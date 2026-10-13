import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const testStore = path.join(os.tmpdir(), `cricketgeo-leaderboard-${Date.now()}.json`);
let board: typeof import("@/lib/leaderboard-store");

beforeAll(async () => {
  process.env.LEADERBOARD_STORE_PATH = testStore;
  board = await import("@/lib/leaderboard-store");
});
afterAll(() => { if (fs.existsSync(testStore)) fs.unlinkSync(testStore); delete process.env.LEADERBOARD_STORE_PATH; });

describe("shared leaderboard repository", () => {
  it("uses display-name validation and maintains each player's highest score", () => {
    const today = board.kolkataDay();
    expect(board.sanitizeDisplayName(" ")).toBeNull();
    const player = board.upsertPlayer("player-identity-0001", "Cover Drive");
    board.recordCompletedGame({ playerId: player.id, gameId: "alpha-one", roundDate: today, score: 420, questionIds: ["a", "b", "c", "d", "e"] });
    board.recordCompletedGame({ playerId: player.id, gameId: "alpha-two", roundDate: today, score: 390, questionIds: ["f", "g", "h", "i", "j"] });
    const ranking = board.getLeaderboard("today");
    expect(ranking.entries[0]).toMatchObject({ displayName: "Cover Drive", points: 420, gamesPlayed: 2 });
  });

  it("ranks ties by earliest qualifying game and rejects duplicate completed submissions", () => {
    const today = board.kolkataDay();
    const second = board.upsertPlayer("player-identity-0002", "Yorker Ace");
    const game = { playerId: second.id, gameId: "beta-one", roundDate: today, score: 420, questionIds: ["k", "l", "m", "n", "o"] };
    expect(board.recordCompletedGame(game).created).toBe(true);
    expect(board.recordCompletedGame(game).created).toBe(false);
    const ranking = board.getLeaderboard("today");
    expect(ranking.entries).toHaveLength(2);
    expect(ranking.entries.map((entry) => entry.points)).toEqual([420, 420]);
    expect(ranking.entries[0].displayName).toBe("Cover Drive");
  });

  it("keeps all-time scores independent from today's ranking", () => {
    const player = board.upsertPlayer("player-identity-0003", "Spin Wizard");
    board.recordCompletedGame({ playerId: player.id, gameId: "spin-one", roundDate: "2020-01-01", score: 500, questionIds: ["p", "q", "r", "s", "t"] });
    expect(board.getLeaderboard("all").entries[0]).toMatchObject({ displayName: "Spin Wizard", points: 500 });
    expect(board.getLeaderboard("today").entries.some((entry) => entry.displayName === "Spin Wizard")).toBe(false);
  });
});
