"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudioStore, type MonitorMode } from "@/store/audioStore";
import { useChainStore } from "@/store/chainStore";
import { getAudioEngine } from "@/engine/AudioEngine";

const MODES: { key: MonitorMode; label: string; color: string }[] = [
  { key: "reference", label: "⬅ Reference", color: "#7c3aed" },
  { key: "dry",       label: "🎙 Dry",       color: "#06b6d4" },
  { key: "processed", label: "✨ Processed",  color: "#39ff14" },
];

export function ABMonitor() {
  const {
    monitorMode, setMonitorMode,
    isPlaying, setPlaying,
    isLooping, toggleLoop,
    masterVolume, setMasterVolume,
    referenceFile, dryFile,
    referenceUrl, dryUrl,
    outputLevel, setOutputLevel,
  } = useAudioStore();
  const { modules } = useChainStore();
  const engine = getAudioEngine();

  // Sync loop state to engine whenever it changes — FIX: was purely cosmetic before
  useEffect(() => {
    engine.setLoop(isLooping);
  }, [isLooping]);

  // Load audio when file changes
  useEffect(() => {
    const file = monitorMode === "reference" ? referenceFile : dryFile;
    if (!file) return;
    engine.loadAudio(file).catch(console.error);
  }, [monitorMode, referenceFile, dryFile]);

  // Apply chain when mode is processed
  useEffect(() => {
    if (monitorMode === "processed") {
      engine.applyChain(modules);
    }
  }, [modules, monitorMode]);

  // Start/stop metering
  useEffect(() => {
    engine.startMeter((db) => setOutputLevel(db));
    return () => engine.stopMeter();
  }, []);

  const handleMode = useCallback((mode: MonitorMode) => {
    setMonitorMode(mode);
    if (isPlaying) {
      engine.stop();
      setTimeout(async () => {
        const file = mode === "reference" ? referenceFile : dryFile;
        if (!file) return;
        await engine.loadAudio(file);
        if (mode === "processed") engine.applyChain(modules);
        engine.play();
      }, 50);
    }
  }, [isPlaying, referenceFile, dryFile, modules]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      engine.stop();
      setPlaying(false);
    } else {
      const file = monitorMode === "reference" ? referenceFile : dryFile;
      if (!file) return;
      await engine.loadAudio(file);
      if (monitorMode === "processed") engine.applyChain(modules);
      engine.play();
      setPlaying(true);
    }
  }, [isPlaying, monitorMode, referenceFile, dryFile, modules]);

  const meterPercent = Math.max(0, Math.min(100, (outputLevel + 60) / 60 * 100));
  const meterColor = outputLevel > -6 ? "#ff6600" : outputLevel > -18 ? "#ffdd00" : "#39ff14";

  return (
    <div className="glass p-4 flex flex-col gap-4">
      {/* Monitor mode buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        {MODES.map(({ key, label, color }) => (
          <button
            key={key}
            className={`btn-monitor ${monitorMode === key ? "active" : ""}`}
            onClick={() => handleMode(key)}
            style={monitorMode === key ? {
              background: `${color}20`,
              borderColor: color,
              color,
              boxShadow: `0 0 10px ${color}40`,
            } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Transport */}
      <div className="flex items-center gap-3 justify-center">
        {/* Play / Stop */}
        <button
          onClick={handlePlayPause}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: isPlaying
              ? "linear-gradient(135deg, #7c3aed, #06b6d4)"
              : "rgba(124,58,237,0.2)",
            border: "1px solid rgba(124,58,237,0.4)",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s ease",
            boxShadow: isPlaying ? "0 0 16px rgba(124,58,237,0.4)" : "none",
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Loop toggle */}
        <button
          onClick={toggleLoop}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: isLooping ? "rgba(6,182,212,0.2)" : "transparent",
            border: `1px solid ${isLooping ? "#06b6d4" : "rgba(255,255,255,0.1)"}`,
            color: isLooping ? "#06b6d4" : "var(--text-secondary)",
            fontSize: 14, cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: isLooping ? "0 0 8px rgba(6,182,212,0.3)" : "none",
          }}
        >
          🔁
        </button>

        {/* Master Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, maxWidth: 140 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setMasterVolume(v);
              engine.setMasterVolume(v);
            }}
            style={{ flex: 1, accentColor: "#7c3aed" }}
          />
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", width: 28 }}>
            {Math.round(masterVolume * 100)}
          </span>
        </div>
      </div>

      {/* Output Level Meter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, color: "var(--text-secondary)", width: 20, textAlign: "right" }}>
          OUT
        </span>
        <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <div style={{
            height: "100%",
            width: `${meterPercent}%`,
            background: `linear-gradient(90deg, #39ff14 0%, #ffdd00 60%, #ff6600 80%, #ff1493 100%)`,
            borderRadius: 4,
            transition: "width 0.05s linear",
          }} />
        </div>
        <span style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: meterColor, width: 36 }}>
          {outputLevel.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
