import { NextRequest, NextResponse } from "next/server";
import { authoritativeRoundScore, recordCompletedGame } from "@/lib/leaderboard-store";
import { hasSupabaseAdmin } from "@/lib/supabase-admin";
import { recordSupabaseCompletedGame, supabaseRoundScore } from "@/lib/supabase-leaderboard";
import { getPublicRoundByDate } from "@/lib/server-answers";

export async function POST(request: NextRequest) {
  try {
    const { playerId, date, gameId, questionIds } = await request.json();
    if (typeof playerId !== "string" || typeof date !== "string" || typeof gameId !== "string" || !Array.isArray(questionIds)) throw new Error("Invalid completed-game request.");
    const round = getPublicRoundByDate(date, true);
    if (!round || round.questions.length !== 5 || questionIds.length !== 5 || new Set(questionIds).size !== 5 || !questionIds.every((id) => round.questions.some((question) => question.id === id))) throw new Error("Only a valid five-question round can be ranked.");
    const score = hasSupabaseAdmin ? await supabaseRoundScore(playerId, gameId, date, questionIds) : authoritativeRoundScore(playerId, date, gameId, questionIds);
    const created = hasSupabaseAdmin ? await recordSupabaseCompletedGame(playerId, gameId, date, score, questionIds) : recordCompletedGame({ playerId, gameId, roundDate: date, score, questionIds }).created;
    return NextResponse.json({ score, created });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not record completed game." }, { status: 400 }); }
}
