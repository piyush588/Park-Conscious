const PARKING_JSON = './assets/data/parkings.json';
// --- Configuration ---
const DEFAULT_LOCATION = { lat: 18.5204, lng: 73.8567 }; // Pune, India
let map;
let userMarker;
let markers = [];
let userPosition = null;
let parkingData = [];

// Utility: Haversine distance in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- Booking Logic (LocalStorage) ---
function saveBooking(booking) {
    const bookings = loadBookings();
    bookings.push(booking);
    localStorage.setItem('park_bookings', JSON.stringify(bookings));
}

function loadBookings() {
    const data = localStorage.getItem('park_bookings');
    return data ? JSON.parse(data) : [];
}

// --- Mock Data Loading ---
async function loadParkingData() {
    // In a real app, fetch from backend API
    // For now, generate mock data around default location
    return new Promise(resolve => {
        setTimeout(() => {
            const mockSpots = [];
            for (let i = 0; i < 50; i++) {
                // Random locations around Pune
                const lat = DEFAULT_LOCATION.lat + (Math.random() - 0.5) * 0.1;
                const lng = DEFAULT_LOCATION.lng + (Math.random() - 0.5) * 0.1;
                mockSpots.push({
                    ID: `P${i + 1}`,
                    Location: `Parking Spot ${i + 1}`,
                    Latitude: lat,
                    Longitude: lng,
                    Type: Math.random() > 0.5 ? 'Covered' : 'Open',
                    PricePerHour: Math.floor(Math.random() * 50) + 20,
                    TotalSlots: Math.floor(Math.random() * 50) + 10,
                    AvailableSlots: Math.floor(Math.random() * 20),
                    Authority: 'Private'
                });
            }
            parkingData = mockSpots;
            resolve(parkingData);
        }, 800);
    });
}

// --- Map Initialization (Leaflet) ---
function initMap() {
    // Initialize Leaflet Map
    map = L.map('map', {
        center: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng],
        zoom: 13,
        zoomControl: false // We can add custom controls if needed
    });

    // Add OpenStreetMap Dark Theme Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Initial render
    getUserLocation(false);

    // Event Listeners
    document.getElementById('locate-btn').addEventListener('click', () => getUserLocation(true));
    document.getElementById('radius-select').addEventListener('change', () => renderNearby());

    // Tab Logic
    const tabNearby = document.getElementById('tab-nearby');
    const tabBookings = document.getElementById('tab-bookings');

    if (tabNearby && tabBookings) {
        tabNearby.addEventListener('click', () => {
            tabNearby.classList.add('border-teal-500', 'text-teal-400');
            tabNearby.classList.remove('border-transparent', 'text-gray-400');
            tabBookings.classList.remove('border-teal-500', 'text-teal-400');
            tabBookings.classList.add('border-transparent', 'text-gray-400');

            const filters = document.querySelector('.p-4.border-b .flex.justify-between');
            if (filters) filters.style.display = 'flex';

            // Show markers again
            markers.forEach(m => m.addTo(map));
            renderNearby();
        });

        tabBookings.addEventListener('click', () => {
            tabBookings.classList.add('border-teal-500', 'text-teal-400');
            tabBookings.classList.remove('border-transparent', 'text-gray-400');
            tabNearby.classList.remove('border-teal-500', 'text-teal-400');
            tabNearby.classList.add('border-transparent', 'text-gray-400');

            const filters = document.querySelector('.p-4.border-b .flex.justify-between');
            if (filters) filters.style.display = 'none';

            // Hide markers
            markers.forEach(m => m.remove());
            renderBookingsList();
        });
    }

    // Basic Search Implementation (Input Enter Key)
    const input = document.getElementById('autocomplete-input');
    if (input) {
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const query = input.value;
                if (!query) return;

                // Use Nominatim for free geocoding
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);

                        userPosition = { lat, lng: lon };
                        map.setView([lat, lon], 14);
                        putUserMarker();
                        renderNearby();
                    } else {
                        alert('Location not found');
                    }
                } catch (err) {
                    console.error('Search error:', err);
                }
            }
        });
    }
}

async function boot() {
    await loadParkingData();
    initMap(); // Leaflet doesn't need a callback script
}

