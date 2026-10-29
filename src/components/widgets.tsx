import { useEffect, useRef, useState } from "react";
import type { Metric, TableData } from "../types";

export function Info({ text }: { text: string }) {
  return <span className="hint" tabIndex={0} title={text} aria-label={text}>i</span>;
}

export function Callout({ level, text, strong = false }: { level: "success" | "warning" | "error" | "info"; text: string; strong?: boolean }) {
  return <div className={`callout ${level}`} role="status">{strong ? <strong>{text}</strong> : text}</div>;
}

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metrics">
      {metrics.map((metric) => (
        <article className="metric" key={metric.label}>
          <div className="metric-label">
            {metric.label}
            {metric.help ? <Info text={metric.help} /> : null}
          </div>
          <div className="metric-value">{metric.value}</div>
          {metric.delta ? <div className="metric-delta">{metric.delta}</div> : null}
        </article>
      ))}
    </div>
  );
}

function cellClass(key: string): string | undefined {
  if (/payout|cpi|cvr|install|organic|bid|impression|click|cost|value/i.test(key)) return "num";
  if (/formula|calculation/i.test(key)) return "formula";
  if (/^step$/i.test(key)) return "step";
  return undefined;
}

export function DataTable({ table }: { table: TableData }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column.key} className={cellClass(column.key)}>
                {column.key}
                {column.help ? <Info text={column.help} /> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={`${row["Bundle id"] ?? index}-${index}`}>
              {table.columns.map((column) => {
                const value = row[column.key] ?? "";
                const cls = cellClass(column.key);
                return (
                  <td key={column.key} className={cls}>
                    {column.key === "Bundle id"
                      ? <code>{value}</code>
                      : column.key === "Same store category" && value
                        ? <span className={value === "Yes" ? "pill yes" : "pill"}>{value}</span>
                        : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NumberField({
  label, value, onChange, min, max, step, digits, help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  help?: string;
}) {
  const [text, setText] = useState(() => show(value, digits));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(show(value, digits));
  }, [value, digits]);
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {help ? <Info text={help} /> : null}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => {
          focused.current = false;
          const parsed = Number(text);
          if (!Number.isFinite(parsed)) {
            setText(show(value, digits));
            return;
          }
          const clamped = clamp(parsed, min, max);
          onChange(clamped);
          setText(show(clamped, digits));
        }}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) return;
          if (min != null && parsed < min) return;
          if (max != null && parsed > max) return;
          onChange(parsed);
        }}
      />
    </label>
  );
}

function show(value: number, digits?: number): string {
  return digits == null ? String(value) : value.toFixed(digits);
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}
