import { describe, test, expect } from "bun:test";

describe("Resilience - Error Handling", () => {
  const BASE_URL = "http://localhost:3000";

  test("Handles very long questions", async () => {
    const longQuestion = "What about " + "practice schedule and fees and registration and ".repeat(50);
    
    const response = await fetch(`${BASE_URL}/api/q`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: longQuestion,
        audience: "parent"
      })
    });

    // Should not crash, should return something
    expect(response.status).toBe(200);
    
    const reader = response.body?.getReader();
    let hasContent = false;
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) hasContent = true;
    }
    
    expect(hasContent).toBe(true);
  });

  test("Handles special characters in questions", async () => {
    const specialQuestion = "What's the cost? <script>alert('xss')</script> & fees?";
    
    const response = await fetch(`${BASE_URL}/api/q`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: specialQuestion,
        audience: "parent"
      })
    });

    expect(response.status).toBe(200);
  });

  test("Rejects huge file uploads", async () => {
    // Create a fake large file (10MB of text)
    const largeContent = "x".repeat(10 * 1024 * 1024);
    const blob = new Blob([largeContent], { type: "text/plain" });
    const file = new File([blob], "huge.txt", { type: "text/plain" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("audience", "parent");

    const response = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: "POST",
      body: formData
    });

    // Should reject files over 5MB
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("Rate limiting protection", async () => {
    // Send 10 requests rapidly
    const promises = Array(10).fill(0).map(() => 
      fetch(`${BASE_URL}/api/q`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Rate limit test",
          audience: "parent"
        })
      })
    );

    const responses = await Promise.all(promises);
    
    // All should complete without crashing
    responses.forEach(r => {
      expect(r.status).toBeLessThan(500); // No server errors
    });
  });

  test("Invalid JSON handling", async () => {
    const response = await fetch(`${BASE_URL}/api/q`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json"
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  test("Missing required fields", async () => {
    const response = await fetch(`${BASE_URL}/api/q`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Missing question field
        audience: "parent"
      })
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
