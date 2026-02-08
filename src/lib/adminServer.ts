import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return { error: "Missing authorization token.", status: 401 as const };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const userType = userDoc.data()?.userType;
    if (userType !== "admin") {
      return { error: "Admin access required.", status: 403 as const };
    }
    return { uid: decoded.uid };
  } catch {
    return { error: "Invalid token.", status: 401 as const };
  }
}
