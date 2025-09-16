"use client";

import { SearchBox } from "@/components/search/search-box";
import { PopularQuestions } from "@/components/popular-questions";
import { AppHeader } from "@/components/app-header";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-tsa-blue/[0.02] via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-tsa-blue/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-muted/30 rounded-full blur-3xl pointer-events-none" />
      {/* Minimal header */}
      <AppHeader className="relative z-50" />

      {/* Main content - centered */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-5xl sm:text-6xl font-semibold tracking-tight mb-8"
          >
            Ask Texas Sports Academy
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="text-xl text-muted-foreground/80 leading-relaxed mb-12 max-w-2xl mx-auto"
          >
            Get instant answers about schedules, registration, policies, uniforms, and everything TSA parents need to know.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="mb-16"
          >
            <SearchBox 
              size="large"
              placeholder="Ask anything"
              autoFocus
              className="max-w-xl mx-auto"
              showHelperText={false}
              showAvatar={true}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-center">
              Popular Questions
            </h2>
            <PopularQuestions />
          </motion.div>
        </div>
      </main>
    </div>
  );
}