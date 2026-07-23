"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function StereoDoubler() {
  const { modules, setParam } = useChainStore();
  const p = modules.doubler;

  return (
    <ModuleSlot moduleKey="doubler" title="Stereo Doubler" icon="↔️" color="cyan">
      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="dbl-width" label="Width" value={p.width} min={0} max={1} step={0.01} decimals={2} color="cyan"
          onChange={(v) => setParam("doubler", "width", v)} />
        <Knob id="dbl-delay" label="Micro Delay" value={p.micro_delay} min={1} max={50} step={0.5} unit=" ms" decimals={1} color="cyan"
          onChange={(v) => setParam("doubler", "micro_delay", v)} />
        <Knob id="dbl-detune" label="Detune" value={p.detune} min={0} max={50} step={0.5} unit=" ¢" decimals={1} color="cyan"
          onChange={(v) => setParam("doubler", "detune", v)} />
        <Knob id="dbl-mix" label="Mix" value={p.mix} min={0} max={100} step={1} unit="%" decimals={0} color="cyan"
          onChange={(v) => setParam("doubler", "mix", v)} />
      </div>

      {/* Width Visualizer */}
      <div className="mt-4 flex justify-center items-center gap-2">
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>L</span>
        <div style={{ position: "relative", width: 120, height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
          <div style={{
            position: "absolute",
            top: 2,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(90deg, #06b6d4, #7c3aed)",
            left: `${50 - p.width * 45}%`,
            right: `${50 - p.width * 45}%`,
            transition: "all 0.1s ease",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>R</span>
      </div>
    </ModuleSlot>
  );
}
