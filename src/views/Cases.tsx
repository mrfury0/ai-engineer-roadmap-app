import { useEffect, useState } from "react";
import type { ViewProps } from "../App";
import type { ConsultingCase } from "../types";
import { caseById, cases } from "../data";
import { useProgress } from "../state/ProgressContext";
import { Markdown, truncate } from "../lib/markdown";
import { Bar, Button, Callout, Card, Pill, Section } from "../components/primitives";

export function Cases({ param, navigate, setCrumbs }: ViewProps) {
  const activeCase = param ? caseById.get(param) : undefined;

  useEffect(() => {
    if (!activeCase) { setCrumbs(<b>Consulting Cases</b>); return; }
    setCrumbs(
      <>
        <span
          role="link"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          onClick={() => navigate("cases")}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("cases"); }}
        >Cases</span>{" / "}<b>{activeCase.title}</b>
      </>,
    );
  }, [activeCase, navigate, setCrumbs]);

  return activeCase ? <CaseDetail kase={activeCase} /> : <CaseIndex navigate={navigate} />;
}

function CaseIndex({ navigate }: { navigate: ViewProps["navigate"] }) {
  const { progress } = useProgress();

  return (
    <div className="page">
      <div>
        <div className="h1">Consulting cases</div>
        <div className="sub">
          Five briefs, eight deliverables each. Write your answer, then compare with the expert version.
          The gap is the lesson.
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        {cases.map((c) => {
          const state = progress.cases[c.id] ?? {};
          const written = c.tasks.filter((t) => state[t.id]?.attempt).length;
          return (
            <Card key={c.id} className="hov" onClick={() => navigate("cases", c.id)}>
              <div className="row wrap" style={{ gap: 7 }}>
                <Pill tone="ac">{c.industry}</Pill>
                <div className="sp" />
                <Pill tone={written === 8 ? "ok" : "out"}>{written}/8 written</Pill>
              </div>
              <div className="h2" style={{ margin: "10px 0 4px" }}>{c.title}</div>
              <div className="sub" style={{ marginBottom: 9 }}>{c.client}</div>
              <div className="prose" style={{ fontSize: 12.8 }}>
                {truncate(c.brief.split("\n")[0], 190)}
              </div>
              <div style={{ marginTop: 11 }}>
                <Bar pct={Math.round((written / 8) * 100)} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CaseDetail({ kase }: { kase: ConsultingCase }) {
  const [openTask, setOpenTask] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="row wrap" style={{ gap: 8 }}>
        <Pill tone="ac">{kase.industry}</Pill>
        <Pill tone="out">{kase.client}</Pill>
      </div>
      <div className="h1" style={{ margin: "10px 0 12px" }}>{kase.title}</div>

      <Card>
        <div className="lbl-mini">The client says</div>
        <Markdown text={kase.brief} />
      </Card>
      <div style={{ marginTop: 12 }}>
        <Card>
          <div className="lbl-mini">What you found in discovery</div>
          <Markdown text={kase.artifacts} />
        </Card>
      </div>
      <div style={{ marginTop: 12 }}>
        <Callout>
          <div className="prose">
            <strong>Method.</strong> Timebox 40 minutes. Write all eight sections before revealing a
            single expert answer — the value is in the diff, and you cannot un-read an answer.
          </div>
        </Callout>
      </div>

      <Section title="Deliverables" />
      {kase.tasks.map((task, i) => (
        <TaskRow
          key={task.id}
          caseId={kase.id}
          task={task}
          index={i}
          open={openTask === task.id}
          onToggle={() => setOpenTask((cur) => (cur === task.id ? null : task.id))}
        />
      ))}

      <Section title="Debrief" />
      <Card><Markdown text={kase.debrief} /></Card>
    </div>
  );
}

function TaskRow({ caseId, task, index, open, onToggle }: {
  caseId: string; task: ConsultingCase["tasks"][number]; index: number; open: boolean; onToggle: () => void;
}) {
  const { progress, setCaseAttempt, revealCase } = useProgress();
  const state = progress.cases[caseId]?.[task.id] ?? {};
  const attempt = state.attempt ?? "";

  return (
    <div className={`item${open ? " open" : ""}`}>
      <div
        className="ihead"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onToggle(); }}
      >
        <div className={`chk${attempt ? " on" : ""}`}>{attempt ? "✓" : ""}</div>
        <div style={{ flex: 1 }}>
          <div className="ititle">{index + 1}. {task.name}</div>
          {state.revealed ? (
            <div className="imeta"><Pill tone="ok">expert answer read</Pill></div>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="ibody">
          <div className="blk">
            <div className="lbl">Your task</div>
            <Markdown text={task.prompt} />
          </div>
          <div className="blk">
            <div className="lbl">Your answer</div>
            <textarea
              className="note"
              style={{ minHeight: 150 }}
              value={attempt}
              onChange={(e) => setCaseAttempt(caseId, task.id, e.target.value)}
              placeholder="Write it properly — bullet points a client could read."
              aria-label={`Your answer for ${task.name}`}
            />
          </div>
          {state.revealed ? (
            <div className="blk">
              <div className="lbl">Expert answer</div>
              <Callout tone="ok"><Markdown text={task.expert} /></Callout>
            </div>
          ) : (
            <div className="blk">
              <div className="reveal">
                {attempt ? null : (
                  <div className="muted" style={{ fontSize: 12.8, marginBottom: 9 }}>
                    Write something first, even if it is rough.
                  </div>
                )}
                <Button variant={attempt ? "p" : "gh"} onClick={() => revealCase(caseId, task.id)}>
                  Reveal expert answer
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
