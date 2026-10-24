import { LimiterSettings } from '../types';
import { RemoteAudioTrack } from 'livekit-client';

export const HARD_VOLUME_CEILING = 0.90; // Software-enforced maximum gain to prevent acoustic runaway

export const DEFAULT_LIMITER_SETTINGS: LimiterSettings = {
  threshold: -18, // dB: kicks in before PA reaches non-linear speaker distortion
  knee: 12,       // dB: soft knee for transparent vocal leveling
  ratio: 10,      // 10:1 ratio acts as a robust peak limiter
  attack: 0.003,  // 3ms ultra-fast attack catches vocal transients and initial feedback chirps
  release: 0.100, // 100ms release restores natural speech envelope without pumping
};

export type AcousticSafetyEvent =
  | {
      type: 'transient_clamped';
      peakLevel: number;
      durationMs: number;
      gainReductionDb: number;
      message: string;
      timestamp: number;
    }
  | {
      type: 'feedback_auto_mute';
      peakLevel: number;
      durationMs: number;
      gainReductionDb: number;
      message: string;
      timestamp: number;
    }
  | {
      type: 'noise_floor_warning';
      level: number;
      message: string;
      timestamp: number;
    }
  | {
      type: 'restored';
      message: string;
      timestamp: number;
    };

export type AutoMuteReason = 'none' | 'manual_panic' | 'feedback_auto_mute';

export class AudioProcessingGraph {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private currentStream: MediaStream | null = null;
  private isUnlocked: boolean = false;
  private isEmergencyMuted: boolean = false;
  private preMuteVolume: number = 0.75;

  // Acoustic Sentry & Feedback Circuit Breaker
  private safetyCallback: ((event: AcousticSafetyEvent) => void) | null = null;
  private autoMuteReason: AutoMuteReason = 'none';
  private sentryIntervalId: number | null = null;
  private sentryEnabled: boolean = true;
  private overloadStartTime: number | null = null;
  private overloadMaxLevel: number = 0;
  private overloadMaxGr: number = 0;
  private elevatedNoiseStartTime: number | null = null;
  private lastNoiseWarningTime: number = 0;
  private lastTransientNotificationTime: number = 0;
  private transientClampedCount: number = 0;
  private feedbackAutoMuteCount: number = 0;

  constructor() {
    // AudioContext will be initialized upon user gesture (unlock gate)
  }

  /**
   * Initializes or resumes the AudioContext in response to an explicit user gesture,
   * satisfying browser Autoplay Policies.
   */
  public async unlockAudio(): Promise<boolean> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({
        latencyHint: 'interactive', // Requests the lowest possible hardware output buffer
        sampleRate: 48000,
      });

