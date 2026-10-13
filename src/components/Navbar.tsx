"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStreakStats } from "@/lib/storage";
import { Menu, X, Trophy, Compass, RotateCcw, HelpCircle, Flame } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { soundController } from "@/lib/audio";

export default function Navbar() {
  const pathname = usePathname();
  const [streak, setStreak] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const stats = getStreakStats();
    setStreak(stats.currentStreak);
    setTotalGames(stats.totalGames);
  }, [pathname]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // On the gameplay page (/play), suppress the global navbar in favor of the integrated viewport-filling game header
  if (pathname === "/play") {
    return null;
  }

  return (
    <>
      {/* Top Banner Matching GeoSports */}
      <div className="w-full bg-black py-1.5 px-4 text-center border-b border-[#18181b] z-50">
        <span className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase">
          QUESTIONS CURATED BY{" "}
          <Link
            href="/"
            className="text-blue-400 font-bold underline underline-offset-2 hover:text-blue-300 transition-colors"
          >
            CricketGeo
          </Link>
        </span>
      </div>

      {/* Main Header Matching GeoSports */}
      <header className="w-full bg-black border-b border-[#222222] sticky top-0 z-50 shrink-0 select-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Hamburger + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundController.playButton();
                setIsMenuOpen((prev) => !prev);
              }}
              aria-label="Toggle navigation menu"
              className="p-1.5 -ml-1 text-white hover:text-blue-400 transition-colors cursor-pointer"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-lg font-bold text-white tracking-tight hover:text-blue-400 transition-colors">
                CricketGeo
              </span>
            </Link>
          </div>

          {/* Right: Pill Action + Leaderboard Link + Sound */}
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/play?practice=true"
              onClick={() => soundController.playGameStart()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#4d7cff] bg-[linear-gradient(180deg,#1b294c,#152039)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_16px_-8px_rgba(77,124,255,0.7)] transition hover:brightness-110 cursor-pointer"
            >
              <span>Practice 5</span>
            </Link>

            <Link
              href="/leaderboard"
              onClick={() => soundController.playButton()}
              className="text-blue-400 hover:text-blue-300 transition-colors font-semibold text-xs sm:text-sm"
            >
              Leaderboard
            </Link>

            {/* Sound Toggle */}
            <SoundToggle compact />
          </nav>
        </div>

        {/* Dropdown Menu Drawer Matching GeoSports */}
        {isMenuOpen && (
          <div className="w-full bg-black border-b border-[#222222] shadow-2xl transition-all animate-in fade-in duration-150">
            <div className="max-w-md mx-auto py-2">
              <Link
                href="/play"
                onClick={() => {
                  soundController.playGameStart();
                  setIsMenuOpen(false);
                }}
                className="block px-5 py-3 text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-blue-400"
              >
                Today&apos;s Round
              </Link>

              <Link
                href="/results"
                onClick={() => setIsMenuOpen(false)}
                className="block px-5 py-3 text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-blue-400"
              >
                Today&apos;s Results
              </Link>

              <Link
                href="/play?practice=true"
                onClick={() => {
                  soundController.playGameStart();
                  setIsMenuOpen(false);
                }}
                className="block px-5 py-3 text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-blue-400"
              >
                Unlimited Practice (5 Qs)
              </Link>

              <div className="my-1 border-t border-[#18181b]" />

              <div className="px-5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
                Your Game
              </div>

              <Link
                href="/leaderboard"
                onClick={() => setIsMenuOpen(false)}
                className="block px-5 py-2.5 text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-blue-400"
              >
                Leaderboard
              </Link>

              {totalGames > 0 && (
                <div className="px-5 py-2 text-xs font-mono text-neutral-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Streak: {streak} days • {totalGames} games played
                  </span>
                </div>
              )}

              <div className="my-1 border-t border-[#18181b]" />

              <div className="px-5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
                About
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(true);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-5 py-2.5 text-sm font-semibold transition-colors text-white hover:bg-white/[0.06] hover:text-blue-400 cursor-pointer"
              >
                How Scoring Works
              </button>
            </div>
          </div>
        )}
      </header>

      {/* How Scoring Works Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0d0f] border border-[#27272a] rounded-2xl p-6 shadow-2xl relative select-none">
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider mb-3">
              How Scoring Works
            </h2>

            <p className="text-xs text-neutral-300 font-mono leading-relaxed mb-4">
              CricketGeo calculates your score using authoritative great-circle distance from your guess to the exact pitch coordinates.
            </p>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-emerald-400 font-bold">🏆 Perfect Pitch (under 15 mi)</span>
                <span className="text-white font-bold">100 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-lime-400 font-bold">🟢 Boundary Hit (under 150 mi)</span>
                <span className="text-white font-bold">80–99 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-amber-400 font-bold">🟡 Solid Strike (under 600 mi)</span>
                <span className="text-white font-bold">50–79 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-orange-400 font-bold">🟠 In the Deep (under 2,000 mi)</span>
                <span className="text-white font-bold">6–49 PTS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-rose-400 font-bold">🔴 Long Shot (any valid guess)</span>
                <span className="text-white font-bold">5 PTS MIN</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="mt-6 w-full rounded-full bg-white text-black font-extrabold py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
