// Renders GET /api/method in full. It holds no constants of its own.
import { useEffect, useState } from 'react';
import { ApiError, getMethod } from '../api/client';
import type { Method as MethodData, ValueKind } from '../api/types';
import './Method.css';

const KIND_WORD: Record<ValueKind, string> = { simulated: 'Simulated', estimated: 'Estimated', public: 'Public data' };
const CONSIDERATION: Record<MethodData['responsible_design'][number]['consideration'], string> = {
  environment: 'Environment',
  fairness: 'Fairness and stakeholder impact',
  transparency: 'Transparency',
  human_oversight: 'Human oversight',
  responsible_data: 'Responsible data use',
};

export function Method() {
  const [data, setData] = useState<MethodData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getMethod()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'The method could not be loaded.'));
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="method method-state" role="alert">
        <p>{error}</p>
        <button type="button" className="btn" onClick={load}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="method method-state" role="status">
        Loading the method.
      </div>
    );
  }

  return (
    <article className="method">
      <header className="method-head">
        <h2>How every number is made</h2>
        <p>
          Every figure on the board is computed by fixed rules from the values below. Nothing here is a trained model.
          Simulated values were invented for this demonstration; estimated values are computed; public values come from open data.
        </p>
      </header>

      <section aria-labelledby="m-resp">
        <h3 id="m-resp">Responsible design</h3>
        <dl className="method-resp">
          {data.responsible_design.map((r) => (
            <div key={r.consideration}>
              <dt>{CONSIDERATION[r.consideration]}</dt>
              <dd>{r.how}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="m-assume">
        <h3 id="m-assume">Assumptions</h3>
        <div className="method-scroll">
          <table className="method-table">
            <thead>
              <tr>
                <th scope="col">Assumption</th>
                <th scope="col" className="num">Value</th>
                <th scope="col">Unit</th>
                <th scope="col">Kind</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.assumptions.map((a) => (
                <tr key={a.key}>
                  <th scope="row">{a.label}</th>
                  <td className="num mono">{a.value}</td>
                  <td>{a.unit}</td>
                  <td className={`kind kind-${a.kind}`}>{KIND_WORD[a.kind]}</td>
                  <td>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="m-form">
        <h3 id="m-form">Formulas</h3>
        <dl className="method-formulas">
          {data.formulas.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd>
                <code>{f.expression}</code>
                <p>{f.explanation}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="m-src">
        <h3 id="m-src">Data sources</h3>
        <dl className="method-formulas">
          {data.data_sources.map((s) => (
            <div key={s.name}>
              <dt>
                {s.name} <span className={`kind kind-${s.kind}`}>{KIND_WORD[s.kind]}</span>
              </dt>
              <dd>
                <p>Used for: {s.used_for}</p>
                <p>Limits: {s.limits}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="m-not">
        <h3 id="m-not">Not modeled</h3>
        <ul className="method-not">
          {data.not_modeled.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
