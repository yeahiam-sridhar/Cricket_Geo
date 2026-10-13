import {
  Coordinates,
  DailyGameHistory,
  GuessResponse,
  InProgressSession,
  ScoredQuestionResult,
} from "@/types/game";

const KEYS = {
  PROGRESS: "cricket_geo.play.progress",
  HISTORY: "cricket_geo.daily_results",
  CLIENT_ID: "cricket_geo.client_id",
  DISPLAY_NAME: "cricket_geo.display_name",
  PRACTICE_COUNT: "cricket_geo.practice_count",
  SEEN_QUESTIONS: "cricket_geo.seen_questions",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStoredCoordinates(value: unknown): Coordinates | null {
  if (!isRecord(value)) return null;
  const latitude =
    typeof value.latitude === "number" ? value.latitude : value.lat;
  const longitude =
    typeof value.longitude === "number" ? value.longitude : value.lng;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function normalizeStoredResults(value: unknown): ScoredQuestionResult[] | null {
  if (!Array.isArray(value)) return null;
  const results: ScoredQuestionResult[] = [];

  for (const result of value) {
    if (!isRecord(result) || !isRecord(result.answer)) return null;
    const guess = normalizeStoredCoordinates(result.guess);
    const answerCoordinates = normalizeStoredCoordinates(result.answer);
    if (!guess || !answerCoordinates) return null;

    const { answer } = result;
    if (
      typeof result.questionIndex !== "number" ||
      typeof result.questionId !== "string" ||
      typeof result.prompt !== "string" ||
      typeof result.category !== "string" ||
      typeof result.difficulty !== "string" ||
      typeof answer.name !== "string" ||
      typeof answer.city !== "string" ||
      typeof answer.country !== "string" ||
      typeof answer.story !== "string" ||
      typeof result.distanceMiles !== "number" ||
      typeof result.score !== "number" ||
      typeof result.emoji !== "string" ||
      typeof result.ratingTier !== "string"
    ) {
      return null;
    }

    const normalizedAnswer: GuessResponse["answer"] = {
      ...answerCoordinates,
      name: answer.name,
      city: answer.city,
      country: answer.country,
      story: answer.story,
      ...(typeof answer.sourceUrl === "string"
        ? { sourceUrl: answer.sourceUrl }
        : {}),
    };
    results.push({
      questionIndex: result.questionIndex,
      questionId: result.questionId,
      prompt: result.prompt,
      category: result.category,
      difficulty: result.difficulty,
      guess,
      answer: normalizedAnswer,
      distanceMiles: result.distanceMiles,
      score: result.score,
      emoji: result.emoji,
      ratingTier: result.ratingTier,
    });
  }

  return results;
}

function normalizeInProgressSession(value: unknown): InProgressSession | null {
  if (!isRecord(value)) return null;
  const results = normalizeStoredResults(value.results);
  if (
    !results ||
    typeof value.date !== "string" ||
    typeof value.currentQuestionIndex !== "number" ||
    typeof value.totalScore !== "number" ||
    typeof value.isFinished !== "boolean" ||
    typeof value.lastUpdated !== "string" ||
    (value.gameId !== undefined && typeof value.gameId !== "string")
  ) {
    return null;
  }
  return {
    date: value.date,
    currentQuestionIndex: value.currentQuestionIndex,
    results,
    totalScore: value.totalScore,
    isFinished: value.isFinished,
    lastUpdated: value.lastUpdated,
    ...(typeof value.gameId === "string" ? { gameId: value.gameId } : {}),
  };
}

function normalizeDailyHistory(value: unknown): DailyGameHistory | null {
  if (!isRecord(value)) return null;
  const results = normalizeStoredResults(value.results);
  if (
    !results ||
    typeof value.date !== "string" ||
    typeof value.totalScore !== "number" ||
    typeof value.maxScore !== "number" ||
    typeof value.completedAt !== "string" ||
    !Array.isArray(value.emojis) ||
    !value.emojis.every((emoji) => typeof emoji === "string")
  ) {
    return null;
  }
  return {
    date: value.date,
    totalScore: value.totalScore,
    maxScore: value.maxScore,
    emojis: value.emojis,
    results,
    completedAt: value.completedAt,
  };
}

export function getPracticeGameCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(KEYS.PRACTICE_COUNT);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export function incrementPracticeGameCount(): number {
  if (typeof window === "undefined") return 1;
  const next = getPracticeGameCount() + 1;
  localStorage.setItem(KEYS.PRACTICE_COUNT, next.toString());
  return next;
}

export function getRecentlySeenQuestions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.SEEN_QUESTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordSeenQuestions(questionIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentlySeenQuestions();
    const updated = Array.from(new Set([...existing, ...questionIds])).slice(-50);
    localStorage.setItem(KEYS.SEEN_QUESTIONS, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getClientId(): string {
  if (typeof window === "undefined") return "server-id";
  let id = localStorage.getItem(KEYS.CLIENT_ID);
  if (!id) {
    id = "cricket-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now();
    localStorage.setItem(KEYS.CLIENT_ID, id);
  }
  return id;
}

export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.DISPLAY_NAME);
}
export function saveDisplayName(name: string): void {
  if (typeof window !== "undefined") localStorage.setItem(KEYS.DISPLAY_NAME, name.trim());
}

export function getInProgressSession(expectedDate?: string): InProgressSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.PROGRESS);
    if (!raw) return null;
    const session = normalizeInProgressSession(JSON.parse(raw));
    if (!session) return null;
    if (expectedDate && session.date !== expectedDate) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveInProgressSession(session: InProgressSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS.PROGRESS, JSON.stringify(session));
  } catch (err) {
    console.error("Failed to save progress to localStorage", err);
  }
}

export function clearInProgressSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.PROGRESS);
}

export function getCompletedResult(date: string): DailyGameHistory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    if (!raw) return null;
    const history: Record<string, unknown> = JSON.parse(raw);
    return normalizeDailyHistory(history[date]);
  } catch {
    return null;
  }
}

export function saveCompletedResult(result: DailyGameHistory): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    const history: Record<string, DailyGameHistory> = raw ? JSON.parse(raw) : {};
    history[result.date] = result;
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    clearInProgressSession();
  } catch (err) {
    console.error("Failed to save completed result to localStorage", err);
  }
}

export function getAllHistory(): Record<string, DailyGameHistory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    if (!raw) return {};
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return {};
    const history: Record<string, DailyGameHistory> = {};
    for (const [date, result] of Object.entries(stored)) {
      const normalized = normalizeDailyHistory(result);
      if (normalized) history[date] = normalized;
    }
    return history;
  } catch {
    return {};
  }
}

export function getStreakStats(): {
  currentStreak: number;
  bestStreak: number;
  totalGames: number;
  averageScore: number;
} {
  const history = getAllHistory();
  const dates = Object.keys(history).sort();
  const totalGames = dates.length;

  if (totalGames === 0) {
    return { currentStreak: 0, bestStreak: 0, totalGames: 0, averageScore: 0 };
  }

  let totalScore = 0;
  for (const d of dates) {
    totalScore += history[d].totalScore;
  }
  const averageScore = Math.round(totalScore / totalGames);

  // Compute streaks
  let bestStreak = 0;
  let tempStreak = 0;
  let lastTime: number | null = null;

  for (const d of dates) {
    const current = new Date(d + "T00:00:00").getTime();
    if (lastTime === null) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((current - lastTime) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak += 1;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    lastTime = current;
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }

  return {
    currentStreak: tempStreak,
    bestStreak,
    totalGames,
    averageScore,
  };
}
