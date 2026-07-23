/**
 * VoxBox DSP Engine — C++ core
 * Compiled to WebAssembly via Emscripten for use in AudioWorklets.
 *
 * Implements:
 *   - Noise Gate (RMS-based with hold)
 *   - De-Esser (sidechain BPF + gain reduction)
 *   - Biquad EQ filter (Direct Form II transposed)
 *   - Dynamics Compressor (feed-forward, log-domain)
 *   - Waveshaper Saturation (tube / tape / warm / soft_clip)
 *   - Stereo Width matrix
 *
 * Build:
 *   emcc dsp_engine.cpp -O3 -msimd128 -s WASM=1 \
 *        -s EXPORTED_FUNCTIONS="['_process_gate','_process_biquad','_process_compressor','_process_saturation','_process_deesser','_process_width','_init_biquad','_malloc','_free']" \
 *        -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" \
 *        -s MODULARIZE=1 -s EXPORT_NAME="VoxBoxDSP" \
 *        -o ../public/dsp/voxbox_dsp.js
 */

#include <emscripten/emscripten.h>
#include <cmath>
#include <cstring>
#include <algorithm>

static const float TWO_PI = 6.28318530718f;
static const float LN2_HALF = 0.34657359028f;

// ── Utility ──────────────────────────────────────────────────────────────────

inline float clamp(float x, float lo, float hi) {
    return x < lo ? lo : (x > hi ? hi : x);
}

inline float db_to_lin(float db) { return powf(10.f, db * 0.05f); }
inline float lin_to_db(float lin) { return lin > 1e-9f ? 20.f * log10f(lin) : -180.f; }

// ── Biquad Filter (Direct Form II Transposed) ─────────────────────────────────

struct Biquad {
    float b0, b1, b2;   // feedforward
    float a1, a2;        // feedback (a0 normalised to 1)
    float s1, s2;        // state

    void clear() { s1 = s2 = 0.f; }
};

