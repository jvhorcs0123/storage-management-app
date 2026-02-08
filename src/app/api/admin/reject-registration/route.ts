import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminServer";

type RejectRequest = {
  requestId?: string;
};

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json()) as RejectRequest;
  if (!body.requestId) {
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });
  }

  const requestRef = adminDb.collection("registrationRequests").doc(body.requestId);
  const snapshot = await requestRef.get();
  const data = snapshot.data() as { uid?: string };
  const targetUid = data?.uid ?? body.requestId;

  await requestRef.delete();
  if (targetUid) {
    await adminAuth.deleteUser(targetUid);
  }

  return NextResponse.json({ ok: true });
}
