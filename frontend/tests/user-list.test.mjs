import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let vite, logic, mocks, service, apiClient, UserListView;
const filters = { search: 'Universidad del Valle', role: 'COMITE', status: 'ALL', sort: 'NAME' };

before(async () => {
  globalThis.window = { location: { origin: 'http://localhost:5173' } };
  globalThis.localStorage = { getItem: () => null };
  vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  logic = await vite.ssrLoadModule('/src/components/users/userList.logic.ts');
  mocks = await vite.ssrLoadModule('/src/components/users/userList.mock.ts');
  service = await vite.ssrLoadModule('/src/services/usersApi.ts');
  ({ apiClient } = await vite.ssrLoadModule('/src/services/api.ts'));
  ({ UserListView } = await vite.ssrLoadModule('/src/components/users/UserListView.tsx'));
});
after(async () => { await vite?.close(); delete globalThis.window; delete globalThis.localStorage; });

test('committee and affiliation use AND, with more than one page of matches', () => {
  const rows = logic.filterUsers(mocks.MOCK_USERS, filters);
  assert.ok(rows.length > 10);
  assert.ok(rows.every((row) => row.roles.includes('COMITE') && row.affiliation === 'Universidad del Valle'));
  const first = logic.paginateUsers(rows, 1);
  const second = logic.paginateUsers(rows, 2);
  assert.equal(first.users.length, 10);
  assert.ok(second.users.length > 0);
  assert.ok(second.users.every((row) => !first.users.some((other) => other.id === row.id)));
  assert.deepEqual(filters, { search: 'Universidad del Valle', role: 'COMITE', status: 'ALL', sort: 'NAME' });
});

test('search handles accents, email and names; state also intersects', () => {
  assert.equal(logic.filterUsers(mocks.MOCK_USERS, { ...filters, role: 'ALL', search: 'julian esteban' })[0].id, 104);
  assert.equal(logic.filterUsers(mocks.MOCK_USERS, { ...filters, role: 'ALL', search: 'maria.rojas@' })[0].id, 101);
  assert.ok(logic.filterUsers(mocks.MOCK_USERS, { ...filters, status: 'INACTIVE' }).every((row) => !row.is_active));
  assert.deepEqual(logic.filterUsers(mocks.MOCK_USERS, { ...filters, search: 'no such university' }), []);
});

test('empty and reduced datasets clamp pagination correctly', () => {
  assert.deepEqual(logic.paginateUsers([], 99), { page: 1, pageCount: 1, users: [], first: 0, last: 0 });
  assert.equal(logic.paginateUsers(mocks.MOCK_USERS.slice(0, 3), 3).page, 1);
});

test('initial loading renders skeleton rows and an accessible busy state', () => {
  const html = renderToStaticMarkup(createElement(UserListView));
  assert.match(html, /aria-busy="true"/);
  assert.equal((html.match(/class="directory-skeleton-row"/g) ?? []).length, 6);
  assert.doesNotMatch(html, /No encontramos usuarios/);
});

test('supplied records render immediately with client pagination and no skeleton', () => {
  const html = renderToStaticMarkup(createElement(UserListView, { initialUsers: mocks.MOCK_USERS }));
  assert.match(html, /aria-busy="false"/);
  assert.match(html, /Mostrando/);
  assert.match(html, /de <span[^>]*>26<\/span>/);
  assert.doesNotMatch(html, /class="directory-skeleton-row"/);
});

function respond(data, config) { return { data, status: 200, statusText: 'OK', headers: {}, config }; }

test('Axios adapter loads a full array and DRF pages without losing records', async () => {
  let calls = 0;
  apiClient.defaults.adapter = async (config) => {
    calls++;
    return respond(calls === 1
      ? { results: mocks.MOCK_USERS.slice(0, 10), next: '?page=2' }
      : { results: mocks.MOCK_USERS.slice(10), next: null }, config);
  };
  const rows = await service.createUserListLoader('users/')(new AbortController().signal);
  assert.equal(calls, 2);
  assert.equal(rows.length, 26);
  apiClient.defaults.adapter = async (config) => respond(mocks.MOCK_USERS, config);
  assert.equal((await service.createUserListLoader('users/')(new AbortController().signal)).length, 26);
});

test('missing configuration and invalid response are rejected, never replaced by mock users', async () => {
  await assert.rejects(service.createUserListLoader('')(new AbortController().signal));
  apiClient.defaults.adapter = async (config) => respond([{ id: 1, role: 'admin' }], config);
  await assert.rejects(service.createUserListLoader('users/')(new AbortController().signal));
});

test('pagination cannot forward authentication to another origin or loop', async () => {
  let calls = 0;
  apiClient.defaults.adapter = async (config) => {
    calls++;
    return respond({ results: [], next: 'https://example.org/users/' }, config);
  };
  await assert.rejects(service.createUserListLoader('users/')(new AbortController().signal));
  assert.equal(calls, 1);
  apiClient.defaults.adapter = async (config) => respond({ results: [], next: config.url }, config);
  await assert.rejects(service.createUserListLoader('users/')(new AbortController().signal));
});

test('demo requests can be cancelled on unmount', async () => {
  const controller = new AbortController();
  const pending = mocks.loadDemoUsers(controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('local filtering remains below 400ms with 10,000 records (not a browser/API latency test)', (t) => {
  const rows = Array.from({ length: 10000 }, (_, index) => ({ ...mocks.MOCK_USERS[index % 26], id: index }));
  const start = performance.now();
  const filtered = logic.filterUsers(rows, filters);
  logic.paginateUsers(filtered, 2);
  const elapsed = performance.now() - start;
  t.diagnostic(`Filtering and pagination: ${elapsed.toFixed(2)} ms`);
  assert.ok(elapsed < 400);
});
