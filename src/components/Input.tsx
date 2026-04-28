import type React from "react";
import { IconStar } from "../icons";

export function Input({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`choice ${selected ? "selected" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function OptionGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly (readonly [T, string])[];
  value: T | "";
  onChange: (value: T) => void;
}) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="segmented">
        {options.map(([optionValue, label]) => (
          <Choice key={optionValue} selected={value === optionValue} onClick={() => onChange(optionValue)}>
            {label}
          </Choice>
        ))}
      </div>
    </section>
  );
}

export function Metric({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`metric ${className}`}>
      <strong>{value}</strong>
      <span className="muted small">{label}</span>
    </div>
  );
}

/**
 * Interactive 1–5 star rating with large touch targets.
 * Tapping a star sets the value; tapping the active star again clears it.
 */
export function StarRating({
  title,
  value,
  onChange,
  max = 5,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const numericValue = Number(value) || 0;

  return (
    <section className="star-rating-section">
      <h3>{title}</h3>
      <div className="star-rating" role="radiogroup" aria-label={title}>
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          const filled = starValue <= numericValue;
          return (
            <button
              key={starValue}
              className={`star-button ${filled ? "filled" : ""}`}
              onClick={() => onChange(starValue === numericValue ? "" : String(starValue))}
              aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
              aria-checked={starValue === numericValue}
              role="radio"
              type="button"
            >
              <IconStar size={28} />
            </button>
          );
        })}
        {numericValue > 0 && (
          <span className="star-value">{numericValue}</span>
        )}
      </div>
    </section>
  );
}
