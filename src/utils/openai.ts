import { TranscriptEntry, formatTimestamp } from './youtube';

/**
 * Generates a summary of the video transcript using OpenAI's GPT API
 */
export async function generateSummary(
  transcript: TranscriptEntry[],
  apiKey: string
): Promise<string> {
  try {
    // Format transcript for better context
    const transcriptText = transcript
      .map((entry) => `[${formatTimestamp(entry.start)}] ${entry.text}`)
      .join('\n');

    const systemPrompt = `You are a helpful assistant that creates detailed, well-structured summaries of YouTube video transcripts.

Your summaries should:
1. Start with a brief overview (2-3 sentences)
2. Include a detailed breakdown of main topics discussed
3. Filter out any sponsor messages, subscribe requests, or promotional content
4. Include key timestamps in markdown link format like [12:34] for important moments
5. End with a brief conclusion
6. Use clear headings and bullet points for readability

Format timestamps as clickable links using the format: [MM:SS] or [HH:MM:SS]`;

    const userPrompt = `Please create a comprehensive summary of this YouTube video transcript. Include important timestamps for key moments:

${transcriptText}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `OpenAI API error: ${response.status}`
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from OpenAI');
    }

    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}
