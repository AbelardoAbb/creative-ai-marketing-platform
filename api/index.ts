/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import app from '../server/app';

/**
 * Vercel Serverless Function entry point for Express backend.
 * Routes all /api/* requests directly through the Express router.
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
