# Deploying to Vercel

This guide will help you deploy the GitHub Uploader to Vercel.

## Prerequisites

- A Vercel account (sign up at https://vercel.com)
- The Vercel CLI installed (optional but recommended)
  ```bash
  npm install -g vercel
  ```

## Step 1: Update Your GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click on your existing OAuth App
3. **Add a new Authorization callback URL**:
   - Keep: `http://localhost:3000/auth/github/callback` (for local dev)
   - Add: `https://your-app-name.vercel.app/auth/github/callback`
   - Replace `your-app-name` with your actual Vercel domain (you'll get this after deploying)
4. Click **"Update application"**

> **Note**: You can come back and update this URL after your first deployment.

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. Go to https://vercel.com/new
2. Import your GitHub repository (or upload the folder)
3. Vercel will auto-detect it's a Node.js app
4. **Before deploying**, add environment variables:
   - Click **"Environment Variables"**
   - Add these variables:
     - `GITHUB_CLIENT_ID` = `Ov23liLdT7cwofYlinEU`
     - `GITHUB_CLIENT_SECRET` = `886cb92f58af581deccff63e11171def76f9afcf`
     - `SESSION_SECRET` = `(generate a random string)`
5. Click **"Deploy"**
6. Wait for deployment to complete
7. Copy your Vercel URL (e.g., `https://github-uploader-xxx.vercel.app`)

### Option B: Deploy via CLI

1. Login to Vercel:
   ```bash
   vercel login
   ```

2. From your project directory, run:
   ```bash
   vercel
   ```

3. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? (select your account)
   - Link to existing project? **N**
   - Project name? **github-uploader** (or your choice)
   - Directory? **./** (current directory)
   - Override settings? **N**

4. Add environment variables:
   ```bash
   vercel env add GITHUB_CLIENT_ID
   ```
   Paste: `Ov23liLdT7cwofYlinEU`

   ```bash
   vercel env add GITHUB_CLIENT_SECRET
   ```
   Paste: `886cb92f58af581deccff63e11171def76f9afcf`

   ```bash
   vercel env add SESSION_SECRET
   ```
   Paste: (generate a random string)

5. Deploy to production:
   ```bash
   vercel --prod
   ```

## Step 3: Update GitHub OAuth Callback URL

1. After deployment, copy your Vercel URL
2. Go back to https://github.com/settings/developers
3. Edit your OAuth App
4. Update the callback URL to match your Vercel domain:
   - `https://your-actual-vercel-url.vercel.app/auth/github/callback`
5. Save changes

## Step 4: Test Your Deployment

1. Visit your Vercel URL
2. Click "Login with GitHub"
3. Authorize the app
4. Try uploading a small folder
5. Verify it creates a repository successfully!

## Important Notes

### Security

- ✅ The hardcoded credentials in `server.js` are for **local development only**
- ✅ For production, Vercel will use the environment variables you set
- ✅ Never commit your `.env` file to Git (it's already in `.gitignore`)

### Using Your Own OAuth Credentials

If you want to use your own GitHub OAuth app instead of the provided one:

1. Create a new OAuth App at https://github.com/settings/developers
2. Use your own Client ID and Client Secret
3. Update the environment variables in Vercel
4. That's it!

### Custom Domain

If you want to use a custom domain:

1. Add your domain in Vercel project settings
2. Update your GitHub OAuth app callback URL to use your custom domain
3. Example: `https://yourdomain.com/auth/github/callback`

### Troubleshooting

**"Not authenticated" error**
- Make sure environment variables are set in Vercel
- Check that the callback URL in GitHub matches your Vercel domain exactly

**"OAuth app not found"**
- Verify GITHUB_CLIENT_ID is set correctly in Vercel environment variables

**Sessions not persisting**
- This is normal on Vercel free tier with multiple serverless functions
- Consider upgrading to Pro for better session handling
- Or use a session store like Redis for production

## Environment Variables Summary

Set these in Vercel Dashboard → Your Project → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `GITHUB_CLIENT_ID` | Your OAuth App Client ID | Yes |
| `GITHUB_CLIENT_SECRET` | Your OAuth App Client Secret | Yes |
| `SESSION_SECRET` | Random string (32+ chars) | Recommended |
| `NODE_ENV` | production | Auto-set by Vercel |

## Generate a Secure SESSION_SECRET

Run this command to generate a random secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your SESSION_SECRET.

## Support

If you encounter issues, check:
1. Vercel deployment logs
2. Browser console for errors
3. GitHub OAuth app settings

Happy deploying! 🚀
