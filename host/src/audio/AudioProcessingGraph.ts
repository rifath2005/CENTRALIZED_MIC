import { LimiterSettings } from '../types';

export const HARD_VOLUME_CEILING = 0.90; // Software-enforced maximum gain to prevent acoustic runaway

export const DEFAULT_LIMITER_SETTINGS: LimiterSettings = {
  threshold: -18, // dB: kicks in before PA reaches non-linear speaker distortion
  knee: 12,       // dB: soft knee for transparent vocal leveling
  ratio: 10,      // 10:1 ratio acts as a robust peak limiter
  attack: 0.003,  // 3ms ultra-fast attack catches vocal transients and initial feedback chirps
  release: 0.100, // 100ms release restores natural speech envelope without pumping
};

export class AudioProcessingGraph {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private currentStream: MediaStream | null = null;
  private isUnlocked: boolean = false;

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
    this.sourceNode = this.ctx.createMediaStreamSource(this.currentStream);
    this.sourceNode.connect(this.highpassFilter);

    console.log('[AudioGraph] Audio track attached to Web Audio limiter graph');
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
    if (!this.ctx || !this.masterGainNode) return;
    const clamped = Math.min(Math.max(0, targetVolume), HARD_VOLUME_CEILING);
    this.masterGainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
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
    this.detachTrack();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.isUnlocked = false;
  }
}
