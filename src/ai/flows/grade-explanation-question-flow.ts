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

// Output Schema
const GradeExplanationQuestionOutputSchema = z.object({
  score: z.union([
    z.literal(0),
    z.literal(1 / 3),
    z.literal(1 / 2),
    z.literal(2 / 3),
    z.literal(1),
  ]).describe("The score assigned to the student's explanation. Possible values are 0, 1/3, 1/2, 2/3, or 1."),
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
  prompt: `Sən tələbələrin yazılı izahlarını yoxlayan insaflı bir imtahan rəhbərisən.
Məqsədin tələbənin izahını verilmiş meyarlar ilə müqayisə edib ədalətli (hətta bir az güzəştli) qiymət verməkdir.

Qiymətləndirmə Təlimatı:
1. Əgər son cavab (isFinalAnswerCorrect = true) DOĞRUDURSA və tələbənin izahı "pis deyilsə" (yəni mövzu ilə əlaqəlidirsə və məntiqlidirsə), tam bal (1) ver. İzahın meyarla tam eyni olması vacib deyil, əsas olan tələbənin məntiqi ifadə etməsidir.
2. KRİTİK QAYDA: Əgər tələbə həll yolunu düzgün yazsa da, istifadə olunan teoremin, qaydanın və ya düsturun adını səhv yazarsa (Məsələn: Pifaqor teoremi tətbiq edildiyi halda "Fales teoremi" yazarsa), ona tam bal vermə. Bu halda maksimum 1/3 bal ver və rəydə teoremin adının yanlış olduğunu qeyd et.
3. Əgər son cavab (isFinalAnswerCorrect = false) SƏHVDİRSƏ, lakin izahda müəyyən düzgün məntiqlər və ya həll yolu varsa, izahın keyfiyyətindən asılı olaraq 2/3, 1/2 və ya 1/3 bal ver.
4. Çox sərt olma, tələbənin dərki və çəkdiyi zəhməti nəzərə al, lakin elmi terminlərin və teorem adlarının düzgünlüyünə (qayda 2-də qeyd edildiyi kimi) diqqət yetir.

Tələbənin İzahı:
{{{studentExplanation}}}

Meyar/Doğru İzah:
{{{adminExplanationCriterion}}}

Son Cavabın Doğruluğu: {{#if isFinalAnswerCorrect}}DOĞRU{{else}}SƏHV{{/if}}

Zəhmət olmasa yuxarıdakı təlimatlara uyğun olaraq ən uyğun balı (0, 1/3, 1/2, 2/3 və ya 1) seç və qısa, dəstəkləyici rəy yaz.

Əgər bal kəsərsən bunun səbəbinidə qeyd etməlisən. Əgər son cavab doğru olmarsa amma izah uyğun olarsa izahdan asılı olaraq bal ver.
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
