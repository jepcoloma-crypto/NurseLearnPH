import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import DataTable from "@/components/DataTable";
import { PageHeader, Badge, LoadingSpinner } from "@/components/shared";

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, actionFilter, resourceFilter],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: "15" };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      return adminApi.listAuditLogs(params);
    },
  });

  const items = data?.data?.data?.items ?? [];
  const pagination = data?.data?.data?.pagination;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="System activity and security events"
      />

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Filter by action..."
          className="px-3 py-2 border rounded-lg text-sm w-48"
        />
        <input
          type="text"
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          placeholder="Filter by resource..."
          className="px-3 py-2 border rounded-lg text-sm w-48"
        />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <DataTable
          columns={[
            { key: "createdAt", label: "Timestamp", className: "w-44", render: (item) => (
              <span className="text-sm">{new Date(String(item.createdAt)).toLocaleString()}</span>
            )},
            { key: "user", label: "User", render: (item) => {
              const firstName = String(item.userFirstName || "");
              const lastName = String(item.userLastName || "");
              if (!firstName && !lastName) return <span className="text-gray-400 italic">System</span>;
              return <span className="font-medium">{firstName} {lastName}</span>;
            }},
            { key: "action", label: "Action", render: (item) => (
              <Badge variant="info">{String(item.action)}</Badge>
            )},
            { key: "resource", label: "Resource", render: (item) => (
              <span>{String(item.resource)}</span>
            )},
            { key: "resourceId", label: "Resource ID", className: "w-36", render: (item) => (
              <span className="text-xs text-gray-500 font-mono truncate block max-w-[140px]" title={String(item.resourceId || "")}>
                {String(item.resourceId || "-")}
              </span>
            )},
            { key: "ipAddress", label: "IP Address", className: "w-32", render: (item) => (
              <span className="text-sm text-gray-500">{String(item.ipAddress || "-")}</span>
            )},
          ]}
          data={items}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
