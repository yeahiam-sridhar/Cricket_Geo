"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getClientId } from "@/lib/storage";

type Row = {
  rank: number;
  playerId: string;
  displayName: string;
  points: number;
  gamesPlayed: number;
};

type Board = {
  scope: "today" | "all";
  day: string;
  tieBreak: string;
  podium: Row[];
  entries: Row[];
  total: number;
  hasMore: boolean;
};

const medals = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"today" | "all">("today");
  const [board, setBoard] = useState<Board | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState("");

  useEffect(() => {
    setMine(getClientId());
    setLoading(true);
    fetch(`/api/leaderboard?scope=${scope}&page=${page}`)
      .then((r) => r.json())
      .then(setBoard)
      .finally(() => setLoading(false));
  }, [scope, page]);

  const changeScope = (next: "today" | "all") => {
    setScope(next);
    setPage(1);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 font-mono select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#38bdf8] mb-1 font-mono">
            Global Competition
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
            Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Best completed five-question game wins. {board?.tieBreak}
          </p>
        </div>
        <Link
          href="/play"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-bold shadow-lg transition-all min-h-[44px] font-sans"
        >
          <span>Play five questions →</span>
        </Link>
      </div>

      {/* Scope Selector Tabs */}
      <div className="flex gap-2.5 mb-6 sm:mb-7">
        <button
          onClick={() => changeScope("today")}
          className={`flex-1 sm:flex-none min-h-[40px] px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono ${
            scope === "today"
              ? "bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20"
              : "bg-[#18181b] text-neutral-300 border border-white/10 hover:border-white/20 hover:text-white"
          }`}
        >
          Today (IST)
        </button>
        <button
          onClick={() => changeScope("all")}
          className={`flex-1 sm:flex-none min-h-[40px] px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono ${
            scope === "all"
              ? "bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20"
              : "bg-[#18181b] text-neutral-300 border border-white/10 hover:border-white/20 hover:text-white"
          }`}
        >
          All-time
        </button>
      </div>

      {loading && !board ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#38bdf8]" />
          <p className="text-xs text-neutral-400 font-mono">Loading rankings...</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <section className="mb-8">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 mb-3 font-sans">
              <span>{scope === "today" ? "Today's Top 3" : "All-Time Top 3"}</span>
            </h2>
            {board?.podium.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[0, 1, 2].map((podiumIndex) => {
                  const row = board.podium[podiumIndex];
                  const podiumStyle =
                    podiumIndex === 0
                      ? "sm:order-2 sm:-translate-y-1 bg-[#18181b] border-2 border-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.2)]"
                      : podiumIndex === 1
                      ? "sm:order-1 bg-[#18181b] border border-white/10"
                      : "sm:order-3 bg-[#18181b] border border-white/10";

                  return row ? (
                    <div
                      key={row.playerId}
                      className={`rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center transition-all ${podiumStyle}`}
                    >
                      <div className="text-2xl sm:text-3xl mb-1.5">{medals[podiumIndex]}</div>
                      <p className="font-bold text-white text-sm sm:text-base truncate max-w-full font-sans">
                        {row.displayName}
                        {row.playerId === mine && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-[10px] font-bold rounded">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums font-mono">
                        {row.points} <span className="text-xs font-semibold text-[#38bdf8]">PTS</span>
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 font-mono">
                        Rank {row.rank} · {row.gamesPlayed} game{row.gamesPlayed === 1 ? "" : "s"}
                      </p>
                    </div>
                  ) : (
                    <div
                      key={podiumIndex}
                      className="rounded-xl border border-dashed border-white/10 p-5 text-center text-neutral-500 flex flex-col items-center justify-center"
                    >
                      <div className="text-2xl mb-1">{medals[podiumIndex]}</div>
                      <span className="text-xs font-mono">Not filled yet</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-neutral-400 text-xs sm:text-sm font-mono">
                No completed five-question games yet. Be the first on today&apos;s board.
              </div>
            )}
          </section>

          {/* Full Leaderboard */}
          <section>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 mb-3 font-sans">
              <span>{scope === "today" ? "Today's Full Standings" : "All-Time Standings"}</span>
            </h2>

            {/* Mobile View: Clean Stacked Cards */}
            <div className="flex flex-col gap-2 sm:hidden">
              {board?.entries.map((row) => (
                <div
                  key={row.playerId}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    row.playerId === mine
                      ? "bg-[#38bdf8]/10 border-[#38bdf8]/40"
                      : "bg-[#18181b] border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-md bg-black border border-white/15 font-mono text-xs font-bold text-neutral-300 shrink-0">
                      #{row.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white text-sm truncate font-sans">
                          {row.displayName}
                        </p>
                        {row.playerId === mine && (
                          <span className="px-1.5 py-0.5 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-[10px] font-bold rounded shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                        {row.gamesPlayed} game{row.gamesPlayed === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span className="text-base font-bold text-white tabular-nums">
                      {row.points}
                    </span>
                    <span className="text-[10px] block text-[#38bdf8] font-bold uppercase">
                      PTS
                    </span>
                  </div>
                </div>
              ))}
              {!board?.entries.length && (
                <p className="p-8 text-center text-neutral-400 text-xs font-mono">
                  No eligible players yet.
                </p>
              )}
            </div>

            {/* Desktop View: Traditional Clean Table */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-white/10 bg-[#18181b]">
              <table className="w-full text-sm">
                <thead className="bg-black/60 text-neutral-400 text-xs uppercase font-mono tracking-wider">
                  <tr>
                    <th className="p-3.5 text-left">Rank</th>
                    <th className="p-3.5 text-left">Player</th>
                    <th className="p-3.5 text-right">Points</th>
                    <th className="p-3.5 text-right">Games</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {board?.entries.map((row) => (
                    <tr
                      key={row.playerId}
                      className={`border-t border-white/5 transition-colors ${
                        row.playerId === mine
                          ? "bg-[#38bdf8]/10 hover:bg-[#38bdf8]/15"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="p-3.5 font-bold text-neutral-300">#{row.rank}</td>
                      <td className="p-3.5 font-semibold text-white font-sans">
                        <span className="truncate">{row.displayName}</span>
                        {row.playerId === mine && (
                          <span className="ml-2 px-1.5 py-0.5 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-[10px] font-bold rounded">
                            You
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-black text-white tabular-nums">
                        {row.points}
                      </td>
                      <td className="p-3.5 text-right text-neutral-400">{row.gamesPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!board?.entries.length && (
                <p className="p-8 text-center text-neutral-400 text-sm font-mono">
                  No eligible players yet.
                </p>
              )}
            </div>

            {board?.hasMore && (
              <button
                onClick={() => setPage(page + 1)}
                className="mt-4 w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#18181b] hover:bg-[#27272a] text-white border border-white/15 text-sm font-bold min-h-[40px] cursor-pointer transition-colors font-sans"
              >
                Load more
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
