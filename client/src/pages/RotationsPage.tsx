import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clinicalRleApi, academicApi, usersApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal, Card } from "@/components/shared";
import { Plus, Pencil, Trash2, Users, Eye, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  instructorId: z.string().min(1, "Instructor is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  facility: z.string().optional(),
  department: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  requiredHours: z.coerce.number().int().min(1),
  maxStudents: z.coerce.number().int().min(1),
});
type FormData = z.infer<typeof schema>;

export default function RotationsPage() {
  const { can } = usePermissions();
  const canCreate = can("rotations.create");
  const canEdit = can("rotations.edit");
  const canDelete = can("rotations.delete");
  const canManage = canCreate || canEdit;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [managingStudents, setManagingStudents] = useState<Record<string, unknown> | null>(null);
  const [completing, setCompleting] = useState<Record<string, unknown> | null>(null);
  const [viewingRotation, setViewingRotation] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rotations", page],
    queryFn: () => clinicalRleApi.listRotations({ page: String(page), limit: "15" }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses-for-rotations"],
    queryFn: () => academicApi.listCourses({ limit: "100" }),
  });

  const { data: instructorsData } = useQuery({
    queryKey: ["instructors-for-rotations"],
    queryFn: () => usersApi.list({ role: "INSTRUCTOR", limit: "100" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalRleApi.createRotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotations"] });
      toast.success("Rotation created");
      setShowCreate(false);
    },
    onError: () => toast.error("Failed to create rotation"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => clinicalRleApi.updateRotation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotations"] });
      toast.success("Rotation updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update rotation"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalRleApi.deleteRotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotations"] });
      toast.success("Rotation deleted");
    },
    onError: () => toast.error("Failed to delete rotation"),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courses = coursesData?.data?.data?.items ?? [];
  const instructors = instructorsData?.data?.data?.items ?? [];

  const handleDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this rotation?")) return;
    deleteMutation.mutate(String(item.id));
  };

  return (
    <div>
      <PageHeader
        title="Clinical Rotations"
        subtitle="Manage clinical rotation schedules and assignments"
        actions={canCreate ? <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Rotation</Button> : undefined}
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "title", label: "Title" },
            { key: "courseCode", label: "Course", render: (row) => (
              <span className="text-sm">{String(row.courseCode ?? "")} — {String(row.courseName ?? "")}</span>
            )},
            { key: "instructorLastName", label: "Instructor", render: (row) => (
              <span className="text-sm">{String(row.instructorFirstName ?? "")} {String(row.instructorLastName ?? "")}</span>
            )},
            { key: "facility", label: "Facility", render: (row) => (
              <span className="text-sm">{String(row.facility ?? "—")}</span>
            )},
            { key: "department", label: "Department", render: (row) => (
              <span className="text-sm">{String(row.department ?? "—")}</span>
            )},
            { key: "startDate", label: "Start", render: (row) => (
              <span className="text-sm">{new Date(String(row.startDate)).toLocaleDateString()}</span>
            )},
            { key: "endDate", label: "End", render: (row) => (
              <span className="text-sm">{new Date(String(row.endDate)).toLocaleDateString()}</span>
            )},
            { key: "maxStudents", label: "Max" },
            { key: "status", label: "Status", render: (row) => (
              <Badge variant={
                row.status === "IN_PROGRESS" ? "success" :
                row.status === "COMPLETED" ? "info" :
                row.status === "CANCELLED" ? "danger" : "default"
              }>
                {String(row.status)}
              </Badge>
            )},
            {
              key: "actions",
              label: "Actions",
              render: (item: Record<string, unknown>) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewingRotation(item)} title="View Details">
                    <Eye size={14} />
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => setManagingStudents(item)} title="Manage Students">
                      <Users size={14} />
                    </Button>
                  )}
                  {canEdit && item.status !== "CANCELLED" && (
                    <Button size="sm" variant="ghost" onClick={() => setCompleting(item)} title={item.status === "COMPLETED" ? "Manage Student Completion" : "Mark as Completed"}>
                      <CheckCircle2 size={14} />
                    </Button>
                  )}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}><Pencil size={14} /></Button>}
                  {canDelete && <Button size="sm" variant="ghost" onClick={() => handleDelete(item)}><Trash2 size={14} /></Button>}
                </div>
              ),
            },
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Rotation">
        <RotationForm
          courses={courses}
          instructors={instructors}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Rotation">
        {editItem && (
          <RotationForm
            courses={courses}
            instructors={instructors}
            defaultValues={{
              courseId: String(editItem.courseId ?? ""),
              instructorId: String(editItem.instructorId ?? ""),
              title: String(editItem.title ?? ""),
              description: String(editItem.description ?? ""),
              facility: String(editItem.facility ?? ""),
              department: String(editItem.department ?? ""),
              startDate: editItem.startDate ? new Date(String(editItem.startDate)).toISOString().split("T")[0] : "",
              endDate: editItem.endDate ? new Date(String(editItem.endDate)).toISOString().split("T")[0] : "",
              requiredHours: Number(editItem.requiredHours ?? 120),
              maxStudents: Number(editItem.maxStudents ?? 20),
            }}
            onSubmit={(data) => updateMutation.mutate({ id: String(editItem.id), data })}
            isPending={updateMutation.isPending}
            onCancel={() => setEditItem(null)}
          />
        )}
      </Modal>

      {/* Student Management Modal */}
      {managingStudents && (
        <StudentManagementModal
          rotation={managingStudents}
          onClose={() => setManagingStudents(null)}
          canManage={canManage}
        />
      )}

      {/* Complete Rotation Modal */}
      {completing && (
        <CompleteRotationModal rotation={completing} onClose={() => setCompleting(null)} />
      )}

      {/* Rotation Detail / Attendance Modal */}
      {viewingRotation && (
        <RotationDetailModal
          rotation={viewingRotation}
          onClose={() => setViewingRotation(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

// ─── Student Management Modal ──────────────────────────────────────────────

function StudentManagementModal({ rotation, onClose, canManage }: {
  rotation: Record<string, unknown>;
  onClose: () => void;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const rotationId = String(rotation.id);
  const maxStudents = Number(rotation.maxStudents ?? 20);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["rotation-students", rotationId],
    queryFn: () => clinicalRleApi.listRotationStudents(rotationId),
  });

  const { data: enrolledData } = useQuery({
    queryKey: ["enrolled-students", rotation.courseId],
    queryFn: () => usersApi.list({ role: "STUDENT", limit: "200" }),
    enabled: canManage,
  });

  const assignMutation = useMutation({
    mutationFn: (studentIds: string[]) => clinicalRleApi.assignStudentsToRotation(rotationId, studentIds),
    onSuccess: (res) => {
      const count = res?.data?.data?.assigned ?? 0;
      toast.success(`${count} student(s) assigned`);
      queryClient.invalidateQueries({ queryKey: ["rotation-students", rotationId] });
    },
    onError: () => toast.error("Failed to assign students"),
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => clinicalRleApi.removeStudentFromRotation(rotationId, studentId),
    onSuccess: () => {
      toast.success("Student removed");
      queryClient.invalidateQueries({ queryKey: ["rotation-students", rotationId] });
    },
    onError: () => toast.error("Failed to remove student"),
  });

  const assignedStudents = studentsData?.data?.data ?? [];
  const allStudents = enrolledData?.data?.data?.items ?? [];
  const assignedIds = new Set(assignedStudents.map((s: Record<string, unknown>) => s.studentId));
  const availableStudents = allStudents.filter((s: Record<string, unknown>) => !assignedIds.has(s.id));
  const slotsLeft = maxStudents - assignedStudents.length;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = () => {
    if (selectedIds.size === 0) return;
    assignMutation.mutate(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <Modal open={true} onClose={onClose} title={`Students: ${String(rotation.title ?? "")}`}>
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Assigned: <strong>{assignedStudents.length}</strong>/{maxStudents}</span>
          <span>Available slots: <strong className={slotsLeft <= 0 ? "text-red-600" : "text-green-600"}>{slotsLeft}</strong></span>
        </div>

        {/* Assigned Students */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Students</h4>
          {isLoading ? <LoadingSpinner /> : assignedStudents.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No students assigned yet.</p>
          ) : (
            <div className="divide-y border rounded-lg">
              {assignedStudents.map((s: Record<string, unknown>) => (
                <div key={String(s.studentId)} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <Link to={`/students/${String(s.studentId)}/profile`} className="font-medium text-primary-600 hover:underline">{String(s.firstName)} {String(s.lastName)}</Link>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-xs text-gray-500">{String(s.email)}</span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${String(s.firstName)} ${String(s.lastName)} from this rotation?`)) {
                          removeMutation.mutate(String(s.studentId));
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Students (Coordinator/Instructor only) */}
        {canManage && slotsLeft > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Add Students ({availableStudents.length} available)</h4>
            {availableStudents.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">No more students available to assign.</p>
            ) : (
              <>
                <div className="divide-y border rounded-lg max-h-60 overflow-y-auto">
                  {availableStudents.map((s: Record<string, unknown>) => (
                    <label key={String(s.id)} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(s.id))}
                        onChange={() => toggleSelect(String(s.id))}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <div>
                        <Link to={`/students/${String(s.studentId)}/profile`} className="font-medium text-primary-600 hover:underline">{String(s.firstName)} {String(s.lastName)}</Link>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-xs text-gray-500">{String(s.email)}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex justify-end mt-3">
                    <Button onClick={handleAssign} disabled={assignMutation.isPending}>
                      Assign {selectedIds.size} Student(s)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Rotation Form ──────────────────────────────────────────────────────────

function RotationForm({ courses, instructors, defaultValues, onSubmit, isPending, onCancel }: {
  courses: Array<Record<string, unknown>>;
  instructors: Array<Record<string, unknown>>;
  defaultValues?: Partial<FormData>;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      courseId: "",
      instructorId: "",
      title: "",
      description: "",
      facility: "",
      department: "",
      startDate: "",
      endDate: "",
      requiredHours: 120,
      maxStudents: 20,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
        <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
          <option value="">Select course</option>
          {courses.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} — {String(c.name)}</option>)}
        </select>
        {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Instructor *</label>
        <select {...register("instructorId")} className="w-full px-3 py-2 border rounded-lg">
          <option value="">Select instructor</option>
          {instructors.map((i) => <option key={String(i.id)} value={String(i.id)}>{String(i.firstName)} {String(i.lastName)}</option>)}
        </select>
        {errors.instructorId && <p className="text-red-500 text-xs mt-1">{errors.instructorId.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Batch A — Medical-Surgical" />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facility / Hospital</label>
          <input {...register("facility")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Philippine General Hospital" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department / Unit</label>
          <input {...register("department")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Ward 5 (Med-Surg)" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
          <input type="date" {...register("startDate")} className="w-full px-3 py-2 border rounded-lg" />
          {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
          <input type="date" {...register("endDate")} className="w-full px-3 py-2 border rounded-lg" />
          {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Required Hours</label>
          <input type="number" {...register("requiredHours")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
          <input type="number" {...register("maxStudents")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}

// ─── Rotation Detail & Attendance Modal ─────────────────────────────────────

type DetailTab = "students" | "attendance" | "logs" | "evaluations";

function RotationDetailModal({ rotation, onClose, canManage }: {
  rotation: Record<string, unknown>;
  onClose: () => void;
  canManage: boolean;
}) {
  const rotationId = String(rotation.id);
  const [tab, setTab] = useState<DetailTab>("students");
  const [markingFor, setMarkingFor] = useState<Record<string, unknown> | null>(null);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["rotation-students", rotationId],
    queryFn: () => clinicalRleApi.listRotationStudents(rotationId),
  });

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["rotation-attendance", rotationId],
    queryFn: () => clinicalRleApi.listAttendance(rotationId),
  });

  const { data: logsData } = useQuery({
    queryKey: ["rotation-logs", rotationId],
    queryFn: () => clinicalRleApi.listRotationLogs(rotationId),
  });

  const { data: evalsData } = useQuery({
    queryKey: ["rotation-evaluations", rotationId],
    queryFn: () => clinicalRleApi.listRotationEvaluations(rotationId),
  });

  const students = studentsData?.data?.data ?? [];
  const attendance = attendanceData?.data?.data ?? [];
  const logs = logsData?.data?.data ?? [];
  const evaluations = evalsData?.data?.data ?? [];

  return (
    <Modal open={true} onClose={onClose} title={`${String(rotation.title ?? "")} — Detail View`}>
      <div className="space-y-4">
        {/* Rotation Info */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <span>📅 {new Date(String(rotation.startDate)).toLocaleDateString()} — {new Date(String(rotation.endDate)).toLocaleDateString()}</span>
          {rotation.facility ? <span>🏥 {String(rotation.facility)}</span> : null}
          {rotation.department ? <span>🏨 {String(rotation.department)}</span> : null}
          <span>⏱ {String(rotation.requiredHours)} hrs required</span>
          <span>👥 {students.length}/{String(rotation.maxStudents)} students</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          <button onClick={() => setTab("students")} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "students" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Students ({students.length})
          </button>
          <button onClick={() => setTab("attendance")} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "attendance" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Attendance ({attendance.length})
          </button>
          <button onClick={() => setTab("logs")} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "logs" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Clinical Logs ({logs.length})
          </button>
          <button onClick={() => setTab("evaluations")} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "evaluations" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Evaluations ({evaluations.length})
          </button>
        </div>

        {/* Tab Content */}
        {tab === "students" && (
          <StudentsWithHoursTab
            rotationId={rotationId}
            students={students}
            requiredHours={Number(rotation.requiredHours ?? 120)}
            isLoading={studentsLoading}
            canManage={canManage}
            onMarkAttendance={(student) => { setMarkingFor(student); setTab("attendance"); }}
          />
        )}
        {tab === "attendance" && (
          <AttendanceTab
            rotationId={rotationId}
            attendance={attendance}
            students={students}
            isLoading={attendanceLoading}
            canManage={canManage}
            onMarkFor={markingFor}
            onClearMarkingFor={() => setMarkingFor(null)}
          />
        )}
        {tab === "logs" && (
          <LogsTab rotationId={rotationId} logs={logs} canManage={canManage} />
        )}
        {tab === "evaluations" && (
          <EvaluationsTab rotationId={rotationId} evaluations={evaluations} students={students} canManage={canManage} />
        )}
      </div>
    </Modal>
  );
}

// ─── Students With Hours Tab ────────────────────────────────────────────────

function StudentsWithHoursTab({ rotationId, students, requiredHours, isLoading, canManage, onMarkAttendance }: {
  rotationId: string;
  students: Array<Record<string, unknown>>;
  requiredHours: number;
  isLoading: boolean;
  canManage: boolean;
  onMarkAttendance: (student: Record<string, unknown>) => void;
}) {
  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      {students.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No students assigned to this rotation.</p>
      ) : (
        students.map((student) => (
          <StudentHoursRow
            key={String(student.studentId)}
            rotationId={rotationId}
            student={student}
            requiredHours={requiredHours}
            canManage={canManage}
            onMarkAttendance={onMarkAttendance}
          />
        ))
      )}
    </div>
  );
}

function StudentHoursRow({ rotationId, student, requiredHours, canManage, onMarkAttendance }: {
  rotationId: string;
  student: Record<string, unknown>;
  requiredHours: number;
  canManage: boolean;
  onMarkAttendance: (student: Record<string, unknown>) => void;
}) {
  const { data: hoursData } = useQuery({
    queryKey: ["student-hours", rotationId, student.studentId],
    queryFn: () => clinicalRleApi.getStudentHours(rotationId, String(student.studentId)),
  });

  const hours = hoursData?.data?.data;
  const totalHours = hours?.totalHours ?? 0;
  const percentage = hours?.percentage ?? 0;

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <Link to={`/students/${String(student.studentId)}/profile`} className="font-medium text-primary-600 hover:underline">{String(student.firstName)} {String(student.lastName)}</Link>
        <div className="text-xs text-gray-500">{String(student.email)}</div>
      </div>
      <div className="text-right min-w-[140px]">
        <div className="text-sm font-semibold text-gray-900">{totalHours}/{requiredHours} hrs</div>
        <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full transition-all ${percentage >= 100 ? "bg-green-500" : percentage >= 75 ? "bg-blue-500" : percentage >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{percentage}%</div>
      </div>
      {canManage && (
        <Button size="sm" variant="primary" onClick={() => onMarkAttendance(student)} title="Mark Attendance">
          <ClipboardCheck size={14} />
        </Button>
      )}
    </div>
  );
}

// ─── Attendance Tab ─────────────────────────────────────────────────────────

function AttendanceTab({ rotationId, attendance, students, isLoading, canManage, onMarkFor, onClearMarkingFor }: {
  rotationId: string;
  attendance: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  isLoading: boolean;
  canManage: boolean;
  onMarkFor: Record<string, unknown> | null;
  onClearMarkingFor: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "bulk">(onMarkFor ? "single" : "bulk");
  const [showMarkForm, setShowMarkForm] = useState(!!onMarkFor);
  const [selectedStudentId, setSelectedStudentId] = useState(onMarkFor ? String(onMarkFor.studentId) : "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("PRESENT");
  const [hours, setHours] = useState(8);
  const [notes, setNotes] = useState("");
  // Bulk mode state
  const [bulkRecords, setBulkRecords] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    students.forEach((s) => { initial[String(s.studentId)] = "PRESENT"; });
    return initial;
  });
  const [bulkHours, setBulkHours] = useState(8);
  const [bulkNotes, setBulkNotes] = useState("");

  // Sync when onMarkFor changes
  if (onMarkFor && !showMarkForm) {
    setShowMarkForm(true);
    setMode("single");
    setSelectedStudentId(String(onMarkFor.studentId));
    onClearMarkingFor();
  }

  // Update bulk records when students change
  if (students.length > 0 && Object.keys(bulkRecords).length === 0) {
    const initial: Record<string, string> = {};
    students.forEach((s) => { initial[String(s.studentId)] = "PRESENT"; });
    setBulkRecords(initial);
  }

  const markMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalRleApi.markAttendance(data),
    onSuccess: () => {
      toast.success("Attendance marked!");
      queryClient.invalidateQueries({ queryKey: ["rotation-attendance", rotationId] });
      queryClient.invalidateQueries({ queryKey: ["student-hours"] });
      setShowMarkForm(false);
      setSelectedStudentId("");
      setNotes("");
    },
    onError: () => toast.error("Failed to mark attendance"),
  });

  const batchMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalRleApi.markBatchAttendance(data),
    onSuccess: () => {
      toast.success("Batch attendance marked!");
      queryClient.invalidateQueries({ queryKey: ["rotation-attendance", rotationId] });
      queryClient.invalidateQueries({ queryKey: ["student-hours"] });
      setShowMarkForm(false);
    },
    onError: () => toast.error("Failed to mark batch attendance"),
  });

  const handleMark = () => {
    if (!selectedStudentId || !date) return;
    markMutation.mutate({
      rotationId,
      studentId: selectedStudentId,
      date: new Date(date).toISOString(),
      status,
      hoursLogged: hours,
      notes,
    });
  };

  const handleBulkMark = () => {
    if (!date) return;
    const records = Object.entries(bulkRecords).map(([studentId, st]) => ({
      studentId,
      status: st,
      hoursLogged: bulkHours,
      notes: bulkNotes || undefined,
    }));
    batchMutation.mutate({ rotationId, date: new Date(date).toISOString(), records });
  };

  // Group attendance by date
  const groupedByDate = attendance.reduce((acc: Record<string, Array<Record<string, unknown>>>, record: Record<string, unknown>) => {
    const d = new Date(String(record.date)).toLocaleDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(record);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Mark Attendance Controls */}
      {canManage && (
        !showMarkForm ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowMarkForm(true); setMode("single"); }}><ClipboardCheck size={14} className="mr-1" /> Mark Single</Button>
            <Button variant="primary" size="sm" onClick={() => { setShowMarkForm(true); setMode("bulk"); }}><ClipboardCheck size={14} className="mr-1" /> Mark All Students</Button>
          </div>
        ) : mode === "single" ? (
        /* Single Student Mark Form */
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Mark Attendance — Single Student</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Student</label>
              <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="">Select student</option>
                {students.map((s) => <option key={String(s.studentId)} value={String(s.studentId)}>{String(s.firstName)} {String(s.lastName)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
                <option value="EXCUSED">Excused</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Hours</label>
              <input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm border rounded" />
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="w-full px-2 py-1.5 text-sm border rounded" />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => { setShowMarkForm(false); setMode("bulk"); onClearMarkingFor(); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleMark} disabled={markMutation.isPending || !selectedStudentId}>
              {markMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </Card>
      ) : (
        /* Bulk Mark Form */
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Mark Attendance — All Students</h4>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Default Hours</label>
              <input type="number" min={0} max={24} value={bulkHours} onChange={(e) => setBulkHours(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Notes (all)</label>
              <input type="text" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Optional..." className="w-full px-2 py-1.5 text-sm border rounded" />
            </div>
          </div>
          <div className="divide-y border rounded-lg max-h-60 overflow-y-auto">
            {students.map((s) => (
              <div key={String(s.studentId)} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="font-medium text-sm text-gray-900">{String(s.firstName)} {String(s.lastName)}</span>
                </div>
                <select
                  value={bulkRecords[String(s.studentId)] ?? "PRESENT"}
                  onChange={(e) => setBulkRecords((prev) => ({ ...prev, [String(s.studentId)]: e.target.value }))}
                  className="px-2 py-1 text-sm border rounded"
                >
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="EXCUSED">Excused</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => { setShowMarkForm(false); setMode("bulk"); onClearMarkingFor(); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleBulkMark} disabled={batchMutation.isPending}>
              {batchMutation.isPending ? "Saving..." : `Save All (${students.length} students)`}
            </Button>
          </div>
        </Card>
      ))}

      {/* Attendance History */}
      {isLoading ? <LoadingSpinner /> : attendance.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No attendance records yet.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByDate).map(([date, records]) => (
            <div key={date}>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">{date}</h4>
              <div className="divide-y border rounded-lg">
                {records.map((r) => {
                  const statusColors: Record<string, string> = {
                    PRESENT: "text-green-600 bg-green-50",
                    ABSENT: "text-red-600 bg-red-50",
                    LATE: "text-yellow-600 bg-yellow-50",
                    EXCUSED: "text-blue-600 bg-blue-50",
                  };
                  return (
                    <div key={String(r.id)} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <span className="font-medium text-gray-900">
                          <Link to={`/students/${String(r.studentId)}/profile`} className="text-primary-600 hover:underline">{String(r.studentFirstName ?? "")} {String(r.studentLastName ?? "")}</Link>
                        </span>
                        {r.notes ? <span className="text-xs text-gray-500 ml-2">— {String(r.notes)}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{String(r.hoursLogged)} hrs</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[String(r.status)] ?? "bg-gray-100 text-gray-600"}`}>
                          {String(r.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Logs Tab (Instructor View) ────────────────────────────────────────────

function LogsTab({ rotationId, logs, canManage }: { rotationId: string; logs: Array<Record<string, unknown>>; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const reviewMutation = useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: string }) => clinicalRleApi.reviewClinicalLog(id, feedback),
    onSuccess: () => {
      toast.success("Log reviewed");
      queryClient.invalidateQueries({ queryKey: ["rotation-logs", rotationId] });
      setFeedbackFor(null);
      setFeedbackText("");
    },
    onError: () => toast.error("Failed to review log"),
  });

  if (logs.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">No clinical logs submitted yet.</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={String(log.id)} className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Link to={`/students/${String(log.studentId)}/profile`} className="font-medium text-primary-600 hover:underline">{String(log.studentFirstName ?? "")} {String(log.studentLastName ?? "")}</Link>
              <span className="text-xs text-gray-500 ml-2">{new Date(String(log.date)).toLocaleDateString()}</span>
              {log.patientCount ? <span className="text-xs text-gray-500 ml-2">— {String(log.patientCount)} patients</span> : null}
            </div>
            {String(log.status ?? (log.reviewedAt ? "REVIEWED" : "SUBMITTED")) === "REVIEWED" ? (
              <Badge variant="success">Reviewed</Badge>
            ) : (
              <Badge variant="default">Pending</Badge>
            )}
          </div>
          {Array.isArray(log.procedures) && log.procedures.length > 0 && (
            <div className="text-xs text-gray-600 mb-1"><strong>Procedures:</strong> {(log.procedures as string[]).join(", ")}</div>
          )}
          {log.reflections ? <div className="text-xs text-gray-600 mb-1"><strong>Reflections:</strong> {String(log.reflections)}</div> : null}
          {log.challenges ? <div className="text-xs text-gray-600 mb-1"><strong>Challenges:</strong> {String(log.challenges)}</div> : null}
          {log.learningOutcomes ? <div className="text-xs text-gray-600 mb-1"><strong>Learning Outcomes:</strong> {String(log.learningOutcomes)}</div> : null}
          {log.feedback ? (
            <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
              <strong>Your Feedback:</strong> {String(log.feedback)}
            </div>
          ) : null}
          {canManage && !log.reviewedAt && (
            feedbackFor === String(log.id) ? (
              <div className="mt-2 flex gap-2">
                <input value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="flex-1 px-2 py-1 text-sm border rounded" placeholder="Write feedback..." />
                <Button size="sm" onClick={() => reviewMutation.mutate({ id: String(log.id), feedback: feedbackText })} disabled={reviewMutation.isPending || !feedbackText.trim()}>Submit</Button>
                <Button size="sm" variant="secondary" onClick={() => { setFeedbackFor(null); setFeedbackText(""); }}>Cancel</Button>
              </div>
            ) : (
              <button onClick={() => setFeedbackFor(String(log.id))} className="mt-2 text-xs text-primary-600 hover:underline">Give Feedback</button>
            )
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Evaluations Tab (Instructor View) ─────────────────────────────────────

function EvaluationsTab({ rotationId, evaluations, students, canManage }: {
  rotationId: string;
  evaluations: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [type, setType] = useState("FORMATIVE");
  const [clinicalPerformance, setClinicalPerformance] = useState(80);
  const [professionalBehavior, setProfessionalBehavior] = useState(80);
  const [communicationSkills, setCommunicationSkills] = useState(80);
  const [criticalThinking, setCriticalThinking] = useState(80);
  const [strengths, setStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [comments, setComments] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => clinicalRleApi.createEvaluation(data),
    onSuccess: () => {
      toast.success("Evaluation submitted");
      queryClient.invalidateQueries({ queryKey: ["rotation-evaluations", rotationId] });
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("Failed to submit evaluation"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => clinicalRleApi.updateEvaluation(id, data),
    onSuccess: () => {
      toast.success("Evaluation updated");
      queryClient.invalidateQueries({ queryKey: ["rotation-evaluations", rotationId] });
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("Failed to update evaluation"),
  });

  const startEdit = (ev: Record<string, unknown>) => {
    setEditingId(String(ev.id));
    setSelectedStudentId(String(ev.studentId));
    setType(String(ev.type ?? "FORMATIVE"));
    setClinicalPerformance(ev.clinicalPerformance != null ? Number(ev.clinicalPerformance) : 80);
    setProfessionalBehavior(ev.professionalBehavior != null ? Number(ev.professionalBehavior) : 80);
    setCommunicationSkills(ev.communicationSkills != null ? Number(ev.communicationSkills) : 80);
    setCriticalThinking(ev.criticalThinking != null ? Number(ev.criticalThinking) : 80);
    setStrengths(ev.strengths ? String(ev.strengths) : "");
    setAreasForImprovement(ev.areasForImprovement ? String(ev.areasForImprovement) : "");
    setComments(ev.comments ? String(ev.comments) : "");
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedStudentId("");
    setType("FORMATIVE");
    setClinicalPerformance(80);
    setProfessionalBehavior(80);
    setCommunicationSkills(80);
    setCriticalThinking(80);
    setStrengths("");
    setAreasForImprovement("");
    setComments("");
  };

  const handleSubmit = () => {
    if (!selectedStudentId) { toast.error("Select a student"); return; }
    const payload = {
      type,
      clinicalPerformance,
      professionalBehavior,
      communicationSkills,
      criticalThinking,
      strengths: strengths.trim() || undefined,
      areasForImprovement: areasForImprovement.trim() || undefined,
      comments: comments.trim() || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ rotationId, studentId: selectedStudentId, ...payload });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700">Student Evaluations</h4>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus size={14} className="mr-1" /> New Evaluation</Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <h5 className="text-sm font-medium text-gray-700">{editingId ? "Edit Evaluation" : "Evaluate Student"}</h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Student</label>
              <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={!!editingId} className="w-full px-2 py-1.5 text-sm border rounded disabled:bg-gray-50">
                <option value="">Select student</option>
                {students.map((s) => <option key={String(s.studentId)} value={String(s.studentId)}>{String(s.firstName)} {String(s.lastName)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Evaluation Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="FORMATIVE">Formative</option>
                <option value="SUMMATIVE">Summative</option>
                <option value="MIDTERM">Midterm</option>
                <option value="FINAL">Final</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Clinical Performance ({clinicalPerformance}%)</label>
              <input type="range" min={0} max={100} value={clinicalPerformance} onChange={(e) => setClinicalPerformance(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Professional Behavior ({professionalBehavior}%)</label>
              <input type="range" min={0} max={100} value={professionalBehavior} onChange={(e) => setProfessionalBehavior(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Communication Skills ({communicationSkills}%)</label>
              <input type="range" min={0} max={100} value={communicationSkills} onChange={(e) => setCommunicationSkills(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Critical Thinking ({criticalThinking}%)</label>
              <input type="range" min={0} max={100} value={criticalThinking} onChange={(e) => setCriticalThinking(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Strengths</label>
            <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" rows={2} placeholder="What does the student do well?" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Areas for Improvement</label>
            <textarea value={areasForImprovement} onChange={(e) => setAreasForImprovement(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" rows={2} placeholder="What areas need improvement?" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Additional Comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" rows={2} placeholder="Any other observations..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Submitting..." : "Submit Evaluation")}
            </Button>
          </div>
        </Card>
      )}

      {/* Evaluation List */}
      {evaluations.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No evaluations submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => (
            <Card key={String(ev.id)} className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Link to={`/students/${String(ev.studentId)}/profile`} className="font-medium text-primary-600 hover:underline">{String(ev.studentFirstName ?? "")} {String(ev.studentLastName ?? "")}</Link>
                <Badge variant="info">{String(ev.type)}</Badge>
                </div>
                <span className="text-sm font-semibold text-primary-600">{ev.overallScore != null ? `${String(ev.overallScore)}%` : "—"}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                <span>Clinical: {ev.clinicalPerformance != null ? `${String(ev.clinicalPerformance)}%` : "—"}</span>
                <span>Behavior: {ev.professionalBehavior != null ? `${String(ev.professionalBehavior)}%` : "—"}</span>
                <span>Communication: {ev.communicationSkills != null ? `${String(ev.communicationSkills)}%` : "—"}</span>
                <span>Critical Thinking: {ev.criticalThinking != null ? `${String(ev.criticalThinking)}%` : "—"}</span>
              </div>
              {ev.strengths ? <div className="text-xs text-gray-600 mb-1"><strong>Strengths:</strong> {String(ev.strengths)}</div> : null}
              {ev.areasForImprovement ? <div className="text-xs text-gray-600 mb-1"><strong>Areas for Improvement:</strong> {String(ev.areasForImprovement)}</div> : null}
              {ev.comments ? <div className="text-xs text-gray-600"><strong>Comments:</strong> {String(ev.comments)}</div> : null}
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">{new Date(String(ev.evaluatedAt)).toLocaleDateString()}</span>
                {canManage && (
                  <button onClick={() => startEdit(ev)} className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Complete Rotation Modal ────────────────────────────────────────────────

function CompleteRotationModal({ rotation, onClose }: { rotation: Record<string, unknown>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const rotationId = String(rotation.id);
  const isEdit = rotation.status === "COMPLETED";
  const [mode, setMode] = useState<"all" | "selected">("all");
  // null => derive selection from summary rows (edit mode pre-checks completed students)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rotation-completion-summary", rotationId],
    queryFn: () => clinicalRleApi.getCompletionSummary(rotationId),
  });

  const summary = data?.data?.data;
  const students: Record<string, unknown>[] = summary?.students ?? [];
  const totals = summary?.totals ?? {};
  const belowRequired = Number(totals.studentsBelowRequiredHours ?? 0);
  const showCheckboxes = isEdit || mode === "selected";

  const isChecked = (s: Record<string, unknown>) => {
    const id = String(s.studentId);
    return selectedIds ? selectedIds.includes(id) : Boolean(s.completedAt);
  };
  const currentSelection = () => students.filter(isChecked).map((s) => String(s.studentId));
  const toggleStudent = (s: Record<string, unknown>) => {
    const id = String(s.studentId);
    const next = currentSelection();
    setSelectedIds(next.includes(id) ? next.filter((x) => x !== id) : [...next, id]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await clinicalRleApi.updateRotationCompletion(rotationId, currentSelection());
      } else if (mode === "selected") {
        await clinicalRleApi.completeRotation(rotationId, currentSelection());
      } else {
        await clinicalRleApi.completeRotation(rotationId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotations"] });
      queryClient.invalidateQueries({ queryKey: ["my-rotations"] });
      queryClient.invalidateQueries({ queryKey: ["rotation-completion-summary", rotationId] });
      toast.success(isEdit ? "Student completion updated" : "Rotation marked as completed");
      onClose();
    },
    onError: () => toast.error(isEdit ? "Failed to update completion" : "Failed to complete rotation"),
  });

  const emptySelection = mode === "selected" && !isEdit && currentSelection().length === 0;

  return (
    <Modal open onClose={onClose} title={isEdit ? "Manage Student Completion" : "Complete Rotation"}>
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-gray-900">{String(rotation.title)}</p>
          <p className="text-sm text-gray-500">
            {new Date(String(rotation.startDate)).toLocaleDateString()} — {new Date(String(rotation.endDate)).toLocaleDateString()}
            {" · "}{String(rotation.requiredHours ?? 120)} required hours
          </p>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {!isEdit && (
              <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-3 text-sm">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="completion-scope" checked={mode === "all"} onChange={() => setMode("all")} />
                  All assigned students
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="completion-scope"
                    checked={mode === "selected"}
                    onChange={() => {
                      setMode("selected");
                      setSelectedIds(students.map((s) => String(s.studentId)));
                    }}
                  />
                  Select students
                </label>
              </div>
            )}

            {isEdit && (
              <p className="text-sm text-gray-600">
                Check the students who have completed this rotation. Only checked students can download a certificate.
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-lg font-semibold text-gray-900">{Number(totals.studentCount ?? 0)}</div>
                <div className="text-xs text-gray-500">Students</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-lg font-semibold text-gray-900">{Number(totals.totalHours ?? 0)}</div>
                <div className="text-xs text-gray-500">Total hours</div>
              </div>
              <div className={`rounded-lg p-3 ${belowRequired > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                <div className={`text-lg font-semibold ${belowRequired > 0 ? "text-amber-600" : "text-gray-900"}`}>{belowRequired}</div>
                <div className="text-xs text-gray-500">Below required hours</div>
              </div>
            </div>

            {students.length === 0 ? (
              <p className="text-sm rounded-lg bg-amber-50 p-3 text-amber-700">
                No students are assigned to this rotation.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      {showCheckboxes && <th className="w-10 px-2 py-2" />}
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2">Attendance</th>
                      <th className="px-3 py-2">Logs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((s) => (
                      <tr key={String(s.studentId)} className={showCheckboxes && !isChecked(s) ? "opacity-60" : ""}>
                        {showCheckboxes && (
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={isChecked(s)}
                              onChange={() => toggleStudent(s)}
                              className="h-4 w-4 rounded border-gray-300"
                              aria-label={`Mark ${String(s.firstName)} ${String(s.lastName)} completed`}
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {String(s.firstName)} {String(s.lastName)}
                        </td>
                        <td className={`px-3 py-2 ${s.metRequiredHours ? "text-gray-700" : "font-medium text-amber-600"}`}>
                          {Number(s.totalHours)}/{Number(s.requiredHours)} hrs ({Number(s.hoursPercentage)}%)
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {Number(s.attendancePercentage)}%{" "}
                          <span className="text-gray-400">({Number(s.presentDays) + Number(s.lateDays)}/{Number(s.totalDays)}d)</span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{Number(s.logCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {belowRequired > 0 && (
              <p className="text-sm rounded-lg bg-amber-50 p-3 text-amber-700">
                {belowRequired} student{belowRequired === 1 ? " has" : "s have"} not yet met the required hours.
                You can still complete the rotation.
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading || emptySelection}>
            {saveMutation.isPending ? "Saving..." : isEdit ? "Save Selection" : "Mark as Completed"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
