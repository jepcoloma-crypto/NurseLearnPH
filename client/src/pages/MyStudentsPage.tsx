import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { academicApi } from "@/services/api";
import { PageHeader, LoadingSpinner } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { Users, Filter, X, BookOpen } from "lucide-react";

interface EnrollmentItem {
  id: string;
  studentId: string;
  courseId: string;
  sectionId: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  courseName: string;
  courseCode: string;
  sectionName: string;
  yearLevelName: string;
  semesterName: string;
}

interface Student {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  courses: { courseId: string; courseCode: string; courseName: string }[];
}

interface SectionData {
  sectionName: string;
  semesterName: string;
  students: Student[];
}

export default function MyStudentsPage() {
  const { user } = useAuth();
  const [activeYear, setActiveYear] = useState("");
  const [filterSection, setFilterSection] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-students", user?.id],
    queryFn: () => academicApi.listEnrollments({ limit: "500", instructorId: user!.id }),
    enabled: !!user?.id,
  });

  const enrollments: EnrollmentItem[] = data?.data?.data?.items ?? [];
  const totalEnrollments: number = data?.data?.data?.pagination?.total ?? 0;

  const yearLevels = useMemo(() => [...new Set(enrollments.map(e => e.yearLevelName).filter(Boolean))].sort(), [enrollments]);

  const sectionsForYear = useMemo(() => {
    if (!activeYear) return [];
    return [...new Set(enrollments
      .filter(e => e.yearLevelName === activeYear)
      .map(e => e.sectionName).filter(Boolean))]
      .sort();
  }, [enrollments, activeYear]);

  const yearData = useMemo(() => {
    const map = new Map<string, SectionData[]>();
    for (const e of enrollments) {
      const year = e.yearLevelName || "Unassigned";
      if (!map.has(year)) map.set(year, []);
      const sections = map.get(year)!;
      let section = sections.find(s => s.sectionName === (e.sectionName || "No Section"));
      if (!section) {
        section = { sectionName: e.sectionName || "No Section", semesterName: e.semesterName || "", students: [] };
        sections.push(section);
      }
      let student = section.students.find(s => s.studentId === e.studentId);
      if (!student) {
        student = { studentId: e.studentId, firstName: e.studentFirstName, lastName: e.studentLastName, email: e.studentEmail, courses: [] };
        section.students.push(student);
      }
      if (!student.courses.some(c => c.courseId === e.courseId)) {
        student.courses.push({ courseId: e.courseId, courseCode: e.courseCode, courseName: e.courseName });
      }
    }
    return map;
  }, [enrollments]);

  const currentSections = useMemo(() => {
    const sections = yearData.get(activeYear) || [];
    if (!filterSection) return sections;
    return sections.filter(s => s.sectionName === filterSection);
  }, [yearData, activeYear, filterSection]);

  const totalStudents = new Set(enrollments.map(e => e.studentId)).size;

  if (yearLevels.length > 0 && !activeYear) {
    setActiveYear(yearLevels[0]);
  }

  return (
    <div>
      <PageHeader
        title="My Students"
        subtitle={`${totalStudents} student${totalStudents !== 1 ? "s" : ""} across ${yearLevels.length} year level${yearLevels.length !== 1 ? "s" : ""}`}
      />

      {!isLoading && totalEnrollments > enrollments.length && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Showing the first {enrollments.length} enrollments ({totalEnrollments} total) — ask an administrator if students are missing.
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : yearLevels.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No students to show</p>
          <p className="text-sm mt-1">Students appear here once you are assigned as the course instructor and they are enrolled in your course.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b mb-6 overflow-x-auto">
            {yearLevels.map(year => {
              const yearStudents = new Set(
                (yearData.get(year) || []).flatMap(s => s.students.map(st => st.studentId))
              ).size;
              return (
                <button
                  key={year}
                  onClick={() => { setActiveYear(year); setFilterSection(""); }}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeYear === year
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {year}
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-medium rounded-full ${
                    activeYear === year ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {yearStudents}
                  </span>
                </button>
              );
            })}
          </div>

          {sectionsForYear.length > 1 && (
            <div className="mb-4 flex items-center gap-2">
              <Filter size={14} className="text-gray-400" />
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-lg bg-white"
              >
                <option value="">All Sections</option>
                {sectionsForYear.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {filterSection && (
                <button onClick={() => setFilterSection("")} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {currentSections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">No sections found for this year level.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {currentSections.map(section => (
                <div key={section.sectionName} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <div>
                      <h3 className="font-semibold text-gray-900">{section.sectionName}</h3>
                      {section.semesterName && <p className="text-xs text-gray-500">{section.semesterName}</p>}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                      {section.students.length} student{section.students.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="divide-y max-h-80 overflow-y-auto">
                    {section.students.sort((a, b) => a.lastName.localeCompare(b.lastName)).map(student => (
                      <div key={student.studentId} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`/students/${student.studentId}/profile`} className="text-sm font-medium text-primary-600 hover:underline truncate block">{student.lastName}, {student.firstName}</Link>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 shrink-0">
                            {student.courses.map(c => (
                              <span key={c.courseId} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-50 text-primary-700">
                                <BookOpen size={9} />
                                {c.courseCode}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
