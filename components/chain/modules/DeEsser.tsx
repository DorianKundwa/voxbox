"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function DeEsser() {
  const { modules, setParam } = useChainStore();
  const p = modules.deesser;

  const formatFreq = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;

  return (
    <ModuleSlot moduleKey="deesser" title="De-Esser" icon="🐍" color="orange">
      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="deesser-freq" label="Frequency" value={p.center_frequency} min={2000} max={16000} step={100} unit=" Hz" decimals={0} color="orange"
          onChange={(v) => setParam("deesser", "center_frequency", v)}
          formatValue={formatFreq} />
        <Knob id="deesser-bw" label="Bandwidth" value={p.bandwidth} min={200} max={6000} step={100} unit=" Hz" decimals={0} color="orange"
          onChange={(v) => setParam("deesser", "bandwidth", v)}
          formatValue={formatFreq} />
        <Knob id="deesser-reduction" label="Reduction" value={p.reduction} min={0} max={24} step={0.5} unit=" dB" decimals={1} color="orange"
          onChange={(v) => setParam("deesser", "reduction", v)} />
        <Knob id="deesser-sens" label="Sensitivity" value={p.sensitivity} min={0} max={1} step={0.01} decimals={2} color="orange"
          onChange={(v) => setParam("deesser", "sensitivity", v)} />
      </div>
    </ModuleSlot>
  );
}
