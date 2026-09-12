import type { ReactNode } from "react";

export function ChartTip({ children }: { children: ReactNode }) {
  return <div className="bf-chart-tip" role="status">{children}</div>;
}

export function ChartEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bf-chart-empty">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function ChartYAxis({ ticks }: { ticks: string[] }) {
  return (
    <div className="bf-chart-y" aria-hidden="true">
      {ticks.map((tick) => <span key={tick}>{tick}</span>)}
    </div>
  );
}
