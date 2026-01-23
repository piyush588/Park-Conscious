// ---- CONFIG ----
// Use relative URL so this works both locally and on Vercel (/api is served by Vercel Functions)
const PARKING_JSON = '/api/parking';
// file with your 400+ parking entries
const DEFAULT_LOCATION = {lat:28.644800, lng:77.216721}; // Delhi center fallback
// -----------------

let map, userMarker, parkingData = [], markers = [], infoWindow;
let userPosition = null;

// Utility: Haversine distance in kilometers (digits by digit safe arithmetic)
function toRad(deg){ return deg * Math.PI / 180; }
function haversineDistance(lat1, lon1, lat2, lon2) {
    // step-by-step to reduce arithmetic mistakes
    const R = 6371.0; // Earth radius in km
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Load parking JSON
async function loadParkingData(){
    try{
    const resp = await fetch(PARKING_JSON);
    parkingData = await resp.json();
    // ensure numeric types where needed
    parkingData = parkingData.map(p => ({
        ...p,
        Latitude: Number(p.Latitude),
        Longitude: Number(p.Longitude),
        PricePerHour: p.PricePerHour !== undefined ? Number(p.PricePerHour) : null,
        TotalSlots: p.TotalSlots !== undefined ? Number(p.TotalSlots) : null
    }));
    }catch(e){
    console.error('Failed to load parking-data.json', e);
    parkingData = [];
    }
}

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_LOCATION,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    });
    infoWindow = new google.maps.InfoWindow();

    // click handler to close modal when clicking map
    map.addListener('click', () => { infoWindow.close(); });

    // wire events
    document.getElementById('locate-btn').addEventListener('click', () => getUserLocation(true));
    document.getElementById('radius-select').addEventListener('change', () => renderNearby());

    // Autocomplete for address search (Places library required)
    const input = document.getElementById('autocomplete-input');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.setFields(['place_id','geometry','formatted_address','name']);
    autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if(place && place.geometry && place.geometry.location){
        const loc = place.geometry.location;
        userPosition = {lat: loc.lat(), lng: loc.lng()};
        map.setCenter(userPosition);
        map.setZoom(14);
        putUserMarker();
        renderNearby();
    }
    });

    // initial user location attempt
    getUserLocation(false);
}

async function boot(){
    await loadParkingData();
    // ensure Google API loaded first then initMap called by callback
}

function putUserMarker(){
    if(!userPosition) return;
    if(userMarker) userMarker.setMap(null);
    userMarker = new google.maps.Marker({
    position: userPosition,
    map,
    title: 'You are here',
    icon: { path: google.maps.SymbolPath.CIRCLE, scale:7, fillColor:'#1f6feb', fillOpacity:1, strokeWeight:2, strokeColor:'#fff' }
    });
}

function renderMarkers(list){
    // clear old markers
    markers.forEach(m => m.setMap(null));
    markers = [];

    list.forEach(item => {
    const pos = {lat: item.Latitude, lng: item.Longitude};
    const marker = new google.maps.Marker({
        position: pos,
        map,
        title:item.Location
    });
    marker.addListener('click', () => {
        map.panTo(pos);
        map.setZoom(16);
        showInfoWindow(item, marker);
    });
    markers.push(marker);
    });
}

function showInfoWindow(item, marker){
    const content = `<div style="min-width:200px"><strong>${escapeHtml(item.Location)}</strong><div class="muted">${escapeHtml(item.Type || '')}</div>
    <div style="margin-top:6px">Price: ${item.PricePerHour ? '₹' + item.PricePerHour + '/hr' : 'Contact'}</div>
    <div style="margin-top:6px"><button id="iw-book-${item.ID}" style="padding:6px 8px;border-radius:6px;border:none;background:#1f6feb;color:#fff;cursor:pointer">Book Now</button></div></div>`;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    // attach a click listener after window dom is rendered
    google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
    const btn = document.getElementById(`iw-book-${item.ID}`);
    if(btn) btn.addEventListener('click', () => openBookingModal(item));
    });
}

