import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DataTable from "./DataTable";

interface TestItem extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
}

const columns = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
];

const testData: TestItem[] = [
  { id: "1", name: "Item One", status: "Active" },
  { id: "2", name: "Item Two", status: "Inactive" },
];

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders data rows", () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText("Item One")).toBeInTheDocument();
    expect(screen.getByText("Item Two")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No data found")).toBeInTheDocument();
  });

  it("renders custom empty message", () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders an icon in the empty state", () => {
    render(<DataTable columns={columns} data={[]} />);
    const empty = screen.getByTestId("table-empty-state");
    expect(empty.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("No data found")).toBeInTheDocument();
  });

  it("renders custom cell content with render function", () => {
    const customColumns = [
      { key: "name", label: "Name", render: (item: TestItem) => <strong>{item.name}</strong> },
    ];
    render(<DataTable columns={customColumns} data={testData} />);
    const strong = screen.getByText("Item One");
    expect(strong.tagName).toBe("STRONG");
  });

  it("does not show pagination when totalPages is 1", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, totalPages: 1, total: 2 }}
      />
    );
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("does not render stray content when totalPages is 0", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, totalPages: 0, total: 0 }}
      />
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByTestId("table-empty-state")).toBeInTheDocument();
  });

  it("shows pagination when totalPages > 1", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, totalPages: 3, total: 30 }}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByText("Page 1 of 3 (30 total)")).toBeInTheDocument();
  });

  it("calls onPageChange with next page when next button clicked", async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, totalPages: 3, total: 30 }}
        onPageChange={onPageChange}
      />
    );
    const navButtons = screen.getAllByRole("button");
    const nextButton = navButtons[navButtons.length - 1];
    await nextButton.click();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous button on first page", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, totalPages: 3, total: 30 }}
        onPageChange={() => {}}
      />
    );
    const navButtons = screen.getAllByRole("button");
    const prevButton = navButtons[navButtons.length - 2];
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 3, totalPages: 3, total: 30 }}
        onPageChange={() => {}}
      />
    );
    const navButtons = screen.getAllByRole("button");
    const nextButton = navButtons[navButtons.length - 1];
    expect(nextButton).toBeDisabled();
  });
});
