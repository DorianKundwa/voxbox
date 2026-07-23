"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

const SYNC_VALUES = ["1/4", "1/8", "1/16", "1/32"] as const;

export function Delay() {
  const { modules, setParam } = useChainStore();
  const p = modules.delay;

  return (
    <ModuleSlot moduleKey="delay" title="Delay" icon="⏪" color="cyan">
      {/* Sync selector */}
      <div className="flex gap-1 mb-4 justify-center">
        {SYNC_VALUES.map((s) => (
          <button
            key={s}
            onClick={() => setParam("delay", "sync", s)}
            style={{
              padding: "4px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              cursor: "pointer",
              border: "1px solid",
              transition: "all 0.15s ease",
              background: p.sync === s ? "rgba(6,182,212,0.2)" : "transparent",
              borderColor: p.sync === s ? "#06b6d4" : "rgba(255,255,255,0.1)",
              color: p.sync === s ? "#22d3ee" : "var(--text-secondary)",
              boxShadow: p.sync === s ? "0 0 8px rgba(6,182,212,0.3)" : "none",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="dly-time" label="Time" value={p.time_ms} min={10} max={2000} step={1} unit=" ms" decimals={0} color="cyan"
          onChange={(v) => setParam("delay", "time_ms", v)} />
        <Knob id="dly-feedback" label="Feedback" value={p.feedback} min={0} max={95} step={1} unit="%" decimals={0} color="cyan"
          onChange={(v) => setParam("delay", "feedback", v)} />
        <Knob id="dly-damping" label="Damping" value={p.damping} min={0} max={100} step={1} unit="%" decimals={0} color="cyan"
          onChange={(v) => setParam("delay", "damping", v)} />
        <Knob id="dly-mix" label="Mix" value={p.mix} min={0} max={100} step={1} unit="%" decimals={0} color="cyan"
          onChange={(v) => setParam("delay", "mix", v)} />
      </div>

      {/* Delay time display */}
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
        {p.time_ms} ms
      </div>
    </ModuleSlot>
  );
}
