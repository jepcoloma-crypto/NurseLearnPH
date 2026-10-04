import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicApi, usersApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal, Badge } from "@/components/shared";
import { UserPlus, Trash2, Pencil, Upload, Download } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { parseRosterCsv, buildRosterTemplate } from "@/utils/roster";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  studentId: z.string().min(1, "Student is required"),
  courseId: z.string().min(1, "Course is required"),
  sectionId: z.string().min(1, "Section is required"),
});
type FormData = z.infer<typeof schema>;

export default function EnrollmentsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importCourseId, setImportCourseId] = useState("");
  const [importSectionId, setImportSectionId] = useState("");
  const [csvValues, setCsvValues] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<
    Record<string, { status: "enrolled" | "already" | "error"; detail?: string }>
  >({});
  const [importing, setImporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["enrollments", page],
    queryFn: () => academicApi.listEnrollments({ page: String(page), limit: "15" }),
  });

  const { data: studentsRes } = useQuery({
    queryKey: ["users-students-enroll"],
    queryFn: () => usersApi.list({ role: "STUDENT", limit: "200" }),
    enabled: showCreate || showImport,
  });

  const { data: coursesRes } = useQuery({
    queryKey: ["courses-list-enroll"],
    queryFn: () => academicApi.listCourses({ limit: "200" }),
    enabled: showCreate || showImport,
  });

  const { data: sectionsRes } = useQuery({
    queryKey: ["sections-list-enroll"],
    queryFn: () => academicApi.listSections({ limit: "200" }),
    enabled: showCreate || showImport,
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const studentList = studentsRes?.data?.data?.items ?? [];
  const courseList = coursesRes?.data?.data?.items ?? [];
  const sectionList = sectionsRes?.data?.data?.items ?? [];
  const canManage = can("enrollments.create");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => academicApi.enrollStudent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student enrolled");
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } | string } } }) => {
      const msg = typeof err?.response?.data?.error === "object" ? err.response.data.error.message : err?.response?.data?.error;
      toast.error(msg || "Failed to enroll student");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.unenrollStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student unenrolled");
    },
    onError: () => toast.error("Failed to unenroll student"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, sectionId }: { id: string; sectionId: string }) => academicApi.updateEnrollment(id, { sectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Enrollment updated");
      setShowCreate(false);
      setEditItem(null);
      reset();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } | string } } }) => {
      const msg = typeof err?.response?.data?.error === "object" ? err.response.data.error.message : err?.response?.data?.error;
      toast.error(msg || "Failed to update enrollment");
    },
  });

  const onDelete = (id: string, studentName: string) => {
    if (window.confirm(`Unenroll ${studentName}?`)) {
      deleteMutation.mutate(id);
    }
  };

  // ─── CSV roster import ─────────────────────────────────────────────────
  const errMsg = (err: unknown): string | undefined => {
    const e = err as { response?: { data?: { error?: { message?: string } | string } } };
    const raw = e?.response?.data?.error;
    return typeof raw === "object" ? raw?.message : raw;
  };

  const resolvedRows = useMemo(
    () =>
      csvValues.map((value) => {
        const v = value.toLowerCase();
        const student = studentList.find(
          (s: Record<string, unknown>) =>
            String(s.email).toLowerCase() === v || String(s.username).toLowerCase() === v
        );
        return {
          value,
          studentId: student ? String(student.id) : undefined,
          studentName: student
            ? `${String(student.firstName)} ${String(student.lastName)}`
            : undefined,
        };
      }),
    [csvValues, studentList]
  );
  const readyRows = resolvedRows.filter(
    (r) => r.studentId && !importResults[r.value]
  );

  const handleRosterFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsvValues(parseRosterCsv(text));
    setImportResults({});
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildRosterTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!importCourseId || !importSectionId) return;
    setImporting(true);
    const res: Record<string, { status: "enrolled" | "already" | "error"; detail?: string }> = {};
    let ok = 0;
    let already = 0;
    let failed = 0;
    for (const row of readyRows) {
      try {
        await academicApi.enrollStudent({
          studentId: row.studentId,
          courseId: importCourseId,
          sectionId: importSectionId,
        });
        res[row.value] = { status: "enrolled" };
        ok++;
      } catch (err) {
        const msg = errMsg(err);
        if (msg && msg.toLowerCase().includes("already enrolled")) {
          res[row.value] = { status: "already", detail: msg };
          already++;
        } else {
          res[row.value] = { status: "error", detail: msg || "Import failed" };
          failed++;
        }
      }
      setImportResults({ ...res });
    }
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    toast.success(
      `Imported ${ok}${already ? `, ${already} already enrolled` : ""}${failed ? `, ${failed} failed` : ""}`
    );
  };

  const closeImport = () => {
    setShowImport(false);
    setImportCourseId("");
    setImportSectionId("");
    setCsvValues([]);
    setImportResults({});
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      studentId: String(item.studentId || ""),
      courseId: String(item.courseId || ""),
      sectionId: String(item.sectionId || ""),
    });
    setShowCreate(true);
  };

  return (
    <div>
      <PageHeader
        title="Course Enrollments"
        subtitle="Manage student enrollments in courses"
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload size={16} /> Import CSV
              </Button>
              <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}>
                <UserPlus size={16} /> Enroll Student
              </Button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "studentLastName", label: "Student", render: (item) => (
              <span className="font-medium">{String(item.studentFirstName)} {String(item.studentLastName)}</span>
            )},
            { key: "studentEmail", label: "Email", render: (item) => (
              <span className="text-gray-500">{String(item.studentEmail)}</span>
            )},
            { key: "courseCode", label: "Course", render: (item) => (
              <span className="font-medium">{String(item.courseCode)}</span>
            )},
            { key: "courseName", label: "Course Name", render: (item) => (
              <span className="text-gray-500 line-clamp-1">{String(item.courseName)}</span>
            )},
            { key: "instructorLastName", label: "Instructor", render: (item) => item.instructorFirstName ? (
              <span>{String(item.instructorFirstName)} {String(item.instructorLastName)}</span>
            ) : <span className="text-gray-400">—</span> },
            { key: "enrolledAt", label: "Enrolled", className: "w-32", render: (item) => new Date(String(item.enrolledAt)).toLocaleDateString() },
            { key: "actions", label: "", className: "w-20", render: (item) => (
              canManage ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(String(item.id), `${String(item.studentFirstName)} ${String(item.studentLastName)}`)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    data-tooltip="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Enrollment" : "Enroll Student"}>
        <form onSubmit={handleSubmit((data) => {
          if (editItem) updateMutation.mutate({ id: String(editItem.id), sectionId: data.sectionId });
          else createMutation.mutate(data);
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select {...register("studentId")} className="w-full px-3 py-2 border rounded-lg" disabled={!!editItem}>
              <option value="">Select student</option>
              {studentList.map((s: Record<string, unknown>) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.firstName)} {String(s.lastName)} ({String(s.email)})
                </option>
              ))}
            </select>
            {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg" disabled={!!editItem}>
              <option value="">Select course</option>
              {courseList.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.code)} - {String(c.name)}
                </option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select {...register("sectionId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select section</option>
              {sectionList.map((s: Record<string, unknown>) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              ))}
            </select>
            {errors.sectionId && <p className="text-red-500 text-xs mt-1">{errors.sectionId.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editItem ? "Update" : "Enroll"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showImport} onClose={closeImport} title="Import Roster (CSV)" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select value={importCourseId} onChange={(e) => setImportCourseId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select course</option>
                {courseList.map((c: Record<string, unknown>) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.code)} - {String(c.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select value={importSectionId} onChange={(e) => setImportSectionId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select section</option>
                {sectionList.map((s: Record<string, unknown>) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {String(s.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">CSV file</label>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                <Download size={13} /> Download template
              </button>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleRosterFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:border file:rounded-lg file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:font-medium"
            />
            <p className="text-xs text-gray-400 mt-1">
              Fill the template with one student per line (email or username) — extra columns and the header row are ignored.
            </p>
          </div>

          {resolvedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  {resolvedRows.length} row{resolvedRows.length === 1 ? "" : "s"} parsed
                </p>
                <p className="text-xs text-gray-500">
                  {readyRows.length} ready · {resolvedRows.filter((r) => !r.studentId).length} not found
                </p>
              </div>
              <div className="border rounded-lg divide-y max-h-56 overflow-y-auto text-sm">
                {resolvedRows.map((r) => {
                  const done = importResults[r.value];
                  const status = done ? done.status : r.studentId ? "ready" : "notfound";
                  return (
                    <div key={r.value} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-gray-800">{r.studentName ?? r.value}</p>
                        <p className="truncate text-xs text-gray-400">
                          {r.value}
                          {done?.detail ? ` — ${done.detail}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          status === "enrolled" ? "success"
                          : status === "already" ? "warning"
                          : status === "ready" ? "default"
                          : "danger"
                        }
                      >
                        {status === "enrolled" ? "Enrolled"
                          : status === "already" ? "Already enrolled"
                          : status === "ready" ? "Ready"
                          : status === "error" ? "Failed"
                          : "Student not found"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={closeImport}>Cancel</Button>
            <Button
              type="button"
              onClick={runImport}
              disabled={importing || readyRows.length === 0 || !importCourseId || !importSectionId}
            >
              {importing
                ? "Importing..."
                : `Import ${readyRows.length} student${readyRows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
