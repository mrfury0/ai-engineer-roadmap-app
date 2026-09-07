import { useMemo, useState } from "react";
import { flashdeck } from "../data";
import { useProgress } from "../state/ProgressContext";
import { todayIso } from "../lib/dates";
import { Modal } from "./Modal";
import { Bar, Button, Callout } from "./primitives";

export function dueCards(flash: Record<string, { due: string }>, today = todayIso()) {
  return flashdeck.filter((c) => !flash[c.id]?.due || flash[c.id].due <= today);
}

export function FlashcardRunner({ all, onClose }: { all: boolean; onClose: () => void }) {
  const { progress, gradeFlash, logMinutes } = useProgress();
  const deck = useMemo(() => {
    const pool = all ? [...flashdeck] : dueCards(progress.flash);
    return pool.sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);

  if (!deck.length) {
    return <Modal title="Flashcards" onClose={onClose} footer={<Button variant="p" onClick={onClose}>Close</Button>}>
      <div className="prose">No cards are due. They come back on a spaced schedule — or review the whole deck from Revision.</div>
    </Modal>;
  }

  if (i >= deck.length) {
    const pct = Math.round((right / deck.length) * 100);
    return (
      <Modal title="Flashcards done" onClose={onClose} footer={<Button variant="p" onClick={() => { logMinutes(0); onClose(); }}>Close</Button>}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 46, fontWeight: 680 }}>{pct}%</div>
          <div className="sub">{right} of {deck.length} recalled. Cards you missed come back tomorrow; the rest space out.</div>
        </div>
      </Modal>
    );
  }

  const card = deck[i];
  return (
    <Modal title="Flashcards" subtitle={`${i + 1} of ${deck.length} · ${card.topic}`} onClose={onClose}
      footer={shown ? (
        <>
          <Button variant="gh" onClick={() => { gradeFlash(card.id, false); setShown(false); setI(i + 1); }}>Missed it</Button>
          <Button variant="g" onClick={() => { gradeFlash(card.id, true); setRight(right + 1); setShown(false); setI(i + 1); }}>Got it</Button>
          <div className="sp" />
        </>
      ) : <span className="dim" style={{ fontSize: 12.5 }}>Say it out loud, then reveal.</span>}>
      <div style={{ minHeight: 150 }}>
        <div style={{ marginBottom: 18 }}><Bar pct={Math.round((i / deck.length) * 100)} /></div>
        <div className="h2" style={{ fontSize: 18, lineHeight: 1.5, marginBottom: 16 }}>{card.front}</div>
        {shown ? <Callout tone="ok"><div className="prose">{card.back}</div></Callout>
          : <div className="reveal"><Button onClick={() => setShown(true)}>Show answer</Button></div>}
      </div>
    </Modal>
  );
}
