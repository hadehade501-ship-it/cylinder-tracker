// ==========================================
// تطبيق بيت السلندر السوري - MVP نهائي
// مع سجل الرفض في بطاقة الطباعة
// ==========================================

const DEFAULT_DATA = {
  admin: { username: 'admin', password: '1234' },
  workers: [
    { id: 'w1', username: 'علي', password: '1111' },
    { id: 'w2', username: 'محمد', password: '2222' }
  ],
  cylinders: [],
  messages: [],
  nextCylinderId: 1
};

function loadData() {
  let data = localStorage.getItem('cylinderAppData');
  if (!data) {
    localStorage.setItem('cylinderAppData', JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  return JSON.parse(data);
}

function saveData(data) {
  localStorage.setItem('cylinderAppData', JSON.stringify(data));
}

function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('ar-SY');
}

function formatDuration(minutes) {
  if (minutes < 60) return minutes + ' دقيقة';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' ساعة ' + (m > 0 ? 'و ' + m + ' دقيقة' : '');
}

function getMinutesDiff(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return Math.floor((new Date(endDate) - new Date(startDate)) / 60000);
}

const app = {
  data: loadData(),
  currentUser: null,
  currentRole: null,
  adminFilter: null,

  login() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const errorDiv = document.getElementById('login-error');
    if (!username || !password) { errorDiv.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور'; return; }
    if (this.currentRole === 'manager') {
      if (username === this.data.admin.username && password === this.data.admin.password) {
        this.currentUser = { username: username, role: 'admin' };
        this.currentRole = 'admin';
        this.showAdminScreen();
        errorDiv.textContent = '';
      } else { errorDiv.textContent = '❌ خطأ في المدير'; }
    } else {
      const worker = this.data.workers.find(w => w.username === username && w.password === password);
      if (worker) {
        this.currentUser = { ...worker, role: 'worker' };
        this.currentRole = 'worker';
        this.showWorkerScreen();
        errorDiv.textContent = '';
      } else { errorDiv.textContent = '❌ خطأ في العامل'; }
    }
  },

  selectRole(role) {
    this.currentRole = role;
    document.getElementById('manager-role-btn').classList.remove('active');
    document.getElementById('worker-role-btn').classList.remove('active');
    if (role === 'manager') { document.getElementById('manager-role-btn').classList.add('active'); }
    else { document.getElementById('worker-role-btn').classList.add('active'); }
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
  },

  logout() {
    this.currentUser = null;
    this.currentRole = null;
    this.adminFilter = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById('login-screen').classList.add('active-screen');
    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
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
    if (tabName === 'dashboard') this.renderDashboard(document.getElementById('admin-tabs-container'));
    if (tabName === 'add-cylinder') this.renderAddcylinder(document.getElementById('admin-tabs-container'));
    if (tabName === 'manage-cylinders') this.renderManagecylinders(document.getElementById('admin-tabs-container'));
    if (tabName === 'workers') this.renderWorkers(document.getElementById('admin-tabs-container'));
    if (tabName === 'messages') this.renderMessages(document.getElementById('admin-tabs-container'));
    if (tabName === 'settings') this.renderSettings(document.getElementById('admin-tabs-container'));
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
    const start = new Date(cyl.stepStartTime);
    const diffHours = (now - start) / (1000 * 60 * 60);
    return diffHours >= 24;
  },

  renderDashboard(container) {
    const allActive = this.data.cylinders.filter(c => c.status === 'active');
    const activeCount = allActive.filter(c => c.currentStepIndex < c.steps.length).length;
    const completedCount = allActive.filter(c => c.currentStepIndex >= c.steps.length).length;
    const rejected = this.data.cylinders.filter(c => c.status === 'rejected').length;
    const delivered = this.data.cylinders.filter(c => c.status === 'delivered').length;
    const delayed = this.data.cylinders.filter(c => this.isDelayed(c)).length;
    
    let tableData = this.data.cylinders;
    let tableTitle = 'جميع السلندرات';
    
    if (this.adminFilter === 'active') { tableData = allActive; tableTitle = '🟢 قيد العمل'; }
    if (this.adminFilter === 'delayed') { tableData = this.data.cylinders.filter(c => this.isDelayed(c)); tableTitle = '⏰ متأخر'; }
    if (this.adminFilter === 'completed') { tableData = this.data.cylinders.filter(c => c.status === 'active' && c.currentStepIndex >= c.steps.length); tableTitle = '✅ مكتمل'; }
    if (this.adminFilter === 'rejected') { tableData = this.data.cylinders.filter(c => c.status === 'rejected'); tableTitle = '🔴 مرفوض'; }
    if (this.adminFilter === 'delivered') { tableData = this.data.cylinders.filter(c => c.status === 'delivered'); tableTitle = '📦 مسلَّم'; }
    
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-box" onclick="app.adminFilter='active';app.renderDashboard(document.getElementById('admin-tabs-container'))"><div class="number">${activeCount}</div><div class="label">🟢 قيد</div></div>
        <div class="stat-box" onclick="app.adminFilter='delayed';app.renderDashboard(document.getElementById('admin-tabs-container'))"><div class="number" style="${delayed>0?'color:red':''}">${delayed}</div><div class="label">⏰ متأخر</div></div>
        <div class="stat-box" onclick="app.adminFilter='completed';app.renderDashboard(document.getElementById('admin-tabs-container'))"><div class="number">${completedCount}</div><div class="label">✅ مكتمل</div></div>
        <div class="stat-box" onclick="app.adminFilter='rejected';app.renderDashboard(document.getElementById('admin-tabs-container'))"><div class="number">${rejected}</div><div class="label">🔴 مرفوض</div></div>
        <div class="stat-box" onclick="app.adminFilter='delivered';app.renderDashboard(document.getElementById('admin-tabs-container'))"><div class="number">${delivered}</div><div class="label">📦 مسلَّم</div></div>
        <div class="stat-box"><div class="number">${this.data.workers.length}</div><div class="label">👥 عمال</div></div>
      </div>
      <div class="card">
        <h3>${tableTitle} (${tableData.length})</h3>
        ${this.adminFilter ? '<button class="btn small-btn" onclick="app.adminFilter=null;app.renderDashboard(document.getElementById(\'admin-tabs-container\'))">❌ إلغاء</button>' : ''}
        ${tableData.length === 0 ? '<p style="color:#888;">لا يوجد</p>' : `
          <table class="data-table">
            <thead><tr><th>الكود</th><th>النوع</th><th>الزبون</th><th>المرحلة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>${[...tableData].reverse().map(c => `
              <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.type==='iron'?'حديد':'كروم'}</td>
                <td>${c.client}</td>
                <td>${c.currentStepIndex < c.steps.length ? c.steps[c.currentStepIndex] : 'مكتمل'}</td>
                <td><span class="badge badge-${c.status}">${c.status==='active'?'نشط':c.status==='rejected'?'مرفوض':'مُسلَّم'}</span></td>
                <td>
                  <button class="btn small-btn" onclick="app.printCard(${c.id})" style="color:gold;border-color:gold;">🖨️</button>
                  ${c.status==='active' && c.currentStepIndex >= c.steps.length ? `<button class="btn small-btn" onclick="app.deliverCylinderPrompt(${c.id})" style="color:gold;border-color:gold;">📦</button>` : ''}
                  <button class="btn small-btn" onclick="app.deleteCylinder(${c.id})" style="color:red;border-color:red;">🗑️</button>
                </td>
              </tr>
            `).join('')}</tbody>
          </table>
        `}
      </div>
    `;
  },

  renderAddcylinder(container) {
    container.innerHTML = `
      <div class="card"><h3>➕ إضافة سلندر</h3>
        <select id="cyl-type"><option value="iron">حديد</option><option value="chrome">كروم</option></select>
        <input type="text" id="cyl-code" placeholder="الكود">
        <input type="text" id="cyl-client" placeholder="المطبعة">
        <input type="text" id="cyl-print" placeholder="الطبعة">
        <button class="btn primary-btn full-width" onclick="app.addNewCylinder()">إضافة</button>
      </div>
    `;
  },

  addNewCylinder() {
    const type = document.getElementById('cyl-type').value;
    const code = document.getElementById('cyl-code').value.trim();
    const client = document.getElementById('cyl-client').value.trim();
    const print = document.getElementById('cyl-print').value.trim();
    if (!code || !client || !print) { alert('كل الحقول مطلوبة'); return; }
    const ironSteps = ['مخارط', 'بوليش تلبيس', 'أحواض نيكل', 'أحواض نحاس', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    const chromeSteps = ['أحواض ديكروم', 'بوليش تلبيس', 'أحواض', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    this.data.cylinders.push({
      id: this.data.nextCylinderId++, code, type, client, print,
      steps: type === 'iron' ? ironSteps : chromeSteps,
      currentStepIndex: 0, status: 'active', stepStartTime: new Date().toISOString(),
      completedSteps: [], createdAt: new Date().toISOString(), defectHistory: []
    });
    saveData(this.data);
    alert('✅ تم: ' + code);
    this.switchTab('dashboard');
  },

  deleteCylinder(cylId) {
    if (!confirm('حذف؟')) return;
    this.data.cylinders = this.data.cylinders.filter(c => c.id !== cylId);
    saveData(this.data);
    this.renderDashboard(document.getElementById('admin-tabs-container'));
  },

  renderManagecylinders(container) {
    this.renderDashboard(container);
  },

  deliverCylinderPrompt(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c) return;
    const name = prompt('اسم المستلم:');
    if (!name) return;
    c.status = 'delivered';
    c.deliveredTo = name;
    c.deliveredDate = new Date().toISOString();
    saveData(this.data);
    alert('✅ تم التسليم');
    this.renderDashboard(document.getElementById('admin-tabs-container'));
  },

  // ============ بطاقة الطباعة مع سجل الرفض ============
  printCard(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c) return;

    // جدول المراحل
    let stepsHTML = c.steps.map((s, i) => {
      let bg = i < c.currentStepIndex ? '#d4edda' : i === c.currentStepIndex ? '#cce5ff' : '#fff3cd';
      let st = i < c.currentStepIndex ? '✅ منجز' : i === c.currentStepIndex ? '🔄 الحالية' : '⏳ متبقي';
      return `<tr style="background:${bg}"><td>${s}</td><td>${st}</td></tr>`;
    }).join('');

    // سجل الرفض والعودة
    let defectHTML = '';
    if (c.defectHistory && c.defectHistory.length > 0) {
      defectHTML = `
        <h4 style="color:red;margin-top:15px;">⚠️ سجل الرفض والعودة:</h4>
        <table style="width:100%;border-collapse:collapse;font-size:0.8em;margin-top:5px;">
          <thead><tr style="background:#e94560;color:white;"><th>السبب</th><th>العودة إلى</th><th>العامل</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${c.defectHistory.map(d => `<tr><td>${d.reason}</td><td>${d.returnTo}</td><td>${d.worker}</td><td>${new Date(d.date).toLocaleString('ar-SY')}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999;overflow-y:auto;padding:20px;font-family:Cairo;color:#1a1a2e;direction:rtl;';
    overlay.innerHTML = `
      <button onclick="this.parentElement.remove()" style="position:fixed;top:10px;right:10px;background:red;color:white;border:none;border-radius:50%;width:35px;height:35px;font-size:20px;">✕</button>
      <h2 style="text-align:center;color:#e2a629;">⚙️ بيت السلندر السوري</h2>
      <h1 style="text-align:center;background:#1a1a2e;color:#e2a629;padding:10px;border-radius:10px;">${c.code}</h1>
      <p><strong>النوع:</strong> ${c.type==='iron'?'حديد':'كروم'} | <strong>الزبون:</strong> ${c.client} | <strong>الطبعة:</strong> ${c.print}</p>
      <p><strong>الحالة:</strong> ${c.status==='active'?'نشط':c.status==='rejected'?'مرفوض':'مُسلَّم'} | <strong>التاريخ:</strong> ${formatDateTime(c.createdAt)}</p>
      ${c.status==='delivered' ? `<p><strong>🚚 المستلم:</strong> ${c.deliveredTo} | <strong>📅 التسليم:</strong> ${formatDateTime(c.deliveredDate)}</p>` : ''}
      <h4 style="color:#e2a629;margin-top:15px;">📋 المراحل:</h4>
      <table style="width:100%;border-collapse:collapse;font-size:0.8em;">
        <thead><tr style="background:#1a1a2e;color:white;"><th>المرحلة</th><th>الحالة</th></tr></thead>
        <tbody>${stepsHTML}</tbody>
      </table>
      ${defectHTML}
      <button onclick="window.print()" style="background:#e2a629;color:#1a1a2e;padding:10px 30px;border:none;border-radius:10px;font-weight:bold;display:block;margin:20px auto;font-family:Cairo;">🖨️ طباعة</button>
    `;
    document.body.appendChild(overlay);
  },

  renderWorkers(container) {
    container.innerHTML = `
      <div class="card"><h3>👥 العمال</h3>
        ${this.data.workers.map(w => `<p>👷 ${w.username} <button class="btn small-btn" onclick="app.deleteWorker('${w.id}')">🗑️</button></p>`).join('')}
        <hr><h4>➕ جديد</h4>
        <input type="text" id="new-worker-name" placeholder="الاسم"><input type="password" id="new-worker-pass" placeholder="كلمة المرور">
        <button class="btn primary-btn full-width" onclick="app.addWorker()">إضافة</button>
      </div>
    `;
  },

  addWorker() {
    const name = document.getElementById('new-worker-name').value.trim();
    const pass = document.getElementById('new-worker-pass').value.trim();
    if (!name || !pass) return;
    this.data.workers.push({ id: 'w' + Date.now(), username: name, password: pass });
    saveData(this.data);
    alert('✅ تم');
    this.switchTab('workers');
  },

  deleteWorker(workerId) {
    if (!confirm('حذف؟')) return;
    this.data.workers = this.data.workers.filter(w => w.id !== workerId);
    saveData(this.data);
    this.switchTab('workers');
  },

  renderMessages(container) {
    container.innerHTML = `
      <div class="card"><h3>📩 رسالة</h3>
        <select id="msg-worker-select">${this.data.workers.map(w => `<option value="${w.id}">${w.username}</option>`).join('')}</select>
        <textarea id="msg-text" placeholder="النص..."></textarea>
        <button class="btn primary-btn full-width" onclick="app.sendMessage()">إرسال</button>
      </div>
    `;
  },

  sendMessage() {
    const to = document.getElementById('msg-worker-select').value;
    const text = document.getElementById('msg-text').value.trim();
    if (!text) return;
    this.data.messages.push({ id: Date.now(), to, text, received: false, date: new Date().toISOString() });
    saveData(this.data);
    alert('✅ تم');
  },

  renderSettings(container) {
    container.innerHTML = `
      <div class="card"><h3>⚙️ كلمة المرور</h3>
        <input type="password" id="old-admin-pass" placeholder="القديمة">
        <input type="password" id="new-admin-pass" placeholder="الجديدة">
        <button class="btn primary-btn full-width" onclick="app.changeAdminPassword()">حفظ</button>
      </div>
    `;
  },

  changeAdminPassword() {
    const old = document.getElementById('old-admin-pass').value.trim();
    const nw = document.getElementById('new-admin-pass').value.trim();
    if (old !== this.data.admin.password) { alert('❌ خطأ'); return; }
    if (!nw || nw.length < 3) { alert('❌ قصيرة'); return; }
    this.data.admin.password = nw;
    saveData(this.data);
    alert('✅ تم');
  },

  renderWorkerTasks(container) {
    const my = this.data.cylinders.filter(c => c.status === 'active' && c.currentStepIndex < c.steps.length);
    const done = this.data.cylinders.filter(c => c.status === 'active' && c.currentStepIndex >= c.steps.length);
    container.innerHTML = `
      ${done.length > 0 ? `<div class="card" style="border-right:4px solid green;"><h3>✅ مكتملة</h3>${done.map(c => `<p>${c.code} - ${c.client}</p>`).join('')}</div>` : ''}
      <div class="card"><h3>🔧 قيد العمل</h3>
        ${my.length === 0 ? '<p>لا يوجد</p>' : my.map(c => `
          <div style="background:#1a1a3e;padding:10px;margin:5px 0;border-radius:8px;">
            <strong>${c.code}</strong> | ${c.client} | ${c.steps[c.currentStepIndex]}
            <div style="display:flex;gap:5px;margin-top:5px;">
              <button class="btn primary-btn" onclick="app.nextStepForWorker(${c.id})">✅ إنجاز</button>
              <button class="btn small-btn" onclick="app.workerGoBack(${c.id})">⬅️</button>
              <button class="btn small-btn" onclick="app.reportDefectPrompt(${c.id})" style="background:red;color:white;">⚠️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  nextStepForWorker(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c || c.currentStepIndex >= c.steps.length) return;
    c.completedSteps.push({ step: c.steps[c.currentStepIndex], worker: this.currentUser.username, time: new Date().toISOString() });
    c.currentStepIndex++;
    if (c.currentStepIndex < c.steps.length) c.stepStartTime = new Date().toISOString();
    else c.stepStartTime = null;
    saveData(this.data);
    this.switchWorkerTab('my-tasks');
  },

  workerGoBack(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c || c.currentStepIndex <= 0) { alert('لا يمكن'); return; }
    c.currentStepIndex--;
    c.completedSteps.pop();
    c.stepStartTime = new Date().toISOString();
    saveData(this.data);
    this.switchWorkerTab('my-tasks');
  },

  reportDefectPrompt(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c) return;
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    const stepsList = c.steps.map((s, i) => `${i}: ${s}`).join('\n');
    const idx = parseInt(prompt(`رقم المرحلة للعودة:\n\n${stepsList}`));
    if (isNaN(idx) || idx < 0 || idx >= c.steps.length) { alert('خطأ'); return; }
    c.defectHistory = c.defectHistory || [];
    c.defectHistory.push({ reason, returnTo: c.steps[idx], worker: this.currentUser.username, date: new Date().toISOString() });
    c.currentStepIndex = idx;
    c.status = 'active';
    c.completedSteps = c.completedSteps.filter(s => c.steps.indexOf(s.step) < idx);
    c.stepStartTime = new Date().toISOString();
    saveData(this.data);
    alert('✅ تم');
    this.switchWorkerTab('my-tasks');
  },

  renderWorkerMessages(container) {
    const msgs = this.data.messages.filter(m => m.to === this.currentUser.id);
    container.innerHTML = `
      <div class="card"><h3>📥 الرسائل</h3>
        ${msgs.length === 0 ? '<p>لا يوجد</p>' : msgs.map(m => `
          <div style="background:#1a1a3e;padding:10px;margin:5px 0;border-radius:8px;">
            <p>${m.text}</p>
            ${!m.received ? `<button class="btn small-btn" onclick="app.confirmReceipt(${m.id})" style="color:gold;">✅ استلام</button>` : '<span style="color:green;">✓ تم</span>'}
          </div>
        `).join('')}
      </div>
    `;
  },

  confirmReceipt(msgId) {
    const m = this.data.messages.find(x => x.id === msgId);
    if (m) { m.received = true; saveData(this.data); this.switchWorkerTab('worker-messages'); }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('login-screen').classList.add('active-screen');
  document.getElementById('password-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') app.login(); });
  app.selectRole('manager');
});
