import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { academicApi, usersApi, adminApi } from "@/services/api";
import { PageHeader, StatCard, Badge } from "@/components/shared";
import { Panel, QuickActions, StatsRow } from "./widgets";
import AnnouncementsFeed from "./AnnouncementsFeed";
import {
  Users, UserCheck, BookOpen, History, Settings, Megaphone,
  ClipboardList, Shield, GraduationCap, ScrollText,
} from "lucide-react";

/** Home screen for ADMIN: platform overview, approvals and audit activity. */
export default function AdminHome() {
  const { user } = useAuth();

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ["users", "count", "dashboard"],
    queryFn: () => usersApi.list({ page: "1", limit: "1" }),
  });
  const { data: pendingRes, isLoading: pendingLoading } = useQuery({
    queryKey: ["users", "pending", "dashboard"],
    queryFn: () => usersApi.list({ page: "1", limit: "5", pending: "true" }),
  });
  const { data: coursesRes, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", "count"],
    queryFn: () => academicApi.listCourses({ page: "1", limit: "1" }),
  });
  const { data: auditRes, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs", "dashboard"],
    queryFn: () => adminApi.listAuditLogs({ page: "1", limit: "5" }),
  });

  const userTotal = usersRes?.data?.data?.pagination?.total ?? 0;
  const pendingItems = pendingRes?.data?.data?.items ?? [];
  const pendingTotal = pendingRes?.data?.data?.pagination?.total ?? 0;
  const courseTotal = coursesRes?.data?.data?.pagination?.total ?? 0;
  const auditItems = auditRes?.data?.data?.items ?? [];
  const auditTotal = auditRes?.data?.data?.pagination?.total ?? 0;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName || "User"}!`}
        subtitle="Platform overview — users, approvals and activity"
      />

      <StatsRow>
        <StatCard label="Users" value={userTotal} icon={<Users size={20} />} loading={usersLoading} />
        <StatCard label="Pending approvals" value={pendingTotal} icon={<UserCheck size={20} />} loading={pendingLoading} />
        <StatCard label="Courses" value={courseTotal} icon={<BookOpen size={20} />} loading={coursesLoading} />
        <StatCard label="Audit events" value={auditTotal} icon={<History size={20} />} loading={auditLoading} />
      </StatsRow>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel
          title="Awaiting approval"
          icon={<UserCheck size={16} />}
          action={
            <Link to="/users" className="text-sm text-primary-600 hover:underline">
              Review all
            </Link>
          }
        >
          {pendingTotal === 0 ? (
            <p className="text-sm text-gray-500">No accounts waiting for approval.</p>
          ) : (
            <div className="space-y-2">
              {pendingItems.map((u: Record<string, unknown>) => (
                <div
                  key={String(u.id)}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {String(u.firstName)} {String(u.lastName)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{String(u.email)}</p>
                  </div>
                  <Link to="/users" className="shrink-0 text-sm text-primary-600 hover:underline">
                    Review
                  </Link>
                </div>
              ))}
              {pendingTotal > pendingItems.length && (
                <p className="text-xs text-gray-400">
                  +{pendingTotal - pendingItems.length} more in Users
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          icon={<History size={16} />}
          action={
            <Link to="/audit-log" className="text-sm text-primary-600 hover:underline">
              Audit log
            </Link>
          }
        >
          {auditItems.length === 0 ? (
            <p className="text-sm text-gray-500">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {auditItems.map((a: Record<string, unknown>, i: number) => (
                <li
                  key={String(a.id ?? `audit-${i}`)}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex items-center gap-2">
                    <Badge variant="info">{String(a.action)}</Badge>
                    <span className="text-gray-700 truncate">{String(a.resource)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(String(a.createdAt)).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <AnnouncementsFeed />

      <Panel title="Quick Actions">
        <QuickActions
          items={[
            { to: "/users", label: "Users", icon: <Users size={16} /> },
            { to: "/academic-setup", label: "Academic Setup", icon: <Settings size={16} /> },
            { to: "/courses", label: "Courses", icon: <BookOpen size={16} /> },
            { to: "/questions", label: "Question Bank", icon: <ClipboardList size={16} /> },
            { to: "/announcements", label: "Announcements", icon: <Megaphone size={16} /> },
            { to: "/audit-log", label: "Audit Log", icon: <Shield size={16} /> },
            { to: "/accreditation", label: "Accreditation", icon: <ScrollText size={16} /> },
            { to: "/sections", label: "Sections", icon: <GraduationCap size={16} /> },
          ]}
        />
      </Panel>
    </div>
  );
}
