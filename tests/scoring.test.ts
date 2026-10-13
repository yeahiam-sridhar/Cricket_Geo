import { describe, it, expect } from "vitest";
import { calculateHaversineDistance } from "@/lib/geo";
import { computeScoreFromDistance, sumQuestionScores } from "@/lib/scoring";

describe("Geodesic Distance & Scoring Engine", () => {
  it("calculates accurate distance between Lord's and The Oval (~4.5 miles)", () => {
    // Lord's Cricket Ground (London)
    const lords = { latitude: 51.529603, longitude: -0.172906 };
    // The Oval (London)
    const theOval = { latitude: 51.48361, longitude: -0.115 };

    const { miles, km } = calculateHaversineDistance(lords, theOval);
    expect(miles).toBeGreaterThan(3.5);
    expect(miles).toBeLessThan(5.5);
    expect(km).toBeGreaterThan(6.0);
    expect(km).toBeLessThan(9.0);
  });

  it("calculates accurate distance between London and Melbourne (~10,500 miles)", () => {
    const lords = { latitude: 51.529603, longitude: -0.172906 };
    const mcg = { latitude: -37.82, longitude: 144.98333 };

    const { miles } = calculateHaversineDistance(lords, mcg);
    expect(miles).toBeGreaterThan(10000);
    expect(miles).toBeLessThan(11000);
  });

  it.each([0, 15, 100, 500, 1000, 2000, 3277, 4691, 8000, 12000])(
    "uses the bounded exponential formula at %i miles",
    (distanceMiles) => {
      const details = computeScoreFromDistance(distanceMiles);
      const expected = Math.max(
        5,
        Math.min(100, Math.round(100 * Math.exp(-distanceMiles / 2500)))
      );

      expect(details.score).toBe(expected);
      expect(details.rawScore).toBe(expected);
      expect(details.score).toBeGreaterThanOrEqual(5);
      expect(details.score).toBeLessThanOrEqual(100);
    }
  );

  it("awards 100 at the correct location and retains fair points at long distances", () => {
    expect(computeScoreFromDistance(0).score).toBe(100);
    expect(computeScoreFromDistance(3277).score).toBe(27);
    expect(computeScoreFromDistance(4691).score).toBe(15);
    expect(computeScoreFromDistance(12000).score).toBe(5);
  });

  it("never increases points as distance increases", () => {
    const distances = [0, 15, 100, 500, 1000, 2000, 3277, 4691, 8000, 12000];
    const scores = distances.map((distance) => computeScoreFromDistance(distance).score);
    expect(scores.every((score, index) => index === 0 || score <= scores[index - 1])).toBe(true);
  });

  it("rejects invalid distances instead of manufacturing a score", () => {
    for (const distance of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => computeScoreFromDistance(distance)).toThrow(
        "Distance must be a finite, non-negative number of miles."
      );
    }
  });

  it("sums the five awarded question scores into the exact match total", () => {
    const questionScores = [100, 96, 67, 27, 5];
    expect(sumQuestionScores(questionScores)).toBe(295);
    expect(sumQuestionScores([100, 100, 100, 100, 100])).toBe(500);
  });
});
