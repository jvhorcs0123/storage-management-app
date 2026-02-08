"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { logAction } from "@/lib/logs";

type CustomerRow = {
  id: string;
  name: string;
  address: string;
  contactNo: string;
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

const ArrowLeftIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M10 6 4 12l6 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 12h16"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
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

const TrashIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(
    null,
  );
  const [formState, setFormState] = useState({
    name: "",
    address: "",
    contactNo: "",
  });
  const [error, setError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const allSelected =
    customers.length > 0 && selectedIds.length === customers.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (!user) return;
    const customersRef = collection(db, "customers");
    const unsubscribe = onSnapshot(customersRef, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CustomerRow, "id">),
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(rows);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = Boolean(someSelected);
    }
  }, [someSelected]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(customers.map((row) => row.id));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const openNewCustomer = () => {
    setError(null);
    setEditingCustomer(null);
    setFormState({ name: "", address: "", contactNo: "" });
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (customer: CustomerRow) => {
    setError(null);
    setEditingCustomer(customer);
    setFormState({
      name: customer.name,
      address: customer.address,
      contactNo: customer.contactNo,
    });
    setCustomerModalOpen(true);
  };

  const saveCustomer = async () => {
    setError(null);
    const name = formState.name.trim();
    const address = formState.address.trim();
    const contactNo = formState.contactNo.trim();
    if (!name || !address || !contactNo) {
      setError("Customer, address, and contact number are required.");
      return;
    }
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, "customers", editingCustomer.id), {
          name,
          address,
          contactNo,
        });
        await logAction(user, {
          action: `Edited ${name}`,
          entity: "customer",
          entityId: editingCustomer.id,
          entityName: name,
        });
      } else {
        const created = await addDoc(collection(db, "customers"), {
          name,
          address,
          contactNo,
        });
        await logAction(user, {
          action: `Added ${name}`,
          entity: "customer",
          entityId: created.id,
          entityName: name,
        });
      }
      setCustomerModalOpen(false);
      setEditingCustomer(null);
    } catch {
      setError("Unable to save customer. Please try again.");
    }
  };

  const deleteSelectedCustomers = async () => {
    if (!selectedIds.length) return;
    const batch = writeBatch(db);
    const namesById = new Map(customers.map((row) => [row.id, row.name]));
    selectedIds.forEach((id) => batch.delete(doc(db, "customers", id)));
    await batch.commit();
    for (const id of selectedIds) {
      await logAction(user, {
        action: `Deleted ${namesById.get(id) ?? "Customer"}`,
        entity: "customer",
        entityId: id,
        entityName: namesById.get(id),
      });
    }
    setSelectedIds([]);
    setConfirmDeleteOpen(false);
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
          Please sign in to view customers.
        </div>
      )}
      {!loading && !user ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Customers
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Customer List
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNewCustomer}
                className="inline-flex items-baseline gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                <span className="relative top-[1px] inline-flex">{PlusIcon}</span>
                New Customer
              </button>
              <Link
                href="/deliveries"
                className="inline-flex items-baseline gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                <span className="relative top-[1px] inline-flex">{ArrowLeftIcon}</span>
                Return to Deliveries
              </Link>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-slate-600">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500"
              >
                <span className="inline-flex">{TrashIcon}</span>
                Delete
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="w-full">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4"
                        checked={Boolean(allSelected)}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="hidden px-4 py-3 md:table-cell">Address</th>
                    <th className="hidden px-4 py-3 md:table-cell">
                      Contact No.
                    </th>
                    <th className="hidden px-4 py-3 md:table-cell">Actions</th>
                    <th className="px-4 py-3 text-right md:hidden">More</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No customers yet.
                      </td>
                    </tr>
                  )}
                  {customers.map((customer) => (
                    <>
                      <tr
                        key={customer.id}
                        className={`transition hover:bg-slate-50 ${
                          selectedIds.includes(customer.id)
                            ? "bg-slate-50 ring-1 ring-inset ring-slate-200"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selectedIds.includes(customer.id)}
                            onChange={() => toggleOne(customer.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {customer.name}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {customer.address}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {customer.contactNo}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <button
                            type="button"
                            onClick={() => openEditCustomer(customer)}
                            className={iconButton}
                            aria-label="Edit customer"
                            title="Edit"
                          >
                            {EditIcon}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right md:hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [customer.id]: !prev[customer.id],
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                          >
                            {expandedRows[customer.id] ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {expandedRows[customer.id] && (
                        <tr className="md:hidden">
                          <td colSpan={6} className="px-4 pb-4">
                            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Address
                                </span>
                                <span className="text-right">
                                  {customer.address}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Contact
                                </span>
                                <span>{customer.contactNo}</span>
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => openEditCustomer(customer)}
                                  className={iconButton}
                                  aria-label="Edit customer"
                                  title="Edit"
                                >
                                  {EditIcon}
                                </button>
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

          {customerModalOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4 md:items-center md:p-6">
              <div className="w-[calc(100%-0.75rem)] max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-6 md:max-h-[90vh] md:overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {editingCustomer ? "Edit Customer" : "New Customer"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCustomerModalOpen(false)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>
                <form
                  className="space-y-4 pt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveCustomer();
                  }}
                >
                  <label className="block text-sm font-medium text-slate-700">
                    Customer
                    <input
                      type="text"
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
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
                      value={formState.address}
                      onChange={(event) =>
                        setFormState((prev) => ({
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
                      value={formState.contactNo}
                      onChange={(event) =>
                        setFormState((prev) => ({
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
              </div>
            </div>
          )}

          {confirmDeleteOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4 md:items-center md:p-6">
              <div className="w-[calc(100%-0.75rem)] max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-6 md:max-h-[90vh] md:overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Confirm Delete
                  </h3>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4 pt-5 text-sm text-slate-700">
                  <p>
                    Delete {selectedIds.length} selected{" "}
                    {selectedIds.length === 1 ? "customer" : "customers"}? This
                    action cannot be undone.
                  </p>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedCustomers}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <span className="inline-flex">{TrashIcon}</span>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
