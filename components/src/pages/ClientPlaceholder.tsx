/**
 * Placeholder page for client panel sub-pages not yet fully built.
 * Shows a "Coming Soon" message with a back button.
 */
import { useNavigate, useParams } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { Button } from "@/ui/button";
import { motion } from "framer-motion";
import { Construction, ArrowLeft } from "lucide-react";

const pageConfig: Record<string, { title: string; description: string }> = {
    photos: {
        title: "Photo Gallery",
        description: "Manage your turf photos and gallery. Upload new images, reorder, and set cover photos.",
    },
    pricing: {
        title: "Pricing Management",
        description: "Set and manage slot pricing, seasonal rates, and special offers for your turf.",
    },
    "turf/edit": {
        title: "Edit Turf Details",
        description: "Update your turf information including name, description, amenities, and contact details.",
    },
    rules: {
        title: "Turf Rules & Policies",
        description: "Manage booking rules, cancellation policies, and turf usage guidelines.",
    },
};

const ClientPlaceholder = () => {
    const navigate = useNavigate();
    // Extract the sub-path from the URL
    const path = window.location.pathname.replace("/client/", "");
    const config = pageConfig[path] || {
        title: "Page",
        description: "This section is under development.",
    };

    return (
        <MobileShell>
            <BackButton />
            <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-sm"
                >
                    <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
                        <Construction className="h-10 w-10 text-amber-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">{config.title}</h1>
                    <p className="text-gray-400 mb-8">{config.description}</p>
                    <div className="bg-gray-800/50 rounded-2xl p-4 mb-6 border border-gray-700">
                        <p className="text-sm text-gray-300">
                            🚧 This feature is coming soon. We're working hard to bring you the best experience.
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate("/client/dashboard")}
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </motion.div>
            </div>
        </MobileShell>
    );
};

export default ClientPlaceholder;
