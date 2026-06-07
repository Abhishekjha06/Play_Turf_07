import React from 'react';
import { useNetwork } from '@/hooks/useNetwork';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = useNetwork();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground text-xs font-semibold py-2 px-4 flex justify-center items-center gap-2 shadow-lg"
        >
          <WifiOff className="w-4 h-4" />
          You are currently offline. Some features may not work.
        </motion.div>
      )}
    </AnimatePresence>
  );
};
