import { describe, expect, it } from "vitest";
import { search, type SearchGroup } from "./search";
import { emptyProgress, type Progress } from "../state/progress";
import { itemById } from "../data";

const p = (patch: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...patch });
const groupsOf = (hits: { group: SearchGroup }[]) => new Set(hits.map((h) => h.group));

describe("search", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    expect(search("", p())).toEqual([]);
    expect(search("   ", p())).toEqual([]);
    expect(search("\n\t", p())).toEqual([]);
  });

  it("returns nothing for a term that appears nowhere in the content", () => {
    expect(search("zzzznotathing", p())).toEqual([]);
  });

  it("finds a real term across more than one group", () => {
    const hits = search("embeddings", p());
    const groups = groupsOf(hits);
    expect(hits.length).toBeGreaterThan(1);
    expect(groups.size).toBeGreaterThan(1);
    expect(groups.has("Lessons")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(search("EMBEDDINGS", p()).length).toBe(search("embeddings", p()).length);
  });

  it("trims the query, so a trailing space from a paste does not kill the results", () => {
    expect(search("  embeddings  ", p()).length).toBe(search("embeddings", p()).length);
  });

  it("gives every hit a navigable target", () => {
    for (const hit of search("embeddings", p())) {
      expect(hit.target.route).toBeTruthy();
      expect(hit.title).toBeTruthy();
    }
  });

  it("searches the learner's own notes and points back at the lesson", () => {
    const noted = p({ notes: { w1d1a: "remember the qzqzqz trick for lockfiles" } });

    expect(search("qzqzqz", p())).toEqual([]);

    const hits = search("qzqzqz", noted);
    expect(hits).toHaveLength(1);
    expect(hits[0].group).toBe("Your notes");
    expect(hits[0].title).toBe(itemById.get("w1d1a")?.title);
    expect(hits[0].target.itemId).toBe("w1d1a");
  });

  it("ignores notes attached to ids that no longer exist, and empty notes", () => {
    const stale = p({ notes: { "ghost-item": "qzqzqz", w1d1b: "" } });
    expect(search("qzqzqz", stale)).toEqual([]);
  });

  it("caps the number of results", () => {
    expect(search("the", p(), 5)).toHaveLength(5);
    // A term this common would otherwise flood the palette.
    expect(search("the", p()).length).toBeLessThanOrEqual(60);
    expect(search("the", p())).toHaveLength(60);
  });
});
