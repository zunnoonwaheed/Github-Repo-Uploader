const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 680,
    minWidth: 700,
    minHeight: 580,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d1117',
    show: false,
    icon: path.join(__dirname, 'renderer', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Select Folder ────────────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select a folder to upload',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── IPC: Get Recent Folders ───────────────────────────────────────────────
ipcMain.handle('get-recent-folders', () => {
  try {
    const storePath = path.join(os.homedir(), '.github-uploader-recents.json');
    if (!fs.existsSync(storePath)) return [];
    const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return (data.folders || []).filter(f => fs.existsSync(f)).slice(0, 5);
  } catch {
    return [];
  }
});

function saveRecentFolder(folderPath) {
  try {
    const storePath = path.join(os.homedir(), '.github-uploader-recents.json');
    let data = { folders: [] };
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    }
    data.folders = [folderPath, ...(data.folders || []).filter(f => f !== folderPath)].slice(0, 10);
    fs.writeFileSync(storePath, JSON.stringify(data), 'utf8');
  } catch {}
}

// ─── IPC: Open URL ─────────────────────────────────────────────────────────
ipcMain.handle('open-url', (_, url) => {
  shell.openExternal(url);
});

// ─── IPC: Check GitHub Auth Status ────────────────────────────────────────
ipcMain.handle('check-auth', async () => {
  try {
    // First check if gh CLI is installed
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch {
      return {
        authenticated: false,
        username: null,
        needsInstall: true,
        message: 'GitHub CLI not installed'
      };
    }

    // Check auth status
    const authStatus = execSync('gh auth status 2>&1', { encoding: 'utf8' });
    const userMatch = authStatus.match(/Logged in to [^\s]+ account ([^\s]+)/);
    const username = userMatch ? userMatch[1] : null;

    return {
      authenticated: !!username,
      username,
      needsInstall: false,
      message: username ? `Logged in as ${username}` : 'Not authenticated'
    };
  } catch (e) {
    return {
      authenticated: false,
      username: null,
      needsInstall: false,
      message: 'Not authenticated with GitHub'
    };
  }
});

