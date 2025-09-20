"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon, SearchIcon, MessageSquareIcon, Trash2Icon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';

interface QAPair {
  id: string;
  question: string;
  answer: string;
  audience: 'parent' | 'coach' | 'both';
  category: string;
  created_at: string;
}

export default function QAAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qaPairs, setQAPairs] = useState<QAPair[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudience, setSelectedAudience] = useState<'all' | 'parent' | 'coach' | 'both'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newAudience, setNewAudience] = useState<'parent' | 'coach' | 'both'>('parent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  // Phase 4: Check Issues states
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [feedbackIssues, setFeedbackIssues] = useState<Array<{question: string, thumbs_down: number}>>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);

  // Check authentication
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin-auth") === "authenticated";
    if (!isAuth) {
      router.push('/admin');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N to add new Q&A
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowAddModal(true);
      }
      // Escape to close modal
      if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal]);

  // Load Q&A pairs
  useEffect(() => {
    if (isAuthenticated) {
      fetchQAPairs();
    }
  }, [isAuthenticated, selectedAudience]);

  const fetchQAPairs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAudience !== 'all') {
        params.append('audience', selectedAudience);
      }
      params.append('limit', '200'); // Get more Q&A pairs
      
      const response = await fetch(`/api/qa-pairs?${params}`);
      const data = await response.json();
      setQAPairs(data.data || []);
    } catch (error) {
      console.error('Failed to fetch Q&A pairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddQA = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Please fill in both question and answer");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/qa-pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          answer: newAnswer,
          audience: newAudience
        })
      });

      if (response.ok) {
        toast.success("Q&A pair added successfully");
        setShowAddModal(false);
        setNewQuestion("");
        setNewAnswer("");
        setNewAudience('parent');
        fetchQAPairs(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to add Q&A pair");
      }
    } catch (error) {
      toast.error("Failed to add Q&A pair");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Q&A pair?")) return;

    try {
      const response = await fetch(`/api/qa-pairs/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success("Q&A pair deleted");
        // Optimistically update the UI
        setQAPairs(prev => prev.filter(qa => qa.id !== id));
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to delete Q&A pair");
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Delete error:', error);
      }
      toast.error("Failed to delete Q&A pair");
    }
  };
  
  // Phase 4: Check for problematic questions (Simplified per Will Larson)
  const checkFeedbackIssues = async () => {
    setIsLoadingIssues(true);
    try {
      const { data, error } = await supabase
        .from('recent_feedback_issues')
        .select('*')
        .order('thumbs_down', { ascending: false });
      
      if (error) {
        throw new Error('Run the SQL in sql/create-feedback-table.sql to create the view');
      }
      
      setFeedbackIssues(data || []);
      
      if (!data || data.length === 0) {
        toast.success("No issues this week! 🎉");
      } else {
        setShowIssuesModal(true);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking feedback:', err);
      }
      toast.error(err instanceof Error ? err.message : "Unable to check feedback issues");
    } finally {
      setIsLoadingIssues(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect to /admin
  }

  // Filtered Q&A pairs - newest first (Larson: what admins actually want)
  const filteredQAPairs = qaPairs
    .filter(qa => 
      qa.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qa.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Count by audience
  const audienceCounts = qaPairs.reduce((acc, qa) => {
    acc[qa.audience] = (acc[qa.audience] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Highlight search matches (Vercel style)
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? `<mark class="bg-yellow-100 dark:bg-yellow-900/30 text-inherit rounded-sm px-0.5">${part}</mark>`
        : part
    ).join('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <nav className="flex items-center h-full">
            <a
              href="/admin/documents"
              className="relative px-4 h-full flex items-center text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border transition-colors"
            >
              Documents
            </a>
            <a
              href="/admin/qa"
              className="relative px-4 h-full flex items-center text-sm font-medium text-foreground border-b-2 border-foreground"
            >
              Q&A Pairs
            </a>
          </nav>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-xs"
            onClick={() => {
              sessionStorage.removeItem("admin-auth");
              router.push('/admin');
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Q&A Pairs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage question and answer pairs for the chatbot
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={checkFeedbackIssues}
              disabled={isLoadingIssues}
            >
              {isLoadingIssues ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircleIcon className="w-4 h-4" />
              )}
              Check Issues
            </Button>
            <Button className="gap-2" onClick={() => setShowAddModal(true)}>
              <PlusIcon className="w-4 h-4" />
              Add Q&A
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search questions or answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Audience Filter Pills */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setSelectedAudience('all')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                selectedAudience === 'all' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              All {qaPairs.length > 0 && `(${qaPairs.length})`}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => setSelectedAudience('parent')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                selectedAudience === 'parent' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Parent {audienceCounts.parent > 0 && `(${audienceCounts.parent})`}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => setSelectedAudience('coach')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                selectedAudience === 'coach' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Coach {audienceCounts.coach > 0 && `(${audienceCounts.coach})`}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => setSelectedAudience('both')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                selectedAudience === 'both' 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Both {audienceCounts.both > 0 && `(${audienceCounts.both})`}
            </button>
          </div>
        </div>

        {/* Content */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="divide-y">
              {/* Table header skeleton */}
              <div className="flex items-center gap-4 px-6 py-3 bg-muted/30">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              {/* Table rows skeleton */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 w-[35%]" />
                  <Skeleton className="h-4 w-[35%]" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredQAPairs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <MessageSquareIcon className="w-8 h-8 text-muted-foreground/70" />
                </div>
                {searchQuery && (
                  <div className="absolute -top-1 -right-1 left-0 mx-auto w-fit">
                    <SearchIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {searchQuery ? 'No matches found' : 'No Q&A pairs yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {searchQuery 
                  ? `No Q&A pairs match "${searchQuery}". Try a different search term.`
                  : "Help parents and coaches get instant answers by adding Q&A pairs."}
              </p>
              <div className="flex items-center justify-center gap-3">
                {searchQuery ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery('')}
                    className="gap-2"
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={() => setShowAddModal(true)} className="gap-2">
                    <PlusIcon className="w-4 h-4" />
                    Add your first Q&A
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="w-full overflow-hidden">
                <Table className="table-fixed w-full">
                  <colgroup>
                    <col className="w-[35%]" />
                    <col className="w-[35%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Question</TableHead>
                      <TableHead>Answer</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQAPairs.map((qa) => {
                      const isNew = new Date(qa.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      return (
                      <TableRow key={qa.id} className="group transition-colors duration-150 hover:bg-muted/50">
                        <TableCell className="font-medium pl-6">
                          <div className="flex items-center gap-2">
                            <div 
                              className="truncate pr-4" 
                              title={qa.question}
                              dangerouslySetInnerHTML={{ 
                                __html: highlightMatch(qa.question, searchQuery) 
                              }}
                            />
                            {isNew && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-md font-medium">
                                NEW
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="truncate pr-4 text-muted-foreground" 
                            title={qa.answer}
                            dangerouslySetInnerHTML={{ 
                              __html: highlightMatch(qa.answer, searchQuery) 
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              qa.audience === 'parent' && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
                              qa.audience === 'coach' && "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
                              qa.audience === 'both' && "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400"
                            )}
                          >
                            {qa.audience}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(qa.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(qa.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </Button>
                        </TableCell>
                    </TableRow>
                  );
                  })}
                  </TableBody>
                </Table>
              </div>

              {/* Footer */}
              {filteredQAPairs.length > 0 && (
                <div className="px-6 py-3 bg-muted/30 border-t">
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredQAPairs.length} of {qaPairs.length} Q&A pairs
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Keyboard shortcuts hint */}
        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> for command menu</span>
          <span>·</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘N</kbd> to add new Q&A</span>
        </div>
      </main>

      {/* Add Q&A Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Q&A Pair</DialogTitle>
            <DialogDescription>
              Create a new question and answer pair for the chatbot
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="question" className="text-sm font-medium">
                Question
              </label>
              <Input
                id="question"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="What is the question users are asking?"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="answer" className="text-sm font-medium">
                Answer
              </label>
              <Textarea
                id="answer"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Provide a clear, concise answer"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Audience</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newAudience === 'parent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewAudience('parent')}
                >
                  Parent
                </Button>
                <Button
                  type="button"
                  variant={newAudience === 'coach' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewAudience('coach')}
                >
                  Coach
                </Button>
                <Button
                  type="button"
                  variant={newAudience === 'both' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewAudience('both')}
                >
                  Both
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddQA}
              disabled={isSubmitting || !newQuestion.trim() || !newAnswer.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Q&A Pair"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Issues Dialog (Phase 4) */}
      <Dialog open={showIssuesModal} onOpenChange={setShowIssuesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Questions Getting Thumbs Down</DialogTitle>
            <DialogDescription>
              These questions need better answers. Click to add as Q&A pair.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {feedbackIssues.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No issues found this week! 🎉
              </p>
            ) : (
              feedbackIssues.map((issue, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Pre-fill the Q&A form
                    setNewQuestion(issue.question);
                    setNewAnswer("");
                    setShowIssuesModal(false);
                    setShowAddModal(true);
                    toast.info(`Add a clear answer for: "${issue.question}"`);
                  }}
                  className="w-full text-left p-4 rounded-lg hover:bg-muted transition-colors border"
                >
                  <div className="font-medium">{issue.question}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    👎 {issue.thumbs_down} {issue.thumbs_down === 1 ? 'time' : 'times'} this week
                  </div>
                  <div className="text-xs text-blue-600 mt-2">
                    → Click to add as Q&A pair
                  </div>
                </button>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssuesModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}