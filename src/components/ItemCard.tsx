import { useState } from "react";
import type { Confidence, Item } from "../types";
import { useProgress } from "../state/ProgressContext";
import { itemById, caseById, weekOfItem } from "../data";
import { isDone, prereqsMet } from "../lib/selectors";
import { humanMinutes } from "../lib/dates";
import { Markdown, Inline } from "../lib/markdown";
import { Bar, Button, Callout, Difficulty, Pill } from "./primitives";
import { ResourceCard } from "./ResourceCard";

const ENERGY = {
  low: { label: "Low energy", tone: "ok" as const, icon: "○" },
  normal: { label: "Normal focus", tone: "ac" as const, icon: "◐" },
  deep: { label: "Deep focus", tone: "pur" as const, icon: "●" },
};
const KIND: Record<Item["kind"], { label: string; tone: "" | "cy" | "bad" | "pur" | "warn" | "ac" }> = {
  lesson: { label: "Lesson", tone: "" }, build: { label: "Build", tone: "cy" },
  debug: { label: "Debug", tone: "bad" }, project: { label: "Project", tone: "pur" },
  review: { label: "Review", tone: "" }, quiz: { label: "Quiz", tone: "warn" },
  consulting: { label: "Consulting", tone: "ac" },
};

export function ItemMeta({ item }: { item: Item }) {
  const { progress } = useProgress();
  const energy = ENERGY[item.energy];
  const status = progress.status[item.id];
  const conf = progress.confidence[item.id];
  return (
    <div className="imeta">
      <Pill tone={KIND[item.kind].tone}>{KIND[item.kind].label}</Pill>
      <Pill>{humanMinutes(item.time)}</Pill>
      <Difficulty level={item.difficulty} />
      <Pill tone={energy.tone}>{energy.icon} {energy.label}</Pill>
      {item.pace !== "core" ? <Pill tone="out">{item.pace}</Pill> : null}
      {status === "revision" ? <Pill tone="warn">↻ revise</Pill> : null}
      {status === "confused" ? <Pill tone="bad">? confused</Pill> : null}
      {status === "understood" ? <Pill tone="ok">✓ understood</Pill> : null}
      {conf ? <Pill tone="out">confidence {conf}/5</Pill> : null}
    </div>
  );
}

export interface ItemCardProps {
  item: Item;
  open: boolean;
  onToggleOpen: () => void;
  onJump?: (id: string) => void;
  onOpenQuiz?: (quizId: string) => void;
  onOpenCase?: (caseId: string) => void;
  onStartTimer?: (minutes: number, itemId: string) => void;
}

export function ItemCard(props: ItemCardProps) {
  const { item, open, onToggleOpen } = props;
  const { progress, toggleItemDone } = useProgress();
  const done = isDone(progress, item.id);
  const blocked = !prereqsMet(progress, item);

  return (
    <div className={`item${open ? " open" : ""}${done ? " done-y" : ""}`} id={`i-${item.id}`}>
      <div className="ihead" onClick={onToggleOpen} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onToggleOpen(); }}>
        <div
          className={`chk${done ? " on" : ""}`}
          title="Mark complete"
          role="checkbox"
          aria-checked={done}
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); toggleItemDone(item.id); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleItemDone(item.id); } }}
        >✓</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ititle">
            {item.title}{" "}
            {blocked && !done ? <Pill tone="out">locked</Pill> : null}
          </div>
          <ItemMeta item={item} />
        </div>
        <div className="dim" style={{ fontSize: 11, paddingTop: 3 }}>+{item.xp} XP</div>
      </div>
      {open ? <ItemBody {...props} /> : null}
    </div>
  );
}

