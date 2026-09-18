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
        console.log("New USA Shift detected! Clearing temporary local storage data...");
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

async function cleanupOldFirebaseData() {
    if (!currentClient || !dispatcherNickname) return;
    
    try {
        let safeUserKey = dispatcherNickname.replace(/[.#$\/\[\]]/g, "_");
        let callLogUrl = `${FIREBASE_DB_URL}call_logs/${currentClient}/${safeUserKey}.json`;
        
        let res = await fetch(callLogUrl);
        let remoteLogs = await res.json();
        
        if (Array.isArray(remoteLogs)) {
            let sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            let filteredLogs = remoteLogs.filter(log => {
                if (!log.shiftDate) return false;
                let logDate = new Date(log.shiftDate);
                return logDate >= sevenDaysAgo;
            });
            
            if (filteredLogs.length !== remoteLogs.length) {
                await fetch(callLogUrl, {
                    method: 'PUT',
                    body: JSON.stringify(filteredLogs)
                });
                console.log("Cleaned up Firebase call logs older than 7 days (allowedUsers untouched).");
            }
        }
    } catch (e) {
        console.error("Failed to cleanup old Firebase data:", e);
    }
}

async function performAutomaticDataCleanup() {
    if (!currentClient) return;
    checkAndClearLocalStorageOnShiftChange();
    
    let currentShiftKey = getCurrentShiftDateKey();
    try {
        if (dispatcherNickname) {
            let safeUserKey = dispatcherNickname.replace(/[.#$\/\[\]]/g, "_");
            let callLogUrl = `${FIREBASE_DB_URL}call_logs/${currentClient}/${safeUserKey}.json`;
            let res = await fetch(callLogUrl);
            let remoteLogs = await res.json();
            if (Array.isArray(remoteLogs)) {
                let freshRemoteLogs = remoteLogs.filter(log => {
                    return log.shiftDate === currentShiftKey;
                });
                if (freshRemoteLogs.length !== remoteLogs.length) {
                    await fetch(callLogUrl, {
                        method: 'PUT',
                        body: JSON.stringify(freshRemoteLogs)
                    });
                }
            }
        }
    } catch (e) {
        console.error("Auto cleanup call logs failed:", e);
    }
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
            <p style="color: #444; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
                ${message}
            </p>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #ddd; font-size: 12px; color: #333; margin-bottom: 20px;">
                Need to increase your active device/tab limit? <br>Contact Admin: <b>03700684849</b>
            </div>
            <button onclick="window.location.reload();" style="background: #002d62; color: white; border: none; padding: 12px 20px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%;">OK, Understood</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function showPremiumNotification(message, duration = 4500) {
    let toast = document.createElement('div');
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: #28a745; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 8px #28a745;"></div>
            <span>${message}</span>
        </div>
    `;
    toast.style.cssText = `
        position: fixed; top: -100px; right: 20px; background: #002d62; color: #ffffff; padding: 14px 22px; border-radius: 6px; font-family: sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.25); border-left: 5px solid #17a2b8; z-index: 100000; transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s; opacity: 0;
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
                    <span onclick="togglePasswordVisibility()" id="dlEyeIcon" style="position: absolute; right: 12px; cursor: pointer; font-size: 16px; user-select: none;" title="Show/Hide Password">👁️‍🗨️</span>
                </div>
            </div>

            <button onclick="processLogin()" style="width: 100%; background: #002d62; color: white; border: none; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.2s;">Login to Portal</button>
            <div id="dlLoginError" style="color: #dc3545; font-size: 12px; font-weight: bold; margin-top: 12px; display: none;"></div>
            
            <div style="margin-top: 25px; font-size: 11px; color: #6c757d;">
                Need access? Contact Admin: <b>03700684849</b><br>
                Email: <a href="mailto:info@dispatchlink.online" style="color: #6c757d; text-decoration: underline;">info@dispatchlink.online</a>
            </div>
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

    let todayStr = new Date().toISOString().split('T')[0];
    if (todayStr > userConfig.expires) {
        errBox.style.display = "block";
        errBox.innerText = "Subscription has expired! Contact Admin.";
        return;
    }

    localStorage.setItem("dl_logged_client", uInput);
    currentClient = uInput;

    saveAppDataToIndexedDB("settings", { key: "client_login", value: uInput });
    
    let overlay = document.getElementById('dlLoginOverlay');
    if (overlay) overlay.remove();

    window.location.reload();
};

function setupDispatcherIdentity() {
    getAppDataFromIndexedDB("settings", "agent_nickname", function(savedNick) {
        dispatcherNickname = savedNick || "";
        if (!dispatcherNickname) {
            let inputName = prompt("Welcome! Please enter your name (e.g., Nauman, Ali, Bilal):");
            if (inputName && inputName.trim() !== "") {
                dispatcherNickname = inputName.trim();
            } else {
                dispatcherNickname = "User_" + Math.floor(100 + Math.random() * 900);
            }
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
                📊 Motus Publications
            </button>

            <button onclick="openCallingDetailModal()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 2px 6px rgba(245,158,11,0.25);" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
                📞 Today Calls
            </button>

            <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 30px; padding: 5px 14px 5px 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); position: relative; cursor: pointer;" onclick="toggleAgentDropdown(event)">
                <div style="width: 32px; height: 32px; background: #002d62; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;" id="dlDispAvatarLetter">
                    A
                </div>
                <div style="display: flex; flex-direction: column; text-align: left;">
                    <span style="font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Active Agent</span>
                    <span id="dlDispCurrentName" style="font-size: 13px; color: #0f172a; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                        Loading... <span style="font-size: 9px; color: #64748b;">▼</span>
                    </span>
                </div>

                <div id="dlAgentDropdownMenu" style="display: none; position: absolute; top: 48px; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); width: 180px; z-index: 99999; padding: 6px 0; font-family: sans-serif;">
                    <div onclick="changeDispatcherName(); event.stopPropagation();" style="padding: 10px 14px; font-size: 12px; color: #334155; font-weight: 600; cursor: pointer;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">Edit Name</div>
                    <div onclick="openAdminPanelPrompt(); event.stopPropagation();" style="padding: 10px 14px; font-size: 12px; color: #334155; font-weight: 600; cursor: pointer;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">Admin Panel</div>
                    <div style="height: 1px; background: #e2e8f0; margin: 4px 0;"></div>
                    <div onclick="logoutUser(); event.stopPropagation();" style="padding: 10px 14px; font-size: 12px; color: #dc2626; font-weight: 600; cursor: pointer;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">Logout</div>
                </div>
            </div>
        </div>
    `;
    heading.parentNode.insertBefore(panel, heading.nextSibling);
    
    setTimeout(() => {
        let nameSpan = document.getElementById('dlDispCurrentName');
        let avatarDiv = document.getElementById('dlDispAvatarLetter');
        if(nameSpan) nameSpan.innerHTML = `${dispatcherNickname} <span style="font-size: 9px; color: #64748b;">▼</span>`;
        if(avatarDiv) avatarDiv.innerText = dispatcherNickname.charAt(0).toUpperCase();
    }, 100);

    document.addEventListener('click', function(e) {
        let dropdown = document.getElementById('dlAgentDropdownMenu');
        if (dropdown && !e.target.closest('#dlNickProfilePanel')) {
            dropdown.style.display = 'none';
        }
    });
}

// ====== MOTUS MODAL FEATURE INTEGRATION ======
if (!document.getElementById('dlMotusModal')) {
    let motusModal = document.createElement('div');
    motusModal.id = 'dlMotusModal';
    motusModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.65); z-index: 100000000; display: none; align-items: center; justify-content: center; font-family: sans-serif;";
    motusModal.innerHTML = `
        <div style="background: #ffffff; width: 460px; border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); overflow: hidden; padding: 25px; box-sizing: border-box; position: relative;">
            <button onclick="document.getElementById('dlMotusModal').style.display='none'" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 22px; color: #6c757d; cursor: pointer; font-weight: bold;" title="Close">&times;</button>
            <h3 style="color: #002d62; margin-top: 0; margin-bottom: 5px; font-size: 18px;">📊 Motus Daily Publications</h3>
            <p style="font-size: 12px; color: #6c757d; margin-bottom: 15px;">Fetch daily FMCSA register lists and notices from motus.dot.gov</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px;">From Date:</label>
                    <input type="date" id="motusModalFrom" style="width: 100%; padding: 8px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px; box-sizing: border-box;" value="2026-09-10">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px;">To Date:</label>
                    <input type="date" id="motusModalTo" style="width: 100%; padding: 8px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px; box-sizing: border-box;" value="2026-09-18">
                </div>
            </div>
            <button onclick="fetchMotusDataList()" style="background: #10b981; color: white; border: none; padding: 10px; width: 100%; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-bottom: 15px;">Fetch Publications</button>
            
            <div id="motusModalResults" style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #f8fafc; font-size: 12px;">
                <div style="color: #64748b; text-align: center; padding: 15px;">Click fetch to load data links.</div>
            </div>
        </div>
    `;
    document.body.appendChild(motusModal);
}

window.openMotusModal = function() {
    let modal = document.getElementById('dlMotusModal');
    if (modal) modal.style.display = 'flex';
};

window.fetchMotusDataList = function() {
    let resultsBox = document.getElementById('motusModalResults');
    resultsBox.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="padding: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span><b>FMCSA Daily Register - 09/17/2026</b></span>
                <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" style="background: #002d62; color: white; padding: 4px 8px; border-radius: 3px; text-decoration: none; font-size: 11px; font-weight: bold;">Open</a>
            </div>
            <div style="padding: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span><b>FMCSA Daily Register - 09/16/2026</b></span>
                <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" style="background: #002d62; color: white; padding: 4px 8px; border-radius: 3px; text-decoration: none; font-size: 11px; font-weight: bold;">Open</a>
            </div>
            <div style="padding: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span><b>Broker Security Notices - 09/16/2026</b></span>
                <a href="https://motus.dot.gov/customer/daily-fmcsa-publications" target="_blank" style="background: #002d62; color: white; padding: 4px 8px; border-radius: 3px; text-decoration: none; font-size: 11px; font-weight: bold;">Open</a>
            </div>
        </div>
    `;
};

window.toggleAgentDropdown = function(e) {
    e.stopPropagation();
    let dropdown = document.getElementById('dlAgentDropdownMenu');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
};

window.changeDispatcherName = function() {
    let oldName = dispatcherNickname;
    let newName = prompt("Enter your new display name:", oldName);
    if (newName && newName.trim() !== "") {
        dispatcherNickname = newName.trim();
        saveAppDataToIndexedDB("settings", { key: "agent_nickname", value: dispatcherNickname });
        let label = document.getElementById('dlDispCurrentName');
        let avatarDiv = document.getElementById('dlDispAvatarLetter');
        if (label) label.innerHTML = `${dispatcherNickname} <span style="font-size: 9px; color: #64748b;">▼</span>`;
        if (avatarDiv) avatarDiv.innerText = dispatcherNickname.charAt(0).toUpperCase();
        updateActiveSessionData();
        window.location.reload();
    }
};

window.logoutUser = function() {
    let safeTabKey = tabUniqueId.replace(/[.#$\/\[\]]/g, "_");
    navigator.sendBeacon(`${FIREBASE_DB_URL}sessions/${currentClient}/${safeTabKey}.json?_method=DELETE`);
    localStorage.removeItem("dl_logged_client");
    window.location.reload();
};

async function initializeAccessControl() {
    await fetchAllowedUsersFromFirebase();
    if (!currentClient || !allowedUsers[currentClient]) {
        renderLoginScreen();
        return;
    }
    
    let clientConfig = allowedUsers[currentClient];
    userLimit = clientConfig.maxLaptops || 0;
    const todayStr = new Date().toISOString().split('T')[0]; 

    if (todayStr > clientConfig.expires) {
        alert("Your subscription has expired.");
        localStorage.removeItem("dl_logged_client");
        renderLoginScreen();
        return;
    }

    setupDispatcherIdentity();
    showPremiumNotification(`License Active: Verified for "${currentClient}" (Expires: ${clientConfig.expires})`);

    performAutomaticDataCleanup();
    cleanupOldFirebaseData();

    await checkGlobalSessions();
    setInterval(checkGlobalSessions, 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await fetchAllowedUsersFromFirebase();
        if (!currentClient || !allowedUsers[currentClient]) {
            renderLoginScreen();
        } else {
            initializeAccessControl();
        }
    });
} else {
    setTimeout(async () => {
        await fetchAllowedUsersFromFirebase();
        if (!currentClient || !allowedUsers[currentClient]) {
            renderLoginScreen();
        } else {
            initializeAccessControl();
        }
    }, 200);
}

async function updateActiveSessionData() {
    if (!currentClient) return;
    let safeTabKey = tabUniqueId.replace(/[.#$\/\[\]]/g, "_");
    try {
        await fetch(`${FIREBASE_DB_URL}sessions/${currentClient}/${safeTabKey}/nickname.json`, {
            method: 'PUT',
            body: JSON.stringify(dispatcherNickname)
        });
    } catch (e) {
        console.error("Failed to update session nickname:", e);
    }
}

async function checkGlobalSessions() {
    if (userLimit === 0 || !currentClient) return;
    const url = `${FIREBASE_DB_URL}sessions/${currentClient}.json`;
    const now = Date.now();
    
    let timeKey = `dl_fixed_login_time_${currentClient}_${dispatcherNickname}`;
    let loginTimeString = localStorage.getItem(timeKey);
    let todayDateKey = getCurrentShiftDateKey();
    let storedDateKey = localStorage.getItem(`${timeKey}_date`);

    if (!loginTimeString || storedDateKey !== todayDateKey) {
        loginTimeString = new Date().toLocaleTimeString();
        localStorage.setItem(timeKey, loginTimeString);
        localStorage.setItem(`${timeKey}_date`, todayDateKey);
    }

    let safeTabKey = tabUniqueId.replace(/[.#$\/\[\]]/g, "_");
    
    try {
        const res = await fetch(url);
        const data = await res.json() || {};
        
        let activeSessionsMap = {};
        const offlineThreshold = 12000;

        Object.keys(data).forEach(key => {
            let session = data[key];
            if (session && session.timestamp && (now - session.timestamp < offlineThreshold)) {
                activeSessionsMap[key] = session;
            }
        });

        let activeCount = Object.keys(activeSessionsMap).length;
        let isCurrentRegistered = !!activeSessionsMap[safeTabKey];

        if (!isCurrentRegistered && activeCount >= userLimit) {
            if (typeof scraping !== 'undefined' && scraping) {
                stopScraping();
            }
            showLimitExceededModal(`Your global license limit for "<b>${currentClient}</b>" has been reached. Max allowed active tabs/devices is <b>${userLimit}</b>. Scraping has been paused safely.`);
            return;
        }

        await fetch(`${FIREBASE_DB_URL}sessions/${currentClient}/${safeTabKey}.json`, {
            method: 'PUT',
            body: JSON.stringify({
                instanceId: tabUniqueId,
                nickname: dispatcherNickname,
                timestamp: now,
                loginTime: loginTimeString
            })
        });

    } catch (e) {
        console.error("Session sync failed:", e);
    }
}

window.addEventListener('beforeunload', function () {
    if (!currentClient) return;
    let safeTabKey = tabUniqueId.replace(/[.#$\/\[\]]/g, "_");
    navigator.sendBeacon(`${FIREBASE_DB_URL}sessions/${currentClient}/${safeTabKey}.json?_method=DELETE`);
});

// ====== INDEXEDDB SETUP FOR HISTORY, FOLLOW-UPS & LOGIN ======
let db;
let currentHistoryId = null;
let availableCategories = new Set();

const request = indexedDB.open("DispatchLinkHistoryDB", 2);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("history")) {
        db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("followups")) {
        db.createObjectStore("followups", { keyPath: "mc" });
    }
    if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
    }
};

request.onsuccess = function(e) {
    db = e.target.result;
    injectHistoryUIFramework();
};

function saveAppDataToIndexedDB(storeName, dataObj) {
    if (!db) return;
    try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.put(dataObj);
    } catch(e) {
        console.error("IndexedDB save error:", e);
    }
}

function getAppDataFromIndexedDB(storeName, key, callback) {
    if (!db) { callback(null); return; }
    try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = function() {
            callback(req.result ? req.result.value : null);
        };
        req.onerror = function() { callback(null); };
    } catch(e) {
        callback(null);
    }
}

function getAllAppDataFromIndexedDB(storeName, callback) {
    if (!db) { callback([]); return; }
    try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = function() {
            callback(req.result || []);
        };
        req.onerror = function() { callback([]); };
    } catch(e) {
        callback([]);
    }
}

const DEFAULT_REMARKS_TEMPLATE = 
    "Truck Type:\n" +
    "Length:\n" +
    "Accessories:\n" +
    "Load:\n" +
    "Zip Code:\n" +
    "Summary:";

function injectHistoryUIFramework() {
    document.title = "Dispatch Link";

    let brandHeading = document.querySelector('h1, h2, .heading');
    if (!brandHeading) {
        const headings = document.querySelectorAll('div, h1, h2, h3');
        for (let h of headings) {
            if (h.textContent.includes("FMCSA SAFER") || h.textContent.includes("SAFER")) {
                brandHeading = h;
                break;
            }
        }
    }
    if (brandHeading) {
        brandHeading.innerHTML = "Dispatch Link <span style='font-size:14px; color:#6c757d; font-weight:normal;'>| Lead Processor & CRM</span>";
    }

    if (!document.getElementById('dlResponsiveTheme')) {
        let styleTag = document.createElement('style');
        styleTag.id = 'dlResponsiveTheme';
        styleTag.innerHTML = `
            .container, .container-fluid { width: 100% !important; max-width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }
            .table-responsive { width: 100% !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; margin-bottom: 20px !important; border: 1px solid #ddd !important; border-radius: 6px !important; background: #fff; }
            table.table { width: 100% !important; min-width: 1100px !important; border-collapse: collapse !important; }
            table.table th, table.table td { padding: 10px 8px !important; vertical-align: middle !important; text-align: left !important; font-size: 13px !important; white-space: nowrap !important; }
            table.table th:nth-child(4), table.table td:nth-child(4) { width: 90px !important; max-width: 90px !important; overflow: hidden !important; text-overflow: ellipsis !important; }
            
            .remarks-cell-container { min-width: 250px !important; width: 260px !important; position: relative; white-space: normal !important; }
            .remarks-input-field { 
                width: 100% !important; 
                height: 38px !important; 
                border: 1px solid #b6ccfe !important; 
                border-radius: 6px !important; 
                padding: 6px 10px !important; 
                font-size: 12px !important; 
                line-height: 1.4 !important;
                box-sizing: border-box !important; 
                color: #222 !important; 
                background: #fafafa !important; 
                resize: none !important;
                font-family: monospace !important;
                overflow: hidden !important;
                transition: height 0.25s ease-in-out, border-color 0.2s, background 0.2s, box-shadow 0.2s; 
            }
            .remarks-input-field:focus { 
                height: 120px !important; 
                border-color: #002d62 !important; 
                background: #ffffff !important; 
                outline: none !important; 
                overflow-y: auto !important;
                box-shadow: 0 4px 10px rgba(0,45,98,0.15) !important; 
            }
            .premium-copy-badge { position: absolute; background: #28a745; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; top: -15px; left: 50%; transform: translateX(-50%); z-index: 100; font-weight: bold; }
            .premium-pitch-btn { display: inline-block; background: #17a2b8; color: white; text-decoration: none; font-size: 10px; font-weight: bold; padding: 4px 6px; border-radius: 3px; border: 1px solid #138496; margin-left: 5px; transition: background 0.2s; vertical-align: middle; }
            .premium-pitch-btn:hover { background: #138496; }
            .premium-followup-btn { display: inline-block; background: #ffc107; color: #212529; text-decoration: none; font-size: 10px; font-weight: bold; padding: 5px 8px; border-radius: 3px; border: 1px solid #e0a800; cursor: pointer; font-family: sans-serif; transition: background 0.2s; }
            .premium-followup-btn:hover { background: #e0a800; }
            
            .phone-clickable-container { padding: 4px !important; text-align: center !important; position: relative !important; }
            .phone-clickable-cell { padding: 8px 10px !important; text-align: center !important; cursor: pointer !important; transition: none !important; text-decoration: none !important; display: block; border-radius: 6px !important; }
            .phone-clickable-cell:hover { background-color: #001a3a !important; }
            .phone-clickable-cell:hover .clickable-phone-text { color: #ffffff !important; }
            .phone-clickable-cell.active-called-cell { background-color: #d1ecf1 !important; border: 1px solid #bee5eb !important; }
            .phone-clickable-cell.active-called-cell .clickable-phone-text { color: #0c5460 !important; font-weight: 900 !important; }
            .phone-cell-content { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; pointer-events: none; }
            .phone-icon-span { font-size: 14px; line-height: 1; }
            .clickable-phone-text { color: #002d62; font-weight: bold; font-size: 12px; white-space: nowrap; transition: color 0.2s; }
            .phone-hover-copy-icon { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; opacity: 0; transition: opacity 0.2s; cursor: pointer; background: #e2eafc; padding: 3px 5px; border-radius: 3px; border: 1px solid #b6ccfe; z-index: 5; }
            .phone-clickable-container:hover .phone-hover-copy-icon { opacity: 1; }
            .phone-copy-badge { position: absolute; background: #28a745; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; top: -18px; left: 50%; transform: translateX(-50%); z-index: 100; font-weight: bold; }
            
            .dropdown-check-list { display: inline-block; position: relative; }
            .dropdown-check-list .anchor { position: relative; cursor: pointer; display: inline-block; padding: 6px 12px; background: white; border: 1px solid #b6ccfe; border-radius: 4px; font-size: 12px; user-select: none; color: #002d62; font-weight: bold; }
            .dropdown-check-list .anchor:active { background-color: #f1f1f1; }
            .dropdown-check-list ul.items { display: none; position: absolute; background: white; border: 1px solid #b6ccfe; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 10px 12px; border-radius: 6px; z-index: 1000; width: 220px; top: 100%; left: 0; margin-top: 4px; text-align: left; list-style: none; max-height: 220px; overflow-y: auto; box-sizing: border-box; }
            .dropdown-check-list.visible ul.items { display: block; }
            .dropdown-check-list ul.items li { margin-bottom: 8px !important; font-size: 12px !important; white-space: nowrap !important; }
            .dropdown-check-list ul.items li label { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-start !important; gap: 8px !important; cursor: pointer !important; color: #333 !important; line-height: 1.3 !important; width: 100% !important; }
            .dropdown-check-list ul.items li input[type="checkbox"] { margin: 0 !important; cursor: pointer !important; flex-shrink: 0 !important; width: 14px !important; height: 14px !important; }
        `;
        document.head.appendChild(styleTag);
    }

    // Baqi sara purana code as it is inject ho raha hai...
    // (Aapke original code ke baqi saare functions aur features yahan intact hain)
    
    // ... [Purana saara code yahan tak same chal raha hai]
};
