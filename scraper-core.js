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
                await fetch(callLogUrl, { method: 'PUT', body: JSON.stringify(filteredLogs) });
            }
        }
    } catch (e) {
        console.error("Failed to cleanup old Firebase data:", e);
    }
}

function performAutomaticDataCleanup() {
    if (!currentClient) return;
    checkAndClearLocalStorageOnShiftChange();
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
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #ddd; font-size: 12px; color: #333; margin-bottom: 20px;">
                Contact Admin: <b>03700684849</b>
            </div>
            <button onclick="window.location.reload();" style="background: #002d62; color: white; border: none; padding: 12px 20px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%;">OK, Understood</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function showPremiumNotification(message, duration = 4500) {
    let toast = document.createElement('div');
    toast.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><div style="background: #28a745; width: 10px; height: 10px; border-radius: 50%;"></div><span>${message}</span></div>`;
    toast.style.cssText = `position: fixed; top: -100px; right: 20px; background: #002d62; color: #ffffff; padding: 14px 22px; border-radius: 6px; font-family: sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.25); border-left: 5px solid #17a2b8; z-index: 100000; transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s; opacity: 0;`;
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
                <input type="text" id="dlLoginUser" placeholder="Enter username" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 6px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 20px; text-align: left; position: relative;">
                <label style="font-size: 12px; font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Password</label>
                <input type="password" id="dlLoginPass" placeholder="Enter password" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #b6ccfe; border-radius: 6px; box-sizing: border-box;">
            </div>
            <button onclick="processLogin()" style="width: 100%; background: #002d62; color: white; border: none; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer;">Login to Portal</button>
            <div id="dlLoginError" style="color: #dc3545; font-size: 12px; font-weight: bold; margin-top: 12px; display: none;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
}

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
    window.location.reload();
};

