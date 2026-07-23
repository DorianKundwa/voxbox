import { create } from "zustand";
import type { VocalFeatures } from "@/lib/types";

export type MonitorMode = "reference" | "dry" | "processed";

interface AudioStore {
  referenceFile: File | null;
  dryFile: File | null;
  referenceUrl: string | null;
  dryUrl: string | null;

  isPlaying: boolean;
  monitorMode: MonitorMode;
  isLooping: boolean;
  masterVolume: number;
  outputLevel: number;   // -60 to 0 dB (live meter)

  setReferenceFile: (file: File) => void;
  setDryFile: (file: File) => void;
  clearFiles: () => void;

  setPlaying: (v: boolean) => void;
  setMonitorMode: (mode: MonitorMode) => void;
  toggleLoop: () => void;
  setMasterVolume: (v: number) => void;
  setOutputLevel: (v: number) => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  referenceFile: null,
  dryFile: null,
  referenceUrl: null,
  dryUrl: null,

  isPlaying: false,
  monitorMode: "dry",
  isLooping: false,
  masterVolume: 0.85,
  outputLevel: -60,

  setReferenceFile: (file) => {
    const prev = get().referenceUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ referenceFile: file, referenceUrl: URL.createObjectURL(file) });
  },

  setDryFile: (file) => {
    const prev = get().dryUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ dryFile: file, dryUrl: URL.createObjectURL(file) });
  },

  clearFiles: () => {
    const { referenceUrl, dryUrl } = get();
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    if (dryUrl) URL.revokeObjectURL(dryUrl);
    set({ referenceFile: null, dryFile: null, referenceUrl: null, dryUrl: null });
  },

  setPlaying: (v) => set({ isPlaying: v }),
  setMonitorMode: (mode) => set({ monitorMode: mode }),
  toggleLoop: () => set((s) => ({ isLooping: !s.isLooping })),
  setMasterVolume: (v) => set({ masterVolume: v }),
  setOutputLevel: (v) => set({ outputLevel: v }),
}));
