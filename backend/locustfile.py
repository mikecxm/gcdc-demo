"""Optional sustained load: QA_TOKEN required; never store tokens in source."""
import os
import json
from pathlib import Path
from locust import HttpUser, task, between, events


@events.quitting.add_listener
def save_final_stats(environment, **kwargs):
    if path := os.environ.get('QA_RESULT_PATH'):
        total = environment.stats.total
        Path(path).write_text(json.dumps({
            'requests': total.num_requests, 'failures': total.num_failures,
            'mean_ms': total.avg_response_time, 'max_ms': total.max_response_time,
        }, indent=2), encoding='utf-8')


class UserDirectoryLoad(HttpUser):
    wait_time = between(0.1, 0.3)

    def on_start(self):
        self.client.headers['Authorization'] = 'Bearer ' + os.environ['QA_TOKEN']

    @task
    def filtered_users(self):
        with self.client.get('/api/v1/users/', params={
            'role': 'AUTOR', 'affiliation': os.environ.get('QA_AFFILIATION', 'Univalle'), 'is_active': 'true',
        }, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f'HTTP {response.status_code}')
            elif os.environ.get('QA_EXPECTED_COUNT') is not None:
                if response.json().get('count') != int(os.environ['QA_EXPECTED_COUNT']):
                    response.failure('Conteo filtrado incorrecto')
