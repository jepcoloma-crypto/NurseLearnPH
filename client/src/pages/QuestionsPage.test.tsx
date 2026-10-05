import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QuestionsPage from "./QuestionsPage";
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

const { listQuestions } = vi.hoisted(() => ({ listQuestions: vi.fn() }));

// Question list + courses + AI endpoints, using the real
// { success, data: { items, pagination } } envelope.
vi.mock("@/services/api", () => {
  const paged = (items: Record<string, unknown>[]) =>
    Promise.resolve({
      data: { data: { items, pagination: { page: 1, limit: 15, total: items.length, totalPages: 1 } } },
    });
  return {
    assessmentApi: {
      listQuestions: (params: Record<string, string | undefined>) => listQuestions(params),
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      toggleQuestionStatus: vi.fn(),
    },
    academicApi: {
      listCourses: () => paged([{ id: "c1", code: "BIO101", name: "Anatomy & Physiology" }]),
    },
    aiApi: {
      generateQuestions: vi.fn(),
      reviewQuestion: vi.fn(),
    },
  };
});

const publishedQ: Record<string, unknown> = {
  id: "q1",
  courseId: "c1",
  stem: "What is the normal adult heart rate range?",
  type: "MC",
  difficulty: "EASY",
  isActive: true,
  options: [
    { text: "60-100 bpm", order: 0 },
    { text: "120-160 bpm", order: 1 },
  ],
};

const inactiveQ: Record<string, unknown> = {
  id: "q2",
  courseId: "c1",
  stem: "Deprecated draft question",
  type: "TF",
  difficulty: "MEDIUM",
  isActive: false,
  options: [],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <QuestionsPage />
    </QueryClientProvider>
  );
}

describe("QuestionsPage print / PDF export", () => {
  const printSpy = vi.fn();

  beforeEach(() => {
    listQuestions.mockReset();
    listQuestions.mockImplementation((params?: Record<string, string | undefined>) =>
      Promise.resolve({
        data: {
          data: {
            items: [publishedQ, inactiveQ],
            pagination: {
              page: 1,
              limit: Number(params?.limit ?? 15),
              total: 2,
              totalPages: 1,
            },
          },
        },
      })
    );
    printSpy.mockClear();
    vi.stubGlobal("print", printSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the question bank with a Print / PDF action", async () => {
    renderPage();
    expect(await screen.findByText("Question Bank")).toBeInTheDocument();
    expect(screen.getByText("Print / PDF")).toBeInTheDocument();
    expect(screen.getByText("Add Question")).toBeInTheDocument();
    // Table shows every question regardless of status
    expect(await screen.findByText(/What is the normal adult heart rate/)).toBeInTheDocument();
    expect(screen.getByText(/Deprecated draft question/)).toBeInTheDocument();
  });

  it("opens a printable sheet with blank name/section and only published questions", async () => {
    renderPage();
    await screen.findByText("Print / PDF");
    fireEvent.click(screen.getByText("Print / PDF"));

    const sheet = await screen.findByTestId("print-sheet");
    expect(within(sheet).getByText("Name:")).toBeInTheDocument();
    expect(within(sheet).getByText("Section:")).toBeInTheDocument();
    expect(within(sheet).getByText(/What is the normal adult heart rate/)).toBeInTheDocument();
    // Published-only: the inactive question never reaches the sheet
    expect(within(sheet).queryByText(/Deprecated draft question/)).toBeNull();
    // Options are listed without revealing the answer
    expect(within(sheet).getByText(/A\. 60-100 bpm/)).toBeInTheDocument();

    // Fetch asks the API for published questions only
    expect(listQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: "true", limit: "200" })
    );
    // App shell is flagged so print CSS hides it behind the sheet
    expect(document.body.classList.contains("printing-questionnaire")).toBe(true);
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
  });

  it("clears the sheet after the print dialog closes", async () => {
    renderPage();
    await screen.findByText("Print / PDF");
    fireEvent.click(screen.getByText("Print / PDF"));
    await screen.findByTestId("print-sheet");

    fireEvent(window, new Event("afterprint"));
    await waitFor(() => expect(screen.queryByTestId("print-sheet")).toBeNull());
    expect(document.body.classList.contains("printing-questionnaire")).toBe(false);
  });
});
