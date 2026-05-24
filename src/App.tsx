import { Toaster } from "sonner";
import { DashboardPage } from "./page";
import { ErrorBoundary } from "./components/error-boundary";
import "./styles/globals.css";

export function App() {
  return (
    <>
      <ErrorBoundary>
        <DashboardPage />
      </ErrorBoundary>
      <Toaster position="bottom-right" duration={1500} />
    </>
  );
}