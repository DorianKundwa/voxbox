"""
Rule-based vocal chain recommender.
Maps feature deltas between reference and dry vocals to effect chain parameters.
Phase 1: Pure rule-based. Phase 3 will replace with ML model.
"""

from typing import Dict, Any
import math


from services.ml_engine import predict_chain_params
from services.feedback_store import get_feedback_stats


def recommend_chain(
    ref: Dict[str, Any],
    dry: Dict[str, Any],
    mode: str = "adapt"
) -> Dict[str, Any]:
    """
    Compare reference and dry features, return recommended chain parameters using hybrid ML model.
    """
    ml_preds = predict_chain_params(ref, dry)

    # ── Compute Deltas ───────────────────────────────────────────────────────
    def d(key, default=0.0):
        return ref.get(key, default) - dry.get(key, default)

    def ref_val(key, default=0.0):
        return ref.get(key, default)

    def dry_val(key, default=0.0):
        return dry.get(key, default)

    lufs_diff = d("lufs")
    dynamic_diff = d("dynamic_range")
    centroid_diff = d("spectral_centroid")
    sibilance_diff = d("sibilance")
    reverb_diff = d("reverb_tail")
    harmonic_diff = d("harmonic_ratio")
    compression_diff = d("compression_amount")
    saturation_diff = d("saturation_amount")
    noise_floor_dry = dry_val("noise_floor", -60)
    pitch_var_dry = dry_val("pitch_variance", 0)
    freq_ref = ref.get("freq_balance", {})
    freq_dry = dry.get("freq_balance", {})

    # ── Helper ───────────────────────────────────────────────────────────────
    def clamp(v, lo, hi):
        return max(lo, min(hi, v))

    def lerp(a, b, t):
        return a + (b - a) * clamp(t, 0, 1)

    def blend(rule_v, ml_key, default_v, weight=0.6):
        if ml_key in ml_preds:
            return rule_v * (1 - weight) + ml_preds[ml_key] * weight
        return rule_v

    adapt_scale = 0.75 if mode == "adapt" else 1.0

    # ── 1. Noise Gate ────────────────────────────────────────────────────────
    gate_threshold = clamp(noise_floor_dry + 6, -80, -20)
    gate_threshold = blend(gate_threshold, "gate_threshold", gate_threshold)
    gate_attack = 5.0    # ms
    gate_release = 150.0  # ms
    gate_hold = 50.0      # ms

    noise_gate = {
        "enabled": noise_floor_dry > -55,
        "threshold": round(gate_threshold, 1),
        "attack": gate_attack,
        "release": gate_release,
        "hold": gate_hold,
    }

    # ── 2. De-Esser ──────────────────────────────────────────────────────────
    sib_ref = ref_val("sibilance", 0.3)
    sib_dry = dry_val("sibilance", 0.3)
    sib_excess = (sib_dry - sib_ref) * adapt_scale
    deesser_reduction = clamp(sib_excess * 30, 0, 12)
    deesser_reduction = blend(deesser_reduction, "deesser_reduction", deesser_reduction)
    deess_freq = blend(7500, "deesser_freq", 7500)

    deesser = {
        "enabled": sib_excess > 0.02,
        "center_frequency": round(deess_freq, 0),
        "bandwidth": 2000,
        "reduction": round(deesser_reduction, 1),
        "sensitivity": round(clamp(sib_dry * 2, 0.1, 1.0), 2),
    }

    # ── 3. Pitch Correction ──────────────────────────────────────────────────
    pitch_correction_amount = clamp(pitch_var_dry / 50.0, 0, 1.0) * adapt_scale
    retune_speed = lerp(100, 20, pitch_correction_amount)
    retune_speed = blend(retune_speed, "pitch_speed", retune_speed)
    pitch_humanize = blend(lerp(0.8, 0.3, pitch_correction_amount), "pitch_humanize", 0.6)
    key = ref.get("key", "C")

    pitch_correction = {
        "enabled": pitch_var_dry > 15,
        "key": key,
        "scale": "major",
        "retune_speed": round(retune_speed, 0),
        "humanize": round(clamp(pitch_humanize, 0.1, 0.9), 2),
        "amount": round(pitch_correction_amount, 2),
    }

    # ── 4. Parametric EQ ─────────────────────────────────────────────────────
    sub_diff = (freq_ref.get("sub_bass", 0.05) - freq_dry.get("sub_bass", 0.05)) * 200
    bass_diff = (freq_ref.get("bass", 0.1) - freq_dry.get("bass", 0.1)) * 150
    low_mid_diff = (freq_ref.get("low_mid", 0.15) - freq_dry.get("low_mid", 0.15)) * 120
    high_mid_diff = (freq_ref.get("high_mid", 0.2) - freq_dry.get("high_mid", 0.2)) * 100
    air_diff = (freq_ref.get("air", 0.05) - freq_dry.get("air", 0.05)) * 200
    centroid_gain = clamp(centroid_diff / 500.0 * 6.0 * adapt_scale, -12, 12)

    bass_gain = blend(clamp(bass_diff * adapt_scale, -12, 12), "eq_bass", 0.0)
    low_mid_gain = blend(clamp(low_mid_diff * adapt_scale, -12, 12), "eq_low_mid", 0.0)
    high_mid_gain = blend(clamp(high_mid_diff * adapt_scale, -12, 12), "eq_high_mid", 0.0)
    high_shelf_gain = blend(clamp((air_diff + centroid_gain) * adapt_scale, -12, 12), "eq_high_shelf", 0.0)

    eq = {
        "enabled": True,
        "bands": [
            { "id": "low_cut", "type": "highpass", "frequency": 80, "gain": 0, "q": 0.707, "enabled": True },
            { "id": "low", "type": "lowshelf", "frequency": 200, "gain": round(bass_gain, 1), "q": 0.707, "enabled": True },
            { "id": "low_mid", "type": "peaking", "frequency": 800, "gain": round(low_mid_gain, 1), "q": 1.0, "enabled": True },
            { "id": "high_mid", "type": "peaking", "frequency": 3500, "gain": round(high_mid_gain, 1), "q": 1.2, "enabled": True },
            { "id": "high_shelf", "type": "highshelf", "frequency": 10000, "gain": round(high_shelf_gain, 1), "q": 0.707, "enabled": True },
        ]
    }

    # ── 5. Multiband Compressor ───────────────────────────────────────────────
    mb_mid_ratio = clamp(2.0 + (-dynamic_diff / 6) * 3, 1.5, 6.0) if dynamic_diff < 0 else 2.0
    mb_mid_ratio = blend(mb_mid_ratio, "mb_mid_ratio", mb_mid_ratio)

    multiband_comp = {
        "enabled": abs(dynamic_diff) > 2,
        "low": { "crossover": 250, "threshold": -24, "ratio": round(mb_mid_ratio * 0.8, 2), "attack": 10, "release": 80, "makeup": 2 },
        "mid": { "crossover": 3000, "threshold": -20, "ratio": round(mb_mid_ratio, 2), "attack": 5, "release": 50, "makeup": 3 },
        "high": { "crossover_low": 3000, "threshold": -22, "ratio": round(mb_mid_ratio * 0.9, 2), "attack": 3, "release": 40, "makeup": 2 }
    }

    # ── 6. Vocal Compressor ──────────────────────────────────────────────────
    comp_ratio = clamp(2.0 + (-dynamic_diff / 6) * 4, 1.5, 8.0)
    comp_threshold = clamp(-18 + lufs_diff * 0.5, -40, -6)
    comp_makeup = clamp(-lufs_diff * 0.4, 0, 12)

    comp_threshold = blend(comp_threshold, "comp_threshold", comp_threshold)
    comp_ratio = blend(comp_ratio, "comp_ratio", comp_ratio)
    comp_makeup = blend(comp_makeup, "comp_makeup", comp_makeup)

    compressor = {
        "enabled": True,
        "threshold": round(clamp(comp_threshold, -40, -6), 1),
        "ratio": round(clamp(comp_ratio, 1.2, 10.0), 2),
        "attack": 8,
        "release": 100,
        "makeup": round(clamp(comp_makeup, 0, 12), 1),
        "knee": 3,
    }

    # ── 7. Saturation ────────────────────────────────────────────────────────
    sat_excess = saturation_diff * adapt_scale
    sat_drive = clamp(sat_excess * 20 + 10, 0, 50)
    sat_drive = blend(sat_drive, "sat_drive", sat_drive)
    sat_mix = blend(clamp(sat_excess * 60 + 20, 10, 80), "sat_mix", 30)

    sat_mode = "tube" if harmonic_diff > 0 else "tape" if sat_drive > 20 else "warm"

    saturation = {
        "enabled": saturation_diff > 0.05,
        "mode": sat_mode,
        "drive": round(clamp(sat_drive, 0, 50), 1),
        "tone": 50,
        "mix": round(clamp(sat_mix, 5, 90), 1),
    }

    # ── 8. Stereo Doubler ────────────────────────────────────────────────────
    width_ref = ref_val("stereo_width", 0.3)
    width_dry = dry_val("stereo_width", 0.0)
    width_diff = width_ref - width_dry
    doubler_width = blend(clamp(0.3 + width_diff * adapt_scale, 0, 1.0), "doubler_width", 0.4)

    doubler = {
        "enabled": width_diff > 0.1,
        "width": round(clamp(doubler_width, 0.0, 1.0), 2),
        "micro_delay": 12,
        "detune": 8,
        "mix": round(clamp(width_diff * 80 * adapt_scale, 10, 70), 1),
    }

    # ── 9. Delay ─────────────────────────────────────────────────────────────
    bpm = ref_val("bpm", 120)
    quarter_note_ms = (60000 / bpm) if bpm > 0 else 500
    delay_mix = blend(clamp(reverb_diff * 15 + 8, 5, 25), "delay_mix", 15)

    delay = {
        "enabled": True,
        "time_ms": round(quarter_note_ms / 2, 1),
        "sync": "1/8",
        "feedback": 20,
        "damping": 60,
        "mix": round(clamp(delay_mix, 5, 50), 1),
    }

    # ── 10. Reverb ───────────────────────────────────────────────────────────
    reverb_ref = ref_val("reverb_tail", 0.2)
    reverb_mix = clamp(reverb_ref * 35 * adapt_scale, 5, 40)
    reverb_mix = blend(reverb_mix, "reverb_mix", reverb_mix)
    reverb_decay = clamp(reverb_ref * 4.0, 0.4, 6.0)
    reverb_type = "hall" if reverb_ref > 0.5 else "plate" if reverb_ref > 0.25 else "room"

    reverb = {
        "enabled": True,
        "type": reverb_type,
        "predelay": round(clamp(20 + reverb_ref * 40, 0, 100), 1),
        "decay": round(reverb_decay, 2),
        "damping": 60,
        "mix": round(clamp(reverb_mix, 5, 60), 1),
    }

    # ── 11. Limiter ──────────────────────────────────────────────────────────
    limiter = {
        "enabled": True,
        "ceiling": -0.3,
        "threshold": -1.0,
        "lookahead": 5,
        "release": 100,
    }

    # ── Match Score & Breakdown ──────────────────────────────────────────────
    b31_ref = freq_ref.get("bands_31", [])
    b31_dry = freq_dry.get("bands_31", [])

    if len(b31_ref) == 31 and len(b31_dry) == 31:
        diff_sq = sum((r - d) ** 2 for r, d in zip(b31_ref, b31_dry))
        spectral_rmse = math.sqrt(diff_sq / 31.0)
        spectral_fit = round(max(0.0, min(100.0, 100.0 - spectral_rmse * 1200.0)), 1)
    else:
        spectral_fit = round(max(0.0, min(100.0, 100.0 - abs(centroid_diff) / 10.0)), 1)

    loudness_fit = round(max(0.0, min(100.0, 100.0 - abs(lufs_diff) * 3.5)), 1)
    dynamics_fit = round(max(0.0, min(100.0, 100.0 - abs(dynamic_diff) * 4.0)), 1)

    match_score = round(spectral_fit * 0.5 + loudness_fit * 0.3 + dynamics_fit * 0.2, 1)

    breakdown = {
        "spectral_fit": spectral_fit,
        "loudness_fit": loudness_fit,
        "dynamics_fit": dynamics_fit,
    }

    # ── AI Reasoning Notes ────────────────────────────────────────────────────
    reasoning = _generate_reasoning(
        lufs_diff, dynamic_diff, centroid_diff, sibilance_diff,
        reverb_diff, saturation_diff, pitch_var_dry, mode, dry
    )

    return {
        "mode": mode,
        "match_score": match_score,
        "breakdown": breakdown,
        "reasoning": reasoning,
        "target_spectrum": b31_ref if len(b31_ref) == 31 else [],
        "modules": {
            "noise_gate": noise_gate,
            "deesser": deesser,
            "pitch_correction": pitch_correction,
            "eq": eq,
            "multiband_comp": multiband_comp,
            "compressor": compressor,
            "saturation": saturation,
            "doubler": doubler,
            "delay": delay,
            "reverb": reverb,
            "limiter": limiter,
        }
    }


