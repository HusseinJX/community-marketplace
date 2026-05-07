# Deployment — Community Marketplace

## Live URL
TBD — deploy to Netlify

## Platform
Netlify (static export or SSR)

## Repo
TBD

## How to Deploy
1. Push to GitHub
2. Connect to Netlify
3. Set env var: NEXT_PUBLIC_API_BASE = https://community-connector-agent.netlify.app

## Environment Variables
- `NEXT_PUBLIC_API_BASE` — base URL of the Community Connector Agent Netlify deployment

## Notes
- Public marketplace app — no auth required
- Data sourced from Community Connector Agent Firestore via public marketplace API endpoints
