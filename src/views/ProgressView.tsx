import { useEffect } from "react";
import type { ViewProps } from "../App";
import { assessment, weeks } from "../data";
import type { AssessmentArea } from "../types";
import { useProgress } from "../state/ProgressContext";
import { earnedXp, levelFromXp, overallProgress, portfolioReadiness, weekProgress } from "../lib/selectors";
import { humanMinutes } from "../lib/dates";
import { Bar, Button, Card, Pill, Section, Stat } from "../components/primitives";

export function ProgressView({ openOverlay, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Progress</b>), [setCrumbs]);

  const overall = overallProgress(progress);
  const level = levelFromXp(earnedXp(progress));
  const last = progress.sessions.slice(-28);
  const maxMinutes = last.reduce((m, s) => Math.max(m, s.m), 0);

  const scored = assessment.areas
    .map((area) => ({ area, score: progress.assessment[area.id]?.score }))
    .filter((x): x is { area: AssessmentArea; score: number } => typeof x.score === "number");

  return (
    <div className="page">
      <div className="h1">Progress</div>
      <div className="sub">The honest version. No inflation — that is the point of the final assessment.</div>

      <div className="grid g4" style={{ margin: "16px 0" }}>
        <Stat label="Course" value={`${overall.pct}%`} note={`${overall.done}/${overall.total} steps`} />
        <Stat label="XP" value={earnedXp(progress).toLocaleString()} note={`level ${level.level}`} />
        <Stat label="Hours" value={(progress.minutes / 60).toFixed(1)} note={`across ${progress.sessions.length} days`} />
        <Stat label="Portfolio" value={`${portfolioReadiness(progress)}%`} note="readiness score" />
      </div>

      <Section title="Week by week" />
      <Card className="pad0">
        <table className="t">
          <thead>
            <tr><th>Week</th><th>Focus</th><th>Steps</th><th>Progress</th><th>Quiz</th></tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const wp = weekProgress(progress, w);
              const q = w.quiz ? progress.quiz[w.quiz.id] : undefined;
              return (
                <tr key={w.id}>
                  <td><b style={{ color: "var(--tx)" }}>{w.week}</b></td>
                  <td>{w.title}</td>
                  <td>{wp.done}/{wp.total}</td>
                  <td style={{ width: 170 }}><Bar pct={wp.pct} tone={wp.pct === 100 ? "ok" : ""} /></td>
                  <td>
                    {q
                      ? <Pill tone={q.best >= 70 ? "ok" : "warn"}>{q.best}%</Pill>
                      : <span className="dim">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {last.length ? (
        <>
          <Section title={`Study log (last ${last.length} active days)`} />
          <Card>
            <div className="row" style={{ alignItems: "flex-end", gap: 4, height: 110 }}>
              {last.map((s) => (
                <div
                  key={s.d}
                  title={`${s.d}: ${humanMinutes(s.m)}`}
                  style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
                >
                  <div style={{
                    background: "linear-gradient(180deg,var(--ac),var(--ac-2))",
                    borderRadius: 3,
                    height: `${Math.max(4, Math.round((s.m / maxMinutes) * 100))}%`,
                  }} />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      <Section title="Final competency assessment">
        <Button size="sm" onClick={() => openOverlay({ kind: "assessment" })}>Open assessment</Button>
      </Section>
      <Card>
        {scored.length ? (
          <div className="grid g3">
            {scored.map(({ area, score }) => {
              const verdict = score >= 80 ? "Ready for interviews" : score >= 50 ? "Needs improvement" : "Major gap";
              const tone = score >= 80 ? "ok" : score >= 50 ? "warn" : "bad";
              return (
                <div key={area.id} style={{ marginBottom: 9 }}>
                  <div className="row">
                    <b style={{ fontSize: 13 }}>{area.name}</b>
                    <div className="sp" />
                    <Pill tone={tone}>{score}%</Pill>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Bar pct={score} tone={score >= 80 ? "ok" : score >= 50 ? "warn" : ""} />
                  </div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>{verdict}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="prose">
              Twelve areas, scored on evidence you can point at — not on how much you read. Run it in the final
              week (or any time you want a reality check) and it generates your next-30-days plan from the gaps.
            </div>
            <div style={{ marginTop: 12 }}>
              <Button variant="p" onClick={() => openOverlay({ kind: "assessment" })}>Start the assessment</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
