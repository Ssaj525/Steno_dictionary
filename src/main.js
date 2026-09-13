import './style.css';
import { 
  INITIAL_DATA, 
  HARDCODED_ADMIN_PASS, 
  getSupabaseClient,
  uploadImageToCloudinary 
} from './store.js';

// Global Application State
let dictionaryData = [];
let selectedLetter = 'All';
let searchQuery = '';
let currentView = 'home';
let selectedWordId = null;
let favoriteWordIds = new Set();
let isAdminLoggedIn = sessionStorage.getItem('steno_is_admin') === 'true';
let deletePendingId = null;
let isLoadingData = false;

// Infinite Scroll Pagination State
const PAGE_SIZE = 50;
let displayedCount = PAGE_SIZE;

// Camera Stream State for Live Viewfinder
let activeCameraStream = null;
let capturedBlob = null;

// SVG Icons
const ICONS = {
  heartOutline: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  heartFilled: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
  search: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`,
  admin: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  loadFavorites();
  fetchLiveSupabaseData();
  setupInfiniteScroll();
});

// Fetch Real Data directly from Supabase Database
async function fetchLiveSupabaseData() {
  isLoadingData = true;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('steno_dictionary')
        .select('*')
        .order('english_meaning', { ascending: true });

      if (error) throw error;
      dictionaryData = data || [];
    } catch (err) {
      console.warn('Supabase database empty or table pending creation:', err);
      dictionaryData = [...INITIAL_DATA];
    }
  } else {
    dictionaryData = [...INITIAL_DATA];
  }

  isLoadingData = false;
  dictionaryData.sort((a, b) => a.english_meaning.localeCompare(b.english_meaning));
  renderApp();
}

function loadFavorites() {
  const favs = localStorage.getItem('steno_favs');
  if (favs) {
    try {
      favoriteWordIds = new Set(JSON.parse(favs));
    } catch (e) {}
  }
}

function saveFavorites() {
  localStorage.setItem('steno_favs', JSON.stringify(Array.from(favoriteWordIds)));
}

function getWordOfTheDay() {
  if (dictionaryData.length === 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = (hash << 5) - hash + todayStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % dictionaryData.length;
  return dictionaryData[index];
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function showDeleteModal(id) {
  deletePendingId = id;
  const item = dictionaryData.find(w => w.id.toString() === id.toString());
  if (!item) return;

  let modal = document.getElementById('custom-delete-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'custom-delete-modal';
    modal.className = 'custom-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="custom-modal-box">
      <div class="modal-title">Delete Word Entry</div>
      <div class="modal-desc">
        Are you sure you want to permanently delete <strong>"${escapeHtml(item.english_meaning)}"</strong>?
      </div>
      <div class="modal-actions">
        <button id="modal-cancel-btn" class="btn-cancel">Cancel</button>
        <button id="modal-confirm-btn" class="btn-danger">Delete</button>
      </div>
    </div>
  `;

  document.getElementById('modal-cancel-btn').onclick = () => {
    modal.remove();
    deletePendingId = null;
  };

  document.getElementById('modal-confirm-btn').onclick = async () => {
    await confirmDeleteWord(deletePendingId);
    modal.remove();
  };
}

async function confirmDeleteWord(id) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('steno_dictionary')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }
  }

  dictionaryData = dictionaryData.filter(w => w.id.toString() !== id.toString());
  showToast('Word deleted successfully!');
  if (currentView === 'detail') currentView = 'home';
  renderApp();
}

function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    if (currentView !== 'home') return;
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
      const filteredLength = getFilteredWords().length;
      if (displayedCount < filteredLength) {
        displayedCount += PAGE_SIZE;
        updateWordListDOM();
      }
    }
  });
}

function getFilteredWords() {
  return dictionaryData.filter(item => {
    if (selectedLetter === 'All') return true;
    if (selectedLetter === '⭐') return favoriteWordIds.has(item.id.toString());
    return item.english_meaning.toUpperCase().startsWith(selectedLetter);
  });
}

function stopCameraStream() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
    activeCameraStream = null;
  }
}

