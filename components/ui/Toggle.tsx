"use client";

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  color?: "violet" | "cyan" | "green" | "orange";
}

export function Toggle({ id, checked, onChange, label, color = "violet" }: ToggleProps) {
  const colors = {
    violet: { active: "#7c3aed", glow: "rgba(124,58,237,0.4)" },
    cyan:   { active: "#06b6d4", glow: "rgba(6,182,212,0.4)"  },
    green:  { active: "#39ff14", glow: "rgba(57,255,20,0.3)"  },
    orange: { active: "#ff6600", glow: "rgba(255,102,0,0.3)"  },
  };
  const { active, glow } = colors[color];

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 cursor-pointer"
      title={label}
    >
      <div className="relative" style={{ width: 32, height: 18 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        {/* Track */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 9,
            background: checked ? active : "rgba(255,255,255,0.08)",
            border: `1px solid ${checked ? active : "rgba(255,255,255,0.1)"}`,
            boxShadow: checked ? `0 0 8px ${glow}` : "none",
            transition: "all 0.2s ease",
          }}
        />
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 15 : 3,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: checked ? "white" : "rgba(255,255,255,0.5)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            transition: "left 0.2s ease, background 0.2s ease",
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 600, color: checked ? "var(--text-primary)" : "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
      )}
    </label>
  );
}
