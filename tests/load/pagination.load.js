import http from 'k6/http';
import { sleep } from 'k6';

export const options = { vus: 5, duration: '30s' };
const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const token = __ENV.ACCESS_TOKEN || '';
const workspaceId = __ENV.WORKSPACE_ID || '00000000-0000-4000-8000-000000000000';

export default function () {
  http.get(`${base}/api/v1/workspaces/${workspaceId}/todos?limit=20`, {
    headers: { authorization: `Bearer ${token}` }
  });
  sleep(0.2);
}
