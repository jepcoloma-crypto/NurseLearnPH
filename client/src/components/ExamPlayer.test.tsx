import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExamPlayer, ExamResult, formatDuration, type ExamQuestion, type ExamInfo, type ExamAttemptRow } from "./ExamPlayer";

const exam: ExamInfo = {
  id: "exam-1",
  title: "Mock Exam",
  timeLimitMinutes: 60,
  passingScore: 75,
  questionCount: 2,
};

// In-progress contract: never carries the answer key
const questions: ExamQuestion[] = [
  {
    id: "q1",
    questionText: "Question one?",
    questionType: "MC",
    difficulty: "MEDIUM",
    options: [
      { id: "q1-a", optionText: "Alpha", order: 0 },
      { id: "q1-b", optionText: "Beta", order: 1 },
    ],
  },
  {
    id: "q2",
    questionText: "Question two?",
    questionType: "MC",
    difficulty: "EASY",
    options: [
      { id: "q2-a", optionText: "One", order: 0 },
      { id: "q2-b", optionText: "Two", order: 1 },
    ],
  },
];

// Completed contract: carries correct flags and explanations
const reviewedQuestions: ExamQuestion[] = [
  {
    ...questions[0],
    explanation: "Because alpha is correct.",
    options: [
      { id: "q1-a", optionText: "Alpha", order: 0, isCorrect: true },
      { id: "q1-b", optionText: "Beta", order: 1 },
    ],
  },
  { ...questions[1] },
];

const completedAttempt: ExamAttemptRow = {
  id: "attempt-1",
  examId: "exam-1",
  score: 100,
  totalQuestions: 2,
  correctAnswers: 2,
  timeSpentSeconds: 65,
  startedAt: "2026-09-23T08:00:00.000Z",
  completedAt: "2026-09-23T08:01:05.000Z",
  status: "COMPLETED",
};

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats hours as h:mm:ss", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("clamps negative values to zero", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("ExamPlayer", () => {
  it("renders the current question with options and progress", () => {
    render(
      <ExamPlayer
        exam={exam}
        startedAt={new Date().toISOString()}
        questions={questions}
        submitting={false}
        onSubmit={vi.fn()}
        onQuit={vi.fn()}
      />
    );
    expect(screen.getByText("Question one?")).toBeInTheDocument();
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("records an answer, updates progress, and navigates", async () => {
    const user = userEvent.setup();
    render(
      <ExamPlayer
        exam={exam}
        startedAt={new Date().toISOString()}
        questions={questions}
        submitting={false}
        onSubmit={vi.fn()}
        onQuit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(screen.getByText(/Question 1 of 2 · 1 answered/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Question two?")).toBeInTheDocument();
  });

  it("confirms submission and sends every question, unanswered included", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ExamPlayer
        exam={exam}
        startedAt={new Date().toISOString()}
        questions={questions}
        submitting={false}
        onSubmit={onSubmit}
        onQuit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("button", { name: "Submit Exam" }));

    expect(screen.getByText("Submit exam?")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 questions answered.")).toBeInTheDocument();
    expect(screen.getByText(/1 unanswered question will be counted as incorrect\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit Now" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: "q1", selectedOptionId: "q1-a" },
      { questionId: "q2", selectedOptionId: undefined },
    ]);
  });

  it("auto-submits once when the time limit has already expired", () => {
    const onSubmit = vi.fn();
    render(
      <ExamPlayer
        exam={{ ...exam, timeLimitMinutes: 5 }}
        startedAt={new Date(Date.now() - 10 * 60_000).toISOString()}
        questions={questions}
        submitting={false}
        onSubmit={onSubmit}
        onQuit={vi.fn()}
      />
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("ExamResult", () => {
  it("shows a passing score with per-question review and explanation", () => {
    render(
      <ExamResult
        exam={exam}
        attempt={completedAttempt}
        questions={reviewedQuestions}
        answers={[
          { questionId: "q1", selectedOptionId: "q1-a", isCorrect: true },
          { questionId: "q2", selectedOptionId: "q2-a", isCorrect: true },
        ]}
        onBack={vi.fn()}
        onRetake={vi.fn()}
      />
    );
    expect(screen.getByText("PASSED")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 correct/)).toBeInTheDocument();
    expect(screen.getByText(/Time: 1:05/)).toBeInTheDocument();
    expect(screen.getByText("Because alpha is correct.")).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
  });

  it("shows a failing score and reveals the correct answer for wrong picks", () => {
    render(
      <ExamResult
        exam={exam}
        attempt={{ ...completedAttempt, score: 40, correctAnswers: 1 }}
        questions={reviewedQuestions}
        answers={[
          { questionId: "q1", selectedOptionId: "q1-b", isCorrect: false },
          { questionId: "q2", selectedOptionId: "q2-a", isCorrect: true },
        ]}
        onBack={vi.fn()}
        onRetake={vi.fn()}
      />
    );
    expect(screen.getByText("NOT PASSED")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getAllByText(/Your answer:/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
  });
});
