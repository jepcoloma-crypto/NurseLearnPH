import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nursingProcessApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  definition: z.string().optional(),
  relatedFactors: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function DiagnosesPage() {
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["diagnoses", page],
    queryFn: () => nursingProcessApi.listDiagnoses({ page: String(page), limit: "15" }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const canCreate = can("diagnoses.create");
  const canEdit = can("diagnoses.edit");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onCreate = async (formData: FormData) => {
    try {
      const payload = {
        ...formData,
        relatedFactors: formData.relatedFactors ? formData.relatedFactors.split(",").map(s => s.trim()) : [],
      };
      await nursingProcessApi.createDiagnosis(payload);
      toast.success("Diagnosis created");
      setShowCreate(false);
      reset();
      refetch();
    } catch {
      toast.error("Failed to create diagnosis");
    }
  };

  const onEdit = async (formData: FormData) => {
    try {
      const payload = {
        ...formData,
        relatedFactors: formData.relatedFactors ? formData.relatedFactors.split(",").map(s => s.trim()) : [],
      };
      await nursingProcessApi.updateDiagnosis(String(editItem?.id), payload);
      toast.success("Diagnosis updated");
      setEditItem(null);
      reset();
      refetch();
    } catch {
      toast.error("Failed to update diagnosis");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    reset({
      code: String(item.code || ""),
      name: String(item.name || ""),
      definition: String(item.definition || ""),
      relatedFactors: Array.isArray(item.relatedFactors) ? (item.relatedFactors as string[]).join(", ") : String(item.relatedFactors || ""),
    });
  };

  return (
    <div>
      <PageHeader
        title="Nursing Diagnoses"
        subtitle="NANDA nursing diagnoses reference"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Add Diagnosis</Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "code", label: "Code", className: "w-28" },
            { key: "name", label: "Diagnosis" },
            { key: "definition", label: "Definition", render: (item) => (
              <span className="line-clamp-1 max-w-lg text-gray-500">{String(item.definition || "")}</span>
            )},
            { key: "actions", label: "Actions", className: "w-16", render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                    <Pencil size={16} className="text-gray-500" />
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Nursing Diagnosis">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NANDA Code</label>
            <input {...register("code")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 00001" />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Acute Pain" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Definition</label>
            <textarea {...register("definition")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Factors (comma-separated)</label>
            <input {...register("relatedFactors")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. tissue trauma, surgical incision" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); reset(); }} title="Edit Nursing Diagnosis">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NANDA Code</label>
            <input {...register("code")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 00001" />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Name</label>
            <input {...register("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Acute Pain" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Definition</label>
            <textarea {...register("definition")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Factors (comma-separated)</label>
            <input {...register("relatedFactors")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. tissue trauma, surgical incision" />
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
