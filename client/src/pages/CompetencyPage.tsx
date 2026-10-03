import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { competencyApi, academicApi, clinicalRleApi } from "@/services/api";
import { PageHeader, Badge, LoadingSpinner, Card, Modal, Button } from "@/components/shared";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

const LEVELS = ["BEGINNER", "DEVELOPING", "COMPETENT", "PROFICIENT", "EXPERT"] as const;

function levelVariant(level: string): "success" | "warning" | "info" {
  if (level === "COMPETENT" || level === "PROFICIENT" || level === "EXPERT") return "success";
  if (level === "DEVELOPING") return "warning";
  return "info";
}

interface StudentOption {
  studentId: string;
  name: string;
}

export default function CompetencyPage() {
  const [fwPage, setFwPage] = useState(1);
  const [compPage, setCompPage] = useState(1);
  const { can, user, isStudent } = usePermissions();
  const queryClient = useQueryClient();

  const canAssess = can("competency.assess");

  const { data: frameworks, isLoading: loadingFw } = useQuery({
    queryKey: ["frameworks", fwPage],
    queryFn: () => competencyApi.listFrameworks({ page: String(fwPage), limit: "15" }),
  });
  const { data: competencies, isLoading: loadingComp } = useQuery({
    queryKey: ["competencies", compPage],
    queryFn: () => competencyApi.listCompetencies({ page: String(compPage), limit: "15" }),
  });

  const fwList = frameworks?.data?.data?.items ?? [];
  const fwPagination = frameworks?.data?.data?.pagination;
  const compList = competencies?.data?.data?.items ?? [];
  const compPagination = competencies?.data?.data?.pagination;

  // ─── Student competency assessment section ───────────────────────────
  const [selStudentId, setSelStudentId] = useState("");
  const [selFwId, setSelFwId] = useState("");
  const frameworkId = selFwId || String(fwList[0]?.id ?? "");
  const activeStudentId = isStudent ? String(user?.id ?? "") : selStudentId;

  const { data: studentOptions, isLoading: loadingStudents } = useQuery({
    queryKey: ["assess-students", user?.id, user?.role],
    queryFn: async (): Promise<StudentOption[]> => {
      if (user!.role === "CLINICAL_INSTRUCTOR") {
        // Clinical instructors know their students through rotations
        const rotRes = await clinicalRleApi.listRotations({ limit: "100" });
        const rotations = (rotRes.data?.data?.items ?? []) as Record<string, unknown>[];
        const mine = rotations.filter((r) => r.instructorId === user!.id);
        const lists = await Promise.all(mine.map((r) => clinicalRleApi.listRotationStudents(String(r.id))));
        const map = new Map<string, StudentOption>();
        for (const l of lists) {
          const d = l.data?.data;
          const arr = (Array.isArray(d) ? d : ((d as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[];
          for (const s of arr) {
            map.set(String(s.studentId), {
              studentId: String(s.studentId),
              name: `${s.firstName} ${s.lastName}`,
            });
          }
        }
        return [...map.values()];
      }
      const params: Record<string, string> = { limit: "500" };
      if (user!.role === "INSTRUCTOR") params.instructorId = String(user!.id);
      const res = await academicApi.listEnrollments(params);
      const items = (res.data?.data?.items ?? []) as Record<string, unknown>[];
      const map = new Map<string, StudentOption>();
      for (const e of items) {
        map.set(String(e.studentId), {
          studentId: String(e.studentId),
          name: `${e.studentFirstName} ${e.studentLastName}`,
        });
      }
      return [...map.values()];
    },
    enabled: !!user && canAssess && !isStudent,
  });

  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ["student-competency-summary", activeStudentId, frameworkId],
    queryFn: () => competencyApi.getStudentCompetencySummary(activeStudentId, frameworkId),
    enabled: !!activeStudentId && !!frameworkId,
  });
  const summary = summaryRes?.data?.data;

  const [assessTarget, setAssessTarget] = useState<{ competencyId: string; name: string; currentLevel: string } | null>(null);
  const [level, setLevel] = useState<string>("COMPETENT");
  const [score, setScore] = useState("");
  const [comments, setComments] = useState("");

  const assessMutation = useMutation({
    mutationFn: () =>
      competencyApi.assessCompetency({
        studentId: activeStudentId,
        competencyId: assessTarget!.competencyId,
        levelAchieved: level,
        score: score ? Number(score) : undefined,
        comments: comments || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-competency-summary", activeStudentId] });
      toast.success("Competency assessment recorded");
      setAssessTarget(null);
    },
    onError: () => toast.error("Failed to record assessment"),
  });

  const openAssess = (row: Record<string, unknown>) => {
    const comp = row.competency as Record<string, unknown>;
    setAssessTarget({
      competencyId: String(comp.id),
      name: String(comp.name),
      currentLevel: String(row.currentLevel),
    });
    setLevel(String(row.currentLevel));
    setScore("");
    setComments("");
  };

  const showSection = canAssess || isStudent;

  return (
    <div>
      <PageHeader title="Competency Framework" subtitle="Track nursing competency progression" />

      {(loadingFw || loadingComp) ? <LoadingSpinner /> : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Frameworks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fwList.map((fw: Record<string, unknown>) => (
                <Card key={String(fw.id)}>
                  <div className="flex items-start gap-3">
                    <Target size={20} className="text-primary-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium">{String(fw.name)}</h3>
                      {fw.description ? <p className="text-sm text-gray-500 mt-1">{String(fw.description)}</p> : null}
                      <div className="mt-2">
                        <Badge variant="info">{String(fw.frameworkType)}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {fwList.length === 0 && <p className="text-gray-400 col-span-3">No frameworks found</p>}
            </div>
            {fwPagination && fwPagination.totalPages > 1 && (
              <PaginationControls page={fwPage} totalPages={fwPagination.totalPages} total={fwPagination.total} onPageChange={setFwPage} />
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Competencies</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {compList.map((c: Record<string, unknown>) => (
                    <tr key={String(c.id)} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{String(c.name)}</td>
                      <td className="px-4 py-3"><Badge variant="info">{String(c.category)}</Badge></td>
                      <td className="px-4 py-3">{String(c.level || "-")}</td>
                    </tr>
                  ))}
                  {compList.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No competencies found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {compPagination && compPagination.totalPages > 1 && (
              <PaginationControls page={compPage} totalPages={compPagination.totalPages} total={compPagination.total} onPageChange={setCompPage} />
            )}
          </div>

          {showSection && (
            <div>
              <h2 className="text-lg font-semibold mb-3">
                {isStudent ? "My Competency Progress" : "Student Competency Assessment"}
              </h2>
              <Card className="mb-4">
                <div className="flex flex-wrap gap-4">
                  {!isStudent && (
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                      <select
                        value={selStudentId}
                        onChange={(e) => setSelStudentId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      >
                        <option value="">Select a student…</option>
                        {(studentOptions ?? []).map((s) => (
                          <option key={s.studentId} value={s.studentId}>{s.name}</option>
                        ))}
                      </select>
                      {loadingStudents && <p className="text-xs text-gray-400 mt-1">Loading students…</p>}
                      {!loadingStudents && (studentOptions ?? []).length === 0 && (
                        <p className="text-xs text-gray-400 mt-1">No students found for your courses/rotations.</p>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Framework</label>
                    <select
                      value={frameworkId}
                      onChange={(e) => setSelFwId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {fwList.map((fw: Record<string, unknown>) => (
                        <option key={String(fw.id)} value={String(fw.id)}>{String(fw.name)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>

              {!activeStudentId ? (
                <p className="text-sm text-gray-400">Select a student to view competency progress.</p>
              ) : !frameworkId ? (
                <p className="text-sm text-gray-400">No competency framework available.</p>
              ) : loadingSummary ? (
                <LoadingSpinner />
              ) : !summary ? (
                <p className="text-sm text-gray-400">No competency data found.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total competencies</p>
                      <p className="text-xl font-semibold">{summary.stats.total}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Achieved</p>
                      <p className="text-xl font-semibold text-green-600">{summary.stats.achieved}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Completion</p>
                      <p className="text-xl font-semibold text-primary-600">{summary.stats.percentage}%</p>
                    </div>
                    <div className="bg-white border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Avg. gap to target</p>
                      <p className="text-xl font-semibold text-amber-600">{summary.stats.averageGap}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Competency</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">Category</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">Target</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">Current</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">Gap</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Achieved</th>
                          {!isStudent && canAssess && <th className="px-4 py-3 w-28" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.competencies.map((row: Record<string, unknown>) => {
                          const comp = row.competency as Record<string, unknown>;
                          return (
                            <tr key={String(comp.id)} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{String(comp.name)}</td>
                              <td className="px-4 py-3">
                                {comp.category ? <Badge variant="info">{String(comp.category)}</Badge> : "—"}
                              </td>
                              <td className="px-4 py-3">{String(comp.targetLevel)}</td>
                              <td className="px-4 py-3">
                                <Badge variant={levelVariant(String(row.currentLevel))}>{String(row.currentLevel)}</Badge>
                              </td>
                              <td className="px-4 py-3">{String(row.gap)}</td>
                              <td className="px-4 py-3">{row.isAchieved ? "Yes" : "No"}</td>
                              {!isStudent && canAssess && (
                                <td className="px-4 py-3">
                                  <Button variant="secondary" onClick={() => openAssess(row)}>Assess</Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={!!assessTarget} onClose={() => setAssessTarget(null)} title={assessTarget ? `Assess: ${assessTarget.name}` : "Assess Competency"}>
        {assessTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Current level:{" "}
              <Badge variant={levelVariant(assessTarget.currentLevel)}>{assessTarget.currentLevel}</Badge>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observed level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score (0–100, optional)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments / evidence (optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Observed performance, clinical evidence..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAssessTarget(null)}>Cancel</Button>
              <Button onClick={() => assessMutation.mutate()} disabled={assessMutation.isPending}>
                {assessMutation.isPending ? "Saving..." : "Record Assessment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PaginationControls({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} total)</p>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
