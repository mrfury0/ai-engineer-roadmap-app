import { resourceById } from "../data";
import type { LearnRef } from "../types";

const ICONS: Record<string, string> = {
  docs: "📘", tutorial: "🧭", video: "▶", article: "📝", repo: "◈",
  course: "🎓", book: "📗", paper: "📄", tool: "🔧",
};

export function ResourceCard({ learn }: { learn: LearnRef }) {
  const r = resourceById.get(learn.resId);
  if (!r) return null;
  const costLabel =
    r.cost === "free" ? <span style={{ color: "var(--ok)" }}>Free</span>
    : r.cost === "paid" ? <span style={{ color: "var(--warn)" }}>Paid</span>
    : <span style={{ color: "var(--cy)" }}>Free tier</span>;

  return (
    <div className="res">
      <div className="ricon">{ICONS[r.type] ?? "🔗"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 7 }}>
          <a className="rt" href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a>
          <span className={`pill ${learn.primary ? "ac" : "out"}`}>{learn.primary ? "Primary" : "Optional"}</span>
        </div>
        <div className="rp">
          {r.provider} · {r.type} · ~{r.minutes}m · {costLabel} ·{" "}
          {r.verified ? (
            <span className="vbadge" title={`Link checked ${r.lastVerified ?? ""}${r.status === "moved" ? " — updated to the current URL" : ""}`}>
              ✓ Verified{r.status === "moved" ? " (updated)" : ""}
            </span>
          ) : (
            <span className="vbadge q" title={r.note}>⚠ Not auto-checked</span>
          )}
          <span className="dim"> · checked {r.lastVerified ?? "—"}</span>
        </div>
        {learn.focus ? (
          <div className="rf"><b style={{ color: "var(--tx-2)" }}>Read exactly this:</b> {learn.focus}</div>
        ) : null}
      </div>
    </div>
  );
}
