import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
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
  MessageCircle
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
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

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
  counters: { party: 100, item: 100, staff: 100, transaction: 1000, task: 500 }
};

// --- HELPER FUNCTIONS ---
const getNextId = (data, type) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;
  if (type === 'transaction' || type === 'estimate') { prefix = 'TX'; counterKey = 'transaction'; }
  if (type === 'sales') { prefix = 'S'; counterKey = 'transaction'; }
  if (type === 'purchase') { prefix = 'P'; counterKey = 'transaction'; }
  if (type === 'expense') { prefix = 'E'; counterKey = 'transaction'; }
  if (type === 'payment') { prefix = 'PAY'; counterKey = 'transaction'; }

  const counters = data.counters || INITIAL_DATA.counters; 
  const num = counters[counterKey] || 1000;
  const nextCounters = { ...counters };
  nextCounters[counterKey] = num + 1;
  return { id: `${prefix}-${num}`, nextCounters };
};

const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

const getTransactionTotals = (tx) => {
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

// --- COMPONENTS ---
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
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
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

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
    signInAnonymously(auth);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const newData = { ...INITIAL_DATA };
        const collections = ['parties', 'items', 'staff', 'transactions', 'tasks', 'attendance'];
        for (const col of collections) {
            const querySnapshot = await getDocs(collection(db, col));
            newData[col] = querySnapshot.docs.map(doc => doc.data());
        }
        const companySnap = await getDocs(collection(db, "settings"));
        companySnap.forEach(doc => {
            if (doc.id === 'company') newData.company = doc.data();
            if (doc.id === 'counters') newData.counters = doc.data();
        });
        if (!newData.counters || Object.keys(newData.counters).length === 0) newData.counters = INITIAL_DATA.counters;
        setData(newData);
      } catch (error) { console.error(error); showToast("Error loading data", "error"); } finally { setLoading(false); }
    };
    fetchData();
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
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [modal, viewDetail, mastersView, reportView, convertModal, showPnlReport, timerConflict, editingTimeLog, statementModal, manualAttModal]);

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
      if (tx.type === 'estimate') return; 
      const { final, paid } = getTransactionTotals(tx);
      const unpaid = final - paid;
      if (tx.type === 'sales') balances[tx.partyId] = (balances[tx.partyId] || 0) + unpaid;
      if (tx.type === 'purchase') balances[tx.partyId] = (balances[tx.partyId] || 0) - unpaid;
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
      if (tx.type === 'estimate') return;
      tx.items?.forEach(line => {
        if (tx.type === 'sales') stock[line.itemId] = (stock[line.itemId] || 0) - parseFloat(line.qty || 0);
        if (tx.type === 'purchase') stock[line.itemId] = (stock[line.itemId] || 0) + parseFloat(line.qty || 0);
      });
    });
    return stock;
  }, [data]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = data.transactions.filter(tx => tx.type === 'sales' && tx.date === today).reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
    const totalExpenses = data.transactions.filter(tx => tx.type === 'expense').reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
    const pendingTasks = data.tasks.filter(t => t.status !== 'Done').length;
    let totalReceivables = 0, totalPayables = 0;
    Object.values(partyBalances).forEach(bal => { if (bal > 0) totalReceivables += bal; if (bal < 0) totalPayables += Math.abs(bal); });
    
    // FIX BUG 2: Correct Cash/Bank Logic (Strictly based on paid/received)
    let cashInHand = 0, bankBalance = 0;
    data.transactions.forEach(tx => {
        if (tx.type === 'estimate') return;
        
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
            // Payments are pure cash flow
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

  const cleanData = (obj) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) newObj[key] = "";
    });
    return newObj;
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
    } catch (e) { console.error(e); showToast("Save Error", "error"); }
    return finalId; 
  };

  const deleteRecord = async (collectionName, id) => {
    if (!user) return;
    if (collectionName === 'items' && data.transactions.some(t => t.items?.some(i => i.itemId === id))) { alert("Item is used."); setConfirmDelete(null); return; }
    if (collectionName === 'parties' && data.transactions.some(t => t.partyId === id)) { alert("Party is used."); setConfirmDelete(null); return; }
    setData(prev => ({ ...prev, [collectionName]: prev[collectionName].filter(r => r.id !== id) }));
    setConfirmDelete(null); setModal({ type: null, data: null }); handleCloseUI(); showToast("Deleted");
    try { await deleteDoc(doc(db, collectionName, id.toString())); } catch (e) { console.error(e); }
  };

  // --- SUB-COMPONENTS ---

  const StaffDetailView = ({ staff }) => {
     const [sTab, setSTab] = useState('attendance');
     
     const attToday = data.attendance.find(a => a.staffId === staff.id && a.date === new Date().toISOString().split('T')[0]) || {};
     const attHistory = data.attendance.filter(a => a.staffId === staff.id).sort((a,b) => new Date(b.date) - new Date(a.date));
     const workLogs = data.tasks.flatMap(t => (t.timeLogs || []).filter(l => l.staffId === staff.id).map(l => ({ ...l, taskName: t.name, type: 'task' }))).sort((a,b) => new Date(b.start) - new Date(a.start));

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
                        <div key={idx} className="p-3 border rounded-xl bg-white text-xs">
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
                <button onClick={() => setUser(null)} className="p-2 bg-red-50 text-red-600 rounded-xl"><LogOut size={20} /></button>
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
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-gray-400 mb-1">CASH / BANK</p>
                  <div className="flex justify-between text-sm mb-1 cursor-pointer" onClick={() => { setListFilter('all'); setListPaymentMode('Cash'); setActiveTab('accounting'); }}><span>Cash:</span><span className="font-bold text-green-600">{formatCurrency(stats.cashInHand)}</span></div>
                  <div className="flex justify-between text-sm cursor-pointer" onClick={() => { setListFilter('all'); setListPaymentMode('Bank'); setActiveTab('accounting'); }}><span>Bank:</span><span className="font-bold text-blue-600">{formatCurrency(stats.bankBalance)}</span></div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* FIX #3: Dashboard Navigation Logic */}
            <div onClick={() => { pushHistory(); setMastersView('parties'); setPartyFilter('receivable'); }} className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
               <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
            </div>
            <div onClick={() => { pushHistory(); setMastersView('parties'); setPartyFilter('payable'); }} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
               <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
            </div>
            <div onClick={() => { setListFilter('sales'); setActiveTab('accounting'); }} className="bg-green-50 p-4 rounded-2xl border border-green-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(stats.todaySales)}</p>
            </div>
            {/* FIX #3: Make Expenses Card Clickable */}
            <div onClick={() => { pushHistory(); setMastersView('expenses'); }} className="bg-red-50 p-4 rounded-2xl border border-red-100 cursor-pointer active:scale-95 transition-transform">
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
            let newRecords = [];
            let batchPromises = [];
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
    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    let filtered = data.transactions.filter(tx => filter === 'all' || tx.type === filter);
    if(listPaymentMode) filtered = filtered.filter(tx => (tx.paymentMode || 'Cash') === listPaymentMode);
    if (categoryFilter) filtered = filtered.filter(tx => tx.category === categoryFilter);
    filtered = sortData(filtered, sort);

    // --- BULK TRANSACTION IMPORT LOGIC (FIX #1: Counter Update & FIX #2: ID Logic) ---
    const handleTransactionImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.XLSX) {
            alert("Excel library is still loading. Please try again in a few seconds.");
            return;
        }

        setLoading(true);
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
                
                if (wb.SheetNames.length < 2) { alert("Excel must have at least 2 sheets (Transactions, Items)"); setLoading(false); return; }
                
                const ws1 = wb.Sheets[wb.SheetNames[0]]; // Transactions
                const ws2 = wb.Sheets[wb.SheetNames[1]]; // Items
                
                const txRows = window.XLSX.utils.sheet_to_json(ws1, { header: 1 });
                const itemRows = window.XLSX.utils.sheet_to_json(ws2, { header: 1 });
                
                const partyMap = {};
                // SAFETY: Convert name to string before trimming to avoid crashes
                data.parties.forEach(p => { if(p.name) partyMap[String(p.name).trim().toLowerCase()] = p.id; });

                const itemMap = {};
                data.items.forEach(i => { if(i.name) itemMap[String(i.name).trim().toLowerCase()] = i.id; });
                
                const validTransactions = [];
                const newItemsToSave = [];
                const batchPromises = [];
                let nextItemCounter = data.counters.item || 100;
                
                const parseDate = (val) => {
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    if (typeof val === 'string' && val.includes('/')) {
                        const parts = val.split('/');
                        return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    return new Date().toISOString().split('T')[0];
                };

                for (let i = 1; i < txRows.length; i++) {
                    const row = txRows[i];
                    if (!row || row.length === 0) continue;
                    
                    const voucher = row[1];
                    if (!voucher) continue;
                    
                    const rawDate = row[0];
                    // SAFETY: Convert to string
                    const partyName = String(row[3] || '');
                    const typeStr = String(row[4] || 'Sales').toLowerCase();
                    const desc = row[6] || '';
                    const category = row[7] || '';
                    
                    let type = 'sales';
                    if (typeStr.includes('purchase')) type = 'purchase';
                    else if (typeStr.includes('expense')) type = 'expense';
                    else if (typeStr.includes('payment')) type = 'payment';
                    else if (typeStr.includes('estimate')) type = 'estimate';
                    
                    let partyId = '';
                    if (type !== 'expense') {
                        partyId = partyMap[(partyName || '').trim().toLowerCase()];
                        if (!partyId) {
                            console.warn(`Party not found: ${partyName}, skipping voucher ${voucher}`);
                            continue;
                        }
                    }
                    
                    // Process Items
                    const specificItemRows = itemRows.filter(r => r[1] == voucher);
                    const relatedItems = [];

                    for (const r of specificItemRows) {
                         const itemName = String(r[2] || '').trim(); // Col C
                         if(!itemName) continue;

                         let itemId = itemMap[itemName.toLowerCase()];
                         if(!itemId) {
                              const existingNew = newItemsToSave.find(ni => ni.name.toLowerCase() === itemName.toLowerCase());
                              if(existingNew) {
                                  itemId = existingNew.id;
                              } else {
                                  itemId = `I-${nextItemCounter}`;
                                  nextItemCounter++;
                                  const newItem = {
                                      id: itemId, name: itemName, category: 'General', type: 'Goods', 
                                      sellPrice: parseFloat(r[8]||0), buyPrice: parseFloat(r[5]||0), 
                                      unit: 'pcs', openingStock: 0 
                                  };
                                  newItemsToSave.push(cleanData(newItem));
                                  itemMap[itemName.toLowerCase()] = itemId; 
                                  batchPromises.push(setDoc(doc(db, "items", itemId), cleanData(newItem)));
                              }
                         }

                         relatedItems.push({
                              itemId,
                              description: r[3] || '',
                              qty: parseFloat(r[4] || 0),
                              buyPrice: parseFloat(r[5] || 0),
                              price: parseFloat(r[8] || 0) // Unit Price
                         });
                    }

                    const validItems = relatedItems.filter(item => item.qty > 0 || item.price > 0);
                    const gross = validItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                    const final = gross; 
                    
                    const newId = voucher.toString();
                    
                    const newTx = {
                        id: newId,
                        date: parseDate(rawDate),
                        type,
                        partyId,
                        category: type === 'expense' ? category : '',
                        items: validItems,
                        amount: final,
                        grossTotal: gross,
                        finalTotal: final,
                        received: 0, 
                        paid: 0,
                        paymentMode: 'Cash',
                        description: desc,
                        createdAt: new Date().toISOString()
                    };
                    
                    validTransactions.push(cleanData(newTx));
                    batchPromises.push(setDoc(doc(db, "transactions", newId), cleanData(newTx)));
                }

                // FIX #1: Update ID Counter based on imported data
                let maxTxNum = data.counters.transaction || 1000;
                validTransactions.forEach(tx => {
                    const parts = tx.id.split(/[-:]/); // Handle multiple ID formats
                    if (parts.length > 1) {
                        const num = parseInt(parts[parts.length - 1]);
                        if (!isNaN(num) && num >= maxTxNum) {
                            maxTxNum = num + 1;
                        }
                    }
                });
                
                const newCounters = { ...data.counters, transaction: maxTxNum, item: nextItemCounter };
                batchPromises.push(setDoc(doc(db, "settings", "counters"), newCounters));
                
                await Promise.all(batchPromises);
                
                setData(prev => ({
                    ...prev,
                    transactions: [...prev.transactions, ...validTransactions],
                    items: [...prev.items, ...newItemsToSave],
                    counters: newCounters
                }));
                
                setLoading(false);
                alert(`Imported ${validTransactions.length} transactions successfully!`);
                
            } catch (err) {
                console.error(err);
                setLoading(false);
                alert("Error importing file. Check console.");
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- BULK PAYMENT IMPORT LOGIC (FIXED) ---
    const handlePaymentImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.XLSX) {
            alert("Excel library is still loading. Please try again in a few seconds.");
            return;
        }

        setLoading(true);
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
                
                if (wb.SheetNames.length < 2) { 
                    alert("Excel must have at least 2 sheets (Header, Links)"); 
                    setLoading(false); 
                    return; 
                }
                
                const ws1 = wb.Sheets[wb.SheetNames[0]]; // Header
                const ws2 = wb.Sheets[wb.SheetNames[1]]; // Links
                
                // Use { header: 1 } to get arrays of rows
                const headers = window.XLSX.utils.sheet_to_json(ws1, { header: 1 });
                const links = window.XLSX.utils.sheet_to_json(ws2, { header: 1 });
                
                // Create Party Name Map for Lookup
                const partyMap = {};
                data.parties.forEach(p => { if(p.name) partyMap[String(p.name).trim().toLowerCase()] = p.id; });

                let nextPayCounter = data.counters.transaction || 1000;
                let maxImportedId = 0; // For updating counter logic
                
                const batchPromises = [];
                const newTransactions = [];

                const parseDate = (val) => {
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    if (typeof val === 'string') {
                         if(val.includes('/')) {
                             const parts = val.split('/');
                             if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                         }
                         return val;
                    }
                    return new Date().toISOString().split('T')[0];
                };

                // Loop Sheet 1 (Skip header row 0)
                for(let i=1; i<headers.length; i++) {
                    const row = headers[i];
                    if(!row || row.length === 0) continue;

                    const rawId = row[0]; // Col A (Index 0): Raw Payment ID
                    if (!rawId) continue;

                    // Parse numeric ID for counter logic
                    const numId = parseInt(rawId);
                    if (!isNaN(numId) && numId > maxImportedId) {
                        maxImportedId = numId;
                    }

                    const rawDate = row[1]; // Col B (Index 1)
                    const typeStr = String(row[3] || '').toLowerCase(); // Col D (Index 3)
                    const totalAmount = parseFloat(row[4] || 0); // Col E (Index 4)
                    const mode = row[5] || 'Cash'; // Col F (Index 5)
                    const partyName = String(row[6] || ''); // Col G (Index 6)
                    const desc = String(row[8] || ''); // Col I (Index 8)
                    const discount = parseFloat(row[14] || 0); // Col O (Index 14)

                    // Lookup Party ID
                    const partyId = partyMap[partyName.trim().toLowerCase()];
                    if (!partyId) {
                        console.warn(`Payment Import: Party not found "${partyName}" for ID ${rawId}. Skipping.`);
                        continue;
                    }

                    let subType = 'in';
                    let idPrefix = 'Payment In';
                    
                    if (typeStr.includes('out')) {
                        subType = 'out';
                        idPrefix = 'Payment Out';
                    } else if (typeStr.includes('in')) {
                        subType = 'in';
                        idPrefix = 'Payment In';
                    }

                    // Construct Firestore ID: Payment In:239
                    const finalId = `${idPrefix}:${rawId}`;

                    // Find links in Sheet 2 where Col A matches Raw ID
                    const linkedBills = links
                        .filter(l => l[0] == rawId) // Loose equality match for string/number
                        .map(l => ({
                            billId: l[1], // Col B (Index 1)
                            amount: parseFloat(l[2] || 0) // Col C (Index 2)
                        }))
                        .filter(l => l.billId && l.amount !== 0);

                    const newTx = {
                        id: finalId,
                        type: 'payment',
                        subType,
                        date: parseDate(rawDate),
                        partyId, 
                        amount: totalAmount,
                        paymentMode: mode,
                        discountValue: discount,
                        discountType: 'Amt',
                        linkedBills,
                        description: desc,
                        createdAt: new Date().toISOString(),
                        externalRef: rawId
                    };

                    newTransactions.push(cleanData(newTx));
                    batchPromises.push(setDoc(doc(db, "transactions", finalId), cleanData(newTx)));
                }
                
                // Update counter if import pushed it higher
                const currentCounter = data.counters.transaction || 1000;
                let finalCounter = currentCounter;
                
                if (maxImportedId >= currentCounter) {
                   finalCounter = maxImportedId + 1;
                   const newCounters = { ...data.counters, transaction: finalCounter };
                   batchPromises.push(setDoc(doc(db, "settings", "counters"), newCounters));
                }
                
                await Promise.all(batchPromises);
                
                setData(prev => ({
                    ...prev,
                    transactions: [...prev.transactions, ...newTransactions],
                    counters: { ...prev.counters, transaction: finalCounter }
                }));
                
                setLoading(false);
                alert(`Imported ${newTransactions.length} payment transactions successfully!`);
                
            } catch (err) {
                console.error(err);
                setLoading(false);
                alert("Error importing payments. Check console.");
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Accounting {categoryFilter && `(${categoryFilter})`}</h1>
          <div className="flex gap-2 items-center">
             {/* IMPORT BUTTONS - ONLY FOR ADMIN */}
             {user.role === 'admin' && (
                 <>
                     <label className="p-2 bg-purple-50 text-purple-700 rounded-xl cursor-pointer border border-purple-100 hover:bg-purple-100 flex items-center gap-1 text-xs font-bold">
                         <Upload size={14}/> Import
                         <input type="file" hidden accept=".xlsx, .xls" onChange={handleTransactionImport} />
                     </label>
                     <label className="p-2 bg-blue-50 text-blue-700 rounded-xl cursor-pointer border border-blue-100 hover:bg-blue-100 flex items-center gap-1 text-xs font-bold">
                         <Upload size={14}/> Pay Import
                         <input type="file" hidden accept=".xlsx, .xls" onChange={handlePaymentImport} />
                     </label>
                 </>
             )}
             <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option><option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option></select>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
            <button key={t} onClick={() => { setFilter(t); setCategoryFilter(null); }} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            const totals = getBillLogic(tx);
            let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
            if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }
            
            return (
              <div key={tx.id} onClick={() => { pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                  <div>
                    <p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
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
    );
  };

  // FIX #3: Expenses Breakdown with Date Filters
  const ExpensesBreakdown = () => {
      const [eFilter, setEFilter] = useState('Monthly');
      const [eDates, setEDates] = useState({ start: '', end: '' });

      const filteredExpenses = data.transactions.filter(t => {
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
    const filtered = data.transactions.filter(t => ['sales'].includes(t.type));
    const filteredDate = filtered.filter(t => {
        const d = new Date(t.date);
        const now = new Date();
        if (pnlFilter === 'Week') return (now - d) / (1000*60*60*24) <= 7;
        if (pnlFilter === 'Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (pnlFilter === 'Year') return d.getFullYear() === now.getFullYear();
        if (pnlFilter === 'Custom' && pnlCustomDates.start && pnlCustomDates.end) {
            return d >= new Date(pnlCustomDates.start) && d <= new Date(pnlCustomDates.end);
        }
        return true;
    });

    return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                <h2 className="font-bold text-lg">Profit & Loss Report</h2>
                <div/>
            </div>
            <div className="p-4 space-y-4">
                {filteredDate.map(tx => {
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
                        <div key={tx.id} className="p-3 border rounded-xl bg-white shadow-sm" onClick={() => setViewDetail({ type: 'transaction', id: tx.id })}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-800">{tx.id} • {formatDate(tx.date)}</span>
                                <span className="font-black text-green-600">{formatCurrency(totalP)}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex justify-between">
                                <span>Service: {formatCurrency(serviceP)}</span>
                                <span>Goods: {formatCurrency(goodsP)}</span>
                            </div>
                        </div>
                    );
                })}
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

      let pnl = { service: 0, goods: 0, total: 0 };
      if (!isPayment) {
          (tx.items || []).forEach(item => {
            const itemMaster = data.items.find(i => i.id === item.itemId);
            const type = itemMaster?.type || 'Goods';
            const qty = parseFloat(item.qty || 0);
            const sell = parseFloat(item.price || 0);
            const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
            if (type === 'Service') pnl.service += (sell * qty);
            else pnl.goods += ((sell - buy) * qty);
          });
          pnl.total = pnl.service + pnl.goods;
      }
      
      const printInvoice = () => {
        const content = `<html><head><title>${tx.type}</title></head><body><h1>Invoice ${tx.id}</h1></body></html>`; 
        const win = window.open('', '_blank');
        if (win) { win.document.write(content); win.document.close(); win.print(); }
      };

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <div className="flex gap-2">
               <button onClick={printInvoice} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center gap-1"><Printer size={16}/> PDF</button>
               {/* FIX #2: Delete Transaction Button */}
               {checkPermission(user, 'canEditTasks') && (
                   <>
                       <button onClick={() => { if(window.confirm('Delete this transaction?')) deleteRecord('transactions', tx.id); }} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
                       <button onClick={() => { pushHistory(); setModal({ type: tx.type, data: tx }); setViewDetail(null); }} className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full">Edit</button>
                   </>
               )}
            </div>
          </div>
          <div className="p-4 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-800">{formatCurrency(totals.amount)}</h1>
              <p className="text-xs font-bold text-gray-400 uppercase">{tx.type} • {formatDate(tx.date)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">{isPayment ? 'Paid Via' : 'Party'}</p>
              <p className="font-bold text-lg">{party?.name || tx.category || 'Unknown'}</p>
              <p className="text-sm text-gray-500">{party?.mobile}</p>
            </div>
            {tx.convertedFromTask && (
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <p className="text-xs font-bold text-purple-600 uppercase mb-1">Source Task</p>
                    <p className="text-sm font-bold text-gray-800">Task #{tx.convertedFromTask}</p>
                    <button onClick={() => { setViewDetail({ type: 'task', id: tx.convertedFromTask }); }} className="mt-2 text-xs font-bold text-white bg-purple-600 px-3 py-1 rounded-lg flex items-center gap-1">
                        <LinkIcon size={12}/> View Source Task
                    </button>
                </div>
            )}
            {['sales'].includes(tx.type) && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Info size={16}/> Profit Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Service Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.service)}</span></div>
                  <div className="flex justify-between"><span>Goods Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.goods)}</span></div>
                  <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-black text-blue-900"><span>Net Profit</span><span>{formatCurrency(pnl.total)}</span></div>
                </div>
              </div>
            )}
             {!isPayment && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-400 text-xs uppercase">Items</h3>
                  {tx.items?.map((item, i) => {
                      const m = data.items.find(x => x.id === item.itemId);
                      return (
                        <div key={i} className="flex justify-between p-3 border rounded-xl bg-white">
                          <div className="flex-1"><p className="font-bold text-sm">{m?.name || 'Item'}</p><p className="text-xs text-gray-500">{item.qty} x {item.price}</p></div>
                          <p className="font-bold text-sm">{formatCurrency(item.qty * item.price)}</p>
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
        const toggleTimer = (staffId) => {
            if (!user) return;
            const now = new Date().toISOString();
            let newLogs = [...(task.timeLogs || [])];
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);
            if (activeLogIndex >= 0) {
                const start = new Date(newLogs[activeLogIndex].start); const end = new Date(now);
                const duration = ((end - start) / 1000 / 60).toFixed(0); 
                newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration };
                updateTaskLogs(newLogs);
            } else {
                const activeTask = data.tasks.find(t => t.timeLogs && t.timeLogs.some(l => l.staffId === staffId && !l.end));
                if (activeTask && activeTask.id !== task.id) { pushHistory(); setTimerConflict({ staffId, activeTaskId: activeTask.id, targetTaskId: task.id }); return; }
                const staff = data.staff.find(s => s.id === staffId);
                newLogs.push({ staffId, staffName: staff?.name, start: now, end: null, duration: 0 });
                updateTaskLogs(newLogs);
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
        const totalTime = (task.timeLogs || []).reduce((acc, log) => acc + (parseFloat(log.duration) || 0), 0);
        
        // WhatsApp Share
        const shareTask = () => {
            const text = `*Task Update: ${task.name}*\nClient: ${party?.name}\nStatus: ${task.status}\nDesc: ${task.description}\n\nView details in SMEES Pro.`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }

        return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
              <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
              <h2 className="font-bold text-lg">Task Details</h2>
              <div className="flex gap-2">
                   <button onClick={shareTask} className="p-2 bg-green-100 text-green-700 rounded-lg"><MessageCircle size={20}/></button>
                   {checkPermission(user, 'canEditTasks') && <button onClick={() => { pushHistory(); setModal({ type: 'task', data: task }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>}
              </div>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h1 className="text-xl font-black text-gray-800 mb-2">{task.name}</h1>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    <p className="text-sm text-gray-600 my-4">{task.description}</p>
                    
                    {/* Client Info */}
                    {party && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                             <p className="text-xs font-bold text-gray-400 uppercase">Client Details</p>
                             <p className="font-bold text-gray-800">{party.name}</p>
                             <div className="flex gap-3">
                                 <a href={`tel:${party.mobile}`} className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded"><Phone size={12}/> {party.mobile}</a>
                                 {party.lat && <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${party.lat},${party.lng}`)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded"><Navigation size={12}/> Direction</button>}
                             </div>
                             {party.address && <p className="text-xs text-gray-500">{party.address}</p>}
                        </div>
                    )}
                </div>
                
                {/* ITEMS SECTION */}
                <div>
                   <div className="flex justify-between items-center mb-2">
                       <h3 className="font-bold flex items-center gap-2 text-gray-700"><ShoppingCart size={18}/> Items Used</h3>
                       {task.status !== 'Converted' && (
                           <div className="w-40">
                               <SearchableSelect placeholder="+ Add Item" options={data.items} value="" onChange={(val) => {
                                   if(val) {
                                      const item = data.items.find(i=>i.id===val);
                                      updateTaskItems([...(task.itemsUsed || []), { itemId: val, qty: 1, price: item?.sellPrice || 0, buyPrice: item?.buyPrice || 0, description: '' }]);
                                   }
                               }} />
                           </div>
                       )}
                   </div>
                   <div className="space-y-2">
                       {(task.itemsUsed || []).map((item, idx) => {
                           const itemDetails = data.items.find(i => i.id === item.itemId);
                           return (
                               <div key={idx} className="p-3 border rounded-xl bg-white space-y-2 text-sm">
                                   <div className="flex justify-between">
                                       <p className="font-bold">{itemDetails?.name}</p>
                                       <button onClick={() => updateTaskItems(task.itemsUsed.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={14}/></button>
                                   </div>
                                   <div className="flex gap-2">
                                       <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={item.qty} onChange={e => { const n = [...task.itemsUsed]; n[idx].qty = e.target.value; updateTaskItems(n); }} />
                                       <span className="text-xs self-center">x {item.price}</span>
                                   </div>
                               </div>
                           );
                       })}
                   </div>
                </div>

                {/* CONVERT OR VIEW INVOICE */}
                {task.generatedSaleId ? (
                    <div className="pt-4 border-t">
                        <button onClick={() => setViewDetail({ type: 'transaction', id: task.generatedSaleId })} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200">
                            <ReceiptText size={18} /> View Invoice #{task.generatedSaleId}
                        </button>
                    </div>
                ) : (
                    task.status !== 'Converted' && (
                        <div className="pt-4 border-t">
                            <button onClick={() => { pushHistory(); setConvertModal(task); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-200">
                                <ReceiptText size={18}/> Convert to Sale
                            </button>
                        </div>
                    )
                )}

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold flex items-center gap-2 text-blue-800"><Clock size={18}/> Time Logs</h3>
                        <span className="text-xs font-black bg-white px-2 py-1 rounded text-blue-600">{totalTime} mins</span>
                    </div>
                    
                    {/* FIX #3: Time Logs List */}
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                        {(task.timeLogs || []).map((log, idx) => (
                            <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-center text-xs">
                                <div>
                                    <p className="font-bold">{log.staffName}</p>
                                    <p className="text-gray-500">{formatTime(log.start)} - {log.end ? formatTime(log.end) : 'Running'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{log.duration}m</span>
                                    {checkPermission(user, 'canEditTasks') && (
                                        <>
                                            <button onClick={() => openEditTimeLog(idx)} className="p-1 bg-gray-100 rounded text-blue-600"><Edit2 size={12}/></button>
                                            <button onClick={() => {
                                                const newLogs = task.timeLogs.filter((_, i) => i !== idx);
                                                updateTaskLogs(newLogs);
                                            }} className="p-1 bg-gray-100 rounded text-red-600"><Trash2 size={12}/></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 mb-4">
                        {data.staff.filter(s => task.assignedStaff?.includes(s.id) || user.role === 'admin').map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-xl border"><span className="text-sm font-bold text-gray-700">{s.name}</span><button onClick={() => toggleTimer(s.id)} className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}</button></div>
                            );
                        })}
                    </div>
                </div>
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
           <div className="space-y-4">
             <h3 className="font-bold flex items-center gap-2 text-gray-700"><History size={18}/> Transaction History</h3>
             {history.map(tx => {
               const t = getBillLogic(tx);
               return (
                 <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm cursor-pointer">
                   <div><p className="font-bold text-sm">{tx.id} • {formatDate(tx.date)}</p><p className="text-[10px] uppercase font-bold text-gray-400">{tx.type} • {tx.paymentMode}</p></div>
                   <div className="text-right"><p className="font-bold">{formatCurrency(tx.amount || t.final)}</p></div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    );
  };

  // 2. Forms
  const TransactionForm = ({ type, record }) => {
    const [tx, setTx] = useState(record ? { linkedBills: [], items: [], paymentMode: 'Cash', discountType: '%', discountValue: 0, ...record } : { type, date: new Date().toISOString().split('T')[0], partyId: '', items: [], discountType: '%', discountValue: 0, received: 0, paid: 0, paymentMode: 'Cash', category: '', subType: type==='payment'?'in':'', amount: '', linkedBills: [], description: '' });
    const [showLinking, setShowLinking] = useState(false);
    const totals = getTransactionTotals(tx);
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
        const currentLinked = tx.linkedBills?.filter(l => l.billId !== billId).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;
        const total = parseFloat(tx.amount || 0);
        if (currentLinked + amt > total) { alert(`Total linked amount cannot exceed payment amount (${formatCurrency(total)})`); return; }
        const others = tx.linkedBills?.filter(l => l.billId !== billId) || [];
        if (amt > 0) setTx({...tx, linkedBills: [...others, { billId, amount: value }]}); else setTx({...tx, linkedBills: others});
    };

    return (
      <div className="space-y-4 pb-10">
        <div className="flex justify-between items-center mb-4"><p className="text-xs font-bold text-gray-400 uppercase">{tx.id || 'New ' + type}</p><input type="date" className="p-1 text-sm border-none bg-transparent font-bold text-blue-600" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} /></div>
        {type === 'payment' && <div className="flex bg-gray-100 p-1 rounded-xl mb-4"><button onClick={() => setTx({...tx, subType: 'in'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'in' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>Payment IN</button><button onClick={() => setTx({...tx, subType: 'out'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'out' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}>Payment OUT</button></div>}
        {type === 'expense' ? <SearchableSelect label="Category" options={data.categories.expense} value={tx.category} onChange={v => setTx({ ...tx, category: v })} onAddNew={() => { const newCat = prompt("New Category Name:"); if (newCat) { const isDirect = window.confirm("Is this a Direct Expense? (OK = Direct, Cancel = Indirect)"); setData(prev => ({ ...prev, categories: { ...prev.categories, expense: [...prev.categories.expense, newCat] } })); setTx({ ...tx, category: newCat, expenseType: isDirect ? 'Direct' : 'Indirect' }); } }} /> : <SearchableSelect label="Party" options={partyOptions} value={tx.partyId} onChange={v => setTx({ ...tx, partyId: v })} onAddNew={() => { pushHistory(); setModal({ type: 'party' }); }} />}
        {type !== 'payment' && <div className="space-y-3"><div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items</h4><button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0 }]})} className="text-blue-600 text-xs font-bold">+ Add Item</button></div>{tx.items.map((line, idx) => (<div key={idx} className="p-3 bg-gray-50 border rounded-xl relative space-y-2"><button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button><SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateLine(idx, 'itemId', v)} onAddNew={() => { pushHistory(); setModal({ type: 'item' }); }}/><input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} /><div className="grid grid-cols-3 gap-2"><input type="number" className="p-2 border rounded-lg text-sm" value={line.qty} placeholder="Qty" onChange={e => updateLine(idx, 'qty', e.target.value)} /><input type="number" className="p-2 border rounded-lg text-sm" value={line.price} placeholder="Price" onChange={e => updateLine(idx, 'price', e.target.value)} />{type === 'sales' && <input type="number" className="p-2 border rounded-lg text-sm bg-yellow-50" value={line.buyPrice || 0} placeholder="Buy" onChange={e => updateLine(idx, 'buyPrice', e.target.value)} />}</div></div>))}<div className="p-4 bg-gray-50 rounded-2xl space-y-3"><div className="flex items-center gap-2"><input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Discount" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})}/><select className="p-2 text-xs border rounded-lg" value={tx.discountType} onChange={e => setTx({...tx, discountType: e.target.value})}><option>%</option><option>Amt</option></select></div><div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(totals.final)}</span></div><div className="grid grid-cols-2 gap-2"><input type="number" className="p-3 border rounded-xl font-bold text-green-600" placeholder="Received/Paid" value={(type==='sales'?tx.received:tx.paid)||''} onChange={e=>setTx({...tx, [type==='sales'?'received':'paid']: e.target.value})}/><select className="p-3 border rounded-xl bg-white" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}><option>Cash</option><option>Bank</option><option>UPI</option></select></div></div></div>}
        {type === 'payment' && (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" className="w-full bg-blue-50 text-2xl font-bold p-4 rounded-xl text-blue-600" placeholder="Amount" value={tx.amount} onChange={e=>setTx({...tx, amount: e.target.value})}/>
                    <select className="w-full bg-gray-50 p-4 rounded-xl font-bold" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}>
                        <option>Cash</option><option>Bank</option><option>UPI</option>
                    </select>
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
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-16" placeholder="Notes" value={tx.description} onChange={e => setTx({...tx, description: e.target.value})} />
        {/* FIX #3: Pass tx.type to get correct ID prefix */}
        <button onClick={() => { if(!tx.partyId && type !== 'expense') return alert("Party Required"); saveRecord('transactions', {...tx, ...totals}, tx.type); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save</button>
      </div>
    );
  };

  const TaskForm = ({ record }) => {
    const [form, setForm] = useState(record ? { ...record, itemsUsed: record.itemsUsed || [], assignedStaff: record.assignedStaff || [] } : { name: '', partyId: '', description: '', status: 'To Do', dueDate: '', assignedStaff: [], itemsUsed: [] });
    const itemOptions = data.items.map(i => ({ ...i, subText: `Stock: ${itemStock[i.id] || 0}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    const updateItem = (idx, field, val) => { const n = [...form.itemsUsed]; n[idx][field] = val; if(field==='itemId') { const item = data.items.find(i=>i.id===val); if(item) { n[idx].price = item.sellPrice; n[idx].buyPrice = item.buyPrice; n[idx].description = item.description || ''; } } setForm({...form, itemsUsed: n}); };
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <div className="p-3 bg-gray-50 rounded-xl border"><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Assigned Staff</label><div className="flex flex-wrap gap-2 mb-2">{form.assignedStaff.map(sid => { const s = data.staff.find(st => st.id === sid); return (<span key={sid} className="bg-white border px-2 py-1 rounded-full text-xs flex items-center gap-1">{s?.name} <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button></span>); })}</div><select className="w-full p-2 border rounded-lg text-sm bg-white" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}><option value="">+ Add Staff</option>{data.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <SearchableSelect label="Client" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v})} />
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
    const TaskItem = ({ task }) => (
      <div onClick={() => { pushHistory(); setViewDetail({ type: 'task', id: task.id }); }} className="p-4 bg-white border rounded-2xl mb-2 flex justify-between items-start cursor-pointer active:scale-95 transition-transform">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1"><span className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : task.status === 'Converted' ? 'bg-purple-500' : 'bg-orange-500'}`} /><p className="font-bold text-gray-800">{task.name}</p></div>
          <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
          <div className="flex gap-3 mt-2 text-[10px] font-bold text-gray-400 uppercase"><span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.dueDate)}</span><span className="flex items-center gap-1"><Users size={10} /> {task.assignedStaff?.length || 0} Staff</span></div>
        </div>
        <div className="text-right"><p className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">{task.id}</p></div>
      </div>
    );
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-xl font-bold">Tasks</h1><div className="flex gap-2 items-center"><input className="p-2 border rounded-xl text-xs w-32" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}/><select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateAsc">Due Soon</option><option value="DateDesc">Due Later</option><option value="A-Z">A-Z</option><option value="Z-A">Z-A</option></select>{checkPermission(user, 'canEditTasks') && <button onClick={() => { pushHistory(); setModal({ type: 'task' }); }} className="p-2 bg-blue-600 text-white rounded-xl"><Plus /></button>}</div></div>
        <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Pending ({pending.length})</h3>{pending.map(t => <TaskItem key={t.id} task={t} />)}</div>
        <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Completed ({done.length})</h3><div className="opacity-60">{done.map(t => <TaskItem key={t.id} task={t} />)}</div></div>
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
        ...(record || {}) 
    });
    return (
        <div className="space-y-4">
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Ref By" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
            </div>
            <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Latitude" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} />
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Longitude" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} />
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
  
  const ConvertTaskModal = ({ task }) => {
      const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], received: '', mode: 'Cash' });
      const handleConfirm = async () => {
          const saleItems = (task.itemsUsed || []).map(i => ({ itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice || 0, description: i.description || '' }));
          const gross = saleItems.reduce((acc, i) => acc + (parseFloat(i.qty)*parseFloat(i.price)), 0);
          const workDoneBy = (task.timeLogs || []).map(l => `${l.staffName} (${l.duration}m)`).join(', ');
          const totalMins = (task.timeLogs || []).reduce((acc,l) => acc + (parseFloat(l.duration)||0), 0);
          const workSummary = `${workDoneBy} | Total: ${totalMins} mins`;
          const newSale = { type: 'sales', date: form.date, partyId: task.partyId, items: saleItems, discountType: '%', discountValue: 0, received: parseFloat(form.received || 0), paymentMode: form.mode, grossTotal: gross, finalTotal: gross, convertedFromTask: task.id, workSummary: workSummary, description: `Converted from Task ${task.id}. Work: ${workSummary}` };
          const saleId = await saveRecord('transactions', newSale, 'transaction');
          const updatedTask = { ...task, status: 'Done', generatedSaleId: saleId };
          await saveRecord('tasks', updatedTask, 'task');
          setConvertModal(null); setViewDetail(null); handleCloseUI();
      };
      return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg mb-4">Convert to Sale</h3><div className="space-y-4"><input type="date" className="w-full p-2 border rounded-xl" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/><input type="number" className="w-full p-2 border rounded-xl" placeholder="Received" value={form.received} onChange={e => setForm({...form, received: e.target.value})}/><div className="flex gap-3"><button onClick={handleCloseUI} className="flex-1 p-3 bg-gray-100 rounded-xl">Cancel</button><button onClick={handleConfirm} className="flex-1 p-3 bg-blue-600 text-white rounded-xl">Confirm</button></div></div></div></div>;
  };
  const TimeLogModal = () => {
      const [form, setForm] = useState({ start: '', end: '' });
      useEffect(() => { if (editingTimeLog) { const { task, index } = editingTimeLog; const log = task.timeLogs[index] || {}; setForm({ start: log.start ? log.start.slice(0, 16) : '', end: log.end ? log.end.slice(0, 16) : '' }); } }, [editingTimeLog]); 
      if (!editingTimeLog) return null;
      const { task, index } = editingTimeLog;
      const handleSave = async () => {
          const startD = new Date(form.start); const endD = form.end ? new Date(form.end) : null;
          const duration = endD ? ((endD - startD) / 1000 / 60).toFixed(0) : 0;
          const newLogs = [...task.timeLogs]; newLogs[index] = { ...task.timeLogs[index], start: new Date(form.start).toISOString(), end: form.end ? new Date(form.end).toISOString() : null, duration };
          const updatedTask = { ...task, timeLogs: newLogs };
          setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t) }));
          if (user) await setDoc(doc(db, "tasks", updatedTask.id), updatedTask);
          setEditingTimeLog(null); handleCloseUI();
      };
      return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg mb-4">Edit Time Log</h3><div className="space-y-3"><input type="datetime-local" className="w-full p-2 border rounded-xl" value={form.start} onChange={e => setForm({...form, start: e.target.value})}/><input type="datetime-local" className="w-full p-2 border rounded-xl" value={form.end} onChange={e => setForm({...form, end: e.target.value})}/><div className="flex gap-3"><button onClick={handleCloseUI} className="flex-1 p-3 bg-gray-100 rounded-xl">Cancel</button><button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl">Save</button></div></div></div></div>;
  };
  const StatementModal = () => {
      const [dates, setDates] = useState({ start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
      const [withItems, setWithItems] = useState(false);
      
      if (!statementModal) return null;
      return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg mb-4">Statement</h3><div className="space-y-4"><input type="date" className="w-full p-3 border rounded-xl" value={dates.start} onChange={e=>setDates({...dates, start:e.target.value})}/><input type="date" className="w-full p-3 border rounded-xl" value={dates.end} onChange={e=>setDates({...dates, end:e.target.value})}/><div className="flex gap-2"><button onClick={() => setStatementModal(null)} className="flex-1 p-3 bg-gray-100 rounded-xl">Cancel</button></div></div></div></div>;
  };
  
  const ManualAttendanceModal = () => {
      const [form, setForm] = useState({ date: '', in: '', out: '', lStart: '', lEnd: '' });
      
      // Effect to sync state when modal opens
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
          const staffId = manualAttModal.staffId || manualAttModal.id.split('-')[1]; // Extract ID if editing
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
          setManualAttModal(false); handleCloseUI(); showToast(manualAttModal.isEdit ? "Updated" : "Added");
      };
      
      return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold text-lg mb-4">{manualAttModal.isEdit ? 'Edit' : 'Manual'} Attendance</h3><div className="space-y-4"><input type="date" disabled={manualAttModal.isEdit} className="w-full p-3 border rounded-xl" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} /><div className="grid grid-cols-2 gap-4"><input type="time" className="w-full p-3 border rounded-xl" value={form.in} onChange={e=>setForm({...form, in: e.target.value})} /><input type="time" className="w-full p-3 border rounded-xl" value={form.out} onChange={e=>setForm({...form, out: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><input type="time" className="w-full p-3 border rounded-xl bg-yellow-50" placeholder="Lunch Start" value={form.lStart} onChange={e=>setForm({...form, lStart: e.target.value})} /><input type="time" className="w-full p-3 border rounded-xl" placeholder="Lunch End" value={form.lEnd} onChange={e=>setForm({...form, lEnd: e.target.value})} /></div><button onClick={handleSave} className="w-full p-3 bg-blue-600 text-white rounded-xl font-bold">Save Entry</button></div></div></div>;
  }

  const LoginScreen = () => {
    const [id, setId] = useState('');
    const [pass, setPass] = useState('');
    const [err, setErr] = useState('');

    const handleLogin = async () => {
        if(id === 'him23' && pass === 'Himanshu#3499sp') {
            setUser({ name: 'Admin', role: 'admin', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } });
        } else {
            try {
                await signInAnonymously(auth);
                const q = query(collection(db, 'staff'), where('loginId', '==', id), where('password', '==', pass));
                const snap = await getDocs(q);
                if(!snap.empty) {
                    const userData = snap.docs[0].data();
                    const defaults = { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true };
                    setUser({ ...userData, permissions: { ...defaults, ...userData.permissions } });
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

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="text-sm font-bold">{toast.message}</span></div>}
      <DetailView />
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div><span className="font-black text-gray-800 tracking-tight">SMEES Pro</span></div>
        <div className="flex gap-3"><button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button></div>
      </div>
      <main className="max-w-xl mx-auto p-4">
        {loading ? <div className="flex flex-col items-center justify-center h-64 text-gray-400"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div><p className="text-sm font-bold">Syncing Data...</p></div> : (
          <>
            {activeTab === 'dashboard' && checkPermission(user, 'canViewDashboard') && <Dashboard />}
            {activeTab === 'accounting' && checkPermission(user, 'canViewAccounts') && <TransactionList />}
            {activeTab === 'tasks' && checkPermission(user, 'canViewTasks') && <TaskModule />}
            {activeTab === 'staff' && (
                <div className="space-y-6">
                    {mastersView === null ? (
                        <div className="space-y-4"><MasterList title="Staff" collection="staff" type="staff" onRowClick={(s) => { pushHistory(); setViewDetail({type: 'staff', id: s.id}); }} /></div>
                    ) : null}
                </div>
            )}
            {activeTab === 'masters' && checkPermission(user, 'canViewMasters') && (
              <div className="space-y-6">
                {mastersView === null ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { pushHistory(); setMastersView('items'); }} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100"><Package size={32} className="text-blue-600"/><span className="font-bold text-blue-800">Items</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('parties'); }} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100"><Users size={32} className="text-emerald-600"/><span className="font-bold text-emerald-800">Parties</span></button>
                    </div>
                ) : (
                    <div>
                        <button onClick={handleCloseUI} className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800"><ArrowLeft size={18}/> Back</button>
                        {mastersView === 'items' && <MasterList title="Items" collection="items" type="item" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'item', id: item.id}); }} />}
                        {mastersView === 'parties' && <MasterList title="Parties" collection="parties" type="party" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'party', id: item.id}); }} />}
                        {mastersView === 'expenses' && <ExpensesBreakdown />}
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
      {convertModal && <ConvertTaskModal task={convertModal} />}
      {editingTimeLog && <TimeLogModal />}
      {statementModal && <StatementModal />}
      {manualAttModal && <ManualAttendanceModal />}
    </div>
  );
}