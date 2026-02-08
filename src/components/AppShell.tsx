"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const userLabel =
    user?.displayName?.trim() ||
    user?.email ||
    "Current User";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onLogoutRequested={() => setLogoutOpen(true)}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Storage Office
            </span>
            <div className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              Logged in as{" "}
              <span className="font-semibold text-slate-900">
                {userLabel}
              </span>
            </div>
          </div>
          <div className="hidden items-center justify-end border-b border-slate-200 bg-white px-6 py-3 md:flex">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              Logged in as{" "}
              <span className="font-semibold text-slate-900">
                {userLabel}
              </span>
            </div>
          </div>
          <main className="flex-1 px-4 py-6 md:px-10">{children}</main>
        </div>
      </div>
      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setLogoutOpen(false)}
            aria-label="Close logout confirmation"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
            <h2 className="text-lg font-semibold">Confirm Logout</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to sign out?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  router.replace("/login");
                  setMobileOpen(false);
                  setLogoutOpen(false);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
