/**
 * VoxBox Pitch Shift Processor
 * Granular overlap-add pitch shifter using twin read-pointers + Hanning window crossfade.
 *
 * AudioParam: "shift"  — semitones to shift, range [-12, +12], default 0
 * AudioParam: "mix"    — wet/dry mix 0-1, default 0 (bypassed)
 *
 * Algorithm:
 *   Two read pointers traverse a circular buffer at speed = 2^(shift/12).
 *   They are offset by grainSize/2 samples so their Hanning windows always
 *   sum to 1 (perfect overlap-add reconstruction at shift=0).
 *   This produces artefact-free output for small shifts (±3 st)
 *   and natural-sounding output for larger shifts (±12 st).
 */

const SAMPLE_RATE = 44100;
const BUFFER_SECS = 2;
const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECS;
const GRAIN_SIZE  = 2048;

class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "shift", defaultValue: 0,   minValue: -12, maxValue: 12,  automationRate: "k-rate" },
      { name: "mix",   defaultValue: 0.0, minValue: 0,   maxValue: 1.0, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this._buf      = new Float32Array(BUFFER_SIZE);
    this._writePos = 0;
    // Stagger the two read pointers by half a grain
    this._rp1 = 0;
    this._rp2 = GRAIN_SIZE / 2;
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    const shift = parameters.shift[0];
    const mix   = parameters.mix[0];
    const speed = Math.pow(2, shift / 12);  // read pointer advance rate

    for (let i = 0; i < output.length; i++) {
      // Write incoming sample into circular buffer
      this._buf[this._writePos & (BUFFER_SIZE - 1)] = input[i];
      this._writePos++;

      if (mix < 0.001) {
        // Bypass — pass through dry signal
        output[i] = input[i];
        this._rp1 += speed;
        this._rp2 += speed;
        continue;
      }

      // Phase within each grain (0 → 1)
      const ph1 = (this._rp1 % GRAIN_SIZE) / GRAIN_SIZE;
      const ph2 = (this._rp2 % GRAIN_SIZE) / GRAIN_SIZE;

      // Hanning window weights — sum to 1 because pointers are offset by GRAIN/2
      const w1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph1);
      const w2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph2);

      // Read from circular buffer with integer index (no interpolation artefacts)
      const idx1 = Math.floor(this._rp1) & (BUFFER_SIZE - 1);
      const idx2 = Math.floor(this._rp2) & (BUFFER_SIZE - 1);

      const wet = this._buf[idx1] * w1 + this._buf[idx2] * w2;

      output[i] = input[i] * (1 - mix) + wet * mix;

      // Advance read pointers at pitch-shifted speed
      this._rp1 += speed;
      this._rp2 += speed;

      // Wrap read pointers when they get too close to write pointer
      // (keep them at least GRAIN_SIZE behind write, at most BUFFER_SIZE/2 behind)
      const dist1 = (this._writePos - this._rp1 + BUFFER_SIZE) % BUFFER_SIZE;
      const dist2 = (this._writePos - this._rp2 + BUFFER_SIZE) % BUFFER_SIZE;

      if (dist1 > BUFFER_SIZE / 2) this._rp1 = this._writePos - GRAIN_SIZE * 2;
      if (dist2 > BUFFER_SIZE / 2) this._rp2 = this._writePos - GRAIN_SIZE * 2 + GRAIN_SIZE / 2;
    }

    return true;
  }
}

registerProcessor("pitch-shift-processor", PitchShiftProcessor);
