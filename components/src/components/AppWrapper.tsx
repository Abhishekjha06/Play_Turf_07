import React, { useState, useEffect } from 'react';
import SplashScreen from './SplashScreen';
import App from '../../App';
import { OfflineIndicator } from '@/ui/OfflineIndicator';
import { FeedbackModal } from '@/ui/FeedbackModal';
import { MessageSquarePlus } from 'lucide-react';

const AppWrapper: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    useEffect(() => {
        // Set a timeout to hide the splash screen after 3.5 seconds (slightly longer than animation)
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <OfflineIndicator />
            {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
            {!showSplash && <App />}
            
            {/* Global Feedback Trigger */}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-neon transition-transform hover:scale-105 active:scale-95 md:bottom-6"
              aria-label="Send Feedback"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </>
    );
};

export default AppWrapper;