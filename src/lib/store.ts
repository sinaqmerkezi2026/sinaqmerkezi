import { z } from 'zod';

export const QuestionType = z.enum(['mcq', 'open', 'explanation']);
export type QuestionType = z.infer<typeof QuestionType>;

export const QuestionSchema = z.object({
  id: z.string(),
  type: QuestionType,
  text: z.string(),
  image: z.string().optional(),
  options: z.array(z.string()).optional(), // For MCQ
  correctAnswer: z.string(), // For all types (Final answer)
  explanationCriterion: z.string().optional(), // For Explanation type
});

export const ExamSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  durationMinutes: z.number(),
  price: z.number(),
  codes: z.array(z.string()),
  questions: z.array(QuestionSchema),
});

export type Question = z.infer<typeof QuestionSchema>;
export type Exam = z.infer<typeof ExamSchema>;

export const AttemptSchema = z.object({
  id: z.string(),
  examId: z.string(),
  code: z.string(),
  studentName: z.string(),
  studentSurname: z.string(),
  answers: z.record(z.string(), z.object({
    finalAnswer: z.string(),
    explanation: z.string().optional()
  })),
  startTime: z.number(),
  endTime: z.number().optional(),
  results: z.any().optional(), // To store AI feedback and scores
});

export type Attempt = z.infer<typeof AttemptSchema>;

// Helpers to interact with local storage (mocking a DB)
export const db = {
  getExams: (): Exam[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('imtahanflow_exams');
    return data ? JSON.parse(data) : [];
  },
  saveExam: (exam: Exam) => {
    const exams = db.getExams();
    const index = exams.findIndex(e => e.id === exam.id);
    if (index >= 0) exams[index] = exam;
    else exams.push(exam);
    localStorage.setItem('imtahanflow_exams', JSON.stringify(exams));
  },
  getExamById: (id: string) => db.getExams().find(e => e.id === id),
  getExamByCode: (code: string) => db.getExams().find(e => e.codes.includes(code)),
  
  getAttempts: (): Attempt[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('imtahanflow_attempts');
    return data ? JSON.parse(data) : [];
  },
  saveAttempt: (attempt: Attempt) => {
    const attempts = db.getAttempts();
    const index = attempts.findIndex(a => a.id === attempt.id);
    if (index >= 0) attempts[index] = attempt;
    else attempts.push(attempt);
    localStorage.setItem('imtahanflow_attempts', JSON.stringify(attempts));
  },
  getAttemptByCode: (code: string) => db.getAttempts().find(a => a.code === code),

  isCodeUsed: (code: string) => {
    const attempts = db.getAttempts();
    const attempt = attempts.find(a => a.code === code);
    return attempt && !!attempt.endTime;
  }
};