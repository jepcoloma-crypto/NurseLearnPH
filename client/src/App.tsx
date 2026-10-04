import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { hasPermission, type Permission } from "@/utils/permissions";
import Layout from "@/layouts/Layout";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import { LoadingSpinner } from "@/components/shared";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CoursesPage = lazy(() => import("@/pages/CoursesPage"));
const TopicsPage = lazy(() => import("@/pages/TopicsPage"));
const QuestionsPage = lazy(() => import("@/pages/QuestionsPage"));
const AssessmentsPage = lazy(() => import("@/pages/AssessmentsPage"));
const CasesPage = lazy(() => import("@/pages/CasesPage"));
const CaseAttemptPage = lazy(() => import("@/pages/CaseAttemptPage"));
const CaseResultPage = lazy(() => import("@/pages/CaseResultPage"));
const SkillsPage = lazy(() => import("@/pages/SkillsPage"));
const RotationsPage = lazy(() => import("@/pages/RotationsPage"));
const DiagnosesPage = lazy(() => import("@/pages/DiagnosesPage"));
const CompetencyPage = lazy(() => import("@/pages/CompetencyPage"));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"));
const NLEPage = lazy(() => import("@/pages/NLEPage"));

const NLEAdminPage = lazy(() => import("@/pages/NLEAdminPage"));
const SimulationPage = lazy(() => import("@/pages/SimulationPage"));
const AITutorPage = lazy(() => import("@/pages/AITutorPage"));
const AIContentPage = lazy(() => import("@/pages/AIContentPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const ResearchPage = lazy(() => import("@/pages/ResearchPage"));
const ResearchDetailPage = lazy(() => import("@/pages/ResearchDetailPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const EnrollmentsPage = lazy(() => import("@/pages/EnrollmentsPage"));
const SectionsPage = lazy(() => import("@/pages/SectionsPage"));
const LessonsPage = lazy(() => import("@/pages/LessonsPage"));
const ExamPage = lazy(() => import("@/pages/ExamPage"));
const ExamResultPage = lazy(() => import("@/pages/ExamResultPage"));
const GradebookPage = lazy(() => import("@/pages/GradebookPage"));
const AnnouncementsPage = lazy(() => import("@/pages/AnnouncementsPage"));
const CarePlansPage = lazy(() => import("@/pages/CarePlansPage"));
const CarePlanDetailPage = lazy(() => import("@/pages/CarePlanDetailPage"));
const AuditLogPage = lazy(() => import("@/pages/AuditLogPage"));
const AcademicSetupPage = lazy(() => import("@/pages/AcademicSetupPage"));
const AccreditationReportPage = lazy(() => import("@/pages/AccreditationReportPage"));
const MyStudentsPage = lazy(() => import("@/pages/MyStudentsPage"));

const StudentRotationsPage = lazy(() => import("@/pages/StudentRotationsPage"));
const CertificatePage = lazy(() => import("@/pages/CertificatePage"));

const StudentProfilePage = lazy(() => import("@/pages/StudentProfilePage"));

function ProtectedRoute({ children, permission, roles, bare }: { children: React.ReactNode; permission?: Permission; roles?: string[]; bare?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(user, permission)) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (bare) return <>{children}</>;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
        <Route path="/topics" element={<ProtectedRoute><TopicsPage /></ProtectedRoute>} />
        <Route path="/questions" element={<ProtectedRoute><QuestionsPage /></ProtectedRoute>} />
        <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
        <Route path="/cases" element={<ProtectedRoute><CasesPage /></ProtectedRoute>} />
        <Route path="/cases/:caseId/attempt/:attemptId" element={<ProtectedRoute><CaseAttemptPage /></ProtectedRoute>} />
        <Route path="/cases/:caseId/attempt/:attemptId/result" element={<ProtectedRoute><CaseResultPage /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><SkillsPage /></ProtectedRoute>} />
        <Route path="/rotations" element={<ProtectedRoute roles={["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"]}><RotationsPage /></ProtectedRoute>} />
        <Route path="/diagnoses" element={<ProtectedRoute><DiagnosesPage /></ProtectedRoute>} />
        <Route path="/competency" element={<ProtectedRoute><CompetencyPage /></ProtectedRoute>} />
        <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
        <Route path="/nle" element={<ProtectedRoute><NLEPage /></ProtectedRoute>} />
        <Route path="/nle/admin" element={<ProtectedRoute permission="nle.manage" roles={["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"]}><NLEAdminPage /></ProtectedRoute>} />
        <Route path="/simulation" element={<ProtectedRoute><SimulationPage /></ProtectedRoute>} />
        <Route path="/ai-tutor" element={<ProtectedRoute><AITutorPage /></ProtectedRoute>} />
        <Route path="/ai-content" element={<ProtectedRoute><AIContentPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/research" element={<ProtectedRoute permission="research.view"><ResearchPage /></ProtectedRoute>} />
        <Route path="/research/:id" element={<ProtectedRoute permission="research.view"><ResearchDetailPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/enrollments" element={<ProtectedRoute permission="enrollments.view"><EnrollmentsPage /></ProtectedRoute>} />
        <Route path="/sections" element={<ProtectedRoute roles={["PROGRAM_COORDINATOR", "ADMIN"]}><SectionsPage /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
        <Route path="/lessons" element={<ProtectedRoute><LessonsPage /></ProtectedRoute>} />
        <Route path="/exam/:assessmentId/result/:attemptId" element={<ProtectedRoute><ExamResultPage /></ProtectedRoute>} />
        <Route path="/exam/:assessmentId" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />
        <Route path="/gradebook" element={<ProtectedRoute><GradebookPage /></ProtectedRoute>} />
        <Route path="/care-plans" element={<ProtectedRoute><CarePlansPage /></ProtectedRoute>} />
        <Route path="/care-plans/:id" element={<ProtectedRoute><CarePlanDetailPage /></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
        <Route path="/accreditation" element={<ProtectedRoute permission="reports.view"><AccreditationReportPage /></ProtectedRoute>} />
        <Route path="/academic-setup" element={<ProtectedRoute roles={["PROGRAM_COORDINATOR", "ADMIN"]}><AcademicSetupPage /></ProtectedRoute>} />
        <Route path="/my-students" element={<ProtectedRoute permission="enrollments.view"><MyStudentsPage /></ProtectedRoute>} />
        <Route path="/my-rotations" element={<ProtectedRoute roles={["STUDENT"]}><StudentRotationsPage /></ProtectedRoute>} />
        <Route path="/rotations/:rotationId/certificate" element={<ProtectedRoute bare><CertificatePage /></ProtectedRoute>} />
        <Route path="/students/:studentId/profile" element={<ProtectedRoute roles={["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"]}><StudentProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <AppRoutes />
    </AuthProvider>
  );
}
