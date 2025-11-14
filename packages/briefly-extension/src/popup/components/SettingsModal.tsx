import React, { useState } from 'react';

interface Settings {
  youtubeApiKey: string;
  openaiApiKey: string;
}

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [youtubeApiKey, setYoutubeApiKey] = useState(settings.youtubeApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ youtubeApiKey, openaiApiKey });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-indigo-600 mb-6">API Keys</h2>

            {/* YouTube API Key */}
            <div className="mb-6">
              <label htmlFor="youtube-key" className="block text-base font-semibold text-gray-900 mb-2">
                YouTube API Key
              </label>
              <input
                type="password"
                id="youtube-key"
                value={youtubeApiKey}
                onChange={(e) => setYoutubeApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your YouTube API key"
              />
              <p className="mt-2 text-sm text-gray-600">
                Get your API key from the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            {/* OpenAI API Key */}
            <div className="mb-6">
              <label htmlFor="openai-key" className="block text-base font-semibold text-gray-900 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                id="openai-key"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your OpenAI API key"
              />
              <p className="mt-2 text-sm text-gray-600">
                Get your API key from the{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  OpenAI Dashboard
                </a>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;
