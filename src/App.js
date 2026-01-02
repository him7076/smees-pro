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
  where 
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
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper for Secured Paths
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app';
const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocRef = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

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

  if (type === 'sales') { prefix = 'S'; counterKey = 'sales'; }
  else if (type === 'purchase') { prefix = 'P'; counterKey = 'purchase'; }
  else if (type === 'expense') { prefix = 'E'; counterKey = 'expense'; }
  else if (type === 'payment') { prefix = 'PAY'; counterKey = 'payment'; }
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
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('smees_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem('smees_data');
    return savedData ? JSON.parse(savedData) : INITIAL_DATA;
  });
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
   
  const [listFilter, setListFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [partyFilter, setPartyFilter] = useState(null);
  const [listPaymentMode, setListPaymentMode] = useState(null);
  const [pnlFilter, setPnlFilter] = useState('Monthly');
  const [pnlCustomDates, setPnlCustomDates] = useState({ start: '', end: '' });
  const [showPnlReport, setShowPnlReport] = useState(false);
  const [timerConflict, setTimerConflict] = useState(null);
  const [editingTimeLog, setEditingTimeLog] = useState(null);
  const [manualAttModal, setManualAttModal] = useState(null); 
  const [adjustCashModal, setAdjustCashModal] = useState(null);
  const [selectedTimeLog, setSelectedTimeLog] = useState(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (!u && !user) {
            signInAnonymously(auth).catch(console.error);
        }
    });
    return () => unsubscribe();
  }, [user]);

  // Sync Logic
  const syncData = async () => {
      setLoading(true);
      try {
        const newData = { ...INITIAL_DATA };
        const collections = ['parties', 'items', 'staff', 'transactions', 'tasks', 'attendance'];
        for (const col of collections) {
            const querySnapshot = await getDocs(getColRef(col));
            newData[col] = querySnapshot.docs.map(doc => doc.data());
        }
        
        const companySnap = await getDocs(getColRef("settings"));
        companySnap.forEach(doc => {
            if (doc.id === 'company') newData.company = doc.data();
            if (doc.id === 'counters') newData.counters = { ...INITIAL_DATA.counters, ...doc.data() };
            if (doc.id === 'categories') newData.categories = { ...INITIAL_DATA.categories, ...doc.data() };
        });
        
        localStorage.setItem('smees_data', JSON.stringify(newData));
        setData(newData);
        showToast("Data Synced Successfully");
      } catch (error) { 
          console.error(error); 
          showToast("Sync Error: " + error.message, "error"); 
      } finally { 
          setLoading(false); 
      }
  };

  useEffect(() => {
    if (!user) return;
    const localData = localStorage.getItem('smees_data');
    if (!localData) {
        syncData();
    }
  }, [user]);

  // Deep Linking
  useEffect(() => {
      if (data.tasks && data.tasks.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const taskId = params.get('taskId');
          if (taskId) {
              const task = data.tasks.find(t => t.id === taskId);
              if (task) {
                  setActiveTab('tasks');
                  setViewDetail({ type: 'task', id: taskId });
              }
          }
      }
  }, [data.tasks]);

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
          else if (selectedTimeLog) setSelectedTimeLog(null);
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
    
    let cashInHand = 0, bankBalance = 0;
    data.transactions.forEach(tx => {
        if (tx.type === 'estimate') return;
        let amt = 0;
        let isIncome = false;
        let affectCashBank = false;

        if (tx.type === 'sales') {
            amt = parseFloat(tx.received || 0);
            isIncome = true;
            affectCashBank = amt > 0;
        } else if (tx.type === 'purchase') {
            amt = parseFloat(tx.paid || 0);
            isIncome = false;
            affectCashBank = amt > 0;
        } else if (tx.type === 'expense') {
            amt = parseFloat(tx.paid || 0);
            isIncome = false;
            affectCashBank = amt > 0;
        } else if (tx.type === 'payment') {
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
           setDoc(getDocRef("tasks", task.id), task);
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
        await setDoc(getDocRef(collectionName, finalId.toString()), safeRecord);
        if (newCounters) await setDoc(getDocRef("settings", "counters"), newCounters);
    } catch (e) { console.error(e); showToast("Save Error", "error"); }
    return finalId; 
  };

  const deleteRecord = async (collectionName, id) => {
    if (!user) return;
    if (collectionName === 'items' && data.transactions.some(t => t.items?.some(i => i.itemId === id))) { alert("Item is used."); setConfirmDelete(null); return; }
    if (collectionName === 'parties' && data.transactions.some(t => t.partyId === id)) { alert("Party is used."); setConfirmDelete(null); return; }
    setData(prev => ({ ...prev, [collectionName]: prev[collectionName].filter(r => r.id !== id) }));
    setConfirmDelete(null); setModal({ type: null, data: null }); handleCloseUI(); showToast("Deleted");
    try { await deleteDoc(getDocRef(collectionName, id.toString())); } catch (e) { console.error(e); }
  };

  const handleTransactionImport = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.XLSX) return alert("Excel lib not loaded");

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
          const jsonData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          let newTx = [];
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
                  date: row[0],
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
              batch.push(setDoc(getDocRef("transactions", id), cleanData(tx)));
          }
          
          if(batch.length > 0) {
              batch.push(setDoc(getDocRef("settings", "counters"), nextCounters));
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
          let newTx = [];
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
                  subType: (row[1] || 'in').toLowerCase(), 
                  partyId: party ? party.id : '',
                  amount: parseFloat(row[3] || 0),
                  paymentMode: row[4] || 'Cash',
                  description: row[5] || 'Imported Payment',
                  createdAt: new Date().toISOString()
              };

              newTx.push(cleanData(tx));
              batch.push(setDoc(getDocRef("transactions", id), cleanData(tx)));
          }

          if(batch.length > 0) {
              batch.push(setDoc(getDocRef("settings", "counters"), nextCounters));
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
        await setDoc(getDocRef("attendance", attRecord.id), attRecord);
        showToast(`${type} Recorded`);
    };

    const deleteAtt = async (id) => {
        if(!window.confirm("Delete this attendance record?")) return;
        await deleteDoc(getDocRef("attendance", id));
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
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('receivable'); }} className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
               <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
            </div>
            
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('payable'); }} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
               <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
            </div>
            
            <div onClick={() => { setListFilter('sales'); setActiveTab('accounting'); }} className="bg-green-50 p-4 rounded-2xl border border-green-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(stats.todaySales)}</p>
            </div>
            
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
                    batchPromises.push(setDoc(getDocRef(collection, id), cleanData(record)));
                }
            }
            
            batchPromises.push(setDoc(getDocRef("settings", "counters"), nextCounters));
            
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
       try { await Promise.all(ids.map(id => deleteDoc(getDocRef(collection, id.toString())))); } catch (e) { console.error(e); }
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
      
      const shareInvoice = () => {
        const company = data.company;
        const discountAmt = totals.gross - totals.final;
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${tx.type.toUpperCase()} - ${tx.id}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
              body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #f8fafc; -webkit-print-color-adjust: exact; }
              .invoice-box { max-width: 800px; margin: auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 24px; }
              .company-name { font-size: 32px; font-weight: 800; color: #2563eb; margin: 0 0 4px 0; letter-spacing: -0.5px; }
              .company-details { font-size: 13px; color: #64748b; line-height: 1.5; }
              .invoice-info { text-align: right; }
              .invoice-title { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
              .meta-item { font-size: 13px; color: #64748b; margin-top: 2px; }
              .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: white; background: ${totals.status === 'PAID' ? '#10b981' : totals.status === 'PARTIAL' ? '#f59e0b' : '#ef4444'}; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
              .billing-grid { display: grid; grid-template-columns: 1fr; margin-bottom: 40px; }
              .bill-card { background: #f1f5f9; padding: 20px; border-radius: 12px; border-left: 4px solid #2563eb; }
              .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
              .party-name { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
              .party-detail { font-size: 13px; color: #475569; display: block; margin-top: 2px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              table th { background: #eff6ff; color: #1e40af; padding: 12px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; text-align: left; border-top: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe; }
              table td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
              table tr:last-child td { border-bottom: none; }
              .text-right { text-align: right; }
              .item-name { font-weight: 600; color: #0f172a; display: block; }
              .item-desc { font-size: 11px; color: #64748b; margin-top: 2px; display: block; }
              .totals-section { display: flex; justify-content: flex-end; }
              .totals-box { width: 280px; }
              .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; }
              .total-row.grand-total { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 12px 0; margin-top: 8px; margin-bottom: 8px; font-size: 18px; font-weight: 800; color: #2563eb; }
              .total-row.balance { color: #dc2626; font-weight: 700; }
              .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 24px; }
              @media print {
                body { background: white; padding: 0; }
                .invoice-box { box-shadow: none; border: none; padding: 0; max-width: 100%; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="invoice-box">
              <div class="header">
                <div>
                  <h1 class="company-name">${company.name}</h1>
                  <div class="company-details">${company.address || 'Address Not Available'}</div>
                  <div class="company-details">Phone: ${company.mobile || 'N/A'}</div>
                </div>
                <div class="invoice-info">
                  <div class="invoice-title">${tx.type}</div>
                  <div class="meta-item">Voucher #: <span style="color: #0f172a; font-weight: 600;">${tx.id}</span></div>
                  <div class="meta-item">Date: <span style="color: #0f172a; font-weight: 600;">${formatDate(tx.date)}</span></div>
                  <span class="status-badge">${totals.status}</span>
                </div>
              </div>

              <div class="billing-grid">
                <div class="bill-card">
                  <div class="label">Billed To</div>
                  <h3 class="party-name">${party?.name || tx.category || 'Unknown'}</h3>
                  <span class="party-detail">Mobile: ${party?.mobile || 'N/A'}</span>
                  <span class="party-detail">${party?.address || ''}</span>
                </div>
              </div>

              ${!isPayment ? `
              <table>
                <thead>
                  <tr>
                    <th style="border-radius: 8px 0 0 8px;">Item Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right" style="border-radius: 0 8px 8px 0;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(tx.items || []).map(item => {
                    const m = data.items.find(x => x.id === item.itemId);
                    return `
                      <tr>
                        <td>
                          <span class="item-name">${m?.name || 'Item'}</span>
                          ${item.description ? `<span class="item-desc">${item.description}</span>` : ''}
                        </td>
                        <td class="text-right">${item.qty}</td>
                        <td class="text-right">${formatCurrency(item.price)}</td>
                        <td class="text-right" style="font-weight: 600;">${formatCurrency(item.qty * item.price)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              ` : `
              <div style="margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
                  <p style="font-size: 14px; color: #64748b;">Payment for <strong>${tx.description || 'General Account'}</strong></p>
                  <h2 style="color: #2563eb; font-size: 24px; margin: 10px 0;">${formatCurrency(tx.amount)}</h2>
                  <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Paid via ${tx.paymentMode}</p>
              </div>
              `}

              <div class="totals-section">
                <div class="totals-box">
                  <div class="total-row"><span>Subtotal</span><span>${formatCurrency(totals.gross || totals.amount)}</span></div>
                  ${discountAmt > 0 ? `<div class="total-row"><span>Discount</span><span style="color: #ef4444;">-${formatCurrency(discountAmt)}</span></div>` : ''}
                  <div class="total-row grand-total"><span>Grand Total</span><span>${formatCurrency(totals.final || totals.amount)}</span></div>
                  <div class="total-row"><span>Paid Amount</span><span>${formatCurrency(totals.paid || (isPayment ? totals.amount : 0))}</span></div>
                  ${totals.pending > 0 ? `<div class="total-row balance"><span>Balance Due</span><span>${formatCurrency(totals.pending)}</span></div>` : ''}
                </div>
              </div>

              <div class="footer">
                <p style="margin-bottom: 8px;">Thank you for your business!</p>
                <p style="font-weight: 600; color: #0f172a;">${company.name}</p>
              </div>
            </div>
            <script>
                // Auto-print when loaded
                setTimeout(() => { window.print(); }, 500);
            </script>
          </body>
          </html>
        `;
        
        const win = window.open('', '_blank');
        if (win) { 
            win.document.write(htmlContent); 
            win.document.close(); 
        } else {
            alert("Pop-up blocked! Please allow pop-ups to view the invoice.");
        }
      };

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <div className="flex gap-2">
               <button onClick={shareInvoice} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200">
                   <Share2 size={16}/> Share PDF
               </button>
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
                const start = new Date(newLogs[activeLogIndex].start); 
                const end = new Date(now);
                const duration = ((end - start) / 1000 / 60).toFixed(0); 
                newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration };
                updateTaskLogs(newLogs);
            } else {
                const activeTask = data.tasks.find(t => t.timeLogs && t.timeLogs.some(l => l.staffId === staffId && !l.end));
                if (activeTask && activeTask.id !== task.id) { 
                    pushHistory(); 
                    setTimerConflict({ staffId, activeTaskId: activeTask.id, targetTaskId: task.id }); 
                    return; 
                }
                
                const staff = data.staff.find(s => s.id === staffId);
                
                const saveLog = (locData) => {
                     newLogs.push({ 
                        staffId, 
                        staffName: staff?.name, 
                        start: now, 
                        end: null, 
                        duration: 0,
                        location: locData 
                    });
                    updateTaskLogs(newLogs);
                };

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            saveLog({ lat: latitude, lng: longitude });
                        },
                        (err) => {
                            console.error("Location Error:", err);
                            saveLog(null); 
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
            setDoc(getDocRef("tasks", updatedTask.id), updatedTask);
        };
        
        const updateTaskItems = (newItems) => {
            const updated = { ...task, itemsUsed: newItems };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }));
            setDoc(getDocRef("tasks", updated.id), updated);
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
                   <button onClick={shareTask} className="p-2 bg-green-100 text-green-700 rounded-lg"><MessageCircle size={20}/></button>
                   {checkPermission(user, 'canEditTasks') && <button onClick={() => { pushHistory(); setModal({ type: 'task', data: task }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>}
              </div>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h1 className="text-xl font-black text-gray-800 mb-2">{task.name}</h1>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    <p className="text-sm text-gray-600 my-4">{task.description}</p>

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

                    <div className="flex flex-col gap-2 mb-4">
                        {visibleStaff.map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-xl border"><span className="text-sm font-bold text-gray-700">{s.name}</span><button onClick={() => toggleTimer(s.id)} className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}</button></div>
                            );
                        })}
                    </div>
                </div>

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
            </div>
          </div>
        );
    }

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
          await setDoc(getDocRef("settings", "categories"), fullCats);
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
          await setDoc(getDocRef("settings", "categories"), fullCats);
          setEditingCat(null);
          showToast("Category Updated");
      };

      const handleDelete = async (catName) => {
          if(!window.confirm(`Delete category "${catName}"?`)) return;
          const updated = (data.categories.expense || []).filter(c => c !== catName);
          const fullCats = { ...data.categories, expense: updated };

          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(getDocRef("settings", "categories"), fullCats);
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
        description: '' 
    });
    
    const [showLinking, setShowLinking] = useState(false);
    
    // REQ 4: Calculate Voucher ID using useMemo
    const currentVoucherId = useMemo(() => {
        if (record?.id) return record.id;
        return getNextId(data, type).id;
    }, [data, type, record]);

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
        let newLinked = [...(tx.linkedBills || [])];
        const existingIdx = newLinked.findIndex(l => l.billId === billId);
        
        if (existingIdx >= 0) {
            if (amt <= 0) newLinked.splice(existingIdx, 1);
            else newLinked[existingIdx].amount = amt;
        } else if (amt > 0) {
            newLinked.push({ billId, amount: amt });
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
        <SearchableSelect 
            label={type === 'expense' ? "Paid To (Party)" : "Party / Client"} 
            options={partyOptions} 
            value={tx.partyId} 
            onChange={v => setTx({...tx, partyId: v})} 
            onAddNew={() => { pushHistory(); setModal({ type: 'party' }); }} 
            placeholder="Select Party..." 
        />

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
                saveRecord('transactions', {...tx, ...totals}, tx.type); 
            }} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
        >
            Save {type}
        </button>
      </div>
    );
  };

  const LoginScreen = () => {
    const [id, setId] = useState('');
    const [pass, setPass] = useState('');
    const [err, setErr] = useState('');

    // REQ 2: Save Session on Login
    const handleLogin = async () => {
        if(id === 'him23' && pass === 'Himanshu#3499sp') {
            const adminUser = { name: 'Admin', role: 'admin', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } };
            setUser(adminUser);
            localStorage.setItem('smees_user', JSON.stringify(adminUser));
        } else {
            try {
                await signInAnonymously(auth);
                const q = query(getColRef('staff'), where('loginId', '==', id), where('password', '==', pass));
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

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="text-sm font-bold">{toast.message}</span></div>}
      <DetailView />
      
      {/* REQ 4: Header with Manual Sync Button */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div><span className="font-black text-gray-800 tracking-tight">SMEES Pro</span></div>
        <div className="flex gap-3">
            <button onClick={syncData} className={`p-2 hover:bg-gray-100 rounded-full ${loading ? 'animate-spin' : ''}`}><RefreshCw size={20} className="text-blue-600" /></button>
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
      {convertModal && <ConvertTaskModal task={convertModal} />}
      {editingTimeLog && <TimeLogModal />}
      {statementModal && <StatementModal />}
      {manualAttModal && <ManualAttendanceModal />}
      {adjustCashModal && <CashAdjustmentModal />}
      {selectedTimeLog && <TimeLogDetailsModal />}
    </div>
  );
}