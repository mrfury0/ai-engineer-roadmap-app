import { useEffect } from "react";
import type { ViewProps } from "../App";
import { flashdeck, weekOfItem } from "../data";
import { useProgress } from "../state/ProgressContext";
import { revisionQueue } from "../lib/selectors";
import { formatDate } from "../lib/dates";
import { Button, Card, Empty, Pill, Section, Stat } from "../components/primitives";
import { ItemBody } from "../components/ItemCard";
import { dueCards } from "../components/FlashcardRunner";

export function Revision({
  navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer, setCrumbs,
}: ViewProps) {
  const { progress, markRevised } = useProgress();
  useEffect(() => setCrumbs(<b>Revision</b>), [setCrumbs]);

  const queue = revisionQueue(progress);
  const due = queue.filter((r) => r.overdue);
  const later = queue.filter((r) => !r.overdue);
  const cards = dueCards(progress.flash);

  return (
    <div className="page">
      <div>
        <div className="h1">Revision</div>
        <div className="sub">
          Anything you marked “need revision” or “confused”, plus low-confidence topics, on a spaced
          schedule. Forgetting is normal; leaving it forgotten is the problem.
        </div>
      </div>

      <div className="grid g3" style={{ margin: "16px 0" }}>
        <Stat label="Due now" value={due.length} note="topics to revisit" />
        <Stat label="Scheduled" value={later.length} note="coming back later" />
        <Stat label="Flashcards due" value={cards.length} note={`of ${flashdeck.length} in the deck`} />
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
        <Button variant="p" onClick={() => openOverlay({ kind: "flash", all: false })}>
          Start flashcard session ({cards.length})
        </Button>
        <Button variant="gh" onClick={() => openOverlay({ kind: "flash", all: true })}>
          Review whole deck
        </Button>
      </div>

      <Section title="Due now" />
      {due.length ? due.map((r) => {
        const week = weekOfItem.get(r.id);
        const open = openItem === r.id;
        const toggle = () => setOpenItem(open ? null : r.id);
        return (
          <div className={`item${open ? " open" : ""}`} key={r.id} id={`i-${r.id}`}>
            <div className="ihead" onClick={toggle} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") toggle(); }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ititle">{r.item.title}</div>
                <div className="imeta">
                  <Pill tone={r.status === "confused" ? "bad" : r.status === "revision" ? "warn" : "out"}>
                    {r.status}
                  </Pill>
                  {week ? <Pill tone="out">Week {week.week}</Pill> : null}
                  <Pill tone="out">due {formatDate(r.due)}</Pill>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" variant="gh" onClick={() => jumpToItem(r.id)}>Open</Button>
                <Button size="sm" variant="g" onClick={() => markRevised(r.id)}>✓ Solid now</Button>
              </div>
            </div>
            {open ? (
              <ItemBody
                item={r.item}
                open={open}
                onToggleOpen={toggle}
                onJump={jumpToItem}
                onOpenQuiz={(id) => openOverlay({ kind: "quiz", quizId: id })}
                onOpenCase={(id) => navigate("cases", id)}
                onStartTimer={startTimer}
              />
            ) : null}
          </div>
        );
      }) : (
        <Empty>
          Nothing due. Mark a lesson “need revision” or “confused” and it appears here straight away; once you mark it solid it returns after 1, 3, 7, 16 then 35 days.
        </Empty>
      )}

      {later.length ? (
        <>
          <Section title="Scheduled" />
          <Card className="pad0">
            <table className="t">
              <thead>
                <tr><th>Topic</th><th>Week</th><th>Flag</th><th>Returns</th></tr>
              </thead>
              <tbody>
                {later.map((r) => (
                  <tr key={r.id}>
                    <td>{r.item.title}</td>
                    <td>{weekOfItem.get(r.id)?.week ?? "—"}</td>
                    <td>{r.status}</td>
                    <td>{formatDate(r.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