export function ItemBody({ item, onJump, onOpenQuiz, onOpenCase, onStartTimer }: ItemCardProps) {
  const { progress, toggleItemDone, setStatus, setConfidence, setNote } = useProgress();
  const [hintsShown, setHintsShown] = useState<number[]>([]);
  const [solutionShown, setSolutionShown] = useState(false);
  const [expertShown, setExpertShown] = useState(false);
  const dm = item.debugMission;
  const status = progress.status[item.id];
  const conf = progress.confidence[item.id];
  const week = weekOfItem.get(item.id);
  const quizResult = week ? progress.quiz[week.quiz.id] : undefined;

  return (
    <div className="ibody">
      <Block label="Concept"><Markdown text={item.concept} /></Block>
      {item.why ? <Block label="Why it matters"><Callout tone="ac"><Markdown text={item.why} /></Callout></Block> : null}

      {item.prereqs.length ? (
        <Block label="Builds on">
          <div className="row wrap">
            {item.prereqs.map((pid) => {
              const dep = itemById.get(pid);
              if (!dep) return null;
              return (
                <Pill key={pid} tone={isDone(progress, pid) ? "ok" : "out"} onClick={() => onJump?.(pid)}>
                  {isDone(progress, pid) ? "✓ " : ""}{dep.title}
                </Pill>
              );
            })}
          </div>
        </Block>
      ) : null}

      {item.learn.length ? (
        <Block label="Learn">{item.learn.map((l) => <ResourceCard key={l.resId} learn={l} />)}</Block>
      ) : null}

      {item.build ? (
        <Block label="Build">
          <div className="prose" style={{ marginBottom: 9 }}><strong>{item.build.task}</strong></div>
          {item.build.steps.length ? (
            <ol className="steps">{item.build.steps.map((s, i) => <li key={i}><Inline text={s} /></li>)}</ol>
          ) : null}
          {item.build.code ? <pre className="code">{item.build.code}</pre> : null}
          {item.build.hint ? (
            <div className="prose dim" style={{ marginTop: 8, fontSize: 12.5 }}>💡 <Inline text={item.build.hint} /></div>
          ) : null}
        </Block>
      ) : null}

      {item.challenge ? <Block label="Challenge"><Callout><Markdown text={item.challenge} /></Callout></Block> : null}

      {dm ? (
        <Block label="🐛 Debug mission">
          <Callout tone="bad">
            <Markdown text={dm.scenario} />
            {dm.artifact ? <pre className="code warnbox" style={{ marginTop: 10 }}>{dm.artifact}</pre> : null}
            <div className="row wrap" style={{ marginTop: 10, gap: 7 }}>
              {dm.hints.map((_, i) => (
                <Button key={i} size="sm" variant="gh" onClick={() => setHintsShown((h) => (h.includes(i) ? h : [...h, i]))}>
                  Hint {i + 1}
                </Button>
              ))}
              <Button size="sm" onClick={() => setSolutionShown(true)}>Reveal the fix</Button>
            </div>
            <div style={{ marginTop: 9 }}>
              {hintsShown.sort((a, b) => a - b).map((i) => (
                <div className="callout" key={i} style={{ marginBottom: 7 }}>
                  <div className="prose"><strong>Hint {i + 1}.</strong> {dm.hints[i]}</div>
                </div>
              ))}
              {solutionShown ? (
                <div className="callout ok">
                  <div className="lbl-mini">The fix</div>
                  <Markdown text={dm.solution} />
                </div>
              ) : null}
            </div>
          </Callout>
        </Block>
      ) : null}

      {item.expert ? (
        <Block label="Expert answer">
          {expertShown ? (
            <Callout tone="ok"><Markdown text={item.expert} /></Callout>
          ) : (
            <div className="reveal">
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 9 }}>
                Write your own answer first — comparing beats reading.
              </div>
              <Button size="sm" onClick={() => setExpertShown(true)}>Reveal expert answer</Button>
            </div>
          )}
        </Block>
      ) : null}

      {item.caseRef && caseById.get(item.caseRef) ? (
        <Block label="Case">
          <Button onClick={() => onOpenCase?.(item.caseRef!)}>◆ Open {caseById.get(item.caseRef)!.title} →</Button>
        </Block>
      ) : null}

      {item.kind === "quiz" && week ? (
        <Block label="Quiz">
          <div className="row" style={{ gap: 9 }}>
            <Button variant="p" onClick={() => onOpenQuiz?.(week.quiz.id)}>Start {week.quiz.title}</Button>
            {quizResult ? <Pill tone={quizResult.best >= 70 ? "ok" : "warn"}>Best {quizResult.best}%</Pill> : null}
          </div>
        </Block>
      ) : null}

      {item.reflection.length ? (
        <Block label="Explain it (out loud)">
          {item.reflection.map((r, i) => <div className="reflect" key={i}>{r}</div>)}
        </Block>
      ) : null}

      {item.done.length ? (
        <Block label="Definition of done">
          <ul className="dones">{item.done.map((d, i) => <li key={i}><Inline text={d} /></li>)}</ul>
        </Block>
      ) : null}

      {item.keyConcepts.length ? (
        <Block label="Key concepts (these come back in revision)">
          {item.keyConcepts.map((k) => (
            <div key={k.term} style={{ marginBottom: 6, fontSize: 13 }}>
              <b>{k.term}</b> <span className="muted">— {k.def}</span>
            </div>
          ))}
        </Block>
      ) : null}

      <hr className="sep" />
      <div className="row wrap" style={{ gap: 14 }}>
        <div>
          <div className="lbl-mini">How did that land?</div>
          <div className="segbtns">
            {(["understood", "revision", "confused"] as const).map((s) => (
              <button key={s} className={status === s ? `on ${s === "understood" ? "ok" : s === "revision" ? "warn" : "bad"}` : ""}
                onClick={() => setStatus(item.id, s)} type="button">
                {s === "understood" ? "✓ Understood" : s === "revision" ? "↻ Need revision" : "? Confused"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="lbl-mini">Confidence</div>
          <div className="segbtns">
            {([1, 2, 3, 4, 5] as Confidence[]).map((n) => (
              <button key={n} className={conf === n ? "on" : ""} onClick={() => setConfidence(item.id, n)}
                title={["Lost", "Weak", "Get it", "Can build", "Can teach"][n - 1]} type="button">{n}</button>
            ))}
          </div>
        </div>
      </div>

      <Block label="Notes">
        <textarea
          className="note"
          value={progress.notes[item.id] ?? ""}
          onChange={(e) => setNote(item.id, e.target.value)}
          placeholder="What clicked, what did not, code you want to remember…"
          aria-label={`Notes for ${item.title}`}
        />
      </Block>

      <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
        <Button variant={isDone(progress, item.id) ? "gh" : "g"} onClick={() => toggleItemDone(item.id)}>
          {isDone(progress, item.id) ? "↺ Mark not done" : `✓ Complete (+${item.xp} XP)`}
        </Button>
        <Button variant="gh" onClick={() => onStartTimer?.(25, item.id)}>▶ Focus sprint (25m)</Button>
        <Button variant="gh" onClick={() => onStartTimer?.(5, item.id)}>⚡ Start tiny (5m)</Button>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="blk"><div className="lbl">{label}</div>{children}</div>;
}

export { Bar };
