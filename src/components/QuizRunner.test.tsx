import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizRunner } from "./QuizRunner";
import { ProgressProvider } from "../state/ProgressContext";
import { emptyProgress } from "../state/progress";
import type { Item, Week } from "../types";

/* ---------------- fixtures ----------------
 * Hand-built rather than imported from ../data: this test is about the runner's
 * behaviour, and it must not start failing when a quiz question is reworded.
 */

function lesson(id: string, title: string, terms: string[]): Item {
  return {
    id, kind: "lesson", title, time: 30, difficulty: 2, energy: "normal", pace: "core",
    prereqs: [], concept: "", why: "", learn: [], build: null, challenge: null,
    debugMission: null, reflection: [], done: [], xp: 40,
    keyConcepts: terms.map((term) => ({ term, def: "" })),
  };
}

const fakeWeek: Week = {
  id: "wt", week: 4, phase: 1, phaseName: "Test phase", title: "Test week",
  objective: "", narrative: "", whatYouCanBuild: "", whyProfessionally: "",
  days: [{
    id: "wtd1", day: 1, title: "Day one",
    items: [lesson("wtd1a", "Chunking strategies", ["chunk overlap"])],
  }],
  quiz: {
    id: "quiz-test", title: "Test quiz", passPct: 70,
    questions: [
      {
        type: "mcq",
        q: "What does a retriever return?",
        options: ["Ranked passages", "A fine-tuned model", "A prompt template"],
        answer: 0,
        explain: "It returns ranked passages for the generator to ground on.",
      },
      {
        type: "mcq",
        q: "Why use chunk overlap?",
        options: ["To save tokens", "To avoid splitting an idea across a boundary"],
        answer: 1,
        explain: "Overlap keeps an idea from being cut in half by chunk boundaries.",
      },
    ],
  },
};

function renderQuiz() {
  const onClose = vi.fn();
  const onOpenRevision = vi.fn();
  const user = userEvent.setup();
  render(
    <ProgressProvider initial={emptyProgress()}>
      <QuizRunner week={fakeWeek} onClose={onClose} onOpenRevision={onOpenRevision} />
    </ProgressProvider>,
  );
  return { user, onClose, onOpenRevision };
}

const option = (text: string | RegExp) => screen.getByRole("button", { name: text });

describe("QuizRunner", () => {
  it("opens on the first question with the right position indicator", () => {
    renderQuiz();
    expect(screen.getByText("Test quiz")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("What does a retriever return?")).toBeInTheDocument();
    // No "Back" on the first question.
    expect(screen.queryByRole("button", { name: /Back/ })).toBeNull();
  });

  it("marks a correct answer and shows the explanation", async () => {
    const { user } = renderQuiz();
    await user.click(option(/Ranked passages/));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText(/ranked passages for the generator/)).toBeInTheDocument();
  });

  it("marks a wrong answer as such, still showing why", async () => {
    const { user } = renderQuiz();
    await user.click(option(/A prompt template/));
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.queryByText("Correct.")).toBeNull();
  });

  it("advances with Next and comes back with Back, keeping the answer", async () => {
    const { user } = renderQuiz();
    await user.click(option(/Ranked passages/));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Why use chunk overlap?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("shows Finish instead of Next on the last question", async () => {
    const { user } = renderQuiz();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("button", { name: /Finish/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull();
  });

  it("scores one right out of two as 50% and calls it below the bar", async () => {
    const { user } = renderQuiz();
    await user.click(option(/Ranked passages/));         // right
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(option(/To save tokens/));          // wrong
    await user.click(screen.getByRole("button", { name: /Finish/ }));

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Below the bar.")).toBeInTheDocument();
    expect(screen.getByText(/pass mark 70%/)).toBeInTheDocument();
  });

  it("scores a clean run as 100% and calls it strong", async () => {
    const { user } = renderQuiz();
    await user.click(option(/Ranked passages/));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(option(/To avoid splitting an idea/));
    await user.click(screen.getByRole("button", { name: /Finish/ }));

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Strong.")).toBeInTheDocument();
  });

  it("scores an unanswered quiz as 0%", async () => {
    const { user } = renderQuiz();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("offers a route into the revision queue from the result screen", async () => {
    const { user, onClose, onOpenRevision } = renderQuiz();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Finish/ }));

    await user.click(screen.getByRole("button", { name: /Open revision queue/ }));
    expect(onOpenRevision).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Done is pressed", async () => {
    const { user, onClose } = renderQuiz();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    await user.click(screen.getByRole("button", { name: /^Done$/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
