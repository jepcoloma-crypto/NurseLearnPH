import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { researchApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal } from "@/components/shared";
import EditProjectModal from "@/components/EditProjectModal";
import { Plus, Pencil, Trash2, FlaskConical, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  researchType: z.enum(["QUASI_EXPERIMENTAL", "EXPERIMENTAL", "CORRELATIONAL", "QUALITATIVE", "MIXED_METHODS"]),
  fundingSource: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ResearchPage() {
  const { can, user } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [page, setPage] = useState(1);
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["research-projects", page, isInstructor ? user?.id : undefined],
    queryFn: () => researchApi.listProjects({ page: String(page), limit: "15", instructorId: isInstructor ? user!.id : undefined }),
  });

  const projectList = projects?.data?.data?.items ?? [];
  const pagination = projects?.data?.data?.pagination;
  const canCreate = can("research.create");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { researchType: "QUASI_EXPERIMENTAL" },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => researchApi.createProject(data),
    onSuccess: () => {
      toast.success("Research project created!");
      setShowCreate(false);
      reset();
      refetch();
    },
    onError: () => toast.error("Failed to create project"),
  });

  const onCreate = (data: FormData) => {
    createMutation.mutate(data);
  };

  const deleteMutation = useMutation({
    mutationFn: (pid: string) => researchApi.deleteProject(pid),
    onSuccess: () => {
      toast.success("Research project deleted");
      refetch();
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const onDeleteProject = (p: Record<string, unknown>) => {
    if (!window.confirm(`Delete research project "${String(p.title)}"? This also removes its cohorts, studies, participants, and test data.`)) return;
    deleteMutation.mutate(String(p.id));
  };

  const statusBadge = (s: string) => {
    const m: Record<string, "success" | "warning" | "info" | "danger"> = {
      ACTIVE: "success", PLANNING: "warning", COMPLETED: "info", CLOSED: "danger",
    };
    return <Badge variant={m[s] || "info"}>{s}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Research Analytics"
        subtitle="Research projects, cohorts, and study analytics"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Project</Button>
          ) : undefined
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectList.map((p: Record<string, unknown>) => (
              <Card key={String(p.id)}>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <FlaskConical size={18} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">
                        <Link
                          to={`/research/${String(p.id)}`}
                          className="hover:text-purple-600 hover:underline underline-offset-2"
                        >
                          {String(p.title)}
                        </Link>
                      </h3>
                      {canCreate && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            className="p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                            aria-label="Edit project"
                            title="Edit project"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(p)}
                            disabled={deleteMutation.isPending}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                            aria-label="Delete project"
                            title="Delete project"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{String(p.description || "")}</p>
                    <div className="flex gap-2 mt-3">
                      {statusBadge(String(p.status))}
                      <Badge variant="info">{String(p.researchType)}</Badge>
                    </div>
                    {typeof p.startDate === "string" && (
                      <p className="text-xs text-gray-400 mt-2">
                        Started {new Date(p.startDate).toLocaleDateString()}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t flex justify-end">
                      <Link
                        to={`/research/${String(p.id)}`}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:underline"
                      >
                        Manage details <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {projectList.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400">
                No research projects yet
              </div>
            )}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Page {page} of {pagination.totalPages} ({pagination.total} total)</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Research Project">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Effectiveness of Simulation-Based Learning" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Research Type</label>
            <select {...register("researchType")} className="w-full px-3 py-2 border rounded-lg">
              <option value="QUASI_EXPERIMENTAL">Quasi-Experimental</option>
              <option value="EXPERIMENTAL">Experimental</option>
              <option value="CORRELATIONAL">Correlational</option>
              <option value="QUALITATIVE">Qualitative</option>
              <option value="MIXED_METHODS">Mixed Methods</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Funding Source</label>
            <input {...register("fundingSource")} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      {editing && (
        <EditProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
