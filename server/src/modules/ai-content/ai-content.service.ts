import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  courses,
  questions,
  questionOptions,
  aiGeneratedQuestions,
  aiGeneratedCases,
  aiGeneratedStudyGuides,
  aiContentApprovalHistory,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import { isGeminiConfigured, generateQuestions as geminiGenerateQuestions, generateText } from "../../services/gemini.service.js";

const logger = createChildLogger("ai-content-service");

// ─── Gemini-Powered Generators ──────────────────────────────────────────────

async function generateGeminiQuestion(topic: string, type: string, difficulty: string, count: number) {
  const types = type === "MC" ? "MULTIPLE_CHOICE" : type === "TF" ? "TRUE_FALSE" : "MULTIPLE_CHOICE";
  const result = await geminiGenerateQuestions(
    `Nursing topic: "${topic}". Generate questions specifically about ${topic} in the context of BSN nursing education in the Philippines.`,
    { count, difficulty: difficulty as "EASY" | "MEDIUM" | "HARD", types: [types as "MULTIPLE_CHOICE" | "TRUE_FALSE"] }
  );
  return result.map((q) => ({
    questionText: q.stem,
    questionType: q.type === "TRUE_FALSE" ? "TF" : "MC",
    options: q.options.map((o) => o.optionText),
    correctAnswer: q.options.find((o) => o.isCorrect)?.optionText || "",
    explanation: q.explanation || q.rationale,
    difficulty: q.difficulty,
  }));
}

async function generateGeminiCase(title: string, difficulty: string, focusArea?: string) {
  const prompt = `Create a nursing clinical case study about "${title}"${focusArea ? ` focusing on ${focusArea}` : ""}. Difficulty: ${difficulty}.

Return JSON:
{
  "title": "${title}",
  "description": "Case description",
  "patientProfile": { "age": 45, "gender": "Female", "medicalHistory": ["condition1", "condition2"] },
  "clinicalPresentation": "Patient presents with...",
  "stages": [{ "stage": 1, "description": "Assessment", "actions": ["action1"] }],
  "learningObjectives": ["objective1", "objective2"],
  "difficulty": "${difficulty}"
}`;

  const result = await generateText(prompt);
  return JSON.parse(result.replace(/```json\s*/g, "").replace(/```/g, ""));
}

async function generateGeminiStudyGuide(title: string, topic: string, includePractice: boolean) {
  const prompt = `Create a nursing study guide for "${title}" about ${topic}.

Return JSON:
{
  "title": "${title}",
  "content": "Full study guide content in markdown",
  "summary": "Brief summary",
  "keyPoints": ["point1", "point2"],
  "practiceQuestions": ${includePractice ? '[{ "q": "question", "answer": "answer" }]' : "[]"}
}`;

  const result = await generateText(prompt);
  return JSON.parse(result.replace(/```json\s*/g, "").replace(/```/g, ""));
}

// ─── Mock Fallback Generators ───────────────────────────────────────────────

