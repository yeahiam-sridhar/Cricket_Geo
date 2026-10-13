export interface PublicQuestion {
  id: string;
  prompt: string;
  map: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Very Hard" | string;
  category: string;
  featuredTeam?: string;
  verification?: {
    eventSourceUrl: string;
    venueSourceUrl: string;
    locationSourceUrl: string;
  };
}

export interface PublicRound {
  date: string;
  questions: PublicQuestion[];
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GuessRequest {
  date: string;
  questionId: string;
  guess: Coordinates;
  clientId?: string;
  gameId?: string;
  displayName?: string | null;
}

export interface AnswerKeyEntry {
  id: string;
  original_id?: string;
  question: string;
  answer: string;
  location_name: string;
  city: string;
  physical_country: string;
  cricket_team_or_region?: string;
  latitude: number;
  longitude: number;
  category: string;
  sub_category_detail?: string;
  difficulty: string;
  year?: number | string;
  event_date?: string;
  players?: string;
  teams?: string;
  tournament?: string;
  question_type?: string;
  story?: string;
  evidence?: string;
  source_name?: string;
  source_url?: string;
  venue_source_url?: string;
  location_source?: string;
  location_source_url?: string;
  verification_source?: string;
  verification_url?: string;
  source_verified?: string;
  location_verified?: string;
  verification_status?: string;
  is_playable?: boolean;
  playable_round_date?: string | null;
  round_number?: number | null;
  question_index_in_round?: number | null;
  review_reason?: string | null;
}

export interface GuessResponse {
  questionId: string;
  answer: Coordinates & {
    name: string;
    city: string;
    country: string;
    story: string;
    sourceUrl?: string;
  };
  guess: Coordinates;
  distanceMiles: number;
  distanceKm: number;
  rawScore: number;
  score: number;
  emoji: string;
  ratingTier: string;
}

export type RevealPhase =
  | "guess-locked"
  | "score-calculated"
  | "globe-rotates"
  | "route-revealed"
  | "camera-travels"
  | "local-close-up"
  | "score-presentation"
  | "next-question";

export interface ScoredQuestionResult {
  questionIndex: number;
  questionId: string;
  prompt: string;
  category: string;
  difficulty: string;
  guess: Coordinates;
  answer: Coordinates & {
    name: string;
    city: string;
    country: string;
    story: string;
    sourceUrl?: string;
  };
  distanceMiles: number;
  score: number;
  emoji: string;
  ratingTier: string;
}

export interface InProgressSession {
  date: string;
  currentQuestionIndex: number;
  results: ScoredQuestionResult[];
  totalScore: number;
  isFinished: boolean;
  lastUpdated: string;
  gameId?: string;
}

export interface DailyGameHistory {
  date: string;
  totalScore: number;
  maxScore: number;
  emojis: string[];
  results: ScoredQuestionResult[];
  completedAt: string;
}
