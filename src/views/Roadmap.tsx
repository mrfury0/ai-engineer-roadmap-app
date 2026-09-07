import { useEffect } from "react";
import type { ViewProps } from "../App";
import type { Day, Week } from "../types";
import { phases, weeks } from "../data";
import { useProgress } from "../state/ProgressContext";
import { isDone, isInPace, weekProgress, weekUnlocked } from "../lib/selectors";
import { humanMinutes } from "../lib/dates";
import { Markdown } from "../lib/markdown";
import { Bar, Button, Card, Pill } from "../components/primitives";
import { ItemCard } from "../components/ItemCard";

const isWeekId = (p: string | null): boolean => Boolean(p && /^w\d+$/.test(p));

export function Roadmap(props: ViewProps) {
  const { param, navigate, setCrumbs } = props;
  const week = isWeekId(param) ? weeks.find((w) => w.id === param) ?? weeks[0] : null;

  useEffect(() => {
    setCrumbs(week
      ? <>
          <span onClick={() => navigate("roadmap")} style={{ cursor: "pointer" }}>Roadmap</span>
          {" / "}
          <b>Week {week.week}</b>
        </>
      : <b>Roadmap</b>);
  }, [setCrumbs, navigate, week]);

  return week ? <WeekDetail week={week} {...props} /> : <PhaseIndex {...props} />;
}

/* ---------------- index ---------------- */

function PhaseIndex({ navigate }: ViewProps) {
  const { progress } = useProgress();

  return (
    <div className="page">
      <div>
        <div className="h1">The 12-week roadmap</div>
        <div className="sub">
          Every week builds on the last. Nothing here is optional decoration — the sequence is the point.
        </div>
      </div>

      {phases.map((ph) => (
        <div key={ph.n}>
          <div className="sect">
            <Pill tone="ac">Phase {ph.n}</Pill>
            <div className="h2">{ph.name}</div>
            <div className="line" />
            <span className="dim" style={{ fontSize: 12 }}>Week {ph.weeks.join(", ")}</span>
          </div>
          <div className="sub" style={{ margin: "-4px 0 12px" }}>{ph.blurb}</div>
          <div className="grid g2">
            {ph.weeks.map((n) => {
              const w = weeks[n - 1];
              if (!w) return null;
              const p = weekProgress(progress, w);
              const unlocked = weekUnlocked(progress, w);
              return (
                <Card key={w.id} className="hov" onClick={() => navigate("roadmap", w.id)}
                  style={unlocked ? undefined : { opacity: 0.55 }}>
                  <div className="row">
                    <Pill tone={p.pct === 100 ? "ok" : p.pct > 0 ? "ac" : "out"}>Week {w.week}</Pill>
                    {unlocked ? null : <Pill tone="out">🔒 finish week {w.week - 1}</Pill>}
                    <div className="sp" />
                    <span className="dim" style={{ fontSize: 12 }}>{p.done}/{p.total}</span>
                  </div>
                  <div className="h2" style={{ margin: "9px 0 4px" }}>{w.title}</div>
                  <div className="sub" style={{ marginBottom: 11 }}>{w.objective}</div>
                  <Bar pct={p.pct} tone={p.pct === 100 ? "ok" : ""} />
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- week detail ---------------- */

function WeekDetail({ week, navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer }: ViewProps & { week: Week }) {
  const { progress } = useProgress();
  const p = weekProgress(progress, week);
  const quiz = progress.quiz[week.quiz.id];
  const prev = weeks[week.week - 2];
  const next = weeks[week.week];
  const minutes = p.items.reduce((s, i) => s + i.time, 0);

  return (
    <div className="page">
      <div className="row wrap" style={{ gap: 9 }}>
        <Pill tone="ac">Phase {week.phase} · {week.phaseName}</Pill>
        <Pill tone="out">Week {week.week} of 12</Pill>
        {quiz ? <Pill tone={quiz.best >= 70 ? "ok" : "warn"}>Quiz best {quiz.best}%</Pill> : null}
      </div>

      <div className="h1" style={{ margin: "10px 0 4px" }}>{week.title}</div>
      <div className="sub" style={{ maxWidth: 760 }}>{week.objective}</div>

      <Card style={{ margin: "16px 0" }}>
        <Markdown text={week.narrative} />
        <div style={{ margin: "14px 0 6px" }}><Bar pct={p.pct} tone="grad" tall /></div>
        <div className="row">
          <span className="dim" style={{ fontSize: 12 }}>
            {p.done} of {p.total} steps · {humanMinutes(minutes)} of work
          </span>
          <div className="sp" />
          <Button size="sm" onClick={() => openOverlay({ kind: "quiz", quizId: week.quiz.id })}>
            Take the week quiz
          </Button>
        </div>
      </Card>

      {week.days.map((day) => (
        <DayBlock key={day.id} day={day} openItem={openItem} setOpenItem={setOpenItem}
          jumpToItem={jumpToItem} openOverlay={openOverlay} startTimer={startTimer} navigate={navigate} />
      ))}

      <div className="grid g2" style={{ marginTop: 22 }}>
        <Card>
          <div className="h3" style={{ marginBottom: 7 }}>✓ What you can now build</div>
          <Markdown text={week.whatYouCanBuild} />
        </Card>
        <Card>
          <div className="h3" style={{ marginBottom: 7 }}>◆ Why this matters professionally</div>
          <Markdown text={week.whyProfessionally} />
        </Card>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        {prev ? <Button variant="gh" onClick={() => navigate("roadmap", prev.id)}>← Week {prev.week}</Button> : null}
        <div className="sp" />
        {next ? <Button onClick={() => navigate("roadmap", next.id)}>Week {next.week} →</Button> : null}
      </div>
    </div>
  );
}

type DayBlockProps = Pick<ViewProps, "navigate" | "openItem" | "setOpenItem" | "jumpToItem" | "openOverlay" | "startTimer">
  & { day: Day };

function DayBlock({ day, navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer }: DayBlockProps) {
  const { progress } = useProgress();
  const items = day.items.filter((i) => isInPace(i, progress.pace));
  if (!items.length) return null;

  const done = items.filter((i) => isDone(progress, i.id)).length;
  const mins = items.reduce((s, i) => s + i.time, 0);

  return (
    <>
      <div className="row" style={{ margin: "20px 0 6px" }}>
        <div className="h3">Day {day.day} · {day.title}</div>
        <Pill tone={done === items.length ? "ok" : "out"}>{done}/{items.length}</Pill>
        <Pill tone="out">{humanMinutes(mins)}</Pill>
      </div>
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
    </>
  );
}
