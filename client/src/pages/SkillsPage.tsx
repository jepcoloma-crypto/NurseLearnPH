import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skillsApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal, Card } from "@/components/shared";
import { Plus, Pencil, Trash2, Play, Send, Eye, Power, ClipboardCheck, ListOrdered } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
});
type FormData = z.infer<typeof schema>;

export default function SkillsPage() {
  const { can, user } = usePermissions();
  const isStudent = user?.role === "STUDENT";
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const canManage = can("skills.create");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [practiceSkill, setPracticeSkill] = useState<Record<string, unknown> | null>(null);
  const [viewChecklist, setViewChecklist] = useState<Record<string, unknown> | null>(null);
  const [managingChecklistFor, setManagingChecklistFor] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["skills", page, isInstructor ? user?.id : undefined],
    queryFn: () => skillsApi.listSkills({
      page: String(page), limit: "15",
      ...(isInstructor ? { instructorId: user!.id } : { showAll: "true" }),
    }),
    enabled: !isStudent,
  });

  const { data: mySkillsData, isLoading: mySkillsLoading } = useQuery({
    queryKey: ["my-skills", user?.id],
    queryFn: () => skillsApi.getMySkills(),
    enabled: isStudent,
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses-for-skills"],
    queryFn: () => academicApi.listCourses({ limit: "100" }),
  });

  const practiceMutation = useMutation({
    mutationFn: ({ skillId, checkedItems }: { skillId: string; checkedItems: string[] }) =>
      skillsApi.practiceSkill(skillId, checkedItems),
    onSuccess: () => {
      toast.success("Practice logged!");
      setPracticeSkill(null);
      queryClient.invalidateQueries({ queryKey: ["my-skills"] });
    },
    onError: () => toast.error("Failed to log practice"),
  });

  const requestAssessmentMutation = useMutation({
    mutationFn: (skillId: string) => skillsApi.requestAssessment(skillId),
    onSuccess: () => {
      toast.success("Assessment requested!");
      queryClient.invalidateQueries({ queryKey: ["my-skills"] });
    },
    onError: () => toast.error("Failed to request assessment"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id: string) => skillsApi.toggleSkillStatus(id),
    onSuccess: (res) => {
      const newStatus = res?.data?.data?.isActive;
      toast.success(`Skill ${newStatus ? "activated" : "deactivated"}`);
      refetch();
    },
    onError: () => toast.error("Failed to toggle status"),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const mySkills = mySkillsData?.data?.data ?? [];
  const courses = coursesData?.data?.data?.items ?? [];

  // ─── Instructor: Pending Assessments ────────────────────────────────────────
  const [gradingId, setGradingId] = useState<string | null>(null);
  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ["pending-assessments"],
    queryFn: () => skillsApi.getPendingAssessments(),
    enabled: !isStudent,
  });
  const pendingList = pendingData?.data?.data ?? [];

  const startAssessmentMutation = useMutation({
    mutationFn: (studentSkillId: string) => skillsApi.createAssessmentFromRequest(studentSkillId),
    onSuccess: (res) => {
      const assessmentId = res?.data?.data?.id;
      if (assessmentId) setGradingId(assessmentId);
      refetchPending();
    },
    onError: () => toast.error("Failed to start assessment"),
  });

  // ─── Student View ────────────────────────────────────────────────────────────
  if (isStudent) {
    return (
      <div>
        <PageHeader title="Skills Lab" subtitle="Practice nursing skills and track your progress" />

        {mySkillsLoading ? <LoadingSpinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySkills.map((item: Record<string, unknown>) => {
              const skill = item.skill as Record<string, unknown> | null;
              const skillDesc = skill?.description;
              const checklists = (item.checklists ?? []) as Array<Record<string, unknown>>;
              const status = String(item.status ?? "NOT_STARTED");
              const isCompetent = Boolean(item.isCompetent);
              const bestScore = Number(item.bestScore ?? 0);
              const attempts = Number(item.attemptsCount ?? 0);
              const requested = Boolean(item.requestedAssessment);

              return (
                <Card key={String(item.id)} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{String(skill?.name ?? "Unknown")}</h3>
                      <p className="text-xs text-gray-500">{String(skill?.category ?? "")}</p>
                    </div>
                    {isCompetent ? (
                      <Badge variant="success">Competent</Badge>
                    ) : status === "PENDING_ASSESSMENT" ? (
                      <Badge variant="warning">Awaiting Assessment</Badge>
                    ) : status === "PRACTICED" ? (
                      <Badge variant="info">Practiced</Badge>
                    ) : (
                      <Badge variant="default">Not Started</Badge>
                    )}
                  </div>

                  {typeof skillDesc === "string" && skillDesc.length > 0 && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{skillDesc}</p>
                  )}

                  <div className="flex gap-4 text-xs text-gray-500 mb-3">
                    <span>Best: <strong>{bestScore}%</strong></span>
                    <span>Practices: <strong>{attempts}</strong></span>
                    <span>Steps: <strong>{checklists.length}</strong></span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className={`h-2 rounded-full transition-all ${isCompetent ? "bg-green-500" : bestScore >= 75 ? "bg-blue-500" : bestScore > 0 ? "bg-yellow-500" : "bg-gray-300"}`}
                      style={{ width: `${isCompetent ? 100 : bestScore}%` }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewChecklist(item)}
                    >
                      <Eye size={14} /> View Steps
                    </Button>
                    {!isCompetent && status !== "PENDING_ASSESSMENT" && (
                      <Button
                        size="sm"
                        onClick={() => setPracticeSkill(item)}
                      >
                        <Play size={14} /> Practice
                      </Button>
                    )}
                    {!isCompetent && (status === "PRACTICED" || attempts > 0) && !requested && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => requestAssessmentMutation.mutate(String(item.skillId))}
                        disabled={requestAssessmentMutation.isPending}
                      >
                        <Send size={14} /> Request Assessment
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {mySkills.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No skills assigned to your courses yet.
              </div>
            )}
          </div>
        )}

        {/* View Checklist Modal */}
        <Modal open={!!viewChecklist} onClose={() => setViewChecklist(null)} title={`Steps: ${viewChecklist ? String((viewChecklist.skill as Record<string, unknown>)?.name ?? "") : ""}`}>
          <div className="space-y-3">
            {viewChecklist && ((viewChecklist.checklists ?? []) as Array<Record<string, unknown>>)
              .sort((a, b) => Number(a.stepNumber ?? 0) - Number(b.stepNumber ?? 0))
              .map((step) => (
                <div key={String(step.id)} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {String(step.stepNumber)}
                  </span>
                  <div>
                    <p className="text-sm text-gray-800">{String(step.description)}</p>
                    {Boolean(step.isCritical) && (
                      <Badge variant="danger">Critical Step</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Modal>

        {/* Practice Modal */}
        <PracticeModal
          skill={practiceSkill}
          onClose={() => setPracticeSkill(null)}
          onSubmit={(checkedItems) => practiceMutation.mutate({ skillId: String(practiceSkill?.skillId), checkedItems })}
          isPending={practiceMutation.isPending}
        />
      </div>
    );
  }

  // ─── Instructor/Coordinator/Admin View ──────────────────────────────────────
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { courseId: "", name: "", description: "", category: "", difficulty: "BEGINNER" },
  });

  const columns = [
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "difficulty", label: "Difficulty", render: (row: Record<string, unknown>) => (
      <Badge variant={row.difficulty === "ADVANCED" ? "danger" : row.difficulty === "INTERMEDIATE" ? "warning" : "info"}>
        {String(row.difficulty)}
      </Badge>
    )},
    { key: "isActive", label: "Status", render: (row: Record<string, unknown>) => (
      <Badge variant={Boolean(row.isActive) ? "success" : "default"}>
        {Boolean(row.isActive) ? "Active" : "Inactive"}
      </Badge>
    )},
    ...(canManage ? [{
      key: "actions",
      label: "Actions",
      render: (row: Record<string, unknown>) => (
        <div className="flex gap-1">
          <button
            onClick={() => toggleStatusMutation.mutate(String(row.id))}
            className="p-1.5 hover:bg-gray-100 rounded"
            title={Boolean(row.isActive) ? "Deactivate" : "Activate"}
          >
            <Power size={14} className={Boolean(row.isActive) ? "text-green-500" : "text-gray-400"} />
          </button>
          <button
            onClick={() => setManagingChecklistFor(row)}
            className="p-1.5 hover:bg-gray-100 rounded text-blue-600"
            title="Manage Steps"
          >
            <ListOrdered size={14} />
          </button>
          <Button size="sm" variant="ghost" onClick={() => setEditItem(row)}><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={async () => {
            if (confirm("Delete this skill?")) {
              await skillsApi.deleteSkill(String(row.id));
              toast.success("Deleted");
              refetch();
            }
          }}><Trash2 size={14} /></Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Skills Lab"
        subtitle="Manage nursing skills and competencies"
        actions={canManage ? <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Skill</Button> : undefined}
      />

      {/* Pending Assessment Requests */}
      {pendingList.length > 0 && (
        <Card className="mb-6 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardCheck size={18} /> Pending Assessment Requests ({pendingList.length})
          </h3>
          <div className="divide-y">
            {pendingList.map((req: Record<string, unknown>) => (
              <div key={String(req.id)} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-medium text-gray-900">{String(req.studentFirstName)} {String(req.studentLastName)}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-sm text-gray-600">{String(req.skillName)}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-xs text-gray-500">Best: {String(req.bestScore)}% · {String(req.attemptsCount)} practices</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => startAssessmentMutation.mutate(String(req.id))}
                  disabled={startAssessmentMutation.isPending}
                >
                  <ClipboardCheck size={14} /> Assess
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={columns}
          data={items as Record<string, unknown>[]}
          pagination={pagination ? { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total } : undefined}
          onPageChange={setPage}
        />
      )}

      {/* Grading Modal */}
      {gradingId && (
        <GradingModal
          assessmentId={gradingId}
          onClose={() => { setGradingId(null); refetchPending(); refetch(); }}
        />
      )}

      <Modal open={showCreate || !!editItem} onClose={() => { setShowCreate(false); setEditItem(null); form.reset(); }} title={editItem ? "Edit Skill" : "Create Skill"}>
        <form onSubmit={form.handleSubmit(async (data) => {
          try {
            if (editItem) {
              await skillsApi.updateSkill(String(editItem.id), data);
              toast.success("Updated");
            } else {
              await skillsApi.createSkill(data);
              toast.success("Created");
            }
            setShowCreate(false); setEditItem(null); form.reset(); refetch();
          } catch { toast.error("Failed"); }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course</label>
            <select {...form.register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courses.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input {...form.register("name")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea {...form.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input {...form.register("category")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Basic Care" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Difficulty</label>
              <select {...form.register("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setEditItem(null); form.reset(); }}>Cancel</Button>
            <Button type="submit">{editItem ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Checklist Manager Modal */}
      {managingChecklistFor && (
        <ChecklistManager
          skill={managingChecklistFor}
          onClose={() => setManagingChecklistFor(null)}
        />
      )}
    </div>
  );
}

// ─── Practice Modal ──────────────────────────────────────────────────────────

function PracticeModal({ skill, onClose, onSubmit, isPending }: {
  skill: Record<string, unknown> | null;
  onClose: () => void;
  onSubmit: (checkedItems: string[]) => void;
  isPending: boolean;
}) {
  const checklists = skill ? ((skill.checklists ?? []) as Array<Record<string, unknown>>) : [];
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const criticalCount = checklists.filter((c) => Boolean(c.isCritical)).length;
  const checkedCriticalCount = checklists.filter((c) => Boolean(c.isCritical) && checked.has(String(c.id))).length;

  return (
    <Modal open={!!skill} onClose={onClose} title={`Practice: ${skill ? String((skill.skill as Record<string, unknown>)?.name ?? "") : ""}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Check off each step as you complete it during practice. Critical steps are marked in red.
        </p>

        <div className="text-sm text-gray-500">
          Progress: <strong>{checked.size}/{checklists.length}</strong> steps
          {criticalCount > 0 && (
            <span className="ml-2">| Critical: <strong className={checkedCriticalCount === criticalCount ? "text-green-600" : "text-red-600"}>{checkedCriticalCount}/{criticalCount}</strong></span>
          )}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {checklists
            .sort((a, b) => Number(a.stepNumber ?? 0) - Number(b.stepNumber ?? 0))
            .map((step) => {
              const id = String(step.id);
              const isChecked = checked.has(id);
              return (
                <label
                  key={id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isChecked ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(id)}
                    className="mt-0.5 h-4 w-4 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{String(step.stepNumber)}</span>
                      {Boolean(step.isCritical) && <Badge variant="danger">Critical</Badge>}
                    </div>
                    <p className="text-sm text-gray-800">{String(step.description)}</p>
                  </div>
                </label>
              );
            })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(Array.from(checked))} disabled={isPending || checked.size === 0}>
            {isPending ? "Saving..." : "Save Practice"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Grading Modal (Instructor) ─────────────────────────────────────────────

function GradingModal({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["assessment-details", assessmentId],
    queryFn: () => skillsApi.getAssessmentDetails(assessmentId),
  });

  const gradeMutation = useMutation({
    mutationFn: (payload: { items: Array<{ checklistId: string; isCompleted: boolean; notes: string; pointsAwarded: number }>; feedback: string; isCompetent: boolean }) =>
      skillsApi.gradeAssessment(assessmentId, payload),
    onSuccess: () => {
      toast.success("Assessment graded!");
      queryClient.invalidateQueries({ queryKey: ["pending-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["my-skills"] });
      onClose();
    },
    onError: () => toast.error("Failed to grade assessment"),
  });

  const details = data?.data?.data;
  const assessment = details as Record<string, unknown> | undefined;
  const items = (assessment?.items ?? []) as Array<Record<string, unknown>>;
  const skill = assessment?.skill as Record<string, unknown> | undefined;
  const student = assessment?.student as Record<string, unknown> | undefined;
  const studentChecked = (assessment?.studentCheckedItems ?? []) as string[];

  // Local grading state
  const [grades, setGrades] = useState<Map<string, { isCompleted: boolean; notes: string; pointsAwarded: number }>>(new Map());
  const [feedback, setFeedback] = useState("");
  const [isCompetent, setIsCompetent] = useState(true);

  if (isLoading) return <Modal open={true} onClose={onClose} title="Loading..."><LoadingSpinner /></Modal>;

  if (!assessment) return null;

  const getGrade = (checklistId: string) => {
    const g = grades.get(checklistId);
    if (g) return g;
    // Default: use assessment item values
    const item = items.find((i) => String(i.checklistId) === checklistId);
    return {
      isCompleted: Boolean(item?.isCompleted),
      notes: String(item?.notes ?? ""),
      pointsAwarded: Number(item?.pointsAwarded ?? 0),
    };
  };

  const updateGrade = (checklistId: string, updates: Partial<{ isCompleted: boolean; notes: string; pointsAwarded: number }>) => {
    setGrades((prev) => {
      const next = new Map(prev);
      const current = getGrade(checklistId);
      next.set(checklistId, { ...current, ...updates });
      return next;
    });
  };

  const totalPoints = items.reduce((sum, item) => {
    const g = getGrade(String(item.checklistId));
    return sum + g.pointsAwarded;
  }, 0);

  const maxScore = Number(assessment?.maxScore ?? 100);
  const scorePercent = maxScore > 0 ? Math.round((totalPoints / maxScore) * 100) : 0;

  const handleSubmit = () => {
    const gradedItems = items.map((item) => {
      const checklistId = String(item.checklistId);
      const g = getGrade(checklistId);
      return { checklistId, isCompleted: g.isCompleted, notes: g.notes, pointsAwarded: g.pointsAwarded };
    });
    gradeMutation.mutate({ items: gradedItems, feedback, isCompetent });
  };

  return (
    <Modal open={true} onClose={onClose} title={`Grade: ${String(skill?.name ?? "")} — ${String(student?.firstName ?? "")} ${String(student?.lastName ?? "")}`}>
      <div className="space-y-4">
        {/* Student's Practice Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-800 mb-1">Student's Practice</p>
          <p className="text-xs text-blue-600">
            Checked {studentChecked.length}/{items.length} steps during practice
          </p>
        </div>

        {/* Grading Steps */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {items
            .sort((a, b) => Number(a.stepNumber ?? 0) - Number(b.stepNumber ?? 0))
            .map((item) => {
              const checklistId = String(item.checklistId);
              const g = getGrade(checklistId);
              const wasCheckedByStudent = studentChecked.includes(checklistId);

              return (
                <div key={checklistId} className={`border rounded-lg p-3 ${g.isCompleted ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{String(item.stepNumber)}</span>
                      {Boolean(item.isCritical) && <Badge variant="danger">Critical</Badge>}
                      {wasCheckedByStudent && <Badge variant="info">Student checked</Badge>}
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={g.isCompleted}
                        onChange={(e) => updateGrade(checklistId, { isCompleted: e.target.checked })}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span className="text-xs font-medium text-gray-600">Correct</span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-800 mb-2">{String(item.description)}</p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-0.5">Points (0-10)</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={g.pointsAwarded}
                        onChange={(e) => updateGrade(checklistId, { pointsAwarded: Math.min(10, Math.max(0, Number(e.target.value))) })}
                        className="w-20 px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
                      <input
                        type="text"
                        value={g.notes}
                        onChange={(e) => updateGrade(checklistId, { notes: e.target.value })}
                        placeholder="Optional feedback..."
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Score Summary */}
        <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
          <span className="text-sm font-medium text-gray-700">Total Score</span>
          <span className={`text-lg font-bold ${scorePercent >= 75 ? "text-green-600" : scorePercent >= 50 ? "text-yellow-600" : "text-red-600"}`}>
            {totalPoints}/{maxScore} ({scorePercent}%)
          </span>
        </div>

        {/* Overall Feedback */}
        <div>
          <label className="block text-sm font-medium mb-1">Overall Feedback</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={2}
            placeholder="Overall assessment notes..."
          />
        </div>

        {/* Competence Decision */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isCompetent}
            onChange={(e) => setIsCompetent(e.target.checked)}
            className="h-4 w-4 text-primary-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Mark as Competent</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={gradeMutation.isPending}>
            {gradeMutation.isPending ? "Grading..." : "Submit Grade"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Checklist Manager (Instructor) ─────────────────────────────────────────

function ChecklistManager({ skill, onClose }: { skill: Record<string, unknown>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const skillId = String(skill.id);
  const skillName = String(skill.name ?? "");

  const { data: skillData, isLoading } = useQuery({
    queryKey: ["skill-detail", skillId],
    queryFn: () => skillsApi.getSkill(skillId),
  });

  const fullSkill = skillData?.data?.data;
  const checklists = (fullSkill?.checklists ?? []) as Array<Record<string, unknown>>;
  const sorted = [...checklists].sort((a, b) => Number(a.stepNumber ?? 0) - Number(b.stepNumber ?? 0));

  const [newStep, setNewStep] = useState({ stepNumber: sorted.length + 1, description: "", isCritical: false });

  const addMutation = useMutation({
    mutationFn: (data: { stepNumber: number; description: string; isCritical: boolean }) => skillsApi.addChecklist(skillId, data),
    onSuccess: () => {
      toast.success("Step added!");
      queryClient.invalidateQueries({ queryKey: ["skill-detail", skillId] });
      setNewStep({ stepNumber: sorted.length + 2, description: "", isCritical: false });
    },
    onError: () => toast.error("Failed to add step"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => skillsApi.removeChecklist(id),
    onSuccess: () => {
      toast.success("Step removed");
      queryClient.invalidateQueries({ queryKey: ["skill-detail", skillId] });
    },
    onError: () => toast.error("Failed to remove step"),
  });

  return (
    <Modal open={true} onClose={onClose} title={`Manage Steps: ${skillName}`}>
      <div className="space-y-4">
        {isLoading ? <LoadingSpinner /> : (
          <>
            {/* Existing Steps */}
            {sorted.length > 0 ? (
              <div className="space-y-2">
                {sorted.map((step) => (
                  <div key={String(step.id)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {String(step.stepNumber)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{String(step.description)}</p>
                    </div>
                    {Boolean(step.isCritical) && <Badge variant="danger">Critical</Badge>}
                    <button
                      onClick={() => {
                        if (confirm("Remove this step?")) removeMutation.mutate(String(step.id));
                      }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No steps yet. Add your first step below.</p>
            )}

            {/* Add New Step */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Add New Step</h4>
              <div className="flex gap-2 items-end">
                <div className="w-16">
                  <label className="block text-xs text-gray-500 mb-0.5">#</label>
                  <input
                    type="number"
                    min={1}
                    value={newStep.stepNumber}
                    onChange={(e) => setNewStep({ ...newStep, stepNumber: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border rounded"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                  <input
                    type="text"
                    value={newStep.description}
                    onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                    placeholder="e.g. Wash hands thoroughly"
                    className="w-full px-2 py-1.5 text-sm border rounded"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer pb-0.5">
                  <input
                    type="checkbox"
                    checked={newStep.isCritical}
                    onChange={(e) => setNewStep({ ...newStep, isCritical: e.target.checked })}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <span className="text-xs text-gray-600">Critical</span>
                </label>
                <Button
                  size="sm"
                  onClick={() => addMutation.mutate(newStep)}
                  disabled={addMutation.isPending || !newStep.description.trim()}
                >
                  <Plus size={14} /> Add
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
