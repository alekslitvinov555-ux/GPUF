import { escapeHtml as esc } from "./format.js";

const value = number => Number.isFinite(number) ? Number(number.toPrecision(8)) : "—";

export function calculationHtml(site, search, criteria) {
  if (!site.calculation) return "";
  const { score, criteria: factors } = site.calculation;
  const rows = criteria.filter(({ key }) => Object.hasOwn(factors, key));
  if (!rows.length) return "";
  const weightSum = rows.reduce((sum, { key }) => sum + factors[key].weight, 0);
  const cells = rows.map(({ key, label, unit }) => {
    const { earth_value, similarity, factor } = factors[key];
    const inputs = [
      label, unit, value(earth_value), value(search.profile[key]),
      value(search.effective_profile[key]), value(factors[key].weight / weightSum),
      value(similarity), value(factor),
    ];
    return `<tr>${inputs.map(input => `<td>${esc(input)}</td>`).join("")}</tr>`;
  });
  return `<details class="atlas-calculation"><summary>Reproduce the match score</summary>
    <p>The final score is the product of the weighted factors. Each factor is its criterion similarity raised to its share of the total active weight.</p>
    <div class="atlas-calculation-scroll"><table>
      <thead><tr>${["Criterion","Unit","Earth","Target","Effective target","Weight share","Similarity","Weighted factor"].map(label=>`<th scope="col">${label}</th>`).join("")}</tr></thead>
      <tbody>${cells.join("")}</tbody>
      <tfoot><tr><th scope="row" colspan="7">Final score</th><td>${value(score)}</td></tr></tfoot>
    </table></div></details>`;
}
