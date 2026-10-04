import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import SearchBar from "@/components/SearchBar";
import NotificationBell from "@/components/NotificationBell";

export default function Layout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f4f8f7]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
          <SearchBar />
          <NotificationBell />
        </header>
        <div className="h-0.5 bg-gradient-to-r from-primary-700 via-primary-500 to-primary-300" />
        <main className="flex-1 overflow-auto p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
