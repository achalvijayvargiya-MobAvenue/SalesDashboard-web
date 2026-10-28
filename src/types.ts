export type DealIn = {
  organic_installs_per_day: number;
  client_payout_usd: number;
  daily_bids_crore: number;
  programmatic_share_percent: number;
  cpm_usd: number;
  bid_to_impression_percent: number;
  impression_to_click_percent: number;
  click_to_install_percent: number;
  vta_multiplier: number;
  min_vta_share_percent: number;
  max_vta_share_percent: number;
  target_installs: number;
  known_bundle_id?: string | null;
};

export type Metric = {
  label: string;
  value: string;
  help?: string;
  delta?: string;
};

export type Callout = {
  level: "success" | "warning" | "error" | "info";
  text: string;
};

export type TableData = {
  columns: { key: string; help?: string | null }[];
  rows: Record<string, string>[];
};

export type Bootstrap = {
  defaults: DealIn;
  show_config_tab: boolean;
  auto_generate_brief: boolean;
  period_label: string;
  categories: string[];
  verticals: string[];
  products: { value: string; label: string }[];
  empty_hint: string;
  assumptions_note: string;
};

export type Estimate = {
  low: number;
  high: number;
  value: number;
  span: string;
  play_text: string;
  ai_text: string;
  use_label: string;
  play_basis: string;
  llm_note: string;
  llm_sources: { title: string; url: string; figure: string }[];
  generated_caption: string | null;
};

export type LookupOk = {
  ok: true;
  app: {
    store: string;
    store_label: string;
    app_id: string;
    title: string;
    category: string;
    developer: string;
    icon_url: string;
    store_url: string;
    facts: { label: string; value: string; code?: boolean }[];
  };
  known_bundle_id: string | null;
  known_client: boolean;
  known_message: string | null;
  our_data: { installs_per_day: number; caption: string; use_label: string } | null;
  estimate: Estimate | null;
  manual_message: string | null;
  apply_organic?: number | null;
};

export type LookupOut = LookupOk | { ok: false; error: string };

export type DealOut = {
  headline: { text: string; organic_text: string; blended_text: string; basis: string };
  summary_metrics: Metric[];
  volume: {
    title: string;
    metrics: Metric[];
    steps: { step: string; formula: string; value: string }[];
  };
  split: {
    status: string;
    intro: string;
    callout: Callout;
    floor_metrics: Metric[];
    share_metrics: Metric[];
    plan_title: string;
    plan_metrics: Metric[];
    note: string;
  };
  existing_campaigns: TableData | null;
};

export type ComparisonOut = {
  shown: boolean;
  warning: string | null;
  vertical_options: string[];
  product_options: { value: string; label: string }[];
  suggested_verticals: string[];
  verticals: string[];
  products: string[];
  callout: Callout | null;
  caption: string | null;
  empty_message: string | null;
  metrics: Metric[];
  table: TableData | null;
};

export type BriefView = {
  bundle_id: string;
  app_title: string;
  caption: string;
  highlight: { text: string; below_required: boolean } | null;
  body_markdown: string;
  download_markdown: string;
  missing_inputs: boolean;
};

export type ConfigOut = {
  caption: string;
  defaults: Record<string, number>;
  category_map: { "Store category": string; Verticals: string }[];
  campaign_count: number;
  campaigns: TableData | null;
  prospect_count: number;
  prospects: TableData;
};
