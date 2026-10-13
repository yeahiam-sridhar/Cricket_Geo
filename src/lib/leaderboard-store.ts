import fs from "fs";
import path from "path";

export type LeaderboardScope = "today" | "all";
export interface PlayerRecord { id: string; displayName: string; createdAt: string; updatedAt: string; }
export interface CompletedGame { id: string; playerId: string; roundDate: string; score: number; completedAt: string; questionIds: string[]; }
interface Attempt { playerId: string; gameId: string; roundDate: string; questionId: string; score: number; recordedAt: string; }
interface Store { players: Record<string, PlayerRecord>; games: CompletedGame[]; attempts?: Attempt[]; }

const storePath = process.env.LEADERBOARD_STORE_PATH || path.join(process.cwd(), "server", "data", "leaderboard.json");
export const kolkataDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const read = (): Store => {
  try { return JSON.parse(fs.readFileSync(storePath, "utf8")); } catch { return { players: {}, games: [] }; }
};
const write = (store: Store) => {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
};

export function sanitizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{N} ._'-]{2,24}$/u.test(name) ? name : null;
}
export function upsertPlayer(id: string, requestedName: unknown) {
  const name = sanitizeDisplayName(requestedName);
  if (!/^[a-zA-Z0-9-]{12,128}$/.test(id) || !name) throw new Error("Use a display name of 2–24 letters, numbers, spaces, apostrophes, dots, underscores, or hyphens.");
  const store = read(); const now = new Date().toISOString();
  store.players[id] = { id, displayName: name, createdAt: store.players[id]?.createdAt || now, updatedAt: now };
  write(store); return store.players[id];
}
export function recordCompletedGame(game: Omit<CompletedGame, "id" | "completedAt"> & { gameId: string }) {
  const store = read();
  if (!store.players[game.playerId]) throw new Error("Choose a display name before joining the leaderboard.");
  const id = `${game.playerId}:${game.gameId}`;
  if (store.games.some((existing) => existing.id === id)) return { game: store.games.find((existing) => existing.id === id)!, created: false };
  const completed = { ...game, id, completedAt: new Date().toISOString() };
  store.games.push(completed); write(store); return { game: completed, created: true };
}
export function getAuthoritativeAttempt(playerId: string, gameId: string, questionId: string): Attempt | null {
  const store = read();
  return store.attempts?.find((item) => item.playerId === playerId && item.gameId === gameId && item.questionId === questionId) || null;
}
export function recordAuthoritativeAttempt(attempt: Omit<Attempt, "score" | "recordedAt"> & { score: number }) {
  const store = read(); store.attempts ||= [];
  const index = store.attempts.findIndex((item) => item.playerId === attempt.playerId && item.gameId === attempt.gameId && item.questionId === attempt.questionId);
  const saved = { ...attempt, recordedAt: new Date().toISOString() };
  if (index >= 0) store.attempts[index] = saved; else store.attempts.push(saved);
  write(store);
}
export function authoritativeRoundScore(playerId: string, roundDate: string, gameId: string, questionIds: string[]) {
  const attempts = read().attempts || [];
  const byQuestion = new Map(attempts.filter((item) => item.playerId === playerId && item.roundDate === roundDate && item.gameId === gameId).map((item) => [item.questionId, item]));
  if (new Set(questionIds).size !== 5 || !questionIds.every((id) => byQuestion.has(id))) throw new Error("All five server-scored questions must be completed before ranking.");
  return questionIds.reduce((total, id) => total + byQuestion.get(id)!.score, 0);
}
export function getLeaderboard(scope: LeaderboardScope, page = 1, pageSize = 50) {
  const store = read(); const today = kolkataDay();
  const relevant = store.games.filter((game) => scope === "all" || game.roundDate === today);
  const bestByPlayer = new Map<string, CompletedGame>();
  for (const game of relevant) {
    const prior = bestByPlayer.get(game.playerId);
    if (!prior || game.score > prior.score || (game.score === prior.score && game.completedAt < prior.completedAt)) bestByPlayer.set(game.playerId, game);
  }
  const rows = [...bestByPlayer.values()].map((best) => ({ player: store.players[best.playerId], best, gamesPlayed: store.games.filter((g) => g.playerId === best.playerId && (scope === "all" || g.roundDate === today)).length }))
    .filter((row) => row.player)
    .sort((a, b) => b.best.score - a.best.score || a.best.completedAt.localeCompare(b.best.completedAt) || a.player.id.localeCompare(b.player.id));
  const ranked = rows.map((row, index) => ({ rank: index + 1, playerId: row.player.id, displayName: row.player.displayName, points: row.best.score, gamesPlayed: row.gamesPlayed, achievedAt: row.best.completedAt }));
  const safePage = Math.max(1, page); const start = (safePage - 1) * pageSize;
  return { scope, day: today, tieBreak: "Higher score, then earliest qualifying game, then anonymous player ID.", podium: ranked.slice(0, 3), entries: ranked.slice(start, start + pageSize), total: ranked.length, hasMore: start + pageSize < ranked.length };
}
