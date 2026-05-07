# Deployment — Community Marketplace

## Live URL
https://comfy-zuccutto-73b27f.netlify.app

## Platform
Netlify (SSR via @netlify/plugin-nextjs)

## Repo
https://github.com/HusseinJX/community-marketplace

## How to Deploy
Push to `main` — manually re-run `netlify deploy --prod` from the project dir (auto-deploy via GitHub not yet wired; connect in Netlify dashboard under Site settings > Build & deploy > GitHub).

## Environment Variables
- `NEXT_PUBLIC_API_BASE` — base URL of the Community Connector Agent Netlify deployment

## Notes
- Public marketplace app — no auth required
- Data sourced from Community Connector Agent Firestore via public marketplace API endpoints
