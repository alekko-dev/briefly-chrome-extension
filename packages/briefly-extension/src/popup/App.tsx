import { useState, useEffect } from 'react';
import SettingsModal from './components/SettingsModal';
import SummaryView from './components/SummaryView';
import { getYouTubeTranscript } from '../utils/youtube';
import { generateSummary } from '../utils/openai';

interface Settings {
  youtubeApiKey: string;
  openaiApiKey: string;
}

interface Summary {
  videoId: string;
  videoTitle: string;
  content: string;
  timestamp: number;
}

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({ youtubeApiKey: '', openaiApiKey: '' });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load settings from chrome.storage
    chrome.storage.local.get(['youtubeApiKey', 'openaiApiKey'], (result) => {
      if (result.youtubeApiKey || result.openaiApiKey) {
        setSettings({
          youtubeApiKey: result.youtubeApiKey || '',
          openaiApiKey: result.openaiApiKey || '',
        });
      }
    });
  }, []);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    chrome.storage.local.set({
      youtubeApiKey: newSettings.youtubeApiKey,
      openaiApiKey: newSettings.openaiApiKey,
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

      // Generate summary using OpenAI
      const summaryContent = await generateSummary(transcript, settings.openaiApiKey);

      setSummary({
        videoId,
        videoTitle: tab.title || 'YouTube Video',
        content: summaryContent,
        timestamp: Date.now(),
      });

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
    <div className="w-full min-h-[400px] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">Briefly</h1>
            <p className="text-sm text-gray-600">AI-powered video summarizer</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="New window"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!summary && (
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating Summary...' : 'Summarize This Video'}
          </button>
        )}

        {summary && (
          <SummaryView
            summary={summary}
            onTimestampClick={handleTimestampClick}
            onNewSummary={() => setSummary(null)}
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
