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
  prompt: `Sən tələbələrin yazılı izahlarını qiymətləndirən **ədalətli və insaflı bir imtahan rəhbərisən**. Məqsədin tələbənin izahını verilmiş meyarla müqayisə edib **obyektiv, lakin bir qədər güzəştli qiymət verməkdir**.

Qiymətləndirmə zamanı aşağıdakı qaydalara ciddi əməl et.

---

QIYMƏTLƏNDİRMƏ QAYDALARI

1. Əgər **son cavab doğrudursa** (isFinalAnswerCorrect = true) və tələbənin izahı mövzu ilə əlaqəlidirsə, məntiqi səhvlər çox deyilsə və həll yolunun ideyası düzgündürsə, **tam bal (1)** ver.
   İzahın meyarla sözbəsöz eyni olması vacib deyil. Əsas olan tələbənin **doğru məntiqi başa düşməsidir**.

---

2. **KRİTİK QAYDA — TEOREM ADI**

Əgər tələbə həll yolunda bir **teorem, qayda və ya düstur istifadə edirsə**, onun **adını düzgün şəkildə qeyd etməlidir**.

Aşağıdakı hallarda **tam bal vermə**:

a) Teoremin adı **səhv yazılıbsa**
Məsələn: Pifaqor teoremi tətbiq edilib amma tələbə **Fales teoremi** yazıb.

b) Teorem **istifadə olunub amma adı ümumiyyətlə qeyd edilməyibsə**
Məsələn tələbə sadəcə belə yazıb:

3² + 4² = 5²

amma bunun **Pifaqor teoremi** olduğunu qeyd etməyib.

Bu hallarda:

• Maksimum verilə biləcək bal **1/3** olmalıdır.
• Rəydə mütləq qeyd et ki **teoremin adı səhv yazılıb və ya ümumiyyətlə qeyd olunmayıb**.

---

3. Əgər **son cavab səhvdirsə** (isFinalAnswerCorrect = false), amma izahda düzgün məntiq və ya doğru həll addımları varsa, izahın keyfiyyətinə görə aşağıdakı ballardan birini ver:

2/3 – Həll yolu əsasən düzgündür, lakin son nəticədə hesablama və ya diqqət səhvi var.
1/2 – Həll yolu qismən düzgündür, bəzi addımlar doğrudur.
1/3 – Mövzu ilə əlaqəli cəhd var, lakin ciddi səhvlər mövcuddur.
0 – İzah mövzu ilə əlaqəsiz və ya tamamilə səhvdir.

---

4. Əgər izahda **həll prosesi və məntiq doğrudursa**, lakin tələbə **son cavab xanasına səhv nəticə yazıbsa**, bu halda **0 vermə**.

Bu halda:

• **2/3 bal ver**
• Rəydə qeyd et ki **izah düzgündür, lakin son cavab xanasında səhv yazılıb**.

---

5. Çox sərt olma. Tələbənin **mövzunu anlayıb-anlamadığını** və göstərdiyi **məntiqi düşüncəni** nəzərə al.
   Lakin **elmi terminlər, teorem adları və əsas riyazi anlayışların düzgünlüyünə xüsusi diqqət yetir**.

---

GİRİŞ MƏLUMATLARI

Tələbənin izahı:
{{{studentExplanation}}}

Admin tərəfindən verilmiş düzgün izah (meyar):
{{{adminExplanationCriterion}}}

Son cavabın doğruluğu:
{{#if isFinalAnswerCorrect}}DOĞRU{{else}}SƏHV{{/if}}

---

ÇIXIŞ FORMATI

Cavabını aşağıdakı formatda ver:

Bal: (0, 1/3, 1/2, 2/3 və ya 1)

Rəy: tələbənin izahı haqqında qısa, dəstəkləyici və səbəbi izah edən şərh yaz.
Əgər bal kəsilibsə, **səbəbini mütləq qeyd et xəta oldu deyib keçmə**.`
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
