/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/app';

/**
 * Vercel Serverless Function entry point for Express backend.
 * Integrates Express 4 with Vercel's serverless runtime by returning
 * a Promise that keeps the serverless execution context alive until
 * the HTTP response stream has completely emitted 'finish' or 'close'.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    // If response was already finalized
    if (res.writableEnded || (res as any).finished) {
      resolve();
      return;
    }

    let isResolved = false;
    const safeResolve = () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      res.removeListener('finish', onFinish);
      res.removeListener('close', onClose);
      res.removeListener('error', onError);
    };

    const onFinish = () => {
      safeResolve();
    };

    const onClose = () => {
      safeResolve();
    };

    const onError = (err: Error) => {
      if (!res.headersSent) {
        try {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'InternalServerError',
              message: err?.message || 'Erro de stream na função serverless.',
            })
          );
        } catch {
          // ignore stream write failure
        }
      }
      safeResolve();
    };

    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);

    try {
      // Delegate to Express application with error boundary callback
      app(req as any, res as any, (err?: any) => {
        if (err) {
          if (!res.headersSent) {
            try {
              const status =
                typeof err?.statusCode === 'number'
                  ? err.statusCode
                  : typeof err?.status === 'number'
                  ? err.status
                  : 500;
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: err?.name || 'InternalServerError',
                  message: err instanceof Error ? err.message : 'Erro interno do servidor.',
                })
              );
            } catch {
              // ignore write error
            }
          }
        }
        safeResolve();
      });
    } catch (syncErr: any) {
      onError(syncErr instanceof Error ? syncErr : new Error(String(syncErr)));
    }
  });
}
