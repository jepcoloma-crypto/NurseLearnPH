import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Badge, Modal } from "@/components/shared";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  XCircle,
} from "lucide-react";

// ─── Types (mirrors the server's exam attempt contract) ──────────────────────

export interface ExamOption {
  id: string;
  optionText: string;
  order?: number;
  isCorrect?: boolean;
}

export interface ExamQuestion {
  id: string;
  questionText: string;
  questionType?: string;
  difficulty?: string;
  explanation?: string | null;
  options: ExamOption[];
}

export interface ExamInfo {
  id: string;
  title: string;
  description?: string | null;
  examType?: string;
  questionCount?: number;
  timeLimitMinutes: number;
  passingScore: number;
  showExplanations?: boolean;
}

export interface ExamAttemptRow {
  id: string;
  examId: string;
  score: number | null;
  totalQuestions: number;
  correctAnswers: number | null;
  timeSpentSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
}

export interface ExamAnswerRow {
  questionId: string;
  selectedOptionId?: string | null;
  isCorrect?: boolean | null;
}

export interface ExamSubmission {
  questionId: string;
  selectedOptionId?: string;
  timeSpentSeconds?: number;
}

export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

const sortedOptions = (question: ExamQuestion): ExamOption[] =>
  [...(question.options ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// ─── In-exam player ──────────────────────────────────────────────────────────

interface ExamPlayerProps {
  exam: ExamInfo;
  startedAt: string;
  questions: ExamQuestion[];
  initialAnswers?: Record<string, string>;
  submitting: boolean;
  onSubmit: (answers: ExamSubmission[]) => void;
  onQuit: () => void;
  onAnswersChange?: (answers: Record<string, string>) => void;
}

export function ExamPlayer({
  exam,
  startedAt,
  questions,
  initialAnswers,
  submitting,
  onSubmit,
  onQuit,
  onAnswersChange,
}: ExamPlayerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers ?? {});
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmMode, setConfirmMode] = useState<"submit" | "quit" | null>(null);
  const submittedRef = useRef(false);

  const deadlineMs = useMemo(
    () => new Date(startedAt).getTime() + exam.timeLimitMinutes * 60_000,
    [startedAt, exam.timeLimitMinutes]
  );
  const timeLeft = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  const question = questions[current];
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
  const unanswered = questions.length - answeredCount;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onAnswersChange?.(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // A failed submission resets this so the student can retry
  useEffect(() => {
    if (!submitting) submittedRef.current = false;
  }, [submitting]);

  const submitNow = () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setConfirmMode(null);
    onSubmit(questions.map((q) => ({ questionId: q.id, selectedOptionId: answers[q.id] })));
  };

  // Time's up — auto-submit whatever has been answered
  useEffect(() => {
    if (timeLeft <= 0) submitNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  if (!question) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-label={`Exam: ${exam.title}`}>
      <header className="border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 bg-white">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate">{exam.title}</h2>
          <p className="text-xs text-gray-500">
            Question {current + 1} of {questions.length} · {answeredCount} answered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 font-mono text-sm font-semibold px-2.5 py-1 rounded-lg border ${
              timeLeft <= 120 ? "text-red-600 border-red-300 bg-red-50" : "text-gray-700 border-gray-50 bg-gray-50"
            }`}
            aria-label="Time remaining"
          >
            <Clock size={15} />
            {formatDuration(timeLeft)}
          </span>
          <Button variant="danger" size="sm" onClick={() => setConfirmMode("quit")} disabled={submitting}>
            Quit
          </Button>
          <Button size="sm" onClick={() => setConfirmMode("submit")} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Exam"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-5xl grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <section className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <Badge variant="info">{question.questionType ?? "MC"}</Badge>
                  <Badge
                    variant={
                      question.difficulty === "EASY"
                        ? "success"
                        : question.difficulty === "HARD"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {question.difficulty ?? "MEDIUM"}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400">Attempt in progress</span>
              </div>

              <p className="font-medium leading-relaxed">{question.questionText}</p>

              <div className="space-y-2">
                {sortedOptions(question).map((opt, i) => {
                  const selected = answers[question.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))}
                      className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                        selected
                          ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt.optionText}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" size="sm" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                <ChevronLeft size={15} /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={current >= questions.length - 1}
                onClick={() => setCurrent((c) => c + 1)}
              >
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </section>

          <aside className="bg-white rounded-xl border border-gray-200 p-3 h-fit space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Navigate</p>
            <div className="grid grid-cols-6 md:grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const isAnswered = Boolean(answers[q.id]);
                const isCurrent = i === current;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-label={`Go to question ${i + 1}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`h-8 rounded text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-primary-700 text-white ring-2 ring-primary-300"
                        : isAnswered
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary-600" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-gray-300 bg-white" /> Not answered
              </span>
            </div>
          </aside>
        </div>
      </div>

      <Modal open={confirmMode === "submit"} onClose={() => setConfirmMode(null)} title="Submit exam?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {answeredCount} of {questions.length} questions answered.
          </p>
          {unanswered > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {unanswered} unanswered {unanswered === 1 ? "question" : "questions"} will be counted as incorrect.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmMode(null)}>
              Keep Working
            </Button>
            <Button onClick={submitNow} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Now"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmMode === "quit"} onClose={() => setConfirmMode(null)} title="Quit exam?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This attempt will be discarded and you can start fresh later. Nothing is saved.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmMode(null)}>
              Keep Working
            </Button>
            <Button variant="danger" onClick={onQuit} disabled={submitting}>
              Quit &amp; Discard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Result + per-question review ────────────────────────────────────────────

interface ExamResultProps {
  exam: ExamInfo;
  attempt: ExamAttemptRow;
  questions: ExamQuestion[];
  answers: ExamAnswerRow[];
  busy?: boolean;
  onBack: () => void;
  onRetake: () => void;
}

export function ExamResult({ exam, attempt, questions, answers, busy, onBack, onRetake }: ExamResultProps) {
  const score = attempt.score ?? 0;
  const passed = score >= exam.passingScore;
  const answerFor = new Map(answers.map((a) => [a.questionId, a]));

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={15} /> Back to Exams
            </button>
            <h2 className="text-lg font-semibold mt-1">{exam.title} — Result</h2>
          </div>
          <Button size="sm" variant="secondary" onClick={onRetake} disabled={busy}>
            <RotateCcw size={14} className="mr-1" /> Retake
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`text-5xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>{score}%</div>
          <div className="flex-1 space-y-1">
            <Badge variant={passed ? "success" : "danger"}>{passed ? "PASSED" : "NOT PASSED"}</Badge>
            <p className="text-sm text-gray-600">
              {attempt.correctAnswers ?? 0} of {attempt.totalQuestions} correct · Passing score {exam.passingScore}%
            </p>
            <p className="text-xs text-gray-400">
              Time: {formatDuration(attempt.timeSpentSeconds ?? 0)}
              {attempt.completedAt && ` · Completed ${new Date(attempt.completedAt).toLocaleString()}`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Question review</h3>
          {questions.map((q, i) => {
            const answer = answerFor.get(q.id);
            const options = sortedOptions(q);
            const correctId = options.find((o) => o.isCorrect)?.id;
            const selectedId = answer?.selectedOptionId ?? undefined;
            const isCorrect = Boolean(
              answer?.isCorrect ?? (selectedId && correctId && selectedId === correctId)
            );
            const correctOption = options.find((o) => o.id === correctId);
            const selectedOption = options.find((o) => o.id === selectedId);
            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                  ) : selectedId ? (
                    <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium flex-1">
                    <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                    {q.questionText}
                  </p>
                </div>
                <div className="pl-7 space-y-1 text-sm">
                  {selectedOption ? (
                    <p className={isCorrect ? "text-green-700" : "text-red-600"}>
                      Your answer: <span className="font-medium">{selectedOption.optionText}</span>
                    </p>
                  ) : (
                    <p className="text-amber-600">Not answered</p>
                  )}
                  {!isCorrect && correctOption && (
                    <p className="text-green-700">
                      Correct answer: <span className="font-medium">{correctOption.optionText}</span>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={onBack}>
            Back to Exams
          </Button>
          <Button onClick={onRetake} disabled={busy}>
            <RotateCcw size={15} className="mr-1" /> Retake Exam
          </Button>
        </div>
      </div>
    </div>
  );
}
