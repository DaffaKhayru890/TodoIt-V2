import http from 'k6/http';
import { sleep } from 'k6';

export const options = { vus: 5, duration: '30s' };
const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const token = __ENV.ACCESS_TOKEN || '';

export default function () {
  http.get(`${base}/api/v1/notifications/unread-count`, { headers: { authorization: `Bearer ${token}` } });
  sleep(0.2);
}
