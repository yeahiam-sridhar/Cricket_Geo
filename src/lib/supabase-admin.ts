import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseAdmin = Boolean(url && secretKey);

export function isSupabaseAdminConfigured(): boolean {
  const currentUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const currentSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(currentUrl && currentSecretKey);
}

let cachedAdminClient: any = null;
let cachedKey = "";

export function getSupabaseAdmin() {
  const currentUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const currentSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!currentUrl || !currentSecretKey) {
    throw new Error("Supabase leaderboard storage is not configured. Set SUPABASE_SECRET_KEY on the server.");
  }
  const key = `${currentUrl}:${currentSecretKey}`;
  if (!cachedAdminClient || cachedKey !== key) {
    cachedAdminClient = createClient(currentUrl, currentSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedKey = key;
  }
  return cachedAdminClient;
}

