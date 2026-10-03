import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { learningApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Modal, LoadingSpinner } from "@/components/shared";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

const schema = z.object({
  courseId: z.string().uuid("Select a course"),
  name: z.string().min(1),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function TopicsPage() {
  const { can, user } = usePermissions();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["topics", page, isInstructor ? user?.id : undefined],
    queryFn: () => learningApi.listTopics({ page: String(page), limit: "15", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courseList = courses?.data?.data?.items ?? [];
  const canCreate = can("topics.create");
  const canEdit = can("topics.edit");
  const canDelete = can("topics.delete");

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm(`Delete topic "${String(item.name)}"?`)) return;
    try {
      await learningApi.deleteTopic(String(item.id));
      toast.success("Topic deleted");
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Failed to delete topic";
      toast.error(msg);
    }
  };

  const onCreate = async (formData: FormData) => {
    try {
      await learningApi.createTopic(formData);
      toast.success("Topic created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create topic");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      await learningApi.updateTopic(String(editItem?.id), formData);
      toast.success("Topic updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update topic");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      courseId: String(item.courseId || ""),
      name: String(item.name || ""),
      description: String(item.description || ""),
    });
  };

  return (
    <div>
      <PageHeader
        title="Topics & Lessons"
        subtitle="Manage learning topics and lesson content"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Add Topic
            </Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "isActive", label: "Status", render: (item) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {item.isActive ? "Active" : "Inactive"}
              </span>
            )},
            { key: "actions", label: "Actions", className: "w-24", render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(item)} className="p-1 hover:bg-gray-100 rounded" title="Delete">
                    <Trash2 size={16} className="text-red-400" />
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Topic">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courseList.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Topic">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courseList.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
