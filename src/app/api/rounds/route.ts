import { NextRequest, NextResponse } from "next/server";
import { getPublicRoundByDate, getPublicRounds } from "@/lib/server-answers";
import { practiceRound, generatePlayerPracticeRound } from "@/lib/question-selection";
import { completeReservation } from "@/lib/question-history-store";
import { getKolkataToday, isPracticeDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDate = searchParams.get("date");
    const dateParam = rawDate ? rawDate.trim() : null;
    const isPracticeQuery =
      searchParams.get("practice") === "true" ||
      searchParams.get("practice") === "1" ||
      searchParams.get("mode") === "practice";

    const allRounds = getPublicRounds();

    // 1. Practice Mode (either explicitly via practice flag or via practice-* date identifier)
    if (isPracticeQuery || isPracticeDate(dateParam)) {
      const playerId =
        searchParams.get("playerId")?.trim() ||
        searchParams.get("clientId")?.trim() ||
        searchParams.get("player")?.trim();

      const poolQuestions = allRounds.flatMap((round) => round.questions);

      if (playerId) {
        let gameId = searchParams.get("gameId")?.trim();
        if (!gameId) {
          if (isPracticeDate(dateParam)) {
            gameId = dateParam!;
          } else if (searchParams.get("game")) {
            gameId = `practice-${searchParams.get("game")!.trim()}`;
          } else {
            gameId = `practice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          }
        }

        const { round, cycleReset, cycleNumber } = await generatePlayerPracticeRound(
          playerId,
          gameId,
          poolQuestions
        );

        return NextResponse.json({
          round,
          cycleReset,
          cycleNumber,
          message: cycleReset
            ? "You have completed all eligible questions in the bank! A fresh question cycle has begun."
            : undefined,
        });
      }

      // Legacy fallback when no playerId is provided
      let gameNumber = 0;
      if (isPracticeDate(dateParam)) {
        gameNumber = Math.max(
          0,
          Number.parseInt(dateParam!.replace("practice-", ""), 10) || 0
        );
      } else {
        gameNumber = Math.max(
          0,
          Number.parseInt(searchParams.get("game") || "0", 10) || 0
        );
      }

      const seen = (searchParams.get("seen") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(-50);

      const generatedRound = practiceRound(poolQuestions, gameNumber, seen);
      return NextResponse.json({ round: generatedRound });
    }

    // 2. Archive Summary (when no specific date or practice requested)
    if (!dateParam) {
      const roundsSummary = allRounds.map((r) => ({
        date: r.date,
        questionCount: r.questions.length,
        categories: Array.from(new Set(r.questions.map((q) => q.category))),
      }));

      return NextResponse.json({
        totalRounds: allRounds.length,
        rounds: roundsSummary,
        today: getKolkataToday(),
        firstDate: allRounds[0]?.date,
        latestDate: allRounds[allRounds.length - 1]?.date,
      });
    }

    // 3. Specific Date Round Lookup
    const today = getKolkataToday();
    const isToday = !dateParam || dateParam === today;
    const allowFallback = isToday || searchParams.get("fallback") === "true";

    const round = getPublicRoundByDate(dateParam, allowFallback);
    if (!round) {
      return NextResponse.json(
        {
          error: `Could not find questions for ${dateParam}.`,
          availableDates: allRounds.map((r) => r.date),
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ round });
  } catch (error: any) {
    console.error("Error in GET /api/rounds:", error);
    return NextResponse.json(
      { error: "Internal server error loading rounds." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { playerId, gameId } = body || {};
    if (playerId && gameId) {
      await completeReservation(playerId, gameId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: "Fields 'playerId' and 'gameId' are required." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/rounds:", error);
    return NextResponse.json(
      { error: "Internal server error completing round." },
      { status: 500 }
    );
  }
}
