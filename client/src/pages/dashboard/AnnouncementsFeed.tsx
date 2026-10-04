import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Megaphone, Paperclip } from "lucide-react";
import { announcementApi } from "@/services/api";
import { Panel } from "./widgets";

/**
 * Unread announcements feed shown on every role's home screen.
 * Items drop off the feed once they have been read.
 */
export default function AnnouncementsFeed() {
  const { data: announcementsFeed } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: () =>
      announcementApi.list({
        limit: "5",
        publishedOnly: "true",
        // Only announcements this user hasn't read yet — once read, they
        // drop off the dashboard.
        unreadOnly: "true",
      }),
  });
  const allFeedItems = announcementsFeed?.data?.data?.items ?? [];
  // Safety net: never render an item whose read flag is already set.
  const feedItems = allFeedItems.filter(
    (a: Record<string, unknown>) => a.read !== true
  );

  return (
    <Panel
      title="Announcements"
      icon={<Megaphone size={16} />}
      className="mb-6"
      action={
        <Link to="/announcements" className="text-sm text-primary-600 hover:underline">
          View all
        </Link>
      }
    >
      {feedItems.length === 0 ? (
        <p className="text-sm text-gray-500">You&rsquo;re all caught up — no unread announcements.</p>
      ) : (
        <div className="space-y-2">
          {feedItems.map((a: Record<string, unknown>) => {
            const fileCount = Array.isArray(a.attachments) ? a.attachments.length : 0;
            const priority = String(a.priority);
            const showChip = priority === "URGENT" || priority === "HIGH";
            return (
              <Link
                key={String(a.id)}
                to="/announcements"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    priority === "URGENT"
                      ? "bg-red-500"
                      : priority === "HIGH"
                      ? "bg-amber-500"
                      : "bg-primary-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.read === false && (
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle"
                        title="Unread"
                      />
                    )}
                    {String(a.title)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {a.courseId
                      ? `${String(a.courseCode || "")} ${String(a.courseName || "")}`.trim()
                      : "Institution-wide"}
                    {" · "}{new Date(String(a.createdAt)).toLocaleDateString()}
                    {fileCount > 0 && ` · ${fileCount} file${fileCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                {showChip && (
                  <span
                    className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                      priority === "URGENT"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {priority}
                  </span>
                )}
                {fileCount > 0 && <Paperclip size={14} className="text-gray-400" />}
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
