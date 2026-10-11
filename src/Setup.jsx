import { parseStudents, maxTotal } from './lib.js';

const FIELDS = [['name', 'School name'], ['addr', 'Address'], ['ca', 'Assessment (e.g. FIRST)'], ['session', 'Session'], ['section', 'Section'], ['term', 'Term'], ['cls', 'Class'], ['teacher', 'Class teacher name'], ['desig', 'Designation']];

export default function Setup({ S, up }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>School and class details</h2>
        <p className="hint">These appear on every report slip. Changes save automatically.</p>
        <div className="fields">
          {FIELDS.map(([k, l]) => (
            <label key={k}>{l}
              <input value={S.school[k]} onChange={(e) => up((d) => { d.school[k] = e.target.value; })} />
            </label>
          ))}
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
          <p className="hint">One subject per line.</p>
          <textarea aria-label="Subjects" defaultValue={S.subjects.join('\n')} onBlur={(e) => {
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
