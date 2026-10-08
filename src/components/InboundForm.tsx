"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { logAction } from "@/lib/logs";
import {
  finalizeInbound,
  handledByLabel,
  inboundSources,
  saveInboundDraft,
  type InboundFormValues,
  type InboundItem,
  type InboundSource,
} from "@/lib/inbound";

type ProductRow = {
  id: string;
  category: string;
  product: string;
  sku?: string;
  unit: string;
  totalQty: number;
  onhandQty: number;
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

const clampQtyInput = (value: string) => {
  if (!value.trim()) return "";
  const next = Math.floor(Number(value));
  if (Number.isNaN(next)) return "";
  return String(Math.max(0, next));
};

export default function InboundForm({
  title,
  initialValues,
  existingId,
}: {
  title: string;
  initialValues: InboundFormValues;
  existingId?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [items, setItems] = useState<InboundItem[]>(initialValues.items);
  const [source, setSource] = useState<InboundSource>(initialValues.source);
  const [handledBy, setHandledBy] = useState(initialValues.handledBy);
  const [dateTime, setDateTime] = useState(initialValues.dateTime);
  const referenceNo = initialValues.referenceNo;
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showSaveHelp, setShowSaveHelp] = useState(false);
  const [showQtyHelp, setShowQtyHelp] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadProducts = async () => {
      const productSnap = await getDocs(collection(db, "products"));
      const productRows = productSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ProductRow, "id">),
      }));
      productRows.sort((a, b) => a.product.localeCompare(b.product));
      setProducts(productRows);
    };
    loadProducts();
  }, [user]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === itemProductId),
    [itemProductId, products],
  );

  const openAddItem = () => {
    setEditingItemId(null);
    setItemProductId("");
    setItemQuantity("");
    setItemError(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: InboundItem) => {
    setEditingItemId(item.id);
    setItemProductId(item.productId);
    setItemQuantity(String(item.quantity));
    setItemError(null);
    setItemModalOpen(true);
  };

  const saveItem = () => {
    setItemError(null);
    if (!selectedProduct) {
      setItemError("Please select a product.");
      return;
    }
    const qty = Number(itemQuantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      setItemError("Quantity must be a positive integer.");
      return;
    }

    const nextItem: InboundItem = {
      id: editingItemId ?? crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.product,
      category: selectedProduct.category,
      sku: selectedProduct.sku ?? "",
      unit: selectedProduct.unit,
      quantity: qty,
    };

    setItems((prev) => {
      if (editingItemId) {
        return prev.map((item) => (item.id === editingItemId ? nextItem : item));
      }
      return [...prev, nextItem];
    });
    logAction(user, {
      action: `${editingItemId ? "Edited" : "Added"} ${nextItem.productName}`,
      entity: "inboundItem",
      entityId: nextItem.productId,
      entityName: nextItem.productName,
    });
    setItemModalOpen(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed) {
        logAction(user, {
          action: `Deleted ${removed.productName}`,
          entity: "inboundItem",
          entityId: removed.productId,
          entityName: removed.productName,
        });
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const validateInboundForm = () => {
    setFormError(null);
    if (!referenceNo || !source || !handledBy.trim() || !dateTime) {
      setFormError(
        `Source, ${handledByLabel(source).toLowerCase()}, and date/time are required.`,
      );
      return false;
    }
    if (items.length === 0) {
      setFormError("Please add at least one item.");
      return false;
    }
    return true;
  };

  const saveInbound = async (finalize: boolean) => {
    if (!validateInboundForm() || saving) return;
    const values = { referenceNo, source, handledBy, dateTime, items };
    setSaving(true);
    try {
      if (finalize) {
        await finalizeInbound(user, values, existingId);
      } else {
        await saveInboundDraft(user, values, existingId);
      }
      router.push("/inbound");
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? `Unable to save inbound: ${error.message}`
          : "Unable to save inbound. Please try again.",
      );
      setSaving(false);
    }
  };

  const requestFinalize = () => {
    if (!validateInboundForm()) return;
    setConfirmFinalizeOpen(true);
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Inbound
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Reference No.
          <input
            type="text"
            value={referenceNo}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Date & Time
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(event) => setDateTime(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="text-sm font-medium text-slate-700">
          <div className="flex items-center gap-2">
            <label htmlFor="inbound-source">Source</label>
            <button
              type="button"
              onClick={() => setShowQtyHelp((prev) => !prev)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:border-sky-300 hover:text-sky-800"
              aria-label="Explain how this affects quantities"
              aria-expanded={showQtyHelp}
              title="How this affects quantities"
            >
              ?
            </button>
          </div>
          <select
            id="inbound-source"
            value={source}
            onChange={(event) => setSource(event.target.value as InboundSource)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {inboundSources.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <label className="text-sm font-medium text-slate-700">
          {handledByLabel(source)}
          <input
            type="text"
            value={handledBy}
            onChange={(event) => setHandledBy(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {showQtyHelp && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 md:col-span-2">
            <p className="font-semibold">How this affects quantities</p>
            <p className="mt-1">
              Restock increases both Onhand and Total quantities.
            </p>
            <p>Returns increase Onhand only (Total stays the same).</p>
          </div>
        )}
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
                <th className="hidden px-4 py-3 md:table-cell">SKU</th>
                <th className="hidden px-4 py-3 md:table-cell">Quantity</th>
                <th className="hidden px-4 py-3 md:table-cell">UoM</th>
                <th className="hidden px-4 py-3 md:table-cell">Actions</th>
                <th className="px-4 py-3 text-right md:hidden">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No items yet.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{item.category}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.productName}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                      {item.sku}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {item.quantity}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {item.unit}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => openEditItem(item)}
                        aria-label="Edit item"
                        title="Edit"
                      >
                        {EditIcon}
                      </button>
                      <button
                        type="button"
                        className={`${iconButton} ml-2`}
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove item"
                        title="Remove"
                      >
                        {TrashIcon}
                      </button>
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
                      <td colSpan={7} className="px-4 pb-4">
                        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                              SKU
                            </span>
                            <span>{item.sku || "-"}</span>
                          </div>
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
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              className={iconButton}
                              onClick={() => openEditItem(item)}
                              aria-label="Edit item"
                              title="Edit"
                            >
                              {EditIcon}
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              onClick={() => removeItem(item.id)}
                              aria-label="Remove item"
                              title="Remove"
                            >
                              {TrashIcon}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={openAddItem}
          className="inline-flex items-baseline gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
        >
          <span className="relative top-[1px] inline-flex">{PlusIcon}</span>
          Add Item
        </button>
        <button
          type="button"
          onClick={() => saveInbound(false)}
          disabled={saving}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={requestFinalize}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setShowSaveHelp((prev) => !prev)}
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:border-sky-300 hover:text-sky-800"
          aria-label="Explain save options"
          title="Explain save options"
        >
          ?
        </button>
        <button
          type="button"
          onClick={() => router.push("/inbound")}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
      </div>
      {showSaveHelp && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <p className="font-semibold text-sky-800">Save vs Save as Draft</p>
          <p className="mt-1">
            Save finalizes the inbound record, adds the quantities to every
            product listed, and locks it from further edits.
          </p>
          <p className="mt-1">
            Save as Draft keeps it editable and does not affect stock or
            transaction history until you save it.
          </p>
        </div>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4 md:items-center md:p-6">
          <div className="w-[calc(100%-0.75rem)] max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-6 md:max-h-[90vh] md:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingItemId ? "Edit Item" : "Add Item"}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <form
              className="space-y-4 pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveItem();
              }}
            >
              <label className="block text-sm font-medium text-slate-700">
                Product
                <select
                  value={itemProductId}
                  onChange={(event) => setItemProductId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Category
                  <input
                    type="text"
                    readOnly
                    value={selectedProduct?.category ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Pack (UoM)
                  <input
                    type="text"
                    readOnly
                    value={selectedProduct?.unit ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Quantity
                  <input
                    type="number"
                    value={itemQuantity}
                    onChange={(event) => setItemQuantity(clampQtyInput(event.target.value))}
                    min={0}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {selectedProduct && (
                <p className="text-xs text-slate-500">
                  Current Onhand: {selectedProduct.onhandQty} · Total:{" "}
                  {selectedProduct.totalQty}
                </p>
              )}
              {itemError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {itemError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
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

      {confirmFinalizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setConfirmFinalizeOpen(false)}
            aria-label="Close confirmation"
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
            <h2 className="text-lg font-semibold">Confirm Save</h2>
            <p className="mt-2 text-sm text-slate-600">
              If you confirm, this inbound will be finalized.{" "}
              {source === "Restock"
                ? "Onhand and Total quantities"
                : "Onhand quantities"}{" "}
              of {items.length} item{items.length === 1 ? "" : "s"} will be
              increased, transaction history will be created, and this record
              will be locked from further edits.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmFinalizeOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmFinalizeOpen(false);
                  await saveInbound(true);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm and Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
