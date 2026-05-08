/* ── State ─────────────────────────────────────────────────────── */
let selectedFiles = null;
let isUploading = false;
let isAuthenticated = false;

/* ── DOM Refs ──────────────────────────────────────────────────── */
const loginOverlay   = document.getElementById('loginOverlay');
const loginStatus    = document.getElementById('loginStatus');
const loginBtn       = document.getElementById('loginBtn');
const installNotice  = document.getElementById('installNotice');
const dropZone       = document.getElementById('dropZone');
const dropOverlay    = document.getElementById('dropOverlay');
const selectBtn      = document.getElementById('selectBtn');
const folderDisplay  = document.getElementById('folderDisplay');
const folderPathText = document.getElementById('folderPathText');
const clearBtn       = document.getElementById('clearBtn');
const repoNameInput  = document.getElementById('repoName');
const visToggle      = document.getElementById('visibilityToggle');
const uploadBtn      = document.getElementById('uploadBtn');
const spinner        = document.getElementById('spinner');
const uploadText     = document.querySelector('.upload-text');
const consoleWrap    = document.getElementById('consoleWrap');
const consoleBody    = document.getElementById('consoleBody');
const consoleClearBtn= document.getElementById('consoleClearBtn');
const successBanner  = document.getElementById('successBanner');
const successUrl     = document.getElementById('successUrl');
const recentsSection = document.getElementById('recentsSection');

// Create hidden file input for folder selection
const folderInput = document.createElement('input');
folderInput.type = 'file';
folderInput.webkitdirectory = true;
folderInput.multiple = true;
folderInput.style.display = 'none';
document.body.appendChild(folderInput);

/* ── Authentication ────────────────────────────────────────────── */
async function checkAuthentication() {
  // Check if we just logged in
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('login') === 'success') {
    // Remove query param
    window.history.replaceState({}, document.title, '/');
  }

  loginOverlay.style.display = 'flex';
  loginStatus.style.display = 'flex';
  loginBtn.style.display = 'none';
  installNotice.style.display = 'none';

  const statusIcon = loginStatus.querySelector('.status-icon');
  const statusText = loginStatus.querySelector('.status-text');

  statusText.textContent = 'Checking authentication...';

  try {
    const response = await fetch('/api/auth/status');
    const authResult = await response.json();

    if (authResult.authenticated) {
      // Successfully authenticated
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/>
        </svg>
      `;
      statusIcon.style.color = 'var(--accent)';
      statusText.textContent = `Authenticated as ${authResult.username}`;

      // Hide login screen after brief delay
      setTimeout(() => {
        loginOverlay.style.display = 'none';
        isAuthenticated = true;
      }, 800);
      return;
    }

    // Not authenticated - show login button
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1v6m0 6v6m6-9h-6m-6 0h6"/>
      </svg>
    `;
    statusIcon.style.color = 'var(--yellow)';
    statusText.textContent = 'Not authenticated with GitHub';
    loginBtn.style.display = 'flex';
  } catch (error) {
    statusText.textContent = 'Error checking authentication';
    loginBtn.style.display = 'flex';
  }
}

function handleLogin() {
  const statusIcon = loginStatus.querySelector('.status-icon');
  const statusText = loginStatus.querySelector('.status-text');

  loginBtn.style.display = 'none';
  loginStatus.style.display = 'flex';

  statusIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  `;
  statusIcon.style.color = 'var(--blue)';
  statusText.textContent = 'Opening browser for login...';

  // Get credentials from localStorage
  const clientId = localStorage.getItem('github_client_id');
  const clientSecret = localStorage.getItem('github_client_secret');

  // Redirect to GitHub OAuth with credentials
  window.location.href = `/auth/github?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
}

loginBtn.addEventListener('click', handleLogin);

/* ── Folder Selection ──────────────────────────────────────────── */
function setFolder(files, folderName) {
  selectedFiles = files;
  folderPathText.textContent = folderName;
  dropZone.style.display = 'none';
  folderDisplay.style.display = '';
  successBanner.style.display = 'none';

  // Default repo name = folder's name
  repoNameInput.value = folderName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');

  uploadBtn.disabled = false;
}

