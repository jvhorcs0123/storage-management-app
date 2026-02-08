"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type DeliveryItem = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
};

type DeliveryDoc = {
  drNo: string;
  drDate: string;
  status: string;
  customerName: string;
  address: string;
  contactNo: string;
  items: DeliveryItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

export default function DeliveryViewPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [delivery, setDelivery] = useState<DeliveryDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const id = params?.id as string | undefined;
    if (!id) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "deliveries", id));
        if (!snap.exists()) {
          setError("Delivery record not found.");
          return;
        }
        setDelivery(snap.data() as DeliveryDoc);
      } catch {
        setError("Unable to load delivery record.");
      }
    };
    load();
  }, [params, user]);

  const subtotal = useMemo(
    () =>
      delivery?.items?.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ) ?? 0,
    [delivery],
  );

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
        Please sign in to view deliveries.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 shadow-sm">
        {error}
      </div>
    );
  }

  if (!delivery) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Deliveries
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">View DR</h1>
        </div>
        <span
          className={`text-sm font-semibold ${
            delivery.status === "Open"
              ? "text-emerald-600"
              : delivery.status === "Closed"
                ? "text-rose-600"
                : "text-slate-600"
          }`}
        >
          {delivery.status}
        </span>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          DR No.
          <input
            type="text"
            value={delivery.drNo}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Delivery Date
          <input
            type="text"
            value={delivery.drDate}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Customer Name
          <input
            type="text"
            value={delivery.customerName}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Address
          <input
            type="text"
            value={delivery.address}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Contact No.
          <input
            type="text"
            value={delivery.contactNo}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Items
          </h2>
        </div>
        <div className="w-full">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Product</th>
                <th className="hidden px-4 py-3 md:table-cell">Quantity</th>
                <th className="hidden px-4 py-3 md:table-cell">UoM</th>
                <th className="hidden px-4 py-3 md:table-cell">Price</th>
                <th className="px-4 py-3 text-right md:hidden">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delivery.items?.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No items.
                  </td>
                </tr>
              )}
              {delivery.items?.map((item) => (
                <>
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{item.category}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.productName}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {item.quantity}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {item.unit}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-700 md:table-cell">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-4 py-3 text-right md:hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedItems((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                      >
                        {expandedItems[item.id] ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedItems[item.id] && (
                    <tr className="md:hidden">
                      <td colSpan={6} className="px-4 pb-4">
                        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                              Quantity
                            </span>
                            <span>{item.quantity}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                              UoM
                            </span>
                            <span>{item.unit}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                              Price
                            </span>
                            <span>{formatCurrency(item.price)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
        Subtotal:&nbsp;{formatCurrency(subtotal)}
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/deliveries")}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Back to Deliveries
        </button>
      </div>
    </section>
  );
}
