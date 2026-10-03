export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN" | "PROGRAM_COORDINATOR" | "CLINICAL_INSTRUCTOR";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  isActive: boolean;
  instructorId: string | null;
  instructorFirstName: string | null;
  instructorLastName: string | null;
  instructorEmail: string | null;
  createdAt: string;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  content: string | null;
  contentType: string;
  durationMinutes: number | null;
  orderIndex: number;
  isActive: boolean;
}

export interface Question {
  id: string;
  courseId: string | null;
  topicId: string | null;
  questionText: string;
  questionType: "MC" | "TF" | "ESSAY" | "FILL_BLANK" | "SCENARIO";
  options: QuestionOption[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface QuestionOption {
  id?: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: string;
  timeLimitMinutes: number | null;
  passingScore: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface ClinicalCase {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  department: string | null;
  createdBy: string | null;
  createdAt: string;
  stages?: CaseStage[];
}

export interface CaseStage {
  id: string;
  caseId: string;
  stageNumber: number;
  title: string;
  description: string | null;
  stageType: string;
  data: Record<string, unknown>;
}

export interface ClinicalRotation {
  id: string;
  studentId: string;
  department: string;
  startDate: string;
  endDate: string | null;
  status: string;
  totalHours: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  isActive: boolean;
  createdBy: string | null;
}

export interface NursingDiagnosis {
  id: string;
  code: string;
  name: string;
  definition: string | null;
  relatedFactors: string[] | null;
  isActive: boolean;
}

export interface LearningOutcome {
  id: string;
  courseId: string;
  code: string;
  description: string;
  bloomLevel: string;
}

export interface Portfolio {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface NLEQuestion {
  id: string;
  categoryId: string;
  questionText: string;
  questionType: string;
  difficulty: string;
  createdAt: string;
}

export interface VirtualPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  medicalHistory: string | null;
  chiefComplaint: string | null;
}

export interface AiMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  content: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  courseName: string | null;
  courseCode: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string | null;
  isRead: boolean;
  relatedId: string | null;
  createdAt: string;
}
