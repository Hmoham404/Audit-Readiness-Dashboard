import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { messages } from './translations';

export type Language = 'fr' | 'ar' | 'en' | 'it' | 'zh';
export const LANGUAGE_KEY = 'myc-interface-language-v1';
export const locales: Record<Language, string> = { fr: 'fr-FR', ar: 'ar-TN', en: 'en-GB', it: 'it-IT', zh: 'zh-CN' };
const columns = { en: 0, ar: 1, it: 2, zh: 3 } as const;
const catalog = new Map(Object.entries(messages).map(([source, values]) => [source.toLocaleLowerCase('fr'), values]));
type Parameters = Record<string, string | number>;
const compoundMessages = Object.entries(messages).filter(([text]) => text.length > 30).sort((a, b) => b[0].length - a[0].length);
const patterns = Object.entries(messages).filter(([source]) => /\{\w+\}/.test(source)).map(([source, values]) => {
  const names: string[] = [];
  const expression = source.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { expression: new RegExp(`^${expression}$`, 'u'), names, values };
});

export function translate(language: Language, source: string, parameters: Parameters = {}) {
  const key = source.trim();
  if (!key) return source;
  let result = source;
  if (language !== 'fr') {
    const translated = catalog.get(key.toLocaleLowerCase('fr'))?.[columns[language]];
    if (translated) {
      const value = key === key.toLocaleUpperCase('fr') ? translated.toLocaleUpperCase(locales[language]) : translated;
      result = source.replace(key, value);
    } else {
      const pattern = patterns.find(item => item.expression.test(key));
      if (pattern) {
        const matched = key.match(pattern.expression)!;
        const captured = Object.fromEntries(pattern.names.map((name, i) => [name, matched[i + 1]]));
        const values = { ...captured, ...parameters };
        return source.replace(key, pattern.values[columns[language]])
          .replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
      }
      // Notices can contain several independently reported connection errors.
      for (const [text, values] of compoundMessages) {
        if (result.includes(text)) result = result.split(text).join(values[columns[language]]);
      }
    }
  }
  return result.replace(/\{(\w+)\}/g, (match, name: string) => parameters[name] === undefined ? match : String(parameters[name]));
}

const LanguageContext = createContext({ language: 'fr' as Language, locale: locales.fr, t: (source: string, parameters?: Parameters) => translate('fr', source, parameters), setLanguage: (_language: Language) => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      return saved && Object.prototype.hasOwnProperty.call(locales, saved) ? saved as Language : 'fr';
    } catch { return 'fr'; }
  });
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* The current selection still works without storage. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);
  const value = useMemo(() => ({ language, locale: locales[language], setLanguage, t: (source: string, parameters?: Parameters) => translate(language, source, parameters) }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
