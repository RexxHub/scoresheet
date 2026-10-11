import { parseStudents, maxTotal, SUBJECTS, SENIOR_SUBJECTS, isSenior } from './lib.js';

const FIELDS = [['name', 'School name'], ['addr', 'Address'], ['ca', 'Assessment (e.g. FIRST)'], ['session', 'Session'], ['term', 'Term'], ['cls', 'Class'], ['teacher', 'Class teacher name'], ['desig', 'Designation']];

export default function Setup({ S, up }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>School and class details</h2>
        <p className="hint">These appear on every report slip. Changes save automatically.</p>
        <p className="hint">Year 7 to 9 is the <b>junior</b> section (grades A to F). Year 10 to 12 is the <b>senior</b> section (grades A1 to F9). This is picked from the class, and the same grades are used for CA and mock.</p>
        <div className="fields">
          {FIELDS.map(([k, l]) => (k === 'cls' ? (
            <label key={k}>{l}
              <select value={S.school.cls} onChange={(e) => {
                const v = e.target.value;
                const was = isSenior(S), now = isSenior({ school: { cls: v, section: S.school.section } });
                up((d) => { d.school.cls = v; d.school.section = now ? 'SENIOR SECTION' : 'JUNIOR SECTION'; });
                if (was !== now && window.confirm(`Switch the subject list to the ${now ? 'senior' : 'junior'} subjects?`)) up((d) => { d.subjects = now ? [...SENIOR_SUBJECTS] : [...SUBJECTS]; });
              }}>
                {[...new Set([...['YEAR 7', 'YEAR 8', 'YEAR 9', 'YEAR 10', 'YEAR 11', 'YEAR 12'], S.school.cls])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          ) : (
            <label key={k}>{l}
              <input value={S.school[k]} onChange={(e) => up((d) => { d.school[k] = e.target.value; })} />
            </label>
          )))}
        </div>
      </section>
      <div className="cols">
        <section className="card">
          <h2>Score columns</h2>
          <p className="hint">The parts that make up one CA. Total is out of <b>{maxTotal(S)}</b>.</p>
          {S.comps.map((c, i) => (
            <div className="comp" key={c.k}>
              <label>Name
                <input value={c.n} onChange={(e) => up((d) => { d.comps[i].n = e.target.value; })} />
              </label>
              <label>Max mark
                <input type="number" min="0" step="any" value={c.m} onChange={(e) => up((d) => { d.comps[i].m = Math.max(0, parseFloat(e.target.value) || 0); })} />
              </label>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>Subjects <span className="count">{S.subjects.length}</span></h2>
          <p className="hint">One subject per line. Senior section uses WAEC grades (A1 to F9); junior uses A to F.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
            <button type="button" className="btn alt" onClick={() => { if (window.confirm('Replace the subject list with the junior subjects?')) up((d) => { d.subjects = [...SUBJECTS]; }); }}>Use junior list</button>
            <button type="button" className="btn alt" onClick={() => { if (window.confirm('Replace the subject list with the senior subjects?')) up((d) => { d.subjects = [...SENIOR_SUBJECTS]; }); }}>Use senior list</button>
          </div>
          <textarea aria-label="Subjects" key={S.subjects.join('|')} defaultValue={S.subjects.join('\n')} onBlur={(e) => {
            const a = e.target.value.split('\n').map((x) => x.trim().toUpperCase()).filter(Boolean);
            if (a.length) up((d) => { d.subjects = a; });
          }} />
        </section>
        <section className="card">
          <h2>Students <span className="count">{S.students.length}</span></h2>
          <p className="hint">One per line: NAME, M or F. Paste the whole class.</p>
          <textarea aria-label="Students" defaultValue={S.students.map((s) => `${s.n}, ${s.g === 'FEMALE' ? 'F' : 'M'}`).join('\n')} onBlur={(e) => {
            const a = parseStudents(e.target.value);
            if (a.length) up((d) => { d.students = a; });
          }} />
        </section>
      </div>
    </div>
  );
}
