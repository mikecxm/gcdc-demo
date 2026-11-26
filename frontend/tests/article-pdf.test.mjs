import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, apiClient, getArticlePdf, uploadArticleVersion;
let activeRole = 'AUTOR';
before(async () => {
  globalThis.localStorage = {
    getItem: (key) => key === 'symposia_auth_token'
      ? 'session-token'
      : key === 'symposia_active_role'
        ? activeRole
        : null,
  };
  vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  ({ apiClient } = await vite.ssrLoadModule('/src/services/api.ts'));
  ({ getArticlePdf, uploadArticleVersion } = await vite.ssrLoadModule('/src/services/articlesApi.ts'));
});
after(async () => { await vite?.close(); delete globalThis.localStorage; });

test('PDF uses authenticated backend endpoint and preserves file bytes', async () => {
  const blob = new Blob(['%PDF-1.4\nexample'], { type: 'application/pdf' });
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.url, '/articles/12/pdf/');
    assert.equal(config.responseType, 'blob');
    assert.equal(config.headers.Authorization, 'Bearer session-token');
    assert.equal(config.headers.get('X-Active-Role'), 'AUTOR');
    return { data: blob, status: 200, headers: {}, config };
  };
  assert.equal(await getArticlePdf(12), blob);
});

test('article requests send the newly selected active role', async () => {
  activeRole = 'COMITE';
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.headers.get('X-Active-Role'), 'COMITE');
    return { data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), status: 200, headers: {}, config };
  };
  try {
    await getArticlePdf(12);
  } finally {
    activeRole = 'AUTOR';
  }
});

test('HTML application response is rejected instead of embedded as a manuscript', async () => {
  for (const type of ['text/html', 'application/pdf']) {
    apiClient.defaults.adapter = async (config) => ({
      data: new Blob(['<!doctype html><title>Dashboard</title>'], { type }),
      status: 200, headers: {}, config,
    });
    await assert.rejects(getArticlePdf(12), /PDF válido/);
  }
});

test('backend failure propagates to the viewer error state', async () => {
  apiClient.defaults.adapter = async () => { throw new Error('PDF unavailable'); };
  await assert.rejects(getArticlePdf(12), /PDF unavailable/);
});

test('multipart version upload sends FormData with a generated boundary', async () => {
  const formData = new FormData();
  formData.append('pdf', new Blob(['%PDF-1.4\nexample'], { type: 'application/pdf' }), 'article.pdf');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.match(request.headers.get('Content-Type') ?? '', /^multipart\/form-data; boundary=/i);
    assert.equal(request.headers.get('Authorization'), 'Bearer session-token');
    assert.equal(request.headers.get('X-Active-Role'), 'AUTOR');
    assert.match(request.url, /\/api\/v1\/articles\/12\/versions\/$/);
    assert.equal((await request.formData()).get('pdf')?.name, 'article.pdf');
    return new Response(
      JSON.stringify({ id: 8, version_number: 2, stage: 'INICIAL', uploaded_at: '2026-11-22T00:00:00Z' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  };
  apiClient.defaults.adapter = 'fetch';
  try {
    await uploadArticleVersion(12, formData);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
