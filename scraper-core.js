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

// Check shift change and clear local temp data automatically
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

// ====== FIREBASE 7-DAYS CLEANUP (ALLOWED USERS SAFE) ======
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
            
            // Sirf pichle 7 din ke andarkay logs ko filter kar ke rakhein
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

// ====== PROFESSIONAL LOGIN SCREEN WITH SHOW/HIDE PASSWORD ======
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

// ====== PROFESSIONAL RIGHT-ALIGNED FLOATING UI & ROUNDED NAME BADGE ======
function injectNicknameProfileUI() {
    if (document.getElementById('dlNickProfilePanel')) return;
    let heading = document.querySelector('h1, h2, .heading') || document.body;
    let panel = document.createElement('div');
    panel.id = 'dlNickProfilePanel';
    panel.style.cssText = "display: flex; justify-content: flex-end; align-items: center; width: 100%; margin: 15px 0; padding: 4px 10px; font-family: sans-serif; box-sizing: border-box; position: relative;";
    
    panel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
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
    
    // Firebase 7-days cleanup (allowedUsers safe rahega, IndexedDB untouched)
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

    if (!document.getElementById('dlFloatingNavPanel')) {
        let navPanel = document.createElement('div');
        navPanel.id = 'dlFloatingNavPanel';
        navPanel.style.cssText = "position: fixed; bottom: 30px; right: 30px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; transition: opacity 0.3s ease-in-out;";
        navPanel.innerHTML = `
            <button id="dlScrollUpBtn" onclick="scrollToTopScreen()" title="Scroll to Top" style="background: #002d62; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; box-shadow: 0 6px 16px rgba(0,45,98,0.35); cursor: pointer; font-size: 18px; font-weight: bold; display: none; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">⬆️</button>
            <button id="dlScrollDownBtn" onclick="scrollToLastCalledLead()" title="Scroll to Last Called Lead" style="background: #17a2b8; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; box-shadow: 0 6px 16px rgba(23,162,184,0.35); cursor: pointer; font-size: 18px; font-weight: bold; display: none; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">⬇️</button>
        `;
        document.body.appendChild(navPanel);

        window.addEventListener('scroll', function() {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            let upBtn = document.getElementById('dlScrollUpBtn');
            let downBtn = document.getElementById('dlScrollDownBtn');
            let hasActiveCalledCell = document.querySelector('.phone-clickable-cell.active-called-cell') !== null;

            if (upBtn) {
                upBtn.style.display = scrollTop > 250 ? 'flex' : 'none';
            }
            if (downBtn) {
                downBtn.style.display = (scrollTop < 300 && hasActiveCalledCell) ? 'flex' : 'none';
            }
        });
    }

    let coreTable = document.querySelector('table');
    if (coreTable && !coreTable.parentNode.classList.contains('table-responsive')) {
        let wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'table-responsive';
        coreTable.parentNode.insertBefore(wrapperDiv, coreTable);
        wrapperDiv.appendChild(coreTable);
    }

    let mainHeading = document.querySelector('h1, h2, .heading');
    if (!mainHeading) {
        const headings = document.querySelectorAll('div, h1, h2, h3');
        for (let h of headings) {
            if (h.textContent.includes("FMCSA SAFER") || h.textContent.includes("SAFER")) {
                mainHeading = h;
                break;
            }
        }
    }

    if (mainHeading && !document.getElementById('devCreditTag')) {
        mainHeading.style.position = 'relative';
        let creditTag = document.createElement('span');
        creditTag.id = 'devCreditTag';
        creditTag.innerHTML = "Developed by <b>Mr. Nauman (Ph: 03700684849)</b>";
        creditTag.style.cssText = "position: absolute; right: 0; bottom: 5px; font-size: 11px; color: #6c757d; font-family: sans-serif; font-weight: normal;";
        mainHeading.appendChild(creditTag);
    }

    let startBtn = document.getElementById('startBtn');
    if (startBtn && !document.getElementById('openHistoryBtn')) {
        let historyBtn = document.createElement('button');
        historyBtn.id = 'openHistoryBtn';
        historyBtn.innerHTML = "📜 View History";
        historyBtn.style.cssText = "background: #002d62; color: white; border: 1px solid #001a3a; padding: 8px 16px; font-size: 14px; font-weight: bold; font-family: sans-serif; border-radius: 4px; cursor: pointer; margin-left: 10px; display: inline-block; vertical-align: middle;";
        historyBtn.onclick = (e) => { e.stopPropagation(); toggleHistoryDrawer(); };
        startBtn.parentNode.insertBefore(historyBtn, startBtn.nextSibling);

        let followUpBtn = document.createElement('button');
        followUpBtn.id = 'openFollowUpDrawerBtn';
        followUpBtn.innerHTML = "📅 View Follow-Ups";
        followUpBtn.style.cssText = "background: #17a2b8; color: white; border: 1px solid #138496; padding: 8px 16px; font-size: 14px; font-weight: bold; font-family: sans-serif; border-radius: 4px; cursor: pointer; margin-left: 8px; display: inline-block; vertical-align: middle;";
        followUpBtn.onclick = (e) => { e.stopPropagation(); toggleFollowUpDrawer(); };
        startBtn.parentNode.insertBefore(followUpBtn, historyBtn.nextSibling);
    }

    if (!document.getElementById('dlHistoryDrawer')) {
        let drawer = document.createElement('div');
        drawer.id = 'dlHistoryDrawer';
        drawer.style.cssText = "position: fixed; top: 0; right: -420px; width: 400px; height: 100%; background: #ffffff; box-shadow: -5px 0 15px rgba(0,0,0,0.15); z-index: 999999; transition: right 0.3s ease-in-out; padding: 20px; box-sizing: border-box; font-family: sans-serif; display: flex; flex-direction: column;";
        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #002d62; padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="color: #002d62; margin: 0; font-size: 18px;">Saved Sheets History</h3>
                <button onclick="toggleHistoryDrawer()" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #6c757d; font-weight: bold;">&times;</button>
            </div>
            <div id="drawerHistoryList" style="flex: 1; overflow-y: auto; padding-right: 5px;"></div>
        `;
        document.body.appendChild(drawer);
    }

    if (!document.getElementById('dlFollowUpDrawer')) {
        let fDrawer = document.createElement('div');
        fDrawer.id = 'dlFollowUpDrawer';
        fDrawer.style.cssText = "position: fixed; top: 0; right: -420px; width: 400px; height: 100%; background: #ffffff; box-shadow: -5px 0 15px rgba(0,0,0,0.15); z-index: 999999; transition: right 0.3s ease-in-out; padding: 20px; box-sizing: border-box; font-family: sans-serif; display: flex; flex-direction: column;";
        fDrawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #17a2b8; padding-bottom: 10px; margin-bottom: 10px;">
                <h3 style="color: #17a2b8; margin: 0; font-size: 18px;">📅 Follow-Up Pipeline</h3>
                <button onclick="toggleFollowUpDrawer()" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #6c757d; font-weight: bold;">&times;</button>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                <button onclick="filterFollowUpsByDate('today')" id="fubtnToday" style="flex: 1; background: #17a2b8; color: white; border: none; padding: 6px; font-size: 11px; font-weight: bold; border-radius: 4px; cursor: pointer;">📅 Today</button>
                <button onclick="filterFollowUpsByDate('all')" id="fubtnAll" style="flex: 1; background: #e2eafc; color: #002d62; border: 1px solid #b6ccfe; padding: 6px; font-size: 11px; font-weight: bold; border-radius: 4px; cursor: pointer;">📋 All</button>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; align-items: center;">
                <input type="text" id="followUpSearchInput" placeholder="🔍 Search MC, Name, Phone..." style="flex: 1; padding: 8px 10px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px; box-sizing: border-box;" oninput="renderFollowUpItems()">
                <button onclick="clearFollowUpFilters()" style="background: #e2eafc; border: 1px solid #b6ccfe; color: #002d62; padding: 7px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; cursor: pointer;" title="Clear Filters">🔄</button>
            </div>
            <div style="margin-bottom: 12px;">
                <button onclick="downloadFollowUpsCSV()" style="background: #28a745; color: white; border: none; padding: 6px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; width: 100%;">📥 Download Follow-Ups Sheet</button>
            </div>
            <div id="drawerFollowUpList" style="flex: 1; overflow-y: auto; padding-right: 5px;"></div>
        `;
        document.body.appendChild(fDrawer);
    }

    if (!document.getElementById('dlDatePickerModal')) {
        let modal = document.createElement('div');
        modal.id = 'dlDatePickerModal';
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000000; display: none; align-items: center; justify-content: center; font-family: sans-serif;";
        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 8px; width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="color: #002d62; margin-top: 0; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #002d62; padding-bottom: 8px;">⏰ Schedule Follow-Up</h3>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; font-weight: bold; color: #333; margin-bottom: 4px;">Select Date:</label>
                    <input type="date" id="dlModalDateInput" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 4px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="display: block; font-size: 12px; font-weight: bold; color: #333; margin-bottom: 4px;">Select Time:</label>
                    <input type="time" id="dlModalTimeInput" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 4px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="closeFollowUpModal()" style="background: #6c757d; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button onclick="confirmFollowUpSchedule()" style="background: #28a745; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer;">Confirm Schedule</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    if (!document.getElementById('dlTeamSelectModal')) {
        let tModal = document.createElement('div');
        tModal.id = 'dlTeamSelectModal';
        tModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000000; display: none; align-items: center; justify-content: center; font-family: sans-serif;";
        tModal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 8px; width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="color: #002d62; margin-top: 0; margin-bottom: 10px; font-size: 16px; border-bottom: 2px solid #002d62; padding-bottom: 8px;">👥 Share with Team Member</h3>
                <p style="font-size: 12px; color: #6c757d; margin-bottom: 12px;">Select team member (Online or Offline will receive inbox message):</p>
                <div id="dlTeamMembersRadioList" style="max-height: 180px; overflow-y: auto; margin-bottom: 15px; border: 1px solid #eee; padding: 8px; border-radius: 4px;"></div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="closeTeamSelectModal()" style="background: #6c757d; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button onclick="confirmTeamShareAction()" style="background: #002d62; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer;">Share Now</button>
                </div>
            </div>
        `;
        document.body.appendChild(tModal);
    }

    if (!document.getElementById('dlDispositionModal')) {
        let dModal = document.createElement('div');
        dModal.id = 'dlDispositionModal';
        dModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.65); z-index: 100000000; display: none; align-items: center; justify-content: center; font-family: sans-serif;";
        dModal.innerHTML = `
            <div style="background: #ffffff; width: 380px; border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); overflow: hidden; padding: 20px; box-sizing: border-box; position: relative;">
                <button onclick="document.getElementById('dlDispositionModal').style.display='none'" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 22px; color: #6c757d; cursor: pointer; font-weight: bold; line-height: 1;" title="Close">&times;</button>
                <h3 style="color: #002d62; margin-top: 0; margin-bottom: 5px; font-size: 18px; text-align: center; padding-right: 15px;">What is the Status of this call?</h3>
                <p style="font-size: 12px; color: #6c757d; text-align: center; margin-bottom: 15px;">Select call status for <b id="dispTargetPhoneNum" style="color: #002d62;"></b></p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div onclick="submitCallDisposition('Hung up')" style="background: #ff5252; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(255,82,82,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>📞</span><span>Hung up</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                    <div onclick="submitCallDisposition('Voicemail')" style="background: #9c27b0; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(156,39,176,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>📭</span><span>Voicemail</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                    <div onclick="submitCallDisposition('Not interested')" style="background: #ff9800; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(255,152,0,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>👎</span><span>Not interested</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                    <div onclick="submitCallDisposition('Do not Call')" style="background: #2196f3; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(33,150,243,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>🚫</span><span>Do not Call</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                    <div onclick="submitCallDisposition('Follow up')" style="background: #4caf50; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(76,175,80,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>📅</span><span>Follow up</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                    <div onclick="submitCallDisposition('Sale Closed')" style="background: #009688; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 3px 10px rgba(0,150,136,0.3);">
                        <div style="display: flex; align-items: center; gap: 10px;"><span>🤝</span><span>Sale Closed</span></div>
                        <div style="width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dModal);
    }

    injectAdvancedFilterBar();

    let tableHeader = document.querySelector('table tr');
    if (tableHeader && !document.getElementById('remarksHeaderCol')) {
        let vehTh = document.createElement('th');
        vehTh.id = 'vehicleTypeHeaderCol';
        vehTh.innerText = "Vehicles";
        
        let remTh = document.createElement('th');
        remTh.id = 'remarksHeaderCol';
        remTh.className = 'remarks-cell-container';
        remTh.innerText = "Remarks";

        let followTh = document.createElement('th');
        followTh.id = 'followUpHeaderCol';
        followTh.innerText = "Action";

        let powerUnitsTh = tableHeader.children[8];
        if (powerUnitsTh && powerUnitsTh.nextSibling) {
            tableHeader.insertBefore(vehTh, powerUnitsTh.nextSibling);
        } else {
            tableHeader.appendChild(vehTh);
        }
        tableHeader.appendChild(remTh);
        tableHeader.appendChild(followTh);
    }

    injectEmailProposalPanel();
}

