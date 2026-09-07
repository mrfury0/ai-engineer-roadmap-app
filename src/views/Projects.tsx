import { useEffect } from "react";
import type { ViewProps } from "../App";
import { itemById, projectById, projects } from "../data";
import type { Project, ProjectStatus, ProjectTier } from "../types";
import { useProgress } from "../state/ProgressContext";
import { projectChecklistScore, projectItemProgress } from "../lib/selectors";
import { Bar, Card, Pill, Section } from "../components/primitives";
import type { PillTone } from "../components/primitives";
import { ItemCard } from "../components/ItemCard";

const TIER_NAME: Record<ProjectTier, string> = {
  mini: "Mini projects", medium: "Medium projects", capstone: "Capstone",
};
const TIER_TONE: Record<ProjectTier, PillTone> = { mini: "out", medium: "ac", capstone: "pur" };
const STATUSES: ProjectStatus[] = ["not-started", "building", "shipped"];

const statusTone = (s: ProjectStatus): PillTone =>
  s === "shipped" ? "ok" : s === "building" ? "warn" : "out";

export function Projects(props: ViewProps) {
  const { param } = props;
  const project = param ? projectById.get(param) : undefined;
  return project ? <ProjectDetail project={project} {...props} /> : <ProjectList {...props} />;
}

function ProjectList({ navigate, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Projects</b>), [setCrumbs]);

  return (
    <div className="page">
      <div>
        <div className="h1">Projects</div>
        <div className="sub">
          Ten builds, escalating. The capstone is the one that gets you interviews; the rest are the
          reps that make it possible.
        </div>
      </div>

      {(["mini", "medium", "capstone"] as const).map((tier) => {
        const list = projects.filter((p) => p.tier === tier);
        return (
          <div key={tier}>
            <Section title={TIER_NAME[tier]}>
              <Pill tone="out">{list.length}</Pill>
            </Section>
            <div className={`grid${tier === "capstone" ? "" : " g2"}`}>
              {list.map((p) => {
                const prog = projectItemProgress(progress, p);
                const score = projectChecklistScore(progress, p);
                const status = progress.projStatus[p.id] ?? "not-started";
                return (
                  <Card key={p.id} className="hov" onClick={() => navigate("projects", p.id)}>
                    <div className="row wrap" style={{ gap: 7 }}>
                      <Pill tone={TIER_TONE[tier]}>Week {p.week}</Pill>
                      <Pill tone={statusTone(status)}>{status}</Pill>
                      <div className="sp" />
                      <span className="dim" style={{ fontSize: 12 }}>
                        {score.n}/{score.total} portfolio
                      </span>
                    </div>
                    <div className="h2" style={{ margin: "9px 0 4px" }}>{p.name}</div>
                    <div className="sub" style={{ marginBottom: 10 }}>{p.blurb}</div>
                    <div className="row wrap" style={{ gap: 5, marginBottom: 10 }}>
                      {p.stack.slice(0, 7).map((s) => <Pill key={s} tone="out">{s}</Pill>)}
                    </div>
                    <Bar pct={prog.pct} tone={prog.pct === 100 ? "ok" : ""} />
                    <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
                      {prog.done}/{prog.total} roadmap steps done
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectDetail({ project, navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer, setCrumbs }: ViewProps & { project: Project }) {
  const { progress, togglePortfolio, setProjectStatus } = useProgress();

  useEffect(() => {
    setCrumbs(
      <>
        <span style={{ cursor: "pointer" }} role="link" tabIndex={0}
          onClick={() => navigate("projects")}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("projects"); }}>Projects</span>
        {" / "}<b>{project.name}</b>
      </>,
    );
  }, [setCrumbs, navigate, project.name]);

  const items = project.itemIds.map((id) => itemById.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const done = items.filter((i) => progress.done[i.id]).length;
  const score = projectChecklistScore(progress, project);
  const got = progress.portfolio[project.id] ?? {};
  const status = progress.projStatus[project.id] ?? "not-started";

  return (
    <div className="page">
      <div className="row wrap" style={{ gap: 8 }}>
        <Pill tone="pur">{project.tier}</Pill>
        <Pill tone="out">Week {project.week}</Pill>
      </div>
      <div className="h1" style={{ margin: "10px 0 4px" }}>{project.name}</div>
      <div className="sub">{project.blurb}</div>

      <Card style={{ margin: "16px 0" }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div>
            <div className="lbl-mini">Status</div>
            <div className="segbtns" style={{ marginTop: 6 }}>
              {STATUSES.map((s) => (
                <button key={s} type="button"
                  className={status === s ? `on ${s === "shipped" ? "ok" : s === "building" ? "warn" : ""}`.trim() : ""}
                  onClick={() => setProjectStatus(project.id, s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="sp" />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 660 }}>{score.pct}%</div>
            <div className="dim" style={{ fontSize: 11 }}>portfolio readiness</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Bar pct={score.pct} tone={score.pct === 100 ? "ok" : "grad"} tall />
        </div>
        <div className="row wrap" style={{ gap: 5, marginTop: 12 }}>
          {project.stack.map((s) => <Pill key={s} tone="out">{s}</Pill>)}
        </div>
      </Card>

      <Section title="Portfolio checklist">
        <Pill tone={score.pct === 100 ? "ok" : "out"}>{score.n}/{score.total}</Pill>
      </Section>
      {project.checklist.map((c) => (
        <div className="item" key={c.id}>
          <div className="ihead" style={{ cursor: "default" }}>
            <div
              className={`chk${got[c.id] ? " on" : ""}`}
              role="checkbox"
              aria-checked={Boolean(got[c.id])}
              aria-label={c.label}
              tabIndex={0}
              onClick={() => togglePortfolio(project.id, c.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") togglePortfolio(project.id, c.id); }}
            >✓</div>
            <div style={{ flex: 1 }}>
              <div className="ititle">{c.label}</div>
              <div className="sub" style={{ fontSize: 12.5, marginTop: 3 }}>{c.hint}</div>
            </div>
          </div>
        </div>
      ))}

      <Section title="Roadmap steps">
        <Pill tone="out">{done}/{items.length}</Pill>
      </Section>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          open={openItem === item.id}
          onToggleOpen={() => setOpenItem(openItem === item.id ? null : item.id)}
          onJump={jumpToItem}
          onOpenQuiz={(id) => openOverlay({ kind: "quiz", quizId: id })}
          onOpenCase={(id) => navigate("cases", id)}
          onStartTimer={startTimer}
        />
      ))}
    </div>
  );
}
