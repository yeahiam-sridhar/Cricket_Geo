import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local without external dependencies
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env.local.");
  process.exit(1);
}

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runTest() {
  console.log("=================================================");
  console.log("CricketGeo Server-Side Supabase Connection Test");
  console.log("=================================================");
  console.log(`Target URL: ${url}`);
  console.log(`Key type: ${secretKey.startsWith("sb_secret_") ? "Supabase Secret Key (valid prefix)" : "Service Role / Custom Key"}`);

  // 1. Check tables
  const tables = ["anonymous_players", "game_attempts", "completed_games"];
  let missingTables = false;

  for (const table of tables) {
    const { data, error } = await client.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ Table 'public.${table}': NOT FOUND (${error.code}: ${error.message})`);
      missingTables = true;
    } else {
      console.log(`✅ Table 'public.${table}': Found (accessible via server client)`);
    }
  }

  if (missingTables) {
    console.log("\n⚠️  Status: Migration has not been applied yet in the Supabase project.");
    console.log("The SQL migration file 'supabase/migrations/20261012_cricketgeo_leaderboard.sql' needs to be executed in the Supabase SQL Editor.");
    process.exit(2);
  }

  // 2. Perform write test
  const testPlayerId = `test-verify-conn-${Date.now()}`;
  const testDisplayName = "Test Umpire";
  const testGameId = `testgame-${Date.now()}`;
  const testDate = new Date().toISOString().slice(0, 10);
  const testQuestionId = "q-test-01";
  const testScore = 85;

  console.log(`\nWriting test player record: ${testPlayerId}...`);
  const { error: playerErr } = await client.from("anonymous_players").upsert({
    player_id: testPlayerId,
    display_name: testDisplayName,
    updated_at: new Date().toISOString(),
  });

  if (playerErr) {
    throw new Error(`Failed to insert test player: ${playerErr.message}`);
  }
  console.log("✅ Successfully inserted test player.");

  console.log("Writing test attempt record...");
  const { error: attemptErr } = await client.from("game_attempts").upsert({
    player_id: testPlayerId,
    game_id: testGameId,
    round_date: testDate,
    question_id: testQuestionId,
    score: testScore,
  });

  if (attemptErr) {
    throw new Error(`Failed to insert test attempt: ${attemptErr.message}`);
  }
  console.log("✅ Successfully inserted test attempt.");

  // 3. Read back
  console.log("Reading back test attempt record...");
  const { data: readData, error: readErr } = await client
    .from("game_attempts")
    .select("question_id, score, anonymous_players(display_name)")
    .eq("player_id", testPlayerId)
    .eq("game_id", testGameId)
    .single();

  if (readErr) {
    throw new Error(`Failed to read test record: ${readErr.message}`);
  }

  if (readData.score !== testScore) {
    throw new Error(`Score mismatch: expected ${testScore}, got ${readData.score}`);
  }
  console.log(`✅ Verified test record: score=${readData.score}, display_name=${readData.anonymous_players?.display_name}`);

  // 4. Clean up test record
  console.log("Cleaning up test player and cascaded records...");
  const { error: delErr } = await client
    .from("anonymous_players")
    .delete()
    .eq("player_id", testPlayerId);

  if (delErr) {
    throw new Error(`Failed to delete test record: ${delErr.message}`);
  }

  // Verify cleanup
  const { data: verifyData } = await client
    .from("anonymous_players")
    .select("player_id")
    .eq("player_id", testPlayerId);

  if (verifyData && verifyData.length > 0) {
    throw new Error("Cleanup failed: record still exists after deletion.");
  }
  console.log("✅ Cleanup verified: test record removed cleanly.");
  console.log("\n🎉 Full round-trip read/write test SUCCEEDED!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
