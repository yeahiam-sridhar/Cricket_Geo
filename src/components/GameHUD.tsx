"use client";

import React from "react";
import { PublicQuestion, ScoredQuestionResult } from "@/types/game";
import { cleanQuestionPrompt } from "@/lib/scoring";
import { Trophy, Calendar, Compass, Shield } from "lucide-react";

interface GameHUDProps {
  roundDate: string;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: PublicQuestion;
  results: ScoredQuestionResult[];
  totalScore: number;
}

export default function GameHUD({
  roundDate,
  currentIndex,
  totalQuestions,
  currentQuestion,
  results,
  totalScore,
}: GameHUDProps) {
  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "easy":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "medium":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "hard":
      case "very hard":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800">
        {/* Left: Round & Progress */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{roundDate}</span>
          </div>

          <div className="text-sm font-semibold text-slate-200">
            Question <span className="text-emerald-400">{currentIndex + 1}</span> of {totalQuestions}
          </div>

          {/* 5 Progress Dots */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            {Array.from({ length: totalQuestions }).map((_, idx) => {
              const res = results[idx];
              let dotBg = "bg-slate-700";
              if (res) {
                dotBg = res.score >= 80 ? "bg-emerald-500" : res.score >= 50 ? "bg-amber-500" : "bg-rose-500";
              } else if (idx === currentIndex) {
                dotBg = "bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse";
              }

              return (
                <div
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${dotBg}`}
                  title={res ? `Q${idx + 1}: ${res.score} pts` : `Q${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Score Counter & Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium uppercase tracking-wider ${getDifficultyColor(
                currentQuestion.difficulty
              )}`}
            >
              {currentQuestion.difficulty}
            </span>

            <span className="text-xs px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">
              {currentQuestion.category}
            </span>
          </div>

          {/* Live Total Score */}
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl shadow-inner">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-emerald-300 tabular-nums">
                {totalScore}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">PTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Question Prompt Card */}
      <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
        <p className="text-lg sm:text-xl font-semibold text-slate-100 leading-snug tracking-tight">
          {cleanQuestionPrompt(currentQuestion.prompt)}
        </p>
      </div>
    </div>
  );
}
