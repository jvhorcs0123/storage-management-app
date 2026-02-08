import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <RequireAuth>{children}</RequireAuth>
    </AppShell>
  );
}
