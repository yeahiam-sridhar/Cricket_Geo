import fs from "fs";
import path from "path";

const SAMPLE_RATE = 44100;
const PUBLIC_SOUNDS_DIR = path.join(process.cwd(), "public", "sounds");

// Ensure public/sounds exists
if (!fs.existsSync(PUBLIC_SOUNDS_DIR)) {
  fs.mkdirSync(PUBLIC_SOUNDS_DIR, { recursive: true });
}

/**
 * Creates a standard 44.1kHz 16-bit PCM WAV buffer from stereo floating-point samples [-1, 1].
 */
function encodeWav(leftChannel, rightChannel, sampleRate = SAMPLE_RATE) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = leftChannel.length;
  const dataByteLength = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataByteLength);

  // RIFF Chunk Descriptor
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write("WAVE", 8);

  // fmt Subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

  // data Subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  // Write interleaved PCM 16-bit samples with soft limiting
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Soft limiter (tanh-like compression to prevent clipping)
    const l = Math.tanh(leftChannel[i]);
    const r = Math.tanh(rightChannel[i]);

    const sL = Math.max(-32768, Math.min(32767, Math.round(l * 32767)));
    const sR = Math.max(-32768, Math.min(32767, Math.round(r * 32767)));

    buffer.writeInt16LE(sL, offset);
    buffer.writeInt16LE(sR, offset + 2);
    offset += 4;
  }

  return buffer;
}

// -------------------------------------------------------------
// Sound Synthesizers: High-Fidelity Additive Harmonic Engines
// -------------------------------------------------------------

/**
 * A. Game-Start Sting (1.5 seconds)
 * Energetic, sports-broadcast fanfare with a punchy opening kick/snare,
 * ascending brass-style synth stabs (D4, G4, B4, D5) and a shimmering tail.
 */
function generateGameStartSting() {
  const duration = 1.45;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  // Chords: G Major arpeggio with brassy overtone warmth
  const notes = [
    { time: 0.0, freq: 293.66, dur: 0.35, pan: -0.2 }, // D4
    { time: 0.12, freq: 392.0, dur: 0.4, pan: 0.15 },  // G4
    { time: 0.24, freq: 493.88, dur: 0.45, pan: -0.15 }, // B4
    { time: 0.38, freq: 587.33, dur: 0.95, pan: 0.0 },  // D5 (Apex)
    { time: 0.40, freq: 783.99, dur: 0.90, pan: 0.25 }, // G5 (Shimmer)
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let sampleL = 0;
    let sampleR = 0;

    // Opening percussive stadium impact
    if (t < 0.25) {
      const impEnv = Math.exp(-t * 22);
      const impPitch = 140 * Math.exp(-t * 30);
      const kick = Math.sin(2 * Math.PI * impPitch * t) * impEnv * 0.45;
      sampleL += kick;
      sampleR += kick;
    }

    // Melodic fanfare notes
    for (const note of notes) {
      if (t >= note.time && t < note.time + note.dur) {
        const localT = t - note.time;
        // ADSR: 12ms attack, exponential decay
        const attack = Math.min(1, localT / 0.015);
        const decay = Math.exp(-localT * 3.5);
        const env = attack * decay * 0.26;

        // Rich brass harmonics: f, 2f, 3f, 4f
        const f = note.freq;
        const wave =
          Math.sin(2 * Math.PI * f * localT) * 0.55 +
          Math.sin(2 * Math.PI * f * 2 * localT) * 0.25 +
          Math.sin(2 * Math.PI * f * 3 * localT) * 0.12 +
          Math.sin(2 * Math.PI * f * 4 * localT) * 0.08;

        const panL = 0.5 * (1 - note.pan);
        const panR = 0.5 * (1 + note.pan);

        sampleL += wave * env * panL;
        sampleR += wave * env * panR;
      }
    }

    // High shimmer / sparkle
    if (t > 0.4) {
      const sparkleT = t - 0.4;
      const sparkleEnv = Math.exp(-sparkleT * 3.0) * 0.08;
      const sparkleFreq = 1567.98; // G6
      const sparkle = Math.sin(2 * Math.PI * sparkleFreq * sparkleT) * sparkleEnv;
      sampleL += sparkle * 0.4;
      sampleR += sparkle * 0.6;
    }

    left[i] = sampleL;
    right[i] = sampleR;
  }

  return encodeWav(left, right);
}

