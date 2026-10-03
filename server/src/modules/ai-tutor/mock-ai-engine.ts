import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("mock-ai-engine");

interface AIResponse {
  content: string;
  messageType: string;
  confidence: number;
  sources: string[];
}

interface HintRequest {
  topic: string;
  subtopic?: string;
  currentLevel: number;
}

interface SocraticRequest {
  topic: string;
  studentAnswer?: string;
  conversationHistory: string[];
}

const NURSING_RESPONSES: Record<string, string[]> = {
  "vital signs": [
    "Vital signs are fundamental indicators of a patient's physiological status. What specific vital sign are you asking about?",
    "Normal adult vital signs include: BP 120/80 mmHg, HR 60-100 bpm, RR 12-20 breaths/min, Temp 36.5-37.5°C, SpO2 95-100%. Which one would you like to discuss?",
    "When assessing vital signs, always consider the patient's baseline and age-specific norms. What's your patient's age group?",
  ],
  "medication": [
    "Medication safety follows the 10 Rights: Right patient, drug, dose, route, time, documentation, reason, response, to refuse, and education. Which aspect would you like to explore?",
    "Always double-check medications before administration. What type of medication are you asking about?",
    "Drug interactions are critical to understand. Are you asking about a specific medication combination?",
  ],
  "assessment": [
    "Nursing assessment involves systematic data collection. What body system are you focusing on?",
    "A head-to-toe assessment follows a systematic approach. Would you like me to walk you through the steps?",
    "Documentation of assessment findings is crucial. What format does your facility use?",
  ],
  "nursing process": [
    "The nursing process has 5 steps: Assessment, Diagnosis, Planning, Implementation, and Evaluation. Which step would you like to discuss?",
    "Critical thinking is essential in applying the nursing process. What clinical scenario are you considering?",
    "NANDA diagnoses help standardize nursing care. Would you like examples of common diagnoses?",
  ],
  "clinical": [
    "Clinical reasoning involves analyzing patient data to make care decisions. What clinical situation are you working through?",
    "Prioritization in clinical settings follows Maslow's hierarchy and ABCs. How would you prioritize these patient needs?",
    "Evidence-based practice guides clinical decisions. What evidence supports your approach?",
  ],
  "community health": [
    "Community health nursing focuses on population health. What community setting are you interested in?",
    "Health promotion and disease prevention are key in community health. What health topic would you like to discuss?",
    "Epidemiology helps understand disease patterns in communities. What health issue are you studying?",
  ],
  "pediatrics": [
    "Pediatric nursing requires age-appropriate care. What age group are you asking about?",
    "Growth and development milestones guide pediatric assessment. Which developmental stage interests you?",
    "Family-centered care is essential in pediatrics. How do you involve families in care?",
  ],
  "obstetric": [
    "Obstetric nursing covers pregnancy, labor, and postpartum. What phase are you asking about?",
    "Fetal assessment includes monitoring heart rate patterns. What FHR pattern would you like to understand?",
    "Maternal assessment is crucial for safe delivery. What aspect of maternal care interests you?",
  ],
};

const SOCRATIC_QUESTIONS: Record<string, string[]> = {
  "vital signs": [
    "What do you think would happen if this patient's blood pressure dropped suddenly?",
    "How would you determine if these vital signs are abnormal for this patient?",
    "What other assessments would you perform based on these vital sign findings?",
  ],
  "medication": [
    "Why do you think this medication is prescribed for this patient?",
    "What would you do if the patient refused this medication?",
    "How would you evaluate the effectiveness of this medication?",
  ],
  "assessment": [
    "What findings would concern you most in this assessment?",
    "How would you prioritize your assessment findings?",
    "What additional information would help you make a clinical judgment?",
  ],
  "nursing process": [
    "Based on your assessment, what nursing diagnosis would you consider?",
    "How would you evaluate if your interventions are effective?",
    "What outcome would you expect for this patient?",
  ],
  "clinical": [
    "What is your clinical reasoning for choosing this intervention?",
    "What evidence supports your clinical decision?",
    "How would you handle a conflicting clinical situation?",
  ],
};

