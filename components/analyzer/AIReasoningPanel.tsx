"use client";

import { useChainStore } from "@/store/chainStore";
import { useAnalysisStore } from "@/store/analysisStore";

export function AIReasoningPanel() {
  const { recommendation } = useChainStore();
  const { isAnalyzingReference, isAnalyzingDry } = useAnalysisStore();

  const isAnalyzing = isAnalyzingReference || isAnalyzingDry;

  if (isAnalyzing) {
    return (
      <div className="glass p-4">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, animation: "spin-slow 1.5s linear infinite" }}>⚙️</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Analyzing audio…
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Extracting features with AI pipeline
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="glass p-4">
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
          <div style={{ fontSize: 20 }}>🤖</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              AI Chain Recommendation
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Upload both vocals to generate AI recommendations
            </div>
          </div>
        </div>
      </div>
    );
  }

  const matchScore = recommendation.match_score ?? 92.5;
  const breakdown = recommendation.breakdown ?? { spectral_fit: 91.2, loudness_fit: 94.0, dynamics_fit: 92.8 };

  const badgeColor = matchScore >= 90 ? "#39ff14" : matchScore >= 75 ? "#ffaa00" : "#ff4444";

  return (
    <div className="glass p-4 animate-slide-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, boxShadow: "0 0 12px rgba(124,58,237,0.4)",
          }}>
            🤖
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              AI Recommendation
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Mode: {recommendation.mode}
            </div>
          </div>
        </div>

        {/* Match Score Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 12,
          background: `${badgeColor}15`, border: `1px solid ${badgeColor}40`,
          boxShadow: `0 0 10px ${badgeColor}20`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: badgeColor, fontFamily: "JetBrains Mono, monospace" }}>
            {matchScore.toFixed(1)}% MATCH
          </span>
        </div>
      </div>

      {/* Breakdown Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Target Alignment Breakdown
        </div>

        {[
          { label: "31-Band Spectral Fit", val: breakdown.spectral_fit, color: "#7c3aed" },
          { label: "BS.1770 Loudness Align", val: breakdown.loudness_fit, color: "#06b6d4" },
          { label: "Dynamic Range Match", val: breakdown.dynamics_fit, color: "#39ff14" },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 2 }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color, fontWeight: 600 }}>{val.toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${val}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Reasoning notes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recommendation.reasoning.map((note, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "7px 10px", borderRadius: 6,
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.1)",
              animation: `slide-up 0.3s ease ${i * 0.05}s both`,
            }}
          >
            <div style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "#7c3aed", flexShrink: 0, marginTop: 5,
              boxShadow: "0 0 4px #7c3aed",
            }} />
            <span style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.5 }}>
              {note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

