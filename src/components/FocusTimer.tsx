import { useEffect, useRef, useState } from "react";
import { itemById } from "../data";

export interface TimerSpec { minutes: number; itemId: string | null }

export function FocusTimer({ spec, onFinish, onStop }: {
  spec: TimerSpec; onFinish: (minutes: number, itemId: string | null) => void; onStop: () => void;
}) {
  const [remaining, setRemaining] = useState(spec.minutes * 60_000);
  const [paused, setPaused] = useState(false);
  const endsAt = useRef(Date.now() + spec.minutes * 60_000);
  const finished = useRef(false);

  useEffect(() => {
    endsAt.current = Date.now() + spec.minutes * 60_000;
    setRemaining(spec.minutes * 60_000);
    setPaused(false);
    finished.current = false;
  }, [spec]);

  useEffect(() => {
    if (paused) return;
    const iv = window.setInterval(() => {
      const left = endsAt.current - Date.now();
      setRemaining(left);
      if (left <= 0 && !finished.current) {
        finished.current = true;
        window.clearInterval(iv);
        onFinish(spec.minutes, spec.itemId);
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [paused, spec, onFinish]);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const label = spec.itemId ? itemById.get(spec.itemId)?.title ?? "Focus sprint" : "Focus sprint";

  return (
    <div id="timer">
      <div className="row">
        <div className="tt">{Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, "0")}</div>
        <div className="sp" />
        <button className="btn sm gh" onClick={() => {
          if (paused) endsAt.current = Date.now() + remaining;
          setPaused((v) => !v);
        }} aria-label={paused ? "Resume" : "Pause"}>{paused ? "▶" : "❚❚"}</button>
        <button className="btn sm gh" onClick={onStop} aria-label="Stop timer">✕</button>
      </div>
      <div className="tl">{label}</div>
    </div>
  );
}
