import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>{children}</div>;
}

export function Badge({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info" }) {
  const styles = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>{children}</span>;
}

export function Button({ children, variant = "primary", size = "md", ...props }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-600 hover:bg-gray-100",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm" };
  return (
    <button className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 ${styles[variant]} ${sizes[size]}`} {...props}>
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: "md" | "lg";
}) {
  if (!open) return null;
  const widths = { md: "max-w-lg", lg: "max-w-3xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${widths[size]} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        {icon && <div className="p-2 bg-primary-50 rounded-lg text-primary-600">{icon}</div>}
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="text-center py-12">
      {icon && <div className="text-gray-300 mb-3 flex justify-center">{icon}</div>}
      <h3 className="text-gray-500 font-medium">{title}</h3>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
