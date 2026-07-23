"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = ["major", "minor", "chromatic"] as const;

export function PitchCorrection() {
  const { modules, setParam } = useChainStore();
  const p = modules.pitch_correction;

  return (
    <ModuleSlot moduleKey="pitch_correction" title="Pitch Correction" icon="🎵" color="green">
      {/* Key + Scale selectors */}
      <div className="flex gap-2 mb-4 justify-center">
        <select
          value={p.key}
          onChange={(e) => setParam("pitch_correction", "key", e.target.value)}
          style={{
            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, color: "var(--text-primary)", padding: "4px 8px",
            fontSize: 12, fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>

        <select
          value={p.scale}
          onChange={(e) => setParam("pitch_correction", "scale", e.target.value as typeof p.scale)}
          style={{
            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, color: "var(--text-primary)", padding: "4px 8px",
            fontSize: 12, fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="pitch-speed" label="Speed" value={p.retune_speed} min={0} max={500} step={1} unit=" ms" decimals={0} color="green"
          onChange={(v) => setParam("pitch_correction", "retune_speed", v)} />
        <Knob id="pitch-humanize" label="Humanize" value={p.humanize} min={0} max={1} step={0.01} decimals={2} color="green"
          onChange={(v) => setParam("pitch_correction", "humanize", v)} />
        <Knob id="pitch-amount" label="Amount" value={p.amount} min={0} max={1} step={0.01} decimals={2} color="green"
          onChange={(v) => setParam("pitch_correction", "amount", v)} />
      </div>
    </ModuleSlot>
  );
}
