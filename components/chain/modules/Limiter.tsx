"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function Limiter() {
  const { modules, setParam } = useChainStore();
  const p = modules.limiter;

  return (
    <ModuleSlot moduleKey="limiter" title="Limiter" icon="🛑" color="orange">
      <div className="flex flex-wrap gap-4 justify-center">
        <Knob id="lim-ceiling" label="Ceiling" value={p.ceiling} min={-12} max={0} step={0.1} unit=" dB" decimals={1} color="orange"
          onChange={(v) => setParam("limiter", "ceiling", v)} />
        <Knob id="lim-threshold" label="Threshold" value={p.threshold} min={-12} max={0} step={0.1} unit=" dB" decimals={1} color="orange"
          onChange={(v) => setParam("limiter", "threshold", v)} />
        <Knob id="lim-lookahead" label="Lookahead" value={p.lookahead} min={0} max={20} step={0.5} unit=" ms" decimals={1} color="orange"
          onChange={(v) => setParam("limiter", "lookahead", v)} />
        <Knob id="lim-release" label="Release" value={p.release} min={1} max={1000} step={1} unit=" ms" decimals={0} color="orange"
          onChange={(v) => setParam("limiter", "release", v)} />
      </div>

      {/* Output level bar */}
      <div className="mt-3 flex items-center gap-2">
        <span style={{ fontSize: 9, color: "var(--text-secondary)", width: 40 }}>Output</span>
        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: "72%",
            background: "linear-gradient(90deg, #39ff14 0%, #ffdd00 70%, #ff6600 90%, #ff1493 100%)",
            borderRadius: 3,
          }} />
        </div>
        <span style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", width: 40 }}>
          {p.ceiling.toFixed(1)} dB
        </span>
      </div>
    </ModuleSlot>
  );
}