function clearFolder() {
  selectedFiles = null;
  dropZone.style.display = '';
  folderDisplay.style.display = 'none';
  repoNameInput.value = '';
  uploadBtn.disabled = true;
  successBanner.style.display = 'none';
}

folderInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    // Get folder name from first file's path
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const folderName = firstPath.split('/')[0];
    setFolder(files, folderName);
  }
});

selectBtn.addEventListener('click', () => {
  folderInput.click();
});

clearBtn.addEventListener('click', clearFolder);

/* ── Drag & Drop ───────────────────────────────────────────────── */
dropZone.addEventListener('click', (e) => {
  if (e.target === selectBtn || e.target.closest('.btn-select')) return;
  folderInput.click();
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('dragleave', (e) => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const items = Array.from(e.dataTransfer.items);

  if (items.length > 0) {
    const item = items[0];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry && entry.isDirectory) {
        const files = await getAllFilesFromDirectory(entry);
        if (files.length > 0) {
          setFolder(files, entry.name);
        }
      }
    }
  }
});

// Helper to read all files from a directory entry
async function getAllFilesFromDirectory(directoryEntry) {
  const files = [];

  async function readEntry(entry, path = '') {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          const fullPath = path + file.name;
          // Create a new file with the relative path
          const fileWithPath = new File([file], fullPath, { type: file.type });
          Object.defineProperty(fileWithPath, 'webkitRelativePath', {
            value: fullPath,
            writable: false
          });
          files.push(fileWithPath);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      return new Promise((resolve) => {
        reader.readEntries(async (entries) => {
          for (const entry of entries) {
            await readEntry(entry, path + directoryEntry.name + '/');
          }
          resolve();
        });
      });
    }
  }

  await readEntry(directoryEntry);
  return files;
}

/* ── Visibility Toggle ─────────────────────────────────────────── */
let isPrivate = false;

visToggle.addEventListener('click', () => {
  isPrivate = !isPrivate;
  visToggle.dataset.private = String(isPrivate);
  const opts = visToggle.querySelectorAll('.toggle-option');
  opts.forEach(opt => opt.classList.remove('active'));
  visToggle.querySelector(`.toggle-option[data-val="${isPrivate ? 'private' : 'public'}"]`).classList.add('active');
});

