"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function NoiseGate() {
  const { modules, setParam } = useChainStore();
  const p = modules.noise_gate;

  return (
    <ModuleSlot moduleKey="noise_gate" title="Noise Gate" icon="🔇" color="cyan">
      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="gate-threshold" label="Threshold" value={p.threshold} min={-80} max={-20} step={0.5} unit=" dB" decimals={1} color="cyan"
          onChange={(v) => setParam("noise_gate", "threshold", v)} />
        <Knob id="gate-attack" label="Attack" value={p.attack} min={0.1} max={100} step={0.1} unit=" ms" decimals={1} color="cyan"
          onChange={(v) => setParam("noise_gate", "attack", v)} />
        <Knob id="gate-hold" label="Hold" value={p.hold} min={0} max={500} step={1} unit=" ms" decimals={0} color="cyan"
          onChange={(v) => setParam("noise_gate", "hold", v)} />
        <Knob id="gate-release" label="Release" value={p.release} min={1} max={2000} step={1} unit=" ms" decimals={0} color="cyan"
          onChange={(v) => setParam("noise_gate", "release", v)} />
      </div>
    </ModuleSlot>
  );
}
