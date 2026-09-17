/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../server/app';
import handler from '../api/index';
import { ROLE_PERMISSIONS, hasRolePermission } from '../src/types/auth';

let server: http.Server;
let baseUrl: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('VERCEL BACKEND & RBAC PRODUCTION VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  console.log('Suite 1: Vercel Configuration & Serverless Entrypoint Verification');
  
  // 1. Check vercel.json exists and contains correct rewrites
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  assert(fs.existsSync(vercelJsonPath), 'vercel.json exists at repository root');
  
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  assert(Array.isArray(vercelConfig.rewrites), 'vercel.json defines rewrites array');
  
  const apiRewrite = vercelConfig.rewrites.find((r: any) => r.source === '/api/(.*)');
  assert(!!apiRewrite && apiRewrite.destination === '/api', '/api/(.*) rewrites to /api serverless function');

  const spaRewrite = vercelConfig.rewrites.find((r: any) => r.source === '/(.*)');
  assert(!!spaRewrite && spaRewrite.destination === '/index.html', '/(.*) rewrites to /index.html SPA entrypoint');

  // 2. Check api/index.ts exports a valid handler function
  assert(typeof handler === 'function', 'api/index.ts exports a callable function');

  console.log('\nSuite 2: Express App & API Route Registration');
  
  // Start temporary HTTP test server
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Verify /api health endpoint
  const apiRes = await fetch(`${baseUrl}/api`);
  assert(apiRes.status === 200, 'GET /api returns HTTP 200');
  const apiJson = await apiRes.json();
  assert(apiJson.status === 'ok', 'GET /api returns JSON status ok');

  // Verify /api/auth/status
  const authStatusRes = await fetch(`${baseUrl}/api/auth/status`);
  assert(authStatusRes.status === 200, 'GET /api/auth/status returns HTTP 200');
  const authStatusJson = await authStatusRes.json();
  assert(typeof authStatusJson.configured === 'boolean', 'GET /api/auth/status returns valid status contract');

  // Verify /api/nonexistent returns JSON 404 (NEVER HTML)
  const notFoundRes = await fetch(`${baseUrl}/api/nonexistent`);
  assert(notFoundRes.status === 404, 'GET /api/nonexistent returns HTTP 404');
  const notFoundContentType = notFoundRes.headers.get('content-type') || '';
  assert(notFoundContentType.includes('application/json'), 'GET /api/nonexistent content-type is application/json');
  const notFoundJson = await notFoundRes.json();
  assert(notFoundJson.error === 'NotFound', 'GET /api/nonexistent returns JSON error NotFound');

  // Verify reverse-proxy normalization: if /api prefix is stripped, it normalizes to /api/...
  const normalizedRes = await fetch(`${baseUrl}/auth/status`);
  assert(normalizedRes.status === 200, 'GET /auth/status without /api prefix is normalized to /api/auth/status');

  console.log('\nSuite 3: Separation of Concerns & Real RBAC Matrix');

  // Verify Administrator permissions
  assert(hasRolePermission('Administrator', 'users.manage'), 'Administrator has users.manage');
  assert(hasRolePermission('Administrator', 'roles.manage'), 'Administrator has roles.manage');
  assert(hasRolePermission('Administrator', 'governance.view'), 'Administrator has governance.view');
  assert(hasRolePermission('Administrator', 'audit.view'), 'Administrator has audit.view');
  assert(hasRolePermission('Administrator', 'costs.view'), 'Administrator has costs.view');
  assert(hasRolePermission('Administrator', 'campaign.view'), 'Administrator has campaign.view');

  // Critical Governance Rule: Administrator must NOT have approval.review or approval.decide
  assert(!hasRolePermission('Administrator', 'approval.review'), 'CRITICAL: Administrator does NOT have approval.review');
  assert(!hasRolePermission('Administrator', 'approval.decide'), 'CRITICAL: Administrator does NOT have approval.decide');

  // Verify Approver permissions
  assert(hasRolePermission('Approver', 'approval.review'), 'Approver has approval.review');
  assert(hasRolePermission('Approver', 'approval.decide'), 'Approver has approval.decide');
  assert(!hasRolePermission('Approver', 'users.manage'), 'Approver does NOT have users.manage');
  assert(!hasRolePermission('Approver', 'costs.view'), 'Approver does NOT have costs.view');

  // Verify Designer permissions
  assert(hasRolePermission('Designer', 'campaign.create'), 'Designer has campaign.create');
  assert(!hasRolePermission('Designer', 'approval.review'), 'Designer does NOT have approval.review');
  assert(!hasRolePermission('Designer', 'content.create'), 'Designer does NOT have content.create');

  // Verify Copywriter permissions
  assert(hasRolePermission('Copywriter', 'content.create'), 'Copywriter has content.create');
  assert(!hasRolePermission('Copywriter', 'approval.review'), 'Copywriter does NOT have approval.review');
  assert(!hasRolePermission('Copywriter', 'asset.create'), 'Copywriter does NOT have asset.create');

  console.log('\nSuite 4: Server-Side Authentication & Endpoint Protection');

  // Verify endpoints require real authentication
  const campaignsWithoutAuth = await fetch(`${baseUrl}/api/campaigns`);
  assert(
    campaignsWithoutAuth.status === 401 || campaignsWithoutAuth.status === 503,
    'GET /api/campaigns without auth returns 401 (or 503 if Supabase unconfigured)'
  );

  const costsWithoutAuth = await fetch(`${baseUrl}/api/governance/costs-roi`);
  assert(
    costsWithoutAuth.status === 401 || costsWithoutAuth.status === 503,
    'GET /api/governance/costs-roi without auth returns 401 (or 503 if Supabase unconfigured)'
  );

  const auditWithoutAuth = await fetch(`${baseUrl}/api/governance/ai-audit`);
  assert(
    auditWithoutAuth.status === 401 || auditWithoutAuth.status === 503,
    'GET /api/governance/ai-audit without auth returns 401 (or 503 if Supabase unconfigured)'
  );

  // Close server
  server.close();

  console.log('\n================================================================');
  console.log('ALL VERCEL BACKEND & RBAC PRODUCTION VERIFICATION TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
