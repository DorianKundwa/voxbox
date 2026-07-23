"use client";

import { useState, useEffect } from "react";
import { useChainStore } from "@/store/chainStore";
import type { ChainModules } from "@/lib/types";

interface NamedPreset {
  id: string;
  name: string;
  category: "factory" | "custom";
  modules: ChainModules;
}

const FACTORY_PRESETS: NamedPreset[] = [
  {
    id: "pop_lead",
    name: "Modern Pop Lead",
    category: "factory",
    modules: {
      noise_gate: { enabled: true, threshold: -55, attack: 5, release: 150, hold: 50 },
      deesser: { enabled: true, center_frequency: 7500, bandwidth: 2000, reduction: 8, sensitivity: 0.6 },
      pitch_correction: { enabled: true, key: "C", scale: "major", retune_speed: 35, humanize: 0.5, amount: 0.7 },
      eq: {
        enabled: true,
        bands: [
          { id: "low_cut", type: "highpass", frequency: 85, gain: 0, q: 0.707, enabled: true },
          { id: "low", type: "lowshelf", frequency: 200, gain: -1.5, q: 0.707, enabled: true },
          { id: "low_mid", type: "peaking", frequency: 400, gain: -2.0, q: 1.0, enabled: true },
          { id: "high_mid", type: "peaking", frequency: 3500, gain: 2.5, q: 1.2, enabled: true },
          { id: "high_shelf", type: "highshelf", frequency: 10000, gain: 3.5, q: 0.707, enabled: true },
        ],
      },
      multiband_comp: {
        enabled: true,
        low: { crossover: 250, threshold: -24, ratio: 2.0, attack: 10, release: 80, makeup: 2 },
        mid: { crossover: 3000, threshold: -20, ratio: 3.0, attack: 5, release: 50, makeup: 3 },
        high: { crossover_low: 3000, threshold: -22, ratio: 2.0, attack: 3, release: 40, makeup: 2 },
      },
      compressor: { enabled: true, threshold: -18, ratio: 4.0, attack: 8, release: 100, makeup: 4, knee: 3 },
      saturation: { enabled: true, mode: "tube", drive: 12, tone: 55, mix: 25 },
      doubler: { enabled: true, width: 0.4, micro_delay: 12, detune: 8, mix: 20 },
      delay: { enabled: true, time_ms: 250, sync: "1/8", feedback: 18, damping: 65, mix: 15 },
      reverb: { enabled: true, type: "plate", predelay: 20, decay: 1.6, damping: 60, mix: 18 },
      limiter: { enabled: true, ceiling: -0.3, threshold: -1.0, lookahead: 5, release: 100 },
    },
  },
  {
    id: "trap_crisp",
    name: "Crisp Trap / Rap",
    category: "factory",
    modules: {
      noise_gate: { enabled: true, threshold: -48, attack: 3, release: 100, hold: 30 },
      deesser: { enabled: true, center_frequency: 7200, bandwidth: 2200, reduction: 10, sensitivity: 0.7 },
      pitch_correction: { enabled: true, key: "C", scale: "minor", retune_speed: 15, humanize: 0.2, amount: 0.9 },
      eq: {
        enabled: true,
        bands: [
          { id: "low_cut", type: "highpass", frequency: 100, gain: 0, q: 0.707, enabled: true },
          { id: "low", type: "lowshelf", frequency: 220, gain: -2.5, q: 0.707, enabled: true },
          { id: "low_mid", type: "peaking", frequency: 500, gain: -3.0, q: 1.2, enabled: true },
          { id: "high_mid", type: "peaking", frequency: 4000, gain: 3.5, q: 1.4, enabled: true },
          { id: "high_shelf", type: "highshelf", frequency: 12000, gain: 4.5, q: 0.707, enabled: true },
        ],
      },
      multiband_comp: {
        enabled: true,
        low: { crossover: 250, threshold: -26, ratio: 3.0, attack: 8, release: 60, makeup: 2 },
        mid: { crossover: 3000, threshold: -22, ratio: 4.0, attack: 4, release: 40, makeup: 3 },
        high: { crossover_low: 3000, threshold: -24, ratio: 2.5, attack: 2, release: 30, makeup: 2 },
      },
      compressor: { enabled: true, threshold: -22, ratio: 6.0, attack: 4, release: 80, makeup: 5, knee: 2 },
      saturation: { enabled: true, mode: "tape", drive: 22, tone: 60, mix: 35 },
      doubler: { enabled: false, width: 0.5, micro_delay: 12, detune: 8, mix: 40 },
      delay: { enabled: true, time_ms: 250, sync: "1/8", feedback: 25, damping: 50, mix: 18 },
      reverb: { enabled: true, type: "room", predelay: 10, decay: 0.9, damping: 70, mix: 12 },
      limiter: { enabled: true, ceiling: -0.2, threshold: -1.5, lookahead: 5, release: 80 },
    },
  },
  {
    id: "rnb_smooth",
    name: "Smooth R&B / Soul",
    category: "factory",
    modules: {
      noise_gate: { enabled: true, threshold: -60, attack: 10, release: 200, hold: 60 },
      deesser: { enabled: true, center_frequency: 7800, bandwidth: 1800, reduction: 6, sensitivity: 0.5 },
      pitch_correction: { enabled: true, key: "C", scale: "major", retune_speed: 60, humanize: 0.75, amount: 0.4 },
      eq: {
        enabled: true,
        bands: [
          { id: "low_cut", type: "highpass", frequency: 75, gain: 0, q: 0.707, enabled: true },
          { id: "low", type: "lowshelf", frequency: 180, gain: 1.5, q: 0.707, enabled: true },
          { id: "low_mid", type: "peaking", frequency: 650, gain: -1.5, q: 0.9, enabled: true },
          { id: "high_mid", type: "peaking", frequency: 2800, gain: 1.5, q: 1.0, enabled: true },
          { id: "high_shelf", type: "highshelf", frequency: 9000, gain: 2.0, q: 0.707, enabled: true },
        ],
      },
      multiband_comp: {
        enabled: false,
        low: { crossover: 250, threshold: -24, ratio: 2.0, attack: 10, release: 80, makeup: 2 },
        mid: { crossover: 3000, threshold: -20, ratio: 2.5, attack: 5, release: 50, makeup: 3 },
        high: { crossover_low: 3000, threshold: -22, ratio: 2.0, attack: 3, release: 40, makeup: 2 },
      },
      compressor: { enabled: true, threshold: -16, ratio: 2.5, attack: 15, release: 150, makeup: 3, knee: 4 },
      saturation: { enabled: true, mode: "warm", drive: 10, tone: 50, mix: 20 },
      doubler: { enabled: true, width: 0.6, micro_delay: 15, detune: 10, mix: 25 },
      delay: { enabled: true, time_ms: 375, sync: "1/4", feedback: 15, damping: 70, mix: 15 },
      reverb: { enabled: true, type: "hall", predelay: 35, decay: 2.4, damping: 55, mix: 24 },
      limiter: { enabled: true, ceiling: -0.3, threshold: -0.8, lookahead: 5, release: 120 },
    },
  },
  {
    id: "broadcast_clean",
    name: "Podcast / Voiceover Clean",
    category: "factory",
    modules: {
      noise_gate: { enabled: true, threshold: -45, attack: 5, release: 120, hold: 40 },
      deesser: { enabled: true, center_frequency: 6500, bandwidth: 2000, reduction: 9, sensitivity: 0.65 },
      pitch_correction: { enabled: false, key: "C", scale: "major", retune_speed: 80, humanize: 0.6, amount: 0.5 },
      eq: {
        enabled: true,
        bands: [
          { id: "low_cut", type: "highpass", frequency: 80, gain: 0, q: 0.707, enabled: true },
          { id: "low", type: "lowshelf", frequency: 160, gain: 2.0, q: 0.707, enabled: true },
          { id: "low_mid", type: "peaking", frequency: 450, gain: -2.5, q: 1.1, enabled: true },
          { id: "high_mid", type: "peaking", frequency: 3000, gain: 1.8, q: 1.0, enabled: true },
          { id: "high_shelf", type: "highshelf", frequency: 8000, gain: 1.5, q: 0.707, enabled: true },
        ],
      },
      multiband_comp: {
        enabled: true,
        low: { crossover: 250, threshold: -22, ratio: 2.5, attack: 12, release: 90, makeup: 2 },
        mid: { crossover: 3000, threshold: -18, ratio: 3.5, attack: 6, release: 60, makeup: 3 },
        high: { crossover_low: 3000, threshold: -20, ratio: 2.0, attack: 4, release: 50, makeup: 1 },
      },
      compressor: { enabled: true, threshold: -20, ratio: 4.5, attack: 6, release: 90, makeup: 5, knee: 3 },
      saturation: { enabled: false, mode: "tube", drive: 15, tone: 50, mix: 30 },
      doubler: { enabled: false, width: 0.5, micro_delay: 12, detune: 8, mix: 40 },
      delay: { enabled: false, time_ms: 250, sync: "1/8", feedback: 20, damping: 60, mix: 12 },
      reverb: { enabled: false, type: "room", predelay: 20, decay: 1.6, damping: 60, mix: 18 },
      limiter: { enabled: true, ceiling: -0.5, threshold: -2.0, lookahead: 5, release: 90 },
    },
  },
];

