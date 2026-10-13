import { NextRequest, NextResponse } from "next/server";
import { upsertPlayer } from "@/lib/leaderboard-store";
import { hasSupabaseAdmin } from "@/lib/supabase-admin";
import { upsertSupabasePlayer } from "@/lib/supabase-leaderboard";
export async function POST(request: NextRequest) {
  try { const { playerId, displayName } = await request.json(); return NextResponse.json({ player: hasSupabaseAdmin ? await upsertSupabasePlayer(playerId, displayName) : upsertPlayer(playerId, displayName) }); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Invalid player profile." }, { status: 400 }); }
}
