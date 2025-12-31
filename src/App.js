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
  MessageCircle,
  Sparkles,
  BrainCircuit,
  Wallet
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

// --- GEMINI API HELPER ---
const callGemini = async (prompt) => {
  const apiKey = ""; // API key provided by environment at runtime
  let attempt = 0;
  const maxRetries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000];

  while (attempt < maxRetries) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error("Gemini API Error:", error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
    }
  }
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

const LoginScreen = ({ onLogin }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async () => {
      if(id === 'him23' && pass === 'Himanshu#3499sp') {
          onLogin({ name: 'Admin', role: 'admin', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } });
      } else {
          try {
              await signInAnonymously(auth);
              const q = query(collection(db, 'staff'), where('loginId', '==', id), where('password', '==', pass));
              const snap = await getDocs(q);
              if(!snap.empty) {
                  const userData = snap.docs[0].data();
                  const defaults = { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true };
                  onLogin({ ...userData, permissions: { ...defaults, ...userData.permissions } });
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
            // Expenses: Use 'paid' field
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
      const [aiInsight, setAiInsight] = useState("");
      const [loadingInsight, setLoadingInsight] = useState(false);

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

      // ✨ FEATURE: AI Business Insight
      const generateInsight = async () => {
          setLoadingInsight(true);
          const prompt = `You are a financial advisor for a small business. Here is the current status: 
          Today's Sales: ${formatCurrency(stats.todaySales)}, 
          Total Expenses: ${formatCurrency(stats.totalExpenses)}, 
          Cash in Hand: ${formatCurrency(stats.cashInHand)}, 
          Bank: ${formatCurrency(stats.bankBalance)}, 
          Net Profit (${pnlFilter}): ${formatCurrency(pnlData)}. 
          Give 3 bullet points of concise, friendly advice or observation based on this data. Do not use markdown formatting like bold, just plain text with emojis.`;
          
          try {
             const result = await callGemini(prompt);
             setAiInsight(result);
          } catch (e) {
             setAiInsight("Failed to generate insight.");
          }
          setLoadingInsight(false);
      };

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1><p className="text-sm text-gray-500">FY {data.company.financialYear}</p></div>
            <div className="flex gap-2">
                <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 bg-gray-100 rounded-xl"><Settings className="text-gray-600" /></button>
                <button onClick={() => setUser(null)} className="p-2 bg-red-50 text-red-600 rounded-xl"><LogOut size={20} /></button>
            </div>
          </div>

          {/* AI Insight Section */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 rounded-2xl text-white shadow-lg">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold flex items-center gap-2"><Sparkles size={16}/> Smart Insights</h3>
                 <button onClick={generateInsight} disabled={loadingInsight} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-bold transition-all">
                     {loadingInsight ? "Thinking..." : "Refresh"}
                 </button>
             </div>
             <div className="text-sm bg-black/20 p-3 rounded-xl min-h-[60px]">
                 {aiInsight ? aiInsight.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>) : <p className="opacity-70 italic">Click refresh to get AI-powered business advice...</p>}
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
            {/* FIX #5: Dashboard Navigation Logic */}
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
    // FIX #1: Pagination
    const [visibleCount, setVisibleCount] = useState(50);
    
    // FIX #5: Receivables/Payables Filter Logic for MasterList
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
          {/* FIX #1: Pagination (Slice the list) */}
          {filtered.slice(0, visibleCount).map(item => (
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
        {/* FIX #1: Load More Button */}
        {visibleCount < filtered.length && (
            <button onClick={() => setVisibleCount(prev => prev + 50)} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl mt-4 hover:bg-gray-200 transition-colors">
                Load More ({filtered.length - visibleCount} remaining)
            </button>
        )}
      </div>
    );
  };

  const TransactionList = () => {
    const [sort, setSort] = useState('DateDesc');
    const [filter, setFilter] = useState('all');
    // FIX #4: Transaction List Search
    const [search, setSearch] = useState('');
    // FIX #1: Client-Side Pagination
    const [visibleCount, setVisibleCount] = useState(50);

    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(50);
    }, [filter, listPaymentMode, categoryFilter, search, sort]);

    let filtered = data.transactions.filter(tx => filter === 'all' || tx.type === filter);
    if(listPaymentMode) filtered = filtered.filter(tx => (tx.paymentMode || 'Cash') === listPaymentMode);
    if (categoryFilter) filtered = filtered.filter(tx => tx.category === categoryFilter);

    // Filter by search term
    if (search) {
        const lower = search.toLowerCase();
        filtered = filtered.filter(tx => {
            const pName = data.parties.find(p => p.id === tx.partyId)?.name || '';
            return tx.id.toLowerCase().includes(lower) || 
                   pName.toLowerCase().includes(lower) || 
                   (tx.description || '').toLowerCase().includes(lower) ||
                   String(tx.amount || '').includes(lower);
        });
    }

    filtered = sortData(filtered, sort);

    // --- BULK TRANSACTION IMPORT LOGIC ---
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
                        partyId = partyMap[partyName.trim().toLowerCase()];
                        if (!partyId) {
                            console.warn(`Party not found: ${partyName}, skipping voucher ${voucher}`);
                            continue;
                        }
                    }
                    
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

                let maxTxNum = data.counters.transaction || 1000;
                validTransactions.forEach(tx => {
                    const parts = tx.id.split(/[-:]/);
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
             {/* FIX #4: Search Input */}
             <input className="p-2 border rounded-xl text-xs w-24 bg-gray-50" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
             <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option><option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option></select>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
            <button key={t} onClick={() => { setFilter(t); setCategoryFilter(null); }} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-3">
          {/* FIX #1: Pagination (Slice the list) */}
          {filtered.slice(0, visibleCount).map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            const totals = getBillLogic(tx);
            let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
            if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }
            
            // FIX #5: Payment Status Tags
            let statusTag = null;
            if(['sales', 'purchase', 'expense'].includes(tx.type)) {
                 statusTag = <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${totals.status === 'PAID' ? 'bg-green-100 text-green-700' : totals.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span>;
            } else if (tx.type === 'payment') {
                 const used = tx.linkedBills?.reduce((s, l) => s + (parseFloat(l.amount)||0), 0) || 0;
                 const total = parseFloat(tx.amount || 0);
                 const unused = total - used;
                 if (used === 0) statusTag = <span className="text-[8px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-black">UNUSED</span>;
                 else if (unused > 0.1) statusTag = <span className="text-[8px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-black">PARTIAL: {formatCurrency(unused)}</span>;
                 else statusTag = <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">FULLY USED</span>;
            }

            return (
              <div key={tx.id} onClick={() => { pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                  <div>
                    <p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
                    <div className="flex gap-1 mt-1">
                        {statusTag}
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
        {/* FIX #1: Load More Button */}
        {visibleCount < filtered.length && (
            <button onClick={() => setVisibleCount(prev => prev + 50)} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl mt-4 hover:bg-gray-200 transition-colors">
                Load More ({filtered.length - visibleCount} remaining)
            </button>
        )}
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
             
            {/* FIX #2: Feature - Invoice Detail View (Show Payments) */}
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
                  {/* Related Payments Section */}
                  <div className="mt-4">
                      <h3 className="font-bold text-gray-700 mb-2">Related Payments</h3>
                      {data.transactions.filter(t => t.type === 'payment' && t.linkedBills?.some(l => l.billId === tx.id)).map(pay => (
                          <div key={pay.id} onClick={() => setViewDetail({ type: 'transaction', id: pay.id })} className="p-3 border rounded-xl bg-purple-50 flex justify-between items-center mb-2 cursor-pointer">
                              <div>
                                  <p className="font-bold text-sm text-purple-900">{pay.id}</p>
                                  <p className="text-xs text-purple-700">{formatDate(pay.date)}</p>
                              </div>
                              <span className="font-bold text-purple-700">{formatCurrency(pay.linkedBills.find(l => l.billId === tx.id).amount)}</span>
                          </div>
                      ))}
                  </div>
                </div>
            )}

            {/* FIX #3: Feature - Payment Detail View (Show Invoices) */}
            {isPayment && (
                <div className="mt-4">
                    <h3 className="font-bold text-gray-700 mb-2">Paid Invoices</h3>
                    {tx.linkedBills?.map(link => {
                        const bill = data.transactions.find(t => t.id === link.billId);
                        return (
                            <div key={link.billId} onClick={() => bill ? setViewDetail({ type: 'transaction', id: bill.id }) : null} className="p-3 border rounded-xl bg-gray-50 flex justify-between items-center mb-2 cursor-pointer">
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{link.billId}</p>
                                    <p className="text-xs text-gray-500">Total: {bill ? formatCurrency(bill.amount || bill.finalTotal) : '?'}</p>
                                </div>
                                <span className="font-bold text-green-600">{formatCurrency(link.amount)}</span>
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
                   
                   {/* ✨ AI Task Assistant */}
                   <button onClick={async () => {
                       const prompt = `Write a professional, concise description for a task named '${task.name}' for client '${party?.name || 'unknown'}'. Include a bullet list of 3 standard sub-steps or checklist items for this type of task.`;
                       try {
                           const aiText = await callGemini(prompt);
                           const updated = { ...task, description: aiText };
                           setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }));
                           await setDoc(doc(db, "tasks", task.id), updated);
                           alert("✨ AI Description Generated!");
                       } catch (e) {
                           alert("AI Error: " + e.message);
                       }
                   }} className="p-2 bg-purple-100 text-purple-700 rounded-lg flex items-center gap-1 font-bold text-xs"><BrainCircuit size={16}/> AI Draft</button>
              </div>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h1 className="text-xl font-black text-gray-800 mb-2">{task.name}</h1>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    <p className="text-sm text-gray-600 my-4 whitespace-pre-line">{task.description}</p>
                    
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
           </div>
           
           {/* FIX #4: UI UPGRADE: Party Detail Transaction History */}
           <div className="space-y-4">
             <h3 className="font-bold flex items-center gap-2 text-gray-700"><History size={18}/> Transaction History</h3>
             {history.map(tx => {
               const totals = getBillLogic(tx);
               const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
               let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
               if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
               if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
               if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }

               let statusTag = null;
               if(['sales', 'purchase', 'expense'].includes(tx.type)) {
                    statusTag = <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${totals.status === 'PAID' ? 'bg-green-100 text-green-700' : totals.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span>;
               } else if (tx.type === 'payment') {
                    const used = tx.linkedBills?.reduce((s, l) => s + (parseFloat(l.amount)||0), 0) || 0;
                    const total = parseFloat(tx.amount || 0);
                    const unused = total - used;
                    if (used === 0) statusTag = <span className="text-[8px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-black">UNUSED</span>;
                    else if (unused > 0.1) statusTag = <span className="text-[8px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-black">PARTIAL</span>;
                    else statusTag = <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">FULLY USED</span>;
               }

               return (
                 <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm cursor-pointer active:scale-95 transition-transform">
                   <div className="flex gap-3 items-center">
                        <div className={`p-2 rounded-full ${bg} ${iconColor}`}><Icon size={16} /></div>
                        <div>
                            <p className="font-bold text-sm text-gray-800">{tx.id} • {formatDate(tx.date)}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-400">{tx.type} • {tx.paymentMode}</p>
                            <div className="mt-1">{statusTag}</div>
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

  // FIX #4: NEW FEATURE: Cash/Bank Management in Masters
  const CashBankView = () => {
      const { cashInHand, bankBalance } = stats;

      return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                  <h2 className="font-bold text-lg">Cash & Bank Adjustment</h2>
                  <div/>
              </div>
              <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-3xl text-white shadow-lg">
                      <p className="text-sm font-medium opacity-80 mb-1">CASH IN HAND</p>
                      <h1 className="text-4xl font-black">{formatCurrency(cashInHand)}</h1>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-3xl text-white shadow-lg">
                      <p className="text-sm font-medium opacity-80 mb-1">BANK BALANCE</p>
                      <h1 className="text-4xl font-black">{formatCurrency(bankBalance)}</h1>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => { pushHistory(); setModal({ type: 'payment', data: { subType: 'in', paymentMode: 'Cash' } }); }} className="p-4 bg-green-50 border border-green-200 rounded-2xl flex flex-col items-center gap-2 hover:bg-green-100">
                          <div className="p-3 bg-green-100 text-green-700 rounded-full"><Plus size={24}/></div>
                          <span className="font-bold text-green-800">Add Cash</span>
                      </button>
                      <button onClick={() => { pushHistory(); setModal({ type: 'payment', data: { subType: 'out', paymentMode: 'Cash' } }); }} className="p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col items-center gap-2 hover:bg-red-100">
                          <div className="p-3 bg-red-100 text-red-700 rounded-full"><div className="w-6 h-1 bg-current rounded-full"/></div>
                          <span className="font-bold text-red-800">Reduce Cash</span>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- IMPORT LOGIC MOVED HERE FOR GLOBAL ACCESS ---
  const handleTransactionImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) { alert("Excel library is still loading. Please try again in a few seconds."); return; }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
            if (wb.SheetNames.length < 2) { alert("Excel must have at least 2 sheets (Transactions, Items)"); setLoading(false); return; }
            
            const ws1 = wb.Sheets[wb.SheetNames[0]]; 
            const ws2 = wb.Sheets[wb.SheetNames[1]]; 
            const txRows = window.XLSX.utils.sheet_to_json(ws1, { header: 1 });
            const itemRows = window.XLSX.utils.sheet_to_json(ws2, { header: 1 });
            
            const partyMap = {};
            data.parties.forEach(p => { if(p.name) partyMap[String(p.name).trim().toLowerCase()] = p.id; });
            const itemMap = {};
            data.items.forEach(i => { if(i.name) itemMap[String(i.name).trim().toLowerCase()] = i.id; });
            
            const validTransactions = [];
            const newItemsToSave = [];
            const batchPromises = [];
            let nextItemCounter = data.counters.item || 100;
            
            const parseDate = (val) => {
                if (val instanceof Date) return val.toISOString().split('T')[0];
                if (typeof val === 'string' && val.includes('/')) { const parts = val.split('/'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }
                return new Date().toISOString().split('T')[0];
            };

            for (let i = 1; i < txRows.length; i++) {
                const row = txRows[i];
                if (!row || row.length === 0) continue;
                const voucher = row[1];
                if (!voucher) continue;
                const rawDate = row[0];
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
                    if (!partyId) { console.warn(`Party not found: ${partyName}, skipping voucher ${voucher}`); continue; }
                }
                
                const specificItemRows = itemRows.filter(r => r[1] == voucher);
                const relatedItems = [];

                for (const r of specificItemRows) {
                     const itemName = String(r[2] || '').trim();
                     if(!itemName) continue;
                     let itemId = itemMap[itemName.toLowerCase()];
                     if(!itemId) {
                          const existingNew = newItemsToSave.find(ni => ni.name.toLowerCase() === itemName.toLowerCase());
                          if(existingNew) { itemId = existingNew.id; } else {
                              itemId = `I-${nextItemCounter}`; nextItemCounter++;
                              const newItem = { id: itemId, name: itemName, category: 'General', type: 'Goods', sellPrice: parseFloat(r[8]||0), buyPrice: parseFloat(r[5]||0), unit: 'pcs', openingStock: 0 };
                              newItemsToSave.push(cleanData(newItem)); itemMap[itemName.toLowerCase()] = itemId; 
                              batchPromises.push(setDoc(doc(db, "items", itemId), cleanData(newItem)));
                          }
                     }
                     relatedItems.push({ itemId, description: r[3] || '', qty: parseFloat(r[4] || 0), buyPrice: parseFloat(r[5] || 0), price: parseFloat(r[8] || 0) });
                }

                const validItems = relatedItems.filter(item => item.qty > 0 || item.price > 0);
                const gross = validItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
                const final = gross; 
                const newId = voucher.toString();
                
                const newTx = { id: newId, date: parseDate(rawDate), type, partyId, category: type === 'expense' ? category : '', items: validItems, amount: final, grossTotal: gross, finalTotal: final, received: 0, paid: 0, paymentMode: 'Cash', description: desc, createdAt: new Date().toISOString() };
                validTransactions.push(cleanData(newTx));
                batchPromises.push(setDoc(doc(db, "transactions", newId), cleanData(newTx)));
            }

            let maxTxNum = data.counters.transaction || 1000;
            validTransactions.forEach(tx => {
                const parts = tx.id.split(/[-:]/);
                if (parts.length > 1) { const num = parseInt(parts[parts.length - 1]); if (!isNaN(num) && num >= maxTxNum) maxTxNum = num + 1; }
            });
            
            const newCounters = { ...data.counters, transaction: maxTxNum, item: nextItemCounter };
            batchPromises.push(setDoc(doc(db, "settings", "counters"), newCounters));
            await Promise.all(batchPromises);
            setData(prev => ({ ...prev, transactions: [...prev.transactions, ...validTransactions], items: [...prev.items, ...newItemsToSave], counters: newCounters }));
            setLoading(false); alert(`Imported ${validTransactions.length} transactions successfully!`);
        } catch (err) { console.error(err); setLoading(false); alert("Error importing file. Check console."); }
    };
    reader.readAsBinaryString(file);
  };

  const handlePaymentImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) { alert("Excel library is still loading. Please try again in a few seconds."); return; }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
            if (wb.SheetNames.length < 2) { alert("Excel must have at least 2 sheets (Header, Links)"); setLoading(false); return; }
            
            const ws1 = wb.Sheets[wb.SheetNames[0]]; 
            const ws2 = wb.Sheets[wb.SheetNames[1]]; 
            const headers = window.XLSX.utils.sheet_to_json(ws1, { header: 1 });
            const links = window.XLSX.utils.sheet_to_json(ws2, { header: 1 });
            const partyMap = {};
            data.parties.forEach(p => { if(p.name) partyMap[String(p.name).trim().toLowerCase()] = p.id; });

            let nextPayCounter = data.counters.transaction || 1000;
            let maxImportedId = 0; 
            const batchPromises = [];
            const newTransactions = [];

            const parseDate = (val) => {
                if (val instanceof Date) return val.toISOString().split('T')[0];
                if (typeof val === 'string') { if(val.includes('/')) { const parts = val.split('/'); if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; } return val; }
                return new Date().toISOString().split('T')[0];
            };

            for(let i=1; i<headers.length; i++) {
                const row = headers[i];
                if(!row || row.length === 0) continue;
                const rawId = row[0]; if (!rawId) continue;
                const numId = parseInt(rawId); if (!isNaN(numId) && numId > maxImportedId) maxImportedId = numId;

                const rawDate = row[1];
                const typeStr = String(row[3] || '').toLowerCase();
                const totalAmount = parseFloat(row[4] || 0);
                const mode = row[5] || 'Cash';
                const partyName = String(row[6] || '');
                const desc = String(row[8] || '');
                const discount = parseFloat(row[14] || 0);

                const partyId = partyMap[partyName.trim().toLowerCase()];
                if (!partyId) { console.warn(`Payment Import: Party not found "${partyName}" for ID ${rawId}. Skipping.`); continue; }

                let subType = 'in'; let idPrefix = 'Payment In';
                if (typeStr.includes('out')) { subType = 'out'; idPrefix = 'Payment Out'; } else if (typeStr.includes('in')) { subType = 'in'; idPrefix = 'Payment In'; }

                const finalId = `${idPrefix}:${rawId}`;
                const linkedBills = links.filter(l => l[0] == rawId).map(l => ({ billId: l[1], amount: parseFloat(l[2] || 0) })).filter(l => l.billId && l.amount !== 0);

                const newTx = { id: finalId, type: 'payment', subType, date: parseDate(rawDate), partyId, amount: totalAmount, paymentMode: mode, discountValue: discount, discountType: 'Amt', linkedBills, description: desc, createdAt: new Date().toISOString(), externalRef: rawId };
                newTransactions.push(cleanData(newTx));
                batchPromises.push(setDoc(doc(db, "transactions", finalId), cleanData(newTx)));
            }
            
            const currentCounter = data.counters.transaction || 1000;
            let finalCounter = currentCounter;
            if (maxImportedId >= currentCounter) { finalCounter = maxImportedId + 1; const newCounters = { ...data.counters, transaction: finalCounter }; batchPromises.push(setDoc(doc(db, "settings", "counters"), newCounters)); }
            
            await Promise.all(batchPromises);
            setData(prev => ({ ...prev, transactions: [...prev.transactions, ...newTransactions], counters: { ...prev.counters, transaction: finalCounter } }));
            setLoading(false); alert(`Imported ${newTransactions.length} payment transactions successfully!`);
            
        } catch (err) { console.error(err); setLoading(false); alert("Error importing payments. Check console."); }
    };
    reader.readAsBinaryString(file);
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

  if (!user) return <LoginScreen onLogin={setUser} />;

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
                    <>
                    <div className="bg-white p-4 rounded-2xl border shadow-sm mb-4">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Upload size={18}/> Data Import</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="p-3 bg-purple-50 text-purple-700 rounded-xl cursor-pointer border border-purple-100 hover:bg-purple-100 flex items-center justify-center gap-2 text-xs font-bold">
                                <Upload size={16}/> Import Transactions
                                <input type="file" hidden accept=".xlsx, .xls" onChange={handleTransactionImport} />
                            </label>
                             <label className="p-3 bg-blue-50 text-blue-700 rounded-xl cursor-pointer border border-blue-100 hover:bg-blue-100 flex items-center justify-center gap-2 text-xs font-bold">
                                 <Upload size={16}/> Import Payments
                                 <input type="file" hidden accept=".xlsx, .xls" onChange={handlePaymentImport} />
                             </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { pushHistory(); setMastersView('items'); }} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100"><Package size={32} className="text-blue-600"/><span className="font-bold text-blue-800">Items</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('parties'); }} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100"><Users size={32} className="text-emerald-600"/><span className="font-bold text-emerald-800">Parties</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('cashbank'); }} className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-amber-100"><Wallet size={32} className="text-amber-600"/><span className="font-bold text-amber-800">Cash & Bank</span></button>
                    </div>
                    </>
                ) : (
                    <div>
                        <button onClick={handleCloseUI} className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800"><ArrowLeft size={18}/> Back</button>
                        {mastersView === 'items' && <MasterList title="Items" collection="items" type="item" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'item', id: item.id}); }} />}
                        {mastersView === 'parties' && <MasterList title="Parties" collection="parties" type="party" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'party', id: item.id}); }} />}
                        {mastersView === 'expenses' && <ExpensesBreakdown />}
                        {mastersView === 'cashbank' && <CashBankView />}
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