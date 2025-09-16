"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ThumbsUpIcon, ThumbsDownIcon, ArrowDownIcon, CopyIcon, CheckIcon, ShareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/components/search/search-box";
import { AppHeader } from "@/components/app-header";
import { mockAnswers, type Answer, type Question } from "@/lib/types";
import { TypingIndicator } from "@/components/typing-indicator";
import { AnswerSkeleton } from "@/components/answer-skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useCopyToClipboard } from "usehooks-ts";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { retryWithBackoff, isRetryableError } from "@/lib/retry";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AnswerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const question = searchParams.get("q") || "";
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{question: string; answer: Answer | null; isLoading: boolean}>>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const [_, copyToClipboard] = useCopyToClipboard();
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
    let abortController = new AbortController();
    
    const fetchAnswer = async () => {
      try {
        // In production, replace this with actual API call
        const fetchWithRetry = async () => {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Simulate random failures for demo (remove in production)
          if (Math.random() < 0.1) {
            throw new Error('Network error');
          }
          
          const mockAnswer = mockAnswers[slug] || mockAnswers["fall-registration-dates"];
          return mockAnswer;
        };

        // Use retry logic with exponential backoff
        const answer = await retryWithBackoff(
          () => Promise.race([
            fetchWithRetry(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 3000)
            )
          ]),
          {
            maxAttempts: 2,
            initialDelay: 500,
            onRetry: (attempt) => {
              console.log(`Retrying... Attempt ${attempt}`);
            }
          }
        );
        
        if (!abortController.signal.aborted) {
          setAnswer(answer);
          setIsLoading(false);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          // Show timeout message
          setAnswer({
            id: 'timeout',
            questionId: 'timeout',
            content: "I'm having trouble getting that information right now. Please try again or contact TSA directly at (555) 123-4567.",
            sources: [],
            relatedQuestions: [],
            updatedAt: new Date()
          });
          setIsLoading(false);
        }
      }
    };

    fetchAnswer();

    return () => {
      abortController.abort();
    };
  }, [slug]);

  // Handle scroll position for scroll-to-bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (!mainRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
      // Check if we're within 100px of the bottom (more forgiving)
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100);
    };

    const main = mainRef.current;
    if (main) {
      main.addEventListener('scroll', handleScroll);
      handleScroll(); // Check initial state
    }

    return () => {
      if (main) {
        main.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({
        top: mainRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await copyToClipboard(text.replace(/\*\*(.*?)\*\*/g, '$1')); // Remove markdown
      setCopiedIds(prev => new Set(prev).add(id));
      toast.success('Answer copied to clipboard!');
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async (question: string, answer: Answer) => {
    const shareText = `Q: ${question}\n\nA: ${answer.content.replace(/\*\*(.*?)\*\*/g, '$1')}\n\n${
      answer.sources.length > 0 
        ? `Sources:\n${answer.sources.map(s => `• ${s.title}${s.pageNumber ? ` (p. ${s.pageNumber})` : ''}`).join('\n')}`
        : ''
    }`;

    // Check if Web Share API is available (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TSA Answer',
          text: shareText,
          url: window.location.href
        });
      } catch (error: any) {
        // User cancelled share or error occurred
        if (error?.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      // Fallback to copy
      await copyToClipboard(shareText);
      toast.success('Full Q&A copied to clipboard!');
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background treatment - same as home page */}
        <div className="absolute inset-0 bg-gradient-to-br from-tsa-blue/[0.02] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-tsa-blue/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-muted/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Fixed header that stays at top */}
      <AppHeader fixed />

      {/* Fixed left sidebar for back button */}
      <div className="fixed left-0 top-0 bottom-0 w-20 pt-24 pl-4">
        <button
          onClick={() => router.back()}
          className={cn(
            "flex items-center justify-center bg-muted/50 text-foreground hover:bg-foreground/10 hover:text-foreground rounded-full transition-all duration-200",
            isMobile ? "w-12 h-12" : "w-10 h-10"
          )}
          aria-label="Go back"
        >
          <ArrowLeftIcon className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
        </button>
      </div>

      <main 
        ref={mainRef} 
        className="pt-24 pb-16 pl-20 h-[calc(100vh-80px)] overflow-y-auto overscroll-behavior-contain"
        style={{ overflowAnchor: 'none' }}
      >
        {/* Question in content container */}
        <div className="max-w-4xl mx-auto px-6">
          <h1 className={`text-4xl sm:text-5xl font-semibold mb-10 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            {question || (
              <span className="inline-block h-12 w-96 bg-muted rounded-lg animate-pulse" />
            )}
          </h1>
        </div>

        {/* Answer content - also in content container */}
        <div className="max-w-4xl mx-auto px-6">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-8"
              >
                <AnswerSkeleton />
              </motion.div>
            ) : answer ? (
              <motion.div
                key="answer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="space-y-8"
              >
                {/* Main answer */}
                <div className="text-xl leading-[1.7] text-foreground mb-6">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: answer.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>') 
                    }} 
                  />
                </div>

            {/* Feedback and action buttons */}
            <div className="flex items-center gap-2 pb-6 border-b">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCopy(answer.content, answer.id)}
                    className={cn(
                      "p-2 rounded-full transition-all duration-200 active:scale-95",
                      copiedIds.has(answer.id)
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label="Copy answer"
                  >
                    {copiedIds.has(answer.id) ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copiedIds.has(answer.id) ? "Copied!" : "Copy answer"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleShare(question, answer)}
                    className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-95"
                    aria-label="Share Q&A"
                  >
                    <ShareIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Share Q&A</p>
                </TooltipContent>
              </Tooltip>
              <div className="w-px h-6 bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const wasActive = feedback === 'up';
                      setFeedback(wasActive ? null : 'up');
                      if (!wasActive) {
                        // Add a brief pulse animation
                        const btn = document.getElementById('feedback-up');
                        btn?.classList.add('animate-pulse');
                        setTimeout(() => btn?.classList.remove('animate-pulse'), 600);
                      }
                    }}
                    id="feedback-up"
                    className={cn(
                      "p-2 rounded-full transition-all duration-200 active:scale-95",
                      feedback === 'up' 
                        ? "bg-tsa-blue/10 text-tsa-blue scale-110 ring-2 ring-tsa-blue/20" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ThumbsUpIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This was helpful</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const wasActive = feedback === 'down';
                      setFeedback(wasActive ? null : 'down');
                      if (!wasActive) {
                        // Add a brief pulse animation
                        const btn = document.getElementById('feedback-down');
                        btn?.classList.add('animate-pulse');
                        setTimeout(() => btn?.classList.remove('animate-pulse'), 600);
                      }
                    }}
                    id="feedback-down"
                    className={cn(
                      "p-2 rounded-full transition-all duration-200 active:scale-95",
                      feedback === 'down' 
                        ? "bg-destructive/10 text-destructive scale-110 ring-2 ring-destructive/20" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ThumbsDownIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This wasn't helpful</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Sources - more subtle */}
            {answer.sources.length > 0 && (
              <div className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                  Sources
                </h3>
                <div className="space-y-2">
                  {answer.sources.map((source) => (
                      <motion.div
                        key={source.id}
                        className="group flex items-baseline gap-2 text-sm py-1 cursor-pointer"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">•</span>
                        <span className="text-foreground/80 group-hover:text-foreground underline-offset-4 group-hover:underline transition-colors">
                          {source.title}
                        </span>
                        {(source.pageNumber || source.timestamp) && (
                          <span className="text-xs text-muted-foreground">
                            {source.pageNumber && `p. ${source.pageNumber}`}
                            {source.timestamp && source.timestamp}
                          </span>
                        )}
                      </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Related questions - expandable */}
            {answer.relatedQuestions && answer.relatedQuestions.length > 0 && (
              <div className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                  Related Questions
                </h3>
                <div className="divide-y divide-border/40">
                  {answer.relatedQuestions.map((relatedQ, index) => {
                    return (
                      <div 
                        key={relatedQ.id}
                        className="animate-in fade-in-0 slide-in-from-right-2"
                        style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                      >
                        <button
                          onClick={() => {
                            // Add to conversation history without filling the input
                            const newConversation = {
                              question: relatedQ.text,
                              answer: null,
                              isLoading: true
                            };
                            setConversationHistory(prev => [...prev, newConversation]);
                            
                            // Scroll to bottom after adding new question
                            setTimeout(() => {
                              if (mainRef.current) {
                                mainRef.current.scrollTo({
                                  top: mainRef.current.scrollHeight,
                                  behavior: 'smooth'
                                });
                              }
                            }, 100);
                            
                            // Simulate getting answer for this question
                            const answerTimer = setTimeout(() => {
                              const mockAnswer = mockAnswers[relatedQ.slug];
                              setConversationHistory(prev => 
                                prev.map((item, idx) => 
                                  idx === prev.length - 1 
                                    ? { ...item, answer: mockAnswer, isLoading: false }
                                    : item
                                )
                              );
                            }, 1500);

                            // 3-second timeout handler
                            const timeoutTimer = setTimeout(() => {
                              setConversationHistory(prev => {
                                const last = prev[prev.length - 1];
                                if (last && last.isLoading) {
                                  return prev.map((item, idx) => 
                                    idx === prev.length - 1 
                                      ? { 
                                          ...item, 
                                          answer: {
                                            id: 'timeout',
                                            questionId: 'timeout',
                                            content: "I'm having trouble getting that information right now. Please try again or contact TSA directly at (555) 123-4567.",
                                            sources: [],
                                            relatedQuestions: [],
                                            updatedAt: new Date()
                                          },
                                          isLoading: false 
                                        }
                                      : item
                                  );
                                }
                                return prev;
                              });
                            }, 3000);
                          }}
                          className="group flex items-center gap-3 w-full text-left py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors duration-200"
                        >
                          <span className="text-sm text-foreground">
                            {relatedQ.text}
                          </span>
                          <ArrowRightIcon 
                            className="h-4 w-4 text-muted-foreground group-hover:text-foreground ml-auto transition-all duration-200 group-hover:translate-x-1" 
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conversation History */}
            {conversationHistory.map((item, idx) => (
              <motion.div 
                key={idx} 
                className="mt-10 pt-10 border-t" 
                data-conversation-item
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <h2 className="text-3xl sm:text-4xl font-semibold mb-8">{item.question}</h2>
                {item.isLoading ? (
                  <TypingIndicator />
                ) : item.answer ? (
                  <div className="space-y-8">
                    <div className="text-xl leading-[1.7] text-foreground">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: item.answer.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>') 
                        }} 
                      />
                    </div>

                    {/* Copy button for conversation answers */}
                    <div className="flex items-center gap-2 pt-4">
                      <button
                        onClick={() => handleCopy(item.answer!.content, `conv-${idx}`)}
                        className={cn(
                          "p-2 rounded-full transition-all duration-200 active:scale-95",
                          copiedIds.has(`conv-${idx}`)
                            ? "bg-green-500/10 text-green-600"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        aria-label="Copy answer"
                      >
                        {copiedIds.has(`conv-${idx}`) ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleShare(item.question, item.answer!)}
                        className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-95"
                        aria-label="Share Q&A"
                      >
                        <ShareIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Sources for this answer */}
                    {item.answer.sources && item.answer.sources.length > 0 && (
                      <div className="pt-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                          Sources
                        </h3>
                        <div className="space-y-2">
                          {item.answer.sources.map((source) => (
                            <motion.div
                              key={source.id}
                              className="group flex items-baseline gap-2 text-sm py-1 cursor-pointer"
                              whileHover={{ x: 4 }}
                              transition={{ duration: 0.2 }}
                            >
                              <span className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">•</span>
                              <span className="text-foreground/80 group-hover:text-foreground underline-offset-4 group-hover:underline transition-colors">
                                {source.title}
                              </span>
                              {(source.pageNumber || source.timestamp) && (
                                <span className="text-xs text-muted-foreground">
                                  {source.pageNumber ? `p. ${source.pageNumber}` : source.timestamp}
                                </span>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Related questions for this answer */}
                    {item.answer.relatedQuestions && item.answer.relatedQuestions.length > 0 && (
                      <div className="pt-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                          Related Questions
                        </h3>
                        <div className="divide-y divide-border/40">
                          {item.answer.relatedQuestions.map((relatedQ, index) => (
                            <div 
                              key={relatedQ.id}
                              className="animate-in fade-in-0 slide-in-from-right-2"
                              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                            >
                              <button
                                onClick={() => {
                                  // Don't fill the input, just add to conversation
                                  const newConversation = {
                                    question: relatedQ.text,
                                    answer: null,
                                    isLoading: true
                                  };
                                  setConversationHistory(prev => [...prev, newConversation]);
                                  
                                  // Scroll to show the full question below the header
                                  setTimeout(() => {
                                    if (mainRef.current) {
                                      mainRef.current.scrollTo({
                                        top: mainRef.current.scrollHeight,
                                        behavior: 'smooth'
                                      });
                                    }
                                  }, 100); // Small delay to ensure DOM update
                                  
                                  // Load the answer after delay
                                  setTimeout(() => {
                                    const mockAnswer = mockAnswers[relatedQ.slug];
                                    setConversationHistory(prev => 
                                      prev.map((item, idx) => 
                                        idx === prev.length - 1 
                                          ? { ...item, answer: mockAnswer, isLoading: false }
                                          : item
                                      )
                                    );
                                  }, 1500);
                                }}
                                className="group flex items-center gap-3 w-full text-left py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors duration-200"
                              >
                                <span className="text-sm text-foreground">
                                  {relatedQ.text}
                                </span>
                                <ArrowRightIcon 
                                  className="h-4 w-4 text-muted-foreground group-hover:text-foreground ml-auto transition-all duration-200 group-hover:translate-x-1" 
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No answer found.</p>
                )}
              </motion.div>
            ))}

            {/* Follow-up section */}
            <div className="pt-10 mt-8 border-t follow-up-section">
              <SearchBox 
                placeholder="Ask a follow-up question" 
                showAvatar={true}
                className="max-w-2xl"
                showHelperText={false}
                size="default"
                value={followUpInput}
                onValueChange={setFollowUpInput}
                onSubmit={(question) => {
                  if (question.trim()) {
                    const newConversation = {
                      question: question,
                      answer: null,
                      isLoading: true
                    };
                    setConversationHistory(prev => [...prev, newConversation]);
                    setFollowUpInput("");
                    
                    // Scroll to bottom after adding new question
                    setTimeout(() => {
                      if (mainRef.current) {
                        mainRef.current.scrollTo({
                          top: mainRef.current.scrollHeight,
                          behavior: 'smooth'
                        });
                      }
                    }, 100);
                    
                    // Simulate getting answer
                    const answerTimer = setTimeout(() => {
                      const slug = question
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")
                        .slice(0, 50);
                      const mockAnswer = mockAnswers[slug] || mockAnswers["fall-registration-dates"];
                      setConversationHistory(prev => 
                        prev.map((item, idx) => 
                          idx === prev.length - 1 
                            ? { ...item, answer: mockAnswer, isLoading: false }
                            : item
                        )
                      );
                    }, 1500);

                    // 3-second timeout handler
                    const timeoutTimer = setTimeout(() => {
                      setConversationHistory(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.isLoading) {
                          return prev.map((item, idx) => 
                            idx === prev.length - 1 
                              ? { 
                                  ...item, 
                                  answer: {
                                    id: 'timeout',
                                    questionId: 'timeout',
                                    content: "I'm having trouble getting that information right now. Please try again or contact TSA directly at (555) 123-4567.",
                                    sources: [],
                                    relatedQuestions: [],
                                    updatedAt: new Date()
                                  },
                                  isLoading: false 
                                }
                              : item
                          );
                        }
                        return prev;
                      });
                    }, 3000);
                  }
                }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-lg bg-destructive/10 p-6 text-center"
          >
            <p className="text-sm text-destructive">
              Sorry, I couldn't find an answer to your question. Please try rephrasing or contact TSA directly.
            </p>
          </motion.div>
        )}
        </AnimatePresence>
        </div>
      </main>

      {/* Scroll to bottom button - shows when scrolled up */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "fixed z-50 bg-background/95 backdrop-blur-sm border shadow-lg rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2",
            isMobile 
              ? "bottom-20 right-4 w-12 h-12" // Larger on mobile, adjusted position
              : "bottom-24 right-8 w-10 h-10"
          )}
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
        </button>
      )}
      </div>
    </TooltipProvider>
  );
}