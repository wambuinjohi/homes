import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  name?: string;
  fallback?: React.ReactNode;
}

export function ComponentErrorBoundary({ 
  children, 
  name, 
  fallback 
}: ComponentErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log component-specific error information
    console.error(`Component Error${name ? ` (${name})` : ""}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentName: name,
      timestamp: new Date().toISOString(),
    });

    // In production, report to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: Send to error tracking service with component context
      // reportComponentError(error, errorInfo, name);
    }
  };

  return (
    <ErrorBoundary 
      level="component" 
      onError={handleError}
      fallback={fallback}
    >
      {children}
    </ErrorBoundary>
  );
}