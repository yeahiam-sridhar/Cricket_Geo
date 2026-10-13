# CricketGeo 🏏🌍

An interactive, daily cricket geography game inspired by GeoSports and Wordle. Players guess the exact global stadium where historic cricket moments occurred on a 3D interactive globe.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.17.0 or higher
- **npm** (or yarn / pnpm)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yeahiam-sridhar/Cricket_Geo.git
   cd Cricket_Geo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables (Optional):**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env.local
   ```
   *Note: If Supabase credentials are not provided, CricketGeo automatically falls back to local JSON storage (`server/data/`) for leaderboards and player history.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to start playing.

### Available Scripts

- `npm run dev` — Starts the Next.js development server.
- `npm run build` — Builds the application for production.
- `npm run start` — Runs the production server.
- `npm test` — Runs the Vitest test suite (70+ unit and regression tests).
- `npm run audit:dataset` — Audits the question dataset for coordinate accuracy and balance.

---

## 🎮 Game Architecture & Mechanics

### Shared Leaderboard Persistence

The leaderboard is maintained server-side in JSON at `server/data/leaderboard.json` during local development. For a deployed shared leaderboard, mount durable storage and set:

```text
LEADERBOARD_STORE_PATH=/persistent-volume/cricketgeo/leaderboard.json
```

Every application instance must use the same writable persistent path. This project does not use browser storage for scores: the browser stores only its anonymous player ID and display-name preference. The server records each scored guess, accepts a completed game only after all five server-scored questions are present, and ranks a player's highest completed five-question score.

Daily rankings use `Asia/Kolkata`. Ties are ordered by higher score, then earlier qualifying game, then anonymous player ID.

### Distance Scoring

Valid guesses are scored on the server from the calculated distance in miles:
```text
max(5, min(100, round(100 * exp(-distanceMiles / 2500))))
```
Each question earns 5–100 points, and a five-question game is out of 500. The leaderboard total is the sum of the five stored server-scored attempts; the client cannot submit a score.

### Map & Reveal Sequence

- Built with **MapLibre GL** using 3D globe projection.
- Guess and answer objects use named `latitude` and `longitude` fields. Conversion to MapLibre's `[longitude, latitude]` tuple happens only at the map boundary.
- The answer key is authoritative for scoring, route endpoints, markers, and camera targets; the reveal card is held until the distance-aware camera journey reaches that answer location.
- Reveal sequence:
  1. Guess locked on submission.
  2. Server score calculated asynchronously.
  3. Globe rotates and flies across the geodesic route unobstructed.
  4. Camera settles at the destination stadium.
  5. Result card smoothly slides up with authoritative distance, points, and venue trivia.

### Question Data & Selection

- `data/cricket_question_audit_report.json` tracks source-backed corrections, coordinate normalizations, and question validation.
- Dated and practice round API responses select five questions with a balanced 2 Easy / 1 Medium / 2 Hard mix across cricket-playing nations.
- The question bank is stored in `data/cricket_public_questions.json`, with authoritative server-side answers in `server/data/cricket_answer_key.json`.