function putUserMarker() {
    if (!userPosition) return;
    if (userMarker) userMarker.remove();

    // Custom Icon for user
    const userIcon = L.divIcon({
        className: 'user-marker-pulse',
        html: '<div style="width: 16px; height: 16px; background: #2dd4bf; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(45, 212, 191, 0.5);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon }).addTo(map);
    userMarker.bindPopup("You are here").openPopup();
}

function renderMarkers(list) {
    // Clear existing markers
    markers.forEach(m => m.remove());
    markers = [];

    list.forEach(item => {
        const marker = L.marker([item.Latitude, item.Longitude]);

        // Popup Content
        const content = `
        <div style="font-family:'Inter', sans-serif; color:#111; min-width: 150px;">
            <strong style="font-size:14px; display:block; margin-bottom:4px; font-family:'Outfit',sans-serif;">${escapeHtml(item.Location)}</strong>
            <div style="color:#666; font-size:12px; margin-bottom:4px;">${escapeHtml(item.Type || '')}</div>
            <div style="font-weight:600; color:#1f40af; margin-bottom:6px; font-size:13px;">${item.PricePerHour ? '₹' + item.PricePerHour + '/hr' : 'Contact'}</div>
            <button class="leaflet-book-btn" data-id="${item.ID}" style="background:#0f766e; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:500; cursor:pointer; width:100%;">Book Spot</button>
        </div>`;

        marker.bindPopup(content);

        marker.on('popupopen', () => {
            // Attach event listener to button inside popup
            const btn = document.querySelector(`.leaflet-book-btn[data-id="${item.ID}"]`);
            if (btn) {
                btn.onclick = () => openBookingModal(item);
            }
        });

        marker.addTo(map);
        markers.push(marker);

        // Add click listener to center map
        marker.on('click', () => {
            map.setView([item.Latitude, item.Longitude], 16);
        });
    });
}

function renderNearby() {
    if (!userPosition) {
        const listEl = document.getElementById('results-list');
        if (listEl) listEl.innerHTML = '<div class="text-center p-6 text-gray-500 text-sm">Location not set. <br>Click "My Location" or search.</div>';
        return;
    }
    const radiusKm = Number(document.getElementById('radius-select').value);

    // Filter logic
    const enriched = parkingData.map(p => {
        const d = haversineDistance(userPosition.lat, userPosition.lng, p.Latitude, p.Longitude);
        return { ...p, distance_km: d };
    });
    const filtered = enriched.filter(p => p.distance_km <= radiusKm).sort((a, b) => a.distance_km - b.distance_km);
    const results = filtered.slice(0, 30);

    const listEl = document.getElementById('results-list');
    listEl.innerHTML = '';

    if (results.length === 0) {
        listEl.innerHTML = '<div class="text-center p-6 text-gray-400">No spots found in this radius.</div>';
    } else {
        results.forEach(p => {
            const el = document.createElement('div');
            // Tailwind glass card
            el.className = 'glass-card rounded-xl p-4 cursor-pointer relative group';
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-white text-base">${escapeHtml(p.Location)}</h4>
                        <div class="text-xs text-gray-400">${escapeHtml(p.Authority || '')}</div>
                    </div>
                    <div class="bg-teal-500/10 text-teal-400 text-xs px-2 py-1 rounded font-medium">
                        ${(p.distance_km).toFixed(1)} km
                    </div>
                </div>
                
                <div class="flex items-center gap-4 my-3 text-sm">
                    <div class="flex items-center text-gray-300">
                        <span class="font-semibold mr-1">${p.PricePerHour ? '₹' + p.PricePerHour : 'Contact'}</span>
                        <span class="text-gray-500 text-xs">/hr</span>
                    </div>
                    <div class="flex items-center text-gray-300">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                        <span class="text-xs">${p.TotalSlots ? p.TotalSlots + ' slots' : 'Open'}</span>
                    </div>
                </div>

                <button class="book-btn w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white border border-blue-500/30 py-2 rounded-lg text-sm font-medium transition-all" data-id="${p.ID}">
                    Book Now
                </button>
            `;
            listEl.appendChild(el);

            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('book-btn')) {
                    map.setView([p.Latitude, p.Longitude], 16);
                    // Open popup for corresponding marker
                    const m = markers.find(marker => marker.getLatLng().lat === p.Latitude && marker.getLatLng().lng === p.Longitude);
                    if (m) m.openPopup();
                }
            });
            el.querySelector('.book-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                openBookingModal(p);
            });
        });
    }

    document.getElementById('results-count').innerText = results.length;
    renderMarkers(results);
}

function renderBookingsList() {
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = '';
    const bookings = loadBookings();

    if (bookings.length === 0) {
        listEl.innerHTML = '<div class="text-center p-6 text-gray-400 text-sm">No active bookings found.</div>';
    } else {
        // Show newest first
        bookings.reverse().forEach(b => {
            const el = document.createElement('div');
            el.className = 'glass-card rounded-xl p-4 relative group mb-3';
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-white text-base">${escapeHtml(b.locationName)}</h4>
                        <div class="text-xs text-teal-400 font-mono mt-1">ID: ${b.id}</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-sm my-3">
                    <div>
                        <div class="text-xs text-gray-500 uppercase font-bold">Time</div>
                         <div class="text-gray-300 text-sm">${b.startTime} - ${b.endTime}</div>
                    </div>
                     <div>
                        <div class="text-xs text-gray-500 uppercase font-bold">Amount</div>
                         <div class="text-gray-300 text-sm">${b.amount}</div>
                    </div>
                </div>

                <div class="w-full bg-green-500/10 border border-green-500/20 text-green-400 py-2 rounded-lg text-sm text-center font-medium">
                    Confirmed
                </div>
            `;
            listEl.appendChild(el);
        });
    }
}

function openBookingModal(item) {
    const modalRoot = document.getElementById('modal-root');
    // Dark modal with Tailwind
    modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
            
            <div class="p-6 border-b border-white/5">
                <h3 class="text-xl font-bold text-white mb-1">${escapeHtml(item.Location)}</h3>
                <p class="text-teal-400 text-sm font-medium">Rate: ${item.PricePerHour ? '₹' + item.PricePerHour + '/hr' : 'Contact Price'}</p>
            </div>

            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs text-gray-500 uppercase font-bold mb-1">Start Time</label>
                        <input id="start-time" type="time" value="09:00" class="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2.5 focus:border-teal-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 uppercase font-bold mb-1">End Time</label>
                        <input id="end-time" type="time" value="10:00" class="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2.5 focus:border-teal-500 outline-none">
                    </div>
                </div>

                <div>
                    <label class="block text-xs text-gray-500 uppercase font-bold mb-1">Duration (Hrs)</label>
                    <input id="num-hours" type="number" min="1" value="1" class="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2.5 focus:border-teal-500 outline-none">
                </div>

                <div class="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 mt-4">
                    <span class="text-gray-400">Total Estimate</span>
                    <span id="total-fare" class="text-2xl font-bold text-white">₹0</span>
                </div>
            </div>

            <div class="p-6 bg-gray-900/50 flex gap-3 border-t border-white/5">
                <button id="cancel-book" class="flex-1 py-3 px-4 rounded-xl text-gray-400 font-medium hover:bg-white/5 transition-colors">Cancel</button>
                <button id="confirm-book" class="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold shadow-lg hover:shadow-teal-500/20 transition-all">Confirm Booking</button>
            </div>
        </div>
    </div>
    `;

    function computeFare() {
        const price = item.PricePerHour ? Number(item.PricePerHour) : null;
        let hrs = Number(document.getElementById('num-hours').value) || 1;
        if (hrs < 1) hrs = 1;
        const total = price ? price * hrs : 'N/A';
        document.getElementById('total-fare').innerText = price ? '₹' + total : 'Contact';
    }

    // Modal logic
    const updateHours = () => {
        const start = document.getElementById('start-time').value;
        const end = document.getElementById('end-time').value;
        if (start && end) {
            const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
            let hours = eh + em / 60 - (sh + sm / 60);
            if (hours <= 0) hours = 1;
            document.getElementById('num-hours').value = Math.ceil(hours);
            computeFare();
        }
    }

    document.getElementById('num-hours').addEventListener('input', computeFare);
    document.getElementById('start-time').addEventListener('change', updateHours);
    document.getElementById('end-time').addEventListener('change', updateHours);

    document.getElementById('cancel-book').addEventListener('click', closeModal);
    document.getElementById('confirm-book').addEventListener('click', () => {
        const bookingId = 'BK' + Date.now().toString().slice(-6);
        const modalRoot = document.getElementById('modal-root');

        // Save to local storage
        saveBooking({
            id: bookingId,
            locationName: item.Location,
            startTime: document.getElementById('start-time').value,
            endTime: document.getElementById('end-time').value,
            amount: document.getElementById('total-fare').innerText,
            date: new Date().toISOString()
        });

        modalRoot.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm text-center p-8 shadow-2xl relative">
                <div class="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">Success!</h3>
                <p class="text-gray-400 mb-6 font-medium text-sm">Your spot is reserved.</p>
                
                <div class="bg-gray-800 rounded-xl p-4 mb-6 border border-white/5 border-dashed">
                    <div class="text-xs text-gray-500 uppercase font-bold mb-1">Booking ID</div>
                    <div class="text-xl font-mono text-white tracking-widest">${bookingId}</div>
                </div>

                <button id="close-ok" class="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors text-base shadow-lg shadow-blue-500/25">Done</button>
            </div>
        </div>
        `;
        document.getElementById('close-ok').addEventListener('click', () => {
            document.getElementById('modal-root').innerHTML = '';
            const tabBookings = document.getElementById('tab-bookings');
            if (tabBookings) tabBookings.click();
        });
    });

    computeFare();
}

function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getUserLocation(requirePrompt) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            // Leaflet set center
            if (map) map.setView([userPosition.lat, userPosition.lng], 14);
            putUserMarker();
            renderNearby();
        }, err => {
            console.warn('Geolocation error', err);
            if (requirePrompt) alert('Location access needed to find nearby spots.');
            // Default fallback
            userPosition = null;
            if (map) map.setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 13);
            renderNearby();
        }, { enableHighAccuracy: true, timeout: 8000 });
    } else {
        if (requirePrompt) alert('Geolocation not supported.');
    }
}

// Boot
boot();