function generateMockQuestion(topic: string, type: string, difficulty: string) {
  const templates: Record<string, { q: string; options: string[]; correct: string; explanation: string }[]> = {
    "vital signs": [
      { q: "What is the normal respiratory rate for an adult?", options: ["8-12 breaths/min", "12-20 breaths/min", "20-30 breaths/min", "30-40 breaths/min"], correct: "12-20 breaths/min", explanation: "Normal adult respiratory rate is 12-20 breaths per minute." },
      { q: "Which vital sign is the first to change in shock?", options: ["Blood pressure", "Heart rate", "Temperature", "Respiratory rate"], correct: "Heart rate", explanation: "Heart rate increases as a compensatory mechanism in early shock." },
      { q: "What is the normal body temperature range for adults?", options: ["35.5-36.5°C", "36.1-37.2°C", "37.0-38.0°C", "38.0-39.0°C"], correct: "36.1-37.2°C", explanation: "Normal oral temperature ranges from 36.1°C to 37.2°C." },
      { q: "What is the normal adult blood pressure range?", options: ["90/60 mmHg", "120/80 mmHg", "140/90 mmHg", "160/100 mmHg"], correct: "120/80 mmHg", explanation: "Normal blood pressure is less than 120/80 mmHg." },
      { q: "What is the normal pulse rate for an adult at rest?", options: ["40-60 bpm", "60-100 bpm", "100-120 bpm", "120-140 bpm"], correct: "60-100 bpm", explanation: "Normal adult resting heart rate is 60-100 beats per minute." },
      { q: "What is the priority vital sign to monitor in a postoperative patient?", options: ["Temperature", "Blood pressure", "Oxygen saturation", "All are equally important"], correct: "Oxygen saturation", explanation: "Oxygen saturation is critical postoperatively due to anesthesia effects on respiratory function." },
    ],
    medication: [
      { q: "What is the first check in the 10 Rights of medication administration?", options: ["Right drug", "Right patient", "Right dose", "Right time"], correct: "Right patient", explanation: "Always verify patient identity first." },
      { q: "Which route of medication administration has the fastest onset?", options: ["Oral", "Intramuscular", "Intravenous", "Subcutaneous"], correct: "Intravenous", explanation: "IV administration delivers medication directly into the bloodstream for immediate effect." },
      { q: "What should the nurse do if a medication is not available?", options: ["Substitute with a similar drug", "Contact the physician", "Withhold and document", "Ask another nurse"], correct: "Contact the physician", explanation: "Never substitute medications without physician authorization." },
      { q: "What is the minimum time interval between two oral medications?", options: ["15 minutes", "30 minutes", "1 hour", "2 hours"], correct: "30 minutes", explanation: "A 30-minute interval allows proper absorption and prevents drug interactions." },
      { q: "When checking medication against the MAR, how many checks are required?", options: ["1 check", "2 checks", "3 checks", "5 checks"], correct: "3 checks", explanation: "Three checks ensure the right patient, right drug, right dose, right time, and right route." },
    ],
    assessment: [
      { q: "What does the nursing assessment prioritize?", options: ["Subjective data only", "Objective data only", "Both subjective and objective data", "Neither"], correct: "Both subjective and objective data", explanation: "Complete assessment includes both patient-reported and observed data." },
      { q: "What is the first step in the nursing process?", options: ["Planning", "Assessment", "Implementation", "Evaluation"], correct: "Assessment", explanation: "Assessment is the foundation of the nursing process." },
      { q: "Which assessment technique involves listening with a stethoscope?", options: ["Inspection", "Palpation", "Percussion", "Auscultation"], correct: "Auscultation", explanation: "Auscultation uses a stethoscope to listen to body sounds." },
      { q: "What type of data is obtained through patient interviews?", options: ["Objective data", "Subjective data", "Primary data", "Both B and C"], correct: "Both B and C", explanation: "Patient interviews yield subjective data (patient's words) and are a primary data source." },
    ],
    anatomy: [
      { q: "What is the largest organ in the human body?", options: ["Heart", "Liver", "Skin", "Brain"], correct: "Skin", explanation: "The skin is the largest organ, covering approximately 20 square feet in adults." },
      { q: "How many chambers does the human heart have?", options: ["2", "3", "4", "5"], correct: "4", explanation: "The heart has 4 chambers: right atrium, right ventricle, left atrium, and left ventricle." },
      { q: "Which blood type is considered the universal donor?", options: ["A+", "B+", "AB+", "O-"], correct: "O-", explanation: "O- blood lacks A, B, and Rh antigens, making it compatible with all blood types." },
      { q: "What is the primary function of red blood cells?", options: ["Fight infection", "Carry oxygen", "Clot blood", "Produce hormones"], correct: "Carry oxygen", explanation: "Red blood cells contain hemoglobin that transports oxygen from lungs to tissues." },
    ],
    pharmacology: [
      { q: "What is the antidote for acetaminophen overdose?", options: ["Atropine", "Naloxone", "Acetylcysteine", "Flumazenil"], correct: "Acetylcysteine", explanation: "Acetylcysteine (Mucomyst) replenishes glutathione stores to prevent liver damage." },
      { q: "Which drug class is used to treat hypertension?", options: ["Antibiotics", "ACE inhibitors", "Antihistamines", "Antacids"], correct: "ACE inhibitors", explanation: "ACE inhibitors block angiotensin-converting enzyme to lower blood pressure." },
      { q: "What is the therapeutic range for lithium?", options: ["0.3-0.8 mEq/L", "0.6-1.2 mEq/L", "1.0-2.0 mEq/L", "2.0-4.0 mEq/L"], correct: "0.6-1.2 mEq/L", explanation: "Lithium has a narrow therapeutic index; levels above 1.5 mEq/L are toxic." },
      { q: "Which insulin type has the fastest onset?", options: ["Regular", "NPH", "Insulin glargine", "Insulin lispro"], correct: "Insulin lispro", explanation: "Rapid-acting insulin (lispro) onset is 10-30 minutes, faster than regular insulin." },
    ],
    nursing: [
      { q: "What is the primary role of a professional nurse?", options: ["Diagnose diseases", "Administer medications only", "Advocate for patient welfare", "Supervise other staff"], correct: "Advocate for patient welfare", explanation: "Nursing advocacy ensures patient rights, safety, and well-being are prioritized." },
      { q: "What is the correct order for donning PPE?", options: ["Gown → Mask → Gloves → Goggles", "Mask → Gown → Gloves → Goggles", "Goggles → Mask → Gown → Gloves", "Gloves → Gown → Mask → Goggles"], correct: "Gown → Mask → Gloves → Goggles", explanation: "PPE is donned from least to most contaminated: gown, mask, goggles, gloves." },
      { q: "What is the purpose of informed consent?", options: ["Protect the hospital", "Ensure patient autonomy", "Reduce liability", "Satisfy legal requirements"], correct: "Ensure patient autonomy", explanation: "Informed consent respects the patient's right to make decisions about their care." },
      { q: "What is the most effective way to prevent healthcare-associated infections?", options: ["Antibiotics", "Hand hygiene", "Isolation", "Sterile equipment"], correct: "Hand hygiene", explanation: "Hand hygiene is the single most effective measure to prevent infection transmission." },
    ],
    ethics: [
      { q: "Which ethical principle refers to 'doing good' for the patient?", options: ["Autonomy", "Beneficence", "Non-maleficence", "Justice"], correct: "Beneficence", explanation: "Beneficence means acting in the patient's best interest." },
      { q: "What does 'do no harm' refer to in nursing ethics?", options: ["Beneficence", "Non-maleficence", "Autonomy", "Justice"], correct: "Non-maleficence", explanation: "Non-maleficence is the duty to avoid causing harm to patients." },
      { q: "Which principle ensures fair distribution of resources?", options: ["Autonomy", "Beneficence", "Fidelity", "Justice"], correct: "Justice", explanation: "Justice requires equitable treatment and fair allocation of healthcare resources." },
    ],
    fundamentals: [
      { q: "What is the correct position for a patient experiencing dyspnea?", options: ["Trendelenburg", "Supine", "Fowler's position", "Prone"], correct: "Fowler's position", explanation: "Fowler's position (45-60°) promotes lung expansion and eases breathing." },
      { q: "What is the purpose of aseptic technique?", options: ["Speed up procedures", "Prevent infection", "Reduce costs", "Simplify tasks"], correct: "Prevent infection", explanation: "Aseptic technique prevents the introduction of microorganisms into sterile areas." },
      { q: "How often should oral care be provided for a bedridden patient?", options: ["Once daily", "Every shift", "Twice daily", "Weekly"], correct: "Every shift", explanation: "Oral care every shift prevents oral infections and promotes comfort." },
      { q: "What is the normal pH range of arterial blood?", options: ["7.0-7.2", "7.35-7.45", "7.5-7.7", "6.8-7.0"], correct: "7.35-7.45", explanation: "Arterial blood pH of 7.35-7.45 indicates normal acid-base balance." },
    ],
  };

  const topicLower = topic.toLowerCase();
  let topicTemplates = templates[topicLower];

  if (!topicTemplates) {
    const matchedKey = Object.keys(templates).find((key) => topicLower.includes(key) || key.includes(topicLower));
    topicTemplates = matchedKey ? templates[matchedKey] : Object.values(templates).flat();
  }

  const template = topicTemplates[Math.floor(Math.random() * topicTemplates.length)];

  return {
    questionText: template.q,
    questionType: type,
    options: template.options,
    correctAnswer: template.correct,
    explanation: template.explanation,
    difficulty,
  };
}

