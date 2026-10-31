import { useSeo } from "@/hooks/use-seo";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { MobileShell } from "@/layout/MobileShell";

const NotFound = () => {
  useSeo({ title: "Page Not Found", description: "This page does not exist.", path: "/404", noindex: true });

  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <MobileShell>
      <div className="flex min-h-[80dvh] items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </MobileShell>
  );
};

export default NotFound;
