import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageHeader, Card, Badge, Button, Modal, StatCard, LoadingSpinner, EmptyState } from "./shared";

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="Test Page" />);
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader title="Test" subtitle="Subtitle text" />);
    expect(screen.getByText("Subtitle text")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<PageHeader title="Test" actions={<button>Action</button>} />);
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(<PageHeader title="Test" />);
    expect(screen.queryByText("Subtitle text")).not.toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant styles", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test")).toHaveClass("bg-gray-100");
  });

  it("applies success variant styles", () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText("Success")).toHaveClass("bg-green-100");
  });

  it("applies danger variant styles", () => {
    render(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText("Danger")).toHaveClass("bg-red-100");
  });

  it("applies warning variant styles", () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText("Warning")).toHaveClass("bg-yellow-100");
  });

  it("applies info variant styles", () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText("Info")).toHaveClass("bg-blue-100");
  });
});

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>);
    expect(screen.getByText("Primary")).toHaveClass("bg-primary-600");
  });

  it("applies secondary variant styles", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText("Secondary")).toHaveClass("bg-white");
  });

  it("applies danger variant styles", () => {
    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByText("Danger")).toHaveClass("bg-red-600");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });

  it("applies small size styles", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByText("Small")).toHaveClass("px-3");
  });
});

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="Test">Content</Modal>);
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(<Modal open={true} onClose={() => {}} title="Modal Title">Modal content</Modal>);
    expect(screen.getByText("Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Modal open={true} onClose={onClose} title="Test">Content</Modal>);
    const overlay = container.querySelector(".absolute.inset-0")!;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Test">Content</Modal>);
    await user.click(screen.getByText("\u00d7"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Students" value={42} />);
    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<StatCard label="Test" value="10" icon={<span data-testid="icon">Icon</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders a skeleton instead of the value while loading", () => {
    render(<StatCard label="Total Students" value={42} loading />);
    expect(screen.getByLabelText("Loading Total Students")).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Students")).not.toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders a spinner", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Try adding something" />);
    expect(screen.getByText("Try adding something")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">Icon</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders a default icon when none is provided", () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByTestId("empty-state-icon").querySelector("svg")).toBeInTheDocument();
  });
});
