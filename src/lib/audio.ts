// CricketGeo Professional Audio Engine
// Combines preloaded studio broadcast WAV audio assets with instant procedural Web Audio synthesis fallback.
// 100% resilient: handles autoplay policies, mobile gesture unlocks, network failures, and localStorage persistence.

export type SoundId =
  | "game-start"
  | "guess-confirm"
  | "globe-whoosh"
  | "score-reveal"
  | "score-perfect"
  | "match-victory"
  | "ui-toggle";

const SOUND_ASSETS: Record<SoundId, string> = {
  "game-start": "/sounds/game-start.wav",
  "guess-confirm": "/sounds/guess-confirm.wav",
  "globe-whoosh": "/sounds/globe-whoosh.wav",
  "score-reveal": "/sounds/score-reveal.wav",
  "score-perfect": "/sounds/score-perfect.wav",
  "match-victory": "/sounds/match-victory.wav",
  "ui-toggle": "/sounds/ui-toggle.wav",
};

export type AudioStateSubscriber = (enabled: boolean) => void;

class CricketSoundController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private soundEnabled: boolean = true;
  private masterVolume: number = 0.85;
  private buffers: Map<SoundId, AudioBuffer> = new Map();
  private loadingPromises: Map<SoundId, Promise<AudioBuffer | null>> = new Map();
  private subscribers: Set<AudioStateSubscriber> = new Set();
  private lastTickTime: number = 0;
  private isUnlocked: boolean = false;
  private activeVictoryId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cricket_geo.sound_enabled");
        this.soundEnabled = stored === null ? true : stored === "true";
      } catch {
        this.soundEnabled = true;
      }

      // Auto-unlock on first user interaction anywhere in the window
      const unlockHandler = () => {
        this.unlockAudio();
        window.removeEventListener("pointerdown", unlockHandler);
        window.removeEventListener("keydown", unlockHandler);
        window.removeEventListener("touchstart", unlockHandler);
      };

      window.addEventListener("pointerdown", unlockHandler, { passive: true });
      window.addEventListener("keydown", unlockHandler, { passive: true });
      window.addEventListener("touchstart", unlockHandler, { passive: true });

      // Preload assets asynchronously
      this.preloadAll();
    }
  }

  /**
   * Subscribe to sound toggle state changes (for reactive UI buttons)
   */
  public subscribe(cb: AudioStateSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.soundEnabled);
    return () => this.subscribers.delete(cb);
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.soundEnabled);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public getMuted(): boolean {
    return !this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cricket_geo.sound_enabled", String(enabled));
      } catch {
        // localStorage unavailable
      }
    }

    if (this.masterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(
          enabled ? this.masterVolume : 0.0001,
          now + 0.03
        );
      } catch {
        // ignore
      }
    }

    this.notifySubscribers();
  }

  public toggle(): boolean {
    const nextState = !this.soundEnabled;
    this.setEnabled(nextState);
    if (nextState) {
      this.playUiToggle();
    }
    return nextState;
  }

  /**
   * Unlocks AudioContext inside a user gesture (tap/click/press).
   */
  public unlockAudio(): void {
    if (typeof window === "undefined") return;
    try {
      const ctx = this.getOrCreateContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      this.isUnlocked = true;
    } catch {
      // AudioContext failure
    }
  }

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(
            this.soundEnabled ? this.masterVolume : 0.0001,
            this.ctx.currentTime
          );
          this.masterGain.connect(this.ctx.destination);
        }
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Asynchronously preloads and decodes all WAV assets into AudioBuffers.
   */
  public async preloadAll(): Promise<void> {
    if (typeof window === "undefined") return;
    const soundKeys = Object.keys(SOUND_ASSETS) as SoundId[];
    await Promise.allSettled(soundKeys.map((id) => this.preloadSound(id)));
  }

  private async preloadSound(id: SoundId): Promise<AudioBuffer | null> {
    if (this.buffers.has(id)) {
      return this.buffers.get(id)!;
    }
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    const promise = (async () => {
      try {
        const url = SOUND_ASSETS[id];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        const arrayBuffer = await res.arrayBuffer();

        const ctx = this.getOrCreateContext();
        if (!ctx) return null;

        const decoded = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(id, decoded);
        return decoded;
      } catch (err) {
        // Fallback to procedural synthesis will be used if buffer fails to load
        return null;
      } finally {
        this.loadingPromises.delete(id);
      }
    })();

    this.loadingPromises.set(id, promise);
    return promise;
  }

  /**
   * Plays a preloaded AudioBuffer through the master gain node.
   * Returns true if audio buffer was played, false if fallback is needed.
   */
  private playBuffer(id: SoundId, volumeMultiplier = 1.0): boolean {
    if (!this.soundEnabled) return true; // Muted, considered handled
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return false;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const buffer = this.buffers.get(id);
    if (!buffer) {
      // Trigger lazy load for next time
      this.preloadSound(id);
      return false;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volumeMultiplier, ctx.currentTime);

      source.connect(gain);
      gain.connect(this.masterGain);

      source.start();
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {}
      };
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Game Audio Events
  // =========================================================================

  /**
   * A. Game-Start Sting (1.45s)
   * Plays when a new 5-question match starts.
   */
  public playGameStart(): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (!this.playBuffer("game-start", 1.0)) {
      // Procedural fallback: Energetic G Major arpeggio with brassy overtone warmth
      this.synthGameStart();
    }
  }

  /**
   * B. Guess Confirmation Cue (180ms)
   * Tactile cricket willow bat sweet-spot strike + electronic lock chime.
   */
  public playGuessConfirm(): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (!this.playBuffer("guess-confirm", 1.0)) {
      this.synthGuessConfirm();
    }
  }

  /**
   * Compatibility alias for playGuessConfirm
   */
  public playClick(): void {
    this.playGuessConfirm();
  }

  /**
   * C. Globe-Reveal Transition (480ms)
   * Spatial rising aerodynamic sweep aligned with camera movement.
   */
  public playGlobeWhoosh(): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (!this.playBuffer("globe-whoosh", 0.95)) {
      this.synthWhoosh();
    }
  }

  /**
   * Compatibility alias for playGlobeWhoosh
   */
  public playWhoosh(): void {
    this.playGlobeWhoosh();
  }

  /**
   * D. Score-Reveal Cue (520ms / 620ms)
   * Positive musical accent when points are revealed. Brighter variation for 95+ pts.
   */
  public playScoreReveal(score: number): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (score >= 95) {
      if (!this.playBuffer("score-perfect", 1.05)) {
        this.synthScoreReward(score);
      }
    } else {
      if (!this.playBuffer("score-reveal", 1.0)) {
        this.synthScoreReward(score);
      }
    }
  }

  /**
   * Compatibility alias for playScoreReveal
   */
  public playScoreReward(score: number): void {
    this.playScoreReveal(score);
  }

  /**
   * Score Counter Tick
   * Soft marimba tick smoothly climbing pitch during numeric count-up.
   */
  public playScoreTick(progressRatio = 0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastTickTime < 24) return;
    this.lastTickTime = nowMs;

    if (!this.soundEnabled) return;
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const ratio = Math.min(1, Math.max(0, progressRatio));
      const freq = 360 + ratio * 280;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }

  /**
   * E. Match-Complete Victory Fanfare (2.1s)
   * Triumphant sports stadium championship fanfare when Match Complete screen appears.
   * Deduped per game/session so it never plays multiple times on rerenders.
   */
  public playMatchVictory(sessionKey?: string): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (sessionKey) {
      if (this.activeVictoryId === sessionKey) return;
      this.activeVictoryId = sessionKey;
    }

    if (!this.playBuffer("match-victory", 1.0)) {
      this.synthVictoryFanfare();
    }
  }

  /**
   * Compatibility alias for playMatchVictory
   */
  public playVictoryJingle(): void {
    this.playMatchVictory();
  }

  /**
   * F. UI Button / Audio Toggle
   * Clean tactile click for button presses and volume toggles.
   */
  public playUiToggle(): void {
    this.unlockAudio();
    if (!this.soundEnabled) return;

    if (!this.playBuffer("ui-toggle", 0.8)) {
      this.synthUiClick();
    }
  }

  public playButton(): void {
    this.playUiToggle();
  }

  // =========================================================================
  // Zero-Latency Procedural Synthesizer Fallbacks
  // =========================================================================

  private synthGameStart(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const notes = [
        { time: 0.0, freq: 293.66 },
        { time: 0.12, freq: 392.0 },
        { time: 0.24, freq: 493.88 },
        { time: 0.38, freq: 587.33 },
        { time: 0.40, freq: 783.99 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.time);
        gain.gain.setValueAtTime(0.18, now + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + 0.6);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + n.time);
        osc.stop(now + n.time + 0.65);
      });
    } catch {}
  }

  private synthGuessConfirm(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.038);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {}
  }

  private synthWhoosh(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const duration = 0.55;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.8;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(2.0, now);
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(280, now + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + duration * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + duration);
    } catch {}
  }

  private synthScoreReward(score: number): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const freqs = score >= 95
        ? [523.25, 659.25, 783.99, 987.77, 1174.66]
        : score >= 70
        ? [523.25, 783.99, 1046.5]
        : [349.23, 523.25];

      freqs.forEach((f, idx) => {
        const noteTime = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, noteTime);
        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(noteTime);
        osc.stop(noteTime + 0.48);
      });
    } catch {}
  }

  private synthVictoryFanfare(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66, 1318.51];
      const durations = [0.12, 0.12, 0.14, 0.25, 0.15, 0.75];
      let elapsed = 0;
      notes.forEach((f, idx) => {
        const noteTime = now + elapsed;
        const dur = durations[idx];
        elapsed += idx === 3 ? 0.26 : 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx >= 3 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(f, noteTime);
        gain.gain.setValueAtTime(0.16, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + dur);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(noteTime);
        osc.stop(noteTime + dur + 0.03);
      });
    } catch {}
  }

  private synthUiClick(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.025);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }
}

export const soundController = new CricketSoundController();
