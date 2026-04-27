// ============================================================
// بيت السلندر السوري - المنطق الكامل مع Firebase (مُعدّل)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyA2x1Oa1r4x03cJiGeCKpQPj_kwMns6-e0",
  authDomain: "cylinder-tracker-82dfb.firebaseapp.com",
  projectId: "cylinder-tracker-82dfb",
  storageBucket: "cylinder-tracker-82dfb.firebasestorage.app",
  messagingSenderId: "1076873817188",
  appId: "1:1076873817188:web:85e6ba88b89a4c602e0371"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== الثوابت =====
const IRON_STAGES = ['مخارط','بوليش تلبيس','أحواض نيكل','أحواض نحاس','بوليش للحفر','حفر','أحواض كروم','بوليش كروم','بروفا','تغليف'];
const CHROME_STAGES = ['أحواض ديكروم','بوليش تلبيس','أحواض','بوليش للحفر','حفر','أحواض كروم','بوليش كروم','بروفا','تغليف'];

const SHIFTS = {
  morning: { label: 'صباحية', time: '8:00 ص - 4:00 م', start: 8, end: 16, icon: '🌅' },
  evening: { label: 'مسائية', time: '4:00 م - 12:00 م', start: 16, end: 24, icon: '🌆' },
  night:   { label: 'ليلية',  time: '12:00 م - 8:00 ص', start: 0,  end: 8,  icon: '🌙' }
};

