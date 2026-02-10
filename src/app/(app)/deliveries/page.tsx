"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import MultiSelect from "@/components/MultiSelect";
import TablePagination from "@/components/TablePagination";

type DeliveryRow = {
  id: string;
  status: string;
  drDate: string;
  drNo: string;
  customerName: string;
  address: string;
  contactNo: string;
};

type CustomerFormState = {
  name: string;
  address: string;
  contactNo: string;
};

const emptyCustomer: CustomerFormState = {
  name: "",
  address: "",
  contactNo: "",
};

const iconBase = "h-4 w-4";
const iconButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-400 hover:text-slate-900";

const PlusIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const UserIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M4 20a8 8 0 0 1 16 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const ListIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const EyeIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const EditIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M4 20h4l11-11-4-4L4 16v4Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4 md:items-center md:p-6">
      <div className="w-[calc(100%-0.75rem)] max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-6 md:max-h-[90vh] md:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
  const { user, loading } = useAuth();
  const pageSize = 10;
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(emptyCustomer);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [drDateFilter, setDrDateFilter] = useState<string[]>([]);
  const [drNoFilter, setDrNoFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryShowAll, setDeliveryShowAll] = useState(false);

  const hasActiveFilters =
    Boolean(statusFilter) ||
    drDateFilter.length > 0 ||
    drNoFilter.length > 0 ||
    customerFilter.length > 0;

  const drDateOptions = useMemo(
    () => Array.from(new Set(deliveries.map((row) => row.drDate))).sort(),
    [deliveries],
  );
  const drNoOptions = useMemo(
    () => Array.from(new Set(deliveries.map((row) => row.drNo))).sort(),
    [deliveries],
  );
  const customerOptions = useMemo(
    () => Array.from(new Set(deliveries.map((row) => row.customerName))).sort(),
    [deliveries],
  );

  const filteredDeliveries = useMemo(
    () =>
      deliveries.filter((row) => {
        const statusMatch = !statusFilter || row.status === statusFilter;
        const dateMatch =
          drDateFilter.length === 0 || drDateFilter.includes(row.drDate);
        const drNoMatch =
          drNoFilter.length === 0 || drNoFilter.includes(row.drNo);
        const customerMatch =
          customerFilter.length === 0 || customerFilter.includes(row.customerName);
        return statusMatch && dateMatch && drNoMatch && customerMatch;
      }),
    [deliveries, statusFilter, drDateFilter, drNoFilter, customerFilter],
  );

  const pagedDeliveries = useMemo(() => {
    if (deliveryShowAll) return filteredDeliveries;
    const start = (deliveryPage - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, deliveryPage, deliveryShowAll]);

  useEffect(() => {
    setDeliveryPage(1);
  }, [filteredDeliveries.length]);

  useEffect(() => {
    if (!user) return;
    const deliveriesRef = collection(db, "deliveries");
    const unsubscribe = onSnapshot(deliveriesRef, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<DeliveryRow, "id">;
        return { id: docSnap.id, ...data };
      });
      rows.sort((a, b) => b.drDate.localeCompare(a.drDate));
      setDeliveries(rows);
    });
    return () => unsubscribe();
  }, [user]);

  const saveCustomer = async () => {
    setError(null);
    const name = customerForm.name.trim();
    const address = customerForm.address.trim();
    const contactNo = customerForm.contactNo.trim();
    if (!name || !address || !contactNo) {
      setError("Customer, address, and contact number are required.");
      return;
    }
    await addDoc(collection(db, "customers"), {
      name,
      address,
      contactNo,
    });
    setCustomerForm(emptyCustomer);
    setCustomerModalOpen(false);
  };

  return (
    <section className="space-y-6">
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading...
        </div>
      )}
      {!loading && !user && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Please sign in to view deliveries.
        </div>
      )}
      {!loading && !user ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Deliveries
              </p>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Manage Deliveries
                </h1>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className="relative inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                  aria-label="Toggle filters"
                  title="Toggle filters"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                    <path
                      d="M4 6h16M7 12h10M10 18h4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/deliveries/new"
                className="inline-flex items-baseline gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                <span className="relative top-[1px] inline-flex">{PlusIcon}</span>
                New DR
              </Link>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(true)}
                className="inline-flex items-baseline gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                <span className="relative top-[1px] inline-flex">{UserIcon}</span>
                New Customer
              </button>
              <Link
                href="/customers"
                className="inline-flex items-baseline gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                <span className="relative top-[1px] inline-flex">{ListIcon}</span>
                Customer List
              </Link>
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
                >
                  <option value="">All</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>
              <MultiSelect
                label="DR Date"
                options={drDateOptions}
                values={drDateFilter}
                onChange={setDrDateFilter}
                placeholder="All dates"
              />
              <MultiSelect
                label="DR No."
                options={drNoOptions}
                values={drNoFilter}
                onChange={setDrNoFilter}
                placeholder="All DR numbers"
              />
              <MultiSelect
                label="Customer"
                options={customerOptions}
                values={customerFilter}
                onChange={setCustomerFilter}
                placeholder="All customers"
              />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="w-full">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">DR Date</th>
                    <th className="px-4 py-3">DR No.</th>
                    <th className="hidden px-4 py-3 md:table-cell">Customer</th>
                    <th className="hidden px-4 py-3 md:table-cell">Address</th>
                    <th className="hidden px-4 py-3 md:table-cell">Contact No.</th>
                    <th className="hidden px-4 py-3 md:table-cell">Actions</th>
                    <th className="px-4 py-3 text-right md:hidden">More</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeliveries.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No delivery records found.
                      </td>
                    </tr>
                  )}
                  {pagedDeliveries.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-slate-50">
                        <td
                          className={`px-4 py-3 font-semibold ${
                            row.status === "Open"
                              ? "text-emerald-600"
                              : row.status === "Closed"
                                ? "text-rose-600"
                                : "text-slate-600"
                          }`}
                        >
                          {row.status}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.drDate}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.drNo}</td>
                        <td className="hidden px-4 py-3 text-slate-700 md:table-cell">
                          {row.customerName}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {row.address}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {row.contactNo}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <Link
                            href={`/deliveries/${row.id}`}
                            className={iconButton}
                            aria-label="View delivery"
                            title="View"
                          >
                            {EyeIcon}
                          </Link>
                          {row.status !== "Closed" && (
                            <Link
                              href={`/deliveries/${row.id}/edit`}
                              className={`${iconButton} ml-2`}
                              aria-label="Edit delivery"
                              title="Edit"
                            >
                              {EditIcon}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right md:hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [row.id]: !prev[row.id],
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                          >
                            {expandedRows[row.id] ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {expandedRows[row.id] && (
                        <tr className="md:hidden">
                          <td colSpan={8} className="px-4 pb-4">
                            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Customer
                                </span>
                                <span>{row.customerName}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Address
                                </span>
                                <span className="text-right">{row.address}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Contact
                                </span>
                                <span>{row.contactNo}</span>
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                <Link
                                  href={`/deliveries/${row.id}`}
                                  className={iconButton}
                                  aria-label="View delivery"
                                  title="View"
                                >
                                  {EyeIcon}
                                </Link>
                                {row.status !== "Closed" && (
                                  <Link
                                    href={`/deliveries/${row.id}/edit`}
                                    className={iconButton}
                                    aria-label="Edit delivery"
                                    title="Edit"
                                  >
                                    {EditIcon}
                                  </Link>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination
            total={filteredDeliveries.length}
            page={deliveryPage}
            pageSize={pageSize}
            showAll={deliveryShowAll}
            onPageChange={setDeliveryPage}
            onToggleShowAll={() => setDeliveryShowAll((prev) => !prev)}
          />

          <Modal
            title="New Customer"
            open={customerModalOpen}
            onClose={() => {
              setCustomerModalOpen(false);
              setError(null);
            }}
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveCustomer();
              }}
            >
              <label className="block text-sm font-medium text-slate-700">
                Customer
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Address
                <input
                  type="text"
                  value={customerForm.address}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Contact No.
                <input
                  type="text"
                  value={customerForm.contactNo}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({
                      ...prev,
                      contactNo: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </section>
  );
}
