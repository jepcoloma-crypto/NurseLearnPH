import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi, academicApi, aiApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, LoadingSpinner, Modal, Badge } from "@/components/shared";
import { Plus, Pencil, Trash2, FileText, Activity, Sparkles } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const lessonSchema = z.object({
  topicId: z.string().min(1, "Topic is required"),
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
});
type LessonFormData = z.infer<typeof lessonSchema>;

const materialSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["TEXT", "VIDEO", "DOCUMENT", "LINK", "IMAGE"]),
  content: z.string().optional(),
  url: z.string().optional(),
  isRequired: z.boolean(),
});
type MaterialFormData = z.infer<typeof materialSchema>;

const activitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["READING", "VIDEO_WATCH", "QUIZ", "REFLECTION", "CASE_STUDY", "DISCUSSION", "PRACTICE", "ASSIGNMENT"]),
  description: z.string().optional(),
  instructions: z.string().optional(),
  points: z.coerce.number().min(0),
  isRequired: z.boolean(),
});
type ActivityFormData = z.infer<typeof activitySchema>;

export default function LessonsPage() {
  const { can, user } = usePermissions();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const [editLesson, setEditLesson] = useState<Record<string, unknown> | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Record<string, unknown> | null>(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [editMaterial, setEditMaterial] = useState<Record<string, unknown> | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [editActivity, setEditActivity] = useState<Record<string, unknown> | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [showAiExtract, setShowAiExtract] = useState(false);
  const [aiResult, setAiResult] = useState<{ summary: string; keyConcepts: string[]; learningObjectives: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: coursesRes } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "200", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });

  const { data: topicsRes } = useQuery({
    queryKey: ["topics-list", selectedCourseId, isInstructor ? user?.id : undefined],
    queryFn: () => learningApi.listTopics({ courseId: selectedCourseId || undefined, limit: "200", ...(!selectedCourseId && isInstructor && user ? { instructorId: user.id } : {}) }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["lessons", page, isInstructor ? user?.id : undefined],
    queryFn: () => learningApi.listLessons({ page: String(page), limit: "15", ...(isInstructor && user ? { instructorId: user.id } : {}) }),
  });

  const { data: materialsRes, isLoading: loadingMaterials } = useQuery({
    queryKey: ["materials", selectedLesson?.id],
    queryFn: () => learningApi.listMaterials(String(selectedLesson!.id)),
    enabled: !!selectedLesson && showMaterials,
  });

  const { data: activitiesRes, isLoading: loadingActivities } = useQuery({
    queryKey: ["activities", selectedLesson?.id],
    queryFn: () => learningApi.listActivities(String(selectedLesson!.id)),
    enabled: !!selectedLesson && showActivities,
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courseList = coursesRes?.data?.data?.items ?? [];
  const topicList = topicsRes?.data?.data?.items ?? [];
  const materialItems = materialsRes?.data?.data ?? [];
  const activityItems = activitiesRes?.data?.data ?? [];

  const canCreate = can("topics.create");
  const canEdit = can("topics.edit");

  const lessonForm = useForm<LessonFormData>({ resolver: zodResolver(lessonSchema), defaultValues: {} });
  const materialForm = useForm<MaterialFormData>({ resolver: zodResolver(materialSchema), defaultValues: { isRequired: true } });
  const activityForm = useForm<ActivityFormData>({ resolver: zodResolver(activitySchema), defaultValues: { points: 0, isRequired: true } });

  const createLesson = useMutation({
    mutationFn: (data: LessonFormData) => learningApi.createLesson(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lessons"] }); toast.success("Lesson created"); setShowCreateLesson(false); lessonForm.reset(); },
    onError: () => toast.error("Failed to create lesson"),
  });

  const updateLesson = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LessonFormData }) => learningApi.updateLesson(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lessons"] }); toast.success("Lesson updated"); setEditLesson(null); lessonForm.reset(); },
    onError: () => toast.error("Failed to update lesson"),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: string) => learningApi.deleteLesson(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lessons"] }); toast.success("Lesson deleted"); },
    onError: () => toast.error("Failed to delete lesson"),
  });

  const createMaterial = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: MaterialFormData }) => learningApi.createMaterial(lessonId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["materials"] }); toast.success("Material added"); setShowCreateMaterial(false); materialForm.reset(); },
    onError: () => toast.error("Failed to add material"),
  });

  const updateMaterial = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MaterialFormData }) => learningApi.updateMaterial(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["materials"] }); toast.success("Material updated"); setEditMaterial(null); materialForm.reset(); },
    onError: () => toast.error("Failed to update material"),
  });

  const deleteMaterial = useMutation({
    mutationFn: (id: string) => learningApi.deleteMaterial(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["materials"] }); toast.success("Material deleted"); },
    onError: () => toast.error("Failed to delete material"),
  });

  const createActivity = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: ActivityFormData }) => learningApi.createActivity(lessonId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["activities"] }); toast.success("Activity added"); setShowCreateActivity(false); activityForm.reset(); },
    onError: () => toast.error("Failed to add activity"),
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActivityFormData }) => learningApi.updateActivity(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["activities"] }); toast.success("Activity updated"); setEditActivity(null); activityForm.reset(); },
    onError: () => toast.error("Failed to update activity"),
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => learningApi.deleteActivity(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["activities"] }); toast.success("Activity deleted"); },
    onError: () => toast.error("Failed to delete activity"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, dest }: { file: File; dest: string }) => learningApi.uploadFile(file, dest),
    onSuccess: (res) => {
      toast.success("File uploaded");
      return res.data?.data;
    },
    onError: () => toast.error("Upload failed"),
  });

  const handleAiExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await aiApi.analyzeFile({ fileName: file.name, mimeType: file.type, fileBase64: base64 });
      setAiResult(res.data?.data ?? res.data);
      setShowAiExtract(true);
    } catch {
      toast.error("AI analysis failed");
    } finally {
      setAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyAiSuggestions = () => {
    if (!aiResult) return;
    lessonForm.setValue("title", aiResult.summary?.split("\n")[0]?.slice(0, 100) || "");
    lessonForm.setValue("content", aiResult.summary || "");
    setShowAiExtract(false);
    setAiResult(null);
    setShowCreateLesson(true);
    toast.success("AI suggestions applied to lesson form");
  };

  const openCreateLesson = () => {
    lessonForm.reset({ topicId: "", title: "", content: "" });
    setShowCreateLesson(true);
  };

  const openEditLesson = (item: Record<string, unknown>) => {
    setEditLesson(item);
    lessonForm.reset({
      topicId: String(item.topicId || ""),
      title: String(item.title || ""),
      content: String(item.content || ""),
    });
  };

  const openEditMaterial = (item: Record<string, unknown>) => {
    setEditMaterial(item);
    materialForm.reset({
      title: String(item.title || ""),
      type: (String(item.type) as MaterialFormData["type"]) || "TEXT",
      content: String(item.content || ""),
      url: String(item.url || ""),
      isRequired: Boolean(item.isRequired),
    });
  };

  const openEditActivity = (item: Record<string, unknown>) => {
    setEditActivity(item);
    activityForm.reset({
      title: String(item.title || ""),
      type: (String(item.type) as ActivityFormData["type"]) || "READING",
      description: String(item.description || ""),
      instructions: String(item.instructions || ""),
      points: Number(item.points || 0),
      isRequired: Boolean(item.isRequired),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadMutation.mutateAsync({ file, dest: "documents" });
    const data = result.data?.data;
    if (data) {
      materialForm.setValue("url", data.url);
      materialForm.setValue("type", "DOCUMENT");
      toast.success(`Uploaded: ${data.originalName}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      TEXT: "bg-gray-100 text-gray-700", VIDEO: "bg-purple-100 text-purple-700",
      DOCUMENT: "bg-blue-100 text-blue-700", LINK: "bg-green-100 text-green-700",
      IMAGE: "bg-pink-100 text-pink-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const activityTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      READING: "bg-blue-100 text-blue-700", VIDEO_WATCH: "bg-purple-100 text-purple-700",
      QUIZ: "bg-red-100 text-red-700", REFLECTION: "bg-yellow-100 text-yellow-700",
      CASE_STUDY: "bg-green-100 text-green-700", DISCUSSION: "bg-indigo-100 text-indigo-700",
      PRACTICE: "bg-orange-100 text-orange-700", ASSIGNMENT: "bg-pink-100 text-pink-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  return (
    <div>
      <PageHeader
        title="Lessons"
        subtitle="Manage lessons, materials, and learning activities"
        actions={canCreate ? <Button onClick={openCreateLesson}><Plus size={16} /> Add Lesson</Button> : undefined}
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Course</label>
        <select
          value={selectedCourseId}
          onChange={(e) => { setSelectedCourseId(e.target.value); setPage(1); }}
          className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All courses</option>
          {courseList.map((c: Record<string, unknown>) => (
            <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>
          ))}
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "title", label: "Title", render: (item) => <span className="font-medium">{String(item.title)}</span> },
            { key: "topicName", label: "Topic", render: (item) => <span className="text-gray-500">{String(item.topicName || "—")}</span> },
            { key: "actions", label: "", className: "w-32", render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && <button onClick={() => openEditLesson(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit"><Pencil size={14} className="text-gray-500" /></button>}
                {canEdit && <button onClick={() => { setSelectedLesson(item); setShowMaterials(true); }} className="p-1 hover:bg-blue-50 rounded" data-tooltip="Materials"><FileText size={14} className="text-blue-500" /></button>}
                {canEdit && <button onClick={() => { setSelectedLesson(item); setShowActivities(true); }} className="p-1 hover:bg-green-50 rounded" data-tooltip="Activities"><Activity size={14} className="text-green-500" /></button>}
                {canEdit && <button onClick={() => { if (window.confirm("Delete this lesson?")) deleteLesson.mutate(String(item.id)); }} className="p-1 hover:bg-red-50 rounded" data-tooltip="Delete"><Trash2 size={14} className="text-red-500" /></button>}
              </div>
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      {/* Lesson Create/Edit Modal */}
      <Modal open={showCreateLesson} onClose={() => setShowCreateLesson(false)} title="Add Lesson">
        <form onSubmit={lessonForm.handleSubmit((d: LessonFormData) => createLesson.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select course</option>
              {courseList.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} - {String(c.name)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select {...lessonForm.register("topicId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select topic</option>
              {topicList.map((t: Record<string, unknown>) => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}
            </select>
            {lessonForm.formState.errors.topicId && <p className="text-red-500 text-xs mt-1">{lessonForm.formState.errors.topicId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...lessonForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea {...lessonForm.register("content")} className="w-full px-3 py-2 border rounded-lg" rows={4} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateLesson(false)}>Cancel</Button>
            <Button type="submit" disabled={createLesson.isPending}>{createLesson.isPending ? "Creating..." : "Create"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editLesson} onClose={() => { setEditLesson(null); lessonForm.reset(); }} title="Edit Lesson">
        <form onSubmit={lessonForm.handleSubmit((d: LessonFormData) => updateLesson.mutate({ id: String(editLesson?.id), data: d }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select {...lessonForm.register("topicId")} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select topic</option>
              {topicList.map((t: Record<string, unknown>) => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...lessonForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea {...lessonForm.register("content")} className="w-full px-3 py-2 border rounded-lg" rows={4} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditLesson(null); lessonForm.reset(); }}>Cancel</Button>
            <Button type="submit" disabled={updateLesson.isPending}>{updateLesson.isPending ? "Updating..." : "Update"}</Button>
          </div>
        </form>
      </Modal>

      {/* Materials Modal */}
      <Modal open={showMaterials} onClose={() => { setShowMaterials(false); setSelectedLesson(null); }} title={`Materials — ${selectedLesson?.title ?? ""}`}>
        <div className="mb-3">
          <Button size="sm" onClick={() => setShowCreateMaterial(true)}><Plus size={14} /> Add Material</Button>
        </div>
        {loadingMaterials ? <LoadingSpinner /> : materialItems.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No materials yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {materialItems.map((m: Record<string, unknown>) => (
              <div key={String(m.id)} className="flex items-center justify-between py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{String(m.title)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${typeBadge(String(m.type))}`}>{String(m.type)}</span>
                    {Boolean(m.isRequired) && <span className="text-xs text-red-500">Required</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => openEditMaterial(m)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit"><Pencil size={12} /></button>
                  <button onClick={() => { if (window.confirm("Delete material?")) deleteMaterial.mutate(String(m.id)); }} className="p-1 hover:bg-red-50 rounded" data-tooltip="Delete"><Trash2 size={12} className="text-red-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Material Create/Edit Modal */}
      <Modal open={showCreateMaterial} onClose={() => setShowCreateMaterial(false)} title="Add Material">
        <form onSubmit={materialForm.handleSubmit((d: MaterialFormData) => createMaterial.mutate({ lessonId: String(selectedLesson?.id), data: d }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...materialForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select {...materialForm.register("type")} className="w-full px-3 py-2 border rounded-lg">
              <option value="TEXT">Text</option>
              <option value="DOCUMENT">Document</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="LINK">Link</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content / URL</label>
            <textarea {...materialForm.register("content")} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Text content or paste URL" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Or extract content with AI</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="file" onChange={handleAiExtract} className="hidden" accept=".pdf,.docx,.doc,.txt,.pptx,.xlsx" />
              <span className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" aria-busy={aiLoading}>
                <Sparkles size={16} />
                {aiLoading ? "Analyzing..." : "AI Extract"}
              </span>
            </label>
          </div>
          <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...materialForm.register("isRequired")} className="rounded" />
                Required
              </label>
            </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateMaterial(false)}>Cancel</Button>
            <Button type="submit" disabled={createMaterial.isPending}>{createMaterial.isPending ? "Adding..." : "Add"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editMaterial} onClose={() => { setEditMaterial(null); materialForm.reset(); }} title="Edit Material">
        <form onSubmit={materialForm.handleSubmit((d: MaterialFormData) => updateMaterial.mutate({ id: String(editMaterial?.id), data: d }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...materialForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select {...materialForm.register("type")} className="w-full px-3 py-2 border rounded-lg">
              <option value="TEXT">Text</option>
              <option value="DOCUMENT">Document</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="LINK">Link</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content / URL</label>
            <textarea {...materialForm.register("content")} className="w-full px-3 py-2 border rounded-lg" rows={3} />
          </div>
          <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...materialForm.register("isRequired")} className="rounded" />
                Required
              </label>
            </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditMaterial(null); materialForm.reset(); }}>Cancel</Button>
            <Button type="submit" disabled={updateMaterial.isPending}>{updateMaterial.isPending ? "Updating..." : "Update"}</Button>
          </div>
        </form>
      </Modal>

      {/* Activities Modal */}
      <Modal open={showActivities} onClose={() => { setShowActivities(false); setSelectedLesson(null); }} title={`Activities — ${selectedLesson?.title ?? ""}`}>
        <div className="mb-3">
          <Button size="sm" onClick={() => setShowCreateActivity(true)}><Plus size={14} /> Add Activity</Button>
        </div>
        {loadingActivities ? <LoadingSpinner /> : activityItems.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No activities yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {activityItems.map((a: Record<string, unknown>) => (
              <div key={String(a.id)} className="flex items-center justify-between py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{String(a.title)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${activityTypeBadge(String(a.type))}`}>{String(a.type).replace("_", " ")}</span>
                    <span className="text-xs text-gray-500">{String(a.points)} pts</span>
                    {Boolean(a.isRequired) && <span className="text-xs text-red-500">Required</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => openEditActivity(a)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit"><Pencil size={12} /></button>
                  <button onClick={() => { if (window.confirm("Delete activity?")) deleteActivity.mutate(String(a.id)); }} className="p-1 hover:bg-red-50 rounded" data-tooltip="Delete"><Trash2 size={12} className="text-red-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Activity Create/Edit Modal */}
      <Modal open={showCreateActivity} onClose={() => setShowCreateActivity(false)} title="Add Activity">
        <form onSubmit={activityForm.handleSubmit((d: ActivityFormData) => createActivity.mutate({ lessonId: String(selectedLesson?.id), data: d }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...activityForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select {...activityForm.register("type")} className="w-full px-3 py-2 border rounded-lg">
              <option value="READING">Reading</option>
              <option value="VIDEO_WATCH">Video Watch</option>
              <option value="QUIZ">Quiz</option>
              <option value="REFLECTION">Reflection</option>
              <option value="CASE_STUDY">Case Study</option>
              <option value="DISCUSSION">Discussion</option>
              <option value="PRACTICE">Practice</option>
              <option value="ASSIGNMENT">Assignment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...activityForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea {...activityForm.register("instructions")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
              <input type="number" {...activityForm.register("points")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...activityForm.register("isRequired")} className="rounded" />
            <label className="text-sm">Required</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateActivity(false)}>Cancel</Button>
            <Button type="submit" disabled={createActivity.isPending}>{createActivity.isPending ? "Adding..." : "Add"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editActivity} onClose={() => { setEditActivity(null); activityForm.reset(); }} title="Edit Activity">
        <form onSubmit={activityForm.handleSubmit((d: ActivityFormData) => updateActivity.mutate({ id: String(editActivity?.id), data: d }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...activityForm.register("title")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select {...activityForm.register("type")} className="w-full px-3 py-2 border rounded-lg">
              <option value="READING">Reading</option>
              <option value="VIDEO_WATCH">Video Watch</option>
              <option value="QUIZ">Quiz</option>
              <option value="REFLECTION">Reflection</option>
              <option value="CASE_STUDY">Case Study</option>
              <option value="DISCUSSION">Discussion</option>
              <option value="PRACTICE">Practice</option>
              <option value="ASSIGNMENT">Assignment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...activityForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea {...activityForm.register("instructions")} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
              <input type="number" {...activityForm.register("points")} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...activityForm.register("isRequired")} className="rounded" />
            <label className="text-sm">Required</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setEditActivity(null); activityForm.reset(); }}>Cancel</Button>
            <Button type="submit" disabled={updateActivity.isPending}>{updateActivity.isPending ? "Updating..." : "Update"}</Button>
          </div>
        </form>
      </Modal>
      {/* AI Extract Modal */}
      <Modal open={showAiExtract} onClose={() => { setShowAiExtract(false); setAiResult(null); }} title="AI Analysis Result">
        {aiResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="info"><Sparkles size={12} /> AI Generated</Badge>
              <span className="text-xs text-gray-400">Powered by Gemini</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Summary</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{aiResult.summary}</p>
            </div>
            {aiResult.keyConcepts?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Key Concepts</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-0.5">
                  {aiResult.keyConcepts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {aiResult.learningObjectives?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Learning Objectives</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-0.5">
                  {aiResult.learningObjectives.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setShowAiExtract(false); setAiResult(null); }}>Close</Button>
              <Button type="button" onClick={applyAiSuggestions}><Sparkles size={14} /> Apply to Lesson</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
