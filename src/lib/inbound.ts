import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Transaction,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { logAction } from "@/lib/logs";
import { claimReferenceNo, getNextSeries } from "@/lib/stock";
import { buildTransactionData } from "@/lib/transactions";

export type InboundSource = "Restock" | "Returns";
export type InboundStatus = "Draft" | "Closed";

export type InboundItem = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  sku: string;
  unit: string;
  quantity: number;
};

export type InboundDoc = {
  referenceNo: string;
  inYear: string;
  series: number;
  source: InboundSource;
  handledBy: string;
  dateTime: string;
  items: InboundItem[];
  status?: InboundStatus;
};

export type InboundFormValues = {
  referenceNo: string;
  source: InboundSource;
  handledBy: string;
  dateTime: string;
  items: InboundItem[];
};

export const inboundSources: InboundSource[] = ["Restock", "Returns"];

export function handledByLabel(source: InboundSource) {
  return source === "Restock" ? "Restocked by" : "Returned by";
}

function generateRefNo(year: string, series: number) {
  const padded = String(series).padStart(4, "0");
  return `REFNO-IN-${year}-${padded}`;
}

export async function getNextInboundRefNo() {
  const year = new Date().getFullYear().toString().slice(-2);
  return generateRefNo(year, await getNextSeries("inbounds", "REFNO-IN", year));
}

function refParts(referenceNo: string) {
  const parts = referenceNo.split("-");
  return { inYear: parts[2] ?? "", series: Number(parts[3]) };
}

export async function saveInboundDraft(
  user: User | null,
  values: InboundFormValues,
  existingId?: string,
) {
  const fields = {
    source: values.source,
    handledBy: values.handledBy.trim(),
    dateTime: values.dateTime,
    items: values.items,
    status: "Draft" as InboundStatus,
  };
  const saved = await runTransaction(db, async (txn) => {
    if (existingId) {
      const inboundRef = doc(db, "inbounds", existingId);
      const existing = await txn.get(inboundRef);
      if (!existing.exists()) throw new Error("Inbound record not found.");
      // Don't reopen an inbound another tab already finalized.
      if ((existing.data().status ?? "Closed") !== "Draft") {
        throw new Error("This inbound has already been saved.");
      }
      txn.update(inboundRef, fields);
      return { id: existingId, referenceNo: values.referenceNo };
    }
    const claimed = await claimInboundRef(txn, values.referenceNo);
    txn.set(claimed.ref, {
      referenceNo: claimed.referenceNo,
      inYear: claimed.year,
      series: claimed.series,
      ...fields,
      createdAt: serverTimestamp(),
    });
    return { id: claimed.ref.id, referenceNo: claimed.referenceNo };
  });
  await logAction(user, {
    action: `Saved draft ${saved.referenceNo}`,
    entity: "inbound",
    entityId: saved.id,
    entityName: saved.referenceNo,
  });
}

// The number shown on the form is a suggestion; if someone else saved it
// first, the next free number is used instead.
async function claimInboundRef(txn: Transaction, suggested: string) {
  const { inYear, series } = refParts(suggested);
  const claimed = await claimReferenceNo(
    txn,
    "inbounds",
    "REFNO-IN",
    inYear,
    series,
  );
  return { ...claimed, year: inYear };
}

// Applies the same rules as a single Incoming Stocks entry, for every item at
// once: Restock raises Total and Onhand, Returns raises Onhand only. Stock
// updates, transaction history, and the inbound record commit together.
export async function finalizeInbound(
  user: User | null,
  values: InboundFormValues,
  existingId?: string,
) {
  const handledBy = values.handledBy.trim();
  const isRestock = values.source === "Restock";
  const productIds = Array.from(
    new Set(values.items.map((item) => item.productId)),
  );

  const saved = await runTransaction(db, async (txn) => {
    let inboundRef: DocumentReference;
    let referenceNo = values.referenceNo;
    let newRecord: { inYear: string; series: number } | null = null;
    if (existingId) {
      inboundRef = doc(db, "inbounds", existingId);
      const existing = await txn.get(inboundRef);
      if (!existing.exists()) throw new Error("Inbound record not found.");
      if ((existing.data().status ?? "Closed") !== "Draft") {
        throw new Error("This inbound has already been saved.");
      }
    } else {
      const claimed = await claimInboundRef(txn, values.referenceNo);
      inboundRef = claimed.ref;
      referenceNo = claimed.referenceNo;
      newRecord = { inYear: claimed.year, series: claimed.series };
    }

    const onhandById = new Map<string, number>();
    for (const productId of productIds) {
      const snap = await txn.get(doc(db, "products", productId));
      if (!snap.exists()) {
        const name = values.items.find((item) => item.productId === productId)
          ?.productName;
        throw new Error(`${name ?? "A product"} no longer exists.`);
      }
      onhandById.set(productId, Number(snap.data().onhandQty ?? 0));
    }

    const qtyById = new Map<string, number>();
    for (const item of values.items) {
      qtyById.set(
        item.productId,
        (qtyById.get(item.productId) ?? 0) + item.quantity,
      );
      const balanceAfter = (onhandById.get(item.productId) ?? 0) + item.quantity;
      onhandById.set(item.productId, balanceAfter);
      txn.set(
        doc(collection(db, "transactions")),
        buildTransactionData({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          sku: item.sku,
          unit: item.unit,
          type: isRestock ? "Incoming (Restock)" : "Incoming (Return)",
          qtyIn: item.quantity,
          qtyOut: 0,
          balanceAfter,
          reference: referenceNo,
          source: values.source,
          handledBy,
          date: values.dateTime.slice(0, 10),
          userId: user?.uid,
          userName: user?.displayName ?? "",
          userEmail: user?.email ?? "",
        }),
      );
    }

    qtyById.forEach((qty, productId) => {
      txn.update(
        doc(db, "products", productId),
        isRestock
          ? { totalQty: increment(qty), onhandQty: increment(qty) }
          : { onhandQty: increment(qty) },
      );
    });

    const fields = {
      source: values.source,
      handledBy,
      dateTime: values.dateTime,
      items: values.items,
      status: "Closed" as InboundStatus,
    };
    if (newRecord) {
      txn.set(inboundRef, {
        referenceNo,
        ...newRecord,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else {
      txn.update(inboundRef, fields);
    }
    return { id: inboundRef.id, referenceNo };
  });

  for (const item of values.items) {
    await logAction(user, {
      action: `${isRestock ? "Restocked" : "Returned"} ${item.productName}`,
      entity: "product",
      entityId: item.productId,
      entityName: item.productName,
      details: {
        qty: item.quantity,
        source: values.source,
        by: handledBy,
        reference: saved.referenceNo,
      },
    });
  }
  await logAction(user, {
    action: `Added ${saved.referenceNo}`,
    entity: "inbound",
    entityId: saved.id,
    entityName: saved.referenceNo,
  });
}
