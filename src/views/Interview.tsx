import { useEffect, useState } from "react";
import type { ViewProps } from "../App";
import type { InterviewQuestion } from "../types";
import { interview } from "../data";
import { useProgress } from "../state/ProgressContext";
import { Markdown } from "../lib/markdown";
import { Button, Difficulty, Pill, Stat } from "../components/primitives";
import { dueCards } from "../components/FlashcardRunner";

const TYPE_TONE = { coding: "cy", scenario: "pur", architecture: "ac", flash: "", short: "" } as const;

const RESULT = {
  yes: { tone: "ok", label: "confident" },
  partial: { tone: "warn", label: "partial" },
  no: { tone: "bad", label: "revisit" },
} as const;

/** Questions grouped by topic, in the order the filter row shows them. */
function byTopic(): [string, InterviewQuestion[]][] {
  const map = new Map<string, InterviewQuestion[]>();
  for (const q of interview) {
    const bucket = map.get(q.topic);
    if (bucket) bucket.push(q);
    else map.set(q.topic, [q]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function Interview({ navigate, openOverlay, setCrumbs }: ViewProps) {
  const { progress, markInterviewSeen } = useProgress();
  const [topic, setTopic] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => setCrumbs(<b>Interview Prep</b>), [setCrumbs]);

  const topics = byTopic();
  const list = topic === "all" ? interview : topics.find(([t]) => t === topic)?.[1] ?? [];
  const attempted = interview.filter((q) => progress.interview[q.id]).length;
  const confident = interview.filter((q) => progress.interview[q.id]?.got === "yes").length;
  const due = dueCards(progress.flash).length;

  const openQuestion = (id: string) => {
    setOpen(id);
    markInterviewSeen(id);
  };

  const randomQuestion = () => {
    let pool = interview.filter((q) => !progress.interview[q.id]?.got);
    if (!pool.length) pool = interview;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setTopic("all");
    openQuestion(pick.id);
    window.setTimeout(
      () => document.getElementById(`q-${pick.id}`)?.scrollIntoView({ block: "center" }),
      60,
    );
  };

  return (
    <div className="page">
      <div>
        <div className="h1">Interview prep</div>
        <div className="sub">
          Attempt out loud, then reveal. Anything you rate “no” goes into revision — that is the whole
          mechanism.
        </div>
      </div>

      <div className="grid g3" style={{ margin: "16px 0" }}>
        <Stat label="Attempted" value={`${attempted}/${interview.length}`} note="questions seen" />
        <Stat
          label="Confident"
          value={confident}
          note={`${Math.round((confident / interview.length) * 100)}% of the bank`}
        />
        <Stat label="Flashcards" value={`${due} due`} note="in the spaced deck" />
      </div>

      <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
        <Pill tone={topic === "all" ? "ac" : "out"} onClick={() => setTopic("all")}>
          All {interview.length}
        </Pill>
        {topics.map(([t, qs]) => (
          <Pill key={t} tone={topic === t ? "ac" : "out"} onClick={() => setTopic(t)}>
            {t} {qs.filter((q) => progress.interview[q.id]?.got === "yes").length}/{qs.length}
          </Pill>
        ))}
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <Button onClick={() => openOverlay({ kind: "flash", all: false })}>Flashcard drill</Button>
        <Button variant="gh" onClick={randomQuestion}>Random question</Button>
        <Button variant="gh" onClick={() => navigate("cases")}>Consulting cases →</Button>
      </div>

      {list.map((q) => (
        <QuestionRow
          key={q.id}
          question={q}
          open={open === q.id}
          onToggle={() => (open === q.id ? setOpen(null) : openQuestion(q.id))}
        />
      ))}
    </div>
  );
}

function QuestionRow({ question, open, onToggle }: {
  question: InterviewQuestion; open: boolean; onToggle: () => void;
}) {
  const { progress, setInterviewResult, pushToast } = useProgress();
  /* The model answer stays revealed once you have seen it — you cannot un-read it. */
  const [revealed, setRevealed] = useState(false);
  const got = progress.interview[question.id]?.got;

  const rate = (result: "yes" | "partial" | "no") => {
    setInterviewResult(question.id, result);
    if (result === "no") pushToast("Queued — the topic is in your weak list.");
  };

  return (
    <div className={`item${open ? " open" : ""}`} id={`q-${question.id}`}>
      <div
        className="ihead"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onToggle(); }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ititle">{question.q}</div>
          <div className="imeta">
            <Pill tone="out">{question.topic}</Pill>
            <Pill tone={TYPE_TONE[question.type]}>{question.type}</Pill>
            <Difficulty level={question.difficulty * 1.6} />
            {got ? <Pill tone={RESULT[got].tone}>{RESULT[got].label}</Pill> : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="ibody">
          {revealed ? (
            <div className="callout ok">
              <div className="lbl-mini">Model answer</div>
              <Markdown text={question.answer} />
              {question.followup ? (
                <div className="reflect" style={{ marginTop: 11 }}>
                  Likely follow-up: {question.followup}
                </div>
              ) : null}
              <div className="row wrap" style={{ marginTop: 12, gap: 7 }}>
                <span className="dim" style={{ fontSize: 12 }}>How did you do?</span>
                <Button size="sm" variant="g" onClick={() => rate("yes")}>Nailed it</Button>
                <Button size="sm" variant="gh" onClick={() => rate("partial")}>Partly</Button>
                <Button size="sm" variant="gh" onClick={() => rate("no")}>Revisit</Button>
              </div>
            </div>
          ) : (
            <div className="reveal">
              <div className="muted" style={{ fontSize: 12.8, marginBottom: 10 }}>
                Say your answer out loud first. Reading the model answer before attempting is how people
                fail interviews they “revised” for.
              </div>
              <Button onClick={() => setRevealed(true)}>Reveal model answer</Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
