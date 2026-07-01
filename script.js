/**
 * ELITE CRM & XTREAM MASTER DASHBOARD
 * Structured for local file protocol and server proxy compatibility
 */

// --- GLOBAL FETCH INTERCEPTOR FOR SECURITY ---
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    if (url.startsWith('/') || url.includes(window.location.host)) {
        options.headers = options.headers || {};
        const userId = localStorage.getItem('session_user_id');
        const role = localStorage.getItem('session_role');
        if (userId) {
            options.headers['X-User-Id'] = userId;
        }
        if (role) {
            options.headers['X-User-Role'] = role;
        }
    }
    return originalFetch(url, options);
};

// --- GLOBAL WINDOW SIDEBAR & THEME CONTROLS ---

window.toggleDesktopSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    if (!sidebar || !mainContent) return;
    
    // Explicitly check current state and toggle to opposite
    const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
    const shouldCollapse = !isCurrentlyCollapsed;
    
    if (shouldCollapse) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
        localStorage.setItem('sidebar_collapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
        localStorage.setItem('sidebar_collapsed', 'false');
    }
};

window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
        const isShown = sidebar.classList.contains('show');
        if (isShown) {
            sidebar.classList.remove('show');
            sidebar.classList.remove('mobile-open');
        } else {
            sidebar.classList.add('show');
            sidebar.classList.add('mobile-open');
        }
    }
    if (overlay) {
        overlay.classList.toggle('show');
    }
};

window.closeMobileSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
        sidebar.classList.remove('show');
        sidebar.classList.remove('mobile-open');
    }
    if (overlay) {
        overlay.classList.remove('show');
    }
};

window.toggleMenu = function(menuId) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('collapsed') && window.innerWidth > 992) {
        window.toggleDesktopSidebar();
    }
    const menu = document.getElementById(menuId);
    const link = menu.previousElementSibling; 
    if (menu.style.display === "block") { 
        menu.style.display = "none"; 
        link.classList.remove("rotate-icon"); 
    } else { 
        document.querySelectorAll('.submenu').forEach(el => el.style.display = 'none'); 
        document.querySelectorAll('.has-arrow').forEach(el => el.classList.remove('rotate-icon')); 
        menu.style.display = "block"; 
        link.classList.add("rotate-icon"); 
    }
};

