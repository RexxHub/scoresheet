import { useState } from 'react';
import sql from '../supabase.sql?raw';

export default function SetupHelp({ onRetry }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) { /* user can select the text */ }
  };
  return (
    <div className="authwrap">
      <div className="authmain">
        <div className="card setuphelp">
          <h2>One step left: create the database table</h2>
          <p className="hint">Your Supabase keys work, but the table that stores scores does not exist yet.</p>
          <ol>
            <li>Open your Supabase project and go to <b>SQL Editor</b>, then <b>New query</b>.</li>
            <li>Copy the SQL below, paste it in, and click <b>Run</b>.</li>
            <li>Come back here and click <b>I have run it</b>.</li>
          </ol>
          <textarea readOnly value={sql} aria-label="SQL to run in Supabase" onFocus={(e) => e.target.select()} />
          <div className="row">
            <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy SQL'}</button>
            <button className="btn alt" onClick={onRetry}>I have run it</button>
          </div>
        </div>
      </div>
    </div>
  );
}