/**
 * B. Guess Confirmation Cue (180 ms)
 * Tactile acoustic English willow cricket bat sweet-spot strike + subtle bright lock chime.
 */
function generateGuessConfirmation() {
  const duration = 0.2;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Willow impact transient (leather-on-wood)
    const woodEnv = Math.exp(-t * 45);
    const woodFreq = 340 * Math.exp(-t * 28);
    const woodThump = Math.sin(2 * Math.PI * woodFreq * t) * woodEnv * 0.45;

    // 2. High snap click
    const snapEnv = Math.exp(-t * 90);
    const snapNoise = (Math.random() * 2 - 1) * snapEnv * 0.15;

    // 3. Crisp electronic lock confirmation bell (A5 = 880Hz, E6 = 1318Hz)
    const bellEnv = Math.exp(-t * 18);
    const bell1 = Math.sin(2 * Math.PI * 880 * t) * bellEnv * 0.22;
    const bell2 = Math.sin(2 * Math.PI * 1318.5 * t) * bellEnv * 0.12;

    const mono = woodThump + snapNoise + bell1 + bell2;
    left[i] = mono * 0.95;
    right[i] = mono * 1.05;
  }

  return encodeWav(left, right);
}

/**
 * C. Globe-Reveal Transition Whoosh (480 ms)
 * Rising aerodynamic spatial sweep evoking globe rotation toward venue.
 */
function generateGlobeRevealWhoosh() {
  const duration = 0.48;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  // State for simple resonant 2-pole IIR filter
  let y1L = 0, y2L = 0;
  let y1R = 0, y2R = 0;

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Envelope: swell up and taper down smoothly
    const env = Math.sin(progress * Math.PI) * Math.sin(progress * Math.PI);

    // Filter frequency sweeps from 250Hz up to 2200Hz, then gently down to 400Hz
    let centerFreq = 220 + 2000 * Math.sin(progress * Math.PI * 0.85);
    centerFreq = Math.max(150, Math.min(centerFreq, 4000));

    // Simple resonance filter coefficients
    const q = 4.5;
    const omega = (2 * Math.PI * centerFreq) / SAMPLE_RATE;
    const alpha = Math.sin(omega) / (2 * q);
    const b0 = alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(omega);
    const a2 = 1 - alpha;

    // Filtered pinkish noise
    const whiteL = (Math.random() * 2 - 1) * 0.45;
    const whiteR = (Math.random() * 2 - 1) * 0.45;

    const outL = (b0 / a0) * whiteL - (a1 / a0) * y1L - (a2 / a0) * y2L;
    y2L = y1L;
    y1L = outL;

    const outR = (b0 / a0) * whiteR - (a1 / a0) * y1R - (a2 / a0) * y2R;
    y2R = y1R;
    y1R = outR;

    // Stereo panning sweep: sweeps from left to right as globe rotates
    const pan = -0.5 + progress * 1.0;
    const gainL = 0.5 * (1 - pan);
    const gainR = 0.5 * (1 + pan);

    // Subtle low sub-pulse for cinematic weight
    const sub = Math.sin(2 * Math.PI * (110 - progress * 40) * t) * env * 0.12;

    left[i] = (outL * 1.2 + sub) * env * gainL;
    right[i] = (outR * 1.2 + sub) * env * gainR;
  }

  return encodeWav(left, right);
}

/**
 * D1. Score-Reveal Cue (520 ms)
 * Satisfying, positive, modern sports-game scoring accent. Ascending major chime (F5 -> A5 -> C6).
 */
