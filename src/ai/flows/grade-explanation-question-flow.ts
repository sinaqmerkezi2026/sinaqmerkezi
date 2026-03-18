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
  isFinalAnswerCorrect: z.boolean().describe("Whether the student's final numerical or short answer was correct according to the system."),
});
export type GradeExplanationQuestionInput = z.infer<typeof GradeExplanationQuestionInputSchema>;

// Output Schema - Using number for better compatibility with LLM output
const GradeExplanationQuestionOutputSchema = z.object({
  score: z.number().describe("The score assigned to the student's explanation (0, 0.33, 0.5, 0.67, or 1)."),
  feedback: z.string().describe("Detailed feedback explaining why the specific score was awarded."),
});
export type GradeExplanationQuestionOutput = z.infer<typeof GradeExplanationQuestionOutputSchema>;

export async function gradeExplanationQuestion(input: GradeExplanationQuestionInput): Promise<GradeExplanationQuestionOutput> {
  return gradeExplanationQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gradeExplanationQuestionPrompt',
  input: { schema: GradeExplanationQuestionInputSchema },
  output: { schema: GradeExplanationQuestionOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `Sən tələbələrin yazılı izahlarını qiymətləndirən ədalətli və insaflı imtahan rəhbərisən. Məqsədin tələbənin izahını verilmiş meyarla müqayisə edib obyektiv, lakin bir qədər güzəştli bal verməkdir.

İzahlı suallar riyaziyyat, Azərbaycan dili və İngilis dili mövzusunda ola bilər. İngilis dilində esselərdə qrammatik səhvlər balı azalda bilər. Azərbaycan dilində cavab nümunəyə yaxın olmalıdır; əgər cavab nümunədəki sayı və ya məzmunu əhatə etmirsə, bal azaldılır. Riyaziyyatda isə aşağıdakı qaydalar tətbiq olunur:

QIYMƏTLƏNDİRMƏ QAYDALARI

Son cavab doğrudursa (isFinalAnswerCorrect = true)

Tələbənin izahı mövzu ilə əlaqəlidirsə, məntiqi səhvlər çox deyilsə və həll yolunun ideyası düzgündürsə, tam bal (1) ver.

İzahın meyarla sözbəsöz eyni olması vacib deyil. Əsas kriteriya: tələbənin doğru məntiqi başa düşməsidir.

KRİTİK QAYDA — TEOREM ADI

Əgər tələbə bir teorem, qayda və ya düstur istifadə edirsə, onun adını düzgün yazmalıdır.

Əgər teorem adı səhv yazılıb və ya ümumiyyətlə qeyd edilməyibsə, maksimum verilə biləcək bal 0.33 olmalıdır.

Rəy yazarkən mütləq qeyd et ki, teoremin adı səhvdir və ya qeyd olunmayıb.

Son cavab səhvdirsə (isFinalAnswerCorrect = false), amma izahda düzgün məntiq varsa:

0.67 – Həll yolu əsasən düzgündür, lakin son nəticədə hesablama və ya diqqət səhvi var.

0.5 – Həll yolu qismən düzgündür, bəzi addımlar doğrudur.

0.33 – Mövzu ilə əlaqəli cəhd var, lakin ciddi səhvlər mövcuddur.

0 – İzah mövzu ilə əlaqəsizdir.

Dil və məzmun nəzərə alınır:

İngilis dili esselərində ciddi qrammatik səhvlər balı azalda bilər.

Azərbaycan dilində cavab nümunəyə yaxın olmalıdır; cavabda azlıq varsa, bal azaldılır.

GİRİŞ MƏLUMATLARI

Tələbənin izahı: {{{studentExplanation}}}
Admin meyarı: {{{adminExplanationCriterion}}}
Son cavabın doğruluğu: {{#if isFinalAnswerCorrect}}DOĞRU{{else}}SƏHV{{/if}}

ÇIXIŞ FORMATI (JSON)
{
  "score": (0, 0.33, 0.5, 0.67, 1),
  "feedback": "..."
}

Rəy yazarkən:

Əsas səhvləri və güclü tərəfləri qısa qeyd et.

Teorem və düstur adı səhvdirsə və ya qeyd edilməyibsə bunu vurğula.

Məntiqi və dil faktorlarını qiymətləndir.`
});

const gradeExplanationQuestionFlow = ai.defineFlow(
  {
    name: 'gradeExplanationQuestionFlow',
    inputSchema: GradeExplanationQuestionInputSchema,
    outputSchema: GradeExplanationQuestionOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('No output received from the AI model.');
      }
      return output;
    } catch (error) {
      console.error('AI Flow Error:', error);
      // Fallback in case of AI failure
      return {
        score: input.isFinalAnswerCorrect ? 1 : 0,
        feedback: "Bal təyin edildi. Baldan razı deyilsənizsə apelyasiya müraciəti edin."
      };
    }
  }
);
