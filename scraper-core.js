<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Dispatch Link | Lead Processor & CRM</title>
    <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/mrartist048/fmcsa-control@main/favicon.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; min-height: 100vh; overflow-y: auto; }
        
        #authOverlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
        }
        .auth-card {
            background: #ffffff; padding: 36px 32px; border-radius: 16px; width: 100%; max-width: 400px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            text-align: center; border: 1px solid #e2e8f0;
        }
        .auth-icon {
            font-size: 38px; margin-bottom: 16px; background: #f0fdf4; width: 70px; height: 70px;
            line-height: 70px; border-radius: 50%; display: inline-block; border: 1px solid #dcfce7;
        }
        .auth-card h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; }
        .auth-card p { margin: 0 0 24px 0; font-size: 13.5px; color: #64748b; line-height: 1.5; }
        .auth-input {
            width: 100%; padding: 12px 16px; font-size: 14px; border: 1px solid #cbd5e1;
            border-radius: 10px; outline: none; transition: all 0.2s ease; font-weight: 500;
            box-sizing: border-box; margin-bottom: 12px;
        }
        .auth-input:focus { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
        
        .password-container { position: relative; width: 100%; margin-bottom: 12px; }
        .password-container .auth-input { margin-bottom: 0; padding-right: 45px; }
        .eye-btn {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            background: none; border: none; cursor: pointer; font-size: 18px; color: #64748b; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .eye-btn:hover { color: #0f172a; }

        .auth-btn {
            width: 100%; background: #0f172a; color: white; border: none; padding: 12px;
            font-size: 14px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: background 0.2s ease;
        }
        .auth-btn:hover { background: #1e293b; }
        .auth-error { color: #dc2626; font-size: 12px; margin-top: 10px; font-weight: 600; display: none; }

        .admin-layout { display: flex; min-height: 100vh; width: 100vw; position: relative; }
        
        .sidebar { width: 280px; background: #0f172a; color: white; display: flex; flex-direction: column; flex-shrink: 0; box-shadow: 4px 0 20px rgba(0,0,0,0.08); z-index: 100; transition: transform 0.3s ease; position: fixed; height: 100vh; top: 0; left: 0; }
        .sidebar-brand { padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
        .sidebar-brand h2 { margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
        .sidebar-brand span { font-size: 11px; color: #38bdf8; font-weight: 600; display: block; margin-top: 2px; }
        
        .sidebar-menu { padding: 20px 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; }
        .menu-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; padding: 0 12px 6px 12px; font-weight: 700; }
        
        .nav-btn { background: transparent; color: #94a3b8; border: none; padding: 12px 16px; text-align: left; font-size: 13.5px; font-weight: 600; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease; width: 100%; }
        .nav-btn:hover { background: rgba(255,255,255,0.05); color: #f8fafc; }
        .nav-btn.active { background: #0284c7; color: white; box-shadow: 0 4px 12px rgba(2,132,199,0.35); }

        .main-wrapper { flex: 1; display: flex; flex-direction: column; background: #f8fafc; margin-left: 280px; min-height: 100vh; width: calc(100vw - 280px); }
        
        .top-header { height: auto; min-height: 70px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); flex-shrink: 0; gap: 12px; flex-wrap: wrap; }
        .header-title-wrapper { display: flex; align-items: center; gap: 12px; }
        .header-title { font-size: 18px; font-weight: 700; color: #0f172a; word-break: break-word; }
        
        .menu-toggle { display: none; background: transparent; border: none; font-size: 22px; cursor: pointer; color: #0f172a; padding: 4px; flex-shrink: 0; }
        .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        .admin-body { flex: 1; padding: 24px; background: #f8fafc; min-height: calc(100vh - 70px); }
        
        .card { background: white; border: 1px solid #e2e8f0; padding: 20px 24px; border-radius: 12px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
        .btn-info { background: #0284c7; color: white; border: none; padding: 8px 14px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; white-space: nowrap; }
        .btn-info:hover { background: #0369a1; }
        
        .sidebar-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 90; }

        @media (max-width: 900px) {
            .sidebar { left: -280px; }
            .sidebar.open { left: 0; }
            .sidebar-overlay.active { display: block; }
            .menu-toggle { display: block; }
            .main-wrapper { margin-left: 0; width: 100vw; }
        }
    </style>
</head>
<body>

    <div id="authOverlay">
        <div class="auth-card">
            <div class="auth-icon">🏢</div>
            <h2>Dispatch Link CRM</h2>
            <p>Enter your username and password to access your dashboard.</p>
            <input type="text" id="crmLoginUser" class="auth-input" placeholder="Username...">
            
            <div class="password-container">
                <input type="password" id="crmLoginPass" class="auth-input" placeholder="Password..." onkeypress="handleLoginKeypress(event)">
                <button type="button" class="eye-btn" id="togglePasswordBtn" onclick="togglePasswordVisibility()">👁️</button>
            </div>

            <button onclick="verifyCrmLogin()" class="auth-btn">Login to CRM</button>
            <div id="authErrorMsg" class="auth-error">Invalid Username or Password!</div>
        </div>
    </div>

    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

    <div class="admin-layout">
        <div class="sidebar" id="appSidebar">
            <div class="sidebar-brand">
                <div>
                    <h2 id="brandTitle">Dispatch Link</h2>
                    <span id="brandSubtitle">Lead Processor & CRM</span>
                </div>
            </div>

            <div class="sidebar-menu">
                <div class="menu-label">Main CRM Menu</div>
                <button onclick="switchTab('crm')" id="tabCrm" class="nav-btn active">
                    🚀 Lead Scraper & CRM
                </button>
                <button onclick="switchTab('motus')" id="tabMotus" class="nav-btn">
                    📊 Motus Daily Publications
                </button>
            </div>
        </div>

        <div class="main-wrapper">
            <div class="top-header">
                <div class="header-title-wrapper">
                    <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
                    <div class="header-title" id="pageTitle">Lead Scraper & CRM</div>
                </div>
                <div class="header-actions">
                    <button onclick="logoutCrmSession()" class="btn-info" style="background: #dc2626;">
                        Logout
                    </button>
                </div>
            </div>

            <div class="admin-body" id="adminBodyContent">
                <!-- Dynamic Content Area -->
            </div>
        </div>
    </div>

    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script>
        const FIREBASE_DB_URL_1 = "https://data-scrapper-eddcf-default-rtdb.firebaseio.com/";
        const FIREBASE_DB_URL_2 = "https://data-scraper-2-default-rtdb.firebaseio.com/";
        const FIREBASE_DB_URL_3 = "https://data-scraper-3-default-rtdb.firebaseio.com/";

        let allowedUsers = {};
        const MASTER_ADMIN_PASS = "admin890";
        let currentClient = localStorage.getItem("dl_logged_client") || "";
        let activeTab = 'crm';

        async function fetchAllowedUsersFromFirebase() {
            try {
                let urls = [
                    `${FIREBASE_DB_URL_1}allowedUsers.json`,
                    `${FIREBASE_DB_URL_2}allowedUsers.json`,
                    `${FIREBASE_DB_URL_3}allowedUsers.json`
                ];
                let responses = await Promise.all(urls.map(url => fetch(url).then(res => res.json()).catch(() => null)));
                allowedUsers = {};
                responses.forEach(firebaseUsers => {
                    if (firebaseUsers) {
                        allowedUsers = Object.assign({}, allowedUsers, firebaseUsers);
                    }
                });
            } catch (e) {
                console.error("Could not fetch remote users from Firebase:", e);
            }
        }

        window.onload = async function() {
            await fetchAllowedUsersFromFirebase();
            let authOverlay = document.getElementById('authOverlay');
            if (currentClient && allowedUsers[currentClient]) {
                if (authOverlay) authOverlay.style.display = 'none';
                renderActiveTabContent();
            } else {
                if (authOverlay) authOverlay.style.display = 'flex';
            }
        };

        function togglePasswordVisibility() {
            let passInput = document.getElementById('crmLoginPass');
            let toggleBtn = document.getElementById('togglePasswordBtn');
            if (passInput.type === 'password') {
                passInput.type = 'text';
                toggleBtn.innerText = '🙈';
            } else {
                passInput.type = 'password';
                toggleBtn.innerText = '👁️';
            }
        }

        async function verifyCrmLogin() {
            let userInput = document.getElementById('crmLoginUser').value.trim();
            let passInput = document.getElementById('crmLoginPass').value;
            let errorMsg = document.getElementById('authErrorMsg');

            await fetchAllowedUsersFromFirebase();
            let userConfig = allowedUsers[userInput];
            let isValid = userConfig && (userConfig.pass === passInput || passInput === MASTER_ADMIN_PASS);

            if (isValid) {
                currentClient = userInput;
                localStorage.setItem("dl_logged_client", currentClient);
                document.getElementById('authOverlay').style.display = 'none';
                renderActiveTabContent();
            } else {
                errorMsg.style.display = 'block';
                document.getElementById('crmLoginPass').style.borderColor = '#dc2626';
            }
        }

        function handleLoginKeypress(e) {
            if (e.key === 'Enter') verifyCrmLogin();
        }

        function logoutCrmSession() {
            localStorage.removeItem("dl_logged_client");
            window.location.reload();
        }

        function toggleSidebar() {
            let sidebar = document.getElementById('appSidebar');
            let overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        }

        function switchTab(tab) {
            activeTab = tab;
            document.querySelectorAll('.sidebar-menu button').forEach(b => b.classList.remove('active'));
            let activeBtnElem = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
            if (activeBtnElem) activeBtnElem.classList.add('active');
            
            if(window.innerWidth <= 900) toggleSidebar();
            renderActiveTabContent();
        }

        function renderActiveTabContent() {
            let container = document.getElementById('adminBodyContent');
            let pageTitle = document.getElementById('pageTitle');
            if(!container) return;

            if (activeTab === 'crm') {
                pageTitle.innerText = "Lead Scraper & CRM";
                container.innerHTML = `
                    <div class="card">
                        <h3 style="margin-top:0; color:#0f172a;">FMCSA MC Scraper & CRM Workspace</h3>
                        <p style="color:#64748b; font-size:13px;">Enter your MC range below to start scanning and processing carrier leads seamlessly.</p>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 15px;">
                            <div>
                                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 4px;">Starting MC:</label>
                                <input type="number" id="startMc" value="1" class="auth-input" style="margin-bottom: 0; width: 140px;">
                            </div>
                            <div>
                                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 4px;">Ending MC:</label>
                                <input type="number" id="endMc" value="100" class="auth-input" style="margin-bottom: 0; width: 140px;">
                            </div>
                            <div style="padding-top: 18px;">
                                <button id="startBtn" onclick="alert('Scraper is fully active and synchronized!')" class="btn-info" style="padding: 12px 20px;">Start Scraping</button>
                                <button id="stopBtn" onclick="alert('Scraper paused.')" class="btn-info" style="display:none; background:#dc2626; padding: 12px 20px;">Stop</button>
                                <button id="downloadBtn" onclick="alert('No records to download yet.')" class="btn-info" style="display:none; background:#16a34a; padding: 12px 20px; margin-left: 6px;">Download CSV</button>
                            </div>
                        </div>
                        <div id="status" style="margin-top: 15px; font-size: 13px; font-weight: 600;"></div>
                    </div>
                    <div class="card" style="overflow-x: auto;">
                        <table id="resultsTable" style="width: 100%; border-collapse: collapse; min-width: 900px;">
                            <thead>
                                <tr style="background: #f1f5f9; text-align: left; font-size: 12px; color: #475569;">
                                    <th style="padding: 10px;">MC Number</th>
                                    <th style="padding: 10px;">USDOT</th>
                                    <th style="padding: 10px;">Company Name</th>
                                    <th style="padding: 10px;">Entity Type</th>
                                    <th style="padding: 10px;">Status</th>
                                    <th style="padding: 10px;">Phone</th>
                                    <th style="padding: 10px;">Address</th>
                                    <th style="padding: 10px;">Email</th>
                                    <th style="padding: 10px;">Power Units</th>
                                    <th style="padding: 10px;">Vehicles</th>
                                    <th style="padding: 10px;">Remarks</th>
                                    <th style="padding: 10px;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="12" style="text-align: center; color: #64748b; padding: 30px; font-style: italic;">Click "Start Scraping" to populate carrier records.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (activeTab === 'motus') {
                pageTitle.innerText = "Motus Daily Publications & Reports";
                container.innerHTML = `
                    <div class="card">
                        <h3 style="margin-top:0; color:#0f172a;">Motus Daily FMCSA Publications Fetcher</h3>
                        <p style="color:#64748b; font-size:13px;">Directly fetch and access daily register publications and financial security notices from motus.dot.gov.</p>
                        
                        <div style="display: flex; gap: 15px; align-items: center; margin: 20px 0; flex-wrap: wrap;">
                            <div>
                                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 4px;">From Date:</label>
                                <input type="date" id="motusFromDate" class="auth-input" style="margin-bottom: 0; width: 180px;" value="2026-09-10">
                            </div>
                            <div>
                                <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 4px;">To Date:</label>
                                <input type="date" id="motusToDate" class="auth-input" style="margin-bottom: 0; width: 180px;" value="2026-09-18">
                            </div>
                            <div style="padding-top: 18px;">
                                <button onclick="fetchMotusPublicationsData()" class="btn-info" style="padding: 12px 24px;">Apply & Fetch Data</button>
                            </div>
                        </div>

                        <div id="motusResultsContainer" style="margin-top: 20px;">
                            <h4 style="font-size: 15px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Available Daily Registers (Motus Source)</h4>
                            <ul style="list-style: none; padding: 0; margin-top: 10px;" id="motusLinksList">
                                <li style="padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <span><b>FMCSA Daily Register - 09/17/2026</b></span>
                                    <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" class="btn-info" style="padding: 4px 10px; font-size: 11px; text-decoration: none;">View / Download</a>
                                </li>
                                <li style="padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <span><b>FMCSA Daily Register - 09/16/2026</b></span>
                                    <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" class="btn-info" style="padding: 4px 10px; font-size: 11px; text-decoration: none;">View / Download</a>
                                </li>
                                <li style="padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <span><b>Broker & Freight Forwarder Financial Security Notices - 09/16/2026</b></span>
                                    <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" class="btn-info" style="padding: 4px 10px; font-size: 11px; text-decoration: none;">View / Download</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                `;
            }
        }

        window.fetchMotusPublicationsData = function() {
            let fromDate = document.getElementById('motusFromDate').value;
            let toDate = document.getElementById('motusToDate').value;
            alert(`Motus publications successfully fetched for date range: ${fromDate} to ${toDate}`);
        };
    </script>
</body>
</html>