function generateScoreRevealCue() {
  const duration = 0.52;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  const notes = [
    { time: 0.0, freq: 698.46, dur: 0.35, pan: -0.2 }, // F5
    { time: 0.08, freq: 880.0, dur: 0.38, pan: 0.1 },  // A5
    { time: 0.16, freq: 1046.5, dur: 0.36, pan: 0.0 }, // C6
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let sL = 0, sR = 0;

    for (const note of notes) {
      if (t >= note.time && t < note.time + note.dur) {
        const localT = t - note.time;
        const attack = Math.min(1, localT / 0.01);
        const decay = Math.exp(-localT * 6.5);
        const env = attack * decay * 0.28;

        const f = note.freq;
        // Warm electric chime (sine + octave + 3rd harmonic)
        const wave =
          Math.sin(2 * Math.PI * f * localT) * 0.65 +
          Math.sin(2 * Math.PI * f * 2 * localT) * 0.25 +
          Math.sin(2 * Math.PI * f * 3 * localT) * 0.1;

        const panL = 0.5 * (1 - note.pan);
        const panR = 0.5 * (1 + note.pan);

        sL += wave * env * panL;
        sR += wave * env * panR;
      }
    }

    left[i] = sL;
    right[i] = sR;
  }

  return encodeWav(left, right);
}

/**
 * D2. Score-Perfect Cue (620 ms)
 * Brilliant, celebratory crystalline chime for 95-100 PTS guesses.
 * Arpeggiated C-Major-9th flourish (C5, E5, G5, B5, D6).
 */
function generateScorePerfectCue() {
  const duration = 0.62;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  const notes = [
    { time: 0.0, freq: 523.25, dur: 0.45, pan: -0.25 }, // C5
    { time: 0.05, freq: 659.25, dur: 0.48, pan: -0.1 }, // E5
    { time: 0.10, freq: 783.99, dur: 0.5, pan: 0.1 },   // G5
    { time: 0.15, freq: 987.77, dur: 0.45, pan: 0.2 },  // B5
    { time: 0.20, freq: 1174.66, dur: 0.42, pan: 0.0 }, // D6 (Top crown)
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let sL = 0, sR = 0;

    for (const note of notes) {
      if (t >= note.time && t < note.time + note.dur) {
        const localT = t - note.time;
        const attack = Math.min(1, localT / 0.008);
        const decay = Math.exp(-localT * 5.5);
        const env = attack * decay * 0.22;

        const f = note.freq;
        const wave =
          Math.sin(2 * Math.PI * f * localT) * 0.6 +
          Math.sin(2 * Math.PI * f * 2 * localT) * 0.25 +
          Math.sin(2 * Math.PI * f * 4 * localT) * 0.15;

        const panL = 0.5 * (1 - note.pan);
        const panR = 0.5 * (1 + note.pan);

        sL += wave * env * panL;
        sR += wave * env * panR;
      }
    }

    left[i] = sL;
    right[i] = sR;
  }

  return encodeWav(left, right);
}

/**
 * E. Match-Complete Victory Fanfare (2.1 seconds)
 * Full triumphant stadium championship fanfare.
 * 6-note brass resolution + celebratory timpani accent.
 */