      this.buildGraph();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isUnlocked = this.ctx.state === 'running';
    if (this.isUnlocked) {
      this.startSafetySentry();
    }
    console.log(`[AudioGraph] AudioContext state: ${this.ctx.state}, sampleRate: ${this.ctx.sampleRate}Hz`);
    return this.isUnlocked;
  }

  /**
   * Builds the Web Audio processing graph:
   * Source -> Highpass (80Hz rumble cut) -> DynamicsCompressor (Peak Limiter) -> Master Gain -> Analyser -> Output
   */
  private buildGraph() {
    if (!this.ctx) return;

    // 1. High-pass filter (80Hz) to eliminate table thumps and sub-bass resonance
    this.highpassFilter = this.ctx.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.setValueAtTime(80, this.ctx.currentTime);
    this.highpassFilter.Q.setValueAtTime(0.707, this.ctx.currentTime); // Butterworth Q

    // 2. DynamicsCompressorNode configured as a fast peak limiter
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.applyLimiterSettings(DEFAULT_LIMITER_SETTINGS);

    // 3. Master Gain Node with software ceiling clamp
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(0.75, this.ctx.currentTime);

    // 4. AnalyserNode for real-time visual RMS & peak metering
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.5;

    // Connect static stages: Filter -> Compressor -> Gain -> Analyser -> Destination
    this.highpassFilter.connect(this.compressorNode);
    this.compressorNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);
  }

  /**
   * Dedicated hidden audio sink element ensuring Chromium actively decodes WebRTC Opus streams
   */
  private getAudioElement(): HTMLAudioElement {
    if (!this.audioElement) {
      let el = document.getElementById('centralized-mic-audio-sink') as HTMLAudioElement;
      if (!el) {
        el = document.createElement('audio');
        el.id = 'centralized-mic-audio-sink';
        el.autoplay = true;
        // @ts-ignore
        el.playsInline = true;
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      this.audioElement = el;
    }
    return this.audioElement;
  }

  /**
   * Attaches an incoming LiveKit RemoteAudioTrack:
   * 1. Attaches to HTML5 audio element so browser WebRTC engine decodes and renders stream.
   * 2. Routes audio element into Web Audio DSP graph (Limiter, 80Hz rumble cut, Peak VU meter).
   */
  public attachRemoteTrack(track: RemoteAudioTrack) {
    const audioEl = this.getAudioElement();

    try {
      track.attach(audioEl);
      audioEl.volume = this.preMuteVolume;
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[AudioGraph] HTML5 audio play:', err);
        });
      }
      console.log('[AudioGraph] LiveKit track attached to HTMLAudioElement and playing');
    } catch (err) {
      console.warn('[AudioGraph] Error attaching LiveKit track to audio element:', err);
    }

    if (this.ctx && this.highpassFilter) {
      if (!this.mediaElementSource) {
        try {
          this.mediaElementSource = this.ctx.createMediaElementSource(audioEl);
          this.mediaElementSource.connect(this.highpassFilter);
          console.log('[AudioGraph] AudioElement routed directly through Web Audio Limiter graph');
        } catch (err) {
          console.warn('[AudioGraph] createMediaElementSource note:', err);
        }
      }

      if (track.mediaStreamTrack) {
        this.attachTrack(track.mediaStreamTrack);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  /**
   * Detaches incoming LiveKit RemoteAudioTrack
   */
  public detachRemoteTrack(track?: RemoteAudioTrack) {
    const audioEl = this.getAudioElement();
    try {
      if (track) {
        track.detach(audioEl);
      } else {
        audioEl.srcObject = null;
      }
    } catch (err) {
      console.warn('[AudioGraph] Error detaching track:', err);
    }
    this.detachTrack();
  }

  /**
   * Attaches an incoming WebRTC MediaStreamTrack to the Web Audio processing chain.
   */
  public attachTrack(track: MediaStreamTrack) {
    if (!this.ctx || !this.highpassFilter) {
      console.warn('[AudioGraph] Cannot attach track: AudioContext not initialized.');
      return;
    }

    this.detachTrack();

    this.currentTrack = track;
    this.currentStream = new MediaStream([track]);
    try {
      this.sourceNode = this.ctx.createMediaStreamSource(this.currentStream);
      this.sourceNode.connect(this.highpassFilter);
      console.log('[AudioGraph] Audio track attached to Web Audio limiter graph');
    } catch (err) {
      console.warn('[AudioGraph] Error creating MediaStreamSource:', err);
    }
  }

  /**
   * Detaches the current track and releases source node resources.
   */
  public detachTrack() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.currentTrack = null;
    this.currentStream = null;
  }

  public getCurrentTrack(): MediaStreamTrack | null {
    return this.currentTrack;
  }

  /**
   * Updates limiter parameters dynamically
   */
  public applyLimiterSettings(settings: LimiterSettings) {
    if (!this.ctx || !this.compressorNode) return;
    const now = this.ctx.currentTime;
    this.compressorNode.threshold.setValueAtTime(settings.threshold, now);
    this.compressorNode.knee.setValueAtTime(settings.knee, now);
    this.compressorNode.ratio.setValueAtTime(settings.ratio, now);
    this.compressorNode.attack.setValueAtTime(settings.attack, now);
    this.compressorNode.release.setValueAtTime(settings.release, now);
  }

  /**
   * Sets master output volume with strict software clamp ceiling (<= HARD_VOLUME_CEILING)
   */
  public setMasterVolume(targetVolume: number) {
    const clamped = Math.min(Math.max(0, targetVolume), HARD_VOLUME_CEILING);
    this.preMuteVolume = clamped;
    if (this.audioElement) {
      this.audioElement.volume = clamped;
    }
    if (!this.ctx || !this.masterGainNode) return;
    if (!this.isEmergencyMuted) {
      this.masterGainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  /**
   * Toggles emergency master mute for instant PA feedback kill (Operator Manual Cut)
   */
  public toggleEmergencyMute(): boolean {
    this.isEmergencyMuted = !this.isEmergencyMuted;
    this.autoMuteReason = this.isEmergencyMuted ? 'manual_panic' : 'none';
    if (this.audioElement) {
      this.audioElement.muted = this.isEmergencyMuted;
    }
    if (!this.ctx || !this.masterGainNode) return this.isEmergencyMuted;

    const now = this.ctx.currentTime;
    if (this.isEmergencyMuted) {
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(0, now);
    } else {
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(this.preMuteVolume, now);
      this.safetyCallback?.({
        type: 'restored',
        message: 'Master broadcast bus manually unmuted.',
        timestamp: Date.now(),
      });
    }
    return this.isEmergencyMuted;
  }

  /**
   * Triggered automatically by Acoustic Sentry circuit breaker when continuous overload is detected
   */
  public autoEmergencyMute(
    reason: AutoMuteReason = 'feedback_auto_mute',
    peakLevel: number = 0.95,
    durationMs: number = 600,
    gainReductionDb: number = 14
  ): void {
    if (this.isEmergencyMuted) return;
    this.isEmergencyMuted = true;
    this.autoMuteReason = reason;

    if (this.audioElement) {
      this.audioElement.muted = true;
    }
    if (this.ctx && this.masterGainNode) {
      const now = this.ctx.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(0, now);
    }

    console.warn(`[AudioGraph] ACOUSTIC FEEDBACK PREVENTED: Output auto-muted (peak: ${(peakLevel * 100).toFixed(0)}%, duration: ${durationMs}ms)`);
    this.safetyCallback?.({
      type: 'feedback_auto_mute',
      peakLevel,
      durationMs,
      gainReductionDb,
      message: `Acoustic feedback loop detected: Continuous overload sustained for ${durationMs}ms. Output automatically muted.`,
      timestamp: Date.now(),
    });
  }

  /**
   * Restores master PA audio bus and clears auto-mute condition
   */
  public restoreBroadcast(): boolean {
    if (!this.isEmergencyMuted) return false;
    this.isEmergencyMuted = false;
    const prevReason = this.autoMuteReason;
    this.autoMuteReason = 'none';
    this.overloadStartTime = null;

    if (this.audioElement) {
      this.audioElement.muted = false;
      this.audioElement.volume = this.preMuteVolume;
    }
    if (this.ctx && this.masterGainNode) {
      const now = this.ctx.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(this.preMuteVolume, now);
    }

    console.log(`[AudioGraph] Broadcast restored from ${prevReason}`);
    this.safetyCallback?.({
      type: 'restored',
      message: 'Master broadcast bus restored. Gain unmuted.',
      timestamp: Date.now(),
    });
    return true;
  }

  public getIsEmergencyMuted(): boolean {
    return this.isEmergencyMuted;
  }

  public getAutoMuteReason(): AutoMuteReason {
    return this.autoMuteReason;
  }

  public onSafetyEvent(callback: (event: AcousticSafetyEvent) => void): () => void {
    this.safetyCallback = callback;
    return () => {
      if (this.safetyCallback === callback) {
        this.safetyCallback = null;
      }
    };
  }

  public setSafetySentryEnabled(enabled: boolean) {
    this.sentryEnabled = enabled;
  }

  public getSafetyStats() {
    return {
      transientClampedCount: this.transientClampedCount,
      feedbackAutoMuteCount: this.feedbackAutoMuteCount,
      sentryActive: this.sentryEnabled && this.isUnlocked,
      autoMuteReason: this.autoMuteReason,
    };
  }

  /**
   * Starts high-precision acoustic sentry monitoring loop (approx 45ms tick)
   */
  public startSafetySentry() {
    if (this.sentryIntervalId !== null) return;
    this.sentryIntervalId = window.setInterval(() => {
      this.runSentryTick();
    }, 45);
  }

  public stopSafetySentry() {
    if (this.sentryIntervalId !== null) {
      clearInterval(this.sentryIntervalId);
      this.sentryIntervalId = null;
    }
    this.overloadStartTime = null;
    this.elevatedNoiseStartTime = null;
  }

  /**
   * Internal Sentry Tick: Analyzes audio envelope with temporal constraints
   *
   * Scenario 1 (Transient Burst, e.g. Sneeze, Cough, Mic Bump):
   * - Sudden spike (>0.82 level or >12dB reduction) that subsides in < 450ms.
   * - Peak limiter's fast 3ms attack clamps amplitude without cutting sound.
   * - DOES NOT MUTE. Fires 'transient_clamped' notification to inform operator.
   *
   * Scenario 2 (Sustained Acoustic Feedback Loop / Howl / Loopback):
   * - Continuous overload persisting >= 600ms.
   * - Triggers autoEmergencyMute immediately.
   * - Fires 'feedback_auto_mute' to display prominent banner with 1-click restore.
   */
  private runSentryTick() {
    if (!this.sentryEnabled || !this.ctx || this.ctx.state !== 'running' || this.isEmergencyMuted) {
      this.overloadStartTime = null;
      this.elevatedNoiseStartTime = null;
      return;
    }

    const metrics = this.getAudioMetrics();
    const now = performance.now();

    // Overload condition: Level >= 0.82 or Compressor Gain Reduction >= 12 dB
    const isOverloaded = metrics.level >= 0.82 || metrics.gainReduction >= 12.0;

    if (isOverloaded) {
      if (this.overloadStartTime === null) {
        // High spike has just begun
        this.overloadStartTime = now;
        this.overloadMaxLevel = metrics.level;
        this.overloadMaxGr = metrics.gainReduction;
      } else {
        this.overloadMaxLevel = Math.max(this.overloadMaxLevel, metrics.level);
        this.overloadMaxGr = Math.max(this.overloadMaxGr, metrics.gainReduction);
        const durationMs = Math.round(now - this.overloadStartTime);

        // TIME CONSTRAINT: Only sustained overload (>= 600ms) triggers auto-mute!
        if (durationMs >= 600) {
          const peak = this.overloadMaxLevel;
          const gr = this.overloadMaxGr;
          this.overloadStartTime = null;
          this.feedbackAutoMuteCount++;
          this.autoEmergencyMute('feedback_auto_mute', peak, durationMs, gr);
          return;
        }
      }
    } else {
      // Overload has cleared back below threshold
      if (this.overloadStartTime !== null) {
        const durationMs = Math.round(now - this.overloadStartTime);
        const peak = this.overloadMaxLevel;
        const gr = this.overloadMaxGr;
        this.overloadStartTime = null;

        // Transient spike (sneeze, cough, desk bump, plosive):
        // Handled cleanly by limiter, broadcast is NOT muted!
        if (durationMs >= 60 && durationMs < 550) {
          this.transientClampedCount++;
          if (now - this.lastTransientNotificationTime > 1500) {
            this.lastTransientNotificationTime = now;
            this.safetyCallback?.({
              type: 'transient_clamped',
              peakLevel: peak,
              durationMs,
              gainReductionDb: gr,
              message: `Transient burst (${durationMs}ms, peak ${Math.round(peak * 100)}%) safely clamped by peak limiter. Audio kept live.`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // High continuous noise floor monitoring
    if (metrics.level >= 0.58 && metrics.level < 0.82) {
      if (this.elevatedNoiseStartTime === null) {
        this.elevatedNoiseStartTime = now;
      } else if (now - this.elevatedNoiseStartTime >= 3500) {
        if (now - this.lastNoiseWarningTime > 15000) {
          this.lastNoiseWarningTime = now;
          this.safetyCallback?.({
            type: 'noise_floor_warning',
            level: metrics.level,
            message: 'Elevated continuous noise floor detected. Recommend enabling Deep Noise Suppression on transmitter.',
            timestamp: Date.now(),
          });
        }
      }
    } else {
      this.elevatedNoiseStartTime = null;
    }
  }

  /**
   * Plays a pleasant dual-tone chime (C5 -> E5) to test room speakers without speech
   */
  public playTestTone(): void {
    if (!this.ctx || !this.masterGainNode) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGainNode);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (err) {
      console.warn('[AudioGraph] Error playing test tone:', err);
    }
  }

  /**
   * Routes audio output to specific soundcard / interface (e.g. Dante, USB interface)
   */
  public async setOutputDevice(deviceId: string): Promise<boolean> {
    if (this.ctx && 'setSinkId' in this.ctx) {
      try {
        await (this.ctx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
        console.log(`[AudioGraph] AudioContext sink set to deviceId: ${deviceId}`);
        return true;
      } catch (err) {
        console.warn('[AudioGraph] setSinkId failed on AudioContext, falling back:', err);
      }
    }
    return false;
  }

  /**
   * Samples current audio level (0.0 to 1.0) and gain reduction (dB) for UI metering
   */
  public getAudioMetrics(): { level: number; gainReduction: number } {
    if (!this.analyserNode || !this.compressorNode) {
      return { level: 0, gainReduction: 0 };
    }

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Dynamic gain reduction applied by the compressor (dB)
    const gr = Math.abs(this.compressorNode.reduction);

    return {
      level: Math.min(rms * 3.5, 1.0), // Scale RMS for visual punch
      gainReduction: gr,
    };
  }

  public get running(): boolean {
    return this.isUnlocked && this.ctx?.state === 'running';
  }

  public close() {
    this.stopSafetySentry();
    this.detachTrack();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.isUnlocked = false;
  }
}
