import { describe, it, expect } from "vitest";
import { getPublicRoundByDate, scoreGuess } from "@/lib/server-answers";

describe("Server-Side Answer Checking and Guess Scoring API Logic", () => {
  it("retrieves round by date and finds questions", () => {
    const round = getPublicRoundByDate("2026-10-12");
    expect(round).toBeDefined();
    expect(round?.questions.length).toBe(5);
  });

  const firstRound = getPublicRoundByDate("2026-10-12")!;
  const firstQuestion = firstRound.questions[0];
  const answerKey = JSON.parse(require("fs").readFileSync("server/data/cricket_answer_key.json", "utf8"));
  const firstAnswer = answerKey[firstQuestion.id];

  it("scores an exact hit with 100 points", () => {
    const guess = { latitude: firstAnswer.latitude, longitude: firstAnswer.longitude };
    const result = scoreGuess("2026-10-12", firstQuestion.id, guess);

    expect(result.questionId).toBe(firstQuestion.id);
    expect(result.distanceMiles).toBe(0);
    expect(result.score).toBe(100);
    expect(result.emoji).toBe("🏆");
    expect(result.answer.name).toBe(firstAnswer.location_name);
    expect(result.answer.city).toBe(firstAnswer.city);
    expect(result.answer.country).toBe(firstAnswer.physical_country);
  });

  it("scores a nearby guess (~10 miles away) with 100 points (bullseye zone)", () => {
    const guess = { latitude: firstAnswer.latitude + 0.05, longitude: firstAnswer.longitude + 0.05 };
    const result = scoreGuess("2026-10-12", firstQuestion.id, guess);

    expect(result.distanceMiles).toBeLessThanOrEqual(15);
    expect(result.score).toBe(100);
    expect(result.emoji).toBe("🏆");
  });

  it("scores a valid distant guess with the five-point minimum", () => {
    // Guess in Sydney, Australia instead of Mumbai
    const guess = { latitude: -33.8688, longitude: 151.2093 };
    const result = scoreGuess("2026-10-12", firstQuestion.id, guess);

    expect(result.distanceMiles).toBeGreaterThan(5000);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.emoji).toBe("🔴");
    expect(result.ratingTier).toBe("Long Shot!");
  });

  it("throws validation error for invalid latitude", () => {
    const badGuess = { latitude: 105, longitude: 72 };
    expect(() => scoreGuess("2026-10-12", firstQuestion.id, badGuess)).toThrow("Invalid guess coordinates");
  });

  it("throws error if question does not belong to the requested round date", () => {
    const guess = { latitude: 18.9, longitude: 72.8 };
    expect(() => scoreGuess("2026-10-12", "NON_EXISTENT_ID", guess)).toThrow("does not belong to round");
  });
});
