"use client";

import { NoiseGate } from "./modules/NoiseGate";
import { DeEsser } from "./modules/DeEsser";
import { PitchCorrection } from "./modules/PitchCorrection";
import { ParametricEQ } from "./modules/ParametricEQ";
import { MultibandComp } from "./modules/MultibandComp";
import { VocalCompressor } from "./modules/VocalCompressor";
import { Saturation } from "./modules/Saturation";
import { StereoDoubler } from "./modules/StereoDoubler";
import { Delay } from "./modules/Delay";
import { Reverb } from "./modules/Reverb";
import { Limiter } from "./modules/Limiter";

// Pipeline arrow indicator
const Arrow = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 16 }}>
    <div style={{ width: 1, height: 10, background: "rgba(124,58,237,0.3)" }} />
    <svg width="8" height="6" style={{ marginTop: 10 }} viewBox="0 0 8 6">
      <path d="M4 6L0 0h8z" fill="rgba(124,58,237,0.4)" />
    </svg>
  </div>
);

export function ChainRack() {
  const modules = [
    <NoiseGate key="gate" />,
    <DeEsser key="deesser" />,
    <PitchCorrection key="pitch" />,
    <ParametricEQ key="eq" />,
    <MultibandComp key="mb" />,
    <VocalCompressor key="comp" />,
    <Saturation key="sat" />,
    <StereoDoubler key="doubler" />,
    <Delay key="delay" />,
    <Reverb key="reverb" />,
    <Limiter key="limiter" />,
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Pipeline header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 8px #7c3aed" }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
          Processing Chain
        </span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)" }} />
      </div>

      {/* Modules */}
      {modules.map((mod, i) => (
        <div key={i}>
          {mod}
          {i < modules.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  );
}
