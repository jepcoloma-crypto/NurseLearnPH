import { eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { moduleSettings } from "../../database/schema/index.js";

export const SETTINGS_SECTIONS = ["organization", "reports", "certificates"] as const;
export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number];

export type SettingsSections = {
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
};

/** Fallbacks used when a section has never been saved (mirrored client-side). */
export const DEFAULT_SETTINGS: SettingsSections = {
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

export function isSettingsSection(key: string): key is SettingsSectionKey {
  return (SETTINGS_SECTIONS as readonly string[]).includes(key);
}

function withDefaults(): SettingsSections {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsSections;
}

/** Every section merged over its defaults; unsaved sections keep defaults. */
export async function getSettings(): Promise<SettingsSections> {
  const rows = await db.select().from(moduleSettings);
  const merged = withDefaults();
  for (const row of rows) {
    if (!isSettingsSection(row.key)) continue;
    const value = row.value as Record<string, unknown> | null;
    if (value && typeof value === "object") Object.assign(merged[row.key], value);
  }
  return merged;
}

/** Merge each provided section into its stored row (upsert), then return all. */
export async function updateSettings(
  patch: Partial<Record<SettingsSectionKey, Record<string, unknown>>>,
  updatedBy: string | null
): Promise<SettingsSections> {
  for (const [key, value] of Object.entries(patch)) {
    if (!isSettingsSection(key) || !value || typeof value !== "object") continue;
    const [existing] = await db
      .select()
      .from(moduleSettings)
      .where(eq(moduleSettings.key, key));
    const stored = (existing?.value ?? {}) as Record<string, unknown>;
    const merged = { ...stored, ...value };
    await db
      .insert(moduleSettings)
      .values({ key, value: merged, updatedBy })
      .onConflictDoUpdate({
        target: moduleSettings.key,
        set: { value: merged, updatedBy, updatedAt: new Date() },
      });
  }
  return getSettings();
}
