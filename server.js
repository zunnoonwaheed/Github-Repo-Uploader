const express = require('express');
const session = require('express-session');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy headers (required on Vercel) so secure cookies work correctly.
// Without this, req.secure may be false behind the proxy and cookies won't be set.
app.set('trust proxy', 1);

// OAuth credentials
// For local development: hardcoded values below
// For production (Vercel): MUST be set as environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liLdT7cwofYlinEU';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '886cb92f58af581deccff63e11171def76f9afcf';

// Verify credentials in production
if (process.env.NODE_ENV === 'production' && (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)) {
  console.error('⚠️  WARNING: GitHub OAuth credentials not set in environment variables!');
  console.error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel environment variables.');
}

// Configure multer for file uploads
// In Vercel, use /tmp directory; locally use uploads/
const uploadDir = process.env.VERCEL ? '/tmp' : 'uploads/';
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'github-uploader-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve renderer files from /renderer route
app.use('/renderer', express.static(path.join(__dirname, 'renderer')));

// ─── Authentication Middleware ─────────────────────────────────────────────
function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  return parts.join('; ');
}

function getAccessToken(req) {
  if (req.session?.accessToken) return req.session.accessToken;
  const cookies = parseCookies(req);
  return cookies.github_access_token || null;
}

function requireAuth(req, res, next) {
  const token = getAccessToken(req);
  if (!token) {
    console.error('❌ Authentication failed: No session or access token');
    return res.status(401).json({
      error: 'Not authenticated. Please refresh the page and log in again.'
    });
  }
  next();
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

// Setup page
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'setup.html'));
});

// Check auth status
app.get('/api/auth/status', async (req, res) => {
  const token = getAccessToken(req);
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    res.json({
      authenticated: true,
      username: response.data.login,
      avatar: response.data.avatar_url
    });
  } catch (error) {
    req.session.destroy();
    res.json({ authenticated: false });
  }
});

// Helper to get base URL
function getBaseUrl(req) {
  // In production (Vercel), use the host from request
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return `https://${req.get('host')}`;
  }
  // In development, use localhost
  return `http://localhost:${PORT}`;
}

// Get OAuth configuration
app.get('/api/auth/config', (req, res) => {
  res.json({
    clientId: GITHUB_CLIENT_ID,
    redirectUri: `${getBaseUrl(req)}/auth/github/callback`
  });
});

// Initiate GitHub OAuth
app.get('/auth/github', (req, res) => {
  // Get credentials from query params (passed from frontend)
  const clientId = req.query.client_id || GITHUB_CLIENT_ID;
  const clientSecret = req.query.client_secret || GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect('/setup?error=missing_credentials');
  }

  // Store credentials in session for the callback
  req.session.oauthClientId = clientId;
  req.session.oauthClientSecret = clientSecret;

  // Also encode credentials in state parameter as backup for serverless
  const state = Buffer.from(JSON.stringify({ clientId, clientSecret })).toString('base64');

  const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
  const scope = 'repo user';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  // Try to get credentials from state parameter (for serverless compatibility)
  let clientId, clientSecret;

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      clientId = decoded.clientId;
      clientSecret = decoded.clientSecret;
    } catch (error) {
      console.error('Failed to decode state parameter:', error);
    }
  }

  // Fall back to session if state decoding failed
  if (!clientId || !clientSecret) {
    clientId = req.session.oauthClientId || GITHUB_CLIENT_ID;
    clientSecret = req.session.oauthClientSecret || GITHUB_CLIENT_SECRET;
  }

  if (!clientId || !clientSecret) {
    return res.redirect('/setup?error=session_expired');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.redirect('/?error=no_token');
    }

    // Save token in session (best-effort; mainly for local dev)
    req.session.accessToken = accessToken;

    // Also persist token in an HttpOnly cookie for serverless deployments (Vercel),
    // where in-memory sessions are not reliable across invocations.
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    res.setHeader('Set-Cookie', serializeCookie('github_access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      path: '/',
      maxAge: 24 * 60 * 60
    }));

    // Redirect to home
    res.redirect('/?login=success');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect('/?error=auth_failed');
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  res.setHeader('Set-Cookie', serializeCookie('github_access_token', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0
  }));
  res.json({ success: true });
});

