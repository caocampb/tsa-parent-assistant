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
      
      <AppHeader />
      
      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl space-y-8 text-center"
        >
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              TSA Parent Assistant
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get instant answers about Texas Sports Academy programs, schedules, policies, and more
            </p>
          </div>
          
          <SearchBox />
          
          <PopularQuestions />
        </motion.div>
      </main>
      
      <footer className="py-6 text-center text-sm text-gray-500 relative z-10">
        <p>© 2025 Texas Sports Academy. All rights reserved.</p>
      </footer>
    </div>
  );
}