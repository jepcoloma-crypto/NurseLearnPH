import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { nleApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card, Modal } from "@/components/shared";
import {
  GraduationCap, Target, Plus, Pencil, Trash2, Upload, Sparkles, FileText,
  BarChart3, ChevronLeft, ChevronRight, Download, Eye,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

type Tab = "dashboard" | "categories" | "questions" | "import" | "generate";

export default function NLEAdminPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("dashboard");

  const canManage = can("nle.manage");

  return (
    <div>
      <PageHeader
        title="NLE Question Bank"
        subtitle="Manage NLE review questions, categories, and AI generation"
      />

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {([
          { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={14} /> },
          { key: "categories", label: "Categories", icon: <Target size={14} /> },
          { key: "questions", label: "Questions", icon: <GraduationCap size={14} /> },
          { key: "import", label: "Bulk Import", icon: <Upload size={14} /> },
          { key: "generate", label: "AI Generate", icon: <Sparkles size={14} /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "categories" && <CategoriesTab canManage={canManage} />}
      {tab === "questions" && <QuestionsTab canManage={canManage} />}
      {tab === "import" && <ImportTab />}
      {tab === "generate" && <GenerateTab />}
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["nle-stats"],
    queryFn: () => nleApi.getStats(),
  });

  const { data: categories } = useQuery({
    queryKey: ["nle-categories"],
    queryFn: () => nleApi.listCategories(),
  });

  const catData = categories?.data?.data;
  const catList = Array.isArray(catData) ? catData : (catData?.items ?? []);
  const stats = data?.data?.data;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Questions</div>
          <div className="text-3xl font-bold text-primary-700 mt-1">{stats?.total ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats?.active ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">High Yield</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{stats?.highYield ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Categories</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{catList.length}</div>
        </Card>
      </div>

      {/* Difficulty Breakdown */}
      {stats?.byDifficulty?.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">By Difficulty</h3>
          <div className="flex gap-4">
            {stats.byDifficulty.map((d: Record<string, unknown>) => (
              <div key={String(d.difficulty)} className="flex items-center gap-2">
                <Badge variant={String(d.difficulty) === "EASY" ? "success" : String(d.difficulty) === "HARD" ? "danger" : "warning"}>
                  {String(d.difficulty)}
                </Badge>
                <span className="text-sm font-medium">{String(d.count)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {stats?.byCategory?.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">By Category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.byCategory.map((c: Record<string, unknown>) => {
              const cat = catList.find((ca: Record<string, unknown>) => String(ca.id) === String(c.categoryId));
              return (
                <div key={String(c.categoryId)} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 truncate">{cat ? String(cat.name) : "Unknown"}</span>
                  <Badge variant="info">{String(c.count)}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Categories Tab ─────────────────────────────────────────────────────────

function CategoriesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["nle-categories"],
    queryFn: () => nleApi.listCategories(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => nleApi.createCategory(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nle-categories"] }); setShowForm(false); resetForm(); toast.success("Category created"); },
    onError: () => toast.error("Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown>) => nleApi.updateCategory(String(id), data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nle-categories"] }); setShowForm(false); resetForm(); toast.success("Category updated"); },
    onError: (err: unknown) => {
      const errData = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      toast.error((typeof errData === "object" ? errData?.message : errData) || "Failed to update category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => nleApi.deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nle-categories"] }); queryClient.invalidateQueries({ queryKey: ["nle-stats"] }); toast.success("Category deleted"); },
    onError: (err: unknown) => {
      const errData = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      toast.error((typeof errData === "object" ? errData?.message : errData) || "Failed to delete category");
    },
  });

  const resetForm = () => { setName(""); setCode(""); setDescription(""); setIsActive(true); setEditing(null); };

  const handleSubmit = () => {
    if (!name || !code) { toast.error("Name and code are required"); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, name, description, isActive });
    } else {
      createMutation.mutate({ name, code, description });
    }
  };

  const catData = data?.data?.data;
  const catList = Array.isArray(catData) ? catData : (catData?.items ?? []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-gray-900">Categories ({catList.length})</h3>
        {canManage && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} className="mr-1" /> Add Category</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {catList.map((cat: Record<string, unknown>) => (
          <Card key={String(cat.id)} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{String(cat.name)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{String(cat.description || "")}</div>
                <div className="mt-1">
                  <Badge variant="info">{String(cat.code)}</Badge>
                  {cat.isActive === false && <span className="ml-1 text-xs text-red-600">(Inactive)</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(cat); setName(String(cat.name)); setCode(String(cat.code)); setDescription(String(cat.description || "")); setIsActive(cat.isActive !== false); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded" title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm(`Delete category "${String(cat.name)}"?`)) deleteMutation.mutate(String(cat.id)); }} className="p-1 hover:bg-red-50 rounded text-red-600" title="Delete"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editing ? "Edit Category" : "New Category"}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g., Pharmacology" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g., PHARMA" disabled={!!editing} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
              Active (available for practice and exams)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Questions Tab ──────────────────────────────────────────────────────────

function QuestionsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterCat, setFilterCat] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [showDetail, setShowDetail] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [form, setForm] = useState({
    categoryId: "", questionText: "", questionType: "MC",
    difficulty: "MEDIUM", explanation: "", isHighYield: false,
    options: [
      { optionText: "", isCorrect: true },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ],
  });

  const { data: categories } = useQuery({ queryKey: ["nle-categories"], queryFn: () => nleApi.listCategories() });
  const catRaw = categories?.data?.data;
  const catList = Array.isArray(catRaw) ? catRaw : (catRaw?.items ?? []);

  const { data, isLoading } = useQuery({
    queryKey: ["nle-questions", page, filterCat, filterDiff],
    queryFn: () => nleApi.listQuestions({ page: String(page), limit: "15", categoryId: filterCat || undefined, difficulty: filterDiff || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => nleApi.deleteQuestion(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nle-questions"] }); queryClient.invalidateQueries({ queryKey: ["nle-stats"] }); toast.success("Question deleted"); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to delete question");
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => nleApi.createQuestion(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nle-questions"] });
      queryClient.invalidateQueries({ queryKey: ["nle-stats"] });
      setShowCreate(false);
      resetForm();
      toast.success("Question created");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to create question");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: Record<string, unknown>) => nleApi.updateQuestion(String(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nle-questions"] });
      queryClient.invalidateQueries({ queryKey: ["nle-stats"] });
      setShowCreate(false);
      resetForm();
      toast.success("Question updated");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to update question");
    },
  });

  const resetForm = () => {
    setEditId(null);
    setForm({
      categoryId: "", questionText: "", questionType: "MC",
      difficulty: "MEDIUM", explanation: "", isHighYield: false,
      options: [
        { optionText: "", isCorrect: true },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
      ],
    });
  };

  const validateForm = () => {
    if (!form.categoryId) { toast.error("Select a category"); return false; }
    if (!form.questionText.trim()) { toast.error("Question text is required"); return false; }
    const filled = form.options.filter((o) => o.optionText.trim());
    if (filled.length < 2) { toast.error("At least 2 options required"); return false; }
    if (!form.options.some((o) => o.isCorrect && o.optionText.trim())) { toast.error("Mark one option as correct"); return false; }
    return true;
  };

  const handleCreate = () => {
    if (!validateForm()) return;
    createMutation.mutate({
      categoryId: form.categoryId,
      questionText: form.questionText,
      questionType: form.questionType,
      difficulty: form.difficulty,
      explanation: form.explanation || undefined,
      isHighYield: form.isHighYield,
      options: form.options.filter((o) => o.optionText.trim()),
    });
  };

  const handleUpdate = () => {
    if (!editId || !validateForm()) return;
    updateMutation.mutate({
      id: editId,
      categoryId: form.categoryId,
      questionText: form.questionText,
      questionType: form.questionType,
      difficulty: form.difficulty,
      explanation: form.explanation || undefined,
      isHighYield: form.isHighYield,
      options: form.options.filter((o) => o.optionText.trim()).map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })),
    });
  };

  const startEdit = async (q: Record<string, unknown>) => {
    try {
      const res = await nleApi.getQuestion(String(q.id));
      const full = res.data?.data;
      if (!full) { toast.error("Could not load question"); return; }
      const rawOpts = (Array.isArray(full.options) ? full.options : []) as { optionText: string; isCorrect: boolean }[];
      const opts = rawOpts.map((o) => ({ optionText: String(o.optionText), isCorrect: !!o.isCorrect }));
      while (opts.length < 2) opts.push({ optionText: "", isCorrect: false });
      setForm({
        categoryId: String(full.categoryId ?? ""),
        questionText: String(full.questionText ?? ""),
        questionType: String(full.questionType ?? "MC"),
        difficulty: String(full.difficulty ?? "MEDIUM"),
        explanation: String(full.explanation ?? ""),
        isHighYield: full.isHighYield === true,
        options: opts,
      });
      setEditId(String(q.id));
      setShowCreate(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Failed to load question");
    }
  };

  const setCorrect = (idx: number) => {
    setForm((f) => ({ ...f, options: f.options.map((o, i) => ({ ...o, isCorrect: i === idx })) }));
  };

  const handleSuggest = async () => {
    if (!form.categoryId) { toast.error("Select a category first"); return; }
    setSuggesting(true);
    try {
      const res = await nleApi.suggestQuestion(form.categoryId);
      const s = res.data?.data;
      if (!s) { toast.error("AI returned no question"); return; }
      const opts = Array.isArray(s.options) && s.options.length >= 2
        ? s.options
        : [{ optionText: "", isCorrect: true }, { optionText: "", isCorrect: false }];
      setForm((f) => ({
        ...f,
        questionText: String(s.questionText ?? ""),
        questionType: String(s.questionType ?? "MC"),
        difficulty: String(s.difficulty ?? "MEDIUM"),
        explanation: String(s.explanation ?? ""),
        options: opts.map((o: { optionText: string; isCorrect: boolean }) => ({ optionText: o.optionText, isCorrect: o.isCorrect })),
      }));
      toast.success("Question suggested — review and edit before saving");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "AI suggestion failed — check GEMINI_API_KEY");
    } finally {
      setSuggesting(false);
    }
  };

  const qList = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {catList.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
        </select>
        <select value={filterDiff} onChange={(e) => { setFilterDiff(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        {pagination && <span className="text-sm text-gray-500 self-center">{pagination.total} questions</span>}
        <div className="ml-auto">
          {canManage && (
            <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus size={14} className="mr-1" /> New Question
            </Button>
          )}
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {qList.map((q: Record<string, unknown>) => {
            const cat = catList.find((c: Record<string, unknown>) => String(c.id) === String(q.categoryId));
            return (
              <Card key={String(q.id)} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{String(q.questionText)}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="info">{String(q.questionType)}</Badge>
                      <Badge variant={String(q.difficulty) === "EASY" ? "success" : String(q.difficulty) === "HARD" ? "danger" : "warning"}>
                        {String(q.difficulty)}
                      </Badge>
                      {q.isHighYield === true && <Badge variant="warning">High Yield</Badge>}
                      <Badge variant="default">{cat ? String(cat.name) : "Unknown"}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setShowDetail(q)} className="p-1.5 hover:bg-gray-100 rounded" title="View"><Eye size={14} /></button>
                    {canManage && (
                      <>
                        <button onClick={() => { void startEdit(q); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm("Delete this question?")) deleteMutation.mutate(String(q.id)); }} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Delete"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {qList.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No questions found.</p>}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {pagination.totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Question Detail">
        {showDetail && (
          <div className="space-y-3">
            <p className="font-medium">{String(showDetail.questionText)}</p>
            <div className="flex gap-2">
              <Badge variant="info">{String(showDetail.questionType)}</Badge>
              <Badge variant="warning">{String(showDetail.difficulty)}</Badge>
            </div>
            {String(showDetail.explanation || "") && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Explanation:</strong> {String(showDetail.explanation)}
              </div>
            )}
            {Array.isArray(showDetail.tags) && (showDetail.tags as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(showDetail.tags as string[]).map((t, i) => <Badge key={i} variant="default">{t}</Badge>)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Question Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title={editId ? "Edit NLE Question" : "New NLE Question"}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select category</option>
              {catList.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Question Text *</label>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                <Sparkles size={12} />
                {suggesting ? "Generating..." : "✨ Suggest with AI"}
              </button>
            </div>
            <textarea value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Enter the question... or pick a category and click Suggest with AI" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.questionType} onChange={(e) => setForm({ ...form, questionType: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="MC">Multiple Choice</option>
                <option value="TF">True/False</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Options * (click the circle to mark the correct answer)</label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(i)}
                    title="Mark as correct"
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${opt.isCorrect ? "border-green-600" : "border-gray-300"}`}
                  >
                    {opt.isCorrect && <span className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                  </button>
                  <input
                    value={opt.optionText}
                    onChange={(e) => setForm({ ...form, options: form.options.map((o, j) => j === i ? { ...o, optionText: e.target.value } : o) })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                </div>
              ))}
            </div>
            {form.options.length < 4 && (
              <button type="button" onClick={() => setForm({ ...form, options: [...form.options, { optionText: "", isCorrect: false }] })} className="text-xs text-primary-600 hover:underline mt-1">+ Add option</button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
            <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Why is this the correct answer?" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isHighYield} onChange={(e) => setForm({ ...form, isHighYield: e.target.checked })} className="h-4 w-4 rounded" />
            High-yield question (commonly tested on the NLE)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={editId ? handleUpdate : handleCreate} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Save Changes" : "Create Question"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Import Tab ─────────────────────────────────────────────────────────────

function ImportTab() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const importMutation = useMutation({
    mutationFn: (questions: Record<string, unknown>[]) => nleApi.importQuestions(questions),
    onSuccess: (res) => {
      const data = res.data?.data;
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["nle-questions"] });
      queryClient.invalidateQueries({ queryKey: ["nle-stats"] });
      if (data?.imported > 0) toast.success(`Imported ${data.imported} questions`);
      if (data?.skipped > 0) toast(`${data.skipped} skipped (duplicates or errors)`, { icon: "⚠️" });
    },
    onError: () => toast.error("Import failed"),
  });

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        toast.error("Invalid format: expected array of questions");
        return;
      }
      importMutation.mutate(questions);
    } catch {
      toast.error("Invalid JSON");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      toast.success("File loaded — review and click Import");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sampleFormat = `[
  {
    "categoryId": "paste-category-uuid-here",
    "questionText": "What is the normal range for adult resting heart rate?",
    "questionType": "MC",
    "difficulty": "EASY",
    "explanation": "Normal adult resting heart rate is 60-100 bpm.",
    "isHighYield": false,
    "options": [
      { "optionText": "50-70 bpm", "isCorrect": false },
      { "optionText": "60-100 bpm", "isCorrect": true },
      { "optionText": "100-120 bpm", "isCorrect": false },
      { "optionText": "40-60 bpm", "isCorrect": false }
    ]
  }
]`;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-medium text-gray-900 mb-2">Bulk Import Questions</h3>
        <p className="text-sm text-gray-500 mb-4">Upload a JSON file or paste JSON below. Each question needs a categoryId, questionText, and options array.</p>

        <div className="flex gap-2 mb-3">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} className="mr-1" /> Upload JSON File
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(sampleFormat); toast.success("Sample copied to clipboard"); }}>
            <Download size={14} className="mr-1" /> Copy Sample Format
          </Button>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          rows={12}
          placeholder='[{"categoryId": "...", "questionText": "...", "options": [...]}]'
        />

        <div className="flex justify-between items-center mt-3">
          <span className="text-sm text-gray-500">
            {jsonText ? (() => { try { const arr = JSON.parse(jsonText); return Array.isArray(arr) ? arr.length : "Invalid"; } catch { return "Invalid JSON"; } })() : 0} questions
          </span>
          <Button onClick={handleImport} disabled={!jsonText || importMutation.isPending}>
            {importMutation.isPending ? "Importing..." : "Import Questions"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-2">Import Results</h3>
          <div className="flex gap-4 mb-2">
            <span className="text-sm"><strong className="text-green-600">{result.imported}</strong> imported</span>
            <span className="text-sm"><strong className="text-yellow-600">{result.skipped}</strong> skipped</span>
          </div>
          {result.errors.length > 0 && (
            <div className="text-sm text-red-600 space-y-1">
              {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Generate Tab ───────────────────────────────────────────────────────────

function GenerateTab() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<string>("");
  const [highYieldPercent, setHighYieldPercent] = useState(20);
  const [result, setResult] = useState<{ imported: number; total: number; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState("");

  const { data: categories } = useQuery({ queryKey: ["nle-categories"], queryFn: () => nleApi.listCategories() });
  const catRaw = categories?.data?.data;
  const catList = Array.isArray(catRaw) ? catRaw : (catRaw?.items ?? []);

  const generateTextMutation = useMutation({
    mutationFn: (data: { categoryId: string; content: string; count: number; difficulty?: string; highYieldPercent?: number }) => nleApi.generateFromContent(data),
    onSuccess: (res) => {
      const data = res.data?.data;
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["nle-questions"] });
      queryClient.invalidateQueries({ queryKey: ["nle-stats"] });
      if (data?.imported > 0) toast.success(`Generated ${data.imported} questions`);
      if (data?.errors?.length > 0) toast(`${data.errors.length} errors`, { icon: "⚠️" });
    },
    onError: () => toast.error("AI generation failed — check GEMINI_API_KEY"),
  });

  const generateFileMutation = useMutation({
    mutationFn: (formData: FormData) => nleApi.generateFromFile(formData),
    onSuccess: (res) => {
      const data = res.data?.data;
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["nle-questions"] });
      queryClient.invalidateQueries({ queryKey: ["nle-stats"] });
      if (data?.imported > 0) toast.success(`Generated ${data.imported} questions from file`);
      if (data?.errors?.length > 0) toast(`${data.errors.length} errors`, { icon: "⚠️" });
    },
    onError: () => toast.error("AI generation failed — check GEMINI_API_KEY"),
  });

  const handleGenerate = () => {
    if (!categoryId) { toast.error("Select a category"); return; }
    if (mode === "text" && !content) { toast.error("Enter content"); return; }
    if (count > 50) { toast.error("Max 50 questions per generation"); return; }

    if (mode === "text") {
      generateTextMutation.mutate({ categoryId, content, count, difficulty: difficulty || undefined, highYieldPercent });
    } else {
      const file = fileRef.current?.files?.[0];
      if (!file) { toast.error("Select a file"); return; }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("categoryId", categoryId);
      formData.append("count", String(count));
      if (difficulty) formData.append("difficulty", difficulty);
      if (highYieldPercent) formData.append("highYieldPercent", String(highYieldPercent));
      generateFileMutation.mutate(formData);
    }
  };

  const isPending = generateTextMutation.isPending || generateFileMutation.isPending;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-purple-600" />
          <h3 className="font-medium text-gray-900">AI Question Generator</h3>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              mode === "text" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText size={14} /> From Text
          </button>
          <button
            onClick={() => setMode("file")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              mode === "file" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Upload size={14} /> From File (PDF/DOCX)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select category</option>
              {catList.map((c: Record<string, unknown>) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count *</label>
            <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 10)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Random</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">High Yield % ({highYieldPercent}%)</label>
            <input type="range" min={0} max={100} value={highYieldPercent} onChange={(e) => setHighYieldPercent(parseInt(e.target.value))} className="w-full mt-2" />
          </div>
        </div>

        {mode === "text" ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content / Lesson Text *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={6}
              placeholder="Paste lesson content, textbook excerpt, or topic description here. The AI will generate NLE-style questions based on this content."
            />
            <p className="text-xs text-gray-400 mt-1">Paste any nursing content — the AI will analyze it and generate relevant MCQs</p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Lesson File *</label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
              <button onClick={() => fileRef.current?.click()} className="text-primary-600 hover:underline text-sm">
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                {fileName || "Click to upload PDF, DOCX, or TXT"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">The AI will extract content and generate questions from the lesson material</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <><LoadingSpinner /> Generating...</>
            ) : (
              <><Sparkles size={14} className="mr-1" /> Generate Questions</>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-2">Generation Results</h3>
          <div className="flex gap-4 mb-2">
            <span className="text-sm"><strong className="text-green-600">{result.imported}</strong> generated & saved</span>
            <span className="text-sm">of <strong>{result.total}</strong> attempted</span>
          </div>
          {result.errors.length > 0 && (
            <div className="text-sm text-red-600 space-y-1 mt-2">
              {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
