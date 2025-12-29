import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
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
  ExternalLink
} from 'lucide-react';

/** * SMEES Pro - Final Fixed Version
 * Backend: Firebase Firestore
 */

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyA0GkAFhV6GfFsszHPJG-aPfGNiVRdBPNg",
  authDomain: "smees-33e6c.firebaseapp.com",
  projectId: "smees-33e6c",
  storageBucket: "smees-33e6c.firebasestorage.app",
  messagingSenderId: "723248995098",
  appId: "1:723248995098:web:a61b659e31f42332656aa3",
  measurementId: "G-JVBZZ8SHGM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const INITIAL_DATA = {
  company: {
    name: "My Enterprise",
    mobile: "",
    address: "",
    financialYear: "2024-25",
    currency: "₹"
  },
  parties: [],
  items: [],
  staff: [],
  transactions: [],
  tasks: [],
  categories: {
    expense: ["Rent", "Electricity", "Marketing", "Salary"],
    item: ["Electronics", "Grocery", "General", "Furniture", "Pharmacy"]
  },
  counters: {
    party: 100,
    item: 100,
    staff: 100,
    transaction: 1000,
    task: 500,
    sales: 100,
    purchase: 100,
    expense: 100,
    payment: 100
  }
};

// --- HELPER FUNCTIONS ---

const getNextId = (data, type, subtype = null) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;

  if (type === 'transaction' && subtype) {
    if (subtype === 'sales') { prefix = 'S'; counterKey = 'sales'; }
    else if (subtype === 'purchase') { prefix = 'P'; counterKey = 'purchase'; }
    else if (subtype === 'expense') { prefix = 'E'; counterKey = 'expense'; }
    else if (subtype === 'payment') { prefix = 'PAY'; counterKey = 'payment'; }
  }

  const counters = data.counters || INITIAL_DATA.counters; 
  const num = counters[counterKey] || counters[type] || 1000;
  
  const nextCounters = { ...counters };
  if (counters[counterKey] !== undefined) {
    nextCounters[counterKey] = num + 1;
  } else {
    nextCounters[type] = num + 1;
  }

  return { id: `${prefix}-${num}`, nextCounters };
};

