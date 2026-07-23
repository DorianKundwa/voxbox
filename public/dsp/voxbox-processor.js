/**
 * VoxBox DSP AudioWorklet Processor
 *
 * Loads the C++ → WASM module (voxbox_dsp.wasm) and routes
 * parameter updates to the compiled DSP functions.
 *
 * Registered as: voxbox-dsp-processor
 *
 * Message protocol (from main thread):
 *   { type: 'init',        sampleRate: number }
 *   { type: 'gate',        threshold, attack, hold, release }
 *   { type: 'deesser',     freq, q, threshold, reduction }
 *   { type: 'eq',          bands: [{freq,gain,q,type},...] }
 *   { type: 'compressor',  threshold, ratio, attack, release, makeup, knee }
 *   { type: 'saturation',  mode, drive, mix }
 *   { type: 'width',       width }
 *   { type: 'limiter',     ceiling, release }
 *   { type: 'bypass',      module, value }
 */

class VoxBoxDSPProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);

    this._sr         = sampleRate;
    this._wasm       = null;
    this._wasmReady  = false;

    // DSP object pointers (set after WASM loaded)
    this._gate     = 0;
    this._deesser  = 0;
    this._comp     = 0;
    this._limiter  = 0;
    this._eqBands  = [];     // array of Biquad pointers
    this._eq5Freqs = [80, 200, 800, 3500, 10000];

    // bypass flags
    this._bypass = {
      gate: true, deesser: true, eq: true,
      compressor: true, saturation: true,
      width: false, limiter: true,
    };

    // saturation params (applied via sat_process, no pointer needed)
    this._satMode  = 0;
    this._satDrive = 15;
    this._satMix   = 0;
    this._widthVal = 1.0;

    this.port.onmessage = (e) => this._onMessage(e.data);

    // Load WASM
    this._loadWasm();
  }

  async _loadWasm() {
    try {
      const resp = await fetch('/dsp/voxbox_dsp.wasm');
      const bytes = await resp.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      const exp = instance.exports;

      this._exp = exp;

      // Allocate DSP objects
      this._gate    = exp.gate_alloc();
      this._deesser = exp.deesser_alloc();
      this._comp    = exp.comp_alloc();
      this._limiter = exp.limiter_alloc();

      // Allocate 5 EQ biquads
      this._eqBands = Array.from({ length: 5 }, () => exp.biquad_alloc());

      // Set defaults
      this._applyGateDefaults();
      this._applyCompDefaults();
      this._applyLimiterDefaults();
      this._applyEQDefaults();

      this._wasmReady = true;
      this.port.postMessage({ type: 'ready' });
    } catch (err) {
      // WASM not available — fall back to JS passthrough
      this.port.postMessage({ type: 'wasm_unavailable', error: err.message });
    }
  }

  _applyGateDefaults() {
    const e = this._exp;
    e.gate_set(this._gate, -50, 5, 50, 150, this._sr);
  }

  _applyCompDefaults() {
    const e = this._exp;
    e.comp_set(this._comp, -18, 3.0, 8, 100, 4, 3, this._sr);
  }

  _applyLimiterDefaults() {
    const e = this._exp;
    e.limiter_set(this._limiter, -0.3, 100, this._sr);
  }

  _applyEQDefaults() {
    const e = this._exp;
    const types = ['highpass', 'lowshelf', 'peaking', 'peaking', 'highshelf'];
    const freqs = this._eq5Freqs;
    freqs.forEach((freq, i) => {
      const ptr = this._eqBands[i];
      if (types[i] === 'highpass')  e.biquad_set_highpass(ptr, freq, 0.707, this._sr);
      else if (types[i] === 'lowshelf') e.biquad_set_lowshelf(ptr, freq, 0, this._sr);
      else if (types[i] === 'highshelf') e.biquad_set_highshelf(ptr, freq, 0, this._sr);
      else e.biquad_set_peaking(ptr, freq, 0, 1.0, this._sr);
    });
  }

  _onMessage(msg) {
    if (!this._wasmReady) return;
    const e = this._exp;

    switch (msg.type) {
      case 'gate':
        e.gate_set(this._gate,
          msg.threshold, msg.attack, msg.hold, msg.release, this._sr);
        break;

      case 'deesser':
        e.deesser_set(this._deesser,
          msg.freq, msg.q || 2.5, msg.threshold, msg.reduction, this._sr);
        break;

      case 'eq':
        (msg.bands || []).forEach((band, i) => {
          const ptr = this._eqBands[i];
          if (!ptr) return;
          if (band.type === 'highpass')
            e.biquad_set_highpass(ptr, band.frequency, band.q, this._sr);
          else if (band.type === 'lowshelf')
            e.biquad_set_lowshelf(ptr, band.frequency, band.gain, this._sr);
          else if (band.type === 'highshelf')
            e.biquad_set_highshelf(ptr, band.frequency, band.gain, this._sr);
          else
            e.biquad_set_peaking(ptr, band.frequency, band.gain, band.q, this._sr);
        });
        break;

      case 'compressor':
        e.comp_set(this._comp,
          msg.threshold, msg.ratio, msg.attack, msg.release, msg.makeup, msg.knee, this._sr);
        break;

      case 'saturation':
        this._satMode  = ['tube','tape','warm','soft_clip'].indexOf(msg.mode);
        this._satDrive = msg.drive;
        this._satMix   = msg.mix;
        break;

      case 'limiter':
        e.limiter_set(this._limiter, msg.ceiling, msg.release, this._sr);
        break;

      case 'width':
        this._widthVal = msg.width;
        break;

      case 'bypass':
        this._bypass[msg.module] = msg.value;
        break;
    }
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const blockSize = input[0].length;
    const e = this._exp;

    // Copy input channels to output (in case we passthrough)
    const ch = Math.min(input.length, output.length);
    for (let c = 0; c < ch; c++) {
      output[c].set(input[c]);
    }

    if (!this._wasmReady) return true;

    // Allocate a working buffer in WASM memory for channel 0
    const bufPtr = e.malloc(blockSize * 4); // float32
    const bufPtr2 = e.malloc(blockSize * 4); // channel 1 for width

    const heap = new Float32Array(e.memory.buffer);

    // Helper: copy JS Float32Array into WASM heap at ptr
    const toWasm = (ptr, arr) => {
      const off = ptr >>> 2;
      heap.set(arr, off);
    };
    const fromWasm = (ptr, n) => {
      const off = ptr >>> 2;
      return heap.slice(off, off + n);
    };

    // ── Process mono (channel 0) through gate → deesser → eq → comp → sat → limiter ──
    toWasm(bufPtr, output[0]);

    if (!this._bypass.gate)       e.gate_process(this._gate, bufPtr, blockSize);
    if (!this._bypass.deesser)    e.deesser_process(this._deesser, bufPtr, blockSize);
    if (!this._bypass.eq)
      this._eqBands.forEach(ptr => e.biquad_process(ptr, bufPtr, blockSize));
    if (!this._bypass.compressor) e.comp_process(this._comp, bufPtr, blockSize);
    if (!this._bypass.saturation && this._satMix > 0)
      e.sat_process(bufPtr, blockSize, this._satMode, this._satDrive, this._satMix);
    if (!this._bypass.limiter)    e.limiter_process(this._limiter, bufPtr, blockSize);

    output[0].set(fromWasm(bufPtr, blockSize));

    // ── Stereo width (if stereo) ──────────────────────────────────────────────
    if (output.length > 1 && !this._bypass.width) {
      toWasm(bufPtr2, output[1]);
      e.width_process(bufPtr, bufPtr2, blockSize, this._widthVal);
      output[0].set(fromWasm(bufPtr, blockSize));
      output[1].set(fromWasm(bufPtr2, blockSize));
    } else if (output.length > 1) {
      // Copy mono to stereo
      output[1].set(output[0]);
    }

    e.free(bufPtr);
    e.free(bufPtr2);
    return true;
  }
}

registerProcessor('voxbox-dsp-processor', VoxBoxDSPProcessor);
