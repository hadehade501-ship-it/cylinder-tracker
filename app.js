// ====================================================================
// تطبيق بيت السلندر السوري - الإصدار النهائي الكامل
// الميزات: توقيت المراحل | تنبيه تأخير 24 ساعة | بحث سريع | إشعار اكتمال
// ====================================================================

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
  let data = localStorage.getItem('cylinderAppData_v2');
  if (!data) {
    localStorage.setItem('cylinderAppData_v2', JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  return JSON.parse(data);
}

function saveData(data) {
  localStorage.setItem('cylinderAppData_v2', JSON.stringify(data));
}

// ============ دوال مساعدة ============
function formatDateTime(date) {
  return date.toLocaleString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(minutes) {
  if (minutes < 60) return minutes + ' دقيقة';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' ساعة ' + (m > 0 ? 'و ' + m + ' دقيقة' : '');
}

function getMinutesDiff(startDate, endDate) {
  return Math.floor((endDate - startDate) / 60000);
}

// ============ التطبيق الرئيسي ============
const app = {
  data: loadData(),
  currentUser: null,
  currentRole: null,

  // ============ تسجيل الدخول ============
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
      } else { errorDiv.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة للمدير'; }
    } else {
      const worker = this.data.workers.find(w => w.username === username && w.password === password);
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
      document.getElementById('username-input').placeholder = 'اسم المستخدم (علي أو محمد)';
    }
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
  },

  logout() {
    this.currentUser = null;
    this.currentRole = null;
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
    this.checkCompletedNotifications();
    this.switchTab('dashboard');
  },

  showWorkerScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('worker-screen').classList.add('active-screen');
    document.getElementById('admin-screen').classList.remove('active-screen');
    document.getElementById('worker-name-display').textContent = '👷 ' + this.currentUser.username;
    this.switchWorkerTab('my-tasks');
  },

  // ============ التحقق من إشعارات الاكتمال للمدير ============
  checkCompletedNotifications() {
    const justCompleted = this.data.cylinders.filter(c => 
      c.status === 'active' && c.currentStepIndex >= c.steps.length && !c.notifiedComplete
    );
    if (justCompleted.length > 0) {
      justCompleted.forEach(c => { c.notifiedComplete = true; });
      saveData(this.data);
      setTimeout(() => {
        alert('🔔 تنبيه: ' + justCompleted.length + ' سلندر(s) جاهز(ة) للتسليم:\n' + justCompleted.map(c => '• ' + c.code).join('\n'));
      }, 500);
    }
  },

  // ============ تبديل التبويبات - مدير ============
  switchTab(tabName) {
    document.querySelectorAll('#admin-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const container = document.getElementById('admin-tabs-container');
    container.innerHTML = '';
    switch(tabName) {
      case 'dashboard': this.renderDashboard(container); break;
      case 'add-cylinder': this.renderAddCylinder(container); break;
      case 'manage-cylinders': this.renderManageCylinders(container); break;
      case 'workers': this.renderWorkers(container); break;
      case 'messages': this.renderMessages(container); break;
      case 'settings': this.renderSettings(container); break;
    }
  },

  switchWorkerTab(tabName) {
    document.querySelectorAll('#worker-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const container = document.getElementById('worker-tabs-container');
    container.innerHTML = '';
    switch(tabName) {
      case 'my-tasks': this.renderWorkerTasks(container); break;
      case 'worker-messages': this.renderWorkerMessages(container); break;
    }
  },

  // ============ التحقق من تأخير 24 ساعة ============
  isDelayed(cyl) {
    if (cyl.status !== 'active') return false;
    if (cyl.currentStepIndex >= cyl.steps.length) return false;
    if (!cyl.stepStartTime) return false;
    const now = new Date();
    const start = new Date(cyl.stepStartTime);
    const diffMs = now - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 24;
  },

  // ============ لوحة التحكم ============
  renderDashboard(container) {
    const active = this.data.cylinders.filter(c => c.status === 'active').length;
    const rejected = this.data.cylinders.filter(c => c.status === 'rejected').length;
    const delivered = this.data.cylinders.filter(c => c.status === 'delivered').length;
    const delayed = this.data.cylinders.filter(c => this.isDelayed(c)).length;
    
    container.innerHTML = `
      <!-- شريط بحث سريع -->
      <div class="card" style="margin-bottom:15px;">
        <div style="display:flex;gap:8px;">
          <input type="text" id="quickSearch" placeholder="🔍 بحث سريع برقم السلندر..." style="flex:1;" onkeypress="if(event.key==='Enter')app.quickSearch()">
          <button class="btn primary-btn" onclick="app.quickSearch()" style="width:auto;">بحث</button>
        </div>
        <div id="quickSearchResult" style="margin-top:8px;"></div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-box"><div class="number">${active}</div><div class="label">🟢 قيد العمل</div></div>
        <div class="stat-box" style="${delayed > 0 ? 'border:2px solid var(--danger);' : ''}"><div class="number" style="${delayed > 0 ? 'color:var(--danger);' : ''}">${delayed}</div><div class="label">⏰ متأخر +24س</div></div>
        <div class="stat-box"><div class="number">${rejected}</div><div class="label">🔴 مرفوض</div></div>
        <div class="stat-box"><div class="number">${delivered}</div><div class="label">✅ مسلَّم</div></div>
      </div>
      
      ${delayed > 0 ? `
        <div class="card" style="border-right:4px solid var(--danger);margin-bottom:15px;">
          <h3 style="color:var(--danger);">⚠️ سلندرات متأخرة (+24 ساعة)</h3>
          ${this.data.cylinders.filter(c => this.isDelayed(c)).map(c => `
            <div style="background:#2e1111;padding:10px;border-radius:8px;margin-bottom:6px;">
              <strong>${c.code}</strong> | ${c.client} | المرحلة: ${c.steps[c.currentStepIndex]} | ${this.getDelayText(c)}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="card">
        <h3>آخر العمليات</h3>
        ${this.data.cylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد عمليات بعد</p>'
          : `<div style="overflow-x:auto;">
              <table class="data-table">
                <thead><tr><th>الكود</th><th>النوع</th><th>المرحلة</th><th>الحالة</th></tr></thead>
                <tbody>
                  ${[...this.data.cylinders].reverse().slice(0, 5).map(c => `
                    <tr style="${this.isDelayed(c) ? 'background:rgba(233,69,96,0.15);' : ''}">
                      <td><strong>${c.code}</strong>${this.isDelayed(c) ? ' ⏰' : ''}</td>
                      <td>${c.type === 'iron' ? 'حديد' : 'كروم'}</td>
                      <td>${c.currentStepIndex < c.steps.length ? c.steps[c.currentStepIndex] : 'مكتمل'}</td>
                      <td><span class="badge badge-${c.status}">${this.getStatusText(c.status)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  },

  getDelayText(cyl) {
    if (!cyl.stepStartTime) return '';
    const start = new Date(cyl.stepStartTime);
    const now = new Date();
    const diffMinutes = getMinutesDiff(start, now);
    return 'بدأت منذ: ' + formatDuration(diffMinutes);
  },

  quickSearch() {
    const query = document.getElementById('quickSearch').value.trim();
    const resultDiv = document.getElementById('quickSearchResult');
    if (!query) { resultDiv.innerHTML = ''; return; }
    
    const found = this.data.cylinders.filter(c => 
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.client.toLowerCase().includes(query.toLowerCase())
    );
    
    if (found.length === 0) {
      resultDiv.innerHTML = '<p style="color:var(--danger);text-align:center;">❌ لا توجد نتائج</p>';
    } else {
      resultDiv.innerHTML = found.map(c => `
        <div style="background:#1a1a3e;padding:10px;border-radius:8px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${c.code}</strong> | ${c.client} | ${c.status === 'active' && c.currentStepIndex < c.steps.length ? c.steps[c.currentStepIndex] : this.getStatusText(c.status)}
          </div>
          <button class="btn small-btn" onclick="app.printCard(${c.id})" style="color:var(--gold);border-color:var(--gold);">🖨️</button>
        </div>
      `).join('');
    }
  },

  // ============ إضافة سلندر ============
  renderAddCylinder(container) {
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

  addNewCylinder() {
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
      id: this.data.nextCylinderId++,
      code, type, client, print, date, notes,
      steps: type === 'iron' ? ironSteps : chromeSteps,
      currentStepIndex: 0,
      status: 'active',
      rejectedReason: '',
      returnToStep: null,
      completedSteps: [],
      stepStartTime: new Date().toISOString(),
      assignedWorker: null,
      deliveredTo: '',
      deliveredDate: '',
      createdAt: new Date().toISOString(),
      notifiedComplete: false,
      defectHistory: []
    };
    this.data.cylinders.push(newCylinder);
    saveData(this.data);
    document.getElementById('cyl-code').value = '';
    document.getElementById('cyl-client').value = '';
    document.getElementById('cyl-print').value = '';
    document.getElementById('cyl-notes').value = '';
    errorDiv.textContent = '';
    alert('✅ تم إضافة السلندر بنجاح: ' + code);
  },

  getStatusText(status) {
    switch(status) {
      case 'active': return 'نشط';
      case 'rejected': return 'مرفوض';
      case 'delivered': return 'مُسلَّم';
      default: return status;
    }
  },

  // ============ إدارة السلندرات ============
  renderManageCylinders(container) {
    container.innerHTML = `
      <div class="card">
        <h3>📋 جميع السلندرات</h3>
        ${this.data.cylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد سلندرات</p>'
          : `<div style="overflow-x:auto;">
              <table class="data-table">
                <thead><tr><th>الكود</th><th>النوع</th><th>الزبون</th><th>المرحلة</th><th>الحالة</th><th>الوقت</th><th>إجراءات</th></tr></thead>
                <tbody>
                  ${this.data.cylinders.map(c => {
                    let info = '';
                    let rowBg = '';
                    if (this.isDelayed(c)) {
                      rowBg = 'background:rgba(233,69,96,0.15);';
                      info = ' ⏰ متأخر';
                    }
                    if (c.status === 'rejected' && c.defectHistory.length > 0) {
                      const last = c.defectHistory[c.defectHistory.length - 1];
                      info += `<br><small style="color:var(--danger);">⚠️ ${last.reason} | العودة: ${last.returnTo}</small>`;
                    }
                    const timeText = c.stepStartTime ? this.getDelayText(c) : '-';
                    return `
                    <tr style="${rowBg}">
                      <td><strong>${c.code}</strong>${info}</td>
                      <td>${c.type === 'iron' ? 'حديد' : 'كروم'}</td>
                      <td>${c.client}</td>
                      <td>${c.currentStepIndex < c.steps.length ? c.steps[c.currentStepIndex] : 'مكتمل'}</td>
                      <td><span class="badge badge-${c.status}">${this.getStatusText(c.status)}</span></td>
                      <td style="font-size:0.75em;">${timeText}</td>
                      <td style="display:flex;gap:4px;flex-wrap:wrap;">
                        <button class="btn small-btn" onclick="app.printCard(${c.id})" style="color:var(--gold);border-color:var(--gold);">🖨️</button>
                        ${c.status === 'active' && c.currentStepIndex >= c.steps.length ? `<button class="btn small-btn" onclick="app.deliverCylinderPrompt(${c.id})" style="color:var(--gold);border-color:var(--gold);">📦 تسليم</button>` : ''}
                      </td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  },

  deliverCylinderPrompt(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c) return;
    const recipient = prompt('اسم المستلم:');
    if (!recipient || !recipient.trim()) return;
    const date = new Date().toISOString();
    c.status = 'delivered';
    c.deliveredTo = recipient.trim();
    c.deliveredDate = date;
    saveData(this.data);
    this.switchTab('manage-cylinders');
    alert(`✅ تم تسليم السلندر ${c.code} إلى ${recipient}`);
  },

  // ============ بطاقة التشغيل الشاملة ============
  printCard(cylId) {
    const c = this.data.cylinders.find(c => c.id === cylId);
    if (!c) return;
    
    const allSteps = c.steps.map((step, index) => {
      let status = '⏳ متبقي';
      let bg = '#fff3cd';
      let worker = '-';
      let startTime = '-';
      let endTime = '-';
      let duration = '-';
      
      if (index < c.currentStepIndex) {
        const done = c.completedSteps.find(s => s.step === step);
        status = '✅ منجز';
        bg = '#d4edda';
        worker = done ? done.worker : '-';
        startTime = done ? done.startTime || '-' : '-';
        endTime = done ? done.endTime || '-' : '-';
        if (done && done.startTime && done.endTime) {
          const mins = getMinutesDiff(new Date(done.startTime), new Date(done.endTime));
          duration = formatDuration(mins);
        }
      } else if (index === c.currentStepIndex && c.status === 'active') {
        status = '🔄 الحالية';
        bg = '#cce5ff';
        startTime = c.stepStartTime ? formatDateTime(new Date(c.stepStartTime)) : '-';
      } else if (c.status === 'rejected' && index === c.currentStepIndex) {
        status = '❌ مرفوضة';
        bg = '#f8d7da';
      }
      
      return { step, status, bg, worker, startTime, endTime, duration };
    });
    
    const stepsHTML = allSteps.map(s => `
      <tr style="background:${s.bg};">
        <td>${s.step}</td>
        <td>${s.status}</td>
        <td>${s.worker}</td>
        <td>${s.startTime}</td>
        <td>${s.endTime}</td>
        <td>${s.duration}</td>
      </tr>
    `).join('');
    
    const defectHistoryHTML = c.defectHistory.length > 0 ? `
      <h4 style="color:var(--danger);margin-top:20px;">⚠️ سجل الرفض والإعادة:</h4>
      <table>
        <thead><tr><th>السبب</th><th>العودة إلى</th><th>العامل</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${c.defectHistory.map(d => `
            <tr>
              <td>${d.reason}</td>
              <td>${d.returnTo}</td>
              <td>${d.worker}</td>
              <td>${d.date}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';
    
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>بطاقة تشغيل - ${c.code}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body { font-family: 'Cairo', sans-serif; padding: 20px; color: #1a1a2e; max-width: 800px; margin: auto; font-size: 0.9em; }
          .header { text-align: center; border-bottom: 4px solid #e2a629; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1a1a2e; margin: 0; font-size: 1.5em; }
          .header .sub { color: #e2a629; font-weight: 700; }
          .code-big { font-size: 1.6em; font-weight: 900; background: #1a1a2e; color: #e2a629; padding: 10px 20px; border-radius: 10px; display: inline-block; margin: 10px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
          .info-grid p { margin: 3px 0; font-size: 0.85em; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.8em; }
          th { background: #1a1a2e; color: #fff; padding: 8px; font-size: 0.8em; }
          td { padding: 7px; border: 1px solid #ddd; text-align: center; }
          .legend { display: flex; gap: 12px; margin-top: 12px; font-size: 0.75em; flex-wrap: wrap; }
          .legend span { padding: 3px 8px; border-radius: 4px; }
          .btn-print { background: #e2a629; color: #1a1a2e; padding: 12px 35px; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; margin: 20px auto; display: block; font-family: 'Cairo', sans-serif; font-size: 1em; }
          @media print { .btn-print { display: none; } body { padding: 5px; font-size: 0.75em; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚙️ بيت السلندر السوري</h1>
          <p class="sub">بطاقة تشغيل سلندر - تقرير شامل</p>
        </div>
        <div style="text-align:center;">
          <div class="code-big">${c.code}</div>
        </div>
        <div class="info-grid">
          <p><strong>📦 النوع:</strong> ${c.type === 'iron' ? 'حديد (10 مراحل)' : 'كروم (9 مراحل)'}</p>
          <p><strong>🏢 الزبون:</strong> ${c.client}</p>
          <p><strong>🖨️ الطبعة:</strong> ${c.print}</p>
          <p><strong>📅 تاريخ الدخول:</strong> ${c.createdAt ? formatDateTime(new Date(c.createdAt)) : '-'}</p>
          <p><strong>📊 الحالة:</strong> ${this.getStatusText(c.status)}</p>
          <p><strong>📝 ملاحظات:</strong> ${c.notes || '-'}</p>
          ${c.status === 'delivered' ? `<p><strong>🚚 تم التسليم إلى:</strong> ${c.deliveredTo}</p><p><strong>📅 تاريخ التسليم:</strong> ${c.deliveredDate ? formatDateTime(new Date(c.deliveredDate)) : '-'}</p>` : ''}
        </div>
        
        <h4 style="color:#e2a629;">📋 جميع المراحل مع التوقيت:</h4>
        <table>
          <thead><tr><th>المرحلة</th><th>الحالة</th><th>العامل</th><th>البداية</th><th>النهاية</th><th>المدة</th></tr></thead>
          <tbody>${stepsHTML}</tbody>
        </table>
        
        <div class="legend">
          <span style="background:#d4edda;">✅ منجز</span>
          <span style="background:#cce5ff;">🔄 الحالية</span>
          <span style="background:#fff3cd;">⏳ متبقي</span>
          <span style="background:#f8d7da;">❌ مرفوضة</span>
        </div>
        
        ${defectHistoryHTML}
        
        <p style="text-align:center;margin-top:15px;font-weight:700;font-size:1.1em;">
          ${c.status === 'active' && c.currentStepIndex < c.steps.length ? `🔄 المرحلة الحالية: ${c.steps[c.currentStepIndex]}` : ''}
          ${c.status === 'active' && c.currentStepIndex >= c.steps.length ? '✅ جميع المراحل مكتملة - في انتظار التسليم' : ''}
          ${c.status === 'delivered' ? '✅ تم التسليم للعميل' : ''}
          ${c.status === 'rejected' ? '❌ السلندر مرفوض' : ''}
        </p>
        
        <button class="btn-print" onclick="window.print()">🖨️ طباعة البطاقة</button>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  // ============ إدارة العمال ============
  renderWorkers(container) {
    container.innerHTML = `
      <div class="card">
        <h3>👥 قائمة العمال</h3>
        ${this.data.workers.map(w => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #333;flex-wrap:wrap;gap:8px;">
            <span>👷 <strong>${w.username}</strong> (${w.id})</span>
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
        <div id="add-worker-error" class="error-message"></div>
        <div id="edit-worker-form" style="display:none;margin-top:15px;">
          <hr style="margin:15px 0;border-color:#333;">
          <h4>✏️ تعديل العامل</h4>
          <input type="hidden" id="edit-worker-id">
          <div class="input-group">
            <input type="text" id="edit-worker-name" placeholder="الاسم الجديد">
            <input type="password" id="edit-worker-pass" placeholder="كلمة مرور جديدة (اترك فارغاً للتجاهل)">
          </div>
          <button class="btn primary-btn full-width" onclick="app.saveWorkerEdit()">💾 حفظ التعديلات</button>
          <button class="btn small-btn full-width" onclick="document.getElementById('edit-worker-form').style.display='none'" style="margin-top:5px;">إلغاء</button>
        </div>
      </div>
    `;
  },

  addWorker() {
    const name = document.getElementById('new-worker-name').value.trim();
    const pass = document.getElementById('new-worker-pass').value.trim();
    const errorDiv = document.getElementById('add-worker-error');
    if (!name || !pass) { errorDiv.textContent = '❌ الرجاء إدخال اسم وكلمة مرور'; return; }
    this.data.workers.push({ id: 'w' + Date.now(), username: name, password: pass });
    saveData(this.data);
    errorDiv.textContent = '';
    alert('✅ تم إضافة العامل بنجاح');
    this.switchTab('workers');
  },

  editWorker(workerId) {
    const worker = this.data.workers.find(w => w.id === workerId);
    if (!worker) return;
    document.getElementById('edit-worker-id').value = workerId;
    document.getElementById('edit-worker-name').value = worker.username;
    document.getElementById('edit-worker-pass').value = '';
    document.getElementById('edit-worker-form').style.display = 'block';
    document.getElementById('edit-worker-form').scrollIntoView({ behavior: 'smooth' });
  },

  saveWorkerEdit() {
    const workerId = document.getElementById('edit-worker-id').value;
    const newName = document.getElementById('edit-worker-name').value.trim();
    const newPass = document.getElementById('edit-worker-pass').value.trim();
    const worker = this.data.workers.find(w => w.id === workerId);
    if (!worker) return;
    if (!newName) { alert('❌ الرجاء إدخال اسم العامل'); return; }
    worker.username = newName;
    if (newPass) worker.password = newPass;
    saveData(this.data);
    alert('✅ تم تعديل بيانات العامل بنجاح');
    this.switchTab('workers');
  },

  deleteWorker(workerId) {
    if (!confirm('هل أنت متأكد من حذف هذا العامل؟')) return;
    this.data.workers = this.data.workers.filter(w => w.id !== workerId);
    saveData(this.data);
    this.switchTab('workers');
  },

  // ============ المراسلة ============
  renderMessages(container) {
    container.innerHTML = `
      <div class="card">
        <h3>📩 إرسال رسالة إلى عامل</h3>
        <div class="input-group">
          <select id="msg-worker-select">
            ${this.data.workers.map(w => `<option value="${w.id}">${w.username}</option>`).join('')}
          </select>
          <textarea id="msg-text" placeholder="نص الرسالة..."></textarea>
        </div>
        <button class="btn primary-btn full-width" onclick="app.sendMessage()">إرسال الرسالة</button>
        <div id="msg-error" class="error-message"></div>
      </div>
      <div class="card">
        <h3>📋 الرسائل المرسلة</h3>
        ${this.data.messages.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد رسائل</p>'
          : this.data.messages.map(m => {
            const worker = this.data.workers.find(w => w.id === m.to);
            return `<div style="background:#1a1a3e;padding:12px;border-radius:8px;margin-bottom:8px;border-right:3px solid ${m.received ? 'var(--success)' : 'var(--gold)'};">
              <p><strong>إلى:</strong> ${worker ? worker.username : 'محذوف'}</p>
              <p>${m.text}</p>
              <small style="color:#888;">${m.date} | ${m.received ? '✅ تم الاستلام' : '⏳ في الانتظار'}</small>
            </div>`;
          }).join('')
        }
      </div>
    `;
  },

  sendMessage() {
    const workerId = document.getElementById('msg-worker-select').value;
    const text = document.getElementById('msg-text').value.trim();
    const errorDiv = document.getElementById('msg-error');
    if (!text) { errorDiv.textContent = '❌ الرجاء كتابة نص الرسالة'; return; }
    this.data.messages.push({
      id: Date.now(), from: 'admin', to: workerId, text: text,
      received: false, date: formatDateTime(new Date())
    });
    saveData(this.data);
    document.getElementById('msg-text').value = '';
    errorDiv.textContent = '';
    this.switchTab('messages');
  },

  // ============ الإعدادات ============
  renderSettings(container) {
    container.innerHTML = `
      <div class="card">
        <h3>⚙️ تغيير كلمة مرور المدير</h3>
        <div class="input-group">
          <input type="password" id="old-admin-pass" placeholder="كلمة المرور القديمة">
          <input type="password" id="new-admin-pass" placeholder="كلمة المرور الجديدة">
        </div>
        <button class="btn primary-btn full-width" onclick="app.changeAdminPassword()">💾 حفظ التغيير</button>
        <div id="settings-error" class="error-message"></div>
      </div>
    `;
  },

  changeAdminPassword() {
    const oldPass = document.getElementById('old-admin-pass').value.trim();
    const newPass = document.getElementById('new-admin-pass').value.trim();
    const errorDiv = document.getElementById('settings-error');
    if (oldPass !== this.data.admin.password) { errorDiv.textContent = '❌ كلمة المرور القديمة غير صحيحة'; return; }
    if (!newPass || newPass.length < 3) { errorDiv.textContent = '❌ كلمة المرور الجديدة قصيرة جداً'; return; }
    this.data.admin.password = newPass;
    saveData(this.data);
    errorDiv.textContent = '';
    alert('✅ تم تغيير كلمة المرور بنجاح');
  },

  // ============ مهام العامل ============
  renderWorkerTasks(container) {
    const myCylinders = this.data.cylinders.filter(c => c.status === 'active' && c.currentStepIndex < c.steps.length);
    const myCompleted = this.data.cylinders.filter(c => c.status === 'active' && c.currentStepIndex >= c.steps.length);
    
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
          ? '<p style="text-align:center;color:#888;">لا توجد سلندرات نشطة حالياً</p>'
          : myCylinders.map(c => {
            const delayed = this.isDelayed(c);
            return `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;${delayed ? 'border-right:4px solid var(--danger);' : ''}">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
                <strong>${c.code}</strong>
                <span style="color:${delayed ? 'var(--danger)' : 'var(--gold)'};">${c.type === 'iron' ? 'حديد' : 'كروم'} | ${c.client}</span>
              </div>
              <div style="margin-top:8px;color:var(--gold);">
                ⏱️ المرحلة الحالية: ${c.steps[c.currentStepIndex]}
              </div>
              ${c.stepStartTime ? `<div style="color:#888;font-size:0.8em;">بدأت: ${formatDateTime(new Date(c.stepStartTime))} | ${this.getDelayText(c)}</div>` : ''}
              ${delayed ? '<div style="color:var(--danger);font-weight:bold;">⚠️ متأخر +24 ساعة</div>' : ''}
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn primary-btn" onclick="app.nextStepForWorker(${c.id})" style="flex:1;min-width:80px;">✅ إنجاز</button>
                <button class="btn small-btn" onclick="app.workerGoBack(${c.id})" style="flex:1;min-width:80px;">⬅️ رجوع</button>
                <button class="btn small-btn" onclick="app.reportDefectPrompt(${c.id})" style="flex:1;min-width:80px;background:var(--danger);color:white;border-color:var(--danger);">⚠️ عيب</button>
              </div>
            </div>
          `}).join('')
        }
      </div>
    `;
  },

  nextStepForWorker(cylId) {
    const cyl = this.data.cylinders.find(c => c.id === cylId);
    if (!cyl) return;
    if (cyl.currentStepIndex < cyl.steps.length) {
      const now = new Date();
      const endTime = now.toISOString();
      
      // إذا كانت هناك مرحلة سابقة قيد التنفيذ، نغلقها
      cyl.completedSteps.push({
        step: cyl.steps[cyl.currentStepIndex],
        worker: this.currentUser.username,
        startTime: cyl.stepStartTime || endTime,
        endTime: endTime
      });
      
      cyl.currentStepIndex++;
      
      // بداية توقيت المرحلة الجديدة
      if (cyl.currentStepIndex < cyl.steps.length) {
        cyl.stepStartTime = new Date().toISOString();
      } else {
        cyl.stepStartTime = null;
      }
      
      saveData(this.data);
      this.switchWorkerTab('my-tasks');
    }
  },

  workerGoBack(cylId) {
    const cyl = this.data.cylinders.find(c => c.id === cylId);
    if (!cyl) return;
    if (cyl.currentStepIndex > 0) {
      cyl.currentStepIndex--;
      cyl.completedSteps.pop();
      cyl.stepStartTime = new Date().toISOString();
      saveData(this.data);
      this.switchWorkerTab('my-tasks');
    } else { alert('لا يمكن الرجوع أكثر من ذلك'); }
  },

  reportDefectPrompt(cylId) {
    const cyl = this.data.cylinders.find(c => c.id === cylId);
    if (!cyl) return;
    
    const reason = prompt('🔴 أدخل سبب الرفض أو العيب:');
    if (!reason || !reason.trim()) return;
    
    // بناء قائمة المراحل الممكنة للعودة
    const stepsList = cyl.steps.map((s, i) => `${i}: ${s}`).join('\n');
    const returnIndex = prompt(`📋 اختر رقم المرحلة المطلوب العودة إليها:\n\n${stepsList}\n\nأدخل الرقم فقط:`);
    
    if (returnIndex === null) return;
    const idx = parseInt(returnIndex);
    if (isNaN(idx) || idx < 0 || idx >= cyl.steps.length) {
      alert('❌ رقم مرحلة غير صحيح');
      return;
    }
    
    const now = formatDateTime(new Date());
    
    cyl.defectHistory.push({
      reason: reason.trim(),
      returnTo: cyl.steps[idx],
      worker: this.currentUser.username,
      date: now
    });
    
    cyl.status = 'rejected';
    cyl.rejectedReason = reason.trim();
    cyl.returnToStep = cyl.steps[idx];
    cyl.returnToStepIndex = idx;
    
    // إعادة السلندر تلقائياً إلى المرحلة المختارة
    cyl.currentStepIndex = idx;
    cyl.status = 'active';
    cyl.stepStartTime = new Date().toISOString();
    
    // حذف المراحل المكتملة التي بعد المرحلة المختارة
    cyl.completedSteps = cyl.completedSteps.filter(s => {
      const stepIndex = cyl.steps.indexOf(s.step);
      return stepIndex < idx;
    });
    
    saveData(this.data);
    alert(`✅ تم إعادة السلندر ${cyl.code} إلى مرحلة "${cyl.steps[idx]}"`);
    this.switchWorkerTab('my-tasks');
  },

  // ============ رسائل العامل ============
  renderWorkerMessages(container) {
    const myMessages = this.data.messages.filter(m => m.to === this.currentUser.id);
    container.innerHTML = `
      <div class="card">
        <h3>📥 الرسائل الواردة</h3>
        ${myMessages.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد رسائل</p>'
          : myMessages.map(m => `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;border-right:3px solid ${m.received ? 'var(--success)' : 'var(--gold)'};">
              <p>${m.text}</p>
              <small style="color:#888;">${m.date}</small>
              ${!m.received ? `<button class="btn small-btn" onclick="app.confirmReceipt(${m.id})" style="margin-top:8px;color:var(--gold);border-color:var(--gold);">✅ تم الاستلام</button>` : '<span style="color:var(--success);font-size:0.8em;display:block;margin-top:5px;">✓ تم الاستلام</span>'}
            </div>
          `).join('')
        }
      </div>
    `;
  },

  confirmReceipt(msgId) {
    const msg = this.data.messages.find(m => m.id === msgId);
    if (msg) { msg.received = true; saveData(this.data); this.switchWorkerTab('worker-messages'); }
  }
};

// ============ بدء التشغيل ============
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('login-screen').classList.add('active-screen');
  document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') app.login();
  });
  app.selectRole('manager');
});
