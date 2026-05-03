// ============================================================
// بيت السلندر السوري - app.js المُصلح
// إصلاح: ١-ظهور السلندر للعمال ٢-تشفير كلمات المرور ٣-الطباعة
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

const IRON_STAGES = ['مخارط','بوليش تلبيس','أحواض نيكل','أحواض نحاس','بوليش للحفر','حفر','أحواض كروم','بوليش كروم','بروفا','تغليف'];
const CHROME_STAGES = ['أحواض ديكروم','بوليش تلبيس','أحواض','بوليش للحفر','حفر','أحواض كروم','بوليش كروم','بروفا','تغليف'];
const SHIFTS = {
  morning: { label:'صباحية', time:'8ص-4م', icon:'🌅' },
  evening: { label:'مسائية', time:'4م-12م', icon:'🌆' },
  night:   { label:'ليلية',  time:'12م-8ص', icon:'🌙' }
};

// إصلاح #٢: تشفير كلمات المرور
async function hashPass(pass) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pass + 'SCH_SALT_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function fmtTime(ts) {
  if (!ts) return '-';
  let d;
  if (ts?.toDate) d = ts.toDate();
  else if (ts?.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ar-SY', { year:'numeric', month:'2-digit', day:'2-digit' }) +
         ' ' + d.toLocaleTimeString('ar-SY', { hour:'2-digit', minute:'2-digit' });
}

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

function isStageDelayed(cyl) {
  if (!cyl.stageStartTime || cyl.status !== 'active') return false;
  return (new Date() - new Date(cyl.stageStartTime)) > 24 * 60 * 60 * 1000;
}

// إصلاح #١: فلترة السلندرات للعامل
function isVisibleToWorker(cyl, workerId) {
  if (cyl.status === 'rejected') return false;
  if (cyl.visibility === 'all') return true;
  if (cyl.assignedWorker === workerId) return true;
  if (cyl.history?.some(h => h.by === workerId)) return true;
  return false;
}

async function initAdmin() {
  const ref = doc(db, 'users', 'admin');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const hashed = await hashPass('Admin');
    await setDoc(ref, { id:'admin', name:'المدير', role:'manager', pass:hashed, active:true, createdAt:serverTimestamp() });
  } else {
    const data = snap.data();
    if (data.pass && data.pass.length < 60) {
      await updateDoc(ref, { pass: await hashPass(data.pass) });
    }
  }
}

async function loginUser(uid, pass) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const u = snap.data();
  if (!u.active) return null;
  const hashed = await hashPass(pass);
  if (u.pass !== hashed && u.pass !== pass) return null;
  if (u.pass === pass && u.pass.length < 60) {
    await updateDoc(doc(db, 'users', uid), { pass: hashed });
  }
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
  const hashed = await hashPass(pass);
  await setDoc(ref, { id:username, name, role:'worker', pass:hashed, active:true, shift:shift||'morning', machine:machine||'', createdAt:serverTimestamp() });
  return { ok:true };
}

async function changePass(userId, oldPass, newPass) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return { ok:false, msg:'المستخدم غير موجود' };
  const u = snap.data();
  const oldHashed = await hashPass(oldPass);
  if (u.pass !== oldHashed && u.pass !== oldPass) return { ok:false, msg:'كلمة المرور الحالية غير صحيحة' };
  await updateDoc(doc(db, 'users', userId), { pass: await hashPass(newPass) });
  return { ok:true };
}

async function changeWorkerPass(wid, pass) {
  await updateDoc(doc(db, 'users', wid), { pass: await hashPass(pass) });
  return { ok:true };
}

