const svg = document.getElementById('bench-chart');
const node = (tag, attrs, text) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text) el.textContent = text;
  svg.append(el);
};
fetch('assets/research/bench/data.json').then(async response => {
  if (!response.ok) throw Error('Example unavailable');
  const data = await response.json();
  if (data.schema !== 'atlas-drive-selected-bench-example-v1') throw Error('Unknown example');
  for (const [i, example] of data.examples.entries()) {
    const y = 42 + i * 95;
    node('text', {x: 12, y, fill: '#ddd7da', 'font-size': 15}, example.label);
    node('rect', {x: 12, y: y + 16, width: 540, height: 20, fill: '#343132'});
    node('rect', {x: 12, y: y + 16, width: 540 * example.current_error_pct / 20,
      height: 20, fill: i ? '#f65893' : '#928c90'});
    node('text', {x: 575, y: y + 33, fill: i ? '#f65893' : '#ddd7da',
      'font-size': 24}, `${example.current_error_pct.toFixed(1)}%`);
  }
  node('text', {x: 12, y: 222, fill: '#aaa6a6', 'font-size': 12}, 'Mean absolute percentage error · lower is better');
}).catch(() => {
  document.getElementById('bench-note').textContent = 'Chart unavailable. The selected aggregate results are shown alongside it.';
});
