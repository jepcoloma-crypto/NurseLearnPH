import { useAuth } from "@/hooks/useAuth";
import { hasPermission, hasAnyPermission, canCreate, type Permission } from "@/utils/permissions";

export function usePermissions() {
  const { user } = useAuth();

  return {
    user,
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    canCreate: () => canCreate(user),
    isInstructor: user?.role === "INSTRUCTOR" || user?.role === "PROGRAM_COORDINATOR" || user?.role === "CLINICAL_INSTRUCTOR",
    isAdmin: user?.role === "ADMIN",
    isStudent: user?.role === "STUDENT",
    isCoordinator: user?.role === "PROGRAM_COORDINATOR",
  };
}
