import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, StatCard, LoadingSpinner, Card } from "@/components/shared";
import { BarChart3, TrendingUp, BookOpen, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"];

interface DashboardData {
  enrollments: Array<{
    course: { id: string; name: string; code: string };
    lessonsCompleted: number;
    lessonsTotal: number;
    averageScore: number | null;
    skillsCompetent: number;
  }>;
  stats: {
    totalCourses: number;
    totalAssessments: number;
    averageScore: number | null;
    completionRate: number;
    skillsCompetent: number;
    skillsTotal: number;
    competenciesAchieved: number;
    competenciesTotal: number;
  };
  gradeDistribution: Array<{ name: string; value: number }>;
  recentActivity: Array<{ id: string; action: string; resource: string; createdAt: string }>;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["analytics-dashboard", user?.id],
    queryFn: () => analyticsApi.getStudentDashboard(),
    enabled: isStudent && !!user?.id,
  });

  const data = dashboard?.data?.data as DashboardData | undefined;
  const stats = data?.stats;
  const gradeDistribution = data?.gradeDistribution ?? [];
  const hasGrades = gradeDistribution.some((g) => g.value > 0);
  const courseScores = (data?.enrollments ?? [])
    .filter((e) => e.averageScore !== null && e.averageScore !== undefined)
    .map((e) => ({ name: e.course.code || e.course.name, value: e.averageScore as number }));
  const recentActivity = data?.recentActivity ?? [];

  if (!isStudent) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Track your learning progress and performance" />
        <Card>
          <p className="text-sm text-gray-600">
            This page shows personal learning analytics for students. Instructors can review class
            performance from the <span className="font-medium">Gradebook</span> and{" "}
            <span className="font-medium">Student Profile</span> pages.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Track your learning progress and performance" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Track your learning progress and performance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Average Score"
          value={stats?.averageScore != null ? `${stats.averageScore}%` : "N/A"}
          icon={<TrendingUp size={20} />}
        />
        <StatCard label="Completion Rate" value={`${stats?.completionRate ?? 0}%`} icon={<BarChart3 size={20} />} />
        <StatCard label="Courses Enrolled" value={String(stats?.totalCourses ?? 0)} icon={<BookOpen size={20} />} />
        <StatCard
          label="Skills Competent"
          value={`${stats?.skillsCompetent ?? 0}/${stats?.skillsTotal ?? 0}`}
          icon={<Award size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold mb-4">Grade Distribution</h3>
          {hasGrades ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {gradeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {gradeDistribution.map((g, i) => (
                  <div key={g.name} className="flex items-center gap-1 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {g.name} ({g.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-500">
              No graded assessment attempts yet.
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Average Score by Course</h3>
          {courseScores.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={courseScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-500">
              No assessment scores yet.
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recentActivity.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-gray-700">{a.action} · {a.resource}</span>
                <span className="text-gray-400 text-xs">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No recent activity recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
