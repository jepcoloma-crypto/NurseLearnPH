import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** White card with a header row used across the role home screens. */
export function Panel({ title, icon, action, children, className = "" }: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          {icon && <span className="text-primary-600">{icon}</span>}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export interface ActionItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Grid of role-specific shortcut links. */
export function QuickActions({ items }: { items: ActionItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <span className="text-primary-600">{a.icon}</span>
          <span className="text-sm font-medium">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

/** Responsive stat-card strip shared by every home screen. */
export function StatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {children}
    </div>
  );
}