window.scrollToTopScreen = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    let startInput = document.getElementById('startMc');
    if (startInput) startInput.focus();
};

window.scrollToLastCalledLead = function() {
    let activeCalledCell = document.querySelector('.phone-clickable-cell.active-called-cell');
    if (activeCalledCell) {
        activeCalledCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showPremiumNotification("Jumped to last called lead!", 2000);
    } else {
        showPremiumNotification("No call logged yet in this session.", 2500);
    }
};

function toggleCategoryDropdown(e) {
    e.stopPropagation();
    let list = document.getElementById('categoryDropdownCheckList');
    if (list) {
        if (list.classList.contains('visible')) {
            list.classList.remove('visible');
        } else {
            list.classList.add('visible');
        }
    }
}

window.addEventListener('click', function(event) {
    if (!event.target.closest('#categoryDropdownCheckList')) {
        let list = document.getElementById('categoryDropdownCheckList');
        if (list && list.classList.contains('visible')) {
            list.classList.remove('visible');
        }
    }
});

function updateCategoryCheckboxes() {
    let container = document.getElementById('checkboxListContainer');
    if (!container) return;
    let currentChecked = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(cb => cb.value);
    
    let html = "";
    Array.from(availableCategories).sort().forEach(cat => {
        let isChecked = currentChecked.includes(cat) ? "checked" : "";
        html += `
            <li>
                <label>
                    <input type="checkbox" class="cat-checkbox" value="${cat}" ${isChecked} onchange="applyAdvancedFilters()"> 
                    <span>${cat}</span>
                </label>
            </li>
        `;
    });
    container.innerHTML = html;
}

function injectAdvancedFilterBar() {
    let table = document.querySelector('table');
    if (!table || document.getElementById('advancedFilterWrapper')) return;
    let wrapperDiv = table.closest('.table-responsive') || table.parentNode;

    let filterDiv = document.createElement('div');
    filterDiv.id = 'advancedFilterWrapper';
    filterDiv.style.cssText = "background: #f4f7fe; padding: 12px 15px; margin: 12px 0; border: 1px solid #b6ccfe; border-radius: 6px; font-family: sans-serif; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between; width: 100%; box-sizing: border-box;";
    filterDiv.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 13px; font-weight: bold; color: #002d62;">State:</span>
                <select id="stateDropdownSelect" style="padding: 6px 10px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px; background: white; color: #002d62; font-weight: bold; font-family: monospace;" onchange="applyAdvancedFilters()">
                    <option value="">All States</option>
                </select>
            </div>
            
            <div id="categoryDropdownCheckList" class="dropdown-check-list" tabindex="100">
                <span class="anchor" onclick="toggleCategoryDropdown(event)">Select Categories ▼</span>
                <ul id="checkboxListContainer" class="items"></ul>
            </div>

            <div style="position: relative; display: inline-block;">
                <button type="button" onclick="toggleVehicleDropdown(event)" style="background: white; border: 1px solid #b6ccfe; padding: 6px 12px; font-size: 12px; border-radius: 4px; color: #002d62; font-weight: bold; cursor: pointer;">Select Vehicle Types ▼</button>
                <div id="vehicleTypeDropdownContent" style="display: none; position: absolute; background: white; border: 1px solid #b6ccfe; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 10px 12px; border-radius: 6px; z-index: 1000; width: 170px; top: 100%; left: 0; margin-top: 4px; text-align: left; box-sizing: border-box;">
                    <div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; text-align: left;">Filter by Vehicle:</div>
                    <div id="vehicleCheckboxList"></div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 220px;">
                <span style="font-size: 13px; font-weight: bold; color: #002d62;">Search:</span>
                <input type="text" id="universalSearchInput" placeholder="Search by MC, Company Name, or Phone..." style="width: 100%; padding: 6px 10px; font-size: 12px; border: 1px solid #b6ccfe; border-radius: 4px;" oninput="applyAdvancedFilters()">
            </div>
            <button onclick="resetAdvancedFilters()" style="background: #002d62; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer;">Reset</button>
        </div>
        <div style="background: #002d62; color: white; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap;">
            Showing: <span id="visibleRecordCountBadge">0</span> Records
        </div>
    `;
    wrapperDiv.parentNode.insertBefore(filterDiv, wrapperDiv);
    populateStateDropdown();
    populateVehicleTypeCheckboxes();

    document.addEventListener('click', function(e) {
        let dropdown = document.getElementById('vehicleTypeDropdownContent');
        let btn = document.querySelector('button[onclick*="toggleVehicleDropdown"]');
        if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && btn && !btn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

window.toggleVehicleDropdown = function(e) {
    e.stopPropagation();
    let dropdown = document.getElementById('vehicleTypeDropdownContent');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
};

function populateStateDropdown() {
    let select = document.getElementById('stateDropdownSelect');
    if (!select) return;
    
    let stateCounts = {};
    if (typeof scrapedData !== 'undefined' && scrapedData.length > 0) {
        scrapedData.forEach(r => {
            let addr = (r.address || "").toUpperCase();
            for (let code in usStatesMap) {
                let stateRegex = new RegExp(`\\b${code}\\b(?=\\s+\\d{5}(-\\d{4})?)`);
                if (stateRegex.test(addr)) {
                    stateCounts[code] = (stateCounts[code] || 0) + 1;
                    break;
                }
            }
        });
    }

    let currentVal = select.value;
    select.innerHTML = '<option value="">All States</option>';
    
    let sortedCodes = Object.keys(stateCounts).sort((a, b) => {
        let nameA = usStatesMap[a] || a;
        let nameB = usStatesMap[b] || b;
        return nameA.localeCompare(nameB);
    });

    let maxLabelLength = 0;
    sortedCodes.forEach(code => {
        let fullName = usStatesMap[code] || code;
        let label = `${fullName} (${code})`;
        if (label.length > maxLabelLength) maxLabelLength = label.length;
    });

    sortedCodes.forEach(code => {
        let fullName = usStatesMap[code] || code;
        let count = stateCounts[code];
        let label = `${fullName} (${code})`;
        let paddingLength = Math.max(2, maxLabelLength - label.length + 4);
        let spaces = "\u00A0".repeat(paddingLength);
        
        let opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${label}${spaces}${count}`;
        select.appendChild(opt);
    });
    select.value = currentVal;
    updateVisibleRecordCount();
}

