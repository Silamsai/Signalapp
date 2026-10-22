import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` and `next build` get separate output folders, so running a
  // production build never overwrites the files the running dev server serves
  // (which made changes appear only after restarting the dev server).
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
