"use client";

import { useEffect, useRef, useCallback } from "react";
import { Knob } from "@/components/ui/Knob";
import { ModuleSlot } from "@/components/chain/ModuleSlot";
import { useChainStore } from "@/store/chainStore";
import type { EQBand } from "@/lib/types";

const BAND_COLORS = ["#06b6d4", "#7c3aed", "#a060ff", "#f59e0b", "#39ff14"];
const BAND_LABELS = ["Low Cut", "Low", "Low Mid", "High Mid", "High Shelf"];

export function ParametricEQ() {
  const { modules, setParam, setEQBand } = useChainStore();
  const eq = modules.eq;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    [80, 250, 1000, 4000, 16000].forEach((freq) => {
      const x = freqToX(freq, W);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    });
    [-12, -6, 0, 6, 12].forEach((db) => {
      const y = dbToY(db, H);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });

    // 0dB line
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, dbToY(0, H)); ctx.lineTo(W, dbToY(0, H)); ctx.stroke();

    // Compute combined response
    const points: number[] = [];
    for (let i = 0; i < W; i++) {
      const f = xToFreq(i, W);
      let totalDb = 0;
      eq.bands.forEach((band) => {
        if (!band.enabled) return;
        totalDb += computeBandResponse(band, f);
      });
      points.push(totalDb);
    }

    // Draw combined curve (glow)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(124,58,237,0.6)");
    grad.addColorStop(1, "rgba(124,58,237,0)");

    ctx.beginPath();
    ctx.moveTo(0, dbToY(points[0], H));
    for (let i = 1; i < W; i++) ctx.lineTo(i, dbToY(points[i], H));
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7c3aed";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(W, dbToY(0, H));
    ctx.lineTo(0, dbToY(0, H));
    ctx.fillStyle = grad;
    ctx.fill();

    // Band handles
    eq.bands.forEach((band, i) => {
      if (band.type === "highpass" || band.type === "lowpass") {
        const x = freqToX(band.frequency, W);
        ctx.beginPath();
        ctx.arc(x, H / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = BAND_COLORS[i];
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const x = freqToX(band.frequency, W);
        const y = dbToY(band.enabled ? band.gain : 0, H);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = BAND_COLORS[i];
        ctx.shadowColor = BAND_COLORS[i];
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }, [eq.bands]);

  useEffect(() => { drawCurve(); }, [drawCurve]);

  return (
    <ModuleSlot moduleKey="eq" title="Parametric EQ" icon="〰️" color="violet">
      {/* EQ Curve Canvas */}
      <div className="freq-graph mb-4" style={{ height: 120 }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={120}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Band Controls */}
      {eq.bands.map((band, i) => (
        <div key={band.id} className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: BAND_COLORS[i] }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: BAND_COLORS[i], letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {BAND_LABELS[i]}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Knob id={`eq-${band.id}-freq`} label="Freq" value={band.frequency}
              min={20} max={20000} step={1} unit="Hz" decimals={0}
              color={["cyan","violet","violet","violet","green"][i] as any}
              onChange={(v) => setEQBand(band.id, { frequency: v })}
              formatValue={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`}
            />
            {band.type !== "highpass" && band.type !== "lowpass" && (
              <Knob id={`eq-${band.id}-gain`} label="Gain" value={band.gain}
                min={-18} max={18} step={0.1} unit=" dB" decimals={1}
                color={["cyan","violet","violet","violet","green"][i] as any}
                onChange={(v) => setEQBand(band.id, { gain: v })}
              />
            )}
            <Knob id={`eq-${band.id}-q`} label="Q" value={band.q}
              min={0.1} max={10} step={0.01} decimals={2}
              color={["cyan","violet","violet","violet","green"][i] as any}
              onChange={(v) => setEQBand(band.id, { q: v })}
            />
          </div>
        </div>
      ))}
    </ModuleSlot>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function freqToX(f: number, W: number): number {
  return (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
}

function xToFreq(x: number, W: number): number {
  return 20 * Math.pow(10, (x / W) * Math.log10(20000 / 20));
}

function dbToY(db: number, H: number): number {
  return H / 2 - (db / 18) * (H / 2 - 8);
}

function computeBandResponse(band: EQBand, f: number): number {
  const { type, frequency, gain, q } = band;
  const w = (2 * Math.PI * f) / 44100;
  const w0 = (2 * Math.PI * frequency) / 44100;

  switch (type) {
    case "highpass": {
      // -20dB/decade above cutoff approximation
      if (f < frequency) return Math.max(-40, 20 * Math.log10(f / frequency));
      return 0;
    }
    case "lowpass": {
      if (f > frequency) return Math.max(-40, 20 * Math.log10(frequency / f));
      return 0;
    }
    case "lowshelf": {
      const ratio = f / frequency;
      if (ratio < 0.5) return gain;
      if (ratio > 2) return 0;
      return gain * (1 - Math.pow((ratio - 0.5) / 1.5, 0.5));
    }
    case "highshelf": {
      const ratio = f / frequency;
      if (ratio > 2) return gain;
      if (ratio < 0.5) return 0;
      return gain * Math.pow((ratio - 0.5) / 1.5, 0.5);
    }
    case "peaking": {
      const dw = w - w0;
      const bw = w0 / q;
      const resp = gain / (1 + (dw / bw) ** 2 * 4);
      return resp;
    }
    default:
      return 0;
  }
}
