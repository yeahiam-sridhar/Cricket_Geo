import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getPublicRoundByDate } from "@/lib/server-answers";

const { recordSupabaseCompletedGame, supabaseRoundScore } = vi.hoisted(() => ({
  recordSupabaseCompletedGame: vi.fn(),
  supabaseRoundScore: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ hasSupabaseAdmin: true }));
vi.mock("@/lib/supabase-leaderboard", () => ({
  recordSupabaseCompletedGame,
  supabaseRoundScore,
}));

import { POST } from "@/app/api/leaderboard/complete/route";

describe("POST /api/leaderboard/complete", () => {
  beforeEach(() => {
    recordSupabaseCompletedGame.mockReset().mockResolvedValue(true);
    supabaseRoundScore.mockReset().mockResolvedValue(295);
  });

  it("saves the sum of server-scored attempts, ignoring any client score", async () => {
    const date = "2026-10-13";
    const questionIds = getPublicRoundByDate(date)!.questions.map((question) => question.id);
    const response = await POST(
      new NextRequest("http://localhost/api/leaderboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "anonymous-player-123",
          date,
          gameId: "game-123",
          questionIds,
          score: 500,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ score: 295, created: true });
    expect(supabaseRoundScore).toHaveBeenCalledWith(
      "anonymous-player-123",
      "game-123",
      date,
      questionIds
    );
    expect(recordSupabaseCompletedGame).toHaveBeenCalledWith(
      "anonymous-player-123",
      "game-123",
      date,
      295,
      questionIds
    );
  });

  it("rejects duplicate question IDs without saving a leaderboard result", async () => {
    const date = "2026-10-13";
    const questionIds = getPublicRoundByDate(date)!.questions.map((question) => question.id);
    questionIds[4] = questionIds[0];
    const response = await POST(
      new NextRequest("http://localhost/api/leaderboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "anonymous-player-123",
          date,
          gameId: "game-123",
          questionIds,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(supabaseRoundScore).not.toHaveBeenCalled();
    expect(recordSupabaseCompletedGame).not.toHaveBeenCalled();
  });
});
