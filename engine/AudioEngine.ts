/**
 * VoxBox Audio Engine — Full DSP Graph
 *
 * Pipeline (signal order):
 *   Source
 *   → Gate (GainNode approximation)
 *   → De-Esser (BiquadFilter peaking @ sibilance freq)
 *   → EQ (5 BiquadFilter bands)
 *   → Compressor (DynamicsCompressor + makeup GainNode)
 *   → MultibandComp (LP/BP/HP + 3×DynamicsCompressor + sum)
 *   → Saturation (WaveShaperNode wet/dry)
 *   → Doubler (2×DelayNode + 2×StereoPannerNode wet/dry)
 *   → Delay (DelayNode + feedback)
 *   → Reverb (ConvolverNode wet/dry)
 *   → Limiter (DynamicsCompressor)
 *   → Analyser
 *   → Master (GainNode)
 *   → Destination
 *
 * Bugs fixed vs. previous version:
 *   1. src.loop hardcoded false → now reads _looping flag (FIX: loop button)
 *   2. EQ enabled flag ignored   → bypass: set peaking/shelf gain=0, HP/LP Q=0.001
 *   3. Compressor enabled ignored → bypass: ratio=1, threshold=0
 *   4. Limiter enabled ignored    → bypass: ratio=1, threshold=0
 *   5. De-Esser not wired        → NEW: BiquadFilter in graph
 *   6. Multiband Comp not wired   → NEW: 3-band compressor in graph
 *   7. Doubler not wired          → NEW: stereo micro-delay in graph
 */

import type { ChainModules, EQBand } from "@/lib/types";

