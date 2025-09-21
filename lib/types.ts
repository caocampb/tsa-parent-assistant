// Types for TSA Q&A System

export interface Question {
  id: string;
  text: string;
  slug: string;
  category: "schedule" | "policy" | "registration" | "uniform" | "payment" | "general" | "platform" | "academic";
  popularity: number; // For sorting popular questions
}

export interface Answer {
  id: string;
  questionId: string;
  content: string;
  sources: Source[];
  relatedQuestions: Question[];
  updatedAt: Date;
}

export interface Source {
  id: string;
  title: string;
  type: "pdf" | "docx" | "audio" | "transcript";
  pageNumber?: number;
  timestamp?: string; // For audio sources
  url?: string;
}

export interface SearchResult {
  question: Question;
  answer: Answer;
  confidence: number;
}

// Popular questions for the landing page
export const popularQuestions: Question[] = [
  {
    id: "1",
    text: "How much does TSA cost?",
    slug: "tsa-tuition-cost",
    category: "payment",
    popularity: 95
  },
  {
    id: "2",
    text: "What is Dash?",
    slug: "what-is-dash",
    category: "platform",
    popularity: 90
  },
  {
    id: "3",
    text: "When does spring registration open?",
    slug: "spring-registration-dates",
    category: "registration",
    popularity: 85
  },
  {
    id: "4",
    text: "What are the practice schedules?",
    slug: "practice-schedules",
    category: "schedule",
    popularity: 80
  },
  {
    id: "5",
    text: "How does MAP testing work?",
    slug: "map-testing-explained",
    category: "academic",
    popularity: 75
  },
  {
    id: "6",
    text: "Is there homework?",
    slug: "homework-policy",
    category: "academic",
    popularity: 70
  }
];

// Mock answer data for development
export const mockAnswers: Record<string, Answer> = {
  "fall-registration-dates": {
    id: "a1",
    questionId: "1",
    content: "Fall registration at Texas Sports Academy typically opens in early August. For 2025, registration will begin on **August 5th at 9:00 AM CST**. Early bird pricing is available until August 15th, with a $25 discount per class. Classes begin the week of September 8th.",
    sources: [
      {
        id: "s1",
        title: "2025 Academic Calendar",
        type: "pdf",
        pageNumber: 3
      },
      {
        id: "s2",
        title: "Parent Handbook",
        type: "pdf",
        pageNumber: 12
      }
    ],
    relatedQuestions: [
      popularQuestions[1], // Tuition fees
      popularQuestions[5], // Holiday closures
    ],
    updatedAt: new Date("2025-01-15")
  },
  "tuition-fees-included": {
    id: "a2",
    questionId: "2",
    content: "TSA tuition includes all instruction, facility usage, and basic equipment during class time. It does **not** include team uniforms, competition fees, or special equipment for home practice. Payment plans are available with a $10/month administrative fee.",
    sources: [
      {
        id: "s3",
        title: "Fee Schedule 2025",
        type: "pdf",
        pageNumber: 1
      }
    ],
    relatedQuestions: [
      popularQuestions[0], // Registration
      popularQuestions[2], // Uniforms
    ],
    updatedAt: new Date("2025-01-10")
  }
};
