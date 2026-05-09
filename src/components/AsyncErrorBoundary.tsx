import React, { useState, useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
}

export function AsyncErrorBoundary({ children }: AsyncErrorBoundaryProps) {
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      
      // Convert promise rejection to Error if it's not already
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      setAsyncError(error);
    };

    // Handle global errors
    const handleError = (event: ErrorEvent) => {
      console.error("Global error:", event.error);
      setAsyncError(event.error || new Error(event.message));
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  // If we caught an async error, throw it to be caught by ErrorBoundary
  if (asyncError) {
    throw asyncError;
  }

  return (
    <ErrorBoundary level="app">
      {children}
    </ErrorBoundary>
  );
}