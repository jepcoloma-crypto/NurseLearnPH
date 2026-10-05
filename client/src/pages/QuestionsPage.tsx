import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentApi, academicApi, aiApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, Pencil, Trash2, Sparkles, Power, Printer } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  stem: z.string().min(1, "Question is required"),
  type: z.enum(["MC", "TF", "ESSAY", "FILL_BLANK", "SCENARIO"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  explanation: z.string().optional(),
  options: z.array(z.object({
    text: z.string().min(1),
    isCorrect: z.boolean(),
    order: z.coerce.number().int().min(0),
  })).optional(),
});
type FormData = z.infer<typeof schema>;

export default function QuestionsPage() {
  const { can, user } = usePermissions();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("MEDIUM");
  const [aiQuestionType, setAiQuestionType] = useState("MC");
  const [aiCourseId, setAiCourseId] = useState("");
  const [aiGenerated, setAiGenerated] = useState<Record<string, unknown>[]>([]);
  const [printItems, setPrintItems] = useState<Record<string, unknown>[] | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["questions", page, isInstructor ? user?.id : undefined],
    queryFn: () => assessmentApi.listQuestions({ page: String(page), limit: "15", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courseList = courses?.data?.data?.items ?? [];
  const canCreate = can("questions.create");
  const canEdit = can("questions.edit");
  const canDelete = can("questions.delete");

  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateQuestions({ topic: aiTopic, count: aiCount, difficulty: aiDifficulty, questionType: aiQuestionType, courseId: aiCourseId || undefined }),
    onSuccess: (res) => {
      const questions = res.data?.data?.questions ?? res.data?.data ?? [];
      setAiGenerated(Array.isArray(questions) ? questions : []);
      toast.success(`Generated ${Array.isArray(questions) ? questions.length : 0} questions`);
    },
    onError: () => toast.error("Failed to generate questions"),
  });

  const approveMutation = useMutation({
    mutationFn: (q: Record<string, unknown>) => aiApi.reviewQuestion(String(q.id), { status: "APPROVED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-questions"] });
      toast.success("Question approved and added to question bank");
    },
    onError: () => toast.error("Failed to approve question"),
  });

  const rejectMutation = useMutation({
    mutationFn: (q: Record<string, unknown>) => aiApi.reviewQuestion(String(q.id), { status: "REJECTED" }),
    onSuccess: () => toast.success("Question rejected"),
    onError: () => toast.error("Failed to reject question"),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "MC", difficulty: "MEDIUM" },
  });

  const questionType = watch("type");

  const onCreate = async (formData: FormData) => {
    try {
      const payload = {
        ...formData,
        options: formData.options?.filter(o => o.text.trim() !== ""),
      };
      await assessmentApi.createQuestion(payload);
      toast.success("Question created");
      setShowCreate(false);
      reset();
      refetch();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to create question");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      const payload = {
        ...formData,
        options: formData.options?.filter(o => o.text.trim() !== ""),
      };
      await assessmentApi.updateQuestion(String(editItem?.id), payload);
      toast.success("Question updated");
      setEditItem(null);
      reset();
      refetch();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to update question");
    }
  };

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to permanently delete this question? This cannot be undone.")) return;
    try {
      await assessmentApi.deleteQuestion(String(item.id));
      toast.success("Question deleted");
      refetch();
    } catch {
      toast.error("Failed to delete question");
    }
  };

  const onToggleStatus = async (item: Record<string, unknown>) => {
    try {
      await assessmentApi.toggleQuestionStatus(String(item.id));
      toast.success(`Question ${item.isActive !== false ? "deactivated" : "activated"}`);
      refetch();
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      courseId: String(item.courseId || ""),
      stem: String(item.stem || item.questionText || ""),
      type: (String(item.type || item.questionType || "MC") as "MC" | "TF" | "ESSAY" | "FILL_BLANK" | "SCENARIO"),
      difficulty: (String(item.difficulty || "MEDIUM") as "EASY" | "MEDIUM" | "HARD"),
      explanation: String(item.explanation || ""),
      options: Array.isArray(item.options)
        ? (item.options as Record<string, unknown>[]).map(o => ({
            text: String(o.text || ""),
            isCorrect: Boolean(o.isCorrect),
            order: Number(o.order || 0),
          }))
        : [{ text: "", isCorrect: false, order: 0 }, { text: "", isCorrect: false, order: 1 }, { text: "", isCorrect: false, order: 2 }, { text: "", isCorrect: false, order: 3 }],
    });
  };

  const typeBadge = (t: string) => {
    const m: Record<string, "info" | "success" | "warning" | "danger"> = {
      MC: "info", TF: "success", ESSAY: "warning", FILL_BLANK: "info", SCENARIO: "danger",
    };
    return <Badge variant={m[t] || "info"}>{t}</Badge>;
  };

  const diffBadge = (d: string) => {
    const m: Record<string, "success" | "warning" | "danger"> = { EASY: "success", MEDIUM: "warning", HARD: "danger" };
    return <Badge variant={m[d] || "default"}>{d}</Badge>;
  };

  // ── Print / PDF export: every published question on a printable sheet ──
  const preparePrint = async () => {
    setPrintLoading(true);
    try {
      const limit = 200;
      const all: Record<string, unknown>[] = [];
      let pageNo = 1;
      let total = Number.POSITIVE_INFINITY;
      while (all.length < total && pageNo <= 25) {
        const res = await assessmentApi.listQuestions({
          page: String(pageNo),
          limit: String(limit),
          isActive: "true",
          ...(isInstructor && user ? { instructorId: user.id } : {}),
        });
        const body = res.data?.data;
        const pageItems: Record<string, unknown>[] = body?.items ?? [];
        total = Number(body?.pagination?.total ?? pageItems.length);
        all.push(...pageItems);
        if (pageItems.length < limit) break;
        pageNo += 1;
      }
      const published = all.filter((q) => q.isActive !== false);
      if (published.length === 0) {
        toast.error("No published questions to print");
        return;
      }
      setPrintItems(published);
    } catch {
      toast.error("Failed to load questions for printing");
    } finally {
      setPrintLoading(false);
    }
  };

  // Render the sheet first, then open the browser dialog (Save as PDF).
  // body.printing-questionnaire hides the app shell in print CSS (the sheet
  // is a portal outside #root, so it survives and starts at the page top).
  useEffect(() => {
    if (!printItems) return;
    document.body.classList.add("printing-questionnaire");
    const t = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove("printing-questionnaire");
    };
  }, [printItems]);

  // Drop the sheet once the print dialog closes (printed or cancelled)
  useEffect(() => {
    const afterPrint = () => setPrintItems(null);
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  const printGroups = useMemo(() => {
    if (!printItems) return [];
    const byCourse = new Map<string, { label: string; items: Array<{ q: Record<string, unknown>; num: number }> }>();
    let num = 0;
    for (const q of printItems) {
      const courseId = String(q.courseId || "");
      const course = courseList.find((c: Record<string, unknown>) => String(c.id) === courseId);
      const label = course ? `${String(course.code)} - ${String(course.name)}` : "Other / Unassigned";
      if (!byCourse.has(courseId)) byCourse.set(courseId, { label, items: [] });
      num += 1;
      byCourse.get(courseId)!.items.push({ q, num });
    }
    return [...byCourse.entries()]
      .sort((a, b) => (!a[0] ? 1 : !b[0] ? -1 : a[1].label.localeCompare(b[1].label)))
      .map(([, v]) => v);
  }, [printItems, courseList]);

  return (
    <div className="print:hidden">
      <PageHeader
        title="Question Bank"
        subtitle="Assessment questions across all topics"
        actions={
          <>
            <Button variant="secondary" onClick={() => void preparePrint()} disabled={printLoading}>
              <Printer size={16} /> {printLoading ? "Preparing..." : "Print / PDF"}
            </Button>
            {canCreate && (
              <>
                <Button variant="secondary" onClick={() => setShowAiGenerate(true)}><Sparkles size={16} /> Generate with AI</Button>
                <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Question</Button>
              </>
            )}
          </>
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "stem", label: "Question", render: (item) => (
              <span className="line-clamp-1 max-w-md">{String(item.stem || item.questionText || "")}</span>
            )},
            { key: "type", label: "Type", className: "w-24", render: (item) => typeBadge(String(item.type || item.questionType)) },
            { key: "difficulty", label: "Difficulty", className: "w-28", render: (item) => diffBadge(String(item.difficulty)) },
            { key: "isActive", label: "Status", className: "w-20", render: (item) => (
              <Badge variant={item.isActive !== false ? "success" : "warning"}>{item.isActive !== false ? "Active" : "Off"}</Badge>
            )},
            { key: "actions", label: "Actions", className: "w-32", render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => onToggleStatus(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip={item.isActive !== false ? "Deactivate" : "Activate"}>
                    <Power size={16} className={item.isActive !== false ? "text-green-500" : "text-gray-400"} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Delete">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                )}
              </div>
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Question">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
            <textarea {...register("stem")} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Enter the question..." />
            {errors.stem && <p className="text-red-500 text-xs mt-1">{errors.stem.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register("type")} className="w-full px-3 py-2 border rounded-lg">
                <option value="MC">Multiple Choice</option>
                <option value="TF">True/False</option>
                <option value="ESSAY">Essay</option>
                <option value="FILL_BLANK">Fill in the Blank</option>
                <option value="SCENARIO">Scenario</option>
              </select>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
            <textarea {...register("explanation")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Optional explanation..." />
          </div>
          {questionType === "MC" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options (check the correct answer)</label>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" {...register(`options.${i}.isCorrect`)} className="rounded" />
                    <input
                      {...register(`options.${i}.text`)}
                      className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                      placeholder={`Option ${i + 1}`}
                    />
                    <input type="hidden" {...register(`options.${i}.order`)} value={i} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {questionType === "TF" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" value="true" {...register("options.0.isCorrect")} className="text-primary-600" />
                  <span className="text-sm">True</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="false" {...register("options.0.isCorrect")} className="text-primary-600" />
                  <span className="text-sm">False</span>
                </label>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Question">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
            <textarea {...register("stem")} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Enter the question..." />
            {errors.stem && <p className="text-red-500 text-xs mt-1">{errors.stem.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register("type")} className="w-full px-3 py-2 border rounded-lg">
                <option value="MC">Multiple Choice</option>
                <option value="TF">True/False</option>
                <option value="ESSAY">Essay</option>
                <option value="FILL_BLANK">Fill in the Blank</option>
                <option value="SCENARIO">Scenario</option>
              </select>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
            <textarea {...register("explanation")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Optional explanation..." />
          </div>
          {questionType === "MC" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options (check the correct answer)</label>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" {...register(`options.${i}.isCorrect`)} className="rounded" />
                    <input
                      {...register(`options.${i}.text`)}
                      className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                      placeholder={`Option ${i + 1}`}
                    />
                    <input type="hidden" {...register(`options.${i}.order`)} value={i} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {questionType === "TF" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" value="true" {...register("options.0.isCorrect")} className="text-primary-600" />
                  <span className="text-sm">True</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="false" {...register("options.0.isCorrect")} className="text-primary-600" />
                  <span className="text-sm">False</span>
                </label>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal open={showAiGenerate} onClose={() => { setShowAiGenerate(false); setAiGenerated([]); setAiCourseId(""); }} title="Generate Questions with AI">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info"><Sparkles size={12} /> AI Generated</Badge>
            <span className="text-xs text-gray-400">Powered by Gemini</span>
          </div>
          {aiGenerated.length === 0 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Pharmacology, Anatomy, Nursing Ethics" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select value={aiCourseId} onChange={(e) => setAiCourseId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select course</option>
                  {courseList.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
                  <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={aiQuestionType} onChange={(e) => setAiQuestionType(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="MC">Multiple Choice</option>
                    <option value="TF">True/False</option>
                    <option value="ESSAY">Essay</option>
                    <option value="FILL_BLANK">Fill in Blank</option>
                    <option value="SCENARIO">Scenario</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowAiGenerate(false)}>Cancel</Button>
                <Button type="button" disabled={!aiTopic.trim() || generateMutation.isPending} onClick={() => generateMutation.mutate()}>
                  <Sparkles size={14} />
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">{aiGenerated.length} questions generated. Review and approve each one.</p>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto space-y-0">
                {aiGenerated.map((q, idx) => (
                  <div key={idx} className="py-3">
                    <p className="text-sm font-medium mb-1">{idx + 1}. {String(q.stem || q.questionText || q.question || "")}</p>
                    {q.options && Array.isArray(q.options) ? (
                      <ul className="text-xs text-gray-600 ml-4 list-disc mb-2">
                        {(q.options as Record<string, unknown>[]).map((o, oi) => (
                          <li key={oi} className={Boolean(o.isCorrect) ? "font-medium text-green-700" : ""}>{String(o.text || o.option || "")}</li>
                        ))}
                      </ul>
                    ) : null}
                    {q.explanation ? <p className="text-xs text-gray-500 italic mb-2">Explanation: {String(q.explanation)}</p> : null}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { approveMutation.mutate(q); setAiGenerated((prev) => prev.filter((_, i) => i !== idx)); }}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => { if (window.confirm("Reject this question?")) { rejectMutation.mutate(q); setAiGenerated((prev) => prev.filter((_, i) => i !== idx)); } }}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => { setShowAiGenerate(false); setAiGenerated([]); setAiCourseId(""); }}>Done</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Printable questionnaire (portal: lives outside the print:hidden page) */}
      {printItems &&
        createPortal(
          <div className="hidden print:block print-questionnaire text-black" data-testid="print-sheet">
            <div className="border-b-2 border-black pb-2 mb-4">
              <h1 className="text-center text-lg font-bold uppercase tracking-wide">NurseLearn PH - Question Bank</h1>
              <p className="text-center text-xs mt-0.5">Published Questions ({printItems.length})</p>
              <div className="mt-4 flex justify-between gap-8 text-sm">
                <span>
                  <span className="mr-2 font-medium">Name:</span>
                  <span className="inline-block w-64 border-b border-black">&nbsp;</span>
                </span>
                <span>
                  <span className="mr-2 font-medium">Section:</span>
                  <span className="inline-block w-64 border-b border-black">&nbsp;</span>
                </span>
              </div>
            </div>
            {printGroups.map((group, gi) => (
              <section key={gi} className="mb-5">
                <h2 className="text-xs font-bold uppercase border-b border-gray-500 pb-0.5 mb-2 break-after-avoid">{group.label}</h2>
                <ol className="space-y-3">
                  {group.items.map(({ q, num }) => {
                    const options = (Array.isArray(q.options) ? q.options : []) as Record<string, unknown>[];
                    const texts = options.filter((o) => String(o.text || "").trim() !== "");
                    const type = String(q.type || "");
                    return (
                      <li key={String(q.id)} className="flex gap-2 text-sm break-inside-avoid">
                        <span className="font-semibold">{num}.</span>
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap">{String(q.stem || q.questionText || "")}</p>
                          {texts.length > 0 ? (
                            <ul className="ml-6 mt-1 space-y-0.5">
                              {texts.map((o, oi) => (
                                <li key={oi}>{String.fromCharCode(65 + oi)}. {String(o.text)}</li>
                              ))}
                            </ul>
                          ) : type === "TF" ? (
                            <p className="ml-6 mt-1">True / False</p>
                          ) : type === "ESSAY" || type === "SCENARIO" ? (
                            <div className="ml-6 mt-2 space-y-4">
                              {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="border-b border-gray-400 h-4" />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
