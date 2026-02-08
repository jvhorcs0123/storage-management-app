"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/");
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError("Please complete all fields.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/register-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Registration failed.");
      }
      setSuccess("Registration submitted. Await admin approval.");
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="hidden flex-col justify-center gap-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-10 text-slate-200 shadow-xl lg:flex">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
              Storage Office
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-white">
              Product & Storage Management System
            </h1>
            <p className="text-sm text-slate-400">
              Track products, deliveries, and storage inventory with a clean
              operational dashboard.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">
                {mode === "login" ? "Login" : "Register"}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setMode((prev) => (prev === "login" ? "register" : "login"))
                }
                className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
              >
                {mode === "login" ? "Create Account" : "Back to Login"}
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "login"
                ? "Use your storage office credentials."
                : "Submit your registration for admin approval."}
            </p>
            <form
              className="mt-8 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (mode === "login") {
                  handleLogin();
                } else {
                  handleRegister();
                }
              }}
            >
              {mode === "register" && (
                <label className="block text-sm font-medium text-slate-700">
                  Fullname
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              {mode === "register" && (
                <label className="block text-sm font-medium text-slate-700">
                  Confirm Password
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  {success}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {loading
                  ? mode === "login"
                    ? "Signing in..."
                    : "Submitting..."
                  : mode === "login"
                    ? "Login"
                    : "Submit Registration"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
