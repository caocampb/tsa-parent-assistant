"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XIcon, FileTextIcon, ClockIcon } from "lucide-react";
import { useEffect } from "react";

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: {
    title: string;
    content?: string;
    pageNumber?: number;
    timestamp?: string;
  };
}

export function DocumentModal({ isOpen, onClose, source }: DocumentModalProps) {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-background border rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{source.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            
            {/* Metadata */}
            {(source.pageNumber || source.timestamp) && (
              <div className="px-6 py-3 bg-muted/50 border-b">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {source.pageNumber && (
                    <span>Page {source.pageNumber}</span>
                  )}
                  {source.timestamp && (
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      <span>{source.timestamp}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="prose prose-sm max-w-none">
                {source.content || (
                  <p className="text-muted-foreground italic">
                    Document preview will be available when the full system is implemented.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
