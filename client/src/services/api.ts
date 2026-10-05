import axios from "axios";

// Absolute backend origin for the Vercel-hosted build (set at build time).
// Empty in development → relative /api → Vite's dev proxy handles it.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Login/register endpoints: let 401 propagate as-is (wrong credentials)
    if (
      originalRequest.url === "/auth/login" ||
      originalRequest.url === "/auth/register" ||
      originalRequest.url === "/auth/verify-email" ||
      originalRequest.url === "/auth/resend-verification"
    ) {
      return Promise.reject(err);
    }

    // Handle 401 with automatic token refresh
    if (err.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/login", { username, password }),
  register: (data: { username: string; email: string; password: string; firstName: string; lastName: string; middleName?: string; role?: string }) =>
    api.post("/auth/register", data),
  signupConfig: () => api.get("/auth/signup-config"),
  verifyEmail: (token: string) => api.post("/auth/verify-email", { token }),
  resendVerification: (email: string) =>
    api.post("/auth/resend-verification", { email }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  refreshToken: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }),
};

// ─── Academic ────────────────────────────────────────────────────────────────

export const academicApi = {
  listCourses: (params?: Record<string, string | undefined>) => api.get("/academic/courses", { params }),
  getCourse: (id: string) => api.get(`/academic/courses/${id}`),
  createCourse: (data: Record<string, unknown>) => api.post("/academic/courses", data),
  updateCourse: (id: string, data: Record<string, unknown>) => api.put(`/academic/courses/${id}`, data),
  listTopics: (params?: Record<string, string | undefined>) => api.get("/learning/topics", { params }),
  createTopic: (data: Record<string, unknown>) => api.post("/learning/topics", data),
  listCourseOutcomes: (courseId: string, params?: Record<string, string | undefined>) =>
    api.get(`/academic/courses/${courseId}/outcomes`, { params }),
  listEnrollments: (params?: Record<string, string | undefined>) => api.get("/academic/enrollments", { params }),
  enrollStudent: (data: Record<string, unknown>) => api.post("/academic/enrollments", data),
  unenrollStudent: (id: string) => api.delete(`/academic/enrollments/${id}`),
  updateEnrollment: (id: string, data: { sectionId: string }) => api.put(`/academic/enrollments/${id}`, data),
  listSections: (params?: Record<string, string | undefined>) => api.get("/academic/sections", { params }),
  createSection: (data: Record<string, unknown>) => api.post("/academic/sections", data),
  updateSection: (id: string, data: Record<string, unknown>) => api.put(`/academic/sections/${id}`, data),
  deleteSection: (id: string) => api.delete(`/academic/sections/${id}`),
  listAcademicYears: (params?: Record<string, string | undefined>) => api.get("/academic/academic-years", { params }),
  createAcademicYear: (data: Record<string, unknown>) => api.post("/academic/academic-years", data),
  updateAcademicYear: (id: string, data: Record<string, unknown>) => api.put(`/academic/academic-years/${id}`, data),
  deleteAcademicYear: (id: string) => api.delete(`/academic/academic-years/${id}`),
  listSemesters: (params?: Record<string, string | undefined>) => api.get("/academic/semesters", { params }),
  createSemester: (data: Record<string, unknown>) => api.post("/academic/semesters", data),
  updateSemester: (id: string, data: Record<string, unknown>) => api.put(`/academic/semesters/${id}`, data),
  deleteSemester: (id: string) => api.delete(`/academic/semesters/${id}`),
  listYearLevels: (params?: Record<string, string | undefined>) => api.get("/academic/year-levels", { params }),
  createYearLevel: (data: Record<string, unknown>) => api.post("/academic/year-levels", data),
  updateYearLevel: (id: string, data: Record<string, unknown>) => api.put(`/academic/year-levels/${id}`, data),
  deleteYearLevel: (id: string) => api.delete(`/academic/year-levels/${id}`),
  listPrograms: (params?: Record<string, string | undefined>) => api.get("/academic/programs", { params }),
  listStudentsBySection: (sectionId: string) => api.get(`/academic/sections/${sectionId}/students`),
  assignStudentSection: (data: { studentId: string; sectionId: string; academicYearId: string }) => api.post("/academic/student-sections", data),
  removeStudentSection: (id: string) => api.delete(`/academic/student-sections/${id}`),
  listStudentSections: (params?: Record<string, string | undefined>) => api.get("/academic/student-sections", { params }),
};

