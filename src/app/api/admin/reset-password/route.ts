import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminServer";

type ResetPasswordRequest = {
  uid?: string;
};

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json()) as ResetPasswordRequest;
  if (!body.uid) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  await adminAuth.updateUser(body.uid, { password: "qweQWE123!@#" });

  return NextResponse.json({ ok: true });
}
