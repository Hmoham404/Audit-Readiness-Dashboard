import { useLanguage, type Language } from './i18n';

const languages: { code: Language; short: string; label: string }[] = [
  { code: 'fr', short: 'FR', label: 'Français' },
  { code: 'ar', short: 'AR', label: 'العربية' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'it', short: 'IT', label: 'Italiano' },
  { code: 'zh', short: 'ZH', label: '中文' },
];

function Flag({ code }: { code: Language }) {
  return <svg className="language-flag" viewBox="0 0 24 24" aria-hidden="true">
    {code === 'fr' && <><path fill="#fff" d="M0 0h24v24H0z"/><path fill="#2449b2" d="M0 0h8v24H0z"/><path fill="#ed3558" d="M16 0h8v24h-8z"/></>}
    {code === 'it' && <><path fill="#fff" d="M0 0h24v24H0z"/><path fill="#12a66b" d="M0 0h8v24H0z"/><path fill="#ed3558" d="M16 0h8v24h-8z"/></>}
    {code === 'ar' && <><path fill="#ed3558" d="M0 0h24v24H0z"/><circle fill="#fff" cx="12" cy="12" r="7"/><circle fill="#ed3558" cx="11" cy="12" r="5"/><circle fill="#fff" cx="13" cy="11" r="4.5"/><path fill="#ed3558" d="m14 8 1 2.6 2.8.1-2.2 1.7.8 2.7-2.4-1.6-2.3 1.6.8-2.7-2.3-1.7 2.8-.1z"/></>}
    {code === 'en' && <><path fill="#243b8a" d="M0 0h24v24H0z"/><path stroke="#fff" strokeWidth="5" d="m0 0 24 24M24 0 0 24"/><path stroke="#ed3558" strokeWidth="2" d="m0 0 24 24M24 0 0 24"/><path stroke="#fff" strokeWidth="8" d="M12 0v24M0 12h24"/><path stroke="#ed3558" strokeWidth="5" d="M12 0v24M0 12h24"/></>}
    {code === 'zh' && <><path fill="#ed3558" d="M0 0h24v24H0z"/><path fill="#ffdc69" d="m8 5 1.1 3.4h3.5l-2.8 2 1.1 3.4-2.9-2.1-2.9 2.1 1.1-3.4-2.8-2h3.5z"/><g fill="#ffdc69"><circle cx="15" cy="5" r=".9"/><circle cx="18" cy="8" r=".9"/><circle cx="18" cy="12" r=".9"/><circle cx="15" cy="15" r=".9"/></g></>}
  </svg>;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-switcher" dir="ltr">
    <span className="language-caption">{t('Traduction')}</span>
    <div className="language-options" role="group" aria-label={t('Choisir la langue')}>
      {languages.map(item => <button type="button" key={item.code} className={language === item.code ? 'selected' : ''}
        lang={item.code} aria-label={item.label} aria-pressed={language === item.code} onClick={() => setLanguage(item.code)}>
        <Flag code={item.code}/><span><b>{item.short}</b><small>{item.label}</small></span>
      </button>)}
    </div>
  </div>;
}
