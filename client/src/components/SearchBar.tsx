import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchApi } from "@/services/api";
import { Search } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  url: string;
}

interface SearchResults {
  courses: SearchResult[];
  topics: SearchResult[];
  lessons: SearchResult[];
  users: SearchResult[];
  assessments: SearchResult[];
}

const TYPE_LABELS: Record<string, string> = {
  course: "Course",
  topic: "Topic",
  lesson: "Lesson",
  user: "User",
  assessment: "Assessment",
};

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allResults: SearchResult[] = results
    ? [...results.courses, ...results.topics, ...results.lessons, ...results.users, ...results.assessments]
    : [];

  const groupedResults: { label: string; items: SearchResult[] }[] = results
    ? [
        ...(results.courses.length > 0 ? [{ label: "Courses", items: results.courses }] : []),
        ...(results.topics.length > 0 ? [{ label: "Topics", items: results.topics }] : []),
        ...(results.lessons.length > 0 ? [{ label: "Lessons", items: results.lessons }] : []),
        ...(results.users.length > 0 ? [{ label: "Users", items: results.users }] : []),
        ...(results.assessments.length > 0 ? [{ label: "Assessments", items: results.assessments }] : []),
      ]
    : [];

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    searchApi.search(q).then((res) => {
      setResults(res.data.data);
    }).catch(() => {
      setResults(null);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : allResults.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = allResults[activeIndex];
      if (item) {
        navigate(item.url);
        setIsOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (url: string) => {
    navigate(url);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setActiveIndex(-1); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-64 pl-9 pr-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
          {groupedResults.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-gray-50">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const globalIndex = allResults.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                        globalIndex === activeIndex ? "bg-primary-50 text-primary-700" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
