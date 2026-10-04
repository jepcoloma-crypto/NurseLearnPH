import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/utils/permissions";
import { academicApi, assessmentApi, clinicalApi, skillsApi } from "@/services/api";
import { PageHeader, StatCard, Badge } from "@/components/shared";
import { Panel, QuickActions } from "./widgets";
import AnnouncementsFeed from "./AnnouncementsFeed";
import {
  BookOpen, ClipboardList, GraduationCap, Stethoscope, Users,
  ClipboardCheck, BarChart3, Megaphone, Sparkles,
} from "lucide-react";

interface PendingSignOff {
  id: string;
  studentFirstName: string;
  studentLastName: string;
  skillName: string;
  skillCategory: string;
  requestedAssessment: boolean;
  lastPracticeAt: string | null;
}

/**
 * Home screen for INSTRUCTOR and CLINICAL_INSTRUCTOR: everything scoped to
 * the courses they teach, plus skill sign-off requests from students.
 */
export default function InstructorHome() {
  const { user } = useAuth();
  const instructorId = user?.id;
  const canSignOff = hasPermission(user, "skills.signoff");

  const { data: coursesRes } = useQuery({
    queryKey: ["courses", "count", instructorId],
    queryFn: () => academicApi.listCourses({ page: "1", limit: "1", instructorId }),
  });
  const { data: questionsRes } = useQuery({
    queryKey: ["questions", "count", instructorId],
    queryFn: () => assessmentApi.listQuestions({ page: "1", limit: "1", instructorId }),
  });
  const { data: assessmentsRes } = useQuery({
    queryKey: ["assessments", "count", instructorId],
    queryFn: () => assessmentApi.listAssessments({ page: "1", limit: "1", instructorId }),
  });
  const { data: casesRes } = useQuery({
    queryKey: ["cases", "count", instructorId],
    queryFn: () => clinicalApi.listCases({ page: "1", limit: "1", instructorId }),
  });
  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", instructorId],
    queryFn: () => academicApi.listEnrollments({ limit: "500", instructorId }),
  });
  const { data: signOffsRes } = useQuery({
    queryKey: ["skills", "pending-assessments"],
    queryFn: () => skillsApi.getPendingAssessments(),
    enabled: canSignOff,
  });

  const courseCount = coursesRes?.data?.data?.pagination?.total ?? 0;
  const questionCount = questionsRes?.data?.data?.pagination?.total ?? 0;
  const assessmentCount = assessmentsRes?.data?.data?.pagination?.total ?? 0;
  const caseCount = casesRes?.data?.data?.pagination?.total ?? 0;
  const studentCount = new Set(
    (enrollments?.data?.data?.items ?? []).map((e: Record<string, unknown>) => String(e.studentId))
  ).size;
  const signOffs = (signOffsRes?.data?.data ?? []) as PendingSignOff[];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName || "User"}!`}
        subtitle="Your teaching overview — courses, assessments and students"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="My Courses" value={courseCount} icon={<BookOpen size={20} />} />
        <StatCard label="Questions" value={questionCount} icon={<ClipboardList size={20} />} />
        <StatCard label="Assessments" value={assessmentCount} icon={<GraduationCap size={20} />} />
        <StatCard label="Clinical Cases" value={caseCount} icon={<Stethoscope size={20} />} />
        <StatCard label="My Students" value={studentCount} icon={<Users size={20} />} />
      </div>

      {canSignOff && (
        <Panel
          title="Skill sign-offs requested"
          icon={<ClipboardCheck size={16} />}
          className="mb-6"
          action={
            <Link to="/skills" className="text-sm text-primary-600 hover:underline">
              Open Skills Lab
            </Link>
          }
        >
          {signOffs.length === 0 ? (
            <p className="text-sm text-gray-500">No students are waiting for a skill sign-off.</p>
          ) : (
            <div className="space-y-2">
              {signOffs.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.studentFirstName} {s.studentLastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.skillName}
                      {s.skillCategory ? ` · ${s.skillCategory}` : ""}
                      {s.lastPracticeAt
                        ? ` · last practiced ${new Date(s.lastPracticeAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={s.requestedAssessment ? "warning" : "default"}>
                    {s.requestedAssessment ? "Sign-off requested" : "Practiced"}
                  </Badge>
                </div>
              ))}
              {signOffs.length > 5 && (
                <p className="text-xs text-gray-400">+{signOffs.length - 5} more in Skills Lab</p>
              )}
            </div>
          )}
        </Panel>
      )}

      <AnnouncementsFeed />

      <Panel title="Quick Actions">
        <QuickActions
          items={[
            { to: "/my-students", label: "My Students", icon: <Users size={16} /> },
            { to: "/gradebook", label: "Gradebook", icon: <BarChart3 size={16} /> },
            { to: "/questions", label: "Question Bank", icon: <ClipboardList size={16} /> },
            { to: "/cases", label: "Clinical Cases", icon: <Stethoscope size={16} /> },
            { to: "/ai-content", label: "AI Content", icon: <Sparkles size={16} /> },
            { to: "/announcements", label: "Announcements", icon: <Megaphone size={16} /> },
          ]}
        />
      </Panel>
    </div>
  );
}
