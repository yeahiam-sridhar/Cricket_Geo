"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Coordinates,
  DailyGameHistory,
  GuessResponse,
  InProgressSession,
  PublicRound,
  RevealPhase,
  ScoredQuestionResult,
} from "@/types/game";
import {
  clearInProgressSession,
  getClientId,
  getCompletedResult,
  getInProgressSession,
  saveCompletedResult,
  saveInProgressSession,
  getDisplayName,
  saveDisplayName,
  recordSeenQuestions,
  getPracticeGameCount,
} from "@/lib/storage";
import { getKolkataToday, isPracticeDate } from "@/lib/dates";
import MapContainer from "@/components/MapContainer";
import RevealCard from "@/components/RevealCard";
import ResultsSummary from "@/components/ResultsSummary";
import { AlertCircle, Calendar, Loader2, Trophy, ListOrdered, Sparkles, RotateCcw, Menu, X } from "lucide-react";
import { sumQuestionScores, cleanQuestionPrompt } from "@/lib/scoring";
import { isValidGuessResponse } from "@/lib/guess-validation";
import { soundController } from "@/lib/audio";
import SoundToggle from "@/components/SoundToggle";

function PlayGameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [dateParam, setDateParam] = useState<string>("");
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [round, setRound] = useState<PublicRound | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // In-Game State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedGuess, setSelectedGuess] = useState<Coordinates | null>(null);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>("guess-locked");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<GuessResponse | null>(null);
  const [results, setResults] = useState<ScoredQuestionResult[]>([]);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [displayedScore, setDisplayedScore] = useState<number>(0);
  const [isScoreCardVisible, setIsScoreCardVisible] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string>("");
  const [nameDraft, setNameDraft] = useState<string>("");
  const [needsName, setNeedsName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [completedHistory, setCompletedHistory] = useState<DailyGameHistory | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isCompletingGame, setIsCompletingGame] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [cycleResetMessage, setCycleResetMessage] = useState<string | null>(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const submissionLockRef = useRef(false);
  const advanceLockRef = useRef(false);
  const hasPlayedStartStingRef = useRef(false);
  const animationCompleteRef = useRef(false);
  const pendingTotalScoreRef = useRef<number | null>(null);
  const settleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  // Play Game Start sting on fresh game load
  useEffect(() => {
    if (
      round &&
      currentIndex === 0 &&
      results.length === 0 &&
      !hasPlayedStartStingRef.current &&
      !needsName &&
      !loading &&
      !completedHistory
    ) {
      hasPlayedStartStingRef.current = true;
      soundController.playGameStart();
    }
  }, [round, currentIndex, results.length, needsName, loading, completedHistory]);

  // 1. Initialize Date & Load Round Data
  useEffect(() => {
    if (!getDisplayName()) setNeedsName(true);

    const rawDate = searchParams.get("date")?.trim();
    const isPracticeQuery =
      searchParams.get("practice") === "true" ||
      searchParams.get("practice") === "1" ||
      searchParams.get("mode") === "practice" ||
      isPracticeDate(rawDate);

    setIsPracticeMode(isPracticeQuery);

    const clientId = getClientId();
    let targetDate = "";
    let fetchUrl = "";
    let activeGameId = "";

    if (isPracticeQuery) {
      const parsedGame = isPracticeDate(rawDate)
        ? Number.parseInt(rawDate!.replace("practice-", ""), 10) || 0
        : Number.parseInt(searchParams.get("game") || "0", 10) || 0;
      targetDate = `practice-${parsedGame}`;
      setDateParam(targetDate);

      // Check if player has an active in-progress session to resume
      const existingSession = getInProgressSession(targetDate);
      activeGameId =
        existingSession?.gameId ||
        `practice-${parsedGame}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      fetchUrl = `/api/rounds?practice=1&playerId=${encodeURIComponent(clientId)}&gameId=${encodeURIComponent(activeGameId)}&game=${parsedGame}`;
    } else {
      targetDate = rawDate || getKolkataToday();
      setDateParam(targetDate);

      const isReplaying =
        searchParams.get("replay") === "true" ||
        searchParams.get("new") === "true";

      // Check if player has already completed this daily round
      const existingResult = getCompletedResult(targetDate);
      if (existingResult && !isReplaying) {
        setCompletedHistory(existingResult);
        setLoading(false);
        return;
      }

      fetchUrl = `/api/rounds?date=${targetDate}&fallback=true`;
    }

    // Fetch the round
    async function fetchRound() {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch(fetchUrl, { cache: "no-store" });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Could not find questions for ${targetDate}.`);
        }
        const data = await res.json();
        if (!data.round || !Array.isArray(data.round.questions) || data.round.questions.length === 0) {
          throw new Error("Invalid round data returned from server.");
        }
        setRound(data.round);

        if (data.cycleReset) {
          setCycleResetMessage(
            data.message ||
            "✨ New Question Cycle: You've completed all eligible questions in the bank! A fresh cycle has begun."
          );
        }

        // Resume in-progress session if any
        const inProgress = getInProgressSession(targetDate);
        if (inProgress && Array.isArray(inProgress.results) && inProgress.results.length > 0) {
          const resultsMatchRound = inProgress.results.every(
            (result, index) =>
              data.round.questions[index]?.id === result.questionId
          );
          if (!resultsMatchRound) {
            console.warn("Discarding stale in-progress session that does not match this round.");
            clearInProgressSession();
            const freshGameId = activeGameId || crypto.randomUUID();
            setGameId(freshGameId);
            setCurrentIndex(0);
            setResults([]);
            setTotalScore(0);
            saveInProgressSession({
              date: targetDate,
              gameId: freshGameId,
              currentQuestionIndex: 0,
              results: [],
              totalScore: 0,
              isFinished: false,
              lastUpdated: new Date().toISOString(),
            });
          } else {
            const isRoundComplete = inProgress.results.length >= data.round.questions.length;
            const completedQuestion = isRoundComplete
              ? inProgress.results[data.round.questions.length - 1]
              : null;
            const sessionGameId = inProgress.gameId || activeGameId || crypto.randomUUID();
          if (completedQuestion) {
            setCurrentIndex(data.round.questions.length - 1);
            setResults(inProgress.results);
            const restoredTotal = sumQuestionScores(inProgress.results.map((result) => result.score));
            setTotalScore(restoredTotal);
            setDisplayedScore(restoredTotal);
            setIsScoreCardVisible(true);
            setGameId(sessionGameId);
            setSelectedGuess(completedQuestion.guess);
            setRevealPhase("score-calculated");
            submissionLockRef.current = true;
            setSubmittedResult({
              questionId: completedQuestion.questionId,
              answer: completedQuestion.answer,
              guess: completedQuestion.guess,
              distanceMiles: completedQuestion.distanceMiles,
              distanceKm: completedQuestion.distanceMiles * 1.609344,
              rawScore: completedQuestion.score,
              score: completedQuestion.score,
              emoji: completedQuestion.emoji,
              ratingTier: completedQuestion.ratingTier,
            });
          } else {
            setCurrentIndex(Math.min(inProgress.results.length, data.round.questions.length - 1));
            setResults(inProgress.results);
            const restoredTotal = sumQuestionScores(inProgress.results.map((result) => result.score));
            setTotalScore(restoredTotal);
            setDisplayedScore(restoredTotal);
            setIsScoreCardVisible(false);
            setGameId(sessionGameId);
          }
        }
      } else {
          const freshGameId = activeGameId || crypto.randomUUID();
          setGameId(freshGameId);
          setCurrentIndex(0);
          setResults([]);
          setTotalScore(0);
          saveInProgressSession({
            date: targetDate,
            gameId: freshGameId,
            currentQuestionIndex: 0,
            results: [],
            totalScore: 0,
            isFinished: false,
            lastUpdated: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        setFetchError(err.message || `Could not find questions for ${targetDate}.`);
      } finally {
        setLoading(false);
      }
    }

    fetchRound();
  }, [searchParams, reloadTrigger]);

  const savePlayerName = async () => {
    try {
      setNameError(null);
      const response = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: getClientId(), displayName: nameDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      saveDisplayName(data.player.displayName);
      setNeedsName(false);
      soundController.playGameStart();
    } catch (error: any) {
      setNameError(error.message || "Please enter a valid display name.");
    }
  };

  // State coordination for smooth globe reveal
  const triggerRevealCompletion = useCallback(() => {
    if (animationCompleteRef.current) return;
    animationCompleteRef.current = true;
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    // Brief gentle settle pause (280ms) so the destination stadium is clearly admired before the card slides up
    settleTimerRef.current = setTimeout(() => {
      setIsScoreCardVisible(true);
      if (pendingTotalScoreRef.current !== null) {
        setDisplayedScore(pendingTotalScoreRef.current);
      }
    }, 280);
  }, []);

  const handleRevealAnimationComplete = useCallback(() => {
    triggerRevealCompletion();
  }, [triggerRevealCompletion]);

  const handleRevealPhaseChange = useCallback(
    (phase: RevealPhase) => {
      setRevealPhase(phase);
      if (phase === "score-presentation") {
        triggerRevealCompletion();
      }
    },
    [triggerRevealCompletion]
  );

  // ONE-TAP GAMEPLAY: Deliberate tap immediately submits to API
  const handleGuess = async (coords: Coordinates) => {
    if (
      submissionLockRef.current ||
      isSubmitting ||
      submittedResult ||
      !round
    ) {
      return;
    }

    // Boundary check: never attempt question six
    if (currentIndex >= round.questions.length) return;

    const currentQ = round.questions[currentIndex];
    if (!currentQ) return;

    submissionLockRef.current = true;
    advanceLockRef.current = false;
    animationCompleteRef.current = false;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setSelectedGuess(coords);
    setRevealPhase("guess-locked");
    setIsSubmitting(true);
    setIsScoreCardVisible(false);
    setScoringError(null);

    try {
      const clientId = getClientId();
      const payload = {
        date: round.date,
        questionId: currentQ.id,
        guess: coords,
        clientId,
        gameId,
        displayName: getDisplayName(),
      };

      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server failed to score guess.");
      }

      // ONLY on success reveal the answer
      const scoredData: unknown = await res.json();
      if (!isValidGuessResponse(scoredData, currentQ.id, coords)) {
        throw new Error("Server returned invalid scoring results.");
      }
      setSubmittedResult(scoredData);
      setRevealPhase("score-calculated");

      // Record question result
      const questionResult: ScoredQuestionResult = {
        questionIndex: currentIndex,
        questionId: currentQ.id,
        prompt: cleanQuestionPrompt(currentQ.prompt),
        category: currentQ.category,
        difficulty: currentQ.difficulty,
        guess: scoredData.guess,
        answer: scoredData.answer,
        distanceMiles: scoredData.distanceMiles,
        score: scoredData.score,
        emoji: scoredData.emoji,
        ratingTier: scoredData.ratingTier,
      };

      const newResults = [...results, questionResult];
      const newTotal = sumQuestionScores(newResults.map((result) => result.score));
      setResults(newResults);
      setTotalScore(newTotal);
      pendingTotalScoreRef.current = newTotal;

      // Start safety fallback timer: ensures result card is never stuck if map animation event is delayed (>4.5s)
      safetyTimerRef.current = setTimeout(() => {
        triggerRevealCompletion();
      }, 4500);

      // Save in-progress session
      const inProgress: InProgressSession = {
        date: round.date,
        currentQuestionIndex: currentIndex,
        results: newResults,
        totalScore: newTotal,
        isFinished: newResults.length >= round.questions.length,
        lastUpdated: new Date().toISOString(),
        gameId,
      };
      saveInProgressSession(inProgress);
    } catch (err: any) {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      animationCompleteRef.current = false;
      pendingTotalScoreRef.current = null;
      setIsScoreCardVisible(false);
      setScoringError(err.message || "Could not submit guess. Please try again.");
      submissionLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance to Next Question or Final Results
  const handleNextQuestion = async () => {
    if (!round || advanceLockRef.current) return;
    advanceLockRef.current = true;

    const isLast = currentIndex >= round.questions.length - 1 || results.length >= round.questions.length;

    if (isLast) {
      if (isCompletingGame) {
        advanceLockRef.current = false;
        return;
      }

      const questionScoreTotal = sumQuestionScores(results.map((result) => result.score));
      if (results.length !== round.questions.length || questionScoreTotal !== totalScore) {
        setCompletionError("The five question scores could not be reconciled. Your result has not been submitted.");
        advanceLockRef.current = false;
        return;
      }

      const historyRecord: DailyGameHistory = {
        date: round.date,
        totalScore: questionScoreTotal,
        maxScore: round.questions.length * 100,
        emojis: results.map((r) => r.emoji),
        results,
        completedAt: new Date().toISOString(),
      };

      setCompletionError(null);
      setIsCompletingGame(true);
      let completionSucceeded = false;
      try {
        if (!round.date.startsWith("practice-")) {
          const response = await fetch("/api/leaderboard/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: getClientId(),
              date: round.date,
              gameId,
              questionIds: results.map((result) => result.questionId),
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || "Could not save your leaderboard result.");
          }
          if (data.score !== questionScoreTotal) {
            throw new Error("The server total did not match your five question scores. Your result has not been submitted.");
          }
          saveCompletedResult(historyRecord);
        } else {
          recordSeenQuestions(round.questions.map((q) => q.id));
          fetch("/api/rounds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: getClientId(), gameId }),
          }).catch(() => undefined);
        }

        clearInProgressSession();
        setCompletedHistory(historyRecord);
        completionSucceeded = true;
      } catch (error) {
        setCompletionError(
          error instanceof Error ? error.message : "Could not save your leaderboard result."
        );
      } finally {
        setIsCompletingGame(false);
        if (!completionSucceeded) advanceLockRef.current = false;
      }
    } else {
      soundController.playButton();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      animationCompleteRef.current = false;
      pendingTotalScoreRef.current = null;
      setIsScoreCardVisible(false);
      setRevealPhase("next-question");
      setCurrentIndex((prev) => prev + 1);
      setSelectedGuess(null);
      setSubmittedResult(null);
      submissionLockRef.current = false;
      setScoringError(null);
      setCompletionError(null);
    }
  };

  // 1. Name Prompt Modal
  if (needsName) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#020408] p-5">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            Anonymous player profile
          </p>
          <h1 className="text-xl font-extrabold text-white">Choose your leaderboard name</h1>
          <p className="text-sm text-slate-400 mt-2">
            No sign-up required. This name is tied only to this browser&apos;s anonymous player ID.
          </p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && savePlayerName()}
            maxLength={24}
            placeholder="e.g. Cover Drive"
            className="mt-5 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base text-white outline-none focus:border-emerald-400"
          />
          {nameError && <p className="mt-2 text-xs text-rose-400">{nameError}</p>}
          <button
            onClick={savePlayerName}
            className="mt-4 w-full min-h-[48px] rounded-xl bg-emerald-500 py-3 text-sm sm:text-base font-black text-slate-950 cursor-pointer active:bg-emerald-600 transition-colors"
          >
            Start playing
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading) {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center bg-[#020408] text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm font-semibold tracking-wide">
          {isPracticeMode ? "Loading practice round..." : "Loading daily cricket round..."}
        </p>
      </div>
    );
  }

  // 3. Error State
  if (fetchError || !round) {
    const today = getKolkataToday();

    const handlePlayToday = () => {
      clearInProgressSession();
      soundController.playGameStart();
      if (typeof window !== "undefined") {
        window.location.href = "/play?replay=true";
      } else {
        router.push("/play");
      }
    };

    const handleStartPractice = () => {
      clearInProgressSession();
      soundController.playGameStart();
      const nextGame = getPracticeGameCount() + 1;
      if (typeof window !== "undefined") {
        window.location.href = `/play?practice=true&game=${nextGame}`;
      } else {
        router.push(`/play?practice=true&game=${nextGame}`);
      }
    };

    const handleRetry = () => {
      clearInProgressSession();
      if (typeof window !== "undefined") {
        window.location.reload();
      } else {
        setReloadTrigger((prev) => prev + 1);
      }
    };

    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center bg-[#020408] p-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Round Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">
          {fetchError || `Could not find questions for ${dateParam || "this round"}.`}
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handlePlayToday}
            className="w-full min-h-[46px] px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-emerald-400 active:bg-emerald-600 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Calendar className="w-4 h-4" />
            <span>Play Today&apos;s Round ({today})</span>
          </button>
          <button
            onClick={handleRetry}
            className="w-full min-h-[44px] px-5 py-2 bg-slate-900 text-slate-300 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Try Reloading Round</span>
          </button>
          <button
            onClick={handleStartPractice}
            className="w-full min-h-[46px] px-5 py-2.5 bg-slate-800 text-slate-200 font-semibold rounded-xl text-sm hover:bg-slate-700 active:bg-slate-900 transition-all cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Practice Unlimited 5 Questions</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Completed Results Screen (Never fetch question 6)
  if (completedHistory) {
    const finalHistory: DailyGameHistory = completedHistory
      ? {
        ...completedHistory,
        totalScore: sumQuestionScores(completedHistory.results.map((result) => result.score)),
      }
      : {
        date: round.date,
        totalScore: sumQuestionScores(results.map((result) => result.score)),
        maxScore: round.questions.length * 100,
        emojis: results.map((r) => r.emoji),
        results,
        completedAt: new Date().toISOString(),
      };
    return (
      <div className="min-h-dvh w-full flex flex-col bg-[#020408] p-4 sm:p-6 overflow-y-auto">
        <ResultsSummary history={finalHistory} />
      </div>
    );
  }

  // Safeguard: strictly ensure currentQuestion exists and never attempt question six
  const currentQuestion = round.questions[currentIndex];
  if (!currentQuestion) {
    const fallbackHistory: DailyGameHistory = {
      date: round.date,
      totalScore: sumQuestionScores(results.map((result) => result.score)),
      maxScore: round.questions.length * 100,
      emojis: results.map((r) => r.emoji),
      results,
      completedAt: new Date().toISOString(),
    };
    return (
      <div className="min-h-dvh w-full flex flex-col bg-[#020408] p-4 sm:p-6 overflow-y-auto">
        <ResultsSummary history={fallbackHistory} />
      </div>
    );
  }

  const isLastQuestion = currentIndex === round.questions.length - 1;

  return (
    <div className="h-dvh max-h-dvh w-full flex flex-col bg-[#020408] text-slate-100 overflow-hidden select-none">
      {/* 1. TOP CURATED BANNER MATCHING GEOSPORTS */}
      <div className="w-full bg-black py-1 px-4 text-center border-b border-[#18181b] z-30 shrink-0">
        <span className="text-[10px] sm:text-[11px] font-mono tracking-wider text-neutral-400 uppercase">
          QUESTIONS CURATED BY{" "}
          <Link
            href="/"
            className="text-blue-400 font-bold underline underline-offset-2 hover:text-blue-300 transition-colors"
          >
            CricketGeo
          </Link>
        </span>
      </div>

      {/* 2. GAMEPLAY NAVIGATION BAR MATCHING GEOSPORTS */}
      <header className="h-11 sm:h-12 w-full bg-black border-b border-[#222222] px-3 sm:px-6 flex items-center justify-between text-xs shrink-0 select-none z-30">
        {/* Left: Hamburger + Brand in Cyan */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              soundController.playButton();
              setIsNavMenuOpen((prev) => !prev);
            }}
            aria-label="Toggle navigation menu"
            className="p-1 text-white hover:text-[#38bdf8] transition-colors cursor-pointer"
          >
            {isNavMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#38bdf8] block font-mono">
              CricketGeo
            </span>
          </Link>
        </div>

        {/* Right: Date & Sound Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 font-mono">
          <span className="text-[11px] sm:text-xs text-[#38bdf8] font-bold">
            {getKolkataToday()}
          </span>
          <SoundToggle compact />
        </div>
      </header>

      {/* Dropdown Menu in Gameplay View */}
      {isNavMenuOpen && (
        <div className="w-full bg-black border-b border-[#222222] shadow-2xl z-40 transition-all">
          <div className="max-w-md mx-auto py-2">
            <Link
              href="/"
              onClick={() => setIsNavMenuOpen(false)}
              className="block px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-[#38bdf8]"
            >
              Home
            </Link>
            <Link
              href="/play"
              onClick={() => {
                clearInProgressSession();
                setIsNavMenuOpen(false);
                window.location.href = "/play?replay=true";
              }}
              className="block px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-[#38bdf8]"
            >
              Today&apos;s Round
            </Link>
            <Link
              href="/play?practice=true"
              onClick={() => {
                clearInProgressSession();
                setIsNavMenuOpen(false);
                window.location.href = `/play?practice=true&game=${getPracticeGameCount() + 1}`;
              }}
              className="block px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-[#38bdf8]"
            >
              Practice Unlimited (5 Qs)
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setIsNavMenuOpen(false)}
              className="block px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-[#38bdf8]"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      )}

      {/* Cycle Reset Notification Banner */}
      {cycleResetMessage && (
        <div className="w-full bg-emerald-950/90 border-b border-emerald-500/40 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300 shrink-0 z-20 shadow-md">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">{cycleResetMessage}</span>
          </div>
          <button
            onClick={() => setCycleResetMessage(null)}
            className="text-emerald-400/80 hover:text-white text-xs px-2 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. HORIZONTAL HUD: DEDICATED SCORE BOX + QUESTION BOX MATCHING GEOSPORTS */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5 flex items-stretch gap-2 sm:gap-3 z-30 shrink-0 select-none">
        {/* Left: Dedicated Score Box */}
        <div className="border-2 border-[#38bdf8] rounded-md bg-black px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col items-center justify-center shrink-0 min-w-[70px] sm:min-w-[84px] shadow-[0_0_12px_rgba(56,189,248,0.2)]">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#38bdf8] font-bold">
            SCORE
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-white leading-none mt-1">
            {String(displayedScore).padStart(3, "0")}
          </span>
        </div>

        {/* Right: Question Box with Mint Strip */}
        <div className="flex-1 border-2 border-[#38bdf8] rounded-md bg-black overflow-hidden flex flex-col shadow-[0_0_12px_rgba(56,189,248,0.2)]">
          <div className="bg-[#a7f3d0] text-slate-950 font-mono font-bold text-xs sm:text-sm py-0.5 sm:py-1 px-3 text-center tracking-tight">
            Question {currentIndex + 1} of {round.questions.length}
          </div>
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-mono text-white leading-snug sm:leading-relaxed text-center flex-1 flex items-center justify-center">
            {cleanQuestionPrompt(currentQuestion.prompt)}
          </div>
        </div>
      </div>

      {/* 4. MAIN MAP STAGE */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden bg-black">
        <MapContainer
          key="cricket-globe-canvas"
          selectedGuess={selectedGuess}
          onSubmitGuess={handleGuess}
          revealData={submittedResult}
          isSubmitting={isSubmitting}
          isResultMode={!!submittedResult}
          onRevealPhaseChange={handleRevealPhaseChange}
          onRevealAnimationComplete={handleRevealAnimationComplete}
        />

        {/* Subtle Prompt Below Globe Pre-Guess */}
        {!submittedResult && !isSubmitting && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
            <span className="text-neutral-400 font-mono text-xs select-none bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
              Rotate globe &amp; tap where it happened
            </span>
          </div>
        )}

        {/* Status Indicator During In-Flight Reveal */}
        {(isSubmitting || (submittedResult && !isScoreCardVisible)) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center animate-in fade-in duration-200">
            <span className="text-[#38bdf8] font-mono text-xs select-none animate-pulse bg-black/80 px-4 py-1.5 rounded-full border border-[#38bdf8]/40 shadow-lg tracking-wider">
              {isSubmitting ? "CALCULATING DISTANCE..." : "REVEALING LOCATION..."}
            </span>
          </div>
        )}

        {/* Floating Error Alert */}
        {scoringError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-rose-950/90 border border-rose-500/60 text-rose-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{scoringError}</span>
            </div>
            <button
              onClick={() => selectedGuess && handleGuess(selectedGuess)}
              className="px-2.5 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 5. DOCKED RESULT DOCK - ONLY SHOWN AFTER DESTINATION ARRIVAL */}
        {submittedResult && isScoreCardVisible && (
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[94%] max-w-xl z-30 pointer-events-auto pb-safe animate-in fade-in slide-in-from-bottom-4 duration-300">
            <RevealCard
              revealData={submittedResult}
              isLastQuestion={isLastQuestion}
              onNextQuestion={handleNextQuestion}
              isCompletingGame={isCompletingGame}
              completionError={completionError}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh w-full flex items-center justify-center bg-[#020408]">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <PlayGameContent />
    </Suspense>
  );
}
