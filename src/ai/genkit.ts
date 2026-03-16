import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit konfiqurasiyası.
 * 
 * Vercel-də GOOGLE_GENAI_API_KEY mühit dəyişəni (Environment Variable) 
 * olaraq əlavə edilməlidir. Genkit bu açarı avtomatik oxuyur.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
