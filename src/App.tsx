"use client";

import { Toaster } from "sonner";
import { DashboardPage } from "./app/page";
import "./app/globals.css";

export function App() {
  return (
    <>
      <DashboardPage />
      <Toaster position="bottom-right" duration={1500} />
    </>
  );
}