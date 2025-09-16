"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <motion.div 
      className="group flex w-full justify-start is-assistant"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-[80%] px-4 py-3 text-sm bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md">
        <div className="flex items-center gap-1.5">
          <motion.span
            animate={{ 
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: 0,
              ease: "easeInOut",
            }}
            className="w-2 h-2 bg-tsa-blue/60 rounded-full"
          />
          <motion.span
            animate={{ 
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: 0.2,
              ease: "easeInOut",
            }}
            className="w-2 h-2 bg-tsa-blue/60 rounded-full"
          />
          <motion.span
            animate={{ 
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: 0.4,
              ease: "easeInOut",
            }}
            className="w-2 h-2 bg-tsa-blue/60 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

// Alternative shimmer version like the template
export function TypingIndicatorShimmer() {
  return (
    <div className="group flex w-full justify-start is-assistant">
      <div className="max-w-[80%] px-4 py-3 text-sm bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md">
        <motion.div
          animate={{ backgroundPosition: ["100% 50%", "-100% 50%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
          className="text-transparent font-medium"
        >
          TSA Assistant is thinking...
        </motion.div>
      </div>
    </div>
  );
}