function generateMatchVictoryFanfare() {
  const duration = 2.1;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  // Victory motif: C5, E5, G5, C6 (sustain), D6, E6 (final triumphant chord)
  const notes = [
    { time: 0.0, freq: 523.25, dur: 0.22, pan: -0.2 },  // C5
    { time: 0.14, freq: 659.25, dur: 0.22, pan: 0.15 }, // E5
    { time: 0.28, freq: 783.99, dur: 0.25, pan: -0.1 }, // G5
    { time: 0.44, freq: 1046.5, dur: 0.55, pan: 0.0 },  // C6
    { time: 0.72, freq: 1174.66, dur: 0.25, pan: -0.15 }, // D6
    { time: 0.88, freq: 1318.51, dur: 1.2, pan: 0.0 }, // E6 (Apex resolution)
    // Harmonizing root & 5th for final chord
    { time: 0.88, freq: 659.25, dur: 1.2, pan: -0.25 }, // E5
    { time: 0.88, freq: 987.77, dur: 1.2, pan: 0.25 },  // B5
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let sL = 0, sR = 0;

    // Opening stadium drum impact
    if (t < 0.35) {
      const timpEnv = Math.exp(-t * 12);
      const timp = Math.sin(2 * Math.PI * 95 * t) * timpEnv * 0.35;
      sL += timp;
      sR += timp;
    }

    // Secondary drum impact on apex chord
    if (t >= 0.88 && t < 1.35) {
      const tApex = t - 0.88;
      const timpEnv = Math.exp(-tApex * 10);
      const timp = Math.sin(2 * Math.PI * 82 * tApex) * timpEnv * 0.4;
      sL += timp;
      sR += timp;
    }

    // Fanfare brass notes
    for (const note of notes) {
      if (t >= note.time && t < note.time + note.dur) {
        const localT = t - note.time;
        const attack = Math.min(1, localT / 0.02);
        const decay = Math.exp(-localT * (note.dur > 0.8 ? 2.2 : 4.5));
        const env = attack * decay * 0.22;

        const f = note.freq;
        const wave =
          Math.sin(2 * Math.PI * f * localT) * 0.5 +
          Math.sin(2 * Math.PI * f * 2 * localT) * 0.28 +
          Math.sin(2 * Math.PI * f * 3 * localT) * 0.14 +
          Math.sin(2 * Math.PI * f * 4 * localT) * 0.08;

        const panL = 0.5 * (1 - note.pan);
        const panR = 0.5 * (1 + note.pan);

        sL += wave * env * panL;
        sR += wave * env * panR;
      }
    }

    left[i] = sL;
    right[i] = sR;
  }

  return encodeWav(left, right);
}

/**
 * F. UI Button / Audio Toggle Tick (75 ms)
 * Clean, subtle, modern tactile switch click.
 */
function generateUiToggle() {
  const duration = 0.075;
  const length = Math.floor(SAMPLE_RATE * duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 60);
    const freq = 560 * Math.exp(-t * 24);
    const wave = Math.sin(2 * Math.PI * freq * t) * env * 0.16;

    left[i] = wave;
    right[i] = wave;
  }

  return encodeWav(left, right);
}

// -------------------------------------------------------------
// Generation Pipeline
// -------------------------------------------------------------

console.log("Generating CricketGeo original broadcast audio assets in:", PUBLIC_SOUNDS_DIR);

const assets = [
  { file: "game-start.wav", fn: generateGameStartSting, desc: "A. Game-Start Sting" },
  { file: "guess-confirm.wav", fn: generateGuessConfirmation, desc: "B. Guess Confirmation Cue" },
  { file: "globe-whoosh.wav", fn: generateGlobeRevealWhoosh, desc: "C. Globe-Reveal Transition" },
  { file: "score-reveal.wav", fn: generateScoreRevealCue, desc: "D1. Score-Reveal Cue" },
  { file: "score-perfect.wav", fn: generateScorePerfectCue, desc: "D2. Score-Perfect Cue (95+ pts)" },
  { file: "match-victory.wav", fn: generateMatchVictoryFanfare, desc: "E. Match-Complete Victory Fanfare" },
  { file: "ui-toggle.wav", fn: generateUiToggle, desc: "F. UI Button & Audio Toggle" },
];

for (const asset of assets) {
  const targetPath = path.join(PUBLIC_SOUNDS_DIR, asset.file);
  const buffer = asset.fn();
  fs.writeFileSync(targetPath, buffer);
  const sizeKb = (buffer.length / 1024).toFixed(1);
  console.log(`✓ Generated ${asset.file} (${sizeKb} KB) - ${asset.desc}`);
}

console.log("All CricketGeo audio assets successfully synthesized and written to public/sounds!");
