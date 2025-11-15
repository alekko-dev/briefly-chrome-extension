import React, { useState } from 'react';

interface Settings {
  youtubeApiKey: string;
  openaiApiKey: string;
  comfortableLanguages: string[];
}

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [youtubeApiKey, setYoutubeApiKey] = useState(settings.youtubeApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
  const [comfortableLanguagesInput, setComfortableLanguagesInput] = useState(
    settings.comfortableLanguages?.join(', ') || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comfortableLanguages = comfortableLanguagesInput
      .split(/[,\n]/)
      .map((language) => language.trim())
      .filter((language) => language.length > 0);

    onSave({ youtubeApiKey, openaiApiKey, comfortableLanguages });
  };

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 bg-black/20 backdrop-blur-sm dark:bg-black/40 overflow-y-auto pt-8 pb-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-indigo-600 mb-6 dark:text-indigo-400">API Keys</h2>

            {/* YouTube API Key */}
            <div className="mb-6">
              <label htmlFor="youtube-key" className="block text-base font-semibold text-gray-900 mb-2 dark:text-gray-100">
                YouTube API Key
              </label>
              <input
                type="password"
                id="youtube-key"
                value={youtubeApiKey}
                onChange={(e) => setYoutubeApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-600 dark:text-gray-100"
                placeholder="Enter your YouTube API key"
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Get your API key from the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            {/* OpenAI API Key */}
            <div className="mb-6">
              <label htmlFor="openai-key" className="block text-base font-semibold text-gray-900 mb-2 dark:text-gray-100">
                OpenAI API Key
              </label>
              <input
                type="password"
                id="openai-key"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-600 dark:text-gray-100"
                placeholder="Enter your OpenAI API key"
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Get your API key from the{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  OpenAI Dashboard
                </a>
              </p>
            </div>

            {/* Comfortable Languages */}
            <div className="mb-2">
              <label htmlFor="comfortable-languages" className="block text-base font-semibold text-gray-900 mb-2 dark:text-gray-100">
                Comfortable Languages
              </label>
              <textarea
                id="comfortable-languages"
                value={comfortableLanguagesInput}
                onChange={(e) => setComfortableLanguagesInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-600 dark:text-gray-100"
                placeholder="Example: English, Español, Français"
                rows={3}
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Add the languages you are comfortable reading. Briefly will keep summaries in the video's language when it matches one of these entries, otherwise it will translate to the first language in the list.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
