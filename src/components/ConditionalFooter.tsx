"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function ConditionalFooter() {
  const pathname = usePathname();

  // On the interactive gameplay page, omit the footer so the game fills 100% of the viewport with zero document scroll
  if (pathname === "/play") {
    return null;
  }

  return (
    <footer className="w-full border-t border-[#18181b] py-6 text-center text-xs text-neutral-500 bg-black shrink-0 font-mono">
      <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          CricketGeo — Daily sports geography game.
        </p>
        <p className="text-[11px] text-neutral-600">
          5 questions daily • Tap where it happened
        </p>
      </div>
    </footer>
  );
}
