"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Coordinates, GuessResponse, RevealPhase } from "@/types/game";

const DynamicCricketGlobe = dynamic(
  () => import("@/components/CricketGlobeMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-0 bg-[#020408] flex flex-col items-center justify-center text-slate-400 gap-3 border border-white/5">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-400">
          Loading 3D Globe & Satellite Imagery...
        </p>
      </div>
    ),
  }
);

interface MapContainerProps {
  selectedGuess: Coordinates | null;
  onSubmitGuess?: (coords: Coordinates) => void;
  onSelectGuess?: (coords: Coordinates) => void;
  revealData: GuessResponse | null;
  isSubmitting?: boolean;
  isScoring?: boolean;
  isResultMode?: boolean;
  onRevealPhaseChange?: (phase: RevealPhase) => void;
  onRevealAnimationComplete?: () => void;
}

export default function MapContainer({
  selectedGuess,
  onSubmitGuess,
  onSelectGuess,
  revealData,
  isSubmitting,
  isScoring,
  isResultMode = false,
  onRevealPhaseChange,
  onRevealAnimationComplete,
}: MapContainerProps) {
  const submitHandler = onSubmitGuess || onSelectGuess || (() => {});
  const submittingState = isSubmitting ?? isScoring ?? false;

  return (
    <div className="w-full h-full min-h-0 bg-[#020408] relative">
      <DynamicCricketGlobe
        selectedGuess={selectedGuess}
        onSubmitGuess={submitHandler}
        revealData={revealData}
        isSubmitting={submittingState}
        isResultMode={isResultMode}
        onRevealPhaseChange={onRevealPhaseChange}
        onRevealAnimationComplete={onRevealAnimationComplete}
      />
    </div>
  );
}
