export interface ScoreDetails {
  rawScore: number;
  score: number;
  emoji: string;
  ratingTier: string;
}

export function computeScoreFromDistance(distanceMiles: number): ScoreDetails {
  if (!Number.isFinite(distanceMiles) || distanceMiles < 0) {
    throw new Error("Distance must be a finite, non-negative number of miles.");
  }

  const rawScore = Math.max(
    5,
    Math.min(100, Math.round(100 * Math.exp(-distanceMiles / 2500)))
  );

  let emoji: string;
  let ratingTier: string;

  if (rawScore === 100) {
    emoji = "🏆";
    ratingTier = "Perfect Pitch!";
  } else if (rawScore >= 80) {
    emoji = "🟢";
    ratingTier = "Boundary Hit!";
  } else if (rawScore >= 50) {
    emoji = "🟡";
    ratingTier = "Solid Strike!";
  } else if (rawScore > 5) {
    emoji = "🟠";
    ratingTier = "In the Deep!";
  } else {
    emoji = "🔴";
    ratingTier = "Long Shot!";
  }

  return {
    rawScore,
    score: rawScore,
    emoji,
    ratingTier,
  };
}

export function sumQuestionScores(scores: readonly number[]): number {
  return scores.reduce((total, score) => total + score, 0);
}

/**
 * Strips internal archive prefixes, clue labels, and debug text from question prompts.
 */
export function cleanQuestionPrompt(prompt: string): string {
  if (!prompt || typeof prompt !== "string") return "";
  return prompt
    .replace(/^CricketGeo archive clue:\s*/i, "")
    .replace(/^archive clue:\s*/i, "")
    .replace(/^CricketGeo clue:\s*/i, "")
    .replace(/^Clue:\s*/i, "")
    .trim();
}

