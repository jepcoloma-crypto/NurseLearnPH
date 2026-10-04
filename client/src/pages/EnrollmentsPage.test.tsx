import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EnrollmentsPage from "./EnrollmentsPage";
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

// Endpoints the enrollments list and import dialog touch, using the real
// { success, data: { items, pagination } } envelope.
vi.mock("@/services/api", () => {
  const paged = (items: Record<string, unknown>[]) =>
    Promise.resolve({
      data: { data: { items, pagination: { page: 1, limit: 15, total: items.length, totalPages: 1 } } },
    });
  return {
    academicApi: {
      listEnrollments: () =>
        paged([
          {
            id: "e1",
            studentId: "u1",
            courseId: "c1",
            sectionId: "s1",
            studentFirstName: "Juan",
            studentLastName: "Dela Cruz",
            studentEmail: "student@nurselearn.local",
            courseCode: "N101",
            courseName: "Fundamentals",
            enrolledAt: "2026-10-01T00:00:00Z",
          },
        ]),
      listCourses: () => paged([{ id: "c1", code: "N101", name: "Fundamentals" }]),
      listSections: () => paged([{ id: "s1", name: "BSN 1st Year - 1" }]),
      enrollStudent: vi.fn(() => Promise.resolve({ data: {} })),
      unenrollStudent: vi.fn(() => Promise.resolve({ data: {} })),
      updateEnrollment: vi.fn(() => Promise.resolve({ data: {} })),
    },
    usersApi: {
      list: () =>
        paged([
          {
            id: "u1",
            username: "student",
            email: "student@nurselearn.local",
            firstName: "Juan",
            lastName: "Dela Cruz",
          },
        ]),
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EnrollmentsPage />
    </QueryClientProvider>
  );
}

describe("EnrollmentsPage", () => {
  it("shows the roster actions for managers and renders the enrollment list", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Import CSV/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enroll Student/ })).toBeInTheDocument();
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
  });

  it("opens the import dialog with a template download link", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Import CSV/ }));
    expect(await screen.findByText("Import Roster (CSV)")).toBeInTheDocument();
    expect(screen.getByText("Download template")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    // Options come from the enabled course/section queries
    expect(await screen.findByText("N101 - Fundamentals")).toBeInTheDocument();
    expect(await screen.findByText("BSN 1st Year - 1")).toBeInTheDocument();
  });

  it("downloads the CSV template with the expected filename", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:roster-template");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let clickedName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clickedName = this.download;
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Import CSV/ }));
    fireEvent.click(await screen.findByText("Download template"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickedName).toBe("roster-import-template.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:roster-template");

    vi.restoreAllMocks();
  });
});