function setupDispatcherIdentity() {
    getAppDataFromIndexedDB("settings", "agent_nickname", function(savedNick) {
        dispatcherNickname = savedNick || "";
        if (!dispatcherNickname) {
            let inputName = prompt("Please enter your agent name (e.g., Nauman, Ali):");
            dispatcherNickname = (inputName && inputName.trim() !== "") ? inputName.trim() : "Agent_1";
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
    panel.style.cssText = "display: flex; justify-content: flex-end; align-items: center; width: 100%; margin: 15px 0; padding: 4px 10px; font-family: sans-serif;";
    panel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="openCallingDetailModal()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">📞 Today Calls</button>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 30px; padding: 5px 14px; font-size: 13px; font-weight: bold; color: #0f172a;">
                Agent: <span id="dlDispCurrentName">${dispatcherNickname}</span>
            </div>
        </div>
    `;
    heading.parentNode.insertBefore(panel, heading.nextSibling);
}

async function initializeAccessControl() {
    await fetchAllowedUsersFromFirebase();
    if (!currentClient || !allowedUsers[currentClient]) {
        renderLoginScreen();
        return;
    }
    let clientConfig = allowedUsers[currentClient];
    userLimit = clientConfig.maxLaptops || 0;
    setupDispatcherIdentity();
    performAutomaticDataCleanup();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await fetchAllowedUsersFromFirebase();
        if (!currentClient || !allowedUsers[currentClient]) { renderLoginScreen(); } else { initializeAccessControl(); }
    });
} else {
    setTimeout(async () => {
        await fetchAllowedUsersFromFirebase();
        if (!currentClient || !allowedUsers[currentClient]) { renderLoginScreen(); } else { initializeAccessControl(); }
    }, 200);
}

// ====== INDEXEDDB SETUP ======
let db;
const request = indexedDB.open("DispatchLinkHistoryDB", 3);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("followups")) db.createObjectStore("followups", { keyPath: "mc" });
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
};
request.onsuccess = function(e) {
    db = e.target.result;
    injectHistoryUIFramework();
};

function saveAppDataToIndexedDB(storeName, dataObj) {
    if (!db) return;
    try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(dataObj);
    } catch(e) { console.error(e); }
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

function getAllAppDataFromIndexedDB(storeName, callback) {
    if (!db) { callback([]); return; }
    try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { callback(req.result || []); };
        req.onerror = function() { callback([]); };
    } catch(e) { callback([]); }
}

const DEFAULT_REMARKS_TEMPLATE = "Truck Type:\nLength:\nAccessories:\nLoad:\nZip Code:\nSummary:";

function injectHistoryUIFramework() {
    document.title = "Dispatch Link";

    let coreTable = document.querySelector('table');
    if (coreTable && !coreTable.parentNode.classList.contains('table-responsive')) {
        let wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'table-responsive';
        coreTable.parentNode.insertBefore(wrapperDiv, coreTable);
        wrapperDiv.appendChild(coreTable);
    }

    let tableHeader = document.querySelector('table tr');
    if (tableHeader && !document.getElementById('remarksHeaderCol')) {
        // Clear old incorrect headers if present to re-align properly
        tableHeader.innerHTML = `
            <th>MC Number</th>
            <th>USDOT</th>
            <th>Company Name</th>
            <th>Entity Type</th>
            <th>Operating Status</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Email</th>
            <th>Power Units</th>
            <th id="vehicleTypeHeaderCol">Vehicles</th>
            <th id="remarksHeaderCol" class="remarks-cell-container">Remarks</th>
            <th id="followUpHeaderCol">Action</th>
        `;
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
                <h3 style="color: #002d62; margin-top: 0; margin-bottom: 15px; font-size: 16px;">⏰ Schedule Follow-Up</h3>
                <div style="margin-bottom: 12px;"><label style="display:block; font-size:12px; font-weight:bold;">Date:</label><input type="date" id="dlModalDateInput" style="width:100%; padding:8px; box-sizing:border-box;"></div>
                <div style="margin-bottom: 18px;"><label style="display:block; font-size:12px; font-weight:bold;">Time:</label><input type="time" id="dlModalTimeInput" style="width:100%; padding:8px; box-sizing:border-box;"></div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="closeFollowUpModal()" style="background: #6c757d; color: white; border: none; padding: 6px 14px; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button onclick="confirmFollowUpSchedule()" style="background: #28a745; color: white; border: none; padding: 6px 14px; font-weight: bold; border-radius: 4px; cursor: pointer;">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    let startBtn = document.getElementById('startBtn');
    if (startBtn && !document.getElementById('openFollowUpDrawerBtn')) {
        let followUpBtn = document.createElement('button');
        followUpBtn.id = 'openFollowUpDrawerBtn';
        followUpBtn.innerHTML = "📅 View Follow-Ups";
        followUpBtn.style.cssText = "background: #17a2b8; color: white; border: none; padding: 8px 16px; font-size: 14px; font-weight: bold; border-radius: 4px; cursor: pointer; margin-left: 8px;";
        followUpBtn.onclick = (e) => { e.stopPropagation(); toggleFollowUpDrawer(); };
        startBtn.parentNode.insertBefore(followUpBtn, startBtn.nextSibling);
    }
}

// Follow-up drawer render logic
window.toggleFollowUpDrawer = function() {
    let drawer = document.getElementById('dlFollowUpDrawer');
    if (!drawer) return;
    drawer.style.right = drawer.style.right === "0px" ? "-420px" : "0px";
    if (drawer.style.right === "0px") renderFollowUpItems();
};

function renderFollowUpItems() {
    let container = document.getElementById('drawerFollowUpList');
    if (!container) return;
    getAllAppDataFromIndexedDB("followups", function(items) {
        if (items.length === 0) {
            container.innerHTML = `<p style="color: #6c757d; text-align: center; font-size: 13px;">No follow-ups added yet.</p>`;
            return;
        }
        let html = "";
        items.forEach(r => {
            html += `
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-bottom: 10px; font-size: 12px;">
                    <div><b>MC:</b> ${r.mc} | <b>Name:</b> ${r.name}</div>
                    <div><b>Phone:</b> ${r.phone}</div>
                    <div style="color: #002d62; margin-top: 4px;"><b>Scheduled:</b> ${r.followUpDate} at ${r.followUpTime}</div>
                    <button onclick="deleteFollowUpItem('${r.mc}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; font-size: 10px; border-radius: 3px; cursor: pointer; margin-top: 6px;">Remove</button>
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

window.deleteFollowUpItem = function(mc) {
    if (confirm("Remove carrier from follow-ups?")) {
        const tx = db.transaction("followups", "readwrite");
        tx.objectStore("followups").delete(mc);
        tx.oncomplete = () => renderFollowUpItems();
    }
};

let pendingFollowUpIndex = null;
window.addLeadToFollowUpList = function(index) {
    let record = scrapedData[index];
    if (!record) return;
    pendingFollowUpIndex = index;
    let modal = document.getElementById('dlDatePickerModal');
    if (modal) modal.style.display = 'flex';
};

window.closeFollowUpModal = function() {
    let modal = document.getElementById('dlDatePickerModal');
    if (modal) modal.style.display = 'none';
    pendingFollowUpIndex = null;
};

window.confirmFollowUpSchedule = function() {
    if (pendingFollowUpIndex === null) return;
    let record = scrapedData[pendingFollowUpIndex];
    let selectedDate = document.getElementById('dlModalDateInput').value;
    let selectedTime = document.getElementById('dlModalTimeInput').value;
    if (!selectedDate) { alert("Please select a date."); return; }

    record.followUpDate = selectedDate;
    record.followUpTime = selectedTime ? formatTime12Hour(selectedTime) : "N/A";
    saveAppDataToIndexedDB("followups", record);
    showPremiumNotification(`Follow-up saved for MC ${record.mc}`);
    closeFollowUpModal();
};

function formatTime12Hour(time24) {
    let parts = time24.split(':');
    let hours = parseInt(parts[0]);
    let minutes = parts[1];
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

window.openCallingDetailModal = function() {
    let logs = JSON.parse(localStorage.getItem(`dl_call_logs_${currentClient}_${dispatcherNickname}`)) || [];
    alert(`Total Calls Logged Today: ${logs.length}`);
};

// Email & Phone Markup Builders
function buildEmailCellMarkup(emailAddress, companyName) {
    if (!emailAddress || emailAddress === 'N/A') return `<td style="color: #6c757d;">N/A</td>`;
    return `<td><a href="mailto:${emailAddress}" style="color: #002d62; font-weight: bold; text-decoration: none;">${emailAddress}</a></td>`;
}

function buildPhoneCellMarkup(phoneNum) {
    if (!phoneNum || phoneNum === 'N/A') return `<td style="color: #6c757d; text-align: center;">N/A</td>`;
    return `<td><a href="tel:${phoneNum}" style="color: #002d62; font-weight: bold; text-decoration: none;">📞 ${phoneNum}</a></td>`;
}

// Scraping Core Engine
let scraping = false; 
let scrapedData = [];

window.stopScraping = function() {
    scraping = false;
    let statusBox = document.getElementById('status');
    if (statusBox) statusBox.innerHTML = "<strong>Processing Paused Safely.</strong>";
}

async function processSingleMCWithDetailedError(mc) {
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const snapshotUrl = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mc}`;
            const response = await fetch(snapshotUrl);
            if (!response.ok) { attempt++; await new Promise(r => setTimeout(r, 1000)); continue; }

            const htmlText = await response.text();
            if (htmlText.includes("Record not found") || !htmlText.includes("USDOT Number:")) {
                return { status: "not_found" };
            }

            let record = { 
                mc: mc, usdot: 'N/A', name: 'N/A', entityType: 'N/A', status: 'N/A', 
                phone: 'N/A', address: 'N/A', email: 'N/A', powerUnits: 'N/A', 
                vehicleType: 'N/A', remarks: DEFAULT_REMARKS_TEMPLATE 
            };

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
                    if (cells[i+1]) record.status = cells[i+1].textContent.replace(/\s+/g, ' ').trim();
                }
                if (text.startsWith("Power Units:")) { 
                    if(cells[i+1]) record.powerUnits = cells[i+1].textContent.trim().replace(/\s+/g, ' '); 
                }
                if (text.startsWith("Phone:")) { 
                    if(cells[i+1]) record.phone = cells[i+1].textContent.trim().replace(/\s+/g, ' '); 
                }
                if (text.startsWith("Physical Address:")) {
                    if(cells[i+1]) record.address = cells[i+1].textContent.trim().replace(/\s+/g, ' ');
                }
            }

            // Extract Email if available in the text
            let emailMatch = htmlText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (emailMatch) {
                record.email = emailMatch[0];
            }

            // Determine Vehicle Type based on power units or table contents
            let pUnitsNum = parseInt(record.powerUnits) || 0;
            if (pUnitsNum > 0) {
                record.vehicleType = "Truck Tractors";
            } else {
                record.vehicleType = "Straight Trucks";
            }

            if (!record.status.toUpperCase().includes("AUTHORIZED") && !record.status.toUpperCase().includes("ACTIVE")) {
                // If you want all records, remove this check or keep as per filtering requirement.
            }

            return { status: "success", data: record };
        } catch (err) {
            attempt++;
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    return { status: "error" };
}

window.startScraping = async function() {
    const start = parseInt(document.getElementById('startMc').value);
    const end = parseInt(document.getElementById('endMc').value);
    let statusBox = document.getElementById('status');

    if (isNaN(start) || isNaN(end) || start > end) {
        if (statusBox) statusBox.innerText = "Please enter a valid MC range.";
        return;
    }

    scraping = true; 
    scrapedData = [];
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'inline-block';
    document.getElementById('downloadBtn').style.display = 'none';

    let totalProcessed = 0;

    for (let mc = start; mc <= end; mc++) {
        if (!scraping) break;
        let result = await processSingleMCWithDetailedError(mc);
        totalProcessed++;

        if (result.status === "success" && result.data) {
            let record = result.data;
            scrapedData.push(record);
            let currentIdx = scrapedData.length - 1;

            const tableBody = document.getElementById('resultsTable');
            if (totalProcessed === 1 && tableBody.innerHTML.includes('No data loaded')) tableBody.innerHTML = '';

            let newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><b>${record.mc}</b></td>
                <td>${record.usdot}</td>
                <td>${record.name}</td>
                <td>${record.entityType}</td>
                <td><span style="color:green; font-weight:bold;">${record.status}</span></td>
                ${buildPhoneCellMarkup(record.phone)}
                <td>${record.address}</td>
                ${buildEmailCellMarkup(record.email, record.name)}
                <td>${record.powerUnits}</td>
                <td>${record.vehicleType}</td>
                <td><textarea class="remarks-input-field" onchange="scrapedData[${currentIdx}].remarks = this.value">${record.remarks}</textarea></td>
                <td><button onclick="addLeadToFollowUpList(${currentIdx})" style="background:#ffc107; border:none; padding:5px 8px; font-weight:bold; cursor:pointer; border-radius:3px;">📅 Follow-Up</button></td>
            `;
            tableBody.appendChild(newRow);
        }
        await new Promise(r => setTimeout(r, 150));
    }

    scraping = false;
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'none';
    if(scrapedData.length > 0) document.getElementById('downloadBtn').style.display = 'inline-block';
};

window.downloadCSV = function() {
    if(scrapedData.length > 0) {
        let csv = "MC Number,USDOT,Company Name,Entity Type,Operating Status,Phone,Address,Email,Power Units,Vehicle Type,Remarks\n";
        scrapedData.forEach(r => {
            csv += `${r.mc},${r.usdot},"${r.name}","${r.entityType}","${r.status}","${r.phone}","${r.address}","${r.email}","${r.powerUnits}","${r.vehicleType}","${(r.remarks || '').replace(/\n/g, ' ')}"\n`;
        });
        let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        let link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `DispatchLink_Export.csv`;
        link.click();
    }
}
