import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

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

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with heading and inputs", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText("NurseLearn PH")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
  });

  it("calls login with correct credentials on submit", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "password123");
    });
  });

  it("navigates to home on successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "pass");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows loading state while logging in", async () => {
    const user = userEvent.setup();
    let resolveLogin!: () => void;
    mockLogin.mockReturnValueOnce(new Promise<void>((r) => { resolveLogin = r; }));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "pass");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });
    resolveLogin();
  });

  it("shows error toast on login failure", async () => {
    const { toast } = await import("react-hot-toast");
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "wrong");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("shows inline error message on login failure", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "wrong");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows friendly message for 401 response", async () => {
    const user = userEvent.setup();
    const axiosErr = { response: { status: 401, data: {} } };
    mockLogin.mockRejectedValueOnce(axiosErr);
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await user.type(screen.getByPlaceholderText("Enter your username"), "testuser");
    await user.type(screen.getByPlaceholderText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), "wrong");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Incorrect username or password.")).toBeInTheDocument();
    });
  });

  it("shows the signup link pointing to the signup page", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });

});
