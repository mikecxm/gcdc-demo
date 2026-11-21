// Paste into browser DevTools while signed in to the local frontend.
// Measures fetch + JSON parsing, including network and JWT; excludes DOM rendering.
(async () => {
  const token = localStorage.getItem('symposia_auth_token');
  if (!token) throw new Error('Inicia sesion antes de medir.');
  const url = 'http://127.0.0.1:8000/api/v1/users/?role=AUTOR&affiliation=Univalle&is_active=true';
  const request = async () => {
    const start = performance.now();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ms: performance.now() - start, count: data.count };
  };
  await request();
  const results = await Promise.all(Array.from({ length: 50 }, request));
  const average = results.reduce((sum, item) => sum + item.ms, 0) / results.length;
  console.table({ requests: 50, average_ms: average, max_ms: Math.max(...results.map(r => r.ms)), sla_pass: average <= 400 });
  console.assert(results.every(r => r.count === results[0].count), 'Conteos inconsistentes');
})();
