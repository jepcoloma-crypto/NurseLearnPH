import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { academicApi, usersApi } from "@/services/api";
import { PageHeader, StatCard } from "@/components/shared";
import { Panel, QuickActions, StatsRow } from "./widgets";
import AnnouncementsFeed from "./AnnouncementsFeed";
import {
  BookOpen, LayoutGrid, GraduationCap, Users, Settings, Megaphone, ClipboardList,
} from "lucide-react";

/** Home screen for PROGRAM_COORDINATOR: program-level academic overview. */
export default function CoordinatorHome() {
  const { user } = useAuth();

  const { data: coursesRes } = useQuery({
    queryKey: ["courses", "count"],
    queryFn: () => academicApi.listCourses({ page: "1", limit: "1" }),
  });
  const { data: sectionsRes } = useQuery({
    queryKey: ["sections", "count"],
    queryFn: () => academicApi.listSections({ page: "1", limit: "1" }),
  });
  const { data: enrollmentsRes } = useQuery({
    queryKey: ["enrollments", "count"],
    queryFn: () => academicApi.listEnrollments({ page: "1", limit: "1" }),
  });
  const { data: usersRes } = useQuery({
    queryKey: ["users", "count", "dashboard"],
    queryFn: () => usersApi.list({ page: "1", limit: "1" }),
  });

  const courseTotal = coursesRes?.data?.data?.pagination?.total ?? 0;
  const sectionTotal = sectionsRes?.data?.data?.pagination?.total ?? 0;
  const enrollmentTotal = enrollmentsRes?.data?.data?.pagination?.total ?? 0;
  const userTotal = usersRes?.data?.data?.pagination?.total ?? 0;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName || "User"}!`}
        subtitle="Program overview — courses, sections and enrollment"
      />

      <StatsRow>
        <StatCard label="Courses" value={courseTotal} icon={<BookOpen size={20} />} />
        <StatCard label="Sections" value={sectionTotal} icon={<LayoutGrid size={20} />} />
        <StatCard label="Enrolled students" value={enrollmentTotal} icon={<GraduationCap size={20} />} />
        <StatCard label="Users" value={userTotal} icon={<Users size={20} />} />
      </StatsRow>

      <AnnouncementsFeed />

      <Panel title="Quick Actions">
        <QuickActions
          items={[
            { to: "/courses", label: "Courses", icon: <BookOpen size={16} /> },
            { to: "/sections", label: "Sections", icon: <LayoutGrid size={16} /> },
            { to: "/enrollments", label: "Enrollments", icon: <GraduationCap size={16} /> },
            { to: "/academic-setup", label: "Academic Setup", icon: <Settings size={16} /> },
            { to: "/questions", label: "Question Bank", icon: <ClipboardList size={16} /> },
            { to: "/announcements", label: "Announcements", icon: <Megaphone size={16} /> },
          ]}
        />
      </Panel>
    </div>
  );
}
