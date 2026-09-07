import { useState } from "react";
import { assessment } from "../data";
import { useProgress } from "../state/ProgressContext";
import { Markdown } from "../lib/markdown";
import { Modal } from "./Modal";
import { Bar, Button, Callout, Pill, Stat } from "./primitives";

export function scoreArea(checks: Record<number, boolean>, total: number): number {
  const n = Object.values(checks).filter(Boolean).length;
  return Math.round((n / total) * 100);
}

export function AssessmentRunner({ onClose }: { onClose: () => void }) {
  const { progress, update } = useProgress();
  const [showResult, setShowResult] = useState(false);

  const toggle = (areaId: string, idx: number) =>
    update((p) => {
      const area = p.assessment[areaId] ?? { checks: {} };
      const checks = { ...area.checks, [idx]: !area.checks[idx] };
      return { ...p, assessment: { ...p.assessment, [areaId]: { ...area, checks } } };
    });

  const commit = () => {
    update((p) => {
      const next = { ...p.assessment };
      for (const area of assessment.areas) {
        const cur = next[area.id] ?? { checks: {} };
        next[area.id] = { ...cur, score: scoreArea(cur.checks, area.checks.length) };
      }
      return { ...p, assessment: next };
    });
    setShowResult(true);
  };

  if (showResult) {
    const scored = assessment.areas.map((a) => ({
      area: a, score: progress.assessment[a.id]?.score ?? scoreArea(progress.assessment[a.id]?.checks ?? {}, a.checks.length),
    }));
    const ready = scored.filter((s) => s.score >= 80);
    const mid = scored.filter((s) => s.score >= 50 && s.score < 80);
    const gaps = scored.filter((s) => s.score < 50);
    const overall = Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length);
    const plan = [...gaps, ...mid].sort((a, b) => a.score - b.score).slice(0, 4);

    return (
      <Modal wide title="Your competency profile" subtitle={`Overall ${overall}% across 12 areas`} onClose={onClose}
        footer={<><Button variant="p" onClick={onClose}>Close</Button><div className="sp" />
          <Button variant="gh" onClick={() => setShowResult(false)}>Re-score</Button></>}>
        <div className="grid g3" style={{ marginBottom: 18 }}>
          <Stat label="Ready for interviews" value={<span style={{ color: "var(--ok)" }}>{ready.length}</span>} />
          <Stat label="Needs improvement" value={<span style={{ color: "var(--warn)" }}>{mid.length}</span>} />
          <Stat label="Major gaps" value={<span style={{ color: "var(--bad)" }}>{gaps.length}</span>} />
        </div>
        {[...scored].sort((a, b) => b.score - a.score).map(({ area, score }) => (
          <div key={area.id} style={{ marginBottom: 11 }}>
            <div className="row">
              <b style={{ fontSize: 13.4 }}>{area.name}</b><div className="sp" />
              <Pill tone={score >= 80 ? "ok" : score >= 50 ? "warn" : "bad"}>{score}%</Pill>
            </div>
            <div style={{ marginTop: 5 }}><Bar pct={score} tone={score >= 80 ? "ok" : score >= 50 ? "warn" : ""} /></div>
          </div>
        ))}
        <div className="sect"><div className="h2">Recommended next 30 days</div><div className="line" /></div>
        {plan.length === 0 ? (
          <Callout tone="ok"><div className="prose">
            Every area is at interview standard. Spend the next 30 days applying, not studying: three tailored
            applications a week, and keep the capstone deployed and warm.
          </div></Callout>
        ) : plan.map(({ area, score }, i) => (
          <div key={area.id} style={{ marginBottom: 9 }}>
            <Callout tone={score < 50 ? "bad" : ""}>
              <div className="h3" style={{ marginBottom: 5 }}>{i + 1}. {area.name} — {score}%</div>
              <Markdown text={area.nextThirtyDays} />
            </Callout>
          </div>
        ))}
      </Modal>
    );
  }

  return (
    <Modal wide title="Final competency assessment"
      subtitle="Tick only what you can demonstrate right now, without notes. Honest scores generate a useful plan; inflated ones waste your next month."
      onClose={onClose}
      footer={<><Button variant="p" onClick={commit}>Score me</Button><div className="sp" />
        <Button variant="gh" onClick={onClose}>Close</Button></>}>
      {assessment.areas.map((area) => {
        const st = progress.assessment[area.id] ?? { checks: {} };
        const n = Object.values(st.checks).filter(Boolean).length;
        return (
          <div key={area.id} style={{ marginBottom: 20 }}>
            <div className="row">
              <div className="h3">{area.name}</div><div className="sp" />
              <Pill tone="out">{Math.round((n / area.checks.length) * 100)}%</Pill>
            </div>
            {area.checks.map((c, i) => (
              <div key={i} className={`qopt${st.checks[i] ? " right" : ""}`} style={{ marginTop: 6 }}
                onClick={() => toggle(area.id, i)} role="checkbox" aria-checked={Boolean(st.checks[i])} tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") toggle(area.id, i); }}>
                <div className="qi">{st.checks[i] ? "✓" : ""}</div><div>{c}</div>
              </div>
            ))}
          </div>
        );
      })}
    </Modal>
  );
}