// ===== مساعدات الوقت =====
function fmtTime(ts) {
  if (!ts) return '-';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('ar-SY') + ' ' + d.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms) {
  if (!ms || ms <= 0) return '-';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} يوم ${h % 24} ساعة`;
  if (h > 0) return `${h} ساعة ${m % 60} دقيقة`;
  return `${m} دقيقة`;
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const s = start?.toDate ? start.toDate() : new Date(start);
  const e = end?.toDate ? end.toDate() : new Date(end);
  return Math.max(0, e - s);
}

function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 8 && h < 16) return 'morning';
  if (h >= 16) return 'evening';
  return 'night';
}

function isLate(deliveryDate) {
  if (!deliveryDate) return false;
  return new Date() > new Date(deliveryDate);
}

function isStuck(cyl) {
  if (cyl.status !== 'active') return false;
  if (!cyl.stageStartTime) return false;
  const start = new Date(cyl.stageStartTime);
  const diffHours = (new Date() - start) / (1000 * 60 * 60);
  return diffHours >= 24;
}

function statusLabel(s, late, stuck) {
  if (stuck) return '⏰ متأخر بالمرحلة';
  if (late && s === 'active') return '⏰ متأخر بالتسليم';
  return s === 'active' ? '🔵 نشط' : s === 'rejected' ? '⚠ مرفوض' : '✅ مُسلَّم';
}

function statusClass(s, late, stuck) {
  if (stuck) return 'late';
  if (late && s === 'active') return 'late';
  return s;
}

// ===== المستخدمون =====
async function initAdmin() {
  const ref = doc(db, 'users', 'admin');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { id: 'admin', name: 'المدير', role: 'manager', pass: 'Admin', active: true, createdAt: serverTimestamp() });
  }
}

async function loginUser(uid, pass) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const u = snap.data();
  if (u.pass !== pass || !u.active) return null;
  return u;
}

async function getWorkers() {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'worker')));
  return snap.docs.map(d => d.data());
}

async function getUserById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, 'users', id));
  return snap.exists() ? snap.data() : null;
}

async function addWorker(name, username, pass, shift, machine) {
  const ref = doc(db, 'users', username);
  if ((await getDoc(ref)).exists()) return { ok: false, msg: 'اسم المستخدم مستخدم مسبقاً' };
  await setDoc(ref, { id: username, name, role: 'worker', pass, active: true, shift: shift || 'morning', machine: machine || '', createdAt: serverTimestamp() });
  return { ok: true };
}

async function deleteWorkerById(wid) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا العامل؟ لا يمكن التراجع.')) return { ok: false, msg: 'تم الإلغاء' };
  await deleteDoc(doc(db, 'users', wid));
  await addNotif('admin', `تم حذف العامل ${wid}`, 'warning');
  return { ok: true };
}

async function changePass(userId, oldPass, newPass) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return { ok: false, msg: 'المستخدم غير موجود' };
  if (snap.data().pass !== oldPass) return { ok: false, msg: 'كلمة المرور الحالية غير صحيحة' };
  await updateDoc(doc(db, 'users', userId), { pass: newPass });
  return { ok: true };
}

async function changeWorkerPass(wid, pass) {
  await updateDoc(doc(db, 'users', wid), { pass });
  return { ok: true };
}

// ===== السلندرات =====
async function addCylinder(data) {
  const stages = data.type === 'iron' ? [...IRON_STAGES] : [...CHROME_STAGES];
  const now = new Date().toISOString();
  const cyl = {
    code: data.code, type: data.type, press: data.press,
    edition: data.edition || '', entryDate: data.entryDate || '',
    deliveryDate: data.deliveryDate || '', notes: data.notes || '',
    stages, currentStageIndex: 0, status: 'active',
    stageStartTime: now,
    history: [{ stage: stages[0], time: now, by: data.by, byName: data.byName || 'المدير', note: '', shift: getCurrentShift(), duration: null, startTime: now, endTime: null }],
    assignedWorker: data.assignedWorker || null,
    rejectReason: null, deliveredTo: null, deliveredAt: null,
    createdAt: serverTimestamp(), createdBy: data.by
  };
  const ref = await addDoc(collection(db, 'cylinders'), cyl);
  return { id: ref.id, ...cyl };
}

async function getCylById(id) {
  const snap = await getDoc(doc(db, 'cylinders', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getCylinders() {
  const snap = await getDocs(query(collection(db, 'cylinders'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateCyl(id, changes) {
  await updateDoc(doc(db, 'cylinders', id), changes);
}

async function deleteCylinderById(cylId) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا السلندر؟ لا يمكن التراجع.')) return { ok: false, msg: 'تم الإلغاء' };
  const cyl = await getCylById(cylId);
  await deleteDoc(doc(db, 'cylinders', cylId));
  await addNotif('admin', `تم حذف السلندر ${cyl?.code || cylId}`, 'warning');
  return { ok: true };
}

async function advanceStage(cylId, workerId, workerName, note) {
  const cyl = await getCylById(cylId);
  if (!cyl || cyl.status !== 'active') return { ok: false, msg: 'لا يمكن تقديم هذا السلندر' };
  if (cyl.currentStageIndex >= cyl.stages.length - 1) return { ok: false, msg: 'السلندر في آخر مرحلة' };
  const now = new Date().toISOString();
  const duration = cyl.stageStartTime ? new Date(now) - new Date(cyl.stageStartTime) : null;
  const nextIdx = cyl.currentStageIndex + 1;
  const history = [...(cyl.history || [])];
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now;
    last.duration = duration;
    history[history.length - 1] = last;
  }
  history.push({ stage: cyl.stages[nextIdx], time: now, by: workerId, byName: workerName, note: note || '', shift: getCurrentShift(), duration: null, startTime: now, endTime: null });
  const isLastStage = (nextIdx >= cyl.stages.length - 1);
  await updateCyl(cylId, { currentStageIndex: nextIdx, history, stageStartTime: now });
  await addNotif('admin', `السلندر ${cyl.code} انتقل إلى: ${cyl.stages[nextIdx]} بواسطة ${workerName}`, 'info');
  if (isLastStage) {
    await addNotif('admin', `🎉 السلندر ${cyl.code} جاهز للتسليم`, 'info');
  }
  return { ok: true };
}

async function goBackStage(cylId, workerId, workerName, reason) {
  const cyl = await getCylById(cylId);
  if (!cyl || cyl.status !== 'active') return { ok: false, msg: 'لا يمكن الرجوع' };
  if (cyl.currentStageIndex === 0) return { ok: false, msg: 'أنت في أول مرحلة' };
  const now = new Date().toISOString();
  const prevIdx = cyl.currentStageIndex - 1;
  const history = [...(cyl.history || []), { stage: '← رجوع: ' + cyl.stages[prevIdx], time: now, by: workerId, byName: workerName, note: reason || 'رجوع للمرحلة السابقة', shift: getCurrentShift(), duration: null, startTime: now, endTime: null }];
  await updateCyl(cylId, { currentStageIndex: prevIdx, history, stageStartTime: now });
  await addNotif('admin', `السلندر ${cyl.code} رجع إلى: ${cyl.stages[prevIdx]} بواسطة ${workerName}`, 'warning');
  return { ok: true };
}

async function rejectCyl(cylId, reason, workerId, workerName, restageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok: false };
  const now = new Date().toISOString();
  const targetIdx = restageIndex !== undefined ? restageIndex : cyl.currentStageIndex;
  const history = [...(cyl.history || [])];
  history.push({ stage: '⚠ إبلاغ عيب', time: now, by: workerId, byName: workerName, note: reason, shift: getCurrentShift(), duration: null, startTime: now, endTime: null });
  history.push({ stage: '🔄 إعادة من: ' + cyl.stages[targetIdx], time: now, by: workerId, byName: workerName, note: `إعادة بعد عيب: ${reason}`, shift: getCurrentShift(), duration: null, startTime: now, endTime: null });
  await updateCyl(cylId, { status: 'active', currentStageIndex: targetIdx, history, stageStartTime: now, lastReject: { reason, by: workerName, time: now, returnTo: cyl.stages[targetIdx] } });
  await addNotif('admin', `⚠ السلندر ${cyl.code} فيه عيب: ${reason} - أُعيد من مرحلة: ${cyl.stages[targetIdx]} بواسطة ${workerName}`, 'warning');
  return { ok: true };
}

async function reinstateCyl(cylId, stageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok: false };
  const now = new Date().toISOString();
  const history = [...(cyl.history || []), { stage: '🔄 إعادة تشغيل من: ' + cyl.stages[stageIndex], time: now, by: 'admin', byName: 'المدير', note: '', shift: getCurrentShift(), duration: null, startTime: now, endTime: null }];
  await updateCyl(cylId, { status: 'active', rejectReason: null, currentStageIndex: stageIndex, history, stageStartTime: now });
  return { ok: true };
}

async function deliverCyl(cylId, deliveredTo) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok: false };
  const now = new Date().toISOString();
  const duration = cyl.stageStartTime ? new Date(now) - new Date(cyl.stageStartTime) : null;
  const history = [...(cyl.history || [])];
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now; last.duration = duration;
    history[history.length - 1] = last;
  }
  history.push({ stage: '✅ تسليم للعميل', time: now, by: 'admin', byName: 'المدير', note: `تسلّم: ${deliveredTo}`, shift: getCurrentShift(), duration: null, startTime: now, endTime: null });
  await updateCyl(cylId, { status: 'delivered', deliveredTo, deliveredAt: now, history, currentStageIndex: cyl.stages.length });
  return { ok: true };
}

// ===== الرسائل =====
async function sendMessage(toId, fromId, fromName, text) {
  await addDoc(collection(db, 'messages'), { to: toId, from: fromId, fromName, text, time: serverTimestamp(), read: false, confirmed: false, confirmedAt: null });
  await addNotif(toId, `رسالة جديدة من ${fromName}`, 'message');
}

async function getMessages() {
  const snap = await getDocs(query(collection(db, 'messages'), orderBy('time', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getMyMessages(userId) {
  const snap = await getDocs(query(collection(db, 'messages'), where('to', '==', userId), orderBy('time', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function confirmRead(msgId, userId, userName) {
  await updateDoc(doc(db, 'messages', msgId), { read: true, confirmed: true, confirmedAt: new Date().toISOString() });
  await addNotif('admin', `✅ ${userName} قرأ رسالتك`, 'info');
}

// ===== الإشعارات =====
async function addNotif(toId, text, type = 'info') {
  await addDoc(collection(db, 'notifications'), { to: toId, text, type, time: serverTimestamp(), read: false });
}

async function getMyNotifs(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('to', '==', userId), orderBy('time', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 30);
}

async function markNotifsRead(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('to', '==', userId), where('read', '==', false)));
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
}

// ===== الإحصائيات =====
async function getStats() {
  const [cyls, workers] = await Promise.all([getCylinders(), getWorkers()]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() - 7);

  const todayCyls = cyls.filter(c => {
    const d = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || 0);
    return d >= today;
  });

  const defectStages = {};
  cyls.forEach(c => {
    (c.history || []).forEach(h => {
      if (h.stage.includes('عيب') || h.stage.includes('مرفوض')) {
        const prevStage = c.stages?.[c.currentStageIndex];
        if (prevStage) defectStages[prevStage] = (defectStages[prevStage] || 0) + 1;
      }
    });
  });
  const topDefects = Object.entries(defectStages).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const stageTimes = {};
  cyls.forEach(c => {
    (c.history || []).forEach(h => {
      if (h.duration && h.duration > 0 && !h.stage.includes('←') && !h.stage.includes('⚠') && !h.stage.includes('🔄') && !h.stage.includes('✅')) {
        if (!stageTimes[h.stage]) stageTimes[h.stage] = [];
        stageTimes[h.stage].push(h.duration);
      }
    });
  });
  const avgStageTimes = Object.entries(stageTimes).map(([stage, times]) => ({
    stage, avg: times.reduce((a, b) => a + b, 0) / times.length, count: times.length
  }));

  const lateCyls = cyls.filter(c => c.status === 'active' && isLate(c.deliveryDate));
  const stuckCyls = cyls.filter(c => isStuck(c));

  return {
    total: cyls.length,
    active: cyls.filter(c => c.status === 'active').length,
    rejected: cyls.filter(c => c.status === 'rejected').length,
    delivered: cyls.filter(c => c.status === 'delivered').length,
    late: lateCyls.length,
    stuck: stuckCyls.length,
    todayAdded: todayCyls.length,
    cylinders: cyls, lateCyls, stuckCyls, topDefects, avgStageTimes,
    workers: workers.map(w => ({
      ...w,
      done: cyls.filter(c => c.history?.some(h => h.by === w.id && !h.stage.includes('←') && !h.stage.includes('⚠'))).length,
      defects: cyls.filter(c => c.history?.some(h => h.by === w.id && (h.stage.includes('عيب') || h.stage.includes('مرفوض')))).length
    }))
  };
}

// ===== النسخ الاحتياطي =====
async function exportBackup() {
  const [cyls, workers, msgs] = await Promise.all([getCylinders(), getWorkers(), getMessages()]);
  const data = { exportDate: new Date().toISOString(), cylinders: cyls, workers: workers.map(w => ({ ...w, pass: '***' })), messages: msgs };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SCH-backup-${new Date().toLocaleDateString('en')}.json`;
  a.click(); URL.revokeObjectURL(url);
}

