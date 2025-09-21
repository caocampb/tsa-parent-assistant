import { describe, test, expect } from "bun:test";

// Test the actual API endpoint with real questions
describe("Parent Flow - Critical Questions", () => {
  const API_URL = "http://localhost:3000/api/q";

  test("Spring registration question", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "When does spring registration open?",
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

    expect(fullText).toContain("January 5, 2025");
    expect(fullText).toContain("9:00 AM");
  });

  test("Pricing information", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "How much does it cost?",
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

    expect(fullText).toContain("$200");
    expect(fullText).toContain("month");
  });

  test("Contact information", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What's the phone number?",
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

    expect(fullText).toContain("(512) 555-0199");
  });

  test("Practice schedule for age group", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "When is practice for 7 year olds?",
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

    expect(fullText.toLowerCase()).toContain("monday");
    expect(fullText.toLowerCase()).toContain("wednesday");
    expect(fullText).toContain("4:00");
    expect(fullText).toContain("6:00");
  });

  test("Payment methods", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Can I pay with credit card?",
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

    expect(fullText.toLowerCase()).toContain("credit");
    expect(fullText.toLowerCase()).toContain("payment");
  });

  test("Handles unknown questions gracefully", async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What is quantum physics?",
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

    expect(fullText).toContain("(512) 555-0199");
    expect(fullText).not.toContain("Error");
    expect(fullText).not.toContain("error");
  });
});
