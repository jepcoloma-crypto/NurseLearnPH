import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, GraduationCap, ClipboardList,
  Stethoscope, Brain, FileText, BarChart3, Users, Settings,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, Menu, Megaphone,
  ClipboardCheck, Trophy, FlaskConical, MessageSquare, Shield, Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, type Permission } from "@/utils/permissions";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  /** If set, only these roles see this item */
  roles?: string[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
    ],
  },
  {
    title: "Learning",
    items: [
      { to: "/courses", label: "Courses", icon: BookOpen, permission: "courses.view" },
      { to: "/topics", label: "Topics", icon: FileText, permission: "topics.view" },
      { to: "/lessons", label: "Lessons", icon: BookOpen, permission: "topics.view" },
    ],
  },
  {
    title: "Assessment",
    items: [
      { to: "/assessments", label: "Assessments", icon: ClipboardCheck, permission: "assessments.view" },
      { to: "/questions", label: "Question Bank", icon: ClipboardList, permission: "questions.view" },
      { to: "/gradebook", label: "Gradebook", icon: BarChart3, permission: "assessments.grade" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { to: "/cases", label: "Clinical Cases", icon: Stethoscope, permission: "cases.view" },
      { to: "/skills", label: "Skills Lab", icon: FlaskConical, permission: "skills.view" },
      { to: "/rotations", label: "Rotations", icon: ClipboardList, permission: "rotations.view", roles: ["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"] },
      { to: "/diagnoses", label: "Nursing Diagnoses", icon: Stethoscope, permission: "diagnoses.view" },
      { to: "/care-plans", label: "Care Plans", icon: ClipboardList, permission: "careplans.view" },
    ],
  },
  {
    title: "Student Tools",
    items: [
      { to: "/nle", label: "NLE Prep", icon: GraduationCap, permission: "nle.view" },
      { to: "/simulation", label: "Virtual Patients", icon: Brain, permission: "simulation.view" },
      { to: "/ai-tutor", label: "AI Tutor", icon: MessageSquare, permission: "ai-tutor.view" },
      { to: "/portfolio", label: "Portfolio", icon: Trophy, permission: "portfolio.view" },
      { to: "/competency", label: "Competency", icon: BarChart3, permission: "competency.view" },
      { to: "/my-rotations", label: "My Rotations", icon: Calendar, roles: ["STUDENT"] },
    ],
  },
  {
    title: "AI & Analytics",
    items: [
      { to: "/ai-content", label: "AI Content", icon: Settings, permission: "ai-content.view" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.student" },
      { to: "/research", label: "Research", icon: BarChart3, permission: "research.view" },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/announcements", label: "Announcements", icon: Megaphone, permission: "announcements.view" },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/users", label: "Users", icon: Users, permission: "users.view" },
      { to: "/my-students", label: "My Students", icon: GraduationCap, permission: "enrollments.view" },
      { to: "/enrollments", label: "Enrollments", icon: GraduationCap, permission: "enrollments.view" },
      { to: "/sections", label: "Sections", icon: Users, permission: "enrollments.view", roles: ["PROGRAM_COORDINATOR", "ADMIN"] },
      { to: "/academic-setup", label: "Academic Setup", icon: Calendar, permission: "enrollments.view", roles: ["PROGRAM_COORDINATOR", "ADMIN"] },
      { to: "/nle/admin", label: "NLE Question Bank", icon: GraduationCap, permission: "nle.manage", roles: ["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"] },
      { to: "/audit-log", label: "Audit Log", icon: Shield, permission: "admin.view-audit-logs" },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { user, logout } = useAuth();

  const toggleSection = (title: string) =>
    setClosedSections((prev) => ({ ...prev, [title]: !prev[title] }));

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.permission && !hasPermission(user, item.permission)) return false;
      if (item.roles && (!user || !item.roles.includes(user.role))) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const nav = (
    <nav className="flex-1 overflow-y-auto py-2">
      {visibleSections.map((section, si) => {
        const title = section.title;
        // Titled sections are collapsible. In icon-only (collapsed) mode all
        // items stay visible since the headers — and thus the reopen control —
        // are hidden there.
        const isOpen = !title || collapsed || !closedSections[title];
        return (
          <div key={si}>
            {title && !collapsed && (
              <button
                type="button"
                onClick={() => toggleSection(title)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
              >
                <span>{title}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                />
              </button>
            )}
            {isOpen &&
              section.items.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
          </div>
        );
      })}
    </nav>
  );

  const roleBadge = user ? (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      user.role === "ADMIN" ? "bg-red-100 text-red-700" :
      user.role === "INSTRUCTOR" ? "bg-green-100 text-green-700" :
      user.role === "PROGRAM_COORDINATOR" ? "bg-yellow-100 text-yellow-700" :
      user.role === "CLINICAL_INSTRUCTOR" ? "bg-purple-100 text-purple-700" :
      "bg-blue-100 text-blue-700"
    }`}>
      {user.role.replace("_", " ")}
    </span>
  ) : null;

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-primary-700">NurseLearn PH</h1>
              <p className="text-xs text-gray-400">Nursing Platform</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block p-1 hover:bg-gray-100 rounded">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {nav}

        <div className="border-t border-gray-200 p-3">
          {user && !collapsed && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
              <div className="mt-1">{roleBadge}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
