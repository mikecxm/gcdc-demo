"""HTTP QA on isolated PostgreSQL; run with manage.py test (or pytest-django)."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import re
from pathlib import Path
import subprocess
import sys
from statistics import mean
from threading import Barrier
from time import perf_counter, sleep
from unittest import skipUnless

import requests
from django.conf import settings
from django.test import LiveServerTestCase
from django.test.testcases import LiveServerThread
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from config.servers import LocalThreadedWSGIServer

from .models import CustomUser, Role, RoleName, UserRole


class ConcurrentLiveServerThread(LiveServerThread):
    server_class = LocalThreadedWSGIServer


class UserListPerformanceTests(LiveServerTestCase):
    host = '127.0.0.1'
    server_thread_class = ConcurrentLiveServerThread

    @classmethod
    def setUpClass(cls):
        if settings.DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
            raise RuntimeError('Esta certificacion requiere PostgreSQL local.')
        super().setUpClass()

    def setUp(self):
        admin = CustomUser.objects.create_user(
            email='load-admin@example.com', full_name='QA', roles=[RoleName.ADMIN],
        )
        self.admin = admin
        self.headers = {'Authorization': f'Bearer {AccessToken.for_user(admin)}'}
        role, _ = Role.objects.get_or_create(name=RoleName.AUTOR)
        users = CustomUser.objects.bulk_create([
            CustomUser(email=f'load-{i}@example.com', full_name=f'QA {i}',
                       affiliation="Universidad ñ & O'Hara + 100%_" if i < 125 else 'Other',
                       is_active=i % 2 == 0)
            for i in range(999)
        ])
        UserRole.objects.bulk_create([UserRole(user=u, role=role) for u in users])
        self.expected = {u.pk for i, u in enumerate(users) if i < 125 and i % 2 == 0}
        self.url = self.live_server_url + '/api/v1/users/'
        self.params = {'role': 'AUTOR', 'affiliation': "ñ & O'Hara + 100%_", 'is_active': 'true'}

    def get(self, url=None, params=None):
        return requests.get(url or self.url, params=params, headers=self.headers, timeout=30)

    def test_50_simultaneous_filtered_requests(self):
        self.assertEqual(self.get(params=self.params).status_code, 200)
        barrier = Barrier(50)

        def request(_):
            barrier.wait(timeout=30)
            start = perf_counter()
            response = self.get(params=self.params)
            elapsed = (perf_counter() - start) * 1000
            return elapsed, response

        with ThreadPoolExecutor(max_workers=50) as pool:
            results = list(pool.map(request, range(50)))
        durations = [duration for duration, _ in results]
        average = mean(durations)
        print(f'\nHTTP 50 concurrent: mean={average:.2f} ms; max={max(durations):.2f} ms')
        report = {
            'transport': 'HTTP TCP IPv4, Django threaded WSGI',
            'database': 'isolated PostgreSQL test database',
            'fixture_users': 1000, 'concurrent_requests': 50,
            'backlog': LocalThreadedWSGIServer.request_queue_size,
            'mean_ms': average, 'max_ms': max(durations), 'limit_mean_ms': 400,
            'samples': [
                {'ms': duration, 'status': response.status_code, 'count': response.json().get('count')}
                for duration, response in results
            ],
            'sla_pass': average <= 400,
        }
        (settings.BASE_DIR.parent / 'docs' / 'hu04-http-results.json').write_text(
            json.dumps(report, indent=2), encoding='utf-8',
        )
        for _, response in results:
            self.assertEqual(response.status_code, 200, response.text[:200])
            self.assertEqual(response.json()['count'], len(self.expected))
            self.assertEqual(len(response.json()['results']), 10)
            self.assertTrue({u['id'] for u in response.json()['results']} <= self.expected)
        self.assertLessEqual(average, 400, 'SLA promedio <= 400 ms incumplido')

    @skipUnless(os.environ.get('QA_BROWSER') == '1', 'Activar QA_BROWSER=1 con Vite iniciado')
    def test_frontend_chrome(self):
        """Real Vite UI + Axios + runserver + isolated PostgreSQL; no HTTP mocks."""
        from playwright.sync_api import sync_playwright

        root = Path(settings.BASE_DIR)
        evidence = root.parent / 'docs'
        refresh = RefreshToken.for_user(self.admin)
        storage = {
            'symposia_auth_token': str(refresh.access_token),
            'symposia_refresh_token': str(refresh),
            'symposia_active_role': 'ADMIN',
            'symposia_user_roles': '["ADMIN"]',
            'symposia_user_full_name': 'QA',
        }
        env = {**os.environ, 'DB_NAME': settings.DATABASES['default']['NAME']}
        # Port 8000 must be free: never silently measure an unrelated server.
        import socket
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 8000))
        with (evidence / 'hu04-runserver.log').open('w', encoding='utf-8') as log:
            server = subprocess.Popen(
                [sys.executable, 'manage.py', 'runserver', '127.0.0.1:8000', '--noreload'],
                cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
            try:
                for _ in range(100):
                    self.assertIsNone(server.poll(), 'runserver no pudo iniciar')
                    try:
                        response = requests.get('http://127.0.0.1:8000/api/v1/users/', timeout=1)
                        if response.status_code == 401:
                            break
                    except requests.ConnectionError:
                        pass
                    sleep(0.1)
                else:
                    self.fail('runserver no respondio')
                with sync_playwright() as playwright:
                    chrome = Path(os.environ.get('QA_CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe'))
                    browser = playwright.chromium.launch(executable_path=str(chrome), headless=True)
                    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                    page.add_init_script('Object.entries(' + json.dumps(storage) + ').forEach(([k,v]) => localStorage.setItem(k,v))')
                    page.goto('http://127.0.0.1:5173/#usuarios')
                    page.locator('tbody tr').filter(has_text='load-').first.wait_for(timeout=30000)
                    self.assertEqual(page.locator('tbody tr').count(), 10)
                    report = page.evaluate('''async (params) => {
                        const { apiClient } = await import('/src/services/api.ts');
                        const request = async () => {
                            const start = performance.now();
                            const response = await apiClient.get('/users/', { params });
                            return {ms: performance.now()-start, status: response.status, count: response.data.count,
                                ids: response.data.results.map(u => u.id)};
                        };
                        await request();
                        const rounds = [];
                        for (let round=0; round<3; round++) {
                            const samples = await Promise.all(Array.from({length:50}, request));
                            rounds.push({mean_ms:samples.reduce((s,x)=>s+x.ms,0)/50,
                                max_ms:Math.max(...samples.map(x=>x.ms)), samples});
                        }
                        return {url:apiClient.defaults.baseURL, rounds};
                    }''', self.params)
                    report['browser'] = browser.version
                    report['expected_count'] = len(self.expected)
                    report['sla_pass'] = all(r['mean_ms'] <= 400 for r in report['rounds'])
                    # Verify the visible client filters and capture their rendered result.
                    filter_started = perf_counter()
                    page.get_by_role('combobox', name='Filtrar por rol').select_option('AUTOR')
                    page.get_by_role('combobox', name='Filtrar por estado').select_option('ACTIVE')
                    page.get_by_placeholder('Buscar por nombre, correo o institución').fill("ñ & O'Hara + 100%_")
                    page.get_by_text(f'{len(self.expected)} personas coinciden con los filtros').wait_for()
                    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                    report['filter_to_paint_ms'] = (perf_counter() - filter_started) * 1000
                    report['visible_rows'] = page.locator('tbody tr').count()
                    self.assertTrue(all("Universidad" in text for text in page.locator('tbody tr').all_inner_texts()))
                    page.screenshot(path=str(evidence / 'hu04-browser.png'), full_page=True)
                    emails, pages = [], 0
                    while True:
                        emails.extend(re.findall(r'load-\d+@example\.com', page.locator('tbody').inner_text()))
                        pages += 1
                        self.assertLessEqual(pages, 7)
                        next_page = page.get_by_role('button', name='Página siguiente')
                        if next_page.is_disabled():
                            break
                        next_page.click()
                    self.assertEqual(len(emails), 63)
                    self.assertEqual(set(emails), {f'load-{i}@example.com' for i in range(0, 125, 2)})
                    report['ui_pages'] = pages
                    report['ui_unique_users'] = len(set(emails))
                    (evidence / 'hu04-browser-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
                    browser.close()
                for round_result in report['rounds']:
                    print(f"\nChrome 50 GET: mean={round_result['mean_ms']:.2f} ms, max={round_result['max_ms']:.2f} ms")
                    self.assertLessEqual(round_result['mean_ms'], 400)
                    for sample in round_result['samples']:
                        self.assertEqual(sample['status'], 200)
                        self.assertEqual(sample['count'], len(self.expected))
                        self.assertTrue(set(sample['ids']) <= self.expected)
                self.assertEqual(report['visible_rows'], 10)
                if os.environ.get('QA_LOCUST') == '1':
                    locust_env = {
                        **env, 'QA_TOKEN': str(refresh.access_token),
                        'QA_AFFILIATION': self.params['affiliation'],
                        'QA_EXPECTED_COUNT': str(len(self.expected)),
                        'QA_RESULT_PATH': str(evidence / 'hu04-locust-results.json'),
                    }
                    result = subprocess.run([
                        sys.executable, '-m', 'locust', '-f', 'locustfile.py',
                        '--host', 'http://127.0.0.1:8000', '--headless',
                        '-u', '50', '-r', '50', '-t', '15s', '--only-summary',
                        '--csv', str(evidence / 'hu04-locust'),
                        '--html', str(evidence / 'hu04-locust.html'),
                    ], cwd=root, env=locust_env, capture_output=True, text=True, timeout=60)
                    (evidence / 'hu04-locust.log').write_text(result.stdout + result.stderr, encoding='utf-8')
                    self.assertEqual(result.returncode, 0, result.stderr[-2000:])
                    aggregate = json.loads((evidence / 'hu04-locust-results.json').read_text(encoding='utf-8'))
                    self.assertGreaterEqual(aggregate['requests'], 50)
                    self.assertEqual(aggregate['failures'], 0)
                    self.assertLessEqual(aggregate['mean_ms'], 400)
                    print(f"\nLocust 50 users: {aggregate['requests']} GET, mean={aggregate['mean_ms']:.2f} ms, failures=0")
            finally:
                server.terminate()
                server.wait(timeout=15)

    def test_exact_filtered_pagination(self):
        response = self.get(params=self.params)
        ids, pages = [], 0
        while True:
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data['count'], len(self.expected))
            ids.extend(u['id'] for u in data['results'])
            pages += 1
            self.assertLessEqual(pages, 7)
            if not data['next']:
                break
            response = self.get(url=data['next'])
        self.assertEqual(len(ids), len(self.expected))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), self.expected)
        print(f'\nPagination: {pages} pages, {len(ids)} unique users, zero discrepancies')

    def test_special_characters(self):
        for term, expected in [("O'Hara", 125), ('ñ', 125), ('&', 125), ('+', 125),
                               ('%', 125), ('_', 125), ("'; DROP TABLE custom_user; --", 0), ('😀', 0)]:
            with self.subTest(term=term):
                response = self.get(params={'affiliation': term})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['count'], expected)
