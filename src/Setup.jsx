import { parseStudents, maxTotal, SUBJECTS, SENIOR_SUBJECTS, isSenior, sectionOf } from './lib.js';

const SCHOOL = [['name', 'School name'], ['addr', 'Address'], ['ca', 'Assessment (e.g. FIRST)'], ['session', 'Session'], ['term', 'Term']];
const YEARS = ['YEAR 7', 'YEAR 8', 'YEAR 9', 'YEAR 10', 'YEAR 11', 'YEAR 12'];

export default function Setup({ S, up, cx }) {
  const unassigned = cx ? S.subjects.filter((s) => !cx.teacherOf(s)).length : 0;
  const assigned = S.subjects.length - unassigned;
  const canPublish = cx && (cx.published || (S.students.length > 0 && assigned > 0));

  return (
    <div className="stack">
      <section className="card">
        <h2>School details</h2>
        <p className="hint">These appear on every report slip and certificate, for all classes. Changes save automatically.</p>
        <div className="fields">
          {SCHOOL.map(([k, l]) => (
            <label key={k}>{l}
              <input value={S.school[k]} onChange={(e) => up((d) => { d.school[k] = e.target.value; })} />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Class details</h2>
        <p className="hint">Year 7 to 9 is the <b>junior</b> section (grades A to F). Year 10 to 12 is the <b>senior</b> section (grades A1 to F9). The same grades are used for CA and mock.</p>
        <div className="fields">
          {cx ? (
            <div className="ro"><small>Class</small><b>{S.school.cls}</b><span>{sectionOf(S)}</span></div>
          ) : (
            <label>Class
              <select value={S.school.cls} onChange={(e) => {
                const v = e.target.value;
                const was = isSenior(S), now = isSenior({ school: { cls: v, section: S.school.section } });
                up((d) => { d.school.cls = v; d.school.section = now ? 'SENIOR SECTION' : 'JUNIOR SECTION'; });
                if (was !== now && window.confirm(`Switch the subject list to the ${now ? 'senior' : 'junior'} subjects?`)) up((d) => { d.subjects = now ? [...SENIOR_SUBJECTS] : [...SUBJECTS]; });
              }}>
                {[...new Set([...YEARS, S.school.cls])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}
          <label>Class teacher name
            <input value={S.school.teacher} onChange={(e) => up((d) => { d.school.teacher = e.target.value; })} />
          </label>
          <label>Designation
            <input value={S.school.desig} onChange={(e) => up((d) => { d.school.desig = e.target.value; })} />
          </label>
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

      {cx && (
        <section className="card">
          <h2>Teacher assignments</h2>
          <p className="hint">Choose which teacher handles each subject in {S.school.cls}. Teachers see only their own subjects and can only enter scores. Assignments save as soon as you pick a teacher.</p>
          {cx.people.length === 0 && <p className="hint">No teacher accounts yet. Ask each teacher to sign up, then they will appear here.</p>}
          <table className="assign">
            <thead><tr><th>S/N</th><th>Subject</th><th>Teacher</th></tr></thead>
            <tbody>
              {S.subjects.map((s, i) => (
                <tr key={s}>
                  <td>{i + 1}</td><td>{s}</td>
                  <td>
                    <select value={cx.teacherOf(s)} onChange={(e) => cx.assign(s, e.target.value)} aria-label={`Teacher for ${s}`}>
                      <option value="">Not assigned</option>
                      {cx.people.map((p) => <option key={p.id} value={p.id}>{p.name ? `${p.name} (${p.email})` : p.email}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {cx && (
        <section className="card pub">
          <div className="rhead">
            <div>
              <h2>Publish this class <span className={`badge${cx.published ? ' live' : ''}`}>{cx.published ? 'Published' : 'Draft'}</span></h2>
              <p className="hint">
                {cx.published
                  ? 'Assigned teachers can see this class and enter scores for their subjects. Unpublish to hide it from them again; their entered scores are kept.'
                  : 'Teachers cannot see this class yet. Publish when the students, subjects and teacher assignments are ready.'}
              </p>
              <ul className="checks">
                <li className={S.students.length ? 'ok' : ''}>{S.students.length} students</li>
                <li className={S.subjects.length ? 'ok' : ''}>{S.subjects.length} subjects</li>
                <li className={assigned > 0 && unassigned === 0 ? 'ok' : ''}>{assigned} of {S.subjects.length} subjects have a teacher</li>
              </ul>
            </div>
            <button className="btn" onClick={() => cx.publish(!cx.published)} disabled={!canPublish}>{cx.published ? 'Unpublish' : 'Publish to teachers'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
