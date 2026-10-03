import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { academicApi, usersApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Modal, LoadingSpinner } from "@/components/shared";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  credits: z.coerce.number().min(1),
  instructorId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CoursesPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["courses", page, isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({
      page: String(page),
      limit: "15",
      ...(isInstructor && user ? { instructorId: user.id } : {}),
    }),
  });
  const { data: instructorsData } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => usersApi.list({ role: "INSTRUCTOR", limit: "100" }),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const instructors = instructorsData?.data?.data?.items ?? [];
  const canCreate = can("courses.create");
  const canEdit = can("courses.edit");
  const canDelete = can("courses.delete");

  const onCreate = async (formData: FormData) => {
    try {
      await academicApi.createCourse(formData);
      toast.success("Course created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create course");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      await academicApi.updateCourse(String(editItem?.id), formData);
      toast.success("Course updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update course");
    }
  };

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await academicApi.updateCourse(String(item.id), { isActive: false });
      toast.success("Course deleted");
      refetch();
    } catch {
      toast.error("Failed to delete course");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      code: String(item.code || ""),
      name: String(item.name || ""),
      description: String(item.description || ""),
      credits: Number(item.credits || 1),
      instructorId: String(item.instructorId || ""),
    });
    setShowCreate(true);
  };

  return (
    <div>
      <PageHeader
        title={isInstructor ? "My Courses" : "Courses"}
        subtitle={isInstructor ? "Courses assigned to you" : "Manage academic courses and curricula"}
        actions={
          canCreate ? (
            <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}>
              <Plus size={16} /> Add Course
            </Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "code", label: "Code", render: (item) => (
              <span className="font-mono font-medium">{String(item.code)}</span>
            )},
            { key: "name", label: "Name", render: (item) => (
              <span className="font-medium">{String(item.name)}</span>
            )},
            { key: "instructorLastName", label: "Instructor", render: (item) => item.instructorFirstName ? (
              <span>{String(item.instructorFirstName)} {String(item.instructorLastName)}</span>
            ) : <span className="text-gray-400">—</span> },
            { key: "studentCount", label: "Students", className: "w-20 text-center", render: (item) => (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                {Number(item.studentCount || 0)}
              </span>
            )},
            { key: "credits", label: "Credits", className: "w-20" },
            { key: "isActive", label: "Status", className: "w-24", render: (item) => (
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {item.isActive ? "Active" : "Inactive"}
              </span>
            )},
            { key: "actions", label: "", className: "w-20", render: (item) => (
              canEdit || canDelete ? (
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(item)} className="p-1 text-gray-400 hover:text-red-600" data-tooltip="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ) : null
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Course" : "Add Course"}>
        <form onSubmit={handleSubmit((data) => editItem ? onEdit(data) : onCreate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
            <input {...register("code")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. NUR101" />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Fundamentals of Nursing" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
              <input type="number" {...register("credits")} className="w-full px-3 py-2 border rounded-lg" />
              {errors.credits && <p className="text-red-500 text-xs mt-1">{errors.credits.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
              <select {...register("instructorId")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">No instructor</option>
                {instructors.map((i: Record<string, unknown>) => (
                  <option key={String(i.id)} value={String(i.id)}>
                    {String(i.firstName)} {String(i.lastName)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit">{editItem ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
