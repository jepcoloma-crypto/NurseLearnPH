# NurseLearn PH — User Manual

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Understanding Roles](#3-understanding-roles)
4. [Dashboard](#4-dashboard)
5. [Learning Module](#5-learning-module)
6. [Assessment Module](#6-assessment-module)
7. [Clinical Module](#7-clinical-module)
8. [Student Tools](#8-student-tools)
9. [AI & Analytics](#9-ai--analytics)
10. [Communication (Announcements)](#10-communication-announcements)
11. [Administration](#11-administration)
12. [Notifications](#12-notifications)
13. [Sidebar Navigation](#13-sidebar-navigation)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Introduction

**NurseLearn PH** is a comprehensive learning management system built for BSN (Bachelor of Science in Nursing) students and educators in the Philippines. It provides tools for course management, clinical reasoning practice, skills laboratory tracking, NLE exam preparation, AI-assisted learning, and competency assessment — all in one platform.

### What You Can Do

- **Students** — Take assessments, practice clinical cases, prepare for NLE exams, build a professional portfolio, use the AI tutor, and track your competency progress.
- **Instructors** — Manage courses, create assessments and questions, grade student work, review care plans, and track student analytics.
- **Program Coordinators** — Manage the full academic structure (programs, sections, enrollments), create rotations, and oversee all courses.
- **Clinical Instructors** — Manage clinical cases, skills lab activities, rotations, and grade clinical submissions.
- **Administrators** — Full system access including user management, audit logs, and system configuration.

---

## 2. Getting Started

### Logging In

1. Open your web browser and navigate to the application URL (provided by your administrator).
2. Enter your **username** and **password** on the login page.
3. Click **Log In**.

> Your administrator will provide your initial login credentials. Contact them if you need a password reset.

### Creating an Account (Self-Signup)

The sign-in page always shows a **Sign up** link:

1. Open **Sign up** and fill in your username, email, and name.
2. Click **Sign Up**. You'll see **Check your email** — open the message
   from NurseLearn PH and click **Verify my email**
   (the link is valid for 24 hours and can be used once; the
   *Resend verification* option is available if it expired).
3. What happens next depends on your school's setup:
   - **Approval mode (default):** after verifying, wait for the
     administrator to activate your account — you'll receive an email when
     you can sign in.
   - **Auto mode:** you can sign in immediately after verifying.
4. Return to **Sign In** and use your username and password.

Until you verify your email (and, in approval mode, until you're activated)
login is blocked with a clear message — your account is created either way.

> If your school has self-signup turned off (`SIGNUP_MODE=off`), the
> signup page shows a notice instead of the form — ask your
> administrator for an account instead.

### The Dashboard

After logging in, you land on the **Dashboard** — your personalized home screen. It shows:

- **Welcome message** with your name and role
- **Quick stats** relevant to your role (enrolled courses, pending assessments, etc.)
- **Recent announcements** — only unread announcements appear; once you open one, it's removed from this feed
- **Activity summary** — your recent learning activity

### Navigating the App

The **sidebar** on the left is your main navigation. It's organized into collapsible sections:

| Section | Contents |
|---------|----------|
| **Learning** | Courses, Topics, Lessons |
| **Assessment** | Assessments, Question Bank, Gradebook |
| **Clinical** | Clinical Cases, Skills Lab, Rotations, Diagnoses, Care Plans |
| **Student Tools** | NLE Prep, Virtual Patients, AI Tutor, Portfolio, Competency, My Rotations |
| **AI & Analytics** | AI Content, Analytics, Research |
| **Communication** | Announcements |
| **Administration** | Users, My Students, Enrollments, Sections, Academic Setup, NLE Question Bank, Audit Log |

> **Tip:** Click any section header to collapse or expand it. In collapsed sidebar mode (icon view), all items remain visible.

You only see modules you have permission to access. For example, students won't see the Administration section.

### Profile Menu

Your name and role badge appear at the bottom of the sidebar. Click **Log Out** to sign out.

---

## 3. Understanding Roles

The system has five user roles with increasing levels of access:

### Student
The learner. Can view courses, take assessments, attempt clinical cases, practice NLE exams, use the AI tutor, build a portfolio, and submit care plans.

### Clinical Instructor
Teaches clinical skills and oversees student rotations. Can create clinical cases, manage skills lab activities, grade clinical submissions, and review care plans.

### Instructor
Teaches academic courses. Can manage topics, lessons, questions, assessments, create AI content, manage the NLE question bank, post announcements for their courses, and view student analytics.

### Program Coordinator
Oversees the entire academic program. Has all Instructor permissions plus: manages courses, sections, enrollments, academic setup (programs, years, semesters), creates rotations, and has full access to user management views.

### Administrator
Full system access. Can do everything other roles can, plus: create/edit/delete users, reset passwords, view audit logs, and manage all system settings.

### Permission Matrix

| Capability | Student | Clinical Instructor | Instructor | Coordinator | Admin |
|-----------|---------|-------------------|-----------|-------------|-------|
| View courses | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create/edit courses | — | — | — | ✓ | ✓ |
| Create assessments | — | ✓ | ✓ | ✓ | ✓ |
| Take assessments | ✓ | — | — | — | — |
| Grade submissions | — | ✓ | ✓ | ✓ | ✓ |
| Attempt clinical cases | ✓ | — | — | — | — |
| Create clinical cases | — | ✓ | ✓ | ✓ | ✓ |
| Manage skills lab | — | ✓ | ✓ | ✓ | ✓ |
| Create rotations | — | ✓ | ✓ | ✓ | ✓ |
| Submit care plans | ✓ | — | — | — | — |
| Review care plans | — | ✓ | ✓ | ✓ | ✓ |
| NLE practice | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage NLE bank | — | ✓ | ✓ | ✓ | ✓ |
| Use AI tutor | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create AI content | — | — | ✓ | ✓ | ✓ |
| View analytics | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create research projects | — | — | ✓ | ✓ | ✓ |
| Post announcements | — | ✓ | ✓ | ✓ | ✓ |
| Manage users | — | — | — | View only | ✓ |
| View audit log | — | — | — | — | ✓ |

---

## 4. Dashboard

The dashboard is your landing page after login. Each role gets a home screen built around what they do.

### For Students
- **Progress stats** — enrolled courses, average score, completion rate, skills competent
- **Continue learning** — your courses with lesson progress bars and average scores
- **Unread announcements** — click to read; once read, it disappears from this feed
- **Quick actions** — My Courses, Assessments, NLE Prep, AI Tutor, Clinical Cases, Portfolio

### For Instructors / Clinical Instructors
- **Teaching stats** — your courses, questions, assessments, clinical cases and students (scoped to your own courses)
- **Skill sign-offs requested** — students waiting for your sign-off, with a shortcut to Skills Lab
- **Unread announcements**
- **Quick actions** — My Students, Gradebook, Question Bank, Clinical Cases, AI Content, Announcements

### For Program Coordinators
- **Program stats** — courses, sections, enrolled students, users
- **Unread announcements**
- **Quick actions** — Courses, Sections, Enrollments, Academic Setup, Question Bank, Announcements

### For Administrators
- **Platform stats** — users, pending approvals, courses, audit events
- **Awaiting approval** — verified signups waiting for activation, with a Review shortcut
- **Recent activity** — latest audit log entries
- **Unread announcements**
- **Quick actions** — Users, Academic Setup, Courses, Question Bank, Announcements, Audit Log, Accreditation

> **Tip:** The announcement feed on the dashboard only shows **unread** announcements. Once you open an announcement (from the dashboard or the Announcements page), it's automatically marked as read and removed from the dashboard feed.

---

## 5. Learning Module

### 5.1 Courses

**Who can see this:** Everyone (view); Coordinators & Admins (create/edit/delete)

The Courses page lists all courses in the system. Each course belongs to a program and may be assigned to an instructor.

**What you can do:**
- **View** the list of courses with pagination (15 per page)
- **Filter** by program or search by course name/code
- **Create a course** (Coordinator/Admin only) — click **Add Course**, fill in the name, code, description, program, and assigned instructor
- **Edit** a course — click the pencil icon
- **Delete** a course — click the trash icon (confirmation required)

**Course details include:**
- Course code and name
- Description
- Assigned instructor
- Program it belongs to

### 5.2 Topics

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete)

Topics organize course content into chapters or modules. Each topic belongs to a course.

**What you can do:**
- Browse topics across courses
- **Create a topic** — select the course, enter a title and description, set an order number
- **Edit** or **delete** topics you created

### 5.3 Lessons

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete)

Lessons are the individual learning units within a topic. Each lesson can have attached materials and activities.

**What you can do:**
- View lessons for a selected course/topic
- **Add a lesson** — enter title, content (supports rich text/markdown), and optional URL
- **Edit** lesson content
- **Manage materials** — attach files (PDFs, documents, images) to a lesson
- **Manage activities** — add interactive learning activities
- **Delete** a lesson

---

## 6. Assessment Module

### 6.1 Assessments

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete); Students (take)

Assessments are exams, quizzes, and assignments that students complete.

**For Instructors — Creating Assessments:**
1. Click **Add Assessment**
2. Select the course
3. Enter a title and description
4. Set a **time limit** (optional) — the assessment will be timed
5. Choose questions from the Question Bank or create new ones
6. Publish when ready

**For Students — Taking Assessments:**
1. Go to Assessments and find an available assessment
2. Click **Start Assessment**
3. Answer questions one at a time or navigate freely (depends on assessment settings)
4. Submit when done — you'll see your score and feedback

**Grading:**
- Auto-graded assessments show results immediately
- Subjective questions (essays, care plans) require instructor grading
- Instructors can access the **Gradebook** to review and grade all submissions

### 6.2 Question Bank

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete)

The Question Bank stores all reusable questions. Questions can be attached to multiple assessments.

**Question types:**
- Multiple choice
- True/False
- Essay / Short answer
- Clinical scenario questions

**What you can do:**
- Browse and search questions by course, topic, or type
- **Create a question** — enter the question text, options/answers, correct answer, and explanation
- **Attach media** — add images or files to questions (useful for clinical scenarios)
- **Edit** or **delete** questions
- Questions show which assessments they're linked to

### 6.3 Gradebook

**Who can see this:** Instructors+ (assessments.grade permission)

The Gradebook provides an overview of all student assessment results.

**What you can do:**
- View all student submissions per assessment
- See auto-graded scores
- **Manually grade** subjective questions — enter a score and feedback
- **Return for revision** — send a submission back to the student with comments
- Export grades

---

## 7. Clinical Module

### 7.1 Clinical Cases

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete); Students (attempt)

Clinical Cases present patient scenarios that students must analyze and respond to, building clinical reasoning skills.

**For Instructors — Creating Cases:**
1. Click **Add Case**
2. Enter a title, description, and clinical scenario
3. Add **options** (multiple choice responses)
4. Set a **maximum number of attempts** (default: 3, configurable per case)
5. Assign to a course
6. Publish when ready

**For Students — Attempting Cases:**
1. Open Clinical Cases and select a case
2. Read the patient scenario carefully
3. Select your response from the options
4. Submit — you'll see if your answer was correct and receive feedback
5. You have up to the configured maximum attempts per case

**What instructors see:**
- List of all cases with attempt statistics
- Individual student responses and scores
- Ability to review student reasoning

### 7.2 Skills Lab

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete, sign off)

The Skills Lab tracks hands-on clinical skills that students must demonstrate proficiency in.

**Skills management includes:**
- **Skills** — individual procedures (e.g., Intravenous Therapy, Wound Dressing, Catheterization)
- **Skill Stations** — physical lab rooms where skills are practiced
- **Checklists** — step-by-step checklists for each skill

**For Students:**
- View your skill progress
- See which skills you've completed, are in progress, or haven't started
- **Request assessment** — signal to your instructor that you're ready to demonstrate a skill
- Track your practice history

**For Instructors:**
- Create and edit skills with descriptions and categories
- **Sign off** on student skill demonstrations
- Manage skill stations (rooms/equipment)
- Review student checklists and mark steps as complete/incomplete

### 7.3 Clinical Rotations

**Who can see this:** Instructors+ only (coordinator/admin create); Students see "My Rotations"

Rotations schedule students into clinical placement sites for supervised practice.

**For Coordinators/Admins — Creating Rotations:**
1. Click **Add Rotation**
2. Enter a title (e.g., "Medical-Surgical Nursing Rotation")
3. Select the clinical instructor
4. Select the section (group of students)
5. Set start/end dates, facility name, and max students
6. **Assign students** — select which students from the section participate

**For Clinical Instructors:**
- View rotations you're assigned to
- See enrolled students and their status
- **Record attendance** — mark students present/absent for each session
- **Track duty hours** — log clinical hours per student
- Mark rotation as **completed** when finished

**For Students — My Rotations:**
- View your assigned rotations
- See your attendance history
- Track your duty hours
- View completion status

**Certificates:** When a rotation is marked complete, students who completed it receive a certificate (visible in their portfolio).

### 7.4 Nursing Diagnoses

**Who can see this:** Everyone (view); Instructors+ (create/edit)

A standardized library of nursing diagnoses used in care planning.

**What you can do:**
- Browse diagnoses (15 per page, searchable)
- **Add a diagnosis** — enter the NANDA diagnosis name and definition
- **Edit** existing diagnoses
- Diagnoses are used when creating care plans

### 7.5 Care Plans

**Who can see this:** Everyone (view); Students (create/edit); Instructors+ (review)

Care plans follow the nursing process: **Assessment → Diagnosis → Planning → Implementation → Evaluation (A→D→P→I→E)**.

**For Students — Creating Care Plans:**
1. Click **Add Care Plan**
2. Select the patient scenario or clinical case
3. **Assessment** — enter subjective and objective data
4. **Diagnosis** — select nursing diagnoses from the library
5. **Planning** — set goals (short-term/long-term) and expected outcomes
6. **Implementation** — add nursing interventions (independent, dependent, collaborative)
7. **Evaluation** — evaluate outcomes
8. **Submit** for instructor review

**For Instructors — Reviewing:**
- View submitted care plans
- **Approve** — mark as completed and approved
- **Return for Revision** — send back with feedback on what needs improvement
- Once returned, the student can edit and resubmit

**Care Plan Statuses:**
| Status | Meaning |
|--------|---------|
| DRAFT | Student is still working on it |
| SUBMITTED | Sent for instructor review |
| UNDER_REVIEW | Instructor is reviewing |
| RETURNED | Sent back for revision with feedback |
| APPROVED | Instructor approved |
| COMPLETED | Finalized |

---

## 8. Student Tools

### 8.1 NLE Preparation

**Who can see this:** Everyone (view/practice); Instructors+ (manage question bank)

The NLE (Nursing Licensure Examination) module provides timed practice exams to help students prepare for the board exam.

**Taking a Practice Exam:**
1. Go to **NLE Prep**
2. Select an available exam
3. Click **Start Exam**
4. Questions appear **one at a time** — answer and click **Next**
5. A **timer** shows remaining time
6. You can navigate back to previous questions
7. Submit when done (or time runs out)
8. View your score and performance breakdown by category

**Key features:**
- **Timed exams** — realistic exam conditions
- **One question at a time** — focused, exam-like experience
- **Resume support** — if you close the browser, you can resume where you left off
- **Performance analytics** — see your strengths and weaknesses by category

**For Instructors — Managing the Question Bank:**
1. Go to **NLE Question Bank** (Administration section)
2. **Add questions** with categories, difficulty levels, and explanations
3. **Import questions** in bulk
4. Organize by category (Fundamentals, Medical-Surgical, Maternal, etc.)
5. Create exams by selecting questions from the bank

### 8.2 Virtual Patient Simulation

**Who can see this:** Everyone (view/start); Instructors+ (manage scenarios)

Simulate patient encounters in a safe, virtual environment.

**For Students:**
1. Select a patient scenario (e.g., "Juan dela Cruz" or "Maria Santos")
2. **Start Simulation** — enter the virtual patient encounter
3. Read the patient presentation
4. **Take actions** — ask questions, perform assessments, administer treatments
5. The patient's state changes based on your actions
6. **Debrief** — after the encounter, review what happened and learn from it

**For Instructors:**
- Create patient scenarios with presenting symptoms, vital signs, and medical history
- Define patient states and transitions
- Set up actions students can take and their consequences
- Review student performance in simulations

### 8.3 AI Tutor

**Who can see this:** Everyone

The AI Tutor provides on-demand learning assistance powered by AI.

**How to use it:**
1. Go to **AI Tutor**
2. Start a new conversation or continue an existing one
3. Ask questions about nursing concepts, procedures, or care planning
4. The AI responds with explanations and **Socratic questions** to deepen your understanding
5. If you're stuck, the AI can provide **hints** (managed by instructors)

**Features:**
- Chat-based interface
- Conversation history — return to previous chats
- Socratic questioning method — learn by thinking, not just memorizing
- Context-aware responses based on your courses

### 8.4 Portfolio

**Who can see this:** Everyone (view/create/edit); Instructors+ (review/issue)

Your professional portfolio showcases your achievements, reflections, and clinical experience.

**Three tabs:**

**Portfolios:**
- Create portfolio entries documenting your learning journey
- Upload supporting documents (certifications, evidence)
- Instructors can review and provide feedback

**Reflections:**
- Write reflective journal entries on clinical experiences
- Document what you learned, challenges faced, and insights gained
- Instructors can review reflections

**Clinical Logs:**
- Record clinical experiences (date, patient contact, procedures performed)
- Submit logs for instructor review
- Status workflow: Submitted → Reviewed

**Certificates:**
- View certificates earned from completed rotations
- Certificates are automatically issued when a rotation is marked complete

### 8.5 Competency

**Who can see this:** Everyone (view); Coordinators/Admins (manage); Instructors (assess)

Track your progress against the BSN competency framework.

**What you can do:**
- View the competency framework with its competencies and indicators
- See your personal competency levels
- Track which competencies you've demonstrated
- **Request assessment** from an instructor

**For Instructors:**
- Assess student competencies
- Mark indicators as achieved
- Provide evidence and comments

**For Coordinators:**
- Manage competency frameworks
- Create new competencies and indicators
- View program-wide competency analytics

### 8.6 My Rotations

**Who can see this:** Students only

Your personal view of clinical rotations you're assigned to.

- See upcoming and completed rotations
- View your attendance records
- Track duty hours
- Access rotation certificates

---

## 9. AI & Analytics

### 9.1 AI Content

**Who can see this:** Instructors+ (create/review)

AI-powered content generation for creating educational materials.

**What you can do:**
1. Select a course
2. Choose what to generate:
   - **Questions** — multiple-choice or short-answer questions on a topic
   - **Clinical Cases** — patient scenarios with decision points
   - **Study Guides** — comprehensive topic summaries
3. Click **Generate** — the AI creates content based on your parameters
4. **Review** the generated content
5. **Approve** — publish to the question bank or case library
6. **Return for Revision** — request changes with specific feedback

**Content Statuses:**
| Status | Meaning |
|--------|---------|
| PENDING | Waiting for instructor review |
| APPROVED | Published and available for use |
| REVISION_NEEDED | Returned with feedback |

> **Note:** Students do not have access to the AI Content module. Instructors see only their own generated content; Coordinators and Admins see all content.

### 9.2 Analytics

**Who can see this:** Everyone (view scope depends on role)

Data-driven insights into learning performance.

**For Students:**
- Your personal performance trends
- Assessment scores over time
- Clinical case completion rates
- Skill proficiency progress

**For Instructors:**
- Class-wide performance analytics
- Assessment difficulty analysis
- Student engagement metrics
- Identify struggling students

### 9.3 Research

**Who can see this:** Everyone (view); Instructors+ (create)

Manage research projects related to nursing education.

**What you can do:**
- Browse research projects
- **Create a new project** — enter title, description, methodology, and objectives
- **Pre/post tests** — design knowledge assessments for research participants
- **Cohorts** — define research groups
- **Participants** — track enrollment and responses
- **Data exports** — export research data for analysis

> **Note:** Instructors can only see and manage their own research projects. Coordinators and Admins see all projects.

---

## 10. Communication (Announcements)

**Who can see this:** Everyone (view); Instructors+ (create/edit/delete)

Announcements keep students and instructors informed about important updates.

### Viewing Announcements

- Go to **Announcements** from the sidebar
- See all published announcements in a list
- **Filter** by course, status, or search by title/content
- Click an announcement to read the full content
- Announcements may include **file attachments** (documents, images)

### Creating Announcements (Instructors+)

1. Click **Add Announcement**
2. Enter a **title** and **content** (supports markdown formatting)
3. Select the **audience**:
   - ☑️ **Students** — visible to students
   - ☑️ **Instructors** — visible to other instructors
   - You can select both
4. Optionally attach files
5. Choose status:
   - **Draft** — save without publishing
   - **Published** — immediately visible to the audience
6. Click **Save**

### Editing & Archiving

- **Edit** an announcement you created — click the pencil icon
- **Archive** a published announcement — removes it from the active list
- **Delete** an announcement you created (confirmation required)

### Workflow

```
Draft → Publish → Archive
```

### Read Receipts

- When a student reads an announcement, it's marked as "read"
- Authors can view **who has read** their announcement (click the eye icon)
- Students see "Read" / "Unread" badges on announcements

### Dashboard Feed

- The dashboard shows **unread announcements only**
- Once you open an announcement (from anywhere), it disappears from the dashboard feed
- This keeps your dashboard clean — you only see what you haven't read yet

> **Permission note:** Instructors can only create announcements for courses they're assigned to. Coordinators and Admins can create global announcements for all courses.

---

## 11. Administration

### 11.1 Users

**Who can see this:** Coordinators (view only); Admins (full access)

Manage all user accounts in the system.

**User list features:**
- View all users with role badges, email, contact number, and status
- **Search** by name, email, or username
- **Filter** by role
- **Pagination** — 15 users per page

**For Admins — Creating Users:**
1. Click **Add User**
2. Fill in: username, email, first name, last name
3. Set a **temporary password** (minimum 8 characters)
4. Select a **role** (Student, Instructor, Clinical Instructor, Program Coordinator, Admin)
5. Optionally add a **contact number**
6. Click **Save**

**For Admins — Editing Users:**
- Click the pencil icon to edit name, email, role, or contact number

**For Admins — Password Reset:**
- Click the **key icon** next to a user
- Enter a new password (minimum 8 characters)
- The user's existing sessions will be revoked — they'll need to log in again

**For Admins — Pending approvals:**
When students self-sign up (email-verified, awaiting activation), switch the
page to the **Pending approvals** tab above the list:

1. Review the applicant — name, username, email, verification date, and
   sign-up date
2. Click **Approve** to activate the account (a confirmation dialog
   appears). The applicant receives an in-app notification and an email,
   and can then log in
3. Or click **Reject** to decline — the account is disabled and removed
   from the list, and the applicant is notified by email (kept for audit)

The tab only shows users who have verified their email but are not yet
active, so someone who hasn't confirmed their email can't be approved by
mistake. When `SIGNUP_MODE=auto`, accounts activate on verification and this
queue stays empty; with `SIGNUP_MODE=off`, there is no self-signup at all.

> **Important:** Only administrators can edit user accounts and reset passwords. Program Coordinators can view the user list but cannot create, edit, reset passwords, or approve signups.

### 11.2 My Students

**Who can see this:** Instructors+ (enrollments.view)

View the students enrolled in your courses.

- See students grouped by course
- View individual student profiles and progress
- Access student assessment results

### 11.3 Enrollments

**Who can see this:** Instructors+ (view); Coordinators/Admins (create/delete)

Manage which students are enrolled in which courses.

**What you can do:**
- View all enrollments
- **Enroll a student** — select a student and course
- **Import a roster (CSV)** — choose a course and section, upload a CSV with one student per line (email or username), preview which students match, then import them all in one go. Extra columns and a header row are ignored; students already enrolled are reported and skipped.
- **Download template** — grab the ready-made CSV template (`roster-import-template.csv`) from the import dialog, fill in your students, then upload it.
- **Remove an enrollment** — unenroll a student from a course

### 11.4 Sections

**Who can see this:** Coordinators/Admins only

Manage student sections (class groups).

- Create new sections within a program
- Assign students to sections
- Sections are used for clinical rotation assignments

### 11.5 Academic Setup

**Who can see this:** Coordinators/Admins only

Configure the academic structure of the nursing program.

**Three tabs:**

**Programs:**
- Create academic programs (e.g., "Bachelor of Science in Nursing")
- Set program code and description

**Academic Years:**
- Define academic years (e.g., "2026-2027")
- Set start and end dates
- Mark as current

**Semesters & Year Levels:**
- Create semesters within academic years
- Define year levels for each program
- Set the order of year levels

### 11.6 NLE Question Bank

**Who can see this:** Instructors+ (nle.manage permission)

Manage the centralized NLE exam question bank.

**What you can do:**
- Browse all questions with category and difficulty filters
- **Add questions** — enter question text, options, correct answer, explanation, category, and difficulty
- **Bulk import** — upload questions in batch
- **Edit** or **delete** questions
- **Create exams** by selecting questions from the bank
- Organize by category:
  - Fundamentals of Nursing
  - Medical-Surgical Nursing
  - Maternal and Child Health
  - Community Health Nursing
  - Psychiatric Nursing
  - Pharmacology
  - Leadership and Management

### 11.7 Audit Log

**Who can see this:** Admins only

Track all system activity for security and compliance.

**What you can see:**
- Every login, logout, and failed login attempt
- All create, update, and delete operations
- Who performed the action and when
- **Pagination** — 15 entries per page
- **Search** by action type or user

---

### 11.8 Accreditation Report

**Who can see this:** Admins and Program Coordinators (Administration → Accreditation)

A printable snapshot of everything the program delivers on the platform — useful for accreditation review and internal program assessment.

**What's included:**
- **Summary stats** — programs, courses, learning outcomes, question bank, assessments, clinical cases, skills, NLE questions
- **Curriculum matrix** — every course with credits, year/semester, instructor and counts of topics, lessons, outcomes, questions, assessments and clinical cases (with a totals row)
- **Assessment coverage** — questions by type and difficulty, assessments by type with published counts
- **Clinical education** — the skills inventory and rotations with facility, period, required hours and status
- **Competency framework** — frameworks and their competencies with categories and target levels
- **People** — user counts by role (total and active)
- **Academic setup** — programs, year levels and semesters

**What you can do:**
- **Print / Save as PDF** — opens your browser's print dialog; the sidebar and app header are excluded from the printout
- **Export CSV** — downloads the curriculum matrix as a spreadsheet file

---

## 12. Notifications

The **notification bell** (top-right of the screen) shows real-time alerts.

**Types of notifications:**
- **Announcements** — new announcement published for you
- **Assessment** — new assessment available or graded
- **Care Plan** — care plan reviewed or returned
- **Clinical** — rotation assignment, attendance recorded
- **Portfolio** — portfolio entry reviewed

**What you can do:**
- Click the bell to see recent notifications
- Click a notification to go directly to the relevant page
- Unread notifications show a badge count

---

## 13. Sidebar Navigation

The sidebar is your main navigation tool. Here are some tips:

### Collapsing Sections
- **Click a section header** (e.g., "Learning", "Assessment") to collapse or expand it
- Collapsed sections hide their menu items, giving you more space
- Click again to expand

### Icon-Only Mode
- Click the **chevron icon** at the bottom of the sidebar to collapse it to icon-only mode
- In icon mode, hover over an icon to see the page name
- All items remain visible in icon mode (section headers are hidden)

### What You See Depends on Your Role
- You only see navigation items you have permission to access
- Students see a streamlined sidebar focused on learning tools
- Instructors see additional management tools
- Admins see the full sidebar including Administration

---

## 14. Troubleshooting

### Can't log in
- Verify your username and password are correct (check for caps lock)
- Contact your administrator if you've forgotten your password
- If you see "Account locked", too many failed attempts — wait a few minutes or contact your admin
- **"Please verify your email address first"** — click the link in your verification email, or use *Resend verification* on the verification page
- **"Your account is awaiting activation"** — you verified your email but an administrator still has to approve your account; watch for their email

### Page not loading or showing errors
- Try refreshing the page (F5 or Ctrl+R)
- Check your internet connection
- Clear your browser cache
- Try a different browser

### Assessment timed out
- Assessments have time limits; if time runs out, your answers are saved automatically
- You can view your results after submission

### Can't see a module in the sidebar
- That module requires a specific role or permission
- Contact your administrator if you believe you should have access

### File upload failed
- Check the file size (max 50MB)
- Supported formats: PDF, DOCX, images (JPG, PNG), videos (MP4)
- Ensure you have a stable internet connection

### AI Tutor not responding
- The AI service may be temporarily unavailable
- The system falls back to built-in responses when AI is unavailable
- Try again in a few minutes

### Notifications not appearing
- Check the notification bell icon in the top-right corner
- Notifications are role-based — you only see notifications relevant to you
- Refresh the page if notifications seem stale

---

## Quick Reference — Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Navigate to search | (Coming soon) |
| Refresh page | F5 |
| Go back | Alt + ← |
| Go forward | Alt + → |

---

*Last updated: September 2026*
*For deployment instructions, see [DEPLOY.md](../DEPLOY.md)*
