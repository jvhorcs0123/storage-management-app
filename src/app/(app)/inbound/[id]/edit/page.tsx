"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import InboundForm from "@/components/InboundForm";
import type { InboundDoc, InboundFormValues } from "@/lib/inbound";

export default function EditInboundPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [initialValues, setInitialValues] = useState<InboundFormValues | null>(
    null,
  );
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "inbounds", id));
        if (!snap.exists()) {
          setPageError("Inbound record not found.");
          return;
        }
        const inbound = snap.data() as InboundDoc;
        if ((inbound.status ?? "Closed") === "Closed") {
          router.replace(`/inbound/${id}`);
          return;
        }
        setInitialValues({
          referenceNo: inbound.referenceNo,
          source: inbound.source ?? "Restock",
          handledBy: inbound.handledBy ?? "",
          dateTime: inbound.dateTime ?? "",
          items: inbound.items ?? [],
        });
      } catch {
        setPageError("Unable to load inbound record.");
      }
    };
    load();
  }, [id, router, user]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        Please sign in to edit inbound records.
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 shadow-sm">
        {pageError}
      </div>
    );
  }

  if (!initialValues) return null;

  return (
    <InboundForm
      title="Edit Inbound"
      initialValues={initialValues}
      existingId={id}
    />
  );
}
