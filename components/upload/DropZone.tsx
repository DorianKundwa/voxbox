"use client";

import { useCallback, useState } from "react";
import { useAudioStore } from "@/store/audioStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { useChainStore } from "@/store/chainStore";

// In dev, Next.js proxies /api/* → http://localhost:8000/api/* (see next.config.ts)
// In prod, NEXT_PUBLIC_API_URL should point to the deployed backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : "/api";

async function analyzeFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).features;
}

async function getRecommendation(refFeatures: any, dryFeatures: any, mode: string) {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_features: refFeatures, dry_features: dryFeatures, mode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).chain;
}

interface DropZoneProps {
  type: "reference" | "dry";
}

export function DropZone({ type }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const { setReferenceFile, setDryFile, referenceFile, dryFile } = useAudioStore();
  const {
    setReferenceFeatures, setDryFeatures,
    setAnalyzingReference, setAnalyzingDry,
    setError, referenceFeatures, dryFeatures
  } = useAnalysisStore();
  const { applyRecommendation } = useChainStore();

  const isRef = type === "reference";
  const file = isRef ? referenceFile : dryFile;
  const color = isRef ? "#7c3aed" : "#06b6d4";
  const label = isRef ? "Reference Vocal" : "Dry Vocal";
  const icon = isRef ? "🎤" : "🎙️";
  const subtitle = isRef
    ? "The professionally mixed vocal you want to match"
    : "Your raw unprocessed recording";

  const handleFile = useCallback(
    async (f: File) => {
      if (isRef) {
        setReferenceFile(f);
        setAnalyzingReference(true);
      } else {
        setDryFile(f);
        setAnalyzingDry(true);
      }

      try {
        const features = await analyzeFile(f);
        if (isRef) {
          setReferenceFeatures(features);
          setAnalyzingReference(false);
          // If dry already analyzed, compute recommendation
          if (dryFeatures) {
            const rec = await getRecommendation(features, dryFeatures, "adapt");
            applyRecommendation(rec);
          }
        } else {
          setDryFeatures(features);
          setAnalyzingDry(false);
          if (referenceFeatures) {
            const rec = await getRecommendation(referenceFeatures, features, "adapt");
            applyRecommendation(rec);
          }
        }
      } catch (err: any) {
        setError(err.message || "Analysis failed");
        if (isRef) setAnalyzingReference(false);
        else setAnalyzingDry(false);
      }
    },
    [isRef, dryFeatures, referenceFeatures, setReferenceFile, setDryFile,
      setReferenceFeatures, setDryFeatures, setAnalyzingReference, setAnalyzingDry,
      setError, applyRecommendation]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  return (
    <label
      className={`upload-zone ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "24px 20px",
        minHeight: 130,
        borderColor: file ? color : undefined,
        background: file ? `${color}10` : undefined,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="file"
        accept="audio/*"
        className="sr-only"
        onChange={onInputChange}
      />

      <div style={{ fontSize: 28 }}>{file ? "✅" : icon}</div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: file ? color : "var(--text-primary)", marginBottom: 2 }}>
          {file ? file.name : label}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Click to replace`
            : subtitle}
        </div>
      </div>

      {!file && (
        <div style={{
          marginTop: 4, padding: "4px 12px", borderRadius: 4,
          background: `${color}20`, border: `1px solid ${color}40`,
          fontSize: 11, fontWeight: 600, color,
        }}>
          Drop audio or click to browse
        </div>
      )}

      {file && (
        <div style={{
          width: "80%", height: 3, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}, transparent)`,
          marginTop: 4,
        }} />
      )}
    </label>
  );
}
