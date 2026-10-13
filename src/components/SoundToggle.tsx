"use client";

import React, { useEffect, useState } from "react";
import { soundController } from "@/lib/audio";
import { Volume2, VolumeX } from "lucide-react";

interface SoundToggleProps {
  className?: string;
  compact?: boolean;
}

export default function SoundToggle({ className = "", compact = false }: SoundToggleProps) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Subscribe to sound controller state updates
    const unsubscribe = soundController.subscribe((soundState) => {
      setEnabled(soundState);
    });
    return () => unsubscribe();
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    soundController.toggle();
  };

  // Avoid SSR hydration mismatch
  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-xl bg-slate-900/60 border border-white/10 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      onClick={handleToggle}
      className={`relative inline-flex items-center justify-center rounded-xl transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${
        enabled
          ? "bg-slate-900/80 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm"
          : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10"
      } ${
        compact
          ? "w-7 h-7 sm:w-8 sm:h-8 text-xs"
          : "w-8 h-8 sm:w-9 sm:h-9 text-sm"
      } ${className}`}
      title={enabled ? "Mute game sounds (Audio ON)" : "Unmute game sounds (Audio OFF)"}
      aria-label={enabled ? "Mute game sounds" : "Unmute game sounds"}
      aria-pressed={!enabled}
    >
      {enabled ? (
        <Volume2 className={compact ? "w-3.5 h-3.5 sm:w-4 sm:h-4" : "w-4 h-4"} />
      ) : (
        <VolumeX className={compact ? "w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400/90" : "w-4 h-4 text-rose-400/90"} />
      )}
      <span className="sr-only">
        {enabled ? "Game Audio On" : "Game Audio Muted"}
      </span>
    </button>
  );
}
