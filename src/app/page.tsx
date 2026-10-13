"use client";

import React, { useState } from "react";
import Link from "next/link";
import { soundController } from "@/lib/audio";
import { ArrowRight, HelpCircle, X } from "lucide-react";

export default function HomePage() {
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20 bg-black text-center select-none">
      <div className="max-w-md mx-auto flex flex-col items-center justify-center my-auto">
        {/* Main Brand Title Matching GeoSports */}
        <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none">
          CricketGeo
        </h1>

        {/* 3-Line Subtitle in Monospace Matching GeoSports */}
        <div className="mt-4 font-mono text-sm sm:text-base text-neutral-300 leading-relaxed space-y-1">
          <p>Daily cricket geography game</p>
          <p>tap where it happened</p>
          <p>5 questions</p>
        </div>

        {/* Primary Action: Royal Blue Pill Button Matching GeoSports */}
        <div className="mt-7 flex flex-col items-center w-full">
          <Link
            href="/play"
            onClick={() => soundController.playGameStart()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-extrabold text-sm sm:text-base px-8 py-3.5 shadow-lg shadow-blue-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>Play today&apos;s round</span>
            <span className="text-lg leading-none">→</span>
          </Link>

          {/* Secondary Unlimited Practice Action in GeoSports Monospace Style */}
          <Link
            href="/play?practice=true"
            onClick={() => soundController.playGameStart()}
            className="mt-4 text-blue-400 hover:text-blue-300 transition-colors font-mono text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <span>Practice unlimited rounds</span>
            <span>→</span>
          </Link>
        </div>

        {/* Subtle Bottom Link Matching GeoSports */}
        <div className="mt-14 sm:mt-16">
          <button
            type="button"
            onClick={() => setIsScoringModalOpen(true)}
            className="text-[11px] font-mono text-neutral-500 hover:text-neutral-400 transition-colors cursor-pointer uppercase tracking-wider"
          >
            How scoring works
          </button>
        </div>
      </div>

      {/* How Scoring Works Modal */}
      {isScoringModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0e11] border border-[#27272a] rounded-2xl p-6 shadow-2xl relative text-left">
            <button
              type="button"
              onClick={() => setIsScoringModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider mb-2">
              How Scoring Works
            </h2>

            <p className="text-xs text-neutral-300 font-mono leading-relaxed mb-4">
              Points are calculated instantly based on great-circle distance from your guess pin to the actual cricket ground pitch.
            </p>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-emerald-400 font-bold">🏆 Perfect Pitch (&lt;15 mi)</span>
                <span className="text-white font-bold">100 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-lime-400 font-bold">🟢 Boundary Hit (&lt;150 mi)</span>
                <span className="text-white font-bold">80–99 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-amber-400 font-bold">🟡 Solid Strike (&lt;600 mi)</span>
                <span className="text-white font-bold">50–79 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-orange-400 font-bold">🟠 In the Deep (&lt;2,000 mi)</span>
                <span className="text-white font-bold">6–49 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-rose-400 font-bold">🔴 Long Shot (any valid guess)</span>
                <span className="text-white font-bold">5 PTS MIN</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsScoringModalOpen(false)}
              className="mt-5 w-full rounded-full bg-white text-black font-extrabold py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
