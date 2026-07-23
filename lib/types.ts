// Audio feature types shared between frontend and backend
export interface FreqBalance {
  sub_bass: number;
  bass: number;
  low_mid: number;
  mid: number;
  high_mid: number;
  presence: number;
  air: number;
}

export interface VocalFeatures {
  duration: number;
  bpm: number;
  key: string;
  // Loudness
  lufs: number;
  peak: number;
  rms_db: number;
  dynamic_range: number;
  crest_factor: number;
  noise_floor: number;
  // Spectral
  spectral_centroid: number;
  spectral_rolloff: number;
  spectral_flux: number;
  spectral_bandwidth: number;
  freq_balance: FreqBalance;
  sibilance: number;
  // Pitch
  pitch_mean: number;
  pitch_variance: number;
  voiced_ratio: number;
  // Texture
  harmonic_ratio: number;
  transient_response: number;
  compression_amount: number;
  saturation_amount: number;
  reverb_tail: number;
  stereo_width: number;
  // MFCC
  mfcc_mean: number[];
  mfcc_std: number[];
}

export interface EQBand {
  id: string;
  type: "highpass" | "lowpass" | "lowshelf" | "highshelf" | "peaking" | "notch";
  frequency: number;
  gain: number;
  q: number;
  enabled: boolean;
}

export interface NoiseGateParams {
  enabled: boolean;
  threshold: number;   // dB
  attack: number;      // ms
  release: number;     // ms
  hold: number;        // ms
}

export interface DeEsserParams {
  enabled: boolean;
  center_frequency: number;
  bandwidth: number;
  reduction: number;   // dB
  sensitivity: number; // 0-1
}

export interface PitchCorrectionParams {
  enabled: boolean;
  key: string;
  scale: "major" | "minor" | "chromatic";
  retune_speed: number;  // ms
  humanize: number;      // 0-1
  amount: number;        // 0-1
}

export interface EQParams {
  enabled: boolean;
  bands: EQBand[];
}

export interface CompBandParams {
  crossover?: number;
  crossover_low?: number;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeup: number;
}

export interface MultibandCompParams {
  enabled: boolean;
  low: CompBandParams;
  mid: CompBandParams;
  high: CompBandParams;
}

export interface CompressorParams {
  enabled: boolean;
  threshold: number;  // dB
  ratio: number;
  attack: number;     // ms
  release: number;    // ms
  makeup: number;     // dB
  knee: number;       // dB
}

export interface SaturationParams {
  enabled: boolean;
  mode: "tube" | "tape" | "warm" | "soft_clip";
  drive: number;   // 0-100
  tone: number;    // 0-100
  mix: number;     // 0-100
}

export interface DoublerParams {
  enabled: boolean;
  width: number;        // 0-1
  micro_delay: number;  // ms
  detune: number;       // cents
  mix: number;          // 0-100
}

export interface DelayParams {
  enabled: boolean;
  time_ms: number;
  sync: string;
  feedback: number;  // 0-100
  damping: number;   // 0-100
  mix: number;       // 0-100
}

export interface ReverbParams {
  enabled: boolean;
  type: "room" | "hall" | "plate";
  predelay: number;  // ms
  decay: number;     // seconds
  damping: number;   // 0-100
  mix: number;       // 0-100
}

export interface LimiterParams {
  enabled: boolean;
  ceiling: number;    // dBFS
  threshold: number;  // dBFS
  lookahead: number;  // ms
  release: number;    // ms
}

export interface ChainModules {
  noise_gate: NoiseGateParams;
  deesser: DeEsserParams;
  pitch_correction: PitchCorrectionParams;
  eq: EQParams;
  multiband_comp: MultibandCompParams;
  compressor: CompressorParams;
  saturation: SaturationParams;
  doubler: DoublerParams;
  delay: DelayParams;
  reverb: ReverbParams;
  limiter: LimiterParams;
}

export type ModuleKey = keyof ChainModules;

export interface MatchBreakdown {
  spectral_fit: number;   // 0-100%
  loudness_fit: number;   // 0-100%
  dynamics_fit: number;   // 0-100%
}

export interface ChainRecommendation {
  mode: string;
  match_score: number;    // 0-100%
  breakdown: MatchBreakdown;
  reasoning: string[];
  modules: ChainModules;
  target_spectrum?: number[]; // 31-band normalized target power
}

