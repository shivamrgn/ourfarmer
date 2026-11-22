import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-6 sm:p-8 shadow-lg text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {this.props.fallbackTitle || "Temporarily Unable to Load Module"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-lg mx-auto">
                An unexpected display issue occurred while rendering this module. Your farm data and settings remain safe.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 max-w-md mx-auto text-left overflow-auto max-h-24">
                  {this.state.error.message || "Unknown error"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleRetry}
                className="bg-[#0a2316] hover:bg-[#123824] text-white text-xs font-semibold px-4 h-9 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Module
              </Button>
              {this.props.onNavigateHome && (
                <Button
                  variant="outline"
                  onClick={this.props.onNavigateHome}
                  className="text-xs font-semibold border-gray-200 text-gray-700 dark:text-gray-300 h-9 px-4"
                >
                  <Home className="w-3.5 h-3.5 mr-1.5" />
                  Return to Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
