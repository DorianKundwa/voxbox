"use client";

/**
 * PitchDisplay — real-time pitch detection using pitchy (McLeod Pitch Method).
 * Reads from the AudioEngine's analyser, runs MPM on each frame,
 * and displays note + cents deviation + frequency.
 */

import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { getAudioEngine } from "@/engine/AudioEngine";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const midi  = 12 * Math.log2(freq / 440) + 69;
  const round = Math.round(midi);
  const cents = Math.round((midi - round) * 100);
  const note  = NOTE_NAMES[((round % 12) + 12) % 12];
  const octave = Math.floor(round / 12) - 1;
  return { note, octave, cents };
}

export function PitchDisplay() {
  const [pitch, setPitch]   = useState<number | null>(null);
  const [clarity, setClarity] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const BUF = 2048;
    const buf = new Float32Array(BUF);
    let detector: PitchDetector<Float32Array> | null = null;
    let analyser: AnalyserNode | null = null;
    let sr = 44100;

    function init() {
      try {
        const eng = getAudioEngine();
        const ctx = eng.getContext();
        if (!ctx) return false;
        sr       = ctx.sampleRate;
        analyser = eng.getAnalyserNode();
        if (!analyser) return false;
        analyser.fftSize = BUF;
        detector = PitchDetector.forFloat32Array(BUF);
        return true;
      } catch { return false; }
    }

    function tick() {
      if (!analyser || !detector) {
        if (!init()) { rafRef.current = requestAnimationFrame(tick); return; }
      }
      analyser!.getFloatTimeDomainData(buf);
      const [freq, cl] = detector!.findPitch(buf, sr);
      if (cl > 0.92 && freq > 60 && freq < 2000) {
        setPitch(freq);
        setClarity(cl);
      } else {
        setPitch(null);
        setClarity(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const info = pitch ? freqToNote(pitch) : null;
  const centsColour = info
    ? Math.abs(info.cents) < 5  ? "#39ff14"
    : Math.abs(info.cents) < 15 ? "#ffaa00"
    : "#ff4444"
    : "var(--text-secondary)";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "8px 14px",
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      minWidth: 90,
      gap: 2,
    }}>
      <div style={{ fontSize: 8, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Live Pitch
      </div>

      {/* Big note name */}
      <div style={{
        fontSize: 26, fontWeight: 800, lineHeight: 1,
        color: pitch ? "#ffffff" : "rgba(255,255,255,0.15)",
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "-0.02em",
        minHeight: 30,
      }}>
        {info ? `${info.note}${info.octave}` : "—"}
      </div>

      {/* Frequency */}
      <div style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
        {pitch ? `${pitch.toFixed(1)} Hz` : "no signal"}
      </div>

      {/* Cents deviation */}
      {info && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: centsColour,
          fontFamily: "JetBrains Mono, monospace",
        }}>
          {info.cents >= 0 ? "+" : ""}{info.cents}¢
        </div>
      )}

      {/* Cents tuning bar */}
      <div style={{
        width: 60, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2,
        position: "relative", overflow: "visible", marginTop: 2,
      }}>
        {/* Center tick */}
        <div style={{ position:"absolute", left:"50%", top:-1, width:1, height:5, background:"rgba(255,255,255,0.2)" }} />
        {/* Needle */}
        {info && (
          <div style={{
            position: "absolute",
            left: `${50 + (info.cents / 50) * 50}%`,
            top: -2, width: 3, height: 7,
            background: centsColour,
            borderRadius: 2,
            transform: "translateX(-50%)",
            transition: "left 0.1s ease, background 0.2s ease",
            boxShadow: `0 0 6px ${centsColour}`,
          }} />
        )}
      </div>

      {/* Clarity bar */}
      <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 1, marginTop: 4 }}>
        <div style={{
          height: "100%", borderRadius: 1,
          width: `${clarity * 100}%`,
          background: "#7c3aed",
          transition: "width 0.1s ease",
        }} />
      </div>
    </div>
  );
}
