"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DailyGameHistory } from "@/types/game";
import { getCompletedResult } from "@/lib/storage";
import ResultsSummary from "@/components/ResultsSummary";
import { Loader2 } from "lucide-react";
import Link from "next/link";

function ResultsPageContent() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || "2026-10-12";

  const [history, setHistory] = useState<DailyGameHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const record = getCompletedResult(date);
    setHistory(record);
    setLoading(false);
  }, [date]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-black">
        <Loader2 className="w-8 h-8 text-[#38bdf8] animate-spin" />
      </div>
    );
  }

  if (!history) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto bg-black font-mono">
        <h2 className="text-xl font-bold text-white mb-2 font-sans">No Round Results Found</h2>
        <p className="text-sm text-neutral-400 mb-6">
          You haven&apos;t completed the round for {date} yet.
        </p>
        <Link
          href={`/play?date=${date}`}
          className="px-8 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-full text-sm transition-all inline-flex items-center gap-2 font-sans shadow-lg"
        >
          <span>Play Round ({date}) →</span>
        </Link>
      </div>
    );
  }

  return <ResultsSummary history={history} />;
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}
