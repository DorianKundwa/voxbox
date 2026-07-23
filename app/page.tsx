"use client";

import { useState, useCallback } from "react";
import { DropZone } from "@/components/upload/DropZone";
import { WaveformView } from "@/components/upload/WaveformView";
import { ChainRack } from "@/components/chain/ChainRack";
import { SpectrumAnalyzer } from "@/components/analyzer/SpectrumAnalyzer";
import { FeaturePanel } from "@/components/analyzer/FeaturePanel";
import { AIReasoningPanel } from "@/components/analyzer/AIReasoningPanel";
import { ABMonitor } from "@/components/monitor/ABMonitor";
import { LUFSMeter } from "@/components/monitor/LUFSMeter";
import { PitchDisplay } from "@/components/monitor/PitchDisplay";
import { ExportPanel } from "@/components/export/ExportPanel";
import { PresetManager } from "@/components/preset/PresetManager";
import { MultiTrackRack } from "@/components/multitrack/MultiTrackRack";
import { ChainSync } from "@/components/chain/ChainSync";
import { useAudioStore } from "@/store/audioStore";
import { useChainStore } from "@/store/chainStore";
import { useAnalysisStore } from "@/store/analysisStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : "/api";

type Step = "idle" | "analyzing_ref" | "analyzing_dry" | "comparing" | "building" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:          "Analyze & Match",
  analyzing_ref: "Extracting reference features…",
  analyzing_dry: "Extracting dry vocal features…",
  comparing:     "Comparing audio profiles…",
  building:      "Building effect chain…",
  done:          "Chain Applied! ✓",
  error:         "Error — Try Again",
};

const STEP_ICONS: Record<Step, string> = {
  idle:          "🤖",
  analyzing_ref: "🔬",
  analyzing_dry: "🔬",
  comparing:     "📊",
  building:      "⚙️",
  done:          "✅",
  error:         "⚠️",
};

function AnalyzeButton() {
  const [step, setStep] = useState<Step>("idle");
  const { referenceFile, dryFile } = useAudioStore();
  const { applyRecommendation } = useChainStore();
  const { setReferenceFeatures, setDryFeatures, setError } = useAnalysisStore();

  const ready = !!referenceFile && !!dryFile;
  const busy  = step !== "idle" && step !== "done" && step !== "error";

  const run = useCallback(async () => {
    if (!referenceFile || !dryFile || busy) return;
    setError(null);

    try {
      // Step 1 — analyze reference
      setStep("analyzing_ref");
      const fd1 = new FormData();
      fd1.append("file", referenceFile);
      const r1 = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd1 });
      if (!r1.ok) throw new Error(await r1.text());
      const refFeatures = (await r1.json()).features;
      setReferenceFeatures(refFeatures);

      // Step 2 — analyze dry
      setStep("analyzing_dry");
      const fd2 = new FormData();
      fd2.append("file", dryFile);
      const r2 = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd2 });
      if (!r2.ok) throw new Error(await r2.text());
      const dryFeatures = (await r2.json()).features;
      setDryFeatures(dryFeatures);

      // Step 3 — compare
      setStep("comparing");
      await new Promise((r) => setTimeout(r, 400)); // brief visual pause

      // Step 4 — recommend + build chain
      setStep("building");
      const r3 = await fetch(`${API_BASE}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_features: refFeatures, dry_features: dryFeatures, mode: "adapt" }),
      });
      if (!r3.ok) throw new Error(await r3.text());
      const { chain } = await r3.json();
      applyRecommendation(chain);

      setStep("done");
      setTimeout(() => setStep("idle"), 3000);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
      setStep("error");
      setTimeout(() => setStep("idle"), 3000);
    }
  }, [referenceFile, dryFile, busy, applyRecommendation, setReferenceFeatures, setDryFeatures, setError]);

  const isDone  = step === "done";
  const isError = step === "error";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
      <button
        onClick={run}
        disabled={!ready || busy}
        style={{
          position: "relative",
          padding: "14px 40px",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.03em",
          cursor: ready && !busy ? "pointer" : "not-allowed",
          border: "1px solid",
          transition: "all 0.25s ease",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 280,
          justifyContent: "center",
          // colours
          background: !ready
            ? "rgba(255,255,255,0.04)"
            : isDone
            ? "rgba(57,255,20,0.15)"
            : isError
            ? "rgba(255,60,60,0.15)"
            : busy
            ? "rgba(124,58,237,0.15)"
            : "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.15))",
          borderColor: !ready
            ? "rgba(255,255,255,0.08)"
            : isDone
            ? "rgba(57,255,20,0.4)"
            : isError
            ? "rgba(255,60,60,0.4)"
            : busy
            ? "rgba(124,58,237,0.4)"
            : "rgba(124,58,237,0.5)",
          color: !ready
            ? "var(--text-secondary)"
            : isDone
            ? "#39ff14"
            : isError
            ? "#ff4444"
            : "var(--text-primary)",
          boxShadow: ready && !busy && !isDone && !isError
            ? "0 0 24px rgba(124,58,237,0.2), 0 0 60px rgba(124,58,237,0.05)"
            : isDone
            ? "0 0 20px rgba(57,255,20,0.2)"
            : "none",
          animation: ready && !busy && !isDone && !isError ? "pulse-glow 2s ease-in-out infinite" : "none",
        }}
      >
        {/* Spinner for busy states */}
        <span style={{
          fontSize: 18,
          display: "inline-block",
          animation: busy ? "spin-slow 1s linear infinite" : "none",
        }}>
          {STEP_ICONS[step]}
        </span>
        <span>{STEP_LABELS[step]}</span>

        {/* Progress shimmer on busy */}
        {busy && (
          <div style={{
            position: "absolute",
            inset: 0, borderRadius: 12,
            background: "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.12) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s linear infinite",
            pointerEvents: "none",
          }} />
        )}
      </button>

      {/* Status sub-label */}
      {!ready && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
          {!referenceFile && !dryFile ? "Upload both vocals to enable" :
           !referenceFile ? "Upload a reference vocal" :
           "Upload your dry vocal"}
        </div>
      )}

      {/* Step progress pills */}
      {busy && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {(["analyzing_ref", "analyzing_dry", "comparing", "building"] as Step[]).map((s, i) => {
            const steps: Step[] = ["analyzing_ref", "analyzing_dry", "comparing", "building"];
            const idx = steps.indexOf(step);
            const done = i < idx;
            const active = s === step;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: active ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: done ? "#39ff14" : active ? "#7c3aed" : "rgba(255,255,255,0.1)",
                  transition: "all 0.3s ease",
                  boxShadow: active ? "0 0 8px rgba(124,58,237,0.6)" : "none",
                }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      {/* Live engine ↔ store sync — no DOM output */}
      <ChainSync />
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

        {/* ── Row 1: Spectrum + LUFS + Pitch + Monitor ──────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto 280px", gap: 12, marginBottom: 12, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              ⚡ Real-Time Spectrum (D3 · log scale · peak hold)
            </div>
            <SpectrumAnalyzer height={80} />
          </div>
          <LUFSMeter />
          <PitchDisplay />
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

        {/* ── Analyze Button ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <AnalyzeButton />
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

            {/* Preset Library */}
            <PresetManager />

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

        {/* ── Row 4: Multi-Track Vocal Stems Processor ────────────────── */}
        <div style={{ marginTop: 12 }}>
          <MultiTrackRack />
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