async function addCylinder(data) {
  const stages = data.type === 'iron' ? [...IRON_STAGES] : [...CHROME_STAGES];
  const now = new Date().toISOString();
  const cyl = {
    code:data.code, type:data.type, press:data.press,
    edition:data.edition||'', entryDate:data.entryDate||'',
    deliveryDate:data.deliveryDate||'', notes:data.notes||'',
    stages, currentStageIndex:0, status:'active',
    stageStartTime:now,
    history:[{ stage:stages[0], time:now, startTime:now, endTime:null, duration:null, by:data.by, byName:data.byName||'المدير', note:'بدء التشغيل', shift:getCurrentShift() }],
    defects:[],
    assignedWorker:data.assignedWorker||null,
    visibility:data.assignedWorker ? 'assigned' : 'all',
    rejectReason:null, rejectBy:null, rejectByName:null, rejectAt:null,
    deliveredTo:null, deliveredAt:null,
    createdAt:serverTimestamp(), createdBy:data.by
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

async function updateCyl(id, changes) { await updateDoc(doc(db, 'cylinders', id), changes); }
async function deleteCyl(id) { await deleteDoc(doc(db, 'cylinders', id)); }

async function advanceStage(cylId, workerId, workerName, note) {
  const cyl = await getCylById(cylId);
  if (!cyl || cyl.status !== 'active') return { ok:false, msg:'لا يمكن تقديم هذا السلندر' };
  if (cyl.currentStageIndex >= cyl.stages.length - 1) return { ok:false, msg:'السلندر في آخر مرحلة' };
  const now = new Date().toISOString();
  const nextIdx = cyl.currentStageIndex + 1;
  const history = [...(cyl.history||[])];
  if (history.length > 0) {
    const last = { ...history[history.length-1] };
    last.endTime = now; last.duration = calcDuration(last.startTime||cyl.stageStartTime, now);
    history[history.length-1] = last;
  }
  history.push({ stage:cyl.stages[nextIdx], time:now, startTime:now, endTime:null, duration:null, by:workerId, byName:workerName, note:note||'', shift:getCurrentShift() });
  await updateCyl(cylId, { currentStageIndex:nextIdx, history, stageStartTime:now });
  if (nextIdx === cyl.stages.length-1) await addNotif('admin', `🎉 السلندر ${cyl.code} وصل لآخر مرحلة — جاهز للتسليم!`, 'complete');
  else await addNotif('admin', `السلندر ${cyl.code} انتقل إلى: ${cyl.stages[nextIdx]} — ${workerName}`, 'info');
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
    const last = { ...history[history.length-1] };
    last.endTime = now; last.duration = calcDuration(last.startTime, now);
    history[history.length-1] = last;
  }
  history.push({ stage:`← رجوع: ${cyl.stages[prevIdx]}`, time:now, startTime:now, endTime:null, duration:null, by:workerId, byName:workerName, note:reason||'رجوع', shift:getCurrentShift() });
  await updateCyl(cylId, { currentStageIndex:prevIdx, history, stageStartTime:now });
  return { ok:true };
}

async function rejectCyl(cylId, reason, workerId, workerName, restageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[])];
  if (history.length > 0) {
    const last = { ...history[history.length-1] };
    last.endTime = now; last.duration = calcDuration(last.startTime, now);
    history[history.length-1] = last;
  }
  history.push({ stage:'⚠ إبلاغ عيب', time:now, startTime:now, endTime:now, duration:0, by:workerId, byName:workerName, note:reason, shift:getCurrentShift() });
  const defects = [...(cyl.defects||[]), { reason, by:workerId, byName:workerName, stage:cyl.stages[cyl.currentStageIndex], restageIndex, time:now }];
  await updateCyl(cylId, { status:'rejected', rejectReason:reason, rejectBy:workerId, rejectByName:workerName, rejectAt:now, currentStageIndex:restageIndex!==undefined?restageIndex:cyl.currentStageIndex, history, defects });
  await addNotif('admin', `⚠ السلندر ${cyl.code} فيه عيب: ${reason} — ${workerName}`, 'warning');
  return { ok:true };
}

async function reinstateCyl(cylId, stageIndex) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[]), { stage:`🔄 إعادة تشغيل من: ${cyl.stages[stageIndex]}`, time:now, startTime:now, endTime:null, duration:null, by:'admin', byName:'المدير', note:'', shift:getCurrentShift() }];
  await updateCyl(cylId, { status:'active', rejectReason:null, rejectBy:null, rejectByName:null, rejectAt:null, currentStageIndex:stageIndex, history, stageStartTime:now });
  return { ok:true };
}

async function deliverCyl(cylId, deliveredTo) {
  const cyl = await getCylById(cylId);
  if (!cyl) return { ok:false };
  const now = new Date().toISOString();
  const history = [...(cyl.history||[])];
  if (history.length > 0) {
    const last = { ...history[history.length-1] };
    last.endTime = now; last.duration = calcDuration(last.startTime, now);
    history[history.length-1] = last;
  }
  history.push({ stage:'✅ تسليم للعميل', time:now, startTime:now, endTime:now, duration:0, by:'admin', byName:'المدير', note:`تسلّم: ${deliveredTo}`, shift:getCurrentShift() });
  await updateCyl(cylId, { status:'delivered', deliveredTo, deliveredAt:now, history });
  return { ok:true };
}

async function sendMessage(toId, fromId, fromName, text) {
  await addDoc(collection(db,'messages'), { to:toId, from:fromId, fromName, text, time:serverTimestamp(), read:false, confirmed:false, confirmedAt:null });
  await addNotif(toId, `✉️ رسالة جديدة من ${fromName}`, 'message');
}

