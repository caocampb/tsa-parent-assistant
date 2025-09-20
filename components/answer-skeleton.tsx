"use client";

import { motion } from "framer-motion";

export function AnswerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Main answer skeleton - matches text-xl leading-[1.7] */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-xl leading-[1.7] mb-6"
      >
        <div className="h-[1.7em] w-3/4 bg-muted rounded animate-pulse mb-2" />
        <div className="h-[1.7em] w-full bg-muted rounded animate-pulse animation-delay-75 mb-2" />
        <div className="h-[1.7em] w-5/6 bg-muted rounded animate-pulse animation-delay-150 mb-2" />
        <div className="h-[1.7em] w-2/3 bg-muted rounded animate-pulse animation-delay-225" />
      </motion.div>

      {/* Action buttons skeleton */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2 mt-8 pt-6"
      >
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse animation-delay-75" />
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse animation-delay-150" />
      </motion.div>

            {/* Related questions skeleton removed - only shows after streaming is done */}
    </div>
  );
}