export function PresetManager() {
  const { modules, loadModules } = useChainStore();
  const [customPresets, setCustomPresets] = useState<NamedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("pop_lead");
  const [newPresetName, setNewPresetName] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("voxbox_custom_presets");
      if (saved) setCustomPresets(JSON.parse(saved));
    } catch {}
  }, []);

  const allPresets = [...FACTORY_PRESETS, ...customPresets];

  const applyPreset = (id: string) => {
    setSelectedPresetId(id);
    const target = allPresets.find((p) => p.id === id);
    if (target) loadModules(target.modules);
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: NamedPreset = {
      id: "user_" + Date.now(),
      name: newPresetName.trim(),
      category: "custom",
      modules: JSON.parse(JSON.stringify(modules)),
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem("voxbox_custom_presets", JSON.stringify(updated));
    setSelectedPresetId(newPreset.id);
    setNewPresetName("");
  };

  return (
    <div className="glass p-4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
          🎛 Vocal Preset Library
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {allPresets.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: selectedPresetId === p.id ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${selectedPresetId === p.id ? "#7c3aed" : "rgba(255,255,255,0.08)"}`,
              color: selectedPresetId === p.id ? "#39ff14" : "var(--text-primary)",
              transition: "all 0.15s ease",
            }}
          >
            {p.category === "factory" ? "🌟" : "👤"} {p.name}
          </button>
        ))}
      </div>

      {/* Save Custom Preset */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Save custom preset name..."
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          style={{
            flex: 1,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={saveCurrentAsPreset}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            background: "rgba(6,182,212,0.2)",
            border: "1px solid rgba(6,182,212,0.4)",
            color: "#06b6d4",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Save Preset
        </button>
      </div>
    </div>
  );
}