function generateMockCase(title: string, difficulty: string, focusArea?: string) {
  return {
    title,
    description: `A clinical case focusing on ${focusArea || "general nursing care"}. This case presents a patient scenario that requires critical thinking and application of nursing knowledge.`,
    patientProfile: {
      age: Math.floor(Math.random() * 60) + 20,
      gender: Math.random() > 0.5 ? "Male" : "Female",
      medicalHistory: ["Hypertension", "Diabetes"],
    },
    clinicalPresentation: `Patient presents with symptoms related to ${focusArea || "the assigned condition"}. Vital signs show mild abnormalities requiring nursing intervention.`,
    stages: [
      { stage: 1, description: "Initial assessment and data collection", actions: ["Take vital signs", "Perform head-to-toe assessment"] },
      { stage: 2, description: "Nursing diagnosis and planning", actions: ["Identify nursing diagnoses", "Set priorities"] },
      { stage: 3, description: "Implementation and evaluation", actions: ["Implement interventions", "Evaluate outcomes"] },
    ],
    learningObjectives: [
      "Apply systematic assessment techniques",
      "Formulate appropriate nursing diagnoses",
      "Implement evidence-based interventions",
    ],
    difficulty,
  };
}

function generateMockStudyGuide(title: string, topic: string, includePractice: boolean) {
  const content = `# ${title}\n\n## Overview\nThis study guide covers essential concepts related to ${topic} in nursing practice.\n\n## Key Concepts\n\n### 1. Fundamental Principles\n${topic} is a critical area of nursing that requires thorough understanding of underlying principles.\n\n### 2. Clinical Application\nApply theoretical knowledge to practical patient care scenarios.\n\n### 3. Evidence-Based Practice\nUse current research to guide nursing interventions.\n\n## Summary\nMastering ${topic} is essential for providing safe, effective patient care.`;

  return {
    title,
    content,
    summary: `A comprehensive study guide covering ${topic} fundamentals and clinical applications.`,
    keyPoints: [
      `Understanding the fundamentals of ${topic}`,
      `Key concepts and principles related to ${topic}`,
      `Clinical applications and nursing implications`,
      `Evidence-based practice guidelines for ${topic}`,
    ],
    practiceQuestions: includePractice ? [
      { q: `What are the key components of ${topic}?`, answer: "Consider the fundamental principles and clinical applications." },
      { q: `How does ${topic} affect patient outcomes?`, answer: "Think about evidence-based interventions and their impact." },
    ] : [],
  };
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function listQuestions(query: { courseId?: string; instructorId?: string; status?: string; topic?: string; page: number; limit: number }) {
  const { courseId, instructorId, status, topic, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (courseId) conditions.push(eq(aiGeneratedQuestions.courseId, courseId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (status) conditions.push(eq(aiGeneratedQuestions.status, status));
  if (topic) conditions.push(sql`${aiGeneratedQuestions.topic} ILIKE ${`%${topic}%`}`);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const useJoin = !!instructorId;
  const baseQuery = useJoin
    ? db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedQuestions).innerJoin(courses, eq(aiGeneratedQuestions.courseId, courses.id))
    : db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedQuestions);
  const [countResult] = await baseQuery.where(where);
  const rawItems = useJoin
    ? await db.select().from(aiGeneratedQuestions).innerJoin(courses, eq(aiGeneratedQuestions.courseId, courses.id)).where(where).orderBy(desc(aiGeneratedQuestions.createdAt)).limit(limit).offset(offset)
    : await db.select().from(aiGeneratedQuestions).where(where).orderBy(desc(aiGeneratedQuestions.createdAt)).limit(limit).offset(offset);
  const items = useJoin ? (rawItems as any[]).map((row) => row.ai_generated_questions) : rawItems;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function generateQuestions(data: { courseId?: string; topic: string; questionType?: string; difficulty?: string; count?: number; generatedBy?: string }) {
  const count = data.count || 1;
  let generated: Array<{ questionText: string; questionType: string; options: string[]; correctAnswer: string; explanation: string; difficulty: string }>;

  if (isGeminiConfigured()) {
    try {
      generated = await generateGeminiQuestion(data.topic, data.questionType || "MC", data.difficulty || "MEDIUM", count);
      logger.info({ topic: data.topic, count, engine: "gemini" }, "Questions generated via Gemini");
    } catch (err) {
      logger.warn({ err, topic: data.topic }, "Gemini failed, falling back to mock");
      generated = [];
      for (let i = 0; i < count; i++) {
        generated.push(generateMockQuestion(data.topic, data.questionType || "MC", data.difficulty || "MEDIUM"));
      }
    }
  } else {
    generated = [];
    for (let i = 0; i < count; i++) {
      generated.push(generateMockQuestion(data.topic, data.questionType || "MC", data.difficulty || "MEDIUM"));
    }
  }

  const seenStems = new Set<string>();
  const items = [];
  for (const mock of generated) {
    const stemLower = mock.questionText.trim().toLowerCase();
    if (seenStems.has(stemLower)) continue;

    const [existing] = await db.select({ id: aiGeneratedQuestions.id }).from(aiGeneratedQuestions)
      .where(and(eq(aiGeneratedQuestions.topic, data.topic), sql`lower(trim(${aiGeneratedQuestions.questionText})) = ${stemLower}`))
      .limit(1);
    if (existing) { seenStems.add(stemLower); continue; }

    seenStems.add(stemLower);
    const [item] = await db.insert(aiGeneratedQuestions).values({
      courseId: data.courseId ?? null,
      topic: data.topic,
      questionText: mock.questionText,
      questionType: mock.questionType,
      options: mock.options,
      correctAnswer: mock.correctAnswer,
      explanation: mock.explanation,
      difficulty: mock.difficulty,
      generatedBy: data.generatedBy ?? null,
      status: "PENDING",
    }).returning();

    await logAudit({ action: "CREATE", resource: "ai_content", resourceId: item.id, metadata: { type: "question", topic: data.topic, engine: isGeminiConfigured() ? "gemini" : "mock" } });
    items.push(item);
  }
  return items;
}

export async function reviewQuestion(id: string, data: { status: string; reviewNotes?: string; reviewedBy?: string }) {
  const [existing] = await db.select().from(aiGeneratedQuestions).where(eq(aiGeneratedQuestions.id, id));
  if (!existing) throw new NotFoundError("AI Generated Question");

  // Reject approval upfront when the stem already exists in the target course
  if (data.status === "APPROVED" && existing.courseId) {
    const [duplicate] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        sql`lower(${questions.stem}) = lower(${existing.questionText}) and ${questions.courseId} = ${existing.courseId}`
      )
      .limit(1);
    if (duplicate) throw new ConflictError("A question with this stem already exists in this course");
  }

  const [item] = await db.update(aiGeneratedQuestions).set({
    status: data.status,
    reviewNotes: data.reviewNotes ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiGeneratedQuestions.id, id)).returning();

  await db.insert(aiContentApprovalHistory).values({
    contentType: "QUESTION",
    contentId: id,
    action: data.status,
    reviewerId: data.reviewedBy ?? null,
    notes: data.reviewNotes ?? null,
  });

  if (data.status === "APPROVED" && existing.courseId) {
    const [question] = await db.insert(questions).values({
      courseId: existing.courseId,
      type: (existing.questionType as "MC" | "TF" | "ESSAY" | "FILL_BLANK" | "SCENARIO") ?? "MC",
      difficulty: (existing.difficulty as "EASY" | "MEDIUM" | "HARD") ?? "MEDIUM",
      stem: existing.questionText,
      explanation: existing.explanation ?? null,
      points: 1,
      createdBy: data.reviewedBy ?? null,
    }).returning();

    if (existing.options && Array.isArray(existing.options) && (existing.options as Array<unknown>).length > 0) {
      const rawOptions = existing.options as Array<string | { text: string; isCorrect: boolean }>;
      const correctAnswer = existing.correctAnswer ?? null;
      await db.insert(questionOptions).values(
        rawOptions.map((opt, idx) => {
          const text = typeof opt === "string" ? opt : opt.text;
          const isCorrect = typeof opt === "string" ? (correctAnswer ? text === correctAnswer : false) : opt.isCorrect;
          return { questionId: question.id, text, isCorrect, order: idx };
        })
      );
    }
  }

  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: item.id, metadata: { type: "question", status: data.status, reviewedBy: data.reviewedBy } });

  return item;
}

