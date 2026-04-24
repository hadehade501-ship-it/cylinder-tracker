// ====================================================================
// تطبيق بيت السلندر السوري - الإصدار السحابي (Firebase)
// ====================================================================

const firebaseConfig = {
  apiKey: "AIzaSyA2x1Oa1r4x03cJiGeCKpQPj_kwMns6-e0",
  authDomain: "cylinder-tracker-82dfb.firebaseapp.com",
  projectId: "cylinder-tracker-82dfb",
  storageBucket: "cylinder-tracker-82dfb.firebasestorage.app",
  messagingSenderId: "1076873817188",
  appId: "1:1076873817188:web:85e6ba88b89a4c602e0371"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

function formatDateTime(date) {
  if (!date) return '-';
  if (date.toDate) date = date.toDate();
  return new Date(date).toLocaleString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(minutes) {
  if (minutes < 60) return minutes + ' دقيقة';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' ساعة ' + (m > 0 ? 'و ' + m + ' دقيقة' : '');
}

function getMinutesDiff(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  if (startDate.toDate) startDate = startDate.toDate();
  if (endDate.toDate) endDate = endDate.toDate();
  return Math.floor((new Date(endDate) - new Date(startDate)) / 60000);
}

const app = {
  db: db,
  currentUser: null,
  currentRole: null,
  adminFilter: null,
  cylinders: [],
  workers: [],
  messages: [],
  adminData: { username: 'admin', password: '1234' },
  listeners: [],

  async loadCloudData() {
    const workersSnap = await getDocs(collection(db, 'workers'));
    this.workers = workersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const adminSnap = await getDocs(collection(db, 'admin'));
    if (!adminSnap.empty) {
      this.adminData = { id: adminSnap.docs[0].id, ...adminSnap.docs[0].data() };
    } else {
      await addDoc(collection(db, 'admin'), this.adminData);
    }
    
    const msgSnap = await getDocs(collection(db, 'messages'));
    this.messages = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const unsub = onSnapshot(collection(db, 'cylinders'), (snapshot) => {
      this.cylinders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      this.refreshCurrentView();
    });
    this.listeners.push(unsub);
    
    const unsubMsg = onSnapshot(collection(db, 'messages'), (snapshot) => {
      this.messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      this.refreshCurrentView();
    });
    this.listeners.push(unsubMsg);
    
    const unsubWorkers = onSnapshot(collection(db, 'workers'), (snapshot) => {
      this.workers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      this.refreshCurrentView();
    });
    this.listeners.push(unsubWorkers);
  },

  refreshCurrentView() {
    if (!this.currentRole) return;
    if (this.currentRole === 'admin') {
      const container = document.getElementById('admin-tabs-container');
      if (container.innerHTML) {
        const activeTab = document.querySelector('#admin-screen .tab-btn.active');
        if (activeTab) {
          const tabName = activeTab.textContent.includes('الإحصائيات') ? 'dashboard' :
                          activeTab.textContent.includes('سلندر جديد') ? 'addcylinder' :
                          activeTab.textContent.includes('السلندرات') ? 'managecylinders' :
                          activeTab.textContent.includes('العمال') ? 'workers' :
                          activeTab.textContent.includes('الرسائل') ? 'messages' :
                          activeTab.textContent.includes('الإعدادات') ? 'settings' : 'dashboard';
          container.innerHTML = '';
          this['render' + tabName.charAt(0).toUpperCase() + tabName.slice(1)](container);
        }
      }
    } else if (this.currentRole === 'worker') {
      const container = document.getElementById('worker-tabs-container');
      if (container.innerHTML) {
        const activeTab = document.querySelector('#worker-screen .tab-btn.active');
        if (activeTab) {
          const tabName = activeTab.textContent.includes('مهامي') ? 'WorkerTasks' : 'WorkerMessages';
          container.innerHTML = '';
          this['render' + tabName](container);
        }
      }
    }
  },

  async login() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const errorDiv = document.getElementById('login-error');
    if (!username || !password) { errorDiv.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور'; return; }
    
    await this.loadCloudData();
    
    if (this.currentRole === 'manager') {
      if (username === this.adminData.username && password === this.adminData.password) {
        this.currentUser = { username: username, role: 'admin' };
        this.currentRole = 'admin';
        this.showAdminScreen();
        errorDiv.textContent = '';
      } else { errorDiv.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة للمدير'; }
    } else {
      const worker = this.workers.find(w => w.username === username && w.password === password);
      if (worker) {
        this.currentUser = { ...worker, role: 'worker' };
        this.currentRole = 'worker';
        this.showWorkerScreen();
        errorDiv.textContent = '';
      } else { errorDiv.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة للعامل'; }
    }
  },

  selectRole(role) {
    this.currentRole = role;
    document.getElementById('manager-role-btn').classList.remove('active');
    document.getElementById('worker-role-btn').classList.remove('active');
    if (role === 'manager') {
      document.getElementById('manager-role-btn').classList.add('active');
      document.getElementById('username-input').placeholder = 'اسم المستخدم (admin)';
    } else {
      document.getElementById('worker-role-btn').classList.add('active');
      document.getElementById('username-input').placeholder = 'اسم المستخدم';
    }
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
  },

  logout() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
    this.currentUser = null;
    this.currentRole = null;
    this.adminFilter = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById('login-screen').classList.add('active-screen');
    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
  },

  showAdminScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('admin-screen').classList.add('active-screen');
    document.getElementById('worker-screen').classList.remove('active-screen');
    document.getElementById('admin-name-display').textContent = '👔 ' + this.currentUser.username;
    this.switchTab('dashboard');
  },

  showWorkerScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('worker-screen').classList.add('active-screen');
    document.getElementById('admin-screen').classList.remove('active-screen');
    document.getElementById('worker-name-display').textContent = '👷 ' + this.currentUser.username;
    this.switchWorkerTab('my-tasks');
  },

  switchTab(tabName) {
    document.querySelectorAll('#admin-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    document.getElementById('admin-tabs-container').innerHTML = '';
    this.adminFilter = null;
    const methodName = 'render' + tabName.charAt(0).toUpperCase() + tabName.slice(1).replace(/-/g, '');
    if (this[methodName]) this[methodName](document.getElementById('admin-tabs-container'));
  },

  switchWorkerTab(tabName) {
    document.querySelectorAll('#worker-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    document.getElementById('worker-tabs-container').innerHTML = '';
    if (tabName === 'my-tasks') this.renderWorkerTasks(document.getElementById('worker-tabs-container'));
    else this.renderWorkerMessages(document.getElementById('worker-tabs-container'));
  },

  isDelayed(cyl) {
    if (cyl.status !== 'active') return false;
    if (cyl.currentStepIndex >= cyl.steps.length) return false;
    if (!cyl.stepStartTime) return false;
    const now = new Date();
    const start = cyl.stepStartTime.toDate ? cyl.stepStartTime.toDate() : new Date(cyl.stepStartTime);
    const diffHours = (now - start) / (1000 * 60 * 60);
    return diffHours >= 24;
  },

  setFilterAndRefresh(filter) {
    this.adminFilter = this.adminFilter === filter ? null : filter;
    this.renderDashboard(document.getElementById('admin-tabs-container'));
  },

  renderDashboard(container) {
    const allActive = this.cylinders.filter(c => c.status === 'active');
    const activeCount = allActive.filter(c => c.currentStepIndex < c.steps.length).length;
    const completedCount = allActive.filter(c => c.currentStepIndex >= c.steps.length).length;
    const rejected = this.cylinders.filter(c => c.status === 'rejected').length;
    const delivered = this.cylinders.filter(c => c.status === 'delivered').length;
    const delayed = this.cylinders.filter(c => this.isDelayed(c)).length;
    
    let tableData = [];
    let tableTitle = 'جميع السلندرات';
    
    switch(this.adminFilter) {
      case 'active': tableData = allActive; tableTitle = '🟢 السلندرات قيد العمل'; break;
      case 'delayed': tableData = this.cylinders.filter(c => this.isDelayed(c)); tableTitle = '⏰ السلندرات المتأخرة (+24 ساعة)'; break;
      case 'completed': tableData = this.cylinders.filter(c => c.status === 'active' && c.currentStepIndex >= c.steps.length); tableTitle = '✅ سلندرات مكتملة بانتظار التسليم'; break;
      case 'rejected': tableData = this.cylinders.filter(c => c.status === 'rejected'); tableTitle = '🔴 السلندرات المرفوضة'; break;
      case 'delivered': tableData = this.cylinders.filter(c => c.status === 'delivered'); tableTitle = '📦 السلندرات المسلّمة'; break;
      default: tableData = this.cylinders; tableTitle = '📋 جميع السلندرات';
    }
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:15px;">
        <div style="display:flex;gap:8px;">
          <input type="text" id="quickSearch" placeholder="🔍 بحث سريع برقم السلندر..." style="flex:1;" onkeypress="if(event.key==='Enter')app.quickSearch()">
          <button class="btn primary-btn" onclick="app.quickSearch()" style="width:auto;">بحث</button>
        </div>
        <div id="quickSearchResult" style="margin-top:8px;"></div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-box${this.adminFilter === 'active' ? ' active-filter' : ''}" onclick="app.setFilterAndRefresh('active')" style="cursor:pointer;">
          <div class="number">${activeCount}</div>
          <div class="label">🟢 قيد العمل</div>
        </div>
        <div class="stat-box${this.adminFilter === 'delayed' ? ' active-filter' : ''}" onclick="app.setFilterAndRefresh('delayed')" style="cursor:pointer;${delayed > 0 ? 'border:2px solid var(--danger);' : ''}">
          <div class="number" style="${delayed > 0 ? 'color:var(--danger);' : ''}">${delayed}</div>
          <div class="label">⏰ متأخر +24س</div>
        </div>
        <div class="stat-box${this.adminFilter === 'completed' ? ' active-filter' : ''}" onclick="app.setFilterAndRefresh('completed')" style="cursor:pointer;">
          <div class="number">${completedCount}</div>
          <div class="label">✅ مكتمل</div>
        </div>
        <div class="stat-box${this.adminFilter === 'rejected' ? ' active-filter' : ''}" onclick="app.setFilterAndRefresh('rejected')" style="cursor:pointer;">
          <div class="number">${rejected}</div>
          <div class="label">🔴 مرفوض</div>
        </div>
        <div class="stat-box${this.adminFilter === 'delivered' ? ' active-filter' : ''}" onclick="app.setFilterAndRefresh('delivered')" style="cursor:pointer;">
          <div class="number">${delivered}</div>
          <div class="label">📦 مسلَّم</div>
        </div>
        <div class="stat-box" style="cursor:default;">
          <div class="number">${this.workers.length}</div>
          <div class="label">👥 العمال</div>
        </div>
      </div>
      
      <div class="card">
        <h3>${tableTitle} (${tableData.length})</h3>
        ${this.adminFilter ? '<button class="btn small-btn" onclick="app.setFilterAndRefresh(\''+this.adminFilter+'\')" style="margin-bottom:10px;">❌ إلغاء الفلتر</button>' : ''}
        ${tableData.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد نتائج</p>'
          : `<div style="overflow-x:auto;">
              <table class="data-table">
                <thead><tr><th>الكود</th><th>النوع</th><th>الزبون</th><th>المرحلة</th><th>الحالة</th><th>الوقت</th><th>إجراءات</th></tr></thead>
                <tbody>
                  ${[...tableData].reverse().map(c => this.renderCylinderRow(c)).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  },

  renderCylinderRow(c) {
    let info = '';
    let rowBg = '';
    if (this.isDelayed(c)) {
      rowBg = 'background:rgba(233,69,96,0.15);';
      info = ' ⏰ متأخر';
    }
    if (c.status === 'rejected' && c.defectHistory && c.defectHistory.length > 0) {
      const last = c.defectHistory[c.defectHistory.length - 1];
      info += `<br><small style="color:var(--danger);">⚠️ ${last.reason} | العودة: ${last.returnTo}</small>`;
    }
    const timeText = c.stepStartTime ? this.getDelayText(c) : '-';
    return `<tr style="${rowBg}">
      <td><strong>${c.code}</strong>${info}</td>
      <td>${c.type === 'iron' ? 'حديد' : 'كروم'}</td>
      <td>${c.client}</td>
      <td>${c.currentStepIndex < c.steps.length ? c.steps[c.currentStepIndex] : 'مكتمل'}</td>
      <td><span class="badge badge-${c.status}">${this.getStatusText(c.status)}</span></td>
      <td style="font-size:0.75em;">${timeText}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn small-btn" onclick="app.printCard('${c.id}')" style="color:var(--gold);border-color:var(--gold);">🖨️</button>
        ${c.status === 'active' && c.currentStepIndex >= c.steps.length ? `<button class="btn small-btn" onclick="app.deliverCylinderPrompt('${c.id}')" style="color:var(--gold);border-color:var(--gold);">📦 تسليم</button>` : ''}
        <button class="btn small-btn" onclick="app.deleteCylinder('${c.id}')" style="color:var(--danger);border-color:var(--danger);">🗑️</button>
      </td>
    </tr>`;
  },

  getDelayText(cyl) {
    if (!cyl.stepStartTime) return '';
    const start = cyl.stepStartTime.toDate ? cyl.stepStartTime.toDate() : new Date(cyl.stepStartTime);
    const now = new Date();
    const diffMinutes = getMinutesDiff(start, now);
    return 'بدأت منذ: ' + formatDuration(diffMinutes);
  },

  quickSearch() {
    const query = document.getElementById('quickSearch').value.trim();
    const resultDiv = document.getElementById('quickSearchResult');
    if (!query) { resultDiv.innerHTML = ''; return; }
    const found = this.cylinders.filter(c => 
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      (c.client && c.client.toLowerCase().includes(query.toLowerCase()))
    );
    if (found.length === 0) {
      resultDiv.innerHTML = '<p style="color:var(--danger);text-align:center;">❌ لا توجد نتائج</p>';
    } else {
      resultDiv.innerHTML = found.map(c => `
        <div style="background:#1a1a3e;padding:10px;border-radius:8px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${c.code}</strong> | ${c.client || ''} | ${this.getStatusText(c.status)}</div>
          <button class="btn small-btn" onclick="app.printCard('${c.id}')" style="color:var(--gold);border-color:var(--gold);">🖨️</button>
        </div>
      `).join('');
    }
  },

  getStatusText(status) {
    switch(status) {
      case 'active': return 'نشط';
      case 'rejected': return 'مرفوض';
      case 'delivered': return 'مُسلَّم';
      default: return status;
    }
  },

  renderAddcylinder(container) {
    container.innerHTML = `
      <div class="card">
        <h3>➕ إضافة سلندر جديد</h3>
        <div class="input-group">
          <select id="cyl-type">
            <option value="iron">🟤 سلندر حديد (10 مراحل)</option>
            <option value="chrome">🪞 سلندر كروم (9 مراحل)</option>
          </select>
          <input type="text" id="cyl-code" placeholder="الكود المنقوش (يدوياً)">
          <input type="text" id="cyl-client" placeholder="اسم المطبعة أو الزبون">
          <input type="text" id="cyl-print" placeholder="نوع الطبعة">
          <input type="date" id="cyl-date">
          <textarea id="cyl-notes" placeholder="ملاحظات (اختياري)"></textarea>
        </div>
        <button class="btn primary-btn full-width" onclick="app.addNewCylinder()">إضافة السلندر</button>
        <div id="add-cyl-error" class="error-message"></div>
      </div>
    `;
  },

  async addNewCylinder() {
    const type = document.getElementById('cyl-type').value;
    const code = document.getElementById('cyl-code').value.trim();
    const client = document.getElementById('cyl-client').value.trim();
    const print = document.getElementById('cyl-print').value.trim();
    const date = document.getElementById('cyl-date').value;
    const notes = document.getElementById('cyl-notes').value.trim();
    const errorDiv = document.getElementById('add-cyl-error');
    if (!code || !client || !print) { errorDiv.textContent = '❌ الكود واسم المطبعة ونوع الطبعة حقول إجبارية'; return; }
    
    const ironSteps = ['مخارط', 'بوليش تلبيس', 'أحواض نيكل', 'أحواض نحاس', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    const chromeSteps = ['أحواض ديكروم', 'بوليش تلبيس', 'أحواض', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    
    const newCylinder = {
      code, type, client, print, date, notes,
      steps: type === 'iron' ? ironSteps : chromeSteps,
      currentStepIndex: 0, status: 'active', rejectedReason: '',
      completedSteps: [], stepStartTime: serverTimestamp(),
      assignedWorker: null, deliveredTo: '', deliveredDate: null,
      createdAt: serverTimestamp(), notifiedComplete: false, defectHistory: []
    };
    
    await addDoc(collection(db, 'cylinders'), newCylinder);
    document.getElementById('cyl-code').value = '';
    document.getElementById('cyl-client').value = '';
    document.getElementById('cyl-print').value = '';
    document.getElementById('cyl-notes').value = '';
    errorDiv.textContent = '';
    alert('✅ تم إضافة السلندر بنجاح: ' + code);
  },

  async deleteCylinder(cylId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا السلندر؟')) return;
    await deleteDoc(doc(db, 'cylinders', cylId));
  },

  renderManagecylinders(container) {
    container.innerHTML = `
      <div class="card">
        <h3>📋 جميع السلندرات</h3>
        ${this.cylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد سلندرات</p>'
          : `<div style="overflow-x:auto;">
              <table class="data-table">
                <thead><tr><th>الكود</th><th>النوع</th><th>الزبون</th><th>المرحلة</th><th>الحالة</th><th>الوقت</th><th>إجراءات</th></tr></thead>
                <tbody>${[...this.cylinders].reverse().map(c => this.renderCylinderRow(c)).join('')}</tbody>
              </table>
            </div>`
        }
      </div>
    `;
  },

  async deliverCylinderPrompt(cylId) {
    const c = this.cylinders.find(c => c.id === cylId);
    if (!c) return;
    const recipient = prompt('اسم المستلم:');
    if (!recipient || !recipient.trim()) return;
    await updateDoc(doc(db, 'cylinders', cylId), {
      status: 'delivered',
      deliveredTo: recipient.trim(),
      deliveredDate: serverTimestamp()
    });
    alert(`✅ تم تسليم السلندر ${c.code} إلى ${recipient}`);
  },

  printCard(cylId) {
    const c = this.cylinders.find(c => c.id === cylId);
    if (!c) return;
    
    const allSteps = c.steps.map((step, index) => {
      let status = '⏳ متبقي', bg = '#fff3cd', worker = '-', startTime = '-', endTime = '-', duration = '-';
      if (index < c.currentStepIndex) {
        const done = c.completedSteps.find(s => s.step === step);
        status = '✅ منجز'; bg = '#d4edda';
        worker = done ? done.worker : '-';
        startTime = done ? formatDateTime(done.startTime) : '-';
        endTime = done ? formatDateTime(done.endTime) : '-';
        if (done && done.startTime && done.endTime) duration = formatDuration(getMinutesDiff(done.startTime, done.endTime));
      } else if (index === c.currentStepIndex && c.status === 'active') {
        status = '🔄 الحالية'; bg = '#cce5ff';
        startTime = c.stepStartTime ? formatDateTime(c.stepStartTime) : '-';
      } else if (c.status === 'rejected' && index === c.currentStepIndex) {
        status = '❌ مرفوضة'; bg = '#f8d7da';
      }
      return { step, status, bg, worker, startTime, endTime, duration };
    });
    
    const stepsHTML = allSteps.map(s => `
      <tr style="background:${s.bg};"><td>${s.step}</td><td>${s.status}</td><td>${s.worker}</td><td>${s.startTime}</td><td>${s.endTime}</td><td>${s.duration}</td></tr>
    `).join('');
    
    const w = window.open('', '_blank', 'width=800,height=700');
    w.document.write(`<html dir="rtl"><head><title>بطاقة ${c.code}</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        body{font-family:'Cairo',sans-serif;padding:20px;color:#1a1a2e;max-width:800px;margin:auto;font-size:0.9em;}
        .header{text-align:center;border-bottom:4px solid #e2a629;padding-bottom:15px;margin-bottom:20px;}
        .header h1{color:#1a1a2e;margin:0;font-size:1.5em;}.header .sub{color:#e2a629;font-weight:700;}
        .code-big{font-size:1.6em;font-weight:900;background:#1a1a2e;color:#e2a629;padding:10px 20px;border-radius:10px;display:inline-block;margin:10px 0;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f5f5f5;padding:15px;border-radius:10px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;margin-top:15px;font-size:0.8em;}
        th{background:#1a1a2e;color:#fff;padding:8px;}td{padding:7px;border:1px solid #ddd;text-align:center;}
        .btn-print{background:#e2a629;color:#1a1a2e;padding:12px 35px;border:none;border-radius:10px;font-weight:700;cursor:pointer;margin:20px auto;display:block;font-family:'Cairo',sans-serif;}
        @media print{.btn-print{display:none;}}</style></head><body>
        <div class="header"><h1>⚙️ بيت السلندر السوري</h1><p class="sub">بطاقة تشغيل سلندر</p></div>
        <div style="text-align:center;"><div class="code-big">${c.code}</div></div>
        <div class="info-grid">
          <p><strong>📦 النوع:</strong> ${c.type==='iron'?'حديد (10 مراحل)':'كروم (9 مراحل)'}</p>
          <p><strong>🏢 الزبون:</strong> ${c.client}</p>
          <p><strong>🖨️ الطبعة:</strong> ${c.print}</p>
          <p><strong>📅 تاريخ الدخول:</strong> ${formatDateTime(c.createdAt)}</p>
          <p><strong>📊 الحالة:</strong> ${this.getStatusText(c.status)}</p>
          <p><strong>📝 ملاحظات:</strong> ${c.notes||'-'}</p>
        </div>
        <h4 style="color:#e2a629;">📋 المراحل مع التوقيت:</h4>
        <table><thead><tr><th>المرحلة</th><th>الحالة</th><th>العامل</th><th>البداية</th><th>النهاية</th><th>المدة</th></tr></thead><tbody>${stepsHTML}</tbody></table>
        <button class="btn-print" onclick="window.print()">🖨️ طباعة</button></body></html>`);
    w.document.close();
  },

  renderWorkers(container) {
    container.innerHTML = `
      <div class="card">
        <h3>👥 قائمة العمال</h3>
        ${this.workers.map(w => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #333;">
            <span>👷 <strong>${w.username}</strong></span>
            <div style="display:flex;gap:6px;">
              <button class="btn small-btn" onclick="app.editWorker('${w.id}')" style="color:var(--gold);border-color:var(--gold);">✏️ تعديل</button>
              <button class="btn small-btn" onclick="app.deleteWorker('${w.id}')">🗑️ حذف</button>
            </div>
          </div>
        `).join('')}
        <hr style="margin:15px 0;border-color:#333;">
        <h4>➕ إضافة عامل جديد</h4>
        <div class="input-group">
          <input type="text" id="new-worker-name" placeholder="اسم العامل">
          <input type="password" id="new-worker-pass" placeholder="كلمة المرور">
        </div>
        <button class="btn primary-btn full-width" onclick="app.addWorker()">إضافة عامل</button>
        <div id="edit-worker-form" style="display:none;margin-top:15px;">
          <hr><h4>✏️ تعديل العامل</h4>
          <input type="hidden" id="edit-worker-id">
          <div class="input-group">
            <input type="text" id="edit-worker-name" placeholder="الاسم الجديد">
            <input type="password" id="edit-worker-pass" placeholder="كلمة مرور جديدة">
          </div>
          <button class="btn primary-btn full-width" onclick="app.saveWorkerEdit()">💾 حفظ</button>
        </div>
      </div>
    `;
  },

  async addWorker() {
    const name = document.getElementById('new-worker-name').value.trim();
    const pass = document.getElementById('new-worker-pass').value.trim();
    if (!name || !pass) { alert('❌ الرجاء إدخال اسم وكلمة مرور'); return; }
    await addDoc(collection(db, 'workers'), { username: name, password: pass });
    alert('✅ تم إضافة العامل');
  },

  editWorker(workerId) {
    const w = this.workers.find(x => x.id === workerId);
    if (!w) return;
    document.getElementById('edit-worker-id').value = workerId;
    document.getElementById('edit-worker-name').value = w.username;
    document.getElementById('edit-worker-pass').value = '';
    document.getElementById('edit-worker-form').style.display = 'block';
  },

  async saveWorkerEdit() {
    const id = document.getElementById('edit-worker-id').value;
    const name = document.getElementById('edit-worker-name').value.trim();
    const pass = document.getElementById('edit-worker-pass').value.trim();
    if (!name) { alert('❌ أدخل اسماً'); return; }
    const update = { username: name };
    if (pass) update.password = pass;
    await updateDoc(doc(db, 'workers', id), update);
    alert('✅ تم التعديل');
  },

  async deleteWorker(workerId) {
    if (!confirm('متأكد من حذف العامل؟')) return;
    await deleteDoc(doc(db, 'workers', workerId));
  },

  renderMessages(container) {
    container.innerHTML = `
      <div class="card">
        <h3>📩 إرسال رسالة</h3>
        <div class="input-group">
          <select id="msg-worker-select">${this.workers.map(w => `<option value="${w.id}">${w.username}</option>`).join('')}</select>
          <textarea id="msg-text" placeholder="نص الرسالة..."></textarea>
        </div>
        <button class="btn primary-btn full-width" onclick="app.sendMessage()">إرسال</button>
      </div>
    `;
  },

  async sendMessage() {
    const to = document.getElementById('msg-worker-select').value;
    const text = document.getElementById('msg-text').value.trim();
    if (!text) return;
    await addDoc(collection(db, 'messages'), { from: 'admin', to, text, received: false, date: serverTimestamp() });
    document.getElementById('msg-text').value = '';
    alert('✅ تم الإرسال');
  },

  renderSettings(container) {
    container.innerHTML = `
      <div class="card">
        <h3>⚙️ تغيير كلمة مرور المدير</h3>
        <div class="input-group">
          <input type="password" id="old-admin-pass" placeholder="القديمة">
          <input type="password" id="new-admin-pass" placeholder="الجديدة">
        </div>
        <button class="btn primary-btn full-width" onclick="app.changeAdminPassword()">💾 حفظ</button>
      </div>
    `;
  },

  async changeAdminPassword() {
    const old = document.getElementById('old-admin-pass').value.trim();
    const nw = document.getElementById('new-admin-pass').value.trim();
    if (old !== this.adminData.password) { alert('❌ كلمة مرور قديمة خاطئة'); return; }
    if (!nw || nw.length < 3) { alert('❌ كلمة مرور قصيرة'); return; }
    await updateDoc(doc(db, 'admin', this.adminData.id), { password: nw });
    this.adminData.password = nw;
    alert('✅ تم التغيير');
  },

  renderWorkerTasks(container) {
    const myCylinders = this.cylinders.filter(c => c.status === 'active' && c.currentStepIndex < c.steps.length);
    const myCompleted = this.cylinders.filter(c => c.status === 'active' && c.currentStepIndex >= c.steps.length);
    
    container.innerHTML = `
      ${myCompleted.length > 0 ? `
        <div class="card" style="border-right:4px solid var(--success);margin-bottom:15px;">
          <h3 style="color:var(--success);">✅ سلندرات مكتملة بانتظار التسليم</h3>
          ${myCompleted.map(c => `<p>• <strong>${c.code}</strong> - ${c.client}</p>`).join('')}
        </div>
      ` : ''}
      
      <div class="card">
        <h3>🔧 السلندرات قيد العمل</h3>
        ${myCylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد سلندرات نشطة</p>'
          : myCylinders.map(c => {
            const delayed = this.isDelayed(c);
            return `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;${delayed ? 'border-right:4px solid var(--danger);' : ''}">
              <div style="display:flex;justify-content:space-between;">
                <strong>${c.code}</strong>
                <span>${c.type === 'iron' ? 'حديد' : 'كروم'} | ${c.client}</span>
              </div>
              <div style="margin-top:8px;color:var(--gold);">المرحلة: ${c.steps[c.currentStepIndex]}</div>
              ${c.stepStartTime ? `<div style="color:#888;font-size:0.8em;">${this.getDelayText(c)}</div>` : ''}
              ${delayed ? '<div style="color:var(--danger);">⚠️ متأخر</div>' : ''}
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn primary-btn" onclick="app.nextStepForWorker('${c.id}')" style="flex:1;">✅ إنجاز</button>
                <button class="btn small-btn" onclick="app.workerGoBack('${c.id}')" style="flex:1;">⬅️ رجوع</button>
                <button class="btn small-btn" onclick="app.reportDefectPrompt('${c.id}')" style="flex:1;background:var(--danger);color:white;">⚠️ عيب</button>
              </div>
            </div>
          `}).join('')
        }
      </div>
    `;
  },

  async nextStepForWorker(cylId) {
    const cyl = this.cylinders.find(c => c.id === cylId);
    if (!cyl || cyl.currentStepIndex >= cyl.steps.length) return;
    const now = new Date().toISOString();
    const completedSteps = [...(cyl.completedSteps || [])];
    completedSteps.push({ step: cyl.steps[cyl.currentStepIndex], worker: this.currentUser.username, startTime: cyl.stepStartTime || now, endTime: now });
    const newIndex = cyl.currentStepIndex + 1;
    const update = { completedSteps, currentStepIndex: newIndex, notifiedComplete: false };
    if (newIndex < cyl.steps.length) update.stepStartTime = new Date().toISOString();
    else update.stepStartTime = null;
    await updateDoc(doc(db, 'cylinders', cylId), update);
  },

  async workerGoBack(cylId) {
    const cyl = this.cylinders.find(c => c.id === cylId);
    if (!cyl || cyl.currentStepIndex <= 0) { alert('لا يمكن الرجوع'); return; }
    const completedSteps = [...(cyl.completedSteps || [])];
    completedSteps.pop();
    await updateDoc(doc(db, 'cylinders', cylId), { currentStepIndex: cyl.currentStepIndex - 1, completedSteps, stepStartTime: new Date().toISOString() });
  },

  reportDefectPrompt(cylId) {
    const cyl = this.cylinders.find(c => c.id === cylId);
    if (!cyl) return;
    const reason = prompt('🔴 سبب الرفض:');
    if (!reason || !reason.trim()) return;
    const stepsList = cyl.steps.map((s, i) => `${i}: ${s}`).join('\n');
    const returnIndex = prompt(`📋 اختر رقم المرحلة للعودة:\n\n${stepsList}`);
    if (returnIndex === null) return;
    const idx = parseInt(returnIndex);
    if (isNaN(idx) || idx < 0 || idx >= cyl.steps.length) { alert('❌ رقم خطأ'); return; }
    const now = formatDateTime(new Date());
    const defectHistory = [...(cyl.defectHistory || []), { reason: reason.trim(), returnTo: cyl.steps[idx], worker: this.currentUser.username, date: now }];
    const completedSteps = (cyl.completedSteps || []).filter(s => cyl.steps.indexOf(s.step) < idx);
    updateDoc(doc(db, 'cylinders', cylId), { defectHistory, rejectedReason: reason.trim(), currentStepIndex: idx, status: 'active', completedSteps, stepStartTime: new Date().toISOString() })
      .then(() => alert(`✅ تم إعادة السلندر إلى "${cyl.steps[idx]}"`));
  },

  renderWorkerMessages(container) {
    const myMessages = this.messages.filter(m => m.to === this.currentUser.id);
    container.innerHTML = `
      <div class="card">
        <h3>📥 الرسائل الواردة</h3>
        ${myMessages.length === 0 
          ? '<p style="color:#888;">لا توجد رسائل</p>'
          : myMessages.map(m => `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;border-right:3px solid ${m.received ? 'var(--success)' : 'var(--gold)'};">
              <p>${m.text}</p>
              <small>${m.date ? formatDateTime(m.date) : ''}</small>
              ${!m.received ? `<button class="btn small-btn" onclick="app.confirmReceipt('${m.id}')" style="color:var(--gold);border-color:var(--gold);">✅ تم الاستلام</button>` : '<span style="color:var(--success);">✓ تم</span>'}
            </div>
          `).join('')
        }
      </div>
    `;
  },

  async confirmReceipt(msgId) {
    await updateDoc(doc(db, 'messages', msgId), { received: true });
  }
};

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('login-screen').classList.add('active-screen');
  document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') app.login();
  });
  app.selectRole('manager');
});
