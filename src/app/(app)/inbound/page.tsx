"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import TablePagination from "@/components/TablePagination";
import { logAction } from "@/lib/logs";
import { handledByLabel, type InboundDoc } from "@/lib/inbound";

type InboundRow = InboundDoc & { id: string };

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

const BoxIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M12 21v-9M4 7.5l8 4.5 8-4.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
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

const PdfIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M6 3h9l4 4v14H6V3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M9 11h6M9 15h6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
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

const EyeIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none">
    <path
      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
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

export default function InboundPage() {
  const { user, loading } = useAuth();
  const pageSize = 10;
  const [inbounds, setInbounds] = useState<InboundRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [requestedPage, setInboundPage] = useState(1);
  const [inboundShowAll, setInboundShowAll] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [selectedInbound, setSelectedInbound] = useState<InboundRow | null>(null);
  const [draftSelection, setSelectedDraftIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"All" | "Draft" | "Closed">(
    "All",
  );

  const filteredInbounds = useMemo(() => {
    if (statusFilter === "All") return inbounds;
    return inbounds.filter((row) => (row.status ?? "Closed") === statusFilter);
  }, [inbounds, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredInbounds.length / pageSize));
  const inboundPage = Math.min(requestedPage, pageCount);

  // Drafts can be finalized or deleted elsewhere; only keep live drafts selected.
  const selectedDraftIds = useMemo(
    () =>
      draftSelection.filter((id) =>
        inbounds.some(
          (row) => row.id === id && (row.status ?? "Closed") === "Draft",
        ),
      ),
    [draftSelection, inbounds],
  );

  const pagedInbounds = useMemo(() => {
    if (inboundShowAll) return filteredInbounds;
    const start = (inboundPage - 1) * pageSize;
    return filteredInbounds.slice(start, start + pageSize);
  }, [filteredInbounds, inboundPage, inboundShowAll]);

  const visibleDraftIds = useMemo(
    () =>
      pagedInbounds
        .filter((row) => (row.status ?? "Closed") === "Draft")
        .map((row) => row.id),
    [pagedInbounds],
  );
  const allDraftSelected =
    visibleDraftIds.length > 0 &&
    visibleDraftIds.every((id) => selectedDraftIds.includes(id));
  const someDraftSelected =
    visibleDraftIds.some((id) => selectedDraftIds.includes(id)) &&
    !allDraftSelected;

  useEffect(() => {
    if (!user) return;
    const inboundsRef = collection(db, "inbounds");
    const unsubscribe = onSnapshot(inboundsRef, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<InboundRow, "id">;
        return { id: docSnap.id, ...data };
      });
      rows.sort((a, b) => b.dateTime?.localeCompare(a.dateTime ?? "") ?? 0);
      setInbounds(rows);
    });
    return () => unsubscribe();
  }, [user]);

  const openProductsModal = (row: InboundRow) => {
    setSelectedInbound(row);
    setProductsModalOpen(true);
  };

  const toggleAllDrafts = () => {
    if (allDraftSelected) {
      setSelectedDraftIds((prev) => prev.filter((id) => !visibleDraftIds.includes(id)));
      return;
    }
    setSelectedDraftIds((prev) => Array.from(new Set([...prev, ...visibleDraftIds])));
  };

  const toggleDraft = (id: string) => {
    setSelectedDraftIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const deleteDrafts = async () => {
    if (!selectedDraftIds.length) return;
    for (const id of selectedDraftIds) {
      await deleteDoc(doc(db, "inbounds", id));
      await logAction(user, {
        action: "Deleted draft inbound",
        entity: "inbound",
        entityId: id,
      });
    }
    setSelectedDraftIds([]);
    setConfirmDeleteOpen(false);
  };

  const handleInboundPdf = (row: InboundRow) => {
    const docPdf = new jsPDF({ orientation: "portrait" });
    const now = new Date();
    docPdf.setFontSize(14);
    docPdf.text(`Inbound - ${row.referenceNo}`, 14, 18);
    docPdf.setFontSize(10);
    docPdf.text(
      `Generated: ${now.toLocaleDateString("en-PH")} ${now.toLocaleTimeString("en-PH")}`,
      14,
      26,
    );
    docPdf.text(`Status: ${row.status ?? "Closed"}`, 14, 32);
    docPdf.text(`Source: ${row.source}`, 14, 38);
    docPdf.text(`${handledByLabel(row.source)}: ${row.handledBy}`, 14, 44);
    docPdf.text(`Date & Time: ${row.dateTime?.replace("T", " ")}`, 14, 50);

    const rows = (row.items ?? []).map((item) => [
      item.productName,
      item.category,
      item.sku || "-",
      item.unit,
      String(item.quantity),
    ]);

    autoTable(docPdf, {
      startY: 58,
      head: [["Product", "Category", "SKU", "UoM", "Quantity"]],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    const blob = docPdf.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
          Please sign in to view inbound records.
        </div>
      )}
      {!loading && !user ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Inbound
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Manage Inbound
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as "All" | "Draft" | "Closed");
                    setInboundPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                >
                  <option value="All">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>
              <Link
                href="/inbound/new"
                className="inline-flex items-baseline gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                <span className="relative top-[1px] inline-flex">{PlusIcon}</span>
                New Inbound
              </Link>
              {selectedDraftIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  <span className="inline-flex">{TrashIcon}</span>
                  Delete Drafts
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={allDraftSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = Boolean(someDraftSelected);
                        }}
                        onChange={toggleAllDrafts}
                        aria-label="Select all drafts"
                      />
                    </th>
                    <th className="px-4 py-3">Reference No.</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Restocked/Returned By</th>
                    <th className="hidden px-4 py-3 md:table-cell">Items</th>
                    <th className="hidden px-4 py-3 md:table-cell">Date & Time</th>
                    <th className="hidden px-4 py-3 md:table-cell">Status</th>
                    <th className="hidden px-4 py-3 md:table-cell">Products</th>
                    <th className="hidden px-4 py-3 md:table-cell">Actions</th>
                    <th className="px-4 py-3 pr-6 text-right md:hidden">More</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInbounds.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No inbound records found.
                      </td>
                    </tr>
                  )}
                  {pagedInbounds.map((row) => {
                    const status = row.status ?? "Closed";
                    return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            disabled={status !== "Draft"}
                            checked={selectedDraftIds.includes(row.id)}
                            onChange={() => toggleDraft(row.id)}
                            aria-label={`Select ${row.referenceNo}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.referenceNo}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.source}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.handledBy}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {row.items?.length ?? 0}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {row.dateTime?.replace("T", " ")}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              status === "Draft"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <button
                            type="button"
                            onClick={() => openProductsModal(row)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
                          >
                            <span className="inline-flex">{BoxIcon}</span>
                            View Products
                          </button>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          {status === "Draft" ? (
                            <Link
                              href={`/inbound/${row.id}/edit`}
                              className={iconButton}
                              aria-label="Edit inbound"
                              title="Edit"
                            >
                              {EditIcon}
                            </Link>
                          ) : (
                            <Link
                              href={`/inbound/${row.id}`}
                              className={iconButton}
                              aria-label="View inbound"
                              title="View"
                            >
                              {EyeIcon}
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => handleInboundPdf(row)}
                            className={`${iconButton} ml-2`}
                            aria-label="Save inbound as PDF"
                            title="Save PDF"
                          >
                            {PdfIcon}
                          </button>
                        </td>
                        <td className="px-4 py-3 pr-6 text-right md:hidden">
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
                          <td colSpan={10} className="px-4 pb-4">
                            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Items
                                </span>
                                <span>{row.items?.length ?? 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Date & Time
                                </span>
                                <span className="text-right">
                                  {row.dateTime?.replace("T", " ")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Status
                                </span>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    status === "Draft"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                  Products
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openProductsModal(row)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
                                >
                                  <span className="inline-flex">{BoxIcon}</span>
                                  View Products
                                </button>
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                {status === "Draft" ? (
                                  <Link
                                    href={`/inbound/${row.id}/edit`}
                                    className={iconButton}
                                    aria-label="Edit inbound"
                                    title="Edit"
                                  >
                                    {EditIcon}
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/inbound/${row.id}`}
                                    className={iconButton}
                                    aria-label="View inbound"
                                    title="View"
                                  >
                                    {EyeIcon}
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleInboundPdf(row)}
                                  className={iconButton}
                                  aria-label="Save inbound as PDF"
                                  title="Save PDF"
                                >
                                  {PdfIcon}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination
            total={filteredInbounds.length}
            page={inboundPage}
            pageSize={pageSize}
            showAll={inboundShowAll}
            onPageChange={setInboundPage}
            onToggleShowAll={() => setInboundShowAll((prev) => !prev)}
          />

          <Modal
            title={`Inbound Products${selectedInbound ? ` - ${selectedInbound.referenceNo}` : ""}`}
            open={productsModalOpen}
            onClose={() => setProductsModalOpen(false)}
          >
            {selectedInbound?.items?.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">UoM</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInbound.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-700">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.sku}</td>
                        <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No products recorded.</p>
            )}
          </Modal>

          <Modal
            title="Delete Drafts"
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
          >
            <div className="space-y-4 text-sm text-slate-700">
              <p>
                Delete {selectedDraftIds.length} selected draft
                {selectedDraftIds.length === 1 ? "" : "s"}? This action cannot be
                undone.
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
                  onClick={deleteDrafts}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <span className="inline-flex">{TrashIcon}</span>
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </section>
  );
}
