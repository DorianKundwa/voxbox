import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChainModules, ModuleKey, ChainRecommendation, EQBand
} from "@/lib/types";

const DEFAULT_CHAIN: ChainModules = {
  noise_gate: {
    enabled: false, threshold: -50, attack: 5, release: 150, hold: 50,
  },
  deesser: {
    enabled: false, center_frequency: 7500, bandwidth: 2000, reduction: 6, sensitivity: 0.5,
  },
  pitch_correction: {
    enabled: false, key: "C", scale: "major", retune_speed: 80, humanize: 0.6, amount: 0.5,
  },
  eq: {
    enabled: true,
    bands: [
      { id: "low_cut",   type: "highpass",  frequency: 80,    gain: 0,   q: 0.707, enabled: true },
      { id: "low",       type: "lowshelf",  frequency: 200,   gain: 0,   q: 0.707, enabled: true },
      { id: "low_mid",   type: "peaking",   frequency: 800,   gain: 0,   q: 1.0,   enabled: true },
      { id: "high_mid",  type: "peaking",   frequency: 3500,  gain: 0,   q: 1.2,   enabled: true },
      { id: "high_shelf",type: "highshelf", frequency: 10000, gain: 0,   q: 0.707, enabled: true },
    ],
  },
  multiband_comp: {
    enabled: false,
    low:  { crossover: 250,  threshold: -24, ratio: 2.0, attack: 10, release: 80, makeup: 2 },
    mid:  { crossover: 3000, threshold: -20, ratio: 2.5, attack: 5,  release: 50, makeup: 3 },
    high: { crossover_low: 3000, threshold: -22, ratio: 2.0, attack: 3, release: 40, makeup: 2 },
  },
  compressor: {
    enabled: true, threshold: -18, ratio: 3.0, attack: 8, release: 100, makeup: 4, knee: 3,
  },
  saturation: {
    enabled: false, mode: "tube", drive: 15, tone: 50, mix: 30,
  },
  doubler: {
    enabled: false, width: 0.5, micro_delay: 12, detune: 8, mix: 40,
  },
  delay: {
    enabled: true, time_ms: 250, sync: "1/8", feedback: 20, damping: 60, mix: 12,
  },
  reverb: {
    enabled: true, type: "plate", predelay: 20, decay: 1.6, damping: 60, mix: 18,
  },
  limiter: {
    enabled: true, ceiling: -0.3, threshold: -1.0, lookahead: 5, release: 100,
  },
};

const MODULE_ORDER: ModuleKey[] = [
  "noise_gate", "deesser", "pitch_correction", "eq",
  "multiband_comp", "compressor", "saturation", "doubler",
  "delay", "reverb", "limiter",
];

interface ChainStore {
  modules: ChainModules;
  moduleOrder: ModuleKey[];
  recommendation: ChainRecommendation | null;

  setParam: <M extends ModuleKey, K extends keyof ChainModules[M]>(
    module: M, param: K, value: ChainModules[M][K]
  ) => void;

  setEQBand: (bandId: string, partial: Partial<EQBand>) => void;
  toggleModule: (module: ModuleKey) => void;
  applyRecommendation: (rec: ChainRecommendation) => void;
  setModuleOrder: (order: ModuleKey[]) => void;
  resetChain: () => void;
  exportJSON: () => string;
}

export const useChainStore = create<ChainStore>()(
  persist(
    (set, get) => ({
      modules: DEFAULT_CHAIN,
      moduleOrder: MODULE_ORDER,
      recommendation: null,

      setParam: (module, param, value) =>
        set((state) => ({
          modules: {
            ...state.modules,
            [module]: { ...state.modules[module], [param]: value },
          },
        })),

      setEQBand: (bandId, partial) =>
        set((state) => ({
          modules: {
            ...state.modules,
            eq: {
              ...state.modules.eq,
              bands: state.modules.eq.bands.map((b) =>
                b.id === bandId ? { ...b, ...partial } : b
              ),
            },
          },
        })),

      toggleModule: (module) =>
        set((state) => ({
          modules: {
            ...state.modules,
            [module]: {
              ...state.modules[module],
              enabled: !(state.modules[module] as any).enabled,
            },
          },
        })),

      applyRecommendation: (rec) =>
        set(() => ({
          modules: rec.modules,
          recommendation: rec,
        })),

      setModuleOrder: (order) => set({ moduleOrder: order }),

      resetChain: () =>
        set({ modules: DEFAULT_CHAIN, recommendation: null }),

      exportJSON: () => {
        const { modules, recommendation } = get();
        return JSON.stringify({ modules, recommendation, version: "1.0.0" }, null, 2);
      },
    }),
    { name: "voxbox-chain" }
  )
);
