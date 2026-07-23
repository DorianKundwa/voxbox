"use client";

import { useEffect, useRef } from "react";
import { getAudioEngine } from "@/engine/AudioEngine";

interface SpectrumAnalyzerProps {
  height?: number;
}

export function SpectrumAnalyzer({ height = 80 }: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const engine = getAudioEngine();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const analyser = engine.getAnalyserNode();
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (!analyser) {
        // Draw idle state
        ctx.fillStyle = "rgba(6,6,8,0.8)";
        ctx.fillRect(0, 0, W, H);
        drawGrid(ctx, W, H);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufLen = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgba(6,6,8,0.85)";
      ctx.fillRect(0, 0, W, H);

      drawGrid(ctx, W, H);

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(160,96,255,0.9)");
      grad.addColorStop(0.4, "rgba(124,58,237,0.7)");
      grad.addColorStop(1, "rgba(6,182,212,0.3)");

      const barCount = 120;
      const barW = W / barCount - 1;

      ctx.fillStyle = grad;
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 4;

      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufLen);
        const v = dataArray[idx] / 255;
        const barH = v * H;
        const x = i * (W / barCount);
        const y = H - barH;

        // Bar
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);

        // Peak dot
        ctx.fillStyle = "rgba(160,96,255,0.8)";
        ctx.fillRect(x, y, barW, 2);
      }

      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="freq-graph" style={{ height }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  [100, 500, 1000, 4000, 10000].forEach((_, i) => {
    const x = (i / 5) * W + W / 10;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  });
}
