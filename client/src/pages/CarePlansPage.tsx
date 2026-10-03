import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { nursingProcessApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  courseId: z.string().min(1, "Course is required"),
  patientName: z.string().optional(),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().optional(),
  medicalDiagnosis: z.string().optional(),
  subjectiveData: z.string().optional(),
  objectiveData: z.string().optional(),
});
type CreateFormData = z.infer<typeof createSchema>;

const STATUS_VARIANT: Record<string, "default" | "success" | "info" | "warning" | "danger"> = {
  DRAFT: "default",
  SUBMITTED: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  RETURNED: "danger",
  ACTIVE: "success",
  COMPLETED: "info",
  ARCHIVED: "default",
};

export default function CarePlansPage() {
  const navigate = useNavigate();
  const { can, user } = usePermissions();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["care-plans", page, statusFilter, isInstructor ? user?.id : undefined],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: "15" };
      if (statusFilter) params.status = statusFilter;
      if (isInstructor && user) params.instructorId = user.id;
      return nursingProcessApi.listCarePlans(params);
    },
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses-for-care-plan", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", instructorId: isInstructor ? user!.id : undefined }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courses = coursesData?.data?.data?.items ?? [];
  const canCreate = can("careplans.create");
  const canEdit = can("careplans.edit");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
  });

  const onCreate = async (formData: CreateFormData) => {
    try {
      await nursingProcessApi.createCarePlan(formData);
      toast.success("Care plan created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create care plan");
    }
  };

  const onEdit = async (formData: CreateFormData) => {
    try {
      await nursingProcessApi.updateCarePlan(String(editItem?.id), formData);
      toast.success("Care plan updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update care plan");
    }
  };

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this care plan?")) return;
    try {
      await nursingProcessApi.deleteCarePlan(String(item.id));
      toast.success("Care plan deleted");
      refetch();
    } catch {
      toast.error("Failed to delete care plan");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      title: String(item.title || ""),
      courseId: String(item.courseId || ""),
      patientName: String(item.patientName || ""),
      patientAge: item.patientAge ? Number(item.patientAge) : undefined,
      patientGender: String(item.patientGender || ""),
      medicalDiagnosis: String(item.medicalDiagnosis || ""),
      subjectiveData: String(item.subjectiveData || ""),
      objectiveData: String(item.objectiveData || ""),
    });
  };

  return (
    <div>
      <PageHeader
        title="Care Plans"
        subtitle="Nursing care plan management"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Care Plan</Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="RETURNED">Returned</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "title", label: "Title", render: (item) => (
              <button onClick={() => navigate(`/care-plans/${item.id}`)} className="text-primary-600 hover:underline font-medium">
                {String(item.title)}
              </button>
            )},
            { key: "patientName", label: "Patient", render: (item) => (
              <span>{String(item.patientName || "-")}</span>
            )},
            { key: "medicalDiagnosis", label: "Medical Dx", render: (item) => (
              <span className="line-clamp-1 max-w-[200px] text-gray-500">{String(item.medicalDiagnosis || "-")}</span>
            )},
            { key: "courseId", label: "Course", render: (item) => {
              const course = courses.find((c: Record<string, unknown>) => c.id === item.courseId);
              return <span>{course ? String(course.name) : "-"}</span>;
            }},
            { key: "status", label: "Status", className: "w-28", render: (item) => (
              <Badge variant={STATUS_VARIANT[String(item.status)] || "default"}>
                {String(item.status).replace("_", " ")}
              </Badge>
            )},
            { key: "createdAt", label: "Created", className: "w-32", render: (item) => (
              <span>{new Date(String(item.createdAt)).toLocaleDateString()}</span>
            )},
            { key: "actions", label: "Actions", className: "w-24", render: (item) => (
              <div className="flex items-center gap-1">
                <button onClick={() => navigate(`/care-plans/${item.id}`)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="View">
                  <Eye size={16} className="text-gray-500" />
                </button>
                {canEdit && ["DRAFT", "RETURNED"].includes(String(item.status)) && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
                {canEdit && String(item.status) === "DRAFT" && (
                  <button onClick={() => onDelete(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Delete">
                    <Trash2 size={16} className="text-red-500" />
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Care Plan">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Care Plan for Patient with Pneumonia" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">-- Select Course --</option>
              {courses.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <input {...register("patientName")} className="w-full px-3 py-2 border rounded-lg" placeholder="Juan Dela Cruz" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Diagnosis</label>
              <input {...register("medicalDiagnosis")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Community-Acquired Pneumonia" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
              <input type="number" {...register("patientAge")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Gender</label>
              <select {...register("patientGender")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">--</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subjective Data</label>
            <textarea {...register("subjectiveData")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="What the patient says: complaints, feelings, symptoms..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objective Data</label>
            <textarea {...register("objectiveData")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Vital signs, physical exam findings, lab results..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Care Plan">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select {...register("courseId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">-- Select Course --</option>
              {courses.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <input {...register("patientName")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Diagnosis</label>
              <input {...register("medicalDiagnosis")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
              <input type="number" {...register("patientAge")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Gender</label>
              <select {...register("patientGender")} className="w-full px-3 py-2 border rounded-lg">
                <option value="">--</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subjective Data</label>
            <textarea {...register("subjectiveData")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objective Data</label>
            <textarea {...register("objectiveData")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
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
