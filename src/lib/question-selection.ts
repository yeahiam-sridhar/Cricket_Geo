import { PublicQuestion, PublicRound } from "@/types/game";
import {
  withPlayerLock,
  getActiveReservation,
  saveActiveReservation,
  getPlayerCycleNumber,
  getPlayerPlayedQuestions,
  getPlayerActiveReservedQuestionIds,
  advancePlayerCycle,
} from "@/lib/question-history-store";

export const TEAMS = [
  "England",
  "India",
  "Australia",
  "New Zealand",
  "South Africa",
  "Pakistan",
  "West Indies",
  "Bangladesh",
  "Sri Lanka",
  "Afghanistan",
] as const;

export const DIFFICULTY_PATTERN = ["Easy", "Easy", "Medium", "Hard", "Hard"] as const;

/**
 * Selects 5 non-repeating practice questions:
 * - Exactly 5 questions
 * - Exactly 2 Easy, 1 Medium, 2 Hard
 * - 5 distinct featured teams
 * - Balanced team exposure across games
 * - Category diversity
 * - Excludes played and currently reserved question IDs
 * - Returns exhausted: true when the pool cannot form a valid 5-question round
 */
export function selectNonRepeatingPracticeQuestions(
  allQuestions: PublicQuestion[],
  playedQuestionIds: string[],
  reservedQuestionIds: string[] = []
): { questions: PublicQuestion[]; exhausted: boolean } {
  // 1. Deduplicate pool by question ID
  const seenPoolIds = new Set<string>();
  const uniquePool: PublicQuestion[] = [];
  for (const q of allQuestions) {
    if (q && q.id && !seenPoolIds.has(q.id)) {
      seenPoolIds.add(q.id);
      uniquePool.push(q);
    }
  }

  // 2. Exclude previously played and currently reserved questions
  const excluded = new Set([...playedQuestionIds, ...reservedQuestionIds]);
  const available = uniquePool.filter((q) => !excluded.has(q.id));

  const easyAvail = available.filter((q) => q.difficulty === "Easy").length;
  const medAvail = available.filter((q) => q.difficulty === "Medium").length;
  const hardAvail = available.filter((q) => q.difficulty === "Hard").length;

  if (easyAvail < 2 || medAvail < 1 || hardAvail < 2 || available.length < 5) {
    return { questions: [], exhausted: true };
  }

  // 3. Compute play counts per team for balanced exposure
  const teamPlayCount = new Map<string, number>();
  for (const t of TEAMS) teamPlayCount.set(t, 0);
  for (const q of uniquePool) {
    if (q.featuredTeam && playedQuestionIds.includes(q.id)) {
      teamPlayCount.set(q.featuredTeam, (teamPlayCount.get(q.featuredTeam) || 0) + 1);
    }
  }

  // Sort teams ascending by play count (least played teams first)
  const sortedTeams = [...TEAMS].sort(
    (a, b) => (teamPlayCount.get(a) || 0) - (teamPlayCount.get(b) || 0)
  );
  const reqDiffs = ["Easy", "Easy", "Medium", "Hard", "Hard"] as const;

  // 4. Generate 5-team combinations from sortedTeams
  function* getTeamCombos(
    teams: string[],
    k: number,
    start = 0,
    current: string[] = []
  ): Generator<string[]> {
    if (current.length === k) {
      yield current;
      return;
    }
    for (let i = start; i < teams.length; i++) {
      yield* getTeamCombos(teams, k, i + 1, [...current, teams[i]]);
    }
  }

  for (const fiveTeams of getTeamCombos(sortedTeams, 5)) {
    function match(
      teamIdx: number,
      remainingDiffs: string[],
      selected: PublicQuestion[]
    ): PublicQuestion[] | null {
      if (teamIdx === 5) return selected;
      const team = fiveTeams[teamIdx];
      const teamAvail = available.filter((q) => q.featuredTeam === team);
      const uniqueDiffs = [...new Set(remainingDiffs)];

      for (const diff of uniqueDiffs) {
        const cands = teamAvail.filter((q) => q.difficulty === diff);
        if (cands.length > 0) {
          // Sort candidates to maximize category diversity
          const selCategories = new Set(selected.map((s) => s.category));
          const sortedCands = [...cands].sort((a, b) => {
            const aHas = selCategories.has(a.category) ? 1 : 0;
            const bHas = selCategories.has(b.category) ? 1 : 0;
            return aHas - bHas;
          });

          for (const cand of sortedCands) {
            const nextRem = [...remainingDiffs];
            nextRem.splice(nextRem.indexOf(diff), 1);
            const res = match(teamIdx + 1, nextRem, [...selected, cand]);
            if (res) return res;
          }
        }
      }
      return null;
    }

    const matched = match(0, [...reqDiffs], []);
    if (matched && matched.length === 5) {
      return { questions: matched, exhausted: false };
    }
  }

  return { questions: [], exhausted: true };
}

/**
 * Server-orchestrated practice round generator for an anonymous player.
 * Ensures:
 * - Refresh persistence: returns the same questions for an active gameId
 * - No repeats: excludes played and active reserved questions
 * - Safe concurrency: serializes requests per player
 * - Automatic cycle reset when bank is exhausted
 */
