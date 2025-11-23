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

interface AnswerQuestionOptions {
  videoTitle?: string;
  comfortableLanguages?: string[];
  videoId?: string;
  history?: { question: string; answer: string }[];
}

const CRITICAL_TIMESTAMP_RULES = `CRITICAL TIMESTAMP FORMATTING RULES:
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

const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

function normalizeTimestampFormats(text: string): string {
  let normalized = text;

  // Convert parentheses timestamps: (12:34) -> [12:34]
  normalized = normalized.replace(/\((\d{1,2}):(\d{2})(?::(\d{2}))?\)/g, '[$1:$2$3]');

  // Convert "Timestamp: MM:SS" -> [MM:SS]
  normalized = normalized.replace(
    /(?:Timestamp|Time|At):\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/gi,
    '[$1:$2$3]'
  );

  // Convert timestamp ranges to just the first timestamp: [12:34 - 15:20] -> [12:34]
  normalized = normalized.replace(
    /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*\d{1,2}:\d{2}(?::\d{2})?\]/g,
    '[$1:$2$3]'
  );

  // Convert "At MM:SS" -> [MM:SS]
  normalized = normalized.replace(/\bAt\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/gi, '[$1:$2$3]');

  // Clean up malformed brackets (e.g., [:] from replacements with undefined groups)
  normalized = normalized.replace(/\[(\d{1,2}):(\d{2}):?\]/g, '[$1:$2]');
  normalized = normalized.replace(/\[(\d{1,2}):(\d{2}):(\d{2})\]/g, '[$1:$2:$3]');

  return normalized;
}

function linkifyTimestamps(
  text: string,
  options?: { videoId?: string; fallbackHref?: string }
): string {
  const { videoId, fallbackHref } = options ?? {};

  return text.replace(TIMESTAMP_REGEX, (_match: string, part1: string, part2: string, part3?: string) => {
    const timestampText = part3 !== undefined ? `${part1}:${part2}:${part3}` : `${part1}:${part2}`;

    if (videoId) {
      const parts = timestampText.split(':').map(Number);
      const seconds =
        parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
      const url = `https://youtube.com/watch?v=${videoId}&t=${seconds}s`;
      return `[${timestampText}](${url})`;
    }

    if (fallbackHref) {
      return `[${timestampText}](${fallbackHref})`;
    }

    return `[${timestampText}]`;
  });
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

${CRITICAL_TIMESTAMP_RULES}`;

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

    const processedSummary = linkifyTimestamps(normalizeTimestampFormats(summary), { fallbackHref: '#' });

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

export async function answerQuestionFromTranscript(
  transcript: TranscriptEntry[],
  question: string,
  apiKey: string,
  options?: AnswerQuestionOptions
): Promise<string> {
  if (!apiKey) {
    throw createTranscriptError('OPENAI_ERROR', 'OpenAI API key is missing');
  }

  if (!question || !question.trim()) {
    throw createTranscriptError('OPENAI_ERROR', 'Question cannot be empty');
  }

  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw createTranscriptError('OPENAI_ERROR', 'Transcript is not available for this video');
  }

  const formattedTranscript = transcript
    .map((entry) => `[${formatTimestamp(entry.start)}] ${entry.text}`)
    .join('\n');

  const preferredLanguageCode = options?.comfortableLanguages
    ?.map((lang) => (typeof lang === 'string' ? lang.trim() : ''))
    .find((lang) => lang.length > 0);

  const languageInstruction = preferredLanguageCode
    ? `Always respond in ${getLanguageNameFromCode(preferredLanguageCode)}.`
    : 'Respond in the primary language used in the transcript.';

  const systemPrompt = `You answer user questions using ONLY the provided YouTube transcript.

Rules:
- Resolve pronouns or vague references using the prior Q&A history before answering.
- Do not invent details; rely strictly on the transcript.
- Provide concise answers (2-4 sentences).
- When the transcript contains the answer, include the single most relevant timestamp at the end using [MM:SS] or [H:MM:SS].
- Use the prior Q&A exchanges for context (pronouns, clarifications), but never contradict the transcript.
- If the transcript does not cover the question, respond with a single sentence phrased as a question that restates the user's request and clearly says the video doesn't explain it (e.g., "The video doesn't explain why Command A has more chances to win.").
- Only use that question-style response when the transcript is missing the info; otherwise, answer directly.
- If the question is off-topic or speculative, use the same question-style response noting the video doesn't cover it.

${languageInstruction}

${CRITICAL_TIMESTAMP_RULES}`;

  const titleLine = options?.videoTitle ? `Video title: ${options.videoTitle}\n\n` : '';
  const historyBlock =
    options?.history && options.history.length > 0
      ? `Relevant previous Q&A (use for context and coreference):
${options.history
  .map(
    (turn, index) =>
      `${index + 1}. Q: ${turn.question.trim()}\n   A: ${turn.answer.trim()}`
  )
  .join('\n')}

`
      : '';

  const userPrompt = `${titleLine}${historyBlock}Question: ${question.trim()}

Transcript:
${formattedTranscript}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      let message = `OpenAI API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          message = errorData.error.message;
        }
      } catch {
        // ignore
      }
      throw createTranscriptError('OPENAI_ERROR', message);
    }

    const data = await response.json();
    const rawAnswer = data.choices?.[0]?.message?.content?.trim();

    if (!rawAnswer) {
      throw createTranscriptError('OPENAI_ERROR', 'No answer generated from OpenAI');
    }

    const normalizedAnswer = normalizeTimestampFormats(rawAnswer);
    return linkifyTimestamps(normalizedAnswer, { videoId: options?.videoId });
  } catch (error) {
    if (error instanceof Error && error.name === 'TranscriptError') {
      throw error;
    }
    throw createTranscriptError(
      'OPENAI_ERROR',
      error instanceof Error ? error.message : String(error)
    );
  }
}
