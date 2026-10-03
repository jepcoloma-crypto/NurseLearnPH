import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { clinicalApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, Card, LoadingSpinner, Modal, EmptyState } from "@/components/shared";
import { Plus, Eye, Pencil, Trash2, Play, Clock, Power, ListOrdered } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  department: z.string().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(100).optional(),
});
type FormData = z.infer<typeof schema>;

export default function CasesPage() {
  const { can, isStudent, user } = usePermissions();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const isAdminOrCoordinator = user?.role === "ADMIN" || user?.role === "PROGRAM_COORDINATOR";
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [stagesCase, setStagesCase] = useState<Record<string, unknown> | null>(null);
  const [showStageForm, setShowStageForm] = useState(false);
  const [editingStage, setEditingStage] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cases", page, isInstructor ? user?.id : undefined, isAdminOrCoordinator ? "showAll" : undefined],
    queryFn: () => clinicalApi.listCases({
      page: String(page),
      limit: "15",
      instructorId: isInstructor ? user!.id : undefined,
      showAll: isAdminOrCoordinator ? "true" : undefined,
    }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses-for-cases"],
    queryFn: () => academicApi.listCourses({ limit: "100" }),
  });

  const { data: attemptsData } = useQuery({
    queryKey: ["clinicalAttempts"],
    queryFn: () => clinicalApi.listAttempts({ limit: "50" }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const attempts = attemptsData?.data?.data?.items ?? [];
  const courses = coursesData?.data?.data?.items ?? [];
  const canCreate = can("cases.create");
  const canEdit = can("cases.edit");
  const canDelete = can("cases.delete");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { difficulty: "BEGINNER" },
  });

  const startMutation = useMutation({
    mutationFn: (caseId: string) => clinicalApi.startCase(caseId),
    onSuccess: (res) => {
      const attempt = res.data.data;
      toast.success("Case started!");
      navigate(`/cases/${attempt.caseId}/attempt/${attempt.id}`);
    },
    onError: () => toast.error("Failed to start case"),
  });

  const togglePublishMutation = useMutation({
    mutationFn: (id: string) => clinicalApi.togglePublish(id),
    onSuccess: (res) => {
      const status = res.data.data.isPublished ? "Published" : "Unpublished";
      toast.success(`Case ${status}`);
      refetch();
    },
    onError: () => toast.error("Failed to toggle publish status"),
  });

  // Stages management
  const { data: stagesData, refetch: refetchStages } = useQuery({
    queryKey: ["case-stages", stagesCase?.id],
    queryFn: () => clinicalApi.getCase(String(stagesCase?.id)),
    enabled: !!stagesCase,
  });

  const createStageMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalApi.createStage(String(stagesCase?.id), data),
    onSuccess: () => { toast.success("Stage added"); setShowStageForm(false); refetchStages(); refetch(); },
    onError: () => toast.error("Failed to add stage"),
  });

  const updateStageMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalApi.updateStage(String(editingStage?.id), data),
    onSuccess: () => { toast.success("Stage updated"); setEditingStage(null); setShowStageForm(false); refetchStages(); refetch(); },
    onError: () => toast.error("Failed to update stage"),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) => clinicalApi.deleteStage(id),
    onSuccess: () => { toast.success("Stage deleted"); refetchStages(); refetch(); },
    onError: () => toast.error("Failed to delete stage"),
  });

  const onCreate = async (formData: FormData) => {
    try {
      await clinicalApi.createCase(formData);
      toast.success("Case created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create case");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      await clinicalApi.updateCase(String(editItem?.id), formData);
      toast.success("Case updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update case");
    }
  };

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this case?")) return;
    try {
      await clinicalApi.deleteCase(String(item.id));
      toast.success("Case deleted");
      refetch();
    } catch {
      toast.error("Failed to delete case");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      courseId: String(item.courseId || ""),
      title: String(item.title || ""),
      description: String(item.description || ""),
      difficulty: (String(item.difficulty || "BEGINNER") as "BEGINNER" | "INTERMEDIATE" | "ADVANCED"),
      department: String(item.department || ""),
      maxAttempts: Number(item.maxAttempts || 3),
    });
  };

  const diffColor = (d: string) => {
    const m: Record<string, "success" | "warning" | "danger"> = { BEGINNER: "success", INTERMEDIATE: "warning", ADVANCED: "danger" };
    return m[d] || "default";
  };

  if (isStudent) {
    return (
      <div>
        <PageHeader
          title="Clinical Cases"
          subtitle="Case-based clinical reasoning scenarios"
        />

        {isLoading ? <LoadingSpinner /> : items.length === 0 ? (
          <EmptyState title="No cases available" description="Check back later for new cases" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {items.map((item: Record<string, unknown>) => {
              const caseId = String(item.id);
              const maxAttempts = Number(item.maxAttempts) || 3;
              const caseAttempts = attempts.filter((a: Record<string, unknown>) => String(a.caseId) === caseId);
              const completedAttempts = caseAttempts.filter((a: Record<string, unknown>) => a.status === "COMPLETED");
              const latestAttempt = completedAttempts[0]; // sorted by date desc
              const hasInProgress = caseAttempts.some((a: Record<string, unknown>) => a.status === "IN_PROGRESS");
              const attemptsUsed = completedAttempts.length;
              const attemptsRemaining = maxAttempts - attemptsUsed;
              const canRetake = attemptsRemaining > 0;

              return (
                <Card key={caseId} className="flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{String(item.title)}</h3>
                      <Badge variant={diffColor(String(item.difficulty))}>{String(item.difficulty)}</Badge>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{String(item.description)}</p>
                    ) : null}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {item.department ? <span>{String(item.department)}</span> : null}
                      {Array.isArray(item.stages) && (
                        <span>{item.stages.length} stage{item.stages.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {latestAttempt && (
                      <div className="mt-2 text-sm text-gray-600">
                        Last score: <span className="font-medium">{String(latestAttempt.score)}/{String(latestAttempt.totalPoints)}</span>
                      </div>
                    )}
                    {attemptsUsed > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        {attemptsUsed}/{maxAttempts} attempts used{canRetake ? ` (${attemptsRemaining} remaining)` : " — max reached"}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t">
                    {hasInProgress ? (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => navigate(`/cases/${caseId}/attempt/${String(caseAttempts.find((a: Record<string, unknown>) => a.status === "IN_PROGRESS")?.id)}`)}
                      >
                        <Play size={16} />
                        Continue
                      </Button>
                    ) : attemptsUsed > 0 && canRetake ? (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          variant="secondary"
                          onClick={() => navigate(`/cases/${caseId}/attempt/${String(latestAttempt?.id)}/result`)}
                        >
                          Review
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => startMutation.mutate(caseId)}
                          disabled={startMutation.isPending}
                        >
                          <Play size={16} />
                          Retake
                        </Button>
                      </div>
                    ) : attemptsUsed > 0 && !canRetake ? (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => navigate(`/cases/${caseId}/attempt/${String(latestAttempt?.id)}/result`)}
                      >
                        Review
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => startMutation.mutate(caseId)}
                        disabled={startMutation.isPending}
                      >
                        <Play size={16} />
                        Start Case
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {attempts.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Attempts</h2>
            <div className="space-y-3">
              {attempts.map((attempt: Record<string, unknown>) => (
                <Card key={String(attempt.id)} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {String(((attempt.case as Record<string, unknown>)?.title) ?? "Clinical Case")}
                      </p>
                      <p className="text-sm text-gray-500">
                        Started {attempt.startedAt ? new Date(String(attempt.startedAt)).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={attempt.status === "COMPLETED" ? "success" : "warning"}>
                      {String(attempt.status)}
                    </Badge>
                    {attempt.status === "COMPLETED" && attempt.score != null && (
                      <span className="text-sm font-medium text-gray-700">
                        {String(attempt.score)}/{String(attempt.totalPoints)} pts
                      </span>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/cases/${String(attempt.caseId)}/attempt/${String(attempt.id)}${attempt.status === "COMPLETED" ? "/result" : ""}`)}
                    >
                      {attempt.status === "COMPLETED" ? "Review" : "Continue"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Modal open={!!selected} onClose={() => setSelected(null)} title="Case Details">
          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{String(selected.description || "No description")}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Difficulty:</span> <Badge variant={diffColor(String(selected.difficulty))}>{String(selected.difficulty)}</Badge></div>
                <div><span className="text-gray-500">Department:</span> {String(selected.department || "N/A")}</div>
              </div>
              {Array.isArray(selected.stages) && selected.stages.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Stages ({selected.stages.length})</h4>
                  <div className="space-y-2">
                    {selected.stages.map((s: Record<string, unknown>, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium">Stage {String(s.stageNumber)}: {String(s.title)}</p>
                        <p className="text-xs text-gray-500 mt-1">{String(s.description || "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={() => {
                  setSelected(null);
                  startMutation.mutate(String(selected.id));
                }} disabled={startMutation.isPending}>
                  <Play size={16} />
                  Start Case
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Clinical Cases"
        subtitle="Case-based clinical reasoning scenarios"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Case</Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "title", label: "Title" },
            { key: "difficulty", label: "Level", className: "w-28", render: (item) => (
              <Badge variant={diffColor(String(item.difficulty))}>{String(item.difficulty)}</Badge>
            )},
            { key: "department", label: "Department", className: "w-40" },
            { key: "stages", label: "Stages", className: "w-20", render: (item) => (
              Array.isArray(item.stages) ? item.stages.length : "-"
            )},
            { key: "isPublished", label: "Status", className: "w-24", render: (item) => (
              <Badge variant={item.isPublished ? "success" : "default"}>
                {item.isPublished ? "Published" : "Draft"}
              </Badge>
            )},
            { key: "actions", label: "Actions", className: "w-32", render: (item) => (
              <div className="flex items-center gap-1">
                <button onClick={() => setSelected(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="View">
                  <Eye size={16} className="text-gray-400" />
                </button>
                {canEdit && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { setStagesCase(item); setEditingStage(null); setShowStageForm(false); }} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Manage Stages">
                    <ListOrdered size={16} className="text-blue-500" />
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => togglePublishMutation.mutate(String(item.id))}
                    className="p-1 hover:bg-gray-100 rounded"
                    data-tooltip={item.isPublished ? "Unpublish" : "Publish"}
                  >
                    <Power size={16} className={item.isPublished ? "text-green-500" : "text-gray-400"} />
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Clinical Case">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courses.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Acute MI Management" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select {...register("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input {...register("department")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. ICU" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
              <input type="number" min="1" max="100" {...register("maxAttempts")} className="w-full px-3 py-2 border rounded-lg" placeholder="3" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Clinical Case">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courses.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Acute MI Management" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select {...register("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input {...register("department")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. ICU" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
              <input type="number" min="1" max="100" {...register("maxAttempts")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">{String(selected.title)}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{String(selected.description || "No description")}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Difficulty:</span> <Badge variant={diffColor(String(selected.difficulty))}>{String(selected.difficulty)}</Badge></div>
                <div><span className="text-gray-500">Department:</span> {String(selected.department || "N/A")}</div>
              </div>
              {Array.isArray(selected.stages) && selected.stages.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Stages ({selected.stages.length})</h4>
                  <div className="space-y-2">
                    {selected.stages.map((s: Record<string, unknown>, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium">Stage {String(s.stageNumber)}: {String(s.title)}</p>
                        <p className="text-xs text-gray-500 mt-1">{String(s.description || "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stages Management Modal */}
      {stagesCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setStagesCase(null); setEditingStage(null); setShowStageForm(false); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Stages: {String(stagesCase.title)}</h3>
                <p className="text-sm text-gray-500">Add and manage decision points for this case</p>
              </div>
              <div className="flex items-center gap-2">
                {!showStageForm && (
                  <Button size="sm" onClick={() => { setEditingStage(null); setShowStageForm(true); }}>
                    <Plus size={16} /> Add Stage
                  </Button>
                )}
                <button onClick={() => { setStagesCase(null); setEditingStage(null); setShowStageForm(false); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
            </div>
            <div className="p-6">
              {/* Stage Form */}
              {showStageForm && (
                <StageForm
                  initialData={editingStage}
                  onSubmit={(data) => {
                    if (editingStage) {
                      updateStageMutation.mutate(data);
                    } else {
                      createStageMutation.mutate(data);
                    }
                  }}
                  onCancel={() => { setEditingStage(null); setShowStageForm(false); }}
                  isPending={createStageMutation.isPending || updateStageMutation.isPending}
                />
              )}

              {/* Stages List */}
              {!showStageForm && (
                <div className="space-y-3">
                  {stagesData?.data?.data?.stages?.length === 0 && (
                    <EmptyState title="No stages yet" description="Add stages to create decision points for students" />
                  )}
                  {stagesData?.data?.data?.stages?.map((stage: Record<string, unknown>, i: number) => (
                    <div key={String(stage.id)} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="info">Stage {i + 1}</Badge>
                            <span className="text-sm text-gray-500">{String(stage.points)} pts</span>
                          </div>
                          <h4 className="font-medium text-gray-900">{String(stage.title)}</h4>
                          {stage.description ? <p className="text-sm text-gray-600 mt-1">{String(stage.description)}</p> : null}
                          {Array.isArray(stage.options) && stage.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {stage.options.map((opt: Record<string, unknown>) => (
                                <div key={String(opt.id)} className="flex items-center gap-2 text-sm">
                                  <span className={opt.isCorrect ? "text-green-600 font-medium" : "text-gray-600"}>
                                    {opt.isCorrect ? "✓" : "○"} {String(opt.text)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button onClick={() => { setEditingStage(stage); setShowStageForm(true); }} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                            <Pencil size={14} className="text-gray-500" />
                          </button>
                          <button onClick={() => { if (window.confirm("Delete this stage?")) deleteStageMutation.mutate(String(stage.id)); }} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Delete">
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stage Form Component ────────────────────────────────────────────────────

interface StageOptionDraft {
  text: string;
  isCorrect: boolean;
  rationale: string;
}

interface StageFormProps {
  initialData: Record<string, unknown> | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}

function StageForm({ initialData, onSubmit, onCancel, isPending }: StageFormProps) {
  const [title, setTitle] = useState(String(initialData?.title || ""));
  const [description, setDescription] = useState(String(initialData?.description || ""));
  const [points, setPoints] = useState(Number(initialData?.points || 1));
  const [order, setOrder] = useState(Number(initialData?.order || 0));
  const [options, setOptions] = useState<StageOptionDraft[]>(() => {
    if (initialData && Array.isArray(initialData.options) && initialData.options.length > 0) {
      return initialData.options.map((o: Record<string, unknown>) => ({
        text: String(o.text || ""),
        isCorrect: Boolean(o.isCorrect),
        rationale: String(o.rationale || ""),
      }));
    }
    return [
      { text: "", isCorrect: true, rationale: "" },
      { text: "", isCorrect: false, rationale: "" },
    ];
  });

  const addOption = () => setOptions([...options, { text: "", isCorrect: false, rationale: "" }]);
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));
  const updateOption = (i: number, field: keyof StageOptionDraft, value: string | boolean) => {
    const updated = [...options];
    updated[i] = { ...updated[i], [field]: value };
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (options.length < 2) { toast.error("At least 2 options required"); return; }
    if (!options.some((o) => o.isCorrect)) { toast.error("Mark at least one option as correct"); return; }
    if (options.some((o) => !o.text.trim())) { toast.error("All options need text"); return; }
    onSubmit({ title, description: description || undefined, points, order, options });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4 bg-gray-50">
      <h4 className="font-medium text-gray-900">{initialData ? "Edit Stage" : "New Stage"}</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Initial Assessment" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input type="number" min="1" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <input type="number" min="0" value={order} onChange={(e) => setOrder(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description / Scenario</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Patient scenario or context..." />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Options * (at least 2, mark correct answer)</label>
          <button type="button" onClick={addOption} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"><Plus size={14} /> Add</button>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="radio"
                name="correctOption"
                checked={opt.isCorrect}
                onChange={() => {
                  const updated = options.map((o, idx) => ({ ...o, isCorrect: idx === i }));
                  setOptions(updated);
                }}
                className="mt-3"
                title="Correct answer"
              />
              <div className="flex-1 space-y-1">
                <input value={opt.text} onChange={(e) => updateOption(i, "text", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={`Option ${i + 1}`} />
                <input value={opt.rationale} onChange={(e) => updateOption(i, "rationale", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs" placeholder="Rationale (optional)" />
              </div>
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="mt-2 p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : initialData ? "Update Stage" : "Add Stage"}</Button>
      </div>
    </form>
  );
}
