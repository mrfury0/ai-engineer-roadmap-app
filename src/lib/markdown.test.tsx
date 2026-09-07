import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Inline, Markdown, truncate } from "./markdown";

describe("Markdown", () => {
  it("renders a plain line as a paragraph", () => {
    const { container } = render(<Markdown text="A typed, validated CLI." />);
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(1);
    expect(ps[0]).toHaveTextContent("A typed, validated CLI.");
  });

  it("renders **bold** as <strong>", () => {
    const { container } = render(<Markdown text="You must **always** validate at the boundary." />);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent("always");
    // The surrounding prose survives intact.
    expect(container.textContent).toBe("You must always validate at the boundary.");
  });

  it("renders a backtick span as <code>", () => {
    const { container } = render(<Markdown text="Run `uv sync` first." />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent("uv sync");
    expect(container.textContent).toBe("Run uv sync first.");
  });

  it("handles bold and code in the same line, in order", () => {
    const { container } = render(<Markdown text="**Note:** call `raise from` to chain." />);
    expect(container.querySelector("strong")).toHaveTextContent("Note:");
    expect(container.querySelector("code")).toHaveTextContent("raise from");
    expect(container.textContent).toBe("Note: call raise from to chain.");
  });

  it("turns '- ' lines into a <ul> of <li>s", () => {
    const { container } = render(<Markdown text={"- first\n- second\n- third"} />);
    const uls = container.querySelectorAll("ul");
    expect(uls).toHaveLength(1);
    const lis = uls[0].querySelectorAll("li");
    expect(lis).toHaveLength(3);
    expect([...lis].map((li) => li.textContent)).toEqual(["first", "second", "third"]);
  });

  it("accepts '* ' bullets too, and formats inside them", () => {
    const { container } = render(<Markdown text={"* run `pytest`\n* ship it"} />);
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("li code")).toHaveTextContent("pytest");
  });

  it("closes a list when prose resumes below it", () => {
    const { container } = render(<Markdown text={"Steps:\n- one\n- two\n\nThen deploy."} />);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("renders nothing at all for blank input", () => {
    expect(render(<Markdown text="" />).container).toBeEmptyDOMElement();
    expect(render(<Markdown text={null} />).container).toBeEmptyDOMElement();
    expect(render(<Markdown text={undefined} />).container).toBeEmptyDOMElement();
  });

  it("takes a class name, defaulting to .prose", () => {
    const { container } = render(<Markdown text="hello" />);
    expect(container.firstElementChild).toHaveClass("prose");
    const custom = render(<Markdown text="hello" className="lead" />).container;
    expect(custom.firstElementChild).toHaveClass("lead");
  });
});

describe("Inline", () => {
  it("renders formatting without a wrapping block element", () => {
    const { container } = render(<Inline text="a **bold** word" />);
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.textContent).toBe("a bold word");
  });
});

/**
 * The markdown renderer exists so authored content never has to go through
 * dangerouslySetInnerHTML. If any of these ever produce a real element, that guarantee
 * is gone — this is the regression test that must never be relaxed.
 */
describe("Markdown is not an XSS vector", () => {
  it("renders a <script> tag as literal text, not as an element", () => {
    const evil = "<script>alert('xss')</script>";
    const { container } = render(<Markdown text={evil} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe(evil);
  });

  it("renders an onerror image payload as literal text", () => {
    const evil = "<img src=x onerror=\"alert('xss')\">";
    const { container } = render(<Markdown text={evil} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(evil);
  });

  it("does not smuggle markup in through bold or code spans", () => {
    const { container } = render(
      <Markdown text={"**<script>alert(1)</script>** and `<img onerror=alert(1)>`"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("<script>alert(1)</script>");
    expect(container.querySelector("code")).toHaveTextContent("<img onerror=alert(1)>");
  });

  it("does not smuggle markup in through a bullet", () => {
    const { container } = render(<Markdown text={"- <iframe src=javascript:alert(1)></iframe>"} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("keeps the same guarantee in the inline variant", () => {
    const evil = "<script>alert('xss')</script>";
    const { container } = render(<Inline text={evil} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe(evil);
  });

  it("renders entity-encoded text verbatim rather than decoding it", () => {
    const { container } = render(<Markdown text={"&lt;script&gt;"} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("&lt;script&gt;");
  });
});

describe("truncate", () => {
  it("leaves short strings alone", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("exactly10!", 10)).toBe("exactly10!");
  });

  it("clips to the limit with an ellipsis", () => {
    expect(truncate("abcdefghijkl", 5)).toBe("abcd…");
    expect(truncate("abcdefghijkl", 5)).toHaveLength(5);
  });
});
