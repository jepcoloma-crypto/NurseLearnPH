import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "./SignupPage";
import { authApi } from "@/services/api";

vi.mock("@/services/api", () => ({
  authApi: {
    signupConfig: vi.fn(),
    register: vi.fn(),
  },
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.signupConfig).mockResolvedValue({
      data: { data: { enabled: true, requireApproval: true } },
    } as never);
  });

  it("renders the signup form", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Create your account" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("signup-username")).toBeInTheDocument();
    expect(screen.getByTestId("signup-email")).toBeInTheDocument();
    expect(screen.getByTestId("signup-password")).toBeInTheDocument();
  });

  it("shows a disabled notice when signup is turned off", async () => {
    vi.mocked(authApi.signupConfig).mockResolvedValue({
      data: { data: { enabled: false, requireApproval: false } },
    } as never);
    renderPage();
    expect(
      await screen.findByText("Registration is disabled")
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("blocks submission until required fields are valid", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Create your account" });

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters")
      ).toBeInTheDocument();
    });
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("submits registration and shows the check-your-email screen", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockResolvedValue({
      data: {
        data: {
          message:
            "Registration successful. Check your email to verify your account.",
          user: { role: "STUDENT" },
        },
      },
    } as never);

    renderPage();
    await screen.findByRole("heading", { name: "Create your account" });

    await user.type(screen.getByTestId("signup-username"), "newnurse01");
    await user.type(screen.getByTestId("signup-email"), "newnurse01@example.com");
    await user.type(screen.getByTestId("signup-firstName"), "Maria");
    await user.type(screen.getByTestId("signup-lastName"), "Clara");
    await user.type(screen.getByTestId("signup-password"), "secret123");
    await user.type(screen.getByTestId("signup-confirmPassword"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        username: "newnurse01",
        email: "newnurse01@example.com",
        password: "secret123",
        firstName: "Maria",
        lastName: "Clara",
      });
    });

    expect(
      await screen.findByRole("heading", { name: "Check your email" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Registration successful. Check your email to verify your account."
      )
    ).toBeInTheDocument();
  });

  it("shows the server error when registration fails", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValue({
      response: { status: 409, data: { error: { message: "Email already registered" } } },
    });

    renderPage();
    await screen.findByRole("heading", { name: "Create your account" });

    await user.type(screen.getByTestId("signup-username"), "dupe01");
    await user.type(screen.getByTestId("signup-email"), "dupe01@example.com");
    await user.type(screen.getByTestId("signup-firstName"), "Dupe");
    await user.type(screen.getByTestId("signup-lastName"), "User");
    await user.type(screen.getByTestId("signup-password"), "secret123");
    await user.type(screen.getByTestId("signup-confirmPassword"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
  });
});
