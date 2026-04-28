// ============================================================
// بيت السلندر السوري - app.js الكامل المُصلح
// إصلاح جميع البنود 1-23
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
  morning: { label:'صباحية', time:'8ص-4م', icon:'🌅' },
  evening: { label:'مسائية', time:'4م-12م', icon:'🌆' },
  night:   { label:'ليلية',  time:'12م-8ص', icon:'🌙' }
};

// ===== إصلاح #17: دالة تنسيق الوقت الصحيحة =====
function fmtTime(ts) {
  if (!ts) return '-';
  let d;
  if (ts?.toDate) d = ts.toDate();
  else if (ts?.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  // استخدام التاريخ الصحيح
  return d.toLocaleDateString('ar-SY', { year:'numeric', month:'2-digit', day:'2-digit' }) +
         ' ' + d.toLocaleTimeString('ar-SY', { hour:'2-digit', minute:'2-digit' });
}

// إصلاح #19: حساب المدة الصحيحة
function fmtDuration(ms) {
  if (!ms || ms <= 0) return '-';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'أقل من دقيقة';
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} يوم ${h % 24} ساعة`;
  if (h > 0) return `${h} ساعة ${m % 60} دقيقة`;
  return `${m} دقيقة`;
}

function calcDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso), e = new Date(endIso);
  if (isNaN(s) || isNaN(e)) return null;
  const diff = e - s;
  return diff > 0 ? diff : null;
}

function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 8 && h < 16) return 'morning';
  if (h >= 16) return 'evening';
  return 'night';
}

// إصلاح #10: حالة السلندر المسلَّم
function statusLabel(s, late) {
  if (s === 'delivered') return '✅ تم التسليم';
  if (late && s === 'active') return '⏰ متأخر';
  return s === 'active' ? '🔵 نشط' : '⚠ مرفوض';
}

function statusClass(s, late) {
  if (s === 'delivered') return 'delivered';
  if (late && s === 'active') return 'late';
  return s;
}

function isLate(deliveryDate) {
  if (!deliveryDate) return false;
  return new Date() > new Date(deliveryDate);
}

// إصلاح #12: تأخر في المرحلة أكثر من 24 ساعة
function isStageDelayed(cyl) {
  if (!cyl.stageStartTime || cyl.status !== 'active') return false;
  const start = new Date(cyl.stageStartTime);
  return (new Date() - start) > 24 * 60 * 60 * 1000;
}

// ===== المستخدمون =====
async function initAdmin() {
  const ref = doc(db, 'users', 'admin');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { id:'admin', name:'المدير', role:'manager', pass:'Admin', active:true, createdAt:serverTimestamp() });
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
  const snap = await getDocs(query(collection(db, 'users'), where('role','==','worker')));
  return snap.docs.map(d => d.data());
}

async function getUserById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, 'users', id));
  return snap.exists() ? snap.data() : null;
}

async function addWorker(name, username, pass, shift, machine) {
  const ref = doc(db, 'users', username);
  if ((await getDoc(ref)).exists()) return { ok:false, msg:'اسم المستخدم مستخدم مسبقاً' };
  await setDoc(ref, { id:username, name, role:'worker', pass, active:true, shift:shift||'morning', machine:machine||'', createdAt:serverTimestamp() });
  return { ok:true };
}

async function changePass(userId, oldPass, newPass) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return { ok:false, msg:'المستخدم غير موجود' };
  if (snap.data().pass !== oldPass) return { ok:false, msg:'كلمة المرور الحالية غير صحيحة' };
  await updateDoc(doc(db, 'users', userId), { pass:newPass });
  return { ok:true };
}

async function changeWorkerPass(wid, pass) {
  await updateDoc(doc(db, 'users', wid), { pass });
  return { ok:true };
}

// ===== السلندرات =====
async function addCylinder(data) {
  const stages = data.type === 'iron' ? [...IRON_STAGES] : [...CHROME_STAGES];
  const now = new Date().toISOString();
  // إصلاح #20: تسجيل بيانات المرحلة الأولى عند البداية
  const cyl = {
    code: data.code, type: data.type, press: data.press,
    edition: data.edition||'', entryDate: data.entryDate||'',
    deliveryDate: data.deliveryDate||'', notes: data.notes||'',
    stages, currentStageIndex: 0, status: 'active',
    stageStartTime: now,
    history: [{
      stage: stages[0],
      time: now,
      startTime: now,
      endTime: null,
      duration: null,
      by: data.by,
      byName: data.byName||'المدير',
      note: 'بدء التشغيل',
      shift: getCurrentShift()
    }],
    defects: [], // إصلاح #22: سجل العيوب المنفصل
    assignedWorker: data.assignedWorker||null,
    rejectReason: null, rejectBy: null, rejectByName: null, rejectAt: null,
    deliveredTo: null, deliveredAt: null,
    createdAt: serverTimestamp(), createdBy: data.by
  };
  const ref = await addDoc(collection(db, 'cylinders'), cyl);
  return { id:ref.id, ...cyl };
}

async function getCylinders() {
  const snap = await getDocs(query(collection(db, 'cylinders'), orderBy('createdAt','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function getCylById(id) {
  const snap = await getDoc(doc(db, 'cylinders', id));
  return snap.exists() ? { id:snap.id, ...snap.data() } : null;
}

async function updateCyl(id, changes) {
  await updateDoc(doc(db, 'cylinders', id), changes);
}

// إصلاح #8: حذف سلندر
async function deleteCyl(id) {
  await deleteDoc(doc(db, 'cylinders', id));
}

// إصلاح #14: تسجيل وقت البداية والنهاية والمدة بشكل صحيح
async function advanceStage(cylId, workerId, workerName, note) {
  const cyl = await getCylById(cylId);
  if (!cyl || cyl.status !== 'active') return { ok:false, msg:'لا يمكن تقديم هذا السلندر' };
  if (cyl.currentStageIndex >= cyl.stages.length - 1) return { ok:false, msg:'السلندر في آخر مرحلة' };
  const now = new Date().toISOString();
  const nextIdx = cyl.currentStageIndex + 1;
  const history = [...(cyl.history||[])];
  // تحديث وقت نهاية المرحلة الحالية والمدة
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now;
    last.duration = calcDuration(last.startTime || cyl.stageStartTime, now);
    history[history.length - 1] = last;
  }
  // إضافة المرحلة الجديدة مع وقت البداية
  history.push({
    stage: cyl.stages[nextIdx],
    time: now,
    startTime: now,
    endTime: null,
    duration: null,
    by: workerId,
    byName: workerName,
    note: note||'',
    shift: getCurrentShift()
  });
  await updateCyl(cylId, { currentStageIndex:nextIdx, history, stageStartTime:now });
  // إصلاح #13: إشعار اكتمال السلندر عند آخر مرحلة
  if (nextIdx === cyl.stages.length - 1) {
    await addNotif('admin', `🎉 السلندر ${cyl.code} وصل لآخر مرحلة (${cyl.stages[nextIdx]}) - جاهز للتسليم!`, 'complete');
  } else {
    await addNotif('admin', `السلندر ${cyl.code} انتقل إلى: ${cyl.stages[nextIdx]} — ${workerName}`, 'info');
  }
  return { ok:true };
}

async function goBackStage(cylId, workerId, workerName, reason) {
  const cyl = await getCylById(cylId);
  if (!cyl || cyl.status !== 'active') return { ok:false, msg:'لا يمكن الرجوع' };
  if (cyl.currentStageIndex === 0) return { ok:false, msg:'أنت في أول مرحلة' };
  const now = new Date().toISOString();
  const prevIdx = cyl.currentStageIndex - 1;
  const history = [...(cyl.history||[])];
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now;
    last.duration = calcDuration(last.startTime, now);
    history[history.length - 1] = last;
  }
  history.push({
    stage: `← رجوع: ${cyl.stages[prevIdx]}`,
    time: now, startTime: now, endTime: null, duration: null,
    by: workerId, byName: workerName,
    note: reason||'رجوع للمرحلة السابقة',
    shift: getCurrentShift()
  });
  await updateCyl(cylId, { currentStageIndex:prevIdx, history, stageStartTime:now });
  return { ok:true };
}

// إصلاح #7 و #2: العامل يبلغ عن عيب ويعيد — السلندر يختفي من قائمة العامل
async function rejectCyl(cylId, reason, workerId, workerName, restageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[])];
  // تحديث نهاية المرحلة الحالية
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now;
    last.duration = calcDuration(last.startTime, now);
    history[history.length - 1] = last;
  }
  history.push({
    stage: '⚠ إبلاغ عيب',
    time: now, startTime: now, endTime: now, duration: 0,
    by: workerId, byName: workerName,
    note: reason, shift: getCurrentShift()
  });
  // إصلاح #22: إضافة للسجل المنفصل للعيوب
  const defects = [...(cyl.defects||[]), {
    reason, by: workerId, byName: workerName,
    stage: cyl.stages[cyl.currentStageIndex],
    restageIndex, time: now
  }];
  // إصلاح #2: تحويل للمرفوض — يختفي من العامل
  await updateCyl(cylId, {
    status: 'rejected',
    rejectReason: reason,
    rejectBy: workerId,
    rejectByName: workerName,
    rejectAt: now,
    currentStageIndex: restageIndex !== undefined ? restageIndex : cyl.currentStageIndex,
    history, defects
  });
  await addNotif('admin', `⚠ السلندر ${cyl.code} فيه عيب: ${reason} — بواسطة ${workerName}`, 'warning');
  return { ok:true };
}

async function reinstateCyl(cylId, stageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[]), {
    stage: `🔄 إعادة تشغيل من: ${cyl.stages[stageIndex]}`,
    time: now, startTime: now, endTime: null, duration: null,
    by: 'admin', byName: 'المدير',
    note: `إعادة من مرحلة: ${cyl.stages[stageIndex]}`,
    shift: getCurrentShift()
  }];
  await updateCyl(cylId, {
    status: 'active',
    rejectReason: null, rejectBy: null, rejectByName: null, rejectAt: null,
    currentStageIndex: stageIndex,
    history, stageStartTime: now
  });
  return { ok:true };
}

async function deliverCyl(cylId, deliveredTo) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[])];
  if (history.length > 0) {
    const last = { ...history[history.length - 1] };
    last.endTime = now;
    last.duration = calcDuration(last.startTime, now);
    history[history.length - 1] = last;
  }
  history.push({
    stage: '✅ تسليم للعميل',
    time: now, startTime: now, endTime: now, duration: 0,
    by: 'admin', byName: 'المدير',
    note: `تسلّم: ${deliveredTo}`,
    shift: getCurrentShift()
  });
  await updateCyl(cylId, { status:'delivered', deliveredTo, deliveredAt:now, history });
  return { ok:true };
}

// ===== الرسائل =====
async function sendMessage(toId, fromId, fromName, text) {
  await addDoc(collection(db, 'messages'), {
    to:toId, from:fromId, fromName, text,
    time:serverTimestamp(), read:false, confirmed:false, confirmedAt:null
  });
  await addNotif(toId, `✉️ رسالة جديدة من ${fromName}`, 'message');
}

async function getMessages() {
  const snap = await getDocs(query(collection(db, 'messages'), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function getMyMessages(userId) {
  const snap = await getDocs(query(collection(db, 'messages'), where('to','==',userId), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function confirmRead(msgId, userId, userName) {
  await updateDoc(doc(db, 'messages', msgId), { read:true, confirmed:true, confirmedAt:new Date().toISOString() });
  await addNotif('admin', `✅ ${userName} قرأ رسالتك`, 'info');
}

// ===== الإشعارات =====
async function addNotif(toId, text, type='info') {
  await addDoc(collection(db, 'notifications'), { to:toId, text, type, time:serverTimestamp(), read:false });
}

async function getMyNotifs(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('to','==',userId), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).slice(0, 30);
}

async function markNotifsRead(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('to','==',userId), where('read','==',false)));
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read:true })));
}

// ===== الإحصائيات =====
async function getStats() {
  const [cyls, workers] = await Promise.all([getCylinders(), getWorkers()]);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayCyls = cyls.filter(c => {
    const d = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt||0);
    return d >= today;
  });
  // إصلاح #12: تأخر في المرحلة أكثر من 24 ساعة
  const stageDelayed = cyls.filter(c => isStageDelayed(c));
  const lateCyls = cyls.filter(c => c.status === 'active' && isLate(c.deliveryDate));
  // أكثر المراحل عيوباً
  const defectStages = {};
  cyls.forEach(c => {
    (c.defects||[]).forEach(def => {
      defectStages[def.stage] = (defectStages[def.stage]||0) + 1;
    });
  });
  const topDefects = Object.entries(defectStages).sort((a,b) => b[1]-a[1]).slice(0,5);
  // متوسط وقت المراحل
  const stageTimes = {};
  cyls.forEach(c => {
    (c.history||[]).forEach(h => {
      if (h.duration && h.duration > 0 && !h.stage.includes('←') && !h.stage.includes('⚠') && !h.stage.includes('🔄') && !h.stage.includes('✅') && !h.stage.includes('تسليم')) {
        if (!stageTimes[h.stage]) stageTimes[h.stage] = [];
        stageTimes[h.stage].push(h.duration);
      }
    });
  });
  const avgStageTimes = Object.entries(stageTimes).map(([stage,times]) => ({
    stage, avg: times.reduce((a,b)=>a+b,0)/times.length, count:times.length
  }));

  return {
    total: cyls.length,
    active: cyls.filter(c=>c.status==='active').length,
    rejected: cyls.filter(c=>c.status==='rejected').length,
    delivered: cyls.filter(c=>c.status==='delivered').length,
    late: lateCyls.length,
    stageDelayed: stageDelayed.length,
    todayAdded: todayCyls.length,
    cylinders: cyls, lateCyls, stageDelayed, topDefects, avgStageTimes,
    workers: workers.map(w => ({
      ...w,
      done: cyls.filter(c => c.history?.some(h => h.by===w.id && !h.stage.includes('←') && !h.stage.includes('⚠'))).length,
      defects: (cyls.flatMap(c => c.defects||[])).filter(d => d.by===w.id).length
    }))
  };
}

// إصلاح #23: تصدير تقرير يومي
async function exportDailyReport() {
  const stats = await getStats();
  const today = new Date().toLocaleDateString('ar-SY');
  const report = {
    date: today,
    summary: {
      total: stats.total,
      active: stats.active,
      rejected: stats.rejected,
      delivered: stats.delivered,
      todayAdded: stats.todayAdded,
      late: stats.late
    },
    defects: stats.cylinders.flatMap(c => (c.defects||[]).map(d => ({
      cylinder: c.code, press: c.press, reason: d.reason,
      stage: d.stage, worker: d.byName, time: d.time
    }))),
    workerPerformance: stats.workers.map(w => ({
      name: w.name, shift: SHIFTS[w.shift||'morning'].label,
      completed: w.done, defects: w.defects
    }))
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SCH-report-${new Date().toLocaleDateString('en')}.json`;
  a.click(); URL.revokeObjectURL(url);
}

