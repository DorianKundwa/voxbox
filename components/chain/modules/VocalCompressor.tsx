"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function VocalCompressor() {
  const { modules, setParam } = useChainStore();
  const p = modules.compressor;

  // Gain reduction meter (visual approximation)
  const grEstimate = Math.max(0, -(p.threshold - (-18)) * (p.ratio - 1) / p.ratio);

  return (
    <ModuleSlot moduleKey="compressor" title="Vocal Compressor" icon="🗜️" color="violet">
      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="comp-threshold" label="Threshold" value={p.threshold} min={-60} max={0} step={0.5} unit=" dB" decimals={1} color="violet"
          onChange={(v) => setParam("compressor", "threshold", v)} />
        <Knob id="comp-ratio" label="Ratio" value={p.ratio} min={1} max={20} step={0.1} decimals={1} color="violet"
          onChange={(v) => setParam("compressor", "ratio", v)}
          formatValue={(v) => `${v.toFixed(1)}:1`} />
        <Knob id="comp-attack" label="Attack" value={p.attack} min={0.1} max={200} step={0.1} unit=" ms" decimals={1} color="violet"
          onChange={(v) => setParam("compressor", "attack", v)} />
        <Knob id="comp-release" label="Release" value={p.release} min={1} max={2000} step={1} unit=" ms" decimals={0} color="violet"
          onChange={(v) => setParam("compressor", "release", v)} />
        <Knob id="comp-makeup" label="Makeup" value={p.makeup} min={0} max={24} step={0.5} unit=" dB" decimals={1} color="cyan"
          onChange={(v) => setParam("compressor", "makeup", v)} />
        <Knob id="comp-knee" label="Knee" value={p.knee} min={0} max={12} step={0.5} unit=" dB" decimals={1} color="cyan"
          onChange={(v) => setParam("compressor", "knee", v)} />
      </div>

      {/* GR Meter */}
      <div className="mt-3" style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, grEstimate * 4)}%`,
            background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
            borderRadius: 3,
            transition: "width 0.1s ease",
          }}
        />
      </div>
      <div style={{ textAlign: "right", fontSize: 9, color: "var(--text-secondary)", marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>
        GR ~{grEstimate.toFixed(1)} dB
      </div>
    </ModuleSlot>
  );
}
