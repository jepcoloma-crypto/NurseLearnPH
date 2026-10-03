import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal, Badge } from "@/components/shared";
import { Plus, Calendar, GraduationCap, Layers, Pencil, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const yearLevelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  programId: z.string().min(1, "Program is required"),
  order: z.coerce.number().int().min(1, "Order must be at least 1"),
});
type YearLevelFormData = z.infer<typeof yearLevelSchema>;

const semesterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});
type SemesterFormData = z.infer<typeof semesterSchema>;

const academicYearSchema = z.object({
  name: z.string().min(1, "Name is required"),
  programId: z.string().min(1, "Program is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});
type AcademicYearFormData = z.infer<typeof academicYearSchema>;

export default function AcademicSetupPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<"yearLevels" | "semesters" | "academicYears">("yearLevels");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);

  const canManage = can("enrollments.create");

  return (
    <div>
      <PageHeader
        title="Academic Setup"
        subtitle="Manage year levels, semesters, and academic years"
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: "yearLevels" as const, label: "Year Levels", icon: Layers },
          { key: "semesters" as const, label: "Semesters", icon: Calendar },
          { key: "academicYears" as const, label: "Academic Years", icon: GraduationCap },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setShowCreate(false); setEditItem(null); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "yearLevels" && (
        <YearLevelsTab canManage={canManage} showCreate={showCreate} setShowCreate={setShowCreate} editItem={editItem} setEditItem={setEditItem} />
      )}
      {tab === "semesters" && (
        <SemestersTab canManage={canManage} showCreate={showCreate} setShowCreate={setShowCreate} editItem={editItem} setEditItem={setEditItem} />
      )}
      {tab === "academicYears" && (
        <AcademicYearsTab canManage={canManage} showCreate={showCreate} setShowCreate={setShowCreate} editItem={editItem} setEditItem={setEditItem} />
      )}
    </div>
  );
}

