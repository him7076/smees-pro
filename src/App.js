import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { 
  LayoutDashboard, 
  ReceiptText, 
  CheckSquare, 
  Users, 
  Plus, 
  Search, 
  ChevronRight, 
  Trash2, 
  Package, 
  Settings,
  X,
  Calendar,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  History,
  ShoppingCart,
  Play,
  Square,
  Printer,
  Share2,
  TrendingUp,
  Banknote,
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Info,
  Clock,
  Navigation,
  Edit2,
  Filter,
  Link as LinkIcon,
  ExternalLink,
  FileText,
  BarChart3,
  PieChart,
  LogOut,
  Map,
  Upload,
  UserCheck,
  Coffee,
  LogIn,
  Save,
  MessageCircle,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAQgIJYRf-QOWADeIKiTyc-lGL8PzOgWvI",
  authDomain: "smeestest.firebaseapp.com",
  projectId: "smeestest",
  storageBucket: "smeestest.firebasestorage.app",
  messagingSenderId: "1086297510582",
  appId: "1:1086297510582:web:7ae94f1d7ce38d1fef8c17",
  measurementId: "G-BQ6NW6D84Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const INITIAL_DATA = {
  company: { name: "My Enterprise", mobile: "", address: "", financialYear: "2024-25", currency: "₹" },
  parties: [],
  items: [],
  staff: [],
  attendance: [],
  transactions: [],
  tasks: [],
  categories: {
    expense: ["Rent", "Electricity", "Marketing", "Salary"],
    item: ["Electronics", "Grocery", "General", "Furniture", "Pharmacy"]
  },
  counters: { 
      sales: 921, 
      purchase: 228, 
      expense: 910, 
      payment: 1663,
      task: 508,
      party: 658, 
      item: 1184, 
      staff: 103, 
      estimate: 100,
      transaction: 1000
  }
};

// --- HELPER FUNCTIONS ---
const getNextId = (data, type) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;

  if (type === 'sales') { prefix = 'Sales:'; counterKey = 'sales'; } 
  else if (type === 'purchase') { prefix = 'Purchase:'; counterKey = 'purchase'; } 
  else if (type === 'expense') { prefix = 'Expense:'; counterKey = 'expense'; } 
  else if (type === 'payment') { prefix = 'Payment:'; counterKey = 'payment'; } 
  else if (type === 'estimate') { prefix = 'EST'; counterKey = 'estimate'; } 
  else if (type === 'task') { prefix = 'T'; counterKey = 'task'; } 
  else if (type === 'transaction') { prefix = 'TX'; counterKey = 'transaction'; }

  const counters = (data && data.counters) ? data.counters : INITIAL_DATA.counters;
  const num = counters[counterKey] || 1; 
  const nextCounters = { ...counters };
  nextCounters[counterKey] = num + 1;
  return { id: `${prefix}-${num}`, nextCounters };
};

const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const getTransactionTotals = (tx) => {
  if (tx.status === 'Cancelled') return { gross: 0, final: 0, paid: 0, status: 'CANCELLED', amount: 0 };
  const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
  let discVal = parseFloat(tx.discountValue || 0);
  if (tx.discountType === '%') discVal = (gross * discVal) / 100;
  const final = gross - discVal;
  const paid = parseFloat(tx.received || tx.paid || 0);
  let status = 'UNPAID';
  if (paid >= final - 0.1 && final > 0) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  return { gross, final, paid, status, amount: parseFloat(tx.amount || 0) || final };
};

const sortData = (data, criterion) => {
    if (!criterion) return data;
    const sorted = [...data];
    switch (criterion) {
        case 'A-Z': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        case 'Z-A': return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        case 'DateAsc': return sorted.sort((a, b) => new Date(a.date || a.dueDate || 0) - new Date(b.date || b.dueDate || 0));
        case 'DateDesc': return sorted.sort((a, b) => new Date(b.date || b.dueDate || 0) - new Date(a.date || a.dueDate || 0));
        case 'AmtAsc': return sorted.sort((a, b) => (parseFloat(a.amount || a.finalTotal || 0) - parseFloat(b.amount || b.finalTotal || 0)));
        case 'AmtDesc': return sorted.sort((a, b) => (parseFloat(b.amount || b.finalTotal || 0) - parseFloat(a.amount || a.finalTotal || 0)));
        default: return sorted;
    }
};

const checkPermission = (user, permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return !!user.permissions?.[permission];
};

const cleanData = (obj) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) newObj[key] = "";
    });
    return newObj;
};

// --- EXTERNALIZED SUB-COMPONENTS ---

const LoginScreen = ({ setUser }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async () => {
      if(id === 'him23' && pass === 'Himanshu#3499sp') {
          const adminUser = { name: 'Admin', role: 'admin', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } };
          setUser(adminUser);
          localStorage.setItem('smees_user', JSON.stringify(adminUser));
      } else {
          try {
              await signInAnonymously(auth);
              const q = query(collection(db, 'staff'), where('loginId', '==', id), where('password', '==', pass));
              const snap = await getDocs(q);
              if(!snap.empty) {
                  const userData = snap.docs[0].data();
                  const defaults = { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true };
                  const staffUser = { ...userData, permissions: { ...defaults, ...userData.permissions } };
                  setUser(staffUser);
                  localStorage.setItem('smees_user', JSON.stringify(staffUser));
              } else {
                  setErr("Invalid ID or Password");
              }
          } catch (e) {
              console.error(e);
              setErr("Connection Error or Invalid Credentials");
          }
      }
  };

  return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm">
              <div className="flex justify-center mb-8"><div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black italic">S</div></div>
              <h1 className="text-2xl font-bold text-center mb-6">SMEES Pro Login</h1>
              <input className="w-full p-4 mb-4 bg-gray-50 border rounded-xl" placeholder="Login ID" value={id} onChange={e=>setId(e.target.value)}/>
              <input className="w-full p-4 mb-4 bg-gray-50 border rounded-xl" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)}/>
              {err && <p className="text-red-500 text-sm mb-4 text-center">{err}</p>}
              <button onClick={handleLogin} className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold text-lg">Login</button>
          </div>
      </div>
  );
};

const ConvertTaskModal = ({ task, onClose, saveRecord, setViewDetail, handleCloseUI }) => {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], received: '', mode: 'Cash' });

  const handleConfirm = async () => {
      const saleItems = (task.itemsUsed || []).map(i => ({ 
          itemId: i.itemId, 
          qty: i.qty, 
          price: i.price, 
          buyPrice: i.buyPrice || 0, 
          description: i.description || '' 
      }));
      
      const gross = saleItems.reduce((acc, i) => acc + (parseFloat(i.qty)*parseFloat(i.price)), 0);
      
      const workDoneBy = (task.timeLogs || []).map(l => `${l.staffName} (${l.duration}m)`).join(', ');
      const totalMins = (task.timeLogs || []).reduce((acc,l) => acc + (parseFloat(l.duration)||0), 0);
      const workSummary = `${workDoneBy} | Total: ${totalMins} mins`;
      
      const newSale = { 
          type: 'sales', 
          date: form.date, 
          partyId: task.partyId, 
          items: saleItems, 
          discountType: '%', 
          discountValue: 0, 
          received: parseFloat(form.received || 0), 
          paymentMode: form.mode, 
          grossTotal: gross, 
          finalTotal: gross, 
          convertedFromTask: task.id, 
          workSummary: workSummary, 
          description: `Converted from Task ${task.id}. Work: ${workSummary}` 
      };
      
      const saleId = await saveRecord('transactions', newSale, 'sales');
      
      const updatedTask = { ...task, status: 'Converted', generatedSaleId: saleId };
      await saveRecord('tasks', updatedTask, 'task');
      
      onClose(); 
      setViewDetail(null); 
      handleCloseUI();
  };
   
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Convert to Sale</h3>
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Conversion Date</label>
                    <input type="date" className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Payment Mode</label>
                    <select className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}>
                        <option>Cash</option>
                        <option>Bank</option>
                        <option>UPI</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Received Amount</label>
                    <input type="number" className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" placeholder="0.00" value={form.received} onChange={e => setForm({...form, received: e.target.value})}/>
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={handleCloseUI} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-600">Cancel</button>
                    <button onClick={handleConfirm} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200">Confirm & Save</button>
                </div>
            </div>
        </div>
    </div>
  );
};

