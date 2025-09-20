"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { LockIcon, PlusIcon, SearchIcon, ArrowUpDownIcon, FileTextIcon, AudioLinesIcon, XIcon } from "lucide-react";
import { DocumentTable } from "@/components/document-table";
import { UploadZone } from "@/components/upload-zone";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "docx" | "audio";
  size: number;
  uploadedAt: Date;
  audience?: 'parent' | 'coach' | 'shared';
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Document | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<'parent' | 'coach' | 'shared'>('parent');

  // Load documents from API
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/documents')
        .then(res => res.json())
        .then(data => {
          setDocuments(data.map((doc: any) => ({
            id: doc.id,
            name: doc.filename,
            type: doc.filename.endsWith('.pdf') ? 'pdf' : 
                  doc.filename.endsWith('.docx') || doc.filename.endsWith('.doc') ? 'docx' : 
                  'audio',
            size: 0, // Size not stored in DB currently
            uploadedAt: new Date(doc.uploaded_at),
            audience: doc.audience
          })));
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to load documents:', err);
          setIsLoading(false);
        });
    }
  }, [isAuthenticated]);

  // Check if already authenticated
  useEffect(() => {
    const auth = sessionStorage.getItem("admin-auth");
    if (auth === "authenticated") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = (e: FormEvent) => {
    e.preventDefault();
    console.log("Auth attempt with password:", password);
    
    // In production, this would be an API call
    if (password === "tsa-admin-2024") {
      console.log("Password correct, logging in...");
      sessionStorage.setItem("admin-auth", "authenticated");
      setIsAuthenticated(true);
      setError(false);
    } else {
      console.log("Password incorrect");
      setError(true);
      setPassword("");
    }
  };

  const handleUpload = async (files: File[]) => {
    // Upload to server with audience
    const updatedDocs = [...documents];
    const replacedFiles: string[] = [];
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('audience', selectedAudience);
      
      try {
        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
          headers: {
            'Idempotency-Key': `${selectedAudience}-${file.name}-${file.size}-${file.lastModified}`
          }
        });
        
        const result = await response.json();
        
        if (response.ok) {
          const existingIndex = updatedDocs.findIndex(doc => doc.name === file.name && doc.audience === selectedAudience);
          const newDoc: Document = {
            id: result.id,
            name: file.name,
            type: file.name.endsWith(".pdf") ? "pdf" : 
                  file.name.endsWith(".docx") || file.name.endsWith(".doc") ? "docx" : 
                  "audio",
            size: file.size,
            uploadedAt: new Date(),
            audience: selectedAudience
          };
          
          if (existingIndex >= 0) {
            // Replace existing file
            updatedDocs[existingIndex] = newDoc;
            replacedFiles.push(file.name);
          } else {
            // Add new file
            updatedDocs.unshift(newDoc);
          }
        } else {
          toast.error(`Failed to upload ${file.name}: ${result.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
        console.error('Upload error:', error);
      }
    }

    setDocuments(updatedDocs);
    
    // Success feedback
    files.forEach((file, index) => {
      setTimeout(() => {
        const message = replacedFiles.includes(file.name)
          ? `Updated ${file.name}`
          : `Uploaded ${file.name}`;
        toast.success(message, {
          position: "top-right",
        });
      }, index * 100); // Stagger toasts
    });
  };

  const handleDelete = async (id: string) => {
    const docToDelete = documents.find(doc => doc.id === id);
    if (!docToDelete) return;
    
    // Optimistically remove from UI
    setDocuments(documents.filter(doc => doc.id !== id));
    
    try {
      const response = await fetch(`/api/documents?id=${id}&audience=${docToDelete.audience}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      
      toast.success(
        <div className="flex items-center justify-between gap-4">
          <span>Document deleted</span>
          <button
            onClick={async () => {
              // Re-upload the document to restore it
              const formData = new FormData();
              // Note: We can't restore the actual file content, just the record
              setDocuments(prev => [...prev, docToDelete]);
              toast.dismiss();
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Undo
          </button>
        </div>,
        {
          position: "bottom-center",
          duration: 5000,
        }
      );
    } catch (error) {
      // Restore on error
      setDocuments(prev => [...prev, docToDelete]);
      toast.error('Failed to delete document');
      console.error('Delete error:', error);
    }
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = documents
    .filter(doc => 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime();
          break;
        case "size":
          comparison = a.size - b.size;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Count documents by type
  const typeCounts = documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
          <div className="text-center mb-8">
            <LockIcon className="w-8 h-8 mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-medium">Admin Access</h1>
          </div>
          
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            autoFocus
          />
          
          {error && (
            <p className="text-sm text-destructive">Invalid password</p>
          )}
          
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">TSA DOCUMENTS</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              sessionStorage.removeItem("admin-auth");
              setIsAuthenticated(false);
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">Documents</h2>
                <div className="flex items-center gap-3">
                  {typeCounts.pdf > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-5 h-5 rounded bg-red-50 text-red-600 flex items-center justify-center">
                        <FileTextIcon className="w-3 h-3" />
                      </div>
                      <span className="text-muted-foreground">{typeCounts.pdf} PDF{typeCounts.pdf !== 1 && 's'}</span>
                    </div>
                  )}
                  {typeCounts.docx > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileTextIcon className="w-3 h-3" />
                      </div>
                      <span className="text-muted-foreground">{typeCounts.docx} Word</span>
                    </div>
                  )}
                  {typeCounts.audio > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-5 h-5 rounded bg-purple-50 text-purple-600 flex items-center justify-center">
                        <AudioLinesIcon className="w-3 h-3" />
                      </div>
                      <span className="text-muted-foreground">{typeCounts.audio} Audio</span>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredAndSortedDocuments.length} of {documents.length} {documents.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {/* Search and Sort Controls */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-9 py-2 text-sm border rounded-lg bg-background",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
                    searchQuery ? "pr-8" : "pr-4"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                  >
                    <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split("-") as [typeof sortBy, typeof sortOrder];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="appearance-none px-3 py-2 pr-8 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center'
                }}
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-desc">Largest first</option>
                <option value="size-asc">Smallest first</option>
              </select>
            </div>
            
            {isLoading ? (
              <DocumentSkeleton />
            ) : (
              <DocumentTable 
                documents={filteredAndSortedDocuments} 
                onDelete={handleDelete}
                isFiltered={searchQuery.length > 0 || sortBy !== "date" || sortOrder !== "desc"}
              />
            )}
          </div>

          {/* Upload Zone */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium mb-6">Upload</h2>
            
            {/* Audience Selector */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setSelectedAudience('parent')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  selectedAudience === 'parent' 
                    ? "bg-background text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Parent
              </button>
              <button
                onClick={() => setSelectedAudience('coach')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  selectedAudience === 'coach' 
                    ? "bg-background text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Coach
              </button>
              <button
                onClick={() => setSelectedAudience('shared')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  selectedAudience === 'shared' 
                    ? "bg-background text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Shared
              </button>
            </div>
            
            <UploadZone onUpload={handleUpload} />
          </div>
        </div>
      </main>
    </div>
  );
}
