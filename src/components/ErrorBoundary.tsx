import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorReporter } from "@/utils/errorReporting";
import { logger } from "@/utils/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: "app" | "page" | "component";
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Use production error reporting instead of console.error
    const errorId = errorReporter.reportError(error, {
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      errorBoundary: true
    });
    
    logger.error(`ErrorBoundary caught error (ID: ${errorId})`, error, {
      errorInfo,
      level: this.props.level
    });
    
    // Call the optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = "component" } = this.props;
      const { error } = this.state;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-destructive/20">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-destructive">
                {level === "app" && "Application Error"}
                {level === "page" && "Page Error"}
                {level === "component" && "Something went wrong"}
              </CardTitle>
              <CardDescription>
                {level === "app" && "The application encountered an unexpected error"}
                {level === "page" && "This page failed to load properly"}
                {level === "component" && "A component on this page encountered an error"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === "development" && error && (
                <Alert className="border-warning/20 bg-warning/5">
                  <Bug className="h-4 w-4 text-warning" />
                  <AlertDescription className="font-mono text-sm">
                    <strong>Error:</strong> {error.message}
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-warning hover:text-warning/80">
                          View stack trace
                        </summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {level === "component" && (
                  <Button
                    onClick={this.handleRetry}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}
                
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>

                {level !== "app" && (
                  <Button
                    onClick={this.handleGoHome}
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                If this problem persists, please contact support.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}