function populateVehicleTypeCheckboxes() {
    let container = document.getElementById('vehicleCheckboxList');
    if (!container) return;

    let fixedTypes = ["Straight Trucks", "Truck Tractors", "Trailers"];
    let checkedSet = new Set();
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedSet.add(cb.value));

    let html = "";
    fixedTypes.forEach(vType => {
        let isChecked = checkedSet.has(vType) ? "checked" : "";
        html += `
            <label style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-start !important; gap: 8px !important; font-size: 12px !important; margin-bottom: 8px !important; cursor: pointer !important; color: #333 !important; text-align: left !important; width: 100% !important; float: none !important;">
                <input type="checkbox" value="${vType}" ${isChecked} onchange="applyAdvancedFilters()" style="cursor: pointer !important; margin: 0 !important; flex-shrink: 0 !important; float: none !important; display: inline-block !important; width: 14px !important; height: 14px !important;"> 
                <span style="text-align: left !important; flex: 1 !important; white-space: nowrap !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: #333 !important; font-size: 12px !important;">${vType}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

window.applyAdvancedFilters = function() {
    let selectedState = (document.getElementById('stateDropdownSelect')?.value || "").toUpperCase().trim();
    let searchQuery = (document.getElementById('universalSearchInput')?.value || "").toLowerCase().trim();
    let selectedCategories = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(cb => cb.value);
    
    let selectedVehicles = [];
    document.querySelectorAll('#vehicleCheckboxList input[type="checkbox"]:checked').forEach(cb => {
        selectedVehicles.push(cb.value.toLowerCase());
    });

    let rows = document.querySelectorAll('#resultsTable tr');

    rows.forEach((row, index) => {
        let record = scrapedData[index];
        if (!record) return;

        let mcText = (row.cells[0]?.textContent || "").toLowerCase();
        let nameText = (row.cells[2]?.textContent || "").toLowerCase();
        let phoneText = (row.cells[5]?.textContent || "").toLowerCase();
        let addressText = (row.cells[6]?.textContent || "").toUpperCase();
        let vehicleText = (row.cells[9]?.textContent || "").toLowerCase();
        let carrierDetailsText = record.carrierDetails || "";

        let matchesState = true;
        if (selectedState !== "") {
            let stateRegex = new RegExp(`\\b${selectedState}\\b(?=\\s+\\d{5}(-\\d{4})?)`);
            matchesState = stateRegex.test(addressText);
        }

        let matchesSearch = true;
        if (searchQuery !== "") {
            matchesSearch = mcText.includes(searchQuery) || nameText.includes(searchQuery) || phoneText.includes(searchQuery);
        }

        let matchesVehicle = true;
        if (selectedVehicles.length > 0) {
            matchesVehicle = selectedVehicles.some(sel => vehicleText.includes(sel));
        }

        let matchesCategory = true;
        if (selectedCategories.length > 0) {
            matchesCategory = selectedCategories.every(selectedCat => carrierDetailsText.includes(selectedCat));
        }

        row.style.display = (matchesState && matchesSearch && matchesVehicle && matchesCategory) ? "" : "none";
    });
    updateVisibleRecordCount();
};

window.resetAdvancedFilters = function() {
    let stSel = document.getElementById('stateDropdownSelect');
    let srchInput = document.getElementById('universalSearchInput');
    if (stSel) stSel.value = "";
    if (srchInput) srchInput.value = "";
    document.querySelectorAll('#vehicleCheckboxList input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.cat-checkbox').forEach(cb => cb.checked = false);
    applyAdvancedFilters();
};

function updateVisibleRecordCount() {
    let rows = document.querySelectorAll('#resultsTable tr');
    let visibleCount = 0;
    if (rows.length > 0) {
        rows.forEach(r => {
            if (r.style.display !== 'none') visibleCount++;
        });
    }
    let badge = document.getElementById('visibleRecordCountBadge');
    if (badge) badge.innerText = visibleCount;
}

function injectEmailProposalPanel() {
    let table = document.querySelector('table');
    if (!table || document.getElementById('premiumProposalWrapper')) return;
    let wrapperDiv = table.closest('.table-responsive') || table.parentNode;

    let savedSubject = localStorage.getItem(`dl_subj_${currentClient}`) || "Dispatch Service Proposal";
    let savedBody = localStorage.getItem(`dl_body_${currentClient}`) || "Hello,\n\nWe found your profile via FMCSA. We offer dispatching services at 5% rate.\n\nBest Regards.";

    let proposalPanel = document.createElement('div');
    proposalPanel.id = 'premiumProposalWrapper';
    proposalPanel.style.cssText = "background: #f4f7fe; padding: 15px; margin: 15px 0; border: 1px solid #b6ccfe; border-radius: 6px; font-family: sans-serif; width: 100%; box-sizing: border-box;";
    proposalPanel.innerHTML = `
        <div onclick="document.getElementById('proposalInputsBlock').style.display = document.getElementById('proposalInputsBlock').style.display === 'none' ? 'block' : 'none';" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 13px; color: #002d62;">Setup Email Proposal Template</strong>
            <span style="font-size: 12px; font-weight: bold;">Click to Edit</span>
        </div>
        <div id="proposalInputsBlock" style="display: none; margin-top: 12px; border-top: 1px dashed #b6ccfe; padding-top: 12px;">
            <div style="margin-bottom: 10px;"><input type="text" id="propSubjectInput" value="${savedSubject}" style="width: 100%; padding: 8px; font-size: 13px;"></div>
            <div style="margin-bottom: 10px;"><textarea id="propBodyInput" style="width: 100%; height: 80px; font-size: 13px;">${savedBody}</textarea></div>
            <button onclick="saveProposalTemplateSettings()" style="background: #002d62; color: white; border: none; padding: 6px 15px; font-size: 12px; border-radius: 4px; cursor: pointer;">Save Template</button>
        </div>
    `;
    wrapperDiv.parentNode.insertBefore(proposalPanel, wrapperDiv);
}

window.saveProposalTemplateSettings = function() {
    localStorage.setItem(`dl_subj_${currentClient}`, document.getElementById('propSubjectInput').value);
    localStorage.setItem(`dl_body_${currentClient}`, document.getElementById('propBodyInput').value);
    alert("Template saved successfully.");
    document.getElementById('proposalInputsBlock').style.display = 'none';
};

window.triggerOneClickEmailPitch = function(emailAddress, companyName) {
    if (!emailAddress || emailAddress === 'N/A') return;
    let subj = localStorage.getItem(`dl_subj_${currentClient}`) || "Dispatch Proposal";
    let body = localStorage.getItem(`dl_body_${currentClient}`) || "Hello";
    let customizedBody = body.replace(/{company}/gi, companyName);

    let mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(customizedBody)}`;
    let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emailAddress}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(customizedBody)}`;

    let activeWindow = window.open(mailtoUrl, '_blank');
    setTimeout(() => {
        try {
            if (!activeWindow || activeWindow.location.href === 'about:blank' || activeWindow.document.body.innerHTML === '') {
                if (activeWindow) activeWindow.location.href = gmailUrl;
            }
        } catch (e) {}
    }, 500);
};

window.copyEmailToClipboard = function(element, emailAddress) {
    if (!emailAddress || emailAddress === 'N/A') return;
    navigator.clipboard.writeText(emailAddress).then(() => {
        let badge = document.createElement('span');
        badge.className = 'premium-copy-badge';
        badge.innerText = "Copied!";
        element.appendChild(badge);
        setTimeout(() => badge.remove(), 1200);
    });
};

function buildEmailCellMarkup(emailAddress, companyName) {
    if (!emailAddress || emailAddress === 'N/A') return `<td style="color: #6c757d;">N/A</td>`;
    let escapedName = companyName.replace(/'/g, "\\'");
    return `
        <td style="position: relative; vertical-align: middle;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span onclick="copyEmailToClipboard(this.parentNode, '${emailAddress}')" style="color: #002d62; font-weight: bold; cursor: pointer;">${emailAddress}</span>
                <a href="#" onclick="triggerOneClickEmailPitch('${emailAddress}', '${escapedName}'); return false;" class="premium-pitch-btn">Send</a>
            </div>
        </td>
    `;
}

let activeCallPhone = null;
let pendingReviewPhone = null;
let activeCallCellElement = null;

window.logCallCountWithDisposition = async function(phoneNum, cellElement, dispositionStatus) {
    if (!phoneNum || phoneNum === 'N/A') return;
    
    let storageKey = `dl_call_logs_${currentClient}_${dispatcherNickname}`;
    let callLogs = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    let logEntry = {
        phone: phoneNum,
        dispatcher: dispatcherNickname,
        shiftDate: getCurrentShiftDateKey(),
        date: new Date().toLocaleString(),
        status: dispositionStatus 
    };
    
    callLogs.push(logEntry);
    localStorage.setItem(storageKey, JSON.stringify(callLogs));

    try {
        let safeUserKey = dispatcherNickname.replace(/[.#$\/\[\]]/g, "_");
        await fetch(`${FIREBASE_DB_URL}call_logs/${currentClient}/${safeUserKey}.json`, {
            method: 'PUT',
            body: JSON.stringify(callLogs)
        });
    } catch (e) {
        console.error("Failed to sync call log to DB:", e);
    }

    showPremiumNotification(`Call Logged [${dispositionStatus}] for ${phoneNum}`, 2500);

    if (cellElement) {
        document.querySelectorAll('.phone-clickable-cell').forEach(el => el.classList.remove('active-called-cell'));
        cellElement.classList.add('active-called-cell');
    }

    let downBtn = document.getElementById('dlScrollDownBtn');
    if (downBtn) downBtn.style.display = 'none';
}

window.openDispositionModal = function(phoneNum) {
    pendingReviewPhone = phoneNum;
    let dispModal = document.getElementById('dlDispositionModal');
    let phoneSpan = document.getElementById('dispTargetPhoneNum');
    if (phoneSpan) phoneSpan.innerText = phoneNum;
    if (dispModal) dispModal.style.display = 'flex';
};

window.submitCallDisposition = function(statusType) {
    let dispModal = document.getElementById('dlDispositionModal');
    if (dispModal) dispModal.style.display = 'none';

    if (pendingReviewPhone) {
        logCallCountWithDisposition(pendingReviewPhone, activeCallCellElement, statusType);
        pendingReviewPhone = null;
        activeCallCellElement = null;
    }
};

window.openCallingDetailModal = function() {
    let existing = document.getElementById('dlCallingDetailModal');
    if (existing) existing.remove();

    let logs = JSON.parse(localStorage.getItem(`dl_call_logs_${currentClient}_${dispatcherNickname}`)) || [];
    let shiftDateStr = getCurrentShiftDateKey();
    let todayLogs = logs.filter(l => l.shiftDate === shiftDateStr);
    
    let totalCallsCount = todayLogs.length;

    let modal = document.createElement('div');
    modal.id = 'dlCallingDetailModal';
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000000; display: flex; align-items: center; justify-content: center; font-family: sans-serif;";
    
    modal.innerHTML = `
        <div style="background: white; width: 360px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden;">
            <div style="background: #002d62; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px;">Current Shift Details</h3>
                <button onclick="document.getElementById('dlCallingDetailModal').remove()" style="background: none; border: none; color: white; font-size: 22px; cursor: pointer; font-weight: bold;">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    <strong>Total Calls Logged:</strong> <span style="font-weight: bold; color: #002d62; font-size: 16px;">${totalCallsCount}</span>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 8px;">
                    <button onclick="document.getElementById('dlCallingDetailModal').remove()" style="background: #6c757d; color: white; border: none; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; width: 100%;">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.openAdminPanelPrompt = function() {
    window.open('admin.html', '_blank');
};

