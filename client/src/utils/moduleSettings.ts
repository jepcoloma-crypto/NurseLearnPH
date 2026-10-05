/**
 * Module Settings — institution letterheads, report notes and certificate
 * wording shared by every printable/exported document.
 * Defaults mirror server/src/modules/admin/settings.service.ts so screens and
 * tests render sensibly before (or without) a settings fetch.
 */

export interface ModuleSettings {
  organization: {
    name: string;
    address: string;
    contact: string;
    logoUrl: string;
    programName: string;
  };
  reports: {
    headerNote: string;
    footerNote: string;
  };
  certificates: {
    title: string;
    signatoryName: string;
    signatoryTitle: string;
    footerNote: string;
  };
}

export const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  organization: {
    name: "NurseLearn PH",
    address: "",
    contact: "",
    logoUrl: "",
    programName: "Bachelor of Science in Nursing",
  },
  reports: {
    headerNote: "",
    footerNote: "",
  },
  certificates: {
    title: "Certificate of Completion",
    signatoryName: "",
    signatoryTitle: "BSN Program",
    footerNote: "",
  },
};

/** Merge a server response over the defaults (missing keys keep defaults). */
export function resolveModuleSettings(data: unknown): ModuleSettings {
  const d = (data ?? {}) as Partial<ModuleSettings>;
  return {
    organization: { ...DEFAULT_MODULE_SETTINGS.organization, ...(d.organization ?? {}) },
    reports: { ...DEFAULT_MODULE_SETTINGS.reports, ...(d.reports ?? {}) },
    certificates: { ...DEFAULT_MODULE_SETTINGS.certificates, ...(d.certificates ?? {}) },
  };
}
