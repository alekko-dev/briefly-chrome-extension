import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Summary {
  videoId: string;
  videoTitle: string;
  content: string;
  timestamp: number;
  hasTranscript?: boolean;
}

interface SummaryViewProps {
  summary: Summary;
  onTimestampClick: (timeInSeconds: number) => void;
  onNewSummary: () => void;
}

interface FollowUpEntry {
  question: string;
  answer: string;
}

function SummaryView({ summary, onTimestampClick, onNewSummary }: SummaryViewProps) {
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<FollowUpEntry[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  // Load persisted Q&A history for this video
  React.useEffect(() => {
    const key = `qa-${summary.videoId}`;
    chrome.storage.local.get([key], (result) => {
      const storedHistory = result[key];
      if (Array.isArray(storedHistory)) {
        setQaHistory(storedHistory);
      }
    });
  }, [summary.videoId]);

  // Utility: convert placeholder timestamps to real video links for display/copy
  const convertPlaceholdersToLinks = (content: string): string => {
    if (!summary.videoId) return content;

    const toSeconds = (part1: string, part2: string, part3?: string): number => {
      const hours = part3 ? parseInt(part1, 10) : 0;
      const minutes = part3 ? parseInt(part2, 10) : parseInt(part1, 10);
      const seconds = part3 ? parseInt(part3, 10) : parseInt(part2, 10);
      return hours * 3600 + minutes * 60 + seconds;
    };

    // 1) Convert placeholder links like [2:14](#)
    const withLinks = content.replace(
      /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\(#\)/g,
      (_match, part1, part2, part3) => {
        const totalSeconds = toSeconds(part1, part2, part3);
        const url = `https://youtube.com/watch?v=${summary.videoId}&t=${totalSeconds}s`;
        const label = part3 ? `${part1}:${part2}:${part3}` : `${part1}:${part2}`;
        return `[${label}](${url})`;
      }
    );

    // 2) Convert bare timestamps like [2:14] that aren't already links
    const withBareConverted = withLinks.replace(
      /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\](?!\()/g,
      (_match, part1, part2, part3) => {
        const totalSeconds = toSeconds(part1, part2, part3);
        const url = `https://youtube.com/watch?v=${summary.videoId}&t=${totalSeconds}s`;
        const label = part3 ? `${part1}:${part2}:${part3}` : `${part1}:${part2}`;
        return `[${label}](${url})`;
      }
    );

    // 3) Remove any stray "(#)" fragments
    return withBareConverted.replace(/\(#\)/g, '');
  };

  // Parse timestamp links from markdown content (e.g., [12:34] or [1:23:45])
  const handleMarkdownClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;

    const text = anchor.textContent || '';
    const href = anchor.getAttribute('href') || '';

    const parseSeconds = (label: string): number | null => {
      const match = label.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!match) return null;
      const hours = match[3] ? parseInt(match[1], 10) : 0;
      const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
      return hours * 3600 + minutes * 60 + seconds;
    };

    // Prefer href t= parameter
    if (href && href !== '#' && !href.startsWith('#')) {
      try {
        const url = new URL(href, 'https://youtube.com');
        const t = url.searchParams.get('t');
        if (t) {
          const seconds = parseInt(t.replace(/\D/g, ''), 10);
          if (!Number.isNaN(seconds)) {
            e.preventDefault();
            onTimestampClick(seconds);
            return;
          }
        }
      } catch {
        // ignore invalid URL, fall back to text
      }
    }

    const secondsFromText = parseSeconds(text);
    if (secondsFromText !== null) {
      e.preventDefault();
      onTimestampClick(secondsFromText);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      // Convert timestamp links to YouTube URLs with escaped brackets
      const contentWithLinks = convertPlaceholdersToLinks(summary.content).replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_match, timestamp, url) => `[\\[${timestamp}\\]](${url})`
      );

      const qaExport =
        qaHistory.length > 0
          ? `\n\n## Follow-up Questions\n${qaHistory
              .map(
                (entry) =>
                  `**Q:** ${entry.question}\n**A:** ${convertPlaceholdersToLinks(entry.answer)}`
              )
              .join('\n\n')}`
          : '';

      await navigator.clipboard.writeText(`${contentWithLinks}${qaExport}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleAskQuestion = () => {
    const trimmedQuestion = question.trim();

    if (summary.hasTranscript === false) {
      setQaError('Follow-up questions are unavailable for this summary.');
      return;
    }

    if (!trimmedQuestion) {
      setQaError('Enter a question about the video.');
      return;
    }

    setAsking(true);
    setQaError(null);

    const historyToSend = qaHistory
      .slice(0, 6)
      .reverse(); // send oldest first for context

    chrome.runtime.sendMessage(
      {
        type: 'ASK_FOLLOW_UP',
        videoId: summary.videoId,
        question: trimmedQuestion,
        history: historyToSend,
      },
      (response) => {
        setAsking(false);

        if (chrome.runtime.lastError) {
          setQaError('Unable to reach the extension. Please try again.');
          return;
        }

        if (!response?.success) {
          setQaError(response?.error || 'Failed to answer this question.');
          return;
        }

        setQaHistory((prev) => {
          const nextHistory = [
            { question: trimmedQuestion, answer: response.answer },
            ...prev,
          ];
          const key = `qa-${summary.videoId}`;
          chrome.storage.local.set({ [key]: nextHistory });
          return nextHistory;
        });
        setQuestion('');
      }
    );
  };

  const handleDeleteQa = (index: number) => {
    setQaHistory((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const key = `qa-${summary.videoId}`;
      chrome.storage.local.set({ [key]: next });
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary Content */}
      <div
        className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 prose prose-sm max-w-none dark:bg-slate-900 dark:border-slate-700 dark:prose-invert"
        onClick={handleMarkdownClick}
      >
        <ReactMarkdown
          components={{
            // Style for timestamps
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
              />
            ),
            // Add styling for other markdown elements
            h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-50" />,
            h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-50" />,
            h3: ({ node, ...props }) => <h3 {...props} className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-50" />,
            p: ({ node, ...props }) => <p {...props} className="mb-3 text-gray-700 leading-relaxed dark:text-gray-200" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 mb-3 space-y-1" />,
            ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 mb-3 space-y-1" />,
            li: ({ node, ...props }) => <li {...props} className="text-gray-700 dark:text-gray-200" />,
          }}
        >
          {convertPlaceholdersToLinks(summary.content)}
        </ReactMarkdown>
      </div>

      {/* Follow-up questions */}
      <div className="bg-indigo-50 border border-indigo-100 dark:bg-slate-800/70 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">Ask about this video</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Follow-up answers use the transcript and include a timestamp when possible.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !asking) {
                handleAskQuestion();
              }
            }}
            placeholder="What else do you want to know?"
            className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100 dark:focus:border-indigo-400"
          />
          <button
            onClick={handleAskQuestion}
            disabled={asking || summary.hasTranscript === false}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {asking ? 'Asking...' : 'Ask'}
          </button>
        </div>

        {summary.hasTranscript === false && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Follow-up questions are unavailable for this summary.
          </p>
        )}

        {qaError && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{qaError}</p>
        )}

        {qaHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {qaHistory.map((entry, index) => (
              <div
                key={`${entry.question}-${index}`}
                className="bg-white border border-indigo-100 rounded-lg p-3 shadow-sm dark:bg-slate-900 dark:border-slate-700"
                onClick={handleMarkdownClick}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Question</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{entry.question}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQa(index);
                    }}
                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                    title="Delete this Q&A"
                  >
                    Delete
                  </button>
                </div>

                <p className="mt-3 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Answer</p>
                <div className="prose prose-sm max-w-none mt-1 dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
                        />
                      ),
                      p: ({ node, ...props }) => <p {...props} className="text-gray-800 dark:text-gray-200" />,
                    }}
                  >
                    {convertPlaceholdersToLinks(entry.answer)}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCopyMarkdown}
          className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy as Markdown
            </>
          )}
        </button>
        <button
          onClick={onNewSummary}
          className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-100"
        >
          New Summary
        </button>
      </div>
    </div>
  );
}

export default SummaryView;
