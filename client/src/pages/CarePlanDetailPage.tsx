import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { nursingProcessApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal } from "@/components/shared";
import { ArrowLeft, Plus, Trash2, Check, Send, RotateCcw } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const diagnosisSchema = z.object({
  diagnosisId: z.string().min(1, "Diagnosis is required"),
  evidence: z.string().optional(),
  rationale: z.string().optional(),
  goalType: z.enum(["SHORT_TERM", "LONG_TERM"]),
  assessmentData: z.string().optional(),
});
type DiagnosisFormData = z.infer<typeof diagnosisSchema>;

const outcomeSchema = z.object({
  description: z.string().min(1, "Description is required"),
  timeframe: z.string().optional(),
  criteria: z.string().optional(),
});
type OutcomeFormData = z.infer<typeof outcomeSchema>;

const interventionSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  rationale: z.string().optional(),
  frequency: z.string().optional(),
  expectedTime: z.string().optional(),
});
type InterventionFormData = z.infer<typeof interventionSchema>;

const evaluateSchema = z.object({
  evaluationNotes: z.string().min(1, "Evaluation notes are required"),
  status: z.enum(["APPROVED", "RETURNED", "COMPLETED"]),
});
type EvaluateFormData = z.infer<typeof evaluateSchema>;

const INTERVENTION_CATEGORIES = ["ASSESSMENT", "THERAPEUTIC", "TEACHING", "COORDINATION", "COLLABORATIVE", "PATIENT_CONTROL"];

