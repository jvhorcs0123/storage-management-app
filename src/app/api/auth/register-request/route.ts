import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type RegisterRequest = {
  fullName?: string;
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterRequest;
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  let userRecord;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
    if (!userRecord.disabled) {
      return NextResponse.json(
        { error: "Email already exists." },
        { status: 409 },
      );
    }
  } catch {
    userRecord = null;
  }

  if (userRecord) {
    return NextResponse.json(
      { error: "Registration request already exists." },
      { status: 409 },
    );
  }

  const newUser = await adminAuth.createUser({
    email,
    password,
    displayName: fullName,
    disabled: true,
  });

  await adminDb.collection("registrationRequests").doc(newUser.uid).set({
    uid: newUser.uid,
    fullName,
    email,
    status: "pending",
    userType: "employee",
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
