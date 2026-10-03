import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { assessmentApi, academicApi } from "@/services/api";
import { PageHeader, LoadingSpinner, Badge, Card, StatCard } from "@/components/shared";
import DataTable from "@/components/DataTable";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Users, FileCheck, Briefcase, Wrench, Activity } from "lucide-react";

type Tab = "overview" | "assessments" | "cases" | "skills" | "activity";

export default function GradebookPage() {
  const { user } = useAuth();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const [courseId, setCourseId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("overview");

  const { data: coursesData } = useQuery({
    queryKey: ["courses-list", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ limit: "100", instructorId: isInstructor ? user!.id : undefined }),
  });

  const { data: gradebookData, isLoading } = useQuery({
    queryKey: ["full-gradebook", courseId],
    queryFn: () => assessmentApi.getFullGradebook(courseId),
    enabled: !!courseId,
  });

  const courseList = coursesData?.data?.data?.items ?? [];
  const gradebook = gradebookData?.data?.data;
  const students = gradebook?.students ?? [];
  const totals = gradebook?.totals;

  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(students.length / PAGE_SIZE);
  const pagedStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 size={16} /> },
    { key: "assessments", label: "Assessments", icon: <FileCheck size={16} /> },
    { key: "cases", label: "Clinical Cases", icon: <Briefcase size={16} /> },
    { key: "skills", label: "Skills Lab", icon: <Wrench size={16} /> },
    { key: "activity", label: "Activity Log", icon: <Activity size={16} /> },
  ];

  return (
    <div>
      <PageHeader title="Gradebook" subtitle="Track student performance across all activities" />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
        <select
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setPage(1); setTab("overview"); }}
          className="w-full max-w-md px-3 py-2 border rounded-lg"
        >
          <option value="">-- Select a course --</option>
          {courseList.map((c: Record<string, unknown>) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.code)} - {String(c.name)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : courseId && gradebook ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Students" value={String(totals?.students ?? 0)} icon={<Users size={20} />} />
            <StatCard label="Assessments" value={String(totals?.assessments ?? 0)} icon={<FileCheck size={20} />} />
            <StatCard label="Clinical Cases" value={String(totals?.cases ?? 0)} icon={<Briefcase size={20} />} />
            <StatCard label="Skills" value={String(totals?.skills ?? 0)} icon={<Wrench size={20} />} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === "overview" && (
            <OverviewTab students={students} pagedStudents={pagedStudents} page={page} totalPages={totalPages} total={students.length} onPageChange={setPage} />
          )}
          {tab === "assessments" && (
            <AssessmentsTab assessments={gradebook.assessments} pagedStudents={pagedStudents} page={page} totalPages={totalPages} total={students.length} onPageChange={setPage} />
          )}
          {tab === "cases" && (
            <CasesTab cases={gradebook.cases} pagedStudents={pagedStudents} page={page} totalPages={totalPages} total={students.length} onPageChange={setPage} />
          )}
          {tab === "skills" && (
            <SkillsTab skills={gradebook.skills} pagedStudents={pagedStudents} page={page} totalPages={totalPages} total={students.length} onPageChange={setPage} />
          )}
          {tab === "activity" && (
            <ActivityTab activity={gradebook.recentActivity} />
          )}
        </>
      ) : courseId ? (
        <Card><p className="text-gray-500 text-center py-8">No data available for this course</p></Card>
      ) : null}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ students, pagedStudents, page, totalPages, total, onPageChange }: {
  students: Array<{ name: string; studentId?: string; avgAssessment: number | null; avgCase: number | null; completedSkills: number; totalSkills: number }>;
  pagedStudents: typeof students;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const columns = [
    { key: "name", label: "Student", render: (row: Record<string, unknown>) => (
      row.studentId ? (
        <Link to={`/students/${String(row.studentId)}/profile`} className="text-primary-600 hover:underline font-medium">
          {String(row.name)}
        </Link>
      ) : <span className="font-medium">{String(row.name)}</span>
    )},
    { key: "avgAssessment", label: "Assessment Avg", render: (row: Record<string, unknown>) => (
      row.avgAssessment != null ? <Badge variant={Number(row.avgAssessment) >= 75 ? "success" : Number(row.avgAssessment) >= 50 ? "warning" : "danger"}>{String(row.avgAssessment)}%</Badge> : <span className="text-gray-400">—</span>
    )},
    { key: "avgCase", label: "Case Avg", render: (row: Record<string, unknown>) => (
      row.avgCase != null ? <Badge variant={Number(row.avgCase) >= 75 ? "success" : Number(row.avgCase) >= 50 ? "warning" : "danger"}>{String(row.avgCase)}%</Badge> : <span className="text-gray-400">—</span>
    )},
    { key: "skills", label: "Skills Progress", render: (row: Record<string, unknown>) => (
      <span>{String(row.completedSkills)}/{String(row.totalSkills)}</span>
    )},
  ];

  return <DataTable columns={columns} data={pagedStudents as Record<string, unknown>[]} pagination={{ page, totalPages: totalPages || 1, total }} onPageChange={onPageChange} emptyMessage="No students enrolled" />;
}

// ─── Assessments Tab ─────────────────────────────────────────────────────────

