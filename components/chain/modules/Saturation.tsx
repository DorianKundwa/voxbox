"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

const MODES = ["tube", "tape", "warm", "soft_clip"] as const;

export function Saturation() {
  const { modules, setParam } = useChainStore();
  const p = modules.saturation;

  return (
    <ModuleSlot moduleKey="saturation" title="Saturation" icon="🔥" color="orange">
      {/* Mode Selector */}
      <div className="flex gap-1 mb-4 justify-center">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setParam("saturation", "mode", mode)}
            style={{
              padding: "4px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: "1px solid",
              transition: "all 0.15s ease",
              background: p.mode === mode ? "rgba(255,102,0,0.2)" : "transparent",
              borderColor: p.mode === mode ? "#ff6600" : "rgba(255,255,255,0.1)",
              color: p.mode === mode ? "#ff8833" : "var(--text-secondary)",
              boxShadow: p.mode === mode ? "0 0 8px rgba(255,102,0,0.3)" : "none",
            }}
          >
            {mode.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="sat-drive" label="Drive" value={p.drive} min={0} max={100} step={0.5} decimals={1} color="orange"
          onChange={(v) => setParam("saturation", "drive", v)} />
        <Knob id="sat-tone" label="Tone" value={p.tone} min={0} max={100} step={1} decimals={0} color="orange"
          onChange={(v) => setParam("saturation", "tone", v)} />
        <Knob id="sat-mix" label="Mix" value={p.mix} min={0} max={100} step={1} unit="%" decimals={0} color="orange"
          onChange={(v) => setParam("saturation", "mix", v)} />
      </div>
    </ModuleSlot>
  );
}
