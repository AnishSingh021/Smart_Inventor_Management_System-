
const TOKEN_KEY = 'inventory_jwt';
const USERS_KEY = 'inventory_users';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function createToken(payload) {
    const exp = Date.now() + TOKEN_TTL_MS;
    const data = { ...payload, exp };
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function parseToken(token) {
    if (!token) return null;
    try {
        const json = decodeURIComponent(escape(atob(token)));
        const data = JSON.parse(json);
        if (data.exp && data.exp < Date.now()) return null; // expired
        return data;
    } catch {
        return null;
    }
}

function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setSession(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
}

function getCurrentUser() {
    const token = getStoredToken();
    return parseToken(token);
}
function getStoredUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveUser(user) {
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUserByUsername(username) {
    return getStoredUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-card').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        if (target === 'login') {
            document.getElementById('login-form').classList.add('active');
        } else {
            document.getElementById('register-form').classList.add('active');
        }
        document.getElementById('auth-error').classList.add('hidden');
        document.getElementById('reg-error').classList.add('hidden');
    });
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');

    const user = findUserByUsername(username);
    if (!user) {
        errEl.textContent = 'User not found. Please register first.';
        errEl.classList.remove('hidden');
        return;
    }
    if (user.password !== password) {
        errEl.textContent = 'Invalid password.';
        errEl.classList.remove('hidden');
        return;
    }

    const token = createToken({
        username: user.username,
        name: user.name,
        role: user.role
    });
    setSession(token);
    errEl.classList.add('hidden');
    showDashboard();
});

document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const errEl = document.getElementById('reg-error');

    if (findUserByUsername(username)) {
        errEl.textContent = 'Username already exists.';
        errEl.classList.remove('hidden');
        return;
    }
    if (password.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        errEl.classList.remove('hidden');
        return;
    }

    saveUser({ name, username, email, password, role });
    errEl.classList.add('hidden');
    const token = createToken({ username, name, role });
    setSession(token);
    showDashboard();
});


function applyRoleBasedUI(role) {
    const sections = document.querySelectorAll('.role-only');
    sections.forEach(section => {
        const allowed = section.dataset.role.split(',').map(r => r.trim());
        section.classList.toggle('hidden', !allowed.includes(role));
    });
    const badge = document.getElementById('user-badge');
    if (badge) {
        badge.textContent = role;
        badge.className = 'role-badge ' + role.toLowerCase();
    }
}
let inventoryData = [
    { id: 1, name: 'MacBook Pro', stock: 25, reorder: 10 },
    { id: 2, name: 'Dell Monitor', stock: 8, reorder: 12 },
    { id: 3, name: 'Logitech Mouse', stock: 45, reorder: 15 },
    { id: 4, name: 'Mechanical Keyboard', stock: 5, reorder: 8 }
];

function loadInventory() {
    try {
        const raw = localStorage.getItem('inventory_data');
        if (raw) inventoryData = JSON.parse(raw);
    } catch (_) {}
}

function saveInventory() {
    localStorage.setItem('inventory_data', JSON.stringify(inventoryData));
}

function getStatus(item) {
    if (item.stock <= item.reorder) return { label: 'Critical', class: 'status-critical' };
    if (item.stock <= item.reorder * 1.5) return { label: 'Low', class: 'status-low' };
    return { label: 'Healthy', class: 'status-healthy' };
}
function getFilteredData() {
    const search = document.getElementById('search-bar').value.toLowerCase().trim();
    const statusFilter = (document.getElementById('filter-status') || {}).value || '';
    return inventoryData.filter(item => {
        const matchSearch = !search || item.name.toLowerCase().includes(search);
        const status = getStatus(item).label;
        const matchStatus = !statusFilter || status === statusFilter;
        return matchSearch && matchStatus;
    });
}

function renderInventory(data) {
    const tbody = document.getElementById('inventory-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const counts = { Healthy: 0, Low: 0, Critical: 0 };
    data.forEach(item => {
        const status = getStatus(item);
        counts[status.label]++;
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${item.stock}</td>
                <td>${item.reorder}</td>
                <td><span class="status-pill ${status.class}">${status.label}</span></td>
            </tr>
        `;
    });

    document.getElementById('total-count').textContent = data.length;
    document.getElementById('healthy-count').textContent = counts.Healthy;
    document.getElementById('low-count').textContent = counts.Low;
    document.getElementById('crit-count').textContent = counts.Critical;
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function filterInventory() {
    renderInventory(getFilteredData());
    renderChart(getFilteredData());
}

let myChart;
function renderChart(data) {
    const canvas = document.getElementById('inventoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    const colors = data.map(i => {
        const s = getStatus(i);
        if (s.label === 'Critical') return '#ef4444';
        if (s.label === 'Low') return '#eab308';
        return '#22c55e';
    });

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(i => i.name),
            datasets: [{
                label: 'Stock',
                data: data.map(i => i.stock),
                backgroundColor: colors,
                borderColor: colors.map(c => c),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function showDashboard() {
    const user = getCurrentUser();
    if (!user) {
        document.getElementById('auth-page').classList.remove('hidden');
        document.getElementById('dashboard-page').classList.add('hidden');
        return;
    }

    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('user-display').textContent = `Welcome, ${user.name || user.username}`;
    applyRoleBasedUI(user.role);

    loadInventory();
    const filtered = getFilteredData();
    renderInventory(filtered);
    renderChart(filtered);

    const searchBar = document.getElementById('search-bar');
    const filterStatus = document.getElementById('filter-status');
    if (searchBar) searchBar.addEventListener('input', filterInventory);
    if (filterStatus) filterStatus.addEventListener('change', filterInventory);

    document.getElementById('btn-refresh').addEventListener('click', () => {
        loadInventory();
        filterInventory();
    });
}

document.getElementById('inventory-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value, 10);
    const reorder = parseInt(document.getElementById('prod-reorder').value, 10);
    if (isNaN(stock) || isNaN(reorder) || stock < 0 || reorder < 0) return;

    const existing = inventoryData.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.stock = stock;
        existing.reorder = reorder;
    } else {
        inventoryData.push({
            id: Math.max(0, ...inventoryData.map(i => i.id)) + 1,
            name,
            stock,
            reorder
        });
    }
    saveInventory();
    document.getElementById('inventory-form').reset();
    filterInventory();
});

function logout() {
    clearSession();
    location.reload();
}

function seedDemoUser() {
    if (getStoredUsers().length === 0) {
        saveUser({
            name: 'Demo Admin',
            username: 'admin',
            email: 'admin@demo.com',
            password: 'admin123',
            role: 'Admin'
        });
    }
}

window.addEventListener('load', () => {
    seedDemoUser();
    if (getCurrentUser()) {
        showDashboard();
    } else {
        document.getElementById('auth-page').classList.remove('hidden');
        document.getElementById('dashboard-page').classList.add('hidden');
    }
});