extern "C" {

// Allocate a Biquad on the heap, return pointer
EMSCRIPTEN_KEEPALIVE
Biquad* biquad_alloc() {
    Biquad* b = new Biquad();
    b->clear();
    return b;
}

EMSCRIPTEN_KEEPALIVE
void biquad_free(Biquad* b) { delete b; }

EMSCRIPTEN_KEEPALIVE
void biquad_set_lowshelf(Biquad* b, float freq, float gain_db, float sr) {
    float A  = sqrtf(db_to_lin(gain_db));
    float w0 = TWO_PI * freq / sr;
    float cosw = cosf(w0), sinw = sinf(w0);
    float S  = 1.f;
    float alpha = sinw * 0.5f * sqrtf((A + 1.f/A) * (1.f/S - 1.f) + 2.f);
    float a0 = (A+1) + (A-1)*cosw + 2*sqrtf(A)*alpha;
    b->b0 = (A * ((A+1) - (A-1)*cosw + 2*sqrtf(A)*alpha)) / a0;
    b->b1 = (2*A * ((A-1) - (A+1)*cosw)) / a0;
    b->b2 = (A * ((A+1) - (A-1)*cosw - 2*sqrtf(A)*alpha)) / a0;
    b->a1 = (-2*((A-1) + (A+1)*cosw)) / a0;
    b->a2 = ((A+1) + (A-1)*cosw - 2*sqrtf(A)*alpha) / a0;
}

EMSCRIPTEN_KEEPALIVE
void biquad_set_highshelf(Biquad* b, float freq, float gain_db, float sr) {
    float A  = sqrtf(db_to_lin(gain_db));
    float w0 = TWO_PI * freq / sr;
    float cosw = cosf(w0), sinw = sinf(w0);
    float S  = 1.f;
    float alpha = sinw * 0.5f * sqrtf((A + 1.f/A) * (1.f/S - 1.f) + 2.f);
    float a0 = (A+1) - (A-1)*cosw + 2*sqrtf(A)*alpha;
    b->b0 = (A*((A+1) + (A-1)*cosw + 2*sqrtf(A)*alpha)) / a0;
    b->b1 = (-2*A*((A-1) + (A+1)*cosw)) / a0;
    b->b2 = (A*((A+1) + (A-1)*cosw - 2*sqrtf(A)*alpha)) / a0;
    b->a1 = (2*((A-1) - (A+1)*cosw)) / a0;
    b->a2 = ((A+1) - (A-1)*cosw - 2*sqrtf(A)*alpha) / a0;
}

EMSCRIPTEN_KEEPALIVE
void biquad_set_peaking(Biquad* b, float freq, float gain_db, float q, float sr) {
    float A  = sqrtf(db_to_lin(gain_db));
    float w0 = TWO_PI * freq / sr;
    float alpha = sinf(w0) / (2.f * q);
    float cosw = cosf(w0);
    float a0 = 1.f + alpha / A;
    b->b0 = (1.f + alpha * A) / a0;
    b->b1 = (-2.f * cosw) / a0;
    b->b2 = (1.f - alpha * A) / a0;
    b->a1 = (-2.f * cosw) / a0;
    b->a2 = (1.f - alpha / A) / a0;
}

EMSCRIPTEN_KEEPALIVE
void biquad_set_highpass(Biquad* b, float freq, float q, float sr) {
    float w0 = TWO_PI * freq / sr;
    float cosw = cosf(w0), sinw = sinf(w0);
    float alpha = sinw / (2.f * q);
    float a0 = 1.f + alpha;
    b->b0 =  (1.f + cosw) / (2.f * a0);
    b->b1 = -(1.f + cosw) / a0;
    b->b2 =  (1.f + cosw) / (2.f * a0);
    b->a1 = (-2.f * cosw) / a0;
    b->a2 = (1.f - alpha) / a0;
}

EMSCRIPTEN_KEEPALIVE
void biquad_set_bandpass(Biquad* b, float freq, float q, float sr) {
    float w0 = TWO_PI * freq / sr;
    float alpha = sinf(w0) / (2.f * q);
    float cosw = cosf(w0);
    float a0 = 1.f + alpha;
    b->b0 = alpha / a0;
    b->b1 = 0.f;
    b->b2 = -alpha / a0;
    b->a1 = (-2.f * cosw) / a0;
    b->a2 = (1.f - alpha) / a0;
}

// Process a single sample through the biquad
EMSCRIPTEN_KEEPALIVE
float biquad_tick(Biquad* b, float x) {
    float y = b->b0 * x + b->s1;
    b->s1 = b->b1 * x - b->a1 * y + b->s2;
    b->s2 = b->b2 * x - b->a2 * y;
    return y;
}

// Process a buffer in-place (mono)
EMSCRIPTEN_KEEPALIVE
void biquad_process(Biquad* b, float* buf, int n) {
    for (int i = 0; i < n; ++i) {
        float y = b->b0 * buf[i] + b->s1;
        b->s1 = b->b1 * buf[i] - b->a1 * y + b->s2;
        b->s2 = b->b2 * buf[i] - b->a2 * y;
        buf[i] = y;
    }
}

// ── Noise Gate ────────────────────────────────────────────────────────────────

struct Gate {
    float threshold_lin;
    float attack_coef;
    float hold_coef;
    float release_coef;
    float env;
    float gain;
    int   hold_samples;
    int   hold_count;

    void set(float thr_db, float atk_ms, float hold_ms, float rel_ms, float sr) {
        threshold_lin = db_to_lin(thr_db);
        attack_coef   = expf(-1.f / (atk_ms  * sr * 0.001f));
        hold_coef     = expf(-1.f / (hold_ms  * sr * 0.001f));
        release_coef  = expf(-1.f / (rel_ms  * sr * 0.001f));
        hold_samples  = (int)(hold_ms * sr * 0.001f);
        env = 0.f;
        gain = 0.f;
        hold_count = 0;
    }
};

EMSCRIPTEN_KEEPALIVE
Gate* gate_alloc() { return new Gate{}; }

EMSCRIPTEN_KEEPALIVE
void gate_free(Gate* g) { delete g; }

EMSCRIPTEN_KEEPALIVE
void gate_set(Gate* g, float thr, float atk, float hold, float rel, float sr) {
    g->set(thr, atk, hold, rel, sr);
}

EMSCRIPTEN_KEEPALIVE
void gate_process(Gate* g, float* buf, int n) {
    for (int i = 0; i < n; ++i) {
        float rectified = fabsf(buf[i]);
        // envelope follower
        if (rectified > g->env)
            g->env = g->attack_coef  * g->env + (1.f - g->attack_coef)  * rectified;
        else
            g->env = g->release_coef * g->env + (1.f - g->release_coef) * rectified;

        float target = g->env >= g->threshold_lin ? 1.f : 0.f;
        if (target > g->gain) {
            g->gain = g->attack_coef * g->gain + (1.f - g->attack_coef) * target;
            g->hold_count = g->hold_samples;
        } else if (g->hold_count > 0) {
            g->hold_count--;
        } else {
            g->gain = g->release_coef * g->gain;
        }
        buf[i] *= g->gain;
    }
}

// ── Compressor ────────────────────────────────────────────────────────────────

struct Compressor {
    float threshold_db;
    float ratio;
    float makeup_lin;
    float knee_db;
    float attack_coef;
    float release_coef;
    float env_db;

    void set(float thr, float rat, float atk_ms, float rel_ms, float makeup_db, float knee, float sr) {
        threshold_db = thr;
        ratio        = rat;
        makeup_lin   = db_to_lin(makeup_db);
        knee_db      = knee;
        attack_coef  = expf(-1.f / (atk_ms  * sr * 0.001f));
        release_coef = expf(-1.f / (rel_ms  * sr * 0.001f));
        env_db = -60.f;
    }
};

EMSCRIPTEN_KEEPALIVE
Compressor* comp_alloc() { return new Compressor{}; }

EMSCRIPTEN_KEEPALIVE
void comp_free(Compressor* c) { delete c; }

EMSCRIPTEN_KEEPALIVE
void comp_set(Compressor* c, float thr, float rat, float atk, float rel, float makeup, float knee, float sr) {
    c->set(thr, rat, atk, rel, makeup, knee, sr);
}

EMSCRIPTEN_KEEPALIVE
void comp_process(Compressor* c, float* buf, int n) {
    for (int i = 0; i < n; ++i) {
        float in_db = lin_to_db(fabsf(buf[i]));
        float over  = in_db - c->threshold_db;

        float gain_db;
        if (c->knee_db > 0.f && over > -c->knee_db * 0.5f && over < c->knee_db * 0.5f) {
            // soft knee
            float k = (over + c->knee_db * 0.5f) / c->knee_db;
            gain_db = (1.f/c->ratio - 1.f) * k * k * c->knee_db * 0.5f;
        } else if (over > 0.f) {
            gain_db = over * (1.f/c->ratio - 1.f);
        } else {
            gain_db = 0.f;
        }

        float coef = gain_db < c->env_db ? c->attack_coef : c->release_coef;
        c->env_db = coef * c->env_db + (1.f - coef) * gain_db;

        buf[i] *= db_to_lin(c->env_db) * c->makeup_lin;
    }
}

// ── Saturation ────────────────────────────────────────────────────────────────

// mode: 0=tube, 1=tape, 2=warm, 3=soft_clip
EMSCRIPTEN_KEEPALIVE
void sat_process(float* buf, int n, int mode, float drive, float mix) {
    float k   = drive * 0.1f;
    float wet = mix * 0.01f;
    float dry = 1.f - wet;

    for (int i = 0; i < n; ++i) {
        float x = buf[i];
        float y;
        switch (mode) {
            case 0: { // tube
                float denom = 3.14159265f + k * fabsf(x);
                y = (3.14159265f + k) * x / (denom > 1e-9f ? denom : 1e-9f);
                break;
            }
            case 1: { // tape — tanh
                float kx = k * x;
                float th = k > 1e-6f ? tanhf(kx) / tanhf(k) : x;
                y = th;
                break;
            }
            case 2: { // warm — power
                y = x < 0.f ? -powf(-x, 0.7f) : powf(x, 0.7f);
                break;
            }
            case 3: { // soft clip — cubic
                float cx = clamp(x, -1.f, 1.f);
                y = 1.5f * cx - 0.5f * cx * cx * cx;
                break;
            }
            default:
                y = x;
        }
        buf[i] = dry * x + wet * y;
    }
}

// ── De-Esser ─────────────────────────────────────────────────────────────────
// Uses a BPF sidechain: if sidechain energy > threshold, apply gain reduction

struct DeEsser {
    Biquad sc_filter;   // sidechain bandpass
    float  threshold_lin;
    float  reduction_lin;
    float  env;
    float  release_coef;

    void set(float freq, float q, float thr_db, float red_db, float sr) {
        biquad_set_bandpass(&sc_filter, freq, q, sr);
        threshold_lin = db_to_lin(thr_db - 40.f); // normalised sensitivity
        reduction_lin = db_to_lin(-fabsf(red_db));
        release_coef  = expf(-1.f / (80.f * sr * 0.001f));
        env = 0.f;
    }
};

EMSCRIPTEN_KEEPALIVE
DeEsser* deesser_alloc() { return new DeEsser{}; }

EMSCRIPTEN_KEEPALIVE
void deesser_free(DeEsser* d) { delete d; }

EMSCRIPTEN_KEEPALIVE
void deesser_set(DeEsser* d, float freq, float q, float thr, float red, float sr) {
    d->set(freq, q, thr, red, sr);
}

EMSCRIPTEN_KEEPALIVE
void deesser_process(DeEsser* d, float* buf, int n) {
    for (int i = 0; i < n; ++i) {
        // sidechain: run sample through BPF
        float sc = biquad_tick(&d->sc_filter, buf[i]);
        float sc_abs = fabsf(sc);
        // envelope
        if (sc_abs > d->env) d->env = sc_abs;
        else                  d->env = d->release_coef * d->env;

        // apply reduction if over threshold
        float gain = 1.f;
        if (d->env > d->threshold_lin) {
            float over = d->env / d->threshold_lin; // 1..inf
            gain = 1.f - (1.f - d->reduction_lin) * clamp((over - 1.f), 0.f, 1.f);
        }
        buf[i] *= gain;
    }
}

// ── Stereo Width ──────────────────────────────────────────────────────────────
// M/S encoding: M=(L+R)*0.5, S=(L-R)*0.5 * width, then decode

EMSCRIPTEN_KEEPALIVE
void width_process(float* left, float* right, int n, float width) {
    for (int i = 0; i < n; ++i) {
        float m = (left[i] + right[i]) * 0.5f;
        float s = (left[i] - right[i]) * 0.5f * width;
        left[i]  = m + s;
        right[i] = m - s;
    }
}

// ── Limiter (lookahead brickwall) ─────────────────────────────────────────────
// Simple peak limiter with attack/release envelope

struct Limiter {
    float ceiling_lin;
    float release_coef;
    float env;

    void set(float ceiling_db, float rel_ms, float sr) {
        ceiling_lin  = db_to_lin(ceiling_db);
        release_coef = expf(-1.f / (rel_ms * sr * 0.001f));
        env = 1.f;
    }
};

EMSCRIPTEN_KEEPALIVE
Limiter* limiter_alloc() { return new Limiter{}; }

EMSCRIPTEN_KEEPALIVE
void limiter_free(Limiter* l) { delete l; }

EMSCRIPTEN_KEEPALIVE
void limiter_set(Limiter* l, float ceil, float rel, float sr) {
    l->set(ceil, rel, sr);
}

EMSCRIPTEN_KEEPALIVE
void limiter_process(Limiter* l, float* buf, int n) {
    for (int i = 0; i < n; ++i) {
        float peak = fabsf(buf[i]);
        float gain_needed = peak > l->ceiling_lin ? l->ceiling_lin / peak : 1.f;
        if (gain_needed < l->env) l->env = gain_needed;
        else                       l->env = l->release_coef * l->env + (1.f - l->release_coef) * gain_needed;
        buf[i] *= l->env;
    }
}

} // extern "C"