export default function CarePlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isInstructor, isAdmin, user } = usePermissions();

  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(null);
  const [showAddDiagnosis, setShowAddDiagnosis] = useState(false);
  const [showAddOutcome, setShowAddOutcome] = useState<string | null>(null);
  const [showAddIntervention, setShowAddIntervention] = useState<string | null>(null);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<Record<string, unknown> | null>(null);
  const [evaluatingOutcome, setEvaluatingOutcome] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["care-plan", id],
    queryFn: () => nursingProcessApi.getCarePlan(id!),
    enabled: !!id,
  });

  const { data: diagnosesData } = useQuery({
    queryKey: ["nursing-diagnoses-for-plan"],
    queryFn: () => nursingProcessApi.listDiagnoses({ limit: "100" }),
  });

  const plan = data?.data?.data;
  const allDiagnoses = diagnosesData?.data?.data?.items ?? [];

  const diagnosisForm = useForm<DiagnosisFormData>({ resolver: zodResolver(diagnosisSchema) });
  const outcomeForm = useForm<OutcomeFormData>({ resolver: zodResolver(outcomeSchema) });
  const interventionForm = useForm<InterventionFormData>({ resolver: zodResolver(interventionSchema) });
  const evaluateForm = useForm<EvaluateFormData>({ resolver: zodResolver(evaluateSchema) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["care-plan", id] });
  };

  const isStudent = user?.role === "STUDENT";
  const isEditable = plan?.status === "DRAFT" || plan?.status === "RETURNED";
  // APPROVED = implementation phase: content is locked, student only tracks
  // interventions (isCompleted) and evaluates outcomes (isMet).
  const isImplementing = plan?.status === "APPROVED";

  // ─── Diagnosis handlers ────────────────────────────────────────────────────

  const onAddDiagnosis = async (formData: DiagnosisFormData) => {
    try {
      await nursingProcessApi.addDiagnosisToPlan(id!, formData);
      toast.success("Diagnosis added");
      setShowAddDiagnosis(false);
      diagnosisForm.reset();
      invalidate();
    } catch {
      toast.error("Failed to add diagnosis");
    }
  };

  const onUpdateDiagnosis = async (formData: DiagnosisFormData) => {
    if (!editingDiagnosis) return;
    try {
      await nursingProcessApi.updateDiagnosisOnPlan(String(editingDiagnosis.id), formData);
      toast.success("Diagnosis updated");
      setEditingDiagnosis(null);
      diagnosisForm.reset();
      invalidate();
    } catch {
      toast.error("Failed to update diagnosis");
    }
  };

  const onRemoveDiagnosis = async (diagnosisId: string) => {
    if (!window.confirm("Remove this diagnosis from the care plan?")) return;
    try {
      await nursingProcessApi.removeDiagnosis(diagnosisId);
      toast.success("Diagnosis removed");
      invalidate();
    } catch {
      toast.error("Failed to remove diagnosis");
    }
  };

  // ─── Outcome handlers ──────────────────────────────────────────────────────

  const onAddOutcome = async (formData: OutcomeFormData) => {
    try {
      await nursingProcessApi.addOutcome(showAddOutcome!, formData);
      toast.success("Outcome added");
      setShowAddOutcome(null);
      outcomeForm.reset();
      invalidate();
    } catch {
      toast.error("Failed to add outcome");
    }
  };

  const onRemoveOutcome = async (outcomeId: string) => {
    if (!window.confirm("Remove this outcome?")) return;
    try {
      await nursingProcessApi.removeOutcome(outcomeId);
      toast.success("Outcome removed");
      invalidate();
    } catch {
      toast.error("Failed to remove outcome");
    }
  };

  const onToggleOutcomeMet = async (outcomeId: string, isMet: boolean) => {
    try {
      await nursingProcessApi.updateOutcome(outcomeId, { isMet: !isMet });
      invalidate();
    } catch {
      toast.error("Failed to update outcome");
    }
  };

  const onEvaluateOutcome = async (formData: { evaluationNotes: string; actualOutcome: string }) => {
    if (!evaluatingOutcome) return;
    try {
      await nursingProcessApi.updateOutcome(String(evaluatingOutcome.id), {
        ...formData,
        isMet: true,
      });
      toast.success("Outcome evaluated");
      setEvaluatingOutcome(null);
      invalidate();
    } catch {
      toast.error("Failed to evaluate outcome");
    }
  };

  // ─── Intervention handlers ─────────────────────────────────────────────────

  const onAddIntervention = async (formData: InterventionFormData) => {
    try {
      await nursingProcessApi.addIntervention(showAddIntervention!, formData);
      toast.success("Intervention added");
      setShowAddIntervention(null);
      interventionForm.reset();
      invalidate();
    } catch {
      toast.error("Failed to add intervention");
    }
  };

  const onRemoveIntervention = async (interventionId: string) => {
    if (!window.confirm("Remove this intervention?")) return;
    try {
      await nursingProcessApi.removeIntervention(interventionId);
      toast.success("Intervention removed");
      invalidate();
    } catch {
      toast.error("Failed to remove intervention");
    }
  };

  const onToggleInterventionCompleted = async (interventionId: string, isCompleted: boolean) => {
    try {
      await nursingProcessApi.updateIntervention(interventionId, { isCompleted: !isCompleted });
      invalidate();
    } catch {
      toast.error("Failed to update intervention");
    }
  };

  // ─── Submit / Recall ───────────────────────────────────────────────────────

  const onSubmitForReview = async () => {
    try {
      await nursingProcessApi.submitCarePlan(id!, { status: "SUBMITTED" });
      toast.success("Care plan submitted for review");
      invalidate();
    } catch {
      toast.error("Failed to submit care plan");
    }
  };

  const onRecall = async () => {
    try {
      await nursingProcessApi.submitCarePlan(id!, { status: "DRAFT" });
      toast.success("Care plan recalled to draft");
      invalidate();
    } catch {
      toast.error("Failed to recall care plan");
    }
  };

  // ─── Evaluate (Instructor) ─────────────────────────────────────────────────

  const onEvaluate = async (formData: EvaluateFormData) => {
    try {
      await nursingProcessApi.evaluateCarePlan(id!, formData);
      toast.success("Care plan evaluated");
      setShowEvaluate(false);
      evaluateForm.reset();
      invalidate();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message || "Failed to evaluate care plan";
      toast.error(msg);
    }
  };

  // Available evaluate decisions depend on the plan's current status
  const evaluateOptionsFor = (status: string): Array<[EvaluateFormData["status"], string]> => {
    if (status === "APPROVED") return [["COMPLETED", "Mark as Completed"], ["RETURNED", "Return for Revision"]];
    if (status === "COMPLETED") return [["APPROVED", "Reopen (Back to Approved)"], ["RETURNED", "Return for Revision"]];
    return [["APPROVED", "Approve"], ["RETURNED", "Return for Revision"]];
  };

  const openEvaluate = () => {
    const opts = evaluateOptionsFor(String(plan?.status));
    evaluateForm.reset({ status: opts[0][0], evaluationNotes: "" });
    setShowEvaluate(true);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!plan) return <div className="text-center py-12 text-gray-500">Care plan not found</div>;

  const diagnoses = plan.diagnoses || [];
  const totalInterventions = diagnoses.reduce((sum: number, d: Record<string, unknown>) => {
    const interventions = d.interventions as Record<string, unknown>[] | undefined;
    return sum + (interventions?.length || 0);
  }, 0);
  const completedInterventions = diagnoses.reduce((sum: number, d: Record<string, unknown>) => {
    const interventions = d.interventions as Record<string, unknown>[] | undefined;
    return sum + (interventions?.filter((i) => i.isCompleted).length || 0);
  }, 0);
  const totalOutcomes = diagnoses.reduce((sum: number, d: Record<string, unknown>) => {
    const outcomes = d.outcomes as Record<string, unknown>[] | undefined;
    return sum + (outcomes?.length || 0);
  }, 0);
  const metOutcomes = diagnoses.reduce((sum: number, d: Record<string, unknown>) => {
    const outcomes = d.outcomes as Record<string, unknown>[] | undefined;
    return sum + (outcomes?.filter((o) => o.isMet).length || 0);
  }, 0);

  const evaluateOptions = evaluateOptionsFor(String(plan.status));

  return (
    <div>
      <PageHeader
        title={plan.title}
        subtitle={`Status: ${String(plan.status).replace("_", " ")}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/care-plans")}><ArrowLeft size={16} /> Back</Button>

            {/* Student: Submit / Recall */}
            {isStudent && (plan.status === "DRAFT" || plan.status === "RETURNED") && (
              <Button onClick={onSubmitForReview}><Send size={16} /> {plan.status === "RETURNED" ? "Resubmit for Review" : "Submit for Review"}</Button>
            )}
            {isStudent && plan.status === "SUBMITTED" && (
              <Button variant="secondary" onClick={onRecall}><RotateCcw size={16} /> Recall</Button>
            )}

            {/* Instructor: Evaluate (review / finalize / reopen) */}
            {(isInstructor || isAdmin) && ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "COMPLETED"].includes(String(plan.status)) && (
              <Button onClick={openEvaluate}>{plan.status === "COMPLETED" ? "Reopen" : "Evaluate"}</Button>
            )}

            {/* Student: Add Diagnosis (only in editable states) */}
            {isStudent && isEditable && (
              <Button onClick={() => setShowAddDiagnosis(true)}><Plus size={16} /> Add Diagnosis</Button>
            )}
          </div>
        }
      />

      {/* ─── Status Banner ──────────────────────────────────────────────────── */}
      {(plan.status === "SUBMITTED" || plan.status === "RETURNED" || plan.status === "APPROVED" || plan.status === "COMPLETED") && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          plan.status === "RETURNED" ? "bg-red-50 text-red-700 border border-red-200" :
          plan.status === "SUBMITTED" ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
          plan.status === "APPROVED" ? "bg-green-50 text-green-700 border border-green-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {plan.status === "SUBMITTED"
            ? "This care plan has been submitted and is awaiting instructor review."
            : plan.status === "RETURNED"
            ? `This care plan has been returned by the instructor for revision.${plan.evaluationNotes ? ` Feedback: ${plan.evaluationNotes}` : plan.feedback ? ` Feedback: ${plan.feedback}` : ""}`
            : plan.status === "APPROVED"
            ? `The instructor approved this care plan — carry out the interventions and evaluate the outcomes. The instructor will mark it Completed when everything is done.${plan.evaluationNotes ? ` Feedback: ${plan.evaluationNotes}` : ""}`
            : `This care plan is completed and closed.${plan.evaluationNotes ? ` Final notes: ${plan.evaluationNotes}` : ""}`}
        </div>
      )}

      {/* ─── Patient & Assessment Info ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Patient Information</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Name:</span> {plan.patientName || "N/A"}</p>
            {plan.patientAge && <p><span className="font-medium">Age:</span> {plan.patientAge}</p>}
            {plan.patientGender && <p><span className="font-medium">Gender:</span> {plan.patientGender}</p>}
            {plan.medicalDiagnosis && <p><span className="font-medium">Medical Diagnosis:</span> {plan.medicalDiagnosis}</p>}
          </div>
          <div className="mt-3 text-xs text-gray-400">
            Created: {new Date(plan.createdAt).toLocaleDateString()}
            {plan.updatedAt !== plan.createdAt && ` | Updated: ${new Date(plan.updatedAt).toLocaleDateString()}`}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Assessment Data</h3>
          {plan.subjectiveData || plan.objectiveData ? (
            <div className="space-y-2 text-sm">
              {plan.subjectiveData && (
                <div>
                  <p className="font-medium text-blue-700">Subjective:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{plan.subjectiveData}</p>
                </div>
              )}
              {plan.objectiveData && (
                <div>
                  <p className="font-medium text-green-700">Objective:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{plan.objectiveData}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No assessment data yet.</p>
          )}
        </Card>
      </div>

      {/* ─── Progress Summary ────────────────────────────────────────────────── */}
      {diagnoses.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-sm text-gray-500">Diagnoses</p>
            <p className="text-2xl font-bold">{diagnoses.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Outcomes Met</p>
            <p className="text-2xl font-bold">{metOutcomes}/{totalOutcomes}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Interventions Done</p>
            <p className="text-2xl font-bold">{completedInterventions}/{totalInterventions}</p>
          </Card>
        </div>
      )}

      {/* ─── Evaluation Notes (if evaluated) ─────────────────────────────────── */}
      {plan.evaluationNotes && (
        <Card className="mb-6 border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Instructor Evaluation</h3>
          <p className="text-sm text-gray-700">{plan.evaluationNotes}</p>
          {plan.evaluatedAt && <p className="text-xs text-gray-400 mt-1">Evaluated: {new Date(plan.evaluatedAt).toLocaleDateString()}</p>}
        </Card>
      )}

      {/* ─── Diagnoses ──────────────────────────────────────────────────────── */}
      <h2 className="text-lg font-semibold mb-4">Nursing Diagnoses ({diagnoses.length})</h2>

      {diagnoses.length === 0 && (
        <Card className="text-center py-8 text-gray-500">
          {isEditable ? 'No diagnoses added yet. Click "Add Diagnosis" to get started.' : "No diagnoses in this care plan."}
        </Card>
      )}

      {diagnoses.map((cpd: Record<string, unknown>) => {
        const diagnosis = cpd.diagnosis as Record<string, unknown> | undefined;
        const outcomes = (cpd.outcomes || []) as Record<string, unknown>[];
        const interventions = (cpd.interventions || []) as Record<string, unknown>[];
        const isExpanded = expandedDiagnosis === String(cpd.id);

        return (
          <Card key={String(cpd.id)} className="mb-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedDiagnosis(isExpanded ? null : String(cpd.id))}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {diagnosis ? `${diagnosis.code} - ${diagnosis.name}` : "Unknown Diagnosis"}
                  </h3>
                  <Badge variant="default">P{String(cpd.priority)}</Badge>
                  <Badge variant={cpd.goalType === "LONG_TERM" ? "info" : "default"}>
                    {cpd.goalType === "LONG_TERM" ? "Long-term" : "Short-term"}
                  </Badge>
                </div>
                {Boolean(cpd.rationale) && (
                  <p className="text-sm text-gray-600 mt-1 italic">Rationale: {String(cpd.rationale)}</p>
                )}
                {Boolean(cpd.evidence) && (
                  <p className="text-sm text-gray-500 mt-1">Evidence: {String(cpd.evidence)}</p>
                )}
                {Boolean(cpd.assessmentData) && (
                  <p className="text-sm text-gray-500 mt-1">Assessment: {String(cpd.assessmentData)}</p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-400 mr-2">{outcomes.length} outcomes · {interventions.length} interventions</span>
                {isStudent && isEditable && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDiagnosis(cpd);
                        diagnosisForm.reset({
                          diagnosisId: String(cpd.diagnosisId),
                          evidence: String(cpd.evidence || ""),
                          rationale: String(cpd.rationale || ""),
                          goalType: (cpd.goalType as "SHORT_TERM" | "LONG_TERM") || "SHORT_TERM",
                          assessmentData: String(cpd.assessmentData || ""),
                        });
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-xs text-gray-500"
                      data-tooltip="Edit diagnosis details"
                    >Edit</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveDiagnosis(String(cpd.id)); }}
                      className="p-1 hover:bg-gray-100 rounded"
                      data-tooltip="Remove diagnosis"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 border-t pt-4 space-y-4">
                {/* ─── Outcomes ──────────────────────────────────────────────── */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Expected Outcomes ({outcomes.length})</h4>
                    {isStudent && isEditable && (
                      <Button size="sm" onClick={() => setShowAddOutcome(String(cpd.id))}>
                        <Plus size={14} /> Add Outcome
                      </Button>
                    )}
                  </div>
                  {outcomes.length === 0 ? (
                    <p className="text-sm text-gray-400">No outcomes yet</p>
                  ) : (
                    <div className="space-y-2">
                      {outcomes.map((o: Record<string, unknown>) => (
                        <div key={String(o.id)} className="bg-gray-50 rounded p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm">{String(o.description)}</p>
                              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                {Boolean(o.timeframe) && <span>⏱ {String(o.timeframe)}</span>}
                                {Boolean(o.criteria) && <span>📏 {String(o.criteria)}</span>}
                              </div>
                              {Boolean(o.actualOutcome) && (
                                <p className="text-xs text-green-600 mt-1">Actual: {String(o.actualOutcome)}</p>
                              )}
                              {Boolean(o.evaluationNotes) && (
                                <p className="text-xs text-blue-600 mt-1">Eval: {String(o.evaluationNotes)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {isStudent && (isEditable || isImplementing) && (
                                <button
                                  onClick={() => onToggleOutcomeMet(String(o.id), Boolean(o.isMet))}
                                  className={`p-1 rounded ${o.isMet ? "bg-green-100 text-green-600" : "hover:bg-gray-100 text-gray-400"}`}
                                  data-tooltip={o.isMet ? "Mark as not met" : "Mark as met"}
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              {isStudent && isEditable && (
                                <button
                                  onClick={() => onRemoveOutcome(String(o.id))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  data-tooltip="Remove outcome"
                                >
                                  <Trash2 size={14} className="text-red-500" />
                                </button>
                              )}
                              {(isInstructor || isAdmin) && !o.isMet && (
                                <button
                                  onClick={() => setEvaluatingOutcome(o)}
                                  className="text-xs text-primary-600 hover:underline"
                                >Evaluate</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Interventions ────────────────────────────────────────── */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Nursing Interventions ({interventions.length})</h4>
                    {isStudent && isEditable && (
                      <Button size="sm" onClick={() => setShowAddIntervention(String(cpd.id))}>
                        <Plus size={14} /> Add Intervention
                      </Button>
                    )}
                  </div>
                  {interventions.length === 0 ? (
                    <p className="text-sm text-gray-400">No interventions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {interventions.map((i: Record<string, unknown>) => (
                        <div key={String(i.id)} className="flex items-start justify-between bg-gray-50 rounded p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="info">{String(i.category)}</Badge>
                              {Boolean(i.frequency) && <span className="text-xs text-gray-500">📅 {String(i.frequency)}</span>}
                              {Boolean(i.expectedTime) && <span className="text-xs text-gray-500">⏱ {String(i.expectedTime)}</span>}
                            </div>
                            <p className="text-sm mt-1">{String(i.description)}</p>
                            {Boolean(i.rationale) && <p className="text-xs text-gray-500 mt-1 italic">Rationale: {String(i.rationale)}</p>}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {isStudent && (isEditable || isImplementing) && (
                              <button
                                onClick={() => onToggleInterventionCompleted(String(i.id), Boolean(i.isCompleted))}
                                className={`p-1 rounded ${i.isCompleted ? "bg-green-100 text-green-600" : "hover:bg-gray-100 text-gray-400"}`}
                                data-tooltip={i.isCompleted ? "Mark as incomplete" : "Mark as completed"}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {isStudent && isEditable && (
                              <button
                                onClick={() => onRemoveIntervention(String(i.id))}
                                className="p-1 hover:bg-gray-100 rounded"
                                data-tooltip="Remove intervention"
                              >
                                <Trash2 size={14} className="text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* ─── Add Diagnosis Modal ────────────────────────────────────────────── */}
      <Modal open={showAddDiagnosis} onClose={() => setShowAddDiagnosis(false)} title="Add Nursing Diagnosis">
        <form onSubmit={diagnosisForm.handleSubmit(onAddDiagnosis)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NANDA Diagnosis *</label>
            <select {...diagnosisForm.register("diagnosisId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">-- Select Diagnosis --</option>
              {allDiagnoses.map((d: Record<string, unknown>) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {String(d.code)} - {String(d.name)}
                </option>
              ))}
            </select>
            {diagnosisForm.formState.errors.diagnosisId && (
              <p className="text-red-500 text-xs mt-1">{diagnosisForm.formState.errors.diagnosisId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type *</label>
            <select {...diagnosisForm.register("goalType")} className="w-full px-3 py-2 border rounded-lg">
              <option value="SHORT_TERM">Short-term (hours to days)</option>
              <option value="LONG_TERM">Long-term (weeks to discharge)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scientific Rationale</label>
            <textarea {...diagnosisForm.register("rationale")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="Why is this diagnosis appropriate for this patient? Reference pathophysiology..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Data / Evidence</label>
            <textarea {...diagnosisForm.register("evidence")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="Specific clinical data supporting this diagnosis..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddDiagnosis(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Diagnosis Modal ───────────────────────────────────────────── */}
      <Modal open={!!editingDiagnosis} onClose={() => { setEditingDiagnosis(null); diagnosisForm.reset(); }} title="Edit Diagnosis Details">
        <form onSubmit={diagnosisForm.handleSubmit(onUpdateDiagnosis)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
            <select {...diagnosisForm.register("goalType")} className="w-full px-3 py-2 border rounded-lg">
              <option value="SHORT_TERM">Short-term (hours to days)</option>
              <option value="LONG_TERM">Long-term (weeks to discharge)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scientific Rationale</label>
            <textarea {...diagnosisForm.register("rationale")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Data / Evidence</label>
            <textarea {...diagnosisForm.register("assessmentData")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditingDiagnosis(null); diagnosisForm.reset(); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Add Outcome Modal ──────────────────────────────────────────────── */}
      <Modal open={!!showAddOutcome} onClose={() => setShowAddOutcome(null)} title="Add Expected Outcome">
        <form onSubmit={outcomeForm.handleSubmit(onAddOutcome)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMART Outcome Description *</label>
            <textarea {...outcomeForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="Patient will [specific measurable action] within [timeframe] as evidenced by [criteria]..." />
            {outcomeForm.formState.errors.description && (
              <p className="text-red-500 text-xs mt-1">{outcomeForm.formState.errors.description.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
            <input {...outcomeForm.register("timeframe")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Within 24 hours, Before discharge" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Criteria</label>
            <textarea {...outcomeForm.register("criteria")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="How will you measure if the goal is met? (e.g. VS within normal limits, pain scale 0/10)" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddOutcome(null)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Add Intervention Modal ─────────────────────────────────────────── */}
      <Modal open={!!showAddIntervention} onClose={() => setShowAddIntervention(null)} title="Add Nursing Intervention">
        <form onSubmit={interventionForm.handleSubmit(onAddIntervention)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select {...interventionForm.register("category")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">-- Select Category --</option>
              {INTERVENTION_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ")}</option>
              ))}
            </select>
            {interventionForm.formState.errors.category && (
              <p className="text-red-500 text-xs mt-1">{interventionForm.formState.errors.category.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea {...interventionForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="What will the nurse do? Be specific and measurable..." />
            {interventionForm.formState.errors.description && (
              <p className="text-red-500 text-xs mt-1">{interventionForm.formState.errors.description.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scientific Rationale</label>
            <textarea {...interventionForm.register("rationale")} className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="Why is this intervention appropriate? Reference evidence-based practice..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <input {...interventionForm.register("frequency")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Every 4 hours, Q shift" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Time</label>
              <input {...interventionForm.register("expectedTime")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 15 minutes, 8:00 AM" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddIntervention(null)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Evaluate Outcome Modal ─────────────────────────────────────────── */}
      <Modal open={!!evaluatingOutcome} onClose={() => setEvaluatingOutcome(null)} title="Evaluate Outcome">
        <form onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const data = new FormData(form);
          onEvaluateOutcome({
            evaluationNotes: String(data.get("evaluationNotes") || ""),
            actualOutcome: String(data.get("actualOutcome") || ""),
          });
        }} className="space-y-4">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm font-medium">Expected Outcome:</p>
            <p className="text-sm text-gray-600">{evaluatingOutcome ? String(evaluatingOutcome.description) : ""}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Outcome *</label>
            <textarea name="actualOutcome" className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="What actually happened? Describe the patient's actual response..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Notes *</label>
            <textarea name="evaluationNotes" className="w-full px-3 py-2 border rounded-lg" rows={2}
              placeholder="Was the goal met? Partially met? Not met? Why?" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEvaluatingOutcome(null)}>Cancel</Button>
            <Button type="submit">Mark as Met</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Evaluate Care Plan Modal (Instructor) ──────────────────────────── */}
      <Modal open={showEvaluate} onClose={() => setShowEvaluate(false)} title={plan.status === "COMPLETED" ? "Reopen Care Plan" : "Evaluate Care Plan"}>
        <form onSubmit={evaluateForm.handleSubmit(onEvaluate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Decision *</label>
            <select {...evaluateForm.register("status")} className="w-full px-3 py-2 border rounded-lg">
              {evaluateOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {plan.status === "APPROVED"
                ? "Plan approved — mark as Completed once interventions are carried out and outcomes evaluated."
                : plan.status === "COMPLETED"
                ? "Plan completed — Reopen moves it back to Approved, or Return sends it back to the student for revision."
                : "Approve the plan content, or return it to the student for revision."}
            </p>
            {evaluateForm.formState.errors.status && (
              <p className="text-red-500 text-xs mt-1">{evaluateForm.formState.errors.status.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Notes *</label>
            <textarea {...evaluateForm.register("evaluationNotes")} className="w-full px-3 py-2 border rounded-lg" rows={4}
              placeholder="Provide detailed feedback on the care plan..." />
            {evaluateForm.formState.errors.evaluationNotes && (
              <p className="text-red-500 text-xs mt-1">{evaluateForm.formState.errors.evaluationNotes.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowEvaluate(false)}>Cancel</Button>
            <Button type="submit">Submit Evaluation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