const HINT_TEMPLATES: Record<string, string[]> = {
  "vital signs": [
    "Think about what each vital sign tells you about the body systems.",
    "Consider the normal ranges and what deviations might indicate.",
    "Remember that vital signs should be interpreted in context with the patient's condition.",
  ],
  "medication": [
    "Consider the mechanism of action and how it affects the patient.",
    "Think about potential side effects and nursing implications.",
    "Remember the importance of patient education about medications.",
  ],
  "assessment": [
    "Start with the most critical findings and work systematically.",
    "Consider both subjective and objective data in your assessment.",
    "Think about how findings relate to the patient's chief complaint.",
  ],
};

export function generateAIResponse(userMessage: string, conversationHistory: string[]): AIResponse {
  const lowerMessage = userMessage.toLowerCase();
  let response = "I understand you're asking about nursing concepts. Could you provide more specific details so I can better assist you?";
  let confidence = 0.5;
  const sources: string[] = [];

  for (const [topic, responses] of Object.entries(NURSING_RESPONSES)) {
    if (lowerMessage.includes(topic)) {
      response = responses[Math.floor(Math.random() * responses.length)];
      confidence = 0.8;
      sources.push(`learning_material:${topic}`);
      break;
    }
  }

  if (lowerMessage.includes("help") || lowerMessage.includes("explain")) {
    response = "I'm here to help you understand nursing concepts. Let me guide you through this step by step. What specific aspect would you like to focus on?";
    confidence = 0.7;
  }

  if (lowerMessage.includes("hint")) {
    response = "Let me give you a hint: Consider the underlying pathophysiology and how it relates to the clinical presentation. What do you think is happening?";
    confidence = 0.6;
  }

  if (conversationHistory.length > 2) {
    response += "\n\nBased on our previous discussion, would you like to explore this topic further or move on to something new?";
  }

  logger.debug({ userMessage: userMessage.substring(0, 100), topic: sources[0] }, "AI response generated");

  return {
    content: response,
    messageType: "TEXT",
    confidence,
    sources,
  };
}

export function generateSocraticResponse(request: SocraticRequest): AIResponse {
  const { topic, studentAnswer, conversationHistory } = request;
  const lowerTopic = topic.toLowerCase();

  const questions = SOCRATIC_QUESTIONS[lowerTopic] || SOCRATIC_QUESTIONS["clinical"] || [
    "What do you think about this situation?",
    "How would you approach this clinical problem?",
    "What evidence supports your thinking?",
  ];

  let response: string;

  if (!studentAnswer) {
    response = `Let's think about this together. ${questions[0]}`;
  } else {
    const followUp = questions[Math.min(conversationHistory.length, questions.length - 1)];
    if (studentAnswer.toLowerCase().includes("yes") || studentAnswer.toLowerCase().includes("correct")) {
      response = `Good thinking! Now, ${followUp}`;
    } else {
      response = `Let's reconsider. ${followUp}`;
    }
  }

  return {
    content: response,
    messageType: "SOCRATIC",
    confidence: 0.75,
    sources: [`socratic:${topic}`],
  };
}

export function generateHint(request: HintRequest): AIResponse {
  const { topic, currentLevel } = request;
  const lowerTopic = topic.toLowerCase();

  const hints = HINT_TEMPLATES[lowerTopic] || [
    "Consider the fundamental principles involved.",
    "Think about how this relates to patient outcomes.",
    "What does the evidence say about this topic?",
  ];

  const hintIndex = Math.min(currentLevel - 1, hints.length - 1);
  const response = hints[hintIndex];

  return {
    content: response,
    messageType: "HINT",
    confidence: 0.7,
    sources: [`hint:${topic}:level${currentLevel}`],
  };
}

export function generateLessonAssistance(lessonTitle: string, lessonContent: string, question: string): AIResponse {
  const response = `Regarding "${lessonTitle}": Based on the lesson content, I can help clarify concepts. Your question about "${question}" relates to key nursing principles. Let me explain this in the context of what you've learned.

The lesson covers important fundamentals that form the basis for clinical practice. Understanding these concepts will help you provide safe, effective patient care. What specific aspect would you like me to elaborate on?`;

  return {
    content: response,
    messageType: "LESSON_ASSISTANCE",
    confidence: 0.8,
    sources: [`lesson:${lessonTitle}`],
  };
}