// ─── Cases ───────────────────────────────────────────────────────────────────

export async function listCases(query: { courseId?: string; instructorId?: string; status?: string; page: number; limit: number }) {
  const { courseId, instructorId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (courseId) conditions.push(eq(aiGeneratedCases.courseId, courseId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (status) conditions.push(eq(aiGeneratedCases.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const useJoin = !!instructorId;
  const baseQuery = useJoin
    ? db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedCases).innerJoin(courses, eq(aiGeneratedCases.courseId, courses.id))
    : db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedCases);
  const [countResult] = await baseQuery.where(where);
  const rawItems = useJoin
    ? await db.select().from(aiGeneratedCases).innerJoin(courses, eq(aiGeneratedCases.courseId, courses.id)).where(where).orderBy(desc(aiGeneratedCases.createdAt)).limit(limit).offset(offset)
    : await db.select().from(aiGeneratedCases).where(where).orderBy(desc(aiGeneratedCases.createdAt)).limit(limit).offset(offset);
  const items = useJoin ? (rawItems as any[]).map((row) => row.ai_generated_cases) : rawItems;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function generateCase(data: { courseId?: string; title: string; difficulty?: string; focusArea?: string; generatedBy?: string }) {
  let mock;
  if (isGeminiConfigured()) {
    try {
      mock = await generateGeminiCase(data.title, data.difficulty || "MEDIUM", data.focusArea);
    } catch (err) {
      logger.warn({ err }, "Gemini failed, falling back to mock");
      mock = generateMockCase(data.title, data.difficulty || "MEDIUM", data.focusArea);
    }
  } else {
    mock = generateMockCase(data.title, data.difficulty || "MEDIUM", data.focusArea);
  }

  const [item] = await db.insert(aiGeneratedCases).values({
    courseId: data.courseId ?? null,
    ...mock,
    generatedBy: data.generatedBy ?? null,
    status: "PENDING",
  }).returning();

  await logAudit({ action: "CREATE", resource: "ai_content", resourceId: item.id, metadata: { type: "case", title: data.title } });

  return item;
}

export async function reviewCase(id: string, data: { status: string; reviewNotes?: string; reviewedBy?: string }) {
  const [existing] = await db.select().from(aiGeneratedCases).where(eq(aiGeneratedCases.id, id));
  if (!existing) throw new NotFoundError("AI Generated Case");

  const [item] = await db.update(aiGeneratedCases).set({
    status: data.status,
    reviewNotes: data.reviewNotes ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiGeneratedCases.id, id)).returning();

  await db.insert(aiContentApprovalHistory).values({
    contentType: "CASE",
    contentId: id,
    action: data.status,
    reviewerId: data.reviewedBy ?? null,
    notes: data.reviewNotes ?? null,
  });

  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: item.id, metadata: { type: "case", status: data.status, reviewedBy: data.reviewedBy } });

  return item;
}

// ─── Study Guides ────────────────────────────────────────────────────────────

export async function listStudyGuides(query: { courseId?: string; instructorId?: string; status?: string; page: number; limit: number }) {
  const { courseId, instructorId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (courseId) conditions.push(eq(aiGeneratedStudyGuides.courseId, courseId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (status) conditions.push(eq(aiGeneratedStudyGuides.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const useJoin = !!instructorId;
  const baseQuery = useJoin
    ? db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedStudyGuides).innerJoin(courses, eq(aiGeneratedStudyGuides.courseId, courses.id))
    : db.select({ count: sql<number>`count(*)::int` }).from(aiGeneratedStudyGuides);
  const [countResult] = await baseQuery.where(where);
  const rawItems = useJoin
    ? await db.select().from(aiGeneratedStudyGuides).innerJoin(courses, eq(aiGeneratedStudyGuides.courseId, courses.id)).where(where).orderBy(desc(aiGeneratedStudyGuides.createdAt)).limit(limit).offset(offset)
    : await db.select().from(aiGeneratedStudyGuides).where(where).orderBy(desc(aiGeneratedStudyGuides.createdAt)).limit(limit).offset(offset);
  const items = useJoin ? (rawItems as any[]).map((row) => row.ai_generated_study_guides) : rawItems;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function generateStudyGuide(data: { courseId?: string; lessonId?: string; title: string; topic: string; includePracticeQuestions?: boolean; generatedBy?: string }) {
  let mock;
  if (isGeminiConfigured()) {
    try {
      mock = await generateGeminiStudyGuide(data.title, data.topic, data.includePracticeQuestions ?? true);
    } catch (err) {
      logger.warn({ err }, "Gemini failed, falling back to mock");
      mock = generateMockStudyGuide(data.title, data.topic, data.includePracticeQuestions ?? true);
    }
  } else {
    mock = generateMockStudyGuide(data.title, data.topic, data.includePracticeQuestions ?? true);
  }

  const [item] = await db.insert(aiGeneratedStudyGuides).values({
    courseId: data.courseId ?? null,
    lessonId: data.lessonId ?? null,
    ...mock,
    generatedBy: data.generatedBy ?? null,
    status: "PENDING",
  }).returning();

  await logAudit({ action: "CREATE", resource: "ai_content", resourceId: item.id, metadata: { type: "study_guide", title: data.title, topic: data.topic } });

  return item;
}

export async function reviewStudyGuide(id: string, data: { status: string; reviewNotes?: string; reviewedBy?: string }) {
  const [existing] = await db.select().from(aiGeneratedStudyGuides).where(eq(aiGeneratedStudyGuides.id, id));
  if (!existing) throw new NotFoundError("AI Generated Study Guide");

  const [item] = await db.update(aiGeneratedStudyGuides).set({
    status: data.status,
    reviewNotes: data.reviewNotes ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiGeneratedStudyGuides.id, id)).returning();

  await db.insert(aiContentApprovalHistory).values({
    contentType: "STUDY_GUIDE",
    contentId: id,
    action: data.status,
    reviewerId: data.reviewedBy ?? null,
    notes: data.reviewNotes ?? null,
  });

  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: item.id, metadata: { type: "study_guide", status: data.status, reviewedBy: data.reviewedBy } });

  return item;
}

// ─── Edit / Revise ───────────────────────────────────────────────────────────
// Content in PENDING or REVISION_NEEDED can be edited; saving returns it to
// PENDING so a reviewer must re-approve. APPROVED / REJECTED are immutable:
// approved questions are already copied into the live `questions` bank, and a
// silent edit there would desync the two. Rejected content should be
// regenerated. Every edit is recorded in the approval history.

const EDITABLE_STATUSES = ["PENDING", "REVISION_NEEDED"];

async function assertEditable(contentType: string, existing: { status: string }) {
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new ConflictError(
      `${contentType} is ${existing.status} and can no longer be edited. Generate a new one instead.`
    );
  }
}

async function recordEdit(contentType: string, id: string, editedBy: string | undefined, fields: string[]) {
  await db.insert(aiContentApprovalHistory).values({
    contentType,
    contentId: id,
    action: "EDITED",
    reviewerId: editedBy ?? null,
    notes: `Edited fields: ${fields.join(", ")}`,
  });
}

export async function updateQuestion(
  id: string,
  data: {
    topic?: string;
    questionText?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    difficulty?: string;
    editedBy?: string;
  }
) {
  const [existing] = await db.select().from(aiGeneratedQuestions).where(eq(aiGeneratedQuestions.id, id));
  if (!existing) throw new NotFoundError("AI Generated Question");
  await assertEditable("Question", existing);

  const { editedBy, ...fields } = data;
  const setFields: any = { updatedAt: new Date(), status: "PENDING", reviewNotes: null, reviewedBy: null, reviewedAt: null };
  if (fields.topic !== undefined) setFields.topic = fields.topic;
  if (fields.questionText !== undefined) setFields.questionText = fields.questionText;
  if (fields.options !== undefined) setFields.options = fields.options;
  if (fields.correctAnswer !== undefined) setFields.correctAnswer = fields.correctAnswer;
  if (fields.explanation !== undefined) setFields.explanation = fields.explanation;
  if (fields.difficulty !== undefined) setFields.difficulty = fields.difficulty;
  setFields.version = existing.version + 1;

  const [item] = await db.update(aiGeneratedQuestions)
    .set(setFields)
    .where(eq(aiGeneratedQuestions.id, id))
    .returning();

  const changed = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
  await recordEdit("QUESTION", id, editedBy, changed);
  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: id, metadata: { type: "question", editedBy, fields: changed, status: "PENDING" } });

  return item;
}

export async function updateCase(
  id: string,
  data: {
    title?: string;
    description?: string;
    clinicalPresentation?: string;
    difficulty?: string;
    stages?: Array<{ stage: number; description: string }>;
    learningObjectives?: string[];
    editedBy?: string;
  }
) {
  const [existing] = await db.select().from(aiGeneratedCases).where(eq(aiGeneratedCases.id, id));
  if (!existing) throw new NotFoundError("AI Generated Case");
  await assertEditable("Case", existing);

  const { editedBy, ...fields } = data;
  const setFields: any = { updatedAt: new Date(), status: "PENDING", reviewNotes: null, reviewedBy: null, reviewedAt: null };
  if (fields.title !== undefined) setFields.title = fields.title;
  if (fields.description !== undefined) setFields.description = fields.description;
  if (fields.clinicalPresentation !== undefined) setFields.clinicalPresentation = fields.clinicalPresentation;
  if (fields.difficulty !== undefined) setFields.difficulty = fields.difficulty;
  if (fields.stages !== undefined) setFields.stages = fields.stages;
  if (fields.learningObjectives !== undefined) setFields.learningObjectives = fields.learningObjectives;
  setFields.version = existing.version + 1;

  const [item] = await db.update(aiGeneratedCases)
    .set(setFields)
    .where(eq(aiGeneratedCases.id, id))
    .returning();

  const changed = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
  await recordEdit("CASE", id, editedBy, changed);
  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: id, metadata: { type: "case", editedBy, fields: changed, status: "PENDING" } });

  return item;
}