function AssessmentsTab({ assessments, pagedStudents, page, totalPages, total, onPageChange }: {
  assessments: Array<{ id: string; title: string; passingScore: number; attempts: Array<{ studentId: string; score: number | null; status: string }> }>;
  pagedStudents: Array<{ studentId: string; name: string }>;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const columns = [
    { key: "name", label: "Student", render: (row: Record<string, unknown>) => (
      <Link to={`/students/${String(row.studentId)}/profile`} className="text-primary-600 hover:underline font-medium">
        {String(row.name)}
      </Link>
    )},
    ...assessments.map((a) => ({
      key: a.id,
      label: a.title.length > 20 ? a.title.slice(0, 20) + "…" : a.title,
      render: (row: Record<string, unknown>) => {
        const attempt = a.attempts.find((att) => att.studentId === row.studentId && (att.status === "SUBMITTED" || att.status === "GRADED"));
        if (!attempt || attempt.score === null) return <span className="text-gray-400">—</span>;
        const passed = attempt.score >= a.passingScore;
        return <Badge variant={passed ? "success" : "danger"}>{attempt.score}</Badge>;
      },
    })),
    {
      key: "average",
      label: "Avg",
      render: (row: Record<string, unknown>) => {
        const scores = assessments.flatMap((a) =>
          a.attempts.filter((att) => att.studentId === row.studentId && att.score !== null).map((att) => att.score as number)
        );
        if (scores.length === 0) return <span className="text-gray-400">—</span>;
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        return <span className="font-medium">{avg}</span>;
      },
    },
  ];

  return <DataTable columns={columns} data={pagedStudents as Record<string, unknown>[]} pagination={{ page, totalPages: totalPages || 1, total }} onPageChange={onPageChange} emptyMessage="No students" />;
}

// ─── Clinical Cases Tab ──────────────────────────────────────────────────────

function CasesTab({ cases, pagedStudents, page, totalPages, total, onPageChange }: {
  cases: Array<{ id: string; title: string; attempts: Array<{ studentId: string; score: number; totalPoints: number; status: string }> }>;
  pagedStudents: Array<{ studentId: string; name: string }>;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const columns = [
    { key: "name", label: "Student", render: (row: Record<string, unknown>) => (
      <Link to={`/students/${String(row.studentId)}/profile`} className="text-primary-600 hover:underline font-medium">
        {String(row.name)}
      </Link>
    )},
    ...cases.map((c) => ({
      key: c.id,
      label: c.title.length > 20 ? c.title.slice(0, 20) + "…" : c.title,
      render: (row: Record<string, unknown>) => {
        const completedAttempts = c.attempts.filter((att) => att.studentId === row.studentId && att.status === "COMPLETED");
        if (completedAttempts.length === 0) return <span className="text-gray-400">—</span>;
        const best = Math.max(...completedAttempts.map((a) => a.score));
        const total = completedAttempts[0].totalPoints;
        const pct = total > 0 ? Math.round((best / total) * 100) : 0;
        return (
          <div className="flex items-center gap-1">
            <Badge variant={pct >= 75 ? "success" : pct >= 50 ? "warning" : "danger"}>{best}/{total}</Badge>
            <span className="text-xs text-gray-500">({completedAttempts.length}x)</span>
          </div>
        );
      },
    })),
  ];

  return <DataTable columns={columns} data={pagedStudents as Record<string, unknown>[]} pagination={{ page, totalPages: totalPages || 1, total }} onPageChange={onPageChange} emptyMessage="No students" />;
}

// ─── Skills Tab ──────────────────────────────────────────────────────────────

function SkillsTab({ skills: skillData, pagedStudents, page, totalPages, total, onPageChange }: {
  skills: Array<{ id: string; name: string; category: string; records: Array<{ studentId: string; isCompetent: boolean; bestScore: number; attemptsCount: number }> }>;
  pagedStudents: Array<{ studentId: string; name: string }>;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const columns = [
    { key: "name", label: "Student", render: (row: Record<string, unknown>) => (
      <Link to={`/students/${String(row.studentId)}/profile`} className="text-primary-600 hover:underline font-medium">
        {String(row.name)}
      </Link>
    )},
    ...skillData.map((s) => ({
      key: s.id,
      label: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
      render: (row: Record<string, unknown>) => {
        const record = s.records.find((r) => r.studentId === row.studentId);
        if (!record) return <Badge variant="default">Not Started</Badge>;
        if (record.isCompetent) return <Badge variant="success">Competent</Badge>;
        if (record.attemptsCount > 0) return <Badge variant="warning">Attempt {String(record.attemptsCount)} (Best: {String(record.bestScore)})</Badge>;
        return <Badge variant="default">Not Started</Badge>;
      },
    })),
  ];

  return <DataTable columns={columns} data={pagedStudents as Record<string, unknown>[]} pagination={{ page, totalPages: totalPages || 1, total }} onPageChange={onPageChange} emptyMessage="No students" />;
}

// ─── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({ activity }: { activity: Array<{ studentName: string; action: string; resource: string; createdAt: string }> }) {
  if (activity.length === 0) return <Card><p className="text-gray-500 text-center py-8">No recent activity</p></Card>;

  return (
    <Card>
      <div className="divide-y">
        {activity.map((a, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div>
              <span className="font-medium text-gray-900">{a.studentName}</span>
              <span className="text-gray-500 mx-1">—</span>
              <span className="text-sm text-gray-600">{a.action.replace(/_/g, " ").toLowerCase()}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-xs text-gray-400">{a.resource}</span>
            </div>
            <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
