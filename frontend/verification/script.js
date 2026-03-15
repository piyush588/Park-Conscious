// Error Handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error("Global Error:", msg, error);
  // Only show toast for relevant errors
  if (msg.toLowerCase().includes('tesseract') || msg.toLowerCase().includes('camera')) {
    if (typeof showToast === 'function') showToast("System Error: " + msg, "error");
  }
  return false;
};

// State
let stream = null;
let history = [];
let isScanning = false;
let detectedPlate = null;
let autoScanActive = true;
let lastCapturedPlate = null;
let lastCaptureTime = 0;
const AUTO_SCAN_COOLDOWN = 10000; // 10 seconds cooldown between same plate logs
const STABILITY_THRESHOLD = 2; // Number of consecutive frames required for a "lock"
let currentStabilityCount = 0;
let lastDraftPlate = null;

console.log("Scanner Logic Initialized");

// DOM Elements
const video = document.getElementById('camera-video');
const canvas = document.getElementById('scan-canvas');
const ctx = canvas.getContext('2d');
const scanBtn = document.getElementById('scan-btn');
const scanIcon = document.getElementById('scan-icon');
const processingIcon = document.getElementById('processing-icon');
const resultCard = document.getElementById('result-card');
const detectedText = document.getElementById('detected-text');
const scanLine = document.getElementById('scan-line');
const loadingCamera = document.getElementById('loading-camera');
const tabScan = document.getElementById('tab-scan');
const tabHistory = document.getElementById('tab-history');
const btnTabScan = document.getElementById('btn-tab-scan');
const btnTabHistory = document.getElementById('btn-tab-history');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const emptyHistory = document.getElementById('empty-history');

// Regex
const PLATE_REGEX_STRICT = /[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}/;
const PLATE_REGEX_RELAXED = /[A-Z]{2}[0-9O]{1,2}[A-Z]{1,2}[0-9O]{1,4}/;

// Init
async function init() {
  console.log("Initializing Scanner App...");
  loadHistory();
  
  // Ensure we switch tab even if camera fails
  switchTab('scan'); 
  
  try {
    await startCamera();
    lucide.createIcons();
    console.log("Camera started successfully");
    
    // Start automatic scanning loop
    setTimeout(autoScanLoop, 2000); // Give camera a moment to stabilize
  } catch (e) {
    console.error("Init failure:", e);
    showToast("Initialization failed", "error");
  }
}

async function autoScanLoop() {
  if (autoScanActive && !isScanning && !detectedPlate && tabScan && tabScan.classList.contains('active-tab')) {
    if (video && video.readyState >= 2) { 
        await triggerScan(true);
    }
  }
  
  // Use a simpler loop to avoid memory/stack issues
  setTimeout(autoScanLoop, 1200); 
}

// Camera
async function startCamera() {
  try {
    // Check if mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media Capture API not supported in this browser");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 }, // Slightly lower resolution for better performance on mobile OCR
        height: { ideal: 720 }
      }
    });
    
    if (video) {
        video.srcObject = stream;
        // Wait for video to be ready before hiding loader
        video.onloadedmetadata = () => {
            console.log("Video metadata loaded:", video.videoWidth, "x", video.videoHeight);
            loadingCamera.classList.add('hidden');
            scanLine.classList.remove('hidden');
        };
    }
  } catch (err) {
    console.error("Camera error:", err);
    if (loadingCamera) {
        loadingCamera.innerHTML = `<div class="flex flex-col items-center gap-2">
            <i data-lucide="camera-off" class="h-8 w-8 text-red-500"></i>
            <span class="text-red-500 font-bold">Camera unavailable</span>
            <button onclick="location.reload()" class="mt-2 bg-accent text-white px-4 py-1 rounded-full text-xs">Retry</button>
        </div>`;
        lucide.createIcons();
    }
    showToast("Camera access denied", "error");
  }
}

// Tabs
window.switchTab = function (tab) {
  if (tab === 'scan') {
    tabScan.classList.remove('hidden');
    tabScan.classList.add('active-tab');
    tabHistory.classList.add('hidden');
    tabHistory.classList.remove('active-tab');

    // Active Styles
    btnTabScan.classList.add('bg-primary', 'text-accent');
    btnTabScan.classList.remove('text-muted-foreground');

    btnTabHistory.classList.remove('bg-primary', 'text-accent');
    btnTabHistory.classList.add('text-muted-foreground');
  } else {
    tabScan.classList.add('hidden');
    tabScan.classList.remove('active-tab');
    tabHistory.classList.remove('hidden');
    tabHistory.classList.add('active-tab');
    renderHistory();

    // Active Styles
    btnTabHistory.classList.add('bg-primary', 'text-accent');
    btnTabHistory.classList.remove('text-muted-foreground');

    btnTabScan.classList.remove('bg-primary', 'text-accent');
    btnTabScan.classList.add('text-muted-foreground');
  }
  lucide.createIcons();
};

