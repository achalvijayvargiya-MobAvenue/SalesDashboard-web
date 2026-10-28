import type { DealIn, Estimate, LookupOk } from "../types";
import { NumberField } from "./widgets";

const TIMES = "\u00d7";
const DIV = "\u00f7";
const ARROW = "\u2192";

export function DealSetup({
  deal, onDeal, url, onUrl, onLookup, lookupBusy, lookup, onUseOrganic, onRefresh,
}: {
  deal: DealIn;
  onDeal: (next: DealIn) => void;
  url: string;
  onUrl: (value: string) => void;
  onLookup: (url: string) => void;
  lookupBusy: boolean;
  lookup: LookupOk | null;
  onUseOrganic: (value: number) => void;
  onRefresh: () => void;
}) {
  const set = (patch: Partial<DealIn>) => onDeal({ ...deal, ...patch });
  const estimate = lookup?.estimate ?? null;
  const our = lookup?.our_data ?? null;

  return (
    <form className="setup" onSubmit={(event) => { event.preventDefault(); onLookup(url); }}>
      <h2>Deal setup</h2>
      <label className="field">
        <span className="field-label">
          Client app URL (optional)
          <span className="hint" tabIndex={0} title="Google Play or App Store link. Adds a comparison with existing clients and an AI sales brief." aria-label="Google Play or App Store link. Adds a comparison with existing clients and an AI sales brief.">i</span>
        </span>
        <input
          value={url}
          placeholder="https://play.google.com/store/apps/details?id=com.example.app"
          onChange={(event) => onUrl(event.target.value)}
          onBlur={() => onLookup(url)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onLookup(url);
            }
          }}
        />
      </label>
      <button className="primary" type="submit" disabled={lookupBusy}>
        {lookupBusy ? "Looking up…" : "Look up"}
      </button>

      <NumberField label="Organic installs per day" min={1} step={1000} value={deal.organic_installs_per_day}
        onChange={(value) => set({ organic_installs_per_day: value })} />
      {our && our.installs_per_day !== deal.organic_installs_per_day ? (
        <div className="side-note">
          <p>{our.caption}</p>
          <button type="button" onClick={() => onUseOrganic(our.installs_per_day)}>{our.use_label}</button>
        </div>
      ) : null}
      {estimate ? <EstimateNote estimate={estimate} organic={deal.organic_installs_per_day} onUse={onUseOrganic} onRefresh={onRefresh} /> : null}
      {lookup && !lookup.our_data && !lookup.estimate && lookup.manual_message ? <p className="note">{lookup.manual_message}</p> : null}

      <NumberField label="Client payout per install (USD)" min={0.01} step={0.1} digits={2} value={deal.client_payout_usd}
        help="What the client pays per attributed install (CTA or VTA). Drives the CTA / VTA split."
        onChange={(value) => set({ client_payout_usd: value })} />

      <details className="assumptions">
        <summary>Assumptions</summary>
        <p className="note">Defaults come from config/settings.yaml. Changes here are what-if only.</p>
        <NumberField label="Bids per day (Crore)" min={0.01} step={1} digits={2} value={deal.daily_bids_crore}
          onChange={(value) => set({ daily_bids_crore: value })} />
        <NumberField label="Programmatic share of organic installs (%)" min={0.1} max={100} step={5}
          value={deal.programmatic_share_percent} onChange={(value) => set({ programmatic_share_percent: value })} />
        <NumberField label="CPM (USD per 1000 impressions)" min={0} step={0.05} digits={3} value={deal.cpm_usd}
          onChange={(value) => set({ cpm_usd: value })} />
        <NumberField label="Bid → impression rate (%)" min={0.01} max={100} step={0.5} digits={2}
          help="Impressions won / bids placed" value={deal.bid_to_impression_percent}
          onChange={(value) => set({ bid_to_impression_percent: value })} />
        <NumberField label="Impression → click rate (%)" min={0.01} max={100} step={0.5} digits={2}
          help="CTA clicks / impressions" value={deal.impression_to_click_percent}
          onChange={(value) => set({ impression_to_click_percent: value })} />
        <NumberField label="Click → install rate (%)" min={0} max={100} step={0.5} digits={2}
          help="Click-through (CTA) installs / CTA clicks. 0 means no CTA installs."
          value={deal.click_to_install_percent} onChange={(value) => set({ click_to_install_percent: value })} />
        <NumberField label={`VTA multiplier (${TIMES} industry CVR)`} min={0} step={0.5} digits={2}
          help={`VTA impression ${ARROW} install rate = this app's industry CVR ${TIMES} this multiplier, so VTA cost scales with the app like CTA. VTA min payout = CTA min payout ${DIV} multiplier. 0 means no VTA installs.`}
          value={deal.vta_multiplier} onChange={(value) => set({ vta_multiplier: value })} />
        <NumberField label="Min VTA share of installs (%)" min={0} max={100} step={5}
          help="Least share of installs that must be VTA in the recommended split"
          value={deal.min_vta_share_percent} onChange={(value) => set({ min_vta_share_percent: value })} />
        <NumberField label="Max VTA share of installs (%)" min={0} max={100} step={5}
          help="Most share of installs the client accepts as VTA. 0 means CTA only."
          value={deal.max_vta_share_percent} onChange={(value) => set({ max_vta_share_percent: value })} />
        <NumberField label="Target installs" min={1} step={10} value={deal.target_installs}
          onChange={(value) => set({ target_installs: value })} />
      </details>
    </form>
  );
}

function EstimateNote({ estimate, organic, onUse, onRefresh }: {
  estimate: Estimate;
  organic: number;
  onUse: (value: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="side-note">
      <p>
        Not in our data. Estimated installs/day: <strong>{estimate.span}</strong> ({estimate.play_text} · {estimate.ai_text}). Using the midpoint {estimate.value.toLocaleString("en-US")}.
      </p>
      {estimate.value !== organic ? <button type="button" onClick={() => onUse(estimate.value)}>{estimate.use_label}</button> : null}
      <details>
        <summary>How this was estimated</summary>
        <p><strong>Google Play:</strong> {estimate.play_basis}</p>
        <p><strong>AI research:</strong> {estimate.llm_note}</p>
        {estimate.llm_sources.length ? (
          <ul>
            {estimate.llm_sources.map((source) => (
              <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>: {source.figure}</li>
            ))}
          </ul>
        ) : null}
        {estimate.generated_caption ? <p className="note">{estimate.generated_caption}</p> : null}
        <button type="button" onClick={onRefresh}>Refresh AI estimate</button>
      </details>
    </div>
  );
}
