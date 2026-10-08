"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import InboundForm from "@/components/InboundForm";
import { getNextInboundRefNo, type InboundFormValues } from "@/lib/inbound";

export default function NewInboundPage() {
  const { user, loading } = useAuth();
  const [initialValues, setInitialValues] = useState<InboundFormValues | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const referenceNo = await getNextInboundRefNo();
      setInitialValues({
        referenceNo,
        source: "Restock",
        handledBy: "",
        dateTime: new Date().toISOString().slice(0, 16),
        items: [],
      });
    };
    load();
  }, [user]);

  if (loading || (user && !initialValues)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        Loading...
      </div>
    );
  }

  if (!user || !initialValues) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        Please sign in to create inbound records.
      </div>
    );
  }

  return <InboundForm title="New Inbound" initialValues={initialValues} />;
}
