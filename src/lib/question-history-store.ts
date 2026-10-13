import fs from "fs";
import path from "path";
import { isSupabaseAdminConfigured, getSupabaseAdmin } from "@/lib/supabase-admin";

export interface PlayerHistoryRecord {
  playerId: string;
  questionId: string;
  firstPlayedAt: string;
  gameId: string;
  lastPlayedAt: string;
  cycleNumber: number;
}

export interface ActiveReservationRecord {
  playerId: string;
  gameId: string;
  questionIds: string[];
  cycleNumber: number;
  reservedAt: string;
  completed: boolean;
}

interface PlayerState {
  cycleNumber: number;
  history: Record<string, PlayerHistoryRecord>; // key: questionId
}

interface QuestionHistoryFileStore {
  players: Record<string, PlayerState>;
  reservations: Record<string, ActiveReservationRecord>; // key: `${playerId}:${gameId}`
}

function getStorePath(): string {
  return (
    process.env.QUESTION_HISTORY_PATH ||
    path.join(process.cwd(), "server", "data", "player_question_history.json")
  );
}

// In-memory per-player mutex to prevent concurrent game generation race conditions
const playerLocks = new Map<string, Promise<void>>();

export async function withPlayerLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = playerLocks.get(playerId) || Promise.resolve();
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  playerLocks.set(playerId, currentLock.then(() => nextLock));

  await currentLock;
  try {
    return await fn();
  } finally {
    release!();
    if (playerLocks.get(playerId) === nextLock) {
      playerLocks.delete(playerId);
    }
  }
}

function readFileStore(): QuestionHistoryFileStore {
  const storePath = getStorePath();
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, "utf8");
      const parsed = JSON.parse(raw);
      return {
        players: parsed.players || {},
        reservations: parsed.reservations || {},
      };
    }
  } catch (err) {
    console.warn("Could not read question history file store, initializing fresh store:", err);
  }
  return { players: {}, reservations: {} };
}

function writeFileStore(store: QuestionHistoryFileStore): void {
  const storePath = getStorePath();
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write question history file store:", err);
  }
}

/**
 * Returns the current cycle number for a player (defaults to 1).
 */
export async function getPlayerCycleNumber(playerId: string): Promise<number> {
  const store = readFileStore();
  const player = store.players[playerId];
  return player?.cycleNumber || 1;
}

/**
 * Gets all questions played by a player in their current (or specified) cycle.
 */
export async function getPlayerPlayedQuestions(
  playerId: string,
  cycleNumber?: number
): Promise<PlayerHistoryRecord[]> {
  const store = readFileStore();
  const targetCycle = cycleNumber ?? (store.players[playerId]?.cycleNumber || 1);

  // If Supabase is configured, attempt to query remote table
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("player_question_history")
        .select("player_id, question_id, first_played_at, game_id, last_played_at, cycle_number")
        .eq("player_id", playerId)
        .eq("cycle_number", targetCycle);

      if (!error && Array.isArray(data)) {
        // Merge with local store to ensure durability
        const records: PlayerHistoryRecord[] = data.map((r) => ({
          playerId: r.player_id,
          questionId: r.question_id,
          firstPlayedAt: r.first_played_at,
          gameId: r.game_id,
          lastPlayedAt: r.last_played_at,
          cycleNumber: r.cycle_number,
        }));
        // Update local file store cache
        store.players[playerId] ||= { cycleNumber: targetCycle, history: {} };
        for (const rec of records) {
          store.players[playerId].history[rec.questionId] = rec;
        }
        writeFileStore(store);
        return records;
      } else if (error) {
        // Supabase error: do not reset or discard local history!
        console.warn("Supabase query for question history failed; using local persistent store:", error.message);
      }
    } catch (err: any) {
      console.warn("Error accessing Supabase question history; using local persistent store:", err?.message);
    }
  }

  // Local persistent fallback
  const playerState = store.players[playerId];
  if (!playerState || !playerState.history) return [];

  return Object.values(playerState.history).filter((rec) => rec.cycleNumber === targetCycle);
}

/**
 * Gets all question IDs reserved in active (uncompleted) games for a player.
 */
export async function getPlayerActiveReservedQuestionIds(
  playerId: string,
  excludeGameId?: string
): Promise<string[]> {
  const store = readFileStore();
  const reservedIds: string[] = [];
  const currentCycle = store.players[playerId]?.cycleNumber || 1;

  for (const reservation of Object.values(store.reservations)) {
    if (
      reservation.playerId === playerId &&
      reservation.cycleNumber === currentCycle &&
      !reservation.completed &&
      (!excludeGameId || reservation.gameId !== excludeGameId)
    ) {
      reservedIds.push(...reservation.questionIds);
    }
  }

  return Array.from(new Set(reservedIds));
}

