import { describe, it, expect } from "vitest";
import { hasPermission, hasAnyPermission, canCreate } from "./permissions";
import type { User } from "@/types";

function makeUser(role: User["role"]): User {
  return {
    id: "test-id",
    username: "testuser",
    email: "test@test.com",
    firstName: "Test",
    lastName: "User",
    middleName: null,
    role,
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("hasPermission", () => {
  it("returns false for null user", () => {
    expect(hasPermission(null, "courses.view")).toBe(false);
  });

  it("returns true for STUDENT with student permissions", () => {
    const user = makeUser("STUDENT");
    expect(hasPermission(user, "courses.view")).toBe(true);
    expect(hasPermission(user, "nle.practice")).toBe(true);
    expect(hasPermission(user, "simulation.start")).toBe(true);
  });

  it("returns false for STUDENT with instructor-only permissions", () => {
    const user = makeUser("STUDENT");
    expect(hasPermission(user, "courses.create")).toBe(false);
    expect(hasPermission(user, "questions.delete")).toBe(false);
    expect(hasPermission(user, "users.create")).toBe(false);
    expect(hasPermission(user, "portfolio.review")).toBe(false);
    expect(hasPermission(user, "portfolio.issue")).toBe(false);
    expect(hasPermission(user, "competency.assess")).toBe(false);
  });

  it("returns true for INSTRUCTOR with instructor permissions", () => {
    const user = makeUser("INSTRUCTOR");
    expect(hasPermission(user, "courses.create")).toBe(false); // courses are created by ADMIN/PROGRAM_COORDINATOR only (matches backend)
    expect(hasPermission(user, "questions.create")).toBe(true);
    expect(hasPermission(user, "ai-content.create")).toBe(true);
    expect(hasPermission(user, "portfolio.review")).toBe(true);
    expect(hasPermission(user, "portfolio.issue")).toBe(true);
    expect(hasPermission(user, "competency.assess")).toBe(true);
  });

  it("returns false for INSTRUCTOR with student-only permissions", () => {
    const user = makeUser("INSTRUCTOR");
    expect(hasPermission(user, "cases.attempt")).toBe(false);
  });

  it("returns true for ADMIN with all permissions", () => {
    const user = makeUser("ADMIN");
    expect(hasPermission(user, "users.create")).toBe(true);
    expect(hasPermission(user, "users.delete")).toBe(true);
    expect(hasPermission(user, "courses.delete")).toBe(true);
    expect(hasPermission(user, "competency.manage")).toBe(true);
  });

  it("returns true for PROGRAM_COORDINATOR with coordinator permissions", () => {
    const user = makeUser("PROGRAM_COORDINATOR");
    expect(hasPermission(user, "users.view")).toBe(true);
    expect(hasPermission(user, "users.create")).toBe(false); // user create/edit + password reset are ADMIN only (matches backend)
    expect(hasPermission(user, "users.edit")).toBe(false);
    expect(hasPermission(user, "rotations.delete")).toBe(true);
    expect(hasPermission(user, "courses.delete")).toBe(true);
    expect(hasPermission(user, "competency.manage")).toBe(true);
  });

  it("returns true for CLINICAL_INSTRUCTOR with academic+clinical permissions", () => {
    const user = makeUser("CLINICAL_INSTRUCTOR");
    expect(hasPermission(user, "cases.create")).toBe(true);
    expect(hasPermission(user, "skills.signoff")).toBe(true);
    expect(hasPermission(user, "rotations.create")).toBe(true);
    expect(hasPermission(user, "courses.create")).toBe(false); // courses are created by ADMIN/PROGRAM_COORDINATOR only (matches backend)
    expect(hasPermission(user, "portfolio.review")).toBe(true);
    expect(hasPermission(user, "portfolio.issue")).toBe(false); // certificates are issued by instructor/coordinator/admin only (matches backend)
    expect(hasPermission(user, "competency.assess")).toBe(true);
  });

  it("returns false for CLINICAL_INSTRUCTOR with restricted permissions", () => {
    const user = makeUser("CLINICAL_INSTRUCTOR");
    expect(hasPermission(user, "users.view")).toBe(false);
    expect(hasPermission(user, "research.create")).toBe(false);
    expect(hasPermission(user, "enrollments.create")).toBe(false);
  });

  it("grants reports.view only to ADMIN and PROGRAM_COORDINATOR", () => {
    expect(hasPermission(makeUser("ADMIN"), "reports.view")).toBe(true);
    expect(hasPermission(makeUser("PROGRAM_COORDINATOR"), "reports.view")).toBe(true);
    expect(hasPermission(makeUser("INSTRUCTOR"), "reports.view")).toBe(false);
    expect(hasPermission(makeUser("CLINICAL_INSTRUCTOR"), "reports.view")).toBe(false);
    expect(hasPermission(makeUser("STUDENT"), "reports.view")).toBe(false);
  });

  it("returns false for unknown role", () => {
    const user = makeUser("UNKNOWN_ROLE" as User["role"]);
    expect(hasPermission(user, "courses.view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns false for null user", () => {
    expect(hasAnyPermission(null, ["courses.view", "courses.create"])).toBe(false);
  });

  it("returns true when user has at least one permission", () => {
    const user = makeUser("STUDENT");
    expect(hasAnyPermission(user, ["courses.create", "courses.view"])).toBe(true);
  });

  it("returns false when user has none of the permissions", () => {
    const user = makeUser("STUDENT");
    expect(hasAnyPermission(user, ["courses.create", "users.delete"])).toBe(false);
  });

  it("returns false for empty permissions array", () => {
    const user = makeUser("ADMIN");
    expect(hasAnyPermission(user, [])).toBe(false);
  });
});

describe("canCreate", () => {
  it("returns false for null user", () => {
    expect(canCreate(null)).toBe(false);
  });

  it("returns true for STUDENT (has careplans.create, portfolio.create)", () => {
    expect(canCreate(makeUser("STUDENT"))).toBe(true);
  });

  it("returns true for INSTRUCTOR", () => {
    expect(canCreate(makeUser("INSTRUCTOR"))).toBe(true);
  });

  it("returns true for ADMIN", () => {
    expect(canCreate(makeUser("ADMIN"))).toBe(true);
  });

  it("returns true for PROGRAM_COORDINATOR", () => {
    expect(canCreate(makeUser("PROGRAM_COORDINATOR"))).toBe(true);
  });

  it("returns true for CLINICAL_INSTRUCTOR (has cases.create, skills.create)", () => {
    expect(canCreate(makeUser("CLINICAL_INSTRUCTOR"))).toBe(true);
  });
});
