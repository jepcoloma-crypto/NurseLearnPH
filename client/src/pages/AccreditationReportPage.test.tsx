import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccreditationReportPage from "./AccreditationReportPage";
import type { User } from "@/types";

const mockUser: User = {
  id: "admin-id",
  username: "admin",
  email: "admin@test.com",
  firstName: "Ada",
  lastName: "Min",
  middleName: null,
  role: "ADMIN",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

// Every endpoint the report aggregates, with the real { success, data } envelope.
vi.mock("@/services/api", () => {
  const paged = (items: Record<string, unknown>[]) =>
    Promise.resolve({
      data: { data: { items, pagination: { page: 1, limit: 500, total: items.length, totalPages: 1 } } },
    });
  return {
    academicApi: {
      listCourses: () =>
        paged([
          {
            id: "c1", code: "N101", name: "Fundamentals", credits: 3, isActive: true,
            yearLevelId: "y1", semesterId: "s1",
            instructorFirstName: "Maria", instructorLastName: "Santos",
          },
        ]),
      listPrograms: () => paged([{ id: "p1", name: "BS Nursing", code: "BSN" }]),
      listYearLevels: () => paged([{ id: "y1", name: "First Year", order: 1 }]),
      listSemesters: () =>
        paged([{ id: "s1", name: "First Semester", academicYearName: "2026-2027", isActive: true }]),
      listCourseOutcomes: () => Promise.resolve({ data: { data: [{ id: "o1", code: "CLO1" }] } }),
    },
    learningApi: {
      listTopics: () => paged([{ id: "t1", courseId: "c1" }]),
      listLessons: () => paged([{ id: "l1", topicId: "t1" }]),
    },
    assessmentApi: {
      listQuestions: () =>
        paged([
          { id: "q1", courseId: "c1", type: "MC", difficulty: "EASY" },
          { id: "q2", courseId: "c1", type: "MC", difficulty: "MEDIUM" },
        ]),
      listAssessments: () => paged([{ id: "a1", courseId: "c1", type: "QUIZ", isPublished: true }]),
    },
    clinicalApi: {
      listCases: () => paged([{ id: "cc1", courseId: "c1", isPublished: false }]),
    },
    skillsApi: {
      listSkills: () =>
        paged([{ id: "sk1", name: "Injection Technique", category: "Basic Skills", difficulty: "BEGINNER", isActive: true }]),
    },
    clinicalRleApi: {
      listRotations: () =>
        paged([
          {
            id: "r1", title: "Ward Rotation", facility: "PGH", courseCode: "N101",
            startDate: "2026-01-05", endDate: "2026-03-30", requiredHours: 120, status: "COMPLETED",
          },
        ]),
    },
    competencyApi: {
      listFrameworks: () => paged([{ id: "f1", name: "Nursing Competency Framework", version: "1.0" }]),
      listCompetencies: () =>
        paged([{ id: "cp1", frameworkId: "f1", name: "Patient Safety", category: "Clinical", targetLevel: "COMPETENT" }]),
    },
    usersApi: {
      list: () =>
        paged([
          { id: "u1", role: "ADMIN", isActive: true },
          { id: "u2", role: "STUDENT", isActive: true },
          { id: "u3", role: "STUDENT", isActive: false },
        ]),
    },
    nleApi: {
      listQuestions: () =>
        Promise.resolve({
          data: { data: { items: [], pagination: { page: 1, limit: 1, total: 516, totalPages: 516 } } },
        }),
    },
  };
});

function renderReport() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/accreditation"]}>
        <AccreditationReportPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AccreditationReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the report header with print and export actions", async () => {
    renderReport();
    expect(await screen.findByText("Accreditation Report")).toBeInTheDocument();
    expect(screen.getByText("Print / PDF")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
  });

  it("renders the curriculum matrix with course and year data", async () => {
    renderReport();
    expect(await screen.findByText("Curriculum Matrix")).toBeInTheDocument();
    // N101 appears in the matrix AND the rotations table
    expect(screen.getAllByText("N101").length).toBeGreaterThan(0);
    expect(screen.getByText("Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("First Year")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  it("renders assessment, clinical, competency and people sections", async () => {
    renderReport();
    expect(await screen.findByText("Assessment Coverage")).toBeInTheDocument();
    expect(screen.getByText("Ward Rotation")).toBeInTheDocument();
    expect(screen.getByText("Injection Technique")).toBeInTheDocument();
    expect(screen.getByText("Patient Safety")).toBeInTheDocument();
    expect(screen.getByText("Nursing Competency Framework")).toBeInTheDocument();
    // NLE bank total appears in the stats row AND the coverage panel
    expect((await screen.findAllByText("516")).length).toBeGreaterThan(0);
    // People: 3 users, 2 active
    expect(screen.getByText("People")).toBeInTheDocument();
  });
});
