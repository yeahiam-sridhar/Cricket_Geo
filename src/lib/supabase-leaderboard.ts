import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeDisplayName, type LeaderboardScope } from "@/lib/leaderboard-store";

const kolkataDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const upsertedPlayersCache = new Set<string>();

export async function upsertSupabasePlayer(playerId: string, requestedName: unknown) {
  const displayName = sanitizeDisplayName(requestedName);
  if (!/^[a-zA-Z0-9-]{12,128}$/.test(playerId) || !displayName) throw new Error("Use a display name of 2–24 letters, numbers, spaces, apostrophes, dots, underscores, or hyphens.");
  const cacheKey = `${playerId}:${displayName}`;
  if (upsertedPlayersCache.has(cacheKey)) {
    return { id: playerId, displayName };
  }
  const { error } = await getSupabaseAdmin().from("anonymous_players").upsert({ player_id: playerId, display_name: displayName, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  upsertedPlayersCache.add(cacheKey);
  return { id: playerId, displayName };
}

export async function recordSupabaseAttempt(playerId: string, gameId: string, roundDate: string, questionId: string, score: number) {
  const { error } = await getSupabaseAdmin().from("game_attempts").upsert({ player_id: playerId, game_id: gameId, round_date: roundDate, question_id: questionId, score }, { onConflict: "player_id,game_id,question_id" });
  if (error) throw new Error(error.message);
}
export async function supabaseRoundScore(playerId: string, gameId: string, roundDate: string, questionIds: string[]) {
  const { data, error } = await getSupabaseAdmin().from("game_attempts").select("question_id,score").eq("player_id", playerId).eq("game_id", gameId).eq("round_date", roundDate).in("question_id", questionIds);
  if (error) throw new Error(error.message); const attempts = new Map<string, number>((data || []).map((row: any) => [row.question_id, row.score]));
  if (new Set(questionIds).size !== 5 || !questionIds.every((id) => attempts.has(id))) throw new Error("All five server-scored questions must be completed before ranking.");
  return questionIds.reduce((sum: number, id) => sum + (attempts.get(id) || 0), 0);
}
export async function recordSupabaseCompletedGame(playerId: string, gameId: string, roundDate: string, score: number, questionIds: string[]) {
  const admin = getSupabaseAdmin(); const { data: prior, error: priorError } = await admin.from("completed_games").select("player_id").eq("player_id", playerId).eq("game_id", gameId).maybeSingle();
  if (priorError) throw new Error(priorError.message); if (prior) return false;
  const { error } = await admin.from("completed_games").insert({ player_id: playerId, game_id: gameId, round_date: roundDate, score, question_ids: questionIds });
  if (error) { if (error.code === "23505") return false; throw new Error(error.message); } return true;
}
export async function getSupabaseLeaderboard(scope: LeaderboardScope, page = 1, pageSize = 50) {
  const admin = getSupabaseAdmin(); let query = admin.from("completed_games").select("player_id,round_date,score,completed_at,anonymous_players!inner(display_name)");
  if (scope === "today") query = query.eq("round_date", kolkataDay());
  const { data, error } = await query; if (error) throw new Error(error.message);
  const best = new Map<string, any>(); for (const game of data || []) { const prior = best.get(game.player_id); if (!prior || game.score > prior.score || (game.score === prior.score && game.completed_at < prior.completed_at)) best.set(game.player_id, game); }
  const allGames = data || []; const ranked = [...best.values()].sort((a,b) => b.score-a.score || a.completed_at.localeCompare(b.completed_at) || a.player_id.localeCompare(b.player_id)).map((game,index) => ({ rank:index+1, playerId:game.player_id, displayName:(game.anonymous_players as any).display_name, points:game.score, gamesPlayed:allGames.filter((item: any) => item.player_id === game.player_id).length, achievedAt:game.completed_at }));
  const start = (Math.max(1,page)-1)*pageSize; return { scope, day:kolkataDay(), tieBreak:"Higher score, then earliest qualifying game, then anonymous player ID.", podium:ranked.slice(0,3), entries:ranked.slice(start,start+pageSize), total:ranked.length, hasMore:start+pageSize<ranked.length };
}

