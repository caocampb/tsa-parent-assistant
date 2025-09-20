"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LockIcon } from "lucide-react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const auth = sessionStorage.getItem("admin-auth");
    if (auth === "authenticated") {
      window.location.href = '/admin/documents';
    }
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      sessionStorage.setItem("admin-auth", "authenticated");
      window.location.href = '/admin/documents';
    } else {
      setError(true);
      setPassword("");
    }
  };

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