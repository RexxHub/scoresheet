import { useState } from 'react';

const YEARS = ['YEAR 7', 'YEAR 8', 'YEAR 9', 'YEAR 10', 'YEAR 11', 'YEAR 12'];

export default function ClassBar({ classes, activeId, admin, onSelect, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [yr, setYr] = useState('YEAR 7');
  const [arm, setArm] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const name = yr + (arm.trim() ? ' ' + arm.trim().toUpperCase() : '');
    if (classes.some((c) => c.name === name)) { setMsg('That class already exists.'); return; }
    setBusy(true);
    await onAdd(name);
    setBusy(false); setAdding(false); setArm(''); setMsg('');
  };

  return (
    <div className="classbar noprint">
      <label>Class
        <select value={activeId} onChange={(e) => onSelect(e.target.value)} disabled={!classes.length}>
          {!classes.length && <option value="">No class yet</option>}
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{admin && !c.published ? ' (draft)' : ''}</option>)}
        </select>
      </label>
      {admin && !adding && <button type="button" className="btn alt" onClick={() => setAdding(true)}>+ New class</button>}
      {admin && adding && (
        <span className="addcls">
          <select value={yr} onChange={(e) => setYr(e.target.value)} aria-label="Year">
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <input value={arm} onChange={(e) => setArm(e.target.value)} placeholder="Arm (optional, e.g. A)" maxLength={15} aria-label="Arm" />
          <button type="button" className="btn" onClick={create} disabled={busy}>{busy ? 'Creating...' : 'Create class'}</button>
          <button type="button" className="lnk" onClick={() => { setAdding(false); setMsg(''); }}>Cancel</button>
          {msg && <span className="err">{msg}</span>}
        </span>
      )}
      {admin && activeId && !adding && <button type="button" className="lnk del" onClick={() => onDelete(activeId)}>Delete class</button>}
    </div>
  );
}
