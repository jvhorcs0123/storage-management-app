import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;

if (!credentialsJson) {
  throw new Error("Missing FIREBASE_ADMIN_CREDENTIALS environment variable.");
}

const credentials = JSON.parse(credentialsJson);

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(credentials),
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
