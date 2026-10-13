"use client";

import React, { useEffect, useState, useRef } from "react";
import { GuessResponse } from "@/types/game";
import { soundController } from "@/lib/audio";
import confetti from "canvas-confetti";

interface RevealCardProps {
  revealData: GuessResponse;
  isLastQuestion: boolean;
  onNextQuestion: () => void;
  isCompletingGame?: boolean;
  completionError?: string | null;
}

export default function RevealCard({
  revealData,
  isLastQuestion,
  onNextQuestion,
  isCompletingGame = false,
  completionError = null,
}: RevealCardProps) {
  const { answer, distanceMiles, distanceKm, score } = revealData;

  const [animatedScore, setAnimatedScore] = useState<number>(0);
  const [isCountComplete, setIsCountComplete] = useState<boolean>(false);
  const hasAnimatedRef = useRef<boolean>(false);

  // Dedicated animated points counter
  useEffect(() => {
    if (hasAnimatedRef.current) {
      setAnimatedScore(score);
      setIsCountComplete(true);
      return;
    }
    hasAnimatedRef.current = true;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setAnimatedScore(score);
      setIsCountComplete(true);
      soundController.playScoreReward(score);
      return;
    }

    const duration = 520; // 520ms counting animation
    const startTime = performance.now();
    let lastTickVal = -1;

    const updateCounter = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.min(score, Math.round(eased * score));

      setAnimatedScore(current);

      if (current !== lastTickVal && current > 0) {
        lastTickVal = current;
        soundController.playScoreTick(progress);
      }

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setAnimatedScore(score);
        setIsCountComplete(true);
        soundController.playScoreReward(score);

        // Restrained celebration particles for high scores
        if (score >= 80) {
          try {
            confetti({
              particleCount: score >= 95 ? 40 : 22,
              spread: 55,
              origin: { y: 0.85 },
              colors: ["#10b981", "#38bdf8", "#f59e0b", "#ffffff"],
              disableForReducedMotion: true,
            });
          } catch {
            // Ignore confetti error
          }
        }
      }
    };

    const frameId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(frameId);
  }, [score]);

  // Keyboard navigation: Enter or Space advances cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button, a, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (!isCountComplete || isCompletingGame) return;
        e.preventDefault();
        soundController.playButton();
        onNextQuestion();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCompletingGame, isCountComplete, onNextQuestion]);

  // Scoring Tier Labels matching GeoSports playful proximity tone
  const getTierInfo = (pts: number) => {
    if (pts >= 95) {
      return {
        label: "Right on the pitch!",
        color: "text-emerald-400 border-emerald-500/40",
      };
    }
    if (pts >= 70) {
      return {
        label: "Boundary strike!",
        color: "text-emerald-400 border-emerald-500/40",
      };
    }
    if (pts >= 40) {
      return {
        label: "Solid connection.",
        color: "text-amber-400 border-amber-500/40",
      };
    }
    if (pts >= 15) {
      return {
        label: "Out in the deep.",
        color: "text-orange-400 border-orange-500/40",
      };
    }
    return {
      label: "Wrong neighborhood.",
      color: "text-orange-400 border-orange-500/40",
    };
  };

  const tier = getTierInfo(score);

  const handleNextClick = () => {
    if (!isCountComplete || isCompletingGame) return;
    soundController.playButton();
    onNextQuestion();
  };

  return (
    <div className="w-full flex flex-col gap-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
      {/* Playful Proximity Badge on Globe matching GeoSports */}
      <div className="self-center">
        <span
          className={`inline-block px-3.5 py-1 rounded-full bg-black/85 border text-xs sm:text-sm font-mono font-bold shadow-xl backdrop-blur-sm ${tier.color}`}
        >
          {tier.label}
        </span>
      </div>

      {/* Row 1: Monospace Stats Line (Points on left, distance on right) */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-mono font-bold px-3 py-1.5 bg-black/90 border border-white/10 rounded-xl backdrop-blur-md shadow-lg select-none">
        <div className="flex items-center gap-1.5 text-white">
          <span className="text-amber-400 text-sm">🟡</span>
          <span className="tabular-nums">
            {animatedScore} = {animatedScore} pts
          </span>
        </div>
        <div className="text-neutral-300 font-mono text-xs sm:text-sm">
          {distanceMiles.toLocaleString()} mi off
        </div>
      </div>

      {/* Row 2: Dark Gray Card with Venue & Story */}
      <div className="bg-[#18181b] border border-white/10 rounded-xl p-3 sm:p-4 text-left font-mono shadow-2xl">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            {answer.city ? `${answer.city}, ` : ""}{answer.country || answer.name}
          </h3>
          {answer.sourceUrl && (
            <a
              href={answer.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 underline shrink-0 font-sans"
            >
              Source ↗
            </a>
          )}
        </div>
        <p className="text-[11px] sm:text-xs text-neutral-400 mb-1.5 font-sans font-semibold">
          {answer.name}
        </p>
        {answer.story && (
          <p className="text-xs sm:text-[13px] text-neutral-300 leading-relaxed max-h-20 sm:max-h-24 overflow-y-auto pr-1">
            {answer.story}
          </p>
        )}
      </div>

      {/* Row 3: Full-Width White Pill Button matching GeoSports */}
      <button
        onClick={handleNextClick}
        disabled={!isCountComplete || isCompletingGame}
        className="w-full min-h-[46px] py-3 px-6 bg-white hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-60 disabled:cursor-wait text-black font-extrabold text-sm sm:text-base rounded-full shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer select-none font-mono"
      >
        <span>
          {isCompletingGame
            ? "Saving score..."
            : isLastQuestion
              ? "See match results ->"
              : "Next question ->"}
        </span>
      </button>

      {completionError && (
        <p role="alert" className="text-xs text-rose-300 text-center font-mono">
          {completionError} Click to retry saving your result.
        </p>
      )}
    </div>
  );
}
