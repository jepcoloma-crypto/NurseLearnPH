import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "./DashboardPage";
import type { User } from "@/types";

// ─── mocks ──────────────────────────────────────────────────────────────────

const mockLogout = vi.fn();
let currentUser: User | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentUser, logout: mockLogout }),
}));

// Every endpoint the four home screens touch. Values mimic the real
// { success, data: { items, pagination } } envelope.
vi.mock("@/services/api", () => {
  const list = (items: Record<string, unknown>[] = [], total = items.length) =>
    Promise.resolve({ data: { data: { items, pagination: { page: 1, limit: 15, total, totalPages: 1 } } } });
  return {
    academicApi: {
      listCourses: (params?: Record<string, string | undefined>) =>
        list([{ id: "c1", code: "N101", name: "Fundamentals" }], params?.instructorId ? 3 : 5),
      listSections: () => list([{ id: "s1", name: "Section A" }], 2),
      listEnrollments: () =>
        list([{ id: "e1", studentId: "stu-1", sectionId: null }], 1),
    },
    assessmentApi: {
      listQuestions: () => list([], 12),
      listAssessments: () => list([], 4),
    },
    clinicalApi: {
      listCases: () => list([], 2),
    },
    skillsApi: {
      getPendingAssessments: () =>
        Promise.resolve({
          data: {
            data: [
              {
                id: "ss-1",
                studentFirstName: "Maria",
                studentLastName: "Santos",
                skillName: "Injection Technique",
                skillCategory: "Basic Skills",
                requestedAssessment: true,
                lastPracticeAt: "2026-10-01T00:00:00Z",
              },
            ],
          },
        }),
    },
    usersApi: {
      list: (params?: Record<string, string | undefined>) =>
        params?.pending === "true"
          ? list(
              [{ id: "u2", firstName: "Juana", lastName: "Dela Cruz", email: "juana@test.com" }],
              1
            )
          : list([], 8),
    },
    adminApi: {
      listAuditLogs: () =>
        list([{ id: "a1", action: "LOGIN", resource: "auth", createdAt: "2026-10-01T00:00:00Z" }], 7),
    },
    analyticsApi: {
      getStudentDashboard: () =>
        Promise.resolve({
          data: {
            data: {
              stats: {
                totalCourses: 3,
                totalAssessments: 6,
                averageScore: 88,
                completionRate: 42,
                skillsCompetent: 2,
                skillsTotal: 5,
                competenciesAchieved: 1,
                competenciesTotal: 4,
              },
              enrollments: [
                {
                  course: { id: "c1", name: "Fundamentals", code: "N101" },
                  lessonsCompleted: 4,
                  lessonsTotal: 10,
                  averageScore: 90,
                  skillsCompetent: 1,
                },
              ],
              gradeDistribution: [],
              recentActivity: [],
            },
          },
        }),
    },
    announcementApi: {
      list: () =>
        Promise.resolve({
          data: { data: { items: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 } } },
        }),
    },
  };
});

// ─── helpers ────────────────────────────────────────────────────────────────

const baseUser: User = {
  id: "test-id",
  username: "tester",
  email: "tester@test.com",
  firstName: "Ana",
  lastName: "Cruz",
  middleName: null,
  role: "STUDENT",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

function renderDashboard(role: User["role"]) {
  currentUser = { ...baseUser, role };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("DashboardPage role homes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the shared welcome header for every role", async () => {
    renderDashboard("STUDENT");
    expect(await screen.findByText("Welcome, Ana!")).toBeInTheDocument();
  });

  it("renders the ADMIN home: approvals and audit activity", async () => {
    renderDashboard("ADMIN");
    expect(await screen.findByText("Pending approvals")).toBeInTheDocument();
    expect(screen.getByText("Audit events")).toBeInTheDocument();
    expect(await screen.findByText("Juana Dela Cruz")).toBeInTheDocument();
    expect(screen.getAllByText("Review all").length).toBeGreaterThan(0);
  });

  it("renders the PROGRAM_COORDINATOR home: sections and enrollment", async () => {
    renderDashboard("PROGRAM_COORDINATOR");
    // "Sections" appears as a stat card AND a quick action.
    const sections = await screen.findAllByText("Sections");
    expect(sections.length).toBeGreaterThan(0);
    expect(screen.getByText("Enrolled students")).toBeInTheDocument();
  });

  it("renders the INSTRUCTOR home: own courses and students", async () => {
    renderDashboard("INSTRUCTOR");
    expect(await screen.findByText("My Courses")).toBeInTheDocument();
    // "My Students" appears as a stat card AND a quick action.
    const myStudents = await screen.findAllByText("My Students");
    expect(myStudents.length).toBeGreaterThan(0);
    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Sign-off requested")).toBeInTheDocument();
  });

  it("renders the STUDENT home: progress and continue learning", async () => {
    renderDashboard("STUDENT");
    expect(await screen.findByText("Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("Skills Competent")).toBeInTheDocument();
    expect(await screen.findByText("N101 Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("4/10 lessons")).toBeInTheDocument();
  });

  it("shows role-specific quick actions", async () => {
    renderDashboard("STUDENT");
    expect(await screen.findByText("NLE Prep")).toBeInTheDocument();
    expect(screen.getByText("AI Tutor")).toBeInTheDocument();
    expect(screen.queryByText("Audit Log")).not.toBeInTheDocument();
  });
});
