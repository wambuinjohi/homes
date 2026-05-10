import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { useLocation } from "react-router-dom";

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  const location = useLocation();

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log page-specific error information
    console.error(`Page Error (${location.pathname}):`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      pathname: location.pathname,
      search: location.search,
      timestamp: new Date().toISOString(),
    });

    // In production, report to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: Send to error tracking service with page context
      // reportPageError(error, errorInfo, location);
    }
  };

  return (
    <ErrorBoundary level="page" onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}