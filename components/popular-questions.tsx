"use client";

import { motion } from "framer-motion";
import { popularQuestions } from "@/lib/types";
import { useRouter } from "next/navigation";

export function PopularQuestions() {
  const router = useRouter();

  const handleQuestionClick = (question: { text: string; slug: string }) => {
    router.push(`/q/${question.slug}?q=${encodeURIComponent(question.text)}`);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {popularQuestions.slice(0, 6).map((question, index) => (
        <motion.button
          key={question.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: 0.05 * index,
            duration: 0.3,
            ease: "easeOut"
          }}
          onClick={() => handleQuestionClick(question)}
          className="group relative p-4 text-left rounded-lg border bg-card hover:bg-muted/50 hover:border-tsa-blue/20 transition-all duration-200 hover:shadow-sm"
        >
          <span className="text-sm text-foreground group-hover:text-tsa-blue transition-colors">
            {question.text}
          </span>
          <motion.div
            className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100"
            initial={false}
            animate={{ x: 0 }}
            whileHover={{ x: 3 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-muted-foreground group-hover:text-tsa-blue transition-colors"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </motion.button>
      ))}
    </div>
  );
}
