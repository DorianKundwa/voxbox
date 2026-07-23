"""
Audio feature extractor using librosa + numpy + scipy.
Extracts a comprehensive set of vocal features for AI chain matching.
"""

import numpy as np
import librosa
import scipy.signal as signal
import scipy.signal.windows as windows
if not hasattr(signal, "hann"):
    signal.hann = windows.hann

import pyloudnorm as pyln
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
    # Crest factor: ratio of peak to RMS
    crest_factor = float(20 * np.log10(peak / (rms + 1e-9)))
    # Dynamic range: loudest - quietest frame (true perceptual range)
    frame_rms = librosa.feature.rms(y=y_trimmed, frame_length=2048, hop_length=512)[0]
    frame_rms_db = 20 * np.log10(frame_rms + 1e-9)
    dynamic_range = float(np.percentile(frame_rms_db, 95) - np.percentile(frame_rms_db, 5))

    # LUFS — ITU-R BS.1770-4 via pyloudnorm (gated, K-weighted)
    meter = pyln.Meter(sr)  # creates BS.1770 meter at file sample rate
    lufs = float(meter.integrated_loudness(y_trimmed.astype(np.float64)))
    if not np.isfinite(lufs):
        lufs = -70.0  # silence / too-short signal

    # Noise floor estimate (from quietest 10% of frames)
    noise_floor = float(np.percentile(frame_rms_db, 10))

    # ── Spectral Features (power spectrogram for accuracy) ───────────────────
    stft_mag = np.abs(librosa.stft(y_trimmed, n_fft=2048, hop_length=512))
    stft = stft_mag ** 2  # power spectrogram
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)

    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(S=stft_mag, sr=sr)))
    spectral_rolloff  = float(np.mean(librosa.feature.spectral_rolloff(S=stft_mag, sr=sr)))
    spectral_flux     = float(np.mean(np.diff(stft_mag, axis=1) ** 2))
    spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(S=stft_mag, sr=sr)))

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
    # voiced_flag is always a numpy bool array from pyin
    voiced_f0 = f0[voiced_flag] if (voiced_flag is not None and voiced_flag.any()) else np.array([])
    voiced_f0 = voiced_f0[~np.isnan(voiced_f0)]  # strip any remaining NaN
    pitch_mean     = float(np.mean(voiced_f0))    if len(voiced_f0) > 0 else 0.0
    pitch_variance = float(np.std(voiced_f0))     if len(voiced_f0) > 0 else 0.0
    voiced_ratio   = float(np.sum(voiced_flag) / len(voiced_flag)) if (voiced_flag is not None and len(voiced_flag) > 0) else 0.0

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
    try:
        tempo, _ = librosa.beat.beat_track(y=y_trimmed, sr=sr)
        bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    except Exception:
        bpm = 120.0

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


def _estimate_reverb(y: np.ndarray, sr: int) -> float:
    """
    Estimate reverb tail length via normalized autocorrelation decay.
    Returns a 0-1 score.
    """
    tail_start = int(len(y) * 0.8)
    tail = y[tail_start:]
    if len(tail) < 1024:
        return 0.0
    rms_tail = float(np.sqrt(np.mean(tail ** 2)))
    rms_full = float(np.sqrt(np.mean(y ** 2)))
    ratio = rms_tail / (rms_full + 1e-9)
    return float(min(1.0, ratio * 5.0))