window.copyPhoneToClipboardDirect = function(event, containerElement, phoneNum) {
    event.stopPropagation();
    if (!phoneNum || phoneNum === 'N/A') return;
    
    activeCallPhone = phoneNum;
    activeCallCellElement = containerElement.closest('td').querySelector('.phone-clickable-cell');

    if (activeCallCellElement) {
        document.querySelectorAll('.phone-clickable-cell').forEach(el => el.classList.remove('active-called-cell'));
        activeCallCellElement.classList.add('active-called-cell');
    }

    navigator.clipboard.writeText(phoneNum).then(() => {
        let badge = document.createElement('span');
        badge.className = 'phone-copy-badge';
        badge.innerText = "Copied!";
        containerElement.appendChild(badge);
        setTimeout(() => badge.remove(), 1200);

        setTimeout(() => {
            openDispositionModal(phoneNum);
        }, 3000);
    });
};

window.handlePhoneInteraction = function(cellElement, phoneNum) {
    if (!phoneNum || phoneNum === 'N/A') return;

    activeCallPhone = phoneNum;
    activeCallCellElement = cellElement;

    document.querySelectorAll('.phone-clickable-cell').forEach(el => el.classList.remove('active-called-cell'));
    cellElement.classList.add('active-called-cell');

    window.location.href = `tel:${phoneNum}`;

    navigator.clipboard.writeText(phoneNum).then(() => {
        setTimeout(() => {
            openDispositionModal(phoneNum);
        }, 3000);
    });
};

function buildPhoneCellMarkup(phoneNum) {
    if (!phoneNum || phoneNum === 'N/A') return `<td style="color: #6c757d; text-align: center;">N/A</td>`;
    return `
        <td class="phone-clickable-container">
            <a href="tel:${phoneNum}" onclick="handlePhoneInteraction(this, '${phoneNum}'); return false;" class="phone-clickable-cell" title="Click to Call">
                <div class="phone-cell-content">
                    <span class="phone-icon-span">📞</span>
                    <span class="clickable-phone-text">${phoneNum}</span>
                </div>
            </a>
            <span class="phone-hover-copy-icon" onclick="copyPhoneToClipboardDirect(event, this, '${phoneNum}')" title="Copy Number">📋</span>
        </td>
    `;
}

let currentFollowUpFilterMode = 'today';
let pendingFollowUpIndex = null;
let pendingFollowUpRowBtn = null;

window.addLeadToFollowUpList = function(index, buttonElement) {
    let record = scrapedData[index];
    if (!record) return;

    getAllAppDataFromIndexedDB("followups", function(followUpStore) {
        if (followUpStore.some(r => r.mc === record.mc)) {
            return alert("This carrier is already added to your Follow-Up list.");
        }
        
        pendingFollowUpIndex = index;
        pendingFollowUpRowBtn = buttonElement;

        let todayDateStr = new Date().toISOString().split('T')[0];
        let nowTimeStr = new Date().toTimeString().substring(0, 5);

        let dateInput = document.getElementById('dlModalDateInput');
        let timeInput = document.getElementById('dlModalTimeInput');
        if (dateInput) dateInput.value = todayDateStr;
        if (timeInput) timeInput.value = nowTimeStr;

        let modal = document.getElementById('dlDatePickerModal');
        if (modal) modal.style.display = 'flex';
    });
};

window.closeFollowUpModal = function() {
    let modal = document.getElementById('dlDatePickerModal');
    if (modal) modal.style.display = 'none';
    pendingFollowUpIndex = null;
    pendingFollowUpRowBtn = null;
};

window.confirmFollowUpSchedule = function() {
    if (pendingFollowUpIndex === null) return;
    let record = scrapedData[pendingFollowUpIndex];
    if (!record) return;

    let selectedDate = document.getElementById('dlModalDateInput').value;
    let selectedTime = document.getElementById('dlModalTimeInput').value;

    if (!selectedDate) {
        alert("Please select a valid date.");
        return;
    }

    record.addedAt = new Date().toLocaleString();
    record.followUpDate = selectedDate;
    record.followUpTime = selectedTime ? formatTime12Hour(selectedTime) : "N/A";
    record.sharedBy = dispatcherNickname;

    saveAppDataToIndexedDB("followups", record);
    
    showPremiumNotification(`Added MC ${record.mc} for Follow-Up on ${record.followUpDate}`, 3500);
    
    if (pendingFollowUpRowBtn) {
        let row = pendingFollowUpRowBtn.closest('tr');
        if (row) row.style.background = "#d4edda";
    }

    closeFollowUpModal();
    if (document.getElementById('dlFollowUpDrawer').style.right === "0px") renderFollowUpItems();
};

function formatTime12Hour(time24) {
    let parts = time24.split(':');
    let hours = parseInt(parts[0]);
    let minutes = parts[1];
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}

window.toggleFollowUpDrawer = function() {
    let drawer = document.getElementById('dlFollowUpDrawer');
    let historyDrawer = document.getElementById('dlHistoryDrawer');
    if (!drawer) return;
    
    if(historyDrawer) historyDrawer.style.right = "-420px"; 
    
    if (drawer.style.right === "0px") {
        drawer.style.right = "-420px";
    } else {
        drawer.style.right = "0px";
        let searchInput = document.getElementById('followUpSearchInput');
        if(searchInput) searchInput.value = ""; 
        currentFollowUpFilterMode = 'today';
        updateFollowUpFilterButtonsUI();
        renderFollowUpItems(); 
    }
};

window.filterFollowUpsByDate = function(mode) {
    currentFollowUpFilterMode = mode;
    updateFollowUpFilterButtonsUI();
    renderFollowUpItems();
};

function updateFollowUpFilterButtonsUI() {
    let btnToday = document.getElementById('fubtnToday');
    let btnAll = document.getElementById('fubtnAll');
    if (!btnToday || !btnAll) return;

    if (currentFollowUpFilterMode === 'today') {
        btnToday.style.background = "#17a2b8";
        btnToday.style.color = "white";
        btnToday.style.border = "none";
        btnAll.style.background = "#e2eafc";
        btnAll.style.color = "#002d62";
        btnAll.style.border = "1px solid #b6ccfe";
    } else {
        btnAll.style.background = "#17a2b8";
        btnAll.style.color = "white";
        btnAll.style.border = "none";
        btnToday.style.background = "#e2eafc";
        btnToday.style.color = "#002d62";
        btnToday.style.border = "1px solid #b6ccfe";
    }
}

window.clearFollowUpFilters = function() {
    let searchInput = document.getElementById('followUpSearchInput');
    if(searchInput) searchInput.value = "";
    currentFollowUpFilterMode = 'all';
    updateFollowUpFilterButtonsUI();
    renderFollowUpItems();
};

window.deleteFollowUpItem = function(mcNumber) {
    if (confirm("Remove carrier from Follow-Ups?")) {
        const tx = db.transaction("followups", "readwrite");
        const store = tx.objectStore("followups");
        store.delete(mcNumber);
        tx.oncomplete = function() {
            renderFollowUpItems();
            let tableRows = document.querySelectorAll('#resultsTable tr');
            tableRows.forEach(row => {
                let cellMc = parseInt(row.cells[0]?.textContent);
                if (cellMc === mcNumber) row.style.background = "";
            });
        };
    }
};

window.downloadFollowUpsCSV = function() {
    getAllAppDataFromIndexedDB("followups", function(followUpStore) {
        if (followUpStore.length === 0) return alert("The follow-up list is currently empty.");
        triggerCSVDownload(followUpStore, `DispatchLink_FollowUps_${dispatcherNickname}.csv`);
    });
};

let pendingShareRecords = [];

