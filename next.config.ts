import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@electric-sql/pglite",
    "unpdf",
    "mammoth",
    "xlsx",
    "pdf-lib",
    "docx",
  ],
};

export default nextConfig;
