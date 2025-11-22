import { TranscriptEntry, formatTimestamp, type VideoChapter } from './youtube';
import { createTranscriptError } from './errors';
import { getLanguageNameFromCode } from './languages';

/**
 * Generates a summary of the video transcript using OpenAI's GPT API
 */
interface GenerateSummaryOptions {
  comfortableLanguages?: string[];
  videoTitle?: string;
  chapters?: VideoChapter[];
}

interface DetectedLanguage {
  languageName: string;
  languageCode: string;
}

async function detectTranscriptLanguage(
  transcriptText: string,
  apiKey: string
): Promise<DetectedLanguage> {
  const systemPrompt = `You are a language detection assistant.

Your job is to detect the primary human language of a transcript.
You MUST respond with a single valid JSON object and nothing else.`;

  const userPrompt = `Detect the primary language of the following transcript.

Return your answer in this exact JSON format (no extra keys, no comments):
{
  "language_name": "<FULL_LANGUAGE_NAME_IN_ENGLISH>",
  "language_code": "<ISO_639_1_LOWERCASE>"
}

Transcript:
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
      temperature: 0,
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    let message = `OpenAI API error during language detection: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error?.message) {
        message = errorData.error.message;
      }
    } catch {
      // Ignore JSON parsing errors and fall back to status-based message
    }

    throw createTranscriptError('OPENAI_ERROR', message);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw createTranscriptError(
      'OPENAI_ERROR',
      'No language detected from OpenAI'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw createTranscriptError(
      'OPENAI_ERROR',
      'Failed to parse language detection result from OpenAI'
    );
  }

  const languageName =
    typeof (parsed as any).language_name === 'string'
      ? (parsed as any).language_name.trim()
      : '';
  const languageCode =
    typeof (parsed as any).language_code === 'string'
      ? (parsed as any).language_code.trim()
      : '';

  if (!languageName || !languageCode) {
    throw createTranscriptError(
      'OPENAI_ERROR',
      'OpenAI did not return a valid language_name and language_code'
    );
  }

  return {
    languageName,
    languageCode,
  };
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

    // Optional: format chapters (if available) to help structure the summary
    let chaptersBlock = '';
    if (options?.chapters && options.chapters.length > 0) {
      const formattedChapters = options.chapters
        .map((chapter) => `- [${formatTimestamp(chapter.start)}] ${chapter.title}`)
        .join('\n');

      chaptersBlock = `Here are the video chapters. Use them as a guide for structuring the summary, but you may merge or split sections when it improves clarity:

${formattedChapters}

`;
    }

    // Step 1: Detect transcript language with a dedicated call
    const detectedLanguage = await detectTranscriptLanguage(transcriptText, apiKey);

    // Step 2: Decide which language the summary should use based on
    // the detected language and the user's comfortableLanguages setting.
    const normalizedComfortableLanguageCodes = options?.comfortableLanguages
      ?.map((lang) => lang.trim())
      .filter((lang) => lang.length > 0);

    const detectedCodeLower = detectedLanguage.languageCode.toLowerCase();
    let targetLanguageCode = detectedCodeLower;

    if (normalizedComfortableLanguageCodes && normalizedComfortableLanguageCodes.length > 0) {
      const comfortableCodesLower = normalizedComfortableLanguageCodes.map((code) =>
        code.toLowerCase()
      );

      const detectedIsComfortable = comfortableCodesLower.includes(detectedCodeLower);

      if (detectedIsComfortable) {
        targetLanguageCode = detectedCodeLower;
      } else {
        targetLanguageCode = comfortableCodesLower[0];
      }
    }

    const targetLanguageName = getLanguageNameFromCode(targetLanguageCode);

    const languageInstruction = `LANGUAGE INSTRUCTIONS:
- The transcript language is ${detectedLanguage.languageName} (code: ${detectedLanguage.languageCode}).
- You MUST write the entire summary in ${targetLanguageName}.
- Do not use any language other than ${targetLanguageName}, except for proper names or code identifiers.
- Use ${targetLanguageName} for all headings, bullet points, and timestamps.
- If you start to respond in a different language, immediately switch back to ${targetLanguageName} and continue only in ${targetLanguageName}.`;

    const systemPrompt = `You are a helpful assistant that creates detailed, well-structured summaries of YouTube video transcripts.

Your summaries should:
1. Start with a brief overview (2-3 sentences)
2. Include a detailed breakdown of main topics discussed
3. Instead of merely listing the topics discussed, explain the key points and conclusions
4. Filter out any sponsor messages, subscribe requests, or promotional content
5. Include key timestamps for important moments
6. End with a brief conclusion
7. Use clear headings and bullet points for readability
8. When chapter information is provided, use it as a scaffold for structuring the summary (section headings can align with chapters when it makes sense), but feel free to merge or split chapters if it leads to a clearer explanation.
9. Correct obvious misspellings of well-known brand names, product names, and technologies when you are confident about the intended name, but do not invent or guess new names that are not clearly implied by the transcript

${languageInstruction}

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

    const titleLine = options?.videoTitle
      ? `Video title: ${options.videoTitle}\n\n`
      : '';

    const userPrompt = `${titleLine}${chaptersBlock}Please create a comprehensive summary of this YouTube video transcript. Include important timestamps for key moments:

Transcript:
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
      throw createTranscriptError(
        'OPENAI_ERROR',
        errorData.error?.message || `OpenAI API error: ${response.status}`
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw createTranscriptError(
        'OPENAI_ERROR',
        'No summary generated from OpenAI'
      );
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
    // Re-throw TranscriptErrors as-is, wrap other errors
    if (error instanceof Error && error.name === 'TranscriptError') {
      throw error;
    }
    throw createTranscriptError(
      'OPENAI_ERROR',
      error instanceof Error ? error.message : String(error)
    );
  }
}