window.openTeamShareModal = async function(recordsToShare) {
    if (!recordsToShare || recordsToShare.length === 0) return;
    pendingShareRecords = recordsToShare;

    let radioListDiv = document.getElementById('dlTeamMembersRadioList');
    if (!radioListDiv) return;
    radioListDiv.innerHTML = `<div style="text-align: center; color: #6c757d; font-size: 12px; padding: 15px;">Loading team members...</div>`;

    let tModal = document.getElementById('dlTeamSelectModal');
    if (tModal) tModal.style.display = 'flex';

    try {
        let [sessionsRes, reportsRes] = await Promise.all([
            fetch(`${FIREBASE_DB_URL}sessions/${currentClient}.json`),
            fetch(`${FIREBASE_DB_URL}shift_reports/${currentClient}.json`)
        ]);
        let sessionsData = await sessionsRes.json() || {};
        let reportsData = await reportsRes.json() || {};
        
        let allMembers = new Set();
        Object.keys(sessionsData).forEach(k => {
            if (sessionsData[k] && sessionsData[k].nickname) allMembers.add(sessionsData[k].nickname);
        });
        Object.keys(reportsData).forEach(name => allMembers.add(name));

        let membersList = Array.from(allMembers).filter(n => n !== dispatcherNickname);

        if (membersList.length === 0) {
            radioListDiv.innerHTML = `<div style="text-align: center; color: #dc3545; font-size: 12px; padding: 15px; font-weight: bold;">No other team members found.</div>`;
            return;
        }

        let now = Date.now();
        let offlineThreshold = 12000;

        let html = "";
        membersList.forEach((name, idx) => {
            let userSessionKey = Object.keys(sessionsData).find(k => sessionsData[k].nickname === name);
            let sObj = userSessionKey ? sessionsData[userSessionKey] : null;
            let isOnline = sObj && sObj.timestamp && (now - sObj.timestamp < offlineThreshold);
            let statusText = isOnline ? "Online" : "Offline";

            let checkedAttr = idx === 0 ? "checked" : "";
            html += `
                <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid #f1f3f4; cursor: pointer; font-size: 13px; color: #333;">
                    <input type="radio" name="teamMemberRadio" value="${name}" ${checkedAttr} style="cursor: pointer;">
                    <span><b>${name}</b> (${statusText})</span>
                </label>
            `;
        });
        radioListDiv.innerHTML = html;
    } catch (e) {
        console.error("Failed to fetch team members:", e);
        radioListDiv.innerHTML = `<div style="text-align: center; color: #dc3545; font-size: 12px; padding: 15px;">Error loading team members.</div>`;
    }
};

window.closeTeamSelectModal = function() {
    let tModal = document.getElementById('dlTeamSelectModal');
    if (tModal) tModal.style.display = 'none';
    pendingShareRecords = [];
};

