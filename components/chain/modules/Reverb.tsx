"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

const TYPES = ["room", "hall", "plate"] as const;

export function Reverb() {
  const { modules, setParam } = useChainStore();
  const p = modules.reverb;

  return (
    <ModuleSlot moduleKey="reverb" title="Reverb" icon="🌊" color="violet">
      {/* Type selector */}
      <div className="flex gap-1 mb-4 justify-center">
        {TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setParam("reverb", "type", type)}
            style={{
              padding: "4px 14px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: "1px solid",
              transition: "all 0.15s ease",
              background: p.type === type ? "rgba(124,58,237,0.2)" : "transparent",
              borderColor: p.type === type ? "#7c3aed" : "rgba(255,255,255,0.1)",
              color: p.type === type ? "#be93ff" : "var(--text-secondary)",
              boxShadow: p.type === type ? "0 0 8px rgba(124,58,237,0.3)" : "none",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="rev-predelay" label="Pre-Delay" value={p.predelay} min={0} max={200} step={1} unit=" ms" decimals={0} color="violet"
          onChange={(v) => setParam("reverb", "predelay", v)} />
        <Knob id="rev-decay" label="Decay" value={p.decay} min={0.1} max={10} step={0.05} unit=" s" decimals={2} color="violet"
          onChange={(v) => setParam("reverb", "decay", v)} />
        <Knob id="rev-damping" label="Damping" value={p.damping} min={0} max={100} step={1} unit="%" decimals={0} color="violet"
          onChange={(v) => setParam("reverb", "damping", v)} />
        <Knob id="rev-mix" label="Mix" value={p.mix} min={0} max={100} step={1} unit="%" decimals={0} color="violet"
          onChange={(v) => setParam("reverb", "mix", v)} />
      </div>

      {/* Decay visualization */}
      <div className="mt-3" style={{ height: 24, background: "rgba(0,0,0,0.3)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, rgba(124,58,237,0.6) 0%, rgba(124,58,237,0.2) ${Math.min(95, p.decay * 10)}%, transparent 100%)`,
          transition: "background 0.2s ease",
        }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 8 }}>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.5)" }}>
            RT60 ~{p.decay.toFixed(2)}s
          </span>
        </div>
      </div>
    </ModuleSlot>
  );
}
