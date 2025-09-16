"use client";

import { motion } from "framer-motion";

export function AnswerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Main answer skeleton */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <div className="h-6 w-3/4 bg-muted rounded-md animate-pulse" />
        <div className="h-6 w-full bg-muted rounded-md animate-pulse animation-delay-75" />
        <div className="h-6 w-5/6 bg-muted rounded-md animate-pulse animation-delay-150" />
        <div className="h-6 w-2/3 bg-muted rounded-md animate-pulse animation-delay-225" />
      </motion.div>

      {/* Sources skeleton */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="pt-6 space-y-3"
      >
        <div className="h-4 w-20 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-48 bg-muted rounded-md animate-pulse animation-delay-75" />
          <div className="h-4 w-56 bg-muted rounded-md animate-pulse animation-delay-150" />
        </div>
      </motion.div>

      {/* Related questions skeleton */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="pt-6 space-y-3"
      >
        <div className="h-4 w-32 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse animation-delay-75" />
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse animation-delay-150" />
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse animation-delay-225" />
        </div>
      </motion.div>
    </div>
  );
}
