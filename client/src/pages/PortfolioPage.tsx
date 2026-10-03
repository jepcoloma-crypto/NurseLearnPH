import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Button, Badge, LoadingSpinner, Modal } from "@/components/shared";
import { Plus, BookOpen, Lightbulb, ClipboardList, Award, ScrollText, MessageSquare } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const feedbackSchema = z.object({
  rating: z.string().optional(),
  comments: z.string().min(1, "Comments are required"),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
});
type FeedbackFormData = z.infer<typeof feedbackSchema>;

const achievementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  points: z.coerce.number().int().min(0, "Points cannot be negative"),
  description: z.string().optional(),
});
type AchievementFormData = z.infer<typeof achievementSchema>;

const certificateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
});
type CertificateFormData = z.infer<typeof certificateSchema>;

const fullName = (first?: unknown, last?: unknown) =>
  `${first ?? ""} ${last ?? ""}`.trim();

export default function PortfolioPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"portfolios" | "reflections" | "logs">("portfolios");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // Review state (instructor / clinical instructor / coordinator / admin)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<{ id: string; title: string } | null>(null);
  const [showAchievement, setShowAchievement] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const canReview = can("portfolio.review");
  const canIssue = can("portfolio.issue");

  const { data: portfolios, isLoading: loadingP } = useQuery({
    queryKey: ["portfolios", page],
    queryFn: () => portfolioApi.listPortfolios({ page: String(page), limit: "15" }),
    enabled: tab === "portfolios",
  });
  const { data: reflections, isLoading: loadingR } = useQuery({
    queryKey: ["reflections", page],
    queryFn: () => portfolioApi.listReflections({ page: String(page), limit: "15" }),
    enabled: tab === "reflections",
  });
  const { data: logs, isLoading: loadingL } = useQuery({
    queryKey: ["clinical-logs", page],
    queryFn: () => portfolioApi.listClinicalLogs({ page: String(page), limit: "15" }),
    enabled: tab === "logs",
  });

  const { data: detailRes, isLoading: loadingDetail } = useQuery({
    queryKey: ["portfolio", detailId],
    queryFn: () => portfolioApi.getPortfolio(detailId!),
    enabled: !!detailId,
  });
  const detail = detailRes?.data?.data;

  const { data: feedbackRes } = useQuery({
    queryKey: ["item-feedback", expandedItemId],
    queryFn: () => portfolioApi.getItemFeedback(expandedItemId!),
    enabled: !!expandedItemId,
  });
  const feedbackList = feedbackRes?.data?.data ?? [];

  const { data: achieveRes } = useQuery({
    queryKey: ["student-achievements", detail?.studentId],
    queryFn: () => portfolioApi.listAchievements({ studentId: detail!.studentId, limit: "50" }),
    enabled: !!detail?.studentId,
  });
  const achievements = achieveRes?.data?.data?.items ?? [];

  const { data: certRes } = useQuery({
    queryKey: ["student-certificates", detail?.studentId],
    queryFn: () => portfolioApi.listCertificates({ studentId: detail!.studentId, limit: "50" }),
    enabled: !!detail?.studentId,
  });
  const certificates = certRes?.data?.data?.items ?? [];

  const isLoading = loadingP || loadingR || loadingL;
  const canCreate = can("portfolio.create");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const fbForm = useForm<FeedbackFormData>({ resolver: zodResolver(feedbackSchema) });
  const achForm = useForm<AchievementFormData>({
    resolver: zodResolver(achievementSchema),
    defaultValues: { points: 0 },
  });
  const certForm = useForm<CertificateFormData>({ resolver: zodResolver(certificateSchema) });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => portfolioApi.createPortfolio(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfolio created");
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Failed to create portfolio"),
  });

  const feedbackMutation = useMutation({
    mutationFn: (data: FeedbackFormData) =>
      portfolioApi.createFeedback({
        portfolioItemId: feedbackItem!.id,
        comments: data.comments,
        rating: data.rating ? Number(data.rating) : undefined,
        strengths: data.strengths || undefined,
        improvements: data.improvements || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-feedback", feedbackItem?.id] });
      toast.success("Feedback submitted");
      setFeedbackItem(null);
      fbForm.reset();
    },
    onError: () => toast.error("Failed to submit feedback"),
  });

  const achievementMutation = useMutation({
    mutationFn: (data: AchievementFormData) =>
      portfolioApi.createAchievement({ studentId: detail!.studentId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-achievements", detail?.studentId] });
      toast.success("Achievement awarded");
      setShowAchievement(false);
      achForm.reset({ points: 0 });
    },
    onError: () => toast.error("Failed to award achievement"),
  });

  const certificateMutation = useMutation({
    mutationFn: (data: CertificateFormData) =>
      portfolioApi.createCertificate({
        studentId: detail!.studentId,
        title: data.title,
        description: data.description || undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-certificates", detail?.studentId] });
      toast.success("Certificate issued");
      setShowCertificate(false);
      certForm.reset();
    },
    onError: () => toast.error("Failed to issue certificate"),
  });

  const closeDetail = () => {
    setDetailId(null);
    setExpandedItemId(null);
  };

  const tabs = [
    { key: "portfolios" as const, label: "Portfolios", icon: BookOpen },
    { key: "reflections" as const, label: "Reflections", icon: Lightbulb },
    { key: "logs" as const, label: "Clinical Logs", icon: ClipboardList },
  ];

  return (
    <div>
      <PageHeader
        title="Student Portfolio"
        subtitle="Track clinical experience and professional growth"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Entry</Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          {tab === "portfolios" && (
            <DataTable
              columns={[
                { key: "studentFirstName", label: "Student", className: "w-44", render: (item) => (
                  <span className="font-medium text-gray-700">
                    {fullName(item.studentFirstName, item.studentLastName) || "—"}
                  </span>
                )},
                { key: "title", label: "Title" },
                { key: "description", label: "Description", render: (item) => (
                  <span className="line-clamp-1 text-gray-500">{String(item.description || "")}</span>
                )},
                { key: "isPublished", label: "Status", className: "w-28", render: (item) => (
                  <Badge variant={item.isPublished ? "success" : "warning"}>
                    {item.isPublished ? "PUBLISHED" : "DRAFT"}
                  </Badge>
                )},
                { key: "createdAt", label: "Created", className: "w-32", render: (item) => new Date(String(item.createdAt)).toLocaleDateString() },
                { key: "actions", label: "", className: "w-24", render: (item) => (
                  <Button variant="secondary" onClick={() => setDetailId(String(item.id))}>View</Button>
                )},
              ]}
              data={portfolios?.data?.data?.items ?? []}
              pagination={portfolios?.data?.data?.pagination}
              onPageChange={setPage}
            />
          )}
          {tab === "reflections" && (
            <DataTable
              columns={[
                { key: "title", label: "Title" },
                { key: "content", label: "Reflection", render: (item) => (
                  <span className="line-clamp-1 max-w-lg text-gray-500">{String(item.content || "")}</span>
                )},
                { key: "category", label: "Category", className: "w-32", render: (item) => (
                  <Badge variant="info">{String(item.category || "")}</Badge>
                )},
                { key: "createdAt", label: "Date", className: "w-32", render: (item) => new Date(String(item.createdAt)).toLocaleDateString() },
              ]}
              data={reflections?.data?.data?.items ?? []}
              pagination={reflections?.data?.data?.pagination}
              onPageChange={setPage}
            />
          )}
          {tab === "logs" && (
            <DataTable
              columns={[
                { key: "date", label: "Date", render: (item) => new Date(String(item.date)).toLocaleDateString() },
                { key: "patientCount", label: "Patients", className: "w-24" },
                { key: "proceduresPerformed", label: "Procedures", render: (item) => (
                  <span className="line-clamp-1 max-w-md">{Array.isArray(item.proceduresPerformed) ? item.proceduresPerformed.join(", ") : ""}</span>
                )},
                { key: "skillsApplied", label: "Skills", render: (item) => (
                  <span className="line-clamp-1 max-w-md">{Array.isArray(item.skillsApplied) ? item.skillsApplied.join(", ") : ""}</span>
                )},
              ]}
              data={logs?.data?.data?.items ?? []}
              pagination={logs?.data?.data?.pagination}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Portfolio Entry">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input {...register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Clinical Rotation - Medical Surgical" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Brief description of your portfolio entry..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Portfolio detail / review modal ─────────────────────────── */}
      <Modal open={!!detailId} onClose={closeDetail} title={detail ? String(detail.title) : "Portfolio"}>
        {loadingDetail || !detail ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-800">
                {fullName(detail.studentFirstName, detail.studentLastName) || "Unknown student"}
              </span>
              <Badge variant={detail.isPublished ? "success" : "warning"}>
                {detail.isPublished ? "PUBLISHED" : "DRAFT"}
              </Badge>
              <span>Created {new Date(String(detail.createdAt)).toLocaleDateString()}</span>
            </div>
            {detail.description && <p className="text-sm text-gray-600">{String(detail.description)}</p>}

            {(canReview || canIssue) && (
              <div className="flex flex-wrap gap-2">
                {canReview && (
                  <Button onClick={() => setShowAchievement(true)}>
                    <Award size={16} /> Award Achievement
                  </Button>
                )}
                {canIssue && (
                  <Button variant="secondary" onClick={() => setShowCertificate(true)}>
                    <ScrollText size={16} /> Issue Certificate
                  </Button>
                )}
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Portfolio Items</h3>
              {(detail.items ?? []).length === 0 && (
                <p className="text-sm text-gray-400">No items yet.</p>
              )}
              <div className="space-y-3">
                {(detail.items ?? []).map((item: Record<string, unknown>) => (
                  <div key={String(item.id)} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{String(item.title)}</p>
                        <Badge variant="info">{String(item.itemType)}</Badge>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          onClick={() => setExpandedItemId(expandedItemId === item.id ? null : String(item.id))}
                        >
                          <MessageSquare size={14} /> Feedback
                        </Button>
                        {canReview && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setFeedbackItem({ id: String(item.id), title: String(item.title) });
                              setExpandedItemId(String(item.id));
                              fbForm.reset();
                            }}
                          >
                            Give Feedback
                          </Button>
                        )}
                      </div>
                    </div>
                    {item.description ? <p className="text-sm text-gray-600 mt-1">{String(item.description)}</p> : null}
                    {item.content != null && (
                      <pre className="mt-2 bg-gray-50 rounded p-2 text-xs overflow-auto max-h-24 text-gray-600">
                        {JSON.stringify(item.content, null, 2)}
                      </pre>
                    )}

                    {expandedItemId === item.id && (
                      <div className="mt-3 border-t pt-2 space-y-2">
                        {feedbackList.length === 0 && <p className="text-xs text-gray-400">No feedback yet.</p>}
                        {feedbackList.map((f: Record<string, unknown>) => (
                          <div key={String(f.id)} className="bg-gray-50 rounded p-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {fullName(f.reviewerFirstName, f.reviewerLastName) || "Reviewer"}
                              </span>
                              <span className="text-amber-500">
                                {f.rating ? "★".repeat(Number(f.rating)) : ""}
                              </span>
                            </div>
                            <p className="text-gray-700">{String(f.comments)}</p>
                            {f.strengths ? (
                              <p className="text-green-700 text-xs mt-1"><b>Strengths:</b> {String(f.strengths)}</p>
                            ) : null}
                            {f.improvements ? (
                              <p className="text-amber-700 text-xs mt-1"><b>Improvements:</b> {String(f.improvements)}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Achievements</h3>
              {achievements.length === 0 ? (
                <p className="text-sm text-gray-400">No achievements yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {achievements.map((a: Record<string, unknown>) => (
                    <li key={String(a.id)} className="flex justify-between items-center border-b pb-1 gap-2">
                      <span>{String(a.title)} <Badge variant="info">{String(a.category)}</Badge></span>
                      <span className="text-gray-500 whitespace-nowrap">
                        {Number(a.points)} pts · {new Date(String(a.earnedAt)).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Certificates</h3>
              {certificates.length === 0 ? (
                <p className="text-sm text-gray-400">No certificates yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {certificates.map((c: Record<string, unknown>) => (
                    <li key={String(c.id)} className="flex justify-between items-center border-b pb-1 gap-2">
                      <span>
                        {String(c.title)}{" "}
                        <span className="text-gray-400 text-xs">({String(c.certificateNumber)})</span>
                      </span>
                      <Badge variant={c.status === "ACTIVE" ? "success" : "warning"}>{String(c.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Give feedback modal ─────────────────────────────────────── */}
      <Modal open={!!feedbackItem} onClose={() => setFeedbackItem(null)} title={`Feedback: ${feedbackItem?.title ?? ""}`}>
        <form onSubmit={fbForm.handleSubmit((data) => feedbackMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating (optional)</label>
            <select {...fbForm.register("rating")} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option value="">No rating</option>
              <option value="1">★☆☆☆☆</option>
              <option value="2">★★☆☆☆</option>
              <option value="3">★★★☆☆</option>
              <option value="4">★★★★☆</option>
              <option value="5">★★★★★</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments *</label>
            <textarea {...fbForm.register("comments")} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Overall feedback on this item..." />
            {fbForm.formState.errors.comments && (
              <p className="text-red-500 text-xs mt-1">{fbForm.formState.errors.comments.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Strengths</label>
            <textarea {...fbForm.register("strengths")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="What the student did well..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Areas for improvement</label>
            <textarea {...fbForm.register("improvements")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="What the student should work on..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setFeedbackItem(null)}>Cancel</Button>
            <Button type="submit" disabled={feedbackMutation.isPending}>
              {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Award achievement modal ─────────────────────────────────── */}
      <Modal open={showAchievement} onClose={() => setShowAchievement(false)} title="Award Achievement">
        <form onSubmit={achForm.handleSubmit((data) => achievementMutation.mutate(data))} className="space-y-4">
          <p className="text-sm text-gray-500">
            Awarding to: <span className="font-medium text-gray-700">
              {detail ? fullName(detail.studentFirstName, detail.studentLastName) || "student" : ""}
            </span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input {...achForm.register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Clinical Excellence Award" />
            {achForm.formState.errors.title && (
              <p className="text-red-500 text-xs mt-1">{achForm.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select {...achForm.register("category")} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option value="">Select category…</option>
              <option value="ACADEMIC">Academic</option>
              <option value="CLINICAL">Clinical</option>
              <option value="LEADERSHIP">Leadership</option>
              <option value="RESEARCH">Research</option>
              <option value="SERVICE">Community Service</option>
              <option value="OTHER">Other</option>
            </select>
            {achForm.formState.errors.category && (
              <p className="text-red-500 text-xs mt-1">{achForm.formState.errors.category.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input type="number" min={0} {...achForm.register("points")} className="w-full px-3 py-2 border rounded-lg" />
            {achForm.formState.errors.points && (
              <p className="text-red-500 text-xs mt-1">{achForm.formState.errors.points.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...achForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Why this achievement was awarded..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAchievement(false)}>Cancel</Button>
            <Button type="submit" disabled={achievementMutation.isPending}>
              {achievementMutation.isPending ? "Awarding..." : "Award"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Issue certificate modal ─────────────────────────────────── */}
      <Modal open={showCertificate} onClose={() => setShowCertificate(false)} title="Issue Certificate">
        <form onSubmit={certForm.handleSubmit((data) => certificateMutation.mutate(data))} className="space-y-4">
          <p className="text-sm text-gray-500">
            Issuing to: <span className="font-medium text-gray-700">
              {detail ? fullName(detail.studentFirstName, detail.studentLastName) || "student" : ""}
            </span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input {...certForm.register("title")} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Certificate of Clinical Completion" />
            {certForm.formState.errors.title && (
              <p className="text-red-500 text-xs mt-1">{certForm.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...certForm.register("description")} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Details of the certificate..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires (optional)</label>
            <input type="datetime-local" {...certForm.register("expiresAt")} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCertificate(false)}>Cancel</Button>
            <Button type="submit" disabled={certificateMutation.isPending}>
              {certificateMutation.isPending ? "Issuing..." : "Issue Certificate"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
