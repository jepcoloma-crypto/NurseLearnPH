import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import type { User } from "@/types";

const mockLogout = vi.fn();

const instructorUser: User = {
  id: "test-id",
  username: "instructor",
  email: "instructor@test.com",
  firstName: "Jane",
  lastName: "Smith",
  middleName: null,
  role: "INSTRUCTOR",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

const studentUser: User = {
  id: "student-id",
  username: "student",
  email: "student@test.com",
  firstName: "Juan",
  lastName: "Dela Cruz",
  middleName: null,
  role: "STUDENT",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

let currentUser: User = instructorUser;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentUser, logout: mockLogout }),
}));

function renderSidebar(user: User = instructorUser, pathname = "/") {
  currentUser = user;
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Sidebar />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the app name", () => {
    renderSidebar();
    expect(screen.getByText("NurseLearn PH")).toBeInTheDocument();
  });

  it("renders navigation items the user has permission for", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("Question Bank")).toBeInTheDocument();
  });

  it("renders user name and role", () => {
    renderSidebar();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("INSTRUCTOR")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    renderSidebar();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("calls logout when logout button is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByText("Logout"));
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it("does not render nav items user lacks permission for", () => {
    renderSidebar();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("highlights the active route", () => {
    renderSidebar(instructorUser, "/courses");
    const coursesLink = screen.getByText("Courses").closest("a");
    expect(coursesLink).toHaveClass("bg-white/10");
  });
});

describe("Sidebar - Student role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows student-appropriate nav items", () => {
    renderSidebar(studentUser);
    expect(screen.getByText("NLE Prep")).toBeInTheDocument();
    expect(screen.getByText("Virtual Patients")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });

  it("hides instructor-only nav items", () => {
    renderSidebar(studentUser);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Content")).not.toBeInTheDocument();
  });

  it("renders student name and role", () => {
    renderSidebar(studentUser);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("STUDENT")).toBeInTheDocument();
  });
});

describe("Sidebar - collapsible sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides a section's items when its header is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar();
    expect(screen.getByText("Courses")).toBeInTheDocument();

    await user.click(screen.getByText("Learning"));

    expect(screen.queryByText("Courses")).not.toBeInTheDocument();
    expect(screen.queryByText("Topics")).not.toBeInTheDocument();
    // other sections stay open
    expect(screen.getByText("Question Bank")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows the items again when the header is clicked twice", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText("Learning"));
    expect(screen.queryByText("Courses")).not.toBeInTheDocument();

    await user.click(screen.getByText("Learning"));
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.getByText("Topics")).toBeInTheDocument();
  });

  it("keeps the untitled Dashboard section always visible", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
