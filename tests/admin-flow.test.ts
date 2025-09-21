import { describe, test, expect } from "bun:test";

describe("Admin Flow - Q&A Management", () => {
  const BASE_URL = "http://localhost:3000";
  
  test("Can add and retrieve Q&A pairs", async () => {
    // Add a Q&A pair
    const addResponse = await fetch(`${BASE_URL}/api/qa-pairs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Test practice schedule question",
        answer: "Practice is Monday and Wednesday from 4-6pm",
        category: "schedule",
        audience: "parent"
      })
    });

    expect(addResponse.status).toBe(200);
    const newQA = await addResponse.json();
    expect(newQA.id).toBeDefined();

    // Verify it appears in the list
    const listResponse = await fetch(`${BASE_URL}/api/qa-pairs?audience=parent`);
    const qaPairs = await listResponse.json();
    
    const found = qaPairs.find((qa: any) => qa.id === newQA.id);
    expect(found).toBeDefined();
    expect(found.question).toBe("Test practice schedule question");

    // Test that parent gets this answer
    const qaResponse = await fetch(`${BASE_URL}/api/q`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Test practice schedule question",
        audience: "parent"
      })
    });

    const reader = qaResponse.body?.getReader();
    let fullText = "";
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += new TextDecoder().decode(value);
    }

    expect(fullText).toContain("Monday and Wednesday");
    expect(fullText).toContain("4-6pm");

    // Clean up - delete the test Q&A
    const deleteResponse = await fetch(`${BASE_URL}/api/qa-pairs/${newQA.id}`, {
      method: "DELETE"
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("Can update Q&A pairs", async () => {
    // First add a Q&A
    const addResponse = await fetch(`${BASE_URL}/api/qa-pairs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Original question about fees",
        answer: "Original answer",
        category: "pricing",
        audience: "parent"
      })
    });

    const qa = await addResponse.json();

    // Update it
    const updateResponse = await fetch(`${BASE_URL}/api/qa-pairs/${qa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: "Updated answer: $200/month"
      })
    });

    expect(updateResponse.status).toBe(200);

    // Verify update
    const listResponse = await fetch(`${BASE_URL}/api/qa-pairs?audience=parent`);
    const qaPairs = await listResponse.json();
    
    const updated = qaPairs.find((item: any) => item.id === qa.id);
    expect(updated.answer).toBe("Updated answer: $200/month");

    // Clean up
    await fetch(`${BASE_URL}/api/qa-pairs/${qa.id}`, { method: "DELETE" });
  });

  test("Feedback system works", async () => {
    // Submit feedback
    const feedbackResponse = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Test question with bad answer",
        answer: "This is a bad answer",
        feedback: false,
        audience: "parent",
        messageId: "test-message-id",
        chunkMetadata: {
          chunks: ["chunk1", "chunk2"],
          similarity: 0.8
        }
      })
    });

    expect(feedbackResponse.status).toBe(200);
  });
});
