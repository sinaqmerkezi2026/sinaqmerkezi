'use server';
/**
 * @fileOverview A Genkit flow for grading student explanations against an admin-defined criterion.
 * 
 * - gradeExplanationQuestion - A function that grades a student's explanation.
 * - GradeExplanationQuestionInput - The input type for the gradeExplanationQuestion function.
 * - GradeExplanationQuestionOutput - The return type for the gradeExplanationQuestion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema
const GradeExplanationQuestionInputSchema = z.object({
  studentExplanation: z.string().describe("The student's written explanation for a question."),
  adminExplanationCriterion: z.string().describe("The admin's predefined ideal explanation or grading criterion for the question."),
});
export type GradeExplanationQuestionInput = z.infer<typeof GradeExplanationQuestionInputSchema>;

// Output Schema
const GradeExplanationQuestionOutputSchema = z.object({
  score: z.union([
    z.literal(0),
    z.literal(1 / 3),
    z.literal(1 / 2),
    z.literal(2 / 3),
    z.literal(1),
  ]).describe("The score assigned to the student's explanation based on its congruence with the admin's criterion. Possible values are 0, 1/3, 1/2, 2/3, or 1."),
  feedback: z.string().describe("Detailed feedback explaining why the specific score was awarded, including reasons for score reduction or full credit."),
});
export type GradeExplanationQuestionOutput = z.infer<typeof GradeExplanationQuestionOutputSchema>;

export async function gradeExplanationQuestion(input: GradeExplanationQuestionInput): Promise<GradeExplanationQuestionOutput> {
  return gradeExplanationQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gradeExplanationQuestionPrompt',
  input: { schema: GradeExplanationQuestionInputSchema },
  output: { schema: GradeExplanationQuestionOutputSchema },
  prompt: `You are an expert examiner tasked with grading student explanations.
Your goal is to compare a student's explanation with a predefined ideal explanation (criterion) and assign a score.
You must also provide clear, actionable feedback explaining your scoring decision.

Scoring Scale:
- 0: The explanation is completely incorrect or irrelevant.
- 1/3: The explanation has minimal correct points or significant misunderstandings.
- 1/2: The explanation is partially correct, addressing some key aspects but missing others or containing minor errors.
- 2/3: The explanation is mostly correct and demonstrates a good understanding, but lacks minor details or has slight inaccuracies.
- 1: The explanation is fully correct, comprehensive, and aligns perfectly with the criterion.

Student's Explanation:
{{{studentExplanation}}}

Admin's Ideal Explanation/Criterion:
{{{adminExplanationCriterion}}}

Based on the comparison, determine the most appropriate score (0, 1/3, 1/2, 2/3, or 1) and provide detailed feedback justifying your choice.
The feedback should clearly state why a certain score was given, highlighting correct points, areas for improvement, or reasons for full credit.
`
});

const gradeExplanationQuestionFlow = ai.defineFlow(
  {
    name: 'gradeExplanationQuestionFlow',
    inputSchema: GradeExplanationQuestionInputSchema,
    outputSchema: GradeExplanationQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('No output received from the AI model.');
    }
    return output;
  }
);
