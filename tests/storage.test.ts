import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCompletedResult,
  getInProgressSession,
} from "@/lib/storage";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const oldScoredResult = {
  questionIndex: 0,
  questionId: "P001",
  prompt: "Which ground hosted the match?",
  category: "World Cup",
  difficulty: "Medium",
  guess: { lat: 30, lng: 70 },
  answer: {
    lat: 31.5133615,
    lng: 74.3334644,
    name: "Gaddafi Stadium",
    city: "Lahore",
    country: "Pakistan",
    story: "A match at Lahore.",
  },
  distanceMiles: 100,
  score: 96,
  emoji: "🏆",
  ratingTier: "Perfect Pitch!",
};

describe("coordinate migration for saved games", () => {
  it("normalizes legacy in-progress guess and answer coordinates", () => {
    storage.set(
      "cricket_geo.play.progress",
      JSON.stringify({
        date: "2026-10-13",
        currentQuestionIndex: 1,
        results: [oldScoredResult],
        totalScore: 96,
        isFinished: false,
        lastUpdated: "2026-10-13T10:00:00.000Z",
        gameId: "practice-game-123",
      })
    );

    expect(getInProgressSession("2026-10-13")?.results[0]).toMatchObject({
      guess: { latitude: 30, longitude: 70 },
      answer: { latitude: 31.5133615, longitude: 74.3334644 },
    });
  });

  it("normalizes legacy completed results without changing their score", () => {
    storage.set(
      "cricket_geo.daily_results",
      JSON.stringify({
        "2026-10-13": {
          date: "2026-10-13",
          totalScore: 96,
          maxScore: 500,
          emojis: ["🏆"],
          results: [oldScoredResult],
          completedAt: "2026-10-13T10:00:00.000Z",
        },
      })
    );

    const history = getCompletedResult("2026-10-13");
    expect(history?.totalScore).toBe(96);
    expect(history?.results[0].guess).toEqual({
      latitude: 30,
      longitude: 70,
    });
    expect(history?.results[0].answer).toMatchObject({
      latitude: 31.5133615,
      longitude: 74.3334644,
    });
  });
});