// ─── Learning ────────────────────────────────────────────────────────────────

export const learningApi = {
  listTopics: (params?: Record<string, string | undefined>) => api.get("/learning/topics", { params }),
  getTopic: (id: string) => api.get(`/learning/topics/${id}`),
  createTopic: (data: Record<string, unknown>) => api.post("/learning/topics", data),
  updateTopic: (id: string, data: Record<string, unknown>) => api.put(`/learning/topics/${id}`, data),
  deleteTopic: (id: string) => api.delete(`/learning/topics/${id}`),
  listLessons: (params?: Record<string, string | undefined>) => api.get("/learning/lessons", { params }),
  getLesson: (id: string) => api.get(`/learning/lessons/${id}`),
  getLessonFull: (id: string) => api.get(`/learning/lessons/${id}/full`),
  createLesson: (data: Record<string, unknown>) => api.post("/learning/lessons", data),
  updateLesson: (id: string, data: Record<string, unknown>) => api.put(`/learning/lessons/${id}`, data),
  deleteLesson: (id: string) => api.delete(`/learning/lessons/${id}`),
  listMaterials: (lessonId: string) => api.get(`/learning/lessons/${lessonId}/materials`),
  createMaterial: (lessonId: string, data: Record<string, unknown>) => api.post(`/learning/lessons/${lessonId}/materials`, data),
  updateMaterial: (id: string, data: Record<string, unknown>) => api.put(`/learning/materials/${id}`, data),
  deleteMaterial: (id: string) => api.delete(`/learning/materials/${id}`),
  listActivities: (lessonId: string) => api.get(`/learning/lessons/${lessonId}/activities`),
  createActivity: (lessonId: string, data: Record<string, unknown>) => api.post(`/learning/lessons/${lessonId}/activities`, data),
  updateActivity: (id: string, data: Record<string, unknown>) => api.put(`/learning/activities/${id}`, data),
  deleteActivity: (id: string) => api.delete(`/learning/activities/${id}`),
  uploadFile: (file: File, dest?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/learning/upload?dest=${dest || "documents"}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ─── Assessment ──────────────────────────────────────────────────────────────

export const assessmentApi = {
  listQuestions: (params?: Record<string, string | undefined>) => api.get("/assessment/questions", { params }),
  getQuestion: (id: string) => api.get(`/assessment/questions/${id}`),
  createQuestion: (data: Record<string, unknown>) => api.post("/assessment/questions", data),
  updateQuestion: (id: string, data: Record<string, unknown>) => api.put(`/assessment/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/assessment/questions/${id}`),
  toggleQuestionStatus: (id: string) => api.patch(`/assessment/questions/${id}/toggle-status`),
  listAssessments: (params?: Record<string, string | undefined>) => api.get("/assessment/assessments", { params }),
  getAssessment: (id: string) => api.get(`/assessment/assessments/${id}`),
  createAssessment: (data: Record<string, unknown>) => api.post("/assessment/assessments", data),
  updateAssessment: (id: string, data: Record<string, unknown>) => api.put(`/assessment/assessments/${id}`, data),
  deleteAssessment: (id: string) => api.delete(`/assessment/assessments/${id}`),
  startAttempt: (assessmentId: string) => api.post(`/assessment/assessments/${assessmentId}/start`),
  getAttempt: (attemptId: string) => api.get(`/assessment/attempts/${attemptId}`),
  submitAttempt: (attemptId: string, data: Record<string, unknown>) => api.post(`/assessment/attempts/${attemptId}/submit`, data),
  getAttemptResult: (attemptId: string) => api.get(`/assessment/attempts/${attemptId}/result`),
  gradeAttempt: (attemptId: string, data: Record<string, unknown>) => api.post(`/assessment/attempts/${attemptId}/grade`, data),
  listAttempts: (params?: Record<string, string | undefined>) => api.get("/assessment/attempts", { params }),
  getMyAttempts: () => api.get("/assessment/my-attempts"),
  getCourseGradebook: (courseId: string) => api.get(`/assessment/gradebook?courseId=${courseId}`),
  getFullGradebook: (courseId: string) => api.get(`/assessment/gradebook/full?courseId=${courseId}`),
  linkQuestions: (assessmentId: string, questionIds: string[]) => api.post(`/assessment/assessments/${assessmentId}/questions`, { questionIds }),
  unlinkQuestion: (assessmentId: string, questionId: string) => api.delete(`/assessment/assessments/${assessmentId}/questions/${questionId}`),
  getAssessmentQuestions: (assessmentId: string) => api.get(`/assessment/assessments/${assessmentId}/questions`),
};

// ─── Clinical ────────────────────────────────────────────────────────────────

export const clinicalApi = {
  listCases: (params?: Record<string, string | undefined>) => api.get("/clinical/cases", { params }),
  getCase: (id: string) => api.get(`/clinical/cases/${id}`),
  createCase: (data: Record<string, unknown>) => api.post("/clinical/cases", data),
  updateCase: (id: string, data: Record<string, unknown>) => api.put(`/clinical/cases/${id}`, data),
  deleteCase: (id: string) => api.delete(`/clinical/cases/${id}`),
  togglePublish: (id: string) => api.patch(`/clinical/cases/${id}/toggle-publish`),
  startCase: (caseId: string) => api.post(`/clinical/cases/${caseId}/start`),
  getAttempt: (attemptId: string) => api.get(`/clinical/attempts/${attemptId}`),
  submitAttempt: (attemptId: string, data: { responses: Array<{ stageId: string; selectedOptionId: string }> }) => api.post(`/clinical/attempts/${attemptId}/submit`, data),
  listAttempts: (params?: Record<string, string | undefined>) => api.get("/clinical/attempts", { params }),
  // Stages
  createStage: (caseId: string, data: Record<string, unknown>) => api.post(`/clinical/cases/${caseId}/stages`, data),
  updateStage: (id: string, data: Record<string, unknown>) => api.put(`/clinical/stages/${id}`, data),
  deleteStage: (id: string) => api.delete(`/clinical/stages/${id}`),
};

// ─── Clinical RLE ────────────────────────────────────────────────────────────

export const clinicalRleApi = {
  listRotations: (params?: Record<string, string | undefined>) => api.get("/clinical-rle/rotations", { params }),
  getRotationDetails: (id: string) => api.get(`/clinical-rle/rotations/${id}/details`),
  createRotation: (data: Record<string, unknown>) => api.post("/clinical-rle/rotations", data),
  updateRotation: (id: string, data: Record<string, unknown>) => api.put(`/clinical-rle/rotations/${id}`, data),
  deleteRotation: (id: string) => api.delete(`/clinical-rle/rotations/${id}`),
  getCompletionSummary: (rotationId: string) => api.get(`/clinical-rle/rotations/${rotationId}/completion-summary`),
  completeRotation: (rotationId: string, studentIds?: string[]) => api.post(`/clinical-rle/rotations/${rotationId}/complete`, studentIds ? { studentIds } : {}),
  updateRotationCompletion: (rotationId: string, studentIds: string[]) => api.put(`/clinical-rle/rotations/${rotationId}/completion`, { studentIds }),
  getRotationCertificate: (rotationId: string, studentId: string) => api.get(`/clinical-rle/rotations/${rotationId}/students/${studentId}/certificate`),
  listRotationStudents: (rotationId: string) => api.get(`/clinical-rle/rotations/${rotationId}/students`),
  assignStudentsToRotation: (rotationId: string, studentIds: string[]) => api.post(`/clinical-rle/rotations/${rotationId}/students`, { studentIds }),
  removeStudentFromRotation: (rotationId: string, studentId: string) => api.delete(`/clinical-rle/rotations/${rotationId}/students/${studentId}`),
  // Attendance
  listAttendance: (rotationId: string, params?: Record<string, string | undefined>) => api.get(`/clinical-rle/rotations/${rotationId}/attendance`, { params }),
  markAttendance: (data: Record<string, unknown>) => api.post("/clinical-rle/attendance", data),
  markBatchAttendance: (data: Record<string, unknown>) => api.post("/clinical-rle/attendance/batch", data),
  getStudentHours: (rotationId: string, studentId: string) => api.get(`/clinical-rle/rotations/${rotationId}/students/${studentId}/hours`),
  // Clinical Logs
  listRotationLogs: (rotationId: string) => api.get(`/clinical-rle/rotations/${rotationId}/logs`),
  listLogs: (params?: Record<string, string | undefined>) => api.get("/clinical-rle/logs", { params }),
  createClinicalLog: (data: Record<string, unknown>) => api.post("/clinical-rle/logs", data),
  updateClinicalLog: (id: string, data: Record<string, unknown>) => api.put(`/clinical-rle/logs/${id}`, data),
  deleteClinicalLog: (id: string) => api.delete(`/clinical-rle/logs/${id}`),
  reviewClinicalLog: (id: string, feedback: string) => api.post(`/clinical-rle/logs/${id}/review`, { feedback }),
  // Evaluations
  listRotationEvaluations: (rotationId: string) => api.get(`/clinical-rle/rotations/${rotationId}/evaluations`),
  createEvaluation: (data: Record<string, unknown>) => api.post("/clinical-rle/evaluations", data),
  updateEvaluation: (id: string, data: Record<string, unknown>) => api.put(`/clinical-rle/evaluations/${id}`, data),
  getStudentRotationSummary: (rotationId: string, studentId: string) => api.get(`/clinical-rle/rotations/${rotationId}/students/${studentId}/summary`),
  // Student view
  getMyRotations: () => api.get("/clinical-rle/my-rotations"),
};

// ─── Skills Lab ──────────────────────────────────────────────────────────────

export const skillsApi = {
  listSkills: (params?: Record<string, string | undefined>) => api.get("/skills-lab/skills", { params }),
  getSkill: (id: string) => api.get(`/skills-lab/skills/${id}`),
  createSkill: (data: Record<string, unknown>) => api.post("/skills-lab/skills", data),
  updateSkill: (id: string, data: Record<string, unknown>) => api.put(`/skills-lab/skills/${id}`, data),
  deleteSkill: (id: string) => api.delete(`/skills-lab/skills/${id}`),
  toggleSkillStatus: (id: string) => api.patch(`/skills-lab/skills/${id}/toggle-status`),
  listStations: (params?: Record<string, string | undefined>) => api.get("/skills-lab/stations", { params }),
  // Checklist management
  addChecklist: (skillId: string, data: { stepNumber: number; description: string; isCritical: boolean }) => api.post(`/skills-lab/skills/${skillId}/checklists`, data),
  removeChecklist: (id: string) => api.delete(`/skills-lab/checklists/${id}`),
  // Student self-practice
  getMySkills: () => api.get("/skills-lab/my-skills"),
  practiceSkill: (skillId: string, checkedItems: string[]) => api.post(`/skills-lab/my-skills/${skillId}/practice`, { checkedItems }),
  requestAssessment: (skillId: string) => api.post(`/skills-lab/my-skills/${skillId}/request-assessment`),
  // Instructor view
  getPendingAssessments: () => api.get("/skills-lab/pending-assessments"),
  createAssessmentFromRequest: (studentSkillId: string) => api.post(`/skills-lab/assessments/from-request/${studentSkillId}`),
  getAssessmentDetails: (assessmentId: string) => api.get(`/skills-lab/assessments/${assessmentId}/details`),
  gradeAssessment: (assessmentId: string, data: { items: Array<{ checklistId: string; isCompleted: boolean; notes?: string; pointsAwarded?: number }>; feedback: string; isCompetent: boolean }) => api.post(`/skills-lab/assessments/${assessmentId}/grade`, data),
  signOffSkill: (studentId: string, skillId: string) => api.post(`/skills-lab/students/${studentId}/skills/${skillId}/sign-off`),
};

// ─── Nursing Process ─────────────────────────────────────────────────────────

export const nursingProcessApi = {
  listDiagnoses: (params?: Record<string, string | undefined>) => api.get("/nursing-process/diagnoses", { params }),
  getDiagnosis: (id: string) => api.get(`/nursing-process/diagnoses/${id}`),
  createDiagnosis: (data: Record<string, unknown>) => api.post("/nursing-process/diagnoses", data),
  updateDiagnosis: (id: string, data: Record<string, unknown>) => api.put(`/nursing-process/diagnoses/${id}`, data),
  listCarePlans: (params?: Record<string, string | undefined>) => api.get("/nursing-process/care-plans", { params }),
  getCarePlan: (id: string) => api.get(`/nursing-process/care-plans/${id}`),
  createCarePlan: (data: Record<string, unknown>) => api.post("/nursing-process/care-plans", data),
  updateCarePlan: (id: string, data: Record<string, unknown>) => api.put(`/nursing-process/care-plans/${id}`, data),
  deleteCarePlan: (id: string) => api.delete(`/nursing-process/care-plans/${id}`),
  submitCarePlan: (id: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plans/${id}/submit`, data),
  evaluateCarePlan: (id: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plans/${id}/evaluate`, data),
  addDiagnosisToPlan: (carePlanId: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plans/${carePlanId}/diagnoses`, data),
  updateDiagnosisOnPlan: (id: string, data: Record<string, unknown>) => api.put(`/nursing-process/care-plan-diagnoses/${id}`, data),
  removeDiagnosis: (id: string) => api.delete(`/nursing-process/care-plan-diagnoses/${id}`),
  addOutcome: (diagnosisId: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plan-diagnoses/${diagnosisId}/outcomes`, data),
  updateOutcome: (id: string, data: Record<string, unknown>) => api.put(`/nursing-process/care-plan-outcomes/${id}`, data),
  removeOutcome: (id: string) => api.delete(`/nursing-process/care-plan-outcomes/${id}`),
  addIntervention: (diagnosisId: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plan-diagnoses/${diagnosisId}/interventions`, data),
  updateIntervention: (id: string, data: Record<string, unknown>) => api.put(`/nursing-process/care-plan-interventions/${id}`, data),
  removeIntervention: (id: string) => api.delete(`/nursing-process/care-plan-interventions/${id}`),
  reviewCarePlan: (id: string, data: Record<string, unknown>) => api.post(`/nursing-process/care-plans/${id}/review`, data),
};

// ─── Competency ──────────────────────────────────────────────────────────────

export const competencyApi = {
  listFrameworks: (params?: Record<string, string | undefined>) => api.get("/competency/frameworks", { params }),
  listCompetencies: (params?: Record<string, string | undefined>) => api.get("/competency/competencies", { params }),
  getStudentCompetencies: (studentId: string) => api.get(`/competency/students/${studentId}/competencies`),
  getStudentCompetencySummary: (studentId: string, frameworkId: string) =>
    api.get(`/competency/students/${studentId}/competencies/summary`, { params: { frameworkId } }),
  assessCompetency: (data: Record<string, unknown>) => api.post("/competency/assess", data),
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  getStudentDashboard: () => api.get("/analytics/students/dashboard"),
  recordActivity: (data: Record<string, unknown>) => api.post("/analytics/activities", data),
};

// ─── Portfolio ───────────────────────────────────────────────────────────────

export const portfolioApi = {
  listPortfolios: (params?: Record<string, string | undefined>) => api.get("/portfolio/portfolios", { params }),
  getPortfolio: (id: string) => api.get(`/portfolio/portfolios/${id}`),
  createPortfolio: (data: Record<string, unknown>) => api.post("/portfolio/portfolios", data),
  getItemFeedback: (itemId: string) => api.get(`/portfolio/portfolio-items/${itemId}/feedback`),
  createFeedback: (data: Record<string, unknown>) => api.post("/portfolio/portfolio-feedback", data),
  listAchievements: (params?: Record<string, string | undefined>) => api.get("/portfolio/achievements", { params }),
  createAchievement: (data: Record<string, unknown>) => api.post("/portfolio/achievements", data),
  deleteAchievement: (id: string) => api.delete(`/portfolio/achievements/${id}`),
  listCertificates: (params?: Record<string, string | undefined>) => api.get("/portfolio/certificates", { params }),
  createCertificate: (data: Record<string, unknown>) => api.post("/portfolio/certificates", data),
  listReflections: (params?: Record<string, string | undefined>) => api.get("/portfolio/reflections", { params }),
  listClinicalLogs: (params?: Record<string, string | undefined>) => api.get("/portfolio/clinical-exp-logs", { params }),
};

// ─── NLE ─────────────────────────────────────────────────────────────────────

export const nleApi = {
  listCategories: () => api.get("/nle/categories"),
  getCategory: (id: string) => api.get(`/nle/categories/${id}`),
  createCategory: (data: Record<string, unknown>) => api.post("/nle/categories", data),
  updateCategory: (id: string, data: Record<string, unknown>) => api.put(`/nle/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/nle/categories/${id}`),
  listQuestions: (params?: Record<string, string | undefined>) => api.get("/nle/questions", { params }),
  getQuestion: (id: string) => api.get(`/nle/questions/${id}`),
  createQuestion: (data: Record<string, unknown>) => api.post("/nle/questions", data),
  updateQuestion: (id: string, data: Record<string, unknown>) => api.put(`/nle/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/nle/questions/${id}`),
  importQuestions: (questions: Record<string, unknown>[]) => api.post("/nle/questions/import", { questions }),
  suggestQuestion: (categoryId: string) => api.post("/nle/questions/suggest", { categoryId }),
  generateFromContent: (data: { categoryId: string; content: string; count: number; difficulty?: string; highYieldPercent?: number }) => api.post("/nle/questions/generate", data),
  generateFromFile: (formData: FormData) => api.post("/nle/questions/generate-from-file", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  getStats: () => api.get("/nle/stats"),
  getPractice: (params?: Record<string, string | undefined>) => api.get("/nle/practice", { params }),
  checkPractice: (data: { answers: { questionId: string; selectedOptionId?: string }[] }) => api.post("/nle/practice/check", data),
  listExams: (params?: Record<string, string | undefined>) => api.get("/nle/exams", { params }),
  startExam: (examId: string) => api.post("/nle/exams/start", { examId }),
  submitExam: (attemptId: string, answers: { questionId: string; selectedOptionId?: string; timeSpentSeconds?: number }[]) =>
    api.post(`/nle/exams/${attemptId}/submit`, { answers }),
  listAttempts: (examId?: string) => api.get("/nle/exams/attempts", { params: examId ? { examId } : undefined }),
  getAttempt: (id: string) => api.get(`/nle/exams/attempts/${id}`),
  abandonAttempt: (id: string) => api.delete(`/nle/exams/attempts/${id}`),
  getPerformance: () => api.get("/nle/performance"),
};

// ─── Simulation ──────────────────────────────────────────────────────────────

export const simulationApi = {
  listPatients: (params?: Record<string, string | undefined>) => api.get("/simulation/patients", { params }),
  getPatient: (id: string) => api.get(`/simulation/patients/${id}`),
  createPatient: (data: Record<string, unknown>) => api.post("/simulation/patients", data),
  updatePatient: (id: string, data: Record<string, unknown>) => api.put(`/simulation/patients/${id}`, data),
  deletePatient: (id: string) => api.delete(`/simulation/patients/${id}`),
  listScenarios: (params?: Record<string, string | undefined>) => api.get("/simulation/scenarios", { params }),
  getScenario: (id: string) => api.get(`/simulation/scenarios/${id}`),
  createScenario: (data: Record<string, unknown>) => api.post("/simulation/scenarios", data),
  updateScenario: (id: string, data: Record<string, unknown>) => api.put(`/simulation/scenarios/${id}`, data),
  deleteScenario: (id: string) => api.delete(`/simulation/scenarios/${id}`),
  listActions: () => api.get("/simulation/actions"),
  listSessions: (params?: Record<string, string | undefined>) => api.get("/simulation/sessions", { params }),
  getSession: (id: string) => api.get(`/simulation/sessions/${id}`),
  startSession: (data: { scenarioId: string }) => api.post("/simulation/sessions/start", data),
  performAction: (sessionId: string, data: Record<string, unknown>) => api.post(`/simulation/sessions/${sessionId}/action`, data),
  completeSession: (sessionId: string) => api.post(`/simulation/sessions/${sessionId}/complete`),
  listResponses: (scenarioId: string) => api.get(`/simulation/scenarios/${scenarioId}/responses`),
  createResponse: (scenarioId: string, data: Record<string, unknown>) => api.post(`/simulation/scenarios/${scenarioId}/responses`, data),
  getDebriefing: (sessionId: string) => api.get(`/simulation/sessions/${sessionId}/debriefing`),
  createDebriefing: (sessionId: string, data: Record<string, unknown>) => api.post(`/simulation/sessions/${sessionId}/debriefing`, data),
};

// ─── AI Tutor ────────────────────────────────────────────────────────────────

export const aiTutorApi = {
  chat: (data: { message: string; mode?: string; conversationId?: string }) =>
    api.post("/ai-tutor/chat", data),
  getConversations: () => api.get("/ai-tutor/conversations"),
  getMessages: (id: string) => api.get(`/ai-tutor/conversations/${id}/messages`),
  getHints: (params?: Record<string, string | undefined>) => api.get("/ai-tutor/hints", { params }),
};

// ─── AI Content ──────────────────────────────────────────────────────────────

export const aiContentApi = {
  listQuestions: (params?: Record<string, string | undefined>) => api.get("/ai-content/questions", { params }),
  generateQuestions: (data: Record<string, unknown>) => api.post("/ai-content/questions/generate", data),
  reviewQuestion: (id: string, data: Record<string, unknown>) => api.post(`/ai-content/questions/${id}/review`, data),
  updateQuestion: (id: string, data: Record<string, unknown>) => api.put(`/ai-content/questions/${id}`, data),
  listCases: (params?: Record<string, string | undefined>) => api.get("/ai-content/cases", { params }),
  listStudyGuides: (params?: Record<string, string | undefined>) => api.get("/ai-content/study-guides", { params }),
  generateCase: (data: { title: string; difficulty?: string; focusArea?: string; courseId?: string }) =>
    api.post("/ai-content/cases/generate", data),
  reviewCase: (id: string, data: Record<string, unknown>) => api.post(`/ai-content/cases/${id}/review`, data),
  updateCase: (id: string, data: Record<string, unknown>) => api.put(`/ai-content/cases/${id}`, data),
  generateStudyGuide: (data: { title: string; topic: string; includePracticeQuestions?: boolean; lessonId?: string; courseId?: string }) =>
    api.post("/ai-content/study-guides/generate", data),
  reviewStudyGuide: (id: string, data: Record<string, unknown>) => api.post(`/ai-content/study-guides/${id}/review`, data),
  updateStudyGuide: (id: string, data: Record<string, unknown>) => api.put(`/ai-content/study-guides/${id}`, data),
};

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  analyzeFile: (data: { fileName: string; mimeType: string; fileBase64: string }) =>
    api.post("/ai-content/analyze-file", data),
  generateQuestions: (data: { topic: string; questionType?: string; difficulty?: string; count?: number; courseId?: string }) =>
    api.post("/ai-content/questions/generate", data),
  generateCase: (data: { title: string; difficulty?: string; focusArea?: string; courseId?: string }) =>
    api.post("/ai-content/cases/generate", data),
  generateStudyGuide: (data: { title: string; topic: string; lessonId?: string; courseId?: string }) =>
    api.post("/ai-content/study-guides/generate", data),
  tutorChat: (data: { message: string; lessonContext?: string }) =>
    api.post("/ai-content/tutor-chat", data),
  getQuestions: (params?: Record<string, string | undefined>) => api.get("/ai-content/questions", { params }),
  reviewQuestion: (id: string, data: { status: string; reviewNotes?: string }) =>
    api.post(`/ai-content/questions/${id}/review`, data),
};

// ─── Research ────────────────────────────────────────────────────────────────

export const researchApi = {
  listProjects: (params?: Record<string, string | undefined>) => api.get("/research/projects", { params }),
  getProject: (id: string) => api.get(`/research/projects/${id}`),
  createProject: (data: Record<string, unknown>) => api.post("/research/projects", data),
  updateProject: (id: string, data: Record<string, unknown>) => api.put(`/research/projects/${id}`, data),
  listCohorts: (projectId: string) => api.get(`/research/projects/${projectId}/cohorts`),
  createCohort: (data: Record<string, unknown>) => api.post("/research/cohorts", data),
  listStudies: (projectId: string) => api.get(`/research/projects/${projectId}/studies`),
  createStudy: (data: Record<string, unknown>) => api.post("/research/studies", data),
  listParticipants: (studyId: string) => api.get(`/research/studies/${studyId}/participants`),
  enrollParticipant: (studyId: string, data: Record<string, unknown>) => api.post(`/research/studies/${studyId}/enroll`, data),
  recordPrePostTest: (data: Record<string, unknown>) => api.post("/research/pre-post-tests", data),
  getStudyAnalysis: (studyId: string) => api.get(`/research/studies/${studyId}/analysis`),
  listExports: (projectId: string) => api.get(`/research/projects/${projectId}/exports`),
  createExport: (data: Record<string, unknown>) => api.post("/research/exports", data),
  deleteProject: (id: string) => api.delete(`/research/projects/${id}`),
  deleteCohort: (id: string) => api.delete(`/research/cohorts/${id}`),
  deleteStudy: (id: string) => api.delete(`/research/studies/${id}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: Record<string, string | undefined>) => api.get("/users", { params }),
  getProfile: (studentId: string) => api.get(`/users/${studentId}/profile`),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post("/users", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  updatePassword: (id: string, data: { password: string }) => api.put(`/users/${id}/password`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  approve: (id: string) => api.post(`/users/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post(`/users/${id}/reject`, reason ? { reason } : {}),
};

// ─── Announcements ────────────────────────────────────────────────────────

export const announcementApi = {
  list: (params?: Record<string, string | undefined>) => api.get("/announcements", { params }),
  get: (id: string) => api.get(`/announcements/${id}`),
  create: (data: Record<string, unknown>) => api.post("/announcements", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
  addAttachments: (id: string, formData: FormData) =>
    api.post(`/announcements/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  removeAttachment: (announcementId: string, attachmentId: string) =>
    api.delete(`/announcements/${announcementId}/attachments/${attachmentId}`),
  markRead: (id: string) => api.post(`/announcements/${id}/read`),
  receipts: (id: string) => api.get(`/announcements/${id}/receipts`),
};

// ─── Notifications ────────────────────────────────────────────────────────

export const notificationApi = {
  list: (params?: Record<string, string | undefined>) => api.get("/notifications", { params }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/read-all"),
};

// ─── Admin ────────────────────────────────────────────────────────────────

export const adminApi = {
  listAuditLogs: (params?: Record<string, string | undefined>) => api.get("/admin/audit-logs", { params }),
  getModuleSettings: () => api.get("/admin/module-settings"),
  updateModuleSettings: (data: object) => api.put("/admin/module-settings", data),
};

// ─── Search ───────────────────────────────────────────────────────────────

export const searchApi = {
  search: (q: string) => api.get(`/search?q=${encodeURIComponent(q)}`),
};
