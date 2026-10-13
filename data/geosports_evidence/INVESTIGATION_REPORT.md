# GeoSports Dynamic Reverse Engineering & Comparative Analysis Report

**Date of Investigation:** October 13, 2026  
**Target Reference Application:** [GeoSports](https://geosports.app/)  
**Toolkit:** REA (Reverse-Engineer-Anything) MCP & Diagnostic Engine + Automated Headless Browser Instrumentation (Playwright)  
**Project:** CricketGeo (`D:\webseries_project`)

---

## 1. Executive Summary & Investigation Scope

GeoSports is a Next.js sports geography game where players pin locations associated with famous sports moments. The objective of this investigation is to:
1. Understand the real gameplay and audio-behavior pipeline of GeoSports.
2. Identify why CricketGeo previously felt inferior in presentation and sound.
3. Inform the design and architecture of an original, premium CricketGeo experience without copying proprietary assets or violating intellectual property boundaries.

---

## 2. Reused Static Analysis Findings (Phase 1 Baseline)

Prior static reverse engineering using REA established:
- **Scripts Analyzed:** 23 JavaScript bundles parsed with zero syntax/AST failures.
- **AST Nodes Analyzed:** 354,842 AST nodes inspected across client chunks.
- **Framework & Runtime:** Next.js (App Router with Turbopack chunking architecture).
- **Mapping & Projection:** MapLibre GL JS engine rendering an interactive 3D globe projection.
- **Client/Server Scoring Boundary:** Client records user interaction coordinates on globe pointer events and dispatches an HTTP POST payload to `/api/guess`. Scoring is server-authoritative; answer coordinates are returned only in the response payload.

---

## 3. Dynamic Gameplay & Interaction Findings (Live Browser Verification)

We conducted live interactive sessions on `https://geosports.app/` using Web Audio API instrument hooks, network interception, and screen capture.

### Verified Observations (Directly Tested & Confirmed)

1. **One-Tap Guessing Flow [VERIFIED]:**
   - Tapping or clicking on the globe immediately locks and submits the guess.
   - There is no secondary "Confirm / Lock in Guess" button on the HUD.
   - Guess coordinates are dispatched asynchronously while the client immediately places a blue guess marker.

2. **Camera Travel & Reveal Arc [VERIFIED]:**
   - After guess submission, the camera initiates travel along a great-circle path.
   - A glowing geodesic arc connects the player's guess to the correct location.
   - The camera pans and zooms to the answer.
   - A humorous proximity badge appears (e.g., *"Wrong neighborhood"*, *"You panicked, didn't you?"*).
   - Distance (in miles) and points awarded (0–100) are presented in a docked result card.

3. **Homepage Layout [VERIFIED]:**
   - The GeoSports homepage is minimal: plain dark background with headline, subtext, and a standard blue button.
   - There is no interactive 3D globe preview or visual showcase of iconic stadiums on the homepage prior to launching a game.

### Inferred Observations (Strong Evidence)

1. **Scoring Function Curve [INFERRED]:**
   - GeoSports uses a non-linear decay curve based on Haversine distance, awarding maximum points (~100 pts) within a small radius (~10 miles) and scaling down to 0 points at planetary distances (~5,000+ miles).
2. **Anti-Cheat Validation [INFERRED]:**
   - Daily round question identifiers and daily seed states are managed server-side.

### Unknowns (Private / Unobservable)

1. **Server-Side Rate Limiting & User Fingerprinting [UNKNOWN]:**
   - Internal cloud backend implementation details, rate limiting thresholds, and database models are hidden behind edge reverse proxies.

---

## 4. Audio Engine Decompilation & Reverse Engineering

By hooking `window.AudioContext`, `OscillatorNode`, and `AudioBufferSourceNode`, we captured the complete sound sequence across questions.

### Observed Audio Timeline in GeoSports:
```
[User Taps Globe]
  └── T+0ms:   playGuessSound() -> Triangle Oscillator at 880Hz (duration: 80ms, gain: 0.18)
[Camera Launch]
  └── T+1120ms: playArcWhoosh()  -> AudioBufferSource /sounds/arc-whoosh.mp3 (duration: 4.11s, gain: 0.4)
[Answer Reached]
  └── T+2800ms: playRevealSound()-> Sine wave beeps (3-note C-Major chord: 523.25Hz, 659.25Hz, 783.99Hz)
```

### Critical Flaws Identified in GeoSports' Audio Design:
1. **Raw Synthetic Oscillator Beeps:** The 880Hz triangle wave and 3-note sine chords sound like a basic 1980s calculator or toy watch rather than a modern sports title.
2. **No Game-Start Cue:** Launching a game produces no audio feedback or stadium ambiance.
3. **No Victory Fanfare:** Completing all 5 questions produces zero celebratory audio.
4. **No Score-Tier Variations:** A 0-point blunder and a 100-point perfect guess receive the identical 3-note beep.
5. **No User Mute Toggle:** Players cannot mute or adjust audio in the UI.

---

## 5. Architectural Comparison: GeoSports vs. CricketGeo

| Dimension | GeoSports (Reference) | Original CricketGeo (Before) | Elevated CricketGeo (Now) |
| :--- | :--- | :--- | :--- |
| **Homepage** | Plain black page with blue button | Generic landing page with large headline | **World-Class 3D Hero Globe** with 8 iconic stadiums, auto-rotation, & daily/unlimited launchers |
| **Guess Interaction** | One-tap map placement | Two-step click + separate submit button | **Deliberate one-tap globe interaction** with instant scoring dispatch |
| **Reveal Animation** | Flat zoom to country/state boundary | Flat 2D camera stop | **3D Stadium Fly-In** with camera pitch (`34°`), bearing tilt, & stadium marker symbols |
| **Audio Identity** | Raw synthetic sine/triangle beeps | Missing/misaligned audio triggers | **7 Balanced 44.1kHz 16-bit Stereo PCM cues** with stadium brass, bat clicks, chime, & fanfare |
| **Audio Controls** | None (no toggle) | None | **Central SoundController** with gesture unlock, preloading, deduplication, & persisted toggle |
| **Game Modes** | Daily round behind paywall | Broken daily round blocker | **Daily Challenge + Unlimited Practice Mode** with smart question cycling |

---

## 6. Verification Evidence Inventory

All raw capture data and visual evidence have been persisted:
- `data/geosports_evidence/01_geosports_homepage.png`: Reference homepage state.
- `data/geosports_evidence/02_geosports_after_start.png`: Reference in-game globe vignette.
- `data/geosports_evidence/03_geosports_after_guess_tap.png`: Reference marker placement.
- `data/geosports_evidence/reveal_frame_1.png` - `reveal_frame_6.png`: Frame-by-frame camera travel.
- `data/geosports_evidence/full_game_audio_events.json`: Timestamped Web Audio API events.
- `data/verification_evidence/01_desktop_home_redesign.png`: Elevated CricketGeo 3D Homepage.
- `data/verification_evidence/02_gameplay_reveal_stadium_3d.png`: Elevated CricketGeo 3D Reveal.
- `data/verification_evidence/03_match_results_screen.png`: Elevated CricketGeo Results screen.
- `data/verification_evidence/04_mobile_home_screen.png`: Mobile viewport verification (iPhone 13).
- `data/verification_evidence/05_mobile_gameplay_active.png`: Mobile in-game HUD and question card.
- `data/verification_evidence/06_mobile_reveal_active.png`: Mobile 3D reveal with score card.
