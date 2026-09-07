import { useEffect } from "react";
import type { ViewProps } from "../App";
import { projects } from "../data";
import type { ProjectStatus } from "../types";
import { useProgress } from "../state/ProgressContext";
import { portfolioReadiness, projectChecklistScore } from "../lib/selectors";
import { Bar, Button, Card, Pill, Section } from "../components/primitives";
import type { PillTone } from "../components/primitives";

const statusTone = (s: ProjectStatus): PillTone =>
  s === "shipped" ? "ok" : s === "building" ? "warn" : "out";

export function Portfolio({ navigate, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Portfolio</b>), [setCrumbs]);

  const score = portfolioReadiness(progress);
  const verdict: { label: string; tone: PillTone } =
    score >= 80 ? { label: "Interview-ready", tone: "ok" }
      : score >= 50 ? { label: "Getting there", tone: "warn" }
        : { label: "Not yet shareable", tone: "bad" };

  const missing = new Map<string, number>();
  for (const p of projects) {
    const got = progress.portfolio[p.id] ?? {};
    for (const c of p.checklist) {
      if (!got[c.id]) missing.set(c.label, (missing.get(c.label) ?? 0) + 1);
    }
  }
  const gaps = [...missing.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="page">
      <div>
        <div className="h1">Portfolio</div>
        <div className="sub">
          Hiring managers spend 90 seconds on a repo. These are the things they look for, per
          project.
        </div>
      </div>

      <Card style={{ margin: "16px 0" }}>
        <div className="row wrap" style={{ gap: 14 }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 680, letterSpacing: "-.04em", lineHeight: 1 }}>
              {score}%
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <Pill tone={verdict.tone}>{verdict.label}</Pill>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="h3" style={{ marginBottom: 8 }}>Portfolio Readiness Score</div>
            <div className="prose">
              Weighted across all ten projects — the capstone counts most. A project only scores when
              every artefact exists: repo, README, diagram, screenshots, deployment, tests,
              decisions, limitations, next steps, and published numbers.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Bar pct={score} tone="grad" tall />
        </div>
      </Card>

      <Card className="pad0">
        <table className="t">
          <thead>
            <tr>
              <th>Project</th><th>Tier</th><th>Status</th><th>Checklist</th><th>Readiness</th><th />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const ps = projectChecklistScore(progress, p);
              const status = progress.projStatus[p.id] ?? "not-started";
              return (
                <tr key={p.id}>
                  <td><b style={{ color: "var(--tx)" }}>{p.name}</b></td>
                  <td>{p.tier}</td>
                  <td><Pill tone={statusTone(status)}>{status}</Pill></td>
                  <td>{ps.n}/{ps.total}</td>
                  <td style={{ width: 150 }}>
                    <Bar pct={ps.pct} tone={ps.pct === 100 ? "ok" : ""} />
                  </td>
                  <td>
                    <Button size="sm" variant="gh" onClick={() => navigate("projects", p.id)}>
                      Open
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {gaps.length ? (
        <>
          <Section title="Most common gap" />
          <Card>
            <div className="row wrap" style={{ gap: 8 }}>
              {gaps.slice(0, 6).map(([label, n]) => (
                <Pill key={label} tone="warn">{label} · missing on {n}</Pill>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
