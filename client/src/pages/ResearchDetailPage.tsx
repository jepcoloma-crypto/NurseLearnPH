import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { researchApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal } from "@/components/shared";
import EditProjectModal from "@/components/EditProjectModal";
import { ArrowLeft, Plus, Users, FlaskConical, Pencil, ChevronDown, ClipboardList, Download, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const cohortSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cohortType: z.enum(["INTERVENTION", "CONTROL", "MIXED", "OTHER"]),
  targetSize: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), "Must be a whole number"),
});
type CohortFormData = z.infer<typeof cohortSchema>;

const studySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  studyDesign: z.enum(["QUASI_EXPERIMENTAL", "RANDOMIZED_CONTROLLED", "PRE_POST", "CORRELATIONAL", "QUALITATIVE", "MIXED_METHODS"]),
  cohortId: z.string().optional(),
  intervention: z.string().optional(),
  controlGroup: z.string().optional(),
  outcomeMeasures: z.string().optional(),
});
type StudyFormData = z.infer<typeof studySchema>;

const enrollSchema = z.object({
  cohortId: z.string().optional(),
  groupAssignment: z.enum(["CONTROL", "EXPERIMENTAL"]),
});
type EnrollFormData = z.infer<typeof enrollSchema>;

const testSchema = z
  .object({
    participantId: z.string().min(1, "Participant is required"),
    testType: z.enum(["PRE", "POST"]),
    testDate: z.string().min(1, "Date is required"),
    score: z.coerce.number().int().min(0, "Score must be 0 or more"),
    maxScore: z.coerce.number().int().min(1, "Max score must be at least 1"),
    testInstrument: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.score <= d.maxScore, {
    message: "Score cannot exceed max score",
    path: ["score"],
  });
type TestFormData = z.infer<typeof testSchema>;

const exportSchema = z.object({
  exportType: z.enum(["CSV", "JSON", "SPSS"]),
  isAnonymized: z.boolean(),
});
type ExportFormData = z.infer<typeof exportSchema>;

interface Analysis {
  preTest: { count: number; averageScore: number };
  postTest: { count: number; averageScore: number };
  improvement: number;
}

export default function ResearchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can("research.create");

  const [editing, setEditing] = useState(false);
  const [showAddCohort, setShowAddCohort] = useState(false);
  const [showAddStudy, setShowAddStudy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [enrollFor, setEnrollFor] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: projectRes, isLoading } = useQuery({
    queryKey: ["research-project", id],
    queryFn: () => researchApi.getProject(id!),
    enabled: !!id,
  });
  const project = projectRes?.data?.data as Record<string, unknown> | undefined;

  const { data: cohortsRes } = useQuery({
    queryKey: ["research-cohorts", id],
    queryFn: () => researchApi.listCohorts(id!),
    enabled: !!id,
  });
  const cohorts = (cohortsRes?.data?.data ?? []) as Record<string, unknown>[];

  const { data: studiesRes } = useQuery({
    queryKey: ["research-studies", id],
    queryFn: () => researchApi.listStudies(id!),
    enabled: !!id,
  });
  const studies = (studiesRes?.data?.data ?? []) as Record<string, unknown>[];

  const { data: exportsRes } = useQuery({
    queryKey: ["research-exports", id],
    queryFn: () => researchApi.listExports(id!),
    enabled: !!id,
  });
  const exportsList = (exportsRes?.data?.data ?? []) as Record<string, unknown>[];

  const { data: participantsRes } = useQuery({
    queryKey: ["research-participants", expanded],
    queryFn: () => researchApi.listParticipants(expanded!),
    enabled: !!expanded,
  });
  const participants = (participantsRes?.data?.data ?? []) as Record<string, unknown>[];

  const { data: analysisRes } = useQuery({
    queryKey: ["research-analysis", expanded],
    queryFn: () => researchApi.getStudyAnalysis(expanded!),
    enabled: !!expanded,
  });
  const analysis = analysisRes?.data?.data as Analysis | undefined;

  const invalidate = () => {
    if (!id) return;
    queryClient.invalidateQueries({ queryKey: ["research-project", id] });
    queryClient.invalidateQueries({ queryKey: ["research-cohorts", id] });
    queryClient.invalidateQueries({ queryKey: ["research-studies", id] });
    queryClient.invalidateQueries({ queryKey: ["research-exports", id] });
    queryClient.invalidateQueries({ queryKey: ["research-participants", expanded] });
    queryClient.invalidateQueries({ queryKey: ["research-analysis", expanded] });
  };

  const cohortForm = useForm<CohortFormData>({
    resolver: zodResolver(cohortSchema),
    defaultValues: { cohortType: "INTERVENTION" },
  });
  const studyForm = useForm<StudyFormData>({
    resolver: zodResolver(studySchema),
    defaultValues: { studyDesign: "QUASI_EXPERIMENTAL" },
  });
  const enrollForm = useForm<EnrollFormData>({
    resolver: zodResolver(enrollSchema),
    defaultValues: { groupAssignment: "CONTROL" },
  });
  const testDefaults: TestFormData = {
    participantId: "",
    testType: "PRE",
    testDate: new Date().toISOString().substring(0, 10),
    score: 0,
    maxScore: 10,
    testInstrument: "",
    notes: "",
  };
  const testForm = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: testDefaults,
  });
  const exportForm = useForm<ExportFormData>({
    resolver: zodResolver(exportSchema),
    defaultValues: { exportType: "CSV", isAnonymized: true },
  });

  const cohortMutation = useMutation({
    mutationFn: (data: CohortFormData) =>
      researchApi.createCohort({
        ...data,
        projectId: id,
        targetSize: data.targetSize ? Number(data.targetSize) : undefined,
      }),
    onSuccess: () => {
      toast.success("Cohort added");
      setShowAddCohort(false);
      cohortForm.reset({ cohortType: "INTERVENTION" });
      invalidate();
    },
    onError: () => toast.error("Failed to add cohort"),
  });

  const studyMutation = useMutation({
    mutationFn: (data: StudyFormData) => {
      const measures = (data.outcomeMeasures ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return researchApi.createStudy({
        projectId: id,
        title: data.title,
        description: data.description,
        studyDesign: data.studyDesign,
        cohortId: data.cohortId || undefined,
        intervention: data.intervention,
        controlGroup: data.controlGroup,
        outcomeMeasures: measures.length ? measures : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Study added");
      setShowAddStudy(false);
      studyForm.reset({ studyDesign: "QUASI_EXPERIMENTAL" });
      invalidate();
    },
    onError: () => toast.error("Failed to add study"),
  });

  const enrollMutation = useMutation({
    mutationFn: (data: EnrollFormData) =>
      researchApi.enrollParticipant(enrollFor!, {
        cohortId: data.cohortId || undefined,
        groupAssignment: data.groupAssignment,
      }),
    onSuccess: () => {
      toast.success("Participant enrolled");
      setEnrollFor(null);
      enrollForm.reset({ groupAssignment: "CONTROL" });
      invalidate();
    },
    onError: () => toast.error("Failed to enroll participant"),
  });

  const testMutation = useMutation({
    mutationFn: (data: TestFormData) =>
      researchApi.recordPrePostTest({
        studyId: testFor!,
        participantId: data.participantId,
        testType: data.testType,
        testDate: new Date(data.testDate).toISOString(),
        score: data.score,
        maxScore: data.maxScore,
        testInstrument: data.testInstrument,
        notes: data.notes,
      }),
    onSuccess: () => {
      toast.success("Test recorded");
      setTestFor(null);
      testForm.reset({
        ...testDefaults,
        testDate: new Date().toISOString().substring(0, 10),
      });
      invalidate();
    },
    onError: () => toast.error("Failed to record test"),
  });

  const exportMutation = useMutation({
    mutationFn: (data: ExportFormData) =>
      researchApi.createExport({ ...data, projectId: id }),
    onSuccess: () => {
      toast.success("Export created");
      setShowExport(false);
      invalidate();
    },
    onError: () => toast.error("Failed to create export"),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => researchApi.deleteProject(id!),
    onSuccess: () => {
      toast.success("Research project deleted");
      navigate("/research");
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const deleteCohortMutation = useMutation({
    mutationFn: (cid: string) => researchApi.deleteCohort(cid),
    onSuccess: () => {
      toast.success("Cohort deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete cohort"),
  });

  const deleteStudyMutation = useMutation({
    mutationFn: (sid: string) => researchApi.deleteStudy(sid),
    onSuccess: (_, sid) => {
      toast.success("Study deleted");
      setExpanded((cur) => (cur === sid ? null : cur));
      invalidate();
    },
    onError: () => toast.error("Failed to delete study"),
  });

  const onDeleteProject = () => {
    if (!window.confirm(`Delete research project "${String(project?.title)}"? This also removes its cohorts, studies, participants, and test data.`)) return;
    deleteProjectMutation.mutate();
  };

  const onDeleteCohort = (c: Record<string, unknown>) => {
    if (!window.confirm(`Delete cohort "${String(c.name)}"? Linked studies and participants are kept but unlinked from it.`)) return;
    deleteCohortMutation.mutate(String(c.id));
  };

  const onDeleteStudy = (st: Record<string, unknown>) => {
    if (!window.confirm(`Delete study "${String(st.title)}"? Its participants and pre/post test records are removed.`)) return;
    deleteStudyMutation.mutate(String(st.id));
  };

  if (isLoading) return <LoadingSpinner />;

  if (!project) {
    return (
      <div className="text-center py-16 text-gray-400">
        Research project not found.{" "}
        <Link to="/research" className="text-purple-600 underline">Back to Research</Link>
      </div>
    );
  }

  const asText = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : "—");
  const asDate = (v: unknown) =>
    typeof v === "string" && v ? new Date(v).toLocaleDateString() : "—";
  const statusVariant = (s: string): "success" | "warning" | "info" | "danger" =>
    s === "ACTIVE" ? "success" : s === "PLANNING" ? "warning" : s === "CLOSED" ? "danger" : "info";
  const label = "block text-xs font-medium text-gray-400 mb-1";
  const input = "w-full px-3 py-2 border rounded-lg";

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/research")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 mb-3"
      >
        <ArrowLeft size={14} /> Back to Research
      </button>

      <PageHeader
        title={String(project.title)}
        subtitle={`${asText(project.researchType)} · ${asText(project.status)}`}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit Details
              </Button>
              <Button
                variant="danger"
                onClick={onDeleteProject}
                disabled={deleteProjectMutation.isPending}
              >
                <Trash2 size={16} /> Delete Project
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {/* Overview */}
        <Card>
          <h2 className="font-medium flex items-center gap-2 mb-3">
            <FlaskConical size={16} className="text-purple-600" /> Overview
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {typeof project.description === "string" && project.description
              ? project.description
              : "No description provided."}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className={label}>Status</p>
              <Badge variant={statusVariant(String(project.status))}>{String(project.status)}</Badge>
            </div>
            <div>
              <p className={label}>Research Type</p>
              <p className="font-medium">{asText(project.researchType)}</p>
            </div>
            <div>
              <p className={label}>Funding Source</p>
              <p className="font-medium">{asText(project.fundingSource)}</p>
            </div>
            <div>
              <p className={label}>IRB Number</p>
              <p className="font-medium">{asText(project.irbNumber)}</p>
            </div>
            <div>
              <p className={label}>Start Date</p>
              <p className="font-medium">{asDate(project.startDate)}</p>
            </div>
            <div>
              <p className={label}>End Date</p>
              <p className="font-medium">{asDate(project.endDate)}</p>
            </div>
            <div>
              <p className={label}>IRB Approval</p>
              <p className="font-medium">{asDate(project.irbApprovalDate)}</p>
            </div>
            <div>
              <p className={label}>Created</p>
              <p className="font-medium">{asDate(project.createdAt)}</p>
            </div>
          </div>
        </Card>

        {/* Cohorts */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <Users size={16} className="text-purple-600" /> Cohorts
              <span className="text-sm font-normal text-gray-400">({cohorts.length})</span>
            </h2>
            {canManage && (
              <Button variant="secondary" onClick={() => setShowAddCohort(true)}>
                <Plus size={14} /> Add Cohort
              </Button>
            )}
          </div>
          {cohorts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No cohorts yet.</p>
          ) : (
            <div className="divide-y">
              {cohorts.map((c) => (
                <div key={String(c.id)} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{String(c.name)}</p>
                    {typeof c.description === "string" && c.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="info">{String(c.cohortType)}</Badge>
                    {typeof c.targetSize === "number" && (
                      <span className="text-xs text-gray-400">
                        {String(c.currentSize ?? 0)}/{c.targetSize} targeted
                      </span>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onDeleteCohort(c)}
                        disabled={deleteCohortMutation.isPending}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Delete cohort"
                        title="Delete cohort"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Studies */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <ClipboardList size={16} className="text-purple-600" /> Studies
              <span className="text-sm font-normal text-gray-400">({studies.length})</span>
            </h2>
            {canManage && (
              <Button variant="secondary" onClick={() => setShowAddStudy(true)}>
                <Plus size={14} /> Add Study
              </Button>
            )}
          </div>

          {studies.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No studies yet.</p>
          ) : (
            studies.map((st) => {
              const stId = String(st.id);
              const isOpen = expanded === stId;
              const linkedCohort = cohorts.find((c) => String(c.id) === String(st.cohortId ?? ""));
              const outcomes = Array.isArray(st.outcomeMeasures)
                ? (st.outcomeMeasures as string[]).filter((o) => typeof o === "string")
                : [];
              return (
                <div key={stId} className="border rounded-lg mb-3">
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : stId)}
                    className="flex-1 flex items-center justify-between gap-3 p-3 text-left"
                  >
                    <div>
                      <p className="font-medium text-sm">{String(st.title)}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="info">{String(st.studyDesign)}</Badge>
                        {typeof st.status === "string" && st.status && (
                          <Badge variant="warning">{String(st.status)}</Badge>
                        )}
                        {linkedCohort && (
                          <span className="text-xs text-gray-400">
                            Cohort: {String(linkedCohort.name)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onDeleteStudy(st)}
                        disabled={deleteStudyMutation.isPending}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        aria-label="Delete study"
                        title="Delete study"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="border-t p-3">
                      <div className="text-sm text-gray-600 space-y-1 mb-4">
                        {typeof st.intervention === "string" && st.intervention && (
                          <p><span className="text-gray-400">Intervention:</span> {String(st.intervention)}</p>
                        )}
                        {typeof st.controlGroup === "string" && st.controlGroup && (
                          <p><span className="text-gray-400">Control group:</span> {String(st.controlGroup)}</p>
                        )}
                        {outcomes.length > 0 && (
                          <p><span className="text-gray-400">Outcomes:</span> {outcomes.join(", ")}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Participants */}
                        <div className="border rounded-lg p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="text-sm font-medium">Participants ({participants.length})</p>
                            {canManage && (
                              <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setEnrollFor(stId)}>
                                  <Plus size={14} /> Enroll
                                </Button>
                                <Button variant="secondary" onClick={() => setTestFor(stId)}>
                                  <Plus size={14} /> Record Test
                                </Button>
                              </div>
                            )}
                          </div>
                          {participants.length === 0 ? (
                            <p className="text-xs text-gray-400">No participants enrolled yet.</p>
                          ) : (
                            <ul className="divide-y text-sm">
                              {participants.map((pt) => (
                                <li key={String(pt.id)} className="py-1.5 flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs">{String(pt.anonymousId)}</span>
                                  <span className="flex items-center gap-1.5">
                                    {typeof pt.groupAssignment === "string" && pt.groupAssignment && (
                                      <Badge variant={pt.groupAssignment === "EXPERIMENTAL" ? "success" : "info"}>
                                        {String(pt.groupAssignment)}
                                      </Badge>
                                    )}
                                    {typeof pt.status === "string" && pt.status && (
                                      <span className="text-xs text-gray-400">{String(pt.status)}</span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Analysis */}
                        <div className="border rounded-lg p-3">
                          <p className="text-sm font-medium mb-3">Pre/Post Analysis</p>
                          {!analysis || (analysis.preTest.count === 0 && analysis.postTest.count === 0) ? (
                            <p className="text-xs text-gray-400">No test data recorded yet.</p>
                          ) : (
                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">Pre-test average</span>
                                  <span className="font-medium">{analysis.preTest.averageScore}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-2 bg-gray-400 rounded-full"
                                    style={{ width: `${analysis.preTest.averageScore}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">Post-test average</span>
                                  <span className="font-medium">{analysis.postTest.averageScore}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-2 bg-purple-600 rounded-full"
                                    style={{ width: `${analysis.postTest.averageScore}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <Badge variant={analysis.improvement >= 0 ? "success" : "danger"}>
                                  {analysis.improvement >= 0 ? "+" : ""}
                                  {analysis.improvement}% improvement
                                </Badge>
                                <span className="text-xs text-gray-400">
                                  {analysis.preTest.count} pre · {analysis.postTest.count} post
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Card>

        {/* Exports */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <Download size={16} className="text-purple-600" /> Data Exports
              <span className="text-sm font-normal text-gray-400">({exportsList.length})</span>
            </h2>
            {canManage && (
              <Button variant="secondary" onClick={() => setShowExport(true)}>
                <Plus size={14} /> Export Data
              </Button>
            )}
          </div>
          {exportsList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No exports yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {exportsList.map((ex) => (
                <li key={String(ex.id)} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="font-medium">{String(ex.exportType)}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-500">
                    {ex.isAnonymized ? (
                      <Badge variant="success">Anonymized</Badge>
                    ) : (
                      <Badge variant="warning">Identified</Badge>
                    )}
                    {typeof ex.recordCount === "number" && <span>{ex.recordCount} records</span>}
                    <span>{asDate(ex.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}

      {editing && (
        <EditProjectModal project={project} onClose={() => setEditing(false)} onSaved={invalidate} />
      )}

      {/* Add Cohort */}
      <Modal open={showAddCohort} onClose={() => setShowAddCohort(false)} title="Add Cohort">
        <form onSubmit={cohortForm.handleSubmit((d) => cohortMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={label}>Name</label>
            <input {...cohortForm.register("name")} className={input} placeholder="e.g. BSN Year 2 Cohort" />
            {cohortForm.formState.errors.name && (
              <p className="text-red-500 text-xs mt-1">{cohortForm.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea {...cohortForm.register("description")} className={input} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Cohort Type</label>
              <select {...cohortForm.register("cohortType")} className={input}>
                <option value="INTERVENTION">Intervention</option>
                <option value="CONTROL">Control</option>
                <option value="MIXED">Mixed</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={label}>Target Size</label>
              <input
                type="number"
                {...cohortForm.register("targetSize")}
                className={input}
                placeholder="Optional"
              />
              {cohortForm.formState.errors.targetSize && (
                <p className="text-red-500 text-xs mt-1">{cohortForm.formState.errors.targetSize.message}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddCohort(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={cohortMutation.isPending}>
              {cohortMutation.isPending ? "Adding..." : "Add Cohort"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Study */}
      <Modal open={showAddStudy} onClose={() => setShowAddStudy(false)} title="Add Study" size="lg">
        <form onSubmit={studyForm.handleSubmit((d) => studyMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={label}>Title</label>
            <input
              {...studyForm.register("title")}
              className={input}
              placeholder="e.g. Simulation vs Traditional Instruction"
            />
            {studyForm.formState.errors.title && (
              <p className="text-red-500 text-xs mt-1">{studyForm.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea {...studyForm.register("description")} className={input} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Study Design</label>
              <select {...studyForm.register("studyDesign")} className={input}>
                <option value="QUASI_EXPERIMENTAL">Quasi-Experimental</option>
                <option value="RANDOMIZED_CONTROLLED">Randomized Controlled</option>
                <option value="PRE_POST">Pre/Post</option>
                <option value="CORRELATIONAL">Correlational</option>
                <option value="QUALITATIVE">Qualitative</option>
                <option value="MIXED_METHODS">Mixed Methods</option>
              </select>
            </div>
            <div>
              <label className={label}>Linked Cohort</label>
              <select {...studyForm.register("cohortId")} className={input}>
                <option value="">None</option>
                {cohorts.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Intervention</label>
              <input {...studyForm.register("intervention")} className={input} placeholder="Optional" />
            </div>
            <div>
              <label className={label}>Control Group</label>
              <input {...studyForm.register("controlGroup")} className={input} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className={label}>Outcome Measures</label>
            <input
              {...studyForm.register("outcomeMeasures")}
              className={input}
              placeholder="Comma-separated, e.g. Competency score, Critical thinking"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddStudy(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={studyMutation.isPending}>
              {studyMutation.isPending ? "Adding..." : "Add Study"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enroll Participant */}
      <Modal open={!!enrollFor} onClose={() => setEnrollFor(null)} title="Enroll Participant">
        <form onSubmit={enrollForm.handleSubmit((d) => enrollMutation.mutate(d))} className="space-y-4">
          <p className="text-sm text-gray-500">
            Participants are stored with an anonymous ID — no personal data is collected.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Cohort</label>
              <select {...enrollForm.register("cohortId")} className={input}>
                <option value="">None</option>
                {cohorts.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Group</label>
              <select {...enrollForm.register("groupAssignment")} className={input}>
                <option value="CONTROL">Control</option>
                <option value="EXPERIMENTAL">Experimental</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEnrollFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={enrollMutation.isPending}>
              {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Pre/Post Test */}
      <Modal open={!!testFor} onClose={() => setTestFor(null)} title="Record Pre/Post Test" size="lg">
        <form onSubmit={testForm.handleSubmit((d) => testMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={label}>Participant</label>
            <select {...testForm.register("participantId")} className={input}>
              <option value="">Select participant...</option>
              {participants.map((pt) => (
                <option key={String(pt.id)} value={String(pt.id)}>
                  {String(pt.anonymousId)}
                  {typeof pt.groupAssignment === "string" && pt.groupAssignment
                    ? ` — ${pt.groupAssignment}`
                    : ""}
                </option>
              ))}
            </select>
            {testForm.formState.errors.participantId && (
              <p className="text-red-500 text-xs mt-1">{testForm.formState.errors.participantId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={label}>Test Type</label>
              <select {...testForm.register("testType")} className={input}>
                <option value="PRE">Pre-test</option>
                <option value="POST">Post-test</option>
              </select>
            </div>
            <div>
              <label className={label}>Test Date</label>
              <input type="date" {...testForm.register("testDate")} className={input} />
              {testForm.formState.errors.testDate && (
                <p className="text-red-500 text-xs mt-1">{testForm.formState.errors.testDate.message}</p>
              )}
            </div>
            <div>
              <label className={label}>Instrument</label>
              <input {...testForm.register("testInstrument")} className={input} placeholder="Optional" />
            </div>
            <div>
              <label className={label}>Score</label>
              <input type="number" {...testForm.register("score")} className={input} />
              {testForm.formState.errors.score && (
                <p className="text-red-500 text-xs mt-1">{testForm.formState.errors.score.message}</p>
              )}
            </div>
            <div>
              <label className={label}>Max Score</label>
              <input type="number" {...testForm.register("maxScore")} className={input} />
              {testForm.formState.errors.maxScore && (
                <p className="text-red-500 text-xs mt-1">{testForm.formState.errors.maxScore.message}</p>
              )}
            </div>
          </div>
          <div>
            <label className={label}>Notes</label>
            <textarea {...testForm.register("notes")} className={input} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setTestFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={testMutation.isPending}>
              {testMutation.isPending ? "Saving..." : "Record Test"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Export Data */}
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Data">
        <form onSubmit={exportForm.handleSubmit((d) => exportMutation.mutate(d))} className="space-y-4">
          <div>
            <label className={label}>Format</label>
            <select {...exportForm.register("exportType")} className={input}>
              <option value="CSV">CSV</option>
              <option value="JSON">JSON</option>
              <option value="SPSS">SPSS</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...exportForm.register("isAnonymized")} className="rounded" />
            Anonymize participant identifiers
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowExport(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={exportMutation.isPending}>
              {exportMutation.isPending ? "Exporting..." : "Export"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
