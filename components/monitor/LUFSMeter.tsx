"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/engine/AudioEngine";

interface LUFSReading {
  lufs: number;
  momentary: number;
  peak: number;
}

export function LUFSMeter() {
  const [reading, setReading] = useState<LUFSReading>({ lufs: -70, momentary: -70, peak: -70 });
  const nodeRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    let active = true;

    async function setup() {
      try {
        const eng = getAudioEngine();
        await eng.init();
        const ctx = eng.getContext();
        if (!ctx) return;

        await ctx.audioWorklet.addModule("/dsp/lufs-processor.js");

        const node = new AudioWorkletNode(ctx, "lufs-processor");
        node.port.onmessage = (e) => {
          if (!active) return;
          setReading({
            lufs:      Math.max(-70, e.data.lufs),
            momentary: Math.max(-70, e.data.momentary),
            peak:      Math.max(-70, e.data.peak),
          });
        };

        // Connect analyser → lufs worklet (tap off the analyser output)
        const analyser = eng.getAnalyserNode();
        if (analyser) analyser.connect(node);
        // Don't connect to destination — meter is analysis-only
        nodeRef.current = node;
      } catch (err) {
        console.warn("LUFS meter setup failed:", err);
      }
    }

    setup();
    return () => {
      active = false;
      nodeRef.current?.disconnect();
    };
  }, []);

  const fmt   = (v: number) => v <= -70 ? "---" : `${v.toFixed(1)} LU`;
  const fmtDb = (v: number) => v <= -70 ? "---" : `${v.toFixed(1)} dBFS`;

  // Colour the integrated LUFS bar
  const lufsNorm = Math.max(0, Math.min(1, (reading.lufs + 60) / 60));
  const colour =
    reading.lufs > -9  ? "#ff4444" :
    reading.lufs > -14 ? "#ffaa00" :
    reading.lufs > -23 ? "#39ff14" : "#06b6d4";

  const momNorm = Math.max(0, Math.min(1, (reading.momentary + 60) / 60));

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "8px 10px",
      background: "rgba(0,0,0,0.3)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.06)",
      minWidth: 160,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        LUFS Meter (ITU-R BS.1770-4)
      </div>

      {/* Integrated LUFS bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Integrated</span>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: colour, fontWeight: 600 }}>
            {fmt(reading.lufs)}
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${lufsNorm * 100}%`,
            background: `linear-gradient(90deg, #06b6d4, ${colour})`,
            transition: "width 0.15s ease",
          }} />
        </div>
      </div>

      {/* Momentary LUFS bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Momentary</span>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)" }}>
            {fmt(reading.momentary)}
          </span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${momNorm * 100}%`,
            background: "#7c3aed",
            transition: "width 0.08s ease",
          }} />
        </div>
      </div>

      {/* True peak */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>True Peak</span>
        <span style={{
          fontSize: 10, fontFamily: "JetBrains Mono, monospace", fontWeight: 600,
          color: reading.peak > -1 ? "#ff4444" : reading.peak > -6 ? "#ffaa00" : "var(--text-primary)",
        }}>
          {fmtDb(reading.peak)}
        </span>
      </div>

      {/* Loudness target reference */}
      <div style={{
        marginTop: 2,
        padding: "3px 6px", borderRadius: 4,
        background: "rgba(255,255,255,0.03)",
        fontSize: 8, color: "var(--text-secondary)", textAlign: "center",
      }}>
        Streaming target: −14 LUFS · Broadcast: −23 LUFS
      </div>
    </div>
  );
}
