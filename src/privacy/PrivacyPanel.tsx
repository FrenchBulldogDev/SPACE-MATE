import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { privacyMessages } from './messages';

export default function PrivacyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { language, hasSavedLanguage, forgetLanguage } = useLanguage();
  const copy = privacyMessages[language];
  const [clearError, setClearError] = useState(false);
  useEffect(() => {
    if (open && !dialog.current!.open) { setClearError(false); dialog.current!.showModal(); }
    if (!open && dialog.current!.open) dialog.current!.close();
  }, [open]);
  return <dialog ref={dialog} className="privacy-dialog" aria-labelledby="privacy-title" onCancel={onClose} onClose={onClose}>
    <div className="privacy-heading"><ShieldCheck size={24} /><h2 id="privacy-title">{copy.title}</h2><button className="icon-button" onClick={onClose} aria-label={copy.close}><X size={18} /></button></div>
    <p>{copy.overview}</p>
    <section><h3>{copy.languageTitle}</h3><p>{copy.languageInfo}</p><p className="privacy-status" role="status">{hasSavedLanguage ? copy.saved : copy.empty}</p><button className="button" disabled={!hasSavedLanguage} onClick={() => setClearError(!forgetLanguage())}>{copy.forget}</button>{clearError && <p role="alert">{copy.storageError}</p>}</section>
    <section><h3>{copy.permissionsTitle}</h3><p>{copy.permissionsInfo}</p></section>
    <section><h3>{copy.ephemerisTitle}</h3><p>{copy.ephemerisInfo}</p></section>
    <section><h3>{copy.scopeTitle}</h3><p>{copy.scopeInfo}</p></section>
  </dialog>;
}