async function exportBackup() {
  const [cyls, workers, msgs] = await Promise.all([getCylinders(), getWorkers(), getMessages()]);
  const data = { exportDate: new Date().toISOString(), cylinders:cyls, workers:workers.map(w=>({...w,pass:'***'})), messages:msgs };
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SCH-backup-${new Date().toLocaleDateString('en')}.json`;
  a.click(); URL.revokeObjectURL(url);
}

// ===== الاستماع الفوري =====
function listenCylinders(cb) {
  return onSnapshot(query(collection(db,'cylinders'), orderBy('createdAt','desc')), snap => {
    cb(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

function listenUnread(userId, cb) {
  return onSnapshot(query(collection(db,'notifications'), where('to','==',userId), where('read','==',false)), snap => cb(snap.size));
}

function listenMsgs(userId, cb) {
  return onSnapshot(query(collection(db,'messages'), where('to','==',userId), where('read','==',false)), snap => cb(snap.size));
}

// ===== تصدير =====
window.SCH = {
  IRON_STAGES, CHROME_STAGES, SHIFTS, db,
  fmtTime, fmtDuration, calcDuration, getCurrentShift, isLate, isStageDelayed, statusLabel, statusClass,
  initAdmin, loginUser, getWorkers, getUserById, addWorker, changePass, changeWorkerPass,
  addCylinder, getCylinders, getCylById, updateCyl, deleteCyl,
  advanceStage, goBackStage, rejectCyl, reinstateCyl, deliverCyl,
  sendMessage, getMessages, getMyMessages, confirmRead,
  addNotif, getMyNotifs, markNotifsRead,
  getStats, exportDailyReport, exportBackup,
  listenCylinders, listenUnread, listenMsgs
};
