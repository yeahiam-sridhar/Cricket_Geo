import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const answerPath = path.join(root, "server/data/cricket_answer_key.json");
const publicPath = path.join(root, "data/cricket_public_questions.json");
const answers = JSON.parse(fs.readFileSync(answerPath, "utf8"));
const allowed = new Set(["England", "India", "Australia", "New Zealand", "South Africa", "Pakistan", "West Indies", "Bangladesh", "Sri Lanka", "Afghanistan"]);
const entries = Object.values(answers);

for (const entry of entries) {
  entry.answerCountryGroup = entry.featuredTeam;
}

const publicData = JSON.parse(fs.readFileSync(publicPath, "utf8"));
for (const round of publicData.rounds) {
  for (const question of round.questions) {
    const answer = answers[question.id];
    question.prompt = answer.question;
    question.category = answer.category;
    question.difficulty = answer.difficulty;
    question.featuredTeam = answer.featuredTeam;
  }
}
fs.writeFileSync(answerPath, JSON.stringify(answers, null, 2));
fs.writeFileSync(publicPath, JSON.stringify(publicData, null, 2));
