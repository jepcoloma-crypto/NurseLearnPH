import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ModuleSettingsPage from "./ModuleSettingsPage";

const { getModuleSettings, updateModuleSettings, uploadFile } = vi.hoisted(() => ({
  getModuleSettings: vi.fn(),
  updateModuleSettings: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  adminApi: { getModuleSettings, updateModuleSettings },
  learningApi: { uploadFile },
}));

const SAVED = {
  organization: {
    name: "Test School of Nursing",
    address: "1 Test Street",
    contact: "(02) 555-0100",
    logoUrl: "",
    programName: "BS Nursing",
  },
  reports: { headerNote: "SY 2026-2027", footerNote: "Internal copy" },
  certificates: {
    title: "Certificate of Completion",
    signatoryName: "Dr. Juan Dela Cruz",
    signatoryTitle: "Dean",
    footerNote: "Ledger no. 123",
  },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ModuleSettingsPage />
    </QueryClientProvider>
  );
}

/** Header + footer both submit the same form; the footer button lives inside it. */
function clickSave() {
  const buttons = screen.getAllByRole("button", { name: /Save changes/i });
  fireEvent.click(buttons[buttons.length - 1]);
}

describe("ModuleSettingsPage", () => {
  beforeEach(() => {
    getModuleSettings.mockReset();
    updateModuleSettings.mockReset();
    uploadFile.mockReset();
    getModuleSettings.mockResolvedValue({ data: { data: SAVED } });
    updateModuleSettings.mockResolvedValue({ data: { data: SAVED } });
  });

  it("renders all three sections and fills the form from saved settings", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Test School of Nursing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organization" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certificates" })).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toHaveValue("1 Test Street");
    expect(screen.getByLabelText("Program name")).toHaveValue("BS Nursing");
    expect(screen.getByLabelText("Header note")).toHaveValue("SY 2026-2027");
    // Reports card precedes the Certificates card in document order
    const footerNotes = screen.getAllByLabelText("Footer note");
    expect(footerNotes[0]).toHaveValue("Internal copy");
    expect(footerNotes[1]).toHaveValue("Ledger no. 123");
    expect(screen.getByLabelText("Signatory name")).toHaveValue("Dr. Juan Dela Cruz");
    expect(screen.getByLabelText("Signatory position")).toHaveValue("Dean");
    expect(screen.getByLabelText("Certificate title")).toHaveValue("Certificate of Completion");
  });

  it("submits edited values as the full settings payload", async () => {
    renderPage();
    await screen.findByDisplayValue("Test School of Nursing");

    fireEvent.change(screen.getByLabelText("Contact"), { target: { value: "(02) 555-9999" } });
    clickSave();

    await waitFor(() => expect(updateModuleSettings).toHaveBeenCalledTimes(1));
    const payload = updateModuleSettings.mock.calls[0][0] as typeof SAVED;
    expect(payload.organization.name).toBe("Test School of Nursing");
    expect(payload.organization.contact).toBe("(02) 555-9999");
    expect(payload.reports.headerNote).toBe("SY 2026-2027");
    expect(payload.certificates.signatoryName).toBe("Dr. Juan Dela Cruz");
  });

  it("requires an institution name before saving", async () => {
    renderPage();
    await screen.findByDisplayValue("Test School of Nursing");

    fireEvent.change(screen.getByLabelText("Institution name"), { target: { value: "" } });
    clickSave();

    expect(await screen.findByText("Institution name is required")).toBeInTheDocument();
    expect(updateModuleSettings).not.toHaveBeenCalled();
  });

  it("uploads a logo, previews it, and includes it in the saved payload", async () => {
    uploadFile.mockResolvedValue({ data: { data: { url: "/storage/images/logo.png" } } });
    renderPage();
    await screen.findByDisplayValue("Test School of Nursing");

    const file = new File(["png-bytes"], "logo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    expect(uploadFile.mock.calls[0][1]).toBe("images");
    const preview = await screen.findByAltText("Logo preview");
    expect(preview).toHaveAttribute("src", "/storage/images/logo.png");

    clickSave();
    await waitFor(() => expect(updateModuleSettings).toHaveBeenCalledTimes(1));
    const payload = updateModuleSettings.mock.calls[0][0] as typeof SAVED;
    expect(payload.organization.logoUrl).toBe("/storage/images/logo.png");
  });
});
