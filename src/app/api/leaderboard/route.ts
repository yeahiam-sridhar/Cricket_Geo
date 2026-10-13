import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard-store";
import { hasSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseLeaderboard } from "@/lib/supabase-leaderboard";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "all" ? "all" : "today";
  const page = Number(searchParams.get("page") || "1");
  return NextResponse.json(hasSupabaseAdmin ? await getSupabaseLeaderboard(scope, Number.isFinite(page) ? page : 1) : getLeaderboard(scope, Number.isFinite(page) ? page : 1));
}
