/**
 * LUFS Meter AudioWorklet
 * ITU-R BS.1770-4 K-weighted integrated loudness, running in the audio thread.
 *
 * Posts { lufs, momentary, peak } to main thread every 100ms.
 *
 * Register: ctx.audioWorklet.addModule('/dsp/lufs-processor.js')
 * Use:      new AudioWorkletNode(ctx, 'lufs-processor')
 */

// K-weighting biquad coefficients (48 kHz)
const HS = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1.0, -1.69065929318241, 0.73248077421585] };
const HP = { b: [1.0, -2.0, 1.0], a: [1.0, -1.99004745483398, 0.99007225036621] };

class BiquadState {
  constructor() { this.s1 = 0; this.s2 = 0; }
  process(b, a, x) {
    const y = b[0] * x + this.s1;
    this.s1 = b[1] * x - a[1] * y + this.s2;
    this.s2 = b[2] * x - a[2] * y;
    return y;
  }
}

class LUFSProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._hs   = new BiquadState();
    this._hp   = new BiquadState();

    // Circular buffer for 400ms integration window (momentary)
    this._bufSize  = Math.ceil(sampleRate * 0.4);
    this._buf      = new Float32Array(this._bufSize);
    this._bufIdx   = 0;
    this._bufFull  = false;

    // Integrated loudness accumulators
    this._sumSq    = 0;
    this._count    = 0;
    this._peak     = 0;

    // Post every ~100ms
    this._postEvery = Math.ceil(sampleRate * 0.1);
    this._postCount = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      let x = ch[i];

      // K-weighting: high-shelf then high-pass
      x = this._hs.process(HS.b, HS.a, x);
      x = this._hp.process(HP.b, HP.a, x);

      const sq = x * x;

      // Update integrated accumulators
      this._sumSq += sq;
      this._count++;

      // Peak detection (true peak approximation)
      const abs = Math.abs(ch[i]);
      if (abs > this._peak) this._peak = abs;

      // Circular buffer for momentary (400ms)
      this._buf[this._bufIdx] = sq;
      this._bufIdx = (this._bufIdx + 1) % this._bufSize;
      if (this._bufIdx === 0) this._bufFull = true;
    }

    this._postCount += ch.length;
    if (this._postCount >= this._postEvery) {
      this._postCount = 0;

      // Momentary LUFS (last 400ms)
      const n = this._bufFull ? this._bufSize : this._bufIdx;
      let momentarySq = 0;
      for (let i = 0; i < n; i++) momentarySq += this._buf[i];
      const momentary = n > 0
        ? -0.691 + 10 * Math.log10(momentarySq / n + 1e-10)
        : -70;

      // Integrated LUFS
      const integrated = this._count > 0
        ? -0.691 + 10 * Math.log10(this._sumSq / this._count + 1e-10)
        : -70;

      // True peak dBFS
      const peakDb = 20 * Math.log10(this._peak + 1e-10);

      this.port.postMessage({ lufs: integrated, momentary, peak: peakDb });
    }

    return true;
  }
}

registerProcessor('lufs-processor', LUFSProcessor);