export async function updateStudyGuide(
  id: string,
  data: {
    title?: string;
    content?: string;
    summary?: string;
    keyPoints?: string[];
    editedBy?: string;
  }
) {
  const [existing] = await db.select().from(aiGeneratedStudyGuides).where(eq(aiGeneratedStudyGuides.id, id));
  if (!existing) throw new NotFoundError("AI Generated Study Guide");
  await assertEditable("Study Guide", existing);

  const { editedBy, ...fields } = data;
  const setFields: any = { updatedAt: new Date(), status: "PENDING", reviewNotes: null, reviewedBy: null, reviewedAt: null };
  if (fields.title !== undefined) setFields.title = fields.title;
  if (fields.content !== undefined) setFields.content = fields.content;
  if (fields.summary !== undefined) setFields.summary = fields.summary;
  if (fields.keyPoints !== undefined) setFields.keyPoints = fields.keyPoints;
  setFields.version = existing.version + 1;

  const [item] = await db.update(aiGeneratedStudyGuides)
    .set(setFields)
    .where(eq(aiGeneratedStudyGuides.id, id))
    .returning();

  const changed = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
  await recordEdit("STUDY_GUIDE", id, editedBy, changed);
  await logAudit({ action: "UPDATE", resource: "ai_content", resourceId: id, metadata: { type: "study_guide", editedBy, fields: changed, status: "PENDING" } });

  return item;
}

// ─── Approval History ────────────────────────────────────────────────────────

export async function listApprovalHistory(contentType: string, contentId: string) {
  const items = await db.select().from(aiContentApprovalHistory).where(
    and(eq(aiContentApprovalHistory.contentType, contentType), eq(aiContentApprovalHistory.contentId, contentId))
  ).orderBy(desc(aiContentApprovalHistory.createdAt));
  return items;
}

// ─── File Analysis (Gemini Multimodal) ───────────────────────────────────────

export async function analyzeUploadedFile(fileBuffer: Buffer, mimeType: string, fileName: string) {
  if (!isGeminiConfigured()) {
    return {
      summary: "Gemini API not configured. Set GEMINI_API_KEY in .env to enable AI analysis.",
      keyConcepts: [],
      learningObjectives: [],
      suggestedLessonTitle: fileName.replace(/\.[^.]+$/, ""),
      suggestedCategory: "Fundamentals",
      rawContent: "",
    };
  }

  const { analyzeDocument } = await import("../../services/gemini.service.js");
  return analyzeDocument(fileBuffer, mimeType, fileName);
}
