import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/guess/route";
import {
  calculateHaversineDistance,
  getRawGeodesicPoints,
  getRevealCameraPlan,
  splitCoordsAtAntimeridian,
  toMapLibreLngLat,
} from "@/lib/geo";
import { isValidGuessResponse } from "@/lib/guess-validation";
import { getAnswerEntry } from "@/lib/server-answers";
import { computeScoreFromDistance } from "@/lib/scoring";
import { CRICKET_STADIUMS_GEOJSON } from "@/lib/cricket-stadiums";
import { Coordinates } from "@/types/game";

const venues = [
  {
    questionId: "N001",
    name: "Eden Park",
    city: "Auckland",
    country: "New Zealand",
    coordinates: { latitude: -36.8750352, longitude: 174.7440567 },
  },
  {
    questionId: "S005",
    name: "Kingsmead Cricket Ground",
    city: "Durban",
    country: "South Africa",
    coordinates: { latitude: -29.8495671, longitude: 31.0277475 },
  },
  {
    questionId: "P001",
    name: "Gaddafi Stadium",
    city: "Lahore",
    country: "Pakistan",
    coordinates: { latitude: 31.5133615, longitude: 74.3334644 },
  },
  {
    questionId: "B012",
    name: "MA Aziz Stadium",
    city: "Chittagong",
    country: "Bangladesh",
    coordinates: { latitude: 22.3461394, longitude: 91.8256257 },
  },
] satisfies Array<{
  questionId: string;
  name: string;
  city: string;
  country: string;
  coordinates: Coordinates;
}>;

describe("authoritative venue coordinates and reveal targets", () => {
  it.each(venues)(
    "returns correct coordinates and converges all reveal geometry on $name",
    async (venue) => {
      const guess: Coordinates = { latitude: 0, longitude: 0 };
      const response = await POST(
        new NextRequest("http://localhost/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: "practice-0",
            questionId: venue.questionId,
            guess,
          }),
        })
      );

      expect(response.status).toBe(200);
      const scoredResult: unknown = await response.json();
      expect(isValidGuessResponse(scoredResult, venue.questionId, guess)).toBe(
        true
      );
      if (!isValidGuessResponse(scoredResult, venue.questionId, guess)) return;

      const answerKeyEntry = getAnswerEntry(venue.questionId);
      expect(answerKeyEntry).toBeDefined();
      expect(scoredResult.answer).toMatchObject({
        ...venue.coordinates,
        name: venue.name,
        city: venue.city,
        country: venue.country,
      });
      expect(scoredResult.answer.latitude).toBe(answerKeyEntry?.latitude);
      expect(scoredResult.answer.longitude).toBe(answerKeyEntry?.longitude);

      const mapAnswer = toMapLibreLngLat(scoredResult.answer);
      expect(mapAnswer).toEqual([
        venue.coordinates.longitude,
        venue.coordinates.latitude,
      ]);
      const stadiumFeature = CRICKET_STADIUMS_GEOJSON.features.find(
        (feature) => feature.properties.name === venue.name
      );
      expect(stadiumFeature?.properties.city).toBe(venue.city);
      expect(stadiumFeature?.properties.country).toBe(venue.country);
      expect(stadiumFeature?.geometry.coordinates).toEqual(mapAnswer);

      const route = getRawGeodesicPoints(
        toMapLibreLngLat(scoredResult.guess),
        mapAnswer,
        64
      );
      expect(route[0]).toEqual(toMapLibreLngLat(guess));
      expect(route.at(-1)).toEqual(mapAnswer);

      const cameraPlan = getRevealCameraPlan(
        scoredResult.distanceMiles,
        scoredResult.answer
      );
      expect(cameraPlan.cameraTarget).toEqual(scoredResult.answer);
      expect(calculateHaversineDistance(guess, scoredResult.answer).miles).toBe(
        scoredResult.distanceMiles
      );
    }
  );

  it("rejects stale question results and mismatched distance calculations", () => {
    const questionId = "P001";
    const answer = getAnswerEntry(questionId)!;
    const guess = { latitude: 40, longitude: -1 };
    const distance = calculateHaversineDistance(guess, {
      latitude: answer.latitude,
      longitude: answer.longitude,
    });
    const score = computeScoreFromDistance(distance.miles);
    const validResult = {
      questionId,
      answer: {
        latitude: answer.latitude,
        longitude: answer.longitude,
        name: answer.location_name,
        city: answer.city,
        country: answer.physical_country,
        story: answer.story || "",
      },
      guess,
      distanceMiles: distance.miles,
      distanceKm: distance.km,
      rawScore: score.rawScore,
      score: score.score,
      emoji: score.emoji,
      ratingTier: score.ratingTier,
    };

    expect(isValidGuessResponse(validResult, questionId, guess)).toBe(true);
    expect(
      isValidGuessResponse(
        { ...validResult, questionId: "S005" },
        questionId,
        guess
      )
    ).toBe(false);
    expect(
      isValidGuessResponse(
        { ...validResult, distanceMiles: distance.miles + 1 },
        questionId,
        guess
      )
    ).toBe(false);
    expect(
      isValidGuessResponse(
        {
          ...validResult,
          answer: {
            ...validResult.answer,
            latitude: validResult.answer.longitude,
            longitude: validResult.answer.latitude,
          },
        },
        questionId,
        guess
      )
    ).toBe(false);
  });

  it("interpolates short routes and splits globe-spanning routes at the antimeridian", () => {
    const shortPath = getRawGeodesicPoints([174.744, -36.875], [174.745, -36.876], 16);
    expect(shortPath[0]).toEqual([174.744, -36.875]);
    expect(shortPath.at(-1)).toEqual([174.745, -36.876]);
    expect(shortPath[8][0]).not.toBe(shortPath[0][0]);

    const crossingPath = getRawGeodesicPoints([179, 10], [-179, 10], 32);
    const segments = splitCoordsAtAntimeridian(crossingPath);
    expect(segments).toHaveLength(2);
    expect(segments.flatMap((segment) => segment.slice(1).map((point, index) =>
      Math.abs(point[0] - segment[index][0])
    )).every((delta) => delta <= 180)).toBe(true);
    expect(segments[0].at(-1)?.[0]).toBe(180);
    expect(segments[1][0][0]).toBe(-180);
    expect(segments[1].at(-1)).toEqual([-179, 10]);
  });

  it("uses increasingly deliberate journeys while retaining the exact answer target", () => {
    const answer = { latitude: 31.5133615, longitude: 74.3334644 };
    const plans = [20, 600, 3000, 9000].map((miles) =>
      getRevealCameraPlan(miles, answer)
    );

    expect(plans.map((plan) => plan.band)).toEqual([
      "short",
      "regional",
      "continental",
      "global",
    ]);
    expect(plans.map((plan) => plan.answerDuration)).toEqual([
      450, 650, 950, 1300,
    ]);
    expect(plans.every((plan) => plan.cameraTarget === answer)).toBe(true);
  });
});
