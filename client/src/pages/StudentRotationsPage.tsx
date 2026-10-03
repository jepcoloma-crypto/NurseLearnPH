import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clinicalRleApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal } from "@/components/shared";
import { Clock, BookOpen, Calendar, ChevronRight, Plus, Send, Pencil, Trash2, Award } from "lucide-react";
import { toast } from "react-hot-toast";

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StudentRotationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-rotations"],
    queryFn: () => clinicalRleApi.getMyRotations(),
  });

  const rotations = data?.data?.data ?? [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="My Clinical Rotations"
        subtitle="View your assigned rotations, track hours, and submit clinical logs"
      />

      {rotations.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Rotations Assigned</h3>
          <p className="text-sm text-gray-500">You are not currently assigned to any clinical rotations. Contact your instructor.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rotations.map((rotation: Record<string, unknown>) => (
            <RotationCard key={String(rotation.id)} rotation={rotation} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rotation Card ──────────────────────────────────────────────────────────

type RotationTab = "overview" | "attendance" | "logs";

function RotationCard({ rotation }: { rotation: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<RotationTab>("overview");

  const statusColor = rotation.status === "IN_PROGRESS" ? "success" : rotation.status === "COMPLETED" ? "info" : "default";
  const totalHours = Number(rotation.totalHours ?? 0);
  const requiredHours = Number(rotation.requiredHours ?? 120);
  const percentage = Number(rotation.percentage ?? 0);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{String(rotation.title)}</h3>
              <Badge variant={statusColor}>{String(rotation.status)}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span>{String(rotation.courseCode)} — {String(rotation.courseName)}</span>
              <span>🏥 {String(rotation.facility ?? "TBD")}</span>
              <span>🏨 {String(rotation.department ?? "TBD")}</span>
              <span>👨‍🏫 {String(rotation.instructorFirstName)} {String(rotation.instructorLastName)}</span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Calendar size={14} />
                {new Date(String(rotation.startDate)).toLocaleDateString()} — {new Date(String(rotation.endDate)).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock size={14} />
                {totalHours}/{requiredHours} hrs ({percentage}%)
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <BookOpen size={14} />
                {String(rotation.logCount ?? 0)} logs
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {rotation.status === "COMPLETED" && Boolean(rotation.studentCompletedAt) && (
              <Link
                to={`/rotations/${String(rotation.id)}/certificate`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-lg border border-primary-600 px-2.5 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Award size={14} /> Certificate
              </Link>
            )}
            {rotation.status === "COMPLETED" && !rotation.studentCompletedAt && (
              <span
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-400"
                title="Your instructor has not marked you as completed for this rotation yet"
              >
                Certificate pending
              </span>
            )}
            <ChevronRight size={20} className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 border-b">
            {(["overview", "attendance", "logs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "overview" ? "Overview" : t === "attendance" ? "Attendance" : "Clinical Logs"}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "overview" && <OverviewTab rotation={rotation} />}
            {tab === "attendance" && <StudentAttendanceTab rotationId={String(rotation.id)} />}
            {tab === "logs" && <StudentLogsTab rotationId={String(rotation.id)} rotationTitle={String(rotation.title)} />}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ rotation }: { rotation: Record<string, unknown> }) {
  const totalHours = Number(rotation.totalHours ?? 0);
  const requiredHours = Number(rotation.requiredHours ?? 120);
  const percentage = Number(rotation.percentage ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalHours}</div>
          <div className="text-sm text-gray-600">Hours Completed</div>
          <div className="text-xs text-gray-500 mt-1">of {requiredHours} required</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{String(rotation.logCount ?? 0)}</div>
          <div className="text-sm text-gray-600">Clinical Logs</div>
          <div className="text-xs text-gray-500 mt-1">submitted</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{percentage}%</div>
          <div className="text-sm text-gray-600">Progress</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${percentage >= 100 ? "bg-green-500" : percentage >= 75 ? "bg-blue-500" : percentage >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p><strong>Facility:</strong> {String(rotation.facility ?? "Not specified")}</p>
        <p><strong>Department:</strong> {String(rotation.department ?? "Not specified")}</p>
        {rotation.description ? <p><strong>Description:</strong> {String(rotation.description)}</p> : null}
      </div>
    </div>
  );
}

// ─── Student Attendance Tab ─────────────────────────────────────────────────

function StudentAttendanceTab({ rotationId }: { rotationId: string }) {
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ["rotation-attendance", rotationId],
    queryFn: () => clinicalRleApi.listAttendance(rotationId),
  });

  const attendance = attendanceData?.data?.data ?? [];

  if (isLoading) return <LoadingSpinner />;

  if (attendance.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">No attendance records yet.</p>;
  }

  // Group by date
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  attendance.forEach((r: Record<string, unknown>) => {
    const d = new Date(String(r.date)).toLocaleDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(r);
  });

  const statusColors: Record<string, string> = {
    PRESENT: "text-green-600 bg-green-50",
    ABSENT: "text-red-600 bg-red-50",
    LATE: "text-yellow-600 bg-yellow-50",
    EXCUSED: "text-blue-600 bg-blue-50",
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([date, records]) => (
        <div key={date}>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">{date}</h4>
          <div className="divide-y border rounded-lg">
            {records.map((r) => (
              <div key={String(r.id)} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[String(r.status)] ?? "bg-gray-100 text-gray-600"}`}>
                    {String(r.status)}
                  </span>
                  {r.notes ? <span className="text-xs text-gray-500 ml-2">— {String(r.notes)}</span> : null}
                </div>
                <span className="text-sm font-medium text-gray-700">{String(r.hoursLogged)} hrs</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Student Logs Tab ───────────────────────────────────────────────────────

function StudentLogsTab({ rotationId, rotationTitle: _rotationTitle }: { rotationId: string; rotationTitle: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editLog, setEditLog] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ["rotation-logs", rotationId],
    queryFn: () => clinicalRleApi.listRotationLogs(rotationId),
  });

  const logs = logsData?.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalRleApi.deleteClinicalLog(id),
    onSuccess: () => {
      toast.success("Clinical log deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["rotation-logs", rotationId] });
      queryClient.invalidateQueries({ queryKey: ["my-rotations"] });
    },
    onError: () => toast.error("Failed to delete clinical log"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700">Your Clinical Logs</h4>
        <Button size="sm" onClick={() => { setEditLog(null); setShowForm(true); }}><Plus size={14} className="mr-1" /> New Log</Button>
      </div>

      {isLoading ? <LoadingSpinner /> : logs.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No clinical logs submitted yet. Click "New Log" to submit your first entry.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log: Record<string, unknown>) => (
            <Card key={String(log.id)} className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(String(log.date)).toLocaleDateString()}
                  </span>
                  {log.patientCount ? <span className="text-xs text-gray-500 ml-2">{String(log.patientCount)} patients</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  {String(log.status ?? (log.reviewedAt ? "REVIEWED" : "SUBMITTED")) === "REVIEWED" ? (
                    <Badge variant="success">Reviewed</Badge>
                  ) : (
                    <Badge variant="default">Pending Review</Badge>
                  )}
                  {String(log.status ?? (log.reviewedAt ? "REVIEWED" : "SUBMITTED")) === "SUBMITTED" && (
                    <>
                      <button onClick={() => { setEditLog(log); setShowForm(true); }} className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setDeleteTarget(log)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                        <Trash2 size={12} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              {Array.isArray(log.procedures) && log.procedures.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500">Procedures: </span>
                  <span className="text-xs text-gray-700">{(log.procedures as string[]).join(", ")}</span>
                </div>
              )}
              {log.reflections ? (
                <div className="mb-1">
                  <span className="text-xs font-medium text-gray-500">Reflections: </span>
                  <span className="text-xs text-gray-700">{String(log.reflections)}</span>
                </div>
              ) : null}
              {log.challenges ? (
                <div className="mb-1">
                  <span className="text-xs font-medium text-gray-500">Challenges: </span>
                  <span className="text-xs text-gray-700">{String(log.challenges)}</span>
                </div>
              ) : null}
              {log.feedback ? (
                <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
                  <strong>Instructor Feedback:</strong> {String(log.feedback)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Modal open={showForm} onClose={() => { setShowForm(false); setEditLog(null); }} title={editLog ? "Edit Clinical Log" : "Submit Clinical Log"}>
          <ClinicalLogForm
            rotationId={rotationId}
            initial={editLog}
            onSuccess={() => {
              setShowForm(false);
              setEditLog(null);
              queryClient.invalidateQueries({ queryKey: ["rotation-logs", rotationId] });
              queryClient.invalidateQueries({ queryKey: ["my-rotations"] });
            }}
            onCancel={() => { setShowForm(false); setEditLog(null); }}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal open={true} onClose={() => setDeleteTarget(null)} title="Delete Clinical Log">
          <p className="text-sm text-gray-600">
            Delete your log for {new Date(String(deleteTarget.date)).toLocaleDateString()}? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={() => deleteMutation.mutate(String(deleteTarget.id))} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Clinical Log Form ──────────────────────────────────────────────────────

function ClinicalLogForm({ rotationId, initial, onSuccess, onCancel }: {
  rotationId: string;
  initial?: Record<string, unknown> | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial ? new Date(String(initial.date)).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [patientCount, setPatientCount] = useState(initial ? Number(initial.patientCount ?? 0) : 0);
  const [proceduresText, setProceduresText] = useState(initial && Array.isArray(initial.procedures) ? (initial.procedures as string[]).join(", ") : "");
  const [reflections, setReflections] = useState(initial?.reflections ? String(initial.reflections) : "");
  const [challenges, setChallenges] = useState(initial?.challenges ? String(initial.challenges) : "");
  const [learningOutcomes, setLearningOutcomes] = useState(initial?.learningOutcomes ? String(initial.learningOutcomes) : "");

  const isEdit = Boolean(initial);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? clinicalRleApi.updateClinicalLog(String(initial!.id), data) : clinicalRleApi.createClinicalLog(data),
    onSuccess: () => {
      toast.success(isEdit ? "Clinical log updated" : "Clinical log submitted");
      onSuccess();
    },
    onError: () => toast.error("Failed to save clinical log"),
  });

  const handleSubmit = () => {
    if (!date || !reflections.trim()) {
      toast.error("Date and reflections are required");
      return;
    }
    const procedures = proceduresText.split(",").map((p) => p.trim()).filter(Boolean);
    mutation.mutate({
      rotationId,
      date: new Date(date).toISOString(),
      patientCount,
      procedures: procedures.length > 0 ? procedures : undefined,
      reflections: reflections.trim(),
      challenges: challenges.trim() || undefined,
      learningOutcomes: learningOutcomes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Patients</label>
          <input type="number" min={0} value={patientCount} onChange={(e) => setPatientCount(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Procedures Performed (comma-separated)</label>
        <input value={proceduresText} onChange={(e) => setProceduresText(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Wound dressing, IV insertion, Catheterization" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reflections *</label>
        <textarea value={reflections} onChange={(e) => setReflections(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="What did you learn today? How did you feel about your performance?" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Challenges</label>
        <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="What challenges did you encounter?" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Learning Outcomes</label>
        <textarea value={learningOutcomes} onChange={(e) => setLearningOutcomes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="What specific skills or knowledge did you gain?" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          <Send size={14} className="mr-1" /> {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Submit Log"}
        </Button>
      </div>
    </div>
  );
}
