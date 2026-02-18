import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');
const model = genAI.getGenerativeModel({ model: config.gemini.model });

export class GeminiService {
    async generateHowTo(transcript: string, videoTitle: string, videoDescription: string = ''): Promise<string> {
        logger.info('Generating how-to with Gemini', { videoTitle });

        const systemPrompt = `You are an expert technical writer and educator. Your task is to transform a noisy, chronological YouTube transcript into a clear, well-structured, step-by-step how-to guide. The output must be directly usable as documentation, not a summary.`;

        const userPrompt = `
I will give you:
- The title of a YouTube video.
- An optional description.
- The full transcript (possibly messy, with filler words, tangents, and repetition).

Your job:
1. Identify the main task or goal taught in the video.
2. Write a detailed how-to document that a reasonably technical reader can follow without watching the video.
3. Organize the content into sections with headings and numbered steps.
4. Convert conversational language into concise, instructional prose.
5. Remove filler, repeated information, and irrelevant tangents; keep only what is needed to perform the task.
6. Include prerequisites, tools/software needed, and any important configuration values.
7. Include troubleshooting tips or common mistakes if the transcript implies them.
8. Where the video uses vague references like ‘click here’ or ‘do this’, infer and name the actual UI element or action when possible.
9. Use Markdown-style structure (headings, bullet points, numbered lists, code blocks) so it maps cleanly to Notion blocks.

Output format (Markdown-like, but do NOT include the word ‘Markdown’ or any surrounding commentary):

# <Clear how-to title>

## Overview
- One or two sentences explaining what the guide helps the reader accomplish.
- A short bullet list of key outcomes.

## Prerequisites
- List tools, accounts, APIs, and permissions required.

## Steps
1. Step title
   - Sub-steps as bullet points.
   - Include specific button/menu names, commands, and parameter names where available.
2. Next step
   - Continue until the task is fully covered.

## Notes and tips
- Clarifications, best practices, and optional enhancements.

## Troubleshooting
- Common issues mentioned or implied in the video and how to resolve them.

Here is the input:

- Video title: ${videoTitle}
- Video description: ${videoDescription}

--- BEGIN TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---
    `;

        try {
            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + '\n' + userPrompt }] }
                ],
                generationConfig: {
                    temperature: 0.2, // Low temperature for faithful reproduction
                    maxOutputTokens: 8192,
                }
            });

            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('Gemini returned empty response');
            }

            return text;
        } catch (error) {
            logger.error('Gemini generation failed', error);
            throw error;
        }
    }
}
