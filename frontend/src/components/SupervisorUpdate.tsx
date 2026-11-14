import { useState } from 'react';
import type { Decision } from '../api/types';

/** Read-only drafted message. The dispatcher sends it; the tool never does. */
export function SupervisorUpdate({ decision, compact = false }: { decision: Decision; compact?: boolean }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(decision.supervisor_update);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    window.setTimeout(() => setCopied('idle'), 2500);
  };
  return (
    <section className={`sup${compact ? ' sup-compact' : ''}`} aria-label={`Supervisor update for ${decision.shipment_id}`}>
      {!compact && <h3>Supervisor update, drafted</h3>}
      <pre className="sup-text" tabIndex={0}>
        {decision.supervisor_update}
      </pre>
      <div className="sup-actions">
        <button type="button" className="btn" onClick={copy}>
          Copy
        </button>
        <span role="status" className="sup-status">
          {copied === 'ok' ? 'Copied to clipboard.' : copied === 'fail' ? 'Copy failed. Select the text and copy it.' : ''}
        </span>
      </div>
      <p className="sup-note">The tool does not send anything.</p>
    </section>
  );
}
