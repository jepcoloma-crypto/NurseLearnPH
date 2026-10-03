import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { usersApi } from "@/services/api";
import { PageHeader, Button, Badge, LoadingSpinner, Card } from "@/components/shared";
import {
  ArrowLeft, BarChart3, Briefcase, FlaskConical, ClipboardList,
  Clock, BookOpen, ClipboardCheck, Star, TrendingUp,
} from "lucide-react";

type ProfileTab = "timeline" | "assessments" | "cases" | "skills" | "careplans" | "rotations" | "logs" | "evaluations";

const TABS: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { key: "timeline", label: "Timeline", icon: <Clock size={14} /> },
  { key: "assessments", label: "Assessments", icon: <BarChart3 size={14} /> },
  { key: "cases", label: "Clinical Cases", icon: <Briefcase size={14} /> },
  { key: "skills", label: "Skills", icon: <FlaskConical size={14} /> },
  { key: "careplans", label: "Care Plans", icon: <ClipboardList size={14} /> },
  { key: "rotations", label: "Rotations", icon: <Clock size={14} /> },
  { key: "logs", label: "Clinical Logs", icon: <BookOpen size={14} /> },
  { key: "evaluations", label: "Evaluations", icon: <Star size={14} /> },
];

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProfileTab>("timeline");

  const { data, isLoading } = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: () => usersApi.getProfile(studentId!),
    enabled: !!studentId,
  });

  const profile = data?.data?.data;

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <div className="text-center py-12 text-gray-500">Student not found</div>;

  const { student, enrollments, summary, timeline } = profile;

  return (
    <div>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`${student.email} · Student Activity Profile`}
        actions={<Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} className="mr-1" /> Back</Button>}
      />

      {/* Enrollments */}
      {enrollments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {enrollments.map((e: Record<string, unknown>, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
              <BookOpen size={12} /> {String(e.courseCode)} — {String(e.courseName)}
              {e.sectionName ? <span className="text-primary-400">({String(e.sectionName)})</span> : null}
            </span>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Assessment Avg"
          value={summary.assessmentAvg != null ? `${summary.assessmentAvg}%` : "—"}
          sub={`${summary.assessmentsAttempted}/${summary.assessmentsTotal} attempted`}
          color={summary.assessmentAvg != null && summary.assessmentAvg >= 75 ? "text-green-600" : summary.assessmentAvg != null && summary.assessmentAvg >= 50 ? "text-yellow-600" : "text-gray-500"}
        />
        <SummaryCard
          label="Clinical Cases"
          value={summary.casesCompleted > 0 ? `${summary.caseAvg}%` : "—"}
          sub={`${summary.casesCompleted}/${summary.casesTotal} completed`}
          color={summary.caseAvg != null && summary.caseAvg >= 75 ? "text-green-600" : "text-gray-500"}
        />
        <SummaryCard
          label="Skills Competent"
          value={`${summary.skillsCompetent}/${summary.skillsTotal}`}
          sub={`${summary.skillsTotal > 0 ? Math.round((summary.skillsCompetent / summary.skillsTotal) * 100) : 0}% competency`}
          color={summary.skillsCompetent > 0 ? "text-blue-600" : "text-gray-500"}
        />
        <SummaryCard
          label="Care Plans"
          value={`${summary.carePlansApproved + summary.carePlansCompleted}`}
          sub={`${summary.carePlansTotal} total`}
          color={summary.carePlansApproved > 0 ? "text-green-600" : "text-gray-500"}
        />
        <SummaryCard
          label="Rotation Hours"
          value={`${summary.rotationHours}`}
          sub={`of ${summary.rotationRequired} required`}
          color={summary.rotationHours > 0 ? "text-purple-600" : "text-gray-500"}
          progress={summary.rotationRequired > 0 ? Math.round((summary.rotationHours / summary.rotationRequired) * 100) : 0}
        />
        <SummaryCard
          label="Clinical Logs"
          value={`${summary.clinicalLogsCount}`}
          sub="submitted"
          color={summary.clinicalLogsCount > 0 ? "text-teal-600" : "text-gray-500"}
        />
        <SummaryCard
          label="Evaluations"
          value={`${summary.evaluationsCount}`}
          sub="received"
          color={summary.evaluationsCount > 0 ? "text-orange-600" : "text-gray-500"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "timeline" && <TimelineTab items={timeline} />}
      {tab === "assessments" && <AssessmentsTab items={profile.assessments} />}
      {tab === "cases" && <CasesTab items={profile.cases} />}
      {tab === "skills" && <SkillsTab items={profile.skills} />}
      {tab === "careplans" && <CarePlansTab items={profile.carePlans} />}
      {tab === "rotations" && <RotationsTab items={profile.rotations} />}
      {tab === "logs" && <LogsTab items={profile.clinicalLogs} />}
      {tab === "evaluations" && <EvaluationsTab items={profile.evaluations} />}
    </div>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, progress }: {
  label: string; value: string; sub: string; color: string; progress?: number;
}) {
  return (
    <Card className="p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
      {progress != null && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
          <div className={`h-1.5 rounded-full ${progress >= 100 ? "bg-green-500" : progress >= 50 ? "bg-blue-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </Card>
  );
}

// ─── Timeline Tab ───────────────────────────────────────────────────────────

function TimelineTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No activity yet.</p>;

  const typeIcons: Record<string, React.ReactNode> = {
    ASSESSMENT: <BarChart3 size={14} className="text-blue-500" />,
    CASE: <Briefcase size={14} className="text-green-500" />,
    SKILL: <FlaskConical size={14} className="text-purple-500" />,
    CARE_PLAN: <ClipboardList size={14} className="text-yellow-500" />,
    ATTENDANCE: <ClipboardCheck size={14} className="text-teal-500" />,
    LOG: <BookOpen size={14} className="text-cyan-500" />,
    LOG_REVIEW: <BookOpen size={14} className="text-cyan-400" />,
    EVALUATION: <Star size={14} className="text-orange-500" />,
  };

  const typeColors: Record<string, string> = {
    ASSESSMENT: "border-blue-200 bg-blue-50",
    CASE: "border-green-200 bg-green-50",
    SKILL: "border-purple-200 bg-purple-50",
    CARE_PLAN: "border-yellow-200 bg-yellow-50",
    ATTENDANCE: "border-teal-200 bg-teal-50",
    LOG: "border-cyan-200 bg-cyan-50",
    LOG_REVIEW: "border-cyan-100 bg-cyan-50",
    EVALUATION: "border-orange-200 bg-orange-50",
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const dateStr = item.date ? new Date(String(item.date)).toLocaleDateString() : "";
        const timeStr = item.date ? new Date(String(item.date)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeColors[String(item.type)] ?? "border-gray-200 bg-white"}`}>
            <div className="mt-0.5">{typeIcons[String(item.type)] ?? <TrendingUp size={14} className="text-gray-400" />}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900">{String(item.description)}</div>
              <div className="text-xs text-gray-500 mt-0.5">{dateStr} {timeStr}</div>
            </div>
            {item.score != null && item.score !== undefined && (
              <Badge variant={Number(item.score) >= 75 ? "success" : Number(item.score) >= 50 ? "warning" : "danger"}>
                {String(item.score)}%
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Assessments Tab ────────────────────────────────────────────────────────

function AssessmentsTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No assessments in enrolled courses.</p>;

  return (
    <div className="space-y-2">
      {items.map((ass) => {
        const attempts = (ass.attempts as Array<Record<string, unknown>>) ?? [];
        const best = attempts.length > 0 ? Math.max(...attempts.map((a) => Number(a.score ?? 0))) : null;
        const passed = best != null && best >= Number(ass.passingScore ?? 0);
        return (
          <Card key={String(ass.id)} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 text-sm">{String(ass.title)}</div>
              <div className="text-xs text-gray-500">Passing: {String(ass.passingScore)}% · Attempts: {attempts.length}</div>
            </div>
            <div className="flex items-center gap-2">
              {best != null ? (
                <Badge variant={passed ? "success" : "danger"}>{best}%</Badge>
              ) : (
                <span className="text-xs text-gray-400">Not attempted</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Cases Tab ──────────────────────────────────────────────────────────────

function CasesTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No clinical cases in enrolled courses.</p>;

  return (
    <div className="space-y-2">
      {items.map((c) => {
        const attempts = (c.attempts as Array<Record<string, unknown>>) ?? [];
        const completed = attempts.filter((a) => a.status === "COMPLETED");
        const bestPct = completed.length > 0
          ? Math.max(...completed.map((a) => {
              const total = Number(a.totalPoints ?? 0);
              const score = Number(a.score ?? 0);
              return total > 0 ? Math.round((score / total) * 100) : 0;
            }))
          : null;
        return (
          <Card key={String(c.id)} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 text-sm">{String(c.title)}</div>
              <div className="text-xs text-gray-500">Attempts: {attempts.length} · Completed: {completed.length}</div>
            </div>
            <div className="flex items-center gap-2">
              {bestPct != null ? (
                <Badge variant={bestPct >= 75 ? "success" : bestPct >= 50 ? "warning" : "danger"}>{bestPct}%</Badge>
              ) : (
                <span className="text-xs text-gray-400">Not completed</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Skills Tab ─────────────────────────────────────────────────────────────

function SkillsTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No skills available.</p>;

  const competent = items.filter((s) => s.isCompetent).length;

  return (
    <div>
      <div className="text-sm text-gray-600 mb-3">{competent}/{items.length} skills competent ({items.length > 0 ? Math.round((competent / items.length) * 100) : 0}%)</div>
      <div className="space-y-2">
        {items.map((s) => {
          const attempts = (s.attempts as Array<Record<string, unknown>>) ?? [];
          return (
            <Card key={String(s.id)} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{String(s.name)}</div>
                <div className="text-xs text-gray-500">{String(s.category)} · Attempts: {attempts.length}</div>
              </div>
              {s.isCompetent ? (
                <Badge variant="success">Competent</Badge>
              ) : attempts.length > 0 ? (
                <Badge variant="warning">Attempted</Badge>
              ) : (
                <Badge variant="default">Not Started</Badge>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Care Plans Tab ─────────────────────────────────────────────────────────

function CarePlansTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No care plans created.</p>;

  const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    DRAFT: "default", SUBMITTED: "warning", UNDER_REVIEW: "warning",
    APPROVED: "success", RETURNED: "danger", ACTIVE: "info",
    COMPLETED: "success", ARCHIVED: "default",
  };

  return (
    <div className="space-y-2">
      {items.map((cp) => (
        <Card key={String(cp.id)} className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 text-sm">{String(cp.title)}</div>
              <div className="text-xs text-gray-500">Created: {cp.createdAt ? new Date(String(cp.createdAt)).toLocaleDateString() : "—"}</div>
            </div>
            <Badge variant={statusVariant[String(cp.status)] ?? "default"}>{String(cp.status)}</Badge>
          </div>
          {cp.evaluationNotes ? (
            <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
              <strong>Feedback:</strong> {String(cp.evaluationNotes)}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

// ─── Rotations Tab ──────────────────────────────────────────────────────────

function RotationsTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">Not assigned to any rotations.</p>;

  return (
    <div className="space-y-2">
      {items.map((r) => {
        const hoursLogged = Number(r.hoursLogged ?? 0);
        const required = Number(r.requiredHours ?? 120);
        const pct = required > 0 ? Math.round((hoursLogged / required) * 100) : 0;
        return (
          <Card key={String(r.id)} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900 text-sm">{String(r.title)}</div>
                <div className="text-xs text-gray-500">
                  {r.facility ? `${String(r.facility)} · ` : ""}{r.department ? `${String(r.department)} · ` : ""}
                  {r.startDate ? new Date(String(r.startDate)).toLocaleDateString() : ""} — {r.endDate ? new Date(String(r.endDate)).toLocaleDateString() : ""}
                </div>
              </div>
              <Badge variant={r.status === "IN_PROGRESS" ? "success" : r.status === "COMPLETED" ? "info" : "default"}>
                {String(r.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{hoursLogged}/{required} hrs</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Logs Tab ───────────────────────────────────────────────────────────────

function LogsTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No clinical logs submitted.</p>;

  return (
    <div className="space-y-2">
      {items.map((l) => (
        <Card key={String(l.id)} className="p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-900 text-sm">{l.date ? new Date(String(l.date)).toLocaleDateString() : "—"}</span>
            {l.reviewedAt ? <Badge variant="success">Reviewed</Badge> : <Badge variant="default">Pending</Badge>}
          </div>
          {Array.isArray(l.procedures) && l.procedures.length > 0 && (
            <div className="text-xs text-gray-600 mb-1"><strong>Procedures:</strong> {(l.procedures as string[]).join(", ")}</div>
          )}
          {l.reflections ? <div className="text-xs text-gray-600 mb-1"><strong>Reflections:</strong> {String(l.reflections)}</div> : null}
          {l.feedback ? (
            <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
              <strong>Feedback:</strong> {String(l.feedback)}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

// ─── Evaluations Tab ────────────────────────────────────────────────────────

function EvaluationsTab({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No evaluations received.</p>;

  return (
    <div className="space-y-2">
      {items.map((e) => (
        <Card key={String(e.id)} className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="info">{String(e.type)}</Badge>
              <span className="text-xs text-gray-500">{e.evaluatedAt ? new Date(String(e.evaluatedAt)).toLocaleDateString() : ""}</span>
            </div>
            {e.overallScore != null ? (
              <span className="text-lg font-bold text-primary-600">{String(e.overallScore)}%</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
            {e.clinicalPerformance != null && <span>Clinical: {String(e.clinicalPerformance)}%</span>}
            {e.professionalBehavior != null && <span>Behavior: {String(e.professionalBehavior)}%</span>}
            {e.communicationSkills != null && <span>Communication: {String(e.communicationSkills)}%</span>}
            {e.criticalThinking != null && <span>Critical Thinking: {String(e.criticalThinking)}%</span>}
          </div>
          {e.strengths ? <div className="text-xs text-gray-600 mb-1"><strong>Strengths:</strong> {String(e.strengths)}</div> : null}
          {e.areasForImprovement ? <div className="text-xs text-gray-600 mb-1"><strong>Areas for Improvement:</strong> {String(e.areasForImprovement)}</div> : null}
          {e.comments ? <div className="text-xs text-gray-600"><strong>Comments:</strong> {String(e.comments)}</div> : null}
        </Card>
      ))}
    </div>
  );
}
