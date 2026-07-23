"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { useMidiLearn } from "@/midi/MidiLearn";

interface KnobProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  decimals?: number;
  color?: "violet" | "cyan" | "green" | "orange";
  size?: "sm" | "md" | "lg";
  onChange: (value: number) => void;
  formatValue?: (v: number) => string;
}

const COLORS = {
  violet: { arc: "#7c3aed", track: "#2a1a4e", glow: "rgba(124,58,237,0.6)" },
  cyan:   { arc: "#06b6d4", track: "#0c2d3a", glow: "rgba(6,182,212,0.6)"  },
  green:  { arc: "#39ff14", track: "#0a2a0a", glow: "rgba(57,255,20,0.4)"  },
  orange: { arc: "#ff6600", track: "#2a1a00", glow: "rgba(255,102,0,0.4)"  },
};

const SIZES = {
  sm: { r: 18, stroke: 3, fontSize: 9 },
  md: { r: 24, stroke: 4, fontSize: 10 },
  lg: { r: 32, stroke: 5, fontSize: 11 },
};

export function Knob({
  id, label, value, min, max, step = 0.01, unit = "", decimals = 1,
  color = "violet", size = "md", onChange, formatValue,
}: KnobProps) {
  const { learnKnob, isLearning, mappings } = useMidiLearn();
  const learning = isLearning === id;
  const hasMidi = !!mappings[id];

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const { r, stroke, fontSize } = SIZES[size];
  const { arc, track, glow } = COLORS[color];

  const svgSize = (r + stroke + 2) * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const startAngle = -135;
  const endAngle = 135;

  const norm = (v: number) => (v - min) / (max - min);
  const angle = startAngle + norm(value) * (endAngle - startAngle);

  const formatNum = (n: number) => Math.round(n * 1000) / 1000;

  const polarToXY = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: formatNum(cx + radius * Math.cos(rad)),
      y: formatNum(cy + radius * Math.sin(rad)),
    };
  };

  const arcPath = (startA: number, endA: number, radius: number) => {
    const s = polarToXY(startA, radius);
    const e = polarToXY(endA, radius);
    const large = endA - startA > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const indicator = polarToXY(angle, r - stroke / 2);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const clampStep = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      if (step >= 1) return Math.round(clamped / step) * step;
      const factor = 1 / step;
      return Math.round(clamped * factor) / factor;
    },
    [min, max, step]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startVal.current = value;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dy = startY.current - ev.clientY;
        const range = max - min;
        const sensitivity = ev.shiftKey ? 0.002 : 0.008;
        const newVal = clampStep(startVal.current + dy * range * sensitivity);
        onChangeRef.current(newVal);
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [value, min, max, clampStep]
  );

  // Fix: attach wheel as non-passive via native addEventListener (React attaches passive by default)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const delta = e.shiftKey ? step : step * 5;
      onChangeRef.current(clampStep(value + dir * delta));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [value, step, clampStep]);

  const onDblClick = useCallback(() => {
    // Reset to center
    onChange(clampStep((min + max) / 2));
  }, [min, max, onChange, clampStep]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      learnKnob(id, (cc, val) => {
        const mapped = min + (val / 127) * (max - min);
        onChange(clampStep(mapped));
      });
    },
    [id, min, max, onChange, clampStep, learnKnob]
  );

  const displayValue = formatValue
    ? formatValue(value)
    : `${value.toFixed(decimals)}${unit}`;

  return (
    <div
      className="knob-container"
      onDoubleClick={onDblClick}
      title={`${label}: ${displayValue} | Right-click for MIDI Learn | Shift+drag for fine control`}
    >
      <svg
        ref={svgRef}
        width={svgSize}
        height={svgSize}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        style={{ cursor: "ns-resize", userSelect: "none" }}
        className={learning ? "midi-learning" : ""}
      >
        <defs>
          <filter id={`glow-${id}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track (full arc background) */}
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* Active arc */}
        <path
          d={arcPath(startAngle, angle, r)}
          fill="none"
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          filter={`url(#glow-${id})`}
          style={{ transition: "d 0.05s ease" }}
        />

        {/* Center circle */}
        <circle cx={cx} cy={cy} r={r * 0.38} fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

        {/* Indicator dot */}
        <circle
          cx={indicator.x}
          cy={indicator.y}
          r={stroke * 0.9}
          fill={arc}
          filter={`url(#glow-${id})`}
        />

        {/* MIDI indicator */}
        {hasMidi && (
          <circle cx={svgSize - 5} cy={5} r={3} fill="#ffdd00" />
        )}
      </svg>

      <span className="knob-label">{label}</span>
      <span className="knob-value" style={{ fontSize, color: learning ? "#ffdd00" : undefined }}>
        {learning ? "MIDI…" : displayValue}
      </span>
    </div>
  );
}
