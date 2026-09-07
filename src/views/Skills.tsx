import { useEffect } from "react";
import type { ViewProps } from "../App";
import { itemById, skillById, skills } from "../data";
import type { Skill, SkillCategory } from "../types";
import { useProgress } from "../state/ProgressContext";
import { isDone, skillState } from "../lib/selectors";
import { truncate } from "../lib/markdown";
import { Bar, Pill, Section, Stat } from "../components/primitives";
import type { PillTone } from "../components/primitives";

const LEVEL_LABEL = ["Not started", "Learning", "Competent", "Strong"] as const;
const LEVEL_TONE: PillTone[] = ["out", "warn", "ac", "ok"];

export function Skills({ jumpToItem, setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Skill Tree</b>), [setCrumbs]);

  const byCategory = new Map<SkillCategory, Skill[]>();
  for (const sk of skills) {
    const list = byCategory.get(sk.category);
    if (list) list.push(sk);
    else byCategory.set(sk.category, [sk]);
  }

  const tally = [0, 0, 0, 0];
  let lockedN = 0;
  for (const sk of skills) {
    const s = skillState(progress, sk);
    tally[s.level]++;
    if (s.locked) lockedN++;
  }
  const available = skills.length - tally[1] - tally[2] - tally[3] - lockedN;

  return (
    <div className="page wide">
      <div>
        <div className="h1">Skill tree</div>
        <div className="sub">
          A skill goes to <b>Competent</b> only when the lessons are done <i>and</i> you have
          evidence — a passed quiz, a shipped project, a fixed ticket. Watching something does not
          count.
        </div>
      </div>

      <div className="grid g4" style={{ margin: "16px 0" }}>
        <Stat label="Strong" value={tally[3]} note="can explain and teach" />
        <Stat label="Competent" value={tally[2]} note="can build with it" />
        <Stat label="Learning" value={tally[1]} note="in progress" />
        <Stat label="Available" value={available} note={`${lockedN} still gated by prerequisites`} />
      </div>

      {[...byCategory.entries()].map(([category, list]) => {
        const competent = list.filter((s) => skillState(progress, s).level >= 2).length;
        return (
          <div key={category}>
            <Section title={category}>
              <Pill tone={competent === list.length ? "ok" : "out"}>
                {competent}/{list.length} competent
              </Pill>
            </Section>
            <div className="grid g3">
              {list.map((sk) => {
                const s = skillState(progress, sk);
                const reqs = sk.requires.map((r) => skillById.get(r)?.name ?? r);
                return (
                  <div key={sk.id} className={`sk l${s.level}${s.locked ? " locked" : ""}`}>
                    <div className="skb" />
                    <div className="skn">{sk.icon} {sk.name}</div>
                    <div className="row" style={{ marginTop: 8, gap: 6 }}>
                      <Pill tone={LEVEL_TONE[s.level]}>
                        {s.locked ? "🔒 Locked" : LEVEL_LABEL[s.level]}
                      </Pill>
                      <Pill tone="out">{s.done}/{s.total} lessons</Pill>
                      {s.evidenceTotal ? (
                        <Pill tone={s.evidence === s.evidenceTotal ? "ok" : "out"}>
                          {s.evidence}/{s.evidenceTotal} evidence
                        </Pill>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <Bar pct={Math.round(s.ratio * 100)} tone={s.level >= 2 ? "ok" : ""} />
                    </div>
                    <div className="skd">{sk.blurb}</div>
                    {s.locked && reqs.length ? (
                      <div className="skd" style={{ color: "var(--tx-4)", marginTop: 6 }}>
                        🔒 needs: {reqs.join(", ")}
                      </div>
                    ) : null}
                    <div className="row wrap" style={{ marginTop: 9, gap: 5 }}>
                      {sk.items.slice(0, 6).map((id) => {
                        const item = itemById.get(id);
                        if (!item) return null;
                        const done = isDone(progress, id);
                        return (
                          <Pill key={id} tone={done ? "ok" : "out"} title={item.title}
                            onClick={() => jumpToItem(id)}>
                            {done ? "✓" : "○"} {truncate(item.title, 20)}
                          </Pill>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