const formatCurrency = (amount) => {
  const val = parseFloat(amount || 0);
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

const getTransactionTotals = (tx) => {
  const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
  
  let discVal = parseFloat(tx.discountValue || 0);
  if (tx.discountType === '%') discVal = (gross * discVal) / 100;
  
  const final = gross - discVal;
  const paid = parseFloat(tx.received || tx.paid || 0);
  
  let status = 'UNPAID';
  if (paid >= final && final > 0) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  
  return { gross, final, paid, status, amount: tx.amount || final };
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

// --- COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
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
  const wrapperRef = useRef(null);

  const filtered = options.filter(opt => {
    const name = typeof opt === 'string' ? opt : (opt.name || '');
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getDisplayValue = () => {
    if (!value) return placeholder;
    const found = options.find(o => (o.id || o) === value);
    if (found) return found.name || found;
    return typeof value === 'object' ? value.name : value;
  };

  return (
    <div className="relative mb-4" ref={wrapperRef}>
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border rounded-xl bg-gray-50 flex justify-between items-center cursor-pointer"
      >
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {getDisplayValue()}
        </span>
        <Search size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <div className="sticky top-0 p-2 bg-white border-b">
            <input 
              autoFocus
              className="w-full p-2 text-sm border-none focus:ring-0" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {filtered.map((opt, idx) => {
            const id = typeof opt === 'string' ? opt : opt.id;
            const name = typeof opt === 'string' ? opt : opt.name;
            return (
              <div 
                key={id || idx} 
                className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 flex justify-between items-center"
                onClick={() => { onChange(id); setIsOpen(false); setSearchTerm(''); }}
              >
                <span>{name}</span>
                {opt.subText && (
                    <span className={`text-[10px] font-bold ${opt.subColor}`}>
                        {opt.subText}
                    </span>
                )}
                {!opt.subText && <span className="text-xs text-gray-400 ml-2">({id || 'N/A'})</span>}
              </div>
            );
          })}
          {onAddNew && (
            <div 
              className="p-3 text-blue-600 font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-blue-50"
              onClick={() => { onAddNew(); setIsOpen(false); }}
            >
              <Plus size={16} /> Add New
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mastersView, setMastersView] = useState(null); 
  const [convertModal, setConvertModal] = useState(null); 
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Logic Update States
  const [listFilter, setListFilter] = useState('all'); 
  const [pnlFilter, setPnlFilter] = useState('All'); 
  const [pnlCustomDates, setPnlCustomDates] = useState({ start: '', end: '' });
  const [showPnlReport, setShowPnlReport] = useState(false);
  const [timerConflict, setTimerConflict] = useState(null);
  const [editingTimeLog, setEditingTimeLog] = useState(null);

  // --- FIREBASE FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const newData = { ...INITIAL_DATA };
        const collections = ['parties', 'items', 'staff', 'transactions', 'tasks'];
        for (const col of collections) {
            const querySnapshot = await getDocs(collection(db, col));
            newData[col] = querySnapshot.docs.map(doc => doc.data());
        }
        const companySnap = await getDocs(collection(db, "settings"));
        companySnap.forEach(doc => {
            if (doc.id === 'company') newData.company = doc.data();
            if (doc.id === 'counters') newData.counters = doc.data();
        });
        if (Object.keys(newData.counters).length === 0) newData.counters = INITIAL_DATA.counters;
        setData(newData);
      } catch (error) {
        console.error("Error fetching data from Firestore: ", error);
        showToast("Error loading data from cloud", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- HISTORY HANDLING ---
  useEffect(() => {
      const handlePopState = (event) => {
          if (modal.type) setModal({ type: null, data: null });
          else if (viewDetail) setViewDetail(null);
          else if (mastersView) setMastersView(null);
          else if (convertModal) setConvertModal(null);
          else if (showPnlReport) setShowPnlReport(false);
          else if (timerConflict) setTimerConflict(null);
          else if (editingTimeLog) setEditingTimeLog(null);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [modal, viewDetail, mastersView, convertModal, showPnlReport, timerConflict, editingTimeLog]);

  const pushHistory = () => window.history.pushState({ modal: true }, '');
  const handleCloseUI = () => window.history.back();

  // --- HELPERS & LOGIC ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getBillLogic = (bill) => {
    const basic = getTransactionTotals(bill);
    const linkedAmount = data.transactions
      .filter(t => t.type === 'payment' && t.linkedBills)
      .reduce((sum, p) => {
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
    const pending = basic.final - totalPaid;
    
    if (totalPaid >= basic.final - 0.1) status = 'PAID'; 
    else if (totalPaid > 0) status = 'PARTIAL';
    
    return { ...basic, totalPaid, pending, status };
  };

  const partyBalances = useMemo(() => {
    const balances = {};
    data.parties.forEach(p => {
      balances[p.id] = p.type === 'DR' ? parseFloat(p.openingBal || 0) : -parseFloat(p.openingBal || 0);
    });
    data.transactions.forEach(tx => {
      const { final, paid } = getTransactionTotals(tx);
      const unpaid = final - paid;
      if (tx.type === 'sales') balances[tx.partyId] = (balances[tx.partyId] || 0) + unpaid;
      if (tx.type === 'purchase') balances[tx.partyId] = (balances[tx.partyId] || 0) - unpaid;
      if (tx.type === 'payment') {
        const amt = parseFloat(tx.amount || 0);
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
    const lowStockItems = data.items.filter(item => (itemStock[item.id] || 0) < 5);
    let totalReceivables = 0, totalPayables = 0;
    data.transactions.forEach(tx => {
       const { pending } = getBillLogic(tx);
       if (tx.type === 'sales') totalReceivables += pending;
       if (tx.type === 'purchase') totalPayables += pending;
    });
    return { todaySales, totalExpenses, pendingTasks, lowStockItems, totalReceivables, totalPayables };
  }, [data, itemStock]);

  const saveRecord = async (collectionName, record, idType) => {
    let newData = { ...data };
    let syncedRecord = null;
    let isUpdate = !!record.id;
    let finalId = record.id;
    let newCounters = null;

    if (record.id) {
      newData[collectionName] = data[collectionName].map(r => r.id === record.id ? record : r);
      if (collectionName === 'transactions' && record.type === 'sales' && record.convertedFromTask) {
         const task = newData.tasks.find(t => t.id === record.convertedFromTask);
         if (task) {
            task.itemsUsed = record.items.map(i => ({ itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice, description: i.description }));
            newData.tasks = newData.tasks.map(t => t.id === task.id ? task : t);
            await setDoc(doc(db, "tasks", task.id), task);
         }
      }
      syncedRecord = record;
    } else {
      const { id, nextCounters } = getNextId(data, idType, record.type);
      const createdField = collectionName === 'tasks' ? { taskCreatedAt: new Date().toISOString() } : {};
      syncedRecord = { ...record, id, createdAt: new Date().toISOString(), ...createdField };
      newData[collectionName] = [...data[collectionName], syncedRecord];
      newData.counters = nextCounters; 
      newCounters = nextCounters;
      finalId = id;
    }

    setData(newData);
    setModal({ type: null, data: null });
    handleCloseUI(); 
    showToast(isUpdate ? "Updated successfully" : "Created successfully");

    try {
        await setDoc(doc(db, collectionName, finalId.toString()), syncedRecord);
        if (newCounters) await setDoc(doc(db, "settings", "counters"), newCounters);
    } catch (e) {
        console.error("Firestore Save Error: ", e);
        showToast("Error saving to cloud", "error");
    }
    return finalId; 
  };

  const saveCompanySettings = async (companyData) => {
      const newData = { ...data, company: companyData };
      setData(newData);
      setModal({ type: null });
      handleCloseUI();
      try { await setDoc(doc(db, "settings", "company"), companyData); showToast("Settings saved"); } catch (e) { console.error(e); }
  };

  const deleteRecord = async (collectionName, id) => {
    if (collectionName === 'items' && data.transactions.some(t => t.items?.some(i => i.itemId === id))) { alert("Cannot delete: Item is used."); setConfirmDelete(null); return; }
    if (collectionName === 'parties' && data.transactions.some(t => t.partyId === id)) { alert("Cannot delete: Party is used."); setConfirmDelete(null); return; }
    setData(prev => ({ ...prev, [collectionName]: prev[collectionName].filter(r => r.id !== id) }));
    setConfirmDelete(null);
    setModal({ type: null, data: null });
    handleCloseUI(); 
    showToast("Record deleted");
    try { await deleteDoc(doc(db, collectionName, id.toString())); } catch (e) { console.error(e); }
  };

  const printInvoice = (tx) => {
    const party = data.parties.find(p => p.id === tx.partyId);
    const content = `<html><body><h1>INVOICE ${tx.id}</h1><p>Date: ${tx.date}</p><p>Party: ${party?.name}</p><p>Notes: ${tx.description || ''}</p></body></html>`; 
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
  };

  // --- SUB-COMPONENTS ---

  const ConvertTaskModal = ({ task }) => {
      const [form, setForm] = useState({
          date: new Date().toISOString().split('T')[0],
          received: '',
          mode: 'Cash'
      });

      const handleConfirm = async () => {
          const saleItems = (task.itemsUsed || []).map(i => ({
              itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice || 0, description: i.description || ''
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

          const saleId = await saveRecord('transactions', newSale, 'transaction');
          const updatedTask = { ...task, status: 'Done', generatedSaleId: saleId };
          await saveRecord('tasks', updatedTask, 'task');
          
          setConvertModal(null);
          setViewDetail(null);
          handleCloseUI();
      };

      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
             <h3 className="font-bold text-lg mb-4">Convert to Sale</h3>
             <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-500">Sale Date</label>
                  <input type="date" className="w-full p-2 border rounded-xl font-bold text-blue-600" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500">Received Amount</label>
                  <input type="number" className="w-full p-2 border rounded-xl" placeholder="0.00" value={form.received} onChange={e => setForm({...form, received: e.target.value})}/>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500">Payment Mode</label>
                  <select className="w-full p-2 border rounded-xl" value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}>
                    <option>Cash</option><option>UPI</option><option>Bank</option>
                  </select>
               </div>
               <div className="flex gap-3 pt-2">
                  <button onClick={handleCloseUI} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-gray-500">Cancel</button>
                  <button onClick={handleConfirm} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Confirm Sale</button>
               </div>
             </div>
          </div>
        </div>
      );
  };

  const TimeLogModal = () => {
      if (!editingTimeLog) return null;
      const { task, index } = editingTimeLog;
      const log = task.timeLogs[index];
      
      const [form, setForm] = useState({
          start: log.start.slice(0, 16), 
          end: log.end ? log.end.slice(0, 16) : ''
      });

      const handleSave = async () => {
          const startD = new Date(form.start);
          const endD = form.end ? new Date(form.end) : null;
          const duration = endD ? ((endD - startD) / 1000 / 60).toFixed(0) : 0;

          const newLogs = [...task.timeLogs];
          newLogs[index] = { ...log, start: new Date(form.start).toISOString(), end: form.end ? new Date(form.end).toISOString() : null, duration };
          
          const updatedTask = { ...task, timeLogs: newLogs };
          setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t) }));
          await setDoc(doc(db, "tasks", updatedTask.id), updatedTask);
          setEditingTimeLog(null);
          handleCloseUI();
      };

      return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                  <h3 className="font-bold text-lg mb-4">Edit Time Log</h3>
                  <div className="space-y-3">
                      <div>
                          <label className="text-xs font-bold text-gray-500">Start Time</label>
                          <input type="datetime-local" className="w-full p-2 border rounded-xl" value={form.start} onChange={e => setForm({...form, start: e.target.value})}/>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">End Time</label>
                          <input type="datetime-local" className="w-full p-2 border rounded-xl" value={form.end} onChange={e => setForm({...form, end: e.target.value})}/>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button onClick={handleCloseUI} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
                          <button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Save</button>
                      </div>
                  </div>
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

  const TaskModule = () => {
    const [sort, setSort] = useState('DateAsc');
    const sortedTasks = sortData(data.tasks, sort);
    const pending = sortedTasks.filter(t => t.status !== 'Done' && t.status !== 'Converted');
    const done = sortedTasks.filter(t => t.status === 'Done' || t.status === 'Converted');

    const TaskItem = ({ task }) => (
      <div 
        onClick={() => { pushHistory(); setViewDetail({ type: 'task', id: task.id }); }}
        className="p-4 bg-white border rounded-2xl mb-2 flex justify-between items-start cursor-pointer active:scale-95 transition-transform"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : task.status === 'Converted' ? 'bg-purple-500' : 'bg-orange-500'}`} />
            <p className="font-bold text-gray-800">{task.name}</p>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
          <div className="flex gap-3 mt-2 text-[10px] font-bold text-gray-400 uppercase">
            <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.dueDate)}</span>
            <span className="flex items-center gap-1"><Users size={10} /> {task.assignedStaff?.length || 0} Staff</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">{task.id}</p>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Tasks</h1>
          <div className="flex gap-2 items-center">
             <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="DateAsc">Due Soon</option><option value="DateDesc">Due Later</option>
                  <option value="A-Z">A-Z</option><option value="Z-A">Z-A</option>
             </select>
             <button onClick={() => { pushHistory(); setModal({ type: 'task' }); }} className="p-2 bg-blue-600 text-white rounded-xl"><Plus /></button>
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

  const DetailView = () => {
    if (!viewDetail) return null;
    
    if (viewDetail.type === 'transaction') {
      const tx = data.transactions.find(t => t.id === viewDetail.id);
      if (!tx) return null;
      const party = data.parties.find(p => p.id === tx.partyId);
      const totals = getBillLogic(tx);

      let pnl = { service: 0, goods: 0, total: 0 };
      (tx.items || []).forEach(item => {
        const itemMaster = data.items.find(i => i.id === item.itemId);
        const type = itemMaster?.type || 'Goods';
        const qty = parseFloat(item.qty || 0);
        const sell = parseFloat(item.price || 0);
        const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
        
        if (type === 'Service') {
          pnl.service += (sell * qty);
        } else {
          pnl.goods += ((sell - buy) * qty);
        }
      });
      pnl.total = pnl.service + pnl.goods;

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <div className="flex gap-2">
               <button onClick={() => printInvoice(tx)} className="p-2 bg-blue-50 text-blue-600 rounded-full"><Share2 size={20}/></button>
               <button onClick={() => { pushHistory(); setModal({ type: tx.type, data: tx }); setViewDetail(null); }} className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full">Edit</button>
            </div>
          </div>
          
          <div className="p-4 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-800">{formatCurrency(totals.final)}</h1>
              <p className="text-xs font-bold text-gray-400 uppercase">{tx.type} • {formatDate(tx.date)}</p>
              <div className="mt-2"><span className={`px-3 py-1 rounded-full text-xs font-black ${totals.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span></div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Party</p>
              <p className="font-bold text-lg">{party?.name || 'Unknown'}</p>
              <p className="text-sm text-gray-500">{party?.mobile}</p>
            </div>

            {tx.convertedFromTask && (
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <p className="text-xs font-bold text-purple-600 uppercase mb-1">Source Task</p>
                    <p className="text-sm font-bold text-gray-800">Task #{tx.convertedFromTask}</p>
                    <p className="text-xs text-gray-600 mt-1">{tx.workSummary}</p>
                    <button onClick={() => { setViewDetail({ type: 'task', id: tx.convertedFromTask }); }} className="mt-2 text-xs font-bold text-white bg-purple-600 px-3 py-1 rounded-lg flex items-center gap-1">
                        <LinkIcon size={12}/> View Source Task
                    </button>
                </div>
            )}

            {tx.description && (
              <div className="bg-white p-4 rounded-2xl border">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{tx.description}</p>
              </div>
            )}

            {['sales'].includes(tx.type) && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Info size={16}/> Profit Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Service Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.service)}</span></div>
                  <div className="flex justify-between"><span>Goods Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.goods)}</span></div>
                  <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-black text-blue-900">
                    <span>Net Profit</span><span>{formatCurrency(pnl.total)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-bold text-gray-400 text-xs uppercase">Items</h3>
              {tx.items?.map((item, i) => {
                 const m = data.items.find(x => x.id === item.itemId);
                 return (
                   <div key={i} className="flex justify-between p-3 border rounded-xl bg-white">
                     <div className="flex-1">
                       <p className="font-bold text-sm">{m?.name || 'Item'}</p>
                       <p className="text-xs text-gray-500">{item.qty} x {item.price}</p>
                       {item.description && <p className="text-xs text-gray-600 italic mt-1">{item.description}</p>}
                     </div>
                     <p className="font-bold text-sm">{formatCurrency(item.qty * item.price)}</p>
                   </div>
                 );
              })}
            </div>
          </div>
        </div>
      );
    }
    
    if (viewDetail.type === 'task') {
        const task = data.tasks.find(t => t.id === viewDetail.id);
        if (!task) return null;
        const party = data.parties.find(p => p.id === task.partyId);
        
        const openEditTimeLog = (idx) => {
            pushHistory();
            setEditingTimeLog({ task, index: idx });
        };

        const toggleTimer = (staffId) => {
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
                newLogs.push({ staffId, staffName: staff?.name, start: now, end: null, duration: 0 });
                updateTaskLogs(newLogs);
            }
        };

        const updateTaskLogs = (logs) => {
            const updatedTask = { ...task, timeLogs: logs };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t) }));
            setDoc(doc(db, "tasks", updatedTask.id), updatedTask);
        };

        const totalTime = (task.timeLogs || []).reduce((acc, log) => acc + (parseFloat(log.duration) || 0), 0);
        const updateTaskItems = (newItems) => {
            const updated = { ...task, itemsUsed: newItems };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }));
            setDoc(doc(db, "tasks", updated.id), updated);
        };

        return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
              <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
              <h2 className="font-bold text-lg">Task Details</h2>
              <button onClick={() => { pushHistory(); setModal({ type: 'task', data: task }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <div className="flex justify-between items-start mb-2">
                        <h1 className="text-xl font-black text-gray-800">{task.name}</h1>
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{task.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                         <div>
                            <p className="font-bold text-gray-400 uppercase">Client</p>
                            <p className="font-bold text-gray-800">{party?.name || 'N/A'}</p>
                            <p className="text-gray-500">{party?.mobile}</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-400 uppercase">Assigned To</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(task.assignedStaff || []).map(sid => {
                                    const s = data.staff.find(st => st.id === sid);
                                    return <span key={sid} className="bg-white border px-2 py-0.5 rounded-full text-gray-700">{s?.name}</span>;
                                })}
                                {(!task.assignedStaff || task.assignedStaff.length===0) && <span className="text-gray-400">Unassigned</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold flex items-center gap-2 text-blue-800"><Clock size={18}/> Time Logs</h3>
                        <span className="text-xs font-black bg-white px-2 py-1 rounded text-blue-600">{totalTime} mins</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 mb-4">
                        {data.staff.map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-xl border">
                                    <span className="text-sm font-bold text-gray-700">{s.name}</span>
                                    <button onClick={() => toggleTimer(s.id)} className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(task.timeLogs || []).map((log, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px] text-gray-600 border-b border-blue-100 pb-1">
                                <div className="flex-1">
                                    <span className="font-bold block">{log.staffName}</span>
                                    <span>{new Date(log.start).toLocaleString()}</span>
                                    {log.end && <span> - {new Date(log.end).toLocaleTimeString()}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{log.duration}m</span>
                                    <button onClick={() => openEditTimeLog(i)} className="p-1 bg-white rounded border"><Edit2 size={10}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold flex items-center gap-2 text-gray-700"><ShoppingCart size={18}/> Items Used</h3>
                         {task.status !== 'Converted' && (
                             <div className="w-40">
                                 <SearchableSelect placeholder="+ Add Item" options={data.items} value="" onChange={(val) => {
                                         if(val) {
                                            const item = data.items.find(i=>i.id===val);
                                            updateTaskItems([...(task.itemsUsed || []), { 
                                                itemId: val, qty: 1, price: item?.sellPrice || 0, buyPrice: item?.buyPrice || 0, description: ''
                                            }]);
                                         }
                                     }}
                                 />
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
                                    <input className="w-full text-xs p-1 border rounded" placeholder="Description" value={item.description} onChange={e => {
                                        const n = [...task.itemsUsed]; n[idx].description = e.target.value; updateTaskItems(n);
                                    }}/>
                                    <div className="flex gap-2">
                                        <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={item.qty} onChange={e => { const n = [...task.itemsUsed]; n[idx].qty = e.target.value; updateTaskItems(n); }} />
                                        <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={item.price} onChange={e => { const n = [...task.itemsUsed]; n[idx].price = e.target.value; updateTaskItems(n); }} />
                                        <input type="number" className="w-20 p-1 border rounded text-xs bg-gray-50" placeholder="Buy" value={item.buyPrice} onChange={e => { const n = [...task.itemsUsed]; n[idx].buyPrice = e.target.value; updateTaskItems(n); }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {task.status !== 'Converted' && (task.itemsUsed && task.itemsUsed.length > 0) && (
                    <div className="pt-4 border-t">
                        <button onClick={() => { pushHistory(); setConvertModal(task); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-200">
                            <ReceiptText size={18}/> Convert to Sale
                        </button>
                    </div>
                )}
            </div>
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
                   {record.lat && record.lng && (
                       <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${record.lat},${record.lng}`)} className="mt-2 w-full py-1 bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1">
                           <Navigation size={12}/> Direction
                       </button>
                   )}
                </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-gray-700"><History size={18}/> Transaction History</h3>
            {history.map(tx => {
              const t = getBillLogic(tx);
              return (
                <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm cursor-pointer">
                  <div>
                    <p className="font-bold text-sm">{tx.id} • {formatDate(tx.date)}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400">{tx.type} • {tx.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(tx.amount || t.final)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const Dashboard = () => {
      const pnlData = useMemo(() => {
          let filteredTx = data.transactions.filter(t => ['sales'].includes(t.type));
          const now = new Date();
          if(pnlFilter === 'Week') filteredTx = filteredTx.filter(t => (now - new Date(t.date)) / (1000*60*60*24) <= 7);
          if(pnlFilter === 'Month') filteredTx = filteredTx.filter(t => new Date(t.date).getMonth() === now.getMonth());
          if(pnlFilter === 'Year') filteredTx = filteredTx.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
          if(pnlFilter === 'Custom' && pnlCustomDates.start && pnlCustomDates.end) {
              filteredTx = filteredTx.filter(t => {
                  const d = new Date(t.date);
                  return d >= new Date(pnlCustomDates.start) && d <= new Date(pnlCustomDates.end);
              });
          }

          let profit = 0;
          filteredTx.forEach(tx => {
             (tx.items || []).forEach(item => {
                 const itemMaster = data.items.find(i => i.id === item.itemId);
                 const type = itemMaster?.type || 'Goods';
                 const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
                 const sell = parseFloat(item.price || 0);
                 const qty = parseFloat(item.qty || 0);
                 if(type === 'Service') profit += (sell * qty);
                 else profit += ((sell - buy) * qty);
             });
          });
          return profit;
      }, [data.transactions, pnlFilter, pnlCustomDates]);

      const navTo = (tab, filter) => {
          setListFilter(filter);
          setActiveTab(tab);
      };

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1>
              <p className="text-sm text-gray-500">FY {data.company.financialYear}</p>
            </div>
            <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 bg-gray-100 rounded-xl">
              <Settings className="text-gray-600" />
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-lg cursor-pointer" onClick={() => { pushHistory(); setShowPnlReport(true); }}>
             <div className="flex justify-between items-center mb-2" onClick={(e) => e.stopPropagation()}>
                 <h2 className="font-bold text-sm opacity-90">Total Profit</h2>
                 <select className="bg-white/20 border-none text-xs rounded-lg p-1 text-white font-bold cursor-pointer outline-none" value={pnlFilter} onChange={e => setPnlFilter(e.target.value)}>
                     <option value="All">All Time</option>
                     <option value="Week">This Week</option>
                     <option value="Month">This Month</option>
                     <option value="Year">This Year</option>
                     <option value="Custom">Custom</option>
                 </select>
             </div>
             {pnlFilter === 'Custom' && (
                 <div className="flex gap-2 mb-2 text-black text-xs" onClick={(e) => e.stopPropagation()}>
                     <input type="date" className="rounded p-1" value={pnlCustomDates.start} onChange={e => setPnlCustomDates({...pnlCustomDates, start: e.target.value})}/>
                     <input type="date" className="rounded p-1" value={pnlCustomDates.end} onChange={e => setPnlCustomDates({...pnlCustomDates, end: e.target.value})}/>
                 </div>
             )}
             <p className="text-3xl font-black">{formatCurrency(pnlData)}</p>
             <p className="text-xs opacity-70 mt-1">Net Profit (Sales - Cost) • Tap for details</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => navTo('accounting', 'sales')} className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
               <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
            </div>
            <div onClick={() => navTo('accounting', 'purchase')} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
               <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
            </div>
            <div onClick={() => navTo('accounting', 'sales')} className="bg-green-50 p-4 rounded-2xl border border-green-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(stats.todaySales)}</p>
            </div>
            <div onClick={() => navTo('accounting', 'expense')} className="bg-red-50 p-4 rounded-2xl border border-red-100 cursor-pointer active:scale-95 transition-transform">
              <p className="text-xs font-bold text-red-600 uppercase">Expenses</p>
              <p className="text-xl font-bold text-red-900">{formatCurrency(stats.totalExpenses)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Sale', icon: <TrendingUp />, type: 'sales', color: 'bg-green-100 text-green-700' },
                { label: 'Purchase', icon: <ShoppingCart />, type: 'purchase', color: 'bg-blue-100 text-blue-700' },
                { label: 'Expense', icon: <ReceiptText />, type: 'expense', color: 'bg-red-100 text-red-700' },
                { label: 'Payment', icon: <Banknote />, type: 'payment', color: 'bg-purple-100 text-purple-700' }
              ].map(action => (
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
    if (type === 'item') listData = listData.map(i => ({ 
        ...i, 
        subText: `${itemStock[i.id] || 0} ${i.unit}`, 
        subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600'
    }));
    if (type === 'party') listData = listData.map(p => {
        const bal = partyBalances[p.id] || 0;
        return {
            ...p,
            subText: bal !== 0 ? formatCurrency(Math.abs(bal)) + (bal > 0 ? ' DR' : ' CR') : 'Settled',
            subColor: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-gray-400'
        };
    });

    const filtered = sortData(listData.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
    ), sort);

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
              <h1 className="text-xl font-bold">{title}</h1>
          </div>
          <div className="flex gap-2">
              <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                  <option>A-Z</option><option>Z-A</option>
              </select>
              {selectedIds.length > 0 ? (
                  <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-xl flex items-center gap-1 text-sm px-4 font-bold"><Trash2 size={16}/> ({selectedIds.length})</button>
              ) : (
                  <button onClick={() => { pushHistory(); setModal({ type }); }} className="p-2 bg-blue-600 text-white rounded-xl flex items-center gap-1 text-sm px-4"><Plus size={18} /> Add</button>
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
              <div className="flex-1" onClick={() => onRowClick ? onRowClick(item) : (pushHistory() || setModal({ type, data: item }))}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.id} • {item.category || (item.mobile ? String(item.mobile).split(',')[0] : '') || item.role}</p>
                    </div>
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

    const filtered = sortData(data.transactions.filter(tx => filter === 'all' || tx.type === filter), sort);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Accounting</h1>
          <div className="flex gap-2 items-center">
             <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option>
                  <option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option>
             </select>
            <button onClick={() => window.print()} className="p-2 bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-1 text-gray-600"><Share2 size={14} /> PDF</button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'purchase', 'expense', 'payment'].map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
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
                        {tx.type === 'payment' && (
                            <>
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${isIncoming ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isIncoming ? 'IN' : 'OUT'}</span>
                                <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-gray-100 text-gray-600">{totals.status === 'UNUSED' ? 'UNUSED' : totals.used >= parseFloat(tx.amount)-0.1 ? 'USED' : 'PARTIAL'}</span>
                            </>
                        )}
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

  const TransactionForm = ({ type, record }) => {
    const [tx, setTx] = useState(record ? { ...record, linkedBills: record.linkedBills||[], items: record.items||[] } : {
        type, date: new Date().toISOString().split('T')[0], partyId: '', items: [], discountType: '%', discountValue: 0,
        received: 0, paid: 0, paymentMode: 'Cash', category: '', subType: type==='payment'?'in':'', amount: '', linkedBills: [], description: ''
    });
    const [showLinking, setShowLinking] = useState(false);
    const totals = getTransactionTotals(tx);

    const unpaidBills = useMemo(() => {
      if (!tx.partyId) return [];
      return data.transactions.filter(t => 
        t.partyId === tx.partyId && t.id !== tx.id &&
        (
             (['sales', 'purchase', 'expense'].includes(t.type) && getBillLogic(t).status !== 'PAID') ||
             (t.type === 'payment' && getBillLogic(t).status !== 'FULLY USED')
        )
      );
    }, [tx.partyId, data.transactions]);

    const updateLine = (idx, field, val) => {
        const newItems = [...tx.items]; newItems[idx][field] = val;
        if(field==='itemId') {
            const item = data.items.find(i=>i.id===val);
            if(item) { newItems[idx].price = type==='purchase'?item.buyPrice:item.sellPrice; newItems[idx].buyPrice = item.buyPrice; newItems[idx].description = item.description || ''; }
        }
        setTx({...tx, items: newItems});
    };

    const partyOptions = data.parties.map(p => {
        const bal = partyBalances[p.id] || 0;
        return {
            ...p,
            subText: bal !== 0 ? formatCurrency(Math.abs(bal)) + (bal > 0 ? ' DR' : ' CR') : 'Settled',
            subColor: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-gray-400'
        };
    });
    const itemOptions = data.items.map(i => ({ 
        ...i, 
        subText: `Stock: ${itemStock[i.id] || 0}`, 
        subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600'
    }));

    const handleLinkChange = (billId, value) => {
        const amt = parseFloat(value) || 0;
        const currentLinked = tx.linkedBills?.filter(l => l.billId !== billId).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;
        const total = parseFloat(tx.amount || 0);
        
        if (currentLinked + amt > total) {
            alert(`Total linked amount cannot exceed payment amount (${formatCurrency(total)})`);
            return;
        }
        
        const others = tx.linkedBills?.filter(l => l.billId !== billId) || [];
        if (amt > 0) setTx({...tx, linkedBills: [...others, { billId, amount: value }]});
        else setTx({...tx, linkedBills: others});
    };

    return (
      <div className="space-y-4 pb-10">
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase">{tx.id || 'New ' + type}</p>
          <input type="date" className="p-1 text-sm border-none bg-transparent font-bold text-blue-600" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} />
        </div>
        {type === 'payment' && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
            <button onClick={() => setTx({...tx, subType: 'in'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'in' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>Payment IN</button>
            <button onClick={() => setTx({...tx, subType: 'out'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'out' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}>Payment OUT</button>
          </div>
        )}
        <SearchableSelect label="Party" options={partyOptions} value={tx.partyId} onChange={v => setTx({...tx, partyId: v})} onAddNew={() => { pushHistory(); setModal({ type: 'party' }); }} />
        {type !== 'payment' && (
            <div className="space-y-3">
                 <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items</h4><button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0 }]})} className="text-blue-600 text-xs font-bold">+ Add Item</button></div>
                 {tx.items.map((line, idx) => (
                     <div key={idx} className="p-3 bg-gray-50 border rounded-xl relative space-y-2">
                         <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                         <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateLine(idx, 'itemId', v)} />
                         <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
                         <div className="grid grid-cols-3 gap-2">
                             <input type="number" className="p-2 border rounded-lg text-sm" value={line.qty} placeholder="Qty" onChange={e => updateLine(idx, 'qty', e.target.value)} />
                             <input type="number" className="p-2 border rounded-lg text-sm" value={line.price} placeholder="Price" onChange={e => updateLine(idx, 'price', e.target.value)} />
                             {type === 'sales' && <input type="number" className="p-2 border rounded-lg text-sm bg-yellow-50" value={line.buyPrice || 0} placeholder="Buy" onChange={e => updateLine(idx, 'buyPrice', e.target.value)} />}
                         </div>
                     </div>
                 ))}
                 <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                     <div className="flex items-center gap-2">
                        <input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Discount" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})}/>
                        <select className="p-2 text-xs border rounded-lg" value={tx.discountType} onChange={e => setTx({...tx, discountType: e.target.value})}><option>%</option><option>Amt</option></select>
                     </div>
                     <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(totals.final)}</span></div>
                     <div className="flex items-center gap-2"><input type="number" className="flex-1 p-3 border rounded-xl font-bold text-green-600" placeholder="Received/Paid" value={(type==='sales'?tx.received:tx.paid)||''} onChange={e=>setTx({...tx, [type==='sales'?'received':'paid']: e.target.value})}/></div>
                 </div>
            </div>
        )}
        {type === 'payment' && (
            <div className="space-y-4">
                <input type="number" className="w-full bg-blue-50 text-2xl font-bold p-4 rounded-xl text-blue-600" placeholder="0.00" value={tx.amount} onChange={e=>setTx({...tx, amount: e.target.value})}/>
                <button onClick={() => setShowLinking(!showLinking)} className="w-full p-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">{showLinking?"Hide":"Link Bills (Advanced)"}</button>
                {showLinking && <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-xl">{unpaidBills.map(b => (
                    <div key={b.id} className="flex justify-between items-center p-2 border-b last:border-0"><div className="text-[10px]"><p className="font-bold">{b.id} • {b.type === 'payment' ? (b.subType==='in'?'IN':'OUT') : b.type}</p><p>{formatDate(b.date)} • Tot: {formatCurrency(b.amount || getBillLogic(b).final)}</p></div><input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Amt" value={tx.linkedBills?.find(l=>l.billId===b.id)?.amount||''} onChange={e => handleLinkChange(b.id, e.target.value)}/></div>
                ))}</div>}
            </div>
        )}
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-16" placeholder="Notes" value={tx.description} onChange={e => setTx({...tx, description: e.target.value})} />
        <button onClick={() => { if(!tx.partyId) return alert("Party Required"); saveRecord('transactions', {...tx, ...totals}, 'transaction'); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save</button>
      </div>
    );
  };

  const StaffForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', mobile: '', role: 'Staff', active: true });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Staff Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
          <option>Admin</option>
          <option>Staff</option>
          <option>Manager</option>
        </select>
        <button onClick={() => saveRecord('staff', form, 'staff')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Staff</button>
      </div>
    );
  };

  const TaskForm = ({ record }) => {
    const [form, setForm] = useState(record ? { ...record, itemsUsed: record.itemsUsed || [], assignedStaff: record.assignedStaff || [] } : { name: '', partyId: '', description: '', status: 'To Do', dueDate: '', assignedStaff: [], itemsUsed: [] });
    
    const itemOptions = data.items.map(i => ({ 
        ...i, 
        subText: `Stock: ${itemStock[i.id] || 0}`, 
        subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600'
    }));

    const updateItem = (idx, field, val) => {
        const n = [...form.itemsUsed]; n[idx][field] = val;
        if(field==='itemId') {
            const item = data.items.find(i=>i.id===val);
            if(item) { n[idx].price = item.sellPrice; n[idx].buyPrice = item.buyPrice; n[idx].description = item.description || ''; }
        }
        setForm({...form, itemsUsed: n});
    };

    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        
        <div className="p-3 bg-gray-50 rounded-xl border">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Assigned Staff</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {form.assignedStaff.map(sid => {
                    const s = data.staff.find(st => st.id === sid);
                    return (
                        <span key={sid} className="bg-white border px-2 py-1 rounded-full text-xs flex items-center gap-1">
                            {s?.name} <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button>
                        </span>
                    );
                })}
            </div>
            <select className="w-full p-2 border rounded-lg text-sm bg-white" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}>
                <option value="">+ Add Staff</option>
                {data.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        </div>

        <SearchableSelect label="Client" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v})} />
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        
        <div className="space-y-2">
            <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items / Parts</h4><button onClick={() => setForm({...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="text-blue-600 text-xs font-bold">+ Add</button></div>
            {form.itemsUsed.map((line, idx) => (
                <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2">
                    <button onClick={() => setForm({...form, itemsUsed: form.itemsUsed.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                    <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} />
                    <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} />
                    <div className="flex gap-2">
                        <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                        <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                        <input type="number" className="w-20 p-1 border rounded text-xs bg-gray-100" placeholder="Buy" value={line.buyPrice} onChange={e => updateItem(idx, 'buyPrice', e.target.value)} />
                    </div>
                </div>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
           <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>To Do</option><option>In Progress</option><option>Done</option></select>
        </div>
        <button onClick={() => saveRecord('tasks', form, 'task')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
      </div>
    );
  };

  const CompanyForm = () => {
    const [form, setForm] = useState(data.company);
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Company Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="FY" value={form.financialYear} onChange={e => setForm({...form, financialYear: e.target.value})} />
          <div className="p-3 bg-gray-100 border rounded-xl text-gray-500">Currency: ₹</div>
        </div>
        <button onClick={() => { saveCompanySettings(form); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Settings</button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="text-sm font-bold">{toast.message}</span></div>}
      <DetailView />
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div><span className="font-black text-gray-800 tracking-tight">SMEES Pro</span></div>
        <div className="flex gap-3">
          <button onClick={() => { setActiveTab('accounting'); setListFilter('all'); }} className="p-2 hover:bg-gray-100 rounded-full"><Search size={20} className="text-gray-500" /></button>
          <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button>
        </div>
      </div>
      <main className="max-w-xl mx-auto p-4">
        {loading ? <div className="flex flex-col items-center justify-center h-64 text-gray-400"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div><p className="text-sm font-bold">Syncing Data...</p></div> : (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'accounting' && <TransactionList />}
            {activeTab === 'tasks' && <TaskModule />}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                {mastersView === null ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { pushHistory(); setMastersView('items'); }} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors"><Package size={32} className="text-blue-600"/><span className="font-bold text-blue-800">Manage Items</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('parties'); }} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100 transition-colors"><Users size={32} className="text-emerald-600"/><span className="font-bold text-emerald-800">Manage Parties</span></button>
                        <button onClick={() => { pushHistory(); setMastersView('staff'); }} className="p-6 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-purple-100 transition-colors"><Briefcase size={32} className="text-purple-600"/><span className="font-bold text-purple-800">Manage Staff</span></button>
                    </div>
                ) : (
                    <div>
                        <button onClick={handleCloseUI} className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800"><ArrowLeft size={18}/> Back to Menu</button>
                        {mastersView === 'items' && <MasterList title="Items" collection="items" type="item" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'item', id: item.id}); }} />}
                        {mastersView === 'parties' && <MasterList title="Parties" collection="parties" type="party" onRowClick={(item) => { pushHistory(); setViewDetail({type: 'party', id: item.id}); }} />}
                        {mastersView === 'staff' && <MasterList title="Staff" collection="staff" type="staff" />}
                    </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-2 flex justify-between items-center z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {[{ id: 'dashboard', icon: <LayoutDashboard />, label: 'Home' }, { id: 'accounting', icon: <ReceiptText />, label: 'Accounts' }, { id: 'tasks', icon: <CheckSquare />, label: 'Tasks' }, { id: 'staff', icon: <Users />, label: 'Masters' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}>{tab.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span></button>
        ))}
      </nav>
      
      {/* MODALS */}
      <Modal isOpen={!!modal.type} onClose={handleCloseUI} title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}>
        {modal.type === 'company' && <CompanyForm />}
        {modal.type === 'party' && <PartyForm record={modal.data} />}
        {modal.type === 'item' && <ItemForm record={modal.data} />}
        {modal.type === 'staff' && <StaffForm record={modal.data} />}
        {modal.type === 'task' && <TaskForm record={modal.data} />}
        {['sales', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} />}
      </Modal>

      {/* 7. Timer Conflict Warning Modal */}
      {timerConflict && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center">
                  <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="text-yellow-600"/></div>
                  <h3 className="font-bold text-lg">Active Timer Detected</h3>
                  <p className="text-sm text-gray-600 my-2">Staff is already active on another task. Stop it first?</p>
                  <div className="flex gap-3 mt-4">
                      <button onClick={() => { 
                          const sId = timerConflict.staffId; 
                          setTimerConflict(null);
                          // Force Start
                          const task = data.tasks.find(t => t.id === timerConflict.targetTaskId);
                          const now = new Date().toISOString();
                          const staff = data.staff.find(s => s.id === sId);
                          const newLogs = [...(task.timeLogs || []), { staffId: sId, staffName: staff?.name, start: now, end: null, duration: 0 }];
                          const updated = { ...task, timeLogs: newLogs };
                          setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) }));
                          setDoc(doc(db, "tasks", updated.id), updated);
                      }} className="flex-1 p-3 bg-gray-100 font-bold rounded-xl text-gray-600">Start Anyway</button>
                      <button onClick={() => { 
                          const tId = timerConflict.activeTaskId;
                          setTimerConflict(null); 
                          setViewDetail({ type: 'task', id: tId }); 
                      }} className="flex-1 p-3 bg-blue-600 font-bold rounded-xl text-white">Go to Task</button>
                  </div>
              </div>
          </div>
      )}

      {confirmDelete && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"><div className="bg-white p-6 rounded-3xl w-full max-w-xs text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div><h3 className="text-xl font-bold mb-2">Are you sure?</h3><div className="flex gap-3"><button onClick={() => setConfirmDelete(null)} className="flex-1 p-3 font-bold text-gray-500 bg-gray-100 rounded-xl">Cancel</button><button onClick={() => deleteRecord(confirmDelete.collection, confirmDelete.id)} className="flex-1 p-3 font-bold text-white bg-red-600 rounded-xl">Delete</button></div></div></div>}
      
      {convertModal && <ConvertTaskModal task={convertModal} />}
      {editingTimeLog && <TimeLogModal />}
      {showPnlReport && <PnlReportView />}
    </div>
  );
}