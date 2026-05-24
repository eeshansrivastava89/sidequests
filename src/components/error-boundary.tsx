import React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}