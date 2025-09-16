"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileTextIcon, AudioLinesIcon, TrashIcon, CalendarIcon, DownloadIcon, CheckIcon, Link2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DocumentCard } from "./document-card";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "docx" | "audio";
  size: number;
  uploadedAt: Date;
}

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
  isFiltered?: boolean;
}

export function DocumentTable({ documents, onDelete, isFiltered }: DocumentTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset delete confirmation after 3 seconds
  useEffect(() => {
    if (deletingId) {
      const timer = setTimeout(() => setDeletingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deletingId]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const getFileIcon = (type: Document["type"]) => {
    switch (type) {
      case "audio":
        return AudioLinesIcon;
      default:
        return FileTextIcon;
    }
  };

  if (documents.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-16 text-center transition-colors hover:border-primary/30">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <FileTextIcon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-base font-medium mb-1">
          {isFiltered ? "No matching documents" : "No documents yet"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isFiltered 
            ? "Try adjusting your search or filters" 
            : "Upload PDFs, Word docs, or audio files for the chatbot"}
        </p>
      </div>
    );
  }

  const handleBulkDelete = () => {
    if (selectedIds.size > 0) {
      const count = selectedIds.size;
      selectedIds.forEach(id => onDelete(id));
      setSelectedIds(new Set());
      toast.success(`Deleted ${count} ${count === 1 ? 'document' : 'documents'}`);
    }
  };

  return (
    <>
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <TrashIcon className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onDelete={onDelete}
            deletingId={deletingId}
            onSetDeletingId={setDeletingId}
          />
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={selectedIds.size === documents.length && documents.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(documents.map(d => d.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                className="rounded border-gray-300 text-primary focus:ring-primary/20"
              />
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Size</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Uploaded</th>
            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.type);
            return (
              <tr key={doc.id} className="group border-b hover:bg-muted/10 transition-all duration-200">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedIds);
                      if (e.target.checked) {
                        newSelected.add(doc.id);
                      } else {
                        newSelected.delete(doc.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary/20"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                      doc.type === "audio" ? "bg-purple-50 text-purple-600 group-hover:bg-purple-100" :
                      doc.type === "pdf" ? "bg-red-50 text-red-600 group-hover:bg-red-100" :
                      "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">{doc.name}</span>
                      {/* NEW badge for recent files */}
                      {new Date().getTime() - doc.uploadedAt.getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                          NEW
                        </span>
                      )}
                      {/* Warning for large files */}
                      {doc.size > 8 * 1024 * 1024 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                          LARGE
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-sm",
                    doc.size > 9.5 * 1024 * 1024 ? "text-destructive font-medium" :
                    doc.size > 8 * 1024 * 1024 ? "text-amber-600 font-medium" :
                    "text-muted-foreground"
                  )}>
                    {formatFileSize(doc.size)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => {
                        // Copy shareable link
                        const link = `https://tsa-bot.vercel.app/docs/${doc.id}`;
                        navigator.clipboard.writeText(link);
                        toast.success("Link copied to clipboard", { position: "top-right" });
                      }}
                    >
                      <Link2Icon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => {
                        // Simulate download
                        const link = document.createElement('a');
                        link.href = '#'; // In production, this would be the file URL
                        link.download = doc.name;
                        link.click();
                        toast.success(`Downloaded ${doc.name}`, { position: "top-right" });
                      }}
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 transition-all duration-200",
                        deletingId === doc.id 
                          ? "text-destructive-foreground bg-destructive hover:bg-destructive/90" 
                          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      )}
                      onClick={() => {
                        if (deletingId === doc.id) {
                          onDelete(doc.id);
                          setDeletingId(null);
                        } else {
                          setDeletingId(doc.id);
                        }
                      }}
                    >
                      {deletingId === doc.id ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
