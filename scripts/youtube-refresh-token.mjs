#!/usr/bin/env node
// One-off helper to mint a YouTube refresh token for the central company channel.
//
// Usage:
//   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy node scripts/youtube-refresh-token.mjs
//
// It starts a tiny local server, prints a Google consent URL, you approve it AS
// THE GOOGLE ACCOUNT THAT OWNS THE COMPANY YOUTUBE CHANNEL, and it prints the
// refresh token to paste into .env.local as YOUTUBE_REFRESH_TOKEN.
//
// Requirements on the Google Cloud OAuth client:
//  - YouTube Data API v3 enabled on the project
//  - Authorized redirect URI must include:  http://localhost:8719/callback
//    (a "Desktop app" client type allows loopback without configuring this;
//     a "Web application" client must list that exact URI)

import http from 'node:http'

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const PORT = 8719
const REDIRECT = `http://localhost:${PORT}/callback`
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars first.')
  process.exit(1)
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time
  })

console.log('\n1) Open this URL and approve as the CHANNEL-OWNING Google account:\n')
console.log(authUrl)
console.log(`\n2) Waiting for the redirect on ${REDIRECT} ...\n`)

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404).end()
    return
  }
  const code = new URL(req.url, REDIRECT).searchParams.get('code')
  if (!code) {
    res.writeHead(400).end('No code')
    return
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    })
    const data = await tokenRes.json()
    if (!data.refresh_token) {
      console.error('\nNo refresh_token returned. Response:', JSON.stringify(data, null, 2))
      console.error('Tip: revoke prior access at https://myaccount.google.com/permissions and retry (prompt=consent is set).')
      res.writeHead(500).end('No refresh token — check the terminal.')
    } else {
      console.log('\n✅ SUCCESS. Add these to .env.local (and your prod env):\n')
      console.log(`YOUTUBE_CLIENT_ID=${CLIENT_ID}`)
      console.log(`YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}`)
      console.log(`YOUTUBE_REFRESH_TOKEN=${data.refresh_token}`)
      console.log(`\n(scope granted: ${data.scope})\n`)
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(
        '<h2>Done ✅</h2><p>Refresh token printed in your terminal. You can close this tab.</p>',
      )
    }
  } catch (err) {
    console.error('Token exchange failed:', err)
    res.writeHead(500).end('Token exchange failed — check the terminal.')
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 500)
  }
})

server.listen(PORT)
