"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine);

    // Event listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-16 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2"
        >
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm">
            <WifiOffIcon className="h-4 w-4" />
            <span>You're offline. Some features may not work.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
