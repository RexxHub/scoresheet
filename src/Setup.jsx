import { parseStudents, maxTotal, SUBJECTS, SENIOR_SUBJECTS } from './lib.js';

const FIELDS = [['name', 'School name'], ['addr', 'Address'], ['ca', 'Assessment (e.g. FIRST)'], ['session', 'Session'], ['section', 'Section'], ['term', 'Term'], ['cls', 'Class'], ['teacher', 'Class teacher name'], ['desig', 'Designation']];

export default function Setup({ S, up }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>School and class details</h2>
        <p className="hint">These appear on every report slip. Changes save automatically.</p>
        <div className="fields">
          {FIELDS.map(([k, l]) => (k === 'section' ? (
            <label key={k}>{l}
              <select value={/senior/i.test(S.school.section) ? 'SENIOR SECTION' : 'JUNIOR SECTION'} onChange={(e) => up((d) => { d.school.section = e.target.value; })}>
                <option>JUNIOR SECTION</option>
                <option>SENIOR SECTION</option>
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
