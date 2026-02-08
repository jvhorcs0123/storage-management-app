import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

type LogParams = {
  action: string;
  entity: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, string | number | boolean | null>;
};

export async function logAction(user: User | null, params: LogParams) {
  if (!user) return;
  const payload = {
    ...params,
    userId: user.uid,
    userName: user.displayName ?? "",
    userEmail: user.email ?? "",
    createdAt: serverTimestamp(),
  };
  try {
    await addDoc(collection(db, "userLogs"), payload);
  } catch {
    // Best-effort logging; ignore failures.
  }
}
