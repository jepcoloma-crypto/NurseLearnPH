import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import {
  DEFAULT_MODULE_SETTINGS,
  resolveModuleSettings,
  type ModuleSettings,
} from "@/utils/moduleSettings";

/**
 * Institution/report/certificate settings used by printable documents.
 * Resolved over defaults so consumers can render immediately.
 */
export function useModuleSettings(): { settings: ModuleSettings; isLoading: boolean } {
  const query = useQuery({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const res = await adminApi.getModuleSettings();
      return resolveModuleSettings(res.data?.data);
    },
    placeholderData: DEFAULT_MODULE_SETTINGS,
    staleTime: 5 * 60_000,
  });
  return { settings: query.data ?? DEFAULT_MODULE_SETTINGS, isLoading: query.isLoading };
}
