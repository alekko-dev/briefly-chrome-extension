import React from 'react';
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

  return (
    <div className="space-y-4">
      {/* Video Info */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-1">{summary.videoTitle}</h3>
        <p className="text-xs text-gray-500">
          Generated {new Date(summary.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Summary Content */}
      <div
        className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-h-[500px] overflow-y-auto prose prose-sm max-w-none"
        onClick={handleMarkdownClick}
      >
        <ReactMarkdown
          components={{
            // Style for timestamps
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium"
              />
            ),
            // Add styling for other markdown elements
            h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold mb-3 text-gray-900" />,
            h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-bold mb-2 text-gray-900" />,
            h3: ({ node, ...props }) => <h3 {...props} className="text-base font-semibold mb-2 text-gray-900" />,
            p: ({ node, ...props }) => <p {...props} className="mb-3 text-gray-700 leading-relaxed" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 mb-3 space-y-1" />,
            ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 mb-3 space-y-1" />,
            li: ({ node, ...props }) => <li {...props} className="text-gray-700" />,
          }}
        >
          {summary.content}
        </ReactMarkdown>
      </div>

      {/* New Summary Button */}
      <button
        onClick={onNewSummary}
        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
      >
        Generate New Summary
      </button>
    </div>
  );
}

export default SummaryView;
