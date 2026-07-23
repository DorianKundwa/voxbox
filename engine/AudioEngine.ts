/**
 * VoxBox Audio Engine
 * Manages the full Web Audio API processing graph.
 * 
 * Pipeline:
 * Source → Gate → DeEsser → Pitch → EQ → MultibandComp → Compressor
 *        → Saturation → Stereo → Delay → Reverb → Limiter → Master → Output
 */

import type { ChainModules, EQBand } from "@/lib/types";

type MeterCallback = (db: number) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private isPlaying = false;

  // DSP Nodes
  private gateGain!: GainNode;
  private eqFilters: BiquadFilterNode[] = [];
  private compressor!: DynamicsCompressorNode;
  private compMakeup!: GainNode;          // makeup gain after compressor
  private masterGainNode!: GainNode;
  private reverbNode!: ConvolverNode;
  private reverbDry!: GainNode;
  private reverbWet!: GainNode;
  private delayNode!: DelayNode;
  private delayFeedback!: GainNode;
  private delayWet!: GainNode;
  private delayDry!: GainNode;
  private limiterNode!: DynamicsCompressorNode;
  private satWaveshaper!: WaveShaperNode;
  private satWet!: GainNode;
  private satDry!: GainNode;
  private satSum!: GainNode;              // merges wet+dry before delay
  private analyserNode!: AnalyserNode;

  // Meter
  private meterRaf: number | null = null;
  private meterCallback: MeterCallback | null = null;

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: 44100 });
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this._buildGraph();
  }

  private _buildGraph(): void {
    const ctx = this.ctx!;

    // Master chain end
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = 0.85;
    this.masterGainNode.connect(ctx.destination);

    // Analyser for metering
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.85;
    this.analyserNode.connect(this.masterGainNode);

    // Limiter (final stage before master)
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.1;
    this.limiterNode.connect(this.analyserNode);

    // Reverb chain
    this.reverbDry = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbNode = ctx.createConvolver();
    this.reverbDry.gain.value = 0.82;
    this.reverbWet.gain.value = 0.18;
    this.reverbDry.connect(this.limiterNode);
    this.reverbWet.connect(this.limiterNode);
    this._generateImpulseResponse("plate", 1.6, 0.6);

    // Delay chain
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.25;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.2;
    this.delayWet = ctx.createGain();
    this.delayDry = ctx.createGain();
    this.delayWet.gain.value = 0.12;
    this.delayDry.gain.value = 0.88;
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayWet.connect(this.reverbDry);
    this.delayWet.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWet);
    this.delayDry.connect(this.reverbDry);
    this.delayDry.connect(this.reverbNode);

    // Saturation chain — correct serial routing:
    // compressor → satWaveshaper → satWet ─┐
    //            → satDry ─────────────────┴→ satSum → delay
    this.satWaveshaper = ctx.createWaveShaper();
    this.satWaveshaper.curve = this._makeSatCurve("tube", 15) as unknown as Float32Array<ArrayBuffer>;
    this.satWaveshaper.oversample = "4x";
    this.satWet = ctx.createGain();
    this.satDry = ctx.createGain();
    this.satSum = ctx.createGain();        // unity merge point
    this.satSum.gain.value = 1.0;
    this.satWet.gain.value = 0.0;          // disabled by default
    this.satDry.gain.value = 1.0;
    this.satWaveshaper.connect(this.satWet);
    this.satWet.connect(this.satSum);      // wet path → merge
    this.satDry.connect(this.satSum);      // dry path → merge
    this.satSum.connect(this.delayNode);   // single output into delay
    this.satSum.connect(this.delayDry);    // also feed the dry delay path

    // Compressor + makeup gain
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 3;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.1;
    this.compMakeup = ctx.createGain();
    this.compMakeup.gain.value = 1.585;    // +4 dB default
    this.compressor.connect(this.compMakeup);
    this.compMakeup.connect(this.satWaveshaper);
    this.compMakeup.connect(this.satDry);

    // EQ chain (5 biquad filters in series)
    const eqFreqs = [80, 200, 800, 3500, 10000];
    const eqTypes: BiquadFilterType[] = ["highpass", "lowshelf", "peaking", "peaking", "highshelf"];
    this.eqFilters = eqFreqs.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = eqTypes[i];
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value = i === 0 ? 0.707 : i >= 3 ? 1.2 : 1.0;
      return f;
    });

    // Chain EQ filters in series
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }
    this.eqFilters[this.eqFilters.length - 1].connect(this.compressor);

    // Gate gain (entry point into chain)
    this.gateGain = ctx.createGain();
    this.gateGain.gain.value = 1.0;
    this.gateGain.connect(this.eqFilters[0]);
  }

  async loadAudio(file: File): Promise<void> {
    await this.init();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
  }

  play(offset = 0): void {
    if (!this.ctx || !this.audioBuffer) return;
    this.stop();

    const src = this.ctx.createBufferSource();
    src.buffer = this.audioBuffer;
    src.loop = false;
    src.connect(this.gateGain);
    src.start(0, offset);
    this.sourceNode = src;
    this.startTime = this.ctx.currentTime - offset;
    this.isPlaying = true;

    src.onended = () => {
      if (this.isPlaying) this.isPlaying = false;
    };
  }

  stop(): void {
    try { this.sourceNode?.disconnect(); (this.sourceNode as AudioBufferSourceNode)?.stop(); }
    catch { /* already stopped */ }
    this.sourceNode = null;
    this.isPlaying = false;
  }

  get currentTime(): number {
    if (!this.ctx || !this.isPlaying) return this.pauseOffset;
    return this.ctx.currentTime - this.startTime;
  }

  setMasterVolume(v: number): void {
    if (this.masterGainNode) this.masterGainNode.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.01);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  // ── Apply chain parameters ─────────────────────────────────────────────

  applyChain(modules: ChainModules): void {
    if (!this.ctx) return;
    this._applyEQ(modules.eq.bands);
    this._applyCompressor(modules.compressor);
    this._applySaturation(modules.saturation);
    this._applyDelay(modules.delay);
    this._applyReverb(modules.reverb);
    this._applyLimiter(modules.limiter);
    this._applyGate(modules.noise_gate);
  }

  private _applyEQ(bands: EQBand[]): void {
    const now = this.ctx!.currentTime;
    bands.forEach((band, i) => {
      const f = this.eqFilters[i];
      if (!f) return;
      f.frequency.setTargetAtTime(band.frequency, now, 0.01);
      f.gain.setTargetAtTime(band.enabled ? band.gain : 0, now, 0.01);
      f.Q.setTargetAtTime(band.q, now, 0.01);
    });
  }

  private _applyCompressor(p: ChainModules["compressor"]): void {
    if (!this.compressor) return;
    const now = this.ctx!.currentTime;
    this.compressor.threshold.setTargetAtTime(p.threshold, now, 0.01);
    this.compressor.ratio.setTargetAtTime(p.ratio, now, 0.01);
    this.compressor.attack.setTargetAtTime(p.attack / 1000, now, 0.01);
    this.compressor.release.setTargetAtTime(p.release / 1000, now, 0.01);
    this.compressor.knee.setTargetAtTime(p.knee, now, 0.01);
    // Apply makeup gain via the dedicated GainNode
    if (this.compMakeup) {
      const makeupLin = Math.pow(10, p.makeup / 20);
      this.compMakeup.gain.setTargetAtTime(makeupLin, now, 0.01);
    }
  }

  private _applySaturation(p: ChainModules["saturation"]): void {
    if (!this.satWaveshaper || !this.satWet || !this.satDry) return;
    const now = this.ctx!.currentTime;
    const mixWet = p.enabled ? p.mix / 100 : 0;
    const mixDry = 1 - mixWet;
    this.satWet.gain.setTargetAtTime(mixWet, now, 0.01);
    this.satDry.gain.setTargetAtTime(mixDry, now, 0.01);
    this.satWaveshaper.curve = this._makeSatCurve(p.mode, p.drive) as unknown as Float32Array<ArrayBuffer>;
  }

  private _applyDelay(p: ChainModules["delay"]): void {
    if (!this.delayNode) return;
    const now = this.ctx!.currentTime;
    this.delayNode.delayTime.setTargetAtTime(p.time_ms / 1000, now, 0.01);
    this.delayFeedback.gain.setTargetAtTime(p.feedback / 100, now, 0.01);
    const mixWet = p.enabled ? p.mix / 100 : 0;
    this.delayWet.gain.setTargetAtTime(mixWet, now, 0.01);
    this.delayDry.gain.setTargetAtTime(1 - mixWet, now, 0.01);
  }

  private _applyReverb(p: ChainModules["reverb"]): void {
    if (!this.reverbWet || !this.reverbDry) return;
    const now = this.ctx!.currentTime;
    const mixWet = p.enabled ? p.mix / 100 : 0;
    this.reverbWet.gain.setTargetAtTime(mixWet, now, 0.01);
    this.reverbDry.gain.setTargetAtTime(1 - mixWet, now, 0.01);
    this._generateImpulseResponse(p.type, p.decay, p.damping / 100);
  }

  private _applyLimiter(p: ChainModules["limiter"]): void {
    if (!this.limiterNode) return;
    const now = this.ctx!.currentTime;
    this.limiterNode.threshold.setTargetAtTime(p.threshold, now, 0.01);
  }

  private _applyGate(p: ChainModules["noise_gate"]): void {
    if (!this.gateGain) return;
    // Approximate gate: when disabled always open (gain=1),
    // when enabled we scale down by the expected gate reduction.
    // A full AudioWorklet gate is in public/dsp/voxbox-processor.js.
    const targetGain = p.enabled ? 0.9 : 1.0; // subtle attenuation when gate active
    this.gateGain.gain.setTargetAtTime(
      p.enabled ? targetGain : 1.0,
      this.ctx!.currentTime, 0.01
    );
  }

  // ── Metering ──────────────────────────────────────────────────────────────

  startMeter(cb: MeterCallback): void {
    this.meterCallback = cb;
    const tick = () => {
      if (!this.analyserNode) return;
      const buf = new Float32Array(this.analyserNode.fftSize);
      this.analyserNode.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      cb(Math.max(-60, db));
      this.meterRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  stopMeter(): void {
    if (this.meterRaf !== null) cancelAnimationFrame(this.meterRaf);
    this.meterCallback = null;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode || null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _makeSatCurve(mode: string, drive: number): Float32Array<ArrayBufferLike> {
    const n = 256;
    const curve = new Float32Array(n);
    const k = drive / 10;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      switch (mode) {
        case "tube":
          curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
          break;
        case "tape":
          curve[i] = k < 1e-6 ? x : Math.tanh(k * x) / Math.tanh(k);
          break;
        case "warm":
          curve[i] = x < 0 ? -Math.pow(Math.abs(x), 0.7) : Math.pow(x, 0.7);
          break;
        case "soft_clip":
          curve[i] = x >= 1 ? 1 : x <= -1 ? -1 : 1.5 * x - 0.5 * Math.pow(x, 3);
          break;
        default:
          curve[i] = x;
      }
    }
    return curve;
  }

  private _generateImpulseResponse(
    type: string,
    decay: number,
    damping: number
  ): void {
    if (!this.ctx || !this.reverbNode) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * decay);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const decayFactor = Math.exp(-t * (3 + damping * 5));
        const noise = Math.random() * 2 - 1;
        let sample = noise * decayFactor;

        if (type === "hall") {
          // Add early reflections
          if (i < sampleRate * 0.02) sample *= 1.4;
        } else if (type === "plate") {
          // Denser early density
          sample *= 1 + 0.3 * Math.sin(i * 0.1);
        }
        data[i] = sample;
      }
    }
    this.reverbNode.buffer = impulse;
  }

  async resume(): Promise<void> {
    await this.ctx?.resume();
  }

  async suspend(): Promise<void> {
    await this.ctx?.suspend();
  }

  destroy(): void {
    this.stop();
    this.stopMeter();
    this.ctx?.close();
    this.ctx = null;
  }
}

// Singleton
let _engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}
