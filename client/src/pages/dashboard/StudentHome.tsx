import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { analyticsApi } from "@/services/api";
import { PageHeader, StatCard } from "@/components/shared";
import { Panel, QuickActions, StatsRow } from "./widgets";
import AnnouncementsFeed from "./AnnouncementsFeed";
import {
  BookOpen, ClipboardCheck, GraduationCap, MessageSquare,
  Stethoscope, Trophy, TrendingUp, BarChart3, Award, PlayCircle,
} from "lucide-react";

interface StudentAnalytics {
  stats: {
    totalCourses: number;
    averageScore: number | null;
    completionRate: number;
    skillsCompetent: number;
    skillsTotal: number;
  };
  enrollments: Array<{
    course: { id: string; name: string; code: string };
    lessonsCompleted: number;
    lessonsTotal: number;
    averageScore: number | null;
  }>;
}

/** Home screen for STUDENT: personal progress, courses to continue, feed. */
export default function StudentHome() {
  const { user } = useAuth();

  const { data: analytics } = useQuery({
    queryKey: ["analytics-dashboard", user?.id],
    queryFn: () => analyticsApi.getStudentDashboard(),
    enabled: user?.role === "STUDENT" && !!user?.id,
  });

  const data = analytics?.data?.data as StudentAnalytics | undefined;
  const stats = data?.stats;
  const courseProgress = data?.enrollments ?? [];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName || "User"}!`}
        subtitle="Your learning overview — progress, scores and announcements"
      />

      <StatsRow>
        <StatCard label="Courses" value={stats?.totalCourses ?? 0} icon={<BookOpen size={20} />} />
        <StatCard
          label="Average Score"
          value={stats?.averageScore != null ? `${stats.averageScore}%` : "N/A"}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Completion Rate"
          value={`${stats?.completionRate ?? 0}%`}
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label="Skills Competent"
          value={`${stats?.skillsCompetent ?? 0}/${stats?.skillsTotal ?? 0}`}
          icon={<Award size={20} />}
        />
      </StatsRow>

      <Panel
        title="Continue learning"
        icon={<PlayCircle size={16} />}
        className="mb-6"
        action={
          <Link to="/courses" className="text-sm text-primary-600 hover:underline">
            All courses
          </Link>
        }
      >
        {courseProgress.length === 0 ? (
          <p className="text-sm text-gray-500">No enrolled courses yet — ask your coordinator to enroll you.</p>
        ) : (
          <div className="space-y-2">
            {courseProgress.slice(0, 5).map((e) => {
              const pct =
                e.lessonsTotal > 0
                  ? Math.round((e.lessonsCompleted / e.lessonsTotal) * 100)
                  : null;
              const courseLabel =
                `${String(e.course.code || "")} ${String(e.course.name)}`.trim();
              return (
                <div key={e.course.id} className="p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{courseLabel}</p>
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                        e.averageScore != null
                          ? "bg-primary-50 text-primary-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {e.averageScore != null ? `${e.averageScore}% avg` : "no score yet"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all"
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {e.lessonsCompleted}/{e.lessonsTotal} lessons
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <AnnouncementsFeed />

      <Panel title="Quick Actions">
        <QuickActions
          items={[
            { to: "/courses", label: "My Courses", icon: <BookOpen size={16} /> },
            { to: "/assessments", label: "Assessments", icon: <ClipboardCheck size={16} /> },
            { to: "/nle", label: "NLE Prep", icon: <GraduationCap size={16} /> },
            { to: "/ai-tutor", label: "AI Tutor", icon: <MessageSquare size={16} /> },
            { to: "/cases", label: "Clinical Cases", icon: <Stethoscope size={16} /> },
            { to: "/portfolio", label: "Portfolio", icon: <Trophy size={16} /> },
          ]}
        />
      </Panel>
    </div>
  );
}
