export interface LanguageOption {
  code: string;
  name: string;
  nativeName?: string;
}

const LANGUAGE_DEFINITIONS: { [code: string]: LanguageOption } = {
  en: { code: 'en', name: 'English' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  uk: { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  da: { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  fi: { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  cs: { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  sk: { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  sl: { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  hr: { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  sr: { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  ro: { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  bg: { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  hu: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  el: { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  he: { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  ms: { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  th: { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  fa: { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  lv: { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  lt: { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  et: { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
};

export const LANGUAGE_OPTIONS: LanguageOption[] = Object.values(
  LANGUAGE_DEFINITIONS
)
  .filter((option, index, self) => {
    // Ensure only one option per language code is exposed in the UI
    return self.findIndex((other) => other.code === option.code) === index;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function getLanguageNameFromCode(code: string): string {
  const normalizedCode = code.trim().toLowerCase();
  const match = LANGUAGE_DEFINITIONS[normalizedCode];
  if (match) {
    return match.name;
  }

  // Fallback: try to match by base code (e.g. "pt-br" -> "pt")
  const baseCode = normalizedCode.split(/[-_]/)[0];
  const baseMatch = LANGUAGE_DEFINITIONS[baseCode];
  if (baseMatch) {
    return baseMatch.name;
  }

  return code;
}
