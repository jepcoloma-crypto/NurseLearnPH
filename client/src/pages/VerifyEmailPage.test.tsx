import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VerifyEmailPage from "./VerifyEmailPage";
import { authApi } from "@/services/api";

vi.mock("@/services/api", () => ({
  authApi: {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}));

const mockToken = vi.fn(() => "tok123");

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [
      new URLSearchParams(mockToken() ? `token=${mockToken()}` : ""),
    ],
  };
});

vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyEmailPage />
    </MemoryRouter>
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken.mockReturnValue("tok123");
  });

  it("verifies a valid token and shows the active state", async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      data: {
        data: {
          status: "active",
          message: "Your email is verified and your account is active.",
        },
      },
    } as never);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Email verified" })).toBeInTheDocument();
    expect(authApi.verifyEmail).toHaveBeenCalledWith("tok123");
    expect(
      screen.getByText("Your email is verified and your account is active.")
    ).toBeInTheDocument();
  });

  it("shows the pending-approval state", async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      data: {
        data: {
          status: "pending",
          message: "Your email is verified. Your account is awaiting administrator approval.",
        },
      },
    } as never);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Waiting for approval" })
    ).toBeInTheDocument();
  });

  it("shows the resend form when verification fails", async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue({
      response: {
        status: 404,
        data: { error: { message: "Verification link not found" } },
      },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Verification failed" })
    ).toBeInTheDocument();
    expect(screen.getByText("Verification link not found")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
  });

  it("resends a verification link on request", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.verifyEmail).mockRejectedValue({
      response: {
        status: 404,
        data: { error: { message: "Verification link not found" } },
      },
    });
    vi.mocked(authApi.resendVerification).mockResolvedValue({
      data: {
        data: {
          message:
            "If that email address is awaiting verification, a new link has been sent.",
        },
      },
    } as never);

    renderPage();
    await screen.findByRole("heading", { name: "Verification failed" });

    await user.type(screen.getByPlaceholderText("you@example.com"), "me@example.com");
    await user.click(
      screen.getByRole("button", { name: "Resend verification email" })
    );

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalledWith("me@example.com");
    });
    expect(
      await screen.findByText(
        "If that email address is awaiting verification, a new link has been sent."
      )
    ).toBeInTheDocument();
  });
});
