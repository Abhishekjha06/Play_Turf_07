import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface AdminRouteProps {
    children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { user } = useAuth();

    if (!user) {
        // User not authenticated, redirect to login
        return <Navigate to="/more" replace />;
    }

    if (user.role !== "admin") {
        // User is not an admin, show access denied
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">
                        You don't have permission to access the admin panel.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // User is an admin, allow access
    return <>{children}</>;
}