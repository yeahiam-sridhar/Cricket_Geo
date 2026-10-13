import { NextRequest, NextResponse } from "next/server";
import { scoreGuess } from "@/lib/server-answers";
import { GuessRequest } from "@/types/game";
import { recordAuthoritativeAttempt, getAuthoritativeAttempt } from "@/lib/leaderboard-store";
import { hasSupabaseAdmin } from "@/lib/supabase-admin";
import { recordSupabaseAttempt, upsertSupabasePlayer } from "@/lib/supabase-leaderboard";
import { recordQuestionPlayed } from "@/lib/question-history-store";

export async function POST(request: NextRequest) {
  try {
    let body: GuessRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const { date, questionId, guess } = body;

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { error: "Field 'date' (string, YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json(
        { error: "Field 'questionId' is required." },
        { status: 400 }
      );
    }

    if (
      !guess ||
      typeof guess !== "object" ||
      typeof guess.latitude !== "number" ||
      typeof guess.longitude !== "number" ||
      !Number.isFinite(guess.latitude) ||
      !Number.isFinite(guess.longitude)
    ) {
      return NextResponse.json(
        {
          error:
            "Field 'guess' with numeric 'latitude' and 'longitude' is required.",
        },
        { status: 400 }
      );
    }

    if (
      guess.latitude < -90 ||
      guess.latitude > 90 ||
      guess.longitude < -180 ||
      guess.longitude > 180
    ) {
      return NextResponse.json(
        { error: "Coordinates out of bounds. Latitude must be between -90 and 90, Longitude between -180 and 180." },
        { status: 400 }
      );
    }

    const result = scoreGuess(date, questionId, guess);

    // Prevent duplicate submissions and duplicate point awards
    if (body.clientId && body.gameId) {
      // Track player persistent question history (local store update is immediate)
      await recordQuestionPlayed(body.clientId, questionId, body.gameId);

      // Ranked daily round leaderboard attempt recording
      if (!date.startsWith("practice-")) {
        if (hasSupabaseAdmin) {
          const playerPromise = upsertSupabasePlayer(body.clientId, body.displayName);
          const attemptPromise = recordSupabaseAttempt(body.clientId, body.gameId, date, questionId, result.score);
          await Promise.all([playerPromise, attemptPromise]);
        } else {
          const priorAttempt = getAuthoritativeAttempt(body.clientId, body.gameId, questionId);
          if (priorAttempt) {
            return NextResponse.json({
              success: true,
              ...result,
              score: priorAttempt.score,
              isDuplicate: true,
            });
          }
          recordAuthoritativeAttempt({
            playerId: body.clientId,
            gameId: body.gameId,
            roundDate: date,
            questionId,
            score: result.score,
          });
        }
      }
    }



    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const msg = error.message || "An unexpected error occurred.";
    if (msg.includes("not found") || msg.includes("does not belong")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("Invalid guess coordinates")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Error in POST /api/guess:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
