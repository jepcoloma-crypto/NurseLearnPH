import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/services/api";
import { Bell, CheckCheck } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "react-hot-toast";

export default function NotificationBell() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: 30000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: () => notificationApi.list({ limit: "10" }),
    enabled: open,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = countData?.data?.data?.count ?? 0;
  const notifications = notificationsData?.data?.data?.items ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!can("notifications.view")) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n: Record<string, unknown>) => (
                <div
                  key={String(n.id)}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                    !n.isRead ? "bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? "font-semibold" : ""} text-gray-900 truncate`}>
                        {String(n.title)}
                      </p>
                      {n.content ? (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {String(n.content)}
                        </p>
                      ) : null}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(String(n.createdAt)).toLocaleString()}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="ml-2 mt-1 w-2 h-2 bg-primary-600 rounded-full flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
