import { useState } from 'react';
import { calc, maxTotal, getScore, subjectStats, mockOf, mockGrade, gradeClass, hasMock } from './lib.js';

export default function Scores({ S, up }) {
  const [cur, setCur] = useState(0);
  const [bad, setBad] = useState('');
  const [modeSel, setMode] = useState('ca');
  const mode = hasMock(S) ? modeSel : 'ca';
  if (!S.subjects.length) return <section className="card"><p className="hint">No subjects are assigned to you in this class yet.</p></section>;
  const idx = cur < S.subjects.length ? cur : 0;
  const sub = S.subjects[idx];
  const st = subjectStats(S, sub);
  const total = S.students.length;

  const setScore = (n, k, raw, max) => {
    let v = raw;
    if (raw !== '') {
      let x = parseFloat(raw);
      if (isNaN(x)) return;
      if (x > max || x < 0) {
        x = Math.min(max, Math.max(0, x));
        setBad(n + k);
        setTimeout(() => setBad(''), 900);
      }
      v = x;
    }
    up((d) => {
      if (!d.scores[n]) d.scores[n] = {};
      if (!d.scores[n][sub]) d.scores[n][sub] = {};
      d.scores[n][sub][k] = v;
    });
  };

  const onKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nx = e.target.closest('tr').nextElementSibling;
    const el = nx && nx.querySelector(`input[data-j="${e.target.dataset.j}"]`);
    if (el) { el.focus(); el.select(); }
  };

  const show = (v) => (v === null ? '-' : v);

  return (
    <div className="stack">
      <section className="card toolbar">
        <label>Subject
          <select value={idx} onChange={(e) => setCur(+e.target.value)}>
            {S.subjects.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </label>
        {hasMock(S) && (
          <div className="seg" role="group" aria-label="Kind of marks">
            <button type="button" aria-pressed={mode === 'ca'} onClick={() => setMode('ca')}>CA marks</button>
            <button type="button" aria-pressed={mode === 'mock'} onClick={() => setMode('mock')}>Mock exam</button>
          </div>
        )}
        <p className="hint">{mode === 'ca' ? "Type each student's marks. Total, percentage and grade update as you type. Press Enter to move down a column." : "Type each student's mock exam score out of 100. The grade shows as you type. Press Enter to move down."}</p>
      </section>
      {mode === 'ca' && (<>
      <div className="stats">
        <div className="stat">
          <small>Students scored</small>
          <b>{st.n}<span>/{total}</span></b>
          <i><u style={{ width: `${total ? (st.n / total) * 100 : 0}%` }} /></i>
        </div>
        <div className="stat"><small>Class average</small><b>{show(st.avg)}{st.avg !== null && <span>%</span>}</b></div>
        <div className="stat"><small>Highest</small><b>{show(st.hi)}{st.hi !== null && <span>%</span>}</b></div>
        <div className="stat"><small>Lowest</small><b>{show(st.lo)}{st.lo !== null && <span>%</span>}</b></div>
      </div>
      <section className="card flush">
        <div className="sc">
          <table className="mk">
            <thead>
              <tr>
                <th>S/N</th><th className="nm">Student</th>
                {S.comps.map((c) => <th key={c.k}>{c.n}<small>out of {c.m}</small></th>)}
                <th>Total<small>out of {maxTotal(S)}</small></th><th>%</th><th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {S.students.map((s, i) => {
                const v = getScore(S, s.n, sub), c = calc(S, s.n, sub);
                return (
                  <tr key={s.n}>
                    <td className="sn">{i + 1}</td><td className="nm">{s.n}</td>
                    {S.comps.map((k, j) => (
                      <td key={k.k}>
                        <input type="number" inputMode="decimal" step="any" min="0" max={k.m} data-j={j}
                          aria-label={`${s.n} ${k.n}`} className={bad === s.n + k.k ? 'bad' : ''}
                          value={v[k.k] ?? ''} onChange={(e) => setScore(s.n, k.k, e.target.value, k.m)} onKeyDown={onKey} />
                      </td>
                    ))}
                    <td className="tot">{c.f ? c.t : ''}</td><td>{c.f ? c.p : ''}</td>
                    <td>{c.f && <span className={`chip ${c.gc}`}>{c.g}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </>)}
      {mode === 'mock' && <MockTable S={S} sub={sub} setScore={setScore} onKey={onKey} bad={bad} />}
    </div>
  );
}

function MockTable({ S, sub, setScore, onKey, bad }) {
  const total = S.students.length;
  const vals = S.students.map((s) => mockOf(S, s.n, sub)).filter((v) => v !== null);
  const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  return (
    <>
      <div className="stats">
        <div className="stat">
          <small>Students scored</small>
          <b>{vals.length}<span>/{total}</span></b>
          <i><u style={{ width: `${total ? (vals.length / total) * 100 : 0}%` }} /></i>
        </div>
        <div className="stat"><small>Class average</small><b>{avg === null ? '-' : avg}{avg !== null && <span>%</span>}</b></div>
      </div>
      <section className="card flush">
        <div className="sc">
          <table className="mk">
            <thead><tr><th>S/N</th><th className="nm">Student</th><th>Mock score<small>out of 100</small></th><th>Grade</th></tr></thead>
            <tbody>
              {S.students.map((s, i) => {
                const v = mockOf(S, s.n, sub), g = mockGrade(S, v);
                return (
                  <tr key={s.n}>
                    <td className="sn">{i + 1}</td><td className="nm">{s.n}</td>
                    <td>
                      <input type="number" inputMode="decimal" step="any" min="0" max="100" data-j={0}
                        aria-label={`${s.n} mock score`} className={bad === s.n + 'mock' ? 'bad' : ''}
                        value={v ?? ''} onChange={(e) => setScore(s.n, 'mock', e.target.value, 100)} onKeyDown={onKey} />
                    </td>
                    <td>{g && <span className={`chip ${gradeClass(g)}`}>{g}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
