import React, { useState } from 'react';
import { LANGUAGE_OPTIONS } from '../../utils/languages';

interface Settings {
  youtubeApiKey: string;
  openaiApiKey: string;
  comfortableLanguages: string[];
  enableNotifications: boolean;
}

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [youtubeApiKey, setYoutubeApiKey] = useState(settings.youtubeApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>(
    settings.comfortableLanguages || []
  );
  const [languageSearch, setLanguageSearch] = useState('');
  const [enableNotifications, setEnableNotifications] = useState(settings.enableNotifications);

  const handleLanguageToggle = (code: string) => {
    setSelectedLanguageCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comfortableLanguages = selectedLanguageCodes;
    onSave({ youtubeApiKey, openaiApiKey, comfortableLanguages, enableNotifications });
  };

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 bg-black/20 backdrop-blur-sm dark:bg-black/40 overflow-y-auto pt-8 pb-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-indigo-600 mb-6 dark:text-indigo-400">Settings</h2>

            {/* API Keys Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 dark:text-gray-300">
                API Keys
              </h3>

              {/* YouTube API Key */}
              <div className="mb-4">
                <label htmlFor="youtube-key" className="block text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">
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
              <div className="mb-4">
                <label htmlFor="openai-key" className="block text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">
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
            </div>

            {/* Preferences Section */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 dark:text-gray-300">
                Preferences
              </h3>

              {/* Comfortable Languages */}
              <div className="mb-4">
                <label htmlFor="comfortable-languages" className="block text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">
                  Comfortable Languages
                </label>
                <input
                  type="text"
                  value={languageSearch}
                  onChange={(e) => setLanguageSearch(e.target.value)}
                  placeholder="Search languages..."
                  className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-600 dark:text-gray-100"
                />
                <div
                  id="comfortable-languages"
                  className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-600"
                >
                  {LANGUAGE_OPTIONS.filter((language) => {
                    const query = languageSearch.trim().toLowerCase();
                    if (!query) {
                      return true;
                    }

                    const name = language.name.toLowerCase();
                    const native = language.nativeName ? language.nativeName.toLowerCase() : '';
                    const code = language.code.toLowerCase();

                    return (
                      name.includes(query) ||
                      (native && native.includes(query)) ||
                      code.includes(query)
                    );
                  })
                    .sort((a, b) => {
                      const aSelected = selectedLanguageCodes.includes(a.code);
                      const bSelected = selectedLanguageCodes.includes(b.code);

                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;

                      return a.name.localeCompare(b.name);
                    })
                    .map((language) => {
                    const label =
                      language.nativeName && language.nativeName !== language.name
                        ? `${language.name} (${language.nativeName})`
                        : language.name;

                    return (
                      <label
                        key={language.code}
                        className="flex items-center text-sm text-gray-800 py-1 cursor-pointer dark:text-gray-100"
                      >
                        <input
                          type="checkbox"
                          className="mr-2 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                          checked={selectedLanguageCodes.includes(language.code)}
                          onChange={() => handleLanguageToggle(language.code)}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Select the languages you are comfortable reading. Briefly will keep summaries in the video's language when it matches one of these languages; otherwise it will translate to the first language in the list.
                </p>
              </div>

              {/* Notifications */}
              <div className="mb-2">
                <label htmlFor="enable-notifications" className="block text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">
                  Notifications
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="enable-notifications"
                    checked={enableNotifications}
                    onChange={(e) => setEnableNotifications(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                    Enable notifications
                  </span>
                </label>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Show a system notification and badge when summary generation is complete. You can continue browsing while summaries are generated in the background.
                </p>
              </div>
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
