'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InitiateScanWithPromptInputSchema = z.object({
  photoDataUri: z.string(),
});
export type InitiateScanWithPromptInput = z.infer<typeof InitiateScanWithPromptInputSchema>;

const InitiateScanWithPromptOutputSchema = z.object({
  plateNumber: z.string(),
});
export type InitiateScanWithPromptOutput = z.infer<typeof InitiateScanWithPromptOutputSchema>;

export async function initiateScanWithPrompt(input: InitiateScanWithPromptInput): Promise<InitiateScanWithPromptOutput> {
  return initiateScanWithPromptFlow(input);
}

const initiateScanWithPromptPrompt = ai.definePrompt({
  name: 'initiateScanWithPromptPrompt',
  input: {schema: InitiateScanWithPromptInputSchema},
  output: {schema: InitiateScanWithPromptOutputSchema},
  prompt: `Extract license plate. Return JSON { "plateNumber": "TEXT" }.
  Image: {{media url=photoDataUri}}`,
});

const initiateScanWithPromptFlow = ai.defineFlow(
  {
    name: 'initiateScanWithPromptFlow',
    inputSchema: InitiateScanWithPromptInputSchema,
    outputSchema: InitiateScanWithPromptOutputSchema,
  },
  async input => {
    const {output} = await initiateScanWithPromptPrompt(input);
    return output!;
  }
);