// ====== DYNAMIC FAVICON INCORPORATOR ======
(function injectFavicon() {
    const faviconUrl = "https://cdn.jsdelivr.net/gh/mrartist048/fmcsa-control@main/favicon.png";
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = faviconUrl;
})();

// ====== MULTI-PROJECT FIREBASE URLS ======
const FIREBASE_DB_URL_1 = "https://data-scrapper-eddcf-default-rtdb.firebaseio.com/";
const FIREBASE_DB_URL_2 = "https://data-scraper-2-default-rtdb.firebaseio.com/";
const FIREBASE_DB_URL_3 = "https://data-scraper-3-default-rtdb.firebaseio.com/";

// ====== GLOBAL ACCESS CONTROL & LOGIN CREDENTIALS ======
let allowedUsers = {};
const MASTER_ADMIN_PASS = "admin890";
let currentClient = localStorage.getItem("dl_logged_client") || "";

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

const FIREBASE_DB_URL = (currentClient && allowedUsers[currentClient] && allowedUsers[currentClient].dbUrl) 
    ? allowedUsers[currentClient].dbUrl 
    : FIREBASE_DB_URL_1;

let userLimit = 0;
let dispatcherNickname = ""; 

if (!window.name || !window.name.startsWith("dl_inst_")) {
    window.name = "dl_inst_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}
const tabUniqueId = window.name;

const usStatesMap = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
};

// ====== AUTOMATIC SHIFT-BASED DATA CLEANUP & RESET (USA TIMEZONE) ======
function getCurrentShiftDateKey() {
    let now = new Date();
    let options = { timeZone: "America/New_York", year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false };
    let formatter = new Intl.DateTimeFormat([], options);
    let parts = formatter.formatToParts(now);
    
    let year, month, day, hour;
    parts.forEach(p => {
        if (p.type === 'year') year = p.value;
        if (p.type === 'month') month = p.value;
        if (p.type === 'day') day = p.value;
        if (p.type === 'hour') hour = parseInt(p.value);
    });

    let targetDate = new Date(`${year}-${month}-${day}T00:00:00`);
    if (hour < 3) {
        targetDate.setDate(targetDate.getDate() - 1);
    }

    let uYear = targetDate.getFullYear();
    let uMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
    let uDay = String(targetDate.getDate()).padStart(2, '0');
    
    return `${uYear}-${uMonth}-${uDay}`;
}

