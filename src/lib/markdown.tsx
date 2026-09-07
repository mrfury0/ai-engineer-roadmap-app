import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny markdown subset: paragraphs, "- " bullets, **bold** and `code`.
 * Rendered to React nodes rather than injected as HTML, so authored content can never
 * become an XSS vector.
 */
export function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    const list = bullets;
    bullets = [];
    blocks.push(
      <ul key={key}>
        {list.map((b, i) => (
          <li key={i}>{renderInline(b, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  text.split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushBullets(`ul-${idx}`);
    if (line) blocks.push(<p key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</p>);
  });
  flushBullets("ul-end");

  return <div className={className ?? "prose"}>{blocks}</div>;
}

/** Inline-only variant for places where a wrapping <div> would break layout. */
export function Inline({ text }: { text: string }) {
  return <Fragment>{renderInline(text)}</Fragment>;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
