import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/rounds/route";
import { NextRequest } from "next/server";
import { getPublicRoundByDate, getPublicRounds, scoreGuess } from "@/lib/server-answers";
import { getKolkataToday, isValidDateFormat, isPracticeDate } from "@/lib/dates";
import { selectBalancedQuestions, practiceRound } from "@/lib/question-selection";
import { authoritativeRoundScore, recordAuthoritativeAttempt } from "@/lib/leaderboard-store";

describe("CricketGeo Round Loading and Practice Flow Regression Tests", () => {
  const allRounds = getPublicRounds();
  const allPoolQuestions = allRounds.flatMap((r) => r.questions);
  const expectDifficultyMix = (questions: { difficulty: string }[]) => {
    expect(
      questions.reduce<Record<string, number>>((counts, question) => {
        counts[question.difficulty] = (counts[question.difficulty] || 0) + 1;
        return counts;
      }, {})
    ).toMatchObject({ Easy: 2, Medium: 1, Hard: 2 });
  };

  // 1. Today's round in Asia/Kolkata
  it("determines today's date in Asia/Kolkata and verifies daily round behavior", async () => {
    const today = getKolkataToday();
    expect(isValidDateFormat(today)).toBe(true);

    const req = new NextRequest(`http://localhost:3000/api/rounds?date=${today}`);
    const res = await GET(req);
    const data = await res.json();

    const expectedRound = getPublicRoundByDate(today);
    if (expectedRound) {
      expect(res.status).toBe(200);
      expect(data.round).toBeDefined();
      expect(data.round.date).toBe(today);
      expect(data.round.questions).toHaveLength(5);
      expectDifficultyMix(data.round.questions);
    } else {
      expect(res.status).toBe(404);
      expect(data.error).toContain(`Could not find questions for ${today}`);
    }
  });

  // 2. Historical dates
  it("loads 2026-10-12 correctly with exactly 5 questions", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?date=2026-10-12");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round).toBeDefined();
    expect(data.round.date).toBe("2026-10-12");
    expect(data.round.questions).toHaveLength(5);

    const ids = data.round.questions.map((q: any) => q.id);
    expect(new Set(ids).size).toBe(5);
    expectDifficultyMix(data.round.questions);
  });

  it("serves the requested Asia/Kolkata daily round with the required mix", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?date=2026-10-13");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round.date).toBe("2026-10-13");
    expect(data.round.questions).toHaveLength(5);
    expectDifficultyMix(data.round.questions);
  });

  it("loads another valid historical round (2026-10-15) with 5 distinct questions", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?date=2026-10-15");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round).toBeDefined();
    expect(data.round.date).toBe("2026-10-15");
    expect(data.round.questions).toHaveLength(5);
    expectDifficultyMix(data.round.questions);
  });

  // 3. Missing dates
  it("gracefully returns 404 for a missing historical or future date", async () => {
    const missingDate = "2024-01-01";
    const req = new NextRequest(`http://localhost:3000/api/rounds?date=${missingDate}`);
    const res = await GET(req);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe(`Could not find questions for ${missingDate}.`);
    expect(data.availableDates).toBeDefined();
    expect(Array.isArray(data.availableDates)).toBe(true);
    expect(data.availableDates.length).toBe(60);
  });

  // 4. Invalid dates
  it("gracefully returns 404 with error message for malformed dates", async () => {
    const invalidInputs = ["invalid-date-format", "2026-99-99", "abc"];
    for (const invalid of invalidInputs) {
      const req = new NextRequest(`http://localhost:3000/api/rounds?date=${invalid}`);
      const res = await GET(req);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe(`Could not find questions for ${invalid}.`);
    }
  });

  // 5. Five-question completion and no question-six overflow
  it("strictly enforces five-question round completion and authoritative scoring", () => {
    const round20261012 = getPublicRoundByDate("2026-10-12")!;
    expect(round20261012.questions).toHaveLength(5);

    const playerId = `regression-player-${Date.now()}`;
    const gameId = `regression-game-${Date.now()}`;
    const questionIds = round20261012.questions.map((q) => q.id);

    // Record 5 attempts
    for (const qId of questionIds) {
      recordAuthoritativeAttempt({
        playerId,
        gameId,
        roundDate: "2026-10-12",
        questionId: qId,
        score: 90,
      });
    }

    // Authoritative score computes sum of all 5
    const total = authoritativeRoundScore(playerId, "2026-10-12", gameId, questionIds);
    expect(total).toBe(450);

    // If an invalid 6th question ID is passed or wrong count, it rejects
    const sixQuestions = [...questionIds, "E002"];
    expect(() => authoritativeRoundScore(playerId, "2026-10-12", gameId, sixQuestions)).toThrow(
      "All five server-scored questions must be completed"
    );

    // Index boundary check: question 5 is the last (index 4). Index 5 does not exist.
    expect(round20261012.questions[4]).toBeDefined();
    expect(round20261012.questions[5]).toBeUndefined();
  });

  // 6. Starting another practice round (unlimited 5-question practice flow)
  it("selects balanced, valid 5 questions for practice round 0 and round 1", () => {
    const practice0 = practiceRound(allPoolQuestions, 0, []);
    expect(practice0.date).toBe("practice-0");
    expect(practice0.questions).toHaveLength(5);

    const ids0 = practice0.questions.map((q) => q.id);
    expect(new Set(ids0).size).toBe(5);

    // Round 1 rotates through the other 5 teams
    const practice1 = practiceRound(allPoolQuestions, 1, ids0);
    expect(practice1.date).toBe("practice-1");
    expect(practice1.questions).toHaveLength(5);

    const ids1 = practice1.questions.map((q) => q.id);
    expect(new Set(ids1).size).toBe(5);

    // Between round 0 and round 1, all 10 teams are represented
    const teams0 = new Set(practice0.questions.map((q) => q.featuredTeam));
    const teams1 = new Set(practice1.questions.map((q) => q.featuredTeam));
    const combined = new Set([...teams0, ...teams1]);
    expect(combined.size).toBe(10);
    expectDifficultyMix(practice0.questions);
    expectDifficultyMix(practice1.questions);
  });

  it("serves practice rounds via GET /api/rounds?practice=1&game=0", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?practice=true&game=2");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round).toBeDefined();
    expect(data.round.date).toBe("practice-2");
    expect(data.round.questions).toHaveLength(5);
    expectDifficultyMix(data.round.questions);
  });

  it("serves game 1 practice questions with the required mix through the API", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?practice=true&game=1");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round.date).toBe("practice-1");
    expect(data.round.questions).toHaveLength(5);
    expectDifficultyMix(data.round.questions);
    expect(new Set(data.round.questions.map((q: { featuredTeam: string }) => q.featuredTeam)).size).toBe(5);
  });

  it("serves practice rounds via GET /api/rounds?date=practice-3", async () => {
    const req = new NextRequest("http://localhost:3000/api/rounds?date=practice-3");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.round).toBeDefined();
    expect(data.round.date).toBe("practice-3");
    expect(data.round.questions).toHaveLength(5);
    expectDifficultyMix(data.round.questions);
  });

  it("scores guesses for practice rounds without requiring a date-calendar entry", () => {
    const practice0 = practiceRound(allPoolQuestions, 0, []);
    const firstQ = practice0.questions[0];

    // Score a guess for practice-0
    const scored = scoreGuess("practice-0", firstQ.id, {
      latitude: 0,
      longitude: 0,
    });
    expect(scored.questionId).toBe(firstQ.id);
    expect(scored.score).toBeGreaterThanOrEqual(5);
    expect(scored.answer.name).toBeDefined();
  });
});
