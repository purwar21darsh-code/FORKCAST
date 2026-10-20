import type { FormEvent } from "react";
import { ArrowIcon, BranchIcon } from "./Icons";

export function RequestPanel({
  value,
  onChange,
  onSubmit,
  onSample,
  busy,
  disabled,
  hasBaseline,
  committed
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSample: () => void;
  busy: boolean;
  disabled: boolean;
  hasBaseline: boolean;
  committed: boolean;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className="request-panel" aria-labelledby="request-heading">
      <div className="section-kicker">
        <BranchIcon size={15} /> Request / deterministic demo route
      </div>
      <h2 id="request-heading">What future should we stress-test?</h2>
      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="request-text">
          Household planning request
        </label>
        <textarea
          id="request-text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          maxLength={600}
          disabled={busy}
          placeholder="Describe the plan you want FORKCAST to calculate."
        />
        <div className="request-panel__meta">
          <span className="deterministic-note">
            No LLM planning. The fixed six-guest seed is routed to the tested scheduler.
          </span>
          <span className="char-count">{value.length}/600</span>
        </div>
        <div className="request-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={disabled || busy || value.trim().length < 3}
          >
            {busy ? "Calculating…" : hasBaseline ? "Recalculate baseline" : "Calculate baseline"}
            <ArrowIcon size={16} />
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onSample}
            disabled={disabled || busy || committed}
          >
            Run sample request
          </button>
        </div>
      </form>
    </section>
  );
}
