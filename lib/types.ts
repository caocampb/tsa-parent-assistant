// Types for TSA Q&A System

export interface Question {
  id: string;
  text: string;
  slug: string;
  category: "schedule" | "policy" | "registration" | "uniform" | "payment" | "general";
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
    text: "When does fall registration open?",
    slug: "fall-registration-dates",
    category: "registration",
    popularity: 95
  },
  {
    id: "2",
    text: "What's included in tuition fees?",
    slug: "tuition-fees-included",
    category: "payment",
    popularity: 88
  },
  {
    id: "3",
    text: "Where can I order team uniforms?",
    slug: "team-uniform-ordering",
    category: "uniform",
    popularity: 82
  },
  {
    id: "4",
    text: "What is the absence and makeup policy?",
    slug: "absence-makeup-policy",
    category: "policy",
    popularity: 76
  },
  {
    id: "5",
    text: "How do I schedule a makeup class?",
    slug: "schedule-makeup-class",
    category: "schedule",
    popularity: 71
  },
  {
    id: "6",
    text: "What are the holiday closures for 2025?",
    slug: "holiday-closures-2025",
    category: "schedule",
    popularity: 68
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
