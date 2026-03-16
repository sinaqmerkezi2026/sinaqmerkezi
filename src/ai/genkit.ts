import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit konfiqurasiyası.
 * 
 * QEYD: Google AI açarını (GOOGLE_GENAI_API_KEY) kodda yazmayın!
 * Yerli mühitdə .env faylından, Vercel-də isə Environment Variables bölməsindən oxunur.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
