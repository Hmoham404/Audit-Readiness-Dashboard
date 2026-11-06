import { useLanguage } from './i18n';
import type { Point } from './data';

type Props = {
  points: Point[];
  selected: string;
  onSelect: (department: string) => void;
};

export function DepartmentProgress({ points, selected, onSelect }: Props) { const { t, locale } = useLanguage();
  const departments = [...new Set(points.map(point => point.department))].sort((a, b) => a.localeCompare(b, locale));
  const circumference = 2 * Math.PI * 42;

  return <section className="department-progress" aria-labelledby="department-progress-heading">
    <div className="department-progress-heading">
      <h2 id="department-progress-heading">{t("Avancement par département")}</h2>
      <p>{t("Points terminés / points applicables · cliquez pour filtrer")}</p>
    </div>
    <div className="department-progress-grid">
      {departments.map(department => {
        const list = points.filter(point => point.department === department);
        const applicable = list.filter(point => point.applicable);
        const done = applicable.filter(point => point.status === 1).length;
        const pending = applicable.length - done;
        const na = list.length - applicable.length;
        const percentage = applicable.length ? `${Math.round(done / applicable.length * 100)}%` : t("N/A");
        const label = department || t("Non renseigné");
        const doneLength = done / list.length * circumference;
        const pendingLength = pending / list.length * circumference;

        return <button type="button" key={department} className={`panel department-progress-card ${selected === department ? 'active' : ''}`}
          aria-label={t("Afficher les points du département {0}", { "0": label })} aria-pressed={selected === department}
          onClick={() => onSelect(selected === department ? 'Tous' : department)}>
          <h3>{label}</h3>
          <div className="department-ring" role="img" aria-label={t("{0} : {1}, {2} terminés sur {3} points applicables, {4} en cours, {5} non applicables", { "0": label, "1": percentage, "2": done, "3": applicable.length, "4": pending, "5": na })}>
            <svg viewBox="0 0 104 104" aria-hidden="true">
              <circle className="department-ring-track" cx="52" cy="52" r="42"/>
              <g transform="rotate(-90 52 52)">
                <circle className="department-ring-done" cx="52" cy="52" r="42" strokeDasharray={`${doneLength} ${circumference}`}/>
                <circle className="department-ring-pending" cx="52" cy="52" r="42" strokeDasharray={`${pendingLength} ${circumference}`} strokeDashoffset={-doneLength}/>
              </g>
            </svg>
            <div className="department-ring-label"><strong>{percentage}</strong><span>{done} / {applicable.length}</span></div>
          </div>
          <div className="department-progress-legend"><span><i className="dot green"/>{done}{t(" terminés")}</span><span><i className="dot orange"/>{pending}{t(" en cours")}</span></div>
          <small>{t(list.length === 1 ? "{count} point" : "{count} points", { count: list.length })}{na > 0 ? t(" · {0} N/A", { "0": na }) : t("")}</small>
        </button>;
      })}
    </div>
    {!departments.length && <p className="department-progress-empty">{t("Aucun point dans cet audit pour le moment.")}</p>}
  </section>;
}
