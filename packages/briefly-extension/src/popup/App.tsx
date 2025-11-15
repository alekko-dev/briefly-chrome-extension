import { useState, useEffect } from 'react';
import SettingsModal from './components/SettingsModal';
import SummaryView from './components/SummaryView';
import { getYouTubeTranscript } from '../utils/youtube';
import { generateSummary } from '../utils/openai';

interface Settings {
  youtubeApiKey: string;
  openaiApiKey: string;
  comfortableLanguages: string[];
}

interface Summary {
  videoId: string;
  videoTitle: string;
  content: string;
  timestamp: number;
}

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    youtubeApiKey: '',
    openaiApiKey: '',
    comfortableLanguages: [],
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isYouTubeVideo, setIsYouTubeVideo] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Load settings and summary from chrome.storage
    chrome.storage.local.get(
      ['youtubeApiKey', 'openaiApiKey', 'comfortableLanguages', 'summary'],
      (result) => {
        if (result.youtubeApiKey || result.openaiApiKey || result.comfortableLanguages) {
          setSettings({
            youtubeApiKey: result.youtubeApiKey || '',
            openaiApiKey: result.openaiApiKey || '',
            comfortableLanguages: Array.isArray(result.comfortableLanguages)
              ? result.comfortableLanguages
              : [],
          });
        }

        // Load stored summary and check if it matches current video
        if (result.summary) {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            const videoId = tab.url?.includes('youtube.com/watch')
              ? new URL(tab.url).searchParams.get('v')
              : null;

            // Only load summary if it matches the current video
            if (videoId && result.summary.videoId === videoId) {
              setSummary(result.summary);
            } else {
              // Clear stale summary from storage
              chrome.storage.local.remove('summary');
            }
          });
        }
      }
    );
  }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const [tab] = tabs;
      const isVideo = !!tab?.url && tab.url.includes('youtube.com/watch');
      setIsYouTubeVideo(isVideo);
    });
  }, []);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const width = isExpanded ? '600px' : '400px';
    const height = isExpanded ? '600px' : '500px';

    body.style.width = width;
    body.style.minHeight = height;

    html.style.width = width;
    html.style.height = height;
  }, [isExpanded]);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    chrome.storage.local.set({
      youtubeApiKey: newSettings.youtubeApiKey,
      openaiApiKey: newSettings.openaiApiKey,
      comfortableLanguages: newSettings.comfortableLanguages,
    });
    setShowSettings(false);
  };

  const handleSummarize = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!settings.openaiApiKey) {
        setError('Please configure your OpenAI API key in settings');
        setShowSettings(true);
        return;
      }

      // Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url?.includes('youtube.com/watch')) {
        setError('Please open a YouTube video page');
        return;
      }

      const videoId = new URL(tab.url).searchParams.get('v');
      if (!videoId) {
        setError('Could not extract video ID from URL');
        return;
      }

      // Extract transcript
      const transcript = await getYouTubeTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        setError('Could not extract transcript from this video. The video may not have captions available.');
        return;
      }

      const comfortableLanguages = settings.comfortableLanguages
        ?.map((lang) => lang.trim())
        .filter((lang) => lang.length > 0);

      // Generate summary using OpenAI
      const summaryContent = await generateSummary(transcript, settings.openaiApiKey, {
        comfortableLanguages,
      });

      const newSummary = {
        videoId,
        videoTitle: tab.title || 'YouTube Video',
        content: summaryContent,
        timestamp: Date.now(),
      };

      setSummary(newSummary);

      // Persist summary to chrome.storage
      chrome.storage.local.set({ summary: newSummary });

    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while generating the summary');
    } finally {
      setLoading(false);
    }
  };

  const handleTimestampClick = async (timeInSeconds: number) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SEEK_VIDEO',
          time: timeInSeconds,
        });
      }
    } catch (err) {
      console.error('Error seeking video:', err);
    }
  };

  return (
    <div className="w-full min-h-[400px] h-full bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Briefly</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered video summarizer</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-800"
              title="Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-800"
              title={isExpanded ? 'Reduce size' : 'Expand size'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/40 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!summary && isYouTubeVideo && (
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-20"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="80"
                    strokeDashoffset="60"
                  />
                </svg>
                <span>Generating Summary...</span>
              </span>
            ) : (
              'Summarize This Video'
            )}
          </button>
        )}

        {!summary && isYouTubeVideo === false && (
          <div className="w-full p-6 bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center text-center gap-3 dark:bg-slate-900 dark:border-slate-700">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm dark:bg-indigo-500">
              B
            </div>
            <div className="text-sm text-gray-700 max-w-xs dark:text-gray-200">
              <p className="font-medium text-gray-900 dark:text-gray-100">Open a YouTube video to get started</p>
              <p className="mt-1 text-gray-600 dark:text-gray-300">
                Briefly can summarize videos that are open in your current tab. Navigate to any YouTube
                video, then reopen this popup to generate a summary.
              </p>
            </div>
          </div>
        )}

        {summary && (
          <SummaryView
            summary={summary}
            onTimestampClick={handleTimestampClick}
            onNewSummary={() => {
              setSummary(null);
              chrome.storage.local.remove('summary');
            }}
          />
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