const StatementModal = ({ isOpen, onClose }) => {
  const [dates, setDates] = useState({ start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
   
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">Statement</h3>
        <div className="space-y-4">
          <input type="date" className="w-full p-3 border rounded-xl" value={dates.start} onChange={e=>setDates({...dates, start:e.target.value})}/>
          <input type="date" className="w-full p-3 border rounded-xl" value={dates.end} onChange={e=>setDates({...dates, end:e.target.value})}/>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 p-3 bg-gray-100 rounded-xl">Cancel</button>
            <button className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Generate</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ManualAttendanceModal = ({ manualAttModal, setManualAttModal, data, setData, handleCloseUI, showToast }) => {
  const [form, setForm] = useState({ date: '', in: '', out: '', lStart: '', lEnd: '' });
   
  useEffect(() => {
      if (manualAttModal) {
          const initial = manualAttModal.isEdit ? manualAttModal : { date: new Date().toISOString().split('T')[0], checkIn: '09:00', checkOut: '18:00', lunchStart: '13:00', lunchEnd: '14:00' };
          setForm({
              date: initial.date,
              in: initial.checkIn || '09:00',
              out: initial.checkOut || '18:00',
              lStart: initial.lunchStart || '',
              lEnd: initial.lunchEnd || ''
          });
      }
  }, [manualAttModal]);

  if (!manualAttModal) return null;
   
  const handleSave = async () => {
      const staffId = manualAttModal.staffId || manualAttModal.id.split('-')[1]; 
      const attId = manualAttModal.isEdit ? manualAttModal.id : `ATT-${staffId}-${form.date}`;
      
      const record = { 
          staffId, 
          date: form.date, 
          checkIn: form.in, 
          checkOut: form.out, 
          lunchStart: form.lStart, 
          lunchEnd: form.lEnd, 
          id: attId, 
          status: 'Present' 
      };
      
      const newAtt = [...data.attendance.filter(a => a.id !== attId), record];
      setData(prev => ({ ...prev, attendance: newAtt }));
      await setDoc(doc(db, "attendance", attId), record);
      setManualAttModal(false); 
      handleCloseUI(); 
      showToast(manualAttModal.isEdit ? "Updated" : "Added");
  };
   
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">{manualAttModal.isEdit ? 'Edit' : 'Manual'} Attendance</h3>
        <div className="space-y-4">
          <input type="date" disabled={manualAttModal.isEdit} className="w-full p-3 border rounded-xl" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <input type="time" className="w-full p-3 border rounded-xl" value={form.in} onChange={e=>setForm({...form, in: e.target.value})} />
            <input type="time" className="w-full p-3 border rounded-xl" value={form.out} onChange={e=>setForm({...form, out: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="time" className="w-full p-3 border rounded-xl bg-yellow-50" placeholder="Lunch Start" value={form.lStart} onChange={e=>setForm({...form, lStart: e.target.value})} />
            <input type="time" className="w-full p-3 border rounded-xl" placeholder="Lunch End" value={form.lEnd} onChange={e=>setForm({...form, lEnd: e.target.value})} />
          </div>
          <button onClick={handleSave} className="w-full p-3 bg-blue-600 text-white rounded-xl font-bold">Save Entry</button>
        </div>
      </div>
    </div>
  );
}

const CashAdjustmentModal = ({ adjustCashModal, setAdjustCashModal, saveRecord, handleCloseUI }) => {
  const [form, setForm] = useState({ 
      action: 'Increase',
      amount: '', 
      description: 'Manual Adjustment',
      date: new Date().toISOString().split('T')[0]
  });

  if (!adjustCashModal) return null;

  const handleSave = async () => {
      if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter valid amount");
      
      const subType = form.action === 'Increase' ? 'in' : 'out';
      const newTx = {
         type: 'payment',
         subType,
         date: form.date,
         partyId: '',
         amount: parseFloat(form.amount),
         paymentMode: adjustCashModal.type,
         discountValue: 0,
         discountType: 'Amt',
         linkedBills: [],
         description: form.description,
         category: 'Adjustment'
      };
      
      await saveRecord('transactions', newTx, 'transaction');
      setAdjustCashModal(null); 
      handleCloseUI();
  };

  return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">Adjust {adjustCashModal.type} Balance</h3>
              <div className="space-y-4">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button onClick={()=>setForm({...form, action: 'Increase'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${form.action==='Increase' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>Increase (+)</button>
                      <button onClick={()=>setForm({...form, action: 'Decrease'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${form.action==='Decrease' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Decrease (-)</button>
                  </div>
                  <input type="number" className="w-full p-3 border rounded-xl text-xl font-bold" placeholder="Amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  <input className="w-full p-3 border rounded-xl text-sm" placeholder="Reason / Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                  <input type="date" className="w-full p-3 border rounded-xl" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  <div className="flex gap-2">
                      <button onClick={() => { setAdjustCashModal(null); handleCloseUI(); }} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
                      <button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Save</button>
                  </div>
              </div>
          </div>
      </div>
  );
};

const TimeLogModal = ({ editingTimeLog, setEditingTimeLog, data, setData, handleCloseUI, showToast }) => {
    const [form, setForm] = useState({ start: '', end: '' });

    useEffect(() => {
        if (editingTimeLog) {
            const { task, index } = editingTimeLog;
            const log = task.timeLogs[index];
            setForm({
                start: log.start ? new Date(log.start).toISOString().slice(0, 16) : '',
                end: log.end ? new Date(log.end).toISOString().slice(0, 16) : ''
            });
        }
    }, [editingTimeLog]);

    if (!editingTimeLog) return null;

    const handleSave = async () => {
        const { task, index } = editingTimeLog;
        const start = new Date(form.start);
        const end = form.end ? new Date(form.end) : null;
        
        // Calculate new duration
        let duration = 0;
        if (end) {
            duration = ((end - start) / 1000 / 60).toFixed(0);
        }

        const updatedLogs = [...task.timeLogs];
        updatedLogs[index] = { ...updatedLogs[index], start: start.toISOString(), end: end ? end.toISOString() : null, duration };

        const updatedTask = { ...task, timeLogs: updatedLogs };
        
        setData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t)
        }));
        
        await setDoc(doc(db, "tasks", task.id), updatedTask);
        setEditingTimeLog(null);
        handleCloseUI();
        showToast("Time Log Updated");
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                <h3 className="font-bold text-lg mb-4">Edit Time Log</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Start Time</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-xl" value={form.start} onChange={e => setForm({...form, start: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">End Time</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-xl" value={form.end} onChange={e => setForm({...form, end: e.target.value})} />
                    </div>
                    <div className="flex gap-2 pt-2">
                          <button onClick={() => { setEditingTimeLog(null); handleCloseUI(); }} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
                          <button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimeLogDetailsModal = ({ selectedTimeLog, setSelectedTimeLog, handleCloseUI }) => {
    if (!selectedTimeLog) return null;
    const { task, index } = selectedTimeLog;
    const log = task.timeLogs[index];

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm relative">
                <button onClick={() => { setSelectedTimeLog(null); handleCloseUI(); }} className="absolute top-4 right-4 p-1 bg-gray-100 rounded-full"><X size={20}/></button>
                <h3 className="font-bold text-lg mb-4">Time Log Details</h3>
                <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-xl border">
                        <p className="text-xs font-bold text-gray-400 uppercase">Task</p>
                        <p className="font-bold">{task.name}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border">
                          <p className="text-xs font-bold text-gray-400 uppercase">Staff</p>
                          <p className="font-bold">{log.staffName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-gray-50 rounded-xl border">
                             <p className="text-xs font-bold text-gray-400 uppercase">Start</p>
                             <p className="text-sm font-bold">{new Date(log.start).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border">
                             <p className="text-xs font-bold text-gray-400 uppercase">End</p>
                             <p className="text-sm font-bold">{log.end ? new Date(log.end).toLocaleString() : 'Running'}</p>
                        </div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-500 uppercase">Duration</p>
                          <p className="font-black text-xl text-blue-700">{log.duration} mins</p>
                    </div>
                    {log.location && (
                        <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-green-600 uppercase">Location Captured</p>
                                <p className="text-[10px] text-gray-500">{log.location.lat.toFixed(5)}, {log.location.lng.toFixed(5)}</p>
                            </div>
                            <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-lg shadow-sm text-green-700">
                                <MapPin size={20}/>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={24} /></button>
        </div>
        <div className="p-4 overflow-y-auto pb-20">{children}</div>
      </div>
    </div>
  );
};

const SearchableSelect = ({ label, options, value, onChange, onAddNew, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = options.filter(opt => (typeof opt === 'string' ? opt : (opt.name || '')).toLowerCase().includes(searchTerm.toLowerCase()));
  const getDisplayValue = () => {
    if (!value) return placeholder;
    const found = options.find(o => (o.id || o) === value);
    return found ? (found.name || found) : (typeof value === 'object' ? value.name : value);
  };

  return (
    <div className="relative mb-4">
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>}
      <div onClick={() => setIsOpen(!isOpen)} className="w-full p-3 border rounded-xl bg-gray-50 flex justify-between items-center cursor-pointer">
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>{getDisplayValue()}</span>
        <Search size={16} className="text-gray-400" />
      </div>
      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <div className="sticky top-0 p-2 bg-white border-b"><input autoFocus className="w-full p-2 text-sm border-none focus:ring-0" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          {filtered.map((opt, idx) => {
            const id = typeof opt === 'string' ? opt : opt.id;
            const name = typeof opt === 'string' ? opt : opt.name;
            return (
              <div key={id || idx} className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 flex justify-between items-center" onClick={() => { onChange(id); setIsOpen(false); setSearchTerm(''); }}>
                <span>{name}</span>
                {opt.subText && <span className={`text-[10px] font-bold ${opt.subColor}`}>{opt.subText}</span>}
                {!opt.subText && <span className="text-xs text-gray-400 ml-2">({id || 'N/A'})</span>}
              </div>
            );
          })}
          {onAddNew && <div className="p-3 text-blue-600 font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-blue-50" onClick={() => { onAddNew(); setIsOpen(false); }}><Plus size={16} /> Add New</div>}
        </div>
      )}
    </div>
  );
};

export default function App() {
  // REQ 1: Persistent Data State (Fixed for Hydration / SSR)
  // Initialize with default values (null / INITIAL_DATA) to prevent Prop ID Mismatch
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);

  // Load from LocalStorage ONLY on the client-side after mount
  useEffect(() => {
    // Load User
    const savedUser = localStorage.getItem('smees_user');
    if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (e) { console.error(e); }
    }

    // Load Data
    const savedData = localStorage.getItem('smees_data');
    if (savedData) {
        try { setData(JSON.parse(savedData)); } catch (e) { console.error(e); }
    }
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [mastersView, setMastersView] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportView, setReportView] = useState(null);
  const [statementModal, setStatementModal] = useState(null);
    
  // Logic & Filter States
  const [listFilter, setListFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [partyFilter, setPartyFilter] = useState(null);
  const [listPaymentMode, setListPaymentMode] = useState(null);
  const [pnlFilter, setPnlFilter] = useState('Monthly'); // Default
  const [pnlCustomDates, setPnlCustomDates] = useState({ start: '', end: '' });
  const [showPnlReport, setShowPnlReport] = useState(false);
  const [timerConflict, setTimerConflict] = useState(null);
  const [editingTimeLog, setEditingTimeLog] = useState(null);
  const [manualAttModal, setManualAttModal] = useState(null); 
  const [adjustCashModal, setAdjustCashModal] = useState(null);
  // NEW: State for selected time log detail
  const [selectedTimeLog, setSelectedTimeLog] = useState(null);

  // REQ 2: Deep Linking (Open Task from URL)
  useEffect(() => {
      // Run logic only if data is loaded and tasks exist
      if (data.tasks && data.tasks.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const taskId = params.get('taskId');
          
          if (taskId) {
              const task = data.tasks.find(t => t.id === taskId);
              if (task) {
                  setActiveTab('tasks');
                  setViewDetail({ type: 'task', id: taskId });
                  
                  // NOTE: History replacement removed to ensure state persistence
              }
          }
      }
  }, [data.tasks]);

  // Initial Setup useEffect
  // REQ 2: Updated Fetch Logic (syncData) with Background Sync Support & Role Optimization
const syncData = async (isBackground = false) => {
    if (!user) return;
    
    // Only show loading if not background sync
    if (!isBackground) setLoading(true);
    
    try {
      const newData = { ...INITIAL_DATA };
      const isAdmin = user.role === 'admin';
      
      // 1. Determine Collections based on Role
      // Base collections for everyone (Staff needs these)
      let masters = ['staff', 'tasks', 'attendance'];
      
      // Admin gets full access to masters (Parties/Items are read-heavy)
      if (isAdmin) {
          masters = [...masters, 'parties', 'items'];
      }

      // Fetch determined master collections
      for (const col of masters) {
          const querySnapshot = await getDocs(collection(db, col));
          newData[col] = querySnapshot.docs.map(doc => doc.data());
      }

      // 2. Fetch Transactions (Admins Only - Optimized: Last 3 Months)
      if (isAdmin) {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const dateStr = threeMonthsAgo.toISOString().split('T')[0];
          
          const txQuery = query(collection(db, "transactions"), where("date", ">=", dateStr));
          const txSnap = await getDocs(txQuery);
          newData.transactions = txSnap.docs.map(doc => doc.data());
      } else {
          // Staff gets no transactions to save reads
          newData.transactions = [];
      }

      // 3. Fetch Settings (For Everyone - Company info/counters needed globally)
      const companySnap = await getDocs(collection(db, "settings"));
      companySnap.forEach(doc => {
          if (doc.id === 'company') newData.company = doc.data();
          if (doc.id === 'counters') newData.counters = { ...INITIAL_DATA.counters, ...doc.data() };
          if (doc.id === 'categories') newData.categories = { ...INITIAL_DATA.categories, ...doc.data() };
      });
      
      localStorage.setItem('smees_data', JSON.stringify(newData));
      setData(newData);
      
      if (!isBackground) showToast(isAdmin ? "Data Synced (Admin Mode)" : "Data Synced (Staff Mode)");
      
    } catch (error) { 
        console.error(error); 
        showToast("Sync Error", "error"); 
    } finally { 
        if (!isBackground) setLoading(false); 
    }
};

  // REQ 3: Smart Auto-Sync Logic
  useEffect(() => {
    if (!user) return;
    const localData = localStorage.getItem('smees_data');
    // Only sync if no local data exists (First run or cleared cache)
    if (!localData) {
        syncData();
    }
  }, [user]);

  useEffect(() => {
      const handlePopState = () => {
          if (modal.type) setModal({ type: null, data: null });
          else if (statementModal) setStatementModal(null);
          else if (viewDetail) setViewDetail(null);
          else if (mastersView) { setMastersView(null); setPartyFilter(null); }
          else if (reportView) setReportView(null);
          else if (convertModal) setConvertModal(null);
          else if (showPnlReport) setShowPnlReport(false);
          else if (timerConflict) setTimerConflict(null);
          else if (editingTimeLog) setEditingTimeLog(null);
          else if (manualAttModal) setManualAttModal(null);
          else if (adjustCashModal) setAdjustCashModal(null);
          else if (selectedTimeLog) setSelectedTimeLog(null); // Handle Back Button
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [modal, viewDetail, mastersView, reportView, convertModal, showPnlReport, timerConflict, editingTimeLog, statementModal, manualAttModal, adjustCashModal, selectedTimeLog]);

  const pushHistory = () => window.history.pushState({ modal: true }, '');
  const handleCloseUI = () => window.history.back();

  // --- LOGIC CALCULATIONS ---
  const getBillLogic = (bill) => {
    if (bill.type === 'estimate') return { ...getTransactionTotals(bill), status: 'ESTIMATE', pending: 0, paid: 0 };
    const basic = getTransactionTotals(bill);
    const linkedAmount = data.transactions.filter(t => t.type === 'payment' && t.linkedBills).reduce((sum, p) => {
         const link = p.linkedBills.find(l => l.billId === bill.id);
         return sum + (link ? parseFloat(link.amount || 0) : 0);
      }, 0);
    
    let status = 'UNPAID';
    if(bill.type === 'payment') {
         const used = bill.linkedBills?.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;
         const total = parseFloat(bill.amount || 0);
         if (used >= total - 0.1 && total > 0) status = 'FULLY USED';
         else if (used > 0) status = 'PARTIALLY USED';
         else status = 'UNUSED';
         return { ...basic, used, status };
    }
    const totalPaid = basic.paid + linkedAmount;
    if (totalPaid >= basic.final - 0.1) status = 'PAID'; else if (totalPaid > 0) status = 'PARTIAL';
    return { ...basic, totalPaid, pending: basic.final - totalPaid, status };
  };

  const partyBalances = useMemo(() => {
    const balances = {};
    data.parties.forEach(p => balances[p.id] = p.type === 'DR' ? parseFloat(p.openingBal || 0) : -parseFloat(p.openingBal || 0));
    data.transactions.forEach(tx => {
      if (tx.type === 'estimate' || tx.status === 'Cancelled') return; 
      const { final, paid } = getTransactionTotals(tx);
      const unpaid = final - paid;
      
      if (tx.type === 'sales') balances[tx.partyId] = (balances[tx.partyId] || 0) + unpaid;
      
      // FIX: Treat 'expense' with a partyId exactly like 'purchase' (accounts payable)
      if (tx.type === 'purchase' || (tx.type === 'expense' && tx.partyId)) {
         balances[tx.partyId] = (balances[tx.partyId] || 0) - unpaid;
      }
      
      if (tx.type === 'payment') {
        const amt = parseFloat(tx.amount || 0) + parseFloat(tx.discountValue || 0);
        if (tx.subType === 'in') balances[tx.partyId] = (balances[tx.partyId] || 0) - amt;
        else balances[tx.partyId] = (balances[tx.partyId] || 0) + amt;
      }
    });
    return balances;
  }, [data]);

  const itemStock = useMemo(() => {
    const stock = {};
    data.items.forEach(i => stock[i.id] = parseFloat(i.openingStock || 0));
    data.transactions.forEach(tx => {
      if (tx.type === 'estimate' || tx.status === 'Cancelled') return;
      tx.items?.forEach(line => {
        if (tx.type === 'sales') stock[line.itemId] = (stock[line.itemId] || 0) - parseFloat(line.qty || 0);
        if (tx.type === 'purchase') stock[line.itemId] = (stock[line.itemId] || 0) + parseFloat(line.qty || 0);
      });
    });
    return stock;
  }, [data]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = data.transactions.filter(tx => tx.type === 'sales' && tx.status !== 'Cancelled' && tx.date === today).reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
    const totalExpenses = data.transactions.filter(tx => tx.type === 'expense' && tx.status !== 'Cancelled').reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
    const pendingTasks = data.tasks.filter(t => t.status !== 'Done').length;
    let totalReceivables = 0, totalPayables = 0;
    Object.values(partyBalances).forEach(bal => { if (bal > 0) totalReceivables += bal; if (bal < 0) totalPayables += Math.abs(bal); });
    
    // FIX BUG 2: Correct Cash/Bank Logic (Strictly based on paid/received)
    let cashInHand = 0, bankBalance = 0;
    data.transactions.forEach(tx => {
        if (tx.type === 'estimate' || tx.status === 'Cancelled') return;
        
        let amt = 0;
        let isIncome = false;
        let affectCashBank = false;

        // Specific logic per type - only count what is ACTUALLY paid/received
        if (tx.type === 'sales') {
            amt = parseFloat(tx.received || 0);
            isIncome = true;
            affectCashBank = amt > 0;
        } else if (tx.type === 'purchase') {
            amt = parseFloat(tx.paid || 0);
            isIncome = false;
            affectCashBank = amt > 0;
        } else if (tx.type === 'expense') {
            // Expenses: Use 'paid' field (default for expense form)
            amt = parseFloat(tx.paid || 0);
            isIncome = false;
            affectCashBank = amt > 0;
        } else if (tx.type === 'payment') {
            // Payments are pure cash flow - Strictly use 'amount' (ignore discount)
            amt = parseFloat(tx.amount || 0);
            isIncome = tx.subType === 'in';
            affectCashBank = amt > 0;
        }

        if (affectCashBank) {
            const isCash = (tx.paymentMode || 'Cash') === 'Cash';
            if (isIncome) {
                isCash ? cashInHand += amt : bankBalance += amt;
            } else {
                isCash ? cashInHand -= amt : bankBalance -= amt;
            }
        }
    });
    return { todaySales, totalExpenses, pendingTasks, totalReceivables, totalPayables, cashInHand, bankBalance };
  }, [data, partyBalances]);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  // REQ: Targeted Sync Function
  const refreshSingleRecord = async (collectionName, id) => {
    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const serverData = docSnap.data();
            setData(prev => {
                const list = prev[collectionName] || [];
                const index = list.findIndex(i => i.id === id);
                let newList;
                
                if (index >= 0) {
                    newList = [...list];
                    newList[index] = serverData;
                } else {
                    newList = [...list, serverData];
                }
                
                const newData = { ...prev, [collectionName]: newList };
                localStorage.setItem('smees_data', JSON.stringify(newData));
                return newData;
            });
            // Optional: Only show toast if triggered manually (context dependent, but okay here)
            // showToast("Refreshed"); 
        }
    } catch (error) {
        console.error("Targeted Sync Error:", error);
    }
  };

  const saveRecord = async (collectionName, record, idType) => {
    if (!user) return;
    let newData = { ...data };
    let finalId = record.id;
    let newCounters = null;

    if (record.id) {
      newData[collectionName] = data[collectionName].map(r => r.id === record.id ? record : r);
      if (collectionName === 'transactions' && record.type === 'sales' && record.convertedFromTask) {
         const task = newData.tasks.find(t => t.id === record.convertedFromTask);
         if (task) {
           task.itemsUsed = record.items.map(i => ({ itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice, description: i.description }));
           newData.tasks = newData.tasks.map(t => t.id === task.id ? task : t);
           setDoc(doc(db, "tasks", task.id), task);
         }
      }
    } else {
      const { id, nextCounters } = getNextId(data, idType);
      const createdField = collectionName === 'tasks' ? { taskCreatedAt: new Date().toISOString() } : {};
      record = { ...record, id, createdAt: new Date().toISOString(), ...createdField };
      newData[collectionName] = [...data[collectionName], record];
      newData.counters = nextCounters; 
      newCounters = nextCounters;
      finalId = id;
    }
    const safeRecord = cleanData(record);
    setData(newData); setModal({ type: null, data: null }); handleCloseUI(); showToast("Saved");
    try {
        await setDoc(doc(db, collectionName, finalId.toString()), safeRecord);
        if (newCounters) await setDoc(doc(db, "settings", "counters"), newCounters);
        
        // REQ: Use Targeted Sync instead of full sync
        await refreshSingleRecord(collectionName, finalId);
    } catch (e) { console.error(e); showToast("Save Error", "error"); }
    return finalId; 
  };

  const deleteRecord = async (collectionName, id) => {
    if (!user) return;
    if (collectionName === 'items' && data.transactions.some(t => t.items?.some(i => i.itemId === id))) { alert("Item is used."); setConfirmDelete(null); return; }
    if (collectionName === 'parties' && data.transactions.some(t => t.partyId === id)) { alert("Party is used."); setConfirmDelete(null); return; }
    setData(prev => ({ ...prev, [collectionName]: prev[collectionName].filter(r => r.id !== id) }));
    setConfirmDelete(null); setModal({ type: null, data: null }); handleCloseUI(); showToast("Deleted");
    try { await deleteDoc(doc(db, collectionName, id.toString())); await syncData(true);} catch (e) { console.error(e); }
  };

  const cancelTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this transaction? It will be removed from all calculations but kept in records.")) return;
    
    // 1. Update local state immediately
    const updatedTransactions = data.transactions.map(t => 
        t.id === id ? { ...t, status: 'Cancelled' } : t
    );
    setData(prev => ({ ...prev, transactions: updatedTransactions }));
    
    // 2. Update Firebase
    try {
        const tx = data.transactions.find(t => t.id === id);
        if (tx) {
            await setDoc(doc(db, "transactions", id), { ...tx, status: 'Cancelled' });
            // 3. Sync quietly
            await syncData(true);
            showToast("Transaction Cancelled");
        }
    } catch (e) {
        console.error(e);
        showToast("Error cancelling", "error");
    }
  };

  // --- MOVED IMPORT LOGIC (From TransactionList to App Scope) ---
  const handleTransactionImport = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.XLSX) return alert("Excel lib not loaded");

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
          const jsonData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          const newTx = [];
          let nextCounters = { ...data.counters };
          let batch = [];

          for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || !row[0]) continue; // Skip empty
              
              const { id, nextCounters: nc } = getNextId({ ...data, counters: nextCounters }, 'transaction');
              nextCounters = nc;

              const type = (row[1] || 'sales').toLowerCase();
              const partyName = row[2];
              const party = data.parties.find(p => p.name?.toLowerCase() === partyName?.toLowerCase());
              
              const tx = {
                  id,
                  date: row[0], // Expect YYYY-MM-DD
                  type,
                  partyId: party ? party.id : '',
                  amount: parseFloat(row[3] || 0),
                  paymentMode: row[4] || 'Cash',
                  description: row[5] || 'Imported',
                  createdAt: new Date().toISOString(),
                  items: [] 
              };
              
              if (['sales','purchase'].includes(type)) {
                  tx.finalTotal = tx.amount;
                  tx.grossTotal = tx.amount;
              }

              newTx.push(cleanData(tx));
              batch.push(setDoc(doc(db, "transactions", id), cleanData(tx)));
          }
          
          if(batch.length > 0) {
              batch.push(setDoc(doc(db, "settings", "counters"), nextCounters));
              await Promise.all(batch);
              setData(prev => ({ ...prev, transactions: [...prev.transactions, ...newTx], counters: nextCounters }));
              showToast(`Imported ${newTx.length} transactions`);
          }
      };
      reader.readAsBinaryString(file);
  };

  const handlePaymentImport = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.XLSX) return alert("Excel lib not loaded");
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
          const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
          const jsonData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          const newTx = [];
          let nextCounters = { ...data.counters };
          let batch = [];

          for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || !row[0]) continue;

              const { id, nextCounters: nc } = getNextId({ ...data, counters: nextCounters }, 'payment');
              nextCounters = nc;

              const partyName = row[2];
              const party = data.parties.find(p => p.name?.toLowerCase() === partyName?.toLowerCase());

              const tx = {
                  id,
                  type: 'payment',
                  date: row[0],
                  subType: (row[1] || 'in').toLowerCase(), // 'in' or 'out'
                  partyId: party ? party.id : '',
                  amount: parseFloat(row[3] || 0),
                  paymentMode: row[4] || 'Cash',
                  description: row[5] || 'Imported Payment',
                  createdAt: new Date().toISOString()
              };

              newTx.push(cleanData(tx));
              batch.push(setDoc(doc(db, "transactions", id), cleanData(tx)));
          }

          if(batch.length > 0) {
              batch.push(setDoc(doc(db, "settings", "counters"), nextCounters));
              await Promise.all(batch);
              setData(prev => ({ ...prev, transactions: [...prev.transactions, ...newTx], counters: nextCounters }));
              showToast(`Imported ${newTx.length} payments`);
          }
      };
      reader.readAsBinaryString(file);
  };

  // --- SUB-COMPONENTS ---

  const StaffDetailView = ({ staff }) => {
     const [sTab, setSTab] = useState('attendance');
     
     const attToday = data.attendance.find(a => a.staffId === staff.id && a.date === new Date().toISOString().split('T')[0]) || {};
     const attHistory = data.attendance.filter(a => a.staffId === staff.id).sort((a,b) => new Date(b.date) - new Date(a.date));
     
     // UPDATED: Include taskId and originalIndex to enable editing/viewing details
     const workLogs = data.tasks.flatMap(t => 
        (t.timeLogs || []).map((l, i) => ({ ...l, taskId: t.id, originalIndex: i, taskName: t.name }))
        .filter(l => l.staffId === staff.id)
     ).sort((a,b) => new Date(b.start) - new Date(a.start));

     const handleAttendance = async (type) => {
        if (!user) return;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const existingDoc = data.attendance.find(a => a.staffId === staff.id && a.date === todayStr);
        let attRecord = existingDoc || { staffId: staff.id, date: todayStr, checkIn: '', checkOut: '', lunchStart: '', lunchEnd: '', status: 'Present', id: `ATT-${staff.id}-${todayStr}` };
        if (type === 'checkIn') attRecord.checkIn = timeStr;
        if (type === 'checkOut') attRecord.checkOut = timeStr;
        if (type === 'lunchStart') attRecord.lunchStart = timeStr;
        if (type === 'lunchEnd') attRecord.lunchEnd = timeStr;
        const newAtt = [...data.attendance.filter(a => a.id !== attRecord.id), attRecord];
        setData(prev => ({ ...prev, attendance: newAtt }));
        await setDoc(doc(db, "attendance", attRecord.id), attRecord);
        showToast(`${type} Recorded`);
    };

    const deleteAtt = async (id) => {
        if(!window.confirm("Delete this attendance record?")) return;
        await deleteDoc(doc(db, "attendance", id));
        setData(prev => ({...prev, attendance: prev.attendance.filter(a => a.id !== id)}));
    }
    
    const editAtt = (record) => {
        pushHistory();
        setManualAttModal({ ...record, isEdit: true });
    }

     return (
         <div className="p-4 space-y-6">
            <div className="p-4 bg-gray-50 rounded-2xl border">
                <div className="flex justify-between items-center mb-2"><p className="font-bold text-lg text-gray-800">{staff.role}</p><span className={`px-2 py-1 rounded text-xs font-bold ${staff.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{staff.active ? 'Active' : 'Inactive'}</span></div>
                <p className="text-sm text-gray-500 flex items-center gap-2"><Phone size={14}/> {staff.mobile}</p>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={()=>setSTab('attendance')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${sTab==='attendance' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Attendance</button>
                <button onClick={()=>setSTab('work')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${sTab==='work' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Work Logs</button>
            </div>

            {sTab === 'attendance' && (
                <div className="space-y-4">
                     <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><UserCheck size={18}/> Actions (Today)</h3>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button onClick={() => handleAttendance('checkIn')} disabled={!!attToday.checkIn} className="p-3 bg-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:bg-gray-400">Check In <br/> <span className="text-xs font-normal">{attToday.checkIn || '--:--'}</span></button>
                            <button onClick={() => handleAttendance('checkOut')} className="p-3 bg-red-600 text-white rounded-xl font-bold text-sm">Check Out <br/> <span className="text-xs font-normal">{attToday.checkOut || '--:--'}</span></button>
                            <button onClick={() => handleAttendance('lunchStart')} disabled={!!attToday.lunchStart} className="p-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"><Coffee size={14}/> Start Lunch <br/>{attToday.lunchStart}</button>
                            <button onClick={() => handleAttendance('lunchEnd')} disabled={!!attToday.lunchEnd} className="p-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"><Briefcase size={14}/> End Lunch <br/>{attToday.lunchEnd}</button>
                        </div>
                    </div>
                    
                    {user.role === 'admin' && (
                        <button onClick={() => { pushHistory(); setManualAttModal({ staffId: staff.id }); }} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50">+ Add/Edit Attendance (Admin)</button>
                    )}

                    <div className="space-y-2">
                        {attHistory.map(item => (
                            <div key={item.id} className="p-3 border rounded-xl bg-white text-xs relative">
                                {user.role === 'admin' && (
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        <button onClick={() => editAtt(item)} className="text-blue-500"><Edit2 size={14}/></button>
                                        <button onClick={() => deleteAtt(item.id)} className="text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-gray-800 mb-1"><span>{formatDate(item.date)}</span></div>
                                <div className="flex justify-between text-gray-600"><span>In: {item.checkIn || '-'}</span><span>Out: {item.checkOut || '-'}</span></div>
                                {item.lunchStart && <div className="text-gray-400 mt-1">Lunch: {item.lunchStart} - {item.lunchEnd}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {sTab === 'work' && (
                <div className="space-y-2">
                    {workLogs.map((item, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => { pushHistory(); setSelectedTimeLog({ task: data.tasks.find(t => t.id === item.taskId), index: item.originalIndex }); }}
                            className="p-3 border rounded-xl bg-white text-xs cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                            <div className="flex justify-between font-bold text-gray-800 mb-1"><span>Task: {item.taskName}</span><span>{new Date(item.start).toLocaleDateString()}</span></div>
                            <div className="flex justify-between text-gray-500"><span>{formatTime(item.start)} - {item.end ? formatTime(item.end) : 'Active'}</span><span className="font-bold">{item.duration}m</span></div>
                        </div>
                    ))}
                </div>
            )}
         </div>
     );
  };

  const Dashboard = () => {
      // FIX #2: Net Profit Filters
      const pnlData = useMemo(() => {
          const now = new Date();
          let filteredTx = data.transactions.filter(t => ['sales'].includes(t.type));
          
          filteredTx = filteredTx.filter(t => {
              const d = new Date(t.date);
              const tDate = d.toDateString();
              const nDate = now.toDateString();
              
              if (pnlFilter === 'Today') return tDate === nDate;
              if (pnlFilter === 'Weekly') {
                  const startOfWeek = new Date(now);
                  startOfWeek.setDate(now.getDate() - now.getDay());
                  startOfWeek.setHours(0,0,0,0);
                  return d >= startOfWeek;
              }
              if (pnlFilter === 'Monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              if (pnlFilter === 'Yearly') return d.getFullYear() === now.getFullYear();
              if (pnlFilter === 'Custom' && pnlCustomDates.start && pnlCustomDates.end) {
                  const s = new Date(pnlCustomDates.start);
                  const e = new Date(pnlCustomDates.end);
                  e.setHours(23,59,59,999);
                  return d >= s && d <= e;
              }
              return true; // 'All' or default
          });

          let profit = 0;
          filteredTx.forEach(tx => {
             (tx.items || []).forEach(item => {
                 const itemMaster = data.items.find(i => i.id === item.itemId);
                 const type = itemMaster?.type || 'Goods';
                 const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
                 const sell = parseFloat(item.price || 0);
                 const qty = parseFloat(item.qty || 0);
                 if(type === 'Service') profit += (sell * qty); else profit += ((sell - buy) * qty);
             });
          });
          return profit;
      }, [data.transactions, pnlFilter, pnlCustomDates]);

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1><p className="text-sm text-gray-500">FY {data.company.financialYear}</p></div>
            <div className="flex gap-2">
                <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 bg-gray-100 rounded-xl"><Settings className="text-gray-600" /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-2xl text-white shadow-lg cursor-pointer" onClick={() => { pushHistory(); setShowPnlReport(true); }}>
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs opacity-80 font-bold mb-1">NET PROFIT</p>
                        <p className="text-2xl font-black">{formatCurrency(pnlData)}</p>
                    </div>
                    <select onClick={(e)=>e.stopPropagation()} value={pnlFilter} onChange={(e)=>setPnlFilter(e.target.value)} className="bg-blue-900/50 text-xs border-none rounded p-1 outline-none text-white max-w-[80px]">
                        <option value="Today">Today</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Month</option>
                        <option value="Yearly">Year</option>
                        <option value="Custom">Custom</option>
                    </select>
                  </div>
                  {pnlFilter === 'Custom' && (
                    <div onClick={(e)=>e.stopPropagation()} className="flex gap-1 mt-2">
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.start} onChange={e=>setPnlCustomDates({...pnlCustomDates, start:e.target.value})} />
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.end} onChange={e=>setPnlCustomDates({...pnlCustomDates, end:e.target.value})} />
                    </div>
                  )}
              </div>
              {/* FIX #4: Cash/Bank with Adjust Button */}
              <div className="bg-white p-4 rounded-2xl border shadow-sm relative group">
                  <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-gray-400">CASH / BANK</p>
                      <button onClick={() => { pushHistory(); setAdjustCashModal({ type: 'Cash' }); }} className="p-1 bg-gray-100 rounded text-blue-600 font-bold text-[10px] flex items-center gap-1">Adjust</button>
                  </div>
                  <div className="flex justify-between text-sm mb-1 cursor-pointer" onClick={() => { setListFilter('all'); setListPaymentMode('Cash'); setActiveTab('accounting'); }}><span>Cash:</span><span className="font-bold text-green-600">{formatCurrency(stats.cashInHand)}</span></div>
                  <div className="flex justify-between text-sm cursor-pointer" onClick={() => { setListFilter('all'); setListPaymentMode('Bank'); setActiveTab('accounting'); }}><span>Bank:</span><span className="font-bold text-blue-600">{formatCurrency(stats.bankBalance)}</span></div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Receivables Card - Click to filter Party Master */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('receivable'); }} className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
               <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
            </div>
            
            {/* Payables Card - Click to filter Party Master */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('payable'); }} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
               <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
            </div>
            
            {/* Sales Card - Click to go to Accounting Tab */}
            <div onClick={() => { setListFilter('sales'); setActiveTab('accounting'); }} className="bg-green-50 p-4 rounded-2xl border border-green-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(stats.todaySales)}</p>
            </div>
            
            {/* Expenses Card - Click to open Expenses Breakdown */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('expenses'); }} className="bg-red-50 p-4 rounded-2xl border border-red-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-red-600 uppercase">Expenses</p>
              <p className="text-xl font-bold text-red-900">{formatCurrency(stats.totalExpenses)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2">
              {[{ label: 'Sale', icon: <TrendingUp />, type: 'sales', color: 'bg-green-100 text-green-700' }, { label: 'Estimate', icon: <FileText />, type: 'estimate', color: 'bg-yellow-100 text-yellow-700' }, { label: 'Purchase', icon: <ShoppingCart />, type: 'purchase', color: 'bg-blue-100 text-blue-700' }, { label: 'Expense', icon: <ReceiptText />, type: 'expense', color: 'bg-red-100 text-red-700' }, { label: 'Payment', icon: <Banknote />, type: 'payment', color: 'bg-purple-100 text-purple-700' }].map(action => (
                <button key={action.label} onClick={() => { pushHistory(); setModal({ type: action.type }); }} className="flex flex-col items-center gap-2">
                  <div className={`p-4 rounded-2xl ${action.color}`}>{action.icon}</div>
                  <span className="text-xs font-medium text-gray-600">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
  };

  const MasterList = ({ title, collection, type, onRowClick }) => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('A-Z');
    const [selectedIds, setSelectedIds] = useState([]);
    
    let listData = data[collection];
    
    if (type === 'item') listData = listData.map(i => ({ ...i, subText: `${itemStock[i.id] || 0} ${i.unit}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    if (type === 'party') {
        listData = listData.map(p => {
           const bal = partyBalances[p.id] || 0;
           return { ...p, subText: bal !== 0 ? formatCurrency(Math.abs(bal)) + (bal > 0 ? ' DR' : ' CR') : 'Settled', subColor: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-gray-400', balance: bal };
        });
        if (partyFilter === 'receivable') listData = listData.filter(p => p.balance > 0);
        if (partyFilter === 'payable') listData = listData.filter(p => p.balance < 0);
    }
    if (type === 'staff') {
        if (user.role !== 'admin') {
            listData = listData.filter(s => s.id === user.id);
        }
        listData = listData.map(s => ({ ...s, subText: s.role, subColor: 'text-blue-500' }));
    }

    const filtered = sortData(listData.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))), sort);

    // --- IMPORT LOGIC ---
    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.XLSX) {
            alert("Excel library is still loading. Please try again in a few seconds.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
            const newRecords = [];
            const batchPromises = [];
            let nextCounters = { ...data.counters };

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                let record = {};
                let id = '';
                
                if (type === 'party') {
                    const num = nextCounters.party || 1000;
                    id = `P-${num}`;
                    nextCounters.party = num + 1;
                    record = { id, name: row[1] || '', email: row[3] || '', mobile: row[4] || '', address: row[5] || '', lat: row[6] || '', lng: row[7] || '', reference: row[8] || '', openingBal: row[10] || 0, type: row[11] || 'DR' };
                } else if (type === 'item') {
                    const num = nextCounters.item || 1000;
                    id = `I-${num}`;
                    nextCounters.item = num + 1;
                    record = { id, name: row[1] || '', category: row[2] || '', type: row[3] || 'Goods', sellPrice: row[4] || 0, buyPrice: row[5] || 0, unit: row[8] || 'pcs', openingStock: 0 };
                }
                
                if (record.name) {
                    newRecords.push(cleanData(record));
                    batchPromises.push(setDoc(doc(db, collection, id), cleanData(record)));
                }
            }
            
            batchPromises.push(setDoc(doc(db, "settings", "counters"), nextCounters));
            
            await Promise.all(batchPromises);
            setData(prev => ({ 
                ...prev, 
                [collection]: [...prev[collection], ...newRecords],
                counters: nextCounters
            }));
            alert(`Imported ${newRecords.length} records successfully!`);
        };
        reader.readAsBinaryString(file);
    };

    const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(i => i.id));
    const handleBulkDelete = async () => {
       if(!window.confirm(`Delete ${selectedIds.length} records?`)) return;
       const ids = [...selectedIds];
       setSelectedIds([]);
       setData(prev => ({ ...prev, [collection]: prev[collection].filter(item => !ids.includes(item.id)) }));
       try { await Promise.all(ids.map(id => deleteDoc(doc(db, collection, id.toString())))); } catch (e) { console.error(e); }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleSelectAll} />
              <h1 className="text-xl font-bold">{title} {partyFilter ? `(${partyFilter})` : ''}</h1>
          </div>
          <div className="flex gap-2">
              {(type === 'party' || type === 'item') && checkPermission(user, 'canViewMasters') && (
                  <label className="p-2 bg-gray-100 rounded-xl cursor-pointer"><Upload size={18} className="text-gray-600"/><input type="file" hidden accept=".xlsx, .xls" onChange={handleImport} /></label>
              )}
              {selectedIds.length > 0 ? (
                  <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-xl flex items-center gap-1 text-sm px-4 font-bold"><Trash2 size={16}/> ({selectedIds.length})</button>
              ) : (
                  checkPermission(user, 'canViewMasters') && <button onClick={() => { pushHistory(); setModal({ type }); }} className="p-2 bg-blue-600 text-white rounded-xl flex items-center gap-1 text-sm px-4"><Plus size={18} /> Add</button>
              )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500" placeholder={`Search ${title}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className={`p-3 bg-white border rounded-2xl flex items-center gap-3 active:scale-95 transition-transform ${selectedIds.includes(item.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : ''}`}>
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i!==item.id) : [...prev, item.id])} />
              <div className="flex-1" onClick={() => onRowClick ? onRowClick(item) : (pushHistory() || setViewDetail({ type, id: item.id }))}>
                <div className="flex justify-between items-start">
                    <div><p className="font-bold text-gray-800">{item.name}</p><p className="text-xs text-gray-500">{item.mobile || item.category || item.role}</p></div>
                    {item.subText && <p className={`text-xs font-bold ${item.subColor}`}>{item.subText}</p>}
                </div>
              </div>
              <ChevronRight className="text-gray-300" />
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No records found</p>}
        </div>
      </div>
    );
  };

  const TransactionList = () => {
    const [sort, setSort] = useState('DateDesc');
    const [filter, setFilter] = useState('all');
    const [visibleCount, setVisibleCount] = useState(50); // Pagination State

    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    let filtered = data.transactions.filter(tx => filter === 'all' || tx.type === filter);
    if(listPaymentMode) filtered = filtered.filter(tx => (tx.paymentMode || 'Cash') === listPaymentMode);
    if (categoryFilter) filtered = filtered.filter(tx => tx.category === categoryFilter);
    filtered = sortData(filtered, sort);

    // Slice data for pagination
    const visibleData = filtered.slice(0, visibleCount);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Accounting {categoryFilter && `(${categoryFilter})`}</h1>
          <div className="flex gap-2 items-center">
              <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option><option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option></select>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
            <button key={t} onClick={() => { setFilter(t); setCategoryFilter(null); }} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-3">
          {visibleData.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            const totals = getBillLogic(tx);
            const isCancelled = tx.status === 'Cancelled';
            const unusedAmount = tx.type === 'payment' ? (totals.amount - (totals.used || 0)) : 0;

            let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
            if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }
            
            return (
              <div key={tx.id} onClick={() => { pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className={`p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                  <div>
                    <p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
                    <div className="flex gap-1 mt-1">
                        {isCancelled ? (
                           <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-gray-200 text-gray-600">CANCELLED</span>
                        ) : (
                           ['sales', 'purchase', 'expense', 'payment'].includes(tx.type) && <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${(totals.status === 'PAID' || totals.status === 'FULLY USED') ? 'bg-green-100 text-green-700' : (totals.status === 'PARTIAL' || totals.status === 'PARTIALLY USED') ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isCancelled ? 'text-gray-400 line-through' : isIncoming ? 'text-green-600' : 'text-red-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(totals.amount)}</p>
                  {['sales', 'purchase'].includes(tx.type) && totals.status !== 'PAID' && !isCancelled && <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(totals.pending)}</p>}
                  {tx.type === 'payment' && !isCancelled && unusedAmount > 0.1 && <p className="text-[10px] font-bold text-orange-600">Unused: {formatCurrency(unusedAmount)}</p>}
                </div>
              </div>
            );
          })}
          
          {visibleCount < filtered.length && (
            <button 
                onClick={() => setVisibleCount(prev => prev + 50)} 
                className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200">
                Load More ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      </div>
    );
  };

  // FIX #3: Expenses Breakdown with Date Filters
  const ExpensesBreakdown = () => {
      const [eFilter, setEFilter] = useState('Monthly');
      const [eDates, setEDates] = useState({ start: '', end: '' });

      const filteredExpenses = data.transactions.filter(t => {
          if (t.status === 'Cancelled') return false;
          if (t.type !== 'expense') return false;
          const d = new Date(t.date);
          const now = new Date();
          if (eFilter === 'Today') return d.toDateString() === now.toDateString();
          if (eFilter === 'Weekly') {
              const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
              return d >= start;
          }
          if (eFilter === 'Monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (eFilter === 'Yearly') return d.getFullYear() === now.getFullYear();
          if (eFilter === 'Custom' && eDates.start && eDates.end) return d >= new Date(eDates.start) && d <= new Date(eDates.end);
          return true; // All
      });

      const byCategory = filteredExpenses.reduce((acc, curr) => {
          const cat = curr.category || 'Uncategorized';
          acc[cat] = (acc[cat] || 0) + parseFloat(curr.finalTotal || curr.amount || 0);
          return acc;
      }, {});

      return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                  <h2 className="font-bold text-lg">Expenses Breakdown</h2>
                  
                  {/* Date Filter Dropdown */}
                  <select value={eFilter} onChange={(e)=>setEFilter(e.target.value)} className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none">
                      <option value="All">All Time</option>
                      <option value="Today">Today</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Month</option>
                      <option value="Yearly">Year</option>
                      <option value="Custom">Custom</option>
                  </select>
              </div>
              
              {eFilter === 'Custom' && (
                  <div className="flex gap-2 p-2 bg-gray-50 justify-center border-b">
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.start} onChange={e=>setEDates({...eDates, start:e.target.value})} />
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.end} onChange={e=>setEDates({...eDates, end:e.target.value})} />
                  </div>
              )}

              <div className="p-4 space-y-4">
                  {/* Show All Button */}
                  <div onClick={() => { setListFilter('expense'); setCategoryFilter(null); setActiveTab('accounting'); handleCloseUI(); }} className="flex justify-center items-center p-3 bg-blue-50 rounded-xl border border-blue-200 cursor-pointer mb-2 text-blue-700 font-bold text-sm">
                      Show All Expenses List
                  </div>
                  {Object.entries(byCategory).map(([cat, total]) => (
                      // FIX #3: Interactive Expense Categories
                      <div key={cat} onClick={() => { setListFilter('expense'); setCategoryFilter(cat); setActiveTab('accounting'); handleCloseUI(); }} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border cursor-pointer hover:bg-gray-100">
                          <span className="font-bold">{cat}</span>
                          <span className="font-bold text-red-600">{formatCurrency(total)}</span>
                      </div>
                  ))}
                  {filteredExpenses.length === 0 && <p className="text-center text-gray-400 mt-10">No expenses recorded for this period</p>}
              </div>
          </div>
      );
  };

  const PnlReportView = () => {
    const [visibleCount, setVisibleCount] = useState(50);

    const filteredDate = useMemo(() => {
        const now = new Date();
        // 1. Filter Sales & Exclude Cancelled
        let txs = data.transactions.filter(t => ['sales'].includes(t.type) && t.status !== 'Cancelled');
        
        // 2. Apply Date Filter (Exact logic from Dashboard)
        return txs.filter(t => {
            const d = new Date(t.date);
            const tDate = d.toDateString();
            const nDate = now.toDateString();
            
            if (pnlFilter === 'Today') return tDate === nDate;
            if (pnlFilter === 'Weekly') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0,0,0,0);
                return d >= startOfWeek;
            }
            if (pnlFilter === 'Monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (pnlFilter === 'Yearly') return d.getFullYear() === now.getFullYear();
            if (pnlFilter === 'Custom' && pnlCustomDates.start && pnlCustomDates.end) {
                const s = new Date(pnlCustomDates.start);
                const e = new Date(pnlCustomDates.end);
                e.setHours(23,59,59,999);
                return d >= s && d <= e;
            }
            return true;
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [data.transactions, pnlFilter, pnlCustomDates]);

    const visibleData = filteredDate.slice(0, visibleCount);

    return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                <div className="text-center">
                    <h2 className="font-bold text-lg">Profit & Loss Report</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{pnlFilter} View</p>
                </div>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>
            <div className="p-4 space-y-4">
                {visibleData.map(tx => {
                    let serviceP = 0, goodsP = 0;
                    (tx.items || []).forEach(item => {
                        const m = data.items.find(i => i.id === item.itemId);
                        const type = m?.type || 'Goods';
                        const buy = parseFloat(item.buyPrice || m?.buyPrice || 0);
                        const sell = parseFloat(item.price || 0);
                        const qty = parseFloat(item.qty || 0);
                        if(type === 'Service') serviceP += (sell * qty);
                        else goodsP += ((sell - buy) * qty);
                    });
                    const totalP = serviceP + goodsP;
                    return (
                        <div key={tx.id} className="p-3 border rounded-xl bg-white shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-transform" onClick={() => setViewDetail({ type: 'transaction', id: tx.id })}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-800">{tx.id} • {formatDate(tx.date)}</span>
                                <span className="font-black text-green-600">{formatCurrency(totalP)}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex justify-between">
                                <span>Service Profit: {formatCurrency(serviceP)}</span>
                                <span>Goods Profit: {formatCurrency(goodsP)}</span>
                            </div>
                        </div>
                    );
                })}
                
                {filteredDate.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No sales found for this period.</div>
                )}

                {visibleCount < filteredDate.length && (
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 50)} 
                        className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200"
                    >
                        Load More ({filteredDate.length - visibleCount} remaining)
                    </button>
                )}
            </div>
        </div>
    );
  };

  const DetailView = () => {
    if (!viewDetail) return null;
    
    // --- TRANSACTION DETAIL ---
    if (viewDetail.type === 'transaction') {
      const tx = data.transactions.find(t => t.id === viewDetail.id);
      if (!tx) return null;
      const party = data.parties.find(p => p.id === tx.partyId);
      const totals = getBillLogic(tx);
      const isPayment = tx.type === 'payment';
      const paymentMode = tx.paymentMode || 'Cash';

      // --- Linked Data Logic ---
      // For Payments: Use own linkedBills. For Sales: Find payments linking to this sale.
      const relatedDocs = isPayment 
          ? (tx.linkedBills || []) 
          : data.transactions.filter(t => t.type === 'payment' && t.linkedBills?.some(l => l.billId === tx.id));

      // --- Profit Analysis Logic ---
      let pnl = { service: 0, goods: 0, discount: 0, total: 0 };
      if (!isPayment) {
          // 1. Calculate Gross
          const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
          
          // 2. Calculate Discount
          pnl.discount = parseFloat(tx.discountValue || 0);
          if (tx.discountType === '%') pnl.discount = (gross * pnl.discount) / 100;

          // 3. Calculate Item Profits
          (tx.items || []).forEach(item => {
            const itemMaster = data.items.find(i => i.id === item.itemId);
            const type = itemMaster?.type || 'Goods';
            const qty = parseFloat(item.qty || 0);
            const sell = parseFloat(item.price || 0);
            const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
            if (type === 'Service') pnl.service += (sell * qty);
            else pnl.goods += ((sell - buy) * qty);
          });
          
          // 4. Net Profit
          pnl.total = (pnl.service + pnl.goods) - pnl.discount;
      }
      
      const shareInvoice = () => { /* ... existing shareInvoice code ... */ };

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <div className="flex gap-2">
               {tx.status !== 'Cancelled' && <button onClick={shareInvoice} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-1"><Share2 size={16}/> PDF</button>}
               
               {checkPermission(user, 'canEditTasks') && (
                   <>
                       {tx.status !== 'Cancelled' ? (
                          <button onClick={() => cancelTransaction(tx.id)} className="p-2 bg-gray-100 text-gray-600 rounded-lg border hover:bg-red-50 hover:text-red-600 font-bold text-xs">Cancel</button>
                       ) : (
                          <span className="px-2 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs border border-red-200 flex items-center">CANCELLED</span>
                       )}
                       {tx.status !== 'Cancelled' && (
                           <button onClick={() => { pushHistory(); setModal({ type: tx.type, data: tx }); setViewDetail(null); }} className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full">Edit</button>
                       )}
                   </>
               )}
            </div>
          </div>
          <div className={`p-4 space-y-6 ${tx.status === 'Cancelled' ? 'opacity-60 grayscale' : ''}`}>
            <div className="text-center">
              <h1 className={`text-2xl font-black ${tx.status === 'Cancelled' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{formatCurrency(totals.amount)}</h1>
              <p className="text-xs font-bold text-gray-400 uppercase">{tx.type} • {formatDate(tx.date)}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">{isPayment ? 'Paid Via' : 'Party'}</p>
              <p className="font-bold text-lg">{party?.name || tx.category || 'Unknown'}</p>
              <p className="text-sm text-gray-500">{party?.mobile}</p>
            </div>

            {/* Linked Transactions Section */}
            {relatedDocs.length > 0 && (
                 <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                    <h3 className="font-bold text-yellow-800 text-xs uppercase mb-2">{isPayment ? 'Settled Bills' : 'Related Payments'}</h3>
                    <div className="space-y-2">
                        {relatedDocs.map((doc, idx) => {
                             const docId = isPayment ? doc.billId : doc.id;
                             const docAmt = isPayment ? doc.amount : (doc.linkedBills?.find(l => l.billId === tx.id)?.amount || 0);
                             return (
                                 <div key={idx} onClick={() => setViewDetail({ type: 'transaction', id: docId })} className="bg-white p-2 rounded-lg border flex justify-between items-center text-xs cursor-pointer">
                                     <span className="font-bold text-gray-700">{docId}</span>
                                     <div className="flex items-center gap-1">
                                         <span className="text-gray-500">Linked:</span>
                                         <span className="font-bold text-green-600">{formatCurrency(docAmt)}</span>
                                         <ChevronRight size={12} className="text-gray-400"/>
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                 </div>
            )}

            {tx.convertedFromTask && (
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <p className="text-xs font-bold text-purple-600 uppercase mb-1">Source Task</p>
                    <p className="text-sm font-bold text-gray-800">Task #{tx.convertedFromTask}</p>
                    <button onClick={() => { setViewDetail({ type: 'task', id: tx.convertedFromTask }); }} className="mt-2 text-xs font-bold text-white bg-purple-600 px-3 py-1 rounded-lg flex items-center gap-1"><LinkIcon size={12}/> View Source Task</button>
                </div>
            )}

            {/* Profit Analysis Section */}
            {['sales'].includes(tx.type) && user.role === 'admin' && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Info size={16}/> Profit Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Service Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.service)}</span></div>
                  <div className="flex justify-between"><span>Goods Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.goods)}</span></div>
                  <div className="flex justify-between text-red-500"><span>Less: Discount</span><span>-{formatCurrency(pnl.discount)}</span></div>
                  <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-black text-blue-900"><span>Net Profit</span><span>{formatCurrency(pnl.total)}</span></div>
                </div>
              </div>
            )}

             {!isPayment && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-400 text-xs uppercase">Items</h3>
                  {tx.items?.map((item, i) => {
                      const m = data.items.find(x => x.id === item.itemId);
                      // Calculate Item Profit
                      const sell = parseFloat(item.price || 0);
                      const buy = parseFloat(item.buyPrice || m?.buyPrice || 0);
                      const itemProfit = (sell - buy) * parseFloat(item.qty || 0);
                      
                      return (
                        <div key={i} className="flex justify-between p-3 border rounded-xl bg-white">
                          <div className="flex-1">
                              <p className="font-bold text-sm">{m?.name || 'Item'}</p>
                              <p className="text-xs text-gray-500">{item.qty} x {item.price}</p>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-sm">{formatCurrency(item.qty * item.price)}</p>
                              {user.role === 'admin' && <p className="text-[10px] font-bold text-green-600">P: {formatCurrency(itemProfit)}</p>}
                          </div>
                        </div>
                      );
                  })}
                </div>
            )}
          </div>
        </div>
      );
    }
    
    // --- TASK DETAIL ---
    if (viewDetail.type === 'task') {
        const task = data.tasks.find(t => t.id === viewDetail.id);
        if (!task) return null;
        const party = data.parties.find(p => p.id === task.partyId);
        
        const openEditTimeLog = (idx) => { pushHistory(); setEditingTimeLog({ task, index: idx }); };

        // Helper for Items dropdown
        const itemOptions = data.items.map(i => ({ 
            ...i, 
            subText: `Stock: ${itemStock[i.id] || 0}`, 
            subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' 
        }));
        
        const toggleTimer = (staffId) => {
            if (!user) return;
            const now = new Date().toISOString();
            let newLogs = [...(task.timeLogs || [])];
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

            if (activeLogIndex >= 0) {
                // STOP TIMER (No location needed)
                const start = new Date(newLogs[activeLogIndex].start); 
                const end = new Date(now);
                const duration = ((end - start) / 1000 / 60).toFixed(0); 
                newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration };
                updateTaskLogs(newLogs);
            } else {
                // START TIMER
                // 1. Check for conflicts
                const activeTask = data.tasks.find(t => t.timeLogs && t.timeLogs.some(l => l.staffId === staffId && !l.end));
                if (activeTask && activeTask.id !== task.id) { 
                    pushHistory(); 
                    setTimerConflict({ staffId, activeTaskId: activeTask.id, targetTaskId: task.id }); 
                    return; 
                }
                
                const staff = data.staff.find(s => s.id === staffId);
                
                // 2. Define helper to save log with or without location
                const saveLog = (locData) => {
                      newLogs.push({ 
                         staffId, 
                         staffName: staff?.name, 
                         start: now, 
                         end: null, 
                         duration: 0,
                         location: locData // Saves { lat, lng } or null
                     });
                    updateTaskLogs(newLogs);
                };

                // 3. Robust Geolocation Capture
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            saveLog({ lat: latitude, lng: longitude });
                        },
                        (err) => {
                            console.error("Location Error:", err);
                            saveLog(null); // Proceed even if location fails
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                } else {
                    saveLog(null);
                }
            }
        };

        const updateTaskLogs = (logs) => {
            const updatedTask = { ...task, timeLogs: logs };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t) }));
            setDoc(doc(db, "tasks", updatedTask.id), updatedTask);
        };
        
        const updateTaskItems = (newItems) => {
            const updated = { ...task, itemsUsed: newItems };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }));
            setDoc(doc(db, "tasks", updated.id), updated);
        };

        const addItem = (itemId) => {
             const item = data.items.find(i => i.id === itemId);
             if (!item) return;
             const newItem = { itemId, qty: 1, price: item.sellPrice || 0, buyPrice: item.buyPrice || 0, description: item.description || '' };
             updateTaskItems([...(task.itemsUsed || []), newItem]);
        };

        const updateLineItem = (idx, field, val) => {
             const newItems = [...(task.itemsUsed || [])];
             newItems[idx][field] = val;
             updateTaskItems(newItems);
        };

        // REQ 2: Fixed WhatsApp Share Link
        const shareTask = () => {
            const link = `${window.location.origin}?taskId=${task.id}`;
            const text = `*Task Details*\nID: ${task.id}\nTask: ${task.name}\nClient: ${party?.name || 'N/A'} (${party?.mobile || ''})\nStatus: ${task.status}\n\nLink: ${link}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        };

        const visibleStaff = data.staff.filter(s => {
            if (user.role === 'admin') return true; 
            return s.id === user.id; 
        });

        return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
              <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
              <h2 className="font-bold text-lg">Task Details</h2>
              <div className="flex gap-2">
                    {/* FIXED: Single Task Sync with Animation & Toast */}
                    <button 
                        onClick={async (e) => {
                            const icon = e.currentTarget.querySelector('svg');
                            if(icon) icon.classList.add('animate-spin'); // Start Spin
                            await refreshSingleRecord('tasks', task.id);
                            if(icon) icon.classList.remove('animate-spin'); // Stop Spin
                            showToast("Task Synced Successfully");
                        }} 
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <RefreshCw size={20}/>
                    </button>
                    
                    <button onClick={shareTask} className="p-2 bg-green-100 text-green-700 rounded-lg"><MessageCircle size={20}/></button>
                    
                    {checkPermission(user, 'canEditTasks') && (
                        <button onClick={() => { pushHistory(); setModal({ type: 'task', data: task }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
                    )}
              </div>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h1 className="text-xl font-black text-gray-800 mb-2">{task.name}</h1>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    <p className="text-sm text-gray-600 my-4">{task.description}</p>

                    {/* REQ 1: Client Details UI */}
                    {party && (
                        <div className="bg-white p-3 rounded-xl border mb-4 space-y-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Client</p>
                                    <p className="font-bold text-gray-800">{party.name}</p>
                                </div>
                                {party.lat && <a href={`https://www.google.com/maps?q=${party.lat},${party.lng}`} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MapPin size={16}/></a>}
                            </div>
                            <a href={`tel:${party.mobile}`} className="text-sm font-bold text-blue-600 flex items-center gap-1"><Phone size={14}/> {party.mobile}</a>
                            {party.address && <p className="text-xs text-gray-500">{party.address}</p>}
                        </div>
                    )}
                    
                    {/* Time Logs List */}
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                        {(task.timeLogs || []).map((log, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => { pushHistory(); setSelectedTimeLog({ task, index: idx }); }}
                                className="bg-white p-3 rounded-lg border flex justify-between items-center text-xs cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
                            >
                                <div>
                                    <p className="font-bold">{log.staffName}</p>
                                    <p className="text-gray-500">{formatTime(log.start)} - {log.end ? formatTime(log.end) : 'Running'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold bg-gray-100 px-2 py-1 rounded">{log.duration}m</span>
                                    <ChevronRight size={14} className="text-gray-400"/>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Staff Timer Controls */}
                    <div className="flex flex-col gap-2 mb-4">
                        {visibleStaff.map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-xl border"><span className="text-sm font-bold text-gray-700">{s.name}</span><button onClick={() => toggleTimer(s.id)} className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}</button></div>
                            );
                        })}
                    </div>
                </div>

                {/* REQ 1: Items Used Section */}
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Package size={18}/> Items / Parts Used</h3>
                    <div className="space-y-2 mb-4">
                        {(task.itemsUsed || []).map((line, idx) => (
                             <div key={idx} className="p-2 border rounded-xl bg-white relative space-y-2">
                                <button onClick={() => { const n = [...task.itemsUsed]; n.splice(idx, 1); updateTaskItems(n); }} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                                <div className="flex justify-between text-xs font-bold">
                                    <span>{data.items.find(i=>i.id===line.itemId)?.name || 'Unknown Item'}</span>
                                    <span>{formatCurrency(line.qty * line.price)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateLineItem(idx, 'qty', e.target.value)} />
                                    <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Price" value={line.price} onChange={e => updateLineItem(idx, 'price', e.target.value)} />
                                    <input className="flex-1 p-1 border rounded text-xs" placeholder="Desc" value={line.description || ''} onChange={e => updateLineItem(idx, 'description', e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {task.status !== 'Converted' && (
                        <SearchableSelect 
                            placeholder="+ Add Item to Task" 
                            options={itemOptions} 
                            value="" 
                            onChange={v => addItem(v)} 
                        />
                    )}
                </div>

                {/* New Bottom Convert Button */}
                {task.status !== 'Converted' && checkPermission(user, 'canEditTasks') && (
                    <button 
                        onClick={() => { pushHistory(); setConvertModal(task); }} 
                        className="w-full bg-purple-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-200 active:scale-95 transition-transform"
                    >
                        <RefreshCw size={20}/> Convert to Sale
                    </button>
                )}
            </div>
          </div>
        );
    }

    // --- STAFF DETAIL ---
    if (viewDetail.type === 'staff') {
        const staff = data.staff.find(s => s.id === viewDetail.id);
        if (!staff) return null;
        
        return (
            <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                    <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-bold text-lg">{staff.name}</h2>
                    {user.role === 'admin' && <button onClick={() => { pushHistory(); setModal({ type: 'staff', data: staff }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>}
                </div>
                <StaffDetailView staff={staff} />
            </div>
        );
    }

    const isItem = viewDetail.type === 'item';
    const record = data[isItem ? 'items' : 'parties'].find(r => r.id === viewDetail.id);
    if (!record) return null;

    const history = data.transactions.filter(tx => 
      isItem ? tx.items?.some(l => l.itemId === record.id) : tx.partyId === record.id
    ).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const mobiles = String(record.mobile || '').split(',').map(m => m.trim()).filter(Boolean);

    return (
      <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
          <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
          <h2 className="font-bold text-lg">{record.name}</h2>
          <div className="flex gap-2">
             {!isItem && <button onClick={() => { pushHistory(); setStatementModal({ partyId: record.id }); }} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1"><FileText size={12}/> Stmt</button>}
             <button onClick={() => { pushHistory(); setModal({ type: isItem ? 'item' : 'party', data: record }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
          </div>
        </div>
        
        <div className="p-4 space-y-6">
           <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gray-50 rounded-2xl border">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Current {isItem ? 'Stock' : 'Balance'}</p>
              <p className={`text-2xl font-black ${!isItem && partyBalances[record.id] > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {isItem ? `${itemStock[record.id] || 0} ${record.unit}` : formatCurrency(Math.abs(partyBalances[record.id] || 0))}
              </p>
              {!isItem && <p className="text-[10px] font-bold text-gray-400">{partyBalances[record.id] > 0 ? 'TO PAY' : 'TO COLLECT'}</p>}
            </div>
            {isItem ? (
                <div className="p-4 bg-gray-50 rounded-2xl border">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Prices</p>
                    <p className="text-sm font-bold">Sell: {formatCurrency(record.sellPrice)}</p>
                    <p className="text-sm text-gray-500">Buy: {formatCurrency(record.buyPrice)}</p>
                </div>
             ) : (
                <div className="p-4 bg-gray-50 rounded-2xl border space-y-1">
                    {mobiles.map((m, i) => <p key={i} className="text-sm font-bold flex items-center gap-1"><Phone size={12}/> <a href={`tel:${m}`}>{m}</a></p>)}
                    {record.address && <p className="text-xs text-gray-500 truncate">{record.address}</p>}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {record.lat && <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${record.lat},${record.lng}`)} className="py-2 bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"><Navigation size={12}/> Map</button>}
                    </div>
                </div>
             )}
           </div>

           <div className="space-y-3">
             <h3 className="font-bold flex items-center gap-2 text-gray-700"><History size={18}/> Transaction History</h3>
             {history.map(tx => {
               const totals = getBillLogic(tx);
               const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
               
               let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
               if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
               if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
               if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }

               return (
                 <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                   <div className="flex gap-4 items-center">
                     <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                     <div>
                       <p className="font-bold text-gray-800 uppercase text-xs">{tx.type} • {tx.paymentMode || 'Credit'}</p>
                       <p className="text-[10px] text-gray-400 font-bold">{tx.id} • {formatDate(tx.date)}</p>
                       <div className="flex gap-1 mt-1">
                           {['sales', 'purchase', 'expense'].includes(tx.type) && <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${totals.status === 'PAID' ? 'bg-green-100 text-green-700' : totals.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span>}
                       </div>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(totals.amount)}</p>
                     {['sales', 'purchase'].includes(tx.type) && totals.status !== 'PAID' && <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(totals.pending)}</p>}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    );
  };

  // REQ 2: Category Manager Component
  const CategoryManager = () => {
      const [newCat, setNewCat] = useState('');
      const [editingCat, setEditingCat] = useState(null); // { original: 'Name', current: 'Name' }
      
      const handleAdd = async () => {
          if(!newCat.trim()) return;
          const current = data.categories.expense || [];
          if(current.some(c => c.toLowerCase() === newCat.trim().toLowerCase())) return showToast("Category already exists", "error");
          
          const updated = [...current, newCat.trim()];
          const fullCats = { ...data.categories, expense: updated };
          
          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          setNewCat('');
          showToast("Category Added");
      };

      const handleUpdate = async (original, newName) => {
          if (!newName || !newName.trim()) return;
          const current = data.categories.expense || [];
          
          // Check duplicate (excluding self)
          if(current.some(c => c !== original && c.toLowerCase() === newName.trim().toLowerCase())) {
              return showToast("Category already exists", "error");
          }

          const updated = current.map(c => c === original ? newName.trim() : c);
          const fullCats = { ...data.categories, expense: updated };
          
          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          setEditingCat(null);
          showToast("Category Updated");
      };

      const handleDelete = async (catName) => {
          if(!window.confirm(`Delete category "${catName}"?`)) return;
          const updated = (data.categories.expense || []).filter(c => c !== catName);
          const fullCats = { ...data.categories, expense: updated };

          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          showToast("Deleted");
      };

      return (
        <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                  <h1 className="text-xl font-bold">Expense Categories</h1>
              </div>
              
              <div className="flex gap-2">
                  <input className="flex-1 p-3 bg-gray-50 border rounded-xl" placeholder="New Category Name..." value={newCat} onChange={e=>setNewCat(e.target.value)} />
                  <button onClick={handleAdd} className="p-3 bg-blue-600 text-white rounded-xl"><Plus/></button>
              </div>

              <div className="space-y-2">
                  {(data.categories.expense || []).map((cat, idx) => (
                      <div key={idx} className="p-3 bg-white border rounded-xl flex justify-between items-center">
                         {editingCat?.original === cat ? (
                             <div className="flex flex-1 gap-2 mr-2">
                                 <input 
                                     className="flex-1 p-2 border rounded-lg text-sm" 
                                     value={editingCat.current} 
                                     autoFocus
                                     onChange={e => setEditingCat({ ...editingCat, current: e.target.value })}
                                 />
                                 <button onClick={() => handleUpdate(cat, editingCat.current)} className="p-2 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 size={16}/></button>
                                 <button onClick={() => setEditingCat(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><X size={16}/></button>
                             </div>
                         ) : (
                             <>
                                 <span className="font-bold text-gray-800">{cat}</span>
                                 <div className="flex gap-2">
                                     <button onClick={() => setEditingCat({ original: cat, current: cat })} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={16}/></button>
                                     <button onClick={() => handleDelete(cat)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
                                 </div>
                             </>
                         )}
                      </div>
                  ))}
                  {(data.categories.expense || []).length === 0 && <p className="text-center text-gray-400">No categories found.</p>}
              </div>
        </div>
      );
  };

  // 2. Forms
  const TransactionForm = ({ type, record }) => {
    // Initialize state with default values or existing record data
    const [tx, setTx] = useState(record ? { 
        linkedBills: [], 
        items: [], 
        paymentMode: 'Cash', 
        discountType: '%', 
        discountValue: 0, 
        ...record 
    } : { 
        type, 
        date: new Date().toISOString().split('T')[0], 
        partyId: '', 
        items: [], 
        discountType: '%', 
        discountValue: 0, 
        received: 0, 
        paid: 0, 
        paymentMode: 'Cash', 
        category: '', 
        subType: type === 'payment' ? 'in' : '', 
        amount: '', 
        linkedBills: [], 
        description: '',
        address: '', 
        mobile: '', 
        lat: '', 
        lng: '', 
        locationLabel: ''
    });
    
    const [showLinking, setShowLinking] = useState(false);
    const [showLocPicker, setShowLocPicker] = useState(false); // Local state for location
    
    // REQ 4: Calculate Voucher ID using useMemo
    const currentVoucherId = useMemo(() => {
        if (record?.id) return record.id;
        return getNextId(data, type).id;
    }, [data, type, record]);

    const totals = getTransactionTotals(tx);
    const selectedParty = data.parties.find(p => p.id === tx.partyId);

    const handleLocationSelect = (loc) => {
        setTx({
            ...tx,
            address: loc.address,
            mobile: loc.mobile || selectedParty?.mobile || '',
            lat: loc.lat || '',
            lng: loc.lng || '',
            locationLabel: loc.label
        });
        setShowLocPicker(false);
    };
    
    const unpaidBills = useMemo(() => {
      if (!tx.partyId) return [];
      return data.transactions.filter(t => t.partyId === tx.partyId && t.id !== tx.id && t.type !== 'estimate' && ( (['sales', 'purchase', 'expense'].includes(t.type) && getBillLogic(t).status !== 'PAID') || (t.type === 'payment' && getBillLogic(t).status !== 'FULLY USED') ) );
    }, [tx.partyId, data.transactions]);

    const updateLine = (idx, field, val) => {
        const newItems = [...tx.items]; newItems[idx][field] = val;
        if(field==='itemId') {
            const item = data.items.find(i=>i.id===val);
            if(item) { newItems[idx].price = type==='purchase'?item.buyPrice:item.sellPrice; newItems[idx].buyPrice = item.buyPrice; newItems[idx].description = item.description || ''; }
        }
        setTx({...tx, items: newItems});
    };

    const itemOptions = data.items.map(i => ({ ...i, subText: `Stock: ${itemStock[i.id] || 0}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    const partyOptions = data.parties.map(p => ({ ...p, subText: partyBalances[p.id] ? formatCurrency(Math.abs(partyBalances[p.id])) + (partyBalances[p.id]>0?' DR':' CR') : 'Settled', subColor: partyBalances[p.id]>0?'text-green-600':partyBalances[p.id]<0?'text-red-600':'text-gray-400' }));
    
    const handleLinkChange = (billId, value) => {
        const amt = parseFloat(value) || 0;
        const maxLimit = parseFloat(tx.amount || 0);

        // 1. Basic validation: Ensure amount exists
        if (maxLimit <= 0) {
            alert("Please enter the Payment Amount first.");
            return;
        }

        let newLinked = [...(tx.linkedBills || [])];
        const existingIdx = newLinked.findIndex(l => l.billId === billId);
        
        // 2. Create tentative new state to calculate total
        if (existingIdx >= 0) {
            if (amt <= 0) newLinked.splice(existingIdx, 1);
            else newLinked[existingIdx] = { ...newLinked[existingIdx], amount: amt };
        } else if (amt > 0) {
            newLinked.push({ billId, amount: amt });
        }
        
        // 3. Calculate Total Linked Amount
        const currentTotal = newLinked.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
        
        // 4. Validate against maxLimit (ignoring discount)
        if (currentTotal > maxLimit) {
            alert(`Cannot link more than the Payment Amount (${maxLimit}). Current Total: ${currentTotal}`);
            return;
        }

        setTx({ ...tx, linkedBills: newLinked });
    };

    return (
      <div className="space-y-4">
        {/* REQ 4: Header with Voucher ID */}
        <div className="flex justify-between items-center border-b pb-2">
            <div>
                <h2 className="text-xl font-bold capitalize">{type}</h2>
                <p className="text-xs font-bold text-gray-500">Voucher: #{currentVoucherId}</p>
            </div>
            <div className="text-right">
                <p className="text-xs font-bold text-gray-400">Total</p>
                <p className="text-xl font-black text-blue-600">{formatCurrency(totals.final)}</p>
            </div>
        </div>

        {/* REQ 2: Payment Toggle Moved to Top */}
        {type === 'payment' && (
            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={()=>setTx({...tx, subType: 'in'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType==='in' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>Received (In)</button>
                <button onClick={()=>setTx({...tx, subType: 'out'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType==='out' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Paid (Out)</button>
            </div>
        )}
        
        {/* REQ 1: Date Input (Vertical Stacking - w-full) */}
        <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
             <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-sm h-[50px]" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} />
        </div>

        {/* REQ 1 & 3: Party Select (Vertical Stacking - w-full) */}
        {/* Even for Expense, we now ask for Party FIRST */}
        <div>
             <SearchableSelect 
                label={type === 'expense' ? "Paid To (Party)" : "Party / Client"} 
                options={partyOptions} 
                value={tx.partyId} 
                onChange={v => setTx({...tx, partyId: v, locationLabel: '', address: ''})} 
                onAddNew={() => { pushHistory(); setModal({ type: 'party' }); }} 
                placeholder="Select Party..." 
            />
            {/* Location Selector */}
            {selectedParty?.locations?.length > 0 && (
                <div className="relative mt-1 mb-2">
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                         <div className="text-xs text-blue-800">
                            <span className="font-bold">Location: </span> 
                            {tx.locationLabel ? tx.locationLabel : 'Default / Primary'}
                            {tx.address && <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{tx.address}</div>}
                         </div>
                         <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded shadow-sm text-blue-600 flex items-center gap-1">
                             <MapPin size={10}/> Change
                         </button>
                    </div>
                    {showLocPicker && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl p-2 space-y-1">
                            <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile, lat: selectedParty.lat, lng: selectedParty.lng })} className="p-2 hover:bg-gray-50 cursor-pointer rounded text-xs border-b">
                                <span className="font-bold text-gray-600">Default (Primary)</span>
                                <div className="truncate">{selectedParty.address}</div>
                            </div>
                            {selectedParty.locations.map((loc, idx) => (
                                <div key={idx} onClick={() => handleLocationSelect(loc)} className="p-2 hover:bg-blue-50 cursor-pointer rounded text-xs">
                                    <span className="font-bold text-blue-600">{loc.label}</span>
                                    <div className="truncate text-gray-600">{loc.address}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* REQ 3: Expense Category (Shown BELOW Party for expenses) */}
        {type === 'expense' && (
             <SearchableSelect 
                label="Expense Category"
                options={data.categories.expense} 
                value={tx.category} 
                onChange={v => setTx({...tx, category: v})} 
                onAddNew={() => { const newCat = prompt("New Category:"); if(newCat) setData(prev => ({...prev, categories: {...prev.categories, expense: [...prev.categories.expense, newCat]}})); }} 
                placeholder="Select Category..." 
            />
        )}

        {/* ITEMS SECTION (For everything except pure Payment) */}
        {type !== 'payment' && (
            <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Items / Services</h4>
                    <button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="text-blue-600 text-xs font-bold">+ Add Item</button>
                </div>
                {tx.items.map((line, idx) => (
                    <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2">
                        <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                        <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateLine(idx, 'itemId', v)} />
                        <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
                        <div className="flex gap-2">
                            <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} />
                            <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Price" value={line.price} onChange={e => updateLine(idx, 'price', e.target.value)} />
                            <div className="flex-1 text-right self-center text-xs font-bold text-gray-500">{formatCurrency(line.qty * line.price)}</div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* PAYMENT SECTION (Specific for Payment Type) */}
        {type === 'payment' && (
            <div className="space-y-4 pt-2 border-t">
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Amount</label>
                        <input type="number" className="w-full bg-blue-50 text-2xl font-bold p-4 rounded-xl text-blue-600" placeholder="0.00" value={tx.amount} onChange={e=>setTx({...tx, amount: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Mode</label>
                        <select className="w-full bg-gray-50 p-4 rounded-xl font-bold h-[68px]" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}>
                            <option>Cash</option><option>Bank</option><option>UPI</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                    <span className="text-xs font-bold text-gray-500">Discount:</span>
                    <input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Amt" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})}/>
                </div>
                <button onClick={() => setShowLinking(!showLinking)} className="w-full p-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">{showLinking?"Hide":"Link Bills (Advanced)"}</button>
                {showLinking && (
                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-xl">
                        {unpaidBills.map(b => (
                            <div key={b.id} className="flex justify-between items-center p-2 border-b last:border-0">
                                <div className="text-[10px]">
                                    <p className="font-bold">{b.id} • {b.type === 'payment' ? (b.subType==='in'?'IN':'OUT') : b.type}</p>
                                    <p>{formatDate(b.date)} • Tot: {formatCurrency(b.amount || getBillLogic(b).final)} <br/> 
                                    <span className="text-red-600">
                                        Due: {formatCurrency(b.type === 'payment' ? (getBillLogic(b).amount - getBillLogic(b).used) : getBillLogic(b).pending)}
                                    </span>
                                    </p>
                                </div>
                                <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Amt" value={tx.linkedBills?.find(l=>l.billId===b.id)?.amount||''} onChange={e => handleLinkChange(b.id, e.target.value)}/>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
        
        {/* PAYMENT DETAILS (For Sales/Purchase/Expense) */}
        {['sales', 'purchase', 'expense'].includes(type) && (
             <div className="p-4 bg-gray-50 rounded-xl border space-y-3 mt-2">
                 <div className="flex justify-between items-center">
                     <span className="text-xs font-bold uppercase text-gray-500">{type === 'sales' ? 'Received Now' : 'Paid Now'}</span>
                     <div className="flex items-center gap-2">
                        <input type="number" className="w-24 p-2 border rounded-lg text-right font-bold" placeholder="0" value={type==='sales'?tx.received:tx.paid} onChange={e => setTx({...tx, [type==='sales'?'received':'paid']: e.target.value})} />
                        <select className="p-2 border rounded-lg text-xs" value={tx.paymentMode} onChange={e=>setTx({...tx, paymentMode: e.target.value})}><option>Cash</option><option>Bank</option><option>UPI</option></select>
                     </div>
                 </div>
                 <div className="flex justify-between items-center">
                     <span className="text-xs font-bold uppercase text-gray-500">Discount</span>
                     <div className="flex items-center gap-2">
                        <input type="number" className="w-20 p-2 border rounded-lg text-right" placeholder="0" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})} />
                        <select className="p-2 border rounded-lg text-xs" value={tx.discountType} onChange={e=>setTx({...tx, discountType: e.target.value})}><option>%</option><option>Amt</option></select>
                     </div>
                 </div>
             </div>
        )}

        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-16" placeholder="Notes" value={tx.description} onChange={e => setTx({...tx, description: e.target.value})} />
        
        {/* Save Button */}
        <button 
            onClick={() => { 
                if(!tx.partyId) return alert("Party is Required"); 
                if(type === 'expense' && !tx.category) return alert("Category is Required");
                
                // FIX: Override 'amount' with recalculated 'totals.final' for item-based transactions.
                // This ensures that if items changed during edit, the total amount updates correctly.
                const finalRecord = {
                    ...tx,
                    ...totals,
                    amount: type === 'payment' ? tx.amount : totals.final
                };

                saveRecord('transactions', finalRecord, tx.type); 
            }} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
        >
            Save {type}
        </button>
      </div>
    );
  };

  const TaskForm = ({ record }) => {
    const [form, setForm] = useState(record ? { ...record, itemsUsed: record.itemsUsed || [], assignedStaff: record.assignedStaff || [] } : { name: '', partyId: '', description: '', status: 'To Do', dueDate: '', assignedStaff: [], itemsUsed: [], address: '', mobile: '', lat: '', lng: '', locationLabel: '' });
    const [showLocPicker, setShowLocPicker] = useState(false); // Local state for location picker
    
    const itemOptions = data.items.map(i => ({ ...i, subText: `Stock: ${itemStock[i.id] || 0}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    const selectedParty = data.parties.find(p => p.id === form.partyId);
    
    const updateItem = (idx, field, val) => { const n = [...form.itemsUsed]; n[idx][field] = val; if(field==='itemId') { const item = data.items.find(i=>i.id===val); if(item) { n[idx].price = item.sellPrice; n[idx].buyPrice = item.buyPrice; n[idx].description = item.description || ''; } } setForm({...form, itemsUsed: n}); };
    
    const handleLocationSelect = (loc) => {
        setForm({
            ...form,
            address: loc.address,
            mobile: loc.mobile || selectedParty?.mobile || '',
            lat: loc.lat || '',
            lng: loc.lng || '',
            locationLabel: loc.label
        });
        setShowLocPicker(false);
    };

    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <div className="p-3 bg-gray-50 rounded-xl border"><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Assigned Staff</label><div className="flex flex-wrap gap-2 mb-2">{form.assignedStaff.map(sid => { const s = data.staff.find(st => st.id === sid); return (<span key={sid} className="bg-white border px-2 py-1 rounded-full text-xs flex items-center gap-1">{s?.name} <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button></span>); })}</div><select className="w-full p-2 border rounded-lg text-sm bg-white" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}><option value="">+ Add Staff</option>{data.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        
        <div>
            <SearchableSelect label="Client" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v, locationLabel: '', address: ''})} />
            
            {/* Location Selector for Task */}
            {selectedParty?.locations?.length > 0 && (
                <div className="mt-1 relative">
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                         <div className="text-xs text-blue-800">
                            <span className="font-bold">Location: </span> 
                            {form.locationLabel ? form.locationLabel : 'Default / Primary'}
                            {form.address && <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{form.address}</div>}
                         </div>
                         <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded shadow-sm text-blue-600 flex items-center gap-1">
                             <MapPin size={10}/> Change
                         </button>
                    </div>
                    {showLocPicker && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl p-2 space-y-1">
                            <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile, lat: selectedParty.lat, lng: selectedParty.lng })} className="p-2 hover:bg-gray-50 cursor-pointer rounded text-xs border-b">
                                <span className="font-bold text-gray-600">Default (Primary)</span>
                                <div className="truncate">{selectedParty.address}</div>
                            </div>
                            {selectedParty.locations.map((loc, idx) => (
                                <div key={idx} onClick={() => handleLocationSelect(loc)} className="p-2 hover:bg-blue-50 cursor-pointer rounded text-xs">
                                    <span className="font-bold text-blue-600">{loc.label}</span>
                                    <div className="truncate text-gray-600">{loc.address}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <div className="space-y-2"><div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items / Parts</h4><button onClick={() => setForm({...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="text-blue-600 text-xs font-bold">+ Add</button></div>{form.itemsUsed.map((line, idx) => (<div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2"><button onClick={() => setForm({...form, itemsUsed: form.itemsUsed.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button><SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} /><input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} /><div className="flex gap-2"><input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} /><input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} /><input type="number" className="w-20 p-1 border rounded text-xs bg-gray-100" placeholder="Buy" value={line.buyPrice} onChange={e => updateItem(idx, 'buyPrice', e.target.value)} /></div></div>))}</div>
        <div className="grid grid-cols-2 gap-4"><input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /><select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>To Do</option><option>In Progress</option><option>Done</option></select></div>
        <button onClick={() => saveRecord('tasks', form, 'task')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
      </div>
    );
  };

  const TaskModule = () => {
    const [sort, setSort] = useState('DateAsc');
    const [search, setSearch] = useState('');
    
    const filtered = data.tasks.filter(t => {
        const clientName = data.parties.find(p => p.id === t.partyId)?.name || '';
        const searchText = search.toLowerCase();
        return t.name.toLowerCase().includes(searchText) || t.description.toLowerCase().includes(searchText) || clientName.toLowerCase().includes(searchText);
    });

    const sortedTasks = sortData(filtered, sort);
    const pending = sortedTasks.filter(t => t.status !== 'Done' && t.status !== 'Converted');
    const done = sortedTasks.filter(t => t.status === 'Done' || t.status === 'Converted');

    const TaskItem = ({ task }) => {
      const party = data.parties.find(p => p.id === task.partyId);
      return (
        <div onClick={() => { pushHistory(); setViewDetail({ type: 'task', id: task.id }); }} className="p-4 bg-white border rounded-2xl mb-2 flex justify-between items-start cursor-pointer active:scale-95 transition-transform">
          <div className="flex-1">
            <div className="flex flex-col gap-1 mb-1">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : task.status === 'Converted' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                    <p className="font-bold text-gray-800">{task.name}</p>
                </div>
                {party && (
                     <span className="self-start text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold truncate max-w-[150px] ml-4 border border-blue-100">
                       {party.name}
                     </span>
                )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-1 ml-4">{task.description}</p>
            <div className="flex gap-3 mt-2 ml-4 text-[10px] font-bold text-gray-400 uppercase">
                <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.dueDate)}</span>
                <span className="flex items-center gap-1"><Users size={10} /> {task.assignedStaff?.length || 0} Staff</span>
            </div>
          </div>
          <div className="text-right"><p className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">{task.id}</p></div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Tasks</h1>
            <div className="flex gap-2 items-center">
                <input className="p-2 border rounded-xl text-xs w-32" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}/>
                <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="DateAsc">Due Soon</option>
                    <option value="DateDesc">Due Later</option>
                    <option value="A-Z">A-Z</option>
                    <option value="Z-A">Z-A</option>
                </select>
                {checkPermission(user, 'canEditTasks') && <button onClick={() => { pushHistory(); setModal({ type: 'task' }); }} className="p-2 bg-blue-600 text-white rounded-xl"><Plus /></button>}
            </div>
        </div>
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Pending ({pending.length})</h3>
            {pending.map(t => <TaskItem key={t.id} task={t} />)}
        </div>
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Completed ({done.length})</h3>
            <div className="opacity-60">
                {done.map(t => <TaskItem key={t.id} task={t} />)}
            </div>
        </div>
      </div>
    );
  };

  const StaffForm = ({ record }) => {
    const [form, setForm] = useState({ name: '', mobile: '', role: 'Staff', active: true, loginId: '', password: '', permissions: { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true }, ...(record || {}) });
    const togglePerm = (p) => setForm({ ...form, permissions: { ...form.permissions, [p]: !form.permissions[p] } });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Staff Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <div className="grid grid-cols-2 gap-4"><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Login ID" value={form.loginId} onChange={e => setForm({...form, loginId: e.target.value})} /><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
        <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option>Admin</option><option>Staff</option><option>Manager</option></select>
        <div className="p-4 bg-gray-50 rounded-xl border"><p className="font-bold text-xs uppercase text-gray-500 mb-2">Permissions</p><div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewDashboard} onChange={() => togglePerm('canViewDashboard')}/> View Home</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewAccounts} onChange={() => togglePerm('canViewAccounts')}/> View Accounts</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewMasters} onChange={() => togglePerm('canViewMasters')}/> View Masters</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewTasks} onChange={() => togglePerm('canViewTasks')}/> View Tasks</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canEditTasks} onChange={() => togglePerm('canEditTasks')}/> Edit Tasks</label></div></div>
        <button onClick={() => saveRecord('staff', form, 'staff')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Staff</button>
      </div>
    );
  };

  // FIX #4: Party Form Missing Fields
  const PartyForm = ({ record }) => {
    const [form, setForm] = useState({ 
        name: '', mobile: '', email: '', 
        address: '', lat: '', lng: '', reference: '', 
        openingBal: '', type: 'DR', // type maps to opening balance type (DR/CR)
        locations: [], // Array to store multiple addresses
        ...(record || {}) 
    });

    const [newLoc, setNewLoc] = useState({ label: '', address: '', mobile: '', lat: '', lng: '' });

    const addLocation = () => {
        if (!newLoc.label || !newLoc.address) return alert("Label and Address are required");
        setForm(prev => ({ ...prev, locations: [...(prev.locations || []), newLoc] }));
        setNewLoc({ label: '', address: '', mobile: '', lat: '', lng: '' });
    };

    const removeLocation = (idx) => {
        setForm(prev => ({ ...prev, locations: prev.locations.filter((_, i) => i !== idx) }));
    };

    return (
        <div className="space-y-4">
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Ref By" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
            </div>
            
            <div className="p-3 bg-gray-50 rounded-xl border space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Primary Address</p>
                <textarea className="w-full p-3 bg-white border rounded-xl" placeholder="Main Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                     <input className="w-full p-3 bg-white border rounded-xl" placeholder="Latitude" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} />
                     <input className="w-full p-3 bg-white border rounded-xl" placeholder="Longitude" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} />
                </div>
            </div>

            {/* Location Manager Section */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><MapPin size={12}/> Multiple Locations</p>
                
                {/* List of Added Locations */}
                {(form.locations || []).map((loc, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-start text-xs">
                        <div>
                            <span className="font-bold text-blue-700 bg-blue-100 px-1 rounded mr-1">{loc.label}</span>
                            <span className="text-gray-600">{loc.address}</span>
                            {loc.mobile && <div className="text-gray-400 mt-1">Contact: {loc.mobile}</div>}
                        </div>
                        <button onClick={() => removeLocation(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded"><X size={14}/></button>
                    </div>
                ))}

                {/* Add New Location Inputs */}
                <div className="space-y-2 pt-2 border-t border-blue-200">
                    <div className="flex gap-2">
                        <input className="w-1/3 p-2 border rounded-lg text-xs" placeholder="Label (e.g. Office)" value={newLoc.label} onChange={e => setNewLoc({...newLoc, label: e.target.value})} />
                        <input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Address" value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                        <input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Site Mobile" value={newLoc.mobile} onChange={e => setNewLoc({...newLoc, mobile: e.target.value})} />
                        <button onClick={addLocation} className="px-4 bg-blue-600 text-white rounded-lg font-bold text-xs">Add</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Opening Bal" value={form.openingBal} onChange={e => setForm({...form, openingBal: e.target.value})} />
                 <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                     <option value="DR">Debit (To Collect)</option>
                     <option value="CR">Credit (To Pay)</option>
                 </select>
            </div>
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Email (Optional)" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <button onClick={() => saveRecord('parties', form, 'party')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save</button>
        </div>
    );
  };
   
  const ItemForm = ({ record }) => {
    const [form, setForm] = useState({ name: '', sellPrice: '', buyPrice: '', unit: 'pcs', openingStock: '0', type: 'Goods', ...(record || {}) });
    return (
       <div className="space-y-4">
         <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Item Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
         <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option>Goods</option><option>Service</option><option>Expense Item</option></select>
         <div className="grid grid-cols-2 gap-4"><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Sell Price" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} /><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Buy Price" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} /></div>
         <div className="grid grid-cols-2 gap-4"><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Unit (e.g. pcs)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Opening Stock" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} /></div>
         <button onClick={() => saveRecord('items', form, 'item')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Item</button>
       </div>
    );
  };
   
  const CompanyForm = ({ record }) => {
    const [form, setForm] = useState(data.company);
    return <div className="space-y-4"><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Company Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} /><textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /><button onClick={() => { setData({...data, company: form}); setModal({type:null}); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Settings</button></div>;
  };

  if (!user) return <LoginScreen setUser={setUser} />;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="text-sm font-bold">{toast.message}</span></div>}
      <DetailView />
      
      {/* REQ 4: Header with Manual Sync Button */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div><span className="font-black text-gray-800 tracking-tight">SMEES Pro</span></div>
        <div className="flex gap-3">
            <button onClick={() => syncData(false)} className={`p-2 hover:bg-gray-100 rounded-full ${loading ? 'animate-spin' : ''}`}><RefreshCw size={20} className="text-blue-600" /></button>
            <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4">
        {loading ? <div className="flex flex-col items-center justify-center h-64 text-gray-400"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div><p className="text-sm font-bold">Syncing Data...</p></div> : (
          <>
            {activeTab === 'dashboard' && checkPermission(user, 'canViewDashboard') && <Dashboard />}
            {activeTab === 'accounting' && checkPermission(user, 'canViewAccounts') && <TransactionList />}
            {activeTab === 'tasks' && checkPermission(user, 'canViewTasks') && <TaskModule />}
            {activeTab === 'staff' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800">Staff</h2>
                        <button onClick={() => { localStorage.removeItem('smees_user'); setUser(null); }} className="p-2 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 font-bold text-xs"><LogOut size={18} /> Logout</button>
                    </div>
                    {mastersView === null ? (
                        <div className="space-y-4"><MasterList title="Team Members" collection="staff" type="staff" onRowClick={(s) => { pushHistory(); setViewDetail({type: 'staff', id: s.id}); }} /></div>
                    ) : null}
                </div>
            )}
            {activeTab === 'masters' && checkPermission(user, 'canViewMasters') && (
              <div className="space-y-6">
                {mastersView === null ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { pushHistory(); setMastersView('items'); }} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100"><Package size={32} className="text-blue-600"/><span className="font-bold text-blue-800">Items</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('parties'); }} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100"><Users size={32} className="text-emerald-600"/><span className="font-bold text-emerald-800">Parties</span></button>
                        
                        {/* Cash & Bank Buttons */}
                        <button onClick={() => { pushHistory(); setAdjustCashModal({ type: 'Cash' }); }} className="p-6 bg-green-50 border border-green-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-green-100"><Banknote size={32} className="text-green-600"/><span className="font-bold text-green-800">Cash</span></button>
                        <button onClick={() => { pushHistory(); setAdjustCashModal({ type: 'Bank' }); }} className="p-6 bg-cyan-50 border border-cyan-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-cyan-100"><Briefcase size={32} className="text-cyan-600"/><span className="font-bold text-cyan-800">Bank</span></button>

                        {/* REQ 3: Expense Categories Button */}
                        <button onClick={() => { pushHistory(); setMastersView('categories'); }} className="p-6 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-red-100"><ReceiptText size={32} className="text-red-600"/><span className="font-bold text-red-800">Exp. Cats</span></button>

                        {/* IMPORT BUTTONS */}
                        {user.role === 'admin' && (
                            <>
                                <label className="p-6 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-purple-100 cursor-pointer">
                                    <Upload size={32} className="text-purple-600"/>
                                    <span className="font-bold text-purple-800 text-center">Import<br/>Transactions</span>
                                    <input type="file" hidden accept=".xlsx, .xls" onChange={handleTransactionImport} />
                                </label>
                                <label className="p-6 bg-orange-50 border border-orange-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-orange-100 cursor-pointer">
                                    <Upload size={32} className="text-orange-600"/>
                                    <span className="font-bold text-orange-800 text-center">Import<br/>Payments</span>
                                    <input type="file" hidden accept=".xlsx, .xls" onChange={handlePaymentImport} />
                                </label>
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        <button onClick={handleCloseUI} className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800"><ArrowLeft size={18}/> Back</button>
                        {mastersView === 'items' && <MasterList title="Items" collection="items" type="item" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'item', id: item.id}); }} />}
                        {mastersView === 'parties' && <MasterList title="Parties" collection="parties" type="party" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'party', id: item.id}); }} />}
                        {mastersView === 'expenses' && <ExpensesBreakdown />}
                        {/* REQ 3: Render Category Manager */}
                        {mastersView === 'categories' && <CategoryManager />}
                    </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {[{ id: 'dashboard', icon: <LayoutDashboard />, label: 'Home', perm: 'canViewDashboard' }, { id: 'accounting', icon: <ReceiptText />, label: 'Accounts', perm: 'canViewAccounts' }, { id: 'tasks', icon: <CheckSquare />, label: 'Tasks', perm: 'canViewTasks' }, { id: 'masters', icon: <Package />, label: 'Masters', perm: 'canViewMasters' }, { id: 'staff', icon: <Users />, label: 'Staff' }].map(tab => {
            if (tab.perm && !checkPermission(user, tab.perm)) return null;
            return <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMastersView(null); setListFilter('all'); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>{tab.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span></button>;
        })}
      </nav>
      <Modal isOpen={!!modal.type} onClose={handleCloseUI} title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}>
        {modal.type === 'company' && <CompanyForm />}
        {modal.type === 'party' && <PartyForm record={modal.data} />}
        {modal.type === 'item' && <ItemForm record={modal.data} />}
        {modal.type === 'staff' && <StaffForm record={modal.data} />}
        {modal.type === 'task' && <TaskForm record={modal.data} />}
        {['sales', 'estimate', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} />}
      </Modal>
      {timerConflict && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center"><AlertTriangle className="text-yellow-600 mx-auto mb-4" size={32}/><h3 className="font-bold">Timer Conflict</h3><p className="text-sm my-2">Another task is active.</p><button onClick={() => setTimerConflict(null)} className="p-2 bg-gray-100 rounded font-bold">Dismiss</button></div></div>}
      {showPnlReport && <PnlReportView />}
      
      {/* RENDER MODALS OUTSIDE MAIN FLOW WITH PROPS */}
      {convertModal && (
        <ConvertTaskModal 
            task={convertModal} 
            onClose={() => setConvertModal(null)} 
            saveRecord={saveRecord} 
            setViewDetail={setViewDetail} 
            handleCloseUI={handleCloseUI} 
        />
      )}
      
      {editingTimeLog && (
        <TimeLogModal 
            editingTimeLog={editingTimeLog} 
            setEditingTimeLog={setEditingTimeLog} 
            data={data} 
            setData={setData} 
            handleCloseUI={handleCloseUI} 
            showToast={showToast} 
        />
      )}
      
      {statementModal && (
        <StatementModal 
            isOpen={!!statementModal} 
            onClose={() => setStatementModal(null)} 
        />
      )}
      
      {manualAttModal && (
        <ManualAttendanceModal 
            manualAttModal={manualAttModal} 
            setManualAttModal={setManualAttModal} 
            data={data} 
            setData={setData} 
            handleCloseUI={handleCloseUI} 
            showToast={showToast} 
        />
      )}
      
      {adjustCashModal && (
        <CashAdjustmentModal 
            adjustCashModal={adjustCashModal} 
            setAdjustCashModal={setAdjustCashModal} 
            saveRecord={saveRecord} 
            handleCloseUI={handleCloseUI} 
        />
      )}
      
      {selectedTimeLog && (
        <TimeLogDetailsModal 
            selectedTimeLog={selectedTimeLog} 
            setSelectedTimeLog={setSelectedTimeLog} 
            handleCloseUI={handleCloseUI} 
        />
      )}
    </div>
  );
}