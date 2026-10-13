import { Coordinates, GuessResponse } from "@/types/game";
import { calculateHaversineDistance } from "@/lib/geo";
import { computeScoreFromDistance } from "@/lib/scoring";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidCoordinates(value: unknown): value is Coordinates {
  if (!isRecord(value)) return false;
  return (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

export function isValidGuessResponse(
  value: unknown,
  questionId: string,
  expectedGuess: Coordinates
): value is GuessResponse {
  if (!isRecord(value) || !isRecord(value.answer)) return false;
  if (
    value.questionId !== questionId ||
    !isValidCoordinates(value.guess) ||
    !isValidCoordinates(value.answer) ||
    value.guess.latitude !== expectedGuess.latitude ||
    value.guess.longitude !== expectedGuess.longitude ||
    typeof value.distanceMiles !== "number" ||
    !Number.isFinite(value.distanceMiles) ||
    value.distanceMiles < 0 ||
    typeof value.distanceKm !== "number" ||
    !Number.isFinite(value.distanceKm) ||
    typeof value.score !== "number" ||
    !Number.isInteger(value.score) ||
    typeof value.rawScore !== "number" ||
    typeof value.emoji !== "string" ||
    typeof value.ratingTier !== "string" ||
    typeof value.answer.name !== "string" ||
    typeof value.answer.city !== "string" ||
    typeof value.answer.country !== "string" ||
    typeof value.answer.story !== "string" ||
    (value.answer.sourceUrl !== undefined &&
      typeof value.answer.sourceUrl !== "string")
  ) {
    return false;
  }

  const distance = calculateHaversineDistance(value.guess, value.answer);
  if (
    Math.abs(distance.miles - value.distanceMiles) > 0.1 ||
    Math.abs(distance.km - value.distanceKm) > 0.1
  ) {
    return false;
  }

  const score = computeScoreFromDistance(distance.miles);
  return (
    value.score === score.score &&
    value.rawScore === score.rawScore &&
    value.score >= 5 &&
    value.score <= 100
  );
}
