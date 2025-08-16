export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'th', label: 'ไทย' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' }
];

export function getLangLabel(code: string) {
  return LANGS.find(l => l.code === code)?.label || code;
}




