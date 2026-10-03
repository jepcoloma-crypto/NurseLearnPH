import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiContentApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { Sparkles, CheckCircle, XCircle, RotateCcw, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const genSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  topic: z.string().min(1, "Topic is required"),
  count: z.coerce.number().int().min(1).max(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});
type GenFormData = z.infer<typeof genSchema>;

const genCaseSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  title: z.string().min(1, "Title is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  focusArea: z.string().optional(),
});
type GenCaseFormData = z.infer<typeof genCaseSchema>;

const genGuideSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  includePracticeQuestions: z.boolean(),
});
type GenGuideFormData = z.infer<typeof genGuideSchema>;

// ─── Edit (revise) forms ─────────────────────────────────────────────────────

const editQuestionSchema = z
  .object({
    topic: z.string().min(1, "Topic is required"),
    questionText: z.string().min(1, "Question text is required"),
    // RHF field arrays require object items, so options are { value } wrappers
    // and flattened to plain strings before hitting the API.
    options: z.array(z.object({ value: z.string().min(1, "Option cannot be empty") })).min(2, "At least 2 options"),
    correctAnswer: z.string().min(1, "Select the correct answer"),
    explanation: z.string().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  })
  .refine((d) => d.options.some((o) => o.value === d.correctAnswer), {
    message: "Correct answer must match one of the options",
    path: ["correctAnswer"],
  });
type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

const editCaseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  clinicalPresentation: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  stages: z.array(z.object({ description: z.string().min(1, "Stage description is required") })).min(1, "At least one stage is required"),
  objectivesText: z
    .string()
    .refine((v) => v.split("\n").some((l) => l.trim().length > 0), "Add at least one learning objective"),
});
type EditCaseFormData = z.infer<typeof editCaseSchema>;

const editGuideSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  summary: z.string().optional(),
  keyPointsText: z.string().optional(),
});
type EditGuideFormData = z.infer<typeof editGuideSchema>;

// Pull a human-readable message out of react-hook-form errors — walks leaf
// fields, array elements, root errors, and nested objects (e.g. options[i].value).
const errMsg = (e: unknown): string | undefined => {
  if (!e || typeof e !== "object") return undefined;
  if (Array.isArray(e)) {
    for (const x of e) {
      const m = errMsg(x);
      if (m) return m;
    }
    return undefined;
  }
  const obj = e as Record<string, unknown>;
  if (typeof obj.message === "string" && obj.message) return obj.message;
  if (obj.root) {
    const rootMsg = errMsg(obj.root);
    if (rootMsg) return rootMsg;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "ref" || k === "root") continue;
    if (v && typeof v === "object" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)) {
      const m = errMsg(v);
      if (m) return m;
    }
  }
  return undefined;
};

// Pull the server's error.message out of an API error response.
const apiMsg = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fallback;