async function getMessages() {
  const snap = await getDocs(query(collection(db,'messages'), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function getMyMessages(userId) {
  const snap = await getDocs(query(collection(db,'messages'), where('to','==',userId), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function confirmRead(msgId, userId, userName) {
  await updateDoc(doc(db,'messages',msgId), { read:true, confirmed:true, confirmedAt:new Date().toISOString() });
  await addNotif('admin', `✅ ${userName} قرأ رسالتك`, 'info');
}

async function addNotif(toId, text, type='info') {
  await addDoc(collection(db,'notifications'), { to:toId, text, type, time:serverTimestamp(), read:false });
}

async function getMyNotifs(userId) {
  const snap = await getDocs(query(collection(db,'notifications'), where('to','==',userId), orderBy('time','desc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).slice(0,30);
}

async function markNotifsRead(userId) {
  const snap = await getDocs(query(collection(db,'notifications'), where('to','==',userId), where('read','==',false)));
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read:true })));
}

async function getStats() {
  const [cyls,workers] = await Promise.all([getCylinders(),getWorkers()]);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayCyls = cyls.filter(c => { const d=c.createdAt?.toDate?c.createdAt.toDate():new Date(c.createdAt||0); return d>=today; });
  const stageDelayed = cyls.filter(c => isStageDelayed(c));
  const lateCyls = cyls.filter(c => c.status==='active'&&isLate(c.deliveryDate));
  const defectStages = {};
  cyls.forEach(c => { (c.defects||[]).forEach(def => { defectStages[def.stage]=(defectStages[def.stage]||0)+1; }); });
  const topDefects = Object.entries(defectStages).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const stageTimes = {};
  cyls.forEach(c => {
    (c.history||[]).forEach(h => {
      if (h.duration&&h.duration>0&&!h.stage.includes('←')&&!h.stage.includes('⚠')&&!h.stage.includes('🔄')&&!h.stage.includes('✅')) {
        if (!stageTimes[h.stage]) stageTimes[h.stage]=[];
        stageTimes[h.stage].push(h.duration);
      }
    });
  });
  const avgStageTimes = Object.entries(stageTimes).map(([stage,times])=>({ stage, avg:times.reduce((a,b)=>a+b,0)/times.length, count:times.length }));
  return {
    total:cyls.length, active:cyls.filter(c=>c.status==='active').length,
    rejected:cyls.filter(c=>c.status==='rejected').length, delivered:cyls.filter(c=>c.status==='delivered').length,
    late:lateCyls.length, stageDelayed:stageDelayed.length, todayAdded:todayCyls.length,
    cylinders:cyls, lateCyls, stageDelayed, topDefects, avgStageTimes,
    workers:workers.map(w=>({ ...w, done:cyls.filter(c=>c.history?.some(h=>h.by===w.id&&!h.stage.includes('←')&&!h.stage.includes('⚠'))).length, defects:(cyls.flatMap(c=>c.defects||[])).filter(d=>d.by===w.id).length }))
  };
}

async function exportDailyReport() {
  const stats = await getStats();
  const report = { date:new Date().toLocaleDateString('ar-SY'), summary:{total:stats.total,active:stats.active,rejected:stats.rejected,delivered:stats.delivered,todayAdded:stats.todayAdded,late:stats.late}, defects:stats.cylinders.flatMap(c=>(c.defects||[]).map(d=>({cylinder:c.code,press:c.press,reason:d.reason,stage:d.stage,worker:d.byName,time:d.time}))), workerPerformance:stats.workers.map(w=>({name:w.name,shift:SHIFTS[w.shift||'morning'].label,completed:w.done,defects:w.defects})) };
  const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`SCH-report-${new Date().toLocaleDateString('en')}.json`; a.click(); URL.revokeObjectURL(url);
}

async function exportBackup() {
  const [cyls,workers,msgs] = await Promise.all([getCylinders(),getWorkers(),getMessages()]);
  const data = { exportDate:new Date().toISOString(), cylinders:cyls, workers:workers.map(w=>({...w,pass:'***'})), messages:msgs };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`SCH-backup-${new Date().toLocaleDateString('en')}.json`; a.click(); URL.revokeObjectURL(url);
}

function listenCylinders(cb) {
  return onSnapshot(query(collection(db,'cylinders'),orderBy('createdAt','desc')), snap=>{ cb(snap.docs.map(d=>({id:d.id,...d.data()}))); });
}
function listenUnread(userId,cb) { return onSnapshot(query(collection(db,'notifications'),where('to','==',userId),where('read','==',false)),snap=>cb(snap.size)); }
function listenMsgs(userId,cb) { return onSnapshot(query(collection(db,'messages'),where('to','==',userId),where('read','==',false)),snap=>cb(snap.size)); }

window.SCH = {
  IRON_STAGES,CHROME_STAGES,SHIFTS,db,
  fmtTime,fmtDuration,calcDuration,getCurrentShift,isLate,isStageDelayed,isVisibleToWorker,statusLabel,statusClass,
  initAdmin,loginUser,getWorkers,getUserById,addWorker,changePass,changeWorkerPass,
  addCylinder,getCylinders,getCylById,updateCyl,deleteCyl,
  advanceStage,goBackStage,rejectCyl,reinstateCyl,deliverCyl,
  sendMessage,getMessages,getMyMessages,confirmRead,
  addNotif,getMyNotifs,markNotifsRead,
  getStats,exportDailyReport,exportBackup,
  listenCylinders,listenUnread,listenMsgs
};
