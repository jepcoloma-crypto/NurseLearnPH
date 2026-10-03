import { useQuery } from "@tanstack/react-query";
import { academicApi, assessmentApi, clinicalApi, announcementApi } from "@/services/api";
import { PageHeader, StatCard } from "@/components/shared";
import { BookOpen, ClipboardList, GraduationCap, Stethoscope, Brain, Users, Megaphone, Paperclip } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();
  const isInstructor = user?.role === "INSTRUCTOR" || user?.role === "CLINICAL_INSTRUCTOR";
  const { data: courses } = useQuery({
    queryKey: ["courses", isInstructor ? user?.id : undefined],
    queryFn: () => academicApi.listCourses({ instructorId: isInstructor ? user!.id : undefined }),
  });
  const { data: questions } = useQuery({
    queryKey: ["questions", isInstructor ? user?.id : undefined],
    queryFn: () => assessmentApi.listQuestions({ instructorId: isInstructor ? user!.id : undefined }),
  });
  const { data: assessments } = useQuery({
    queryKey: ["assessments", isInstructor ? user?.id : undefined],
    queryFn: () => assessmentApi.listAssessments({ instructorId: isInstructor ? user!.id : undefined }),
  });
  const { data: cases } = useQuery({
    queryKey: ["cases", isInstructor ? user?.id : undefined],
    queryFn: () => clinicalApi.listCases({ instructorId: isInstructor ? user!.id : undefined }),
  });
  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", user?.id],
    queryFn: () => academicApi.listEnrollments({ limit: "500", instructorId: user!.id }),
    enabled: isInstructor,
  });
  const { data: announcementsFeed } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: () =>
      announcementApi.list({
        limit: "5",
        publishedOnly: "true",
        // Only announcements this user hasn't read yet — once read, they
        // drop off the dashboard.
        unreadOnly: "true",
      }),
  });
  const allFeedItems = announcementsFeed?.data?.data?.items ?? [];
  // Safety net: never render an item whose read flag is already set.
  const feedItems = allFeedItems.filter(
    (a: Record<string, unknown>) => a.read !== true
  );

  const courseCount = courses?.data?.data?.items?.length ?? 0;
  const questionCount = questions?.data?.data?.items?.length ?? 0;
  const assessmentCount = assessments?.data?.data?.items?.length ?? 0;
  const caseCount = cases?.data?.data?.items?.length ?? 0;
  const studentCount = new Set((enrollments?.data?.data?.items ?? []).map((e: Record<string, unknown>) => String(e.studentId))).size;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName || "User"}!`}
        subtitle="Nursing Competency, Clinical Reasoning & Learning Platform"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Courses" value={courseCount} icon={<BookOpen size={20} />} />
        <StatCard label="Questions" value={questionCount} icon={<ClipboardList size={20} />} />
        <StatCard label="Assessments" value={assessmentCount} icon={<GraduationCap size={20} />} />
        <StatCard label="Clinical Cases" value={caseCount} icon={<Stethoscope size={20} />} />
        {isInstructor && <StatCard label="My Students" value={studentCount} icon={<Users size={20} />} />}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <Megaphone size={16} className="text-primary-600" /> Announcements
          </h3>
          <a href="/announcements" className="text-sm text-primary-600 hover:underline">View all</a>
        </div>
        {feedItems.length === 0 ? (
          <p className="text-sm text-gray-500">You&rsquo;re all caught up — no unread announcements.</p>
        ) : (
          <div className="space-y-2">
            {feedItems.map((a: Record<string, unknown>) => {
              const fileCount = Array.isArray(a.attachments) ? a.attachments.length : 0;
              const priority = String(a.priority);
              const showChip = priority === "URGENT" || priority === "HIGH";
              return (
                <a
                  key={String(a.id)}
                  href="/announcements"
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${
                      priority === "URGENT"
                        ? "bg-red-500"
                        : priority === "HIGH"
                        ? "bg-amber-500"
                        : "bg-primary-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {a.read === false && (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle"
                          title="Unread"
                        />
                      )}
                      {String(a.title)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.courseId
                        ? `${String(a.courseCode || "")} ${String(a.courseName || "")}`.trim()
                        : "Institution-wide"}
                      {" · "}{new Date(String(a.createdAt)).toLocaleDateString()}
                      {fileCount > 0 && ` · ${fileCount} file${fileCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {showChip && (
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                        priority === "URGENT"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {priority}
                    </span>
                  )}
                  {fileCount > 0 && <Paperclip size={14} className="shrink-0 text-gray-400" />}
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <a href="/courses" className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <BookOpen size={16} className="text-primary-600" />
              <span className="text-sm font-medium">View Courses</span>
            </a>
            <a href="/questions" className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ClipboardList size={16} className="text-primary-600" />
              <span className="text-sm font-medium">Question Bank</span>
            </a>
            <a href="/cases" className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Stethoscope size={16} className="text-primary-600" />
              <span className="text-sm font-medium">Clinical Cases</span>
            </a>
            <a href="/ai-tutor" className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Brain size={16} className="text-primary-600" />
              <span className="text-sm font-medium">AI Tutor</span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Your Account</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
