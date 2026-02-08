import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminServer";

type DeleteUserRequest = {
  uid?: string;
};

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json()) as DeleteUserRequest;
  if (!body.uid) {
    return NextResponse.json({ error: "Missing uid." }, { status: 400 });
  }

  const userDoc = await adminDb.collection("users").doc(body.uid).get();
  const targetType = userDoc.data()?.userType;
  if (targetType === "admin") {
    const adminsSnapshot = await adminDb
      .collection("users")
      .where("userType", "==", "admin")
      .get();
    if (adminsSnapshot.size <= 1) {
      return NextResponse.json(
        { error: "At least one admin account must remain." },
        { status: 400 },
      );
    }
  }

  await adminAuth.deleteUser(body.uid);
  await adminDb.collection("users").doc(body.uid).delete();

  return NextResponse.json({ ok: true });
}
