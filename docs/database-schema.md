# Database Schema — Phase 0 Foundation

## Tables Created

### Identity Domain
- `users` — User accounts with roles
- `refresh_tokens` — JWT refresh tokens
- `audit_logs` — Security audit trail
- `permissions` — Granular permission definitions
- `role_permissions` — Role-permission mappings

### Academic Domain
- `programs` — Academic programs (e.g., BSN)
- `academic_years` — Academic year periods
- `semesters` — Semester periods
- `year_levels` — Year levels within programs
- `sections` — Class sections
- `courses` — Course offerings
- `course_enrollments` — Student-course enrollment
- `learning_outcomes` — Course learning outcomes

### Learning Domain
- `topics` — Course topics
- `lessons` — Individual lessons

## ER Diagram (Simplified)

```
programs ─── academic_years ─── semesters
   │              │                │
   │              │           year_levels
   │              │                │
   └──────── courses ──── sections
                  │
         course_enrollments ─── users
                  │
           learning_outcomes
                  │
              topics
                  │
             lessons

users ─── refresh_tokens
users ─── audit_logs

permissions ─── role_permissions
```

## Roles

| Role | Description |
|------|-------------|
| ADMIN | System administrator |
| PROGRAM_COORDINATOR | Academic program coordinator |
| INSTRUCTOR | Course instructor |
| CLINICAL_INSTRUCTOR | Clinical/RLE instructor |
| STUDENT | Nursing student |
