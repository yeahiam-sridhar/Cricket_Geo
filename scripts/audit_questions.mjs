import fs from "fs";
import path from "path";

const answerPath = path.join(process.cwd(), "server", "data", "cricket_answer_key.json");
const publicPath = path.join(process.cwd(), "data", "cricket_public_questions.json");

const answers = JSON.parse(fs.readFileSync(answerPath, "utf8"));
const publicData = JSON.parse(fs.readFileSync(publicPath, "utf8"));

const issues = [];

for (const [id, a] of Object.entries(answers)) {
  const p = a.question || "";
  const pl = p.toLowerCase();

  // Check prefix
  if (pl.includes("clue") || pl.includes("archive") || pl.includes("cricketgeo")) {
    issues.push({ id, type: "PREFIX", prompt: p });
  }

  // Check conversational fillers / confusion
  if (pl.includes("no wait") || pl.includes("or did") || pl.includes("wait,") || pl.includes("giving pakistan") || pl.includes("— wait")) {
    issues.push({ id, type: "CONVERSATIONAL", prompt: p });
  }

  // Check grammar
  if (/^Which (New Zealand|England|India|Australia|South Africa|Pakistan|West Indies|Bangladesh|Sri Lanka|Afghanistan) (win|beat|clinch|play|host|bowl)/i.test(p)) {
    issues.push({ id, type: "GRAMMAR_WHICH_TEAM", prompt: p });
  }

  // Check if it clearly asks for a location
  const asksLocation = /where|which\b[\w\s'-]*(ground|stadium|city|venue|oval|suburb|town|province|hill station|harbour|park|arena)|at which|in which/i.test(p);
  if (!asksLocation) {
    issues.push({ id, type: "NOT_EXPLICIT_LOCATION", prompt: p });
  }

  // Check valid coordinates and names
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || a.latitude < -90 || a.latitude > 90 || a.longitude < -180 || a.longitude > 180) {
    issues.push({ id, type: "INVALID_COORDS", a });
  }
  if (!a.location_name || !a.city || !a.physical_country) {
    issues.push({ id, type: "MISSING_GEO_FIELDS", a });
  }

  // Check if question asks "In which city..." but location_name / city contradict
  if (p.includes("In which") && p.includes("city")) {
    // If the question gives the city away in the question itself:
    const cityRegex = new RegExp(`\\b${a.city}\\b`, "i");
    // e.g. "In which Yorkshire city was Joe Root born... Sheffield"
  }
}

console.log(`Found ${issues.length} potential issues:`);
for (const iss of issues) {
  console.log(`[${iss.id}] ${iss.type}: ${iss.prompt || JSON.stringify(iss.a)}`);
}

const teams = ["England","India","Australia","New Zealand","South Africa","Pakistan","West Indies","Bangladesh","Sri Lanka","Afghanistan"];
console.log("\nDifficulty counts per team:");
for (const t of teams) {
  const teamQs = Object.values(answers).filter(q => q.featuredTeam === t);
  const diffs = {};
  teamQs.forEach(q => diffs[q.difficulty] = (diffs[q.difficulty] || 0) + 1);
  console.log(t, diffs);
}
