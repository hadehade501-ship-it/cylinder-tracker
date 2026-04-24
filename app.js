// ==========================================
// تطبيق بيت السلندر السوري - MVP
// ==========================================

// ------- هيكل البيانات (مخزن في localStorage) -------
const DEFAULT_DATA = {
  admin: {
    username: 'admin',
    password: '1234'
  },
  workers: [
    { id: 'w1', username: 'علي', password: '1111' },
    { id: 'w2', username: 'محمد', password: '2222' }
  ],
  cylinders: [],
  messages: [],
  nextCylinderId: 1
};

// ------- تحميل أو إنشاء البيانات -------
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

// ------- التطبيق الرئيسي -------
const app = {
  data: loadData(),
  currentUser: null,
  currentRole: null, // 'admin' أو 'worker'

  // ============ تسجيل الدخول ============
  login() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const errorDiv = document.getElementById('login-error');

    if (!username || !password) {
      errorDiv.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
      return;
    }

    if (this.currentRole === 'manager') {
      // تسجيل دخول مدير
      if (username === this.data.admin.username && password === this.data.admin.password) {
        this.currentUser = { username: username, role: 'admin' };
        this.currentRole = 'admin';
        this.showAdminScreen();
        errorDiv.textContent = '';
      } else {
        errorDiv.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة للمدير';
      }
    } else {
      // تسجيل دخول عامل
      const worker = this.data.workers.find(w => w.username === username && w.password === password);
      if (worker) {
        this.currentUser = { ...worker, role: 'worker' };
        this.currentRole = 'worker';
        this.showWorkerScreen();
        errorDiv.textContent = '';
      } else {
        errorDiv.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة للعامل';
      }
    }
  },

  // ============ اختيار الدور في شاشة الدخول ============
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

  // ============ تسجيل الخروج ============
  logout() {
    this.currentUser = null;
    this.currentRole = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById('login-screen').classList.add('active-screen');
    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
  },

  // ============ عرض شاشة المدير ============
  showAdminScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('admin-screen').classList.add('active-screen');
    document.getElementById('worker-screen').classList.remove('active-screen');
    document.getElementById('admin-name-display').textContent = '👔 ' + this.currentUser.username;
    
    // تنشيط أول تبويب
    this.switchTab('dashboard');
  },

  // ============ عرض شاشة العامل ============
  showWorkerScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('worker-screen').classList.add('active-screen');
    document.getElementById('admin-screen').classList.remove('active-screen');
    document.getElementById('worker-name-display').textContent = '👷 ' + this.currentUser.username;
    
    // تنشيط أول تبويب
    this.switchWorkerTab('my-tasks');
  },

  // ============ تبديل تبويبات المدير ============
  switchTab(tabName) {
    // تحديث أزرار التبويب
    document.querySelectorAll('#admin-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // عرض المحتوى المناسب
    const container = document.getElementById('admin-tabs-container');
    container.innerHTML = '';
    
    switch(tabName) {
      case 'dashboard':
        this.renderDashboard(container);
        break;
      case 'add-cylinder':
        this.renderAddCylinder(container);
        break;
      case 'manage-cylinders':
        this.renderManageCylinders(container);
        break;
      case 'workers':
        this.renderWorkers(container);
        break;
      case 'messages':
        this.renderMessages(container);
        break;
      case 'settings':
        this.renderSettings(container);
        break;
    }
  },

  // ============ تبديل تبويبات العامل ============
  switchWorkerTab(tabName) {
    document.querySelectorAll('#worker-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('worker-tabs-container');
    container.innerHTML = '';
    
    switch(tabName) {
      case 'my-tasks':
        this.renderWorkerTasks(container);
        break;
      case 'worker-messages':
        this.renderWorkerMessages(container);
        break;
    }
  },

  // ============ لوحة تحكم المدير ============
  renderDashboard(container) {
    const active = this.data.cylinders.filter(c => c.status === 'active').length;
    const rejected = this.data.cylinders.filter(c => c.status === 'rejected').length;
    const delivered = this.data.cylinders.filter(c => c.status === 'delivered').length;
    
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-box">
          <div class="number">${active}</div>
          <div class="label">🟢 قيد العمل</div>
        </div>
        <div class="stat-box">
          <div class="number">${rejected}</div>
          <div class="label">🔴 مرفوض</div>
        </div>
        <div class="stat-box">
          <div class="number">${delivered}</div>
          <div class="label">✅ مسلَّم</div>
        </div>
        <div class="stat-box">
          <div class="number">${this.data.workers.length}</div>
          <div class="label">👥 العمال</div>
        </div>
      </div>
      
      <div class="card">
        <h3>آخر العمليات</h3>
        ${this.data.cylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد عمليات بعد</p>'
          : `<div style="overflow-x:auto;">
              <table class="data-table">
                <thead><tr><th>الكود</th><th>النوع</th><th>المرحلة</th><th>الحالة</th></tr></thead>
                <tbody>
                  ${[...this.data.cylinders].reverse().slice(0, 5).map(c => `
                    <tr>
                      <td><strong>${c.code}</strong></td>
                      <td>${c.type === 'iron' ? 'حديد' : 'كروم'}</td>
                      <td>${c.currentStep || 'لم يبدأ'}</td>
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

  // ============ إضافة سلندر جديد ============
  renderAddCylinder(container) {
    container.innerHTML = `
      <div class="card">
        <h3>➕ إضافة سلندر جديد</h3>
        <div class="input-group">
          <select id="cyl-type" style="padding:14px;background:var(--bg-input);color:var(--white);border-radius:var(--radius);border:none;font-family:Cairo;">
            <option value="iron">🟤 سلندر حديد (10 مراحل)</option>
            <option value="chrome">🪞 سلندر كروم (9 مراحل)</option>
          </select>
          <input type="text" id="cyl-code" placeholder="الكود المنقوش (يدوياً)">
          <input type="text" id="cyl-client" placeholder="اسم المطبعة أو الزبون">
          <input type="text" id="cyl-print" placeholder="نوع الطبعة">
          <input type="date" id="cyl-date">
          <textarea id="cyl-notes" placeholder="ملاحظات (اختياري)" style="padding:14px;background:var(--bg-input);color:var(--white);border-radius:var(--radius);border:none;font-family:Cairo;resize:vertical;"></textarea>
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

    if (!code || !client || !print) {
      errorDiv.textContent = '❌ الكود واسم المطبعة ونوع الطبعة حقول إجبارية';
      return;
    }

    // تعريف المراحل حسب النوع
    const ironSteps = ['مخارط', 'بوليش تلبيس', 'أحواض نيكل', 'أحواض نحاس', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    const chromeSteps = ['أحواض ديكروم', 'بوليش تلبيس', 'أحواض', 'بوليش للحفر', 'حفر', 'أحواض كروم', 'بوليش كروم', 'بروفا', 'تغليف'];
    
    const newCylinder = {
      id: this.data.nextCylinderId++,
      code: code,
      type: type,
      client: client,
      print: print,
      date: date,
      notes: notes,
      steps: type === 'iron' ? ironSteps : chromeSteps,
      currentStepIndex: 0,
      status: 'active', // active, rejected, delivered
      rejectedReason: '',
      completedSteps: [],
      assignedWorker: null
    };

    this.data.cylinders.push(newCylinder);
    saveData(this.data);
    
    // إعادة تعيين الحقول
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
                <thead><tr><th>الكود</th><th>النوع</th><th>الزبون</th><th>المرحلة</th><th>الحالة</th></tr></thead>
                <tbody>
                  ${this.data.cylinders.map(c => `
                    <tr>
                      <td><strong>${c.code}</strong></td>
                      <td>${c.type === 'iron' ? 'حديد' : 'كروم'}</td>
                      <td>${c.client}</td>
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

  // ============ إدارة العمال ============
  renderWorkers(container) {
    container.innerHTML = `
      <div class="card">
        <h3>👥 قائمة العمال</h3>
        ${this.data.workers.map(w => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #333;">
            <span>👷 ${w.username}</span>
            <span style="color:#888;font-size:0.8em;">${w.id}</span>
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
      </div>
    `;
  },

  addWorker() {
    const name = document.getElementById('new-worker-name').value.trim();
    const pass = document.getElementById('new-worker-pass').value.trim();
    const errorDiv = document.getElementById('add-worker-error');
    
    if (!name || !pass) {
      errorDiv.textContent = '❌ الرجاء إدخال اسم وكلمة مرور';
      return;
    }
    
    const newWorker = {
      id: 'w' + (this.data.workers.length + 1),
      username: name,
      password: pass
    };
    
    this.data.workers.push(newWorker);
    saveData(this.data);
    errorDiv.textContent = '';
    alert('✅ تم إضافة العامل بنجاح');
    this.switchTab('workers');
  },

  // ============ نظام المراسلة ============
  renderMessages(container) {
    container.innerHTML = `
      <div class="card">
        <h3>📩 إرسال رسالة إلى عامل</h3>
        <div class="input-group">
          <select id="msg-worker-select" style="padding:14px;background:var(--bg-input);color:var(--white);border-radius:var(--radius);border:none;font-family:Cairo;">
            ${this.data.workers.map(w => `<option value="${w.id}">${w.username}</option>`).join('')}
          </select>
          <textarea id="msg-text" placeholder="نص الرسالة..." style="padding:14px;background:var(--bg-input);color:var(--white);border-radius:var(--radius);border:none;font-family:Cairo;resize:vertical;min-height:100px;"></textarea>
        </div>
        <button class="btn primary-btn full-width" onclick="app.sendMessage()">إرسال الرسالة</button>
        <div id="msg-error" class="error-message"></div>
      </div>
    `;
  },

  sendMessage() {
    const workerId = document.getElementById('msg-worker-select').value;
    const text = document.getElementById('msg-text').value.trim();
    const errorDiv = document.getElementById('msg-error');
    
    if (!text) {
      errorDiv.textContent = '❌ الرجاء كتابة نص الرسالة';
      return;
    }
    
    const newMessage = {
      id: Date.now(),
      from: 'admin',
      to: workerId,
      text: text,
      received: false,
      date: new Date().toLocaleString('ar-SY')
    };
    
    this.data.messages.push(newMessage);
    saveData(this.data);
    document.getElementById('msg-text').value = '';
    errorDiv.textContent = '';
    alert('✅ تم إرسال الرسالة');
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
        <button class="btn primary-btn full-width" onclick="app.changeAdminPassword()">حفظ التغيير</button>
        <div id="settings-error" class="error-message"></div>
      </div>
    `;
  },

  changeAdminPassword() {
    const oldPass = document.getElementById('old-admin-pass').value.trim();
    const newPass = document.getElementById('new-admin-pass').value.trim();
    const errorDiv = document.getElementById('settings-error');
    
    if (oldPass !== this.data.admin.password) {
      errorDiv.textContent = '❌ كلمة المرور القديمة غير صحيحة';
      return;
    }
    
    if (!newPass || newPass.length < 3) {
      errorDiv.textContent = '❌ كلمة المرور الجديدة قصيرة جداً';
      return;
    }
    
    this.data.admin.password = newPass;
    saveData(this.data);
    errorDiv.textContent = '';
    alert('✅ تم تغيير كلمة المرور بنجاح');
  },

  // ============ مهام العامل ============
  renderWorkerTasks(container) {
    const myCylinders = this.data.cylinders.filter(c => c.status === 'active');
    
    container.innerHTML = `
      <div class="card">
        <h3>🔧 السلندرات قيد العمل</h3>
        ${myCylinders.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد سلندرات نشطة حالياً</p>'
          : myCylinders.map(c => `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;">
              <strong>${c.code}</strong> | ${c.type === 'iron' ? 'حديد' : 'كروم'} | ${c.client}
              <div style="margin-top:8px;color:var(--gold);">
                المرحلة الحالية: ${c.steps[c.currentStepIndex] || 'مكتمل'}
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button class="btn primary-btn" onclick="app.nextStepForWorker(${c.id})" style="flex:1;">✅ إنجاز</button>
                <button class="btn small-btn" onclick="app.workerGoBack(${c.id})" style="flex:1;">⬅️ رجوع</button>
                <button class="btn small-btn" onclick="app.reportDefectPrompt(${c.id})" style="flex:1;background:var(--danger);color:white;">⚠️ عيب</button>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  },

  nextStepForWorker(cylId) {
    const cyl = this.data.cylinders.find(c => c.id === cylId);
    if (!cyl) return;
    
    if (cyl.currentStepIndex < cyl.steps.length) {
      cyl.completedSteps.push({
        step: cyl.steps[cyl.currentStepIndex],
        worker: this.currentUser.username,
        time: new Date().toLocaleString('ar-SY')
      });
      cyl.currentStepIndex++;
      
      if (cyl.currentStepIndex >= cyl.steps.length) {
        cyl.status = 'delivered';
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
      saveData(this.data);
      this.switchWorkerTab('my-tasks');
    } else {
      alert('لا يمكن الرجوع أكثر من ذلك');
    }
  },

  reportDefectPrompt(cylId) {
    const reason = prompt('أدخل سبب الرفض أو العيب:');
    if (reason && reason.trim()) {
      const cyl = this.data.cylinders.find(c => c.id === cylId);
      if (cyl) {
        cyl.status = 'rejected';
        cyl.rejectedReason = reason.trim();
        saveData(this.data);
        this.switchWorkerTab('my-tasks');
      }
    }
  },

  // ============ رسائل العامل ============
  renderWorkerMessages(container) {
    const myMessages = this.data.messages.filter(m => m.to === this.currentUser.id || m.to === 'all');
    
    container.innerHTML = `
      <div class="card">
        <h3>📥 الرسائل الواردة</h3>
        ${myMessages.length === 0 
          ? '<p style="text-align:center;color:#888;">لا توجد رسائل</p>'
          : myMessages.map(m => `
            <div style="background:#1a1a3e;padding:15px;border-radius:8px;margin-bottom:10px;border-right:3px solid ${m.received ? 'var(--success)' : 'var(--gold)'};">
              <p>${m.text}</p>
              <small style="color:#888;">${m.date}</small>
              ${!m.received ? `<button class="btn small-btn" onclick="app.confirmReceipt(${m.id})" style="margin-top:8px;">✅ تم الاستلام</button>` 
              : '<span style="color:var(--success);font-size:0.8em;">✓ تم الاستلام</span>'}
            </div>
          `).join('')
        }
      </div>
    `;
  },

  confirmReceipt(msgId) {
    const msg = this.data.messages.find(m => m.id === msgId);
    if (msg) {
      msg.received = true;
      saveData(this.data);
      this.switchWorkerTab('worker-messages');
    }
  }

};

// ============ بدء التشغيل ============
document.addEventListener('DOMContentLoaded', function() {
  // شاشة الدخول تظهر مباشرة
  document.getElementById('login-screen').classList.add('active-screen');
  
  // السماح بالدخول بزر Enter
  document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      app.login();
    }
  });
  
  // تعيين المدير كاختيار افتراضي
  app.selectRole('manager');
});