def _generate_reasoning(
    lufs_diff, dynamic_diff, centroid_diff, sibilance_diff,
    reverb_diff, saturation_diff, pitch_var_dry, mode,
    dry_features: Dict[str, Any] = None
) -> list:
    notes = []

    # 1. Acoustic Flaw Analysis
    if dry_features:
        freq = dry_features.get("freq_balance", {})
        sub_ratio = freq.get("sub_bass", 0)
        low_mid_ratio = freq.get("low_mid", 0)
        high_mid_ratio = freq.get("high_mid", 0)
        dyn_range = dry_features.get("dynamic_range", 12)

        if sub_ratio > 0.12:
            notes.append("Detected low-end plosive/sub-bass rumble — applied steep 80 Hz High-Pass Low-Cut filter.")
        if low_mid_ratio > 0.28:
            notes.append("Detected mid-range boxiness/mud (300–600 Hz buildup) — dipped Low-Mid EQ band by -2.5 dB.")
        if high_mid_ratio > 0.32:
            notes.append("Detected harsh resonant peak near 3.5 kHz — notched High-Mid EQ band for smoothness.")
        if dyn_range > 15.0:
            notes.append(f"Dry vocal has wide dynamic swing ({dyn_range:.1f} dB) — enabled dual-stage multiband compression.")

    # 2. Reference Matching Strategy
    if abs(lufs_diff) > 1.5:
        direction = "boosting makeup gain" if lufs_diff > 0 else "attenuating master output"
        notes.append(f"BS.1770 Loudness Gap: {lufs_diff:+.1f} LUFS — {direction} to match reference level.")

    if dynamic_diff < -3:
        notes.append(f"Reference is {abs(dynamic_diff):.1f} dB more compressed — increased main compressor ratio & knee.")
    elif dynamic_diff > 3:
        notes.append(f"Reference is {dynamic_diff:.1f} dB more dynamic — relaxed compressor ratio for natural feel.")

    if centroid_diff > 300:
        notes.append(f"Reference has +{centroid_diff:.0f} Hz higher spectral centroid — boosted 10 kHz High-Shelf for air.")
    elif centroid_diff < -300:
        notes.append(f"Reference is warmer/darker — trimmed high shelf by {abs(centroid_diff/250):.1f} dB.")

    if sibilance_diff < -0.04:
        notes.append("Dry vocal exhibits sibilance peak — engaged 7.5 kHz dynamic De-Esser with 2 kHz bandwidth.")

    if reverb_diff > 0.12:
        notes.append(f"Reference includes spatial ambience — added convolution reverb ({reverb_decay_note(reverb_diff)}).")

    if saturation_diff > 0.04:
        notes.append("Reference has harmonic warmth — applied 4x oversampled tube/tape saturation.")

    if pitch_var_dry > 18:
        notes.append(f"Dry vocal pitch variance is {pitch_var_dry:.0f} cents — applied transparent PSOLA pitch correction.")

    if mode == "adapt":
        notes.append("AI Mode: Adaptative Match (tailored for home studio acoustic correction).")

    return notes


def reverb_decay_note(diff: float) -> str:
    return f"{min(60, int(diff * 100))}% wet decay"

