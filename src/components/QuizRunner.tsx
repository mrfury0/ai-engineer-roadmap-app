import { useMemo, useState } from "react";
import type { Quiz, Week } from "../types";
import { useProgress } from "../state/ProgressContext";
import { Modal } from "./Modal";
import { Bar, Button, Callout, Pill } from "./primitives";

type Answer = number | { text?: string; shown?: boolean; self?: boolean } | undefined;

/**
 * Missed questions are matched back to the lesson that taught them (by key-concept term
 * overlap) and pushed into the revision queue.
 */
function lessonsToRevise(week: Week, quiz: Quiz, answers: Answer[]): string[] {
  const out: string[] = [];
  const lessons = week.days.flatMap((d) => d.items).filter((i) => i.kind === "lesson");
  quiz.questions.forEach((q, i) => {
    const a = answers[i];
    const wrong = q.type === "mcq" ? a !== q.answer : !(typeof a === "object" && a?.self);
    if (!wrong) return;
    const text = `${q.q} ${q.type === "mcq" ? q.explain : q.answer}`.toLowerCase();
    let best: string | null = null;
    let bestScore = 0;
    for (const lesson of lessons) {
      let score = 0;
      for (const kc of lesson.keyConcepts) if (text.includes(kc.term.toLowerCase())) score += 3;
      for (const w of lesson.title.toLowerCase().split(/\W+/)) if (w.length > 4 && text.includes(w)) score += 1;
      if (score > bestScore) { bestScore = score; best = lesson.id; }
    }
    if (best && bestScore > 0) out.push(best);
  });
  return [...new Set(out)];
}

export function QuizRunner({ week, onClose, onOpenRevision }: {
  week: Week; onClose: () => void; onOpenRevision: () => void;
}) {
  const quiz = week.quiz;
  const { progress, recordQuiz, setStatus } = useProgress();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);

  const score = useMemo(() => {
    let right = 0;
    quiz.questions.forEach((q, idx) => {
      const a = answers[idx];
      if (q.type === "mcq") { if (a === q.answer) right++; }
      else if (typeof a === "object" && a?.self) right++;
    });
    return Math.round((right / quiz.questions.length) * 100);
  }, [answers, quiz]);

  const finish = () => {
    recordQuiz(quiz.id, score, quiz.passPct);
    for (const id of lessonsToRevise(week, quiz, answers)) {
      if (progress.status[id] !== "confused") setStatus(id, "revision");
    }
    setFinished(true);
  };

  if (finished) {
    const verdict = score >= 85 ? ["Strong.", "ok"] as const
      : score >= quiz.passPct ? ["Pass.", "ok"] as const
      : ["Below the bar.", "warn"] as const;
    return (
      <Modal title={`${quiz.title} — result`} onClose={onClose}
        footer={<>
          <Button variant="p" onClick={onClose}>Done</Button>
          <div className="sp" />
          <Button variant="gh" onClick={() => { onClose(); onOpenRevision(); }}>Open revision queue</Button>
        </>}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 680, letterSpacing: "-.04em", lineHeight: 1.1 }}>{score}%</div>
          <div className="row" style={{ justifyContent: "center", margin: "10px 0 4px" }}>
            <Pill tone={verdict[1]}>{verdict[0]}</Pill>
          </div>
          <div className="sub" style={{ marginBottom: 16 }}>pass mark {quiz.passPct}%</div>
          <div className="prose" style={{ textAlign: "left" }}>
            {score >= quiz.passPct
              ? "Anything you missed has been added to your revision queue on a spaced schedule. Carry on."
              : `The topics you missed are now queued for revision. Re-read those lessons before moving on — week ${week.week + 1} assumes this material.`}
          </div>
        </div>
      </Modal>
    );
  }

  const q = quiz.questions[i];
  const a = answers[i];
  const setAnswer = (v: Answer) => setAnswers((prev) => { const n = [...prev]; n[i] = v; return n; });
  const answered = q.type === "mcq" && typeof a === "number";

  return (
    <Modal
      title={quiz.title}
      subtitle={`Question ${i + 1} of ${quiz.questions.length}`}
      onClose={onClose}
      footer={<>
        {i > 0 ? <Button variant="gh" onClick={() => setI(i - 1)}>← Back</Button> : null}
        <div className="sp" />
        {q.type === "short" && !(typeof a === "object" && a?.shown) ? (
          <Button onClick={() => setAnswer({ ...(typeof a === "object" ? a : {}), shown: true })}>Show model answer</Button>
        ) : null}
        <Button variant="p" onClick={() => (i === quiz.questions.length - 1 ? finish() : setI(i + 1))}>
          {i === quiz.questions.length - 1 ? "Finish" : "Next →"}
        </Button>
      </>}
    >
      <div style={{ marginBottom: 16 }}><Bar pct={Math.round((i / quiz.questions.length) * 100)} /></div>
      <div className="h3" style={{ marginBottom: 13, fontSize: 15, lineHeight: 1.5 }}>{q.q}</div>

      {q.type === "mcq" ? (
        <>
          {q.options.map((opt, oi) => {
            let cls = "";
            if (answered) cls = oi === q.answer ? " right" : oi === a ? " wrong" : "";
            return (
              <div key={oi} className={`qopt${cls}`} onClick={() => setAnswer(oi)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setAnswer(oi); }}>
                <div className="qi">{"ABCDE"[oi]}</div><div>{opt}</div>
              </div>
            );
          })}
          {answered ? (
            <Callout tone={a === q.answer ? "ok" : "bad"}>
              <div className="prose"><strong>{a === q.answer ? "Correct." : "Not quite."}</strong> {q.explain}</div>
            </Callout>
          ) : null}
        </>
      ) : (
        <>
          <textarea className="note" style={{ minHeight: 110 }} aria-label="Your answer"
            value={typeof a === "object" ? a?.text ?? "" : ""}
            onChange={(e) => setAnswer({ ...(typeof a === "object" ? a : {}), text: e.target.value })}
            placeholder="Answer in two or three sentences…" />
          {typeof a === "object" && a?.shown ? (
            <Callout tone="ok">
              <div className="lbl-mini">Model answer</div>
              <div className="prose">{q.answer}</div>
              {q.keywords?.length ? (
                <div className="row wrap" style={{ gap: 5, marginTop: 9 }}>
                  {q.keywords.map((k) => {
                    const hit = (a.text ?? "").toLowerCase().includes(k.toLowerCase());
                    return <Pill key={k} tone={hit ? "ok" : "out"}>{hit ? "✓ " : "○ "}{k}</Pill>;
                  })}
                </div>
              ) : null}
              <div className="row" style={{ marginTop: 11, gap: 7 }}>
                <span className="dim" style={{ fontSize: 12 }}>Did you get it?</span>
                <Button size="sm" variant="g" onClick={() => setAnswer({ ...a, self: true })}>Yes</Button>
                <Button size="sm" variant="gh" onClick={() => setAnswer({ ...a, self: false })}>Not really</Button>
              </div>
            </Callout>
          ) : null}
        </>
      )}
    </Modal>
  );
}
