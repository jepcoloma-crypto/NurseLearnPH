import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, Users, Trash2, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const sectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  yearLevelId: z.string().min(1, "Year level is required"),
  semesterId: z.string().min(1, "Semester is required"),
});
type SectionFormData = z.infer<typeof sectionSchema>;

export default function SectionsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [viewStudents, setViewStudents] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sections", page],
    queryFn: () => academicApi.listSections({ page: String(page), limit: "15" }),
  });

  const { data: yearLevelsRes } = useQuery({
    queryKey: ["year-levels"],
    queryFn: () => academicApi.listYearLevels({ limit: "100" }),
  });

  const { data: semestersRes } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => academicApi.listSemesters({ limit: "100" }),
  });

  const { data: studentsRes } = useQuery({
    queryKey: ["section-students", viewStudents?.id],
    queryFn: () => academicApi.listStudentsBySection(viewStudents!.id),
    enabled: !!viewStudents,
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const yearLevels = yearLevelsRes?.data?.data?.items ?? [];
  const semesters = semestersRes?.data?.data?.items ?? [];
  const sectionStudents = studentsRes?.data?.data ?? [];
  const canManage = can("enrollments.create");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: SectionFormData) => academicApi.createSection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section created");
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to create section");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SectionFormData }) => academicApi.updateSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section updated");
      setEditItem(null);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to update section");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => academicApi.removeStudentSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-students"] });
      toast.success("Student removed from section");
    },
    onError: () => toast.error("Failed to remove student"),
  });

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      name: String(item.name || ""),
      yearLevelId: String(item.yearLevelId || ""),
      semesterId: String(item.semesterId || ""),
    });
    setShowCreate(true);
  };

  const handleDelete = (item: Record<string, unknown>) => {
    if (window.confirm(`Delete section "${String(item.name)}"?`)) {
      deleteMutation.mutate(String(item.id));
    }
  };

  return (
    <div>
      <PageHeader
        title="Sections"
        subtitle="Manage class sections and student assignments"
        actions={
          canManage ? (
            <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}><Plus size={16} /> Add Section</Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "name", label: "Section Name", render: (item) => (
              <span className="font-medium">{String(item.name)}</span>
            )},
            { key: "yearLevelName", label: "Year Level", render: (item) => (
              <span className="text-gray-500">{String(item.yearLevelName || "—")}</span>
            )},
            { key: "semesterName", label: "Semester", render: (item) => (
              <span className="text-gray-500">{String(item.semesterName || "—")}</span>
            )},
            { key: "actions", label: "", className: "w-32", render: (item) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewStudents({ id: String(item.id), name: String(item.name) })}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded"
                >
                  <Users size={12} /> Students
                </button>
                {canManage && (
                  <>
                    <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(item)} className="p-1 text-gray-400 hover:text-red-600" data-tooltip="Delete">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Section" : "Add Section"}>
        <form onSubmit={handleSubmit((data) => editItem ? updateMutation.mutate({ id: String(editItem.id), data }) : createMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. BS-1A" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
            <select {...register("yearLevelId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select year level</option>
              {yearLevels.map((y: Record<string, unknown>) => (
                <option key={String(y.id)} value={String(y.id)}>{String(y.name)}</option>
              ))}
            </select>
            {errors.yearLevelId && <p className="text-red-500 text-xs mt-1">{errors.yearLevelId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select {...register("semesterId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select semester</option>
              {semesters.map((s: Record<string, unknown>) => (
                <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>
              ))}
            </select>
            {errors.semesterId && <p className="text-red-500 text-xs mt-1">{errors.semesterId.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewStudents} onClose={() => setViewStudents(null)} title={`Students in ${viewStudents?.name ?? ""}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Students are automatically added here when enrolled in a course within this section.
          </p>

          {studentsRes === undefined ? (
            <LoadingSpinner />
          ) : sectionStudents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No students in this section yet. Enroll students in courses to populate this list.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {sectionStudents.map((s: Record<string, unknown>) => (
                <div key={String(s.id)} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{String(s.studentFirstName)} {String(s.studentLastName)}</p>
                    <p className="text-xs text-gray-500">{String(s.studentEmail)}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${s.studentFirstName} ${s.studentLastName} from this section?`)) {
                          removeMutation.mutate(String(s.id));
                        }
                      }}
                      disabled={removeMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600"
                      data-tooltip="Remove student"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
