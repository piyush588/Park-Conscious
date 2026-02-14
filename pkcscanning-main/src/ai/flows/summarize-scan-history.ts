'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeScanHistoryInputSchema = z.object({
  scanHistory: z.string(),
});

export type SummarizeScanHistoryInput = z.infer<typeof SummarizeScanHistoryInputSchema>;

const SummarizeScanHistoryOutputSchema = z.object({
  summary: z.string(),
});

export type SummarizeScanHistoryOutput = z.infer<typeof SummarizeScanHistoryOutputSchema>;

export async function summarizeScanHistory(input: SummarizeScanHistoryInput): Promise<SummarizeScanHistoryOutput> {
  return summarizeScanHistoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeScanHistoryPrompt',
  input: {schema: SummarizeScanHistoryInputSchema},
  output: {schema: SummarizeScanHistoryOutputSchema},
  prompt: `Summarize plate history: {{scanHistory}}`,
});

const summarizeScanHistoryFlow = ai.defineFlow(
  {
    name: 'summarizeScanHistoryFlow',
    inputSchema: SummarizeScanHistoryInputSchema,
    outputSchema: SummarizeScanHistoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);