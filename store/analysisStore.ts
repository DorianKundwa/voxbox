import { create } from "zustand";
import type { VocalFeatures } from "@/lib/types";

interface AnalysisStore {
  referenceFeatures: VocalFeatures | null;
  dryFeatures: VocalFeatures | null;
  isAnalyzingReference: boolean;
  isAnalyzingDry: boolean;
  analysisError: string | null;
  lastAnalyzedAt: number | null;

  setReferenceFeatures: (f: VocalFeatures) => void;
  setDryFeatures: (f: VocalFeatures) => void;
  setAnalyzingReference: (v: boolean) => void;
  setAnalyzingDry: (v: boolean) => void;
  setError: (e: string | null) => void;
  clearAnalysis: () => void;

  // Computed: difference between reference and dry
  getDeltas: () => Partial<Record<keyof VocalFeatures, number>> | null;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  referenceFeatures: null,
  dryFeatures: null,
  isAnalyzingReference: false,
  isAnalyzingDry: false,
  analysisError: null,
  lastAnalyzedAt: null,

  setReferenceFeatures: (f) =>
    set({ referenceFeatures: f, lastAnalyzedAt: Date.now(), analysisError: null }),

  setDryFeatures: (f) =>
    set({ dryFeatures: f, lastAnalyzedAt: Date.now(), analysisError: null }),

  setAnalyzingReference: (v) => set({ isAnalyzingReference: v }),
  setAnalyzingDry: (v) => set({ isAnalyzingDry: v }),
  setError: (e) => set({ analysisError: e }),

  clearAnalysis: () =>
    set({ referenceFeatures: null, dryFeatures: null, analysisError: null }),

  getDeltas: () => {
    const { referenceFeatures: ref, dryFeatures: dry } = get();
    if (!ref || !dry) return null;

    const numericKeys: (keyof VocalFeatures)[] = [
      "lufs", "peak", "rms_db", "dynamic_range", "crest_factor", "noise_floor",
      "spectral_centroid", "spectral_rolloff", "spectral_flux", "spectral_bandwidth",
      "sibilance", "pitch_mean", "pitch_variance", "voiced_ratio",
      "harmonic_ratio", "transient_response", "compression_amount",
      "saturation_amount", "reverb_tail", "stereo_width", "bpm",
    ];

    const deltas: Partial<Record<keyof VocalFeatures, number>> = {};
    for (const k of numericKeys) {
      const rv = ref[k] as number;
      const dv = dry[k] as number;
      if (typeof rv === "number" && typeof dv === "number") {
        deltas[k] = rv - dv;
      }
    }
    return deltas;
  },
}));
