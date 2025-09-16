"use client";

import { Button } from "@/components/ui/button";
import { FileTextIcon, AudioLinesIcon, TrashIcon, DownloadIcon, Link2Icon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "docx" | "audio";
  size: number;
  uploadedAt: Date;
}

interface DocumentCardProps {
  doc: Document;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onSetDeletingId: (id: string | null) => void;
}

export function DocumentCard({ doc, onDelete, deletingId, onSetDeletingId }: DocumentCardProps) {
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

  const Icon = getFileIcon(doc.type);

  return (
    <div className="p-4 border rounded-lg hover:bg-muted/10 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0",
            doc.type === "audio" ? "bg-purple-50 text-purple-600" :
            doc.type === "pdf" ? "bg-red-50 text-red-600" :
            "bg-blue-50 text-blue-600"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium font-mono truncate">{doc.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn(
                "text-xs",
                doc.size > 9.5 * 1024 * 1024 ? "text-destructive font-medium" :
                doc.size > 8 * 1024 * 1024 ? "text-amber-600 font-medium" :
                "text-muted-foreground"
              )}>
                {formatFileSize(doc.size)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(doc.uploadedAt)}
              </span>
            </div>
            {/* Badges */}
            <div className="flex items-center gap-2 mt-2">
              {new Date().getTime() - doc.uploadedAt.getTime() < 24 * 60 * 60 * 1000 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                  NEW
                </span>
              )}
              {doc.size > 8 * 1024 * 1024 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                  LARGE
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => {
            const link = `https://tsa-bot.vercel.app/docs/${doc.id}`;
            navigator.clipboard.writeText(link);
            toast.success("Link copied", { position: "top-right" });
          }}
        >
          <Link2Icon className="h-3.5 w-3.5 mr-1.5" />
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => {
            const link = document.createElement('a');
            link.href = '#';
            link.download = doc.name;
            link.click();
            toast.success(`Downloaded ${doc.name}`, { position: "top-right" });
          }}
        >
          <DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-3 text-xs ml-auto",
            deletingId === doc.id 
              ? "text-destructive-foreground bg-destructive hover:bg-destructive/90" 
              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          )}
          onClick={() => {
            if (deletingId === doc.id) {
              onDelete(doc.id);
              onSetDeletingId(null);
            } else {
              onSetDeletingId(doc.id);
            }
          }}
        >
          {deletingId === doc.id ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 mr-1.5" />
              Confirm
            </>
          ) : (
            <>
              <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