// ===== الاستماع الفوري =====
function listenCylinders(cb) {
  return onSnapshot(query(collection(db, 'cylinders'), orderBy('createdAt', 'desc')), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function listenUnread(userId, cb) {
  return onSnapshot(query(collection(db, 'notifications'), where('to', '==', userId), where('read', '==', false)), snap => cb(snap.size));
}

function listenMsgs(userId, cb) {
  return onSnapshot(query(collection(db, 'messages'), where('to', '==', userId), where('read', '==', false)), snap => cb(snap.size));
}

// ===== تصدير =====
window.SCH = {
  IRON_STAGES, CHROME_STAGES, SHIFTS, db,
  fmtTime, fmtDuration, calcDuration, getCurrentShift, isLate, isStuck, statusLabel, statusClass,
  initAdmin, loginUser, getWorkers, getUserById, addWorker, deleteWorkerById, changePass, changeWorkerPass,
  addCylinder, getCylinders, getCylById, updateCyl, deleteCylinderById,
  advanceStage, goBackStage, rejectCyl, reinstateCyl, deliverCyl,
  sendMessage, getMessages, getMyMessages, confirmRead,
  addNotif, getMyNotifs, markNotifsRead,
  getStats, exportBackup,
  listenCylinders, listenUnread, listenMsgs
};
