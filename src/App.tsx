
import { Toaster } from "sonner";
import { DashboardPage } from "./page";
import "./styles/globals.css";

export function App() {
  return (
    <>
      <DashboardPage />
      <Toaster position="bottom-right" duration={1500} />
    </>
  );
}