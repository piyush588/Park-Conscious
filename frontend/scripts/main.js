const PARKING_JSON = './assets/data/parkings.json';
const DEFAULT_LOCATION = { lat: 28.644800, lng: 77.216721 }; // Delhi center fallback
// -----------------

let map, userMarker, parkingData = [], markers = [], infoWindow;
let userPosition = null;

// Utility: Haversine distance in kilometers
function toRad(deg) { return deg * Math.PI / 180; }
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Load parking JSON
async function loadParkingData() {
    try {
        const resp = await fetch(PARKING_JSON);
        parkingData = await resp.json();
        parkingData = parkingData.map(p => ({
            ...p,
            Latitude: Number(p.Latitude),
            Longitude: Number(p.Longitude),
            PricePerHour: p.PricePerHour !== undefined ? Number(p.PricePerHour) : null,
            TotalSlots: p.TotalSlots !== undefined ? Number(p.TotalSlots) : null
        }));
    } catch (e) {
        console.error('Failed to load parking-data.json', e);
        parkingData = [];
    }
}

function initMap() {
    // Custom dark map style
    const darkMapStyle = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
        { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
        { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
        { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
    ];

    map = new google.maps.Map(document.getElementById('map'), {
        center: DEFAULT_LOCATION,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        styles: darkMapStyle
    });
    infoWindow = new google.maps.InfoWindow();

    map.addListener('click', () => { infoWindow.close(); });

    document.getElementById('locate-btn').addEventListener('click', () => getUserLocation(true));
    document.getElementById('radius-select').addEventListener('change', () => renderNearby());

    const input = document.getElementById('autocomplete-input');
    // Ensure input exists before init
    if (input) {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.setFields(['place_id', 'geometry', 'formatted_address', 'name']);
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place && place.geometry && place.geometry.location) {
                const loc = place.geometry.location;
                userPosition = { lat: loc.lat(), lng: loc.lng() };
                map.setCenter(userPosition);
                map.setZoom(14);
                putUserMarker();
                renderNearby();
            }
        });
    }

    getUserLocation(false);
}

async function boot() {
    await loadParkingData();
}

function putUserMarker() {
    if (!userPosition) return;
    if (userMarker) userMarker.setMap(null);
    userMarker = new google.maps.Marker({
        position: userPosition,
        map,
        title: 'You are here',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#2dd4bf',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#fff'
        }
    });
}

function renderMarkers(list) {
    markers.forEach(m => m.setMap(null));
    markers = [];

    list.forEach(item => {
        const pos = { lat: item.Latitude, lng: item.Longitude };
        const marker = new google.maps.Marker({
            position: pos,
            map,
            title: item.Location
        });
        marker.addListener('click', () => {
            map.panTo(pos);
            map.setZoom(16);
            showInfoWindow(item, marker);
        });
        markers.push(marker);
    });
}

function showInfoWindow(item, marker) {
    // Styled info window content
    const content = `
    <div style="font-family:'Inter', sans-serif; color:#111; padding:4px;">
        <strong style="font-size:14px; display:block; margin-bottom:4px;">${escapeHtml(item.Location)}</strong>
        <div style="color:#666; font-size:12px; margin-bottom:8px;">${escapeHtml(item.Type || '')}</div>
        <div style="font-weight:600; color:#1f40af; margin-bottom:8px;">${item.PricePerHour ? '₹' + item.PricePerHour + '/hr' : 'Contact'}</div>
        <button id="iw-book-${item.ID}" style="background:#0f766e; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer; width:100%;">Book Spot</button>
    </div>`;

    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
        const btn = document.getElementById(`iw-book-${item.ID}`);
        if (btn) btn.addEventListener('click', () => openBookingModal(item));
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
                    map.panTo({ lat: p.Latitude, lng: p.Longitude });
                    map.setZoom(16);
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

        modalRoot.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm text-center p-8 shadow-2xl relative">
                <div class="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">Success!</h3>
                <p class="text-gray-400 mb-6">Your spot is reserved.</p>
                
                <div class="bg-gray-800 rounded-xl p-4 mb-6 border border-white/5 border-dashed">
                    <div class="text-xs text-gray-500 uppercase font-bold mb-1">Booking ID</div>
                    <div class="text-xl font-mono text-white tracking-widest">${bookingId}</div>
                </div>

                <button id="close-ok" class="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors">Done</button>
            </div>
        </div>
        `;
        document.getElementById('close-ok').addEventListener('click', () => {
            document.getElementById('modal-root').innerHTML = '';
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
            map.setCenter(userPosition);
            map.setZoom(14);
            putUserMarker();
            renderNearby();
        }, err => {
            console.warn('Geolocation error', err);
            if (requirePrompt) alert('Location access needed to find nearby spots.');
            // Default center fallback
            userPosition = null;
            map.setCenter(DEFAULT_LOCATION);
            // Try to render with default center logic or just empty? 
            // Better to show empty state if no user loc.
        }, { enableHighAccuracy: true, timeout: 8000 });
    } else {
        if (requirePrompt) alert('Geolocation not supported.');
    }
}

boot();
window.initMap = initMap;

