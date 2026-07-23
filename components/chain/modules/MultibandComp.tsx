"use client";

import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";

export function MultibandComp() {
  const { modules, setParam } = useChainStore();
  const p = modules.multiband_comp;

  const bands = [
    { key: "low" as const,  label: "Low",  color: "#06b6d4" as const, range: "<250Hz" },
    { key: "mid" as const,  label: "Mid",  color: "#7c3aed" as const, range: "250Hz–3kHz" },
    { key: "high" as const, label: "High", color: "#39ff14" as const, range: ">3kHz" },
  ];

  return (
    <ModuleSlot moduleKey="multiband_comp" title="Multiband Comp" icon="📊" color="violet">
      <div className="flex flex-col gap-4">
        {bands.map(({ key, label, color, range }) => {
          const b = p[key];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{range}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Knob id={`mb-${key}-thresh`} label="Threshold" value={b.threshold} min={-60} max={0} step={0.5} unit=" dB" decimals={1}
                  color={key === "low" ? "cyan" : key === "mid" ? "violet" : "green"}
                  onChange={(v) => setParam("multiband_comp", key, { ...b, threshold: v })} />
                <Knob id={`mb-${key}-ratio`} label="Ratio" value={b.ratio} min={1} max={10} step={0.1} decimals={1}
                  color={key === "low" ? "cyan" : key === "mid" ? "violet" : "green"}
                  onChange={(v) => setParam("multiband_comp", key, { ...b, ratio: v })} />
                <Knob id={`mb-${key}-attack`} label="Attack" value={b.attack} min={0.1} max={100} step={0.1} unit=" ms" decimals={1}
                  color={key === "low" ? "cyan" : key === "mid" ? "violet" : "green"}
                  onChange={(v) => setParam("multiband_comp", key, { ...b, attack: v })} />
                <Knob id={`mb-${key}-release`} label="Release" value={b.release} min={1} max={1000} step={1} unit=" ms" decimals={0}
                  color={key === "low" ? "cyan" : key === "mid" ? "violet" : "green"}
                  onChange={(v) => setParam("multiband_comp", key, { ...b, release: v })} />
              </div>
            </div>
          );
        })}
      </div>
    </ModuleSlot>
  );
}