export default function AIContentPage() {
  const { can, user } = usePermissions();
  const queryClient = useQueryClient();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const [tab, setTab] = useState<"questions" | "cases" | "guides">("questions");
  const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: questions, isLoading: loadingQ, refetch: refetchQ } = useQuery({
    queryKey: ["ai-questions", page, isInstructor ? user?.id : undefined],
    queryFn: () => aiContentApi.listQuestions({ page: String(page), limit: "15", instructorId: isInstructor ? user!.id : undefined }),
    enabled: tab === "questions",
  });
  const { data: cases, isLoading: loadingC } = useQuery({
    queryKey: ["ai-cases", isInstructor ? user?.id : undefined],
    queryFn: () => aiContentApi.listCases({ limit: "20", instructorId: isInstructor ? user!.id : undefined }),
    enabled: tab === "cases",
  });
  const { data: guides, isLoading: loadingG } = useQuery({
    queryKey: ["ai-guides", isInstructor ? user?.id : undefined],
    queryFn: () => aiContentApi.listStudyGuides({ limit: "20", instructorId: isInstructor ? user!.id : undefined }),
    enabled: tab === "guides",
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", instructorId: isInstructor ? user!.id : undefined }),
  });

  const isLoading = loadingQ || loadingC || loadingG;
  const canCreate = can("ai-content.create");
  const canReview = can("ai-content.review");
  const courseList = courses?.data?.data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GenFormData>({
    resolver: zodResolver(genSchema),
    defaultValues: { count: 5, difficulty: "MEDIUM" },
  });
  const { register: registerCase, handleSubmit: handleSubmitCase, reset: resetCase, formState: { errors: caseErrors } } = useForm<GenCaseFormData>({
    resolver: zodResolver(genCaseSchema),
    defaultValues: { difficulty: "MEDIUM" },
  });
  const { register: registerGuide, handleSubmit: handleSubmitGuide, reset: resetGuide, formState: { errors: guideErrors } } = useForm<GenGuideFormData>({
    resolver: zodResolver(genGuideSchema),
    defaultValues: { includePracticeQuestions: true },
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenFormData) => aiContentApi.generateQuestions(data),
    onSuccess: () => {
      toast.success("Content generated!");
      setShowGenerate(false);
      reset();
      refetchQ();
    },
    onError: () => toast.error("Generation failed"),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: "APPROVED" | "REJECTED" | "REVISION_NEEDED"; reviewNotes?: string }) =>
      aiContentApi.reviewQuestion(id, { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-questions"] });
      toast.success("Review submitted");
    },
    onError: () => toast.error("Review failed"),
  });

  const generateCaseMutation = useMutation({
    mutationFn: (data: GenCaseFormData) => aiContentApi.generateCase(data),
    onSuccess: () => {
      toast.success("Case generated!");
      setShowGenerate(false);
      resetCase();
      queryClient.invalidateQueries({ queryKey: ["ai-cases"] });
    },
    onError: () => toast.error("Generation failed"),
  });

  const reviewCaseMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: "APPROVED" | "REJECTED" | "REVISION_NEEDED"; reviewNotes?: string }) =>
      aiContentApi.reviewCase(id, { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-cases"] });
      toast.success("Review submitted");
    },
    onError: () => toast.error("Review failed"),
  });

  const generateGuideMutation = useMutation({
    mutationFn: (data: GenGuideFormData) => aiContentApi.generateStudyGuide(data),
    onSuccess: () => {
      toast.success("Study guide generated!");
      setShowGenerate(false);
      resetGuide();
      queryClient.invalidateQueries({ queryKey: ["ai-guides"] });
    },
    onError: () => toast.error("Generation failed"),
  });

  const reviewGuideMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: "APPROVED" | "REJECTED" | "REVISION_NEEDED"; reviewNotes?: string }) =>
      aiContentApi.reviewStudyGuide(id, { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-guides"] });
      toast.success("Review submitted");
    },
    onError: () => toast.error("Review failed"),
  });

  // ─── Edit (revise) flow ─────────────────────────────────────────────────────
  // Editing is allowed for PENDING / REVISION_NEEDED content; saving returns the
  // item to PENDING so a reviewer must re-approve it.

  const [editing, setEditing] = useState<{ item: Record<string, unknown>; kind: "questions" | "cases" | "guides" } | null>(null);

  const {
    register: registerEditQ, handleSubmit: handleSubmitEditQ, reset: resetEditQ, watch: watchEditQ, control: controlEditQ,
    formState: { errors: editQErrors },
  } = useForm<EditQuestionFormData>({ resolver: zodResolver(editQuestionSchema) });
  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({ control: controlEditQ, name: "options" });
  const watchedOptions = watchEditQ("options");

  const {
    register: registerEditC, handleSubmit: handleSubmitEditC, reset: resetEditC, control: controlEditC,
    formState: { errors: editCErrors },
  } = useForm<EditCaseFormData>({ resolver: zodResolver(editCaseSchema) });
  const { fields: stageFields, append: appendStage, remove: removeStage } = useFieldArray({ control: controlEditC, name: "stages" });

  const {
    register: registerEditG, handleSubmit: handleSubmitEditG, reset: resetEditG,
    formState: { errors: editGErrors },
  } = useForm<EditGuideFormData>({ resolver: zodResolver(editGuideSchema) });

  const openEdit = (item: Record<string, unknown>, kind: "questions" | "cases" | "guides") => {
    const difficulty = (["EASY", "MEDIUM", "HARD"].includes(String(item.difficulty)) ? String(item.difficulty) : "MEDIUM") as "EASY" | "MEDIUM" | "HARD";
    if (kind === "questions") {
      const raw = Array.isArray(item.options) ? item.options : [];
      const options = raw
        .map((o) => (typeof o === "string" ? o : String((o as { text?: string; optionText?: string }).text ?? (o as { optionText?: string }).optionText ?? "")))
        .filter((o) => o.length > 0);
      resetEditQ({
        topic: String(item.topic ?? ""),
        questionText: String(item.questionText ?? ""),
        options: options.length >= 2 ? options.map((value) => ({ value })) : [{ value: "" }, { value: "" }],
        correctAnswer: String(item.correctAnswer ?? ""),
        explanation: String(item.explanation ?? ""),
        difficulty,
      });
    } else if (kind === "cases") {
      const stages = Array.isArray(item.stages) ? (item.stages as Array<{ description?: string }>) : [];
      resetEditC({
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        clinicalPresentation: String(item.clinicalPresentation ?? ""),
        difficulty,
        stages: stages.length > 0 ? stages.map((s) => ({ description: String(s.description ?? "") })) : [{ description: "" }],
        objectivesText: Array.isArray(item.learningObjectives) ? (item.learningObjectives as string[]).join("\n") : "",
      });
    } else {
      resetEditG({
        title: String(item.title ?? ""),
        content: String(item.content ?? ""),
        summary: String(item.summary ?? ""),
        keyPointsText: Array.isArray(item.keyPoints) ? (item.keyPoints as string[]).join("\n") : "",
      });
    }
    setEditing({ item, kind });
  };

  const editQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => aiContentApi.updateQuestion(id, data),
    onSuccess: () => {
      toast.success("Saved — returned to the review queue");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["ai-questions"] });
    },
    onError: (err) => toast.error(apiMsg(err, "Could not save changes")),
  });

  const editCaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => aiContentApi.updateCase(id, data),
    onSuccess: () => {
      toast.success("Saved — returned to the review queue");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["ai-cases"] });
    },
    onError: (err) => toast.error(apiMsg(err, "Could not save changes")),
  });

  const editGuideMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => aiContentApi.updateStudyGuide(id, data),
    onSuccess: () => {
      toast.success("Saved — returned to the review queue");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["ai-guides"] });
    },
    onError: (err) => toast.error(apiMsg(err, "Could not save changes")),
  });

  const onEditQuestion = (data: EditQuestionFormData) => {
    if (!editing) return;
    editQuestionMutation.mutate({
      id: String(editing.item.id),
      data: {
        topic: data.topic,
        questionText: data.questionText,
        options: data.options.map((o) => o.value),
        correctAnswer: data.correctAnswer,
        explanation: data.explanation ?? "",
        difficulty: data.difficulty,
      },
    });
  };

  const onEditCase = (data: EditCaseFormData) => {
    if (!editing) return;
    const prevStages = Array.isArray(editing.item.stages) ? (editing.item.stages as Array<Record<string, unknown>>) : [];
    editCaseMutation.mutate({
      id: String(editing.item.id),
      data: {
        title: data.title,
        description: data.description,
        clinicalPresentation: data.clinicalPresentation ?? "",
        difficulty: data.difficulty,
        stages: data.stages.map((s, i) => ({
          stage: i + 1,
          description: s.description.trim(),
          ...(prevStages[i] && Array.isArray(prevStages[i].actions) ? { actions: prevStages[i].actions } : {}),
        })),
        learningObjectives: data.objectivesText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0),
      },
    });
  };

  const onEditGuide = (data: EditGuideFormData) => {
    if (!editing) return;
    editGuideMutation.mutate({
      id: String(editing.item.id),
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary ?? "",
        keyPoints: (data.keyPointsText ?? "").split("\n").map((l) => l.trim()).filter((l) => l.length > 0),
      },
    });
  };

  const [revision, setRevision] = useState<{ id: string; kind: "questions" | "cases" | "guides" } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  const submitRevision = () => {
    if (!revision) return;
    const notes = revisionNotes.trim();
    if (notes.length < 10) {
      toast.error("Please include specific revision instructions (min 10 characters)");
      return;
    }
    const payload = { id: revision.id, status: "REVISION_NEEDED" as const, reviewNotes: notes };
    if (revision.kind === "questions") reviewMutation.mutate(payload);
    else if (revision.kind === "cases") reviewCaseMutation.mutate(payload);
    else reviewGuideMutation.mutate(payload);
    setRevision(null);
    setRevisionNotes("");
  };

  const onGenerate = (data: GenFormData) => {
    generateMutation.mutate(data);
  };
  const onGenerateCase = (data: GenCaseFormData) => {
    generateCaseMutation.mutate(data);
  };
  const onGenerateGuide = (data: GenGuideFormData) => {
    generateGuideMutation.mutate(data);
  };

  const statusBadge = (s: string, notes?: string) => {
    const m: Record<string, "success" | "danger" | "warning" | "info"> = {
      APPROVED: "success", REJECTED: "danger", PENDING: "warning", REVISION_NEEDED: "info",
    };
    const title = s === "REVISION_NEEDED" && notes ? `Revision notes: ${notes}` : undefined;
    return <span title={title}><Badge variant={m[s] || "info"}>{s}</Badge></span>;
  };

  return (
    <div>
      <PageHeader
        title="AI Content Generation"
        subtitle="AI-powered question, case, and study guide generation"
        actions={
          canCreate ? (
            <Button onClick={() => setShowGenerate(true)}>
              <Sparkles size={16} /> {tab === "questions" ? "Generate Content" : tab === "cases" ? "Generate Case" : "Generate Study Guide"}
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["questions", "cases", "guides"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "questions" ? "Questions" : t === "cases" ? "Cases" : "Study Guides"}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          {tab === "questions" && (
            <DataTable
              columns={[
                { key: "questionText", label: "Question", render: (item) => (
                  <span className="line-clamp-1 max-w-md">{String(item.questionText)}</span>
                )},
                { key: "topic", label: "Topic", className: "w-40" },
                { key: "difficulty", label: "Level", className: "w-24", render: (item) => (
                  <Badge variant={String(item.difficulty) === "EASY" ? "success" : String(item.difficulty) === "HARD" ? "danger" : "warning"}>
                    {String(item.difficulty)}
                  </Badge>
                )},
                { key: "status", label: "Status", className: "w-28", render: (item) => statusBadge(String(item.status), String(item.reviewNotes ?? "")) },
                { key: "actions", label: "", className: "w-28", render: (item) => (
                  <div className="flex gap-1">
                    {canCreate && (String(item.status) === "PENDING" || String(item.status) === "REVISION_NEEDED") && (
                      <button onClick={() => openEdit(item, "questions")} className="p-1 hover:bg-blue-50 rounded text-blue-600" data-tooltip="Edit"><Pencil size={14} /></button>
                    )}
                    {canReview && String(item.status) === "PENDING" && (
                      <>
                        <button onClick={() => reviewMutation.mutate({ id: String(item.id), status: "APPROVED" })} className="p-1 hover:bg-green-50 rounded text-green-600" data-tooltip="Approve"><CheckCircle size={14} /></button>
                        <button onClick={() => setRevision({ id: String(item.id), kind: "questions" })} className="p-1 hover:bg-amber-50 rounded text-amber-600" data-tooltip="Return for revision"><RotateCcw size={14} /></button>
                        <button onClick={() => reviewMutation.mutate({ id: String(item.id), status: "REJECTED" })} className="p-1 hover:bg-red-50 rounded text-red-600" data-tooltip="Reject"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                )},
              ]}
              data={questions?.data?.data?.items ?? []}
              pagination={questions?.data?.data?.pagination}
              onPageChange={setPage}
            />
          )}

          {tab === "cases" && (
            <DataTable
              columns={[
                { key: "title", label: "Title" },
                { key: "difficulty", label: "Level", className: "w-28", render: (item) => (
                  <Badge variant={String(item.difficulty) === "ADVANCED" ? "danger" : "warning"}>{String(item.difficulty)}</Badge>
                )},
                { key: "status", label: "Status", className: "w-28", render: (item) => statusBadge(String(item.status), String(item.reviewNotes ?? "")) },
                { key: "actions", label: "", className: "w-28", render: (item) => (
                  <div className="flex gap-1">
                    {canCreate && (String(item.status) === "PENDING" || String(item.status) === "REVISION_NEEDED") && (
                      <button onClick={() => openEdit(item, "cases")} className="p-1 hover:bg-blue-50 rounded text-blue-600" data-tooltip="Edit"><Pencil size={14} /></button>
                    )}
                    {canReview && String(item.status) === "PENDING" && (
                      <>
                        <button onClick={() => reviewCaseMutation.mutate({ id: String(item.id), status: "APPROVED" })} className="p-1 hover:bg-green-50 rounded text-green-600" data-tooltip="Approve"><CheckCircle size={14} /></button>
                        <button onClick={() => setRevision({ id: String(item.id), kind: "cases" })} className="p-1 hover:bg-amber-50 rounded text-amber-600" data-tooltip="Return for revision"><RotateCcw size={14} /></button>
                        <button onClick={() => reviewCaseMutation.mutate({ id: String(item.id), status: "REJECTED" })} className="p-1 hover:bg-red-50 rounded text-red-600" data-tooltip="Reject"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                )},
              ]}
              data={cases?.data?.data?.items ?? []}
            />
          )}

          {tab === "guides" && (
            <DataTable
              columns={[
                { key: "title", label: "Title" },
                { key: "status", label: "Status", className: "w-28", render: (item) => statusBadge(String(item.status), String(item.reviewNotes ?? "")) },
                { key: "actions", label: "", className: "w-28", render: (item) => (
                  <div className="flex gap-1">
                    {canCreate && (String(item.status) === "PENDING" || String(item.status) === "REVISION_NEEDED") && (
                      <button onClick={() => openEdit(item, "guides")} className="p-1 hover:bg-blue-50 rounded text-blue-600" data-tooltip="Edit"><Pencil size={14} /></button>
                    )}
                    {canReview && String(item.status) === "PENDING" && (
                      <>
                        <button onClick={() => reviewGuideMutation.mutate({ id: String(item.id), status: "APPROVED" })} className="p-1 hover:bg-green-50 rounded text-green-600" data-tooltip="Approve"><CheckCircle size={14} /></button>
                        <button onClick={() => setRevision({ id: String(item.id), kind: "guides" })} className="p-1 hover:bg-amber-50 rounded text-amber-600" data-tooltip="Return for revision"><RotateCcw size={14} /></button>
                        <button onClick={() => reviewGuideMutation.mutate({ id: String(item.id), status: "REJECTED" })} className="p-1 hover:bg-red-50 rounded text-red-600" data-tooltip="Reject"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                )},
              ]}
              data={guides?.data?.data?.items ?? []}
            />
          )}
        </>
      )}

      {/* Generate Modals */}
      {tab === "questions" && (
        <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Questions">
          <form onSubmit={handleSubmit(onGenerate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select course</option>
                {courseList.map((c: Record<string, unknown>) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
                ))}
              </select>
              {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input {...register("topic")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Vital Signs, Medication Safety" />
              {errors.topic && <p className="text-red-500 text-xs mt-1">{errors.topic.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
                <input type="number" {...register("count")} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select {...register("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {tab === "cases" && (
        <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Clinical Case">
          <form onSubmit={handleSubmitCase(onGenerateCase)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select {...registerCase("courseId")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select course</option>
                {courseList.map((c: Record<string, unknown>) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
                ))}
              </select>
              {caseErrors.courseId && <p className="text-red-500 text-xs mt-1">{caseErrors.courseId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
              <input {...registerCase("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Sepsis Early Recognition" />
              {caseErrors.title && <p className="text-red-500 text-xs mt-1">{caseErrors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select {...registerCase("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Focus Area (optional)</label>
                <input {...registerCase("focusArea")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Assessment" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button type="submit" disabled={generateCaseMutation.isPending}>
                {generateCaseMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {tab === "guides" && (
        <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Study Guide">
          <form onSubmit={handleSubmitGuide(onGenerateGuide)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select {...registerGuide("courseId")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select course</option>
                {courseList.map((c: Record<string, unknown>) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
                ))}
              </select>
              {guideErrors.courseId && <p className="text-red-500 text-xs mt-1">{guideErrors.courseId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input {...registerGuide("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Fluid and Electrolytes Review" />
              {guideErrors.title && <p className="text-red-500 text-xs mt-1">{guideErrors.title.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input {...registerGuide("topic")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Electrolyte Imbalance" />
              {guideErrors.topic && <p className="text-red-500 text-xs mt-1">{guideErrors.topic.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...registerGuide("includePracticeQuestions")} className="rounded" />
              Include practice questions
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button type="submit" disabled={generateGuideMutation.isPending}>
                {generateGuideMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {/* Return for Revision Modal */}
      <Modal open={revision !== null} onClose={() => setRevision(null)} title="Return for Revision">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Revision instructions</label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Describe what needs to change, e.g. fix the correct answer, strengthen the rationale, add Philippine nursing context..."
            />
            <p className="text-xs text-gray-500 mt-1">Notes are saved to the item's approval history. Minimum 10 characters.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRevision(null)}>Cancel</Button>
            <Button type="button" onClick={submitRevision}>Return for Revision</Button>
          </div>
        </div>
      </Modal>

      {/* Edit (revise) Modals — saving returns the item to the review queue */}
      {editing?.kind === "questions" && (
        <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Question" size="lg">
          <form onSubmit={handleSubmitEditQ(onEditQuestion)} className="space-y-4">
            {String(editing.item.status) === "REVISION_NEEDED" && editing.item.reviewNotes ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span className="font-semibold">Reviewer notes: </span>
                {String(editing.item.reviewNotes)}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input {...registerEditQ("topic")} className="w-full px-3 py-2 border rounded-lg" />
              {errMsg(editQErrors.topic) && <p className="text-red-500 text-xs mt-1">{errMsg(editQErrors.topic)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
              <textarea {...registerEditQ("questionText")} rows={3} className="w-full px-3 py-2 border rounded-lg" />
              {errMsg(editQErrors.questionText) && <p className="text-red-500 text-xs mt-1">{errMsg(editQErrors.questionText)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
              <div className="space-y-2">
                {optionFields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <input {...registerEditQ(`options.${i}.value`)} className="flex-1 px-3 py-2 border rounded-lg" placeholder={`Option ${i + 1}`} />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={optionFields.length <= 2}
                      className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                      data-tooltip="Remove option"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => appendOption({ value: "" })}
                disabled={optionFields.length >= 6}
                className="text-xs text-primary-600 hover:text-primary-700 mt-1 disabled:opacity-40"
              >
                + Add option
              </button>
              {errMsg(editQErrors.options) && <p className="text-red-500 text-xs mt-1">{errMsg(editQErrors.options)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correct answer</label>
              <select {...registerEditQ("correctAnswer")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select the correct answer</option>
                {(watchedOptions ?? []).map((o, i) => (o.value ? <option key={i} value={o.value}>{o.value}</option> : null))}
              </select>
              {errMsg(editQErrors.correctAnswer) && <p className="text-red-500 text-xs mt-1">{errMsg(editQErrors.correctAnswer)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
              <textarea {...registerEditQ("explanation")} rows={3} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select {...registerEditQ("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={editQuestionMutation.isPending}>
                {editQuestionMutation.isPending ? "Saving..." : "Save & Resubmit"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {editing?.kind === "cases" && (
        <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Clinical Case" size="lg">
          <form onSubmit={handleSubmitEditC(onEditCase)} className="space-y-4">
            {String(editing.item.status) === "REVISION_NEEDED" && editing.item.reviewNotes ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span className="font-semibold">Reviewer notes: </span>
                {String(editing.item.reviewNotes)}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
              <input {...registerEditC("title")} className="w-full px-3 py-2 border rounded-lg" />
              {errMsg(editCErrors.title) && <p className="text-red-500 text-xs mt-1">{errMsg(editCErrors.title)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea {...registerEditC("description")} rows={3} className="w-full px-3 py-2 border rounded-lg" />
              {errMsg(editCErrors.description) && <p className="text-red-500 text-xs mt-1">{errMsg(editCErrors.description)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical presentation</label>
              <textarea {...registerEditC("clinicalPresentation")} rows={2} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select {...registerEditC("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stages</label>
              <div className="space-y-2">
                {stageFields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                    <input {...registerEditC(`stages.${i}.description`)} className="flex-1 px-3 py-2 border rounded-lg" placeholder={`Stage ${i + 1}`} />
                    <button
                      type="button"
                      onClick={() => removeStage(i)}
                      disabled={stageFields.length <= 1}
                      className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                      data-tooltip="Remove stage"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => appendStage({ description: "" })} className="text-xs text-primary-600 hover:text-primary-700 mt-1">
                + Add stage
              </button>
              {errMsg(editCErrors.stages) && <p className="text-red-500 text-xs mt-1">{errMsg(editCErrors.stages)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Learning objectives</label>
              <textarea {...registerEditC("objectivesText")} rows={4} className="w-full px-3 py-2 border rounded-lg" placeholder="One learning objective per line" />
              {errMsg(editCErrors.objectivesText) && <p className="text-red-500 text-xs mt-1">{errMsg(editCErrors.objectivesText)}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={editCaseMutation.isPending}>
                {editCaseMutation.isPending ? "Saving..." : "Save & Resubmit"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {editing?.kind === "guides" && (
        <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Study Guide">
          <form onSubmit={handleSubmitEditG(onEditGuide)} className="space-y-4">
            {String(editing.item.status) === "REVISION_NEEDED" && editing.item.reviewNotes ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span className="font-semibold">Reviewer notes: </span>
                {String(editing.item.reviewNotes)}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input {...registerEditG("title")} className="w-full px-3 py-2 border rounded-lg" />
              {errMsg(editGErrors.title) && <p className="text-red-500 text-xs mt-1">{errMsg(editGErrors.title)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (markdown)</label>
              <textarea {...registerEditG("content")} rows={8} className="w-full px-3 py-2 border rounded-lg font-mono text-xs" />
              {errMsg(editGErrors.content) && <p className="text-red-500 text-xs mt-1">{errMsg(editGErrors.content)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea {...registerEditG("summary")} rows={2} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key points</label>
              <textarea {...registerEditG("keyPointsText")} rows={4} className="w-full px-3 py-2 border rounded-lg" placeholder="One key point per line" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={editGuideMutation.isPending}>
                {editGuideMutation.isPending ? "Saving..." : "Save & Resubmit"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