// ─── IPC: Login to GitHub ──────────────────────────────────────────────────
ipcMain.handle('github-login', async () => {
  return new Promise((resolve) => {
    // Use spawn for interactive command and inherit stdio
    const loginProcess = spawn('gh', ['auth', 'login', '--web', '--git-protocol', 'https'], {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    loginProcess.on('close', (code) => {
      if (code === 0) {
        // Login successful, verify authentication
        try {
          const authStatus = execSync('gh auth status 2>&1', { encoding: 'utf8' });
          const userMatch = authStatus.match(/Logged in to [^\s]+ account ([^\s]+)/);
          const username = userMatch ? userMatch[1] : null;

          resolve({
            success: true,
            username,
            message: `Successfully logged in as ${username}`
          });
        } catch {
          resolve({
            success: true,
            username: 'user',
            message: 'Login completed successfully'
          });
        }
      } else {
        resolve({
          success: false,
          message: 'Login failed or was cancelled'
        });
      }
    });

    loginProcess.on('error', (err) => {
      resolve({
        success: false,
        message: err.message || 'Login failed'
      });
    });
  });
});

// ─── IPC: Upload to GitHub ─────────────────────────────────────────────────
ipcMain.handle('upload-to-github', async (event, { folderPath, repoName, isPrivate }) => {
  const send = (type, message) => {
    event.sender.send('log', { type, message });
  };

  const run = (cmd, cwd) =>
    new Promise((resolve, reject) => {
      exec(cmd, { cwd: cwd || folderPath, shell: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || stdout || err.message));
        else resolve((stdout || '').trim());
      });
    });

  try {
    // ── 1. Validate folder ───────────────────────────────────────────────
    if (!fs.existsSync(folderPath)) {
      send('error', `Folder not found: ${folderPath}`);
      return { success: false };
    }
    send('info', `📁 Folder: ${folderPath}`);

    // ── 2. Check gh is installed ─────────────────────────────────────────
    send('info', '🔍 Checking GitHub CLI...');
    try {
      await run('gh --version', os.homedir());
      send('success', 'GitHub CLI found.');
    } catch {
      send('error', 'GitHub CLI (gh) not found. Install it from https://cli.github.com/');
      return { success: false };
    }

    // ── 3. Check gh auth ─────────────────────────────────────────────────
    send('info', '🔐 Verifying GitHub authentication...');
    try {
      const authStatus = await run('gh auth status', os.homedir());
      const userMatch = authStatus.match(/Logged in to [^\s]+ account ([^\s]+)/);
      const username = userMatch ? userMatch[1] : 'your account';
      send('success', `Authenticated as ${username}`);
    } catch (e) {
      send('error', 'Not authenticated with GitHub CLI. Run: gh auth login');
      return { success: false };
    }

    // ── 4. Write .gitignore if missing ───────────────────────────────────
    const gitignorePath = path.join(folderPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      send('info', '📝 Creating .gitignore...');
      const gitignoreContent = [
        '# Dependencies',
        'node_modules/',
        'vendor/',
        '',
        '# Environment variables',
        '.env',
        '.env.local',
        '.env.*.local',
        '',
        '# Build output',
        'dist/',
        'build/',
        'out/',
        '.next/',
        '.nuxt/',
        '',
        '# Logs',
        'logs/',
        '*.log',
        'npm-debug.log*',
        'yarn-debug.log*',
        '',
        '# OS files',
        '.DS_Store',
        'Thumbs.db',
        'desktop.ini',
        '',
        '# IDE / editor',
        '.vscode/',
        '.idea/',
        '*.swp',
        '*.swo',
        '',
        '# Python',
        '__pycache__/',
        '*.pyc',
        '*.pyo',
        '.venv/',
        'venv/',
        '',
        '# Cache',
        '.cache/',
        '.parcel-cache/',
        '',
      ].join('\n');
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
      send('success', '.gitignore created.');
    } else {
      send('info', '.gitignore already exists — skipping.');
    }

    // ── 5. Init git repo if needed ───────────────────────────────────────
    const gitDir = path.join(folderPath, '.git');
    if (!fs.existsSync(gitDir)) {
      send('info', '🔧 Initializing git repository...');
      await run('git init');
      await run('git checkout -b main || git branch -m main');
      send('success', 'Git repository initialized with branch: main');
    } else {
      send('info', 'Git repository already initialized.');
      // Ensure we are on main branch
      try {
        const currentBranch = await run('git branch --show-current');
        send('info', `Current branch: ${currentBranch || 'main'}`);
      } catch {}
    }

    // ── 6. Detect default branch ─────────────────────────────────────────
    let defaultBranch = 'main';
    try {
      const branch = await run('git branch --show-current');
      if (branch) defaultBranch = branch;
    } catch {}
    send('info', `🌿 Default branch: ${defaultBranch}`);

    // ── 7. Stage all files ───────────────────────────────────────────────
    send('info', '📦 Staging files...');
    await run('git add -A');
    send('success', 'All files staged.');

    // ── 8. Commit ────────────────────────────────────────────────────────
    send('info', '💾 Committing...');
    try {
      await run('git diff --cached --quiet');
      send('info', 'Nothing to commit — working tree clean. Skipping commit.');
    } catch {
      // There are staged changes — commit them
      try {
        await run('git -c user.email="uploader@github-uploader.app" -c user.name="GitHub Uploader" commit -m "Initial commit via GitHub Uploader"');
        send('success', 'Committed: "Initial commit via GitHub Uploader"');
      } catch (e) {
        if (e.message && e.message.includes('nothing to commit')) {
          send('info', 'Nothing new to commit — skipping.');
        } else {
          throw e;
        }
      }
    }

    // ── 9. Create GitHub repo ─────────────────────────────────────────────
    send('info', `🚀 Creating GitHub repository "${repoName}"...`);
    const visibilityFlag = isPrivate ? '--private' : '--public';
    let repoUrl = '';
    try {
      const createOutput = await run(
        `gh repo create "${repoName}" ${visibilityFlag} --source=. --remote=origin --push`,
        folderPath
      );
      // Extract URL from output
      const urlMatch = createOutput.match(/https:\/\/github\.com\/[^\s]+/);
      repoUrl = urlMatch ? urlMatch[0] : '';
      send('success', `Repository created: ${repoUrl || repoName}`);
      send('success', '✅ Code pushed successfully!');
      saveRecentFolder(folderPath);
      return { success: true, repoUrl };
    } catch (createErr) {
      const msg = createErr.message || '';

      // Repo already exists — try just adding remote & pushing
      if (msg.includes('already exists') || msg.includes('Name already exists')) {
        send('warn', `Repository "${repoName}" already exists. Attempting to push to existing repo...`);

        // Get GitHub username
        let ghUser = '';
        try {
          ghUser = await run('gh api user --jq .login', os.homedir());
        } catch {}

        repoUrl = ghUser ? `https://github.com/${ghUser}/${repoName}` : '';

        // Set or update remote
        try {
          const remotes = await run('git remote');
          if (remotes.includes('origin')) {
            await run(`git remote set-url origin ${repoUrl}.git`);
          } else {
            await run(`git remote add origin ${repoUrl}.git`);
          }
        } catch {}

        // Push
        await run(`git push -u origin ${defaultBranch}`);
        send('success', `Pushed to existing repo: ${repoUrl}`);
        send('success', '✅ Code pushed successfully!');
        saveRecentFolder(folderPath);
        return { success: true, repoUrl };
      }

      throw createErr;
    }
  } catch (err) {
    send('error', `❌ Error: ${err.message || String(err)}`);
    return { success: false };
  }
});