function YearLevelsTab({ canManage, showCreate, setShowCreate, editItem, setEditItem }: {
  canManage: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  editItem: Record<string, unknown> | null;
  setEditItem: (v: Record<string, unknown> | null) => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["year-levels", page],
    queryFn: () => academicApi.listYearLevels({ page: String(page), limit: "15" }),
  });

  const { data: programsRes } = useQuery({
    queryKey: ["programs"],
    queryFn: () => academicApi.listPrograms({ limit: "100" }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const programs = programsRes?.data?.data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<YearLevelFormData>({
    resolver: zodResolver(yearLevelSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: YearLevelFormData) => academicApi.createYearLevel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year-levels"] });
      toast.success("Year level created");
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to create year level");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: YearLevelFormData }) => academicApi.updateYearLevel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year-levels"] });
      toast.success("Year level updated");
      setEditItem(null);
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to update year level");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteYearLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year-levels"] });
      toast.success("Year level deleted");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to delete year level");
    },
  });

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      name: String(item.name || ""),
      programId: String(item.programId || ""),
      order: Number(item.order || 1),
    });
  };

  const handleDelete = (item: Record<string, unknown>) => {
    if (window.confirm("Are you sure you want to delete this year level?")) {
      deleteMutation.mutate(String(item.id));
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        {canManage && (
          <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}>
            <Plus size={16} /> Add Year Level
          </Button>
        )}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "order", label: "Order", className: "w-20", render: (item) => (
              <span className="font-medium text-gray-700">{String(item.order)}</span>
            )},
            { key: "name", label: "Name", render: (item) => (
              <span className="font-medium">{String(item.name)}</span>
            )},
            { key: "programName", label: "Program", render: (item) => (
              <span className="text-gray-500">{String(item.programName || "—")}</span>
            )},
            { key: "actions", label: "", className: "w-24", render: (item) => canManage ? (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1 text-gray-400 hover:text-red-600" data-tooltip="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null },
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate || !!editItem} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Year Level" : "Add Year Level"}>
        <form onSubmit={handleSubmit((d) => {
          if (editItem) {
            updateMutation.mutate({ id: String(editItem.id), data: d });
          } else {
            createMutation.mutate(d);
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 1st Year" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
            <select {...register("programId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select program</option>
              {programs.map((p: Record<string, unknown>) => (
                <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
              ))}
            </select>
            {errors.programId && <p className="text-red-500 text-xs mt-1">{errors.programId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <input type="number" {...register("order")} className="w-full px-3 py-2 border rounded-lg" min={1} />
            {errors.order && <p className="text-red-500 text-xs mt-1">{errors.order.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function SemestersTab({ canManage, showCreate, setShowCreate, editItem, setEditItem }: {
  canManage: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  editItem: Record<string, unknown> | null;
  setEditItem: (v: Record<string, unknown> | null) => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["semesters", page],
    queryFn: () => academicApi.listSemesters({ page: String(page), limit: "15" }),
  });

  const { data: academicYearsRes } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => academicApi.listAcademicYears({ limit: "100" }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const academicYears = academicYearsRes?.data?.data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SemesterFormData>({
    resolver: zodResolver(semesterSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: SemesterFormData) => academicApi.createSemester(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      toast.success("Semester created");
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to create semester");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SemesterFormData }) => academicApi.updateSemester(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      toast.success("Semester updated");
      setEditItem(null);
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to update semester");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteSemester(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      toast.success("Semester deleted");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to delete semester");
    },
  });

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      name: String(item.name || ""),
      academicYearId: String(item.academicYearId || ""),
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : "",
    });
  };

  const handleDelete = (item: Record<string, unknown>) => {
    if (window.confirm("Are you sure you want to delete this semester?")) {
      deleteMutation.mutate(String(item.id));
    }
  };

  const formatDate = (d: unknown) => d ? new Date(String(d)).toLocaleDateString() : "—";

  return (
    <>
      <div className="flex justify-end mb-4">
        {canManage && (
          <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}>
            <Plus size={16} /> Add Semester
          </Button>
        )}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "name", label: "Name", render: (item) => (
              <span className="font-medium">{String(item.name)}</span>
            )},
            { key: "academicYearName", label: "Academic Year", render: (item) => (
              <span className="text-gray-500">{String(item.academicYearName || "—")}</span>
            )},
            { key: "startDate", label: "Start", render: (item) => (
              <span className="text-gray-500">{formatDate(item.startDate)}</span>
            )},
            { key: "endDate", label: "End", render: (item) => (
              <span className="text-gray-500">{formatDate(item.endDate)}</span>
            )},
            { key: "isActive", label: "Status", className: "w-24", render: (item) => (
              <Badge variant={item.isActive === true ? "success" : "default"}>
                {item.isActive === true ? "Active" : "Inactive"}
              </Badge>
            )},
            { key: "actions", label: "", className: "w-24", render: (item) => canManage ? (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1 text-gray-400 hover:text-red-600" data-tooltip="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null },
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate || !!editItem} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Semester" : "Add Semester"}>
        <form onSubmit={handleSubmit((d) => {
          if (editItem) {
            updateMutation.mutate({ id: String(editItem.id), data: d });
          } else {
            createMutation.mutate(d);
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 1st Semester" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <select {...register("academicYearId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select academic year</option>
              {academicYears.map((y: Record<string, unknown>) => (
                <option key={String(y.id)} value={String(y.id)}>{String(y.name)}</option>
              ))}
            </select>
            {errors.academicYearId && <p className="text-red-500 text-xs mt-1">{errors.academicYearId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" {...register("startDate")} className="w-full px-3 py-2 border rounded-lg" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" {...register("endDate")} className="w-full px-3 py-2 border rounded-lg" />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function AcademicYearsTab({ canManage, showCreate, setShowCreate, editItem, setEditItem }: {
  canManage: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  editItem: Record<string, unknown> | null;
  setEditItem: (v: Record<string, unknown> | null) => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["academic-years", page],
    queryFn: () => academicApi.listAcademicYears({ page: String(page), limit: "15" }),
  });

  const { data: programsRes } = useQuery({
    queryKey: ["programs"],
    queryFn: () => academicApi.listPrograms({ limit: "100" }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const programs = programsRes?.data?.data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AcademicYearFormData>({
    resolver: zodResolver(academicYearSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: AcademicYearFormData) => academicApi.createAcademicYear(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year created");
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to create academic year");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcademicYearFormData }) => academicApi.updateAcademicYear(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year updated");
      setEditItem(null);
      setShowCreate(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to update academic year");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteAcademicYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Academic year deleted");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Failed to delete academic year");
    },
  });

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      name: String(item.name || ""),
      programId: String(item.programId || ""),
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : "",
    });
  };

  const handleDelete = (item: Record<string, unknown>) => {
    if (window.confirm("Are you sure you want to delete this academic year?")) {
      deleteMutation.mutate(String(item.id));
    }
  };

  const formatDate = (d: unknown) => d ? new Date(String(d)).toLocaleDateString() : "—";

  return (
    <>
      <div className="flex justify-end mb-4">
        {canManage && (
          <Button onClick={() => { setEditItem(null); reset(); setShowCreate(true); }}>
            <Plus size={16} /> Add Academic Year
          </Button>
        )}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "name", label: "Name", render: (item) => (
              <span className="font-medium">{String(item.name)}</span>
            )},
            { key: "programName", label: "Program", render: (item) => (
              <span className="text-gray-500">{String(item.programName || "—")}</span>
            )},
            { key: "startDate", label: "Start", render: (item) => (
              <span className="text-gray-500">{formatDate(item.startDate)}</span>
            )},
            { key: "endDate", label: "End", render: (item) => (
              <span className="text-gray-500">{formatDate(item.endDate)}</span>
            )},
            { key: "isActive", label: "Status", className: "w-24", render: (item) => (
              <Badge variant={item.isActive === true ? "success" : "default"}>
                {item.isActive === true ? "Active" : "Inactive"}
              </Badge>
            )},
            { key: "actions", label: "", className: "w-24", render: (item) => canManage ? (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(item)} className="p-1 text-gray-400 hover:text-primary-600" data-tooltip="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1 text-gray-400 hover:text-red-600" data-tooltip="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null },
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal open={showCreate || !!editItem} onClose={() => { setShowCreate(false); setEditItem(null); reset(); }} title={editItem ? "Edit Academic Year" : "Add Academic Year"}>
        <form onSubmit={handleSubmit((d) => {
          if (editItem) {
            updateMutation.mutate({ id: String(editItem.id), data: d });
          } else {
            createMutation.mutate(d);
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 2025-2026" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
            <select {...register("programId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select program</option>
              {programs.map((p: Record<string, unknown>) => (
                <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
              ))}
            </select>
            {errors.programId && <p className="text-red-500 text-xs mt-1">{errors.programId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" {...register("startDate")} className="w-full px-3 py-2 border rounded-lg" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" {...register("endDate")} className="w-full px-3 py-2 border rounded-lg" />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); setEditItem(null); reset(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
