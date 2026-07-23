"""
Audio feature extractor using librosa + numpy + scipy.
Extracts a comprehensive set of vocal features for AI chain matching.
"""

import numpy as np
import librosa
import scipy.signal as signal
from typing import Dict, Any
import warnings
warnings.filterwarnings("ignore")


def extract_features(path: str) -> Dict[str, Any]:
    """
    Full vocal feature extraction pipeline.
    Returns a dict of normalized feature values.
    """
    # Load audio (mono, 44100 Hz)
    y, sr = librosa.load(path, sr=44100, mono=True)

    # Trim silence
    y_trimmed, _ = librosa.effects.trim(y, top_db=30)
    if len(y_trimmed) < sr * 0.5:
        y_trimmed = y  # fallback if too short

    duration = librosa.get_duration(y=y_trimmed, sr=sr)

    # ── Loudness & Dynamics ──────────────────────────────────────────────────
    rms = float(np.sqrt(np.mean(y_trimmed ** 2)))
    peak = float(np.max(np.abs(y_trimmed)))
    dynamic_range = float(20 * np.log10(peak / (rms + 1e-9)))
    crest_factor = float(20 * np.log10(peak / (rms + 1e-9)))

    # LUFS approximation (ITU-R BS.1770 simplified)
    lufs = _estimate_lufs(y_trimmed, sr)

    # Noise floor estimate (from quietest 10% of frames)
    frame_rms = librosa.feature.rms(y=y_trimmed, frame_length=2048, hop_length=512)[0]
    noise_floor = float(20 * np.log10(np.percentile(frame_rms, 10) + 1e-9))

    # ── Spectral Features ────────────────────────────────────────────────────
    stft = np.abs(librosa.stft(y_trimmed, n_fft=2048, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)

    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(S=stft, sr=sr)))
    spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(S=stft, sr=sr)))
    spectral_flux = float(np.mean(np.diff(stft, axis=1) ** 2))
    spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(S=stft, sr=sr)))

    # Frequency balance: energy in bands
    def band_energy(lo, hi):
        mask = (freqs >= lo) & (freqs <= hi)
        return float(np.mean(stft[mask, :]))

    freq_balance = {
        "sub_bass": band_energy(20, 80),
        "bass": band_energy(80, 250),
        "low_mid": band_energy(250, 800),
        "mid": band_energy(800, 2500),
        "high_mid": band_energy(2500, 6000),
        "presence": band_energy(6000, 10000),
        "air": band_energy(10000, 20000),
    }

    # Normalize freq balance
    total = sum(freq_balance.values()) + 1e-9
    freq_balance = {k: v / total for k, v in freq_balance.items()}

    # ── Sibilance ────────────────────────────────────────────────────────────
    sibilance = float(band_energy(5000, 10000) / (band_energy(1000, 20000) + 1e-9))

    # ── MFCC ─────────────────────────────────────────────────────────────────
    mfcc = librosa.feature.mfcc(y=y_trimmed, sr=sr, n_mfcc=13)
    mfcc_mean = mfcc.mean(axis=1).tolist()
    mfcc_std = mfcc.std(axis=1).tolist()

    # ── Pitch ────────────────────────────────────────────────────────────────
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y_trimmed, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"),
        frame_length=2048
    )
    voiced_f0 = f0[voiced_flag] if voiced_flag is not None else f0[~np.isnan(f0)]
    pitch_mean = float(np.nanmean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
    pitch_variance = float(np.nanstd(voiced_f0)) if len(voiced_f0) > 0 else 0.0
    voiced_ratio = float(np.sum(voiced_flag) / len(voiced_flag)) if voiced_flag is not None else 0.5

    # ── Harmonics & Noise ────────────────────────────────────────────────────
    harmonic, percussive = librosa.effects.hpss(y_trimmed)
    harmonic_ratio = float(np.mean(harmonic ** 2) / (np.mean(y_trimmed ** 2) + 1e-9))

    # ── Transient Response ───────────────────────────────────────────────────
    onset_env = librosa.onset.onset_strength(y=y_trimmed, sr=sr)
    transient_response = float(np.mean(onset_env))

    # ── Compression Characteristics ─────────────────────────────────────────
    # Estimate how compressed a signal is via dynamic range ratio
    frame_rms_db = 20 * np.log10(frame_rms + 1e-9)
    compression_amount = float(1.0 - (np.std(frame_rms_db) / 30.0))
    compression_amount = max(0.0, min(1.0, compression_amount))

    # ── Reverb Estimation ────────────────────────────────────────────────────
    reverb_tail = _estimate_reverb(y_trimmed, sr)

    # ── Stereo Width ─────────────────────────────────────────────────────────
    # For mono files, width is 0
    stereo_width = 0.0  # Extended in stereo version

    # ── BPM / Tempo ──────────────────────────────────────────────────────────
    tempo, _ = librosa.beat.beat_track(y=y_trimmed, sr=sr)
    bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)

    # ── Key / Scale ──────────────────────────────────────────────────────────
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key_idx = int(np.argmax(chroma_mean))
    key_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    key = key_names[key_idx]

    # ── Saturation Estimation ────────────────────────────────────────────────
    # Estimate via THD proxy: high-frequency harmonic distortion
    saturation_amount = float(np.mean(np.abs(np.diff(y_trimmed))) / (rms + 1e-9))
    saturation_amount = min(1.0, saturation_amount)

    return {
        "duration": round(duration, 2),
        "bpm": round(bpm, 1),
        "key": key,
        # Loudness
        "lufs": round(lufs, 2),
        "peak": round(float(20 * np.log10(peak + 1e-9)), 2),
        "rms_db": round(float(20 * np.log10(rms + 1e-9)), 2),
        "dynamic_range": round(dynamic_range, 2),
        "crest_factor": round(crest_factor, 2),
        "noise_floor": round(noise_floor, 2),
        # Spectral
        "spectral_centroid": round(spectral_centroid, 1),
        "spectral_rolloff": round(spectral_rolloff, 1),
        "spectral_flux": round(spectral_flux, 6),
        "spectral_bandwidth": round(spectral_bandwidth, 1),
        "freq_balance": {k: round(v, 4) for k, v in freq_balance.items()},
        "sibilance": round(sibilance, 4),
        # Pitch
        "pitch_mean": round(pitch_mean, 1),
        "pitch_variance": round(pitch_variance, 1),
        "voiced_ratio": round(voiced_ratio, 3),
        # Texture
        "harmonic_ratio": round(harmonic_ratio, 4),
        "transient_response": round(transient_response, 4),
        "compression_amount": round(compression_amount, 4),
        "saturation_amount": round(saturation_amount, 4),
        "reverb_tail": round(reverb_tail, 4),
        "stereo_width": round(stereo_width, 4),
        # MFCC
        "mfcc_mean": [round(x, 3) for x in mfcc_mean],
        "mfcc_std": [round(x, 3) for x in mfcc_std],
    }


