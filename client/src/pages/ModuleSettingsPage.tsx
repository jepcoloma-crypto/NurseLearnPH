import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Image as ImageIcon } from "lucide-react";
import { PageHeader, Button } from "@/components/shared";
import { adminApi, learningApi } from "@/services/api";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import type { ModuleSettings } from "@/utils/moduleSettings";

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500";
const textareaCls = inputCls + " resize-y";

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <p className="text-xs text-gray-400 mt-1 mb-4">{description}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Administration → Module Settings.
 * Central configuration for every printable/exported document: reports
 * (accreditation), certificates, printed question sheets and future exports.
 */
export default function ModuleSettingsPage() {
  const { settings } = useModuleSettings();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ModuleSettings>({ defaultValues: settings });
  const [uploading, setUploading] = useState(false);

  // Fill the form when fetched settings arrive; keep in-progress edits on refetch
  useEffect(() => {
    reset(settings, { keepDirtyValues: true });
  }, [settings, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: ModuleSettings) => adminApi.updateModuleSettings(values),
    onSuccess: (_res, values) => {
      reset(values);
      toast.success("Module settings saved");
      queryClient.invalidateQueries({ queryKey: ["module-settings"] });
    },
    onError: () => toast.error("Failed to save module settings"),
  });

  const logoUrl = watch("organization.logoUrl");

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }
    setUploading(true);
    learningApi
      .uploadFile(file, "images")
      .then((res) => {
        const url = res.data?.data?.url as string | undefined;
        if (url) {
          setValue("organization.logoUrl", url, { shouldDirty: true });
          toast.success("Logo uploaded - click Save changes to apply it");
        }
      })
      .catch(() => toast.error("Logo upload failed"))
      .finally(() => setUploading(false));
  };

  return (
    <div>
      <PageHeader
        title="Module Settings"
        subtitle="Letterheads, notes and wording used on reports, certificates and printable documents"
        actions={
          <Button
            type="submit"
            form="module-settings-form"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        }
      />

      <form
        id="module-settings-form"
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-6 pb-8"
      >
        <SectionCard
          title="Organization"
          description="Institution identity printed at the top of reports, question sheets and certificates."
        >
          <div className="sm:col-span-2 flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon size={22} className="text-gray-300" />
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={onLogoFile}
                disabled={uploading}
                className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-xs file:cursor-pointer"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {uploading
                  ? "Uploading logo..."
                  : "Shown on printed documents. Click Save changes after uploading."}
              </p>
              {logoUrl && (
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline mt-1"
                  onClick={() => setValue("organization.logoUrl", "", { shouldDirty: true })}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>

          <Field
            label="Institution name"
            htmlFor="org-name"
            error={errors.organization?.name?.message}
            hint="Printed at the top of every document."
          >
            <input
              id="org-name"
              className={inputCls}
              {...register("organization.name", { required: "Institution name is required" })}
            />
          </Field>
          <Field label="Program name" htmlFor="org-program" hint="Shown as the certificate subtitle.">
            <input id="org-program" className={inputCls} {...register("organization.programName")} />
          </Field>
          <Field label="Address" htmlFor="org-address" hint="Campus / school address line.">
            <input id="org-address" className={inputCls} {...register("organization.address")} />
          </Field>
          <Field label="Contact" htmlFor="org-contact" hint="Phone / email line under the address.">
            <input
              id="org-contact"
              className={inputCls}
              placeholder="(02) 1234-5678 - info@school.edu"
              {...register("organization.contact")}
            />
          </Field>
        </SectionCard>

        <SectionCard
          title="Reports"
          description="Used by the Accreditation Report and other printable/exportable reports."
        >
          <Field
            label="Header note"
            htmlFor="report-header"
            hint="Shown under the institution name at the top of reports (e.g. school year or accreditation statement)."
          >
            <textarea id="report-header" rows={3} className={textareaCls} {...register("reports.headerNote")} />
          </Field>
          <Field
            label="Footer note"
            htmlFor="report-footer"
            hint="Printed at the end of reports (e.g. confidentiality or generation note)."
          >
            <textarea id="report-footer" rows={3} className={textareaCls} {...register("reports.footerNote")} />
          </Field>
        </SectionCard>

        <SectionCard
          title="Certificates"
          description="Used on rotation completion certificates."
        >
          <Field label="Certificate title" htmlFor="cert-title">
            <input id="cert-title" className={inputCls} {...register("certificates.title")} />
          </Field>
          <Field
            label="Signatory name"
            htmlFor="cert-signatory"
            hint={'Leave blank to print "Program Coordinator".'}
          >
            <input id="cert-signatory" className={inputCls} {...register("certificates.signatoryName")} />
          </Field>
          <Field
            label="Signatory position"
            htmlFor="cert-signatory-title"
            hint="Line under the signatory name (e.g. Program Chair)."
          >
            <input id="cert-signatory-title" className={inputCls} {...register("certificates.signatoryTitle")} />
          </Field>
          <Field
            label="Footer note"
            htmlFor="cert-footer"
            hint="Extra line under the certificate footer."
          >
            <input id="cert-footer" className={inputCls} {...register("certificates.footerNote")} />
          </Field>
        </SectionCard>

        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">
            Changes apply to newly generated reports, certificates and printed documents.
          </p>
          <Button
            type="submit"
            form="module-settings-form"
            variant="primary"
            className="ml-auto"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
