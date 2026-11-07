import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 5, duration: '30s' };
const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const token = __ENV.ACCESS_TOKEN || '';

export default function () {
  const response = http.get(`${base}/api/v1/workspaces`, { headers: { authorization: `Bearer ${token}` } });
  check(response, { 'workspace list menjawab': (result) => result.status === 200 || result.status === 401 });
  sleep(0.2);
}
