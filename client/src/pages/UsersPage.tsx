import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { UserPlus, Pencil, Trash2, KeyRound } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

const EMPTY_FORM = { username: "", email: "", password: "", firstName: "", lastName: "", middleName: "", contactNumber: "", role: "STUDENT" };

export default function UsersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwItem, setPwItem] = useState<Record<string, unknown> | null>(null);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["users", page, tab],
    queryFn: () =>
      usersApi.list({
        page: String(page),
        limit: "15",
        ...(tab === "pending" ? { pending: "true" } : {}),
      }),
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;
  const canCreate = can("users.create");
  const canEdit = can("users.edit");
  const canDelete = can("users.delete");

  // Live count for the pending tab badge — invalidated with the other
  // "users" queries after create/approve/reject.
  const { data: pendingData } = useQuery({
    queryKey: ["users", "pending-count"],
    queryFn: () => usersApi.list({ page: "1", limit: "1", pending: "true" }),
    enabled: canCreate,
  });
  const pendingCount = pendingData?.data?.data?.pagination?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setErrors({});
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to create user";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      setEditItem(null);
      setForm(EMPTY_FORM);
      setErrors({});
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to update user";
      toast.error(msg);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => usersApi.updatePassword(id, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Password updated");
      setPwItem(null);
      setPwForm({ password: "", confirm: "" });
      setPwErrors({});
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to update password";
      toast.error(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => usersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Server auto-marked the ACCOUNT_PENDING bell notifications as read.
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      toast.success("Account approved — the user can now sign in");
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to approve account";
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => usersApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Server auto-marked the ACCOUNT_PENDING bell notifications as read.
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      toast.success("Signup rejected — the applicant has been notified");
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to reject signup";
      toast.error(msg);
    },
  });

  const onApprove = (item: Record<string, unknown>) => {
    if (!window.confirm(`Approve the account for ${String(item.firstName)} ${String(item.lastName)}? They will be able to sign in.`)) return;
    approveMutation.mutate(String(item.id));
  };

  const onReject = (item: Record<string, unknown>) => {
    if (!window.confirm(`Reject the signup for ${String(item.firstName)} ${String(item.lastName)}? The account will be disabled and they will be notified by email.`)) return;
    rejectMutation.mutate(String(item.id));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim() || form.username.trim().length < 3) e.username = "Username must be at least 3 characters";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (!editItem && (!form.password || form.password.length < 8)) e.password = "Password must be at least 8 characters";
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      contactNumber: form.contactNumber.trim(),
      role: form.role,
    };
    if (!editItem && form.password.trim()) payload.password = form.password.trim();
    if (form.middleName.trim()) payload.middleName = form.middleName.trim();
    createMutation.mutate(payload);
  };

  const handleEditSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      contactNumber: form.contactNumber.trim(),
      role: form.role,
    };
    if (form.middleName.trim()) payload.middleName = form.middleName.trim();
    updateMutation.mutate({ id: String(editItem?.id), data: payload });
  };

  const onDelete = async (item: Record<string, unknown>) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await usersApi.update(String(item.id), { isActive: false });
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditItem(item);
    setForm({
      username: String(item.username || ""),
      email: String(item.email || ""),
      password: "",
      firstName: String(item.firstName || ""),
      lastName: String(item.lastName || ""),
      middleName: String(item.middleName || ""),
      contactNumber: String(item.contactNumber || ""),
      role: String(item.role || "STUDENT"),
    });
    setErrors({});
  };

  const openPassword = (item: Record<string, unknown>) => {
    setPwItem(item);
    setPwForm({ password: "", confirm: "" });
    setPwErrors({});
  };

  const handlePasswordSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!pwForm.password || pwForm.password.length < 8) e.password = "Password must be at least 8 characters";
    if (pwForm.password !== pwForm.confirm) e.confirm = "Passwords do not match";
    setPwErrors(e);
    if (Object.keys(e).length > 0) return;
    passwordMutation.mutate({ id: String(pwItem?.id), password: pwForm.password.trim() });
  };

  const roleBadge = (r: string) => {
    const m: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
      ADMIN: "danger", INSTRUCTOR: "info", PROGRAM_COORDINATOR: "warning",
      CLINICAL_INSTRUCTOR: "success", STUDENT: "default",
    };
    return <Badge variant={m[r] || "default"}>{r.replace("_", " ")}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and roles"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><UserPlus size={16} /> Add User</Button>
          ) : undefined
        }
      />

      {canCreate && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setTab("all"); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "all"
                ? "bg-primary-600 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => { setTab("pending"); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "pending"
                ? "bg-amber-500 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
            data-testid="pending-tab"
          >
            Pending approvals
            {pendingCount > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                  tab === "pending"
                    ? "bg-white text-amber-600"
                    : "bg-amber-100 text-amber-700"
                }`}
                data-testid="pending-count"
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={
            tab === "pending"
              ? [
                  { key: "name", label: "Name", render: (item) => (
                    <span className="font-medium">{String(item.firstName)} {String(item.lastName)}</span>
                  )},
                  { key: "username", label: "Username" },
                  { key: "email", label: "Email" },
                  { key: "emailVerifiedAt", label: "Email verified", className: "w-36", render: (item) =>
                    item.emailVerifiedAt ? new Date(String(item.emailVerifiedAt)).toLocaleDateString() : "—"
                  },
                  { key: "createdAt", label: "Signed up", className: "w-32", render: (item) => new Date(String(item.createdAt)).toLocaleDateString() },
                  { key: "actions", label: "Actions", className: "w-48", render: (item) => (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onApprove(item)}
                        disabled={approveMutation.isPending}
                        className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        data-testid="approve-btn"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(item)}
                        disabled={rejectMutation.isPending}
                        className="px-2 py-1 text-xs font-medium bg-white border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                        data-testid="reject-btn"
                      >
                        Reject
                      </button>
                    </div>
                  )},
                ]
              : [
            { key: "username", label: "Username", render: (item) => (
              <span className="font-medium">{String(item.username)}</span>
            )},
            { key: "name", label: "Name", render: (item) => (
              <span>{String(item.firstName)} {String(item.lastName)}</span>
            )},
            { key: "email", label: "Email" },
            { key: "contactNumber", label: "Contact #", render: (item) => String(item.contactNumber || "—") },
            { key: "role", label: "Role", className: "w-40", render: (item) => roleBadge(String(item.role)) },
            { key: "isActive", label: "Status", className: "w-24", render: (item) => (
              <Badge variant={item.isActive ? "success" : "warning"}>{item.isActive ? "Active" : "Inactive"}</Badge>
            )},
            { key: "createdAt", label: "Joined", className: "w-32", render: (item) => new Date(String(item.createdAt)).toLocaleDateString() },
            { key: "actions", label: "Actions", className: "w-32", render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Edit">
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => openPassword(item)} className="p-1 hover:bg-gray-100 rounded" data-tooltip="Reset password">
                    <KeyRound size={16} className="text-amber-600" />
                  </button>
                )}
                {canDelete && (
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add User">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter username"
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="user@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Middle Name (optional)</label>
            <input
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact # (optional)</label>
            <input
              type="tel"
              maxLength={30}
              value={form.contactNumber}
              onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="+63 917 123 4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Min 8 characters"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="PROGRAM_COORDINATOR">Program Coordinator</option>
              <option value="CLINICAL_INSTRUCTOR">Clinical Instructor</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => { setEditItem(null); setForm(EMPTY_FORM); setErrors({}); }} title="Edit User">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Enter username"
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="user@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Middle Name (optional)</label>
            <input
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact # (optional)</label>
            <input
              type="tel"
              maxLength={30}
              value={form.contactNumber}
              onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="+63 917 123 4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="PROGRAM_COORDINATOR">Program Coordinator</option>
              <option value="CLINICAL_INSTRUCTOR">Clinical Instructor</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setErrors({}); }}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!pwItem} onClose={() => { setPwItem(null); setPwForm({ password: "", confirm: "" }); setPwErrors({}); }} title="Reset Password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              Set a new password for{" "}
              <span className="font-medium">
                {String(pwItem?.firstName || "")} {String(pwItem?.lastName || "")}
              </span>{" "}
              (@{String(pwItem?.username || "")}). Their existing sessions will be signed out.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              autoFocus
              value={pwForm.password}
              onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Min 8 characters"
            />
            {pwErrors.password && <p className="text-red-500 text-xs mt-1">{pwErrors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Repeat new password"
            />
            {pwErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwErrors.confirm}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setPwItem(null); setPwForm({ password: "", confirm: "" }); setPwErrors({}); }}>Cancel</Button>
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
