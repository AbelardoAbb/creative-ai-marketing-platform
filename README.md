# Creative AI Marketing Platform

## Overview
A SaaS platform for AI-assisted marketing content creation, visual generation, collaboration, approval and AI governance.

## Technology
- React
- TypeScript
- Vite
- Tailwind CSS
- Node.js / Express
- Supabase
- Stability AI
- Anthropic Claude

## Main capabilities
- Campaign management
- AI image generation
- AI-assisted content creation
- Collaboration
- Approval workflow
- Responsible AI moderation
- AI audit trail
- Cost tracking
- RBAC

## AI Providers Status
- **Stability AI**: Real integration validated.
- **Anthropic Claude**: Anthropic API integration implemented and authentication validated; live content generation is currently limited by insufficient Anthropic account credits; no simulated Claude responses are used.

## Development

Prerequisites:
- Node.js (v18+)
- npm

Setup:
1. Copy `.env.example` to `.env` and configure your environment variables.
2. The environment variables are loaded securely on the backend server.

Available commands:
- `npm run dev`: Start the development server (Express + Vite) on port 3000.
- `npm run build`: Build client static assets with Vite and bundle the server with esbuild into `dist/server.cjs`.
- `npm start`: Launch the production server from `dist/server.cjs`.
- `npm test`: Execute the comprehensive automated test suites (RBAC, campaigns, image generation, Claude provider, approval workflow, moderation, AI audit & cost tracking).
- `npm run lint`: Run TypeScript type checking (`tsc --noEmit`).
- `npm run preview`: Preview the production client build locally.
- `npm run clean`: Remove build artifacts (`dist/` directory).
