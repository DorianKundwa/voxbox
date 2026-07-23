"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformViewProps {
  url: string | null;
  label: string;
  color?: string;
  /** Pass the isPlaying state only for visual cursor tracking — WaveSurfer does NOT own playback */
  isPlaying?: boolean;
}

export function WaveformView({ url, label, color = "#7c3aed" }: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef        = useRef<WaveSurfer | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    wsRef.current?.destroy();

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     `${color}60`,
      progressColor: color,
      cursorColor:   "rgba(255,255,255,0.4)",
      barWidth:      2,
      barGap:        1,
      barRadius:     2,
      height:        56,
      normalize:     true,
      interact:      false,   // display-only — AudioEngine owns playback
      backend:       "WebAudio",
    });

    ws.on("ready",      () => setDuration(ws.getDuration()));
    ws.on("timeupdate", (t: number) => setCurrentTime(t));
    wsRef.current = ws;

    if (url) ws.load(url);

    return () => ws.destroy();
  }, [url, color]);

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {duration > 0 && (
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        )}
      </div>

      {url ? (
        <div ref={containerRef} style={{ borderRadius: 4, overflow: "hidden" }} />
      ) : (
        <div style={{
          height: 56, borderRadius: 4,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>No audio loaded</span>
        </div>
      )}
    </div>
  );
}
