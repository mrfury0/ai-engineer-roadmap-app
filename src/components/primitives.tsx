import type { ReactNode } from "react";

export function Card({ children, className = "", onClick, style }: {
  children: ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`card ${className}`}
      style={onClick ? { cursor: "pointer", ...style } : style}
      onClick={onClick}
      {...(onClick ? { role: "button", tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") onClick(); } } : {})}
    >
      {children}
    </div>
  );
}

export type PillTone = "ac" | "ok" | "warn" | "bad" | "pur" | "cy" | "out" | "";

export function Pill({ tone = "", children, title, onClick }: {
  tone?: PillTone; children: ReactNode; title?: string; onClick?: () => void;
}) {
  const cls = `pill ${tone}`.trim();
  return onClick
    ? <button className={cls} title={title} onClick={onClick} type="button">{children}</button>
    : <span className={cls} title={title}>{children}</span>;
}

export function Bar({ pct, tone = "", tall = false }: { pct: number; tone?: "ok" | "warn" | "grad" | ""; tall?: boolean }) {
  return (
    <div className={`bar${tall ? " tall" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i className={tone} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {note ? <div className="n">{note}</div> : null}
    </div>
  );
}

export function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="sect">
      <div className="h2">{title}</div>
      <div className="line" />
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = "", size = "", disabled, title, type = "button" }: {
  children: ReactNode; onClick?: () => void;
  variant?: "p" | "g" | "gh" | ""; size?: "sm" | "lg" | ""; disabled?: boolean; title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button className={`btn ${variant} ${size}`.trim()} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

export function Empty({ icon = "✓", children }: { icon?: string; children: ReactNode }) {
  return <div className="empty"><div className="e1">{icon}</div><div>{children}</div></div>;
}

export function Callout({ tone = "", children }: { tone?: "ok" | "bad" | "ac" | ""; children: ReactNode }) {
  return <div className={`callout ${tone}`.trim()}>{children}</div>;
}

export function Difficulty({ level }: { level: number }) {
  return (
    <span className="pill out" title={`Difficulty ${level}/5`} style={{ gap: 2, fontSize: 8, padding: "3px 7px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= level ? "var(--tx-2)" : "var(--tx-4)" }}>●</span>
      ))}
    </span>
  );
}
