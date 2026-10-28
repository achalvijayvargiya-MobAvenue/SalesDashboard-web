import { useEffect, useRef, useState } from "react";
import { getJSON, isAbort, postJSON } from "./api";
import { BriefPanel } from "./components/Brief";
import { Comparison } from "./components/Comparison";
import { ConfigPanel } from "./components/ConfigPanel";
import { DealSetup } from "./components/DealSetup";
import { Callout, DataTable, MetricGrid } from "./components/widgets";
import type { Bootstrap, BriefView, ComparisonOut, DealIn, DealOut, LookupOk, LookupOut } from "./types";

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [dealIn, setDealIn] = useState<DealIn | null>(null);
  const [deal, setDeal] = useState<DealOut | null>(null);
  const [dealError, setDealError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [lookup, setLookup] = useState<LookupOk | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [verticals, setVerticals] = useState<string[] | null>(null);
  const [products, setProducts] = useState<string[] | null>(null);
  const [comparison, setComparison] = useState<ComparisonOut | null>(null);
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [tab, setTab] = useState<"deal" | "config">("deal");
  const applied = useRef(new Set<string>());
  const lookupSeq = useRef(0);
  const inFlightUrl = useRef<string | null>(null);

  useEffect(() => {
    getJSON<Bootstrap>("/api/bootstrap")
      .then((loaded) => {
        setBoot(loaded);
        setDealIn(loaded.defaults);
      })
      .catch((reason: unknown) => setBootError(reason instanceof Error ? reason.message : "The API is not running."));
  }, []);

  const category = lookup ? lookup.app.category : lookupError ? manualCategory : "";

  useEffect(() => {
    setVerticals(null);
    setProducts(null);
  }, [category]);

  useEffect(() => {
    if (!dealIn) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const body = { ...dealIn, known_bundle_id: lookup?.known_bundle_id ?? null };
      postJSON<DealOut>("/api/deal", body, controller.signal)
        .then((next) => {
          setDeal(next);
          setDealError(null);
        })
        .catch((reason: unknown) => {
          if (!isAbort(reason)) setDealError(reason instanceof Error ? reason.message : "Could not calculate the deal.");
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dealIn, lookup]);

  useEffect(() => {
    if (!dealIn || !category) {
      setComparison(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      postJSON<ComparisonOut>("/api/comparison", { ...dealIn, category, verticals, products }, controller.signal)
        .then(setComparison)
        .catch((reason: unknown) => {
          if (!isAbort(reason)) setComparison(null);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dealIn, category, verticals, products]);

  async function generateBrief(target: LookupOk, organic: number, sourceUrl: string) {
    if (!dealIn) return;
    setBriefBusy(true);
    setBriefError(null);
    try {
      const record = await postJSON<BriefView>("/api/brief", {
        ...dealIn,
        organic_installs_per_day: organic,
        known_bundle_id: target.known_bundle_id,
        url: sourceUrl,
        category: target.app.category,
        verticals,
        products,
      });
      setBrief(record);
    } catch (reason: unknown) {
      setBriefError(reason instanceof Error ? reason.message : "The sales brief failed.");
    } finally {
      setBriefBusy(false);
    }
  }

  async function runLookup(nextUrl: string) {
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      if (!activeUrl && !lookup && !lookupError) return;
      setLookup(null);
      setLookupError(null);
      setBrief(null);
      setBriefError(null);
      setActiveUrl("");
      setManualCategory("");
      return;
    }
    if (inFlightUrl.current === trimmed) return;
    if (trimmed === activeUrl && lookup) return;
    inFlightUrl.current = trimmed;
    const seq = ++lookupSeq.current;
    setLookupBusy(true);
    setLookupError(null);
    try {
      const result = await postJSON<LookupOut>("/api/lookup", { url: trimmed });
      if (seq !== lookupSeq.current) return;
      if (!result.ok) {
        setLookup(null);
        setLookupError(result.error);
        setBrief(null);
        setBriefError(null);
        setActiveUrl("");
        setManualCategory("");
        return;
      }
      setLookup(result);
      setActiveUrl(trimmed);
      setBrief(null);
      setBriefError(null);
      let organic = dealIn?.organic_installs_per_day ?? result.estimate?.value ?? 0;
      if (result.estimate && !applied.current.has(result.app.app_id)) {
        organic = result.estimate.value;
        applied.current.add(result.app.app_id);
        setDealIn((current) => current && { ...current, organic_installs_per_day: organic });
      }
      const saved = await getJSON<{ record: BriefView | null }>(`/api/brief/${encodeURIComponent(result.app.app_id)}`);
      if (seq !== lookupSeq.current) return;
      if (saved.record) setBrief(saved.record);
      else if (boot?.auto_generate_brief) await generateBrief(result, organic, trimmed);
    } catch (reason: unknown) {
      if (seq === lookupSeq.current) setLookupError(reason instanceof Error ? reason.message : "Lookup failed.");
    } finally {
      if (inFlightUrl.current === trimmed) inFlightUrl.current = null;
      if (seq === lookupSeq.current) setLookupBusy(false);
    }
  }

  async function refreshEstimate() {
    if (!activeUrl || !lookup) return;
    setLookupBusy(true);
    try {
      const result = await postJSON<LookupOut>("/api/estimate/refresh", { url: activeUrl });
      if (!result.ok) return;
      setLookup(result);
      if (result.apply_organic != null) {
        applied.current.add(result.app.app_id);
        setDealIn((current) => current && { ...current, organic_installs_per_day: result.apply_organic as number });
      }
    } catch (reason: unknown) {
      setLookupError(reason instanceof Error ? reason.message : "Could not refresh the estimate.");
    } finally {
      setLookupBusy(false);
    }
  }

  if (bootError) {
    return <main className="boot-error"><h1>Sales Planner</h1><p>{bootError}</p><p>Start the API, then reload this page. In development the page proxies <code>/api</code> to the backend.</p></main>;
  }
  if (!boot || !dealIn) return <main className="boot-error"><p>Loading Sales Planner…</p></main>;

  return (
    <div className="page">
      <header className="top">
        <img src="/mobavenue-logo-dark.png" alt="Mobavenue" />
        <div className="rule" />
        <div>
          <h1>Sales Planner</h1>
          <p>Deal pricing · CTA / VTA split · Client benchmarks</p>
        </div>
      </header>
      <div className="workspace">
        <aside>
          <DealSetup
            deal={dealIn}
            onDeal={setDealIn}
            url={url}
            onUrl={setUrl}
            onLookup={runLookup}
            lookupBusy={lookupBusy}
            lookup={lookup}
            onUseOrganic={(value) => setDealIn({ ...dealIn, organic_installs_per_day: value })}
            onRefresh={refreshEstimate}
          />
        </aside>
        <main>
          {boot.show_config_tab ? (
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "deal"} className={tab === "deal" ? "on" : ""} onClick={() => setTab("deal")}>Deal analysis</button>
              <button type="button" role="tab" aria-selected={tab === "config"} className={tab === "config" ? "on" : ""} onClick={() => setTab("config")}>Config</button>
            </div>
          ) : null}
          {tab === "config" && boot.show_config_tab ? <ConfigPanel deal={dealIn} /> : (
            <>
              {lookupBusy ? <p className="note">Fetching store details… If this app is not in our data, researching installs per day can take a minute.</p> : null}
              {lookupError ? (
                <>
                  <Callout level="error" text={lookupError} />
                  <label className="field category-pick">
                    <span className="field-label">Pick the app&apos;s category manually to compare with existing clients</span>
                    <select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>
                      <option value="">Select a category</option>
                      {boot.categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                </>
              ) : null}
              {lookup ? (
                <section className="client">
                  <img src={lookup.app.icon_url} alt="" width={72} height={72} />
                  <div>
                    <h2><a href={lookup.app.store_url} target="_blank" rel="noreferrer">{lookup.app.title}</a></h2>
                    <p className="facts">
                      {lookup.app.facts.map((fact, index) => (
                        <span key={fact.label}>{index ? " · " : ""}<strong>{fact.label}:</strong> {fact.code ? <code>{fact.value}</code> : fact.value}</span>
                      ))}
                    </p>
                  </div>
                </section>
              ) : null}
              {lookup?.known_message ? <Callout level="success" text={lookup.known_message} /> : null}
              {deal?.existing_campaigns ? <DataTable table={deal.existing_campaigns} /> : null}
              {!lookup && !lookupError && !lookupBusy ? <Callout level="info" text={boot.empty_hint} /> : null}
              {dealError ? <Callout level="error" text={dealError} /> : null}
              {deal ? (
                <>
                  <section>
                    <h2>Payout and scale</h2>
                    <div className="headline">
                      <p>
                        With <strong>{deal.headline.organic_text}</strong> organic installs/day, the blended minimum payout per install to ask for is <strong>{deal.headline.blended_text}</strong>, {deal.headline.basis}.
                      </p>
                    </div>
                    <MetricGrid metrics={deal.summary_metrics} />
                    <details className="volume">
                      <summary>{deal.volume.title}</summary>
                      <MetricGrid metrics={deal.volume.metrics} />
                      <DataTable table={{
                        columns: [{ key: "Step" }, { key: "Formula" }, { key: "Value" }],
                        rows: deal.volume.steps.map((step) => ({ Step: step.step, Formula: step.formula, Value: step.value })),
                      }} />
                    </details>
                  </section>
                  <section>
                    <h2>CTA / VTA split</h2>
                    <p className="note">{deal.split.intro}</p>
                    <Callout level={deal.split.callout.level} text={deal.split.callout.text} />
                    <MetricGrid metrics={deal.split.floor_metrics} />
                    <MetricGrid metrics={deal.split.share_metrics} />
                    <h3>{deal.split.plan_title}</h3>
                    <MetricGrid metrics={deal.split.plan_metrics} />
                    <p className="note">{deal.split.note}</p>
                  </section>
                </>
              ) : <p className="note">Calculating…</p>}
              {comparison?.shown ? (
                <Comparison comparison={comparison} verticals={verticals} products={products} onVerticals={setVerticals} onProducts={setProducts} />
              ) : null}
              {lookup ? (
                <BriefPanel
                  brief={brief}
                  error={briefError}
                  busy={briefBusy}
                  auto={boot.auto_generate_brief}
                  onGenerate={() => generateBrief(lookup, dealIn.organic_installs_per_day, activeUrl)}
                />
              ) : null}
            </>
          )}
        </main>
      </div>
      <footer>
        <span>Mobavenue AI Tech Limited · Connecting what&apos;s next</span>
        <span>Internal sales tool · Confidential</span>
      </footer>
    </div>
  );
}