/* ── Console ───────────────────────────────────────────────────── */
function appendLog(type, message) {
  consoleWrap.style.display = '';
  const line = document.createElement('div');
  line.className = 'log-line';

  const prefixMap = { info: '›', success: '✓', warn: '!', error: '✗' };
  const prefix = document.createElement('span');
  prefix.className = 'log-prefix';
  prefix.textContent = prefixMap[type] || '›';

  const msg = document.createElement('span');
  msg.className = `log-msg ${type}`;
  msg.textContent = message;

  line.appendChild(prefix);
  line.appendChild(msg);
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

consoleClearBtn.addEventListener('click', () => {
  consoleBody.innerHTML = '';
  consoleWrap.style.display = 'none';
});

/* ── Upload ────────────────────────────────────────────────────── */
uploadBtn.addEventListener('click', async () => {
  if (!selectedFiles || isUploading) return;

  const repoName = repoNameInput.value.trim() || 'my-project';
  isUploading = true;
  uploadBtn.classList.add('loading');
  uploadText.textContent = 'Uploading...';
  spinner.style.display = '';
  successBanner.style.display = 'none';
  consoleBody.innerHTML = '';
  consoleWrap.style.display = '';

  try {
    // Create zip file from selected files
    appendLog('info', 'Preparing files for upload...');

    const JSZip = window.JSZip;
    if (!JSZip) {
      // Load JSZip dynamically
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }

    // Filter out unnecessary files and folders
    const filteredFiles = selectedFiles.filter(file => {
      const relativePath = file.webkitRelativePath || file.name;
      const pathLower = relativePath.toLowerCase();

      // Skip these folders/files
      if (pathLower.includes('/node_modules/') ||
          pathLower.includes('/.git/') ||
          pathLower.includes('/.claude/') ||
          pathLower.includes('/dist/') ||
          pathLower.includes('/build/') ||
          pathLower.includes('/.next/') ||
          pathLower.includes('/.nuxt/') ||
          pathLower.includes('/vendor/') ||
          pathLower.includes('/.venv/') ||
          pathLower.includes('/venv/') ||
          pathLower.includes('/__pycache__/') ||
          pathLower.includes('/.cache/') ||
          pathLower.includes('/coverage/') ||
          pathLower.endsWith('.log') ||
          pathLower.endsWith('.pyc') ||
          pathLower.includes('/.ds_store') ||
          pathLower.includes('/thumbs.db')) {
        return false;
      }
      return true;
    });

    if (filteredFiles.length === 0) {
      appendLog('error', 'No files to upload after filtering');
      return;
    }

    if (filteredFiles.length > 2000) {
      appendLog('error', `❌ Too many files: ${filteredFiles.length} files`);
      appendLog('error', 'Maximum 2000 files allowed. Please select a smaller folder.');
      return;
    }

    if (filteredFiles.length > 500) {
      appendLog('warn', `⚠️  Large folder detected (${filteredFiles.length} files)`);
      appendLog('warn', 'This may take 1-2 minutes...');
    }

    appendLog('info', `📦 Preparing ${filteredFiles.length} files (filtered from ${selectedFiles.length})...`);

    const zip = new JSZip();

    // Add files to zip
    for (const file of filteredFiles) {
      const relativePath = file.webkitRelativePath || file.name;
      // Remove the root folder name from the path
      const pathParts = relativePath.split('/');
      const pathWithoutRoot = pathParts.slice(1).join('/');

      if (pathWithoutRoot) {
        zip.file(pathWithoutRoot, file);
      }
    }

    appendLog('info', `Compressing ${filteredFiles.length} files...`);
    let lastReported = 0;
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      const percent = Math.round(metadata.percent);
      // Only report every 20% to reduce log spam
      if (percent - lastReported >= 20 && percent !== 100) {
        appendLog('info', `Compression progress: ${percent}%`);
        lastReported = percent;
      }
    });

    appendLog('success', 'Files compressed successfully');
    appendLog('info', 'Uploading to GitHub...');

    // Upload to server
    const formData = new FormData();
    formData.append('folder', zipBlob, 'folder.zip');
    formData.append('repoName', repoName);
    formData.append('isPrivate', String(isPrivate));

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (response.status === 401) {
        appendLog('error', '❌ Session expired. Please refresh the page and log in again.');
      } else {
        appendLog('error', `❌ Server error (${response.status}). Please try again.`);
      }
      return;
    }

    const result = await response.json();

    if (response.ok && result.success) {
      appendLog('success', '✓ Repository created successfully!');
      appendLog('success', `✓ URL: ${result.repoUrl}`);

      successBanner.style.display = '';
      successUrl.textContent = result.repoUrl;
      successUrl.href = result.repoUrl;
    } else {
      appendLog('error', `❌ Upload failed: ${result.error || 'Unknown error'}`);
      if (result.details) {
        appendLog('error', JSON.stringify(result.details));
      }
    }
  } catch (error) {
    appendLog('error', `Error: ${error.message}`);
    console.error('Upload error:', error);
  } finally {
    isUploading = false;
    uploadBtn.classList.remove('loading');
    uploadText.textContent = 'Upload to GitHub';
    spinner.style.display = 'none';
  }
});

// Helper to load external script
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/* ── Init ──────────────────────────────────────────────────────── */

// Check if user has configured their OAuth credentials
function checkOAuthSetup() {
  const clientId = localStorage.getItem('github_client_id');
  const clientSecret = localStorage.getItem('github_client_secret');

  if (!clientId || !clientSecret) {
    // Redirect to setup page
    window.location.href = '/setup';
    return false;
  }
  return true;
}

// Only proceed if OAuth is configured
if (checkOAuthSetup()) {
  checkAuthentication();
}

// Hide recents section in web version (no local storage of folder paths)
if (recentsSection) {
  recentsSection.style.display = 'none';
}
