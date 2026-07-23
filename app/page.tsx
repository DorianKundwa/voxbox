"use client";

import { DropZone } from "@/components/upload/DropZone";
import { WaveformView } from "@/components/upload/WaveformView";
import { ChainRack } from "@/components/chain/ChainRack";
import { SpectrumAnalyzer } from "@/components/analyzer/SpectrumAnalyzer";
import { FeaturePanel } from "@/components/analyzer/FeaturePanel";
import { AIReasoningPanel } from "@/components/analyzer/AIReasoningPanel";
import { ABMonitor } from "@/components/monitor/ABMonitor";
import { ExportPanel } from "@/components/export/ExportPanel";
import { useAudioStore } from "@/store/audioStore";
import { useChainStore } from "@/store/chainStore";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Animated VoxBox logo mark */}
      <div style={{ position: "relative", width: 36, height: 36 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
          boxShadow: "0 0 20px rgba(124,58,237,0.5)",
          animation: "pulse-glow 2s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          🎤
        </div>
      </div>
      <div>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
          background: "linear-gradient(90deg, #a060ff, #06b6d4)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          VoxBox
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: -2 }}>
          AI Vocal Chain Matching
        </div>
      </div>
    </div>
  );
}

function PipelineBadge({ step, label, color }: { step: number; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: `${color}20`, border: `1px solid ${color}60`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color, flexShrink: 0,
      }}>
        {step}
      </div>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

export default function VoxBoxPage() {
  const { referenceUrl, dryUrl, isPlaying, monitorMode } = useAudioStore();
  const { resetChain } = useChainStore();

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--void-900)",
      backgroundImage: "radial-gradient(ellipse at 15% 10%, rgba(124,58,237,0.10) 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(6,182,212,0.07) 0%, transparent 55%)",
    }}>
      {/* ── Top Nav ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(6,6,8,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "0 24px",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo />

        {/* Pipeline steps */}
        <div style={{ display: "none", alignItems: "center", gap: 16 }}>
          <PipelineBadge step={1} label="Upload" color="#7c3aed" />
          <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <PipelineBadge step={2} label="Analyze" color="#06b6d4" />
          <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <PipelineBadge step={3} label="Match" color="#39ff14" />
          <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <PipelineBadge step={4} label="Export" color="#ff6600" />
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--text-secondary)", textDecoration: "none" }}
          >
            API Docs ↗
          </a>
          <button className="btn-ghost" onClick={resetChain} style={{ fontSize: 11 }}>
            Reset Chain
          </button>
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.2)",
            fontSize: 10, fontWeight: 700, color: "#39ff14",
            letterSpacing: "0.05em",
          }}>
            BETA
          </div>
        </div>
      </nav>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 20px 40px" }}>

        {/* ── Row 1: Spectrum + Monitor ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              ⚡ Real-Time Spectrum
            </div>
            <SpectrumAnalyzer height={80} />
          </div>
          <ABMonitor />
        </div>

        {/* ── Row 2: Upload + Waveforms ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="glass p-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DropZone type="reference" />
            <WaveformView
              url={referenceUrl}
              label="Reference Vocal"
              color="#7c3aed"
              isPlaying={isPlaying && monitorMode === "reference"}
            />
          </div>
          <div className="glass p-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DropZone type="dry" />
            <WaveformView
              url={dryUrl}
              label="Dry Vocal"
              color="#06b6d4"
              isPlaying={isPlaying && (monitorMode === "dry" || monitorMode === "processed")}
            />
          </div>
        </div>

        {/* ── Row 3: Main Content (Chain | Analysis Sidebar) ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12 }}>

          {/* Left: Chain Rack */}
          <div>
            <ChainRack />
          </div>

          {/* Right: Analysis sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* AI Reasoning */}
            <AIReasoningPanel />

            {/* Feature Comparison */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Feature Analysis
              </div>
              <FeaturePanel />
            </div>

            {/* Export */}
            <ExportPanel />

            {/* MIDI hint */}
            <div className="glass p-3" style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>🎛 MIDI Learn</div>
              <strong style={{ color: "#ffdd00" }}>Right-click</strong> any knob to enter MIDI learn mode.
              Move a controller knob — it maps automatically.
              Mappings are saved to your browser.
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan line animation ───────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.005) 0px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}
