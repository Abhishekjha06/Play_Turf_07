import { createRoot } from "react-dom/client";
import AppWrapper from "./src/components/AppWrapper";
import "./index.css";

// MON-1: Core Web Vitals tracking
import { onCLS, onINP, onLCP } from "web-vitals";

function sendToAnalytics(metric: { name: string; value: number; id: string }) {
    // In production, send to your analytics endpoint
    if (import.meta.env.DEV) {
        console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.id})`);
    }
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);

createRoot(document.getElementById("root")!).render(<AppWrapper />);
