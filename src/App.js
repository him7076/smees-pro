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
  Link as LinkIcon
} from 'lucide-react';

/** * SMEES Pro - Final Fixed Version (Restored Missing Components)
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
      // 1. Hooks (Unconditional)
      const [form, setForm] = useState({ start: '', end: '' });

      useEffect(() => {
          if (editingTimeLog) {
              const { task, index } = editingTimeLog;
              const log = task.timeLogs[index] || {};
              setForm({
                  start: log.start ? log.start.slice(0, 16) : '', 
                  end: log.end ? log.end.slice(0, 16) : ''
              });
          }
      }, [editingTimeLog]);

      // 2. Return Check (After Hooks)
      if (!editingTimeLog) return null;

      const { task, index } = editingTimeLog;
      const log = task.timeLogs[index];

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

  // --- RESTORED COMPONENT DEFINITIONS ---

  const PartyForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', mobile: '', email: '', openingBal: 0, type: 'CR', address: '', lat: '', lng: '' });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Party Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile (comma separated)" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
             <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Latitude" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} />
             <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Longitude" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} />
        </div>
        <div className="flex gap-2 items-center">
          <input className="flex-1 p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Opening Balance" value={form.openingBal} onChange={e => setForm({...form, openingBal: e.target.value})} />
          <select className="p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="CR">CR</option><option value="DR">DR</option>
          </select>
        </div>
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        <button onClick={() => saveRecord('parties', form, 'party')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Party</button>
      </div>
    );
  };

  const ItemForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', unit: 'PCS', sellPrice: 0, buyPrice: 0, category: 'General', type: 'Goods', openingStock: 0, description: '' });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Item Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-20" placeholder="Item Description" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
        <SearchableSelect label="Category" options={data.categories.item.map(c => ({ id: c, name: c }))} value={form.category} onChange={v => setForm({...form, category: v})} />
        <div className="grid grid-cols-2 gap-4">
          <select className="p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option>Goods</option><option>Service</option><option>Expense Item</option>
          </select>
          <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Unit" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Sale Price" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} />
          <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Buy Price" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
        </div>
        <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Opening Stock" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} />
        <button onClick={() => saveRecord('items', form, 'item')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Item</button>
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