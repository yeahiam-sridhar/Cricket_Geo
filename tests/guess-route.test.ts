import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getPublicRoundByDate } from "@/lib/server-answers";

const { upsertSupabasePlayer, recordSupabaseAttempt } = vi.hoisted(() => ({
  upsertSupabasePlayer: vi.fn(),
  recordSupabaseAttempt: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  hasSupabaseAdmin: true,
  isSupabaseAdminConfigured: () => false,
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase-leaderboard", () => ({
  upsertSupabasePlayer,
  recordSupabaseAttempt,
}));

import { POST } from "@/app/api/guess/route";

describe("POST /api/guess", () => {
  beforeEach(() => {
    upsertSupabasePlayer.mockReset().mockResolvedValue(undefined);
    recordSupabaseAttempt.mockReset().mockResolvedValue(undefined);
  });

  it("upserts the anonymous profile before recording a daily attempt", async () => {
    const date = "2026-10-13";
    const round = getPublicRoundByDate(date)!;
    const question = round.questions[0];
    const response = await POST(
      new NextRequest("http://localhost/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          questionId: question.id,
          guess: { latitude: 0, longitude: 0 },
          clientId: "anonymous-player-123",
          gameId: "game-123",
          displayName: "Anonymous Fan",
          score: 0,
        }),
      })
    );

    expect(response.status).toBe(200);
    const scoredData = await response.json();
    expect(scoredData.score).toBeGreaterThanOrEqual(5);
    expect(scoredData.score).toBeLessThanOrEqual(100);
    expect(upsertSupabasePlayer).toHaveBeenCalledWith("anonymous-player-123", "Anonymous Fan");
    expect(recordSupabaseAttempt).toHaveBeenCalledWith(
      "anonymous-player-123",
      "game-123",
      date,
      question.id,
      scoredData.score
    );
    expect(upsertSupabasePlayer.mock.invocationCallOrder[0]).toBeLessThan(
      recordSupabaseAttempt.mock.invocationCallOrder[0]
    );
  });

  it("rejects invalid coordinates without returning or recording points", async () => {
    const round = getPublicRoundByDate("2026-10-13")!;
    const response = await POST(
      new NextRequest("http://localhost/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-13",
          questionId: round.questions[0].id,
          guess: { latitude: 91, longitude: 0 },
          clientId: "anonymous-player-123",
          gameId: "game-123",
          displayName: "Anonymous Fan",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(upsertSupabasePlayer).not.toHaveBeenCalled();
    expect(recordSupabaseAttempt).not.toHaveBeenCalled();
  });

  it("does not return a score when the authoritative attempt write fails", async () => {
    recordSupabaseAttempt.mockRejectedValueOnce(new Error("Database write failed."));
    const round = getPublicRoundByDate("2026-10-13")!;
    const response = await POST(
      new NextRequest("http://localhost/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-13",
          questionId: round.questions[0].id,
          guess: { latitude: 0, longitude: 0 },
          clientId: "anonymous-player-123",
          gameId: "game-123",
          displayName: "Anonymous Fan",
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Database write failed." });
  });
});
