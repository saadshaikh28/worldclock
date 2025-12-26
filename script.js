// --- Configuration & State ---
let selectedCities = [
    { name: 'London', timezone: 'Europe/London' },
    { name: 'New York', timezone: 'America/New_York' },
    { name: 'Dubai', timezone: 'Asia/Dubai' },
    { name: 'Singapore', timezone: 'Asia/Singapore' }
];

let globalTimeOffset = 0; // Milliseconds
let activeEditIndex = -1;
let isScheduleMode = false;
let primaryCityIndex = 0; // Default to first city

// --- Three.js Setup ---
let scene, camera, renderer, globe;

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Globe
    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    // Using a nice dark earth texture
    const texture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpScale: 0.05,
        specular: new THREE.Color('grey'),
        shininess: 10
    });

    globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 3, 5);
    scene.add(mainLight);

    // Stars
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = -Math.random() * 2000;
        starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    camera.position.z = 15;

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    if (globe) {
        globe.rotation.y += 0.001;
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- UI Logic ---

const clocksGrid = document.getElementById('clocks-grid');
const searchInput = document.getElementById('city-search');
const searchResults = document.getElementById('search-results');
const modal = document.getElementById('time-edit-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const editTimeInput = document.getElementById('edit-time-input');

function renderClocks() {
    clocksGrid.innerHTML = '';
    selectedCities.forEach((city, index) => {
        const isPrimary = isScheduleMode && index === primaryCityIndex;
        const card = document.createElement('div');
        card.className = `clock-card ${isPrimary ? 'primary' : ''}`;
        card.draggable = true;
        card.dataset.index = index;
        card.innerHTML = `
            ${isPrimary ? '<div class="primary-badge">Primary</div>' : ''}
            <button class="remove-city" onclick="removeCity(${index})">&times;</button>
            <div class="clock-face" id="clock-${index}" 
                 onclick="${(isScheduleMode && index !== primaryCityIndex) ? `setPrimary(${index})` : ''}"
                 onmousedown="${isPrimary ? `startHandDrag(event, ${index})` : ''}">
                <div class="hand hour-hand ${isPrimary ? 'interactive' : ''}"></div>
                <div class="hand minute-hand ${isPrimary ? 'interactive' : ''}"></div>
                <div class="hand second-hand"></div>
            </div>
            <div class="city-info">
                <h2>${city.name}</h2>
                <div class="timezone-label">${city.timezone}</div>
                <div class="digital-time" onclick="openEditModal(${index})">--:--:--</div>
                <div class="range-display" id="range-${index}" style="display: ${isScheduleMode ? 'block' : 'none'}">
                    <div class="time-range">--:-- - --:--</div>
                    <div class="date-diff">Same Day</div>
                </div>
            </div>
        `;

        // Drag Events
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        clocksGrid.appendChild(card);
    });
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(this.dataset.index);
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Reorder array
        const itemMove = selectedCities.splice(draggedIndex, 1)[0];
        selectedCities.splice(targetIndex, 0, itemMove);
        renderClocks();
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedIndex = null;
}

function updateClocks() {
    if (isScheduleMode) {
        updateScheduleDisplay();
        return;
    }

    const now = new Date(Date.now() + globalTimeOffset);

    selectedCities.forEach((city, index) => {
        const timeInZone = new Date(now.toLocaleString('en-US', { timeZone: city.timezone }));

        const seconds = timeInZone.getSeconds();
        const minutes = timeInZone.getMinutes();
        const hours = timeInZone.getHours();

        const secDeg = (seconds / 60) * 360;
        const minDeg = ((minutes + seconds / 60) / 60) * 360;
        const hourDeg = ((hours % 12 + minutes / 60) / 12) * 360;

        const clockEl = document.getElementById(`clock-${index}`);
        if (clockEl) {
            clockEl.querySelector('.second-hand').style.transform = `rotate(${secDeg}deg)`;
            clockEl.querySelector('.minute-hand').style.transform = `rotate(${minDeg}deg)`;
            clockEl.querySelector('.hour-hand').style.transform = `rotate(${hourDeg}deg)`;

            const digitalEl = clockEl.parentElement.querySelector('.digital-time');
            digitalEl.textContent = timeInZone.toLocaleTimeString('en-GB', { hour12: false });

            // Day/Night visualization
            clockEl.classList.remove('day', 'night');
            clockEl.classList.add(hours >= 6 && hours < 18 ? 'day' : 'night');
        }
    });

    if (globalTimeOffset !== 0) {
        document.getElementById('sync-indicator').querySelector('span').textContent = 'Custom Sync Active';
        document.getElementById('sync-indicator').querySelector('.pulse').style.background = '#ff9800';
        document.getElementById('sync-indicator').querySelector('.pulse').style.boxShadow = '0 0 10px #ff9800';
        document.getElementById('reset-time').style.display = 'block';
    } else {
        document.getElementById('sync-indicator').querySelector('span').textContent = 'Real-time Sync';
        document.getElementById('sync-indicator').querySelector('.pulse').style.background = '#4caf50';
        document.getElementById('sync-indicator').querySelector('.pulse').style.boxShadow = '0 0 10px #4caf50';
        document.getElementById('reset-time').style.display = 'none';
    }
}

function updateScheduleDisplay() {
    const startTime = document.getElementById('plan-start').value;
    const endTime = document.getElementById('plan-end').value;
    const primaryCity = selectedCities[primaryCityIndex];

    // Create a base date in primary timezone
    const baseDateStr = new Date().toLocaleDateString('en-US', { timeZone: primaryCity.timezone });

    selectedCities.forEach((city, index) => {
        // Calculate start and end for each city corresponding to primary
        const start = getOffsetTime(primaryCity.timezone, city.timezone, startTime);
        const end = getOffsetTime(primaryCity.timezone, city.timezone, endTime);

        // Update Hands (to start time)
        const [h, m] = start.time.split(':').map(Number);
        const clockEl = document.getElementById(`clock-${index}`);
        if (clockEl) {
            clockEl.querySelector('.second-hand').style.transform = `rotate(0deg)`;
            clockEl.querySelector('.minute-hand').style.transform = `rotate(${(m / 60) * 360}deg)`;
            clockEl.querySelector('.hour-hand').style.transform = `rotate(${((h % 12 + m / 60) / 12) * 360}deg)`;

            const digitalEl = clockEl.parentElement.querySelector('.digital-time');
            digitalEl.textContent = start.time + ":00";

            // Day/Night visualization in planning mode
            clockEl.classList.remove('day', 'night');
            clockEl.classList.add(h >= 6 && h < 18 ? 'day' : 'night');

            const rangeEl = document.getElementById(`range-${index}`);
            rangeEl.querySelector('.time-range').textContent = `${start.time} - ${end.time}`;
            rangeEl.querySelector('.date-diff').textContent = start.dateDiff || "Same day";
        }
    });
}

function getOffsetTime(fromTZ, toTZ, timeStr) {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    // Create a date in the 'from' timezone
    const fromDate = new Date(d.toLocaleString('en-US', { timeZone: fromTZ }));
    fromDate.setHours(h, m, 0, 0);

    // This is tricky in JS. A better way:
    // 1. Get current time in both timezones to find the static difference
    const now = new Date();
    const fromNow = new Date(now.toLocaleString('en-US', { timeZone: fromTZ }));
    const toNow = new Date(now.toLocaleString('en-US', { timeZone: toTZ }));
    const diff = toNow.getTime() - fromNow.getTime();

    const targetDate = new Date(fromDate.getTime() + diff);

    const targetH = String(targetDate.getHours()).padStart(2, '0');
    const targetM = String(targetDate.getMinutes()).padStart(2, '0');

    // Date difference logic
    let diffLabel = "Same day";
    const dayDiff = targetDate.getDate() - fromDate.getDate();
    if (dayDiff > 0) diffLabel = `+${dayDiff} day${dayDiff > 1 ? 's' : ''}`;
    if (dayDiff < 0) diffLabel = `${dayDiff} day${dayDiff < -1 ? 's' : ''}`;

    return { time: `${targetH}:${targetM}`, dateDiff: diffLabel };
}

function removeCity(index) {
    selectedCities.splice(index, 1);
    renderClocks();
}

// --- Search Implementation ---
const commonCities = [
    // Americas
    { name: 'New York', timezone: 'America/New_York' },
    { name: 'Los Angeles', timezone: 'America/Los_Angeles' },
    { name: 'Chicago', timezone: 'America/Chicago' },
    { name: 'San Francisco', timezone: 'America/Los_Angeles' },
    { name: 'Toronto', timezone: 'America/Toronto' },
    { name: 'Vancouver', timezone: 'America/Vancouver' },
    { name: 'Mexico City', timezone: 'America/Mexico_City' },
    { name: 'Sao Paulo', timezone: 'America/Sao_Paulo' },
    { name: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires' },
    { name: 'Santiago', timezone: 'America/Santiago' },
    { name: 'Bogota', timezone: 'America/Bogota' },
    { name: 'Lima', timezone: 'America/Lima' },
    { name: 'Miami', timezone: 'America/New_York' },
    { name: 'Seattle', timezone: 'America/Los_Angeles' },
    { name: 'Denver', timezone: 'America/Denver' },
    { name: 'Boston', timezone: 'America/New_York' },
    { name: 'Houston', timezone: 'America/Chicago' },
    { name: 'Phoenix', timezone: 'America/Phoenix' },

    // Europe
    { name: 'London', timezone: 'Europe/London' },
    { name: 'Paris', timezone: 'Europe/Paris' },
    { name: 'Berlin', timezone: 'Europe/Berlin' },
    { name: 'Zurich', timezone: 'Europe/Zurich' },
    { name: 'Madrid', timezone: 'Europe/Madrid' },
    { name: 'Rome', timezone: 'Europe/Rome' },
    { name: 'Amsterdam', timezone: 'Europe/Amsterdam' },
    { name: 'Vienna', timezone: 'Europe/Vienna' },
    { name: 'Stockholm', timezone: 'Europe/Stockholm' },
    { name: 'Oslo', timezone: 'Europe/Oslo' },
    { name: 'Copenhagen', timezone: 'Europe/Copenhagen' },
    { name: 'Brussels', timezone: 'Europe/Brussels' },
    { name: 'Dublin', timezone: 'Europe/Dublin' },
    { name: 'Lisbon', timezone: 'Europe/Lisbon' },
    { name: 'Helsinki', timezone: 'Europe/Helsinki' },
    { name: 'Athens', timezone: 'Europe/Athens' },
    { name: 'Istanbul', timezone: 'Europe/Istanbul' },
    { name: 'Moscow', timezone: 'Europe/Moscow' },
    { name: 'Warsaw', timezone: 'Europe/Warsaw' },
    { name: 'Prague', timezone: 'Europe/Prague' },

    // Middle East & Africa
    { name: 'Dubai', timezone: 'Asia/Dubai' },
    { name: 'Riyadh', timezone: 'Asia/Riyadh' },
    { name: 'Doha', timezone: 'Asia/Qatar' },
    { name: 'Abu Dhabi', timezone: 'Asia/Dubai' },
    { name: 'Tel Aviv', timezone: 'Asia/Jerusalem' },
    { name: 'Johannesburg', timezone: 'Africa/Johannesburg' },
    { name: 'Cairo', timezone: 'Africa/Cairo' },
    { name: 'Nairobi', timezone: 'Africa/Nairobi' },
    { name: 'Lagos', timezone: 'Africa/Lagos' },
    { name: 'Casablanca', timezone: 'Africa/Casablanca' },
    { name: 'Cape Town', timezone: 'Africa/Johannesburg' },

    // Asia
    { name: 'Singapore', timezone: 'Asia/Singapore' },
    { name: 'Tokyo', timezone: 'Asia/Tokyo' },
    { name: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
    { name: 'Mumbai', timezone: 'Asia/Kolkata' },
    { name: 'Delhi', timezone: 'Asia/Kolkata' },
    { name: 'Seoul', timezone: 'Asia/Seoul' },
    { name: 'Beijing', timezone: 'Asia/Shanghai' },
    { name: 'Shanghai', timezone: 'Asia/Shanghai' },
    { name: 'Bangkok', timezone: 'Asia/Bangkok' },
    { name: 'Jakarta', timezone: 'Asia/Jakarta' },
    { name: 'Manila', timezone: 'Asia/Manila' },
    { name: 'Taipei', timezone: 'Asia/Taipei' },
    { name: 'Ho Chi Minh City', timezone: 'Asia/Ho_Chi_Minh' },
    { name: 'Kuala Lumpur', timezone: 'Asia/Kuala_Lumpur' },
    { name: 'Karachi', timezone: 'Asia/Karachi' },
    { name: 'Dhaka', timezone: 'Asia/Dhaka' },

    // Oceania
    { name: 'Sydney', timezone: 'Australia/Sydney' },
    { name: 'Melbourne', timezone: 'Australia/Melbourne' },
    { name: 'Perth', timezone: 'Australia/Perth' },
    { name: 'Brisbane', timezone: 'Australia/Brisbane' },
    { name: 'Auckland', timezone: 'Pacific/Auckland' },
    { name: 'Wellington', timezone: 'Pacific/Auckland' },
    { name: 'Fiji', timezone: 'Pacific/Fiji' }
];

searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    if (val.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    const matches = commonCities.filter(c => c.name.toLowerCase().includes(val));
    if (matches.length > 0) {
        searchResults.innerHTML = matches.map(c => `
            <div class="search-item" onclick="addCity('${c.name}', '${c.timezone}')">${c.name} (${c.timezone})</div>
        `).join('');
        searchResults.style.display = 'block';
    } else {
        searchResults.style.display = 'none';
    }
});

function addCity(name, timezone) {
    if (!selectedCities.find(c => c.name === name)) {
        selectedCities.push({ name, timezone });
        renderClocks();
    }
    searchInput.value = '';
    searchResults.style.display = 'none';
}

// --- Sync Modal Logic ---

function openEditModal(index) {
    activeEditIndex = index;
    const city = selectedCities[index];
    const now = new Date(Date.now() + globalTimeOffset);
    const timeInZone = new Date(now.toLocaleString('en-US', { timeZone: city.timezone }));

    const h = String(timeInZone.getHours()).padStart(2, '0');
    const m = String(timeInZone.getMinutes()).padStart(2, '0');
    editTimeInput.value = `${h}:${m}`;

    modal.style.display = 'block';
    modalBackdrop.style.display = 'block';
}

function closeEditModal() {
    modal.style.display = 'none';
    modalBackdrop.style.display = 'none';
}

document.getElementById('cancel-edit').addEventListener('click', closeEditModal);
modalBackdrop.addEventListener('click', closeEditModal);

document.getElementById('apply-edit').addEventListener('click', () => {
    if (activeEditIndex === -1) return;

    const [newH, newM] = editTimeInput.value.split(':').map(Number);
    const city = selectedCities[activeEditIndex];

    // Current time in that zone
    const nowLocal = new Date();
    const zoneTimeStr = nowLocal.toLocaleString('en-US', { timeZone: city.timezone });
    const zoneTime = new Date(zoneTimeStr);

    // Target time today in that zone
    const targetTime = new Date(zoneTimeStr);
    targetTime.setHours(newH, newM, 0, 0);

    // The difference we need to apply globally
    globalTimeOffset = targetTime.getTime() - zoneTime.getTime();

    closeEditModal();
});

document.getElementById('reset-time').addEventListener('click', () => {
    globalTimeOffset = 0;
});

// --- Schedule Mode Actions ---

function setPrimary(index) {
    primaryCityIndex = index;
    renderClocks();
    updateScheduleDisplay();
}

document.getElementById('toggle-schedule-mode').addEventListener('click', () => {
    isScheduleMode = true;
    document.body.classList.add('planning-mode');
    document.getElementById('schedule-controls').style.display = 'flex';
    document.getElementById('toggle-schedule-mode').style.display = 'none';
    renderClocks();
    updateScheduleDisplay();
});

document.getElementById('exit-schedule').addEventListener('click', () => {
    isScheduleMode = false;
    document.body.classList.remove('planning-mode');
    document.getElementById('schedule-controls').style.display = 'none';
    document.getElementById('toggle-schedule-mode').style.display = 'flex';
    renderClocks();
});

// --- Hand Dragging Logic ---
let isDraggingHand = false;

function startHandDrag(e, index) {
    if (!isScheduleMode) return;
    isDraggingHand = true;
    window.addEventListener('mousemove', handleHandMove);
    window.addEventListener('mouseup', stopHandDrag);
}

function stopHandDrag() {
    isDraggingHand = false;
    window.removeEventListener('mousemove', handleHandMove);
    window.removeEventListener('mouseup', stopHandDrag);
}

function handleHandMove(e) {
    if (!isDraggingHand) return;

    const primaryClock = document.getElementById(`clock-${primaryCityIndex}`);
    const rect = primaryClock.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle from center
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) + Math.PI / 2;
    let degrees = angle * (180 / Math.PI);
    if (degrees < 0) degrees += 360;

    // Convert degrees to time (for the primary clock)
    // We'll treat the drag as a minute hand adjustment for precision, or hour if they are closer to it.
    // For simplicity and better UX, we'll map the full 360 to 12 hours.
    const totalMinutes = (degrees / 360) * (12 * 60);
    const h = Math.floor(totalMinutes);
    const m = Math.floor((totalMinutes % 1) * 60);

    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    document.getElementById('plan-start').value = timeStr;
    updateScheduleDisplay();
}

document.getElementById('plan-start').addEventListener('input', updateScheduleDisplay);
document.getElementById('plan-end').addEventListener('input', updateScheduleDisplay);

async function detectLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        if (data.city && data.timezone) {
            const userCity = { name: `Current: ${data.city}`, timezone: data.timezone };

            // Remove if already exists with same name to avoid duplicates
            selectedCities = selectedCities.filter(c => c.timezone !== data.timezone);

            // Add to the beginning
            selectedCities.unshift(userCity);

            // Set as primary
            primaryCityIndex = 0;

            renderClocks();
            updateClocks();
        }
    } catch (error) {
        console.error("Location detection failed:", error);
    }
}

// Initialize
initThreeJS();
detectLocation();
renderClocks();
setInterval(updateClocks, 1000);
updateClocks();
