# GitPush — One-Click GitHub Uploader

A web application to drag-and-drop any local folder and push it to GitHub in one click. Each user provides their own GitHub OAuth credentials - no shared accounts!

**🚀 Live Demo:** [https://github-repo-uploader.vercel.app](https://github-repo-uploader.vercel.app)

---

## Features

- **Your Own OAuth App** - Each user sets up their own GitHub credentials (one-time setup)
- **Guided Setup** - Step-by-step instructions to create your OAuth app
- **Drag & Drop** - Simply drag a folder or browse to select
- **Automatic Repository Creation** - Creates public or private repos
- **Smart Filtering** - Auto-excludes node_modules, .git, and other unnecessary folders
- **Real-time Progress** - Watch your upload in real-time
- **Web-based** - Works on localhost or deployed to Vercel/any hosting

---

## Quick Start

### Option 1: Use the Live Version (No Installation!)

1. **Visit:** [https://github-repo-uploader.vercel.app](https://github-repo-uploader.vercel.app)
2. Follow the setup instructions to create your GitHub OAuth App
3. Start uploading!

### Option 2: Run Locally

1. **Install Dependencies**

```bash
cd github-uploader
npm install
```

2. **Start the Server**

```bash
npm start
```

The server will start at **http://localhost:3000**

3. **First-Time Setup**

1. Open **http://localhost:3000** in your browser
2. You'll be redirected to the **Setup Page**
3. Follow the on-screen instructions to:
   - Create your GitHub OAuth App
   - Enter your Client ID and Client Secret
4. Click "Save & Continue"

That's it! You're ready to upload folders to GitHub!

---

## How to Use

1. **Open http://localhost:3000** in your browser
2. **Click "Login with GitHub"** - Authenticate with your GitHub account
3. **Select a folder** to upload (drag-and-drop or browse)
4. **Edit the repo name** if you want (defaults to the folder's name)
5. **Toggle visibility** — Public or Private
6. Click **"Upload to GitHub"**
7. Watch the progress in the console
8. On success, click the URL to open your new repo!

---

## What Gets Uploaded?

The app automatically **excludes** these folders/files:
- `node_modules/`
- `.git/`
- `.claude/`
- `dist/`, `build/`
- `.next/`, `.nuxt/`
- `vendor/`, `venv/`, `.venv/`
- `__pycache__/`, `.cache/`, `coverage/`
- `*.log`, `*.pyc`
- `.DS_Store`, `Thumbs.db`

### File Limits
- Maximum **2000 files** per upload
- Files larger than **50MB** are skipped
- If you need to upload more, split into smaller folders

---

## Setup Your GitHub OAuth App

### Step 1: Create OAuth App

1. Go to https://github.com/settings/applications/new
2. Fill in these details:
   - **Application name**: GitHub Uploader (or any name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
3. Click **"Register application"**

### Step 2: Get Your Credentials

1. Copy your **Client ID**
2. Click **"Generate a new client secret"**
3. Copy the **Client Secret** (you won't see it again!)

### Step 3: Enter in the App

1. Go to http://localhost:3000/setup
2. Paste your Client ID and Client Secret
3. Click "Save & Continue"

Your credentials are stored **only in your browser** (localStorage) - they're never sent to any third-party server!

---

## Security & Privacy

- ✅ **Your credentials stay local** - Stored in browser localStorage
- ✅ **No tracking** - No analytics, no data collection
- ✅ **Open source** - Audit the code yourself
- ✅ **Your OAuth app** - You control everything

The app only communicates with:
1. Your local server (localhost:3000)
2. GitHub's API (api.github.com)

That's it! No other servers involved.

---

## Updating Your Credentials

Need to update your OAuth credentials?

1. Click the **⚙️ Settings icon** in the top-right corner
2. Enter your new Client ID and Client Secret
3. Click "Save & Continue"

---

## Deploying to Vercel (Optional)

Want to host this online? See **DEPLOY_VERCEL.md** for detailed instructions.

**Quick version:**
1. Push to GitHub
2. Import in Vercel
3. Deploy
4. Update your OAuth app callback URL to match your Vercel domain

---

## Project Structure

```
github-uploader/
├── server.js              ← Express server (OAuth, API, file handling)
├── package.json
├── renderer/
│   ├── index.html         ← Main app UI
│   ├── setup.html         ← OAuth setup page
│   ├── style.css          ← Dark terminal-inspired styles
│   └── renderer.js        ← Frontend logic (drag-drop, OAuth, upload)
├── README.md
└── DEPLOY_VERCEL.md       ← Deployment guide
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application |
| `/setup` | GET | OAuth credentials setup page |
| `/api/auth/status` | GET | Check if user is authenticated |
| `/auth/github` | GET | Initiate GitHub OAuth (with user's credentials) |
| `/auth/github/callback` | GET | OAuth callback handler |
| `/api/auth/logout` | POST | Logout and destroy session |
| `/api/upload` | POST | Upload folder to GitHub (requires auth) |

---

## Troubleshooting

### "Please set up your OAuth credentials"
- Click the link to go to the setup page
- Follow the instructions to create your GitHub OAuth app

### OAuth callback error
- Make sure your callback URL in GitHub OAuth app is: `http://localhost:3000/auth/github/callback`
- Check that you copied the Client ID and Secret correctly

### "Too many files" error
- Your folder has more than 2000 files
- The app automatically filters out `node_modules`, etc., but you may need to select a smaller folder
- Try uploading only the essential source code files

### Upload gets stuck
- Check the browser console for errors (F12)
- Check the server terminal for logs
- Make sure your GitHub token has `repo` scope

### Session expired
- Your session cookie expired
- Just refresh the page and log in again

---

## Development

To run in development mode with auto-reload:

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when files change.

---

## Why Your Own OAuth App?

**Security**: You control your own credentials
**Privacy**: No shared access tokens
**Reliability**: No rate limiting from shared OAuth apps
**Flexibility**: Customize scopes and permissions as needed

---

## License

MIT

---

## Support

Found a bug? Have a suggestion?
- Open an issue on GitHub
- Check existing issues first!

Happy uploading! 🚀
