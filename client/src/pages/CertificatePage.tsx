import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { clinicalRleApi } from "@/services/api";
import { Button, LoadingSpinner } from "@/components/shared";
import { ArrowLeft, Printer, Award, AlertTriangle } from "lucide-react";

function apiMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
  return e?.response?.data?.message ?? e?.response?.data?.error?.message ?? fallback;
}

function formatDate(value: unknown): string {
  if (!value) return "\u2014";
  return new Date(String(value)).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function CertificatePage() {
  const { rotationId } = useParams<{ rotationId: string }>();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useModuleSettings();

  const studentId = user?.role === "STUDENT" ? user.id : searchParams.get("studentId");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rotation-certificate", rotationId, studentId],
    queryFn: () => clinicalRleApi.getRotationCertificate(String(rotationId), String(studentId)),
    enabled: Boolean(rotationId && studentId),
    retry: false,
  });

  const cert = data?.data?.data;

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </Button>
          {cert && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save as PDF
            </Button>
          )}
        </div>

        {authLoading || isLoading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner />
          </div>
        ) : !studentId ? (
          <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center">
            <AlertTriangle size={36} className="mx-auto mb-3 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Student Required</h2>
            <p className="mt-1 text-sm text-gray-500">
              Staff members must specify a student, e.g. <code className="text-xs">?studentId=&lt;id&gt;</code>.
            </p>
            <Link to="/rotations" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline">
              Back to Rotations
            </Link>
          </div>
        ) : isError || !cert ? (
          <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center">
            <AlertTriangle size={36} className="mx-auto mb-3 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Certificate Unavailable</h2>
            <p className="mt-1 text-sm text-gray-500">
              {apiMessage(error, "This certificate could not be loaded.")}
            </p>
            <Link
              to={user?.role === "STUDENT" ? "/my-rotations" : "/rotations"}
              className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline"
            >
              Back to My Rotations
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow-lg print:shadow-none">
            <div className="m-3 border-[6px] border-double border-gray-800 p-6 sm:p-10 print:m-2 print:border-gray-900">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  {settings.organization.logoUrl ? (
                    <img src={settings.organization.logoUrl} alt="" className="h-9 w-9 object-contain" />
                  ) : (
                    <Award size={18} />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-[0.3em]">{settings.organization.name}</span>
                </div>
                {settings.organization.programName && (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-gray-400">
                    {settings.organization.programName}
                  </p>
                )}

                <h1 className="mt-6 font-serif text-3xl font-bold tracking-wide text-gray-900 sm:text-4xl">
                  {settings.certificates.title}
                </h1>
                <div className="mx-auto mt-3 h-px w-40 bg-gray-300" />

                <p className="mt-8 text-gray-600">This is to certify that</p>
                <p className="mt-3 font-serif text-2xl font-semibold text-gray-900 sm:text-3xl">
                  {cert.student.firstName}
                  {cert.student.middleName ? ` ${cert.student.middleName}` : ""} {cert.student.lastName}
                </p>

                <p className="mt-4 text-gray-600">has successfully completed the clinical rotation</p>
                <p className="mt-2 font-serif text-xl italic text-gray-800">&ldquo;{cert.rotation.title}&rdquo;</p>
                {cert.course && (
                  <p className="mt-1 text-sm text-gray-500">
                    {cert.course.code} &mdash; {cert.course.name}
                  </p>
                )}

                <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 text-left text-sm text-gray-600 sm:grid-cols-3">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Facility</span>
                    {cert.rotation.facility || "\u2014"}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Department</span>
                    {cert.rotation.department || "\u2014"}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Rotation Period</span>
                    {formatDate(cert.rotation.startDate)} &ndash; {formatDate(cert.rotation.endDate)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Hours Rendered</span>
                    {cert.hours.total} of {cert.hours.required} hrs ({cert.hours.percentage}%)
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Attendance</span>
                    {cert.attendance.percentage}% ({cert.attendance.presentDays + cert.attendance.lateDays}/
                    {cert.attendance.totalDays} days)
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">Completed On</span>
                    {formatDate(cert.rotation.completedAt)}
                  </div>
                </div>

                {!cert.hours.metRequiredHours && (
                  <p className="mt-4 text-xs text-amber-600">
                    Rendered hours below the {cert.hours.required}-hour requirement.
                  </p>
                )}

                <div className="mt-10 grid grid-cols-2 gap-8 sm:gap-12">
                  <div>
                    <div className="h-10 border-b border-gray-400" />
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {cert.instructor ? `${cert.instructor.firstName} ${cert.instructor.lastName}` : "\u2014"}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">Clinical Instructor</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-gray-400" />
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {settings.certificates.signatoryName || "Program Coordinator"}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">
                      {settings.certificates.signatoryTitle || "BSN Program"}
                    </p>
                  </div>
                </div>

                <p className="mt-8 text-[11px] text-gray-400">
                  Issued by {settings.organization.name} &middot; {formatDate(cert.rotation.completedAt)}
                </p>
                {settings.certificates.footerNote && (
                  <p className="mt-1 text-[11px] text-gray-400">{settings.certificates.footerNote}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
