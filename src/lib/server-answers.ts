import fs from "fs";
import path from "path";
import {
  AnswerKeyEntry,
  Coordinates,
  GuessResponse,
  PublicRound,
} from "@/types/game";
import { calculateHaversineDistance } from "@/lib/geo";
import { computeScoreFromDistance, cleanQuestionPrompt } from "@/lib/scoring";
import { selectBalancedQuestions } from "@/lib/question-selection";
import { getKolkataToday } from "@/lib/dates";

export { cleanQuestionPrompt };

let cachedPublicRounds: PublicRound[] | null = null;
let cachedAnswerKey: Record<string, AnswerKeyEntry> | null = null;


function loadPublicRounds(): PublicRound[] {
  if (cachedPublicRounds) {
    return cachedPublicRounds;
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "cricket_public_questions.json"
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Public questions file not found at ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(fileContent);
  cachedPublicRounds = (parsed.rounds || []).map((round: PublicRound) => ({
    ...round,
    questions: (round.questions || []).map((q) => ({
      ...q,
      prompt: cleanQuestionPrompt(q.prompt),
    })),
  }));
  return cachedPublicRounds!;
}

function loadAnswerKey(): Record<string, AnswerKeyEntry> {
  if (cachedAnswerKey) {
    return cachedAnswerKey;
  }

  const filePath = path.join(
    process.cwd(),
    "server",
    "data",
    "cricket_answer_key.json"
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Answer key file not found at ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const rawKey = JSON.parse(fileContent);
  const cleanedKey: Record<string, AnswerKeyEntry> = {};
  for (const [id, entry] of Object.entries(rawKey)) {
    cleanedKey[id] = {
      ...(entry as AnswerKeyEntry),
      question: cleanQuestionPrompt((entry as AnswerKeyEntry).question),
    };
  }
  cachedAnswerKey = cleanedKey;
  return cachedAnswerKey!;
}

export function resetPublicRoundsCache(): void {
  cachedPublicRounds = null;
  cachedAnswerKey = null;
}

export function getPublicRounds(): PublicRound[] {
  return loadPublicRounds();
}

export function getPublicRoundByDate(
  targetDate: string,
  allowFallback = false
): PublicRound | null {
  if (!targetDate || typeof targetDate !== "string") return null;
  const cleanDate = targetDate.trim();
  const rounds = loadPublicRounds();
  if (rounds.length === 0) return null;

  const roundIndex = rounds.findIndex((round) => round.date === cleanDate);
  const questions = rounds.flatMap((round) => round.questions);

  if (roundIndex >= 0) {
    return {
      date: cleanDate,
      questions: selectBalancedQuestions(questions, roundIndex),
    };
  }

  // If today's date or explicit fallback allowed, automatically generate valid 5 questions from the bank
  if (allowFallback || cleanDate === getKolkataToday()) {
    let hash = 0;
    for (let i = 0; i < cleanDate.length; i++) {
      hash = ((hash << 5) - hash + cleanDate.charCodeAt(i)) | 0;
    }
    const derivedIndex = Math.abs(hash) % rounds.length;
    return {
      date: cleanDate,
      questions: selectBalancedQuestions(questions, derivedIndex),
    };
  }

  return null;
}

export function getAnswerEntry(questionId: string): AnswerKeyEntry | null {
  const answerKey = loadAnswerKey();
  return answerKey[questionId] || null;
}

export function scoreGuess(
  date: string,
  questionId: string,
  guess: Coordinates
): GuessResponse {
  // Validate coordinates
  if (
    typeof guess.latitude !== "number" ||
    typeof guess.longitude !== "number" ||
    !Number.isFinite(guess.latitude) ||
    !Number.isFinite(guess.longitude) ||
    guess.latitude < -90 ||
    guess.latitude > 90 ||
    guess.longitude < -180 ||
    guess.longitude > 180
  ) {
    throw new Error("Invalid guess coordinates. Must be valid latitude (-90 to 90) and longitude (-180 to 180).");
  }

  // Verify that the question exists in the requested round
  const round = getPublicRoundByDate(date, true);
  if (!round && !date.startsWith("practice-")) {
    throw new Error(`Round for date '${date}' not found.`);
  }

  const questionInRound = round?.questions.find((q) => q.id === questionId);
  if (!questionInRound && !date.startsWith("practice-")) {
    throw new Error(`Question '${questionId}' does not belong to round '${date}'.`);
  }

  // Load ground truth from server answer key
  const answer = getAnswerEntry(questionId);
  if (!answer) {
    throw new Error(`Ground truth answer for question '${questionId}' not found in answer key.`);
  }

  const trueCoords: Coordinates = {
    latitude: answer.latitude,
    longitude: answer.longitude,
  };

  const { miles, km } = calculateHaversineDistance(guess, trueCoords);
  const scoreDetails = computeScoreFromDistance(miles);

  return {
    questionId,
    answer: {
      latitude: answer.latitude,
      longitude: answer.longitude,
      name: answer.location_name || answer.answer,
      city: answer.city,
      country: answer.physical_country,
      story: answer.story || answer.evidence || `Match held at ${answer.location_name}.`,
      sourceUrl: answer.source_url || answer.verification_url,
    },
    guess,
    distanceMiles: miles,
    distanceKm: km,
    rawScore: scoreDetails.rawScore,
    score: scoreDetails.score,
    emoji: scoreDetails.emoji,
    ratingTier: scoreDetails.ratingTier,
  };
}
