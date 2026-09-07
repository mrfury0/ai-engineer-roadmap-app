import { useEffect, useRef } from "react";
import type { ViewProps } from "../App";
import {
  allItems, cases, flashdeck, interview, paceProfiles, projects, resources, tickets, weeks,
} from "../data";
import { useProgress } from "../state/ProgressContext";
import { useAuth } from "../state/AuthContext";
import { STORAGE_KEY } from "../state/progress";
import { todayIso } from "../lib/dates";
import { Markdown } from "../lib/markdown";
import { Button, Callout, Card, Pill, Section } from "../components/primitives";

const KEYS: [string, string][] = [
  ["Ctrl / ⌘ + K", "Command palette and global search"],
  ["G then D", "Dashboard"],
  ["G then T", "Today"],
  ["G then R", "Roadmap"],
  ["G then S", "Skill tree"],
  ["G then P", "Practice tickets"],
  ["G then I", "Interview prep"],
  ["N", "What should I do right now?"],
  ["F", "Start / stop a 25-minute focus sprint"],
  ["Esc", "Close overlay"],
];

const CORE_COUNT = allItems.filter((i) => i.pace === "core").length;
const OPTIONAL_COUNT = allItems.length - CORE_COUNT;
const TOTAL_HOURS = Math.round(allItems.reduce((s, i) => s + i.time, 0) / 60);

export function Settings({ setCrumbs }: ViewProps) {
  const { progress, setPace, reset, importProgress, storageAvailable, pushToast } = useProgress();
  const { user, configured, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setCrumbs(<b>Settings</b>), [setCrumbs]);

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-engineer-roadmap-progress-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast("Exported. Keep it somewhere you'll find it.", "ok");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (importProgress(parsed)) pushToast("Imported. Your progress is back.", "ok");
        else pushToast("That file could not be read as progress data.");
      } catch {
        pushToast("That file could not be read as progress data.");
      }
    };
    reader.readAsText(file);
  };

  const onReset = () => {
    if (window.confirm("Delete all progress, notes, confidence ratings and quiz results? This cannot be undone.")) {
      reset();
      pushToast("Everything reset.");
    }
  };

  return (
    <div className="page">
      <div className="h1">Settings</div>
      <div className="sub">
        Progress lives in this browser. Export regularly if you care about it — that is your cross-device story.
      </div>

      <Section title="Pace" />
      <div className="grid g3">
        {paceProfiles.map((p) => {
          const items = allItems.filter((i) => p.includes.includes(i.pace));
          const hours = items.reduce((s, i) => s + i.time, 0) / 60;
          const projected = Math.round((hours / (p.hoursPerDay * 6)) * 10) / 10;
          const extra = items.length - CORE_COUNT;
          const selected = progress.pace === p.id;
          return (
            <Card
              key={p.id}
              className="hov"
              onClick={() => setPace(p.id)}
              style={selected ? { borderColor: "var(--ac)", background: "var(--ac-dim)" } : undefined}
            >
              <div className="row">
                <div className="h3">{p.name}</div>
                <div className="sp" />
                {selected ? <Pill tone="ac">Selected</Pill> : null}
              </div>
              <div className="sub" style={{ margin: "6px 0 10px" }}>{p.blurb}</div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Pill tone="out">~{p.hoursPerDay}h/day</Pill>
                <Pill tone="out">{items.length} steps</Pill>
                <Pill tone="out">{Math.round(hours)}h of work</Pill>
              </div>
              <div className="dim" style={{ fontSize: 12, marginTop: 9 }}>
                Finishes in about <b style={{ color: "var(--tx-2)" }}>{projected} weeks</b> at 6 days a week
                {extra ? ` · includes ${extra} optional extension steps` : " · core curriculum only"}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <Callout tone="ac">
          <Markdown text={
            `Changing pace never removes progress or the core curriculum — it only hides or reveals the ${OPTIONAL_COUNT} optional extension steps.\n\n` +
            `**The honest arithmetic.** The full curriculum is about ${TOTAL_HOURS} hours of estimated work. ` +
            "Those estimates are for reading and building at a steady clip — real builds overrun, so budget roughly 1.3x. " +
            "At two hours a day, six days a week, the twelve weeks fit with slack for the overruns; at one hour a day it is closer to sixteen weeks, and that is fine. " +
            "The sequence matters more than the calendar."
          } />
        </Callout>
      </div>

      <Section title="Your data" />
      <Card>
        {configured && user ? (
          <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
            <div className="sub">Signed in as {user.email}</div>
            <div className="sp" />
            <Button variant="gh" onClick={() => void signOut()}>Sign out</Button>
          </div>
        ) : null}
        <div className="prose" style={{ marginBottom: 12 }}>
          <p>
            {configured ? "Your progress is synced to your private account. A local copy is also kept under " :
              "Everything is stored locally in this browser under "}<code>{STORAGE_KEY}</code>.
            {configured ? " Export remains available as a backup." : " Nothing is sent anywhere. To move to another machine, export here and import there."}
          </p>
        </div>
        {storageAvailable ? null : (
          <div style={{ marginBottom: 12 }}>
            <Callout tone="bad">
              <div className="prose">
                <p>
                  This browser is refusing to store data, so nothing you do here will survive a reload. Export
                  before you close the tab, or switch out of private browsing.
                </p>
              </div>
            </Callout>
          </div>
        )}
        <div className="row wrap" style={{ gap: 8 }}>
          <Button variant="p" onClick={exportProgress}>⬇ Export progress (JSON)</Button>
          <Button onClick={() => fileRef.current?.click()}>⬆ Import progress</Button>
          <Button variant="gh" onClick={onReset}>
            <span style={{ color: "var(--bad)" }}>Reset everything</span>
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hide" onChange={onFile} />
      </Card>

      <Section title="Keyboard" />
      <Card className="pad0">
        <table className="t">
          <tbody>
            {KEYS.map(([key, what]) => (
              <tr key={key}>
                <td style={{ width: 150 }}><span className="kbd">{key}</span></td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Section title="About" />
      <Card>
        <div className="prose">
          <p>
            {weeks.length} weeks · {allItems.length} steps · {resources.length} verified resources ·{" "}
            {interview.length} interview questions · {tickets.length} incident tickets · {cases.length}{" "}
            consulting cases · {flashdeck.length} flashcards · {projects.length} projects. Runs entirely offline
            in one file.
          </p>
        </div>
      </Card>
    </div>
  );
}
