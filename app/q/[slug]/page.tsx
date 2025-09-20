"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ArrowDownIcon, CopyIcon, CheckIcon, ShareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/components/search/search-box";
import { AppHeader } from "@/components/app-header";
// Removed old types - using AI SDK v5 UIMessage instead
import { AnswerSkeleton } from "@/components/answer-skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useCopyToClipboard } from "usehooks-ts";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackButtons } from "@/components/feedback-buttons";

export default function AnswerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const question = searchParams.get("q") || "";
  const audience = searchParams.get("audience") as 'parent' | 'coach' || 'parent';
  
  // Use the AI SDK's useChat hook for streaming
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/q',
      body: { audience },
    }),
  });
  
  // Store chunk metadata for feedback (Phase 3)
  const [chunkMetadata, setChunkMetadata] = useState<Record<string, any>>({});
  
  const [hasInitialized, setHasInitialized] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [feedbackPerMessage, setFeedbackPerMessage] = useState<Record<string, 'up' | 'down' | null>>({});
  const [mounted, setMounted] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const [_, copyToClipboard] = useCopyToClipboard();
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [lastCopyId, setLastCopyId] = useState<string>('');
  const isMobile = useIsMobile();
  const [showFollowUpLoading, setShowFollowUpLoading] = useState(false);
  const [isWaitingForFollowUps, setIsWaitingForFollowUps] = useState(false);

  // Debug logging and extract chunk metadata
  useEffect(() => {
    const firstAssistant = messages.filter(m => m.role === 'assistant')[0];
    const hasFollowUps = firstAssistant?.parts?.some(p => p.type === 'data-followups');
    const assistantCount = messages.filter(m => m.role === 'assistant').length;
    
    // Extract chunk metadata from messages (Phase 3)
    messages.forEach((message, idx) => {
      if (message.role === 'assistant') {
        const chunkMetaPart = message.parts?.find(p => (p as any).type === 'chunk-metadata');
        const metricsPart = message.parts?.find(p => (p as any).type === 'response-metrics');
        
        if (chunkMetaPart && 'data' in chunkMetaPart) {
          const metadata = (chunkMetaPart as any).data;
          if (metricsPart && 'data' in metricsPart) {
            metadata.response_time_ms = (metricsPart as any).data.response_time_ms;
          }
          setChunkMetadata(prev => ({ ...prev, [message.id]: metadata }));
          if (process.env.NODE_ENV === 'development') {
            console.log('Captured chunk metadata:', metadata);
          }
        }
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Chat debug:', {
        messages: messages.length,
        status,
        error,
        hasInitialized,
        question,
        assistantCount,
        hasFollowUps,
        isStreamingFirst: status === 'streaming' && assistantCount === 1
      });
      if (firstAssistant) {
        console.log('First assistant parts:', firstAssistant.parts.map(p => ({ type: p.type, hasData: 'data' in p })));
      }
    }
  }, [messages, status, error, hasInitialized, question]);
  
  // Track when we finish streaming and are waiting for follow-ups
  useEffect(() => {
    const firstAssistant = messages.filter(m => m.role === 'assistant')[0];
    const hasFollowUps = firstAssistant?.parts?.some(p => p.type === 'data-followups');
    const assistantCount = messages.filter(m => m.role === 'assistant').length;
    
    // If we just finished streaming the first message and don't have follow-ups yet
    if (status === 'ready' && assistantCount === 1 && firstAssistant && !hasFollowUps) {
      setIsWaitingForFollowUps(true);
    } else if (hasFollowUps || assistantCount > 1) {
      setIsWaitingForFollowUps(false);
    }
  }, [messages, status]);

  useEffect(() => {
    setMounted(true);
    
    // Initialize the chat with the initial question
    if (question && !hasInitialized) {
      // Small delay to ensure smooth initial render
      setTimeout(() => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: question,
            }
          ],
        });
      }, 100);
      setHasInitialized(true);
    }
  }, [question, sendMessage, hasInitialized]);

  // Smart auto-scroll during streaming
  useEffect(() => {
    if (status === 'streaming' && isAtBottom) {
      // Only auto-scroll if user is already near bottom
      const scrollInterval = setInterval(() => {
        if (mainRef.current && isAtBottom) {
          mainRef.current.scrollTo({
            top: mainRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);

      return () => clearInterval(scrollInterval);
    }
  }, [status, isAtBottom]);

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

  const handleShare = async (question: string, answerText: string) => {
    const shareText = `Q: ${question}\n\nA: ${answerText}`;

    // Check if Web Share API is available (mobile)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
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
          onClick={() => router.push('/')}
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
          {(() => {
            // Check if we have an assistant message with actual text content
            const firstAssistant = messages.filter(m => m.role === 'assistant')[0];
            const hasTextContent = firstAssistant?.parts?.some(p => p.type === 'text' && (p as any).text);
            
            // Show skeleton if:
            // 1. No assistant messages yet, OR
            // 2. Assistant message exists but has no text content yet (still initializing)
            // 3. And we're in a loading state or just initialized
            const shouldShowSkeleton = (!firstAssistant || !hasTextContent) && 
              (status === 'submitted' || status === 'streaming' || (!hasInitialized && question));
            
            // Will Larson's simple error state
            if (error) {
              return (
                <div className="mb-8 text-center py-12">
                  <p className="text-lg text-muted-foreground mb-4">
                    Something went wrong. Please try again.
                  </p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-primary hover:underline"
                  >
                    Refresh page
                  </button>
                </div>
              );
            } else if (shouldShowSkeleton) {
              return (
                <div className="mb-8">
                  <AnswerSkeleton />
                </div>
              );
            } else if (firstAssistant && hasTextContent) {
              return (
                <div className="space-y-8">
                {/* Main answer - always show the FIRST assistant response */}
                <div className="text-xl leading-[1.7] text-foreground mb-6">
                  {messages.filter(m => m.role === 'assistant')[0]?.parts.map((part, index) => {
                    if (part.type === 'text' && 'text' in part) {
                      const text = (part as any).text || '';
                      return (
                        <div 
                          key={index}
                          dangerouslySetInnerHTML={{ 
                            __html: text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                          }} 
                        />
                      );
                    }
                    return null;
                  })}
                  {/* Show a subtle cursor at the end while still streaming the first response (but not if we already have follow-up questions) */}
                  {(() => {
                    const firstAssistant = messages.filter(m => m.role === 'assistant')[0];
                    const hasFollowUps = firstAssistant?.parts?.some(p => p.type === 'data-followups');
                    return status === 'streaming' && messages.filter(m => m.role === 'assistant').length === 1 && !hasFollowUps && (
                      <span className="inline-block w-1 h-5 bg-foreground/50 animate-pulse ml-1" />
                    );
                  })()}
                </div>

            {/* Feedback and action buttons */}
            <div className="flex items-center gap-2 pb-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const firstAssistantMessage = messages.filter(m => m.role === 'assistant')[0];
                      if (firstAssistantMessage) {
                        const copyId = `answer-main`;
                        const textParts = firstAssistantMessage.parts
                          .filter(p => p.type === 'text')
                          .map(p => p.text)
                          .join('\n');
                        handleCopy(textParts, copyId);
                        setLastCopyId(copyId);
                      }
                    }}
                    className={cn(
                      "p-2 rounded-full transition-all duration-200 active:scale-95",
                      copiedIds.has('answer-main')
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label="Copy answer"
                  >
                    {copiedIds.has('answer-main') ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copiedIds.has('answer-main') ? "Copied!" : "Copy answer"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const firstAssistantMessage = messages.filter(m => m.role === 'assistant')[0];
                      if (firstAssistantMessage) {
                        const textParts = firstAssistantMessage.parts
                          .filter(p => p.type === 'text')
                          .map(p => p.text)
                          .join('\n');
                        handleShare(question, textParts);
                      }
                    }}
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
              <FeedbackButtons
                question={messages[0]?.parts.find(p => p.type === 'text')?.text || ''}
                answer={messages[1]?.parts
                  .filter(p => p.type === 'text')
                  .map(p => p.text)
                  .join('\n') || ''}
                audience={audience}
                messageId="main"
                currentFeedback={feedback}
                onFeedbackChange={setFeedback}
                chunkMetadata={messages[1] ? chunkMetadata[messages[1].id] : undefined}
              />
            </div>

            {/* Dynamic follow-up questions from AI */}
            {(() => {
              // Find follow-up questions in data parts
              let followUpQuestions: string[] | undefined;
              
              // Check the FIRST assistant message for data parts (keeps them stable)
              const firstAssistantMessage = messages.filter(m => m.role === 'assistant')[0];
              if (firstAssistantMessage && firstAssistantMessage.parts) {
                for (const part of firstAssistantMessage.parts) {
                  // Check for data parts containing follow-up questions
                  if (part.type === 'data-followups' && 'data' in part) {
                    const data = (part as any).data;
                    if (data?.questions && Array.isArray(data.questions)) {
                      followUpQuestions = data.questions;
                      break;
                    }
                  }
                }
              }
              
              // Show loading state after streaming but before follow-ups
              // For the main answer, we show loading if:
              // 1. We have the first assistant message
              // 2. No follow-ups yet
              // 3. Either not streaming at all OR streaming a later message (not the first)
              const isStreamingFirstMessage = status === 'streaming' && messages.filter(m => m.role === 'assistant').length === 1;
              const shouldShowLoading = (firstAssistantMessage && !followUpQuestions && !isStreamingFirstMessage) || isWaitingForFollowUps;
              
              // Log for debugging
              if (firstAssistantMessage) {
                console.log('Main follow-up state:', {
                  hasFirstAssistant: !!firstAssistantMessage,
                  hasFollowUps: !!followUpQuestions,
                  isStreamingFirst: isStreamingFirstMessage,
                  isWaitingForFollowUps,
                  shouldShowLoading,
                  status
                });
              }
              
              if (shouldShowLoading) {
                return (
                  <div className="mt-10">
                    <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-4">
                      Related Questions
                    </h3>
                    <div className="flex items-center gap-2 px-4">
                      {/* Single row of three pulsing dots - made larger for visibility */}
                      <div
                        className="w-2.5 h-2.5 bg-muted-foreground/50 rounded-full animate-pulse"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2.5 h-2.5 bg-muted-foreground/50 rounded-full animate-pulse"
                        style={{ animationDelay: '200ms' }}
                      />
                      <div
                        className="w-2.5 h-2.5 bg-muted-foreground/50 rounded-full animate-pulse"
                        style={{ animationDelay: '400ms' }}
                      />
                    </div>
                  </div>
                );
              }
              
              if (followUpQuestions && followUpQuestions.length > 0) {
                return (
                  <div className="mt-10">
                    <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-4">
                      Related Questions
                    </h3>
                    <div className="space-y-3">
                      {followUpQuestions.map((q: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (process.env.NODE_ENV === 'development') {
                              console.log('Main related question clicked:', q);
                              console.log('Current messages before send:', messages.length);
                              console.log('Current status:', status);
                            }
                            sendMessage({
                              role: 'user',
                              parts: [
                                {
                                  type: 'text',
                                  text: q,
                                }
                              ],
                            });
                            // Auto-scroll during streaming will handle the scrolling
                          }}
                          className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                          <ChevronDownIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          <span className="text-sm text-foreground">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Show follow-up conversations (skip the initial Q&A) */}
            {messages.length > 2 && (
              <div className="space-y-8">
                {/* Start from index 2 to skip the initial Q&A pair */}
                {messages.slice(2).filter((_, idx) => idx % 2 === 0).map((userMessage, idx) => {
                  const assistantMessage = messages[messages.indexOf(userMessage) + 1];
                  
                  // Show user message immediately, even if assistant hasn't responded yet
                  if (userMessage.role === 'user') {
                    return (
                      <div key={userMessage.id} className="mt-10 pt-10 border-t">
                        <h2 className="text-2xl font-semibold mb-6">
                          {userMessage.parts.find(p => p.type === 'text')?.text}
                        </h2>
                        
                        {/* Show loading skeleton if no assistant message yet */}
                        {!assistantMessage ? (
                          <AnswerSkeleton />
                        ) : (
                          <div className="text-lg leading-[1.7] text-foreground/90">
                            {assistantMessage.parts.map((part, partIdx) => {
                              if (part.type === 'text') {
                                return (
                                  <div
                                    key={partIdx}
                                    dangerouslySetInnerHTML={{
                                      __html: part.text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                                    }}
                                  />
                                );
                              }
                              return null;
                            })}
                            {/* Show streaming cursor if this is the last message and still streaming */}
                            {idx === Math.floor((messages.length - 3) / 2) && status === 'streaming' && (
                              <span className="inline-block w-1 h-5 bg-foreground/50 animate-pulse ml-1" />
                            )}
                          </div>
                        )}
                        
                        {/* Action buttons for this answer - only show when assistant has responded */}
                        {assistantMessage && (
                          <div className="flex items-center gap-2 mt-6 pt-6 border-t">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  const copyId = `answer-${assistantMessage.id}`;
                                  const textParts = assistantMessage.parts
                                    .filter(p => p.type === 'text')
                                    .map(p => p.text)
                                    .join('\n');
                                  handleCopy(textParts, copyId);
                                  setLastCopyId(copyId);
                                }}
                                className={cn(
                                  "p-2 rounded-full transition-all duration-200 active:scale-95",
                                  copiedIds.has(`answer-${assistantMessage.id}`)
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                aria-label="Copy answer"
                              >
                                {copiedIds.has(`answer-${assistantMessage.id}`) ? (
                                  <CheckIcon className="h-4 w-4" />
                                ) : (
                                  <CopyIcon className="h-4 w-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{copiedIds.has(`answer-${assistantMessage.id}`) ? "Copied!" : "Copy answer"}</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {mounted && typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    const userText = userMessage.parts.find(p => p.type === 'text')?.text || '';
                                    const textParts = assistantMessage.parts
                                      .filter(p => p.type === 'text')
                                      .map(p => p.text)
                                      .join('\n');
                                    handleShare(userText, textParts);
                                  }}
                                  className="p-2 rounded-full transition-all duration-200 active:scale-95 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="Share this Q&A"
                                >
                                  <ShareIcon className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Share this Q&A</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          <div className="w-px h-6 bg-border" />
                          <FeedbackButtons
                            question={userMessage.parts.find(p => p.type === 'text')?.text || ''}
                            answer={assistantMessage.parts
                              .filter(p => p.type === 'text')
                              .map(p => p.text)
                              .join('\n')}
                            audience={audience}
                            messageId={assistantMessage.id}
                            currentFeedback={feedbackPerMessage[assistantMessage.id]}
                            onFeedbackChange={(feedback) => 
                              setFeedbackPerMessage(prev => ({ ...prev, [assistantMessage.id]: feedback }))
                            }
                            chunkMetadata={chunkMetadata[assistantMessage.id]}
                          />
                          </div>
                        )}
                        
                        {/* Show follow-up questions for this assistant message */}
                        {(() => {
                          let followUpQuestions: string[] | undefined;
                          const isLastMessage = idx === Math.floor((messages.length - 3) / 2);
                          const isCurrentlyStreaming = status === 'streaming' && isLastMessage;
                          
                          // Check this specific assistant message for follow-ups
                          if (assistantMessage && assistantMessage.parts) {
                            for (const part of assistantMessage.parts) {
                              if (part.type === 'data-followups' && 'data' in part) {
                                const data = (part as any).data;
                                if (data?.questions && Array.isArray(data.questions)) {
                                  followUpQuestions = data.questions;
                                  break;
                                }
                              }
                            }
                          }
                          
                          // Show loading state only AFTER streaming is done for this message
                          const isMessageDoneStreaming = !(status === 'streaming' && isLastMessage);
                          if (isMessageDoneStreaming && isLastMessage && !followUpQuestions) {
                            return (
                              <div className="mt-6">
                                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-3">
                                  Related Questions
                                </h3>
                                <div className="flex items-center gap-1.5 px-3">
                                  {/* Single row of three pulsing dots - smaller for conversation history */}
                                  <div
                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse"
                                    style={{ animationDelay: '0ms' }}
                                  />
                                  <div
                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse"
                                    style={{ animationDelay: '200ms' }}
                                  />
                                  <div
                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse"
                                    style={{ animationDelay: '400ms' }}
                                  />
                                </div>
                              </div>
                            );
                          }
                          
                          if (followUpQuestions && followUpQuestions.length > 0) {
                            return (
                              <div className="mt-6">
                                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-3">
                                  Related Questions
                                </h3>
                                <div className="space-y-2">
                                  {followUpQuestions.map((q: string, i: number) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        if (process.env.NODE_ENV === 'development') {
                                          console.log('Related question clicked:', q);
                                          console.log('Current messages before send:', messages.length);
                                          console.log('Current status:', status);
                                        }
                                        sendMessage({
                                          role: 'user',
                                          parts: [
                                            {
                                              type: 'text',
                                              text: q,
                                            }
                                          ],
                                        });
                                        // Auto-scroll during streaming will handle the scrolling
                                      }}
                                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group text-sm"
                                    >
                                      <ChevronDownIcon className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                      <span className="text-foreground/90">{q}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
            

            {/* Follow-up section */}
            <div className="pt-10 mt-8 border-t follow-up-section flex justify-center">
              <SearchBox 
                placeholder="Ask a follow-up question" 
                showAvatar={true}
                showAudienceToggle={false}
                className="max-w-2xl w-full"
                showHelperText={false}
                size="default"
                onSubmit={(followUpQuestion) => {
                  if (followUpQuestion.trim()) {
                    sendMessage({
                      role: 'user',
                      parts: [
                        {
                          type: 'text',
                          text: followUpQuestion,
                        }
                      ],
                    });
                    // Auto-scroll during streaming will handle the scrolling
                  }
                }}
              />
            </div>
                </div>
              );
            } else {
              return null;
            }
          })()}
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