window.confirmTeamShareAction = async function() {
    let selectedRadio = document.querySelector('input[name="teamMemberRadio"]:checked');
    if (!selectedRadio) {
        return alert("Please select a team member from the list.");
    }

    let targetName = selectedRadio.value;
    pendingShareRecords.forEach(r => r.sharedBy = dispatcherNickname);

    try {
        let shareUrl = `${FIREBASE_DB_URL}shared_leads/${currentClient}/${targetName}.json`;
        let res = await fetch(shareUrl);
        let existingList = await res.json() || [];
        if (!Array.isArray(existingList)) existingList = [];

        let addedCount = 0;
        pendingShareRecords.forEach(rec => {
            if (!existingList.some(r => r.mc === rec.mc)) {
                existingList.push(rec);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            await fetch(shareUrl, {
                method: 'PUT',
                body: JSON.stringify(existingList)
            });
            showPremiumNotification(`Successfully shared ${addedCount} lead(s) with ${targetName}!`, 4000);
            
            document.querySelectorAll('.followup-select-checkbox:checked').forEach(cb => cb.checked = false);
        } else {
            alert(`Selected lead(s) are already present in ${targetName}'s shared inbox.`);
        }
        closeTeamSelectModal();
    } catch (e) {
        console.error("Team share action failed:", e);
        alert("Failed to share leads with team member. Check connection.");
    }
};

window.shareSingleFollowUpToTeam = function(record) {
    openTeamShareModal([record]);
};

window.shareSelectedFollowUpsToTeam = function() {
    let selectedCheckboxes = document.querySelectorAll('.followup-select-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        return alert("Please select at least one follow-up record to share with your team.");
    }

    getAllAppDataFromIndexedDB("followups", function(followUpStore) {
        let selectedMCs = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        let selectedRecords = followUpStore.filter(r => selectedMCs.includes(r.mc));
        openTeamShareModal(selectedRecords);
    });
};

async function pollIncomingSharedLeads() {
    if (!currentClient || !dispatcherNickname) return;
    try {
        let inboxUrl = `${FIREBASE_DB_URL}shared_leads/${currentClient}/${dispatcherNickname}.json`;
        let res = await fetch(inboxUrl);
        let sharedLeads = await res.json() || [];
        if (!Array.isArray(sharedLeads) || sharedLeads.length === 0) return;

        getAllAppDataFromIndexedDB("followups", async function(localFollowUps) {
            let newLeadsAdded = false;
            sharedLeads.forEach(lead => {
                if (!localFollowUps.some(r => r.mc === lead.mc)) {
                    saveAppDataToIndexedDB("followups", lead);
                    newLeadsAdded = true;
                }
            });

            if (newLeadsAdded) {
                showPremiumNotification(`You received new shared follow-up leads from your team!`, 5000);
                if (document.getElementById('dlFollowUpDrawer') && document.getElementById('dlFollowUpDrawer').style.right === "0px") {
                    renderFollowUpItems();
                }
                await fetch(inboxUrl, { method: 'DELETE' });
            }
        });
    } catch (e) {
        console.error("Polling shared leads failed:", e);
    }
}

setInterval(pollIncomingSharedLeads, 60000);

function renderFollowUpItems() {
    const listContainer = document.getElementById('drawerFollowUpList');
    if (!listContainer) return;

    getAllAppDataFromIndexedDB("followups", function(data) {
        data = data.reverse(); 

        let filterQuery = (document.getElementById('followUpSearchInput')?.value || "").toLowerCase().trim();
        let todayDateStr = new Date().toISOString().split('T')[0];

        if (data.length === 0) {
            listContainer.innerHTML = `<p style="color: #6c757d; font-size: 13px; font-style: italic; text-align: center; margin-top: 30px;">No follow-up leads saved yet.</p>`;
            return;
        }

        let itemsHTML = "";
        let matchCount = 0;

        data.forEach(item => {
            let fuDate = item.followUpDate || "N/A";
            let fuTime = item.followUpTime || "N/A";

            if (currentFollowUpFilterMode === 'today' && fuDate !== todayDateStr) {
                return;
            }

            let mcString = (item.mc || "").toString().toLowerCase();
            let nameString = (item.name || "").toLowerCase();
            let phoneString = (item.phone || "").toLowerCase();

            if (filterQuery !== "") {
                let textMatches = mcString.includes(filterQuery) || nameString.includes(filterQuery) || phoneString.includes(filterQuery);
                if (!textMatches) return;
            }

            matchCount++;
            let senderTag = item.sharedBy ? `<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Sent by: ${item.sharedBy}</span>` : "";

            itemsHTML += `
                <div style="background: #fdfdfd; border: 1px solid #e9ecef; border-left: 4px solid #17a2b8; padding: 12px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); font-family:sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6c757d; font-weight: bold; margin-bottom: 4px;">
                        <span>Saved: ${item.addedAt}</span>
                        <span style="background: #e2eafc; color: #002d62; padding: 2px 6px; border-radius: 3px;">${fuDate} @ ${fuTime}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="font-size: 14px; font-weight: bold; color: #002d62;">${item.name}</div>
                        ${senderTag}
                    </div>
                    <div style="font-size: 12px; color:#333;"><b>MC:</b> ${item.mc} | <b>Phone:</b> ${item.phone || 'N/A'}</div>
                    <div style="font-size: 12px; color:#333; margin-top:3px;"><b>Email:</b> ${item.email || 'N/A'}</div>
                    <div style="font-size: 12px; color: #555; background: #f1f3f4; padding: 4px 6px; margin-top: 6px; border-radius: 3px; font-style:italic;">
                        <b>Remarks:</b> ${item.remarks || 'No remarks added'}
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 5px; margin-top: 8px;">
                        <button onclick="triggerOneClickEmailPitch('${item.email}', '${item.name.replace(/'/g, "\\'")}')" style="background: #17a2b8; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">Send</button>
                        <button onclick="deleteFollowUpItem(${item.mc})" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">Drop</button>
                    </div>
                </div>
            `;
        });

        if (matchCount === 0) {
            listContainer.innerHTML = `<p style="color: #6c757d; font-size: 13px; font-style: italic; text-align: center; margin-top: 30px;">No matching follow-up records found for ${currentFollowUpFilterMode === 'today' ? "Today" : "this filter"}.</p>`;
        } else {
            listContainer.innerHTML = itemsHTML;
        }

        if (!document.getElementById('dlBulkFollowUpActionBar')) {
            let actionBar = document.createElement('div');
            actionBar.id = 'dlBulkFollowUpActionBar';
            actionBar.style.cssText = "display: flex; gap: 6px; margin-bottom: 10px; align-items: center; background: #e2eafc; padding: 6px; border-radius: 4px; font-size: 11px;";
            actionBar.innerHTML = `
                <label style="cursor: pointer; font-weight: bold; color: #002d62; display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" id="selectAllFollowUpsCheckbox" onclick="toggleSelectAllFollowUps(this)"> Select All
                </label>
                <button onclick="shareSelectedFollowUpsToTeam()" style="background: #002d62; color: white; border: none; padding: 4px 8px; font-weight: bold; border-radius: 3px; cursor: pointer; flex: 1;" title="Share Selected with Team">Share Selected</button>
            `;
            listContainer.parentNode.insertBefore(actionBar, listContainer);
        }

        let itemDivs = listContainer.querySelectorAll('div[style*="border-left"]');
        itemDivs.forEach((div, idx) => {
            if (!div.querySelector('.followup-select-checkbox')) {
                let record = data[idx];
                if (!record) return;

                let topHeader = div.querySelector('div');
                if (topHeader) {
                    let checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'followup-select-checkbox';
                    checkbox.value = record.mc;
                    checkbox.style.cssText = "margin-right: 6px; cursor: pointer;";
                    topHeader.insertBefore(checkbox, topHeader.firstChild);
                }

                let btnContainer = div.querySelector('div[style*="justify-content: flex-end"]');
                if (btnContainer && !btnContainer.querySelector('.single-team-share-btn')) {
                    let teamBtn = document.createElement('button');
                    teamBtn.className = 'single-team-share-btn';
                    teamBtn.innerHTML = "Share";
                    teamBtn.style.cssText = "background: #002d62; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;";
                    teamBtn.onclick = () => shareSingleFollowUpToTeam(record);
                    btnContainer.insertBefore(teamBtn, btnContainer.firstChild);
                }
            }
        });
    });
}

window.toggleSelectAllFollowUps = function(masterCheckbox) {
    let checkboxes = document.querySelectorAll('.followup-select-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
};

window.remarksFocus = function(index, textarea) {
    if (!textarea.value || textarea.value.trim() === "") {
        textarea.value = DEFAULT_REMARKS_TEMPLATE;
        if (scrapedData[index]) scrapedData[index].remarks = DEFAULT_REMARKS_TEMPLATE;
    }
};

window.remarksBlur = function(index, textarea) {
    let lines = textarea.value.split('\n');
    const linesCheck = ["Truck Type:", "Length:", "Accessories:", "Load:", "Zip Code:", "Summary:"];
    let hasData = false;
    
    for(let i = 0; i < 6; i++) {
        if (lines[i]) {
            let data = lines[i].replace(linesCheck[i], "").trim();
            if (data !== "") { hasData = true; break; }
        }
    }

    if (!hasData) {
        textarea.value = "";
        if (scrapedData[index]) {
            scrapedData[index].remarks = "";
            updateRealTimeHistory(scrapedData, false);
        }
    }
};

window.syncRemarksData = function(index, textarea) {
    if (scrapedData[index]) {
        scrapedData[index].remarks = textarea.value;
        updateRealTimeHistory(scrapedData, false);
    }
};

function generateCSVString(recordsData) {
    let csv = "MC Number,USDOT Number,Company Name,Entity Type,Operating Status,Phone,Address,Email,Power Units,Vehicle Type,Carrier Details,Follow-Up Date,Follow-Up Time,Shared By,Remarks\n";
    recordsData.forEach(r => {
        let safeRemarks = r.remarks || "";
        let safeCarrierDetails = r.carrierDetails || "";
        csv += `${r.mc},${r.usdot},"${r.name}","${r.entityType}","${r.status}","${r.phone}","${r.address}","${r.email}","${r.powerUnits}","${r.vehicleType || 'N/A'}","${safeCarrierDetails}","${r.followUpDate || 'N/A'}","${r.followUpTime || 'N/A'}","${r.sharedBy || dispatcherNickname}","${safeRemarks.replace(/"/g, '""')}"\n`;
    });
    return csv;
}

window.toggleHistoryDrawer = function() {
    let drawer = document.getElementById('dlHistoryDrawer');
    let followUpDrawer = document.getElementById('dlFollowUpDrawer');
    if (!drawer) return;
    
    if(followUpDrawer) followUpDrawer.style.right = "-420px"; 
    
    if (drawer.style.right === "0px") {
        drawer.style.right = "-420px";
    } else {
        drawer.style.right = "0px";
        renderHistoryItems();
    }
};

function renderHistoryItems() {
    if (!db) return;
    const listContainer = document.getElementById('drawerHistoryList');
    if (!listContainer) return;

    const tx = db.transaction("history", "readonly");
    const store = tx.objectStore("history");
    const getAll = store.getAll();
    
    getAll.onsuccess = function() {
        let data = getAll.result || [];
        data = data.reverse();

        if (data.length === 0) {
            listContainer.innerHTML = `<p style="color: #6c757d; font-size: 13px; font-style: italic; text-align: center; margin-top: 30px;">No history records found yet.</p>`;
            return;
        }

        let itemsHTML = "";
        data.forEach(item => {
            let displayStatus = item.status === "Interrupted (Auto-Saved)"
                ? `<span style="color: #d9534f; font-weight:bold;">${item.status}</span>`
                : `<span style="color: #28a745; font-weight:bold;">${item.status}</span>`;

            let recordsCount = item.records ? item.records.length : (item.totalRecords || 0);

            let resumeBtnStyle = recordsCount === 0 
                ? "background: #cccccc; color: #666666; border: none; padding: 5px 10px; border-radius: 4px; cursor: not-allowed; font-size: 12px; font-weight: bold;" 
                : "background: #ff9800; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;";
            
            let csvBtnStyle = recordsCount === 0 
                ? "background: #cccccc; color: #666666; border: none; padding: 5px 10px; border-radius: 4px; cursor: not-allowed; font-size: 12px; font-weight: bold;" 
                : "background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;";

            let resumeActionAttr = recordsCount === 0 ? "" : `onclick="resumeHistorySheet(${item.id})"`;
            let csvActionAttr = recordsCount === 0 ? "" : `onclick="downloadHistoryCSV(${item.id})"`;

            itemsHTML += `
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-left: 4px solid #002d62; padding: 12px; margin-bottom: 10px; border-radius: 6px; font-family: sans-serif;">
                    <div style="font-size: 11px; color: #6c757d; font-weight: bold;">${item.date}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #333; margin: 4px 0;">Range: ${item.range}</div>
                    <div style="font-size: 12px; margin-bottom: 8px;">Status: ${displayStatus}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; border-top: 1px solid #eee; padding-top: 8px;">
                        <span style="background: #e2eafc; color: #002d62; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">${recordsCount} Active</span>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <button ${resumeActionAttr} style="${resumeBtnStyle}">Resume</button>
                            <button onclick="loadHistorySheetToTable(${item.id})" style="background: #002d62; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Open</button>
                            <button ${csvActionAttr} style="${csvBtnStyle}">CSV</button>
                            <button onclick="deleteHistoryItem(${item.id})" style="background: #dc3545; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;" title="Delete">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = itemsHTML;
    };
}

window.loadHistorySheetToTable = async function(id) {
    const tx = db.transaction("history", "readonly");
    const req = tx.objectStore("history").get(id);

    req.onsuccess = async function() {
        let item = req.result;
        if (!item || !item.records) return;
        
        scrapedData = item.records; 
        currentHistoryId = item.id;

        availableCategories.clear();
        scrapedData.forEach(r => {
            if (r.carrierDetails) {
                r.carrierDetails.split(', ').forEach(cat => {
                    if (cat.trim()) availableCategories.add(cat.trim());
                });
            }
        });
        updateCategoryCheckboxes();

        if (item.range) {
            let parts = item.range.split('-');
            if (parts.length === 2) {
                let startInput = document.getElementById('startMc');
                let endInput = document.getElementById('endMc');
                if (startInput) startInput.value = parts[0].trim();
                if (endInput) endInput.value = parts[1].trim();
            }
        }

        const tableBody = document.getElementById('resultsTable');
        tableBody.innerHTML = '';
        
        getAllAppDataFromIndexedDB("followups", function(followUpStore) {
            for (let index = 0; index < scrapedData.length; index++) {
                let record = scrapedData[index];
                let emailCellHTML = buildEmailCellMarkup(record.email, record.name);
                let phoneCellHTML = buildPhoneCellMarkup(record.phone);
                
                let isAlreadyFollowed = followUpStore.some(r => r.mc === record.mc);
                let rowStyleHTML = isAlreadyFollowed ? `style="background: #d4edda;"` : '';
                let activeRemarksValue = record.remarks || "";

                tableBody.innerHTML += `<tr ${rowStyleHTML}>
                    <td><b>${record.mc}</b></td>
                    <td>${record.usdot}</td>
                    <td>${record.name}</td>
                    <td>${record.entityType}</td>
                    <td><span class="badge badge-active">${record.status}</span></td>
                    ${phoneCellHTML}
                    <td>${record.address}</td> 
                    ${emailCellHTML}
                    <td>${record.powerUnits}</td>
                    <td style="white-space: nowrap !important;"><b>${record.vehicleType || 'N/A'}</b></td>
                    <td class="remarks-cell-container">
                        <textarea class="remarks-input-field" placeholder="Click to add remarks..." onfocus="remarksFocus(${index}, this)" onblur="remarksBlur(${index}, this)" oninput="syncRemarksData(${index}, this)">${activeRemarksValue}</textarea>
                    </td>
                    <td><button onclick="addLeadToFollowUpList(${index}, this)" class="premium-followup-btn">Follow</button></td>
                </tr>`;
            }
            populateStateDropdown();
            populateVehicleTypeCheckboxes();
            toggleHistoryDrawer(); 
        });
    };
};

window.resumeHistorySheet = async function(id) {
    const tx = db.transaction("history", "readonly");
    const req = tx.objectStore("history").get(id);

    req.onsuccess = async function() {
        let item = req.result;
        if (!item || !item.range) return;

        let parts = item.range.split('-');
        let startRange = parseInt(parts[0].trim());
        let endRange = parseInt(parts[1].trim());

        let startInput = document.getElementById('startMc');
        let endInput = document.getElementById('endMc');
        if (startInput) startInput.value = startRange;
        if (endInput) endInput.value = endRange;

        scrapedData = item.records || [];
        currentHistoryId = item.id;
        window.activeScrapeRange = item.range;

        availableCategories.clear();
        scrapedData.forEach(r => {
            if (r.carrierDetails) {
                r.carrierDetails.split(', ').forEach(cat => {
                    if (cat.trim()) availableCategories.add(cat.trim());
                });
            }
        });
        updateCategoryCheckboxes();

        const tableBody = document.getElementById('resultsTable');
        tableBody.innerHTML = '';
        
        getAllAppDataFromIndexedDB("followups", function(followUpStore) {
            for (let index = 0; index < scrapedData.length; index++) {
                let record = scrapedData[index];
                let emailCellHTML = buildEmailCellMarkup(record.email, record.name);
                let phoneCellHTML = buildPhoneCellMarkup(record.phone);
                let isAlreadyFollowed = followUpStore.some(r => r.mc === record.mc);
                let rowStyleHTML = isAlreadyFollowed ? `style="background: #d4edda;"` : '';
                let activeRemarksValue = record.remarks || "";

                tableBody.innerHTML += `<tr ${rowStyleHTML}>
                    <td><b>${record.mc}</b></td>
                    <td>${record.usdot}</td>
                    <td>${record.name}</td>
                    <td>${record.entityType}</td>
                    <td><span class="badge badge-active">${record.status}</span></td>
                    ${phoneCellHTML}
                    <td>${record.address}</td> 
                    ${emailCellHTML}
                    <td>${record.powerUnits}</td>
                    <td style="white-space: nowrap !important;"><b>${record.vehicleType || 'N/A'}</b></td>
                    <td class="remarks-cell-container">
                        <textarea class="remarks-input-field" placeholder="Click to add remarks..." onfocus="remarksFocus(${index}, this)" onblur="remarksBlur(${index}, this)" oninput="syncRemarksData(${index}, this)">${activeRemarksValue}</textarea>
                    </td>
                    <td><button onclick="addLeadToFollowUpList(${index}, this)" class="premium-followup-btn">Follow</button></td>
                </tr>`;
            }
            populateStateDropdown();
            populateVehicleTypeCheckboxes();
            toggleHistoryDrawer();
            
            let nextStartMc = startRange;
            if (scrapedData.length > 0) {
                let maxScannedMc = Math.max(...scrapedData.map(r => parseInt(r.mc)));
                if (!isNaN(maxScannedMc) && maxScannedMc >= startRange) {
                    nextStartMc = maxScannedMc + 1;
                }
            }
            
            startScraping(nextStartMc, endRange);
        });
    };
};

window.downloadHistoryCSV = function(id) {
    const tx = db.transaction("history", "readonly");
    const store = tx.objectStore("history");
    const req = store.get(id);
    req.onsuccess = function() {
        let item = req.result;
        let recordsList = item && item.records ? item.records : [];
        if (recordsList.length > 0) {
            triggerCSVDownload(recordsList, `History_MC_${item.range.replace(/\s+/g, '_')}.csv`);
        }
    };
};

window.deleteHistoryItem = function(id) {
    if (confirm("Delete this sheet from history?")) {
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");
        store.delete(id);
        tx.oncomplete = function() {
            renderHistoryItems();
        };
    }
};

function triggerCSVDownload(recordsData, filename) {
    const csv = generateCSVString(recordsData);
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function updateRealTimeHistory(recordsArray, isCompleted = false) {
    if (!db || currentHistoryId === null) return;
    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    const req = store.get(currentHistoryId);
    
    req.onsuccess = function() {
        const data = req.result;
        if (data) {
            data.totalRecords = recordsArray.length;
            data.records = recordsArray;
            data.status = isCompleted ? "Completed" : "Interrupted (Auto-Saved)";
            store.put(data);
        }
    };
}

let scraping = false; 
let scrapedData = [];

window.stopScraping = function() {
    scraping = false;
    let statusBox = document.getElementById('status');
    if (statusBox) {
        statusBox.style.background = "#fff3cd";
        statusBox.style.color = "#856404";
        statusBox.style.padding = "10px 15px";
        statusBox.innerHTML = "<strong>Processing Paused Safely. Click Start to resume/run again.</strong>";
    }
    if (currentHistoryId) {
        updateRealTimeHistory(scrapedData, false);
    }
}

async function processSingleMCWithDetailedError(mc, statusBox) {
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const sessionUrl = `${FIREBASE_DB_URL}sessions/${currentClient}.json`;
            const sRes = await fetch(sessionUrl);
            const sData = await sRes.json() || {};
            let now = Date.now();
            const offlineThreshold = 12000;
            
            let activeCount = 0;
            Object.keys(sData).forEach(k => {
                let session = sData[k];
                if (session && session.timestamp && (now - session.timestamp < offlineThreshold)) {
                    activeCount++;
                }
            });

            if (userLimit > 0 && activeCount > userLimit) {
                if (statusBox) {
                    statusBox.innerHTML = `<strong>Global License Limit Exceeded (${activeCount}/${userLimit}). Pausing scraping...</strong>`;
                }
                return { status: "limit_exceeded" };
            }

            const snapshotUrl = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mc}`;
            const response = await fetch(snapshotUrl);
            
            if (!response.ok) {
                attempt++;
                if (statusBox) {
                    statusBox.innerHTML = `<strong>Safer Server Issue (Attempt ${attempt}/${maxRetries}). Retrying...</strong>`;
                }
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }

            const htmlText = await response.text();

            if (htmlText.includes("Record not found") || htmlText.includes("No records found") || !htmlText.includes("USDOT Number:")) {
                return { status: "not_found" };
            }

            let record = { mc: mc, usdot: 'N/A', name: 'N/A', entityType: 'N/A', status: 'N/A', phone: 'N/A', address: 'N/A', email: 'N/A', powerUnits: 'N/A', vehicleType: 'N/A', carrierDetails: '', remarks: '', followUpDate: '', followUpTime: '', sharedBy: dispatcherNickname };
            let el = document.createElement('html');
            el.innerHTML = htmlText;
            let cells = el.querySelectorAll('td, th');

            for (let i = 0; i < cells.length; i++) {
                let text = cells[i].textContent.trim();
                if (text.startsWith("Legal Name:") || text.startsWith("Entity Name:")) {
                    if(cells[i+1]) record.name = cells[i+1].textContent.trim().replace(/\s+/g, ' ');
                }
                if (text.startsWith("USDOT Number:")) {
                    if(cells[i+1]) record.usdot = cells[i+1].textContent.trim().split(/\s+/)[0];
                }
                if (text.startsWith("Entity Type:")) {
                    if(cells[i+1]) record.entityType = cells[i+1].textContent.trim().replace(/\s+/g, ' ');
                }
                if (text.startsWith("Operating Authority Status:")) {
                    if (cells[i+1]) {
                        let rawStatus = cells[i+1].textContent.toUpperCase();
                        if (rawStatus.includes("NOT AUTHORIZED")) {
                            record.status = "NOT AUTHORIZED";
                        } else if (rawStatus.includes("AUTHORIZED") || rawStatus.includes("ACTIVE")) {
                            record.status = "AUTHORIZED";
                        } else {
                            record.status = cells[i+1].textContent.replace(/\s+/g, ' ').trim();
                        }
                    }
                }
                if (text.startsWith("Power Units:")) { if(cells[i+1]) record.powerUnits = cells[i+1].textContent.trim().replace(/\s+/g, ' '); }
                if (text.startsWith("Phone:")) { if(cells[i+1]) record.phone = cells[i+1].textContent.trim().replace(/\s+/g, ' '); }
                if (text.startsWith("Physical Address:") || (text.startsWith("Address:") && !text.includes("Mailing"))) {
                    if(cells[i+1]) record.address = cells[i+1].textContent.trim().replace(/\s+/g, ' ');
                }
            }

            if (record.status !== "AUTHORIZED") { 
                return { status: "filtered_out" }; 
            }

            let tables = el.querySelectorAll('table');
            let allDetails = [];
            tables.forEach(table => {
                let rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    let rCells = row.querySelectorAll('td');
                    rCells.forEach((cell, idx) => {
                        let cVal = cell.textContent.trim();
                        if (cVal === 'X' || cVal.toLowerCase() === 'x') {
                            let labelCell = rCells[idx + 1] || rCells[idx - 1];
                            if (labelCell) {
                                let cleanVal = labelCell.textContent.trim().replace(/\s+/g, ' ');
                                if (cleanVal && cleanVal !== 'X' && !allDetails.includes(cleanVal)) {
                                    allDetails.push(cleanVal);
                                    availableCategories.add(cleanVal);
                                }
                            }
                        }
                    });
                });
            });
            if (allDetails.length > 0) { record.carrierDetails = allDetails.join(', '); }

            if (record.usdot !== 'N/A') {
                try {
                    const smsUrl = `https://ai.fmcsa.dot.gov/SMS/Carrier/${record.usdot}/CarrierRegistration.aspx`;
                    const smsResponse = await fetch(smsUrl);
                    if (smsResponse.ok) {
                        const smsHtml = await smsResponse.text();
                        let smsEl = document.createElement('html');
                        smsEl.innerHTML = smsHtml;

                        let vehicleMapList = [];
                        let smsTables = smsEl.querySelectorAll('table');
                        smsTables.forEach(tbl => {
                            let rows = tbl.querySelectorAll('tr');
                            rows.forEach(row => {
                                let cols = row.querySelectorAll('td, th');
                                if (cols.length >= 4) {
                                    let vType = cols[0].textContent.trim().replace(/\*$/, "").trim();
                                    let owned = parseInt(cols[1].textContent.trim()) || 0;
                                    let termLeased = parseInt(cols[2].textContent.trim()) || 0;
                                    let tripLeased = parseInt(cols[3].textContent.trim()) || 0;
                                    let totalCount = owned + termLeased + tripLeased;

                                    if (totalCount > 0 && ["Straight Trucks", "Truck Tractors", "Trailers"].includes(vType)) {
                                        vehicleMapList.push(`${vType} ${totalCount}`);
                                    }
                                }
                            });
                        });

                        if (vehicleMapList.length > 0) {
                            record.vehicleType = vehicleMapList.join(" | ");
                        }

                        let smsCells = smsEl.querySelectorAll('td, th, span, label, a');
                        for (let j = 0; j < smsCells.length; j++) {
                            let smsText = smsCells[j].textContent.trim();
                            if (smsText.toLowerCase().includes("email") || smsText.includes("@")) {
                                let emailMatch = smsText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                if (emailMatch && !emailMatch[0].includes("fmcsa") && !emailMatch[0].includes("dot.gov")) { 
                                    record.email = emailMatch[0]; 
                                    break; 
                                }
                            }
                        }
                        if (record.email === 'N/A') {
                            let fullPageEmailMatch = smsHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                            if (fullPageEmailMatch) {
                                let validEmail = fullPageEmailMatch.find(e => !e.toLowerCase().includes("fmcsa") && !e.toLowerCase().includes("dot.gov"));
                                if (validEmail) record.email = validEmail;
                            }
                        }
                    }
                } catch (smsErr) { 
                    console.warn(`SMS Portal warning for USDOT ${record.usdot}:`, smsErr.message); 
                }
            }
            return { status: "success", data: record };

        } catch (err) {
            attempt++;
            if (statusBox) {
                statusBox.innerHTML = `<strong>Safer Server Issue on MC ${mc}. Retrying (${attempt}/${maxRetries})...</strong>`;
            }
            await new Promise(r => setTimeout(r, 3000 * attempt));
        }
    }
    return { status: "error", message: `Failed after retries for MC ${mc}` };
}

window.startScraping = async function(overrideStart = null, overrideEnd = null) {
    const start = overrideStart !== null ? overrideStart : parseInt(document.getElementById('startMc').value);
    const end = overrideEnd !== null ? overrideEnd : parseInt(document.getElementById('endMc').value);

   // SAFE STATUS INITIALIZER
    try {
        let statusBox = document.getElementById('status');
        if (statusBox) {
            statusBox.style.display = "block";
            statusBox.innerHTML = "<strong>Initializing scan and connecting to Safer Web...</strong>";
        }
    } catch (err) {
        console.error("Status update error:", err);
    }

    if (isNaN(start) || isNaN(end) || start > end) {
        let stBox = document.getElementById('status');
        if (stBox) stBox.innerText = "Please enter a valid MC range.";
        return;
    }

    let currentRangeStr = `${start} - ${end}`;
    if (!currentHistoryId || window.activeScrapeRange !== currentRangeStr) {
        if (overrideStart === null) {
            currentHistoryId = null;
            scrapedData = [];
            availableCategories.clear();
        }
        window.activeScrapeRange = currentRangeStr;
        if (overrideStart === null) {
            const tableBody = document.getElementById('resultsTable');
            if (tableBody) tableBody.innerHTML = '';
        }
    }

    scraping = true; 
    document.getElementById('startBtn').style.display = 'none';
    if(document.getElementById('openHistoryBtn')) document.getElementById('openHistoryBtn').style.display = 'none';
    if(document.getElementById('openFollowUpDrawerBtn')) document.getElementById('openFollowUpDrawerBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'inline-block';
    document.getElementById('downloadBtn').style.display = 'none';

    let totalToScan = end - start + 1;
    let totalProcessed = 0;
    let errorDetailsList = [];
    let startTime = Date.now();

    let statusBox = document.getElementById('status');
    if (statusBox) {
        statusBox.style.display = "flex";
        statusBox.style.flexDirection = "row";
        statusBox.style.alignItems = "center";
        statusBox.style.justifyContent = "space-between";
        statusBox.style.padding = "10px 15px";
        statusBox.style.background = "#f8f9fa";
        statusBox.style.color = "#333";
        statusBox.style.border = "1px solid #e9ecef";
        statusBox.style.borderLeft = "5px solid #002d62";
        statusBox.style.borderRadius = "4px";
    }

    if (!currentHistoryId && db) {
        const now = new Date();
        const formattedDate = now.toLocaleString('en-US', { hour12: true });

        const initialHistoryItem = {
            id: Date.now(),
            date: formattedDate,
            range: currentRangeStr,
            totalRecords: scrapedData.length,
            status: "Interrupted (Auto-Saved)",
            records: scrapedData
        };

        currentHistoryId = initialHistoryItem.id;
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");
        store.add(initialHistoryItem);
    }

    let effectiveStart = start;
    if (scrapedData.length > 0) {
        let maxScannedMc = Math.max(...scrapedData.map(r => parseInt(r.mc)));
        if (!isNaN(maxScannedMc) && maxScannedMc >= start && maxScannedMc < end) {
            effectiveStart = maxScannedMc + 1;
        }
    }

    for (let mc = effectiveStart; mc <= end; mc++) {
        if (!scraping) break;

        let result = await processSingleMCWithDetailedError(mc, statusBox);
        
        if (result.status === "limit_exceeded") {
            stopScraping();
            showLimitExceededModal(`Your global license limit for "${currentClient}" has been reached. Max allowed active tabs/devices is <b>${userLimit}</b>. Scraping has been paused safely.`);
            break;
        }

        totalProcessed++;

        if (result.status === "error") {
            errorDetailsList.push(result.message);
        } else {
            errorDetailsList = []; 
            if (result.status === "success" && result.data) {
                let record = result.data;
                
                let isAlreadyExists = scrapedData.some(existing => String(existing.mc) === String(record.mc));
                
                if (!isAlreadyExists) {
                    scrapedData.push(record);
                    let recordIndex = scrapedData.length - 1;
                    updateRealTimeHistory(scrapedData, false);
                    updateCategoryCheckboxes();

                    let emailCellMarkup = buildEmailCellMarkup(record.email, record.name);
                    let phoneCellMarkup = buildPhoneCellMarkup(record.phone);
                    let activeRemarksValue = record.remarks || "";

                    const tableBody = document.getElementById('resultsTable');
                    let newRow = document.createElement('tr');
                    newRow.innerHTML = `
                        <td><b>${record.mc}</b></td>
                        <td>${record.usdot}</td>
                        <td>${record.name}</td>
                        <td>${record.entityType}</td>
                        <td><span class="badge badge-active">${record.status}</span></td>
                        ${phoneCellMarkup}
                        <td>${record.address}</td>
                        ${emailCellMarkup}
                        <td>${record.powerUnits}</td>
                        <td style="white-space: nowrap !important;"><b>${record.vehicleType || 'N/A'}</b></td>
                        <td class="remarks-cell-container">
                            <textarea class="remarks-input-field" placeholder="Click to add remarks..." onfocus="remarksFocus(${recordIndex}, this)" onblur="remarksBlur(${recordIndex}, this)" oninput="syncRemarksData(${recordIndex}, this)">${activeRemarksValue}</textarea>
                        </td>
                        <td><button onclick="addLeadToFollowUpList(${recordIndex}, this)" class="premium-followup-btn">Follow</button></td>
                    `;
                    tableBody.appendChild(newRow);
                }
            }
        }

        let percentage = Math.floor((totalProcessed / totalToScan) * 100);
        let elapsedSeconds = (Date.now() - startTime) / 1000;
        let avgTimePerMC = elapsedSeconds / (totalProcessed || 1);
        let remainingMCs = totalToScan - totalProcessed;
        let estimatedRemainingSeconds = remainingMCs * avgTimePerMC;

        let mins = Math.floor(estimatedRemainingSeconds / 60);
        let secs = Math.floor(estimatedRemainingSeconds % 60);
        let timeString = totalProcessed < 3 ? "Calculating ETA..." : `ETA: ${mins}m ${secs}s`;
        let degrees = percentage * 3.6;

        let latestErrorText = errorDetailsList.length > 0 ? `<span style="color:#d9534f; font-size:11px;" title="${errorDetailsList[errorDetailsList.length - 1]}">Retrying/Err</span>` : `<span style="color:#28a745; font-size:11px; font-weight:bold;">Status: Stable</span>`;

        if (statusBox && scraping) {
            statusBox.innerHTML = `
                <div style="font-family: sans-serif; display: flex; flex-direction: column; gap: 2px; text-align: left;">
                    <div style="font-size: 13px; font-weight: bold; color: #333;">Scanning MC ${mc} (${totalProcessed}/${totalToScan})</div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 11px; color: #6c757d; font-weight: bold;">${timeString}</span>
                        ${latestErrorText}
                    </div>
                </div>
                <div style="position: relative; width: 40px; height: 40px; border-radius: 50%; background: conic-gradient(#002d62 ${degrees}deg, #ddd ${degrees}deg); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <div style="position: absolute; width: 30px; height: 30px; background: #f8f9fa; border-radius: 50%;"></div>
                    <span style="position: relative; font-family: sans-serif; font-size: 11px; font-weight: bold; color: #002d62;">${percentage}%</span>
                </div>
            `;
        }
        populateStateDropdown();
        populateVehicleTypeCheckboxes();
        applyAdvancedFilters();

        await new Promise(r => setTimeout(r, 350));
    }

    scraping = false;
    document.getElementById('startBtn').style.display = 'inline-block';
    if(document.getElementById('openHistoryBtn')) document.getElementById('openHistoryBtn').style.display = 'inline-block';
    if(document.getElementById('openFollowUpDrawerBtn')) document.getElementById('openFollowUpDrawerBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'none';

    if (statusBox) {
        statusBox.style.padding = "15px";
        statusBox.style.display = "flex";
        statusBox.style.borderLeft = "5px solid #28a745";
        statusBox.innerHTML = `<strong style="size: 15px; color: #28a745; font-family: sans-serif;">Completed! Found ${scrapedData.length} valid records.</strong>`;
    }

    if(scrapedData.length > 0) {
        document.getElementById('downloadBtn').style.display = 'inline-block';
        updateRealTimeHistory(scrapedData, true);
    }
}

window.downloadCSV = function() {
    if(scrapedData.length > 0) {
        const start = document.getElementById('startMc').value;
        const end = document.getElementById('endMc').value;
        triggerCSVDownload(scrapedData, `DispatchLink_Data_${start}_to_${end}.csv`);
    }
}
