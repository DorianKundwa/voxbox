"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import type { VocalFeatures } from "@/lib/types";

const DISPLAY_FEATURES: { key: keyof VocalFeatures; label: string; unit: string; fmt?: (v: any) => string }[] = [
  { key: "lufs",             label: "LUFS",          unit: " dB" },
  { key: "peak",             label: "Peak",          unit: " dB" },
  { key: "dynamic_range",    label: "Dynamic Range", unit: " dB" },
  { key: "spectral_centroid",label: "Brightness",    unit: " Hz", fmt: (v) => `${Math.round(v)} Hz` },
  { key: "sibilance",        label: "Sibilance",     unit: "", fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "harmonic_ratio",   label: "Harmonicity",   unit: "", fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "reverb_tail",      label: "Reverb",        unit: "", fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "compression_amount", label: "Compression", unit: "", fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "pitch_variance",   label: "Pitch Var",     unit: " ¢" },
  { key: "noise_floor",      label: "Noise Floor",   unit: " dB" },
  { key: "bpm",              label: "BPM",           unit: "", fmt: (v) => v > 0 ? `${v.toFixed(1)}` : "—" },
  { key: "key",              label: "Key",           unit: "", fmt: (v) => String(v) },
];

function FeatureRow({
  label, refVal, dryVal, unit, fmt,
}: {
  label: string; refVal: any; dryVal: any; unit: string; fmt?: (v: any) => string;
}) {
  const fmtVal = (v: any) => (fmt ? fmt(v) : typeof v === "number" ? v.toFixed(1) + unit : String(v));
  const diff = typeof refVal === "number" && typeof dryVal === "number" ? refVal - dryVal : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px", gap: 4, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#be93ff", textAlign: "center" }}>
        {refVal !== undefined && refVal !== null ? fmtVal(refVal) : "—"}
      </span>
      <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#67e8f9", textAlign: "center" }}>
        {dryVal !== undefined && dryVal !== null ? fmtVal(dryVal) : "—"}
      </span>
      {diff !== null && (
        <span style={{
          fontSize: 10, fontFamily: "JetBrains Mono, monospace", textAlign: "right",
          color: Math.abs(diff) < 0.5 ? "rgba(255,255,255,0.3)" : diff > 0 ? "#39ff14" : "#ff6600",
          fontWeight: 600,
        }}>
          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function FeaturePanel() {
  const { referenceFeatures: ref, dryFeatures: dry, isAnalyzingReference, isAnalyzingDry } = useAnalysisStore();

  const isLoading = isAnalyzingReference || isAnalyzingDry;

  return (
    <div className="glass p-4">
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px", gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Feature</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#be93ff", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Reference</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Dry</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Δ</span>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 20, animation: "spin-slow 1.5s linear infinite", display: "inline-block" }}>⚙️</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
            {isAnalyzingReference ? "Analyzing reference vocal…" : "Analyzing dry vocal…"}
          </div>
        </div>
      )}

      {!isLoading && !ref && !dry && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)", fontSize: 12 }}>
          Upload audio files to see feature analysis
        </div>
      )}

      {!isLoading && (ref || dry) && DISPLAY_FEATURES.map(({ key, label, unit, fmt }) => (
        <FeatureRow
          key={key}
          label={label}
          refVal={ref ? (ref as any)[key] : undefined}
          dryVal={dry ? (dry as any)[key] : undefined}
          unit={unit}
          fmt={fmt}
        />
      ))}

      {/* Frequency Balance bars */}
      {(ref || dry) && !isLoading && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Frequency Balance
          </div>
          {(["sub_bass", "bass", "low_mid", "mid", "high_mid", "presence", "air"] as const).map((band) => {
            const refV = ref?.freq_balance?.[band] ?? 0;
            const dryV = dry?.freq_balance?.[band] ?? 0;
            const label = band.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={band} style={{ marginBottom: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                </div>
                <div style={{ display: "flex", gap: 2, height: 5, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${refV * 100}%`, background: "#7c3aed", borderRadius: 2, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${dryV * 100}%`, background: "#06b6d4", borderRadius: 2, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#7c3aed" }} />
              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Ref</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#06b6d4" }} />
              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Dry</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
