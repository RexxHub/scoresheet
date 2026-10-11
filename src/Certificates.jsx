import { mockOf, mockGrade, isSenior, hasMock } from './lib.js';
import logo from './assets/logo.png';
import Icon from './Icon.jsx';

const TERMW = { '1ST': 'First', '2ND': 'Second', '3RD': 'Third' };
const title = (t) => String(t || '').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());

// shrink the picked signature so it stays small when saved
const readSig = (file, done) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(260, img.width), h = Math.round(img.height * (w / img.width));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
      cx.drawImage(img, 0, 0, w, h);
      done(cv.toDataURL('image/jpeg', 0.85));
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
};

export default function Certificates({ S, up }) {
  if (!hasMock(S)) return <section className="card"><p className="hint">Mock exams are only for Year 9 and Year 12.</p></section>;
  const sch = S.school, c = sch.cert || {}, sen = isSenior(S);
  const set = (k, v) => up((d) => { d.school.cert = { ...(d.school.cert || {}), [k]: v }; });
  const exam = c.exam || (sen ? 'first Mock Senior School Certificate Examination' : 'first Basic Education Certificate Examination');
  const coord = c.coord || 'COORDINATOR TWS';
  const term = TERMW[String(sch.term).toUpperCase()] || sch.term;
  const list = S.students.filter((st) => S.subjects.some((s) => mockOf(S, st.n, s) !== null));
  const rowsOf = (st) => S.subjects.map((s) => ({ s, g: mockGrade(S, mockOf(S, st.n, s)) })).filter((r) => !sen || r.g);

  return (
    <div className="stack">
      <section className="card noprint">
        <div className="rhead">
          <div>
            <h2>Mock certificates</h2>
            <p className="hint">{list.length} of {S.students.length} students have mock scores. Students with no mock score are left out. {sen ? 'Senior certificates list only the subjects the student took.' : 'Junior certificates list every subject.'}</p>
          </div>
          <button className="btn" onClick={() => window.print()} disabled={!list.length}><Icon n="print" />Print certificates</button>
        </div>
        <div className="fields">
          <label>Exam wording
            <input value={c.exam || ''} placeholder={exam} onChange={(e) => set('exam', e.target.value)} />
          </label>
          <label>Date shown on the certificate
            <input value={c.date || ''} placeholder="25th February, 2026" onChange={(e) => set('date', e.target.value)} />
          </label>
          <label>Coordinator label
            <input value={c.coord || ''} placeholder="COORDINATOR TWS" onChange={(e) => set('coord', e.target.value)} />
          </label>
          <label>Coordinator signature (picture)
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files[0]; if (f) readSig(f, (u) => set('sig', u)); }} />
          </label>
        </div>
        {c.sig && (
          <p className="hint">
            <img src={c.sig} alt="Signature" style={{ height: 40, verticalAlign: 'middle', border: '1px solid var(--line)' }} />{' '}
            <button type="button" className="lnk" onClick={() => set('sig', '')}>Remove signature</button>
          </p>
        )}
      </section>
      {list.map((st) => (
        <section className="cert" key={st.n}>
          <img className="wm" src={logo} alt="" />
          <div className="ch">
            <h2 className="cn">{sch.name}</h2>
            <p className="ca">{sch.addr}</p>
            <img className="clogo" src={logo} alt="" />
            <div className="cband">MOCK CERTIFICATE EXAMINATION</div>
            <h3 className="ctitle">STATEMENT OF RESULT/ TESTIMONIAL</h3>
            <p className="ccert">This is to Certify that</p>
            <p className="cname">{title(st.n)}</p>
            <p className="ctook">took the {exam}<br />conducted by <b>{title(sch.name)}</b>.<br />For {term} Term, {sch.session} Academic Session</p>
          </div>
          <p className="cres">The result is as stated below:</p>
          <table className="ct">
            <thead><tr><th>S/N</th><th>SUBJECTS</th><th>GRADE</th></tr></thead>
            <tbody>
              {rowsOf(st).map((r, i) => (
                <tr key={r.s}><td>{i + 1}.</td><td className="l">{r.s}</td><td>{r.g}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="cfoot">
            <div>{c.sig && <img src={c.sig} alt="" />}<b>{coord}</b></div>
            <div><span className="cdate">{c.date}</span><b>DATE</b></div>
          </div>
        </section>
      ))}
    </div>
  );
}