function renderNearby(){
    if(!userPosition){
    document.getElementById('results-list').innerHTML = '<div class="muted">User location not set. Click "Use my location" or search an address.</div>';
    document.getElementById('results-count').innerText = 0;
    return;
    }
    const radiusKm = Number(document.getElementById('radius-select').value);
    // compute distances
    const enriched = parkingData.map(p => {
    const d = haversineDistance(userPosition.lat, userPosition.lng, p.Latitude, p.Longitude);
    return {...p, distance_km: d};
    });
    // filter by radius and sort
    const filtered = enriched.filter(p => p.distance_km <= radiusKm).sort((a,b)=>a.distance_km - b.distance_km);
    // top N results (say 30)
    const results = filtered.slice(0, 30);

    // populate list
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = '';
    if(results.length === 0){
    listEl.innerHTML = '<div class="muted">No parking spots found within selected radius.</div>';
    }else{
    results.forEach(p => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
            <div style="width:8px;height:48px;background:#eef6ff;border-radius:4px"></div>
            <div style="flex:1">
            <h4>${escapeHtml(p.Location)}</h4>
            <div class="muted">${escapeHtml(p.Authority || '')} ${p.Zone ? '• ' + escapeHtml(p.Zone): ''}</div>
            <div class="meta">
                <span>${p.PricePerHour ? '₹' + p.PricePerHour + '/hr' : 'Contact'}</span>
                <span>${p.TotalSlots ? p.TotalSlots + ' slots' : 'Slots N/A'}</span>
                <span>${p.Type || 'Type N/A'}</span>
            </div>
            </div>
            <div style="text-align:right">
            <div class="muted" style="font-size:13px">Distance</div>
            <div style="font-weight:700">${(p.distance_km).toFixed(2)} km</div>
            <div style="margin-top:6px">
                <button class="btn book-btn" data-id="${p.ID}">Book Now</button>
            </div>
            </div>
        </div>
        `;
        listEl.appendChild(el);

        // click handlers
        el.querySelector('.card')?.addEventListener?.('click', () => {
        map.panTo({lat: p.Latitude, lng: p.Longitude});
        map.setZoom(16);
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

function openBookingModal(item){
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true">
        <h3 style="margin:0 0 6px 0">${escapeHtml(item.Location)}</h3>
        <div class="muted">Price: ${item.PricePerHour ? '₹'+item.PricePerHour+'/hr' : 'Contact'}</div>
        <div style="margin-top:8px">Owner: ${escapeHtml(item.Owner || 'N/A')} • Contact: ${escapeHtml(item.Contact || 'N/A')}</div>

        <label>Start Time</label>
        <input id="start-time" type="time" value="09:00" />

        <label>End Time</label>
        <input id="end-time" type="time" value="10:00" />

        <label>Number of hours</label>
        <input id="num-hours" type="number" min="1" value="1" />

        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
            <div><strong>Total:</strong> <span id="total-fare">₹0</span></div>
            <div>
            <button id="cancel-book" class="btn" style="background:#e5e7eb;color:#111;border:none;margin-right:6px">Cancel</button>
            <button id="confirm-book" class="btn">Confirm & Get QR</button>
            </div>
        </div>

        <div style="margin-top:8px;font-size:13px;color:var(--muted)">Note: This is a demo booking (no live availability or payments).</div>
        </div>
    </div>
    `;
    modalRoot.setAttribute('aria-hidden','false');

    function computeFare(){
    const price = item.PricePerHour ? Number(item.PricePerHour) : null;
    let hrs = Number(document.getElementById('num-hours').value) || 1;
    if(hrs < 1) hrs = 1;
    const total = price ? price * hrs : 'Contact';
    document.getElementById('total-fare').innerText = price ? '₹' + total : 'Contact owner';
    }

    // wire modal events
    document.getElementById('num-hours').addEventListener('input', computeFare);
    document.getElementById('start-time').addEventListener('change', () => {
    // simple attempt to compute hours from start/end
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;
    if(start && end){
        const [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
        let hours = eh + em/60 - (sh + sm/60);
        if(hours <= 0) hours = 1;
        document.getElementById('num-hours').value = Math.ceil(hours);
        computeFare();
    }
    });
    document.getElementById('end-time').addEventListener('change', () => {
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;
    if(start && end){
        const [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
        let hours = eh + em/60 - (sh + sm/60);
        if(hours <= 0) hours = 1;
        document.getElementById('num-hours').value = Math.ceil(hours);
        computeFare();
    }
    });

    document.getElementById('cancel-book').addEventListener('click', closeModal);
    document.getElementById('confirm-book').addEventListener('click', () => {
    // generate a simple QR-like code modal (not real QR) — a unique booking id
    const bookingId = 'BK' + Date.now().toString().slice(-6);
    modalRoot.innerHTML = `
        <div class="modal-backdrop">
        <div class="modal">
            <h3>Booking Confirmed</h3>
            <div>Booking ID: <strong>${bookingId}</strong></div>
            <div style="margin-top:12px;padding:10px;border-radius:8px;background:#f3f6fb;text-align:center">
            <div style="font-weight:700;font-size:20px">${bookingId}</div>
            <div class="muted">Show this code at entry</div>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
            <button id="close-ok" class="btn">Done</button>
            </div>
        </div>
        </div>
    `;
    document.getElementById('close-ok').addEventListener('click', closeModal);
    });

    computeFare();
}

function closeModal(){
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = '';
    modalRoot.setAttribute('aria-hidden','true');
}

function escapeHtml(s){
    if(!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// get user geolocation
function getUserLocation(requirePrompt){
    if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos => {
        userPosition = {lat: pos.coords.latitude, lng: pos.coords.longitude};
        map.setCenter(userPosition);
        map.setZoom(14);
        putUserMarker();
        renderNearby();
    }, err => {
        console.warn('Geolocation error', err);
        if(requirePrompt){
        alert('Could not get your location. Please allow location access or search an address.');
        }
        // fallback: center map on default but still render nearby if possible
        userPosition = null;
        map.setCenter(DEFAULT_LOCATION);
    }, {enableHighAccuracy:true,timeout:8000});
    }else{
    if(requirePrompt) alert('Geolocation not supported. Use the search box to find a place.');
    }
}

// fetch plus initialize after Google loads. We'll bootstrap loading of parking data now.
boot();

// expose initMap globally for Google callback
window.initMap = initMap;
// when parking-data.json is loaded and map ready, calls to renderNearby happen after initMap.

