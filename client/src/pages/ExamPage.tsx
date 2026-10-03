import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { assessmentApi } from "@/services/api";
import { PageHeader, Button, LoadingSpinner, Badge } from "@/components/shared";
import { toast } from "react-hot-toast";

interface QuestionOption {
  id: string;
  text: string;
  order: number;
}

interface Question {
  id: string;
  stem: string;
  type: string;
  points: number;
  options: QuestionOption[];
}

interface QuestionLink {
  questionId: string;
  order: number;
  points: number;
  question: Question;
}

interface Attempt {
  id: string;
  assessmentId: string;
  status: string;
  startedAt: string;
  assessment: { title: string; timeLimitMinutes: number | null; passingScore: number };
  questions: QuestionLink[];
}

type Answers = Record<string, { selectedOptionId?: string | null; textAnswer?: string | null }>;

function getStorageKey(assessmentId: string) {
  return `exam_answers_${assessmentId}`;
}

function saveAnswersToStorage(assessmentId: string, answers: Answers) {
  try {
    localStorage.setItem(getStorageKey(assessmentId), JSON.stringify(answers));
  } catch {}
}

function loadAnswersFromStorage(assessmentId: string): Answers | null {
  try {
    const raw = localStorage.getItem(getStorageKey(assessmentId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearAnswersStorage(assessmentId: string) {
  try {
    localStorage.removeItem(getStorageKey(assessmentId));
  } catch {}
}

export default function ExamPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMutation = useMutation({
    mutationFn: (id: string) => assessmentApi.startAttempt(id),
    onSuccess: (res) => {
      setAttemptId(res.data.data.id);
    },
    onError: () => toast.error("Failed to start attempt"),
  });

  const { data: attemptData, isLoading: attemptLoading } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => assessmentApi.getAttempt(attemptId!),
    enabled: !!attemptId,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const answerArray = Object.entries(answers).map(([questionId, a]) => ({
        questionId,
        ...a,
      }));
      return assessmentApi.submitAttempt(attemptId!, { answers: answerArray });
    },
    onSuccess: (res) => {
      const { score, totalPossible, percentage } = res.data.data;
      clearAnswersStorage(assessmentId!);
      toast.success(`Submitted! Score: ${score}/${totalPossible} (${percentage}%)`);
      navigate(`/exam/${assessmentId}/result/${attemptId}`);
    },
    onError: () => toast.error("Failed to submit attempt"),
  });

  useEffect(() => {
    if (assessmentId) {
      startMutation.mutate(assessmentId);
    }
  }, [assessmentId]);

  const attempt: Attempt | null = attemptData?.data?.data ?? null;

  useEffect(() => {
    if (attempt && attemptId) {
      if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
        navigate(`/exam/${assessmentId}/result/${attemptId}`);
        return;
      }

      const saved = loadAnswersFromStorage(assessmentId!);
      if (saved && Object.keys(saved).length > 0) {
        setAnswers(saved);
        toast.success("Answers restored from previous session");
      }
    }
  }, [attempt, attemptId]);

  useEffect(() => {
    if (attempt?.assessment?.timeLimitMinutes && attempt.startedAt) {
      const startTime = new Date(attempt.startedAt).getTime();
      const totalSeconds = attempt.assessment.timeLimitMinutes * 60;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = totalSeconds - elapsed;
      if (remaining > 0) {
        setTimeLeft(remaining);
      } else {
        submitMutation.mutate();
      }
    }
  }, [attempt]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          submitMutation.mutate();
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft !== null]);

  useEffect(() => {
    if (!assessmentId || submitMutation.isSuccess) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (Object.keys(answers).length > 0) {
        saveAnswersToStorage(assessmentId, answers);
      }
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [answers, assessmentId, submitMutation.isSuccess]);

  const handleAnswer = useCallback((questionId: string, answer: { selectedOptionId?: string | null; textAnswer?: string | null }) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (startMutation.isPending || attemptLoading) {
    return (
      <div>
        <PageHeader title="Exam" subtitle="Loading..." />
        <LoadingSpinner />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div>
        <PageHeader title="Exam" subtitle="Failed to load attempt" />
      </div>
    );
  }

  const questions = attempt.questions ?? [];
  const currentQuestion = questions[currentIndex];

  return (
    <div>
      <PageHeader
        title={attempt.assessment?.title ?? "Exam"}
        subtitle={timeLeft !== null ? `Time remaining: ${formatTime(timeLeft)}` : undefined}
        actions={
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Submitting..." : "Submit Exam"}
          </Button>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1">
          {currentQuestion && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">{currentQuestion.question.type}</Badge>
                <span className="text-sm text-gray-500">{currentQuestion.question.points} pts</span>
              </div>
              <p className="text-gray-900 font-medium mb-6">{currentQuestion.question.stem}</p>

              {(currentQuestion.question.type === "MC" || currentQuestion.question.type === "TF") && (
                <div className="space-y-2">
                  {currentQuestion.question.options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        answers[currentQuestion.questionId]?.selectedOptionId === opt.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQuestion.questionId}
                        checked={answers[currentQuestion.questionId]?.selectedOptionId === opt.id}
                        onChange={() => handleAnswer(currentQuestion.questionId, { selectedOptionId: opt.id })}
                        className="text-primary-600"
                      />
                      <span>{opt.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.question.type === "ESSAY" && (
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={6}
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion.questionId]?.textAnswer ?? ""}
                  onChange={(e) => handleAnswer(currentQuestion.questionId, { textAnswer: e.target.value })}
                />
              )}

              {currentQuestion.question.type === "FILL_BLANK" && (
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Type your answer..."
                  value={answers[currentQuestion.questionId]?.textAnswer ?? ""}
                  onChange={(e) => handleAnswer(currentQuestion.questionId, { textAnswer: e.target.value })}
                />
              )}
            </div>
          )}

          <div className="flex justify-between mt-4">
            <Button
              variant="secondary"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 self-center">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <Button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex >= questions.length - 1}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="w-48 bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Questions</p>
          <div className="grid grid-cols-5 gap-1">
            {questions.map((q, i) => (
              <button
                key={q.questionId}
                onClick={() => setCurrentIndex(i)}
                className={`w-8 h-8 rounded text-xs font-medium ${
                  i === currentIndex
                    ? "bg-primary-600 text-white"
                    : answers[q.questionId]
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
