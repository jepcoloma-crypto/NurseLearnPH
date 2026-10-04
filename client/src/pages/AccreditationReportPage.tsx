import { useMemo, type ReactNode } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Printer, Download, BookOpen, Target, HelpCircle, ClipboardCheck, Stethoscope, FlaskConical, GraduationCap, Layers } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  academicApi, learningApi, assessmentApi, clinicalApi, clinicalRleApi,
  skillsApi, competencyApi, usersApi, nleApi,
} from "@/services/api";
import { PageHeader, StatCard, Badge, Button, LoadingSpinner } from "@/components/shared";
import { Panel, StatsRow } from "@/pages/dashboard/widgets";
import { ROLE_LABELS } from "@/utils/permissions";

type Item = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const toNum = (v: unknown): number => (typeof v === "number" ? v : 0);

const QUESTION_TYPES: Array<[string, string]> = [
  ["MC", "Multiple Choice"], ["TF", "True/False"], ["ESSAY", "Essay"],
  ["FILL_BLANK", "Fill in the Blank"], ["SCENARIO", "Scenario"],
];
const ASSESSMENT_TYPES: Array<[string, string]> = [
  ["QUIZ", "Quiz"], ["EXAM", "Exam"], ["ASSIGNMENT", "Assignment"],
];
const ROLE_ORDER = ["ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR", "STUDENT"] as const;
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

/** Plain report table; scrolls horizontally on screen, prints full width. */
function ReportTable({ head, children, footer }: { head: string[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && (
          <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-800">{footer}</tfoot>
        )}
      </table>
    </div>
  );
}

const listItems = (res: unknown): Item[] =>
  ((res as { data?: { data?: { items?: Item[] } } })?.data?.data?.items ?? []) as Item[];
const listTotal = (res: unknown): number =>
  (res as { data?: { data?: { pagination?: { total?: number } } } })?.data?.data?.pagination?.total ?? 0;

