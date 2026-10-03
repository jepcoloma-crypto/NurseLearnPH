import type { User } from "@/types";

export type Permission =
  | "courses.view" | "courses.create" | "courses.edit" | "courses.delete"
  | "topics.view" | "topics.create" | "topics.edit" | "topics.delete"
  | "questions.view" | "questions.create" | "questions.edit" | "questions.delete"
  | "assessments.view" | "assessments.create" | "assessments.edit" | "assessments.take" | "assessments.grade" | "assessments.delete"
  | "cases.view" | "cases.create" | "cases.edit" | "cases.delete" | "cases.attempt"
  | "skills.view" | "skills.create" | "skills.edit" | "skills.delete" | "skills.signoff"
  | "rotations.view" | "rotations.create" | "rotations.edit" | "rotations.delete"
  | "diagnoses.view" | "diagnoses.create" | "diagnoses.edit"
  | "careplans.view" | "careplans.create" | "careplans.edit" | "careplans.review"
  | "competency.view" | "competency.manage" | "competency.assess"
  | "portfolio.view" | "portfolio.create" | "portfolio.edit" | "portfolio.review" | "portfolio.issue"
  | "nle.view" | "nle.practice" | "nle.manage"
  | "simulation.view" | "simulation.start" | "simulation.manage"
  | "ai-tutor.view" | "ai-tutor.hints.manage"
  | "ai-content.view" | "ai-content.create" | "ai-content.review"
  | "analytics.view" | "analytics.student" | "analytics.instructor"
  | "research.view" | "research.create"
  | "users.view" | "users.create" | "users.edit" | "users.delete"
  | "enrollments.view" | "enrollments.create" | "enrollments.delete"
  | "announcements.view" | "announcements.create" | "announcements.edit" | "announcements.delete"
  | "notifications.view"
  | "dashboard.view"
  | "admin.view-audit-logs"
  | "search";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  STUDENT: [
    "dashboard.view",
    "courses.view", "topics.view",
    "questions.view",
    "assessments.view", "assessments.take",
    "cases.view", "cases.attempt",
    "skills.view",
    "rotations.view",
    "diagnoses.view",
    "careplans.view", "careplans.create", "careplans.edit",
    "competency.view",
    "portfolio.view", "portfolio.create", "portfolio.edit",
    "nle.view", "nle.practice",
    "simulation.view", "simulation.start",
    "ai-tutor.view",
    "analytics.view", "analytics.student",
    "announcements.view",
    "notifications.view",
    "search",
  ],
