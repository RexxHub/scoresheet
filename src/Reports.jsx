import { calc, maxTotal, getScore, scoredCount, overall } from './lib.js';
import Logo from './Logo.jsx';
import Icon from './Icon.jsx';

export default function Reports({ S, up }) {
  const sch = S.school;
  const done = S.subjects.filter((s) => scoredCount(S, s) === S.students.length).length;
  return (
    <div className="stack">
      <section className="card noprint">
        <div className="rhead">
          <div>
            <h2>Ready to print</h2>
            <p className="hint">{done} of {S.subjects.length} subjects have scores for every student. Missing marks print as blank cells.</p>
          </div>
          <button className="btn" onClick={() => window.print()}><Icon n="print" />Print all slips</button>
        </div>
        <div className="chk">
          {S.subjects.map((s) => {
            const n = scoredCount(S, s);
            return <span key={s} className={n === S.students.length ? 'ok' : ''}>{s} {n}/{S.students.length}</span>;
          })}
        </div>
      </section>
      {S.students.map((st) => {
        const o = overall(S, st);
        return (
          <section className="slip" key={st.n}>
            <div className="sh">
              <Logo size="slip" />
              <div>
                <div className="sn1">{sch.name}</div>
                <div className="sa">{sch.addr}</div>
              </div>
            </div>
            <div className="band">
              <b>{sch.ca} CONTINUOUS ASSESSMENT REPORT</b>
              <span>{sch.session} Academic Session ({sch.section})</span>
            </div>
            <div className="info">
              <div className="who2"><small>Student</small><b>{st.n}</b></div>
              <div><small>Term</small><b>{sch.term}</b></div>
              <div><small>Class</small><b>{sch.cls}</b></div>
              <div><small>Gender</small><b>{st.g}</b></div>
              <div><small>No in class</small><b>{S.students.length}</b></div>
            </div>
            <table className="rp">
              <thead>
                <tr>
                  <th>S/N</th><th className="s">Subjects</th>
                  {S.comps.map((k) => <th key={k.k}>{k.n} ({k.m})</th>)}
                  <th>Total ({maxTotal(S)})</th><th>Per (100%)</th><th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {S.subjects.map((s, i) => {
                  const v = getScore(S, st.n, s), c = calc(S, st.n, s);
                  return (
                    <tr key={s}>
                      <td>{i + 1}</td><td className="s">{s}</td>
                      {S.comps.map((k) => <td key={k.k}>{v[k.k] === undefined || v[k.k] === '' ? '' : v[k.k]}</td>)}
                      <td><b>{c.f ? c.t : ''}</b></td><td>{c.f ? c.p : ''}</td>
                      <td>{c.f && <span className={`chip ${c.g}`}>{c.g}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {o.n > 0 && (
              <div className="sum">
                <div><small>Total obtained</small><b>{o.sum} / {o.max}</b></div>
                <div><small>Overall percentage</small><b>{o.pct}%</b></div>
                <div><small>Overall grade</small><b><span className={`chip ${o.g}`}>{o.g}</span></b></div>
              </div>
            )}
            <p className="scale">
              <span><i className="chip A">A</i> 80-100 Excellent</span>
              <span><i className="chip B">B</i> 70-79 Very good</span>
              <span><i className="chip C">C</i> 60-69 Credit</span>
              <span><i className="chip P">P</i> 50-59 Pass</span>
              <span><i className="chip F">F</i> 0-49 Fail</span>
            </p>
            <div className="sig">
              <label className="w">Remark
                <textarea value={S.rem[st.n] || ''} onChange={(e) => up((d) => { d.rem[st.n] = e.target.value; })} />
              </label>
              <div><small>Name</small><span>{sch.teacher}</span></div>
              <div><small>Designation</small><span>{sch.desig}</span></div>
              <div className="w"><small>Sign / Date</small><span /></div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
