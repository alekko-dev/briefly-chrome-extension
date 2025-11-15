import { TranscriptEntry, formatTimestamp } from './youtube';

/**
 * Generates a summary of the video transcript using OpenAI's GPT API
 */
interface GenerateSummaryOptions {
  comfortableLanguages?: string[];
}

/**
 * Turns the user-configured comfortable languages into a short instruction block
 * that is appended to the system prompt. The block explains the fallback
 * translation behavior, making it clear to reviewers (and ourselves) why the
 * additional text is there.
 */
function buildLanguageInstruction(languages?: string[]): string {
  if (!languages) {
    return '';
  }

  const normalizedLanguages = languages
    .map((lang) => lang.trim())
    .filter((lang) => lang.length > 0);

  if (normalizedLanguages.length === 0) {
    return '';
  }

  const fallbackLanguage = normalizedLanguages[0];

  return `IMPORTANT LANGUAGE RULES:\n- Detect the language of the transcript before writing.\n- If the transcript language is in this set: ${normalizedLanguages.join(
    ', '
  )}, keep the summary in that same language.\n- If the transcript language is not in that set, translate the entire summary to ${fallbackLanguage}.\n- Maintain consistent language across headings, bullets, and timestamps.`;
}

export async function generateSummary(
  transcript: TranscriptEntry[],
  apiKey: string,
  options?: GenerateSummaryOptions
): Promise<string> {
  try {
    // Format transcript for better context
    const transcriptText = transcript
      .map((entry) => `[${formatTimestamp(entry.start)}] ${entry.text}`)
      .join('\n');

    const languageInstruction = buildLanguageInstruction(options?.comfortableLanguages);

    const basePrompt = `You are a helpful assistant that creates detailed, well-structured summaries of YouTube video transcripts.

Your summaries should:
1. Start with a brief overview (2-3 sentences)
2. Include a detailed breakdown of main topics discussed
3. Filter out any sponsor messages, subscribe requests, or promotional content
4. Include key timestamps for important moments
5. End with a brief conclusion
6. Use clear headings and bullet points for readability

${languageInstruction ? languageInstruction : ''}

CRITICAL TIMESTAMP FORMATTING RULES:
- ALWAYS use square brackets: [MM:SS] or [H:MM:SS]
- NEVER use parentheses: (MM:SS) ❌
- NEVER use "Timestamp:" prefix ❌
- NEVER use ranges like [MM:SS - MM:SS] ❌
- Place timestamps at the END of the paragraph/point they reference

CORRECT examples:
✓ Introduction to the topic [0:45]
✓ Main argument begins here [12:34]
✓ Final thoughts and conclusion [1:23:45]

INCORRECT examples:
✗ [12:34] Topic discussed
✗ (12:34) Topic discussed
✗ Timestamp: 12:34
✗ [12:34 - 15:20] Topic discussed
✗ At 12:34 the speaker mentions...`;

    const systemPrompt = [basePrompt, languageInstruction]
      .filter(Boolean)
      .join('\n\n');

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

    // Post-process: Normalize various timestamp formats to [MM:SS] or [H:MM:SS]
    let processedSummary = summary;

    // 1. Convert parentheses timestamps: (12:34) -> [12:34]
    processedSummary = processedSummary.replace(
      /\((\d{1,2}):(\d{2})(?::(\d{2}))?\)/g,
      '[$1:$2$3]'
    );

    // 2. Convert "Timestamp: MM:SS" -> [MM:SS]
    processedSummary = processedSummary.replace(
      /(?:Timestamp|Time|At):\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/gi,
      '[$1:$2$3]'
    );

    // 3. Convert timestamp ranges to just the first timestamp: [12:34 - 15:20] -> [12:34]
    processedSummary = processedSummary.replace(
      /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*\d{1,2}:\d{2}(?::\d{2})?\]/g,
      '[$1:$2$3]'
    );

    // 4. Convert "At MM:SS" -> [MM:SS]
    processedSummary = processedSummary.replace(
      /\bAt\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/gi,
      '[$1:$2$3]'
    );

    // 5. Clean up any malformed brackets (e.g., [:] from replacements with undefined groups)
    processedSummary = processedSummary.replace(
      /\[(\d{1,2}):(\d{2}):?\]/g,
      '[$1:$2]'
    );
    processedSummary = processedSummary.replace(
      /\[(\d{1,2}):(\d{2}):(\d{2})\]/g,
      '[$1:$2:$3]'
    );

    // 6. Convert all properly formatted timestamps into markdown links
    processedSummary = processedSummary.replace(
      /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g,
      (match: string) => `${match}(#)`
    );

    return processedSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}
