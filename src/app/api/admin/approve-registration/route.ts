import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminServer";

type ApproveRequest = {
  requestId?: string;
};

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json()) as ApproveRequest;
  if (!body.requestId) {
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });
  }

  const requestRef = adminDb.collection("registrationRequests").doc(body.requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const data = requestSnap.data() as {
    fullName?: string;
    email?: string;
    userType?: string;
    uid?: string;
  };

  const targetUid = data.uid ?? requestSnap.id;
  if (!data.email || !targetUid) {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }

  await adminAuth.updateUser(targetUid, {
    disabled: false,
    displayName: data.fullName ?? "",
  });

  await adminDb.collection("users").doc(targetUid).set(
    {
      displayName: data.fullName ?? "",
      email: data.email,
      userType: data.userType ?? "employee",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await requestRef.delete();

  return NextResponse.json({ ok: true, uid: targetUid });
}
