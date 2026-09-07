import { useEffect, useState } from "react";
import type { ViewProps } from "../App";
import type { Ticket } from "../types";
import { ticketById, tickets } from "../data";
import { useProgress } from "../state/ProgressContext";
import { humanMinutes } from "../lib/dates";
import { Markdown } from "../lib/markdown";
import { Button, Callout, Difficulty, Pill, Stat } from "../components/primitives";

/** Severity maps straight onto the pill tones: P1 is an incident, P3 is a nag. */
const SEVERITY = { P1: "bad", P2: "warn", P3: "out" } as const;

export function Practice({ param, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  const [open, setOpen] = useState<string | null>(() => (param && ticketById.has(param) ? param : null));

  useEffect(() => setCrumbs(<b>Engineering Tickets</b>), [setCrumbs]);
  useEffect(() => {
    if (param && ticketById.has(param)) setOpen(param);
  }, [param]);

  const openTickets = tickets.filter((t) => !progress.tickets[t.id]?.done);
  const xpAvailable = openTickets.reduce((s, t) => s + t.xp, 0);

  return (
    <div className="page">
      <div>
        <div className="h1">Engineering tickets</div>
        <div className="sub">
          Fourteen incidents from a production AI platform, written the way they actually land in your
          queue. Diagnose before you reveal.
        </div>
      </div>

      <div className="grid g3" style={{ margin: "16px 0" }}>
        <Stat label="Open" value={openTickets.length} note="waiting for you" />
        <Stat label="Resolved" value={tickets.length - openTickets.length} note={`of ${tickets.length}`} />
        <Stat label="XP available" value={xpAvailable.toLocaleString()} note="from open tickets" />
      </div>

      {tickets.map((t) => (
        <TicketRow
          key={t.id}
          ticket={t}
          open={open === t.id}
          onToggle={() => setOpen((cur) => (cur === t.id ? null : t.id))}
        />
      ))}
    </div>
  );
}

function TicketRow({ ticket, open, onToggle }: { ticket: Ticket; open: boolean; onToggle: () => void }) {
  const { progress, toggleTicket } = useProgress();
  const done = Boolean(progress.tickets[ticket.id]?.done);
  /* Hints and the root cause stay revealed once shown — closing the ticket does not un-tell you. */
  const [hints, setHints] = useState<number[]>([]);
  const [rootCause, setRootCause] = useState(false);

  return (
    <div className={`item${open ? " open" : ""}${done ? " done-y" : ""}`} id={`t-${ticket.id}`}>
      <div
        className="ihead"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onToggle(); }}
      >
        <div
          className={`chk${done ? " on" : ""}`}
          title={done ? "Reopen ticket" : "Mark resolved"}
          role="checkbox"
          aria-checked={done}
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); toggleTicket(ticket.id); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleTicket(ticket.id); }
          }}
        >✓</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ititle">
            <span className="mono dim" style={{ fontSize: 11 }}>{ticket.id}</span> {ticket.title}
          </div>
          <div className="sub" style={{ fontSize: 12.6, marginTop: 3 }}>{ticket.symptom}</div>
          <div className="imeta">
            <Pill tone={SEVERITY[ticket.severity]}>{ticket.severity}</Pill>
            <Pill tone="out">{ticket.area}</Pill>
            <Pill>{humanMinutes(ticket.time)}</Pill>
            <Difficulty level={ticket.difficulty} />
          </div>
        </div>
        <div className="dim" style={{ fontSize: 11, paddingTop: 3 }}>+{ticket.xp} XP</div>
      </div>

      {open ? (
        <div className="ibody">
          <div className="blk">
            <div className="lbl">Context</div>
            <Markdown text={ticket.context} />
          </div>
          <div className="blk">
            <div className="lbl">Evidence</div>
            <pre className="code warnbox">{ticket.artifact}</pre>
          </div>
          <div className="blk">
            <div className="lbl">Your mission</div>
            <Callout tone="ac"><Markdown text={ticket.mission} /></Callout>
          </div>

          <div className="row wrap" style={{ marginTop: 12, gap: 7 }}>
            {ticket.hints.map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant="gh"
                onClick={() => setHints((h) => (h.includes(i) ? h : [...h, i]))}
              >
                Hint {i + 1}
              </Button>
            ))}
            <Button size="sm" onClick={() => setRootCause(true)}>Reveal root cause</Button>
          </div>

          <div style={{ marginTop: 10 }}>
            {[...hints].sort((a, b) => a - b).map((i) => (
              <div className="callout" key={i} style={{ marginBottom: 7 }}>
                <div className="prose"><strong>Hint {i + 1}.</strong> {ticket.hints[i]}</div>
              </div>
            ))}
            {rootCause ? (
              <Callout tone="ok">
                <div className="lbl-mini">Root cause &amp; fix</div>
                <Markdown text={ticket.resolution} />
                <hr className="sep" />
                <div className="prose"><strong>The lesson.</strong> {ticket.lesson}</div>
              </Callout>
            ) : null}
          </div>

          <hr className="sep" />
          <Button variant={done ? "gh" : "g"} onClick={() => toggleTicket(ticket.id)}>
            {done ? "↺ Reopen" : `✓ Resolved (+${ticket.xp} XP)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
