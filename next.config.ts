import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

const stagingEnvPath = path.join(process.cwd(), ".env.staging");

if (fs.existsSync(stagingEnvPath)) {
  const content = fs.readFileSync(stagingEnvPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
    if (key.startsWith("NEXT_PUBLIC_FIREBASE_") || key.startsWith("FIREBASE_STAGING_")) {
      process.env[key] = unquoted;
    }
  });
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
