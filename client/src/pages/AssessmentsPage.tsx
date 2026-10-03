import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, Pencil, Link as LinkIcon, Play, History, CheckSquare, Trash2, CheckCircle2, Clock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["QUIZ", "EXAM", "ASSIGNMENT"]),
  timeLimitMinutes: z.coerce.number().int().min(1).optional().nullable(),
  passingScore: z.coerce.number().int().min(0).max(100),
  questionIds: z.array(z.string()).optional(),
});
type FormData = z.infer<typeof schema>;

export default function AssessmentsPage() {
  const { can, user } = usePermissions();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [linkModalItem, setLinkModalItem] = useState<Record<string, unknown> | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["assessments", page, isInstructor ? user?.id : undefined],
    queryFn: () => assessmentApi.listAssessments({ page: String(page), limit: "15", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { data: questions } = useQuery({
    queryKey: ["questions-bank", isInstructor ? user?.id : undefined],
    queryFn: () => assessmentApi.listQuestions({ limit: "200", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { data: assessmentQuestions, refetch: refetchAssessmentQuestions } = useQuery({
    queryKey: ["assessment-questions", linkModalItem?.id],
    queryFn: () => assessmentApi.getAssessmentQuestions(String(linkModalItem?.id)),
    enabled: !!linkModalItem?.id,
  });
  const { data: studentAttempts } = useQuery({
    queryKey: ["my-attempts"],
    queryFn: () => assessmentApi.getMyAttempts(),
    enabled: !isInstructor,
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courseList = courses?.data?.data?.items ?? [];
  const questionList = questions?.data?.data?.items ?? [];
  const linkedQuestions = assessmentQuestions?.data?.data?.items ?? assessmentQuestions?.data?.data ?? [];
  const attemptItems = studentAttempts?.data?.data ?? [];
  const canCreate = can("assessments.create");
  const canEdit = can("assessments.edit");
  const canDelete = can("assessments.delete");
  const isInstructorRole = canEdit || can("assessments.create");

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "QUIZ", passingScore: 75, questionIds: [] },
  });

  const linkQuestionsMutation = useMutation({
    mutationFn: (data: { assessmentId: string; questionIds: string[] }) =>
      assessmentApi.linkQuestions(data.assessmentId, data.questionIds),
    onSuccess: () => {
      toast.success("Questions linked");
      refetchAssessmentQuestions();
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: () => toast.error("Failed to link questions"),
  });

  const unlinkQuestionMutation = useMutation({
    mutationFn: (data: { assessmentId: string; questionId: string }) =>
      assessmentApi.unlinkQuestion(data.assessmentId, data.questionId),
    onSuccess: () => {
      toast.success("Question unlinked");
      refetchAssessmentQuestions();
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: () => toast.error("Failed to unlink question"),
  });

  const togglePublishMutation = useMutation({
    mutationFn: (data: { assessmentId: string; isPublished: boolean }) =>
      assessmentApi.updateAssessment(data.assessmentId, {
        isPublished: data.isPublished,
      }),
    onSuccess: () => {
      toast.success("Assessment publish status updated");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: () => toast.error("Failed to toggle publish status"),
  });

  const onCreate = async (formData: FormData) => {
    try {
      await assessmentApi.createAssessment({
        ...formData,
        questionIds: formData.questionIds?.length ? formData.questionIds : undefined,
      });
      toast.success("Assessment created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create assessment");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      await assessmentApi.updateAssessment(String(editItem?.id), {
        ...formData,
        questionIds: formData.questionIds?.length ? formData.questionIds : undefined,
      });
      toast.success("Assessment updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update assessment");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    const existingIds = item.questionIds
      ? (item.questionIds as string[])
      : item.questions
      ? ((item.questions as Record<string, unknown>[]).map((q) => String(q.questionId || q.id || q)))
      : [];
    reset({
      courseId: String(item.courseId || ""),
      title: String(item.title || ""),
      description: String(item.description || ""),
      type: (String(item.type || "QUIZ") as "QUIZ" | "EXAM" | "ASSIGNMENT"),
      timeLimitMinutes: item.timeLimitMinutes ? Number(item.timeLimitMinutes) : null,
      passingScore: Number(item.passingScore || 75),
      questionIds: existingIds,
    });
  };

  const onDeleteAssessmentsItem = async (item: Record<string, unknown>) => {
    if (!window.confirm(`Delete assessment "${String(item.title)}"?`)) return;
    try {
      await assessmentApi.deleteAssessment(String(item.id));
      toast.success("Assessment deleted");
      refetch();
    } catch {
      toast.error("Failed to delete assessment");
    }
  };

  const openLinkModal = (item: Record<string, unknown>) => {
    setLinkModalItem(item);
    setSelectedQuestionIds([]);
    setQuestionSearch("");
  };

  const handleLinkQuestions = () => {
    if (!linkModalItem || selectedQuestionIds.length === 0) return;
    linkQuestionsMutation.mutate({
      assessmentId: String(linkModalItem.id),
      questionIds: selectedQuestionIds,
    });
  };

  const handleUnlinkQuestion = (questionId: string) => {
    if (!linkModalItem) return;
    if (!window.confirm("Remove this question from the assessment?")) return;
    unlinkQuestionMutation.mutate({
      assessmentId: String(linkModalItem.id),
      questionId,
    });
  };

  const toggleQuestionSelection = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const toggleAllQuestions = (filteredIds: string[]) => {
    const allSelected = filteredIds.every((id) => selectedQuestionIds.includes(id));
    setSelectedQuestionIds(allSelected ? [] : filteredIds);
  };

  const getFilteredQuestions = () => {
    if (!questionSearch.trim()) return questionList;
    const term = questionSearch.toLowerCase();
    return questionList.filter((q: Record<string, unknown>) => {
      const stem = String(q.stem || q.questionText || "").toLowerCase();
      const type = String(q.type || q.questionType || "").toLowerCase();
      return stem.includes(term) || type.includes(term);
    });
  };

  const getLinkedQuestionCount = (item: Record<string, unknown>) => {
    if (typeof item.questionCount === "number") return item.questionCount;
    if (Array.isArray(item.questionIds)) return item.questionIds.length;
    if (Array.isArray(item.questions)) return item.questions.length;
    return 0;
  };

  const getAttemptForAssessment = (assessmentId: string) => {
    return attemptItems.find((a: Record<string, unknown>) => String(a.assessmentId) === assessmentId);
  };

  const formatType = (t: string) => {
    const m: Record<string, "info" | "success" | "warning" | "danger"> = {
      QUIZ: "info", EXAM: "warning", ASSIGNMENT: "success",
    };
    return <Badge variant={m[t] || "default"}>{t}</Badge>;
  };

  if (isInstructorRole) {
    return (
      <div>
        <PageHeader
          title="Assessments"
          subtitle="Quizzes, exams, and evaluations"
          actions={
            canCreate ? (
              <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Create Assessment</Button>
            ) : undefined
          }
        />

        {isLoading ? <LoadingSpinner /> : (
          <DataTable
            columns={[
              { key: "title", label: "Title" },
              { key: "type", label: "Type", className: "w-20", render: (item) => (
                formatType(String(item.type))
              )},
              { key: "questionCount", label: "Questions", className: "w-16", render: (item) => (
                <span className="text-gray-600">{getLinkedQuestionCount(item)}</span>
              )},
              { key: "passingScore", label: "Pass %", className: "w-16" },
              { key: "timeLimitMinutes", label: "Time", className: "w-16", render: (item) => (
                item.timeLimitMinutes ? `${item.timeLimitMinutes}m` : "-"
              )},
              { key: "isPublished", label: "Status", className: "w-24", render: (item) => (
                <Badge variant={item.isPublished ? "success" : "warning"}>{item.isPublished ? "Published" : "Draft"}</Badge>
              )},
              { key: "actions", label: "", className: "w-28", render: (item) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => openLinkModal(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Link Questions">
                    <LinkIcon size={16} className="text-primary-500" />
                  </button>
                  {canEdit && (
                    <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                      <Pencil size={16} className="text-gray-500" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDeleteAssessmentsItem(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Delete">
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  )}
                  {isInstructorRole && (
                    <button
                      onClick={() => togglePublishMutation.mutate({ assessmentId: String(item.id), isPublished: !item.isPublished })}
                      className="p-1 hover:bg-gray-100 rounded"
                      data-tooltip={item.isPublished ? "Unpublish" : "Publish"}
                    >
                      {item.isPublished ? <CheckCircle2 size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
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

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Assessment">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Midterm Quiz" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select {...register("type")} className="w-full px-3 py-2 border rounded-lg">
                  <option value="QUIZ">Quiz</option>
                  <option value="EXAM">Exam</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (min)</label>
                <input type="number" {...register("timeLimitMinutes")} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pass %</label>
                <input type="number" {...register("passingScore")} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <QuestionSelector
              questions={questionList}
              selectedIds={watch("questionIds") ?? []}
              onChange={(ids) => { reset((prev) => ({ ...prev, questionIds: ids })); }}
              search={questionSearch}
              onSearchChange={setQuestionSearch}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Assessment">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Midterm Quiz" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select {...register("type")} className="w-full px-3 py-2 border rounded-lg">
                  <option value="QUIZ">Quiz</option>
                  <option value="EXAM">Exam</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (min)</label>
                <input type="number" {...register("timeLimitMinutes")} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pass %</label>
                <input type="number" {...register("passingScore")} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <QuestionSelector
              questions={questionList}
              selectedIds={watch("questionIds") ?? []}
              onChange={(ids) => { reset((prev) => ({ ...prev, questionIds: ids })); }}
              search={questionSearch}
              onSearchChange={setQuestionSearch}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setEditItem(null); reset(); }}>Cancel</Button>
              <Button type="submit">Update</Button>
            </div>
          </form>
        </Modal>

        <Modal open={!!linkModalItem} onClose={() => setLinkModalItem(null)} title="Link Questions">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search questions..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg divide-y divide-gray-100">
              {Array.isArray(linkedQuestions) && linkedQuestions.length > 0 && (
                <div className="px-3 py-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 uppercase">Currently Linked ({linkedQuestions.length})</p>
                </div>
              )}
              {Array.isArray(linkedQuestions) && linkedQuestions.map((lq: Record<string, unknown>) => {
                const q = (lq.question || lq) as Record<string, unknown>;
                const qId = String((lq.questionId as string) || (q.id as string) || "");
                return (
                  <div key={qId} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm line-clamp-1 flex-1">{String(q.stem || q.questionText || "")}</span>
                    <button
                      onClick={() => handleUnlinkQuestion(qId)}
                      className="ml-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
              <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase">Available Questions</p>
                <button
                  type="button"
                  onClick={() => {
                    const filtered = getFilteredQuestions();
                    const ids = filtered.map((q: Record<string, unknown>) => String(q.id));
                    toggleAllQuestions(ids);
                  }}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  {getFilteredQuestions().every((q: Record<string, unknown>) => selectedQuestionIds.includes(String(q.id))) ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {getFilteredQuestions().map((q: Record<string, unknown>) => (
                  <label key={String(q.id)} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(String(q.id))}
                      onChange={() => toggleQuestionSelection(String(q.id))}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-1">{String(q.stem || q.questionText || "")}</p>
                      <div className="flex gap-2 mt-0.5">
                        <Badge variant="info" >{String(q.type || q.questionType || "")}</Badge>
                        <Badge>{String(q.difficulty || "")}</Badge>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-gray-500">{selectedQuestionIds.length} selected</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setLinkModalItem(null)}>Cancel</Button>
                <Button onClick={handleLinkQuestions} disabled={selectedQuestionIds.length === 0 || linkQuestionsMutation.isPending}>
                  <CheckSquare size={16} />
                  {linkQuestionsMutation.isPending ? "Linking..." : "Link Selected"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Assessments"
        subtitle="Available quizzes and exams"
      />

      {isLoading ? <LoadingSpinner /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: Record<string, unknown>) => {
            const attempt = getAttemptForAssessment(String(item.id));
            const isInProgress = attempt?.status === "IN_PROGRESS";
            const isCompleted = attempt?.status === "SUBMITTED" || attempt?.status === "GRADED";
            return (
              <div key={String(item.id)} className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{String(item.title)}</h3>
                  {formatType(String(item.type))}
                </div>
                <div className="space-y-1 text-sm text-gray-500 mb-4 flex-1">
                  {item.timeLimitMinutes != null && (
                    <p>Time Limit: {String(item.timeLimitMinutes)} min</p>
                  )}
                  <p>Pass Score: {String(item.passingScore)}%</p>
                  {getLinkedQuestionCount(item) > 0 && (
                    <p>Questions: {getLinkedQuestionCount(item)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isInProgress ? (
                    <Button onClick={() => navigate(`/exam/${String(item.id)}`)}>
                      <Play size={16} /> Resume Exam
                    </Button>
                  ) : isCompleted ? (
                    <Button variant="secondary" onClick={() => navigate(`/exam/${String(item.id)}/result/${String(attempt?.id)}`)}>
                      <History size={16} /> View Result
                    </Button>
                  ) : (
                    <Button onClick={() => navigate(`/exam/${String(item.id)}`)}>
                      <Play size={16} /> Start Exam
                    </Button>
                  )}
                  <Badge variant={item.isPublished ? "success" : "warning"}>
                    {item.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
                {isCompleted && attempt && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    Last attempt: {String(attempt.score ?? "-")}/{String(attempt.totalPossible ?? "-")} ({String(attempt.percentage ?? "-")}%)
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">No assessments available</div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionSelector({
  questions,
  selectedIds,
  onChange,
  search,
  onSearchChange,
}: {
  questions: Record<string, unknown>[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  search: string;
  onSearchChange: (val: string) => void;
}) {
  const filtered = search.trim()
    ? questions.filter((q) => {
        const stem = String(q.stem || q.questionText || "").toLowerCase();
        const type = String(q.type || q.questionType || "").toLowerCase();
        return stem.includes(search.toLowerCase()) || type.includes(search.toLowerCase());
      })
    : questions;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Link Questions (optional)</label>
      <input
        type="text"
        placeholder="Search questions..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
      />
      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-gray-100">
        {filtered.map((q) => (
          <label key={String(q.id)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(String(q.id))}
              onChange={() => toggle(String(q.id))}
              className="rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-1">{String(q.stem || q.questionText || "")}</p>
            </div>
            <Badge variant="info">{String(q.type || q.questionType || "")}</Badge>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No questions found</p>
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">{selectedIds.length} question(s) selected</p>
      )}
    </div>
  );
}