function renderApp() {
  stopCameraStream();
  const app = document.getElementById('app');

  if (currentView === 'search') {
    app.innerHTML = renderSearchPage();
    bindSearchEvents();
  } else if (currentView === 'detail') {
    app.innerHTML = renderDetailPage();
    bindDetailEvents();
  } else if (currentView === 'admin') {
    app.innerHTML = renderAdminPage();
    bindAdminEvents();
  } else {
    app.innerHTML = renderHomePage();
    bindHomeEvents();
  }
}

// ----------------------------------------------------
// 1. HOME PAGE
// ----------------------------------------------------
function renderHomePage() {
  const alphabet = ['All', '⭐', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  const wod = getWordOfTheDay();
  const allFiltered = getFilteredWords();

  return `
    <div class="top-header">
      <div class="brand-wrapper">
        <div class="brand-title">
          <h1>Pitman Shorthand</h1>
          <p>A modern steno dictionary</p>
        </div>
      </div>
      ${isAdminLoggedIn ? `
        <button id="logout-admin-btn" class="icon-btn pink" title="Logout Admin">
          ${ICONS.logout}
        </button>
      ` : ''}
    </div>

    ${wod ? `
      <div class="wod-card-container" data-id="${wod.id}">
        <div class="wod-badge-header">
          ${ICONS.star} WORD OF THE DAY
        </div>
        <img class="wod-img-rectangle" src="${wod.image_url}" alt="${wod.english_meaning} stroke" />
        <div class="wod-word-name">${escapeHtml(wod.english_meaning)}</div>
      </div>
    ` : ''}

    <div class="alphabet-bar">
      ${alphabet.map(letter => `
        <button 
          class="alpha-btn ${letter === '⭐' ? 'fav-star' : ''} ${selectedLetter === letter ? 'active' : ''}" 
          data-letter="${letter}">
          ${letter === '⭐' ? ICONS.star : letter}
        </button>
      `).join('')}
    </div>

    <div style="padding: 0 1.25rem 0.5rem 1.25rem; font-weight: 800; font-size: 0.9rem;">
      ${selectedLetter === '⭐' ? 'Favorite Words' : 'Words List'} (${allFiltered.length})
    </div>

    <div id="word-fast-list-container" class="word-fast-list">
      ${isLoadingData ? `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">Fetching live entries from Supabase...</div>
      ` : renderWordRowsHtml(allFiltered.slice(0, displayedCount))}
    </div>

    ${renderBottomNav('home')}
  `;
}

function renderWordRowsHtml(words) {
  if (words.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        ${selectedLetter === '⭐' ? 'No favorite words saved yet' : 'No words found'}
      </div>
    `;
  }

  return words.map(item => `
    <div class="word-list-row" data-id="${item.id}">
      <div class="word-row-text">${escapeHtml(item.english_meaning)}</div>
      <div class="word-row-actions">
        <button class="fav-btn ${favoriteWordIds.has(item.id.toString()) ? 'active' : ''}" data-fav-id="${item.id}">
          ${favoriteWordIds.has(item.id.toString()) ? ICONS.heartFilled : ICONS.heartOutline}
        </button>
        ${isAdminLoggedIn ? `
          <button class="icon-btn pink" data-del-id="${item.id}" title="Delete word">
            ${ICONS.trash}
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function updateWordListDOM() {
  const container = document.getElementById('word-fast-list-container');
  if (container) {
    const allFiltered = getFilteredWords();
    container.innerHTML = renderWordRowsHtml(allFiltered.slice(0, displayedCount));
    bindHomeRowEvents();
  }
}

function bindHomeEvents() {
  document.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.onclick = (e) => {
      selectedLetter = e.currentTarget.getAttribute('data-letter');
      displayedCount = PAGE_SIZE;
      renderApp();
    };
  });

  document.querySelector('.wod-card-container')?.addEventListener('click', () => {
    const wod = getWordOfTheDay();
    if (wod) {
      selectedWordId = wod.id;
      currentView = 'detail';
      renderApp();
    }
  });

  document.getElementById('logout-admin-btn')?.addEventListener('click', () => {
    isAdminLoggedIn = false;
    sessionStorage.removeItem('steno_is_admin');
    showToast('Logged out');
    renderApp();
  });

  bindHomeRowEvents();
  bindNavEvents();
}

function bindHomeRowEvents() {
  document.querySelectorAll('.word-list-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('.fav-btn') || e.target.closest('[data-del-id]')) return;
      selectedWordId = row.getAttribute('data-id');
      currentView = 'detail';
      renderApp();
    };
  });

  document.querySelectorAll('[data-fav-id]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-fav-id').toString();
      if (favoriteWordIds.has(id)) {
        favoriteWordIds.delete(id);
        showToast('Removed from favorites');
      } else {
        favoriteWordIds.add(id);
        showToast('Added to favorites');
      }
      saveFavorites();
      renderApp();
    };
  });

  document.querySelectorAll('[data-del-id]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-del-id');
      showDeleteModal(id);
    };
  });
}

// ----------------------------------------------------
// 2. STANDALONE SEARCH PAGE
// ----------------------------------------------------
function renderSearchPage() {
  const matches = searchQuery.trim() === '' ? [] : dictionaryData.filter(w => 
    w.english_meaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return `
    <div class="search-page">
      <div class="search-input-wrapper">
        <input 
          type="text" 
          id="search-box-input" 
          class="search-page-input" 
          placeholder="Search word..." 
          value="${escapeHtml(searchQuery)}"
        />
        ${searchQuery ? `
          <button id="clear-search-btn" class="clear-search-btn" title="Clear search">
            ${ICONS.close}
          </button>
        ` : ''}
      </div>

      <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 0.75rem;">
        Search Results (${matches.length})
      </div>

      <div id="search-results-list" class="word-fast-list">
        ${renderSearchRowsHtml(matches)}
      </div>
    </div>
    ${renderBottomNav('search')}
  `;
}

function renderSearchRowsHtml(matches) {
  if (searchQuery.trim() === '') {
    return `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Type to search...</div>`;
  }
  if (matches.length === 0) {
    return `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No matching words found</div>`;
  }
  return matches.slice(0, 100).map(item => `
    <div class="word-list-row" data-id="${item.id}">
      <div class="word-row-text">${escapeHtml(item.english_meaning)}</div>
      <div style="color: var(--accent-pink); font-weight: 700; font-size: 0.85rem;">View Stroke →</div>
    </div>
  `).join('');
}

function bindSearchEvents() {
  const input = document.getElementById('search-box-input');
  if (input) {
    const val = input.value;
    input.value = '';
    input.value = val;
    input.focus();

    input.oninput = (e) => {
      searchQuery = e.target.value;
      const matches = searchQuery.trim() === '' ? [] : dictionaryData.filter(w => 
        w.english_meaning.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const wrapper = document.querySelector('.search-input-wrapper');
      let clearBtn = document.getElementById('clear-search-btn');
      if (searchQuery && !clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.id = 'clear-search-btn';
        clearBtn.className = 'clear-search-btn';
        clearBtn.innerHTML = ICONS.close;
        wrapper.appendChild(clearBtn);
        clearBtn.onclick = clearSearch;
      } else if (!searchQuery && clearBtn) {
        clearBtn.remove();
      }

      document.querySelector('.search-page > div:nth-child(2)').textContent = `Search Results (${matches.length})`;
      document.getElementById('search-results-list').innerHTML = renderSearchRowsHtml(matches);
      bindSearchResultClicks();
    };
  }

  document.getElementById('clear-search-btn')?.addEventListener('click', clearSearch);

  bindSearchResultClicks();
  bindNavEvents();
}

function clearSearch() {
  searchQuery = '';
  renderApp();
}

function bindSearchResultClicks() {
  document.querySelectorAll('#search-results-list .word-list-row').forEach(row => {
    row.onclick = () => {
      selectedWordId = row.getAttribute('data-id');
      currentView = 'detail';
      renderApp();
    };
  });
}

// ----------------------------------------------------
// 3. WORD DETAIL PAGE
// ----------------------------------------------------
function renderDetailPage() {
  const item = dictionaryData.find(w => w.id.toString() === selectedWordId.toString()) || dictionaryData[0];

  return `
    <div class="detail-page">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <button id="back-btn" class="icon-btn" style="background: white; box-shadow: var(--shadow-soft);">
          ${ICONS.back}
        </button>
        <div style="font-weight: 800; font-size: 1rem;">Steno Word Detail</div>
        ${isAdminLoggedIn ? `
          <button id="detail-delete-btn" class="icon-btn pink" title="Delete Word">
            ${ICONS.trash}
          </button>
        ` : '<div></div>'}
      </div>

      <div class="detail-card-main">
        <img class="detail-img-box" src="${item.image_url}" alt="${item.english_meaning} stroke photo" loading="lazy" />
        <h1 class="detail-word-heading">${escapeHtml(item.english_meaning)}</h1>
      </div>
    </div>
  `;
}

function bindDetailEvents() {
  document.getElementById('back-btn')?.addEventListener('click', () => {
    currentView = 'home';
    renderApp();
  });

  document.getElementById('detail-delete-btn')?.addEventListener('click', () => {
    showDeleteModal(selectedWordId);
  });
}

// ----------------------------------------------------
// 4. ADMIN PAGE (Inserts into Supabase + Cloudinary)
// ----------------------------------------------------
function renderAdminPage() {
  if (!isAdminLoggedIn) {
    return `
      <div class="admin-page" style="padding: 1.25rem;">
        <div class="form-card" style="text-align: center; padding: 2rem 1.25rem;">
          <h2 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">Admin Login</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem;">
            Enter admin password to insert or delete words.
          </p>
          <form id="login-form">
            <div class="form-group">
              <input type="password" id="admin-pass-input" class="form-control" placeholder="Enter Admin Password" required />
            </div>
            <button type="submit" class="btn-primary">Login as Admin</button>
          </form>
        </div>
      </div>
      ${renderBottomNav('admin')}
    `;
  }

  return `
    <div class="admin-page" style="padding: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="font-size: 1.2rem; font-weight: 800;">Add New Word</h2>
        <button id="admin-logout-btn" class="icon-btn pink" title="Logout Admin">
          ${ICONS.logout}
        </button>
      </div>

      <div class="form-card">
        <form id="add-word-form">
          <div class="form-group">
            <label>English Meaning *</label>
            <input type="text" id="word-meaning" class="form-control" placeholder="e.g. Account" required />
          </div>

          <div class="form-group">
            <label>Stroke Photo *</label>
            <input type="file" id="word-file" class="form-control" accept="image/*" />
            <button type="button" id="trigger-cam-btn" class="cam-option-btn">
              ${ICONS.camera} Open Camera Viewfinder
            </button>
            <img id="cam-snapshot-preview" style="display: none; width: 100%; height: 160px; object-fit: contain; border-radius: 12px; margin-top: 8px; border: 1px solid #e2e8f0;" />
          </div>

          <button type="submit" id="save-btn" class="btn-primary" style="margin-top: 0.5rem;">
            Save Word
          </button>
        </form>
      </div>
    </div>

    <!-- Live Camera Viewfinder Modal -->
    <div id="camera-modal" class="custom-modal-overlay" style="display: none;">
      <div class="custom-modal-box" style="max-width: 420px; padding: 1.25rem;">
        <div class="modal-title" style="margin-bottom: 0.5rem;">Camera Viewfinder</div>
        <video id="camera-video" autoplay playsinline style="width: 100%; height: 240px; background: #000; border-radius: 12px; object-fit: cover;"></video>
        <canvas id="camera-canvas" style="display: none;"></canvas>
        <div class="modal-actions" style="margin-top: 1rem;">
          <button type="button" id="close-cam-btn" class="btn-cancel">Close</button>
          <button type="button" id="capture-snap-btn" class="btn-primary" style="flex: 1;">Snap Photo 📸</button>
        </div>
      </div>
    </div>

    ${renderBottomNav('admin')}
  `;
}

function bindAdminEvents() {
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === HARDCODED_ADMIN_PASS) {
      isAdminLoggedIn = true;
      sessionStorage.setItem('steno_is_admin', 'true');
      showToast('Admin logged in successfully!');
      renderApp();
    } else {
      showToast('Incorrect Admin Password!');
    }
  });

  document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
    isAdminLoggedIn = false;
    sessionStorage.removeItem('steno_is_admin');
    showToast('Logged out');
    renderApp();
  });

  document.getElementById('trigger-cam-btn')?.addEventListener('click', async () => {
    const camModal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');

    try {
      activeCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = activeCameraStream;
      camModal.style.display = 'flex';
    } catch (err) {
      showToast('Camera access blocked. Using file picker.');
      document.getElementById('word-file').click();
    }
  });

  document.getElementById('close-cam-btn')?.addEventListener('click', () => {
    stopCameraStream();
    document.getElementById('camera-modal').style.display = 'none';
  });

  document.getElementById('capture-snap-btn')?.addEventListener('click', () => {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      capturedBlob = blob;
      const preview = document.getElementById('cam-snapshot-preview');
      preview.src = URL.createObjectURL(blob);
      preview.style.display = 'block';
      showToast('Photo captured successfully!');
    }, 'image/jpeg', 0.9);

    stopCameraStream();
    document.getElementById('camera-modal').style.display = 'none';
  });

  document.getElementById('add-word-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-btn');
    const meaning = document.getElementById('word-meaning').value.trim();
    const fileInput = document.getElementById('word-file');

    let fileToUpload = capturedBlob ? new File([capturedBlob], `${meaning}.jpg`, { type: 'image/jpeg' }) : fileInput.files[0];

    if (!fileToUpload) {
      showToast('Please select a photo or snap a picture via camera!');
      return;
    }

    saveBtn.textContent = 'Uploading to Cloudinary...';
    saveBtn.disabled = true;

    try {
      // 1. Upload image to Cloudinary CDN
      const imageUrl = await uploadImageToCloudinary(fileToUpload);

      // 2. Insert text & image URL directly into Supabase database
      const supabase = getSupabaseClient();
      let newId = Date.now().toString();

      if (supabase) {
        const { data, error } = await supabase
          .from('steno_dictionary')
          .insert([{
            english_meaning: meaning,
            image_url: imageUrl
          }])
          .select();

        if (error) {
          console.warn('Supabase insert warning:', error);
        } else if (data && data[0]) {
          newId = data[0].id;
        }
      }

      const newItem = {
        id: newId,
        english_meaning: meaning,
        image_url: imageUrl
      };

      dictionaryData.unshift(newItem);
      dictionaryData.sort((a, b) => a.english_meaning.localeCompare(b.english_meaning));
      capturedBlob = null;

      showToast('Word saved directly to Supabase & Cloudinary!');
      currentView = 'home';
      renderApp();
    } catch (err) {
      showToast(`${err.message}`);
    } finally {
      saveBtn.textContent = 'Save Word';
      saveBtn.disabled = false;
    }
  });

  bindNavEvents();
}

// ----------------------------------------------------
// BOTTOM NAVIGATION BAR
// ----------------------------------------------------
function renderBottomNav(activeTab) {
  return `
    <div class="bottom-nav">
      <button class="nav-item ${activeTab === 'home' ? 'active' : ''}" data-target="home">
        ${ICONS.home}
        Home
      </button>

      <button class="nav-fab-btn" data-target="search" title="Search Words">
        ${ICONS.search}
      </button>

      <button class="nav-item ${activeTab === 'admin' ? 'active' : ''}" data-target="admin">
        ${ICONS.admin}
        Admin
      </button>
    </div>
  `;
}

function bindNavEvents() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.onclick = (e) => {
      currentView = e.currentTarget.getAttribute('data-target');
      displayedCount = PAGE_SIZE;
      renderApp();
    };
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}