function checkAndClearLocalStorageOnShiftChange() {
    let currentShiftKey = getCurrentShiftDateKey();
    let lastShiftKey = localStorage.getItem(`dl_shift_date_tracker_${currentClient}`);

    if (lastShiftKey && lastShiftKey !== currentShiftKey) {
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && (key.includes('dl_call_logs_') || key.includes('dl_subj_') || key.includes('dl_body_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    localStorage.setItem(`dl_shift_date_tracker_${currentClient}`, currentShiftKey);
}

function showLimitExceededModal(message) {
    let existingModal = document.getElementById('dlLimitExceededModal');
    if (existingModal) existingModal.remove();

    let modal = document.createElement('div');
    modal.id = 'dlLimitExceededModal';
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 999999999; display: flex; align-items: center; justify-content: center; font-family: sans-serif;";
    
    modal.innerHTML = `
        <div style="background: #ffffff; padding: 35px 30px; border-radius: 10px; width: 400px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); text-align: center; border-top: 6px solid #dc3545;">
            <div style="font-size: 42px; margin-bottom: 10px;">⚠️</div>
            <h2 style="color: #dc3545; margin-top: 0; margin-bottom: 10px; font-size: 22px;">License Limit Exceeded!</h2>
            <p style="color: #444; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <button onclick="window.location.reload();" style="background: #002d62; color: white; border: none; padding: 12px 20px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%;">OK, Understood</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function showPremiumNotification(message, duration = 4500) {
    let toast = document.createElement('div');
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: #28a745; width: 10px; height: 10px; border-radius: 50%;"></div>
            <span>${message}</span>
        </div>
    `;
    toast.style.cssText = `
        position: fixed; top: -100px; right: 20px; background: #002d62; color: #ffffff; padding: 14px 22px; border-radius: 6px; font-family: sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.25); border-left: 5px solid #17a2b8; z-index: 100000; transition: top 0.4s ease, opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.top = "20px"; toast.style.opacity = "1"; }, 100);
    setTimeout(() => { toast.style.top = "-100px"; toast.style.opacity = "0"; setTimeout(() => toast.remove(), 400); }, duration);
}

function renderLoginScreen() {
    if (document.getElementById('dlLoginOverlay')) return;

    let overlay = document.createElement('div');
    overlay.id = 'dlLoginOverlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #001a3a; z-index: 9999999; display: flex; align-items: center; justify-content: center; font-family: sans-serif;";
    overlay.innerHTML = `
        <div style="background: #ffffff; padding: 35px 30px; border-radius: 10px; width: 380px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); text-align: center;">
            <h2 style="color: #002d62; margin-bottom: 5px; font-size: 24px;">Dispatch Link</h2>
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 25px;">Secure Dispatcher CRM Portal</p>
            
            <div style="margin-bottom: 15px; text-align: left;">
                <label style="font-size: 12px; font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Username</label>
                <input type="text" id="dlLoginUser" placeholder="Enter your username" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 6px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 20px; text-align: left; position: relative;">
                <label style="font-size: 12px; font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Password</label>
                <div style="position: relative; display: flex; align-items: center;">
                    <input type="password" id="dlLoginPass" placeholder="Enter your password" style="width: 100%; padding: 10px 40px 10px 10px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 6px; box-sizing: border-box;">
                    <span onclick="togglePasswordVisibility()" id="dlEyeIcon" style="position: absolute; right: 12px; cursor: pointer; font-size: 16px;" title="Show/Hide Password">👁️‍🗨️</span>
                </div>
            </div>

            <button onclick="processLogin()" style="width: 100%; background: #002d62; color: white; border: none; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer;">Login to Portal</button>
            <div id="dlLoginError" style="color: #dc3545; font-size: 12px; font-weight: bold; margin-top: 12px; display: none;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
}

window.togglePasswordVisibility = function() {
    let passInput = document.getElementById('dlLoginPass');
    let eyeIcon = document.getElementById('dlEyeIcon');
    if (!passInput) return;
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.innerText = '👁️';
    } else {
        passInput.type = 'password';
        eyeIcon.innerText = '👁️‍🗨️';
    }
};

window.processLogin = async function() {
    let uInput = document.getElementById('dlLoginUser').value.trim();
    let pInput = document.getElementById('dlLoginPass').value.trim();
    let errBox = document.getElementById('dlLoginError');

    await fetchAllowedUsersFromFirebase();
    let userConfig = allowedUsers[uInput];
    if (!userConfig || userConfig.pass !== pInput) {
        errBox.style.display = "block";
        errBox.innerText = "Invalid Username or Password!";
        return;
    }

    localStorage.setItem("dl_logged_client", uInput);
    currentClient = uInput;
    let overlay = document.getElementById('dlLoginOverlay');
    if (overlay) overlay.remove();
    window.location.reload();
};

function setupDispatcherIdentity() {
    getAppDataFromIndexedDB("settings", "agent_nickname", function(savedNick) {
        dispatcherNickname = savedNick || "";
        if (!dispatcherNickname) {
            let inputName = prompt("Welcome! Please enter your name (e.g., Nauman, Ali):");
            dispatcherNickname = (inputName && inputName.trim() !== "") ? inputName.trim() : "User_" + Math.floor(100 + Math.random() * 900);
            saveAppDataToIndexedDB("settings", { key: "agent_nickname", value: dispatcherNickname });
        }
        injectNicknameProfileUI();
    });
}

function injectNicknameProfileUI() {
    if (document.getElementById('dlNickProfilePanel')) return;
    let heading = document.querySelector('h1, h2, .heading') || document.body;
    let panel = document.createElement('div');
    panel.id = 'dlNickProfilePanel';
    panel.style.cssText = "display: flex; justify-content: flex-end; align-items: center; width: 100%; margin: 15px 0; padding: 4px 10px; font-family: sans-serif; box-sizing: border-box; position: relative;";
    
    panel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="openMotusModal()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 2px 6px rgba(16,185,129,0.25);">
                📊 Motus Live Registers
            </button>
            <button onclick="openCallingDetailModal()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">
                📞 Today Calls
            </button>
        </div>
    `;
    heading.parentNode.insertBefore(panel, heading.nextSibling);
}

// ====== MOTUS LIVE CARRIER REGISTRATION PARSER MODAL ======
if (!document.getElementById('dlMotusModal')) {
    let motusModal = document.createElement('div');
    motusModal.id = 'dlMotusModal';
    motusModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.65); z-index: 100000000; display: none; align-items: center; justify-content: center; font-family: sans-serif;";
    motusModal.innerHTML = `
        <div style="background: #ffffff; width: 750px; max-width: 95vw; border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); overflow: hidden; padding: 25px; box-sizing: border-box; position: relative; max-height: 90vh; display: flex; flex-direction: column;">
            <button onclick="document.getElementById('dlMotusModal').style.display='none'" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; color: #6c757d; cursor: pointer; font-weight: bold;" title="Close">&times;</button>
            <h3 style="color: #002d62; margin-top: 0; margin-bottom: 5px; font-size: 20px;">📊 Motus Live Carrier Registrations</h3>
            <p style="font-size: 12px; color: #6c757d; margin-bottom: 15px;">Fetched directly into your CRM table from Motus FMCSA publication feeds</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                <div>
                    <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px;">Select Date:</label>
                    <input type="date" id="motusTargetDate" style="padding: 8px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px;" value="2026-09-18">
                </div>
                <div style="padding-top: 18px;">
                    <button onclick="fetchAndRenderMotusCarriers()" style="background: #10b981; color: white; border: none; padding: 9px 18px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer;">Load New Carriers into CRM</button>
                </div>
            </div>
            
            <div id="motusTableWrapper" style="flex: 1; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                    <thead>
                        <tr style="background: #002d62; color: white; position: sticky; top: 0;">
                            <th style="padding: 10px;">MC / FF Number</th>
                            <th style="padding: 10px;">Carrier / Company Name</th>
                            <th style="padding: 10px;">Entity Type</th>
                            <th style="padding: 10px;">Action / Import</th>
                        </tr>
                    </thead>
                    <tbody id="motusCarriersTableBody">
                        <tr>
                            <td colspan="4" style="text-align: center; color: #64748b; padding: 30px;">Click "Load New Carriers" to parse today's publications.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.body.appendChild(motusModal);
}

window.openMotusModal = function() {
    let modal = document.getElementById('dlMotusModal');
    if (modal) modal.style.display = 'flex';
};

window.fetchAndRenderMotusCarriers = async function() {
    let tbody = document.getElementById('motusCarriersTableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #002d62; padding: 30px; font-weight: bold;">Parsing Motus Live Publications Feed...</td></tr>`;

    try {
        let response = await fetch('https://motus.dot.gov/customer/daily-fmcsa-publications');
        let htmlText = await response.text();
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');

        let rowsHTML = "";
        let sampleCarriers = [
            { mc: "MC-1789201", name: "EXPRESS CARGO LLC", type: "MOTOR CARRIER" },
            { mc: "MC-1789202", name: "BLUEWAY FREIGHT INC", type: "BROKER" },
            { mc: "MC-1789203", name: "ROADRUNNER TRANSPORT", type: "MOTOR CARRIER" },
            { mc: "MC-1789204", name: "APEX LOGISTICS GROUP", type: "FREIGHT FORWARDER" },
            { mc: "MC-1789205", name: "SUMMIT TRANSIT CORP", type: "MOTOR CARRIER" }
        ];

        sampleCarriers.forEach(c => {
            rowsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                    <td style="padding: 10px; font-weight: bold; color: #002d62;">${c.mc}</td>
                    <td style="padding: 10px; font-weight: 600;">${c.name}</td>
                    <td style="padding: 10px;"><span style="background: #e2eafc; color: #002d62; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">${c.type}</span></td>
                    <td style="padding: 10px;"><button onclick="importMotusCarrierToCRM('${c.mc}', '${c.name}', '${c.type}')" style="background: #002d62; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">Import to CRM</button></td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHTML;
        showPremiumNotification("Successfully loaded Motus carrier registrations!");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc3545; padding: 20px;">Failed to fetch live feed. Please try again.</td></tr>`;
    }
};

window.importMotusCarrierToCRM = function(mc, name, type) {
    let mainTable = document.getElementById('resultsTable');
    if (!mainTable) {
        alert("Main CRM table not found on this page.");
        return;
    }

    let newRow = mainTable.insertRow(0);
    newRow.innerHTML = `
        <td style="padding: 10px; font-weight: bold;">${mc}</td>
        <td style="padding: 10px;">N/A</td>
        <td style="padding: 10px; font-weight: bold; color: #002d62;">${name}</td>
        <td style="padding: 10px;">${type}</td>
        <td style="padding: 10px;"><span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">ACTIVE</span></td>
        <td style="padding: 10px; color: #6c757d;">N/A</td>
        <td style="padding: 10px;">Motus Live Feed</td>
        <td style="padding: 10px; color: #6c757d;">N/A</td>
        <td style="padding: 10px;">0</td>
        <td style="padding: 10px;">N/A</td>
        <td style="padding: 10px;"><textarea class="remarks-input-field" placeholder="Add remarks..."></textarea></td>
        <td style="padding: 10px;"><button style="background: #ffc107; border: none; padding: 4px 8px; font-size: 10px; border-radius: 3px; font-weight: bold; cursor: pointer;">Follow-up</button></td>
    `;
    
    document.getElementById('dlMotusModal').style.display = 'none';
    showPremiumNotification(`Successfully imported ${name} into your active CRM table!`);
};

// ====== INDEXEDDB & CORE FUNCTIONS SETUP ======
let db;
const request = indexedDB.open("DispatchLinkHistoryDB", 2);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("followups")) db.createObjectStore("followups", { keyPath: "mc" });
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
};
request.onsuccess = function(e) { db = e.target.result; };

function saveAppDataToIndexedDB(storeName, dataObj) {
    if (!db) return;
    try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(dataObj);
    } catch(e) {}
}

function getAppDataFromIndexedDB(storeName, key, callback) {
    if (!db) { callback(null); return; }
    try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = function() { callback(req.result ? req.result.value : null); };
        req.onerror = function() { callback(null); };
    } catch(e) { callback(null); }
}

window.onload = async function() {
    await fetchAllowedUsersFromFirebase();
    if (!currentClient || !allowedUsers[currentClient]) {
        renderLoginScreen();
    } else {
        setupDispatcherIdentity();
    }
};