function countBy(items: Item[], key: (i: Item) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = key(i);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Accreditation Report — printable snapshot of curriculum structure, learning
 * outcomes, assessment coverage, clinical education, competency frameworks and
 * people. Gated to ADMIN / PROGRAM_COORDINATOR (reports.view); aggregates
 * read-only data from existing endpoints (no backend changes).
 */
export default function AccreditationReportPage() {
  const { user } = useAuth();

  // ─── Data: one bulk request per entity (limits within server maxima) ────
  const coursesQ = useQuery({ queryKey: ["report", "courses"], queryFn: () => academicApi.listCourses({ page: "1", limit: "500" }) });
  const topicsQ = useQuery({ queryKey: ["report", "topics"], queryFn: () => learningApi.listTopics({ page: "1", limit: "200" }) });
  const lessonsQ = useQuery({ queryKey: ["report", "lessons"], queryFn: () => learningApi.listLessons({ page: "1", limit: "200" }) });
  const questionsQ = useQuery({ queryKey: ["report", "questions"], queryFn: () => assessmentApi.listQuestions({ page: "1", limit: "200" }) });
  const assessmentsQ = useQuery({ queryKey: ["report", "assessments"], queryFn: () => assessmentApi.listAssessments({ page: "1", limit: "200" }) });
  const casesQ = useQuery({ queryKey: ["report", "cases"], queryFn: () => clinicalApi.listCases({ page: "1", limit: "200" }) });
  const skillsQ = useQuery({ queryKey: ["report", "skills"], queryFn: () => skillsApi.listSkills({ page: "1", limit: "200" }) });
  const rotationsQ = useQuery({ queryKey: ["report", "rotations"], queryFn: () => clinicalRleApi.listRotations({ page: "1", limit: "200" }) });
  const frameworksQ = useQuery({ queryKey: ["report", "frameworks"], queryFn: () => competencyApi.listFrameworks({ page: "1", limit: "200" }) });
  const competenciesQ = useQuery({ queryKey: ["report", "competencies"], queryFn: () => competencyApi.listCompetencies({ page: "1", limit: "200" }) });
  const programsQ = useQuery({ queryKey: ["report", "programs"], queryFn: () => academicApi.listPrograms({ page: "1", limit: "500" }) });
  const yearsQ = useQuery({ queryKey: ["report", "years"], queryFn: () => academicApi.listYearLevels({ page: "1", limit: "500" }) });
  const semestersQ = useQuery({ queryKey: ["report", "semesters"], queryFn: () => academicApi.listSemesters({ page: "1", limit: "500" }) });
  const usersQ = useQuery({ queryKey: ["report", "users"], queryFn: () => usersApi.list({ page: "1", limit: "500" }) });
  const nleQ = useQuery({ queryKey: ["report", "nle"], queryFn: () => nleApi.listQuestions({ page: "1", limit: "1" }) });

  const courses = useMemo(() => listItems(coursesQ.data), [coursesQ.data]);

  // Learning outcomes exist only as a per-course endpoint (admin/coordinator).
  const outcomeResults = useQueries({
    queries: courses.map((c) => ({
      queryKey: ["report", "outcomes", str(c.id)],
      queryFn: () => academicApi.listCourseOutcomes(str(c.id)),
      enabled: courses.length > 0,
    })),
  });
  const outcomesByCourse = useMemo(() => {
    const m = new Map<string, number>();
    outcomeResults.forEach((r, idx) => {
      const id = str(courses[idx]?.id);
      if (!id) return;
      const data = (r.data as { data?: unknown[] })?.data;
      m.set(id, Array.isArray(data) ? data.length : 0);
    });
    return m;
  }, [outcomeResults, courses]);

  const pending =
    coursesQ.isLoading || topicsQ.isLoading || lessonsQ.isLoading || questionsQ.isLoading ||
    assessmentsQ.isLoading || casesQ.isLoading || skillsQ.isLoading || rotationsQ.isLoading ||
    frameworksQ.isLoading || competenciesQ.isLoading || programsQ.isLoading || yearsQ.isLoading ||
    semestersQ.isLoading || usersQ.isLoading || nleQ.isLoading ||
    (courses.length > 0 && outcomeResults.some((r) => r.isLoading));

  const topicList = listItems(topicsQ.data);
  const lessonList = listItems(lessonsQ.data);
  const questionList = listItems(questionsQ.data);
  const assessmentList = listItems(assessmentsQ.data);
  const caseList = listItems(casesQ.data);
  const skillList = listItems(skillsQ.data);
  const rotationList = listItems(rotationsQ.data);
  const frameworkList = listItems(frameworksQ.data);
  const competencyList = listItems(competenciesQ.data);
  const programList = listItems(programsQ.data);
  const yearList = listItems(yearsQ.data);
  const semesterList = listItems(semestersQ.data);
  const userList = listItems(usersQ.data);

  const topicsByCourse = countBy(topicList, (t) => str(t.courseId));
  const topicCourse = new Map(topicList.map((t) => [str(t.id), str(t.courseId)]));
  const lessonsByCourse = countBy(lessonList, (l) => topicCourse.get(str(l.topicId)) ?? "");
  const questionsByCourse = countBy(questionList, (q) => str(q.courseId));
  const assessmentsByCourse = countBy(assessmentList, (a) => str(a.courseId));
  const casesByCourse = countBy(caseList, (c) => str(c.courseId));

  const yearOrder = new Map(yearList.map((y) => [str(y.id), toNum(y.order)]));
  const yearName = new Map(yearList.map((y) => [str(y.id), str(y.name)]));
  const semesterName = new Map(semesterList.map((s) => [str(s.id), str(s.name)]));

  // Curriculum matrix: courses ordered by year level, then semester, then code.
  const matrixRows = [...courses].sort((a, b) => {
    const ya = yearOrder.get(str(a.yearLevelId)) ?? 99;
    const yb = yearOrder.get(str(b.yearLevelId)) ?? 99;
    if (ya !== yb) return ya - yb;
    const sa = semesterName.get(str(a.semesterId)) ?? "";
    const sb = semesterName.get(str(b.semesterId)) ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return str(a.code).localeCompare(str(b.code));
  });

  const instructorLabel = (c: Item): string =>
    `${str(c.instructorFirstName)} ${str(c.instructorLastName)}`.trim() || "—";

  const outcomesTotal = [...outcomesByCourse.values()].reduce((a, b) => a + b, 0);
  const activeCourses = courses.filter((c) => c.isActive !== false).length;
  const publishedAssessments = assessmentList.filter((a) => a.isPublished === true).length;
  const publishedCases = caseList.filter((c) => c.isPublished === true).length;
  const nleTotal = listTotal(nleQ.data);

  const roleStats = ROLE_ORDER.map((role) => {
    const rows = userList.filter((u) => str(u.role) === role);
    return { role, total: rows.length, active: rows.filter((u) => u.isActive === true).length };
  });

  function exportCsv() {
    const header = [
      "Code", "Course", "Credits", "Year", "Semester", "Instructor",
      "Topics", "Lessons", "Outcomes", "Questions", "Assessments", "Clinical Cases", "Status",
    ];
    const rows = matrixRows.map((c) => [
      str(c.code), str(c.name), toNum(c.credits),
      yearName.get(str(c.yearLevelId)) ?? "", semesterName.get(str(c.semesterId)) ?? "",
      instructorLabel(c),
      topicsByCourse.get(str(c.id)) ?? 0, lessonsByCourse.get(str(c.id)) ?? 0,
      outcomesByCourse.get(str(c.id)) ?? 0, questionsByCourse.get(str(c.id)) ?? 0,
      assessmentsByCourse.get(str(c.id)) ?? 0, casesByCourse.get(str(c.id)) ?? 0,
      c.isActive === false ? "Archived" : "Active",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${str(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accreditation-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (pending) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Accreditation Report"
        subtitle="Curriculum, assessment and clinical education coverage snapshot"
        actions={
          <span className="print:hidden flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            <Button variant="primary" size="sm" onClick={exportCsv}>
              <Download size={15} /> Export CSV
            </Button>
          </span>
        }
      />
      <p className="text-xs text-gray-500 mb-6">
        Generated {new Date().toLocaleString()} · {user?.firstName} {user?.lastName} ({ROLE_LABELS[str(user?.role)] || str(user?.role)}) · source: live platform data
      </p>

      <StatsRow>
        <StatCard label="Programs" value={programList.length} icon={<Layers size={20} />} />
        <StatCard label="Courses" value={`${activeCourses}/${courses.length}`} icon={<BookOpen size={20} />} />
        <StatCard label="Learning Outcomes" value={outcomesTotal} icon={<Target size={20} />} />
        <StatCard label="Questions" value={listTotal(questionsQ.data)} icon={<HelpCircle size={20} />} />
        <StatCard label="Assessments" value={`${publishedAssessments}/${assessmentList.length} published`} icon={<ClipboardCheck size={20} />} />
        <StatCard label="Clinical Cases" value={`${publishedCases}/${caseList.length} published`} icon={<Stethoscope size={20} />} />
        <StatCard label="Skills" value={skillList.length} icon={<FlaskConical size={20} />} />
        <StatCard label="NLE Question Bank" value={nleTotal} icon={<GraduationCap size={20} />} />
      </StatsRow>

      {/* ── Curriculum matrix ─────────────────────────────────────────── */}
      <Panel title="Curriculum Matrix" className="mb-6">
        <ReportTable
          head={[
            "Code", "Course", "Cr", "Year", "Semester", "Instructor",
            "Topics", "Lessons", "Outcomes", "Questions", "Assess.", "Cases", "Status",
          ]}
          footer={
            <>
              <td className="px-3 py-2" colSpan={2}>Totals ({matrixRows.length} courses)</td>
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + toNum(c.credits), 0)}</td>
              <td className="px-3 py-2" colSpan={3} />
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + (topicsByCourse.get(str(c.id)) ?? 0), 0)}</td>
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + (lessonsByCourse.get(str(c.id)) ?? 0), 0)}</td>
              <td className="px-3 py-2">{outcomesTotal}</td>
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + (questionsByCourse.get(str(c.id)) ?? 0), 0)}</td>
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + (assessmentsByCourse.get(str(c.id)) ?? 0), 0)}</td>
              <td className="px-3 py-2">{matrixRows.reduce((a, c) => a + (casesByCourse.get(str(c.id)) ?? 0), 0)}</td>
              <td className="px-3 py-2" />
            </>
          }
        >
          {matrixRows.map((c) => (
            <tr key={str(c.id)} className="border-b border-gray-100 hover:bg-gray-50/60">
              <td className="px-3 py-2 font-mono text-xs">{str(c.code)}</td>
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{str(c.name)}</td>
              <td className="px-3 py-2 text-center">{toNum(c.credits)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{yearName.get(str(c.yearLevelId)) ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{semesterName.get(str(c.semesterId)) ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{instructorLabel(c)}</td>
              <td className="px-3 py-2 text-center">{topicsByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2 text-center">{lessonsByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2 text-center">{outcomesByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2 text-center">{questionsByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2 text-center">{assessmentsByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2 text-center">{casesByCourse.get(str(c.id)) ?? 0}</td>
              <td className="px-3 py-2">
                <Badge variant={c.isActive === false ? "default" : "success"}>
                  {c.isActive === false ? "Archived" : "Active"}
                </Badge>
              </td>
            </tr>
          ))}
          {matrixRows.length === 0 && (
            <tr><td className="px-3 py-4 text-gray-500" colSpan={13}>No courses recorded.</td></tr>
          )}
        </ReportTable>
      </Panel>

      {/* ── Assessment coverage ───────────────────────────────────────── */}
      <Panel title="Assessment Coverage" className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Question bank by type</h4>
            <ReportTable
              head={["Type", ...DIFFICULTIES.map((d) => d[0].charAt(0) + d.slice(1).toLowerCase()), "Total"]}
              footer={
                <>
                  <td className="px-3 py-2">All types</td>
                  {DIFFICULTIES.map((d) => (
                    <td key={d} className="px-3 py-2 text-center">
                      {questionList.filter((q) => str(q.difficulty) === d).length}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">{questionList.length}</td>
                </>
              }
            >
              {QUESTION_TYPES.map(([code, label]) => (
                <tr key={code} className="border-b border-gray-100">
                  <td className="px-3 py-2">{label}</td>
                  {DIFFICULTIES.map((d) => (
                    <td key={d} className="px-3 py-2 text-center">
                      {questionList.filter((q) => str(q.type) === code && str(q.difficulty) === d).length}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-medium">
                    {questionList.filter((q) => str(q.type) === code).length}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Assessments by type</h4>
            <ReportTable
              head={["Type", "Total", "Published"]}
              footer={
                <tr>
                  <td className="px-3 py-2">All types</td>
                  <td className="px-3 py-2 text-center">{assessmentList.length}</td>
                  <td className="px-3 py-2 text-center">{publishedAssessments}</td>
                </tr>
              }
            >
              {ASSESSMENT_TYPES.map(([code, label]) => (
                <tr key={code} className="border-b border-gray-100">
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2 text-center">
                    {assessmentList.filter((a) => str(a.type) === code).length}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {assessmentList.filter((a) => str(a.type) === code && a.isPublished === true).length}
                  </td>
                </tr>
              ))}
            </ReportTable>
            <p className="text-sm text-gray-600 mt-3">
              NLE question bank: <strong>{nleTotal}</strong> licensure-review questions
            </p>
          </div>
        </div>
      </Panel>

      {/* ── Clinical education ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Clinical Skills">
          <ReportTable head={["Skill", "Category", "Difficulty", "Status"]}>
            {skillList.map((s) => (
              <tr key={str(s.id)} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{str(s.name)}</td>
                <td className="px-3 py-2">{str(s.category) || "—"}</td>
                <td className="px-3 py-2">{str(s.difficulty) ? str(s.difficulty).toLowerCase() : "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={s.isActive === false ? "default" : "success"}>
                    {s.isActive === false ? "Inactive" : "Active"}
                  </Badge>
                </td>
              </tr>
            ))}
            {skillList.length === 0 && (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={4}>No skills recorded.</td></tr>
            )}
          </ReportTable>
        </Panel>

        <Panel title="Clinical Rotations">
          <ReportTable head={["Rotation", "Facility", "Course", "Period", "Hours", "Status"]}>
            {rotationList.map((r) => (
              <tr key={str(r.id)} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{str(r.title)}</td>
                <td className="px-3 py-2">{str(r.facility) || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{str(r.courseCode) || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {new Date(str(r.startDate)).toLocaleDateString()} – {new Date(str(r.endDate)).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-center">{toNum(r.requiredHours)}</td>
                <td className="px-3 py-2">
                  <Badge variant={str(r.status) === "COMPLETED" ? "success" : str(r.status) === "ACTIVE" ? "info" : "warning"}>
                    {str(r.status) || "—"}
                  </Badge>
                </td>
              </tr>
            ))}
            {rotationList.length === 0 && (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={6}>No rotations scheduled.</td></tr>
            )}
          </ReportTable>
        </Panel>
      </div>

      {/* ── Competency frameworks + people ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Competency Framework">
          <ReportTable head={["Framework", "Competency", "Category", "Target Level"]}>
            {competencyList.map((cp) => {
              const fw = frameworkList.find((f) => str(f.id) === str(cp.frameworkId));
              return (
                <tr key={str(cp.id)} className="border-b border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fw ? str(fw.name) : "—"}
                    {fw?.version ? <span className="text-xs text-gray-400 ml-1">v{str(fw.version)}</span> : null}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{str(cp.name)}</td>
                  <td className="px-3 py-2">{str(cp.category) || "—"}</td>
                  <td className="px-3 py-2">{str(cp.targetLevel) || "—"}</td>
                </tr>
              );
            })}
            {competencyList.length === 0 && (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={4}>No competencies recorded.</td></tr>
            )}
          </ReportTable>
          {frameworkList.length > 1 && (
            <p className="text-xs text-gray-400 mt-2">{frameworkList.length} frameworks · {competencyList.length} competencies</p>
          )}
        </Panel>

        <Panel title="People">
          <ReportTable head={["Role", "Users", "Active"]}
            footer={
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-center">{userList.length}</td>
                <td className="px-3 py-2 text-center">{userList.filter((u) => u.isActive === true).length}</td>
              </tr>
            }
          >
            {roleStats.map((r) => (
              <tr key={r.role} className="border-b border-gray-100">
                <td className="px-3 py-2">{ROLE_LABELS[r.role] || r.role}</td>
                <td className="px-3 py-2 text-center">{r.total}</td>
                <td className="px-3 py-2 text-center">{r.active}</td>
              </tr>
            ))}
          </ReportTable>
        </Panel>
      </div>

      {/* ── Academic setup ────────────────────────────────────────────── */}
      <Panel title="Academic Setup" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Programs</h4>
            {programList.length === 0 ? (
              <p className="text-gray-500">No programs recorded.</p>
            ) : (
              <ul className="space-y-1">
                {programList.map((p) => (
                  <li key={str(p.id)}>{str(p.name)} <span className="text-gray-400 font-mono text-xs">({str(p.code)})</span></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Year Levels</h4>
            {yearList.length === 0 ? (
              <p className="text-gray-500">No year levels recorded.</p>
            ) : (
              <ul className="space-y-1">
                {[...yearList]
                  .sort((a, b) => toNum(a.order) - toNum(b.order))
                  .map((y) => (
                    <li key={str(y.id)}>{toNum(y.order)}. {str(y.name)}</li>
                  ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Semesters</h4>
            {semesterList.length === 0 ? (
              <p className="text-gray-500">No semesters recorded.</p>
            ) : (
              <ul className="space-y-1">
                {semesterList.map((s) => (
                  <li key={str(s.id)} className="flex items-center gap-2">
                    {str(s.name)}
                    <span className="text-gray-400 text-xs">{str(s.academicYearName)}</span>
                    {s.isActive === false && <Badge variant="default">Inactive</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      <p className="text-xs text-gray-400 text-center pb-4">
        NurseLearn PH Accreditation Report · questions, lessons and outcome counts reflect live platform data
      </p>
    </div>
  );
}
