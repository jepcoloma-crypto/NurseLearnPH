import { useAuth } from "@/hooks/useAuth";
import AdminHome from "@/pages/dashboard/AdminHome";
import CoordinatorHome from "@/pages/dashboard/CoordinatorHome";
import InstructorHome from "@/pages/dashboard/InstructorHome";
import StudentHome from "@/pages/dashboard/StudentHome";

/**
 * Role-based home screen. The route stays "/", but each role gets a layout
 * built around what they actually do:
 *
 *   ADMIN                 -> platform overview, pending approvals, audit trail
 *   PROGRAM_COORDINATOR   -> courses / sections / enrollment overview
 *   INSTRUCTOR,
 *   CLINICAL_INSTRUCTOR   -> own courses, assessments, students, sign-offs
 *   STUDENT (default)     -> personal progress, continue learning, feed
 */
export default function DashboardPage() {
  const { user } = useAuth();

  switch (user?.role) {
    case "ADMIN":
      return <AdminHome />;
    case "PROGRAM_COORDINATOR":
      return <CoordinatorHome />;
    case "INSTRUCTOR":
    case "CLINICAL_INSTRUCTOR":
      return <InstructorHome />;
    default:
      return <StudentHome />;
  }
}
