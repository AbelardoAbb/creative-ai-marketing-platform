/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';
import handler from '../api/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runServerlessAsyncTests() {
  console.log('================================================================');
  console.log('VERCEL SERVERLESS ASYNC LIFECYCLE VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // Create a server where every incoming request directly invokes the Vercel handler
  // and awaits the returned Promise (simulating Vercel's serverless runtime runner)
  let invocationsCount = 0;
  const server = http.createServer(async (req, res) => {
    invocationsCount++;
    const start = Date.now();
    // Vercel serverless runner awaits handler promise:
    const promise = handler(req, res);
    assert(promise instanceof Promise, 'handler(req, res) returns a true Promise');
    await promise;
    const duration = Date.now() - start;
    // When promise resolves, the response stream MUST be ended
    assert(res.writableEnded, `Response stream was ended before serverless function resolved (${duration}ms)`);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log('Suite 1: Standard Endpoints via Vercel Handler Lifecycle');

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health through serverless handler returns HTTP 200');
    const healthJson = await healthRes.json();
    assert(healthJson.status === 'ok', 'Health check payload is valid');

    console.log('\nSuite 2: Authenticated Asynchronous Routes Resolution');

    // Dev admin headers (bypasses remote Supabase token roundtrip in dev/test, validating Express RBAC & routes)
    const adminHeaders = {
      'x-user-id': 'admin-test-uuid',
      'x-user-role': 'Administrator',
      'x-user-email': 'admin@creative.ai',
      'x-user-name': 'Test Admin',
    };

    // 2. GET /api/campaigns
    console.log('Testing GET /api/campaigns...');
    const campaignsRes = await fetch(`${baseUrl}/api/campaigns`, { headers: adminHeaders });
    assert(campaignsRes.status === 200, 'GET /api/campaigns resolves with HTTP 200');
    const campaignsData = await campaignsRes.json();
    assert(Array.isArray(campaignsData.campaigns), 'campaigns response contains campaigns array');
    assert(campaignsData.total >= 0, `campaigns total count is ${campaignsData.total}`);
    assert(campaignsData.scope === 'global_administrator', 'scope is correctly assigned to global_administrator');

    // 3. GET /api/governance/costs-roi
    console.log('Testing GET /api/governance/costs-roi...');
    const costsRes = await fetch(`${baseUrl}/api/governance/costs-roi`, { headers: adminHeaders });
    assert(costsRes.status === 200, 'GET /api/governance/costs-roi resolves with HTTP 200');
    const costsData = await costsRes.json();
    assert(costsData.operational !== undefined, 'costs-roi contains operational metrics');
    assert(costsData.costs !== undefined, 'costs-roi contains cost summary metrics');
    assert(costsData.roi !== undefined, 'costs-roi contains ROI metrics');

    // 4. GET /api/governance/ai-audit
    console.log('Testing GET /api/governance/ai-audit...');
    const auditRes = await fetch(`${baseUrl}/api/governance/ai-audit`, { headers: adminHeaders });
    assert(auditRes.status === 200, 'GET /api/governance/ai-audit resolves with HTTP 200');
    const auditData = await auditRes.json();
    assert(Array.isArray(auditData.events), 'ai-audit response contains events array');
    assert(typeof auditData.total === 'number', `ai-audit total events: ${auditData.total}`);

    console.log('\nSuite 3: Unauthenticated Protection & 404 Boundaries');

    // 5. Unauthenticated rejection (without headers)
    const unauthRes = await fetch(`${baseUrl}/api/campaigns`);
    assert(
      unauthRes.status === 401 || unauthRes.status === 503,
      'GET /api/campaigns without auth resolves correctly as 401 or 503'
    );

    // 6. JSON 404 for unknown endpoints
    const notFoundRes = await fetch(`${baseUrl}/api/unknown-endpoint-test`);
    assert(notFoundRes.status === 404, 'Unknown endpoint resolves with HTTP 404');
    const notFoundJson = await notFoundRes.json();
    assert(notFoundJson.error === 'NotFound', 'Error message is structured as NotFound JSON');

    console.log('\n================================================================');
    console.log(`ALL VERCEL SERVERLESS ASYNC LIFECYCLE TESTS PASSED (${invocationsCount} invocations)`);
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runServerlessAsyncTests().catch((err) => {
  console.error('Serverless async test failed:', err);
  process.exit(1);
});