// Scan Logic
// Toast
function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  // Classes
  let bgClass = 'bg-card/90';
  let borderClass = 'border-white/10';
  let textClass = 'text-foreground';

  if (type === 'error') {
    bgClass = 'bg-destructive/90';
    textClass = 'text-white';
  } else if (type === 'success') {
    bgClass = 'bg-accent/90';
    textClass = 'text-background font-bold';
  }

  toast.className = `glass-panel ${bgClass} ${borderClass} ${textClass} px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-auto`;
  toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info')}" class="h-5 w-5"></i>
        <span class="text-sm">${message}</span>
    `;

  container.appendChild(toast);
  lucide.createIcons();

  // Remove after 3s
  setTimeout(() => {
    toast.classList.add('fade-out', 'slide-out-to-top-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.triggerScan = async function (arg) {
  const isAuto = arg === true;
  if (isScanning) return;

  if (typeof Tesseract === 'undefined') {
      if (!isAuto) showToast("OCR Engine loading...", "default");
      return;
  }

  if (video.readyState < 2) {
      if (!isAuto) showToast("Camera not ready", "error");
      return;
  }

  // UI Loading (only show icon change if manual or high confidence)
  isScanning = true;
  if (!isAuto) {
    scanBtn.disabled = true;
    scanIcon.classList.add('hidden');
    processingIcon.classList.remove('hidden');
  }

  // Visual scan line pulse
  scanLine.classList.add('scanning-active');

  // Capture
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  ctx.drawImage(video, 0, 0);
  
  if (isAuto) console.log("Auto-scanning frame...");
  else console.log("Manual scan triggered...");

  // OCR
  try {
    const { data: { text } } = await Tesseract.recognize(canvas, "eng", {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    });

    const cleanText = text.replace(/[^A-Z0-9]/g, "");
    let match = cleanText.match(PLATE_REGEX_STRICT);

    if (!match) {
      let possibleMap = cleanText.match(PLATE_REGEX_RELAXED);
      if (possibleMap) match = [possibleMap[0]];
    }

    if (match) {
      const currentPlate = match[0];
      console.log("Plate Candidate:", currentPlate, "Confidence:", match.index);
      
      // Manual scan shows result IMMEDIATELY
      if (!isAuto) {
          detectedPlate = currentPlate;
          showResult(currentPlate);
          showToast("Detected: " + currentPlate, "success");
          return;
      }

      // Stability check for AUTO-SCAN ONLY
      if (currentPlate === lastDraftPlate) {
        currentStabilityCount++;
      } else {
        lastDraftPlate = currentPlate;
        currentStabilityCount = 1;
      }

      if (currentStabilityCount >= STABILITY_THRESHOLD) {
        // Cooldown check for automatic logging
        const now = Date.now();
        if (currentPlate === lastCapturedPlate && (now - lastCaptureTime) < AUTO_SCAN_COOLDOWN) {
          console.log("Plate in cooldown:", currentPlate);
        } else {
          detectedPlate = currentPlate;
          showResult(currentPlate);
          showToast("AI Auto-Scan: " + currentPlate, "success");
        }
        currentStabilityCount = 0;
      }
    } else {
      currentStabilityCount = 0;
      lastDraftPlate = null;
    }

    // Fallback for manual scan only
    if (!isAuto && !match && cleanText.length > 3) {
      detectedPlate = cleanText;
      showResult(cleanText + "?");
      showToast("Low confidence scan", "default");
    } else if (!isAuto && !match) {
      showToast("No plate detected", "error");
    }

  } catch (err) {
    console.error(err);
    if (!isAuto) showToast("Scanner failed", "error");
  } finally {
    isScanning = false;
    scanLine.classList.remove('scanning-active');
    if (!isAuto) {
      scanBtn.disabled = false;
      scanIcon.classList.remove('hidden');
      processingIcon.classList.add('hidden');
    }
  }
};

function showResult(text) {
  detectedText.textContent = text;
  resultCard.classList.remove('hidden');
  scanLine.classList.add('hidden'); // Pause scanning visual
}

window.resetScan = function () {
  resultCard.classList.add('hidden');
  scanLine.classList.remove('hidden');
  detectedPlate = null;
};

window.saveScan = function () {
  if (!detectedPlate) return;

  const newEntry = {
    id: Math.random().toString(36).substr(2, 9),
    plateNumber: detectedPlate.replace("?", ""),
    timestamp: new Date().toISOString()
  };

  // Update cooldown tracking
  lastCapturedPlate = newEntry.plateNumber;
  lastCaptureTime = Date.now();

  history.unshift(newEntry);
  saveHistory();

  // UI Feedback
  showToast("Scan saved successfully", "success");
  resetScan();
};

// History Logic
function loadHistory() {
  const saved = localStorage.getItem("plateseeker_history");
  if (saved) {
    try {
      history = JSON.parse(saved);
    } catch (e) { console.error(e); }
  }
}

function saveHistory() {
  localStorage.setItem("plateseeker_history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyCount.textContent = `${history.length} records captured`;

  // Clear list except empty state
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.appendChild(emptyHistory);
    emptyHistory.style.display = 'flex';
    return;
  }

  emptyHistory.style.display = 'none';

  history.forEach(scan => {
    const date = new Date(scan.timestamp);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const card = document.createElement('div');
    card.className = "bg-card/40 border border-white/5 p-4 rounded-xl flex items-center justify-between hover:bg-card/60 transition-colors";
    card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="bg-accent/10 p-3 rounded-xl border border-accent/20">
                    <i data-lucide="car" class="text-accent h-6 w-6"></i>
                </div>
                <div>
                    <p class="text-xl font-mono font-bold tracking-tight text-accent">${scan.plateNumber}</p>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <i data-lucide="calendar" class="h-3 w-3"></i> ${dateStr}
                    </div>
                </div>
            </div>
            <span class="bg-accent/10 text-accent border border-accent/20 px-2 py-1 rounded text-xs">Verified</span>
        `;
    historyList.appendChild(card);
  });
  lucide.createIcons();
}

window.clearHistory = function () {
  if (confirm("Clear all scan history?")) {
    history = [];
    saveHistory();
    showToast("History cleared", "default");
  }
};

// Start
init();
