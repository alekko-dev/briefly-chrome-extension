import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Summary {
  videoId: string;
  videoTitle: string;
  content: string;
  timestamp: number;
}

interface SummaryViewProps {
  summary: Summary;
  onTimestampClick: (timeInSeconds: number) => void;
  onNewSummary: () => void;
}

function SummaryView({ summary, onTimestampClick, onNewSummary }: SummaryViewProps) {
  const [copied, setCopied] = useState(false);

  // Parse timestamp links from markdown content (e.g., [12:34] or [1:23:45])
  const handleMarkdownClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    if (target.tagName === 'A' && target.textContent) {
      const match = target.textContent.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/);

      if (match) {
        e.preventDefault();
        const hours = match[3] ? parseInt(match[1]) : 0;
        const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);

        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        onTimestampClick(totalSeconds);
      }
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      // Convert timestamp links to YouTube URLs with escaped brackets
      const contentWithLinks = summary.content.replace(
        /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\(#\)/g,
        (match, hours_or_minutes, minutes_or_seconds, seconds) => {
          // Parse timestamp to seconds
          const hours = seconds ? parseInt(hours_or_minutes) : 0;
          const minutes = seconds ? parseInt(minutes_or_seconds) : parseInt(hours_or_minutes);
          const secs = seconds ? parseInt(seconds) : parseInt(minutes_or_seconds);
          const totalSeconds = hours * 3600 + minutes * 60 + secs;

          // Create YouTube URL with timestamp
          const youtubeUrl = `https://youtube.com/watch?v=${summary.videoId}&t=${totalSeconds}s`;

          // Extract original timestamp text and escape brackets for markdown
          const timestamp = match.match(/\[([^\]]+)\]/)?.[1] || '';
          return `[\\[${timestamp}\\]](${youtubeUrl})`;
        }
      );

      await navigator.clipboard.writeText(contentWithLinks);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
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
          {summary.content}
        </ReactMarkdown>
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
