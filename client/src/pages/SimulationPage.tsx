import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { simulationApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal, EmptyState } from "@/components/shared";
import { Play, User, Pencil, Plus, CheckCircle, Clock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const patientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().int().min(0, "Age is required"),
  gender: z.string().min(1, "Gender is required"),
  chiefComplaint: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
});
type PatientFormData = z.infer<typeof patientSchema>;

const scenarioSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  timeLimitMinutes: z.coerce.number().int().min(1).default(30),
  maxScore: z.coerce.number().int().min(1).default(100),
  initialVitalSignsHR: z.string().optional(),
  initialVitalSignsBP: z.string().optional(),
  initialVitalSignsTemp: z.string().optional(),
  initialVitalSignsResp: z.string().optional(),
  initialSymptoms: z.string().optional(),
  initialConsciousness: z.enum(["ALERT", "CONFUSED", "UNRESPONSIVE"]),
});
type ScenarioFormData = z.infer<typeof scenarioSchema>;

function parseJsonArray(val: unknown): string[] | null {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string" && val.trim()) return val.split(",").map((s) => s.trim()).filter(Boolean);
  return null;
}

function diffBadge(d: string) {
  const m: Record<string, "success" | "warning" | "danger"> = { EASY: "success", MEDIUM: "warning", HARD: "danger" };
  return m[d] || "default";
}

