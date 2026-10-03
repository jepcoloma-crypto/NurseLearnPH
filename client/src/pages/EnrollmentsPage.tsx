import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicApi, usersApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal } from "@/components/shared";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
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

  const { data, isLoading } = useQuery({
    queryKey: ["enrollments", page],
    queryFn: () => academicApi.listEnrollments({ page: String(page), limit: "15" }),
  });

  const { data: studentsRes } = useQuery({
    queryKey: ["users-students-enroll"],
    queryFn: () => usersApi.list({ role: "STUDENT", limit: "200" }),
    enabled: showCreate,
  });

  const { data: coursesRes } = useQuery({
    queryKey: ["courses-list-enroll"],
    queryFn: () => academicApi.listCourses({ limit: "200" }),
    enabled: showCreate,
  });

  const { data: sectionsRes } = useQuery({
    queryKey: ["sections-list-enroll"],
    queryFn: () => academicApi.listSections({ limit: "200" }),
    enabled: showCreate,
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
            <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}><UserPlus size={16} /> Enroll Student</Button>
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
    </div>
  );
}
