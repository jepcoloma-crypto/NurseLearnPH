import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nleApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal, EmptyState } from "@/components/shared";
import {
  ExamPlayer,
  ExamResult,
  formatDuration,
  type ExamInfo,
  type ExamQuestion,
  type ExamAttemptRow,
  type ExamAnswerRow,
  type ExamSubmission,
} from "@/components/ExamPlayer";
import { GraduationCap, Target, TrendingUp, ChevronLeft, ChevronRight, Sparkles, Play, ClipboardCheck, Clock, AlertTriangle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

export default function NLEPage() {
  const { can, isStudent } = usePermissions();
  const [tab, setTab] = useState<"categories" | "exams" | "questions" | "performance">("categories");
  const [qPage, setQPage] = useState(1);

  // Practice setup
  const [showSetup, setShowSetup] = useState(false);
  const [setupCat, setSetupCat] = useState("");
  const [setupDiff, setSetupDiff] = useState("");
  const [setupCount, setSetupCount] = useState(5);
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [starting, setStarting] = useState(false);

  // Practice quiz
  const [showPractice, setShowPractice] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<Record<string, unknown>[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    total: number; correctCount: number; score: number;
    results: { questionId: string; isCorrect: boolean; correctOptionId: string | null; correctOptionText: string | null; explanation: string | null }[];
  } | null>(null);

  // Exam-taking flow
  const [activeExam, setActiveExam] = useState<{
    exam: ExamInfo;
    attemptId: string;
    startedAt: string;
    questions: ExamQuestion[];
    initialAnswers: Record<string, string>;
  } | null>(null);
  const [examResult, setExamResult] = useState<{
    exam: ExamInfo;
    attempt: ExamAttemptRow;
    questions: ExamQuestion[];
    answers: ExamAnswerRow[];
  } | null>(null);
  const [examBusy, setExamBusy] = useState(false);

  const { data: categories, isLoading: loadingCat } = useQuery({
    queryKey: ["nle-categories"],
    queryFn: () => nleApi.listCategories(),
  });
  const { data: questions, isLoading: loadingQ } = useQuery({
    queryKey: ["nle-questions", qPage],
    queryFn: () => nleApi.listQuestions({ page: String(qPage), limit: "15" }),
    enabled: tab === "questions",
  });
  const { data: performance, isLoading: loadingPerf } = useQuery({
    queryKey: ["nle-performance"],
    queryFn: () => nleApi.getPerformance(),
    enabled: tab === "performance",
  });
  const { data: examsRes, isLoading: loadingExams } = useQuery({
    queryKey: ["nle-exams"],
    queryFn: () => nleApi.listExams({ limit: "50" }),
    enabled: tab === "exams" && isStudent,
  });
  const { data: attemptsRes, isLoading: loadingAttempts, refetch: refetchAttempts } = useQuery({
    queryKey: ["nle-exam-attempts"],
    queryFn: () => nleApi.listAttempts(),
    enabled: tab === "exams" && isStudent,
  });

  const rawCats = categories?.data?.data;
  const catList = Array.isArray(rawCats) ? rawCats : (rawCats?.items ?? []);
  const qList = questions?.data?.data?.items ?? [];
  const qPagination = questions?.data?.data?.pagination;
  const perfData = performance?.data?.data as Record<string, unknown> | undefined;
  const canPractice = can("nle.practice");
  const examList = (examsRes?.data?.data?.items ?? []) as unknown as ExamInfo[];
  const attemptList = (attemptsRes?.data?.data ?? []) as unknown as ExamAttemptRow[];
  const inProgressAttempt = attemptList.find((a) => a.status === "IN_PROGRESS");
  const inProgressExam = inProgressAttempt ? examList.find((e) => e.id === inProgressAttempt.examId) : undefined;

  const openSetup = (categoryId?: string) => {
    setSetupCat(categoryId ?? "");
    setSetupDiff("");
    setSetupCount(5);
    setHighYieldOnly(false);
    setShowSetup(true);
  };

  const startPractice = async () => {
    setStarting(true);
    try {
      const params: Record<string, string> = { count: String(setupCount) };
      if (setupCat) params.categoryId = setupCat;
      if (setupDiff) params.difficulty = setupDiff;
      if (highYieldOnly) params.highYieldOnly = "true";

      const res = await nleApi.getPractice(params);
      const qs = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.items ?? []);
      if (qs.length === 0) {
        toast.error("No questions found for these filters. Try different options.");
        return;
      }
      setPracticeQuestions(qs);
      setCurrentQ(0);
      setAnswers({});
      setCheckResult(null);
      setShowResult(false);
      setShowSetup(false);
      setShowPractice(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to start practice");
    } finally {
      setStarting(false);
    }
  };

  const selectAnswer = (qIdx: number, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optionId }));
  };

  const nextQuestion = async () => {
    if (currentQ < practiceQuestions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      return;
    }
    // Last question answered — grade server-side (answers are never sent to the client before this)
    setFinishing(true);
    try {
      const payload = practiceQuestions.map((q, idx) => ({
        questionId: String(q.id),
        selectedOptionId: answers[idx],
      }));
      const res = await nleApi.checkPractice({ answers: payload });
      setCheckResult(res.data.data);
      setShowResult(true);
    } catch {
      toast.error("Failed to grade your answers. Please try again.");
    } finally {
      setFinishing(false);
    }
  };

  // ─── Exam flow ─────────────────────────────────────────────────────────────
  const examStorageKey = (attemptId: string) => `nle-exam-answers:${attemptId}`;

  const readStoredAnswers = (attemptId: string): Record<string, string> => {
    try {
      const raw = sessionStorage.getItem(examStorageKey(attemptId));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const enterExam = (
    exam: ExamInfo,
    attempt: { id: string; startedAt: string },
    questions: ExamQuestion[],
    resume: boolean
  ) => {
    setExamResult(null);
    setActiveExam({
      exam,
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      questions,
      initialAnswers: resume ? readStoredAnswers(attempt.id) : {},
    });
  };

  const resumeExam = async (exam: ExamInfo, attemptId: string) => {
    setExamBusy(true);
    try {
      const res = await nleApi.getAttempt(attemptId);
      const data = res.data.data;
      if (data.attempt.status !== "IN_PROGRESS") {
        toast.error("This attempt is no longer in progress.");
        refetchAttempts();
        return;
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        toast.error("This attempt can't be resumed. Discard it to start over.");
        return;
      }
      enterExam(exam, data.attempt, data.questions as ExamQuestion[], true);
    } catch {
      toast.error("Failed to load your exam attempt.");
    } finally {
      setExamBusy(false);
    }
  };

  const startExamFlow = async (exam: ExamInfo) => {
    setExamBusy(true);
    try {
      const res = await nleApi.startExam(exam.id);
      const data = res.data.data;
      enterExam(exam, data.attempt, data.questions as ExamQuestion[], false);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
      const msg = resp?.data?.error?.message;
      if (resp?.status === 403 && msg?.includes("already in progress")) {
        // Another tab/device holds the attempt — pick it up instead
        try {
          const attempts = await nleApi.listAttempts(exam.id);
          const pending = (attempts.data.data as ExamAttemptRow[] | undefined)?.find(
            (a) => a.status === "IN_PROGRESS"
          );
          if (pending) {
            await resumeExam(exam, pending.id);
            return;
          }
        } catch {
          /* fall through to the toast below */
        }
        toast.error("You already have an exam in progress. Refresh the page to resume it.");
      } else {
        toast.error(msg || "Failed to start exam");
      }
    } finally {
      setExamBusy(false);
    }
  };

  const discardAttempt = async (attemptId: string, closePlayer = false) => {
    setExamBusy(true);
    try {
      await nleApi.abandonAttempt(attemptId);
      sessionStorage.removeItem(examStorageKey(attemptId));
      if (closePlayer) setActiveExam(null);
      refetchAttempts();
    } catch {
      toast.error("Failed to discard the attempt.");
    } finally {
      setExamBusy(false);
    }
  };

  const loadExamResult = async (exam: ExamInfo, attemptId: string) => {
    try {
      const res = await nleApi.getAttempt(attemptId);
      const data = res.data.data;
      setExamResult({
        exam,
        attempt: data.attempt as ExamAttemptRow,
        questions: (data.questions ?? []) as ExamQuestion[],
        answers: (data.answers ?? []) as ExamAnswerRow[],
      });
    } catch {
      toast.error("Submitted — but the result could not be loaded. Open it from the attempt history.");
    } finally {
      setActiveExam(null);
    }
  };

  const submitExamAnswers = async (answers: ExamSubmission[]) => {
    if (!activeExam) return;
    const { exam, attemptId } = activeExam;
    setExamBusy(true);
    try {
      await nleApi.submitExam(attemptId, answers);
      sessionStorage.removeItem(examStorageKey(attemptId));
      await loadExamResult(exam, attemptId);
      refetchAttempts();
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
      const msg = resp?.data?.error?.message;
      if (resp?.status === 403 && msg?.includes("already submitted")) {
        // A racing submission (e.g. timer vs. click) already landed — show that result
        sessionStorage.removeItem(examStorageKey(attemptId));
        await loadExamResult(exam, attemptId);
        refetchAttempts();
      } else {
        // The player stays open and the submit guard resets, so the student can retry
        toast.error("Submission failed — your answers were not recorded. Please try again.");
      }
    } finally {
      setExamBusy(false);
    }
  };

  const viewAttempt = async (exam: ExamInfo, attempt: ExamAttemptRow) => {
    if (attempt.status === "IN_PROGRESS") {
      await resumeExam(exam, attempt.id);
      return;
    }
    setExamBusy(true);
    try {
      await loadExamResult(exam, attempt.id);
    } finally {
      setExamBusy(false);
    }
  };

  return (
    <div>
      {activeExam && (
        <ExamPlayer
          exam={activeExam.exam}
          startedAt={activeExam.startedAt}
          questions={activeExam.questions}
          initialAnswers={activeExam.initialAnswers}
          submitting={examBusy}
          onSubmit={submitExamAnswers}
          onQuit={() => discardAttempt(activeExam.attemptId, true)}
          onAnswersChange={(a) => {
            try {
              sessionStorage.setItem(examStorageKey(activeExam.attemptId), JSON.stringify(a));
            } catch {
              /* storage unavailable — answers just won't survive a refresh */
            }
          }}
        />
      )}
      {!activeExam && examResult && (
        <ExamResult
          exam={examResult.exam}
          attempt={examResult.attempt}
          questions={examResult.questions}
          answers={examResult.answers}
          busy={examBusy}
          onBack={() => setExamResult(null)}
          onRetake={() => startExamFlow(examResult.exam)}
        />
      )}
      <PageHeader
        title="NLE Preparation"
        subtitle="National Licensure Examination review and practice"
        actions={
          canPractice ? (
            <Button onClick={() => openSetup()}><GraduationCap size={16} /> Start Practice</Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(isStudent
          ? (["categories", "exams", "questions", "performance"] as const)
          : (["categories", "questions", "performance"] as const)
        ).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === "questions") setQPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "categories" && <Target size={16} />}
            {t === "exams" && <ClipboardCheck size={16} />}
            {t === "questions" && <GraduationCap size={16} />}
            {t === "performance" && <TrendingUp size={16} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {(loadingCat || loadingQ || loadingPerf || loadingExams || loadingAttempts) ? <LoadingSpinner /> : (
        <>
          {tab === "categories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catList.map((cat: Record<string, unknown>) => (
                <Card key={String(cat.id)} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Target size={18} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{String(cat.name)}</h3>
                      <p className="text-sm text-gray-500 mt-1">{String(cat.description || "")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="info">{String(cat.code)}</Badge>
                        <Badge variant="default">{String(cat.examPercentage || 0)}%</Badge>
                      </div>
                      {canPractice && (
                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={() => openSetup(String(cat.id))}
                        >
                          <Play size={13} className="mr-1" /> Practice This Category
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === "questions" && (
            <div className="space-y-3">
              {qList.map((q: Record<string, unknown>) => (
                <Card key={String(q.id)}>
                  <p className="font-medium text-sm">{String(q.questionText ?? q.stem)}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="info">{String(q.questionType ?? q.type)}</Badge>
                    <Badge variant={String(q.difficulty) === "EASY" ? "success" : String(q.difficulty) === "HARD" ? "danger" : "warning"}>
                      {String(q.difficulty)}
                    </Badge>
                  </div>
                </Card>
              ))}
              {qPagination && qPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-gray-500">Page {qPage} of {qPagination.totalPages} ({qPagination.total} total)</p>
                  <div className="flex gap-1">
                    <button onClick={() => setQPage((p) => p - 1)} disabled={qPage <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setQPage((p) => p + 1)} disabled={qPage >= qPagination.totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "performance" && perfData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <p className="text-sm text-gray-500">Total Questions Answered</p>
                <p className="text-3xl font-bold text-primary-700 mt-1">{String(perfData.totalAnswered ?? 0)}</p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Accuracy Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{String(perfData.accuracy ?? 0)}%</p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Study Hours</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{String(perfData.studyHours ?? 0)}</p>
              </Card>
            </div>
          )}

          {tab === "exams" && isStudent && (
            <div className="space-y-4">
              {inProgressExam && inProgressAttempt && (
                <Card className="border border-amber-300 bg-amber-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span>
                        You have an unfinished attempt on{" "}
                        <span className="font-semibold">{inProgressExam.title}</span>.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resumeExam(inProgressExam, inProgressAttempt.id)} disabled={examBusy}>
                        Resume
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => discardAttempt(inProgressAttempt.id)} disabled={examBusy}>
                        Discard
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {examList.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck size={40} />}
                  title="No exams yet"
                  description="Your instructors haven't published any exams. Check back later."
                />
              ) : (
                examList.map((exam) => {
                  const examAttempts = attemptList.filter((a) => a.examId === exam.id);
                  const completed = examAttempts.filter((a) => a.status === "COMPLETED");
                  const best = completed.reduce((max, a) => Math.max(max, a.score ?? 0), 0);
                  const pending = examAttempts.find((a) => a.status === "IN_PROGRESS");
                  return (
                    <Card key={exam.id} className="hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{exam.title}</h3>
                            <Badge variant="info">{exam.examType ?? "PRACTICE"}</Badge>
                            {completed.length > 0 && <Badge variant="success">Best {best}%</Badge>}
                          </div>
                          {exam.description && <p className="text-sm text-gray-500 mt-1">{exam.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <GraduationCap size={13} /> {exam.questionCount} questions
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={13} /> {exam.timeLimitMinutes} minutes
                            </span>
                            <span className="flex items-center gap-1">
                              <Target size={13} /> Pass at {exam.passingScore}%
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {pending ? (
                            <>
                              <Button size="sm" onClick={() => resumeExam(exam, pending.id)} disabled={examBusy}>
                                Resume
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => discardAttempt(pending.id)} disabled={examBusy}>
                                Discard
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => startExamFlow(exam)} disabled={examBusy}>
                              {examBusy ? (
                                "Starting..."
                              ) : (
                                <>
                                  <Play size={14} className="mr-1" /> Start Exam
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {completed.length > 0 && (
                        <div className="mt-3 border-t border-gray-100 pt-2 space-y-1">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempts</p>
                          {completed
                            .slice()
                            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                            .map((a) => (
                              <div key={a.id} className="flex items-center justify-between gap-2 text-sm py-1">
                                <span className="text-gray-600 truncate">
                                  {new Date(a.completedAt ?? a.startedAt).toLocaleString()} · {a.correctAnswers ?? 0}/
                                  {a.totalQuestions} correct
                                  {a.timeSpentSeconds != null && ` · ${formatDuration(a.timeSpentSeconds)}`}
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span
                                    className={`font-semibold ${
                                      (a.score ?? 0) >= exam.passingScore ? "text-green-600" : "text-red-600"
                                    }`}
                                  >
                                    {a.score ?? 0}%
                                  </span>
                                  <Button size="sm" variant="ghost" onClick={() => viewAttempt(exam, a)}>
                                    View
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Practice Setup Modal */}
      <Modal open={showSetup} onClose={() => setShowSetup(false)} title="Setup Practice Session">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={setupCat}
              onChange={(e) => setSetupCat(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Categories (mixed)</option>
              {catList.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select
              value={setupDiff}
              onChange={(e) => setSetupDiff(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSetupCount(n)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    setupCount === n
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={highYieldOnly}
              onChange={(e) => setHighYieldOnly(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Sparkles size={14} className="text-amber-500" />
            High-yield questions only (commonly tested on NLE)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowSetup(false)}>Cancel</Button>
            <Button onClick={startPractice} disabled={starting}>
              {starting ? "Loading..." : <><Play size={15} className="mr-1" /> Start Practice</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Practice Modal */}
      <Modal open={showPractice} onClose={() => setShowPractice(false)} title="NLE Practice">
        {!showResult ? (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Question {currentQ + 1} of {practiceQuestions.length}</span>
              <span>Answered: {Object.keys(answers).length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${((currentQ + 1) / practiceQuestions.length) * 100}%` }} />
            </div>
            {practiceQuestions[currentQ] && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="info">{String(practiceQuestions[currentQ].questionType ?? practiceQuestions[currentQ].type ?? "MC")}</Badge>
                  <Badge variant={
                    String(practiceQuestions[currentQ].difficulty) === "EASY" ? "success" :
                    String(practiceQuestions[currentQ].difficulty) === "HARD" ? "danger" : "warning"
                  }>
                    {String(practiceQuestions[currentQ].difficulty ?? "MEDIUM")}
                  </Badge>
                </div>
                <p className="font-medium">{String(practiceQuestions[currentQ].questionText ?? practiceQuestions[currentQ].stem)}</p>
                <div className="space-y-2">
                  {(practiceQuestions[currentQ].options as { id: string; optionText: string }[])?.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => selectAnswer(currentQ, String(opt.id))}
                      className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                        answers[currentQ] === String(opt.id)
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt.optionText}
                    </button>
                  ))}
                </div>
                <Button onClick={nextQuestion} className="w-full" disabled={!answers[currentQ] || finishing}>
                  {finishing ? "Grading..." : currentQ < practiceQuestions.length - 1 ? "Next Question" : "Finish"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-5xl font-bold text-primary-700">
              {checkResult?.correctCount ?? 0}/{checkResult?.total ?? practiceQuestions.length}
            </div>
            <p className="text-gray-500">
              {checkResult?.score ?? 0}% Correct
            </p>
            <div className="space-y-1 text-left">
              {(checkResult?.results ?? []).map((r, idx) => {
                const opts = (practiceQuestions[idx]?.options ?? []) as { id: string; optionText: string }[];
                const selected = answers[idx];
                const selectedText = opts.find((o) => String(o.id) === selected)?.optionText;
                return (
                  <div key={idx} className={`p-2 rounded-lg text-sm ${r.isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium w-6 text-right">{idx + 1}.</span>
                      <span className="flex-1 text-left">{r.isCorrect ? "✓" : "✗"} {selectedText || "No answer"}</span>
                      {!r.isCorrect && r.correctOptionText && <span className="text-xs text-gray-500">Correct: {r.correctOptionText}</span>}
                    </div>
                    {!r.isCorrect && r.explanation && <p className="text-xs text-gray-600 mt-1 pl-8">{r.explanation}</p>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => { setShowPractice(false); openSetup(); }}>Try Again</Button>
              <Button onClick={() => setShowPractice(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
