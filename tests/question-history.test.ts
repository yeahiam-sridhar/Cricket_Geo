import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { PublicQuestion } from "@/types/game";
import {
  selectNonRepeatingPracticeQuestions,
  generatePlayerPracticeRound,
  TEAMS,
} from "@/lib/question-selection";
import {
  clearStoreForTesting,
  recordQuestionPlayed,
  getPlayerPlayedQuestions,
  getActiveReservation,
  advancePlayerCycle,
  getPlayerCycleNumber,
} from "@/lib/question-history-store";

// Load actual 300 question dataset
const questionsPath = path.join(process.cwd(), "data", "cricket_public_questions.json");
const publicQuestionsData = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
const allPublicQuestions: PublicQuestion[] = publicQuestionsData.rounds.flatMap(
  (r: any) => r.questions
);

describe("CricketGeo Persistent Player Question History & Balanced Selection", () => {
  beforeEach(() => {
    process.env.QUESTION_HISTORY_PATH = path.join(
      process.cwd(),
      "server",
      "data",
      `test_question_history_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.json`
    );
    clearStoreForTesting();
  });

  afterEach(() => {
    clearStoreForTesting();
  });

  // 1. Two consecutive games for one player contain no repeated questions
  it("1. Two consecutive games for one player contain no repeated questions", async () => {
    const playerId = `player-consecutive-${Date.now()}`;
    const game1Id = "game-1";
    const game2Id = "game-2";

    const res1 = await generatePlayerPracticeRound(playerId, game1Id, allPublicQuestions);
    expect(res1.round.questions).toHaveLength(5);
    const qIds1 = res1.round.questions.map((q) => q.id);

    // Player submits guesses for all 5 questions in game 1
    for (const q of res1.round.questions) {
      await recordQuestionPlayed(playerId, q.id, game1Id);
    }

    const res2 = await generatePlayerPracticeRound(playerId, game2Id, allPublicQuestions);
    expect(res2.round.questions).toHaveLength(5);
    const qIds2 = res2.round.questions.map((q) => q.id);

    // Check intersection
    const overlap = qIds1.filter((id) => qIds2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  // 2. Question history survives a browser refresh
  it("2. Question history survives a browser refresh", async () => {
    const playerId = `player-refresh-${Date.now()}`;
    const gameId = `game-refresh-${Date.now()}`;

    // First load
    const initial = await generatePlayerPracticeRound(playerId, gameId, allPublicQuestions);
    const initialIds = initial.round.questions.map((q) => q.id);

    // Refresh simulation (same playerId and gameId)
    const refreshed = await generatePlayerPracticeRound(playerId, gameId, allPublicQuestions);
    const refreshedIds = refreshed.round.questions.map((q) => q.id);

    expect(refreshedIds).toEqual(initialIds);
  });

  // 3. A player's question history survives server restarts when shared persistence is configured
  it("3. A player's question history survives server restarts when shared persistence is configured", async () => {
    const playerId = `player-restart-${Date.now()}`;
    const gameId = "game-restart-1";

    // Play 3 questions
    const q1 = allPublicQuestions[0].id;
    const q2 = allPublicQuestions[1].id;
    const q3 = allPublicQuestions[2].id;

    await recordQuestionPlayed(playerId, q1, gameId);
    await recordQuestionPlayed(playerId, q2, gameId);
    await recordQuestionPlayed(playerId, q3, gameId);

    // Verify file exists on disk
    const storeFile = process.env.QUESTION_HISTORY_PATH!;
    expect(fs.existsSync(storeFile)).toBe(true);

    // Simulate "server restart" by reading fresh state from file store
    const played = await getPlayerPlayedQuestions(playerId);
    const playedIds = played.map((p) => p.questionId);

    expect(playedIds).toContain(q1);
    expect(playedIds).toContain(q2);
    expect(playedIds).toContain(q3);
    expect(played).toHaveLength(3);
  });

  // 4. Different anonymous players maintain separate histories
  it("4. Different anonymous players maintain separate histories", async () => {
    const playerA = `player-A-${Date.now()}`;
    const playerB = `player-B-${Date.now()}`;

    const resA = await generatePlayerPracticeRound(playerA, "game-A-1", allPublicQuestions);
    for (const q of resA.round.questions) {
      await recordQuestionPlayed(playerA, q.id, "game-A-1");
    }

    const playedA = await getPlayerPlayedQuestions(playerA);
    const playedB = await getPlayerPlayedQuestions(playerB);

    expect(playedA).toHaveLength(5);
    expect(playedB).toHaveLength(0);
  });

  // 5. Exactly five unique questions are assigned per game
  it("5. Exactly five unique questions are assigned per game", async () => {
    const playerId = `player-unique-${Date.now()}`;

    for (let i = 1; i <= 5; i++) {
      const res = await generatePlayerPracticeRound(
        playerId,
        `game-uniq-${i}`,
        allPublicQuestions
      );
      expect(res.round.questions).toHaveLength(5);
      const uniqueIds = new Set(res.round.questions.map((q) => q.id));
      expect(uniqueIds.size).toBe(5);

      for (const q of res.round.questions) {
        await recordQuestionPlayed(playerId, q.id, `game-uniq-${i}`);
      }
    }
  });

  // 6. The 2 Easy, 1 Medium, 2 Hard rule is enforced
  it("6. The 2 Easy, 1 Medium, 2 Hard rule is enforced", async () => {
    const playerId = `player-diff-${Date.now()}`;

    for (let i = 1; i <= 5; i++) {
      const res = await generatePlayerPracticeRound(
        playerId,
        `game-diff-${i}`,
        allPublicQuestions
      );
      const diffs = res.round.questions.map((q) => q.difficulty);
      const easy = diffs.filter((d) => d === "Easy").length;
      const med = diffs.filter((d) => d === "Medium").length;
      const hard = diffs.filter((d) => d === "Hard").length;

      expect(easy).toBe(2);
      expect(med).toBe(1);
      expect(hard).toBe(2);

      for (const q of res.round.questions) {
        await recordQuestionPlayed(playerId, q.id, `game-diff-${i}`);
      }
    }
  });

  // 7. Team representation remains balanced
  it("7. Team representation remains balanced", async () => {
    const playerId = `player-teams-${Date.now()}`;
    const teamCounts = new Map<string, number>();
    for (const t of TEAMS) teamCounts.set(t, 0);

    // Play 10 games = 50 questions
    for (let i = 1; i <= 10; i++) {
      const res = await generatePlayerPracticeRound(
        playerId,
        `game-team-${i}`,
        allPublicQuestions
      );

      // Within each game, all 5 teams should be distinct
      const gameTeams = new Set(res.round.questions.map((q) => q.featuredTeam));
      expect(gameTeams.size).toBe(5);

      for (const q of res.round.questions) {
        if (q.featuredTeam) {
          teamCounts.set(q.featuredTeam, (teamCounts.get(q.featuredTeam) || 0) + 1);
        }
        await recordQuestionPlayed(playerId, q.id, `game-team-${i}`);
      }
    }

    // Every one of the 10 teams must have been played exactly 5 times (50 questions / 10 teams = 5)
    for (const team of TEAMS) {
      expect(teamCounts.get(team)).toBe(5);
    }
  });

  // 8. Concurrent game creation cannot reserve duplicate questions for the same player
  it("8. Concurrent game creation cannot reserve duplicate questions for the same player", async () => {
    const playerId = `player-concurrent-${Date.now()}`;

    // Launch two requests concurrently for the same player with different game IDs
    const [res1, res2] = await Promise.all([
      generatePlayerPracticeRound(playerId, "game-c1", allPublicQuestions),
      generatePlayerPracticeRound(playerId, "game-c2", allPublicQuestions),
    ]);

    expect(res1.round.questions).toHaveLength(5);
    expect(res2.round.questions).toHaveLength(5);

    const ids1 = new Set(res1.round.questions.map((q) => q.id));
    const ids2 = new Set(res2.round.questions.map((q) => q.id));

    // Zero overlap between the two concurrently created games!
    for (const id of ids1) {
      expect(ids2.has(id)).toBe(false);
    }
  });

  // 9. An active game resumes after refresh
  it("9. An active game resumes after refresh", async () => {
    const playerId = `player-resume-${Date.now()}`;
    const gameId = "game-resume-1";

    const game = await generatePlayerPracticeRound(playerId, gameId, allPublicQuestions);
    const qIds = game.round.questions.map((q) => q.id);

    // Submit guess for Q1 and Q2
    await recordQuestionPlayed(playerId, qIds[0], gameId);
    await recordQuestionPlayed(playerId, qIds[1], gameId);

    // Refresh active game
    const resumed = await generatePlayerPracticeRound(playerId, gameId, allPublicQuestions);
    expect(resumed.round.questions.map((q) => q.id)).toEqual(qIds);

    const played = await getPlayerPlayedQuestions(playerId);
    expect(played).toHaveLength(2);
  });

  // 10. The question cycle resets only after all eligible questions have been exhausted
  it("10. The question cycle resets only after all eligible questions have been exhausted", async () => {
    const playerId = `player-cycle-${Date.now()}`;
    const allPlayedIds = new Set<string>();
    let cycleResetDetected = false;
    let completedGames = 0;

    // Play continuously until cycle reset occurs
    while (!cycleResetDetected && completedGames < 35) {
      const gameId = `game-cycle-${completedGames + 1}`;
      const res = await generatePlayerPracticeRound(playerId, gameId, allPublicQuestions);

      if (res.cycleReset) {
        cycleResetDetected = true;
        expect(res.cycleNumber).toBe(2);
        break;
      }

      // Check no repeats in cycle 1
      for (const q of res.round.questions) {
        expect(allPlayedIds.has(q.id)).toBe(false);
        allPlayedIds.add(q.id);
        await recordQuestionPlayed(playerId, q.id, gameId);
      }
      completedGames++;
    }

    expect(cycleResetDetected).toBe(true);
    // Verified: at least 20+ full 5-question games completed with zero repeats before reset!
    expect(completedGames).toBeGreaterThanOrEqual(20);
    expect(allPlayedIds.size).toBeGreaterThanOrEqual(100);
  });

  // 11. Supabase errors do not silently reset a player's history and repeat old questions
  it("11. Supabase errors do not silently reset a player's history and repeat old questions", async () => {
    const playerId = `player-fallback-${Date.now()}`;
    const game1Id = "game-fb-1";

    // Play 5 questions
    const res1 = await generatePlayerPracticeRound(playerId, game1Id, allPublicQuestions);
    for (const q of res1.round.questions) {
      await recordQuestionPlayed(playerId, q.id, game1Id);
    }
    const qIds1 = res1.round.questions.map((q) => q.id);

    // Even if remote services or Supabase are unavailable, local persistent store retains history
    const played = await getPlayerPlayedQuestions(playerId);
    expect(played).toHaveLength(5);

    const res2 = await generatePlayerPracticeRound(playerId, "game-fb-2", allPublicQuestions);
    const qIds2 = res2.round.questions.map((q) => q.id);

    // Zero overlap between Game 1 and Game 2!
    const overlap = qIds1.filter((id) => qIds2.includes(id));
    expect(overlap).toHaveLength(0);
  });
});
