import { useEffect, useMemo, useState } from "react";
import type { SessionMode, ViewProps } from "../App";
import type { Energy, Item } from "../types";
import { dayOfItem, itemById, weekOfItem } from "../data";
import { useProgress } from "../state/ProgressContext";
import { planSession, remainingItems } from "../lib/selectors";
import { humanMinutes } from "../lib/dates";
import { truncate } from "../lib/markdown";
import { Button, Callout, Card, Empty, Pill } from "../components/primitives";
import { ItemCard } from "../components/ItemCard";

interface ModeConfig { minutes: number; energy: Energy; label: string }

const MODES: Record<SessionMode, ModeConfig> = {
  quick: { minutes: 20, energy: "low", label: "⚡ 20 min" },
  hour: { minutes: 60, energy: "normal", label: "◐ 1 hour" },
  deep: { minutes: 165, energy: "deep", label: "● Deep work" },
  tired: { minutes: 10, energy: "low", label: "🌙 No-zero day" },
};

const MODE_ORDER: SessionMode[] = ["quick", "hour", "deep", "tired"];

export function Today({
  param, navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer,
  sessionMode, setSessionMode, setCrumbs,
}: ViewProps) {
  const { progress } = useProgress();
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => setCrumbs(
    <>
      <span onClick={() => navigate("dashboard")} style={{ cursor: "pointer" }}>Dashboard</span>
      {" / "}
      <b>Today</b>
    </>
  ), [setCrumbs, navigate]);

  const lead = param ? itemById.get(param) ?? null : null;

  // A named item leads the plan and opens straight away.
  useEffect(() => { if (lead) setOpenItem(lead.id); }, [lead, setOpenItem]);

  // A new mode or a new lead item means a fresh plan, not a pile of old rejections.
  useEffect(() => { setSkipped([]); }, [sessionMode, param]);

  const cfg = MODES[sessionMode];

  const plan = useMemo<Item[]>(() => {
    const build = (skip: Set<string>): Item[] => {
      let budget = cfg.minutes - (lead?.time ?? 0);
      const chosen = planSession(progress, budget, cfg.energy)
        .filter((i) => i.id !== lead?.id && !skip.has(i.id));
      budget -= chosen.reduce((s, i) => s + i.time, 0);
      if (budget > 8) {
        // Reshuffling thins the greedy plan; top it back up so the time still gets filled.
        const taken = new Set(chosen.map((i) => i.id));
        for (const i of remainingItems(progress)) {
          if (budget <= 8) break;
          if (i.id === lead?.id || taken.has(i.id) || skip.has(i.id)) continue;
          if (i.time > budget + 8) continue;
          chosen.push(i);
          taken.add(i.id);
          budget -= i.time;
        }
      }
      return chosen;
    };

    let rest = build(new Set(skipped));
    if (!rest.length && skipped.length) rest = build(new Set()); // wrapped round; start again
    return lead ? [lead, ...rest] : rest;
  }, [progress, cfg, lead, skipped]);

  const total = plan.reduce((s, i) => s + i.time, 0);
  const momentum = remainingItems(progress).filter((i) => i.time <= 30).slice(0, 3);

  const reshuffle = () => {
    const drop = plan.filter((i) => i.id !== lead?.id).map((i) => i.id);
    setSkipped((s) => [...s, ...drop]);
  };

  return (
    <div className="page">
      <div className="row">
        <div>
          <div className="h1">Today</div>
          <div className="sub">
            A session built for the time and energy you actually have — not an idealised version of you.
          </div>
        </div>
      </div>

      <Card style={{ margin: "14px 0" }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="segbtns">
            {MODE_ORDER.map((m) => (
              <button key={m} type="button" className={sessionMode === m ? "on" : ""}
                onClick={() => setSessionMode(m)}>
                {MODES[m].label}
              </button>
            ))}
          </div>
          <div className="sp" />
          <Pill>{plan.length} steps</Pill>
          <Pill>{humanMinutes(total)}</Pill>
          <Button size="sm" variant="gh" onClick={reshuffle}>↻ Different steps</Button>
        </div>

        {sessionMode === "tired" ? (
          <div style={{ marginTop: 12 }}>
            <Callout tone="ok">
              <div className="prose">
                <strong>No-zero day.</strong> Ten minutes of real work beats a day written off. Do the one
                step below, mark it, close the laptop. That still counts and your streak survives.
              </div>
            </Callout>
          </div>
        ) : null}

        {sessionMode === "deep" ? (
          <div style={{ marginTop: 12 }}>
            <Callout tone="ac">
              <div className="prose">
                <strong>Deep work.</strong> Phone in another room, notifications off, one browser window.
                Start the sprint timer on the first step — momentum comes from starting, not from feeling ready.
              </div>
            </Callout>
          </div>
        ) : null}
      </Card>

      {plan.length ? (
        <>
          {plan.map((item, idx) => {
            const week = weekOfItem.get(item.id);
            const day = dayOfItem.get(item.id);
            return (
              <div key={item.id}>
                <div className="dim mono" style={{ fontSize: 11, margin: "14px 0 5px" }}>
                  {week && day ? `Week ${week.week} · Day ${day.day} · ${day.title}` : item.kind}
                </div>
                <ItemCard
                  item={item}
                  open={openItem === item.id || (openItem === null && idx === 0)}
                  onToggleOpen={() => setOpenItem(openItem === item.id ? null : item.id)}
                  onJump={jumpToItem}
                  onOpenQuiz={(id) => openOverlay({ kind: "quiz", quizId: id })}
                  onOpenCase={(id) => navigate("cases", id)}
                  onStartTimer={startTimer}
                />
              </div>
            );
          })}

          <Card style={{ marginTop: 18 }}>
            <div className="h3" style={{ marginBottom: 8 }}>Momentum</div>
            <div className="sub" style={{ marginBottom: 11 }}>
              Finished something? Ride it. These are short and adjacent.
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {momentum.map((i) => (
                <Button key={i.id} size="sm" variant="gh" onClick={() => navigate("today", i.id)}>
                  {truncate(i.title, 40)} · {humanMinutes(i.time)}
                </Button>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Empty>Nothing left at this pace. Try Intensive in Settings, or work through the ticket queue.</Empty>
      )}
    </div>
  );
}
