import { useEffect, useState } from "react";
import { isAbort, postJSON } from "../api";
import type { ConfigOut, DealIn } from "../types";
import { DataTable } from "./widgets";

export function ConfigPanel({ deal }: { deal: DealIn }) {
  const [config, setConfig] = useState<ConfigOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    postJSON<ConfigOut>("/api/config", deal, controller.signal).then(setConfig).catch((reason: unknown) => {
      if (!isAbort(reason)) setError(reason instanceof Error ? reason.message : "Could not load config.");
    });
    return () => controller.abort();
  }, [deal]);

  if (error) return <p className="callout error">{error}</p>;
  if (!config) return <p className="note">Loading configuration…</p>;
  return (
    <section>
      <h2>Loaded configuration</h2>
      <p className="note">{config.caption}</p>
      <h3>Calculator defaults</h3>
      <pre>{JSON.stringify(config.defaults, null, 2)}</pre>
      <h3>Store category → verticals</h3>
      <DataTable table={{
        columns: [{ key: "Store category" }, { key: "Verticals" }],
        rows: config.category_map,
      }} />
      <h3>Existing client campaigns ({config.campaign_count})</h3>
      {config.campaigns ? <DataTable table={config.campaigns} /> : null}
      <h3>Bundles with organic data but no campaigns ({config.prospect_count})</h3>
      <DataTable table={config.prospects} />
    </section>
  );
}
