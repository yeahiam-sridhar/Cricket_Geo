"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { DailyGameHistory } from "@/types/game";
import { sumQuestionScores, cleanQuestionPrompt } from "@/lib/scoring";
import confetti from "canvas-confetti";
import { soundController } from "@/lib/audio";
import SoundToggle from "@/components/SoundToggle";

interface ResultsSummaryProps {
  history: DailyGameHistory;
}

export default function ResultsSummary({ history }: ResultsSummaryProps) {
  const totalScore = sumQuestionScores(history.results.map((result) => result.score));

  useEffect(() => {
    // Play celebratory match victory fanfare (deduplicated by history.date)
    soundController.playMatchVictory(history.date);

    // Fire celebratory confetti if high score
    if (totalScore >= 350) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [totalScore, history.date]);

  const getRankTitle = (score: number) => {
    if (score >= 450) return { title: "Test Match Legend 🏆", color: "text-amber-400" };
    if (score >= 380) return { title: "Centurion Star 🏏", color: "text-emerald-400" };
    if (score >= 280) return { title: "Solid All-Rounder ⚡", color: "text-sky-400" };
    if (score >= 150) return { title: "Middle Order Battler 🛡️", color: "text-amber-300" };
    return { title: "Tail-ender in Training 🧤", color: "text-slate-400" };
  };

  const rank = getRankTitle(totalScore);
  const isPractice = history.date.startsWith("practice-");
  const roundLabel = isPractice
    ? `Practice Match #${history.date.replace("practice-", "") || "1"}`
    : `Daily Round: ${history.date}`;

  const handleStartAnother5 = () => {
    soundController.playGameStart();
    const completedPracticeGame = isPractice
      ? Number.parseInt(history.date.replace("practice-", ""), 10) || 0
      : 0;
    const savedPracticeGame =
      typeof window !== "undefined"
        ? Number.parseInt(localStorage.getItem("cricket_geo.practice_count") || "0", 10) || 0
        : 0;
    const nextGame = Math.max(completedPracticeGame, savedPracticeGame) + 1;
    if (typeof window !== "undefined") {
      localStorage.setItem("cricket_geo.practice_count", nextGame.toString());
      localStorage.removeItem("cricket_geo.play.progress");
    }
    window.location.href = `/play?practice=true&game=${nextGame}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 sm:gap-6 p-2 sm:p-4 animate-fade-in font-mono select-none">
      {/* Top Results Card */}
      <div className="bg-[#18181b] border border-white/10 rounded-2xl p-5 sm:p-7 text-center shadow-2xl relative">
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5">
          <SoundToggle compact />
        </div>

        <div className="text-xs font-mono text-[#38bdf8] font-bold tracking-wider uppercase mb-1">
          {roundLabel}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
          Match Complete
        </h1>

        <p className={`text-sm sm:text-base font-semibold mt-1 font-sans ${rank.color}`}>
          {rank.title}
        </p>

        {/* Big Score Box */}
        <div className="my-5 inline-flex flex-col items-center justify-center bg-black border-2 border-[#38bdf8] rounded-xl px-7 py-4 shadow-[0_0_16px_rgba(56,189,248,0.2)]">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#38bdf8] font-bold">
            TOTAL SCORE
          </span>
          <div className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight tabular-nums mt-0.5">
            {totalScore}
            <span className="text-lg sm:text-2xl font-bold text-neutral-500"> / 500</span>
          </div>
        </div>

        {/* Emoji Strip */}
        <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl p-2 bg-black/60 rounded-xl border border-white/10 max-w-xs mx-auto mb-6">
          {history.emojis.map((emoji, idx) => (
            <span key={idx} className="transition-transform hover:scale-125 cursor-default">
              {emoji}
            </span>
          ))}
        </div>

        {/* Action Buttons: GeoSports Pill Style */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto">
          <button
            onClick={handleStartAnother5}
            className="w-full sm:w-auto min-h-[46px] flex items-center justify-center gap-2 px-7 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-bold text-sm rounded-full shadow-lg transition-all cursor-pointer font-sans"
          >
            <span>Start Another 5 →</span>
          </button>

          {isPractice ? (
            <Link
              href="/play?new=true"
              className="w-full sm:w-auto min-h-[46px] flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-neutral-200 text-black font-bold text-sm rounded-full transition-all cursor-pointer font-sans"
            >
              <span>Play Today&apos;s Daily →</span>
            </Link>
          ) : (
            <>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("cricket_geo.play.progress");
                    window.location.href = "/play?replay=true";
                  }
                }}
                className="w-full sm:w-auto min-h-[46px] flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-neutral-200 text-black font-bold text-sm rounded-full transition-all cursor-pointer font-sans"
              >
                <span>Replay Daily Round</span>
              </button>
              <Link
                href="/leaderboard"
                className="w-full sm:w-auto min-h-[46px] flex items-center justify-center gap-2 px-6 py-3 bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold text-sm rounded-full border border-white/15 transition-all font-sans"
              >
                <span>Leaderboard</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Question Breakdown List */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-400 px-1 font-bold">
          Innings Breakdown
        </h2>

        {history.results.map((res, idx) => (
          <div
            key={idx}
            className="bg-[#18181b] border border-white/10 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:border-white/20"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-black border border-[#38bdf8]/40 font-mono text-xs font-bold text-[#38bdf8] shrink-0">
                Q{idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-neutral-200 font-sans font-medium line-clamp-2">
                  {cleanQuestionPrompt(res.prompt)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400 font-mono">
                  <span className="text-white font-bold truncate">
                    {res.answer.city ? `${res.answer.city}, ` : ""}{res.answer.country || res.answer.name}
                  </span>
                  <span>•</span>
                  <span>{res.distanceMiles.toLocaleString()} mi off</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0 font-mono">
              <span className="text-lg">{res.emoji}</span>
              <div className="text-right">
                <span className="text-sm sm:text-base font-bold text-white tabular-nums">
                  +{res.score} pts
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
