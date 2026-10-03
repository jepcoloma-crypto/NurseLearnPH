import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementApi, academicApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import {
  Megaphone,
  Pencil,
  Trash2,
  Send,
  Eye,
  EyeOff,
  Archive,
  RotateCcw,
  Paperclip,
  X,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

type FormState = {
  scope: "course" | "global";
  courseId: string;
  title: string;
  content: string;
  priority: string;
  audienceStudents: boolean;
  audienceInstructors: boolean;
  publishAt: string;
  expiresAt: string;
};

type AttachmentRow = {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes?: number;
};

const EMPTY_FORM: FormState = {
  scope: "course",
  courseId: "",
  title: "",
  content: "",
  priority: "NORMAL",
  audienceStudents: true,
  audienceInstructors: false,
  publishAt: "",
  expiresAt: "",
};

const toInputValue = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const errMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
};

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FILE_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export default function AnnouncementsPage() {
  const { can, user } = usePermissions();
  const queryClient = useQueryClient();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const isManager = user?.role === "ADMIN" || user?.role === "PROGRAM_COORDINATOR";
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [viewItem, rawViewItem] = useState<Record<string, unknown> | null>(null);
  // Opening an announcement marks it read for the current user (receivers only —
  // the server reports your own posts as already read). `readMutation` and
  // `invalidate` are declared further below; they run on click, after render.
  const setViewItem = (item: Record<string, unknown> | null) => {
    rawViewItem(item);
    if (item && item.read === false) {
      readMutation.mutate(String(item.id));
    }
  };
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [editFiles, setEditFiles] = useState<File[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", page, isInstructor ? user?.id : undefined, statusFilter],
    queryFn: () =>
      announcementApi.list({
        page: String(page),
        limit: "15",
        status: statusFilter || undefined,
      }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses-for-announcements", isInstructor ? user?.id : undefined],
    queryFn: () =>
      academicApi.listCourses({ limit: "100", instructorId: isInstructor ? user!.id : undefined }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const courses = coursesData?.data?.data?.items ?? [];
  const canCreate = can("announcements.create");
  const canEdit = can("announcements.edit");
  const canDelete = can("announcements.delete");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["announcements"] });

  // Attachments upload — declared before createMutation so its onSuccess can chain it.
  const attachMutation = useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      return announcementApi.addAttachments(id, fd);
    },
    onSuccess: (res, vars) => {
      setEditItem((prev) => {
        if (!prev || String(prev.id) !== vars.id) return prev;
        return {
          ...prev,
          attachments: [
            ...((prev.attachments as AttachmentRow[]) ?? []),
            ...((res.data?.data as AttachmentRow[]) ?? []),
          ],
        };
      });
    },
    onError: (err) => toast.error(errMsg(err, "Failed to upload attachments")),
  });

  const detachMutation = useMutation({
    mutationFn: ({ announcementId, attachmentId }: { announcementId: string; attachmentId: string }) =>
      announcementApi.removeAttachment(announcementId, attachmentId),
    onSuccess: (_res, vars) => {
      setEditItem((prev) => {
        if (!prev || String(prev.id) !== vars.announcementId) return prev;
        return {
          ...prev,
          attachments: ((prev.attachments as AttachmentRow[]) ?? []).filter(
            (a) => a.id !== vars.attachmentId
          ),
        };
      });
      toast.success("Attachment removed");
      invalidate();
    },
    onError: (err) => toast.error(errMsg(err, "Failed to remove attachment")),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => announcementApi.create(payload),
    onSuccess: (res) => {
      const created = res.data?.data;
      const finish = () => {
        toast.success("Announcement created");
        setShowCreate(false);
        setForm(EMPTY_FORM);
        setPendingFiles([]);
        setErrors({});
        invalidate();
      };
      if (created?.id && pendingFiles.length > 0) {
        attachMutation.mutate(
          { id: String(created.id), files: pendingFiles },
          { onSettled: finish }
        );
      } else {
        finish();
      }
    },
    onError: (err) => toast.error(errMsg(err, "Failed to create announcement")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      announcementApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Announcement updated");
      setEditItem(null);
      setForm(EMPTY_FORM);
      setErrors({});
    },
    onError: (err) => toast.error(errMsg(err, "Failed to update announcement")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      announcementApi.update(id, { status }),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.status === "PUBLISHED"
          ? "Announcement published"
          : vars.status === "ARCHIVED"
          ? "Announcement archived"
          : "Announcement moved to draft"
      );
      invalidate();
    },
    onError: (err) => toast.error(errMsg(err, "Failed to update status")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Announcement deleted");
      setEditItem(null);
    },
    onError: (err) => toast.error(errMsg(err, "Failed to delete announcement")),
  });

  // ── Read receipts ──────────────────────────────────────────────────────
  const [receiptsItem, setReceiptsItem] = useState<Record<string, unknown> | null>(null);

  const readMutation = useMutation({
    mutationFn: (id: string) => announcementApi.markRead(id),
    onSuccess: () => {
      invalidate();
      // Opening an announcement clears its bell notification for this user.
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    },
  });

  const { data: receiptsData, isLoading: receiptsPending } = useQuery({
    queryKey: ["announcements-receipts", receiptsItem?.id],
    queryFn: () => announcementApi.receipts(String(receiptsItem!.id)),
    enabled: !!receiptsItem,
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setPendingFiles([]);
    setEditFiles([]);
  };

  const validateFields = (requireCourse: boolean) => {
    const e: Record<string, string> = {};
    if (requireCourse && !form.courseId) e.courseId = "Course is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.content.trim()) e.content = "Content is required";
    if (!form.audienceStudents && !form.audienceInstructors)
      e.audience = "Select at least one audience";
    if (
      form.publishAt &&
      form.expiresAt &&
      new Date(form.publishAt).getTime() >= new Date(form.expiresAt).getTime()
    ) {
      e.publishAt = "Publish date must be before the expiry date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const datePayload = () => ({
    publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  });

  const handleCreate = (mode: "draft" | "publish") => {
    const requireCourse = form.scope === "course";
    if (!validateFields(requireCourse)) return;
    createMutation.mutate({
      courseId: form.scope === "global" ? null : form.courseId,
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      audienceStudents: form.audienceStudents,
      audienceInstructors: form.audienceInstructors,
      ...datePayload(),
      status: mode === "publish" ? "PUBLISHED" : "DRAFT",
    });
  };

  const handleEditSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateFields(false)) return;
    updateMutation.mutate({
      id: String(editItem?.id),
      data: {
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        audienceStudents: form.audienceStudents,
        audienceInstructors: form.audienceInstructors,
        ...datePayload(),
      },
    });
  };

  const uploadEditFiles = () => {
    if (!editItem || editFiles.length === 0) return;
    attachMutation.mutate(
      { id: String(editItem.id), files: editFiles },
      {
        onSettled: () => {
          setEditFiles([]);
          invalidate();
        },
      }
    );
  };

  const onDelete = (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this announcement? Its attachments are removed too.")) return;
    deleteMutation.mutate(String(item.id));
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    setForm({
      scope: item.courseId ? "course" : "global",
      courseId: String(item.courseId || ""),
      title: String(item.title || ""),
      content: String(item.content || ""),
      priority: String(item.priority || "NORMAL"),
      audienceStudents: item.audienceStudents !== false,
      audienceInstructors: item.audienceInstructors === true,
      publishAt: toInputValue(item.publishAt),
      expiresAt: toInputValue(item.expiresAt),
    });
    setEditFiles([]);
    setErrors({});
  };

  const effectiveStatus = (item: Record<string, unknown>): string => {
    const status = String(item.status || (item.isPublished ? "PUBLISHED" : "DRAFT"));
    if (status !== "PUBLISHED") return status;
    const now = Date.now();
    if (item.publishAt && new Date(String(item.publishAt)).getTime() > now) return "SCHEDULED";
    if (item.expiresAt && new Date(String(item.expiresAt)).getTime() <= now) return "EXPIRED";
    return "PUBLISHED";
  };

  const statusBadge = (s: string) => {
    const m: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
      DRAFT: "default",
      SCHEDULED: "info",
      PUBLISHED: "success",
      EXPIRED: "warning",
      ARCHIVED: "default",
    };
    return <Badge variant={m[s] || "default"}>{s}</Badge>;
  };

  const priorityBadge = (p: string) => {
    const m: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
      LOW: "default",
      NORMAL: "info",
      HIGH: "warning",
      URGENT: "danger",
    };
    return <Badge variant={m[p] || "default"}>{p}</Badge>;
  };

  const canManageItem = (item: Record<string, unknown>) => {
    if (isManager) return true;
    // The server scopes instructors to their own courses plus institution-wide
    // rows; only their course rows are manageable (globals are coord/admin-only).
    if (isInstructor) return !!item.courseId;
    return false;
  };

  const workflowButtons = (item: Record<string, unknown>) => {
    if (!canEdit || !canManageItem(item)) return null;
    const real = String(item.status || "DRAFT");
    const id = String(item.id);
    return (
      <>
        {real === "DRAFT" && (
          <button
            onClick={() => statusMutation.mutate({ id, status: "PUBLISHED" })}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            disabled={statusMutation.isPending}
            data-tooltip="Publish"
          >
            <Send size={15} className="text-green-600" />
          </button>
        )}
        {real === "PUBLISHED" && (
          <button
            onClick={() => statusMutation.mutate({ id, status: "DRAFT" })}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            disabled={statusMutation.isPending}
            data-tooltip="Unpublish (move back to draft)"
          >
            <EyeOff size={15} className="text-gray-500" />
          </button>
        )}
        {real === "ARCHIVED" && (
          <button
            onClick={() => statusMutation.mutate({ id, status: "DRAFT" })}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            disabled={statusMutation.isPending}
            data-tooltip="Restore to draft"
          >
            <RotateCcw size={15} className="text-gray-500" />
          </button>
        )}
        {real !== "ARCHIVED" && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Archive this announcement? It will no longer be visible to its audience."
                )
              ) {
                statusMutation.mutate({ id, status: "ARCHIVED" });
              }
            }}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            disabled={statusMutation.isPending}
            data-tooltip="Archive"
          >
            <Archive size={15} className="text-gray-500" />
          </button>
        )}
      </>
    );
  };

  const createModal = (
    <Modal
      open={showCreate}
      onClose={() => {
        setShowCreate(false);
        resetForm();
      }}
      title="New Announcement"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate("publish");
        }}
        className="space-y-4"
      >
        {isManager && (
          <div>
            <label className="block text-sm font-medium mb-1">Scope</label>
            <select
              value={form.scope}
              onChange={(e) =>
                setForm({ ...form, scope: e.target.value as "course" | "global" })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="course">Course announcement</option>
              <option value="global">Institution-wide (all instructors &amp; students)</option>
            </select>
          </div>
        )}
        {form.scope === "course" && (
          <div>
            <label className="block text-sm font-medium mb-1">Course</label>
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select a course</option>
              {courses.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.code)} - {String(c.name)}
                </option>
              ))}
            </select>
            {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId}</p>}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Announcement title"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={6}
            placeholder="Announcement content"
          />
          {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Audience</label>
            <div className="flex items-center gap-4 h-[38px] px-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.audienceStudents}
                  onChange={(e) => setForm({ ...form, audienceStudents: e.target.checked })}
                />
                Students
              </label>
              <label
                className="flex items-center gap-2 text-sm"
                title={
                  isInstructor ? "Instructor audience is coordinator/admin only" : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={form.audienceInstructors}
                  disabled={isInstructor}
                  onChange={(e) => setForm({ ...form, audienceInstructors: e.target.checked })}
                />
                Instructors
              </label>
            </div>
            {errors.audience && <p className="text-red-500 text-xs">{errors.audience}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Publish at (optional)</label>
            <input
              type="datetime-local"
              value={form.publishAt}
              onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            {errors.publishAt && (
              <p className="text-red-500 text-xs mt-1">{errors.publishAt}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires at (optional)</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Attach documents <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="file"
            multiple
            accept={FILE_ACCEPT}
            onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
            className="w-full text-sm"
          />
          {pendingFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {pendingFiles.map((f, idx) => (
                <li
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1.5"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip size={12} className="shrink-0 text-gray-400" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles(pendingFiles.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Files upload once the announcement is saved. PDF, DOC, DOCX, TXT, MD — max 20MB each.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowCreate(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={createMutation.isPending}
            onClick={() => handleCreate("draft")}
          >
            Save as Draft
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending
              ? "Saving..."
              : form.publishAt && new Date(form.publishAt).getTime() > Date.now()
              ? "Schedule"
              : "Publish"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  const editAttachments = (editItem?.attachments as AttachmentRow[] | undefined) ?? [];

  const editModal = (
    <Modal
      open={!!editItem}
      onClose={() => {
        setEditItem(null);
        resetForm();
      }}
      title="Edit Announcement"
    >
      <form onSubmit={handleEditSubmit} className="space-y-4">
        {editItem && (
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge(effectiveStatus(editItem))}
            <span className="text-xs text-gray-500">
              {editItem.courseId
                ? `${String(editItem.courseCode || "")} ${String(editItem.courseName || "")}`.trim()
                : "Institution-wide"}
            </span>
            <span className="text-xs text-gray-400">
              · status changes use the row buttons (publish / archive / restore)
            </span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Announcement title"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={6}
            placeholder="Announcement content"
          />
          {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Audience</label>
            <div className="flex items-center gap-4 h-[38px] px-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.audienceStudents}
                  onChange={(e) => setForm({ ...form, audienceStudents: e.target.checked })}
                />
                Students
              </label>
              <label
                className="flex items-center gap-2 text-sm"
                title={
                  isInstructor ? "Instructor audience is coordinator/admin only" : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={form.audienceInstructors}
                  disabled={isInstructor}
                  onChange={(e) => setForm({ ...form, audienceInstructors: e.target.checked })}
                />
                Instructors
              </label>
            </div>
            {errors.audience && <p className="text-red-500 text-xs">{errors.audience}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Publish at (optional)</label>
            <input
              type="datetime-local"
              value={form.publishAt}
              onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            {errors.publishAt && (
              <p className="text-red-500 text-xs mt-1">{errors.publishAt}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires at (optional)</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        {editAttachments.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Attached documents</p>
            {editAttachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1.5"
              >
                <a
                  href={a.filePath}
                  download={a.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 truncate text-primary-600 hover:underline"
                >
                  <Paperclip size={13} className="shrink-0" />
                  <span className="truncate">{a.fileName}</span>
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      detachMutation.mutate({
                        announcementId: String(editItem?.id),
                        attachmentId: a.id,
                      })
                    }
                    disabled={detachMutation.isPending}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                    title="Remove attachment"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div>
            <label className="block text-sm font-medium mb-1">Attach documents</label>
            <input
              type="file"
              multiple
              accept={FILE_ACCEPT}
              onChange={(e) => setEditFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm"
            />
            {editFiles.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {editFiles.length} file{editFiles.length > 1 ? "s" : ""} selected
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={attachMutation.isPending}
                  onClick={uploadEditFiles}
                >
                  {attachMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditItem(null);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  const viewAttachments = (viewItem?.attachments as AttachmentRow[] | undefined) ?? [];
  const viewStats =
    (viewItem?.stats as
      | { readCount: number; receiverCount: number }
      | undefined) ?? null;

  const viewModal = (
    <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Announcement">
      {viewItem && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge(effectiveStatus(viewItem))}
            {priorityBadge(String(viewItem.priority))}
            <Badge variant={viewItem.courseId ? "default" : "info"}>
              {viewItem.courseId
                ? `${String(viewItem.courseCode || "")} ${String(viewItem.courseName || "")}`.trim()
                : "Institution-wide"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Audience:</span>
            {viewItem.audienceStudents !== false && <Badge variant="default">Students</Badge>}
            {viewItem.audienceInstructors === true && <Badge variant="info">Instructors</Badge>}
          </div>

          <p className="text-xs text-gray-500">
            By{" "}
            {`${String(viewItem.authorFirstName || "")} ${String(viewItem.authorLastName || "")}`.trim() ||
              "Unknown"}{" "}
            · {new Date(String(viewItem.createdAt)).toLocaleString()}
            {!!viewItem.publishAt &&
              ` · Publishes ${new Date(String(viewItem.publishAt)).toLocaleString()}`}
            {!!viewItem.expiresAt &&
              ` · Expires ${new Date(String(viewItem.expiresAt)).toLocaleString()}`}
          </p>

          {viewStats && (
            <p className="text-sm text-gray-600">
              Seen by {viewStats.readCount} of {viewStats.receiverCount}{" "}
              {viewStats.receiverCount === 1 ? "receiver" : "receivers"}
            </p>
          )}

          <div className="text-sm text-gray-800 whitespace-pre-wrap border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
            {String(viewItem.content || "")}
          </div>

          {viewAttachments.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                Attachments ({viewAttachments.length})
              </p>
              {viewAttachments.map((a) => (
                <a
                  key={a.id}
                  href={a.filePath}
                  download={a.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm border rounded px-3 py-2 text-primary-600 hover:bg-primary-50"
                >
                  <Paperclip size={14} className="shrink-0" />
                  <span className="truncate">{a.fileName}</span>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">
                    {formatSize(a.sizeBytes)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No attachments.</p>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setViewItem(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Draft, publish and archive announcements for students and instructors"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 border rounded-lg text-sm bg-white"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
              >
                <Megaphone size={16} /> New Announcement
              </Button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={[
            {
              key: "title",
              label: "Title",
              render: (item) => (
                <span className="flex items-center gap-2">
                  {item.read === false && (
                    <span
                      className="shrink-0 w-2 h-2 rounded-full bg-amber-500"
                      title="Unread"
                    />
                  )}
                  <button
                    onClick={() => setViewItem(item)}
                    className="font-medium text-left hover:text-primary-600 hover:underline"
                  >
                    {String(item.title)}
                  </button>
                </span>
              ),
            },
            {
              key: "author",
              label: "Created by",
              className: "w-44",
              render: (item) => {
                const name =
                  `${String(item.authorFirstName || "")} ${String(
                    item.authorLastName || ""
                  )}`.trim();
                return (
                  <span className="text-sm">
                    {name || String(item.authorEmail || "—")}
                  </span>
                );
              },
            },
            {
              key: "scope",
              label: "Scope",
              className: "w-44",
              render: (item) =>
                item.courseId ? (
                  <span className="text-sm">
                    {String(item.courseCode || "")} - {String(item.courseName || "")}
                  </span>
                ) : (
                  <Badge variant="info">Institution-wide</Badge>
                ),
            },
            {
              key: "status",
              label: "Status",
              className: "w-28",
              render: (item) => statusBadge(effectiveStatus(item)),
            },
            {
              key: "audience",
              label: "Audience",
              className: "w-36",
              render: (item) => (
                <div className="flex flex-wrap gap-1">
                  {item.audienceStudents !== false && (
                    <Badge variant="default">Students</Badge>
                  )}
                  {item.audienceInstructors === true && (
                    <Badge variant="info">Instructors</Badge>
                  )}
                </div>
              ),
            },
            ...(items.some((i: Record<string, unknown>) => i.stats)
              ? [
                  {
                    key: "seen",
                    label: "Seen",
                    className: "w-24",
                    render: (item: Record<string, unknown>) => {
                      const stats = item.stats as
                        | { readCount: number; receiverCount: number }
                        | undefined;
                      if (!stats) return <span className="text-gray-300">—</span>;
                      const done =
                        stats.receiverCount > 0 &&
                        stats.readCount >= stats.receiverCount;
                      return (
                        <button
                          onClick={() => setReceiptsItem(item)}
                          className="hover:underline"
                          title="View read receipts"
                        >
                          <Badge
                            variant={
                              done
                                ? "success"
                                : stats.readCount > 0
                                ? "info"
                                : "default"
                            }
                          >
                            {stats.readCount}/{stats.receiverCount} read
                          </Badge>
                        </button>
                      );
                    },
                  },
                ]
              : []),
            {
              key: "priority",
              label: "Priority",
              className: "w-24",
              render: (item) => priorityBadge(String(item.priority)),
            },
            {
              key: "attachments",
              label: "Files",
              className: "w-20",
              render: (item) => {
                const atts = (item.attachments as AttachmentRow[] | undefined) ?? [];
                if (atts.length === 0) return <span className="text-gray-300">—</span>;
                return (
                  <div className="flex items-center gap-1">
                    {atts.slice(0, 3).map((a) => (
                      <a
                        key={a.id}
                        href={a.filePath}
                        download={a.fileName}
                        target="_blank"
                        rel="noreferrer"
                        title={a.fileName}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <Paperclip size={14} />
                      </a>
                    ))}
                    {atts.length > 3 && (
                      <span className="text-xs text-gray-400">+{atts.length - 3}</span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "createdAt",
              label: "Date",
              className: "w-28",
              render: (item) => new Date(String(item.createdAt)).toLocaleDateString(),
            },
            {
              key: "actions",
              label: "Actions",
              className: "w-44",
              render: (item) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewItem(item)}
                    className="p-1 hover:bg-gray-100 rounded"
                    data-tooltip="View"
                  >
                    <Eye size={15} className="text-gray-500" />
                  </button>
                  {workflowButtons(item)}
                  {canEdit && canManageItem(item) && (
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1 hover:bg-gray-100 rounded"
                      data-tooltip="Edit"
                    >
                      <Pencil size={15} className="text-gray-500" />
                    </button>
                  )}
                  {canDelete && canManageItem(item) && (
                    <button
                      onClick={() => onDelete(item)}
                      className="p-1 hover:bg-gray-100 rounded"
                      data-tooltip="Delete"
                    >
                      <Trash2 size={15} className="text-red-500" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal
        open={!!receiptsItem}
        onClose={() => setReceiptsItem(null)}
        title="Read receipts"
      >
        {receiptsItem &&
          (() => {
            const r = receiptsData?.data?.data as
              | {
                  receiverCount: number;
                  readCount: number;
                  unreadCount: number;
                  read: Array<{
                    userId: string;
                    firstName: string;
                    lastName: string;
                    role: string;
                    readAt: string;
                  }>;
                  unread: Array<{
                    userId: string;
                    firstName: string;
                    lastName: string;
                    role: string;
                  }>;
                  truncated?: boolean;
                }
              | undefined;
            const nameOf = (p: { firstName?: string; lastName?: string }) =>
              `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Unknown";
            // Receivers are listed per role group — students, instructors,
            // then coordinators/admins (bell oversight on instructor posts).
            const groupDefs = [
              {
                key: "students",
                label: "Students",
                match: (role: string) => role === "STUDENT",
              },
              {
                key: "instructors",
                label: "Instructors",
                match: (role: string) =>
                  role === "INSTRUCTOR" || role === "CLINICAL_INSTRUCTOR",
              },
              {
                key: "staff",
                label: "Coordinators & Admins",
                match: (role: string) =>
                  role === "PROGRAM_COORDINATOR" || role === "ADMIN",
              },
            ];
            const groups =
              r && !receiptsPending
                ? groupDefs
                    .map((g) => ({
                      ...g,
                      read: r.read.filter((e) => g.match(e.role)),
                      unread: r.unread.filter((e) => g.match(e.role)),
                    }))
                    .filter((g) => g.read.length + g.unread.length > 0)
                : [];
            return (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">
                    {String(receiptsItem.title)}
                  </span>
                </p>
                {receiptsPending || !r ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          r.receiverCount > 0 && r.unreadCount === 0
                            ? "success"
                            : r.readCount > 0
                            ? "info"
                            : "default"
                        }
                      >
                        {r.readCount}/{r.receiverCount} read
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {r.receiverCount > 0
                          ? `${Math.round(
                              (r.readCount / r.receiverCount) * 100
                            )}% of receivers`
                          : "No receivers yet"}
                      </span>
                    </div>

                    {groups.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        No receivers yet.
                      </p>
                    ) : (
                      groups.map((g) => (
                        <div key={g.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900">
                              {g.label}
                            </p>
                            <Badge
                              variant={
                                g.read.length + g.unread.length > 0 &&
                                g.unread.length === 0
                                  ? "success"
                                  : g.read.length > 0
                                  ? "info"
                                  : "default"
                              }
                            >
                              {g.read.length}/{g.read.length + g.unread.length}{" "}
                              read
                            </Badge>
                          </div>

                          {g.read.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                Read ({g.read.length})
                              </p>
                              <ul className="max-h-44 overflow-y-auto divide-y border rounded-lg">
                                {g.read.map((entry) => (
                                  <li
                                    key={entry.userId}
                                    className="flex items-center justify-between px-3 py-1.5 text-sm"
                                  >
                                    <span className="text-gray-800">
                                      {nameOf(entry)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(entry.readAt).toLocaleString()}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {g.unread.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                Not yet read ({g.unread.length})
                              </p>
                              <ul className="max-h-44 overflow-y-auto divide-y border rounded-lg">
                                {g.unread.map((entry) => (
                                  <li
                                    key={entry.userId}
                                    className="px-3 py-1.5 text-sm text-gray-600"
                                  >
                                    {nameOf(entry)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {r.truncated && (
                      <p className="text-xs text-gray-400">
                        Showing the first 200 names per list.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })()}
      </Modal>

      {createModal}
      {editModal}
      {viewModal}
    </div>
  );
}