export default function SimulationPage() {
  const { can } = usePermissions();
  const canManage = can("simulation.manage");
  const canStart = can("simulation.start");

  const [showPatientModal, setShowPatientModal] = useState(false);
  const [editPatient, setEditPatient] = useState<Record<string, unknown> | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showScenarioSelect, setShowScenarioSelect] = useState<string | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientPage, setPatientPage] = useState(1);
  const [scenarioPage, setScenarioPage] = useState(1);

  const { data: patientsRes, isLoading: loadingP, refetch: refetchPatients } = useQuery({
    queryKey: ["patients", patientPage],
    queryFn: () => simulationApi.listPatients({ page: String(patientPage), limit: "15" }),
  });
  const { data: scenariosRes, isLoading: loadingS, refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios", scenarioPage],
    queryFn: () => simulationApi.listScenarios({ page: String(scenarioPage), limit: "15" }),
  });
  const { data: allPatientsRes } = useQuery({
    queryKey: ["patients-all"],
    queryFn: () => simulationApi.listPatients({ limit: "100" }),
  });

  const patientList = patientsRes?.data?.data?.items ?? [];
  const patientPagination = patientsRes?.data?.data?.pagination;
  const scenarioList = scenariosRes?.data?.data?.items ?? [];
  const scenarioPagination = scenariosRes?.data?.data?.pagination;
  const allPatients = allPatientsRes?.data?.data?.items ?? [];

  const patientForm = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: { gender: "Male" },
  });

  const scenarioForm = useForm({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      difficulty: "MEDIUM" as const,
      timeLimitMinutes: 30,
      maxScore: 100,
      initialConsciousness: "ALERT" as const,
    },
  });

  const createPatientMut = useMutation({
    mutationFn: (data: PatientFormData) => simulationApi.createPatient({
      name: data.name,
      age: data.age,
      gender: data.gender,
      chiefComplaint: data.chiefComplaint || null,
      medicalHistory: parseJsonArray(data.medicalHistory),
      allergies: parseJsonArray(data.allergies),
      currentMedications: parseJsonArray(data.currentMedications),
    }),
    onSuccess: () => {
      toast.success("Patient created");
      setShowPatientModal(false);
      patientForm.reset();
      refetchPatients();
    },
    onError: () => toast.error("Failed to create patient"),
  });

  const updatePatientMut = useMutation({
    mutationFn: (data: PatientFormData) => simulationApi.updatePatient(String(editPatient?.id), {
      name: data.name,
      age: data.age,
      gender: data.gender,
      chiefComplaint: data.chiefComplaint || null,
      medicalHistory: parseJsonArray(data.medicalHistory),
      allergies: parseJsonArray(data.allergies),
      currentMedications: parseJsonArray(data.currentMedications),
    }),
    onSuccess: () => {
      toast.success("Patient updated");
      setEditPatient(null);
      patientForm.reset();
      refetchPatients();
    },
    onError: () => toast.error("Failed to update patient"),
  });

  const deletePatientMut = useMutation({
    mutationFn: (id: string) => simulationApi.deletePatient(id),
    onSuccess: () => {
      toast.success("Patient deleted");
      refetchPatients();
    },
    onError: () => toast.error("Failed to delete patient. Remove scenarios first."),
  });

  const createScenarioMut = useMutation({
    mutationFn: (data: ScenarioFormData) => {
      const vitalSigns: Record<string, string> = {};
      if (data.initialVitalSignsHR) vitalSigns.hr = data.initialVitalSignsHR;
      if (data.initialVitalSignsBP) vitalSigns.bp = data.initialVitalSignsBP;
      if (data.initialVitalSignsTemp) vitalSigns.temp = data.initialVitalSignsTemp;
      if (data.initialVitalSignsResp) vitalSigns.resp = data.initialVitalSignsResp;
      return simulationApi.createScenario({
        patientId: data.patientId,
        title: data.title,
        description: data.description || null,
        category: data.category,
        difficulty: data.difficulty,
        timeLimitMinutes: data.timeLimitMinutes,
        maxScore: data.maxScore,
        initialVitalSigns: vitalSigns,
        initialSymptoms: parseJsonArray(data.initialSymptoms) || [],
        initialConsciousness: data.initialConsciousness,
      });
    },
    onSuccess: () => {
      toast.success("Scenario created");
      setShowScenarioModal(false);
      scenarioForm.reset();
      refetchScenarios();
    },
    onError: () => toast.error("Failed to create scenario"),
  });

  const deleteScenarioMut = useMutation({
    mutationFn: (id: string) => simulationApi.deleteScenario(id),
    onSuccess: () => {
      toast.success("Scenario deleted");
      refetchScenarios();
    },
    onError: () => toast.error("Failed to delete scenario"),
  });

  const startSessionMut = useMutation({
    mutationFn: (scenarioId: string) => simulationApi.startSession({ scenarioId }),
    onSuccess: (res) => {
      setSessionId(res.data.data.id);
      setShowSession(true);
      setShowScenarioSelect(null);
      toast.success("Simulation started!");
    },
    onError: () => toast.error("Failed to start simulation"),
  });

  const openEditPatient = (p: Record<string, unknown>) => {
    setEditPatient(p);
    patientForm.reset({
      name: String(p.name || ""),
      age: Number(p.age || 0),
      gender: String(p.gender || "Male"),
      chiefComplaint: String(p.chiefComplaint || ""),
      medicalHistory: Array.isArray(p.medicalHistory) ? (p.medicalHistory as string[]).join(", ") : String(p.medicalHistory || ""),
      allergies: Array.isArray(p.allergies) ? (p.allergies as string[]).join(", ") : String(p.allergies || ""),
      currentMedications: Array.isArray(p.currentMedications) ? (p.currentMedications as string[]).join(", ") : String(p.currentMedications || ""),
    });
  };

  const openScenarioForPatient = (patientId: string) => {
    setShowScenarioSelect(patientId);
  };

  const patientScenariosFor = (patientId: string) =>
    scenarioList.filter((s: Record<string, unknown>) => s.patientId === patientId);

  const getPatientName = (patientId: string) => {
    const p = allPatients.find((pp: Record<string, unknown>) => String(pp.id) === patientId);
    return p ? String(p.name) : "Unknown";
  };

  if (loadingP || loadingS) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Virtual Patient Simulation"
        subtitle="Practice clinical reasoning with virtual patients"
        actions={
          canManage ? (
            <Button onClick={() => { setEditPatient(null); patientForm.reset({ gender: "Male" }); setShowPatientModal(true); }}>
              <Plus size={16} /> Add Patient
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Virtual Patients</h2>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={() => { scenarioForm.reset({ difficulty: "MEDIUM", timeLimitMinutes: 30, maxScore: 100, initialConsciousness: "ALERT" }); setShowScenarioModal(true); }}>
                <Plus size={14} /> Add Scenario
              </Button>
            )}
          </div>
          {patientList.length === 0 ? (
            <EmptyState title="No patients yet" description="Create a virtual patient to get started" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {patientList.map((p: Record<string, unknown>) => (
                  <Card key={String(p.id)}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <User size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{String(p.name)}</h3>
                          {p.isActive === false && <Badge variant="warning">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-gray-500">Age {String(p.age)} · {String(p.gender)}</p>
                        {typeof p.chiefComplaint === "string" && p.chiefComplaint && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.chiefComplaint}</p>
                        )}
                        {Array.isArray(p.allergies) && (p.allergies as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(p.allergies as string[]).slice(0, 3).map((a) => (
                              <span key={a} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded">{a}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {canStart && (
                            <Button size="sm" onClick={() => openScenarioForPatient(String(p.id))} disabled={startSessionMut.isPending}>
                              <Play size={12} /> Start
                            </Button>
                          )}
                          {canManage && (
                            <Button size="sm" variant="ghost" onClick={() => openEditPatient(p)}>
                              <Pencil size={12} /> Edit
                            </Button>
                          )}
                          {canManage && (
                            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Delete patient "${String(p.name)}"?`)) deletePatientMut.mutate(String(p.id)); }} disabled={deletePatientMut.isPending}>
                              <Trash2 size={12} /> Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {patientPagination && patientPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-gray-500">Page {patientPage} of {patientPagination.totalPages} ({patientPagination.total} total)</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPatientPage((p) => p - 1)} disabled={patientPage <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setPatientPage((p) => p + 1)} disabled={patientPage >= patientPagination.totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Scenarios</h2>
          {scenarioList.length === 0 ? (
            <EmptyState title="No scenarios yet" description="Create a scenario for a virtual patient" />
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">Patient</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">Difficulty</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Time</th>
                      {canManage && <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scenarioList.map((s: Record<string, unknown>) => (
                      <tr key={String(s.id)} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{String(s.title)}</td>
                        <td className="px-4 py-3 text-gray-500">{getPatientName(String(s.patientId))}</td>
                        <td className="px-4 py-3">
                          <Badge variant={diffBadge(String(s.difficulty))}>{String(s.difficulty)}</Badge>
                        </td>
                        <td className="px-4 py-3">{String(s.category)}</td>
                        <td className="px-4 py-3">{s.timeLimitMinutes ? `${s.timeLimitMinutes}m` : "-"}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => { if (window.confirm(`Delete scenario "${String(s.title)}"?`)) deleteScenarioMut.mutate(String(s.id)); }}
                              className="p-1 text-gray-400 hover:text-red-600"
                              disabled={deleteScenarioMut.isPending}
                              data-tooltip="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scenarioPagination && scenarioPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-gray-500">Page {scenarioPage} of {scenarioPagination.totalPages} ({scenarioPagination.total} total)</p>
                  <div className="flex gap-1">
                    <button onClick={() => setScenarioPage((p) => p - 1)} disabled={scenarioPage <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setScenarioPage((p) => p + 1)} disabled={scenarioPage >= scenarioPagination.totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={showPatientModal || !!editPatient} onClose={() => { setShowPatientModal(false); setEditPatient(null); patientForm.reset(); }} title={editPatient ? "Edit Patient" : "Add Patient"}>
        <form onSubmit={patientForm.handleSubmit((d: PatientFormData) => editPatient ? updatePatientMut.mutate(d) : createPatientMut.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...patientForm.register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Maria Santos" />
            {patientForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{patientForm.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input type="number" {...patientForm.register("age")} className="w-full px-3 py-2 border rounded-lg" />
              {patientForm.formState.errors.age && <p className="text-red-500 text-xs mt-1">{patientForm.formState.errors.age.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select {...patientForm.register("gender")} className="w-full px-3 py-2 border rounded-lg">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
            <textarea {...patientForm.register("chiefComplaint")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical History (comma-separated)</label>
            <input {...patientForm.register("medicalHistory")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Hypertension, Diabetes" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allergies (comma-separated)</label>
            <input {...patientForm.register("allergies")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Penicillin, Aspirin" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications (comma-separated)</label>
            <input {...patientForm.register("currentMedications")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Metformin, Lisinopril" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowPatientModal(false); setEditPatient(null); patientForm.reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createPatientMut.isPending || updatePatientMut.isPending}>{editPatient ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showScenarioModal} onClose={() => setShowScenarioModal(false)} title="Add Scenario">
        <form onSubmit={scenarioForm.handleSubmit((d: Record<string, unknown>) => createScenarioMut.mutate(d as ScenarioFormData))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select {...scenarioForm.register("patientId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select patient</option>
              {allPatients.map((p: Record<string, unknown>) => (
                <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
              ))}
            </select>
            {scenarioForm.formState.errors.patientId && <p className="text-red-500 text-xs mt-1">{scenarioForm.formState.errors.patientId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...scenarioForm.register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Acute Coronary Syndrome" />
            {scenarioForm.formState.errors.title && <p className="text-red-500 text-xs mt-1">{scenarioForm.formState.errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...scenarioForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input {...scenarioForm.register("category")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Emergency" />
              {scenarioForm.formState.errors.category && <p className="text-red-500 text-xs mt-1">{scenarioForm.formState.errors.category.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select {...scenarioForm.register("difficulty")} className="w-full px-3 py-2 border rounded-lg">
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
              <input type="number" {...scenarioForm.register("timeLimitMinutes")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
              <input type="number" {...scenarioForm.register("maxScore")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Vital Signs</label>
            <div className="grid grid-cols-2 gap-3">
              <input {...scenarioForm.register("initialVitalSignsHR")} className="px-3 py-2 border rounded-lg" placeholder="HR (e.g. 88 bpm)" />
              <input {...scenarioForm.register("initialVitalSignsBP")} className="px-3 py-2 border rounded-lg" placeholder="BP (e.g. 130/85 mmHg)" />
              <input {...scenarioForm.register("initialVitalSignsTemp")} className="px-3 py-2 border rounded-lg" placeholder="Temp (e.g. 37.2 C)" />
              <input {...scenarioForm.register("initialVitalSignsResp")} className="px-3 py-2 border rounded-lg" placeholder="Resp (e.g. 18 bpm)" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Symptoms (comma-separated)</label>
            <input {...scenarioForm.register("initialSymptoms")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Chest pain, Shortness of breath" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Consciousness</label>
            <select {...scenarioForm.register("initialConsciousness")} className="w-full px-3 py-2 border rounded-lg">
              <option value="ALERT">Alert</option>
              <option value="CONFUSED">Confused</option>
              <option value="UNRESPONSIVE">Unresponsive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowScenarioModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createScenarioMut.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showScenarioSelect} onClose={() => setShowScenarioSelect(null)} title="Select Scenario">
        {showScenarioSelect && (() => {
          const filtered = patientScenariosFor(showScenarioSelect);
          return filtered.length === 0 ? (
            <EmptyState title="No scenarios for this patient" description="Create a scenario first" />
          ) : (
            <div className="space-y-2">
              {filtered.map((s: Record<string, unknown>) => (
                <button
                  key={String(s.id)}
                  onClick={() => startSessionMut.mutate(String(s.id))}
                  disabled={startSessionMut.isPending}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{String(s.title)}</h4>
                      <p className="text-sm text-gray-500">{String(s.category)} · {s.timeLimitMinutes ? `${s.timeLimitMinutes}m` : ""}</p>
                    </div>
                    <Badge variant={diffBadge(String(s.difficulty))}>{String(s.difficulty)}</Badge>
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </Modal>

      {showSession && sessionId && <SessionModal sessionId={sessionId} onClose={() => { setShowSession(false); setSessionId(null); }} />}
    </div>
  );
}

function SessionModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: sessionRes, isLoading, refetch } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => simulationApi.getSession(sessionId),
    refetchInterval: false,
  });

  const { data: actionsRes } = useQuery({
    queryKey: ["nursingActions"],
    queryFn: () => simulationApi.listActions(),
  });

  const performActionMut = useMutation({
    mutationFn: ({ actionId, notes }: { actionId: string; notes?: string }) =>
      simulationApi.performAction(sessionId, { actionId, notes }),
    onSuccess: (res) => {
      toast.success(`Action performed! +${res.data.data.pointsAwarded} points`);
      setLastResponse(res.data.data);
      refetch();
    },
    onError: () => toast.error("Failed to perform action"),
  });

  const completeMut = useMutation({
    mutationFn: () => simulationApi.completeSession(sessionId),
    onSuccess: () => {
      toast.success("Session completed!");
      refetch();
    },
    onError: () => toast.error("Failed to complete session"),
  });

  const [lastResponse, setLastResponse] = useState<{ pointsAwarded: number; response: string; feedback?: string } | null>(null);

  const session = sessionRes?.data?.data;
  const actions = (actionsRes?.data?.data ?? []) as Record<string, unknown>[];

  const vitals = session?.currentVitalSigns as Record<string, string> | null;
  const symptoms = Array.isArray(session?.currentSymptoms) ? (session.currentSymptoms as string[]) : [];
  const performedActions = Array.isArray(session?.actions) ? (session.actions as Record<string, unknown>[]) : [];

  const groupedActions: Record<string, Record<string, unknown>[]> = {};
  actions.forEach((a) => {
    const cat = String(a.category || "Other");
    if (!groupedActions[cat]) groupedActions[cat] = [];
    groupedActions[cat].push(a);
  });

  const findActionName = (actionId: string) => {
    const found = actions.find((a) => String(a.id) === actionId);
    return found ? String(found.name) : actionId;
  };

  const consciousnessLabel = (c: string) => {
    if (c === "CONFUSED") return <Badge variant="warning">Confused</Badge>;
    if (c === "UNRESPONSIVE") return <Badge variant="danger">Unresponsive</Badge>;
    return <Badge variant="success">Alert</Badge>;
  };

  const statusLabel = (s: string) => {
    if (s === "COMPLETED") return <Badge variant="success">Completed</Badge>;
    if (s === "IN_PROGRESS") return <Badge variant="info">In Progress</Badge>;
    return <Badge>{s}</Badge>;
  };

  return (
    <Modal open onClose={onClose} title="Simulation Session" >
      {isLoading ? <LoadingSpinner /> : !session ? (
        <p className="text-gray-500 text-sm">Session not found.</p>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <User size={18} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Scenario {String(session.scenarioId).slice(0, 8)}...</h4>
                <p className="text-xs text-gray-500">Status: {statusLabel(String(session.status))}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">{session.score ?? 0}</p>
              <p className="text-xs text-gray-500">points</p>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Deterioration Level</h4>
              <span className="text-sm font-medium">{session.deteriorationLevel ?? 0}/10</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${(session.deteriorationLevel ?? 0) > 7 ? "bg-red-500" : (session.deteriorationLevel ?? 0) > 4 ? "bg-yellow-500" : "bg-green-500"}`}
                style={{ width: `${((session.deteriorationLevel ?? 0) / 10) * 100}%` }}
              />
            </div>
          </div>

          {vitals && (
            <div>
              <h4 className="text-sm font-medium mb-2">Vital Signs</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(vitals).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 p-2 bg-white border rounded-lg text-sm">
                    <span className="font-medium text-gray-600 uppercase">{k}:</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {symptoms.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Symptoms</h4>
              <div className="flex flex-wrap gap-2">
                {symptoms.map((s) => (
                  <span key={s} className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Consciousness Level: {consciousnessLabel(String(session.currentConsciousness || "ALERT"))}</h4>
          </div>

          {lastResponse && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-green-800 font-medium">Patient Response (+{lastResponse.pointsAwarded} pts)</p>
                  <p className="text-sm text-green-700 mt-1">{lastResponse.response}</p>
                  {lastResponse.feedback && <p className="text-xs text-green-600 mt-1 italic">{lastResponse.feedback}</p>}
                </div>
              </div>
            </div>
          )}

          {session.status === "IN_PROGRESS" && Object.keys(groupedActions).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Nursing Actions</h4>
              <div className="space-y-3">
                {Object.entries(groupedActions).map(([category, catActions]) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {catActions.map((a) => (
                        <button
                          key={String(a.id)}
                          onClick={() => performActionMut.mutate({ actionId: String(a.id) })}
                          disabled={performActionMut.isPending}
                          className="px-2.5 py-1 text-xs bg-white border border-gray-200 hover:border-primary-400 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          {String(a.name)}
                          {typeof a.points === "number" && <span className="text-gray-400 ml-1">({a.points}pt)</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {performedActions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Action History ({performedActions.length})</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {performedActions.map((pa, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium">{findActionName(String(pa.actionId))}</span>
                    <div className="flex items-center gap-2">
                      {typeof pa.notes === "string" && pa.notes && <span className="text-gray-400 italic truncate max-w-[100px]">{pa.notes}</span>}
                      <span className="text-green-600 font-medium">+{String(pa.pointsAwarded ?? 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            {session.status === "IN_PROGRESS" ? (
              <>
                <Button variant="secondary" onClick={onClose}><span className="text-xs">Close</span></Button>
                <Button variant="danger" onClick={() => { if (window.confirm("Complete this session?")) completeMut.mutate(); }} disabled={completeMut.isPending}>
                  <CheckCircle size={14} /> Complete Session
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {session.timeSpentSeconds && (
                    <span className="flex items-center gap-1"><Clock size={14} /> {Math.floor(session.timeSpentSeconds / 60)}m {session.timeSpentSeconds % 60}s</span>
                  )}
                </div>
                <Button onClick={onClose}>Close</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
