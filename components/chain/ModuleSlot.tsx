"use client";

import React from "react";
import { Toggle } from "@/components/ui/Toggle";
import type { ModuleKey } from "@/lib/types";
import { useChainStore } from "@/store/chainStore";

interface ModuleSlotProps {
  moduleKey: ModuleKey;
  title: string;
  icon: string;
  color?: "violet" | "cyan" | "green" | "orange";
  children: React.ReactNode;
}

const COLOR_STYLES: Record<string, { header: string; indicator: string }> = {
  violet: { header: "rgba(124,58,237,0.15)", indicator: "#7c3aed" },
  cyan:   { header: "rgba(6,182,212,0.15)",  indicator: "#06b6d4" },
  green:  { header: "rgba(57,255,20,0.1)",   indicator: "#39ff14" },
  orange: { header: "rgba(255,102,0,0.12)",  indicator: "#ff6600" },
};

export function ModuleSlot({ moduleKey, title, icon, color = "violet", children }: ModuleSlotProps) {
  const { modules, toggleModule } = useChainStore();
  const mod = modules[moduleKey] as { enabled: boolean };
  const enabled = mod?.enabled ?? false;
  const { header, indicator } = COLOR_STYLES[color];

  return (
    <div
      className={`module-card ${enabled ? "active" : ""} flex flex-col`}
      style={{ minWidth: 0 }}
    >
      {/* Header */}
      <div
        style={{
          background: enabled ? header : "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "10px 10px 0 0",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "background 0.2s ease",
        }}
      >
        {/* Status indicator */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: enabled ? indicator : "rgba(255,255,255,0.15)",
            boxShadow: enabled ? `0 0 6px ${indicator}` : "none",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        />

        <span style={{ fontSize: 13, marginRight: 2 }}>{icon}</span>

        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: enabled ? "var(--text-primary)" : "var(--text-secondary)",
            flex: 1,
            transition: "color 0.2s ease",
          }}
        >
          {title}
        </span>

        <Toggle
          id={`toggle-${moduleKey}`}
          checked={enabled}
          onChange={() => toggleModule(moduleKey)}
          color={color}
        />
      </div>

      {/* Content */}
      <div
        style={{
          padding: "14px",
          opacity: enabled ? 1 : 0.4,
          transition: "opacity 0.2s ease",
          pointerEvents: enabled ? "auto" : "none",
          flex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
