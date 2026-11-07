import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05']
  }
};

const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';

export default function () {
  const response = http.post(
    `${base}/api/v1/auth/login`,
    JSON.stringify({ email: 'load@example.com', password: 'not-a-real-password' }),
    { headers: { 'content-type': 'application/json' } }
  );
  check(response, { 'login menjawab': (result) => result.status === 401 || result.status === 422 || result.status === 429 });
  sleep(0.2);
}
