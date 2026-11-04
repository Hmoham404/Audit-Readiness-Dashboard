import type { Point } from './data';

export function NonConformityDetails({ point }: { point: Point }) {
  const details = point.details;
  if (!details) return null;
  const fields = [
    ['Faits non conformes', details.facts], ['Référence / clause', details.reference],
    ['Département', point.department], ['Responsable du département', details.departmentOwner],
    ['Type de non-conformité', details.ncType], ['Analyse des causes', details.causes],
    ['Correction', details.correction], ['Action corrective', details.correctiveAction],
    ['Date de vérification', details.verificationDate ? new Date(`${details.verificationDate}T12:00:00`).toLocaleDateString('fr-FR') : ''],
    ['Vérification / efficacité', details.verification], ['Observations / preuves', details.observations],
  ];
  return <section className="detail-block nc-details"><h4>Non-conformité relevée</h4><dl>{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><details className="nc-source"><summary>Source Excel</summary><p>{details.sourceFile}<br/>{details.sourceSheet} · ligne {details.sourceRow}</p></details></section>;
}
