import { useEffect } from "react";
import type { ViewProps } from "../App";
import { projects, tickets, interview } from "../data";
import { useProgress } from "../state/ProgressContext";
import { daysAway } from "../state/progress";
import {
  currentWeek, earnedXp, isDone, levelFromXp, nextBestItem, overallProgress,
  portfolioReadiness, projectItemProgress, remainingItems, revisionQueue, weakAreas, weekProgress,
} from "../lib/selectors";
import { humanMinutes } from "../lib/dates";
import { Markdown, truncate } from "../lib/markdown";
import { totalXp } from "../data";
import { Bar, Button, Card, Pill, Section, Stat } from "../components/primitives";
import { ItemMeta } from "../components/ItemCard";

const GREETINGS = ["Right then.", "Let's build.", "Ready when you are.", "Pick up where you left off."];

export function Dashboard({ navigate, jumpToItem, openOverlay, setSessionMode, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Dashboard</b>), [setCrumbs]);

  const week = currentWeek(progress);
  const wp = weekProgress(progress, week);
  const next = nextBestItem(progress);
  const away = daysAway(progress);
  const level = levelFromXp(earnedXp(progress));
  const overall = overallProgress(progress);
  const queue = revisionQueue(progress);
  const overdue = queue.filter((r) => r.overdue);
  const weak = weakAreas(progress);

  const milestone = (() => {
    for (const p of projects) {
      const prog = projectItemProgress(progress, p);
      if (prog.done < prog.total) {
        return { name: p.name, icon: p.tier === "capstone" ? "★" : p.tier === "medium" ? "◆" : "▪", pct: prog.pct,
          note: `${p.tier} project · week ${p.week} · ${prog.done}/${prog.total} steps` };
      }
    }
    return null;
  })();

  const smallest = remainingItems(progress).filter((i) => i.time <= 30).sort((a, b) => a.time - b.time)[0] ?? next;

  return (
    <div className="page">
      {away >= 3 ? (
        <Card style={{ borderColor: "var(--ac)", background: "linear-gradient(180deg,var(--ac-dim),transparent)" }}>
          <div className="h2">Welcome back.</div>
          <div className="sub" style={{ marginBottom: 12 }}>
            {away} days away. Nothing is lost, nothing resets — your {overall.done} completed steps and{" "}
            {earnedXp(progress).toLocaleString()} XP are exactly where you left them. Here is the smallest useful step to restart:
          </div>
          {smallest ? (
            <div className="row wrap" style={{ gap: 8 }}>
              <Button variant="p" onClick={() => jumpToItem(smallest.id)}>
                Restart with: {smallest.title} · {humanMinutes(smallest.time)}
              </Button>
              <Button variant="gh" onClick={() => { setSessionMode("tired"); navigate("today"); }}>
                Show me a 10-minute option
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="row" style={{ marginBottom: 4, marginTop: away >= 3 ? 16 : 0 }}>
        <div>
          <div className="h1">{away >= 3 ? "Back on the roadmap" : GREETINGS[new Date().getDay() % 4]}</div>
          <div className="sub">Week {week.week} of 12 · {week.phaseName} · {week.title}</div>
        </div>
      </div>

      <Card className="" >
        <div className="row wrap" style={{ gap: 14 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lbl-mini">Continue learning</div>
            {next ? (
              <>
                <div className="h2" style={{ margin: "7px 0 4px" }}>{next.title}</div>
                <ItemMeta item={next} />
              </>
            ) : (
              <div className="h2" style={{ margin: "7px 0" }}>Curriculum complete. Go and get the job.</div>
            )}
          </div>
          {next ? (
            <div className="row" style={{ gap: 8 }}>
              <Button variant="p" size="lg" onClick={() => jumpToItem(next.id)}>Continue →</Button>
              <Button size="lg" variant="gh" onClick={() => openOverlay({ kind: "whatnow" })}>
                What should I do right now?
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid g4" style={{ marginTop: 14 }}>
        <Stat label="Overall" value={`${overall.pct}%`} note={`${overall.done} of ${overall.total} steps`} />
        <Stat label="Hours studied" value={(progress.minutes / 60).toFixed(1)} note={`logged across ${progress.sessions.length} days`} />
        <Stat label="Streak" value={`${progress.streak || 0}d`} note={`best ${progress.best || 0}d · one rest day is free`} />
        <Stat label="Level" value={level.level} note={`${earnedXp(progress).toLocaleString()} XP of ${totalXp.toLocaleString()}`} />
      </div>

      <Section title="This week">
        <Button size="sm" variant="gh" onClick={() => navigate("roadmap", week.id)}>Open week {week.week} →</Button>
      </Section>
      <Card>
        <div className="row" style={{ marginBottom: 10 }}>
          <div>
            <div className="h3">Week {week.week} — {week.title}</div>
            <div className="sub">{week.objective}</div>
          </div>
          <div className="sp" />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 660 }}>{wp.pct}%</div>
            <div className="dim" style={{ fontSize: 11 }}>{wp.done}/{wp.total}</div>
          </div>
        </div>
        <Bar pct={wp.pct} tone="grad" tall />
        <div className="grid g2" style={{ marginTop: 14 }}>
          <div className="callout ok">
            <div className="lbl-mini">What you can build after this week</div>
            <Markdown text={week.whatYouCanBuild} />
          </div>
          <div className="callout ac">
            <div className="lbl-mini">Why this matters professionally</div>
            <Markdown text={week.whyProfessionally} />
          </div>
        </div>
      </Card>

      <Section title="How much time have you got?" />
      <div className="grid g4">
        {([
          ["20 minutes", "⚡", "One focused step. No setup, no faff.", "quick"],
          ["1 hour", "◐", "A concept plus the build that proves it.", "hour"],
          ["Deep work", "●", "2–3 hours. Project-grade progress.", "deep"],
          ["No-zero day", "🌙", "Tired? Take a meaningful 10 minutes.", "tired"],
        ] as const).map(([title, icon, blurb, mode]) => (
          <Card key={mode} className="hov" onClick={() => { setSessionMode(mode); navigate("today"); }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontWeight: 560, fontSize: 13.5 }}>{title}</div>
            <div className="sub">{blurb}</div>
          </Card>
        ))}
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card>
          <div className="h3" style={{ marginBottom: 9 }}>Next milestone</div>
          {milestone ? (
            <div className="row" style={{ gap: 11 }}>
              <div style={{ fontSize: 22 }}>{milestone.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 560 }}>{milestone.name}</div>
                <div className="sub">{milestone.note}</div>
                <div style={{ marginTop: 8, maxWidth: 220 }}><Bar pct={milestone.pct} /></div>
              </div>
            </div>
          ) : <div className="muted">All milestones cleared.</div>}
        </Card>
        <Card>
          <div className="row" style={{ marginBottom: 9 }}>
            <div className="h3">Revision queue</div><div className="sp" />
            {queue.length ? <Button size="sm" onClick={() => navigate("revision")}>Open →</Button> : null}
          </div>
          {queue.length ? (
            <>
              <div className="row wrap" style={{ gap: 7, marginBottom: 9 }}>
                <Pill tone={overdue.length ? "warn" : "ok"}>{overdue.length} due now</Pill>
                <Pill tone="out">{queue.length} tracked</Pill>
              </div>
              {queue.slice(0, 3).map((r) => (
                <div key={r.id} style={{ fontSize: 12.8, color: "var(--tx-2)", marginBottom: 4 }}>
                  · {truncate(r.item.title, 54)}
                </div>
              ))}
            </>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Nothing queued. Mark a lesson “need revision” or “confused” and it lands here on a spaced schedule.
            </div>
          )}
        </Card>
      </div>

      {weak.length ? (
        <>
          <Section title="Weak areas" />
          <Card>
            <div className="row wrap" style={{ gap: 8 }}>
              {weak.map((w, i) => <Pill key={i} tone="warn">{w.label} · {w.why}</Pill>)}
            </div>
          </Card>
        </>
      ) : null}

      <Section title="Jump to" />
      <div className="grid g4">
        <Card className="hov" onClick={() => navigate("skills")}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>⬡</div>
          <div style={{ fontWeight: 560, fontSize: 13.5 }}>Skill Tree</div>
          <div className="sub">40 skills tracked</div>
        </Card>
        <Card className="hov" onClick={() => navigate("practice")}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>⚑</div>
          <div style={{ fontWeight: 560, fontSize: 13.5 }}>Engineering tickets</div>
          <div className="sub">{tickets.filter((t) => !progress.tickets[t.id]?.done).length} open</div>
        </Card>
        <Card className="hov" onClick={() => navigate("interview")}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>◍</div>
          <div style={{ fontWeight: 560, fontSize: 13.5 }}>Interview prep</div>
          <div className="sub">{interview.length} questions</div>
        </Card>
        <Card className="hov" onClick={() => navigate("portfolio")}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>★</div>
          <div style={{ fontWeight: 560, fontSize: 13.5 }}>Portfolio</div>
          <div className="sub">{portfolioReadiness(progress)}% ready</div>
        </Card>
      </div>
      {isDone(progress, "") ? null : null}
    </div>
  );
}
