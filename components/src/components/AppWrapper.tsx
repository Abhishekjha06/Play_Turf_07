import React, { useState, useEffect } from 'react';
import SplashScreen from './SplashScreen';
import App from '../../App';

const AppWrapper: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        // Set a timeout to hide the splash screen after 3.5 seconds (slightly longer than animation)
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
            {!showSplash && <App />}
        </>
    );
};

export default AppWrapper;