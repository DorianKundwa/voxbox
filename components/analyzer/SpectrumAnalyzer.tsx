"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { getAudioEngine } from "@/engine/AudioEngine";

interface SpectrumAnalyzerProps {
  height?: number;
}

const FFT_SIZE    = 2048;
const SMOOTHING   = 0.8;
const MIN_DB      = -90;
const MAX_DB      = 0;
// Mel-inspired log frequency scale
const FREQ_MIN    = 40;
const FREQ_MAX    = 20000;

// Frequency labels on the X axis
const FREQ_TICKS  = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function SpectrumAnalyzer({ height = 100 }: SpectrumAnalyzerProps) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const rafRef  = useRef<number>(0);
  const initRef = useRef(false);

  // d3 selections & scales stored across frames
  const scaleX  = useRef<d3.ScaleLogarithmic<number, number> | undefined>(undefined);
  const scaleY  = useRef<d3.ScaleLinear<number, number> | undefined>(undefined);
  const pathRef = useRef<d3.Selection<SVGPathElement, unknown, null, undefined> | undefined>(undefined);
  const peakRef = useRef<d3.Selection<SVGPathElement, unknown, null, undefined> | undefined>(undefined);
  const peakBuf = useRef<Float32Array>(new Float32Array(FFT_SIZE / 2));

  const setupD3 = useCallback((svg: SVGSVGElement) => {
    const W = svg.clientWidth || 800;
    const H = height;

    const d3svg = d3.select(svg);
    d3svg.selectAll("*").remove();

    const margin = { top: 4, right: 8, bottom: 18, left: 28 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const g = d3svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    scaleX.current = d3.scaleLog().domain([FREQ_MIN, FREQ_MAX]).range([0, w]).clamp(true);
    scaleY.current = d3.scaleLinear().domain([MIN_DB, MAX_DB]).range([h, 0]).clamp(true);

    const xScale = scaleX.current;
    const yScale = scaleY.current;

    // Background grid
    FREQ_TICKS.forEach(f => {
      g.append("line")
        .attr("x1", xScale(f)).attr("x2", xScale(f))
        .attr("y1", 0).attr("y2", h)
        .attr("stroke", "rgba(255,255,255,0.04)").attr("stroke-width", 1);
    });

    [-60, -40, -20].forEach(db => {
      g.append("line")
        .attr("x1", 0).attr("x2", w)
        .attr("y1", yScale(db)).attr("y2", yScale(db))
        .attr("stroke", "rgba(255,255,255,0.05)").attr("stroke-width", 1);
    });

    // X axis labels
    FREQ_TICKS.forEach(f => {
      g.append("text")
        .attr("x", xScale(f))
        .attr("y", h + 14)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(255,255,255,0.25)")
        .attr("font-size", "8px")
        .attr("font-family", "JetBrains Mono, monospace")
        .text(f >= 1000 ? `${f / 1000}k` : String(f));
    });

    // Y axis label
    [-60, -40, -20, 0].forEach(db => {
      g.append("text")
        .attr("x", -4).attr("y", yScale(db) + 3)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(255,255,255,0.2)")
        .attr("font-size", "7px")
        .attr("font-family", "JetBrains Mono, monospace")
        .text(`${db}`);
    });

    // Gradient fill
    const gradId = "spec-grad";
    const defs = d3svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id", gradId).attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#7c3aed").attr("stop-opacity", 0.6);
    grad.append("stop").attr("offset", "60%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.3);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.0);

    // Peak hold path (drawn below the main path)
    peakRef.current = g.append("path")
      .attr("fill", "none")
      .attr("stroke", "rgba(57,255,20,0.45)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");

    // Filled spectrum path
    pathRef.current = g.append("path")
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", "#7c3aed")
      .attr("stroke-width", 1.5);

    initRef.current = true;
  }, [height]);

  useEffect(() => {
    if (!svgRef.current) return;
    setupD3(svgRef.current);

    const analyser = (() => {
      try {
        const eng = getAudioEngine();
        const node = eng.getAnalyserNode();
        if (node) {
          node.fftSize = FFT_SIZE;
          node.smoothingTimeConstant = SMOOTHING;
        }
        return node;
      } catch { return null; }
    })();

    const freqData = new Float32Array(FFT_SIZE / 2);
    const nyquist  = 44100 / 2;

    const tick = () => {
      if (!pathRef.current || !scaleX.current || !scaleY.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const xScale = scaleX.current;
      const yScale = scaleY.current;

      if (analyser) {
        analyser.getFloatFrequencyData(freqData);
      } else {
        // Idle noise floor when no audio loaded
        for (let i = 0; i < freqData.length; i++) freqData[i] = -90 + Math.random() * 2;
      }

      const W = svgRef.current?.clientWidth || 800;
      const H = height;
      const margin = { top: 4, right: 8, bottom: 18, left: 28 };
      const h = H - margin.top - margin.bottom;

      // Build line points: map bin index → frequency → x, dB → y
      const points: [number, number][] = [];
      const peakPoints: [number, number][] = [];
      const binCount = freqData.length;

      for (let i = 1; i < binCount; i++) {
        const freq = (i / binCount) * nyquist;
        if (freq < FREQ_MIN || freq > FREQ_MAX) continue;
        const x = xScale(freq);
        const db = Math.max(MIN_DB, freqData[i]);
        const y = yScale(db);

        // Peak hold: decay slowly
        if (db > (peakBuf.current[i] ?? MIN_DB)) {
          peakBuf.current[i] = db;
        } else {
          peakBuf.current[i] = (peakBuf.current[i] ?? MIN_DB) - 0.3;
        }
        const py = yScale(Math.max(MIN_DB, peakBuf.current[i] ?? MIN_DB));

        points.push([x, y]);
        peakPoints.push([x, py]);
      }

      // Close path to bottom for fill
      const closedPoints: [number, number][] = [
        [points[0]?.[0] ?? 0, h],
        ...points,
        [points[points.length - 1]?.[0] ?? 0, h],
      ];

      const lineGen = d3.line<[number, number]>()
        .x(d => d[0]).y(d => d[1])
        .curve(d3.curveBasis);

      pathRef.current.attr("d", lineGen(closedPoints) ?? "");
      peakRef.current?.attr("d", lineGen(peakPoints) ?? "");

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    const resizeObs = new ResizeObserver(() => {
      if (svgRef.current) setupD3(svgRef.current);
    });
    if (svgRef.current) resizeObs.observe(svgRef.current);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
    };
  }, [setupD3, height]);

  return (
    <div className="glass" style={{ padding: "8px 8px 4px", borderRadius: 8 }}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{ display: "block", overflow: "visible" }}
      />
    </div>
  );
}