// Upload folder to GitHub
app.post('/api/upload', requireAuth, upload.single('folder'), async (req, res) => {
  console.log('\n📤 Upload request received');
  const { repoName, isPrivate } = req.body;
  const zipFile = req.file;

  if (!zipFile) {
    console.error('❌ No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!repoName) {
    console.error('❌ No repository name provided');
    return res.status(400).json({ error: 'Repository name is required' });
  }

  console.log(`📁 Repository name: ${repoName}`);
  console.log(`🔒 Private: ${isPrivate === 'true' ? 'Yes' : 'No'}`);
  console.log(`📦 Zip file size: ${(zipFile.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    const accessToken = getAccessToken(req);
    const isPrivateRepo = isPrivate === 'true';

    // Extract zip file
    console.log('📂 Extracting zip file...');
    const zip = new AdmZip(zipFile.path);
    // Vercel serverless filesystem is read-only except /tmp
    const extractBase = process.env.VERCEL ? '/tmp' : 'uploads';
    const extractPath = path.join(extractBase, `extracted_${Date.now()}`);
    zip.extractAllTo(extractPath, true);
    console.log(`✅ Files extracted to: ${extractPath}`);

    // Get username
    console.log('👤 Getting GitHub user info...');
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    const username = userResponse.data.login;
    console.log(`✅ Authenticated as: ${username}`);

    // Create repository with auto_init to avoid empty repo issues
    console.log(`🏗️  Creating repository: ${repoName}...`);
    const repoResponse = await axios.post('https://api.github.com/user/repos', {
      name: repoName,
      private: isPrivateRepo,
      auto_init: true  // Initialize with README to avoid "empty repo" errors
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const repoUrl = repoResponse.data.html_url;
    const repoFullName = repoResponse.data.full_name;
    console.log(`✅ Repository created: ${repoUrl}`);

    // Wait a moment for repo to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('⏳ Repository initialized');

    // Get the default branch info (should have initial commit now)
    const branchResponse = await axios.get(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/main`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    const baseCommitSha = branchResponse.data.object.sha;
    console.log(`📍 Base commit: ${baseCommitSha.substring(0, 7)}`);

    // Read files and create blobs
    const files = getAllFiles(extractPath);

    // File count limit
    if (files.length === 0) {
      throw new Error('No files found in the uploaded folder');
    }

    if (files.length > 2000) {
      throw new Error(`Too many files (${files.length}). Please limit to 2000 files or less. Tip: Make sure node_modules and other build folders are excluded.`);
    }

    const blobs = [];

    console.log(`📦 Processing ${files.length} files...`);

    // Upload files in batches of 10 for speed
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, Math.min(i + batchSize, files.length));
      const batchPromises = batch.map(async (file) => {
        try {
          const content = fs.readFileSync(file.path);
          const blobResponse = await axios.post(
            `https://api.github.com/repos/${repoFullName}/git/blobs`,
            {
              content: content.toString('base64'),
              encoding: 'base64'
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );

          return {
            path: file.relativePath,
            mode: '100644',
            type: 'blob',
            sha: blobResponse.data.sha
          };
        } catch (error) {
          console.error(`❌ Failed to upload ${file.relativePath}:`, error.response?.data || error.message);
          throw new Error(`Failed to upload file: ${file.relativePath}`);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      blobs.push(...batchResults);

      console.log(`⬆️  Uploaded ${Math.min(i + batchSize, files.length)}/${files.length} files...`);
    }

    console.log(`✅ All ${files.length} files uploaded successfully`);

    // Create tree
    console.log('🌳 Creating git tree...');
    const treeResponse = await axios.post(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      { tree: blobs },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    console.log('✅ Tree created successfully');

    // Create commit with parent reference
    console.log('💾 Creating commit...');
    const commitResponse = await axios.post(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        message: 'Add project files via GitHub Uploader',
        tree: treeResponse.data.sha,
        parents: [baseCommitSha]  // Reference the initial commit
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    console.log('✅ Commit created successfully');

    // Update reference (push to main) - use PATCH since ref already exists
    console.log('🚀 Pushing to main branch...');
    await axios.patch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/main`,
      {
        sha: commitResponse.data.sha,
        force: false
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    console.log('✅ Pushed to GitHub successfully!');

    // Cleanup
    console.log('🧹 Cleaning up temporary files...');
    fs.rmSync(zipFile.path);
    fs.rmSync(extractPath, { recursive: true, force: true });
    console.log('✅ Cleanup complete');

    console.log(`\n🎉 SUCCESS! Repository uploaded: ${repoUrl}\n`);

    res.json({
      success: true,
      repoUrl: repoUrl,
      message: 'Repository created and files uploaded successfully!'
    });

  } catch (error) {
    // Cleanup on error
    if (req.file) {
      try {
        fs.rmSync(req.file.path);
      } catch {}
    }

    console.error('\n❌ Upload error:', error.response?.data || error.message);
    console.error('Stack:', error.stack);

    const errorMessage = error.response?.data?.message || error.message || 'Upload failed';

    // Always return JSON
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || { message: error.message }
    });
  }
});

// Helper function to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = [], basePath = dirPath) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // Skip these directories entirely
      const dirName = file.toLowerCase();
      if (dirName === 'node_modules' ||
          dirName === '.git' ||
          dirName === '.claude' ||
          dirName === 'dist' ||
          dirName === 'build' ||
          dirName === '.next' ||
          dirName === '.nuxt' ||
          dirName === 'vendor' ||
          dirName === '.venv' ||
          dirName === 'venv' ||
          dirName === '__pycache__' ||
          dirName === '.cache' ||
          dirName === 'coverage') {
        return; // Skip this directory
      }
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles, basePath);
    } else {
      const relativePath = path.relative(basePath, filePath);
      const fileName = file.toLowerCase();

      // Skip certain files
      if (!fileName.endsWith('.log') &&
          !fileName.endsWith('.pyc') &&
          !fileName.startsWith('.ds_store') &&
          fileName !== 'thumbs.db' &&
          stats.size < 50 * 1024 * 1024) { // Skip files larger than 50MB
        arrayOfFiles.push({
          path: filePath,
          relativePath: relativePath.replace(/\\/g, '/') // Normalize path separators
        });
      }
    }
  });

  return arrayOfFiles;
}

// Create uploads directory if it doesn't exist (only in non-serverless mode)
if (!process.env.VERCEL && !fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// For Vercel serverless: export the app
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development: start the server
  app.listen(PORT, () => {
    console.log(`\n🚀 GitHub Uploader running at: http://localhost:${PORT}`);
    console.log(`\n✨ Ready to use! Just open the URL and click "Login with GitHub"\n`);

    if (GITHUB_CLIENT_ID === 'your_default_client_id_here') {
      console.log(`⚠️  Using default OAuth credentials - you should update these!`);
      console.log(`\n📝 To set up your own OAuth app:`);
      console.log(`   1. Create a GitHub OAuth App at: https://github.com/settings/developers`);
      console.log(`   2. Set Authorization callback URL to: http://localhost:${PORT}/auth/github/callback`);
      console.log(`   3. Copy .env.example to .env and add your credentials\n`);
    } else {
      console.log(`✓ Using custom OAuth credentials from .env\n`);
    }
  });
}
