import { useEffect, useRef, useState } from "react";
import { apiBase, AuthRequired, getJSON, isAbort, postJSON } from "./api";
import { BriefPanel } from "./components/Brief";
import { Comparison } from "./components/Comparison";
import { ConfigPanel } from "./components/ConfigPanel";
import { DealSetup } from "./components/DealSetup";
import { Callout, DataTable, MetricGrid } from "./components/widgets";
import type { Bootstrap, BriefView, ComparisonOut, DealIn, DealOut, LookupOk, LookupOut } from "./types";

type Account = { email: string; name: string };

const AUTH_ERRORS: Record<string, string> = {
  domain: "That Google account is not a @mobavenue.com account.",
  denied: "Google sign-in was cancelled.",
  failed: "Google sign-in did not complete. Try again.",
};

function noteError(reason: unknown, fallback: string, setMessage: (message: string) => void, onSignedOut: () => void) {
  if (reason instanceof AuthRequired) {
    onSignedOut();
    return;
  }
  if (!isAbort(reason)) setMessage(reason instanceof Error ? reason.message : fallback);
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
    const params = new URLSearchParams(window.location.search);
    const code = params.get("auth_error");
    if (code) {
      setAuthError(AUTH_ERRORS[code] ?? "Google sign-in did not complete. Try again.");
      window.history.replaceState({}, "", "/");
    }
    getJSON<Account>("/api/auth/me")
      .then((me) => setAccount(me))
      .catch(() => setAccount(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    getJSON<Bootstrap>("/api/bootstrap", controller.signal)
      .then((loaded) => {
        setBoot(loaded);
        setDealIn(loaded.defaults);
      })
      .catch((reason: unknown) => {
        if (reason instanceof AuthRequired) setAccount(null);
        else if (!isAbort(reason)) setBootError(reason instanceof Error ? reason.message : "The API is not running.");
      });
    return () => controller.abort();
  }, [account]);

  function signOut() {
    fetch(`${apiBase()}/api/auth/logout`, { method: "POST", credentials: "include" }).finally(() => {
      setAccount(null);
      setBoot(null);
      setDealIn(null);
    });
  }

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
        .catch((reason: unknown) => noteError(reason, "Could not calculate the deal.", setDealError, () => setAccount(null)));
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
          if (reason instanceof AuthRequired) setAccount(null);
          else if (!isAbort(reason)) setComparison(null);
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
      if (reason instanceof AuthRequired) setAccount(null);
      else setBriefError(reason instanceof Error ? reason.message : "The sales brief failed.");
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
      if (reason instanceof AuthRequired) setAccount(null);
      else if (seq === lookupSeq.current) setLookupError(reason instanceof Error ? reason.message : "Lookup failed.");
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
      if (reason instanceof AuthRequired) setAccount(null);
      else setLookupError(reason instanceof Error ? reason.message : "Could not refresh the estimate.");
    } finally {
      setLookupBusy(false);
    }
  }

  if (!authReady) return <main className="boot-error"><p>Loading Sales Planner…</p></main>;
  if (!account) {
    return (
      <main className="boot-error login">
        <img src="/mobavenue-logo-dark.png" alt="Mobavenue" />
        <h1>Sales Planner</h1>
        <p>Sign in with your @mobavenue.com Google account.</p>
        {authError ? <p className="callout error">{authError}</p> : null}
        <a className="signin" href={`${apiBase()}/api/auth/google`} target="_top" rel="noopener">
          <svg className="google-g" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.12-1.43.36-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
          </svg>
          Sign in with Google
        </a>
      </main>
    );
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
        <div className="account">
          <span>{account.email}</span>
          <button type="button" onClick={signOut}>Sign out</button>
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
