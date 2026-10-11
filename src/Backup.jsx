import { useState } from 'react';
import * as cloud from './cloud.js';
import { periodOf } from './cloud.js';
import { calc, maxTotal, mockOf, mockGrade, defaults } from './lib.js';
import Icon from './Icon.jsx';

const KEY = 'caportal_last_backup';
const getLast = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const stamp = () => new Date().toISOString().slice(0, 10);
const save = (name, text, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// one spreadsheet row per student and subject, for the current session, term and assessment
async function resultsCsv(list, glob) {
  const period = periodOf(glob);
  const names = [];
  const rows = [];
  for (const c of list) {
    const r = await cloud.fetchScores(c.id, period);
    if (r.error) return { error: r.error };
    const d = c.data || {};
    const S = { school: { ...glob, cls: c.name }, comps: d.comps || defaults().comps, subjects: d.subjects || [], students: d.students || [], scores: r.scores, rem: d.rem || {} };
    S.comps.forEach((k) => { if (!names.includes(k.n)) names.push(k.n); });
    S.students.forEach((st) => S.subjects.forEach((sub) => {
      const f = calc(S, st.n, sub), mk = mockOf(S, st.n, sub);
      if (!f.f && mk === null) return;
      const parts = {};
      S.comps.forEach((k) => { const v = S.scores[st.n] && S.scores[st.n][sub] ? S.scores[st.n][sub][k.k] : undefined; parts[k.n] = v === undefined ? '' : v; });
      rows.push({ cls: c.name, n: st.n, g: st.g, sub, parts, f, mk, mg: mockGrade(S, mk), max: maxTotal(S) });
    }));
  }
  const head = ['Class', 'Session', 'Term', 'Assessment', 'Student', 'Gender', 'Subject', ...names, 'Total', 'Out of', 'Percent', 'Grade', 'Mock score', 'Mock grade'];
  const lines = [head, ...rows.map((x) => [x.cls, glob.session, glob.term, glob.ca, x.n, x.g, x.sub, ...names.map((n) => (n in x.parts ? x.parts[n] : '')),
    x.f.f ? x.f.t : '', x.f.f ? x.max : '', x.f.f ? x.f.p : '', x.f.f ? x.f.g : '', x.mk === null ? '' : x.mk, x.mg])];
  return { csv: '\ufeff' + lines.map((l) => l.map(cell).join(',')).join('\r\n'), count: rows.length };
}

export default function Backup({ classes, glob }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState(getLast());

  const full = async () => {
    setBusy('full'); setMsg('');
    const r = await cloud.fetchEverything();
    if (r.error) { setMsg('Backup failed: ' + r.error.message); setBusy(''); return; }
    const payload = { app: 'ca-score-portal', version: 1, exportedAt: new Date().toISOString(), ...r.data };
    save(`ca-portal-backup-${stamp()}.json`, JSON.stringify(payload, null, 1), 'application/json');
    const now = new Date().toISOString();
    try { localStorage.setItem(KEY, now); } catch (e) { /* ignore */ }
    setLast(now);
    setMsg(`Backup downloaded: ${r.data.classes.length} classes and ${r.data.scores.length} saved scores. Keep the file somewhere safe.`);
    setBusy('');
  };

  const results = async (list, label) => {
    setBusy(label); setMsg('');
    const r = await resultsCsv(list, glob);
    if (r.error) { setMsg('Export failed: ' + r.error.message); setBusy(''); return; }
    if (!r.count) { setMsg('There are no scores to export for this session, term and assessment yet.'); setBusy(''); return; }
    const nm = list.length === 1 ? list[0].name.replace(/\s+/g, '-') : 'all-classes';
    save(`results-${nm}-${stamp()}.csv`, r.csv, 'text/csv;charset=utf-8');
    setMsg(`Spreadsheet downloaded (${r.count} rows). Open it with Excel.`);
    setBusy('');
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Full backup</h2>
        <p className="hint">Saves everything in one file: school details, classes, students, subjects, teacher assignments and every saved score. Do this at the end of each term and before big changes. Store the file on a flash drive or Google Drive. It holds student names and scores, so do not share it publicly.</p>
        <div className="rhead">
          <p className="hint">{last ? `Last backup from this browser: ${new Date(last).toLocaleString()}` : 'No backup has been made from this browser yet.'}</p>
          <button className="btn" onClick={full} disabled={!!busy}><Icon n="file" />{busy === 'full' ? 'Preparing...' : 'Download backup'}</button>
        </div>
      </section>
      <section className="card">
        <h2>Results spreadsheet</h2>
        <p className="hint">Marks, totals, percentages and grades for {glob.session} session, {glob.term} term, {glob.ca} assessment. One row per student and subject. Opens in Excel.</p>
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => results(classes, 'all')} disabled={!!busy || !classes.length}>{busy === 'all' ? 'Preparing...' : 'Download all classes'}</button>
        </div>
        <table className="assign">
          <thead><tr><th>Class</th><th>Status</th><th /></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><span className={`badge${c.published ? ' live' : ''}`}>{c.published ? 'Published' : 'Draft'}</span></td>
                <td><button className="btn alt" onClick={() => results([c], c.id)} disabled={!!busy}>{busy === c.id ? 'Preparing...' : 'Download'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {msg && <p className="hint" role="status">{msg}</p>}
    </div>
  );
}
