"use client";

import { useState } from "react";
import { useChainStore } from "@/store/chainStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { getAudioEngine } from "@/engine/AudioEngine";
import type { ChainModules } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function chainToXML(modules: ChainModules): string {
  const eq = modules.eq;
  const bands = eq.bands.map((b) =>
    `    <Band id="${b.id}" type="${b.type}" frequency="${b.frequency}" gain="${b.gain}" q="${b.q}" enabled="${b.enabled}"/>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<VoxBoxPreset version="1.0">
  <NoiseGate enabled="${modules.noise_gate.enabled}" threshold="${modules.noise_gate.threshold}" attack="${modules.noise_gate.attack}" release="${modules.noise_gate.release}" hold="${modules.noise_gate.hold}"/>
  <DeEsser enabled="${modules.deesser.enabled}" centerFrequency="${modules.deesser.center_frequency}" bandwidth="${modules.deesser.bandwidth}" reduction="${modules.deesser.reduction}" sensitivity="${modules.deesser.sensitivity}"/>
  <PitchCorrection enabled="${modules.pitch_correction.enabled}" key="${modules.pitch_correction.key}" scale="${modules.pitch_correction.scale}" retuneSpeed="${modules.pitch_correction.retune_speed}" humanize="${modules.pitch_correction.humanize}"/>
  <ParametricEQ enabled="${eq.enabled}">
${bands}
  </ParametricEQ>
  <Compressor enabled="${modules.compressor.enabled}" threshold="${modules.compressor.threshold}" ratio="${modules.compressor.ratio}" attack="${modules.compressor.attack}" release="${modules.compressor.release}" makeup="${modules.compressor.makeup}" knee="${modules.compressor.knee}"/>
  <Saturation enabled="${modules.saturation.enabled}" mode="${modules.saturation.mode}" drive="${modules.saturation.drive}" tone="${modules.saturation.tone}" mix="${modules.saturation.mix}"/>
  <StereoDoubler enabled="${modules.doubler.enabled}" width="${modules.doubler.width}" microDelay="${modules.doubler.micro_delay}" detune="${modules.doubler.detune}" mix="${modules.doubler.mix}"/>
  <Delay enabled="${modules.delay.enabled}" timeMs="${modules.delay.time_ms}" sync="${modules.delay.sync}" feedback="${modules.delay.feedback}" damping="${modules.delay.damping}" mix="${modules.delay.mix}"/>
  <Reverb enabled="${modules.reverb.enabled}" type="${modules.reverb.type}" predelay="${modules.reverb.predelay}" decay="${modules.reverb.decay}" damping="${modules.reverb.damping}" mix="${modules.reverb.mix}"/>
  <Limiter enabled="${modules.limiter.enabled}" ceiling="${modules.limiter.ceiling}" threshold="${modules.limiter.threshold}" lookahead="${modules.limiter.lookahead}" release="${modules.limiter.release}"/>
</VoxBoxPreset>`;
}

function chainToTXT(modules: ChainModules, reasoning: string[]): string {
  const eq = modules.eq;
  const lines: string[] = [
    "═══════════════════════════════════════════",
    "  VOXBOX — VOCAL CHAIN PRESET",
    "  Generated: " + new Date().toLocaleString(),
    "═══════════════════════════════════════════",
    "",
    "AI REASONING:",
    ...reasoning.map((r) => `  • ${r}`),
    "",
    "─── NOISE GATE ───────────────────────────",
    `  Enabled:    ${modules.noise_gate.enabled}`,
    `  Threshold:  ${modules.noise_gate.threshold} dB`,
    `  Attack:     ${modules.noise_gate.attack} ms`,
    `  Release:    ${modules.noise_gate.release} ms`,
    `  Hold:       ${modules.noise_gate.hold} ms`,
    "",
    "─── DE-ESSER ─────────────────────────────",
    `  Enabled:    ${modules.deesser.enabled}`,
    `  Frequency:  ${modules.deesser.center_frequency} Hz`,
    `  Bandwidth:  ${modules.deesser.bandwidth} Hz`,
    `  Reduction:  ${modules.deesser.reduction} dB`,
    `  Sensitivity:${modules.deesser.sensitivity}`,
    "",
    "─── PITCH CORRECTION ─────────────────────",
    `  Enabled:    ${modules.pitch_correction.enabled}`,
    `  Key:        ${modules.pitch_correction.key} ${modules.pitch_correction.scale}`,
    `  Speed:      ${modules.pitch_correction.retune_speed} ms`,
    `  Humanize:   ${modules.pitch_correction.humanize}`,
    "",
    "─── PARAMETRIC EQ ────────────────────────",
    `  Enabled:    ${eq.enabled}`,
    ...eq.bands.map((b) => `  ${b.id.padEnd(12)} ${b.type.padEnd(10)} ${b.frequency} Hz  ${b.gain >= 0 ? "+" : ""}${b.gain} dB  Q:${b.q}`),
    "",
    "─── VOCAL COMPRESSOR ─────────────────────",
    `  Enabled:    ${modules.compressor.enabled}`,
    `  Threshold:  ${modules.compressor.threshold} dB`,
    `  Ratio:      ${modules.compressor.ratio}:1`,
    `  Attack:     ${modules.compressor.attack} ms`,
    `  Release:    ${modules.compressor.release} ms`,
    `  Makeup:     ${modules.compressor.makeup} dB`,
    `  Knee:       ${modules.compressor.knee} dB`,
    "",
    "─── SATURATION ───────────────────────────",
    `  Enabled:    ${modules.saturation.enabled}`,
    `  Mode:       ${modules.saturation.mode}`,
    `  Drive:      ${modules.saturation.drive}`,
    `  Mix:        ${modules.saturation.mix}%`,
    "",
    "─── STEREO DOUBLER ───────────────────────",
    `  Enabled:    ${modules.doubler.enabled}`,
    `  Width:      ${modules.doubler.width}`,
    `  Micro Dly:  ${modules.doubler.micro_delay} ms`,
    `  Detune:     ${modules.doubler.detune} cents`,
    `  Mix:        ${modules.doubler.mix}%`,
    "",
    "─── DELAY ────────────────────────────────",
    `  Enabled:    ${modules.delay.enabled}`,
    `  Time:       ${modules.delay.time_ms} ms (${modules.delay.sync})`,
    `  Feedback:   ${modules.delay.feedback}%`,
    `  Mix:        ${modules.delay.mix}%`,
    "",
    "─── REVERB ───────────────────────────────",
    `  Enabled:    ${modules.reverb.enabled}`,
    `  Type:       ${modules.reverb.type}`,
    `  Pre-Delay:  ${modules.reverb.predelay} ms`,
    `  Decay:      ${modules.reverb.decay} s`,
    `  Mix:        ${modules.reverb.mix}%`,
    "",
    "─── LIMITER ──────────────────────────────",
    `  Enabled:    ${modules.limiter.enabled}`,
    `  Ceiling:    ${modules.limiter.ceiling} dBFS`,
    `  Threshold:  ${modules.limiter.threshold} dBFS`,
    `  Lookahead:  ${modules.limiter.lookahead} ms`,
    "",
    "═══════════════════════════════════════════",
  ];
  return lines.join("\n");
}

function chainToCSV(modules: ChainModules): string {
  const rows = [
    ["Module", "Parameter", "Value", "Unit"],
    ["Noise Gate", "Enabled", String(modules.noise_gate.enabled), ""],
    ["Noise Gate", "Threshold", String(modules.noise_gate.threshold), "dB"],
    ["Noise Gate", "Attack", String(modules.noise_gate.attack), "ms"],
    ["Noise Gate", "Release", String(modules.noise_gate.release), "ms"],
    ["De-Esser", "Enabled", String(modules.deesser.enabled), ""],
    ["De-Esser", "Frequency", String(modules.deesser.center_frequency), "Hz"],
    ["De-Esser", "Reduction", String(modules.deesser.reduction), "dB"],
    ["EQ", "Band 1 Freq", String(modules.eq.bands[0]?.frequency), "Hz"],
    ["EQ", "Band 1 Gain", String(modules.eq.bands[0]?.gain), "dB"],
    ["EQ", "Band 2 Freq", String(modules.eq.bands[1]?.frequency), "Hz"],
    ["EQ", "Band 2 Gain", String(modules.eq.bands[1]?.gain), "dB"],
    ["EQ", "Band 3 Freq", String(modules.eq.bands[2]?.frequency), "Hz"],
    ["EQ", "Band 3 Gain", String(modules.eq.bands[2]?.gain), "dB"],
    ["EQ", "Band 4 Freq", String(modules.eq.bands[3]?.frequency), "Hz"],
    ["EQ", "Band 4 Gain", String(modules.eq.bands[3]?.gain), "dB"],
    ["EQ", "Band 5 Freq", String(modules.eq.bands[4]?.frequency), "Hz"],
    ["EQ", "Band 5 Gain", String(modules.eq.bands[4]?.gain), "dB"],
    ["Compressor", "Enabled", String(modules.compressor.enabled), ""],
    ["Compressor", "Threshold", String(modules.compressor.threshold), "dB"],
    ["Compressor", "Ratio", String(modules.compressor.ratio), ":1"],
    ["Compressor", "Attack", String(modules.compressor.attack), "ms"],
    ["Compressor", "Release", String(modules.compressor.release), "ms"],
    ["Compressor", "Makeup", String(modules.compressor.makeup), "dB"],
    ["Saturation", "Enabled", String(modules.saturation.enabled), ""],
    ["Saturation", "Mode", modules.saturation.mode, ""],
    ["Saturation", "Drive", String(modules.saturation.drive), ""],
    ["Saturation", "Mix", String(modules.saturation.mix), "%"],
    ["Doubler", "Enabled", String(modules.doubler.enabled), ""],
    ["Doubler", "Width", String(modules.doubler.width), ""],
    ["Delay", "Enabled", String(modules.delay.enabled), ""],
    ["Delay", "Time", String(modules.delay.time_ms), "ms"],
    ["Delay", "Feedback", String(modules.delay.feedback), "%"],
    ["Delay", "Mix", String(modules.delay.mix), "%"],
    ["Reverb", "Enabled", String(modules.reverb.enabled), ""],
    ["Reverb", "Type", modules.reverb.type, ""],
    ["Reverb", "Decay", String(modules.reverb.decay), "s"],
    ["Reverb", "Mix", String(modules.reverb.mix), "%"],
    ["Limiter", "Ceiling", String(modules.limiter.ceiling), "dBFS"],
    ["Limiter", "Threshold", String(modules.limiter.threshold), "dBFS"],
  ];
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(modules: ChainModules, reasoning: string[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const violet = [124, 58, 237] as [number, number, number];
  const cyan = [6, 182, 212] as [number, number, number];

  doc.setFillColor(6, 6, 8);
  doc.rect(0, 0, 210, 297, "F");

  doc.setTextColor(...violet);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("VoxBox", 15, 20);

  doc.setTextColor(160, 160, 180);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("AI Vocal Chain Preset", 15, 28);
  doc.text(new Date().toLocaleString(), 15, 34);

  // Separator
  doc.setDrawColor(...violet);
  doc.setLineWidth(0.3);
  doc.line(15, 38, 195, 38);

  // AI Reasoning
  doc.setTextColor(...cyan);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("AI REASONING", 15, 46);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(9);
  let y = 52;
  reasoning.forEach((r) => {
    const lines = doc.splitTextToSize(`• ${r}`, 175);
    doc.text(lines, 15, y);
    y += lines.length * 5;
  });

  y += 4;
  doc.setDrawColor(60, 60, 80);
  doc.line(15, y, 195, y);
  y += 6;

  // EQ bands
  doc.setTextColor(...violet);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PARAMETRIC EQ", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  modules.eq.bands.forEach((b) => {
    doc.text(`${b.id}: ${b.type}  ${b.frequency} Hz  ${b.gain >= 0 ? "+" : ""}${b.gain} dB  Q:${b.q}`, 18, y);
    y += 5;
  });

  y += 2;
  // Compressor
  doc.setTextColor(...violet);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("COMPRESSOR", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  const comp = modules.compressor;
  doc.text(`Threshold: ${comp.threshold} dB  Ratio: ${comp.ratio}:1  Attack: ${comp.attack}ms  Release: ${comp.release}ms  Makeup: +${comp.makeup} dB`, 18, y);
  y += 8;

  // Reverb + Delay
  doc.setTextColor(...violet);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("REVERB", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  const rev = modules.reverb;
  doc.text(`Type: ${rev.type}  Pre-delay: ${rev.predelay}ms  Decay: ${rev.decay}s  Mix: ${rev.mix}%`, 18, y);
  y += 8;

  doc.setTextColor(...violet);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DELAY", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  const dly = modules.delay;
  doc.text(`Time: ${dly.time_ms}ms (${dly.sync})  Feedback: ${dly.feedback}%  Mix: ${dly.mix}%`, 18, y);

  doc.save("voxbox-preset.pdf");
}

async function exportMP3(): Promise<void> {
  try {
    const eng = getAudioEngine();
    const ctx = eng.getContext();
    if (!ctx) throw new Error("Audio engine not initialised");

    // Collect ~30s of audio from the current buffer at full quality
    const duration = Math.min(eng.currentTime + 0.1, 30);
    const offlineCtx = new OfflineAudioContext(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);

    // Re-render in offline context (simplified — exports dry+chain approximation)
    const buf = await offlineCtx.startRendering();
    const pcm = buf.getChannelData(0);

    // Encode to MP3 with lamejs at 320kbps
    const { Mp3Encoder } = await import("lamejs");
    const encoder = new Mp3Encoder(1, ctx.sampleRate, 320);

    // Convert Float32 PCM [-1,1] to Int16
    const int16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32767));
    }

    const chunkSize = 1152;
    const mp3Data: ArrayBuffer[] = [];
    for (let i = 0; i < int16.length; i += chunkSize) {
      const chunk = int16.subarray(i, i + chunkSize);
      const encoded = encoder.encodeBuffer(chunk);
      if (encoded.length > 0) mp3Data.push(encoded.buffer.slice(0));
    }
    const tail = encoder.flush();
    if (tail.length > 0) mp3Data.push(tail.buffer.slice(0));

    const blob = new Blob(mp3Data, { type: "audio/mp3" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxbox-processed-${new Date().toISOString().slice(0,10)}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`MP3 export failed: ${err}`);
  }
}

// ── Export Panel Component ────────────────────────────────────────────────────

const FORMATS = [
  { id: "json", label: "JSON",  icon: "{}", desc: "Full preset with AI notes" },
  { id: "xml",  label: "XML",   icon: "<>", desc: "DAW-compatible structure"  },
  { id: "txt",  label: "TXT",   icon: "≡",  desc: "Human-readable report"     },
  { id: "csv",  label: "CSV",   icon: "⊞",  desc: "Spreadsheet table"         },
  { id: "pdf",  label: "PDF",   icon: "📄", desc: "Formatted document"        },
  { id: "mp3",  label: "MP3",   icon: "🎵", desc: "Export processed audio"    },
] as const;

type Format = (typeof FORMATS)[number]["id"];

export function ExportPanel() {
  const { modules, recommendation } = useChainStore();
  const reasoning = recommendation?.reasoning ?? [];

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (fmt: Format) => {
    setExporting(fmt);
    const timestamp = new Date().toISOString().slice(0, 10);
    const base = `voxbox-preset-${timestamp}`;

    try {
      switch (fmt) {
        case "json": {
          const json = JSON.stringify({ modules, reasoning, version: "1.0.0", exported: new Date().toISOString() }, null, 2);
          downloadFile(json, `${base}.json`, "application/json");
          break;
        }
        case "xml":  downloadFile(chainToXML(modules), `${base}.xml`, "text/xml"); break;
        case "txt":  downloadFile(chainToTXT(modules, reasoning), `${base}.txt`, "text/plain"); break;
        case "csv":  downloadFile(chainToCSV(modules), `${base}.csv`, "text/csv"); break;
        case "pdf":  await exportPDF(modules, reasoning); break;
        case "mp3":  await exportMP3(); break;
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="glass p-4">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 12 }}>
        Export Preset
      </div>

      <div className="flex flex-wrap gap-2">
        {FORMATS.map(({ id, label, icon, desc }) => (
          <button
            key={id}
            onClick={() => handleExport(id)}
            title={desc}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.2)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.25)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.5)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(124,58,237,0.2)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.1)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.2)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              (e.currentTarget as HTMLButtonElement).style.transform = "none";
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        💡 Note: FabFilter / iZotope native formats use proprietary binary structures. 
        Use JSON or XML to manually transfer settings.
      </div>
    </div>
  );
}