def _estimate_lufs(y: np.ndarray, sr: int) -> float:
    """
    Simplified ITU-R BS.1770-4 LUFS estimation (no gating for brevity).
    """
    # K-weighting filter approximation
    # Stage 1: High-shelf pre-filter
    b1, a1 = signal.bilinear(
        [1.53512485958697, -2.69169618940638, 1.19839281085285],
        [1.0, -1.69065929318241, 0.73248077421585],
        fs=sr
    )
    # Stage 2: High-pass filter
    b2, a2 = signal.bilinear(
        [1.0, -2.0, 1.0],
        [1.0, -1.99004745483398, 0.99007225036621],
        fs=sr
    )
    y_k = signal.lfilter(b1, a1, y)
    y_k = signal.lfilter(b2, a2, y_k)
    mean_sq = np.mean(y_k ** 2)
    lufs = -0.691 + 10 * np.log10(mean_sq + 1e-9)
    return float(lufs)


def _estimate_reverb(y: np.ndarray, sr: int) -> float:
    """
    Estimate reverb tail length via normalized autocorrelation decay.
    Returns a 0-1 score.
    """
    # Use last 20% of audio (where reverb tail would be most apparent)
    tail_start = int(len(y) * 0.8)
    tail = y[tail_start:]
    if len(tail) < 1024:
        return 0.0
    rms_tail = float(np.sqrt(np.mean(tail ** 2)))
    rms_full = float(np.sqrt(np.mean(y ** 2)))
    ratio = rms_tail / (rms_full + 1e-9)
    # Normalize: higher ratio = more reverb tail
    return float(min(1.0, ratio * 5.0))
