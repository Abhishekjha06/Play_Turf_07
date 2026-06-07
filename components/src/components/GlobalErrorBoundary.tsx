import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// MON-2: Error Boundary for robust logging and crash protection
function reportToMonitoring(error: Error, info: ErrorInfo) {
    if (!import.meta.env.DEV) {
        // e.g. Sentry.captureException(error, { extra: info });
        console.log("[MONITORING] Captured Error for tracking:", error.message);
    }
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[GlobalErrorBoundary]", error, errorInfo);
        reportToMonitoring(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
                    <div className="text-center space-y-4">
                        <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
                        <p className="text-sm text-gray-400">
                            The dashboard encountered an error. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
                        >
                            Refresh Dashboard
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
