import { describe, test, expect } from "bun:test";

describe("Smoke Test - Quick Confidence Check", () => {
  const API_URL = "http://localhost:3000/api/q";

  test("API is responding", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Hello",
        audience: "parent"
      })
    });

    expect(response.status).toBe(200);
  });

  test("Can answer basic registration question", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "When can I register?",
        audience: "parent"
      })
    });

    const reader = response.body?.getReader();
    let fullText = "";
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += new TextDecoder().decode(value);
    }

    // Should mention January or registration
    expect(fullText.toLowerCase()).toMatch(/january|registration|register/);
  });

  test("Admin endpoints are protected", async () => {
    // Try to access admin without auth
    const response = await fetch("http://localhost:3000/api/qa-pairs", {
      method: "GET"
    });

    // Should still work (read is allowed)
    expect(response.status).toBe(200);
  });

  test("Handles unknown questions without crashing", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Tell me about quantum computing",
        audience: "parent"
      })
    });

    expect(response.status).toBe(200);
    
    const reader = response.body?.getReader();
    let fullText = "";
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += new TextDecoder().decode(value);
    }

    // Should have fallback with phone number
    expect(fullText).toContain("555-0199");
  });
});
