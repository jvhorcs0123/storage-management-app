"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type ProductRow = {
  id: string;
  product: string;
  category: string;
  onhandQty: number;
  unitPrice: number;
};

type DeliveryRow = {
  id: string;
  status: string;
  drDate: string;
  drNo: string;
  customerName: string;
};

type LogRow = {
  id: string;
  action: string;
  userName: string;
  createdAt?: { toDate: () => Date };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [userType, setUserType] = useState<"admin" | "employee">("employee");
  const [showAllActivity, setShowAllActivity] = useState(false);

  const lowStockThreshold = 10;
  const monthKey = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      const data = snapshot.data() as { userType?: "admin" | "employee" };
      setUserType(data?.userType ?? "employee");
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const productsRef = collection(db, "products");
    const deliveriesRef = collection(db, "deliveries");

    const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<ProductRow, "id">;
        return { id: docSnap.id, ...data };
      });
      setProducts(rows);
    });

    const unsubscribeDeliveries = onSnapshot(deliveriesRef, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<DeliveryRow, "id">;
        return { id: docSnap.id, ...data };
      });
      setDeliveries(rows);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeDeliveries();
    };
  }, [user]);

  useEffect(() => {
    if (!user || userType !== "admin") {
      setLogs([]);
      return;
    }
    const logsRef = collection(db, "userLogs");
    const logsQuery = query(logsRef, orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<LogRow, "id">;
        return { id: docSnap.id, ...data };
      });
      setLogs(rows);
    });
    return () => unsubscribe();
  }, [user, userType]);

  const totalProducts = products.length;
  const lowStockCount = products.filter(
    (row) => (row.onhandQty ?? 0) <= lowStockThreshold,
  ).length;
  const openDeliveries = deliveries.filter((row) => row.status === "Open")
    .length;
  const closedThisMonth = deliveries.filter(
    (row) => row.status === "Closed" && row.drDate?.startsWith(monthKey),
  ).length;

  const inventoryValue = useMemo(
    () =>
      products.reduce(
        (acc, row) => acc + (row.onhandQty ?? 0) * (row.unitPrice ?? 0),
        0,
      ),
    [products],
  );

  const topProducts = useMemo(() => {
    return [...products]
      .map((row) => ({
        ...row,
        value: (row.onhandQty ?? 0) * (row.unitPrice ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [products]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((row) => {
      const current = map.get(row.category) ?? 0;
      map.set(row.category, current + (row.onhandQty ?? 0));
    });
    return Array.from(map.entries())
      .map(([category, qty]) => ({ category, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [products]);

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => b.drDate.localeCompare(a.drDate))
      .slice(0, 5);
  }, [deliveries]);

  const activityRows = useMemo(() => {
    if (showAllActivity) return logs;
    return logs.slice(0, 5);
  }, [logs, showAllActivity]);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Homepage / Dashboard
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Quick snapshot of inventory and deliveries.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading dashboard...
        </div>
      )}

      {!loading && !user ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Total Products
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {totalProducts}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Low Stock
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {lowStockCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Threshold: {lowStockThreshold} units
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Open Deliveries
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {openDeliveries}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Closed This Month
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {closedThisMonth}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Inventory Value
                  </h2>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(inventoryValue)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Based on onhand quantity x unit price.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Recent Deliveries
                </h2>
                <div className="mt-4 space-y-3">
                  {recentDeliveries.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No deliveries yet.
                    </p>
                  )}
                  {recentDeliveries.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {row.drNo}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.customerName} · {row.drDate}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          row.status === "Open"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Top Products (Onhand Value)
                </h2>
                <div className="mt-4 space-y-3">
                  {topProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No products yet.</p>
                  )}
                  {topProducts.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {row.product}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.category} · {row.onhandQty ?? 0} onhand
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">
                        {formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Category Breakdown
                </h2>
                <div className="mt-4 space-y-3">
                  {categoryBreakdown.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No categories yet.
                    </p>
                  )}
                  {categoryBreakdown.map((row) => (
                    <div
                      key={row.category}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      <span className="font-semibold text-slate-900">
                        {row.category}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {row.qty} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {userType === "admin" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Recent Activity
              </h2>
              <div className="mt-4 space-y-3">
                {logs.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No recent activity.
                  </p>
                )}
                {activityRows.map((row) => {
                  const created = row.createdAt?.toDate?.();
                  const time = created
                    ? created.toLocaleTimeString("en-PH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      <p className="font-semibold text-slate-900">
                        {row.action}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.userName || "User"} {time && `· ${time}`}
                      </p>
                    </div>
                  );
                })}
                {logs.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllActivity((prev) => !prev)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {showAllActivity ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
