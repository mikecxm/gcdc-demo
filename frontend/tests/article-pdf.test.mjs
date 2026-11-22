import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, apiClient, getArticlePdf;
before(async () => {
  globalThis.localStorage = { getItem: () => 'session-token' };
  vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  ({ apiClient } = await vite.ssrLoadModule('/src/services/api.ts'));
  ({ getArticlePdf } = await vite.ssrLoadModule('/src/services/articlesApi.ts'));
});
after(async () => { await vite?.close(); delete globalThis.localStorage; });

test('PDF uses authenticated backend endpoint and preserves file bytes', async () => {
  const blob = new Blob(['%PDF-1.4\nexample'], { type: 'application/pdf' });
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.url, '/articles/12/pdf/');
    assert.equal(config.responseType, 'blob');
    assert.equal(config.headers.Authorization, 'Bearer session-token');
    return { data: blob, status: 200, headers: {}, config };
  };
  assert.equal(await getArticlePdf(12), blob);
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
