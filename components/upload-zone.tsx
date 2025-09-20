"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadIcon, FileIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileWithProgress extends File {
  progress?: number;
  speed?: number;
  timeRemaining?: string;
}

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
}

export function UploadZone({ 
  onUpload, 
  accept = ".pdf,.docx,.doc,.txt,.mp3,.m4a,.wav",
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = true 
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `${file.name} exceeds 10MB limit`;
    }
    return null;
  };

  const handleFiles = useCallback((fileList: FileList) => {
    setError(null);
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors[0]); // Show first error
    }

    if (validFiles.length > 0) {
      // Convert to plain objects with File properties we need
      const fileObjects = validFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        _file: file, // Keep original File object for upload
        progress: undefined,
        speed: undefined,
        timeRemaining: undefined
      }));
      setFiles(fileObjects as any);
    }
  }, [maxSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleUpload = async () => {
    if (files.length > 0 && !isUploading) {
      setIsUploading(true);
      
      // Simulate upload progress
      const uploadFiles = [...files];
      
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        const fileSize = file?.size || 0;
        const startTime = Date.now();
        
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = (fileSize * (progress / 100)) / elapsed;
          const remaining = ((fileSize - (fileSize * (progress / 100))) / speed);
          
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              progress,
              speed: speed / (1024 * 1024), // MB/s
              timeRemaining: remaining > 60 ? `${Math.floor(remaining / 60)}m` : `${Math.floor(remaining)}s`
            } : f
          ));
        }
      }
      
      // Complete upload
      setTimeout(() => {
        // Extract original File objects
        const originalFiles = files.map(f => (f as any)._file || f).filter(Boolean);
        onUpload(originalFiles);
        setFiles([]);
        setIsUploading(false);
      }, 500);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border",
          "cursor-pointer group"
        )}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4 p-12 pointer-events-none">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
            isDragging ? "bg-primary text-primary-foreground scale-110" : "bg-muted"
          )}>
            <UploadIcon className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className={cn(
              "text-sm font-medium transition-colors duration-200",
              isDragging && "text-primary"
            )}>
              {isDragging ? "Release to upload" : "Drop files or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, TXT, MP3, M4A • Max 10MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ready to upload</p>
            <span className="text-xs text-muted-foreground">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="group flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md",
                    (file?.type?.includes("pdf") || file?.name?.endsWith(".pdf")) ? "bg-red-50 text-red-600" :
                    (file?.type?.includes("audio") || file?.name?.match(/\.(mp3|m4a|wav)$/i)) ? "bg-purple-50 text-purple-600" :
                    (file?.name?.endsWith(".txt")) ? "bg-green-50 text-green-600" :
                    "bg-blue-50 text-blue-600"
                  )}>
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file?.name || 'Unknown file'}</p>
                    {file.progress !== undefined && file.progress < 100 ? (
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{file.progress}% • {file.speed?.toFixed(1)} MB/s</span>
                          <span>{file.timeRemaining}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button 
            onClick={handleUpload} 
            className="w-full"
            disabled={isUploading}
          >
            {isUploading ? (
              <>Uploading...</>
            ) : (
              <>Upload {files.length} {files.length === 1 ? "file" : "files"}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