export async function generatePlayerPracticeRound(
  playerId: string,
  gameId: string,
  allQuestions: PublicQuestion[]
): Promise<{ round: PublicRound; cycleReset: boolean; cycleNumber: number }> {
  return await withPlayerLock(playerId, async () => {
    // 1. Check if there's already an active reservation for this exact gameId
    const existingReservation = await getActiveReservation(playerId, gameId);
    if (existingReservation && existingReservation.questionIds.length === 5) {
      const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
      const reservedQuestions = existingReservation.questionIds
        .map((id) => questionMap.get(id))
        .filter(Boolean) as PublicQuestion[];
      if (reservedQuestions.length === 5) {
        return {
          round: {
            date: gameId,
            questions: reservedQuestions,
          },
          cycleReset: false,
          cycleNumber: existingReservation.cycleNumber,
        };
      }
    }

    // 2. Fetch player's current cycle & history
    let cycleNumber = await getPlayerCycleNumber(playerId);
    let playedRecords = await getPlayerPlayedQuestions(playerId, cycleNumber);
    let playedIds = playedRecords.map((r) => r.questionId);
    let activeReservedIds = await getPlayerActiveReservedQuestionIds(playerId, gameId);

    // 3. Select non-repeating questions
    let selection = selectNonRepeatingPracticeQuestions(
      allQuestions,
      playedIds,
      activeReservedIds
    );

    let cycleReset = false;
    // 4. If exhausted, advance cycle and select from fresh bank
    if (selection.exhausted) {
      cycleNumber = await advancePlayerCycle(playerId);
      cycleReset = true;
      selection = selectNonRepeatingPracticeQuestions(allQuestions, [], []);
    }

    if (!selection.questions || selection.questions.length !== 5) {
      throw new Error("Unable to select 5 balanced questions from pool.");
    }

    // 5. Save reservation for this gameId
    await saveActiveReservation(
      playerId,
      gameId,
      selection.questions.map((q) => q.id),
      cycleNumber
    );

    return {
      round: {
        date: gameId,
        questions: selection.questions,
      },
      cycleReset,
      cycleNumber,
    };
  });
}

/**
 * Retained for backwards compatibility with legacy tests.
 */
export function selectBalancedQuestions(
  questions: PublicQuestion[],
  gameNumber: number,
  recentlyPlayed: string[] = []
): PublicQuestion[] {
  if (recentlyPlayed && recentlyPlayed.length > 0) {
    const result = selectNonRepeatingPracticeQuestions(questions, recentlyPlayed, []);
    if (!result.exhausted && result.questions.length === 5) {
      return result.questions;
    }
  }

  // Fallback to pool modulo if recentlyPlayed exhausted
  const seenPoolIds = new Set<string>();
  const uniqueQuestions: PublicQuestion[] = [];
  for (const q of questions) {
    if (q && q.id && !seenPoolIds.has(q.id)) {
      seenPoolIds.add(q.id);
      uniqueQuestions.push(q);
    }
  }

  const byTeam = new Map<string, PublicQuestion[]>();
  for (const team of TEAMS) byTeam.set(team, []);
  for (const question of uniqueQuestions) {
    if (question.featuredTeam && byTeam.has(question.featuredTeam)) {
      byTeam.get(question.featuredTeam)!.push(question);
    }
  }

  const safeGameNumber = Math.max(0, Math.floor(Number.isFinite(gameNumber) ? gameNumber : 0));
  const start = (safeGameNumber * 5) % TEAMS.length;
  const patternOffset = safeGameNumber % DIFFICULTY_PATTERN.length;
  const requestedDifficulties = Array.from(
    { length: DIFFICULTY_PATTERN.length },
    (_, index) => DIFFICULTY_PATTERN[(index + patternOffset) % DIFFICULTY_PATTERN.length]
  );
  const remaining = new Map<string, number>([
    ["Easy", 2],
    ["Medium", 1],
    ["Hard", 2],
  ]);
  const selected: PublicQuestion[] = [];

  function select(index: number): boolean {
    if (index === 5) return [...remaining.values()].every((count) => count === 0);

    const team = TEAMS[(start + index) % TEAMS.length];
    const pool = byTeam.get(team) || [];
    const difficultyOrder = [
      ...new Set([
        requestedDifficulties[index],
        ...DIFFICULTY_PATTERN,
      ]),
    ];

    for (const difficulty of difficultyOrder) {
      const count = remaining.get(difficulty) || 0;
      if (count === 0) continue;

      const difficultyPool = pool.filter((question) => question.difficulty === difficulty);
      if (!difficultyPool.length) continue;

      const offset = Math.floor(safeGameNumber / 2) % difficultyPool.length;
      for (let candidateIndex = 0; candidateIndex < difficultyPool.length; candidateIndex += 1) {
        const choice = difficultyPool[(candidateIndex + offset) % difficultyPool.length];
        if (selected.some((s) => s.id === choice.id)) continue;
        selected.push(choice);
        remaining.set(difficulty, count - 1);
        if (select(index + 1)) return true;
        remaining.set(difficulty, count);
        selected.pop();
      }
    }

    return false;
  }

  return select(0) ? selected : uniqueQuestions.slice(0, 5);
}

export function practiceRound(
  questions: PublicQuestion[],
  gameNumber: number,
  recentlyPlayed: string[] = []
): PublicRound {
  const safeGameNumber = Math.max(0, Math.floor(Number.isFinite(gameNumber) ? gameNumber : 0));
  return {
    date: `practice-${safeGameNumber}`,
    questions: selectBalancedQuestions(questions, safeGameNumber, recentlyPlayed),
  };
}