window.toggleDarkMode = function() {
    const hasDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', hasDark ? 'dark' : 'light');
    
    if (hasDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Switch icon between moon and sun
    const toggleIcon = document.querySelector('#darkModeToggle i');
    if (toggleIcon) {
        toggleIcon.className = hasDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    const loginToggleIcon = document.querySelector('#darkModeToggleLogin i');
    if (loginToggleIcon) {
        loginToggleIcon.className = hasDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    
    App.showToast(hasDark ? "تم تفعيل الوضع الداكن 🌙" : "تم تفعيل الوضع المضيء ☀️");
};

// --- MODULE 1: UTILS ---
const Utils = {
    normalizeDate(dateStr) {
        if (!dateStr) return null;
        if (typeof dateStr === 'number') return this.excelToJSDate(dateStr);
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateStr;
    },
    excelToJSDate(serial) {
        const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    },
    getRemainingDays(expireDate) {
        if (!expireDate) return null;
        let d, m, y;

        if (typeof expireDate === 'string' && expireDate.includes('/')) {
            const parts = expireDate.split('/');
            if (parts.length === 3) {
                [d, m, y] = parts.map(Number);
            }
        } else {
            const dateObj = new Date(expireDate);
            if (!isNaN(dateObj.getTime())) {
                d = dateObj.getDate();
                m = dateObj.getMonth() + 1;
                y = dateObj.getFullYear();
            }
        }

        if (!d || !m || !y) return null;

        const target = new Date(y, m - 1, d);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diff = target - today;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },
    formatDisplayDate(dateStr) {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },
    copyToClipboard(text) {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        return true;
    },
    highlightText(text, search) {
        if (!search || !text) return text;
        const regex = new RegExp(`(${search})`, 'gi');
        return String(text).replace(regex, '<span class="search-highlight">$1</span>');
    },
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    generateRandomString(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
};

// --- MODULE 2: SUPABASE SERVICE ---
const SupabaseService = {
    client: null,
    init(url, key) {
        if (typeof supabase === 'undefined') return null;
        this.client = supabase.createClient(url, key);
        return this.client;
    },
    async fetchData(table) {
        return await this.client.from(table).select('*').order('created_at', { ascending: false });
    },
    async addCustomer(table, payload) {
        return await this.client.from(table).insert([payload]);
    },
    async updateCustomer(table, id, data) {
        return await this.client.from(table).update(data).eq('id', id);
    },
    async deleteCustomer(table, id) {
        return await this.client.from(table).delete().eq('id', id);
    }
};

// --- MODULE 3: UI COMPONENTS ---
const Components = {
    createCustomerCard(customer, category, onRenew, onDelete) {
        const days = Utils.getRemainingDays(customer.expire_date);
        const expired = days !== null && days < 0;
        const urgent = days !== null && days >= 0 && days <= 7;
        const statusClass = expired ? 'status-err' : (urgent ? 'status-warn' : 'status-ok');
        const badgeText = expired ? 'منتهي' : 'نشط';
        const badgeClass = expired ? 'badge-expired' : 'badge-active';

        const card = document.createElement('div');
        card.className = `c-card ${statusClass}`;
        card.innerHTML = `
            <div class="c-card-header">
                <div style="flex:1">
                    <div class="c-name" onclick="App.copyText('${customer.username}')">${Utils.highlightText(customer.username, App.state.searchQuery)}</div>
                    ${customer.mac_address ? `<div class="c-meta" onclick="App.copyText('${customer.mac_address}')"><span class="meta-label">MAC:</span> ${Utils.highlightText(customer.mac_address, App.state.searchQuery)} 📋</div>` : ''}
                    ${customer.phone_number ? `<div class="c-meta" onclick="App.copyText('${customer.phone_number}')"><span class="meta-label">📞</span> ${Utils.highlightText(customer.phone_number, App.state.searchQuery)} 📋</div>` : ''}
                    ${customer.note || customer.notes ? `<div class="c-meta note-box"><span class="meta-label">📝 ملاحظة:</span> ${customer.note || customer.notes}</div>` : ''}
                    <div class="c-pass" onclick="App.copyText('${customer.password}')">Pass: ${Utils.highlightText(customer.password || '---', App.state.searchQuery)}</div>
                </div>
                <div class="c-header-actions">
                    <span class="c-badge ${badgeClass}">${badgeText}</span>
                    <div class="c-menu-wrapper">
                        <button class="btn-mini btn-gear">⚙️</button>
                        <div class="c-action-menu">
                            <button class="menu-item btn-edit-trigger"><span>✏️</span> تعديل البيانات</button>
                            <button class="menu-item btn-renew-card-trigger"><span>🔄</span> تجديد الاشتراك</button>
                            <button class="menu-item btn-del-trigger danger"><span>🗑️</span> حذف العميل</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Safety Overlay for Actions -->
            <div class="safety-overlay" id="safety-${customer.id}">
                <div class="safety-content">
                    <div class="safety-timer">5</div>
                    <p class="safety-text" id="safety-text-${customer.id}">جاري التنفيذ...</p>
                    <button class="btn-cancel">إلغاء ❌</button>
                </div>
            </div>

            <!-- Success Checkmark Overlay -->
            <div class="success-overlay" id="success-${customer.id}">
                <div class="checkmark-circle">
                    <div class="checkmark draw"></div>
                </div>
                <p>تم بنجاح ✅</p>
            </div>

            <div class="c-progress-info">
                <span>ينتهي في: ${Utils.formatDisplayDate(customer.expire_date)}</span>
                <span style="font-weight:700">${expired ? 'انتهى منذ' : 'متبقي'} <b dir="ltr">${Math.abs(days)}</b> يوم</span>
            </div>
            <div class="c-progress-bg">
                <div class="c-progress-fill" style="width:${this.calcProgress(days)}%; background:${this.getBarColor(expired, urgent)}"></div>
            </div>
            <div class="c-actions">
                <button class="btn-action btn-wa">واتساب 💬</button>
                <button class="btn-action btn-call" onclick="window.location.href='tel:${customer.username}'">اتصال 📞</button>
            </div>
        `;

        const gear = card.querySelector('.btn-gear');
        const menu = card.querySelector('.c-action-menu');
        gear.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
        };

        card.querySelector('.btn-edit-trigger').onclick = () => { menu.classList.remove('active'); App.openManageModal(customer); };
        card.querySelector('.btn-renew-card-trigger').onclick = () => { menu.classList.remove('active'); App.openManageModal(customer); }; 
        card.querySelector('.btn-del-trigger').onclick = () => { menu.classList.remove('active'); App.startSafetyFlow(customer, 'delete'); };

        card.querySelector('.btn-wa').onclick = () => App.openTemplateModal(customer);
        return card;
    },
    calcProgress(days) {
        if (days === null) return 0;
        if (days <= 0) return 100;
        return Math.min(100, Math.max(5, (days / 30) * 100));
    },
    getBarColor(expired, urgent) {
        if (expired) return 'var(--danger)';
        if (urgent) return 'var(--warning)';
        return 'var(--primary)';
    },

    createResellerSubCard(sub, onRenew, onToggleStatus, onDelete) {
        const days = Utils.getRemainingDays(sub.expire_date);
        const expired = days !== null && days < 0;
        const disabled = sub.status === 'disabled';
        
        let statusClass = 'status-ok';
        let badgeText = 'نشط';
        let badgeClass = 'badge-active';

        if (disabled) {
            statusClass = 'status-err';
            badgeText = 'معطل';
            badgeClass = 'badge-expired';
        } else if (expired) {
            statusClass = 'status-err';
            badgeText = 'منتهي';
            badgeClass = 'badge-expired';
        } else if (days !== null && days <= 7) {
            statusClass = 'status-warn';
            badgeText = 'عاجل';
            badgeClass = 'badge-active'; 
        }

        const card = document.createElement('div');
        card.className = `c-card ${statusClass}`;
        card.innerHTML = `
            <div class="c-card-header">
                <div style="flex:1">
                    <div class="c-name" onclick="App.copyText('${sub.line_username}')">${sub.line_username}</div>
                    <div class="c-pass" onclick="App.copyText('${sub.line_password}')">Pass: ${sub.line_password}</div>
                    <div class="c-meta"><span class="meta-label">السيرفر:</span> ${sub.xtream_panels?.name || '---'}</div>
                    <div class="c-meta"><span class="meta-label">الخدمة:</span> ${sub.services?.service_name || '---'}</div>
                </div>
                <div class="c-header-actions">
                    <span class="c-badge ${badgeClass}">${badgeText}</span>
                    <div class="c-menu-wrapper">
                        <button class="btn-mini btn-gear">⚙️</button>
                        <div class="c-action-menu">
                            <button class="menu-item btn-renew-trigger"><span>🔄</span> تجديد الاشتراك (رصيد)</button>
                            <button class="menu-item btn-status-trigger">${disabled ? '<span>✅</span> تفعيل الحساب' : '<span>❌</span> تعطيل الحساب'}</button>
                            <button class="menu-item btn-delete-reseller-subdanger danger"><span>🗑️</span> حذف الحساب نهائياً</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="c-progress-info" style="margin-top:15px">
                <span>ينتهي في: ${Utils.formatDisplayDate(sub.expire_date)}</span>
                <span style="font-weight:700">${expired ? 'انتهى منذ' : 'متبقي'} <b dir="ltr">${Math.abs(days || 0)}</b> يوم</span>
            </div>
            <div class="c-progress-bg">
                <div class="c-progress-fill" style="width:${this.calcProgress(days)}%; background:${this.getBarColor(expired, days <= 7)}"></div>
            </div>
        `;

        const gear = card.querySelector('.btn-gear');
        const menu = card.querySelector('.c-action-menu');
        gear.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
        };

        card.querySelector('.btn-renew-trigger').onclick = () => {
            menu.classList.remove('active');
            onRenew(sub);
        };
        card.querySelector('.btn-status-trigger').onclick = () => {
            menu.classList.remove('active');
            onToggleStatus(sub, disabled ? 'enable' : 'disable');
        };
        card.querySelector('.btn-delete-reseller-subdanger').onclick = () => {
            menu.classList.remove('active');
            onDelete(sub);
        };

        return card;
    }
};

// --- MODULE 4: MAIN APP CONTROLLER ---
const App = {
    API_BASE: `${window.location.origin}`,

    state: {
        customers: [],
        currentCategory: 'IPTV',
        searchQuery: '',
        filterStatus: 'all',
        activeTimers: {},
        pageSize: 50,
        visibleCount: 50,
        analyticsChart: null,
        selectedCustomerForTemplate: null,
        selectedCustomer: null,
        dateFilter: '',
        
        session: {
            role: null,
            id: null,
            username: null,
            credits: 0.00
        },
        
        panels: [],
        resellers: [],
        services: [],
        logs: {
            subscriptions: [],
            transactions: []
        },
        
        resellerServices: [],
        resellerSubscriptions: []
    },

    config: {
        IPTV_TABLE: 'iptv_customers',
        DEFAULT_URL: window.APP_CONFIG?.SB_URL || '',
        DEFAULT_KEY: window.APP_CONFIG?.SB_KEY || ''
    },

    async init() {
        // Restore dark mode theme state for body and toggle icons
        const hasDark = localStorage.getItem('theme') === 'dark';
        if (hasDark) {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
            
            const toggleIcon = document.querySelector('#darkModeToggle i');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-sun';
            
            const loginToggleIcon = document.querySelector('#darkModeToggleLogin i');
            if (loginToggleIcon) loginToggleIcon.className = 'fa-solid fa-sun';
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
            
            const toggleIcon = document.querySelector('#darkModeToggle i');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-moon';
            
            const loginToggleIcon = document.querySelector('#darkModeToggleLogin i');
            if (loginToggleIcon) loginToggleIcon.className = 'fa-solid fa-moon';
        }

        this.checkSession();
        this.setupEventListeners();
        
        // Restore sidebar state cleanly
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (sidebar && mainContent) {
            if (localStorage.getItem('sidebar_collapsed') === 'true') {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
            } else {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
            }
        }
    },

    checkSession() {
        const role = localStorage.getItem('session_role');
        const sbUrl = localStorage.getItem('SB_URL');
        const userId = localStorage.getItem('session_user_id');

        if (userId === 'static-reseller-id' || userId === 'static-admin-id') {
            localStorage.removeItem('session_role');
            localStorage.removeItem('session_user_id');
            localStorage.removeItem('session_username');
            localStorage.removeItem('session_credits');
            this.showLoginScreen();
            return;
        }

        if (!sbUrl) {
            // No SB_URL needed in browser - Flask backend handles all Supabase calls
            localStorage.setItem('SB_URL', this.config.DEFAULT_URL || '');
        }

        if (role === 'admin' && userId) {
            this.state.session = {
                role: 'admin',
                id: userId,
                username: localStorage.getItem('session_username') || 'الآدمن',
                credits: 999999.00
            };
            this.showAdminDashboard();
        } else if (role === 'reseller' && userId) {
            this.state.session = {
                role: 'reseller',
                id: userId,
                username: localStorage.getItem('session_username'),
                credits: parseFloat(localStorage.getItem('session_credits') || '0.00')
            };
            this.showResellerDashboard();
        } else {
            this.showLoginScreen();
        }
    },

    showLoginScreen() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
    },

    showAdminDashboard() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        
        // Show Admin Only navigation items and hide Reseller Only
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.reseller-only').forEach(el => el.style.display = 'none');
        document.getElementById('mainContent').style.display = 'block';
        
        document.getElementById('navbar-credits-display').style.display = 'none';
        
        document.getElementById('navbar-username-val').innerText = this.state.session.username;
        document.getElementById('navbar-title').innerText = "Dashboard";

        // Set default active tab
        this.switchTab('tab-dashboard');

        this.initBackend();
        this.loadAdminData();
    },

    showResellerDashboard() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        
        // Hide Admin Only items and show Reseller Only
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.reseller-only').forEach(el => el.style.display = 'block');
        document.getElementById('mainContent').style.display = 'block';
        
        document.getElementById('navbar-credits-display').style.display = 'block';
        
        document.getElementById('navbar-username-val').innerText = this.state.session.username;
        document.getElementById('navbar-credits-val').innerText = parseFloat(this.state.session.credits).toFixed(2);
        document.getElementById('navbar-title').innerText = "Dashboard";

        // Set default active tab
        this.switchTab('tab-dashboard');

        this.initBackend();
        this.loadResellerData();
    },

    initBackend() {
        console.log("Secure mode: Supabase initialized and accessed only on backend.");
    },

    // --- UNIFIED TAB SWITCHER ---
    switchTab(targetTabId) {
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        const targetEl = document.getElementById(targetTabId);
        if (targetEl) targetEl.style.display = 'block';
        
        // Update active class in sidebar
        document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-tab-btn[data-target="${targetTabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update title
        const titles = {
            'tab-dashboard': 'Dashboard',
            'tab-add-user': 'Add User',
            'tab-manage-users': 'Manage Users',
            'tab-expiring-soon': 'Expiring Soon',
            'tab-add-mag': 'Add New MAG Device',
            'tab-manage-mags': 'Manage MAG Devices',
            'tab-add-e2': 'Add Enigma2 Receiver',
            'tab-manage-e2': 'Manage Enigma2 Devices',
            'tab-add-reseller': 'Create Sub-Reseller Account',
            'tab-manage-resellers': 'Manage Resellers List',
            'tab-admin-panels-services': 'الخوادم والباقات (Servers & Packages)',
            'tab-admin-codes': 'Manage Activation Codes Store',
            'tab-reseller-codes': 'Codes Store (متجر الأكواد)',
            'tab-activity-logs': 'Activity & Transaction Logs',
            'tab-profile': 'Profile & System Settings'
        };
        document.getElementById('navbar-title').innerText = titles[targetTabId] || 'Dashboard';
        
        // Tab specific loaders
        if (targetTabId === 'tab-admin-codes') {
            this.loadAdminCodesTab();
        } else if (targetTabId === 'tab-reseller-codes') {
            this.loadResellerCodesTab();
        } else if (targetTabId === 'tab-manage-users' && this.state.session.role === 'admin') {
            this.loadAdminLogs().then(() => this.renderAdminAllSubscriptions());
        }

        // Role-based visibility for shared tabs
        if (targetTabId === 'tab-add-user') {
            const isAdmin = this.state.session.role === 'admin';
            const adminCard = document.getElementById('admin-add-user-card');
            const resellerCard = document.getElementById('reseller-add-user-card');
            if (adminCard) adminCard.style.display = isAdmin ? 'block' : 'none';
            if (resellerCard) resellerCard.style.display = !isAdmin ? 'block' : 'none';
        } else if (targetTabId === 'tab-manage-users') {
            const isAdmin = this.state.session.role === 'admin';
            document.getElementById('admin-manage-users-card').style.display = isAdmin ? 'block' : 'none';
            document.getElementById('reseller-manage-users-card').style.display = !isAdmin ? 'block' : 'none';
        }

        // Force layout sync on tab switch
        const side = document.getElementById('sidebar');
        const main = document.getElementById('mainContent');
        if (side && main) {
            if (window.innerWidth > 992) {
                if (localStorage.getItem('sidebar_collapsed') === 'true') {
                    side.classList.add('collapsed');
                    main.classList.add('expanded');
                } else {
                    side.classList.remove('collapsed');
                    main.classList.remove('expanded');
                }
            } else {
                side.classList.remove('collapsed');
                main.classList.remove('expanded');
            }
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 992) {
            window.closeMobileSidebar();
        }
    },

    showResellerCreationLoading() {
        const modal = document.getElementById('reseller-creation-loading-modal');
        if (!modal) return;

        // Reset steps to initial state
        const steps = [
            { id: 'step-connect', text: 'Connecting to StreamCreed Server...' },
            { id: 'step-login', text: 'Logging in with credentials...' },
            { id: 'step-fill', text: 'Submitting subscriber details...' },
            { id: 'step-done', text: 'جاري التفعيل وخصم الرصيد...' }
        ];

        steps.forEach((s, idx) => {
            const el = document.getElementById(s.id);
            if (el) {
                el.className = 'loading-step mb-3 d-flex align-items-center ' + (idx === 0 ? 'text-white' : 'text-muted');
                el.querySelector('i').className = idx === 0 ? 'fa-solid fa-circle-notch fa-spin text-primary me-3' : 'fa-regular fa-circle me-3';
            }
        });

        modal.style.display = 'flex';

        // Start simulated timer sequence
        this.loadingTimer = setTimeout(() => {
            this.setLoadingStepDone('step-connect', 'step-login');
        }, 2500);

        this.loadingTimer2 = setTimeout(() => {
            this.setLoadingStepDone('step-login', 'step-fill');
        }, 5000);

        this.loadingTimer3 = setTimeout(() => {
            this.setLoadingStepDone('step-fill', 'step-done');
        }, 7500);
    },

    setLoadingStepDone(currentId, nextId) {
        const curEl = document.getElementById(currentId);
        if (curEl) {
            curEl.className = 'loading-step mb-3 d-flex align-items-center text-success';
            curEl.querySelector('i').className = 'fa-solid fa-circle-check me-3';
        }
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
            nextEl.className = 'loading-step mb-3 d-flex align-items-center text-white';
            nextEl.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin text-primary me-3';
        }
    },

    hideResellerCreationLoading() {
        const modal = document.getElementById('reseller-creation-loading-modal');
        if (modal) modal.style.display = 'none';
        clearTimeout(this.loadingTimer);
        clearTimeout(this.loadingTimer2);
        clearTimeout(this.loadingTimer3);
    },

    renderStatsContainer() {
        const container = document.getElementById('stats-container-dynamic');
        if (!container) return;

        const serverSelect = document.getElementById('stats-server-select');
        const filterContainer = document.getElementById('stats-server-filter-container');
        
        // Show/hide filter container
        if (filterContainer) {
            filterContainer.style.setProperty('display', 'flex', 'important');
        }

        // Dynamically populate server options if empty
        if (serverSelect && serverSelect.options.length <= 1) {
            const serverNames = new Set();
            if (this.state.session.role === 'admin') {
                this.state.panels.forEach(p => serverNames.add(p.name));
            } else {
                this.state.resellerServices.forEach(s => {
                    if (s.xtream_panels?.name) serverNames.add(s.xtream_panels.name);
                });
            }
            serverNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.innerText = name;
                serverSelect.appendChild(opt);
            });
            // Add onchange listener once
            serverSelect.onchange = () => this.renderStatsContainer();
        }

        const selectedServer = serverSelect ? serverSelect.value : 'all';

        if (this.state.session.role === 'admin') {
            // Filter admin subscriptions by server
            let filteredSubs = this.state.logs.subscriptions;
            if (selectedServer !== 'all') {
                filteredSubs = filteredSubs.filter(s => s.xtream_panels?.name === selectedServer);
            }

            // Sum credits of resellers
            const poolCredits = this.state.resellers.reduce((sum, r) => sum + parseFloat(r.credits || 0), 0);

            container.innerHTML = `
                <div class="stat-card" style="border-color: #198754;">
                    <i class="fa-solid fa-server stat-icon" style="color: #198754;"></i>
                    <div class="stat-value" id="admin-stat-total-panels">${this.state.panels.length}</div>
                    <div class="stat-label">Xtream Panels</div>
                </div>
                <div class="stat-card" style="border-color: #0d6efd;">
                    <i class="fa-solid fa-user-tie stat-icon" style="color: #0d6efd;"></i>
                    <div class="stat-value" id="admin-stat-total-resellers">${this.state.resellers.length}</div>
                    <div class="stat-label">Sub-Resellers</div>
                </div>
                <div class="stat-card" style="border-color: #6610f2;">
                    <i class="fa-solid fa-user-check stat-icon" style="color: #6610f2;"></i>
                    <div class="stat-value" id="admin-stat-total-subs">${filteredSubs.length}</div>
                    <div class="stat-label">Active Subscriptions ${selectedServer !== 'all' ? `(${selectedServer})` : ''}</div>
                </div>
                <div class="stat-card" style="border-color: #fd7e14;">
                    <i class="fa-solid fa-coins stat-icon" style="color: #fd7e14;"></i>
                    <div class="stat-value" id="admin-stat-total-credits">${poolCredits.toFixed(2)}</div>
                    <div class="stat-label">إجمالي أرصدة الموزعين</div>
                </div>
            `;
        } else {
            // Calculate Reseller Stats
            let total = 0, active = 0, expiring = 0;
            
            // Filter by server if selected
            let filteredSubs = this.state.resellerSubscriptions;
            if (selectedServer !== 'all') {
                filteredSubs = filteredSubs.filter(s => s.xtream_panels?.name === selectedServer);
            }

            filteredSubs.forEach(s => {
                total++;
                const days = Utils.getRemainingDays(s.expire_date);
                if (s.status === 'active' && days !== null && days >= 0) {
                    active++;
                    if (days <= 7) expiring++;
                } else {
                    expiring++;
                }
            });

            container.innerHTML = `
                <div class="stat-card" style="border-color: #198754;">
                    <i class="fa-solid fa-coins stat-icon" style="color: #198754;"></i>
                    <div class="stat-value" id="reseller-stat-credits">${parseFloat(this.state.session.credits).toFixed(2)}</div>
                    <div class="stat-label">رصيدك بالجنيه</div>
                </div>
                <div class="stat-card" style="border-color: #0d6efd;">
                    <i class="fa-solid fa-list-ol stat-icon" style="color: #0d6efd;"></i>
                    <div class="stat-value" id="reseller-stat-total-lines">${total}</div>
                    <div class="stat-label">Total Lines</div>
                </div>
                <div class="stat-card" style="border-color: #0dcaf0;">
                    <i class="fa-solid fa-wifi stat-icon" style="color: #0dcaf0;"></i>
                    <div class="stat-value">0</div>
                    <div class="stat-label">Online Now</div>
                </div>
                <div class="stat-card" style="border-color: #6610f2;">
                    <i class="fa-solid fa-user-check stat-icon" style="color: #6610f2;"></i>
                    <div class="stat-value" id="reseller-stat-active-lines">${active}</div>
                    <div class="stat-label">Active Lines</div>
                </div>
                <div class="stat-card" style="border-color: #fd7e14;">
                    <i class="fa-solid fa-clock stat-icon" style="color: #fd7e14;"></i>
                    <div class="stat-value" id="reseller-stat-expiring-lines">${expiring}</div>
                    <div class="stat-label">Expiring Soon</div>
                </div>
            `;
        }
    },

    // --- DATA LOADING FLOWS ---
    
    async loadAdminData() {
        const isFlask = window.location.protocol.startsWith('http');
        if (isFlask) {
            this.sync();
            await this.loadAdminPanels();
            await this.loadAdminResellers();
            await this.loadAdminServices();
            await this.loadAdminLogs();
            return;
        }

        if (!SupabaseService.client) {
            // Mock data for Design Mode testing
            this.state.panels = [
                { id: 1, name: 'سيرفر MH - الرئيسي', domain_url: 'http://mh-panel.com:8080', api_username: 'mh_admin', status: 'active' },
                { id: 2, name: 'سيرفر Alfa - الاحتياطي', domain_url: 'http://alfa.to', api_username: 'alfa_root', status: 'inactive' }
            ];
            this.state.resellers = [
                { id: 'r1', username: 'mohanad_reseller', credits: 450.00, status: 'active', created_at: new Date().toISOString() },
                { id: 'r2', username: 'bahe_reseller', credits: 20.00, status: 'suspended', created_at: new Date().toISOString() }
            ];
            this.state.services = [
                { id: 1, service_name: 'MH - 1 Month (باقة شهرية)', package_id: '12', cost_credits: 1.0, xtream_panels: { name: 'سيرفر MH - الرئيسي' } },
                { id: 2, service_name: 'Alfa - 12 Months (باقة سنوية)', package_id: '45', cost_credits: 10.0, xtream_panels: { name: 'سيرفر Alfa - الاحتياطي' } }
            ];
            this.state.logs.subscriptions = [
                { id: 's1', users: { username: 'mohanad_reseller' }, xtream_panels: { name: 'سيرفر MH - الرئيسي' }, services: { service_name: 'MH - 1 Month' }, line_username: 'client_honda', line_password: 'pwd', credits_deducted: 1.0, expire_date: '2026-07-29', created_at: new Date().toISOString() }
            ];
            this.state.logs.transactions = [
                { id: 't1', users: { username: 'mohanad_reseller' }, action_type: 'deposit', amount: 500.0, description: 'شحن رصيد تجريبي من المسؤول', created_at: new Date().toISOString() }
            ];
            
            this.renderAdminPanels();
            this.renderAdminResellers();
            this.renderAdminServices();
            this.renderAdminLogs();
            this.populatePanelsDropdown();
            
            this.renderStatsContainer();
            
            this.state.customers = [
                { id: 'c1', username: 'ahmed_iptv', password: '123', expire_date: '2026-10-15', phone_number: '01012345678', note: 'عميل باقة MH' },
                { id: 'c2', username: 'sami_egy', password: '456', expire_date: '2026-06-25', mac_address: '11:22:33:44:55:66', note: 'عميل باقة Alfa' }
            ];
            this.render();
            return;
        }
        this.sync();
        this.loadAdminPanels();
        this.loadAdminResellers();
        this.loadAdminServices();
        this.loadAdminLogs();
    },

    async loadAdminPanels() {
        const isFlask = window.location.protocol.startsWith('http');
        if (!SupabaseService.client && !isFlask) {
            this.renderAdminPanels();
            this.populatePanelsDropdown();
            this.renderStatsContainer();
            return;
        }

        if (isFlask) {
            try {
                const res = await fetch('/api/panels');
                const data = await res.json();
                if (data.success) {
                    this.state.panels = data.panels;
                    this.renderAdminPanels();
                    this.populatePanelsDropdown();
                    this.renderStatsContainer();
                }
            } catch (e) {
                console.error("Failed to load panels:", e);
            }
            return;
        }

        const { data, error } = await SupabaseService.client.from('xtream_panels').select('*').order('id', { ascending: true });
        if (!error) {
            this.state.panels = data;
            this.renderAdminPanels();
            this.populatePanelsDropdown();
            this.renderStatsContainer();
        }
    },

    async loadAdminResellers() {
        try {
            const res = await fetch('/api/admin/resellers');
            const data = await res.json();
            this.state.resellers = data;
            this.renderAdminResellers();
            this.renderStatsContainer();
        } catch (e) {
            console.error("Failed to load admin resellers:", e);
        }
    },

    async loadAdminServices() {
        try {
            const res = await fetch('/api/admin/services');
            const data = await res.json();
            this.state.services = data;
            this.renderAdminServices();
        } catch (e) {
            console.error("Failed to load admin services:", e);
        }
    },

    async loadAdminLogs() {
        try {
            const res = await fetch('/api/admin/logs');
            const data = await res.json();
            this.state.logs.subscriptions = data.subscriptions || [];
            this.state.logs.transactions = data.transactions || [];
            this.renderAdminLogs();
            this.renderStatsContainer();
        } catch (e) {
            console.error("Failed to load admin logs:", e);
        }
    },

    async loadResellerData() {
        const isFlask = window.location.protocol.startsWith('http');
        if (isFlask) {
            try {
                const res = await fetch(`/api/reseller/data?reseller_id=${this.state.session.id}`);
                const data = await res.json();
                if (data.success) {
                    this.state.resellerServices = data.services;
                    this.state.resellerSubscriptions = data.subscriptions;
                    this.state.session.credits = parseFloat(data.credits);
                    localStorage.setItem('session_credits', data.credits);
                    
                    this.renderResellerServicesDropdown();
                    this.renderResellerXtreamServers();
                    this.renderResellerSubscriptions();
                    this.renderStatsContainer();
                    return;
                }
            } catch (e) {
                console.error("Failed to load reseller data from Flask, falling back to mock:", e);
            }
        }

        if (!SupabaseService.client) {
            // Mock data for Reseller Design Mode testing with actual package details
            this.state.resellerServices = [
                { id: 10, service_name: 'TEST 24 HOURS ALL CHANNEL', cost_credits: 0.0, xtream_panels: { name: 'MH IPTV Server' } },
                { id: 54, service_name: '3 Months ALL CHANNEL', cost_credits: 1.0, xtream_panels: { name: 'MH IPTV Server' } },
                { id: 55, service_name: '6 Months ALL CHANNEL', cost_credits: 2.0, xtream_panels: { name: 'MH IPTV Server' } },
                { id: 56, service_name: '12 Months ALL CHANNEL', cost_credits: 4.0, xtream_panels: { name: 'MH IPTV Server' } },
                { id: 119, service_name: '15 Months ALL CHANNEL', cost_credits: 5.0, xtream_panels: { name: 'MH IPTV Server' } }
            ];
            this.renderResellerServicesDropdown();
            this.renderResellerXtreamServers();
            
            this.state.resellerSubscriptions = [
                { id: 'rs1', line_username: 'medo_user_m3u', line_password: 'pwd', xtream_panels: { name: 'MH IPTV Server' }, services: { service_name: '12 Months ALL CHANNEL' }, expire_date: '2027-06-29', status: 'active', created_at: new Date().toISOString() },
                { id: 'rs2', line_username: 'test_demo_line', line_password: 'pwd', xtream_panels: { name: 'MH IPTV Server' }, services: { service_name: 'TEST 24 HOURS ALL CHANNEL' }, expire_date: '2026-06-30', status: 'active', created_at: new Date().toISOString() }
            ];
            this.renderResellerSubscriptions();
            
            this.renderStatsContainer();
            return;
        }

        const { data: services, error: errS } = await SupabaseService.client
            .from('services')
            .select('*, xtream_panels(name)')
            .eq('status', 'active');
        if (!errS) {
            this.state.resellerServices = services;
            this.renderResellerServicesDropdown();
            this.renderResellerXtreamServers();
        }

        const { data: resData, error: errR } = await SupabaseService.client
            .from('users')
            .select('credits')
            .eq('id', this.state.session.id)
            .single();
        if (!errR && resData) {
            this.state.session.credits = parseFloat(resData.credits);
            localStorage.setItem('session_credits', resData.credits);
            
            // Update indicators
            document.getElementById('navbar-credits-val').innerText = parseFloat(resData.credits).toFixed(2);
        }

        this.loadResellerSubscriptions();
    },

    async loadResellerSubscriptions() {
        const isFlask = window.location.protocol.startsWith('http');
        if (isFlask) {
            // Already loaded via loadResellerData in local mode, just render
            this.renderResellerSubscriptions();
            this.renderStatsContainer();
            return;
        }

        if (!SupabaseService.client) return;

        const { data: subs, error: errSub } = await SupabaseService.client
            .from('subscriptions_log')
            .select('*, xtream_panels(name), services(service_name)')
            .eq('sub_reseller_id', this.state.session.id)
            .order('created_at', { ascending: false });

        if (!errSub) {
            this.state.resellerSubscriptions = subs;
            this.renderResellerSubscriptions();
            this.renderStatsContainer();
        }
    },

    // --- RENDER FUNCTIONS FOR TABLES & LISTS ---
    
    renderAdminPanels() {
        const list = document.getElementById('admin-panels-list');
        if (!list) return;
        list.innerHTML = this.state.panels.map(p => `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td><code style="font-size:0.85rem">${p.domain_url}</code></td>
                <td>${p.api_username}</td>
                <td><span class="badge-status ${p.status === 'active' ? 'active' : 'inactive'}">${p.status === 'active' ? 'نشط' : 'متوقف'}</span></td>
                <td>
                    <div class="action-row-btns">
                        <button class="btn-small" onclick="App.testPanelConnection(${p.id})"><i class="fa-solid fa-signal"></i> اختبار الاتصال</button>
                        <button class="btn-small" style="background: var(--primary)" onclick="App.startEditPanel(${p.id})"><i class="fa-solid fa-pen-to-square"></i> تعديل ✏️</button>
                        <button class="btn-small danger" onclick="App.deletePanel(${p.id})"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    renderAdminResellers() {
        const list = document.getElementById('admin-resellers-list');
        if (!list) return;
        list.innerHTML = this.state.resellers.map(r => {
            const statusClass = r.status === 'active' ? 'active' : 'suspended';
            const statusText = r.status === 'active' ? 'نشط' : 'موقوف';
            const creditsVal = parseFloat(r.credits || 0).toFixed(2);

            return `
                <tr>
                    <td><strong style="cursor: pointer; color: var(--primary);" onclick="App.openResellerDetailsModal('${r.id}')">${r.username} 🔍</strong></td>
                    <td><span style="color:var(--success); font-weight:800; font-size:1.05rem">${creditsVal}</span> ج.م</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>${new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    <td class="text-end">
                        <div class="actions-cell">
                            <button class="btn-reseller-action btn-add-credit" title="شحن الرصيد 💳" onclick="App.openChargeResellerModal('${r.id}', '${r.username}', ${creditsVal})"><i class="fa-solid fa-coins"></i></button>
                            <button class="btn-reseller-action btn-pass" title="تعديل البيانات ✏️" onclick="App.startEditReseller('${r.id}', '${r.username}', ${creditsVal})"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="btn-reseller-action btn-block" title="تغيير الحالة" onclick="App.toggleResellerStatus('${r.id}', '${r.status}')"><i class="fa-solid ${r.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off'}"></i></button>
                            <button class="btn-reseller-action btn-delete" title="حذف الحساب" onclick="App.deleteReseller('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async openResellerDetailsModal(resellerId) {
        this.showToast("جاري تحميل تفاصيل الموزع... ⏳");
        try {
            const res = await fetch(`/api/admin/reseller/details?reseller_id=${resellerId}`);
            const data = await res.json();
            if (data.success) {
                document.getElementById('det-reseller-username').innerText = data.reseller.username;
                document.getElementById('det-reseller-credits').innerText = parseFloat(data.reseller.credits).toFixed(2) + " ج.م";

                // Subscriptions
                const subList = document.getElementById('det-reseller-subscriptions');
                if (subList) {
                    subList.innerHTML = data.subscriptions.length === 0 ? 
                        `<tr><td colspan="7" class="text-center text-muted">لا توجد اشتراكات مفعّلة</td></tr>` :
                        data.subscriptions.map(s => `
                            <tr>
                                <td>${s.xtream_panels?.name || '---'}</td>
                                <td><code onclick="App.copyText('${s.line_username}')" style="cursor:pointer; color:var(--primary)">${s.line_username} 📋</code></td>
                                <td><code>${s.line_password}</code></td>
                                <td>${s.services?.service_name || '---'}</td>
                                <td><span style="color:var(--danger)">-${s.credits_deducted}</span></td>
                                <td>${Utils.formatDisplayDate(s.expire_date)}</td>
                                <td style="font-size:0.75rem">${new Date(s.created_at).toLocaleString('ar-EG')}</td>
                            </tr>
                        `).join('');
                }

                // Codes
                const codeList = document.getElementById('det-reseller-codes');
                if (codeList) {
                    codeList.innerHTML = data.purchased_codes.length === 0 ?
                        `<tr><td colspan="4" class="text-center text-muted">لا توجد أكواد مشتراة</td></tr>` :
                        data.purchased_codes.map(c => `
                            <tr>
                                <td><strong>${c.code_categories?.name || '---'}</strong></td>
                                <td><code onclick="App.copyText('${c.code}')" style="cursor:pointer; color:var(--primary)">${c.code} 📋</code></td>
                                <td><span style="font-weight:700; color:var(--warning)">${c.price}</span> ج.م</td>
                                <td style="font-size:0.75rem">${c.sold_at ? new Date(c.sold_at).toLocaleString('ar-EG') : '---'}</td>
                            </tr>
                        `).join('');
                }

                // Transactions
                const txList = document.getElementById('det-reseller-transactions');
                if (txList) {
                    txList.innerHTML = data.transactions.length === 0 ?
                        `<tr><td colspan="4" class="text-center text-muted">لا توجد عمليات شحن رصيد</td></tr>` :
                        data.transactions.map(t => {
                            const isDeposit = t.action_type === 'deposit';
                            const isRefund = t.action_type === 'refund';
                            const color = isDeposit ? 'var(--success)' : (isRefund ? '#0dcaf0' : 'var(--danger)');
                            const amountText = isDeposit ? `+${t.amount}` : `${t.amount}`;
                            return `
                                <tr>
                                    <td><span class="badge-status" style="background:rgba(255,255,255,0.05); color:${color}">${t.action_type === 'deposit' ? 'شحن رصيد' : (t.action_type === 'refund' ? 'استرجاع رصيد' : 'سحب/شراء')}</span></td>
                                    <td><span style="font-weight:800; color:${color}">${amountText}</span></td>
                                    <td>${t.description || '---'}</td>
                                    <td style="font-size:0.75rem">${new Date(t.created_at).toLocaleString('ar-EG')}</td>
                                </tr>
                            `;
                        }).join('');
                }

                document.getElementById('reseller-details-modal').classList.add('active');
            } else {
                alert(`فشل تحميل التفاصيل: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    closeResellerDetailsModal() {
        document.getElementById('reseller-details-modal').classList.remove('active');
    },

    renderAdminServices() {
        const list = document.getElementById('admin-services-list');
        if (!list) return;
        list.innerHTML = this.state.services.map(s => `
            <tr>
                <td><strong>${s.service_name}</strong></td>
                <td><span class="badge-status active">${s.xtream_panels?.name || '---'}</span></td>
                <td><code>${s.package_id}</code></td>
                <td><span style="font-weight:700; color:var(--warning)">${s.cost_credits}</span> ج.م</td>
                <td>
                    <div class="action-row-btns">
                        <button class="btn-small" style="background: var(--primary); color: #fff;" onclick="App.editServicePricePrompt(${s.id}, ${s.cost_credits})"><i class="fa-solid fa-pen-to-square"></i> تعديل السعر</button>
                        <button class="btn-small danger" onclick="App.deleteService(${s.id})"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    renderAdminLogs() {
        const subList = document.getElementById('admin-logs-subscriptions');
        const txList = document.getElementById('admin-logs-transactions');
        
        if (subList) {
            subList.innerHTML = this.state.logs.subscriptions.map(s => `
                <tr>
                    <td><strong>${s.users?.username || '---'}</strong></td>
                    <td>${s.xtream_panels?.name || '---'}</td>
                    <td><code onclick="App.copyText('${s.line_username}')" style="cursor:pointer; color:var(--primary)">${s.line_username} 📋</code></td>
                    <td><code>${s.line_password}</code></td>
                    <td>${s.services?.service_name || '---'}</td>
                    <td><span style="color:var(--danger)">-${s.credits_deducted}</span></td>
                    <td>${Utils.formatDisplayDate(s.expire_date)}</td>
                    <td style="font-size:0.75rem">${new Date(s.created_at).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        }

        if (txList) {
            txList.innerHTML = this.state.logs.transactions.map(t => {
                const isDeposit = t.action_type === 'deposit';
                const isRefund = t.action_type === 'refund';
                const color = isDeposit ? 'var(--success)' : (isRefund ? '#0dcaf0' : 'var(--danger)');
                const amountText = isDeposit ? `+${t.amount}` : `${t.amount}`;
                
                return `
                    <tr>
                        <td><strong>${t.users?.username || '---'}</strong></td>
                        <td><span class="badge-status" style="background:rgba(255,255,255,0.05); color:${color}">${t.action_type === 'deposit' ? 'شحن رصيد' : (t.action_type === 'refund' ? 'استرجاع رصيد' : 'سحب/شراء')}</span></td>
                        <td><span style="font-weight:800; color:${color}">${amountText}</span></td>
                        <td>${t.description || '---'}</td>
                        <td style="font-size:0.75rem">${new Date(t.created_at).toLocaleString('ar-EG')}</td>
                    </tr>
                `;
            }).join('');
        }
    },

    renderAdminAllSubscriptions() {
        const list = document.getElementById('admin-all-subscriptions-list');
        if (!list) return;

        const query = (this.state.adminSearchQuery || '').toLowerCase().trim();
        const filter = this.state.adminFilterStatus || 'all';

        let filtered = this.state.logs.subscriptions.filter(s => {
            const reseller = (s.users?.username || s.reseller_id || '').toLowerCase();
            const username = (s.line_username || '').toLowerCase();
            const password = (s.line_password || '').toLowerCase();
            const server = (s.xtream_panels?.name || '').toLowerCase();
            const serviceName = (s.services?.service_name || '').toLowerCase();

            const matchesQuery = reseller.includes(query) || 
                                 username.includes(query) || 
                                 password.includes(query) || 
                                 server.includes(query) || 
                                 serviceName.includes(query);

            const days = Utils.getRemainingDays(s.expire_date);
            const isExpired = days !== null && days < 0;

            let matchesFilter = true;
            if (filter === 'active') matchesFilter = !isExpired;
            else if (filter === 'expired') matchesFilter = isExpired;

            return matchesQuery && matchesFilter;
        });

        const countEl = document.getElementById('admin-subs-count');
        if (countEl) countEl.innerText = filtered.length;

        list.innerHTML = filtered.map(s => {
            const days = Utils.getRemainingDays(s.expire_date);
            const isExpired = days !== null && days < 0;
            const statusClass = s.status === 'active' ? 'active' : 'suspended';
            const statusText = s.status === 'active' ? 'نشط' : 'معطل';

            let daysBadge = '';
            if (days === null) {
                daysBadge = `<span class="badge bg-secondary">غير محدد</span>`;
            } else if (isExpired) {
                daysBadge = `<span class="badge bg-danger">منتهي (${Math.abs(days)} يوم)</span>`;
            } else if (days <= 7) {
                daysBadge = `<span class="badge bg-warning text-dark">${days} يوم</span>`;
            } else {
                daysBadge = `<span class="badge bg-success">${days} يوم</span>`;
            }

            return `
                <tr>
                    <td><strong>${s.users?.username || s.reseller_id || '---'}</strong></td>
                    <td><code onclick="App.copyText('${s.line_username}')" style="cursor:pointer; color:var(--primary)">${s.line_username} 📋</code></td>
                    <td><code>${s.line_password}</code></td>
                    <td>${s.xtream_panels?.name || '---'}</td>
                    <td>${s.services?.service_name || '---'}</td>
                    <td>${Utils.formatDisplayDate(s.expire_date)}</td>
                    <td>${daysBadge}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-row-btns">
                            <button class="btn btn-sm btn-info text-white" id="admin-btn-renew-${s.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">تجديد 🔄</button>
                            <button class="btn btn-sm ${s.status === 'active' ? 'btn-warning text-dark' : 'btn-success'}" id="admin-btn-toggle-${s.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">
                                ${s.status === 'active' ? 'تعطيل ❌' : 'تفعيل ✅'}
                            </button>
                            <button class="btn btn-sm btn-danger" id="admin-btn-delete-${s.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">حذف 🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind events programmatically
        filtered.forEach(s => {
            const renewBtn = document.getElementById(`admin-btn-renew-${s.id}`);
            if (renewBtn) {
                renewBtn.onclick = () => this.adminRenewSubscriptionPrompt(s);
            }

            const toggleBtn = document.getElementById(`admin-btn-toggle-${s.id}`);
            if (toggleBtn) {
                toggleBtn.onclick = () => this.adminToggleSubscriptionStatus(s, s.status === 'active' ? 'disable' : 'enable');
            }

            const deleteBtn = document.getElementById(`admin-btn-delete-${s.id}`);
            if (deleteBtn) {
                deleteBtn.onclick = () => this.adminDeleteSubscription(s);
            }
        });
    },

    exportAdminSubscriptionsToExcel() {
        const query = (this.state.adminSearchQuery || '').toLowerCase().trim();
        const filter = this.state.adminFilterStatus || 'all';

        let filtered = this.state.logs.subscriptions.filter(s => {
            const reseller = (s.users?.username || s.reseller_id || '').toLowerCase();
            const username = (s.line_username || '').toLowerCase();
            const password = (s.line_password || '').toLowerCase();
            const server = (s.xtream_panels?.name || '').toLowerCase();
            const serviceName = (s.services?.service_name || '').toLowerCase();

            const matchesQuery = reseller.includes(query) || 
                                 username.includes(query) || 
                                 password.includes(query) || 
                                 server.includes(query) || 
                                 serviceName.includes(query);

            const days = Utils.getRemainingDays(s.expire_date);
            const isExpired = days !== null && days < 0;

            let matchesFilter = true;
            if (filter === 'active') matchesFilter = !isExpired;
            else if (filter === 'expired') matchesFilter = isExpired;

            return matchesQuery && matchesFilter;
        });

        const dataToExport = filtered.map(s => ({
            "الموزع": s.users?.username || s.reseller_id || '---',
            "اسم المستخدم": s.line_username,
            "كلمة المرور": s.line_password,
            "السيرفر": s.xtream_panels?.name || '---',
            "الباقة": s.services?.service_name || '---',
            "تاريخ الانتهاء": s.expire_date,
            "الحالة": s.status === 'active' ? 'نشط' : 'معطل',
            "تاريخ الإنشاء": new Date(s.created_at).toLocaleDateString('ar-EG')
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");
        XLSX.writeFile(workbook, `Reseller_Subscriptions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },

    async adminToggleSubscriptionStatus(sub, action) {
        const arabicAction = action === 'enable' ? 'تفعيل' : 'تعطيل';
        if (!confirm(`هل أنت متأكد من رغبتك في ${arabicAction} اشتراك العميل (${sub.line_username})؟`)) return;

        this.showToast(`جاري إرسال أمر الـ ${arabicAction} للسيرفر... 📡`);
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    action: action
                })
            });
            const result = await response.json();
            if (result.success) {
                this.showToast(`تم ${arabicAction} الحساب بنجاح! ✅`);
                await this.loadAdminLogs();
                this.renderAdminAllSubscriptions();
            } else {
                alert(`فشلت العملية على السيرفر: ${result.error}`);
            }
        } catch (err) {
            alert(`خطأ في الاتصال بالخادم الوسيط: ${err.message}`);
        }
    },

    async adminDeleteSubscription(sub) {
        if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف اشتراك العميل (${sub.line_username}) نهائياً من السيرفر وفي قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء ولا يتم استرجاع الج.م.`)) return;

        this.showToast("جاري حذف الحساب من السيرفر... 🗑️");
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    action: 'delete'
                })
            });
            const result = await response.json();
            if (result.success) {
                this.showToast("تم حذف الحساب نهائياً بنجاح! ✅");
                await this.loadAdminLogs();
                this.renderAdminAllSubscriptions();
            } else {
                alert(`فشلت العملية على السيرفر: ${result.error}`);
            }
        } catch (err) {
            alert(`خطأ في الاتصال بالخادم الوسيط: ${err.message}`);
        }
    },

    async adminRenewSubscriptionPrompt(sub) {
        const panelId = sub.panel_id || sub.xtream_panels?.id || 1;
        const options = this.state.services.filter(s => (s.panel_id || s.xtream_panels?.id || 1) === panelId);
        if (options.length === 0) return alert("لا توجد خدمات تجديد مضافة لهذا السيرفر حالياً!");

        let promptText = "اختر الباقة المناسبة للتجديد:\n";
        options.forEach((s, idx) => {
            promptText += `[${idx + 1}] ${s.service_name} - التكلفة: ${s.cost_credits} ج.م\n`;
        });
        
        const selectionStr = prompt(promptText + "\nاكتب رقم الخيار المحدد للتجديد (مثال: 1):");
        if (!selectionStr) return;

        const idx = parseInt(selectionStr) - 1;
        if (isNaN(idx) || idx < 0 || idx >= options.length) {
            return alert("الخيار المكتوب غير صالح!");
        }

        const selectedService = options[idx];
        
        let days = 30;
        if (selectedService.service_name.includes("12") || selectedService.service_name.includes("Year") || selectedService.service_name.includes("سنة")) {
            days = 365;
        } else if (selectedService.service_name.includes("6")) {
            days = 180;
        } else if (selectedService.service_name.includes("3")) {
            days = 90;
        }

        this.showToast("جاري إرسال طلب التجديد للمخدم... ⏳");
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    service_id: selectedService.id,
                    additional_days: days
                })
            });
            const result = await response.json();
            if (result.success) {
                alert("🎉 تم تجديد الاشتراك وتمديده بنجاح على السيرفر!");
                await this.loadAdminLogs();
                this.renderAdminAllSubscriptions();
            } else {
                alert(`❌ فشل التجديد: ${result.error}`);
            }
        } catch (err) {
            alert(`خطأ في شبكة الخادم الوسيط: ${err.message}`);
        }
    },

    populatePanelsDropdown() {
        const select = document.getElementById('service-panel-id');
        if (!select) return;
        select.innerHTML = '<option value="">اختر السيرفر...</option>' + 
            this.state.panels.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    },

    renderResellerServicesDropdown() {
        const select = document.getElementById('reseller-select-service');
        if (!select) return;
        select.innerHTML = '<option value="">-- اختر باقة السيرفر المطلوبة --</option>' + 
            this.state.resellerServices.map(s => `
                <option value="${s.id}">${s.service_name} (${s.xtream_panels?.name}) - التكلفة: ${s.cost_credits} ج.م
            `).join('');
    },

    renderResellerXtreamServers() {
        const grid = document.getElementById('reseller-xtream-servers-grid');
        if (!grid) return;
        
        const serversMap = new Map();
        this.state.resellerServices.forEach(s => {
            const panel = s.xtream_panels;
            if (panel) {
                const id = panel.id || 1;
                const name = panel.name || "MH IPTV Server";
                if (!serversMap.has(id)) {
                    serversMap.set(id, { id, name, services: [] });
                }
                serversMap.get(id).services.push(s);
            }
        });
        const servers = Array.from(serversMap.values());

        if (servers.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center text-secondary py-4">No servers available.</div>';
            return;
        }

        grid.innerHTML = servers.map(srv => `
            <div class="col-md-4 mb-4">
                <div class="dashboard-section-card h-100 text-center d-flex flex-column justify-content-between" style="border-top: 3px solid var(--primary) !important;">
                    <div class="p-2">
                        <div class="mb-3" style="font-size: 2.5rem; color: var(--primary);"><i class="fa-solid fa-server"></i></div>
                        <h4 class="font-weight-bold mb-2">${srv.name}</h4>
                        <div class="mb-3">
                            <span class="badge bg-secondary">${srv.services.length} Packages Available</span>
                        </div>
                    </div>
                    <button class="btn-primary w-100 mt-2" 
                            id="btn-open-server-${srv.id}">
                        دخول السيرفر 🔌
                    </button>
                </div>
            </div>
        `).join('');

        servers.forEach(srv => {
            const btn = document.getElementById(`btn-open-server-${srv.id}`);
            if (btn) {
                btn.onclick = () => {
                    this.openXtreamCreateModal(srv);
                };
            }
        });
    },

    openXtreamCreateModal(server) {
        const modal = document.getElementById('reseller-xtream-create-modal');
        if (!modal) return;

        document.getElementById('xtream-modal-title').innerText = `${server.name}`;
        
        // Reset fields
        document.getElementById('reseller-new-username').value = '';
        document.getElementById('reseller-new-password').value = '';
        document.getElementById('reseller-notes').value = '';

        // Store server services map for price lookup
        this._currentServerServices = server.services || [];

        // Populate dropdown with this server's services only
        const select = document.getElementById('reseller-select-service');
        if (select) {
            select.innerHTML = '<option value="">-- اختر الباقة المطلوبة --</option>' + 
                server.services.map(s => {
                    const isTrial = parseFloat(s.cost_credits) === 0 || s.service_name.toLowerCase().includes('test');
                    const priceLabel = isTrial ? '🎁 مجاني' : `${parseFloat(s.cost_credits).toFixed(0)} ج.م`;
                    return `<option value="${s.id}" data-cost="${s.cost_credits}" data-name="${s.service_name}">${s.service_name} — ${priceLabel}</option>`;
                }).join('');

            // Bind price preview on change
            select.onchange = () => {
                const opt = select.options[select.selectedIndex];
                const cost = parseFloat(opt.dataset.cost || '0');
                const name = opt.dataset.name || '';
                const priceBox = document.getElementById('service-price-preview');
                if (!priceBox) return;
                if (!opt.value) {
                    priceBox.innerHTML = '';
                    priceBox.style.display = 'none';
                    return;
                }
                const isTrial = cost === 0 || name.toLowerCase().includes('test');
                
                // Align the hidden line type dropdown value so payload is correct
                const lineTypeEl = document.getElementById('reseller-line-type');
                if (lineTypeEl) {
                    lineTypeEl.value = isTrial ? 'trial' : 'official';
                }

                const myBalance = parseFloat(this.state.session.credits || 0);
                const canAfford = isTrial || myBalance >= cost;
                priceBox.style.display = 'block';
                priceBox.innerHTML = isTrial
                    ? `<div class="price-preview-badge free">🎁 تجريبي مجاني</div>`
                    : `<div class="price-preview-badge ${canAfford ? 'ok' : 'danger'}">
                         <span class="price-label">💰 السعر:</span>
                         <strong>${cost.toFixed(0)} ج.م</strong>
                         ${canAfford
                           ? `<span class="balance-after">رصيدك بعد الشراء: ${(myBalance - cost).toFixed(2)} ج.م</span>`
                           : `<span class="balance-warn">⚠️ رصيدك (${myBalance.toFixed(2)} ج.م) غير كافٍ!</span>`}
                       </div>`;
            };
        }

        modal.style.display = 'flex';

        // Bind generator buttons
        const genUser = document.getElementById('btn-gen-reseller-username');
        if (genUser) {
            genUser.onclick = () => {
                document.getElementById('reseller-new-username').value = 'u' + Utils.generateRandomString(6);
            };
        }

        const genPass = document.getElementById('btn-gen-reseller-password');
        if (genPass) {
            genPass.onclick = () => {
                document.getElementById('reseller-new-password').value = Utils.generateRandomString(8);
            };
        }

        // Bind cancel
        const cancelBtn = document.getElementById('btn-cancel-xtream-create');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                const priceBox = document.getElementById('service-price-preview');
                if (priceBox) { priceBox.innerHTML = ''; priceBox.style.display = 'none'; }
            };
        }

        // Bind submit form
        const form = document.getElementById('reseller-create-line-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                modal.style.display = 'none'; // Hide first so creation loading shows nicely
                this.handleResellerCreateSub();
            };
        }
    },

    renderResellerSubscriptions() {
        const tbody = document.getElementById('reseller-customer-list-body');
        const countIndicator = document.getElementById('reseller-sub-count');
        if (!tbody) return;

        const query = document.getElementById('reseller-search-input')?.value.toLowerCase().trim() || '';
        const filtered = this.state.resellerSubscriptions.filter(sub => {
            return sub.line_username.toLowerCase().includes(query);
        });

        if (countIndicator) countIndicator.innerText = `العدد: ${filtered.length}`;

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-low-light)">لا توجد اشتراكات مطابقة لعملية البحث</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(sub => {
            const days = Utils.getRemainingDays(sub.expire_date);
            const expired = days !== null && days < 0;
            const disabled = sub.status === 'disabled';
            
            let badgeText = 'نشط';
            let badgeStyle = 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981;';
            if (disabled) {
                badgeText = 'معطل';
                badgeStyle = 'background: rgba(108, 117, 125, 0.1); color: #6c757d; border: 1px solid #6c757d;';
            } else if (expired) {
                badgeText = 'منتهي';
                badgeStyle = 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444;';
            } else if (days !== null && days <= 7) {
                badgeText = 'عاجل';
                badgeStyle = 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid #f59e0b;';
            }

            const expireDisplay = Utils.formatDisplayDate(sub.expire_date);
            const remainingText = expired ? `منتهي منذ <b dir="ltr">${Math.abs(days || 0)}</b> يوم` : `<b dir="ltr">${Math.abs(days || 0)}</b> يوم`;

            return `
                <tr>
                    <td class="fw-bold" style="cursor:pointer;" onclick="App.copyText('${sub.line_username}')" title="اضغط لنسخ اسم المستخدم">
                        ${sub.line_username} <i class="fa-solid fa-copy text-info ms-1" style="font-size:0.8rem;"></i>
                    </td>
                    <td style="cursor:pointer;" onclick="App.copyText('${sub.line_password}')" title="اضغط لنسخ كلمة المرور">
                        ${sub.line_password} <i class="fa-solid fa-copy text-info ms-1" style="font-size:0.8rem;"></i>
                    </td>
                    <td>${sub.xtream_panels?.name || '---'}</td>
                    <td>${sub.services?.service_name || '---'}</td>
                    <td style="font-weight:500;">${expireDisplay}</td>
                    <td style="font-weight:700; color: ${expired ? '#ef4444' : (days <= 7 ? '#f59e0b' : '#10b981')};">${remainingText}</td>
                    <td>
                        <span style="border-radius: 20px; padding: 4px 10px; font-weight:700; font-size: 0.8rem; display: inline-block; ${badgeStyle}">${badgeText}</span>
                    </td>
                    <td style="text-align: center;">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-info text-white" id="btn-renew-sub-${sub.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">
                                تجديد 🔄
                            </button>
                            <button class="btn btn-sm ${disabled ? 'btn-success' : 'btn-warning text-dark'}" id="btn-toggle-sub-${sub.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">
                                ${disabled ? 'تفعيل ✅' : 'تعطيل ❌'}
                            </button>
                            <button class="btn btn-sm btn-danger" id="btn-delete-sub-${sub.id}" style="padding: 4px 8px; font-size:0.8rem; font-weight:700; border-radius:6px; border:0;">
                                حذف 🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind programmatic action events
        filtered.forEach(sub => {
            const disabled = sub.status === 'disabled';

            const renewBtn = document.getElementById(`btn-renew-sub-${sub.id}`);
            if (renewBtn) {
                renewBtn.onclick = () => {
                    this.promptRenewResellerSub(sub);
                };
            }

            const toggleBtn = document.getElementById(`btn-toggle-sub-${sub.id}`);
            if (toggleBtn) {
                toggleBtn.onclick = () => {
                    this.toggleResellerSubStatus(sub, disabled ? 'enable' : 'disable');
                };
            }

            const deleteBtn = document.getElementById(`btn-delete-sub-${sub.id}`);
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    this.deleteResellerSub(sub);
                };
            }
        });
    },

    // --- ACTION AND TRANSACTION LOGIC ---

    async handleAddPanel(e) {
        e.preventDefault();
        const editIdVal = document.getElementById('edit-panel-id').value;
        const payload = {
            name: document.getElementById('panel-name').value.trim(),
            domain_url: document.getElementById('panel-url').value.trim(),
            api_username: document.getElementById('panel-username').value.trim(),
            api_password: document.getElementById('panel-password').value.trim()
        };
        if (editIdVal) {
            payload.id = parseInt(editIdVal);
        }

        this.showToast("جاري حفظ بيانات اللوحة... ⏳");
        const isFlask = window.location.protocol.startsWith('http');
        if (!SupabaseService.client && !isFlask) {
            if (editIdVal) {
                const idx = this.state.panels.findIndex(p => p.id == editIdVal);
                if (idx !== -1) {
                    this.state.panels[idx] = { ...this.state.panels[idx], ...payload };
                }
                this.showToast("تم تحديث بيانات السيرفر بنجاح! ✅");
            } else {
                this.state.panels.push({ id: Date.now(), ...payload, status: 'active' });
                this.showToast("تم إضافة لوحة Xtream بنجاح! ✅");
            }
            this.resetPanelForm();
            this.loadAdminPanels();
            return;
        }

        if (isFlask) {
            try {
                const res = await fetch('/api/panels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast(editIdVal ? "تم تحديث بيانات السيرفر بنجاح! ✅" : "تم إضافة لوحة Xtream بنجاح! ✅");
                    this.resetPanelForm();
                    this.loadAdminPanels();
                } else {
                    alert(`فشلت العملية: ${data.error}`);
                }
            } catch (err) {
                alert(`خطأ بالاتصال: ${err.message}`);
            }
            return;
        }

        let dbRes;
        if (editIdVal) {
            dbRes = await SupabaseService.client.from('xtream_panels').update(payload).eq('id', editIdVal);
        } else {
            dbRes = await SupabaseService.client.from('xtream_panels').insert([payload]);
        }
        const { error } = dbRes;
        if (!error) {
            this.showToast(editIdVal ? "تم تحديث بيانات السيرفر بنجاح! ✅" : "تم إضافة لوحة Xtream بنجاح! ✅");
            this.resetPanelForm();
            this.loadAdminPanels();
        } else {
            alert(`فشلت العملية: ${error.message}`);
        }
    },

    startEditPanel(panelId) {
        const panel = this.state.panels.find(p => p.id == panelId);
        if (!panel) return;

        // Show the panel card container
        const cardContainer = document.getElementById('add-panel-card-container');
        if (cardContainer) cardContainer.style.display = 'block';

        // Populate fields
        document.getElementById('edit-panel-id').value = panel.id;
        document.getElementById('panel-name').value = panel.name;
        document.getElementById('panel-url').value = panel.domain_url;
        document.getElementById('panel-username').value = panel.api_username;
        document.getElementById('panel-password').value = panel.api_password;

        // Update form title and button text
        document.getElementById('panel-form-title').innerText = "تعديل بيانات خادم إكستريم (Edit Xtream Panel) ✏️";
        document.getElementById('btn-save-panel').innerText = "تحديث بيانات السيرفر 💾";

        // Show cancel button
        const cancelBtn = document.getElementById('btn-cancel-edit-panel');
        if (cancelBtn) cancelBtn.style.display = 'block';

        // Scroll to the card
        if (cardContainer) {
            cardContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    resetPanelForm() {
        document.getElementById('add-panel-form').reset();
        document.getElementById('edit-panel-id').value = '';
        
        // Reset form title and button text
        document.getElementById('panel-form-title').innerText = "إضافة خادم إكستريم جديد (Configure Xtream Panel) 🖥️";
        document.getElementById('btn-save-panel').innerText = "حفظ اتصال السيرفر 💾";

        // Hide cancel button
        const cancelBtn = document.getElementById('btn-cancel-edit-panel');
        if (cancelBtn) cancelBtn.style.display = 'none';
    },

    async testPanelConnection(panelId) {
        const panel = this.state.panels.find(p => p.id === panelId);
        if (!panel) return;

        this.showToast(`جاري اختبار الاتصال بسيرفر ${panel.name}... 📡`);
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/test-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain_url: panel.domain_url,
                    username: panel.api_username,
                    password: panel.api_password
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`✅ اتصال ناجح!\n\nاستجابة الخادم: ${data.message}`);
            } else {
                alert(`❌ فشل الاتصال!\n\nالسبب: ${data.error}`);
            }
        } catch (err) {
            alert(`حدث خطأ أثناء محاولة الاتصال بالخادم الوسيط: ${err.message}`);
        }
    },

    async deletePanel(panelId) {
        if (!confirm("هل أنت متأكد من رغبتك في حذف هذا السيرفر؟ سيتم حذف جميع باقاته المرتبطة به!")) return;
        
        const isFlask = window.location.protocol.startsWith('http');
        if (!SupabaseService.client && !isFlask) {
            this.state.panels = this.state.panels.filter(p => p.id !== panelId);
            this.showToast("تم الحذف بنجاح! 🗑️");
            this.loadAdminPanels();
            return;
        }

        if (isFlask) {
            try {
                const res = await fetch(`/api/panels/delete/${panelId}`, {
                    method: 'POST'
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast("تم الحذف بنجاح! 🗑️");
                    this.loadAdminPanels();
                } else {
                    alert(`فشل الحذف: ${data.error}`);
                }
            } catch (err) {
                alert(`خطأ بالاتصال: ${err.message}`);
            }
            return;
        }

        const { error } = await SupabaseService.client.from('xtream_panels').delete().eq('id', panelId);
        if (!error) {
            this.showToast("تم الحذف بنجاح! 🗑️");
            this.loadAdminPanels();
            this.loadAdminServices(); 
        }
    },

    async handleAddReseller(e) {
        e.preventDefault();
        const username = document.getElementById('reseller-username').value.trim();
        const passRaw = document.getElementById('reseller-password').value;
        const initialCredits = parseFloat(document.getElementById('reseller-credits').value || '0');

        this.showToast("جاري إنشاء حساب الموزع... 🤝");

        const resellerPayload = {
            username: username,
            password: passRaw, // Send plain password for secure server-side bcrypt hashing
            credits: initialCredits,
            role: 'reseller',
            status: 'active'
        };

        try {
            const res = await fetch('/api/admin/resellers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resellerPayload)
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم إنشاء الحساب للموزع! ✅");
                document.getElementById('add-reseller-form').reset();
                const modal = document.getElementById('add-reseller-modal');
                if (modal) modal.style.display = 'none';
                this.loadAdminResellers();
                this.loadAdminLogs();
            } else {
                alert(`فشل إنشاء الحساب: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async resellerCreditAction(resellerId, username, type) {
        const word = type === 'add' ? 'شحن' : 'خصم';
        const amountStr = prompt(`أدخل كمية الج.م المراد ${word}ها للموزع (${username}):`);
        if (!amountStr || isNaN(amountStr)) return;
        let amount = parseFloat(amountStr);
        if (amount <= 0) return alert("يجب إدخال قيمة صحيحة أكبر من الصفر!");
        
        if (type === 'deduct') {
            amount = -amount;
        }

        this.showToast(`جاري ${word} الرصيد... ⏳`);

        try {
            const res = await fetch('/api/admin/resellers/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resellerId: resellerId,
                    amount: amount
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(`تم ${word} الرصيد بنجاح! ✅`);
                this.loadAdminResellers();
                this.loadAdminLogs();
            } else {
                alert(`فشلت العملية: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async resellerChangePasswordPrompt(resellerId, username) {
        const newPass = prompt(`أدخل كلمة المرور الجديدة للموزع (${username}):`);
        if (!newPass) return;
        if (newPass.length < 4) return alert("كلمة المرور يجب أن لا تقل عن 4 خانات!");

        this.showToast("جاري تحديث كلمة المرور... ⏳");

        try {
            const res = await fetch('/api/admin/resellers/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: resellerId,
                    password: newPass
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم تحديث كلمة المرور بنجاح! ✅");
                this.loadAdminResellers();
            } else {
                alert(`فشلت العملية: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async toggleResellerStatus(resellerId, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        try {
            const res = await fetch('/api/admin/resellers/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resellerId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم تحديث حالة الموزع! ✅");
                this.loadAdminResellers();
            } else {
                alert(`فشل التحديث: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    generateResellerPassword(formType) {
        const pass = Utils.generateRandomString(10);
        if (formType === 'add') {
            document.getElementById('reseller-password').value = pass;
        } else {
            document.getElementById('edit-reseller-password').value = pass;
        }
    },

    startEditReseller(resellerId, username, credits) {
        // Show the edit reseller modal overlay
        const modal = document.getElementById('edit-reseller-modal');
        if (modal) modal.style.display = 'flex';

        // Populate fields
        document.getElementById('edit-reseller-id').value = resellerId;
        document.getElementById('edit-reseller-username').value = username;
        document.getElementById('edit-reseller-password').value = ''; // empty by default
        document.getElementById('edit-reseller-credits').value = credits;
    },

    openChargeResellerModal(resellerId, username, currentCredits) {
        const modal = document.getElementById('charge-reseller-modal');
        if (modal) modal.style.display = 'flex';

        document.getElementById('charge-reseller-id').value = resellerId;
        document.getElementById('charge-reseller-username').value = username;
        document.getElementById('charge-reseller-current-credits').value = parseFloat(currentCredits).toFixed(2) + " ج.م";
        document.getElementById('charge-reseller-amount').value = '';
    },

    closeChargeResellerModal() {
        const modal = document.getElementById('charge-reseller-modal');
        if (modal) modal.style.display = 'none';
        document.getElementById('charge-reseller-form').reset();
    },

    async submitChargeReseller(e) {
        if (e) e.preventDefault();
        const resellerId = document.getElementById('charge-reseller-id').value;
        const amountVal = parseFloat(document.getElementById('charge-reseller-amount').value);

        if (isNaN(amountVal) || amountVal === 0) {
            this.showToast("❌ يرجى إدخال مبلغ صحيح!");
            return;
        }

        const actionText = amountVal > 0 ? "شحن" : "خصم";
        this.showToast(`جاري ${actionText} الرصيد... ⏳`);
        this.closeChargeResellerModal();

        try {
            const res = await fetch('/api/admin/resellers/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resellerId: resellerId,
                    amount: amountVal
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(`تم ${actionText} الرصيد بنجاح! ✅`);
                this.loadAdminResellers();
                this.loadAdminLogs();
            } else {
                alert(`فشلت العملية: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    cancelEditReseller() {
        const modal = document.getElementById('edit-reseller-modal');
        if (modal) modal.style.display = 'none';
        document.getElementById('edit-reseller-form').reset();
    },

    async handleEditResellerSubmit(e) {
        e.preventDefault();
        const resellerId = document.getElementById('edit-reseller-id').value;
        const newUsername = document.getElementById('edit-reseller-username').value.trim();
        const newPassword = document.getElementById('edit-reseller-password').value;
        const newCredits = parseFloat(document.getElementById('edit-reseller-credits').value || '0');

        this.showToast("جاري تحديث بيانات الموزع... ⏳");

        const payload = {
            id: resellerId,
            username: newUsername,
            credits: newCredits
        };

        if (newPassword) {
            payload.password = newPassword;
        }

        try {
            const res = await fetch('/api/admin/resellers/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم تحديث بيانات الموزع بنجاح! ✅");
                this.cancelEditReseller();
                this.loadAdminResellers();
            } else {
                alert(`فشل التحديث: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async deleteReseller(resellerId) {
        if (!confirm("هل أنت متأكد من حذف حساب هذا الموزع بالكامل وسجل عملياته؟")) return;
        try {
            const res = await fetch('/api/admin/resellers/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resellerId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم حذف حساب الموزع! 🗑️");
                this.loadAdminResellers();
                this.loadAdminLogs();
            } else {
                alert(`فشل الحذف: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    onServerPriceSelectChange() {
        const panelId = parseInt(document.getElementById('service-panel-id').value);
        const listDiv = document.getElementById('server-packages-prices-list');
        if (!panelId) {
            if (listDiv) listDiv.style.display = 'none';
            return;
        }

        // Set defaults
        document.getElementById('price-pkg-10').value = 0;
        document.getElementById('price-pkg-54').value = 55;
        document.getElementById('price-pkg-55').value = 110;
        document.getElementById('price-pkg-56').value = 220;
        document.getElementById('price-pkg-119').value = 275;

        // Load existing
        this.state.services.forEach(s => {
            if (s.panel_id === panelId) {
                const pkgId = parseInt(s.package_id);
                const input = document.getElementById(`price-pkg-${pkgId}`);
                if (input) {
                    input.value = s.cost_credits;
                }
            }
        });

        if (listDiv) listDiv.style.display = 'block';
    },

    async handleAddService(e) {
        e.preventDefault();
        const panelId = parseInt(document.getElementById('service-panel-id').value);
        if (!panelId) return alert("برجاء تحديد السيرفر!");

        const packages = [
            { id: 10, name: "تجريبي 24 ساعة - TEST", defaultVal: 0 },
            { id: 54, name: "باقة 3 أشهر", defaultVal: 55 },
            { id: 55, name: "باقة 6 أشهر", defaultVal: 110 },
            { id: 56, name: "باقة 12 شهر", defaultVal: 220 },
            { id: 119, name: "باقة 15 شهر", defaultVal: 275 }
        ];

        this.showToast("جاري حفظ أسعار الباقات... 💳");
        let successCount = 0;

        for (const pkg of packages) {
            const inputVal = parseFloat(document.getElementById(`price-pkg-${pkg.id}`).value || '0');
            const existing = this.state.services.find(s => s.panel_id === panelId && parseInt(s.package_id) === pkg.id);

            try {
                if (existing) {
                    // Update
                    const res = await fetch('/api/admin/services/update_price', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serviceId: existing.id, newPrice: inputVal })
                    });
                    const data = await res.json();
                    if (data.success) successCount++;
                } else {
                    // Create
                    const res = await fetch('/api/admin/services', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            service_name: pkg.name,
                            panel_id: panelId,
                            package_id: pkg.id,
                            cost_credits: inputVal,
                            status: 'active'
                        })
                    });
                    const data = await res.json();
                    if (data.success) successCount++;
                }
            } catch (err) {
                console.error("Error updating package price:", err);
            }
        }

        this.showToast(`تم تحديث ${successCount} من أصل 5 باقات بنجاح! ✅`);
        this.loadAdminServices();
    },

    async deleteService(serviceId) {
        if (!confirm("هل تريد حذف هذه الخدمة؟")) return;
        try {
            const res = await fetch('/api/admin/services/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم الحذف بنجاح! 🗑️");
                this.loadAdminServices();
            } else {
                alert(`فشل الحذف: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async editServicePricePrompt(serviceId, currentPrice) {
        const valStr = prompt("أدخل السعر الجديد للباقة بالجنيه المصري (ج.م):", currentPrice);
        if (valStr === null) return;
        const newPrice = parseFloat(valStr);
        if (isNaN(newPrice) || newPrice < 0) {
            alert("⚠️ السعر غير صالح! يجب إدخال رقم موجب.");
            return;
        }

        this.showToast("جاري تحديث السعر... 💳");
        try {
            const res = await fetch('/api/admin/services/update_price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId, newPrice })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم تحديث السعر بنجاح! ✅");
                this.loadAdminServices();
            } else {
                alert(`فشل التحديث: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },


    async handleResellerCreateSub() {
        const modal = document.getElementById('reseller-xtream-create-modal');
        if (modal) modal.style.display = 'none';

        const serviceId = document.getElementById('reseller-select-service').value;
        let username = document.getElementById('reseller-new-username').value.trim();
        let password = document.getElementById('reseller-new-password').value.trim();
        const lineType = document.getElementById('reseller-line-type').value;
        const notes = document.getElementById('reseller-notes').value.trim();
        
        // Collect selected bouquets
        const selectedBouquets = [];
        document.querySelectorAll('.bouquet-check:checked').forEach(cb => {
            selectedBouquets.push(cb.value);
        });

        // Auto generate if left blank
        if (!username) {
            username = 'u' + Utils.generateRandomString(6);
        }
        if (!password) {
            password = Utils.generateRandomString(8);
        }

        if (!serviceId) {
            this.showToast("⚠️ برجاء اختيار باقة/خدمة لإنشاء الاشتراك!");
            return;
        }

        const service = this.state.resellerServices.find(s => s.id == serviceId);
        if (!service) return;

        // In trial mode, credits cost is 0
        const creditsCost = lineType === 'trial' ? 0.0 : parseFloat(service.cost_credits);

        if (this.state.session.role === 'reseller' && parseFloat(this.state.session.credits) < creditsCost) {
            this.showToast("❌ رصيدك الحالي غير كافٍ لشراء هذا الاشتراك!");
            return;
        }

        const confirmModal = document.getElementById('xtream-purchase-confirm-modal');
        if (!confirmModal) return;

        const currentBalance = parseFloat(this.state.session.credits);
        const remainingBalance = currentBalance - creditsCost;

        document.getElementById('xtream-confirm-current-balance').innerText = `${currentBalance.toFixed(2)} ج.م`;
        document.getElementById('xtream-confirm-cost').innerText = `-${creditsCost.toFixed(2)} ج.م`;
        document.getElementById('xtream-confirm-remaining-balance').innerText = `${remainingBalance.toFixed(2)} ج.م`;

        confirmModal.style.display = 'flex';

        document.getElementById('btn-xtream-confirm-yes').onclick = async () => {
            confirmModal.style.display = 'none';
            
            this.showToast("جاري إنشاء الاشتراك... ⏳");
            const btn = document.getElementById('reseller-btn-create-sub');
            if (btn) btn.disabled = true;

            const isFlask = window.location.protocol.startsWith('http');
            if (!SupabaseService.client && !isFlask) {
                // Simulated response in Design Mode
                setTimeout(() => {
                    if (btn) btn.disabled = false;
                    
                    if (lineType === 'official') {
                        this.state.session.credits = parseFloat(this.state.session.credits) - creditsCost;
                    }

                    const expireDate = new Date();
                    expireDate.setDate(expireDate.getDate() + (lineType === 'trial' ? 1 : 30));
                    
                    this.state.resellerSubscriptions.unshift({
                        id: 'rs_' + Date.now(),
                        line_username: username,
                        line_password: password,
                        xtream_panels: { name: service.xtream_panels?.name || 'MH Server' },
                        services: { service_name: service.service_name },
                        expire_date: expireDate.toISOString().split('T')[0],
                        status: 'active',
                        created_at: new Date().toISOString()
                    });
                    
                    alert(`🎉 [وضع المعاينة] تم إنشاء الاشتراك بنجاح!\n\nاسم الحساب: ${username}\nكلمة السر: ${password}\nنوع الحساب: ${lineType === 'trial' ? 'تجريبي (24 ساعة)' : 'رسمي (30 يوم)'}\nتاريخ الانتهاء: ${expireDate.toISOString().split('T')[0]}`);
                    
                    document.getElementById('reseller-new-username').value = '';
                    document.getElementById('reseller-new-password').value = '';
                    document.getElementById('reseller-select-service').value = '';
                    document.getElementById('reseller-notes').value = '';

                    this.switchTab('tab-manage-users');
                    this.renderResellerSubscriptions();
                    this.renderStatsContainer();
                }, 1000);
                return;
            }

            this.showResellerCreationLoading();
            try {
                const response = await fetch(`${this.API_BASE}/api/xtream/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reseller_id: this.state.session.id,
                        service_id: serviceId,
                        line_username: username,
                        line_password: password,
                        line_type: lineType,
                        bouquets: selectedBouquets,
                        notes: notes
                    })
                });

                const result = await response.json();
                this.hideResellerCreationLoading();
                if (btn) btn.disabled = false;

                if (result.success) {
                    document.getElementById('reseller-new-username').value = '';
                    document.getElementById('reseller-new-password').value = '';
                    document.getElementById('reseller-select-service').value = '';
                    document.getElementById('reseller-notes').value = '';

                    this.loadResellerData();

                    const successModal = document.getElementById('xtream-creation-success-modal');
                    if (successModal) {
                        const serverNameVal = service.xtream_panels?.name || "StreamCreed";
                        
                        // Use stream_url from server response (actual IPTV server), fallback to domain_url parsing
                        let hostUrl = result.stream_url || null;
                        if (!hostUrl) {
                            const serverDomain = service.xtream_panels?.domain_url || "";
                            hostUrl = serverDomain.split('/userpanel')[0].split('/index.php')[0];
                            try {
                                const parsedUrl = new URL(serverDomain);
                                hostUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
                            } catch (e) {}
                        }

                        const m3uUrl = `${hostUrl}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`;

                        document.getElementById('xtream-success-server-name').innerText = `تم إعداد خط المشترك على سيرفر ${serverNameVal} بنجاح.`;
                        document.getElementById('xtream-success-username').innerText = username;
                        document.getElementById('xtream-success-password').innerText = password;
                        document.getElementById('xtream-success-expire').innerText = Utils.formatDisplayDate(result.expire_date);
                        
                        const m3uInput = document.getElementById('xtream-success-m3u-input');
                        if (m3uInput) m3uInput.value = m3uUrl;

                        successModal.style.display = 'flex';

                        document.getElementById('btn-copy-xtream-user').onclick = () => {
                            this.copyText(username);
                        };

                        document.getElementById('btn-copy-xtream-pass').onclick = () => {
                            this.copyText(password);
                        };

                        document.getElementById('btn-copy-xtream-m3u').onclick = () => {
                            this.copyText(m3uUrl);
                        };

                        document.getElementById('btn-close-xtream-success').onclick = () => {
                            successModal.style.display = 'none';
                            this.switchTab('tab-manage-users');
                        };
                    } else {
                        alert(`🎉 تم إنشاء الاشتراك بنجاح!\n\nاسم الحساب: ${username}\nكلمة السر: ${password}\nتاريخ الانتهاء: ${Utils.formatDisplayDate(result.expire_date)}`);
                        this.switchTab('tab-manage-users');
                    }
                } else {
                    this.showToast(`❌ فشل الإنشاء: ${result.error || 'خطأ غير معروف'}`);
                    this.loadResellerData(); 
                }
            } catch (err) {
                this.hideResellerCreationLoading();
                if (btn) btn.disabled = false;
                this.showToast(`❌ خطأ بالاتصال: ${err.message}`);
                this.loadResellerData();
            }
        };

        document.getElementById('btn-xtream-confirm-no').onclick = () => {
            confirmModal.style.display = 'none';
            const createModal = document.getElementById('reseller-xtream-create-modal');
            if (createModal) createModal.style.display = 'flex';
        };
    },

    async toggleResellerSubStatus(sub, action) {
        const arabicAction = action === 'enable' ? 'تفعيل' : 'تعطيل';
        if (!confirm(`هل أنت متأكد من رغبتك في ${arabicAction} اشتراك العميل (${sub.line_username})؟`)) return;

        this.showToast(`جاري إرسال أمر الـ ${arabicAction} للسيرفر... 📡`);
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    action: action
                })
            });
            const result = await response.json();
            if (result.success) {
                this.showToast(`تم ${arabicAction} الحساب بنجاح! ✅`);
                this.loadResellerSubscriptions();
            } else {
                alert(`فشلت العملية على السيرفر: ${result.error}`);
            }
        } catch (err) {
            alert(`خطأ في الاتصال بالخادم الوسيط: ${err.message}`);
        }
    },

    async deleteResellerSub(sub) {
        if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف اشتراك العميل (${sub.line_username}) نهائياً من السيرفر وفي قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء ولا يتم استرجاع الج.م.`)) return;

        this.showToast("جاري حذف الحساب من السيرفر... 🗑️");
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    action: 'delete'
                })
            });
            const result = await response.json();
            if (result.success) {
                this.showToast("تم حذف الحساب نهائياً بنجاح! ✅");
                this.loadResellerSubscriptions();
            } else {
                alert(`فشل حذف الاشتراك: ${result.error}`);
            }
        } catch (err) {
            alert(`خطأ في الاتصال بالخادم الوسيط: ${err.message}`);
        }
    },

    async promptRenewResellerSub(sub) {
        const panelId = sub.panel_id || sub.xtream_panels?.id || 1;
        const options = this.state.resellerServices.filter(s => (s.panel_id || s.xtream_panels?.id || 1) === panelId);
        if (options.length === 0) return alert("لا توجد خدمات تجديد مضافة لهذا السيرفر حالياً!");

        let promptText = "اختر الباقة المناسبة للتجديد:\n";
        options.forEach((s, idx) => {
            promptText += `[${idx + 1}] ${s.service_name} - التكلفة: ${s.cost_credits} ج.م\n`;
        });
        
        const selectionStr = prompt(promptText + "\nاكتب رقم الخيار المحدد للتجديد (مثال: 1):");
        if (!selectionStr) return;

        const idx = parseInt(selectionStr) - 1;
        if (isNaN(idx) || idx < 0 || idx >= options.length) {
            return alert("الخيار المكتوب غير صالح!");
        }

        const selectedService = options[idx];
        
        let days = 30;
        if (selectedService.service_name.includes("12") || selectedService.service_name.includes("Year") || selectedService.service_name.includes("سنة")) {
            days = 365;
        } else if (selectedService.service_name.includes("6")) {
            days = 180;
        } else if (selectedService.service_name.includes("3")) {
            days = 90;
        }

        if (this.state.session.role === 'reseller' && parseFloat(this.state.session.credits) < parseFloat(selectedService.cost_credits)) {
            return alert("❌ رصيدك غير كافٍ لإتمام عملية التجديد!");
        }

        this.showToast("جاري إرسال طلب التجديد للمخدم... ⏳");
        try {
            const response = await fetch(`${this.API_BASE}/api/xtream/renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reseller_id: this.state.session.id,
                    subscription_id: sub.id,
                    service_id: selectedService.id,
                    additional_days: days
                })
            });
            const result = await response.json();
            if (result.success) {
                alert("🎉 تم تجديد الاشتراك وتمديده بنجاح على السيرفر!");
                this.loadResellerData();
            } else {
                alert(`❌ فشل التجديد: ${result.error}`);
                this.loadResellerData();
            }
        } catch (err) {
            alert(`خطأ في شبكة الخادم الوسيط: ${err.message}`);
            this.loadResellerData();
        }
    },


    // --- ORIGINAL CRM LOGIC INTEGRATED ---

    updateQuickDateButtons() {
        const container = document.getElementById('quick-dates-container');
        if (!container) return;
        const months = [1, 3, 6, 12];
        
        container.innerHTML = months.map(m => `
            <button type="button" class="btn-quick-date" data-months="${m}">${m} شهر</button>
        `).join('');

        container.querySelectorAll('.btn-quick-date').forEach(btn => {
            btn.onclick = () => {
                const m = parseInt(btn.dataset.months);
                const d = new Date();
                d.setMonth(d.getMonth() + m);
                const input = document.getElementById('new-expire');
                if (input) input.value = d.toISOString().split('T')[0];
            };
        });
    },

    async sync() {
        this.state.customers = [];
        this.render();
        this.updateStats();

        this.showToast(`جاري تحميل بيانات العملاء... 🔄`);
        try {
            const res = await fetch(`/api/customers`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const uniqueMap = new Map();
                data.forEach(c => {
                    const u = String(c.username).toLowerCase().trim();
                    uniqueMap.set(u, c);
                });
                this.state.customers = Array.from(uniqueMap.values());
                this.render();
                this.updateStatusUI(true);
            } else {
                this.updateStatusUI(false);
                this.showToast("خطأ في قراءة بيانات العملاء! ⚠️");
            }
        } catch (e) {
            console.error("Failed to sync customers:", e);
            this.updateStatusUI(false);
            this.showToast("خطأ في الاتصال بقاعدة البيانات! ⚠️");
        }
    },

    render(appendMode = false) {
        const list = document.getElementById('customer-list');
        if (!list) return;

        if (!appendMode) {
            list.innerHTML = '';
            this.state.visibleCount = this.state.pageSize;
        }

        const query = this.state.searchQuery.toLowerCase().trim();
        let filtered = this.state.customers.filter(c => {
            const matchesQuery = String(c.username).toLowerCase().includes(query) || 
                                 String(c.mac_address || '').toLowerCase().includes(query) ||
                                 String(c.phone_number || '').includes(query);
            
            const days = Utils.getRemainingDays(c.expire_date);
            const expired = days !== null && days < 0;
            const urgent = days !== null && days >= 0 && days <= 7;

            let matchesStatus = true;
            if (this.state.filterStatus === 'active') matchesStatus = !expired;
            else if (this.state.filterStatus === 'expired') matchesStatus = expired;
            else if (this.state.filterStatus === 'urgent') matchesStatus = urgent;

            let matchesDate = true;
            if (this.state.dateFilter) {
                matchesDate = (Utils.normalizeDate(c.expire_date) === this.state.dateFilter);
            }

            return matchesQuery && matchesStatus && matchesDate;
        });

        document.getElementById('results-count').innerText = filtered.length;

        const paginated = filtered.slice(0, this.state.visibleCount);
        
        if (paginated.length === 0) {
            list.innerHTML = `<p style="text-align:center; padding:30px; color:var(--text-low-light)">لا توجد نتائج مطابقة</p>`;
            document.getElementById('load-more-container').style.display = 'none';
            return;
        }

        paginated.forEach(c => {
            const card = Components.createCustomerCard(c, this.state.currentCategory);
            list.appendChild(card);
        });

        const hasMore = filtered.length > this.state.visibleCount;
        document.getElementById('load-more-container').style.display = hasMore ? 'block' : 'none';

        this.updateStats();
    },

    updateStats() {
        let all = 0, active = 0, expired = 0, urgent = 0;
        this.state.customers.forEach(c => {
            all++;
            const days = Utils.getRemainingDays(c.expire_date);
            if (days !== null && days < 0) expired++;
            else active++;
            
            if (days !== null && days >= 0 && days <= 7) urgent++;
        });

        const statAll = document.getElementById('stat-all');
        const statActive = document.getElementById('stat-active');
        const statExpired = document.getElementById('stat-expired');
        const statUrgent = document.getElementById('stat-urgent');

        if (statAll) statAll.innerText = all;
        if (statActive) statActive.innerText = active;
        if (statExpired) statExpired.innerText = expired;
        if (statUrgent) statUrgent.innerText = urgent;
    },

    openAddCustomerSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if(sidebar && overlay) {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        }
    },

    async addCustomer() {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const mac = document.getElementById('new-mac').value.trim();
        const expireDate = document.getElementById('new-expire').value;
        const phone = document.getElementById('new-phone').value.trim();
        const note = document.getElementById('new-note').value;

        if (!username || !expireDate) {
            return alert("اسم المستخدم وتاريخ الانتهاء حقول إجبارية!");
        }

        const payload = {
            username,
            password,
            expire_date: expireDate,
            phone_number: phone,
            note
        };

        this.showToast("جاري الحفظ... ⏳");
        try {
            const res = await fetch(`/api/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم إضافة العميل بنجاح! ✅");
                this.resetForm();
                document.getElementById('close-sidebar').click();
                this.sync();
            } else {
                alert(`فشل الحفظ: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    startSafetyFlow(customer, action, parameter = null) {
        const cardId = customer.id;
        const overlay = document.getElementById(`safety-${cardId}`);
        const text = document.getElementById(`safety-text-${cardId}`);
        if (!overlay) return;

        overlay.classList.add('active');
        let count = 5;
        
        const actionLabel = action === 'delete' ? 'حذف العميل نهائياً' : `تجديد الاشتراك لـ ${parameter} شهر`;
        text.innerText = `جاري ${actionLabel} خلال ${count}...`;

        const interval = setInterval(() => {
            count--;
            overlay.querySelector('.safety-timer').innerText = count;
            text.innerText = `جاري ${actionLabel} خلال ${count}...`;
            
            if (count <= 0) {
                clearInterval(interval);
                this.executeSafetyAction(customer, action, parameter);
            }
        }, 1000);

        this.state.activeTimers[cardId] = interval;

        overlay.querySelector('.btn-cancel').onclick = () => {
            clearInterval(interval);
            overlay.classList.remove('active');
            delete this.state.activeTimers[cardId];
            this.showToast("تم إلغاء العملية! ✕");
        };
    },

    async executeSafetyAction(customer, action, parameter) {
        const cardId = customer.id;
        const overlay = document.getElementById(`safety-${cardId}`);
        const successOverlay = document.getElementById(`success-${cardId}`);
        
        if (overlay) overlay.classList.remove('active');
        delete this.state.activeTimers[cardId];

        if (action === 'delete') {
            try {
                const res = await fetch(`/api/customers/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: customer.id })
                });
                const data = await res.json();
                if (data.success) {
                    if (successOverlay) {
                        successOverlay.classList.add('active');
                        setTimeout(() => { this.sync(); }, 1000);
                    } else {
                        this.sync();
                    }
                } else {
                    alert(`فشل الحذف: ${data.error}`);
                }
            } catch (err) {
                alert(`خطأ بالاتصال: ${err.message}`);
            }
        } else if (action === 'renew') {
            const m = parseInt(parameter);
            const currentExp = Utils.normalizeDate(customer.expire_date);
            let baseDate = new Date();
            
            if (currentExp) {
                const expObj = new Date(currentExp);
                if (expObj > baseDate) {
                    baseDate = expObj;
                }
            }
            baseDate.setMonth(baseDate.getMonth() + m);
            const newExpire = baseDate.toISOString().split('T')[0];

            try {
                const res = await fetch(`/api/customers/renew`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: customer.id, expire_date: newExpire })
                });
                const data = await res.json();
                if (data.success) {
                    if (successOverlay) {
                        successOverlay.classList.add('active');
                        setTimeout(() => { this.sync(); }, 1000);
                    } else {
                        this.sync();
                    }
                } else {
                    alert(`فشل التجديد: ${data.error}`);
                }
            } catch (err) {
                alert(`خطأ بالاتصال: ${err.message}`);
            }
        }
    },

    openManageModal(customer) {
        this.state.selectedCustomer = customer;
        document.getElementById('edit-id').value = customer.id;
        document.getElementById('edit-username').value = customer.username || '';
        document.getElementById('edit-password').value = customer.password || '';
        document.getElementById('edit-expire').value = Utils.normalizeDate(customer.expire_date) || '';
        document.getElementById('edit-note').value = customer.note || customer.notes || '';

        const renewContainer = document.getElementById('manage-renew-btns');
        const months = [3, 6, 12];
        renewContainer.innerHTML = months.map(m => `<button class="btn-renew-opt" data-months="${m}">${m} شهر</button>`).join('');

        renewContainer.querySelectorAll('.btn-renew-opt').forEach(btn => {
            btn.onclick = () => {
                const m = parseInt(btn.dataset.months);
                this.closeManageModal();
                this.startSafetyFlow(customer, 'renew', m);
            };
        });

        document.getElementById('manage-modal').classList.add('active');
    },

    closeManageModal() {
        document.getElementById('manage-modal').classList.remove('active');
    },

    async saveCustomerEdit() {
        const id = document.getElementById('edit-id').value;
        const updates = {
            username: document.getElementById('edit-username').value,
            password: document.getElementById('edit-password').value,
            expire_date: document.getElementById('edit-expire').value,
            note: document.getElementById('edit-note').value
        };

        this.showToast("جاري حفظ التعديلات... ⏳");
        try {
            const res = await fetch(`/api/customers/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, updates })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم الحفظ بنجاح! ✅");
                this.closeManageModal();
                this.sync();
            } else {
                this.showToast("فشل الحفظ! ⚠️");
            }
        } catch (err) {
            console.error(err);
            this.showToast("فشل الحفظ! ⚠️");
        }
    },

    closeModals() {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    },

    openTemplateModal(customer) {
        const resolvedPhone = customer.phone_number || customer.username;
        if (!resolvedPhone) return alert("⚠️ عذراً، لا يوجد رقم هاتف مسجل لهذا العميل!");
        
        this.state.selectedCustomerForTemplate = { ...customer, resolvedPhone };
        
        const days = Utils.getRemainingDays(customer.expire_date);
        const isExpired = (days !== null && days < 0);
        
        const btnReminder = document.getElementById('tmp-reminder');
        const btnExpired = document.getElementById('tmp-expired');
        const btnWelcome = document.getElementById('tmp-welcome');

        if (isExpired) {
            if (btnReminder) btnReminder.style.display = 'none';
            if (btnWelcome) btnWelcome.style.display = 'none';
            if (btnExpired) btnExpired.style.display = 'flex';
        } else {
            if (btnReminder) btnReminder.style.display = 'flex';
            if (btnWelcome) btnWelcome.style.display = 'flex';
            if (btnExpired) btnExpired.style.display = 'none';
        }

        const nameEl = document.getElementById('template-customer-name');
        if (nameEl) nameEl.innerText = `العميل: ${customer.username}`;
        document.getElementById('templates-modal').classList.add('active');
    },

    sendTemplateMessage(type) {
        const c = this.state.selectedCustomerForTemplate;
        if (!c || !c.resolvedPhone) return alert("رقم الهاتف غير متوفر!");

        const name = c.username;
        let phone = String(c.resolvedPhone).replace(/\D/g, '');
        
        if (phone.length === 11 && phone.startsWith('01')) {
            phone = '20' + phone.substring(1);
        } else if (phone.length === 10 && phone.startsWith('1')) {
            phone = '20' + phone;
        }

        const days = Utils.getRemainingDays(c.expire_date);
        const displayDate = Utils.formatDisplayDate(c.expire_date);
        let msg = "";

        switch (type) {
            case 'reminder':
                msg = `أهلاً بك عميلنا العزيز ${name}، نود تذكيرك من "التهامي جروب" بأن اشتراكك سينتهي بتاريخ ${displayDate} (متبقي ${days} يوم). يسعدنا استمرارك معنا، للتجديد يرجى التواصل معنا. نتمنى لك مشاهدة ممتعة.`;
                break;
            case 'expired':
                msg = `أهلاً بك عميلنا العزيز ${name}، نود إحاطتك من "التهامي جروب" بأن اشتراكك قد انتهى بتاريخ ${displayDate}. يسعدنا تواصلك معنا لتجديد الخدمة والاستمتاع بمحتوانا الحصري. نحن في انتظارك!`;
                break;
            case 'welcome':
                msg = `أهلاً بك في "التهامي جروب" عميلنا العزيز ${name}! يسعدنا انضمامك إلينا؛ تم تفعيل اشتراكك بنجاح وسينتهي بتاريخ ${displayDate}. شكراً لثقتك بنا ونتمنى لك تجربة فريدة ومشاهدة ممتعة.`;
                break;
            case 'general':
                msg = `أهلاً بك في "التهامي جروب"، كيف يمكننا مساعدتك اليوم؟`;
                break;
        }

        const encodedMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
        document.getElementById('templates-modal').classList.remove('active');
    },

    updateStatusUI(online) {
        const dot = document.getElementById('sync-dot');
        const txt = document.getElementById('sync-text');
        if (!dot || !txt) return;
        dot.className = online ? 'pulse-dot online' : 'pulse-dot';
        txt.innerText = online ? `متصل بالخادم (${this.state.currentCategory})` : 'الخادم غير متصل';
    },

    showToast(msg) {
        const toast = document.getElementById('copy-toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 2500);
    },

    copyText(text) {
        const ok = Utils.copyToClipboard(text);
        if (ok) this.showToast("تم النسخ بنجاح! ✅");
    },

    resetForm() {
        ['new-username', 'new-password', 'new-expire', 'new-mac', 'new-phone', 'new-note'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    async loadAdminCodesTab() {
        const isFlask = window.location.protocol.startsWith('http');
        if (!isFlask) {
            // Mock categories for Design Mode
            const mockCats = [
                { id: "cat_hyper", name: "Hyper IPTV", cost_credits: 2.0, available_count: 5 },
                { id: "cat_nova", name: "Nova IPTV", cost_credits: 3.0, available_count: 0 }
            ];
            this.renderAdminCategoriesTable(mockCats);
            this.populateAdminCategoriesDropdown(mockCats);
            return;
        }

        try {
            const res = await fetch('/api/codes/categories');
            const data = await res.json();
            if (data.success) {
                this.renderAdminCategoriesTable(data.categories);
                this.populateAdminCategoriesDropdown(data.categories);
            }
        } catch (e) {
            console.error("Failed to load admin categories:", e);
        }
    },

    populateAdminCategoriesDropdown(categories) {
        const select = document.getElementById('code-upload-category');
        if (!select) return;
        select.innerHTML = '<option value="">-- Choose Category --</option>' +
            categories.map(c => `<option value="${c.id}">${c.name} (Cost: ${c.cost_credits} ج.م)</option>`).join('');
    },

    renderAdminCategoriesTable(categories) {
        const tbody = document.getElementById('admin-code-categories-list');
        if (!tbody) return;
        // Store categories globally for button access
        window._adminCategories = categories;
        tbody.innerHTML = categories.map((c, idx) => `
            <tr>
                <td class="fw-bold">${c.name}</td>
                <td><span class="badge bg-primary" style="font-size:0.9rem">${parseFloat(c.cost_credits).toFixed(2)} ج.م</span></td>
                <td><span class="badge ${c.available_count > 0 ? 'bg-success' : 'bg-danger'}" style="font-size:0.9rem; cursor:pointer;" onclick="App.viewCodesForCategory(${idx})">${c.available_count} متاح 👁</span></td>
                <td class="text-end">
                    <div class="action-row-btns justify-content-end" style="padding-right: 20px;">
                        <button class="btn-small" style="background:#17a2b8; color:#fff;" onclick="App.viewCodesForCategory(${idx})"><i class="fa-solid fa-eye"></i> أكواد</button>
                        <button class="btn-small" style="background: var(--primary); color: #fff;" onclick="App.editCodeCategoryFromIndex(${idx})"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
                        <button class="btn-small danger" onclick="App.deleteCodeCategoryFromIndex(${idx})"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async viewCodesForCategory(idx) {
        const c = window._adminCategories && window._adminCategories[idx];
        if (!c) return;
        // Set modal header
        document.getElementById('view-codes-cat-name').textContent = c.name;
        document.getElementById('view-codes-list').innerHTML = '<tr><td colspan="6" class="text-center">جاري التحميل... ⏳</td></tr>';
        document.getElementById('view-codes-total').textContent = '';
        document.getElementById('view-codes-available').textContent = '';
        document.getElementById('view-codes-sold').textContent = '';
        document.getElementById('view-codes-modal').style.display = 'flex';

        try {
            const res = await fetch(`/api/codes/list?category_id=${c.id}`);
            const data = await res.json();
            if (!data.success) {
                document.getElementById('view-codes-list').innerHTML = `<tr><td colspan="6" class="text-center text-danger">❌ ${data.error}</td></tr>`;
                return;
            }
            const codes = data.codes || [];
            const available = codes.filter(x => x.status === 'available' || x.status === 'active');
            const sold = codes.filter(x => x.status === 'sold');

            document.getElementById('view-codes-total').textContent = `إجمالي: ${codes.length} كود`;
            document.getElementById('view-codes-available').textContent = `متاح: ${available.length}`;
            document.getElementById('view-codes-sold').textContent = `مباع: ${sold.length}`;

            if (codes.length === 0) {
                document.getElementById('view-codes-list').innerHTML = '<tr><td colspan="9" class="text-center">لا توجد أكواد لهذه الفئة بعد</td></tr>';
                return;
            }

            document.getElementById('view-codes-list').innerHTML = codes.map((code, i) => {
                const isSold = code.status === 'sold';
                const soldTo = code.sold_to_username || code.sold_to || '—';
                const price = code.cost_credits != null ? `<span class="badge bg-warning text-dark">${parseFloat(code.cost_credits).toFixed(2)} ج.م</span>` : '—';
                const before = code.credits_before != null ? `<span class="badge bg-secondary">${parseFloat(code.credits_before).toFixed(2)}</span>` : '—';
                const after = code.credits_after != null ? `<span class="badge bg-info text-dark">${parseFloat(code.credits_after).toFixed(2)}</span>` : '—';
                const date = code.sold_at ? new Date(code.sold_at).toLocaleDateString('ar-EG', {year:'numeric', month:'short', day:'numeric'}) : '—';
                const deleteBtn = !isSold
                    ? `<button class="btn-small danger" style="padding:3px 8px; font-size:0.7rem;" onclick="App.deleteSingleCode('${code.id}', ${idx})"><i class="fa-solid fa-trash"></i></button>`
                    : '<span class="text-muted">—</span>';
                return `
                <tr>
                    <td class="text-muted">${i + 1}</td>
                    <td><code style="font-size:0.82rem; word-break:break-all;">${code.code}</code></td>
                    <td>${isSold ? '<span class="badge bg-danger">مباع</span>' : '<span class="badge bg-success">متاح</span>'}</td>
                    <td style="font-size:0.82rem; font-weight:600;">${isSold ? soldTo : '—'}</td>
                    <td>${isSold ? price : '—'}</td>
                    <td>${isSold ? before : '—'}</td>
                    <td>${isSold ? after : '—'}</td>
                    <td style="font-size:0.78rem;" class="text-muted">${isSold ? date : '—'}</td>
                    <td>${deleteBtn}</td>
                </tr>`;
            }).join('');
        } catch (err) {
            document.getElementById('view-codes-list').innerHTML = `<tr><td colspan="9" class="text-center text-danger">❌ خطأ: ${err.message}</td></tr>`;
        }
    },

    closeViewCodesModal() {
        document.getElementById('view-codes-modal').style.display = 'none';
    },

    async deleteSingleCode(codeId, catIdx) {
        if (!codeId) return;
        this.showToast('جاري حذف الكود... 🗑️');
        try {
            const res = await fetch('/api/codes/delete_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_id: codeId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('تم حذف الكود بنجاح! ✅');
                // Refresh codes list
                this.viewCodesForCategory(catIdx);
                // Reload main table stats
                this.loadAdminCodesTab();
            } else {
                this.showToast(`❌ فشل: ${data.error}`);
            }
        } catch (err) {
            this.showToast(`❌ خطأ: ${err.message}`);
        }
    },

    editCodeCategoryFromIndex(idx) {
        const c = window._adminCategories && window._adminCategories[idx];
        if (!c) return;
        // Open modal with current values
        document.getElementById('edit-cat-id').value = c.id;
        document.getElementById('edit-cat-name').value = c.name;
        document.getElementById('edit-cat-price').value = c.cost_credits;
        const modal = document.getElementById('edit-category-modal');
        modal.style.display = 'flex';
    },

    closeEditCategoryModal() {
        document.getElementById('edit-category-modal').style.display = 'none';
    },

    async submitEditCategory() {
        const categoryId = document.getElementById('edit-cat-id').value;
        const name = document.getElementById('edit-cat-name').value.trim();
        const price = parseFloat(document.getElementById('edit-cat-price').value);

        if (!name) { this.showToast('❌ اسم الفئة لا يمكن أن يكون فارغاً!'); return; }
        if (isNaN(price) || price < 0) { this.showToast('❌ السعر غير صالح!'); return; }

        this.closeEditCategoryModal();
        this.showToast('جاري تعديل فئة الأكواد... ✏️');
        try {
            const res = await fetch('/api/codes/categories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: categoryId, name, cost_credits: price })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('تم تعديل فئة الأكواد بنجاح! ✅');
                this.loadAdminCodesTab();
            } else {
                this.showToast(`❌ فشل التعديل: ${data.error}`);
            }
        } catch (err) {
            this.showToast(`❌ خطأ بالاتصال: ${err.message}`);
        }
    },

    deleteCodeCategoryFromIndex(idx) {
        const c = window._adminCategories && window._adminCategories[idx];
        if (!c) return;
        document.getElementById('delete-cat-id').value = c.id;
        document.getElementById('delete-cat-name-label').textContent = c.name;
        const modal = document.getElementById('delete-category-modal');
        modal.style.display = 'flex';
    },

    closeDeleteCategoryModal() {
        document.getElementById('delete-category-modal').style.display = 'none';
    },

    async submitDeleteCategory() {
        const categoryId = document.getElementById('delete-cat-id').value;
        this.closeDeleteCategoryModal();
        this.showToast('جاري حذف فئة الأكواد... 🗑️');
        try {
            const res = await fetch('/api/codes/categories/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: categoryId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('تم حذف فئة الأكواد بنجاح! ✅');
                this.loadAdminCodesTab();
            } else {
                this.showToast(`❌ فشل الحذف: ${data.error}`);
            }
        } catch (err) {
            this.showToast(`❌ خطأ بالاتصال: ${err.message}`);
        }
    },

    // Legacy kept for compatibility
    async editCodeCategoryPrompt(categoryId, currentName, currentPrice) {
        document.getElementById('edit-cat-id').value = categoryId;
        document.getElementById('edit-cat-name').value = currentName;
        document.getElementById('edit-cat-price').value = currentPrice;
        document.getElementById('edit-category-modal').style.display = 'flex';
    },

    async deleteCodeCategory(categoryId) {
        document.getElementById('delete-cat-id').value = categoryId;
        document.getElementById('delete-category-modal').style.display = 'flex';
    },

    async loadResellerCodesTab() {
        const isFlask = window.location.protocol.startsWith('http');
        if (!isFlask) {
            // Mock grid & history for Design Mode
            const mockCats = [
                { id: "cat_hyper", name: "Hyper IPTV", cost_credits: 2.0, available_count: 5 },
                { id: "cat_nova", name: "Nova IPTV", cost_credits: 3.0, available_count: 0 }
            ];
            const mockHist = [
                { category_name: "Hyper IPTV", code: "HYPER-9988-1122", sold_at: new Date().toISOString() }
            ];
            this.renderResellerCodesGrid(mockCats);
            this.renderResellerCodesHistory(mockHist);
            return;
        }

        try {
            const res = await fetch('/api/codes/categories');
            const data = await res.json();
            if (data.success) {
                this.renderResellerCodesGrid(data.categories);
            }

            const resH = await fetch(`/api/codes/history?reseller_id=${this.state.session.id}`);
            const dataH = await resH.json();
            if (dataH.success) {
                this.renderResellerCodesHistory(dataH.history);
            }
        } catch (e) {
            console.error("Failed to load reseller codes tab:", e);
        }
    },

    renderResellerCodesGrid(categories) {
        const grid = document.getElementById('reseller-codes-grid');
        if (!grid) return;
        if (categories.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center text-secondary py-4">No code categories available.</div>';
            return;
        }
        
        grid.innerHTML = '';
        categories.forEach(c => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            card.innerHTML = `
                <div class="dashboard-section-card h-100 text-center d-flex flex-column justify-content-between" style="border-top: 3px solid var(--primary) !important;">
                    <div class="p-3">
                        <div class="mb-3" style="font-size: 2.5rem; color: var(--primary);"><i class="fa-solid fa-ticket"></i></div>
                        <h4 class="font-weight-bold mb-2">${c.name}</h4>
                        <div class="mb-3">
                            <span class="badge bg-secondary me-2">السعر: ${parseFloat(c.cost_credits).toFixed(2)} ج.م</span>
                            <span class="badge ${c.available_count > 0 ? 'bg-success' : 'bg-danger'}">${c.available_count} In Stock</span>
                        </div>
                    </div>
                    <button class="btn-primary w-100 mt-2 ${c.available_count === 0 ? 'disabled' : ''}" 
                            id="btn-buy-${c.id}">
                        ${c.available_count > 0 ? 'Purchase Code 🛒' : 'Out of Stock ❌'}
                    </button>
                </div>
            `;
            grid.appendChild(card);
            
            const btn = card.querySelector(`#btn-buy-${c.id}`);
            if (btn && c.available_count > 0) {
                btn.onclick = () => {
                    this.handleBuyCode(c.id, c.name, c.cost_credits);
                };
            }
        });
    },

    renderResellerCodesHistory(history) {
        const tbody = document.getElementById('reseller-codes-history-list');
        if (!tbody) return;
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-3">No codes purchased yet.</td></tr>';
            return;
        }
        tbody.innerHTML = history.map(h => `
            <tr>
                <td class="fw-bold">${h.category_name}</td>
                <td><code class="text-primary font-weight-bold" style="font-size: 1.1rem; background: rgba(13,110,253,0.1); padding: 4px 10px; border-radius: 4px;">${h.code}</code></td>
                <td><span class="text-secondary small">${new Date(h.sold_at).toLocaleString()}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="App.copyText('${h.code}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async handleBuyCode(categoryId, categoryName, cost) {
        if (parseFloat(this.state.session.credits) < cost) {
            this.showToast("❌ رصيدك الحالي غير كافٍ لشراء هذا الكود!");
            return;
        }

        const confirmModal = document.getElementById('code-purchase-confirm-modal');
        const confirmText = document.getElementById('confirm-modal-text');
        const confirmBtn = document.getElementById('btn-confirm-purchase-action');
        const cancelBtn = document.getElementById('btn-cancel-purchase-action');

        if (!confirmModal || !confirmText || !confirmBtn || !cancelBtn) return;

        confirmText.innerText = `هل أنت متأكد من رغبتك في شراء كود تفعيل ${categoryName}؟\nسيتم خصم ${cost.toFixed(2)} ج.م من رصيدك الحالي.`;
        confirmModal.style.display = 'flex';

        confirmBtn.onclick = async () => {
            confirmModal.style.display = 'none';
            this.showToast("جاري شراء الكود... ⏳");

            try {
                const res = await fetch('/api/codes/buy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reseller_id: this.state.session.id,
                        category_id: categoryId
                    })
                });
                const data = await res.json();
                if (data.success) {
                    this.state.session.credits = parseFloat(data.credits_remaining);
                    localStorage.setItem('session_credits', data.credits_remaining);
                    this.renderStatsContainer();
                    this.loadResellerCodesTab();

                    const successModal = document.getElementById('code-purchase-success-modal');
                    const codeDisplay = document.getElementById('purchased-code-display');
                    const copyBtn = document.getElementById('btn-copy-purchased-code');
                    const closeBtn = document.getElementById('btn-close-purchased-modal');

                    if (successModal && codeDisplay && copyBtn && closeBtn) {
                        codeDisplay.innerText = data.code;
                        successModal.style.display = 'flex';

                        copyBtn.onclick = () => {
                            this.copyText(data.code);
                        };

                        closeBtn.onclick = () => {
                            successModal.style.display = 'none';
                        };
                    }
                } else {
                    alert(`❌ فشل شراء الكود: ${data.error}`);
                }
            } catch (e) {
                alert(`خطأ في الشبكة: ${e.message}`);
            }
        };

        cancelBtn.onclick = () => {
            confirmModal.style.display = 'none';
        };
    },

    async handleAddCodeCategory(e) {
        e.preventDefault();
        const name = document.getElementById('code-cat-name').value.trim();
        const cost = parseFloat(document.getElementById('code-cat-cost').value);

        if (!name || isNaN(cost) || cost < 0) return alert("يرجى إدخال بيانات صحيحة");

        const isFlask = window.location.protocol.startsWith('http');
        if (!isFlask) {
            alert("[وضع المعاينة] تم إضافة الفئة بنجاح!");
            document.getElementById('form-add-code-category').reset();
            return;
        }

        try {
            const res = await fetch('/api/codes/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cost_credits: cost })
            });
            const data = await res.json();
            if (data.success) {
                alert("🎉 تم إضافة فئة الأكواد بنجاح!");
                document.getElementById('form-add-code-category').reset();
                this.loadAdminCodesTab();
            } else {
                alert(`❌ فشل الإضافة: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async handleUploadCodes(e) {
        e.preventDefault();
        const categoryId = document.getElementById('code-upload-category').value;
        const codes = document.getElementById('code-upload-list').value.trim();

        if (!categoryId || !codes) return alert("يرجى اختيار الفئة ولصق الأكواد");

        const isFlask = window.location.protocol.startsWith('http');
        if (!isFlask) {
            alert("[وضع المعاينة] تم رفع الأكواد بنجاح!");
            document.getElementById('form-upload-codes').reset();
            return;
        }

        try {
            const res = await fetch('/api/codes/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: categoryId, codes })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                document.getElementById('form-upload-codes').reset();
                this.loadAdminCodesTab();
            } else {
                alert(`❌ فشل الرفع: ${data.error}`);
            }
        } catch (err) {
            alert(`خطأ بالاتصال: ${err.message}`);
        }
    },

    async handleChangePasswordSubmit(e) {
        e.preventDefault();
        
        const currentPass = document.getElementById('change-pass-current').value;
        const newPass = document.getElementById('change-pass-new').value;
        const confirmPass = document.getElementById('change-pass-confirm').value;

        if (newPass.length < 6) {
            this.showToast("❌ كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف!");
            return;
        }

        if (newPass !== confirmPass) {
            this.showToast("❌ كلمات المرور الجديدة غير متطابقة!");
            return;
        }

        const username = this.state.session?.username;
        if (!username) {
            this.showToast("❌ خطأ: لم يتم العثور على اسم مستخدم نشط.");
            return;
        }

        this.showToast("جاري تحديث كلمة المرور... 🔐");
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    current_password: currentPass,
                    new_password: newPass
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast("تم تحديث كلمة المرور بنجاح! ✅");
                document.getElementById('form-change-password').reset();
            } else {
                this.showToast(`❌ فشل التحديث: ${data.error}`);
            }
        } catch (err) {
            this.showToast(`❌ خطأ بالاتصال: ${err.message}`);
        }
    },

    // --- EVENT LISTENERS & UI ACTIONS SETUP ---
    setupEventListeners() {
        // --- 1. Authentication Event Listeners (Unified login logic) ---
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value.trim();
                const passRaw = document.getElementById('login-password').value;
                const errEl = document.getElementById('login-error');
                
                if (errEl) errEl.innerText = "";

                if (!username || !passRaw) {
                    return alert("برجاء إدخال اسم المستخدم وكلمة المرور!");
                }

                const isFlask = window.location.protocol.startsWith('http');

                if (isFlask) {
                    // --- FLASK BACKEND LOGIN (Production Mode) ---
                    this.showToast("جاري التحقق من بياناتك... ⏳");
                    try {
                        const res = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password: passRaw }) // Plain text - verified by bcrypt on server
                        });
                        const data = await res.json();

                        if (!data.success) {
                            if (errEl) errEl.innerText = data.error || "فشل تسجيل الدخول";
                            return;
                        }

                        const session = data.session; // { id (UUID), username, role, credits }

                        localStorage.setItem('session_role', session.role);
                        localStorage.setItem('session_user_id', session.id); // Store real UUID
                        localStorage.setItem('session_username', session.username);
                        localStorage.setItem('session_credits', session.credits);
                        
                        this.state.session = {
                            role: session.role,
                            id: session.id,         // Real UUID from Supabase
                            username: session.username,
                            credits: parseFloat(session.credits)
                        };

                        this.showToast("تم تسجيل الدخول بنجاح! 🚀");
                        
                        if (session.role === 'admin') {
                            setTimeout(() => this.showAdminDashboard(), 800);
                        } else {
                            setTimeout(() => this.showResellerDashboard(), 800);
                        }

                    } catch (err) {
                        if (errEl) errEl.innerText = "فشل الاتصال بالخادم: " + err.message;
                    }
                } else {
                    // --- DESIGN MODE LOGIN (for testing without Flask) ---
                    this.showToast("وضع التصميم: جاري تسجيل الدخول... ⏳");
                    const role = username.toLowerCase().includes('admin') ? 'admin' : 'reseller';
                    const session = {
                        role: role,
                        id: username,
                        username: username,
                        credits: role === 'admin' ? 999999.00 : 100.00
                    };

                    localStorage.setItem('session_role', session.role);
                    localStorage.setItem('session_user_id', session.id);
                    localStorage.setItem('session_username', session.username);
                    localStorage.setItem('session_credits', session.credits);
                    
                    this.state.session = {
                        role: session.role,
                        id: session.id,
                        username: session.username,
                        credits: parseFloat(session.credits)
                    };

                    this.showToast("تم تسجيل الدخول (وضع التصميم)! 🚀");
                    
                    if (session.role === 'admin') {
                        setTimeout(() => this.showAdminDashboard(), 800);
                    } else {
                        setTimeout(() => this.showResellerDashboard(), 800);
                    }
                }
            };
        }

        // Logouts
        const logoutHandler = () => {
            localStorage.removeItem('session_role');
            localStorage.removeItem('session_user_id');
            localStorage.removeItem('session_username');
            localStorage.removeItem('session_credits');
            this.state.session = { role: null, id: null, username: null, credits: 0 };
            this.showLoginScreen();
        };

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) logoutBtn.onclick = logoutHandler;

        // --- 2. Unified Tab Switchers ---
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.target;
                this.switchTab(target);
            };
        });


        // --- 3. Forms Event Listeners ---
        const addPanelForm = document.getElementById('add-panel-form');
        if (addPanelForm) addPanelForm.onsubmit = (e) => this.handleAddPanel(e);

        const addResellerForm = document.getElementById('add-reseller-form');
        if (addResellerForm) addResellerForm.onsubmit = (e) => this.handleAddReseller(e);

        const editResellerForm = document.getElementById('edit-reseller-form');
        if (editResellerForm) editResellerForm.onsubmit = (e) => this.handleEditResellerSubmit(e);

        const addServiceForm = document.getElementById('add-service-form');
        if (addServiceForm) addServiceForm.onsubmit = (e) => this.handleAddService(e);

        const addCodeCategoryForm = document.getElementById('form-add-code-category');
        if (addCodeCategoryForm) addCodeCategoryForm.onsubmit = (e) => this.handleAddCodeCategory(e);

        const uploadCodesForm = document.getElementById('form-upload-codes');
        if (uploadCodesForm) uploadCodesForm.onsubmit = (e) => this.handleUploadCodes(e);

        const changePasswordForm = document.getElementById('form-change-password');
        if (changePasswordForm) changePasswordForm.onsubmit = (e) => this.handleChangePasswordSubmit(e);

        const chargeResellerForm = document.getElementById('charge-reseller-form');
        if (chargeResellerForm) chargeResellerForm.onsubmit = (e) => this.submitChargeReseller(e);

        // --- 4. Reseller Random generators ---
        const genResUserBtn = document.getElementById('btn-gen-reseller-username');
        if (genResUserBtn) {
            genResUserBtn.onclick = () => {
                document.getElementById('reseller-new-username').value = 'u' + Utils.generateRandomString(6);
            };
        }

        const genResPassBtn = document.getElementById('btn-gen-reseller-password');
        if (genResPassBtn) {
            genResPassBtn.onclick = () => {
                document.getElementById('reseller-new-password').value = Utils.generateRandomString(8);
            };
        }

        const resellerServiceSelect = document.getElementById('reseller-select-service');
        if (resellerServiceSelect) {
            resellerServiceSelect.onchange = () => {
                const serviceId = resellerServiceSelect.value;
                const service = this.state.resellerServices.find(s => s.id == serviceId);
                const lineTypeSelect = document.getElementById('reseller-line-type');
                const infoDisplay = document.getElementById('reseller-package-info-display');
                
                if (lineTypeSelect) {
                    lineTypeSelect.innerHTML = '';
                    if (service) {
                        const isTrial = service.service_name.toLowerCase().includes('test') || service.cost_credits == 0;
                        if (isTrial) {
                            lineTypeSelect.innerHTML = `<option value="trial" selected>Trial - [مجاني] 0 - [Duration] 24 Hours</option>`;
                        } else {
                            const cost = parseInt(service.cost_credits);
                            let durationText = "1 years";
                            if (service.id == 54) durationText = "3 Months";
                            else if (service.id == 55) durationText = "6 Months";
                            else if (service.id == 56) durationText = "12 Months";
                            else if (service.id == 119) durationText = "15 Months";
                            lineTypeSelect.innerHTML = `<option value="official" selected>Official Use - [Credits price] ${cost} - [Duration] ${durationText}</option>`;
                        }
                    } else {
                        lineTypeSelect.innerHTML = `<option value="">--</option>`;
                    }
                }
                
                if (infoDisplay) {
                    if (service) {
                        const isTrial = service.service_name.toLowerCase().includes('test') || service.cost_credits == 0;
                        const cost = parseFloat(service.cost_credits);
                        
                        let durationText = "سنة واحدة (1 Year)";
                        if (service.id == 54) durationText = "3 أشهر (3 Months)";
                        else if (service.id == 55) durationText = "6 أشهر (6 Months)";
                        else if (service.id == 56) durationText = "12 شهر (12 Months)";
                        else if (service.id == 119) durationText = "15 شهر (15 Months)";
                        
                        infoDisplay.style.display = 'block';
                        infoDisplay.innerHTML = `
                            <div class="d-flex gap-2 flex-wrap mt-2">
                                <span class="info-badge-price">
                                    <i class="fa-solid fa-coins me-1"></i> السعر: ${cost.toFixed(2)} ج.م
                                </span>
                                <span class="info-badge-duration">
                                    <i class="fa-solid fa-hourglass-half me-1"></i> المدة: ${isTrial ? '24 ساعة (تجريبي)' : durationText}
                                </span>
                            </div>
                        `;
                    } else {
                        infoDisplay.style.display = 'none';
                        infoDisplay.innerHTML = '';
                    }
                }
            };
        }

        const resellerForm = document.getElementById('reseller-create-line-form');
        if (resellerForm) {
            resellerForm.onsubmit = (e) => {
                e.preventDefault();
                this.handleResellerCreateSub();
            };
        }

        const resellerSearchInput = document.getElementById('reseller-search-input');
        if (resellerSearchInput) {
            resellerSearchInput.oninput = () => this.renderResellerSubscriptions();
        }

        const adminSearchSubsInput = document.getElementById('admin-search-subs-input');
        if (adminSearchSubsInput) {
            adminSearchSubsInput.oninput = (e) => {
                this.state.adminSearchQuery = e.target.value;
                this.renderAdminAllSubscriptions();
            };
        }

        const btnFilterAdminAll = document.getElementById('btn-filter-admin-all');
        const btnFilterAdminActive = document.getElementById('btn-filter-admin-active');
        const btnFilterAdminExpired = document.getElementById('btn-filter-admin-expired');

        if (btnFilterAdminAll) {
            btnFilterAdminAll.onclick = () => {
                document.querySelectorAll('#admin-manage-users-card .filter-btn').forEach(btn => btn.classList.remove('active'));
                btnFilterAdminAll.classList.add('active');
                this.state.adminFilterStatus = 'all';
                this.renderAdminAllSubscriptions();
            };
        }
        if (btnFilterAdminActive) {
            btnFilterAdminActive.onclick = () => {
                document.querySelectorAll('#admin-manage-users-card .filter-btn').forEach(btn => btn.classList.remove('active'));
                btnFilterAdminActive.classList.add('active');
                this.state.adminFilterStatus = 'active';
                this.renderAdminAllSubscriptions();
            };
        }
        if (btnFilterAdminExpired) {
            btnFilterAdminExpired.onclick = () => {
                document.querySelectorAll('#admin-manage-users-card .filter-btn').forEach(btn => btn.classList.remove('active'));
                btnFilterAdminExpired.classList.add('active');
                this.state.adminFilterStatus = 'expired';
                this.renderAdminAllSubscriptions();
            };
        }

        const adminExportSubsExcel = document.getElementById('admin-export-subs-excel');
        if (adminExportSubsExcel) {
            adminExportSubsExcel.onclick = () => this.exportAdminSubscriptionsToExcel();
        }

        const btnShowAddReseller = document.getElementById('btn-show-add-reseller');
        if (btnShowAddReseller) {
            btnShowAddReseller.onclick = () => {
                const modal = document.getElementById('add-reseller-modal');
                if (modal) modal.style.display = 'flex';
            };
        }

        const btnCancelEditReseller = document.getElementById('btn-cancel-edit-reseller');
        if (btnCancelEditReseller) {
            btnCancelEditReseller.onclick = () => {
                this.cancelEditReseller();
            };
        }

        // Toggle buttons for showing forms
        const btnShowAddPanel = document.getElementById('btn-show-add-panel');
        if (btnShowAddPanel) {
            btnShowAddPanel.onclick = () => {
                const card = document.getElementById('add-panel-card-container');
                if (card) {
                    card.style.display = card.style.display === 'none' ? 'block' : 'none';
                    if (card.style.display === 'block') {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            };
        }

        const btnShowAddService = document.getElementById('btn-show-add-service');
        if (btnShowAddService) {
            btnShowAddService.onclick = () => {
                const card = document.getElementById('add-service-card-container');
                if (card) {
                    card.style.display = card.style.display === 'none' ? 'block' : 'none';
                    if (card.style.display === 'block') {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            };
        }

        // Cancel button for panel edit
        const btnCancelEditPanel = document.getElementById('btn-cancel-edit-panel');
        if (btnCancelEditPanel) {
            btnCancelEditPanel.onclick = () => {
                this.resetPanelForm();
            };
        }


        // --- 5. Original CRM Event Listeners ---
        const modeIptv = document.getElementById('mode-iptv');
        const modeEgy = document.getElementById('mode-egy');
        if (modeIptv) modeIptv.onclick = () => this.switchCategory('IPTV');
        if (modeEgy) modeEgy.onclick = () => this.switchCategory('EGY');

        const sideToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const sideOverlay = document.getElementById('sidebar-overlay');
        const toggle = () => { 
            const sideAdd = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if(sideAdd) sideAdd.classList.toggle('active'); 
            if(overlay) overlay.classList.toggle('active'); 
        };
        if (sideToggle) sideToggle.onclick = toggle;
        if (sideOverlay) sideOverlay.onclick = toggle;
        
        const closeSidebar = document.getElementById('close-sidebar');
        if (closeSidebar) closeSidebar.onclick = toggle;

        const syncBtn = document.getElementById('btn-sync-server');
        if (syncBtn) {
            syncBtn.onclick = () => {
                document.getElementById('sync-modal').classList.add('active');
            };
        }

        const closeSync = document.getElementById('close-sync-modal');
        if (closeSync) {
            closeSync.onclick = () => {
                document.getElementById('sync-modal').classList.remove('active');
            };
        }

        const closeDet = document.getElementById('close-reseller-details-modal');
        if (closeDet) {
            closeDet.onclick = () => this.closeResellerDetailsModal();
        }

        const startSync = document.getElementById('start-sync-action');
        if (startSync) {
            startSync.onclick = async () => {
                const user = document.getElementById('sync-user').value;
                const key = document.getElementById('sync-key').value;
                const pass = document.getElementById('sync-pass').value;

                if (!pass) return alert("برجاء كتابة كلمة السر أولاً!");

                const githubToken = localStorage.getItem('GH_TOKEN');
                const githubRepo = localStorage.getItem('GH_REPO') || window.APP_CONFIG?.GH_REPO;

                if (!githubToken || !githubRepo) {
                    alert("برجاء ضبط إعدادات GitHub (Token & Repo) من قائمة الإعدادات أولاً!");
                    return;
                }

                this.showToast("جاري إرسال أمر المزامنة للسحابة... ☁️");
                
                try {
                    const response = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/sync.yml/dispatches`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Accept': 'application/vnd.github+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            ref: 'main',
                            inputs: {
                                panel_user: user,
                                panel_pass: pass,
                                panel_key: key
                            }
                        })
                    });

                    if (response.ok) {
                        this.showToast("تم بدء المزامنة بنجاح! استنى دقيقة واعمل ريفريش. ✅");
                        document.getElementById('sync-modal').classList.remove('active');
                    } else {
                        const err = await response.text();
                        console.error(err);
                        alert("فشل بدء المزامنة! تأكد من الـ Token وإعدادات المستودع.");
                    }
                } catch (e) {
                    alert("حدث خطأ في الاتصال بـ GitHub!");
                }
            };
        }

        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.onclick = () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.filterStatus = btn.dataset.filter;
                this.render();
            };
        });

        window.onclick = (e) => {
            if (!e.target.matches('.btn-gear')) {
                document.querySelectorAll('.c-action-menu.active').forEach(m => m.classList.remove('active'));
            }
        };

        const saveSettingsBtn = document.getElementById('save-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.onclick = () => {
                const url = document.getElementById('setting-sb-url').value;
                const ghToken = document.getElementById('setting-gh-token').value;
                const ghRepo = document.getElementById('setting-gh-repo').value;

                localStorage.setItem('SB_URL', url);
                localStorage.setItem('GH_TOKEN', ghToken);
                localStorage.setItem('GH_REPO', ghRepo);

                this.showToast("تم حفظ الإعدادات! سيتم إعادة التحميل... 🔄");
                setTimeout(() => location.reload(), 1500);
            };
        }

        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.onclick = () => {
                this.state.visibleCount += this.state.pageSize;
                this.render(true);
            };
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchQuery = e.target.value;
                    this.render();
                }, 300);
            };
        }

        const dateFilterInput = document.getElementById('date-filter-input');
        if (dateFilterInput) {
            dateFilterInput.onchange = (e) => {
                this.state.dateFilter = e.target.value;
                this.render();
            };
        }

        const clearDateFilter = document.getElementById('clear-date-filter');
        if (clearDateFilter) {
            clearDateFilter.onclick = () => {
                document.getElementById('date-filter-input').value = '';
                this.state.dateFilter = '';
                this.render();
            };
        }

        const saveNewCustomerBtn = document.getElementById('save-new-customer');
        if (saveNewCustomerBtn) saveNewCustomerBtn.onclick = () => this.saveNewCustomer();
        
        const saveEditBtn = document.getElementById('save-edit-btn');
        if (saveEditBtn) saveEditBtn.onclick = () => this.saveCustomerEdit();

        const closeManageModalBtn = document.getElementById('close-manage-modal');
        if (closeManageModalBtn) closeManageModalBtn.onclick = () => this.closeManageModal();

        const deleteBtnModal = document.getElementById('delete-btn-modal');
        if (deleteBtnModal) {
            deleteBtnModal.onclick = () => {
                const customer = this.state.selectedCustomer;
                if (customer) {
                    this.closeManageModal();
                    this.startSafetyFlow(customer, 'delete');
                }
            };
        }

        const closeTemplatesModal = document.getElementById('close-templates-modal');
        if (closeTemplatesModal) closeTemplatesModal.onclick = () => document.getElementById('templates-modal').classList.remove('active');

        const templateBtns = document.querySelectorAll('.template-option-btn');
        templateBtns.forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                this.sendTemplateMessage(type);
            };
        });

        const openSettingsBtn = document.getElementById('btn-open-settings');
        if (openSettingsBtn) {
            openSettingsBtn.onclick = () => {
                document.getElementById('modal-settings').classList.add('active');
            };
        }

        const closeSettingsBtn = document.getElementById('close-settings-modal');
        if (closeSettingsBtn) {
            closeSettingsBtn.onclick = () => {
                document.getElementById('modal-settings').classList.remove('active');
            };
        }

        const exportExcelBtn = document.getElementById('export-excel');
        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => {
                if (this.state.customers.length === 0) return alert("لا توجد بيانات لتصديرها!");
                const worksheet = XLSX.utils.json_to_sheet(this.state.customers);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
                XLSX.writeFile(workbook, `${this.state.currentCategory}_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
                this.showToast("تم تصدير ملف Excel بنجاح! 📤✅");
            };
        }

        const excelUpload = document.getElementById('excel-upload');
        if (excelUpload) {
            excelUpload.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const data = new Uint8Array(evt.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheet = workbook.SheetNames[0];
                        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                        
                        this.showToast(`جاري استيراد ${rows.length} عميل... ⏳`);
                        const table = this.state.currentCategory === 'EGY' ? this.config.EGY_TABLE : this.config.IPTV_TABLE;
                        
                        let imported = 0;
                        for (let row of rows) {
                            const username = String(row.username || row['الاسم'] || row['اسم المستخدم'] || '').trim();
                            const password = String(row.password || row['الباسورد'] || row['كلمة السر'] || '').trim();
                            const rawExp = row.expire_date || row['تاريخ الانتهاء'] || row['الانتهاء'];
                            const phone = String(row.phone_number || row['الهاتف'] || row['رقم الهاتف'] || '').trim();
                            const mac = String(row.mac_address || row['الماك'] || row['عنوان MAC'] || '').trim();
                            const note = String(row.note || row.notes || row['ملاحظات'] || '').trim();

                            if (username && rawExp) {
                                const expire_date = Utils.normalizeDate(rawExp);
                                if (expire_date) {
                                    const payload = { username, password, expire_date, phone_number: phone, note };
                                    await fetch(`/api/customers`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    imported++;
                                }
                            }
                        }
                        this.showToast(`تم استيراد ${imported} عميل بنجاح! 🎉✅`);
                        this.sync();
                    } catch (err) {
                        alert("حدث خطأ أثناء قراءة ملف Excel! تأكد من توافق الأعمدة.");
                    }
                };
                reader.readAsArrayBuffer(file);
            };
        }


    },


};

// Initializer
window.App = App;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

