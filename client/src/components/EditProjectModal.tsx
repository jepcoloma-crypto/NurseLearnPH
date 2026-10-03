import { useMutation } from "@tanstack/react-query";
import { researchApi } from "@/services/api";
import { Button, Modal } from "@/components/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const editSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  researchType: z.enum(["QUASI_EXPERIMENTAL", "EXPERIMENTAL", "CORRELATIONAL", "QUALITATIVE", "MIXED_METHODS"]),
  fundingSource: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CLOSED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  irbNumber: z.string().max(100).optional(),
  irbApprovalDate: z.string().optional(),
});
type EditFormData = z.infer<typeof editSchema>;

interface EditProjectModalProps {
  project: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}

const toDayInput = (v: unknown): string =>
  typeof v === "string" && v ? v.substring(0, 10) : "";

const toIso = (v: string | undefined | null): string | null =>
  v ? new Date(v).toISOString() : null;

export default function EditProjectModal({ project, onClose, onSaved }: EditProjectModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: String(project.title ?? ""),
      description: String(project.description ?? ""),
      researchType: String(project.researchType ?? "QUASI_EXPERIMENTAL") as EditFormData["researchType"],
      fundingSource: String(project.fundingSource ?? ""),
      status: String(project.status ?? "PLANNING") as EditFormData["status"],
      startDate: toDayInput(project.startDate),
      endDate: toDayInput(project.endDate),
      irbNumber: String(project.irbNumber ?? ""),
      irbApprovalDate: toDayInput(project.irbApprovalDate),
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditFormData) =>
      researchApi.updateProject(String(project.id), {
        title: data.title,
        description: data.description,
        researchType: data.researchType,
        fundingSource: data.fundingSource,
        status: data.status,
        startDate: toIso(data.startDate),
        endDate: toIso(data.endDate),
        irbNumber: data.irbNumber || null,
        irbApprovalDate: toIso(data.irbApprovalDate),
      }),
    onSuccess: () => {
      toast.success("Research project updated!");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Failed to update project"),
  });

  const label = "block text-sm font-medium text-gray-700 mb-1";
  const input = "w-full px-3 py-2 border rounded-lg";

  return (
    <Modal open onClose={onClose} title="Edit Research Project" size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className={label}>Title</label>
          <input {...register("title")} className={input} />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea {...register("description")} className={input} rows={3} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Research Type</label>
            <select {...register("researchType")} className={input}>
              <option value="QUASI_EXPERIMENTAL">Quasi-Experimental</option>
              <option value="EXPERIMENTAL">Experimental</option>
              <option value="CORRELATIONAL">Correlational</option>
              <option value="QUALITATIVE">Qualitative</option>
              <option value="MIXED_METHODS">Mixed Methods</option>
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select {...register("status")} className={input}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className={label}>Funding Source</label>
            <input {...register("fundingSource")} className={input} placeholder="Optional" />
          </div>
          <div>
            <label className={label}>IRB Number</label>
            <input {...register("irbNumber")} className={input} placeholder="e.g. IRB-2026-014" />
            {errors.irbNumber && <p className="text-red-500 text-xs mt-1">{errors.irbNumber.message}</p>}
          </div>
          <div>
            <label className={label}>Start Date</label>
            <input type="date" {...register("startDate")} className={input} />
            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className={label}>End Date</label>
            <input type="date" {...register("endDate")} className={input} />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
          </div>
          <div>
            <label className={label}>IRB Approval Date</label>
            <input type="date" {...register("irbApprovalDate")} className={input} />
            {errors.irbApprovalDate && <p className="text-red-500 text-xs mt-1">{errors.irbApprovalDate.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
