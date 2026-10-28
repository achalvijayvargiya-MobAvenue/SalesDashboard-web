import type { ComparisonOut } from "../types";
import { Callout, DataTable, MetricGrid } from "./widgets";

export function Comparison({
  comparison, verticals, products, onVerticals, onProducts,
}: {
  comparison: ComparisonOut;
  verticals: string[] | null;
  products: string[] | null;
  onVerticals: (values: string[]) => void;
  onProducts: (values: string[]) => void;
}) {
  const chosenVerticals = verticals ?? comparison.verticals;
  const chosenProducts = products ?? comparison.products;

  const toggle = (current: string[], value: string, apply: (values: string[]) => void) => {
    apply(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <section>
      <h2>Comparison with existing clients</h2>
      {comparison.warning ? <Callout level="warning" text={comparison.warning} /> : null}
      <div className="filters">
        <fieldset>
          <legend>Verticals</legend>
          <div className="chips">
            {comparison.vertical_options.map((vertical) => (
              <button type="button" key={vertical} className={chosenVerticals.includes(vertical) ? "chip on" : "chip"}
                aria-pressed={chosenVerticals.includes(vertical)}
                onClick={() => toggle(chosenVerticals, vertical, onVerticals)}>
                {vertical}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Product</legend>
          <div className="chips">
            {comparison.product_options.map((product) => (
              <button type="button" key={product.value} className={chosenProducts.includes(product.value) ? "chip on" : "chip"}
                aria-pressed={chosenProducts.includes(product.value)}
                onClick={() => toggle(chosenProducts, product.value, onProducts)}>
                {product.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      {comparison.empty_message ? <Callout level="info" text={comparison.empty_message} /> : null}
      {comparison.metrics.length ? <MetricGrid metrics={comparison.metrics} /> : null}
      {comparison.callout ? <Callout level={comparison.callout.level} text={comparison.callout.text} /> : null}
      {comparison.caption ? <p className="note">{comparison.caption}</p> : null}
      {comparison.table ? <DataTable table={comparison.table} /> : null}
    </section>
  );
}