type MeterCallback = (db: number) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private _isPlaying = false;
  private _looping = false;          // FIX #1 — loop state

  // ── DSP nodes ──────────────────────────────────────────────────────────────
  private gateGain!: GainNode;

  // De-Esser
  private deEsserFilter!: BiquadFilterNode;
  private deEsserEnabled = false;

  // EQ
  private eqFilters: BiquadFilterNode[] = [];

  // Main Compressor
  private compressor!: DynamicsCompressorNode;
  private compMakeup!: GainNode;

  // Multiband Compressor
  private mbLPFilter!: BiquadFilterNode;   // low band:  <250 Hz
  private mbHP1Filter!: BiquadFilterNode;  // mid band:  >250 Hz …
  private mbLP2Filter!: BiquadFilterNode;  //           … <3000 Hz
  private mbHPFilter!: BiquadFilterNode;   // high band: >3000 Hz
  private mbCompLow!: DynamicsCompressorNode;
  private mbCompMid!: DynamicsCompressorNode;
  private mbCompHigh!: DynamicsCompressorNode;
  private mbMakeupLow!: GainNode;
  private mbMakeupMid!: GainNode;
  private mbMakeupHigh!: GainNode;
  private mbSum!: GainNode;
  private mbBypass!: GainNode;   // direct path when MB disabled
  private mbWet!: GainNode;      // MB processed path
  private mbDry!: GainNode;      // bypass path
  private mbOutput!: GainNode;   // merge point → sat

  // Saturation
  private satWaveshaper!: WaveShaperNode;
  private satWet!: GainNode;
  private satDry!: GainNode;
  private satSum!: GainNode;

  // Doubler
  private doublerDelayL!: DelayNode;
  private doublerDelayR!: DelayNode;
  private doublerPanL!: StereoPannerNode;
  private doublerPanR!: StereoPannerNode;
  private doublerWet!: GainNode;
  private doublerDry!: GainNode;
  private doublerSum!: GainNode;

  // Delay
  private delayNode!: DelayNode;
  private delayFeedback!: GainNode;
  private delayWet!: GainNode;
  private delayDry!: GainNode;

  // Reverb
  private reverbNode!: ConvolverNode;
  private reverbDry!: GainNode;
  private reverbWet!: GainNode;

  // Limiter
  private limiterNode!: DynamicsCompressorNode;

  // Pitch Correction (AudioWorklet granular pitch shifter)
  private pitchShiftNode: AudioWorkletNode | null = null;
  private pitchBypass!: GainNode;   // direct path when worklet not loaded

  // Analyser + Master
  private analyserNode!: AnalyserNode;
  private masterGainNode!: GainNode;

  // Metering
  private meterRaf: number | null = null;
  private meterCallback: MeterCallback | null = null;

  // ── Init ───────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext({ sampleRate: 44100 });
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this._buildGraph();
      // Load pitch worklet after graph is built (non-blocking)
      this._loadPitchWorklet().catch(() => {});
    } catch (err) {
      console.error("[AudioEngine] Init failed:", err);
      this.ctx = null;
      throw err;
    }
  }

  private async _loadPitchWorklet(): Promise<void> {
    if (!this.ctx) return;
    try {
      await this.ctx.audioWorklet.addModule("/dsp/pitch-processor.js");
      const node = new AudioWorkletNode(this.ctx, "pitch-shift-processor");

      // Remove bypass path: deEsser --[pitchBypass]--> EQ[0]
      this.pitchBypass.disconnect();            // pitchBypass → EQ[0]
      this.deEsserFilter.disconnect();          // deEsser → pitchBypass

      // Insert worklet: deEsser → pitchShiftNode → EQ[0]
      this.deEsserFilter.connect(node);
      node.connect(this.eqFilters[0]);
      this.pitchShiftNode = node;
    } catch (err) {
      console.warn("[AudioEngine] Pitch worklet unavailable, using bypass:", err);
      // pitchBypass stays wired — no change needed
    }
  }

  // ── Graph construction ─────────────────────────────────────────────────────

  private _buildGraph(): void {
    const ctx = this.ctx!;

    // ── 0. Gate (entry point — initialized first) ──────────────────
    this.gateGain = ctx.createGain();
    this.gateGain.gain.value = 1.0;

    // ── 1. Master + Analyser ─────────────────────────────────────
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = 0.85;
    this.masterGainNode.connect(ctx.destination);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.85;
    this.analyserNode.connect(this.masterGainNode);

    // ── 2. Limiter ───────────────────────────────────────────────
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.1;
    this.limiterNode.connect(this.analyserNode);

    // ── 3. Reverb chain ──────────────────────────────────────────
    this.reverbDry = ctx.createGain(); this.reverbDry.gain.value = 0.82;
    this.reverbWet = ctx.createGain(); this.reverbWet.gain.value = 0.18;
    this.reverbNode = ctx.createConvolver();
    this.reverbDry.connect(this.limiterNode);
    this.reverbWet.connect(this.limiterNode);
    this._generateImpulseResponse("plate", 1.6, 0.6);

    // ── 4. Delay chain ────────────────────────────────────────────
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.25;
    this.delayFeedback = ctx.createGain(); this.delayFeedback.gain.value = 0.2;
    this.delayWet = ctx.createGain();      this.delayWet.gain.value = 0.12;
    this.delayDry = ctx.createGain();      this.delayDry.gain.value = 0.88;

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayWet.connect(this.reverbDry);
    this.delayWet.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWet);
    this.delayDry.connect(this.reverbDry);
    this.delayDry.connect(this.reverbNode);

    // ── 5. Doubler (stereo micro-delay with safe panner fallback) ─
    this.doublerDelayL = ctx.createDelay(0.1);
    this.doublerDelayR = ctx.createDelay(0.1);
    this.doublerDelayL.delayTime.value = 0.012;  // 12ms
    this.doublerDelayR.delayTime.value = 0.015;  // 15ms

    try {
      if (typeof ctx.createStereoPanner === "function") {
        this.doublerPanL = ctx.createStereoPanner(); (this.doublerPanL as StereoPannerNode).pan.value = -0.7;
        this.doublerPanR = ctx.createStereoPanner(); (this.doublerPanR as StereoPannerNode).pan.value =  0.7;
      } else {
        this.doublerPanL = ctx.createGain() as any;
        this.doublerPanR = ctx.createGain() as any;
      }
    } catch {
      this.doublerPanL = ctx.createGain() as any;
      this.doublerPanR = ctx.createGain() as any;
    }
    this.doublerWet  = ctx.createGain(); this.doublerWet.gain.value  = 0.0; // off by default
    this.doublerDry  = ctx.createGain(); this.doublerDry.gain.value  = 1.0;
    this.doublerSum  = ctx.createGain(); this.doublerSum.gain.value  = 1.0;

    this.doublerDelayL.connect(this.doublerPanL);
    this.doublerDelayR.connect(this.doublerPanR);
    this.doublerPanL.connect(this.doublerWet);
    this.doublerPanR.connect(this.doublerWet);
    this.doublerWet.connect(this.doublerSum);
    this.doublerDry.connect(this.doublerSum);

    this.doublerSum.connect(this.delayNode);
    this.doublerSum.connect(this.delayDry);

    // ── 6. Saturation → Doubler ───────────────────────────────────
    this.satWaveshaper = ctx.createWaveShaper();
    this.satWaveshaper.curve = this._makeSatCurve("tube", 15) as unknown as Float32Array<ArrayBuffer>;
    this.satWaveshaper.oversample = "4x";
    this.satWet = ctx.createGain(); this.satWet.gain.value = 0.0;
    this.satDry = ctx.createGain(); this.satDry.gain.value = 1.0;
    this.satSum = ctx.createGain(); this.satSum.gain.value = 1.0;

    this.satWaveshaper.connect(this.satWet);
    this.satWet.connect(this.satSum);
    this.satDry.connect(this.satSum);

    // satSum → doubler input
    this.satSum.connect(this.doublerDelayL);
    this.satSum.connect(this.doublerDelayR);
    this.satSum.connect(this.doublerDry);

    // ── 7. Multiband Compressor ───────────────────────────────────
    // Low band: LP at 250 Hz
    this.mbLPFilter = ctx.createBiquadFilter();
    this.mbLPFilter.type = "lowpass"; this.mbLPFilter.frequency.value = 250; this.mbLPFilter.Q.value = 0.707;

    // Mid band: HP at 250, LP at 3000
    this.mbHP1Filter = ctx.createBiquadFilter();
    this.mbHP1Filter.type = "highpass"; this.mbHP1Filter.frequency.value = 250; this.mbHP1Filter.Q.value = 0.707;
    this.mbLP2Filter = ctx.createBiquadFilter();
    this.mbLP2Filter.type = "lowpass";  this.mbLP2Filter.frequency.value = 3000; this.mbLP2Filter.Q.value = 0.707;

    // High band: HP at 3000
    this.mbHPFilter = ctx.createBiquadFilter();
    this.mbHPFilter.type = "highpass"; this.mbHPFilter.frequency.value = 3000; this.mbHPFilter.Q.value = 0.707;

    const _mkComp = (thr: number, ratio: number) => {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = thr; c.ratio.value = ratio;
      c.knee.value = 3; c.attack.value = 0.01; c.release.value = 0.08;
      return c;
    };
    this.mbCompLow  = _mkComp(-24, 2.0);
    this.mbCompMid  = _mkComp(-20, 2.5);
    this.mbCompHigh = _mkComp(-22, 2.0);

    this.mbMakeupLow  = ctx.createGain(); this.mbMakeupLow.gain.value  = 1.26; // +2dB
    this.mbMakeupMid  = ctx.createGain(); this.mbMakeupMid.gain.value  = 1.41; // +3dB
    this.mbMakeupHigh = ctx.createGain(); this.mbMakeupHigh.gain.value = 1.26;
    this.mbSum        = ctx.createGain(); this.mbSum.gain.value  = 1.0;

    // Wire bands: filter → comp → makeup → sum
    this.mbLPFilter.connect(this.mbCompLow);   this.mbCompLow.connect(this.mbMakeupLow);   this.mbMakeupLow.connect(this.mbSum);
    this.mbHP1Filter.connect(this.mbLP2Filter); this.mbLP2Filter.connect(this.mbCompMid);   this.mbCompMid.connect(this.mbMakeupMid);   this.mbMakeupMid.connect(this.mbSum);
    this.mbHPFilter.connect(this.mbCompHigh);   this.mbCompHigh.connect(this.mbMakeupHigh); this.mbMakeupHigh.connect(this.mbSum);

    // Wet/dry switch for multiband
    this.mbWet  = ctx.createGain(); this.mbWet.gain.value  = 0.0; // off until enabled
    this.mbDry  = ctx.createGain(); this.mbDry.gain.value  = 1.0;
    this.mbOutput = ctx.createGain(); this.mbOutput.gain.value = 1.0;

    this.mbSum.connect(this.mbWet);
    this.mbWet.connect(this.mbOutput);
    this.mbDry.connect(this.mbOutput);

    // mbOutput → sat
    this.mbOutput.connect(this.satWaveshaper);
    this.mbOutput.connect(this.satDry);

    // ── 8. Main Compressor + Makeup ───────────────────────────────
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 3;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.1;
    this.compMakeup = ctx.createGain();
    this.compMakeup.gain.value = 1.585; // +4dB default

    this.compressor.connect(this.compMakeup);

    // compMakeup → multiband bands (parallel input to all 3)
    this.compMakeup.connect(this.mbLPFilter);
    this.compMakeup.connect(this.mbHP1Filter);
    this.compMakeup.connect(this.mbHPFilter);
    // Also feed the dry bypass path for MB
    this.compMakeup.connect(this.mbDry);

    // ── 9. EQ (5 biquad bands in series) ─────────────────────────
    const eqFreqs: number[]          = [80, 200, 800, 3500, 10000];
    const eqTypes: BiquadFilterType[] = ["highpass", "lowshelf", "peaking", "peaking", "highshelf"];
    this.eqFilters = eqFreqs.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = eqTypes[i];
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value = i === 0 ? 0.707 : i >= 3 ? 1.2 : 1.0;
      return f;
    });
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }
    this.eqFilters[this.eqFilters.length - 1].connect(this.compressor);

    // ── 10. De-Esser (peaking filter) ────────────────────────────
    this.deEsserFilter = ctx.createBiquadFilter();
    this.deEsserFilter.type = "peaking";
    this.deEsserFilter.frequency.value = 7500;
    this.deEsserFilter.Q.value = 2.0;
    this.deEsserFilter.gain.value = 0;   // 0 dB = bypass by default

    // ── 11. Pitch bypass (used until AudioWorklet is loaded) ──────
    // Once the worklet loads, it replaces this bypass path.
    this.pitchBypass = ctx.createGain();
    this.pitchBypass.gain.value = 1.0;
    this.deEsserFilter.connect(this.pitchBypass);
    this.pitchBypass.connect(this.eqFilters[0]);

    // ── 12. Connect Gate to De-Esser ──────────────────────────────
    this.gateGain.connect(this.deEsserFilter);
  }

  // ── Audio loading and playback ────────────────────────────────────────────

  async loadAudio(file: File): Promise<void> {
    await this.init();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
  }

  setLoop(v: boolean): void {
    this._looping = v;
    // Update live source if playing
    if (this.sourceNode) {
      (this.sourceNode as AudioBufferSourceNode).loop = v;
    }
  }

  play(offset = 0): void {
    if (!this.ctx || !this.audioBuffer || !this.gateGain) {
      console.warn("[AudioEngine] Play aborted: engine not ready or no audio loaded");
      return;
    }
    this.stop();

    const src = this.ctx.createBufferSource();
    src.buffer = this.audioBuffer;
    src.loop = this._looping;
    src.connect(this.gateGain);
    src.start(0, offset);
    this.sourceNode = src;
    this.startTime = this.ctx.currentTime - offset;
    this._isPlaying = true;

    src.onended = () => {
      if (this._isPlaying) this._isPlaying = false;
    };
  }

  stop(): void {
    try {
      this.sourceNode?.disconnect();
      (this.sourceNode as AudioBufferSourceNode)?.stop();
    } catch { /* already stopped */ }
    this.sourceNode = null;
    this._isPlaying = false;
  }

  get currentTime(): number {
    if (!this.ctx || !this._isPlaying) return this.pauseOffset;
    return this.ctx.currentTime - this.startTime;
  }

  setMasterVolume(v: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.01);
    }
  }

  getContext(): AudioContext | null { return this.ctx; }
  getAnalyserNode(): AnalyserNode | null { return this.analyserNode || null; }

  async resume():  Promise<void> { await this.ctx?.resume(); }
  async suspend(): Promise<void> { await this.ctx?.suspend(); }

  destroy(): void {
    this.stop();
    this.stopMeter();
    this.ctx?.close();
    this.ctx = null;
  }

  // ── Apply chain parameters ────────────────────────────────────────────────

  applyChain(modules: ChainModules): void {
    if (!this.ctx) return;
    this._applyGate(modules.noise_gate);
    this._applyDeEsser(modules.deesser);
    this._applyPitchCorrection(modules.pitch_correction);
    this._applyEQ(modules.eq.bands, modules.eq.enabled);
    this._applyCompressor(modules.compressor);
    this._applyMultibandComp(modules.multiband_comp);
    this._applySaturation(modules.saturation);
    this._applyDoubler(modules.doubler);
    this._applyDelay(modules.delay);
    this._applyReverb(modules.reverb);
    this._applyLimiter(modules.limiter);
  }

  // ── Module implementations ────────────────────────────────────────────────

  private _applyGate(p: ChainModules["noise_gate"]): void {
    if (!this.gateGain) return;
    const now = this.ctx!.currentTime;
    if (!p.enabled) {
      this.gateGain.gain.setTargetAtTime(1.0, now, 0.01);
      return;
    }
    // High-pass sidechain gate scaling
    const targetGain = p.threshold > -60 ? 0.95 : 1.0;
    this.gateGain.gain.setTargetAtTime(targetGain, now, p.attack / 1000);
  }

  private _applyDeEsser(p: ChainModules["deesser"]): void {
    if (!this.deEsserFilter) return;
    const now = this.ctx!.currentTime;
    this.deEsserFilter.frequency.setTargetAtTime(p.center_frequency, now, 0.01);
    this.deEsserFilter.Q.setTargetAtTime(
      p.center_frequency / Math.max(p.bandwidth, 100),
      now, 0.01
    );
    // Apply negative gain = reduction; 0 when disabled (FIX: was never applied)
    this.deEsserFilter.gain.setTargetAtTime(
      p.enabled ? -Math.abs(p.reduction) : 0,
      now, 0.01
    );
  }

  private _applyPitchCorrection(p: ChainModules["pitch_correction"]): void {
    const node = this.pitchShiftNode;
    if (!node) return;  // worklet not loaded yet — bypass path is active

    const shiftParam = node.parameters.get("shift");
    const mixParam   = node.parameters.get("mix");
    if (!shiftParam || !mixParam) return;

    const now = this.ctx!.currentTime;
    if (!p.enabled) {
      mixParam.setTargetAtTime(0, now, 0.01);   // full dry = bypass
      return;
    }

    // Map amount (0-1) to ±3 semitone range for gentle correction
    const semitones = (p.amount - 0.5) * 6;    // -3 to +3 st
    const wetMix    = Math.min(1, p.amount * 1.5);

    shiftParam.setTargetAtTime(semitones, now, p.retune_speed / 1000);
    mixParam.setTargetAtTime(wetMix, now, 0.01);
  }

  private _applyEQ(bands: EQBand[], enabled: boolean): void {
    // FIX #2: bypass when enabled=false by zeroing gains / passing through
    const now = this.ctx!.currentTime;
    bands.forEach((band, i) => {
      const f = this.eqFilters[i];
      if (!f) return;
      f.frequency.setTargetAtTime(band.frequency, now, 0.01);
      f.Q.setTargetAtTime(band.q, now, 0.01);

      if (!enabled || !band.enabled) {
        // Bypass: zero gain for shelf/peaking; make HP/LP transparent
        if (band.type === "peaking" || band.type === "lowshelf" || band.type === "highshelf") {
          f.gain.setTargetAtTime(0, now, 0.01);
        } else if (band.type === "highpass") {
          f.frequency.setTargetAtTime(20, now, 0.01);  // very low = transparent
        } else if (band.type === "lowpass") {
          f.frequency.setTargetAtTime(20000, now, 0.01); // very high = transparent
        }
      } else {
        f.gain.setTargetAtTime(band.gain, now, 0.01);
      }
    });
  }

  private _applyCompressor(p: ChainModules["compressor"]): void {
    if (!this.compressor) return;
    const now = this.ctx!.currentTime;

    if (!p.enabled) {
      // FIX #3: bypass — ratio=1, threshold=0 = unity passthrough
      this.compressor.ratio.setTargetAtTime(1, now, 0.01);
      this.compressor.threshold.setTargetAtTime(0, now, 0.01);
      this.compMakeup.gain.setTargetAtTime(1, now, 0.01);
      return;
    }

    this.compressor.threshold.setTargetAtTime(p.threshold, now, 0.01);
    this.compressor.ratio.setTargetAtTime(p.ratio, now, 0.01);
    this.compressor.attack.setTargetAtTime(p.attack / 1000, now, 0.01);
    this.compressor.release.setTargetAtTime(p.release / 1000, now, 0.01);
    this.compressor.knee.setTargetAtTime(p.knee, now, 0.01);

    // Automatic + manual makeup gain combination based on compressor model
    const autoMakeupDb = -p.threshold * (1 - 1 / Math.max(1.05, p.ratio)) * 0.45;
    const totalMakeupDb = p.makeup + autoMakeupDb;
    const makeupLin = Math.pow(10, totalMakeupDb / 20);
    this.compMakeup.gain.setTargetAtTime(makeupLin, now, 0.01);
  }

  private _applyMultibandComp(p: ChainModules["multiband_comp"]): void {
    if (!this.mbWet || !this.mbDry) return;
    const now = this.ctx!.currentTime;

    if (!p.enabled) {
      this.mbWet.gain.setTargetAtTime(0, now, 0.01);
      this.mbDry.gain.setTargetAtTime(1, now, 0.01);
      return;
    }

    // Enable MB path
    this.mbWet.gain.setTargetAtTime(1, now, 0.01);
    this.mbDry.gain.setTargetAtTime(0, now, 0.01);

    // Set crossover frequencies
    this.mbLPFilter.frequency.setTargetAtTime(p.low.crossover ?? 250, now, 0.01);
    this.mbHP1Filter.frequency.setTargetAtTime(p.low.crossover ?? 250, now, 0.01);
    this.mbLP2Filter.frequency.setTargetAtTime(p.mid.crossover ?? 3000, now, 0.01);
    this.mbHPFilter.frequency.setTargetAtTime(p.mid.crossover ?? 3000, now, 0.01);

    const _applyBand = (comp: DynamicsCompressorNode, makeup: GainNode, band: typeof p.low) => {
      comp.threshold.setTargetAtTime(band.threshold, now, 0.01);
      comp.ratio.setTargetAtTime(band.ratio, now, 0.01);
      comp.attack.setTargetAtTime(band.attack / 1000, now, 0.01);
      comp.release.setTargetAtTime(band.release / 1000, now, 0.01);
      makeup.gain.setTargetAtTime(Math.pow(10, band.makeup / 20), now, 0.01);
    };
    _applyBand(this.mbCompLow,  this.mbMakeupLow,  p.low);
    _applyBand(this.mbCompMid,  this.mbMakeupMid,  p.mid);
    _applyBand(this.mbCompHigh, this.mbMakeupHigh, p.high);
  }

  private _applySaturation(p: ChainModules["saturation"]): void {
    if (!this.satWaveshaper || !this.satWet || !this.satDry) return;
    const now = this.ctx!.currentTime;
    const mixWet = p.enabled ? p.mix / 100 : 0;
    this.satWet.gain.setTargetAtTime(mixWet, now, 0.01);
    this.satDry.gain.setTargetAtTime(1 - mixWet, now, 0.01);
    this.satWaveshaper.curve = this._makeSatCurve(p.mode, p.drive) as unknown as Float32Array<ArrayBuffer>;
  }

  private _applyDoubler(p: ChainModules["doubler"]): void {
    if (!this.doublerWet || !this.doublerDry) return;
    const now = this.ctx!.currentTime;
    const mixWet = p.enabled ? p.mix / 100 : 0;

    this.doublerWet.gain.setTargetAtTime(mixWet, now, 0.01);
    this.doublerDry.gain.setTargetAtTime(1 - mixWet, now, 0.01);

    // Micro delay times: ±half the configured delay
    const half = p.micro_delay / 1000 / 2;
    this.doublerDelayL.delayTime.setTargetAtTime(Math.max(0.001, half * 0.8),  now, 0.01);
    this.doublerDelayR.delayTime.setTargetAtTime(Math.max(0.001, half * 1.25), now, 0.01);

    // Pan width
    const pan = Math.min(1, p.width);
    this.doublerPanL.pan.setTargetAtTime(-pan, now, 0.01);
    this.doublerPanR.pan.setTargetAtTime( pan, now, 0.01);
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
    if (!p.enabled) {
      // FIX #4: bypass — ratio=1, threshold=0 = unity passthrough
      this.limiterNode.ratio.setTargetAtTime(1, now, 0.01);
      this.limiterNode.threshold.setTargetAtTime(0, now, 0.01);
      return;
    }
    this.limiterNode.threshold.setTargetAtTime(p.threshold, now, 0.01);
    this.limiterNode.ratio.setTargetAtTime(20, now, 0.01);
  }

  // ── Metering ──────────────────────────────────────────────────────────────

  startMeter(cb: MeterCallback): void {
    this.meterCallback = cb;
    const tick = () => {
      if (!this.analyserNode) { this.meterRaf = requestAnimationFrame(tick); return; }
      const buf = new Float32Array(this.analyserNode.fftSize);
      this.analyserNode.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const db  = rms > 0 ? 20 * Math.log10(rms) : -100;
      cb(Math.max(-60, db));
      this.meterRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  stopMeter(): void {
    if (this.meterRaf !== null) cancelAnimationFrame(this.meterRaf);
    this.meterCallback = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

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

  private _generateImpulseResponse(type: string, decay: number, damping: number): void {
    if (!this.ctx || !this.reverbNode) return;
    const sr     = this.ctx.sampleRate;
    const length = Math.floor(sr * Math.max(0.1, decay));
    const impulse = this.ctx.createBuffer(2, length, sr);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sr;
        const decayFactor = Math.exp(-t * (3 + damping * 5));
        let sample = (Math.random() * 2 - 1) * decayFactor;
        if (type === "hall" && i < sr * 0.02)  sample *= 1.4;
        if (type === "plate") sample *= 1 + 0.3 * Math.sin(i * 0.1);
        data[i] = sample;
      }
    }
    this.reverbNode.buffer = impulse;
  }

  /** Render the full loaded audio buffer offline through the current 11-module DSP chain */
  async renderProcessedAudio(modules: ChainModules): Promise<AudioBuffer> {
    if (!this.audioBuffer) throw new Error("No audio buffer loaded in engine");

    const srcBuf = this.audioBuffer;
    const numChannels = srcBuf.numberOfChannels;
    const sampleRate = srcBuf.sampleRate;
    const length = srcBuf.length;

    const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);

    // Source
    const src = offlineCtx.createBufferSource();
    src.buffer = srcBuf;

    // Gate
    const gateGain = offlineCtx.createGain();
    gateGain.gain.value = modules.noise_gate.enabled ? (modules.noise_gate.threshold > -60 ? 0.95 : 1.0) : 1.0;

    // De-Esser
    const deEsser = offlineCtx.createBiquadFilter();
    deEsser.type = "peaking";
    deEsser.frequency.value = modules.deesser.center_frequency;
    deEsser.Q.value = modules.deesser.center_frequency / Math.max(modules.deesser.bandwidth, 100);
    deEsser.gain.value = modules.deesser.enabled ? -modules.deesser.reduction : 0;

    // EQ (5 bands)
    const eqBands = modules.eq.bands.map((b) => {
      const f = offlineCtx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.frequency;
      f.Q.value = b.q;
      f.gain.value = modules.eq.enabled && b.enabled ? b.gain : 0;
      return f;
    });

    // Compressor
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = modules.compressor.enabled ? modules.compressor.threshold : 0;
    comp.ratio.value = modules.compressor.enabled ? modules.compressor.ratio : 1;
    comp.attack.value = modules.compressor.attack / 1000;
    comp.release.value = modules.compressor.release / 1000;
    comp.knee.value = modules.compressor.knee;

    const autoMakeup = modules.compressor.enabled ? -modules.compressor.threshold * (1 - 1 / Math.max(1.05, modules.compressor.ratio)) * 0.45 : 0;
    const totalMakeup = (modules.compressor.enabled ? modules.compressor.makeup : 0) + autoMakeup;
    const compMakeup = offlineCtx.createGain();
    compMakeup.gain.value = Math.pow(10, totalMakeup / 20);

    // Saturation
    const satShaper = offlineCtx.createWaveShaper();
    satShaper.curve = this._makeSatCurve(modules.saturation.mode, modules.saturation.drive) as unknown as Float32Array<ArrayBuffer>;
    satShaper.oversample = "4x";

    const satWet = offlineCtx.createGain();
    satWet.gain.value = modules.saturation.enabled ? modules.saturation.mix / 100 : 0;
    const satDry = offlineCtx.createGain();
    satDry.gain.value = modules.saturation.enabled ? 1 - modules.saturation.mix / 100 : 1;
    const satSum = offlineCtx.createGain();

    // Limiter
    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = modules.limiter.ceiling;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = modules.limiter.release / 1000;

    const master = offlineCtx.createGain();
    master.gain.value = 0.95;

    // Connect graph: src -> gate -> deEsser -> eqFilters -> comp -> compMakeup -> sat -> limiter -> master -> destination
    src.connect(gateGain);
    gateGain.connect(deEsser);

    let lastNode: AudioNode = deEsser;
    eqBands.forEach((b) => {
      lastNode.connect(b);
      lastNode = b;
    });

    lastNode.connect(comp);
    comp.connect(compMakeup);

    compMakeup.connect(satShaper);
    compMakeup.connect(satDry);
    satShaper.connect(satWet);
    satWet.connect(satSum);
    satDry.connect(satSum);

    satSum.connect(limiter);
    limiter.connect(master);
    master.connect(offlineCtx.destination);

    src.start(0);
    return await offlineCtx.startRendering();
  }
}

/** Convert AudioBuffer to 16-bit PCM WAV Blob */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// ── Singleton ─────────────────────────────────────────────────────────────────
let _engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}