INSTRUCTOR: [
    "dashboard.view",
    "courses.view",
    "topics.view", "topics.create", "topics.edit", "topics.delete",
    "questions.view", "questions.create", "questions.edit", "questions.delete",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.grade", "assessments.delete",
    "cases.view", "cases.create", "cases.edit", "cases.delete",
    "skills.view", "skills.create", "skills.edit", "skills.delete", "skills.signoff",
    "rotations.view", "rotations.create", "rotations.edit",
    "diagnoses.view", "diagnoses.create", "diagnoses.edit",
    "careplans.view", "careplans.review",
    "competency.view", "competency.assess",
    "enrollments.view",
    "portfolio.view", "portfolio.review", "portfolio.issue",
    "nle.view", "nle.practice", "nle.manage",
    "simulation.view", "simulation.start", "simulation.manage",
    "ai-tutor.view", "ai-tutor.hints.manage",
    "ai-content.view", "ai-content.create", "ai-content.review",
    "analytics.view", "analytics.instructor",
    "research.view", "research.create",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "notifications.view",
    "search",
  ],
  PROGRAM_COORDINATOR: [
    "dashboard.view",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "topics.view", "topics.create", "topics.edit", "topics.delete",
    "questions.view", "questions.create", "questions.edit", "questions.delete",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.grade", "assessments.delete",
    "cases.view", "cases.create", "cases.edit", "cases.delete",
    "skills.view", "skills.create", "skills.edit", "skills.delete", "skills.signoff",
    "rotations.view", "rotations.create", "rotations.edit", "rotations.delete",
    "diagnoses.view", "diagnoses.create", "diagnoses.edit",
    "careplans.view", "careplans.review",
    "competency.view", "competency.manage", "competency.assess",
    "portfolio.view", "portfolio.review", "portfolio.issue",
    "nle.view", "nle.practice", "nle.manage",
    "simulation.view", "simulation.start", "simulation.manage",
    "ai-tutor.view", "ai-tutor.hints.manage",
    "ai-content.view", "ai-content.create", "ai-content.review",
    "analytics.view", "analytics.instructor",
    "research.view", "research.create",
    "users.view", // create/edit/delete + password reset are ADMIN-only (matches backend)
    "enrollments.view", "enrollments.create", "enrollments.delete",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "notifications.view",
    "search",
  ],
  CLINICAL_INSTRUCTOR: [
    "dashboard.view",
    "courses.view",
    "topics.view", "topics.create", "topics.edit", "topics.delete",
    "questions.view", "questions.create", "questions.edit", "questions.delete",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.grade", "assessments.delete",
    "cases.view", "cases.create", "cases.edit", "cases.delete",
    "skills.view", "skills.create", "skills.edit", "skills.delete", "skills.signoff",
    "rotations.view", "rotations.create", "rotations.edit",
    "diagnoses.view", "diagnoses.create", "diagnoses.edit",
    "careplans.view", "careplans.review",
    "competency.view", "competency.assess",
    "portfolio.view", "portfolio.review",
    "nle.view", "nle.practice", "nle.manage",
    "simulation.view", "simulation.start", "simulation.manage",
    "ai-tutor.view", "ai-tutor.hints.manage",
    "ai-content.view", "ai-content.create", "ai-content.review",
    "analytics.view", "analytics.instructor",
    "research.view",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "notifications.view",
    "search",
  ],
  ADMIN: [
    "dashboard.view",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "topics.view", "topics.create", "topics.edit", "topics.delete",
    "questions.view", "questions.create", "questions.edit", "questions.delete",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.grade", "assessments.delete",
    "cases.view", "cases.create", "cases.edit", "cases.delete",
    "skills.view", "skills.create", "skills.edit", "skills.delete", "skills.signoff",
    "rotations.view", "rotations.create", "rotations.edit", "rotations.delete",
    "diagnoses.view", "diagnoses.create", "diagnoses.edit",
    "careplans.view", "careplans.review",
    "competency.view", "competency.manage", "competency.assess",
    "portfolio.view", "portfolio.review", "portfolio.issue",
    "nle.view", "nle.practice", "nle.manage",
    "simulation.view", "simulation.start", "simulation.manage",
    "ai-tutor.view", "ai-tutor.hints.manage",
    "ai-content.view", "ai-content.create", "ai-content.review",
    "analytics.view", "analytics.instructor",
    "research.view", "research.create",
    "users.view", "users.create", "users.edit", "users.delete",
    "enrollments.view", "enrollments.create", "enrollments.delete",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "notifications.view",
    "admin.view-audit-logs",
    "search",
  ],
};

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function canCreate(user: User | null): boolean {
  return hasAnyPermission(user || null, [
    "courses.create", "topics.create", "questions.create", "assessments.create",
    "cases.create", "skills.create", "diagnoses.create", "careplans.create",
    "portfolio.create", "research.create", "ai-content.create", "users.create",
    "announcements.create", "simulation.manage",
  ]);
}

export const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  INSTRUCTOR: "Instructor",
  PROGRAM_COORDINATOR: "Program Coordinator",
  CLINICAL_INSTRUCTOR: "Clinical Instructor",
  ADMIN: "Administrator",
};

export const ROLE_COLORS: Record<string, string> = {
  STUDENT: "bg-blue-100 text-blue-700",
  INSTRUCTOR: "bg-green-100 text-green-700",
  PROGRAM_COORDINATOR: "bg-yellow-100 text-yellow-700",
  CLINICAL_INSTRUCTOR: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
};
