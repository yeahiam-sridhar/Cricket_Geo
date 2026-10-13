import fs from "fs";
import path from "path";

function parseWavHeader(buffer) {
  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    return { error: "Not a valid WAV file" };
  }

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = dataSize / (numChannels * bytesPerSample);
  const duration = numSamples / sampleRate;

  // Scan 16-bit PCM samples for peak amplitude and RMS
  let maxAbs = 0;
  let sumSquares = 0;
  let sampleCount = 0;
  const offset = 44; // standard data chunk start

  for (let i = offset; i < Math.min(buffer.length - 1, offset + dataSize); i += 2) {
    const sample = buffer.readInt16LE(i) / 32768.0;
    const abs = Math.abs(sample);
    if (abs > maxAbs) maxAbs = abs;
    sumSquares += sample * sample;
    sampleCount++;
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const peakDb = 20 * Math.log10(Math.max(1e-5, maxAbs));
  const rmsDb = 20 * Math.log10(Math.max(1e-5, rms));

  return {
    numChannels,
    sampleRate,
    bitsPerSample,
    durationSec: Number(duration.toFixed(3)),
    peakDb: Number(peakDb.toFixed(2)),
    rmsDb: Number(rmsDb.toFixed(2)),
    isClipping: maxAbs >= 0.999,
  };
}

const soundsDir = path.join(process.cwd(), "public", "sounds");
const files = fs.readdirSync(soundsDir).filter((f) => f.endsWith(".wav"));

console.log("=== Audio Asset Audit (public/sounds) ===");
for (const file of files) {
  const buf = fs.readFileSync(path.join(soundsDir, file));
  const meta = parseWavHeader(buf);
  console.log(`${file} (${(buf.length / 1024).toFixed(1)} KB):`, meta);
}
