"use client";

import { useState } from "react";
import { useChainStore } from "@/store/chainStore";
import { getAudioEngine, audioBufferToWav } from "@/engine/AudioEngine";
import type { ChainModules } from "@/lib/types";

export type StemRole = "lead" | "harmony_l" | "harmony_r" | "backing" | "adlib";

export interface VocalStem {
  id: string;
  name: string;
  role: StemRole;
  file: File;
  processedBuffer: AudioBuffer | null;
  processing: boolean;
}

const ROLE_PRESETS: Record<StemRole, { label: string; icon: string; pan: number; desc: string }> = {
  lead:      { label: "Lead Vocal",      icon: "🎤", pan:  0.0, desc: "Primary lead, centered, full dynamic presence" },
  harmony_l: { label: "Harmony (Left)",  icon: "🗣️", pan: -0.6, desc: "Left panned, lead formant notch, wider reverb" },
  harmony_r: { label: "Harmony (Right)", icon: "🗣️", pan:  0.6, desc: "Right panned, lead formant notch, wider reverb" },
  backing:   { label: "Backing Vocal",   icon: "🎶", pan:  0.0, desc: "Higher compression ratio (6:1), low-mid dip"     },
  adlib:     { label: "Adlibs / FX",     icon: "⚡", pan:  0.3, desc: "BPM 1/4 delay, 300Hz highpass, warm tube drive" },
};

export function MultiTrackRack() {
  const { modules } = useChainStore();
  const [stems, setStems] = useState<VocalStem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newStems: VocalStem[] = files.map((file, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      role: i === 0 ? "lead" : i % 2 === 1 ? "harmony_l" : "harmony_r",
      file,
      processedBuffer: null,
      processing: false,
    }));
    setStems((prev) => [...prev, ...newStems]);
  };

  const setRole = (id: string, role: StemRole) => {
    setStems((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  };

  const removeStem = (id: string) => {
    setStems((prev) => prev.filter((s) => s.id !== id));
  };

  // Role-adapted vocal chain configuration
  const getRoleAdaptedModules = (base: ChainModules, role: StemRole): ChainModules => {
    const cloned: ChainModules = JSON.parse(JSON.stringify(base));

    switch (role) {
      case "lead":
        // Lead remains standard high clarity
        break;
      case "harmony_l":
      case "harmony_r":
        // Dip 2.5kHz lead formant space by -3dB; boost reverb mix by +15%
        if (cloned.eq.bands[3]) cloned.eq.bands[3].gain -= 3.0;
        cloned.reverb.mix = Math.min(100, cloned.reverb.mix + 15);
        cloned.doubler.enabled = true;
        cloned.doubler.width = 0.8;
        break;
      case "backing":
        // Tight 6:1 compression; low-mid boxiness dip at 300Hz
        cloned.compressor.ratio = 6.0;
        if (cloned.eq.bands[1]) cloned.eq.bands[1].gain -= 3.5;
        cloned.multiband_comp.enabled = true;
        break;
      case "adlib":
        // Highpass filter 300Hz; 1/4 note delay mix boost + tube drive
        if (cloned.eq.bands[0]) cloned.eq.bands[0].frequency = 300;
        cloned.delay.enabled = true;
        cloned.delay.mix = 35;
        cloned.saturation.enabled = true;
        cloned.saturation.drive = 25;
        break;
    }

    return cloned;
  };

  const processBatchStems = async () => {
    if (stems.length === 0) return;
    setIsBatchProcessing(true);
    const eng = getAudioEngine();

    for (const stem of stems) {
      setStems((prev) => prev.map((s) => (s.id === stem.id ? { ...s, processing: true } : s)));

      try {
        await eng.loadAudio(stem.file);
        const adaptedModules = getRoleAdaptedModules(modules, stem.role);
        const buf = await eng.renderProcessedAudio(adaptedModules);

        setStems((prev) =>
          prev.map((s) => (s.id === stem.id ? { ...s, processedBuffer: buf, processing: false } : s))
        );
      } catch (err) {
        console.error(`Failed stem ${stem.name}:`, err);
        setStems((prev) => prev.map((s) => (s.id === stem.id ? { ...s, processing: false } : s)));
      }
    }

    setIsBatchProcessing(false);
  };

  const downloadStemWav = (stem: VocalStem) => {
    if (!stem.processedBuffer) return;
    const blob = audioBufferToWav(stem.processedBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxbox-${stem.role}-${stem.name.replace(/\.[^/.]+$/, "")}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            🎙️ Multi-Track Vocal Stems Batch Processor
          </h3>
          <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Process backing vocals, harmonies, and adlibs simultaneously with role-adapted AI chains.
          </p>
        </div>

        <label
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))",
            border: "1px solid rgba(124,58,237,0.4)",
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Vocal Stems
          <input type="file" multiple accept="audio/*" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>
      </div>

      {/* Stem List */}
      {stems.length === 0 ? (
        <div style={{
          padding: 24, textAlign: "center", border: "1px dashed rgba(255,255,255,0.1)",
          borderRadius: 8, color: "var(--text-secondary)", fontSize: 12
        }}>
          No vocal stems loaded. Click "+ Add Vocal Stems" to batch process Harmonies, Backings, and Adlibs.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stems.map((stem) => (
            <div
              key={stem.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: 16 }}>{ROLE_PRESETS[stem.role].icon}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {stem.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  {ROLE_PRESETS[stem.role].desc}
                </div>
              </div>

              {/* Role Select */}
              <select
                value={stem.role}
                onChange={(e) => setRole(stem.id, e.target.value as StemRole)}
                style={{
                  background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "var(--text-primary)", borderRadius: 6, padding: "4px 8px", fontSize: 11,
                }}
              >
                {Object.entries(ROLE_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>

              {/* Status / Actions */}
              {stem.processing ? (
                <span style={{ fontSize: 11, color: "#06b6d4", fontFamily: "JetBrains Mono" }}>Processing...</span>
              ) : stem.processedBuffer ? (
                <button
                  onClick={() => downloadStemWav(stem)}
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    background: "rgba(57,255,20,0.15)", border: "1px solid rgba(57,255,20,0.3)",
                    color: "#39ff14", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  ⬇ WAV
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Ready</span>
              )}

              <button
                onClick={() => removeStem(stem.id)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Batch Control Footer */}
      {stems.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button
            onClick={processBatchStems}
            disabled={isBatchProcessing}
            style={{
              padding: "10px 20px", borderRadius: 8,
              background: isBatchProcessing
                ? "rgba(124,58,237,0.3)"
                : "linear-gradient(135deg, #7c3aed, #06b6d4)",
              color: "white", fontWeight: 700, fontSize: 12, border: "none",
              cursor: isBatchProcessing ? "not-allowed" : "pointer",
              boxShadow: "0 0 16px rgba(124,58,237,0.4)",
            }}
          >
            {isBatchProcessing ? "Processing Stem Batch..." : `⚡ Process All ${stems.length} Vocal Stems`}
          </button>
        </div>
      )}
    </div>
  );
}
