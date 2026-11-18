import assert from 'node:assert/strict';
import test from 'node:test';
import { reportUrl } from '../src/utils/report-url.mjs';
test('QR label keeps the token and selects the configured origin', () => {
  const local = 'http://localhost:5173';
  assert.equal(reportUrl('a/b', '', local, false), local + '/report/a%2Fb');
  assert.equal(reportUrl('abc', 'https://test.example', local, true), 'https://test.example/report/abc');
  for (const invalid of ['', local, 'https://localhost.', 'https://a.localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user@a.example', 'https://a.example/path']) {
    assert.throws(() => reportUrl('abc', invalid, local, true), /VITE_PUBLIC_FRONTEND_URL/);
  }
});
