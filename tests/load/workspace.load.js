import http from 'k6/http';
import { sleep } from 'k6';

export const options = { vus: 5, duration: '30s' };
const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';

export default function () {
  http.get(`${base}/health`);
  sleep(0.1);
}
