# Developer Setup Guide

This guide is for **you** (the developer) to set up the OAuth credentials that will be used by all users of the app.

## Step 1: Create Your GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: `GitHub Uploader` (or any name you prefer)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Click **"Register application"**
5. You'll see your **Client ID** - copy this
6. Click **"Generate a new client secret"** and copy the secret

## Step 2: Update the Default Credentials

Open `server.js` and replace these lines (around line 12-14):

```javascript
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'your_default_client_id_here';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'your_default_client_secret_here';
```

With your actual credentials:

```javascript
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liAbC123XYZ...'; // Your Client ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'a1b2c3d4e5f6...'; // Your Client Secret
```

## Step 3: Test It

```bash
npm start
```

Open http://localhost:3000 and click "Login with GitHub" - it should work!

## For End Users

Now anyone can:
1. Clone/download your project
2. Run `npm install`
3. Run `npm start`
4. Open http://localhost:3000
5. Click "Login with GitHub" and start using it!

No configuration needed for users! They'll use your OAuth app.

## Security Notes

- The Client ID is public and safe to include in code
- The Client Secret should ideally be kept private, but for a localhost-only app, it's acceptable to include it
- If you plan to deploy this to production (with a real domain), use environment variables instead of hardcoded credentials
- For production deployment, update the callback URL in your GitHub OAuth app settings to match your domain

## Production Deployment (Optional)

If you want to deploy this to a real server:

1. Update your GitHub OAuth App callback URL to: `https://yourdomain.com/auth/github/callback`
2. Use environment variables on your server (don't hardcode secrets in production)
3. Update `server.js` line that builds the redirect URI to use the actual domain
4. Set `cookie.secure: true` in the session configuration (line 25 in server.js)

Example for production redirect URI in server.js:

```javascript
const redirectUri = process.env.CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`;
```

Then set `CALLBACK_URL=https://yourdomain.com/auth/github/callback` in your production environment.