/**
 * Retrieves an existing reservation for a specific game ID.
 */
export async function getActiveReservation(
  playerId: string,
  gameId: string
): Promise<ActiveReservationRecord | null> {
  const store = readFileStore();
  const key = `${playerId}:${gameId}`;
  const existing = store.reservations[key];
  if (existing) return existing;

  // Check Supabase if configured
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("active_game_reservations")
        .select("player_id, game_id, question_ids, cycle_number, reserved_at, completed")
        .eq("player_id", playerId)
        .eq("game_id", gameId)
        .maybeSingle();

      if (!error && data) {
        const record: ActiveReservationRecord = {
          playerId: data.player_id,
          gameId: data.game_id,
          questionIds: Array.isArray(data.question_ids) ? data.question_ids : [],
          cycleNumber: data.cycle_number,
          reservedAt: data.reserved_at,
          completed: Boolean(data.completed),
        };
        store.reservations[key] = record;
        writeFileStore(store);
        return record;
      }
    } catch (err) {
      // Ignore and return null
    }
  }

  return null;
}

/**
 * Creates or updates an active game reservation.
 */
export async function saveActiveReservation(
  playerId: string,
  gameId: string,
  questionIds: string[],
  cycleNumber: number
): Promise<ActiveReservationRecord> {
  const store = readFileStore();
  const key = `${playerId}:${gameId}`;
  const now = new Date().toISOString();

  const record: ActiveReservationRecord = {
    playerId,
    gameId,
    questionIds,
    cycleNumber,
    reservedAt: now,
    completed: false,
  };

  store.reservations[key] = record;
  writeFileStore(store);

  // Attempt to write to Supabase if configured
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("active_game_reservations").upsert({
        player_id: playerId,
        game_id: gameId,
        question_ids: questionIds,
        cycle_number: cycleNumber,
        reserved_at: now,
        completed: false,
      });
    } catch (err: any) {
      console.warn("Supabase reservation save error (falling back to local store):", err?.message);
    }
  }

  return record;
}

/**
 * Marks a game reservation as completed.
 */
export async function completeReservation(playerId: string, gameId: string): Promise<void> {
  const store = readFileStore();
  const key = `${playerId}:${gameId}`;
  if (store.reservations[key]) {
    store.reservations[key].completed = true;
    writeFileStore(store);
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      await admin
        .from("active_game_reservations")
        .update({ completed: true })
        .eq("player_id", playerId)
        .eq("game_id", gameId);
    } catch {
      // Ignore
    }
  }
}

/**
 * Records that a question has been played (invoked when a valid guess is submitted).
 */
export async function recordQuestionPlayed(
  playerId: string,
  questionId: string,
  gameId: string
): Promise<PlayerHistoryRecord> {
  const store = readFileStore();
  store.players[playerId] ||= { cycleNumber: 1, history: {} };
  const player = store.players[playerId];
  const now = new Date().toISOString();

  const existing = player.history[questionId];
  const record: PlayerHistoryRecord = {
    playerId,
    questionId,
    firstPlayedAt: existing?.firstPlayedAt || now,
    gameId,
    lastPlayedAt: now,
    cycleNumber: player.cycleNumber,
  };

  player.history[questionId] = record;
  writeFileStore(store);

  // Attempt to write to Supabase asynchronously if configured
  if (isSupabaseAdminConfigured()) {
    void (async () => {
      try {
        const admin = getSupabaseAdmin();
        await admin.from("player_question_history").upsert(
          {
            player_id: playerId,
            question_id: questionId,
            first_played_at: record.firstPlayedAt,
            game_id: gameId,
            last_played_at: now,
            cycle_number: player.cycleNumber,
          },
          { onConflict: "player_id,question_id,cycle_number" }
        );
      } catch (err: any) {
        console.warn("Supabase record question played error (safely retained locally):", err?.message);
      }
    })();
  }

  return record;
}

/**
 * Advances the player's cycle when all eligible questions have been exhausted.
 */
export async function advancePlayerCycle(playerId: string): Promise<number> {
  const store = readFileStore();
  store.players[playerId] ||= { cycleNumber: 1, history: {} };
  store.players[playerId].cycleNumber += 1;
  const newCycle = store.players[playerId].cycleNumber;

  // Clear uncompleted active reservations for this player
  for (const [key, res] of Object.entries(store.reservations)) {
    if (res.playerId === playerId && !res.completed) {
      delete store.reservations[key];
    }
  }

  writeFileStore(store);
  return newCycle;
}

/**
 * Helper for tests to clean up local store.
 */
export function clearStoreForTesting(): void {
  const storePath = getStorePath();
  try {
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }
  } catch {
    // Ignore
  }
}
