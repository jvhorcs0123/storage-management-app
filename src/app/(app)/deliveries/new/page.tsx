"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
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

type ProductRow = {
  id: string;
  category: string;
  product: string;
  unit: string;
  unitPrice: number;
  onhandQty: number;
};

type DeliveryItem = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

function generateDrNo(year: string, series: number) {
  const padded = String(series).padStart(4, "0");
  return `DR-ZK-${year}-${padded}`;
}

export default function NewDeliveryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [drNo, setDrNo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [address, setAddress] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const customerSnap = await getDocs(collection(db, "customers"));
      const productSnap = await getDocs(collection(db, "products"));
      const deliverySnap = await getDocs(collection(db, "deliveries"));

      const customerRows = customerSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CustomerRow, "id">),
      }));
      customerRows.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(customerRows);

      const productRows = productSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ProductRow, "id">),
      }));
      productRows.sort((a, b) => a.product.localeCompare(b.product));
      setProducts(productRows);

      const year = new Date().getFullYear().toString().slice(-2);
      let maxSeries = 0;
      deliverySnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as { drYear?: string; series?: number };
        if (data.drYear === year && typeof data.series === "number") {
          maxSeries = Math.max(maxSeries, data.series);
        }
      });
      setDrNo(generateDrNo(year, maxSeries + 1));
    };
    loadData();
  }, [user]);

  useEffect(() => {
    const selected = customers.find((customer) => customer.id === customerId);
    if (selected) {
      setAddress(selected.address);
      setContactNo(selected.contactNo);
    } else {
      setAddress("");
      setContactNo("");
    }
  }, [customerId, customers]);

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

  const openEditItem = (item: DeliveryItem) => {
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

    const existing = deliveryItems.find((item) => item.id === editingItemId);
    const available =
      selectedProduct.onhandQty + (existing?.quantity ?? 0);
    if (qty > available) {
      setItemError(
        `Quantity exceeds onhand (${selectedProduct.onhandQty}).`,
      );
      return;
    }

    const nextItem: DeliveryItem = {
      id: editingItemId ?? crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.product,
      category: selectedProduct.category,
      unit: selectedProduct.unit,
      price: selectedProduct.unitPrice,
      quantity: qty,
    };

    setDeliveryItems((prev) => {
      if (editingItemId) {
        return prev.map((item) => (item.id === editingItemId ? nextItem : item));
      }
      return [...prev, nextItem];
    });
    logAction(user, {
      action: `${editingItemId ? "Edited" : "Added"} ${nextItem.productName}`,
      entity: "deliveryItem",
      entityId: nextItem.productId,
      entityName: nextItem.productName,
    });
    setItemModalOpen(false);
  };

  const removeItem = (id: string) => {
    setDeliveryItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed) {
        logAction(user, {
          action: `Deleted ${removed.productName}`,
          entity: "deliveryItem",
          entityId: removed.productId,
          entityName: removed.productName,
        });
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const saveDelivery = async () => {
    setFormError(null);
    if (!drNo || !customerId || !deliveryDate) {
      setFormError("DR No., customer, and delivery date are required.");
      return;
    }
    if (deliveryItems.length === 0) {
      setFormError("Please add at least one item.");
      return;
    }

    const customer = customers.find((item) => item.id === customerId);
    if (!customer) {
      setFormError("Customer selection is invalid.");
      return;
    }

    const year = new Date().getFullYear().toString().slice(-2);
    const series = Number(drNo.split("-").pop());
    const batch = writeBatch(db);
    const deliveryRef = doc(collection(db, "deliveries"));

    deliveryItems.forEach((item) => {
      const product = products.find((row) => row.id === item.productId);
      if (!product) return;
      batch.update(doc(db, "products", product.id), {
        onhandQty: product.onhandQty - item.quantity,
      });
    });

    batch.set(deliveryRef, {
      drNo,
      drYear: year,
      series,
      drDate: deliveryDate,
      status: "Open",
      customerId: customer.id,
      customerName: customer.name,
      address: customer.address,
      contactNo: customer.contactNo,
      items: deliveryItems,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    await logAction(user, {
      action: `Added ${drNo}`,
      entity: "delivery",
      entityId: deliveryRef.id,
      entityName: drNo,
    });
    router.push("/deliveries");
  };

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
        Please sign in to create deliveries.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Deliveries
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">New DR</h1>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          DR No.
          <input
            type="text"
            value={drNo}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Delivery Date
          <input
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Customer Name
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Address
          <input
            type="text"
            value={address}
            readOnly
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Contact No.
          <input
            type="text"
            value={contactNo}
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
                <th className="hidden px-4 py-3 md:table-cell">Actions</th>
                <th className="px-4 py-3 text-right md:hidden">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveryItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No items yet.
                  </td>
                </tr>
              )}
              {deliveryItems.map((item) => (
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
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
        Subtotal:&nbsp;
        {formatCurrency(
          deliveryItems.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
          ),
        )}
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
          onClick={saveDelivery}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Save
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => router.push("/deliveries")}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
      </div>

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
                  Price
                  <input
                    type="text"
                    readOnly
                    value={
                      selectedProduct
                        ? formatCurrency(selectedProduct.unitPrice)
                        : ""
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Quantity
                  <input
                    type="number"
                    value={itemQuantity}
                    onChange={(event) => setItemQuantity(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {selectedProduct && (
                <p className="text-xs text-slate-500">
                  Onhand: {selectedProduct.onhandQty}
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
    </section>
  );
}
