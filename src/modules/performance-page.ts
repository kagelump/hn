// Performance page module
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { perf } from './performance';

function renderPerformancePage(): void {
  const page = document.querySelector('.page-performance') as HTMLElement | null;
  if (!page) return;

  const perfData = perf.data;
  const rows = Object.entries(perfData)
    .filter(([key]) => key !== 'insertedNodeCount')
    .map(([key, value]) => {
      const displayValue = typeof value === 'object'
        ? Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : String(value);
      return `<tr><td>${key}</td><td>${displayValue}</td></tr>`;
    })
    .join('');

  page.innerHTML = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Performance</h1>
        <ul class="r-menu list-inline menu"></ul>
      </header>
    </div>
    <section class="pagebd-container">
      <div class="bd">
        <table class="perf-table">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">No data yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

export function initPerformancePage(): void {
  PubSub.subscribe('show-performance', () => {
    showPage('page-performance', 'Performance');
    renderPerformancePage();
  });
}
