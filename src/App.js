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
  Clock
} from 'lucide-react';

/** * SMEES Pro - Final Centralized Version
 * Backend: Firebase Firestore
 * Features: Real-time Sync, PDF Print, Dashboard, Enhanced UI/UX
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
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
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
                className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
                onClick={() => { onChange(id); setIsOpen(false); setSearchTerm(''); }}
              >
                {name} <span className="text-xs text-gray-400 ml-2">({id || 'N/A'})</span>
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

  // --- FIREBASE FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const newData = { ...INITIAL_DATA };
        
        // Fetch All Collections
        const collections = ['parties', 'items', 'staff', 'transactions', 'tasks'];
        for (const col of collections) {
            const querySnapshot = await getDocs(collection(db, col));
            newData[col] = querySnapshot.docs.map(doc => doc.data());
        }

        // Fetch Settings (Company & Counters)
        const companySnap = await getDocs(collection(db, "settings"));
        companySnap.forEach(doc => {
            if (doc.id === 'company') newData.company = doc.data();
            if (doc.id === 'counters') newData.counters = doc.data();
        });

        // Use fetched counters or fallback
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
    
    const totalPaid = basic.paid + linkedAmount;
    const pending = basic.final - totalPaid;
    
    let status = 'UNPAID';
    if (totalPaid >= basic.final - 0.1) status = 'PAID'; 
    else if (totalPaid > 0) status = 'PARTIAL';
    
    return { ...basic, totalPaid, pending, status };
  };

  // --- SAVE TO FIRESTORE ---
  const saveRecord = async (collectionName, record, idType) => {
    let newData = { ...data };
    let syncedRecord = null;
    let isUpdate = !!record.id;
    let finalId = record.id;
    let newCounters = null;

    if (record.id) {
      // Update Local
      newData[collectionName] = data[collectionName].map(r => r.id === record.id ? record : r);
      
      // Task Conversion Logic
      if (collectionName === 'transactions' && record.type === 'sales' && record.convertedFromTask) {
         const task = newData.tasks.find(t => t.id === record.convertedFromTask);
         if (task) {
            task.itemsUsed = record.items.map(i => ({ 
               itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice 
            }));
            newData.tasks = newData.tasks.map(t => t.id === task.id ? task : t);
            // Sync Task update to Firestore
            await setDoc(doc(db, "tasks", task.id), task);
         }
      }
      syncedRecord = record;
    } else {
      // Create Local
      const { id, nextCounters } = getNextId(data, idType, record.type);
      const createdField = collectionName === 'tasks' ? { taskCreatedAt: new Date().toISOString() } : {};
      syncedRecord = { ...record, id, createdAt: new Date().toISOString(), ...createdField };
      newData[collectionName] = [...data[collectionName], syncedRecord];
      newData.counters = nextCounters; 
      newCounters = nextCounters;
      finalId = id;
    }

    // Optimistic UI Update
    setData(newData);
    setModal({ type: null, data: null });
    showToast(isUpdate ? "Updated successfully" : "Created successfully");

    // Sync to Firestore
    try {
        // Save the Record
        await setDoc(doc(db, collectionName, finalId.toString()), syncedRecord);
        
        // Save Counters if new
        if (newCounters) {
            await setDoc(doc(db, "settings", "counters"), newCounters);
        }
        
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
      try {
          await setDoc(doc(db, "settings", "company"), companyData);
          showToast("Settings saved");
      } catch (e) {
          console.error(e);
          showToast("Error saving settings", "error");
      }
  };

  const deleteRecord = async (collectionName, id) => {
    // PROTECTED DELETE LOGIC
    if (collectionName === 'items') {
        const isUsed = data.transactions.some(t => t.items?.some(i => i.itemId === id));
        if (isUsed) {
            alert("Cannot delete: Item is used in transactions.");
            setConfirmDelete(null);
            return;
        }
    }
    if (collectionName === 'parties') {
        const isUsed = data.transactions.some(t => t.partyId === id);
        if (isUsed) {
            alert("Cannot delete: Party is used in transactions.");
            setConfirmDelete(null);
            return;
        }
    }

    // 1. UPDATE LOCAL STATE IMMEDIATELY (OPTIMISTIC)
    setData(prev => ({
      ...prev,
      [collectionName]: prev[collectionName].filter(r => r.id !== id)
    }));
    
    setConfirmDelete(null);
    setModal({ type: null, data: null });
    showToast("Record deleted");

    // 2. DELETE FROM FIRESTORE
    try {
        await deleteDoc(doc(db, collectionName, id.toString()));
    } catch (e) {
        console.error("Firestore Delete Error: ", e);
        showToast("Error deleting from cloud", "error");
    }
  };

  const handleConvertTask = async () => {
    const task = convertModal;
    if(!task) return;

    const saleItems = (task.itemsUsed || []).map(i => ({
        itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice || 0
    }));

    const gross = saleItems.reduce((acc, i) => acc + (parseFloat(i.qty)*parseFloat(i.price)), 0);
    const saleDate = document.getElementById('convert_date')?.value || new Date().toISOString().split('T')[0];
    const received = parseFloat(document.getElementById('convert_received')?.value || 0);
    const mode = document.getElementById('convert_mode')?.value || 'Cash';

    const newSale = {
        type: 'sales',
        date: saleDate,
        partyId: task.partyId,
        items: saleItems,
        discountType: '%',
        discountValue: 0,
        received: received, 
        paymentMode: mode,
        grossTotal: gross,
        finalTotal: gross, 
        convertedFromTask: task.id,
        description: `Converted from Task ${task.id}`
    };

    const saleId = await saveRecord('transactions', newSale, 'transaction');
    // UPDATED: Set status to 'Done' instead of 'Converted'
    const updatedTask = { ...task, status: 'Done', generatedSaleId: saleId };
    await saveRecord('tasks', updatedTask, 'task');

    setConvertModal(null);
    setViewDetail(null);
  };

  const printInvoice = (tx) => {
    const party = data.parties.find(p => p.id === tx.partyId);
    const content = `<html><body><h1>INVOICE ${tx.id}</h1><p>Date: ${tx.date}</p><p>Party: ${party?.name}</p></body></html>`; 
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
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
    const todaySales = data.transactions
      .filter(tx => tx.type === 'sales' && tx.date === today)
      .reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
    
    const totalExpenses = data.transactions
      .filter(tx => tx.type === 'expense')
      .reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);

    const pendingTasks = data.tasks.filter(t => t.status !== 'Done').length;
    const lowStockItems = data.items.filter(item => (itemStock[item.id] || 0) < 5);

    // NEW: Receivables and Payables
    let totalReceivables = 0;
    let totalPayables = 0;
    data.transactions.forEach(tx => {
       const { pending } = getBillLogic(tx);
       if (tx.type === 'sales') totalReceivables += pending;
       if (tx.type === 'purchase') totalPayables += pending;
    });

    return { 
        todaySales, totalExpenses, pendingTasks, 
        lowStockItems, 
        totalReceivables, totalPayables 
    };
  }, [data, itemStock]);

  const DetailView = () => {
    if (!viewDetail) return null;
    
    if (viewDetail.type === 'transaction') {
      const tx = data.transactions.find(t => t.id === viewDetail.id);
      if (!tx) return null;
      const party = data.parties.find(p => p.id === tx.partyId);
      const totals = getBillLogic(tx);

      let pnl = { service: 0, material: 0, expense: 0, total: 0 };
      (tx.items || []).forEach(item => {
        const itemMaster = data.items.find(i => i.id === item.itemId);
        const type = itemMaster?.type || 'Goods';
        const qty = parseFloat(item.qty || 0);
        const sell = parseFloat(item.price || 0);
        const buy = parseFloat(item.buyPrice || itemMaster?.buyPrice || 0);
        
        if (type === 'Service') {
          pnl.service += (sell * qty); // Service Revenue
        } else if (type === 'Goods') {
          pnl.material += ((sell - buy) * qty); // Gross Profit
        } else if (type === 'Expense Item') {
          pnl.expense -= (buy * qty); // Cost impact
        }
      });
      pnl.total = pnl.service + pnl.material + pnl.expense;

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={() => setViewDetail(null)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            <div className="flex gap-2">
               <button onClick={() => printInvoice(tx)} className="p-2 bg-blue-50 text-blue-600 rounded-full"><Share2 size={20}/></button>
               <button onClick={() => { setModal({ type: tx.type, data: tx }); setViewDetail(null); }} className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full">Edit</button>
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

            {tx.description && (
              <div className="bg-white p-4 rounded-2xl border">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{tx.description}</p>
              </div>
            )}

            {['sales'].includes(tx.type) && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Info size={16}/> Profit & Loss Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Service Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.service)}</span></div>
                  <div className="flex justify-between"><span>Material Profit</span><span className="font-bold text-green-600">{formatCurrency(pnl.material)}</span></div>
                  <div className="flex justify-between"><span>Expense Impact</span><span className="font-bold text-red-600">{formatCurrency(pnl.expense)}</span></div>
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
                     <div>
                       <p className="font-bold text-sm">{m?.name || 'Item'}</p>
                       <p className="text-xs text-gray-500">{item.qty} x {item.price}</p>
                       {m?.description && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{m.description}</p>}
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
        const assignedStaff = data.staff.find(s => s.id === task.assignedTo);

        const toggleTimer = (staffId) => {
            const now = new Date().toISOString();
            let newLogs = [...(task.timeLogs || [])];
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

            if (activeLogIndex >= 0) {
                const start = new Date(newLogs[activeLogIndex].start);
                const end = new Date(now);
                const duration = ((end - start) / 1000 / 60).toFixed(0); 
                newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration };
            } else {
                const staff = data.staff.find(s => s.id === staffId);
                newLogs.push({ staffId, staffName: staff?.name, start: now, end: null, duration: 0 });
            }
            const updatedTask = { ...task, timeLogs: newLogs };
            setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t) }));
            setDoc(doc(db, "tasks", updatedTask.id), updatedTask); // Auto save timer
        };

        const totalTime = (task.timeLogs || []).reduce((acc, log) => acc + (parseFloat(log.duration) || 0), 0);

        const updateTaskItems = (newItems) => {
            const updated = { ...task, itemsUsed: newItems };
            setData(prev => ({ 
                ...prev, 
                tasks: prev.tasks.map(t => t.id === task.id ? updated : t) 
            }));
            setDoc(doc(db, "tasks", updated.id), updated); // Auto save items
        };

        return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
              <button onClick={() => setViewDetail(null)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
              <h2 className="font-bold text-lg">Task Details</h2>
              <button onClick={() => { setModal({ type: 'task', data: task }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <div className="flex justify-between items-start mb-2">
                        <h1 className="text-xl font-black text-gray-800">{task.name}</h1>
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{task.description}</p>
                    <p className="text-[10px] text-gray-400 mb-4">Created: {new Date(task.taskCreatedAt || task.createdAt || Date.now()).toLocaleString()}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                         <div>
                            <p className="font-bold text-gray-400 uppercase">Client</p>
                            <p className="font-bold text-gray-800">{party?.name || 'N/A'}</p>
                            <p className="text-gray-500">{party?.mobile}</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-400 uppercase">Assigned To</p>
                            <p className="font-bold text-gray-800 flex items-center gap-1">
                                <Users size={12}/> {assignedStaff?.name || 'Unassigned'}
                            </p>
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
                                    <button 
                                        onClick={() => toggleTimer(s.id)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                                    >
                                        {isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {(task.timeLogs || []).map((log, i) => (
                            <div key={i} className="flex justify-between text-[10px] text-gray-600 border-b border-blue-100 pb-1">
                                <span>{log.staffName}</span>
                                <span>{new Date(log.start).toLocaleTimeString()} - {log.end ? new Date(log.end).toLocaleTimeString() : 'Running...'}</span>
                                <span className="font-bold">{log.duration}m</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold flex items-center gap-2 text-gray-700"><ShoppingCart size={18}/> Items Used</h3>
                        {task.status !== 'Converted' && (
                             <></>
                        )}
                         {/* UPDATED: Add Item via SearchableSelect */}
                         {task.status !== 'Converted' && (
                             <div className="w-40">
                                 <SearchableSelect 
                                     placeholder="+ Add Item"
                                     options={data.items} 
                                     value=""
                                     onChange={(val) => {
                                         if(val) {
                                            const item = data.items.find(i=>i.id===val);
                                            updateTaskItems([...(task.itemsUsed || []), { 
                                                itemId: val, 
                                                qty: 1, 
                                                price: item?.sellPrice || 0, 
                                                buyPrice: item?.buyPrice || 0 
                                            }]);
                                         }
                                     }}
                                     onAddNew={() => setModal({ type: 'item' })}
                                 />
                             </div>
                         )}
                    </div>
                    
                    <div className="space-y-2">
                        {(task.itemsUsed || []).map((item, idx) => {
                            const itemDetails = data.items.find(i => i.id === item.itemId);
                            return (
                                <div key={idx} className="p-3 border rounded-xl bg-white flex justify-between items-center text-sm">
                                    {task.status === 'Converted' ? (
                                        <div className="flex-1">
                                            <p className="font-bold">{itemDetails?.name || 'Unknown Item'}</p>
                                            <p className="text-xs text-gray-500">{item.qty} x {formatCurrency(item.price)}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 space-y-1">
                                                <div className="-mb-3">
                                                    <p className="text-xs font-bold text-gray-700 mb-1">{itemDetails?.name}</p>
                                                </div>
                                                <div className="flex gap-2 relative z-0">
                                                    <input 
                                                        type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty"
                                                        value={item.qty}
                                                        onChange={(e) => {
                                                            const newItems = [...task.itemsUsed];
                                                            newItems[idx].qty = e.target.value;
                                                            updateTaskItems(newItems);
                                                        }}
                                                    />
                                                    <input 
                                                        type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale"
                                                        value={item.price}
                                                        onChange={(e) => {
                                                            const newItems = [...task.itemsUsed];
                                                            newItems[idx].price = e.target.value;
                                                            updateTaskItems(newItems);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => updateTaskItems(task.itemsUsed.filter((_, i) => i !== idx))}
                                                className="ml-2 text-red-500 p-1"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {(!task.itemsUsed || task.itemsUsed.length === 0) && <p className="text-xs text-gray-400 italic">No items added yet.</p>}
                    </div>
                </div>

                {task.status !== 'Converted' && (task.itemsUsed && task.itemsUsed.length > 0) && (
                    <div className="pt-4 border-t">
                        <button 
                            onClick={() => setConvertModal(task)}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                        >
                            <ReceiptText size={18}/> Convert to Sale
                        </button>
                    </div>
                )}
                {task.status === 'Converted' && task.generatedSaleId && (
                    <div className="pt-4 border-t text-center">
                        <p className="text-xs font-bold text-green-600 flex items-center justify-center gap-1"><CheckCircle2 size={14}/> Linked to Sale #{task.generatedSaleId}</p>
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

    return (
      <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
          <button onClick={() => setViewDetail(null)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
          <h2 className="font-bold text-lg">{record.name}</h2>
          <div className="flex gap-2">
             <button onClick={() => { setModal({ type: isItem ? 'item' : 'party', data: record }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
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
            {isItem && (
              <div className="p-4 bg-gray-50 rounded-2xl border">
                 <p className="text-[10px] font-bold text-gray-400 uppercase">Prices</p>
                 <p className="text-sm font-bold">Sell: {formatCurrency(record.sellPrice)}</p>
                 <p className="text-sm text-gray-500">Buy: {formatCurrency(record.buyPrice)}</p>
              </div>
            )}
            {!isItem && (
               <div className="p-4 bg-gray-50 rounded-2xl border">
                 <p className="text-[10px] font-bold text-gray-400 uppercase">Contact</p>
                 <p className="text-sm font-bold truncate">{record.mobile}</p>
                 <p className="text-xs text-gray-500 truncate">{record.address}</p>
               </div>
            )}
          </div>
          
          {isItem && record.description && (
             <div className="bg-gray-50 p-4 rounded-2xl border">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Description</p>
                <p className="text-sm text-gray-700">{record.description}</p>
             </div>
          )}
          
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-gray-700"><History size={18}/> Transaction History</h3>
            {history.length === 0 ? <p className="text-gray-400 text-sm">No transactions found</p> : history.map(tx => {
              const t = getBillLogic(tx);
              return (
                <div 
                  key={tx.id} 
                  onClick={() => setViewDetail({ type: 'transaction', id: tx.id })}
                  className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-sm">{tx.id} • {formatDate(tx.date)}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400">{tx.type} • {tx.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(tx.amount || t.final)}</p>
                    <div className="flex justify-end gap-1 mt-1">
                        {['sales','purchase'].includes(tx.type) && (
                           <button onClick={(e) => { e.stopPropagation(); printInvoice(tx); }} className="text-gray-400 hover:text-blue-600"><Printer size={12}/></button>
                        )}
                        {['sales','purchase'].includes(tx.type) && (
                           <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${t.status === 'PAID' ? 'bg-green-100 text-green-600' : t.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                             {t.status}
                           </span>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1>
          <p className="text-sm text-gray-500">FY {data.company.financialYear}</p>
        </div>
        <button onClick={() => setModal({ type: 'company' })} className="p-2 bg-gray-100 rounded-xl">
          <Settings className="text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* NEW: Receivables and Payables */}
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
           <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
           <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
           <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
           <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
          <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
          <p className="text-xl font-bold text-green-900">{formatCurrency(stats.todaySales)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-xs font-bold text-red-600 uppercase">Expenses</p>
          <p className="text-xl font-bold text-red-900">{formatCurrency(stats.totalExpenses)}</p>
        </div>
      </div>
      
      {/* Removed Low Stock Alert Section as requested */}

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Sale', icon: <TrendingUp />, type: 'sales', color: 'bg-green-100 text-green-700' },
            { label: 'Purchase', icon: <ShoppingCart />, type: 'purchase', color: 'bg-blue-100 text-blue-700' },
            { label: 'Expense', icon: <ReceiptText />, type: 'expense', color: 'bg-red-100 text-red-700' },
            { label: 'Payment', icon: <Banknote />, type: 'payment', color: 'bg-purple-100 text-purple-700' }
          ].map(action => (
            <button 
              key={action.label}
              onClick={() => setModal({ type: action.type })}
              className="flex flex-col items-center gap-2"
            >
              <div className={`p-4 rounded-2xl ${action.color}`}>{action.icon}</div>
              <span className="text-xs font-medium text-gray-600">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const MasterList = ({ title, collection, type, idKey, fields, onRowClick }) => {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]); // NEW: Bulk Delete State
    
    const filtered = data[collection].filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
    );

    const toggleSelect = (id) => {
        if(selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id));
        else setSelectedIds([...selectedIds, id]);
    };
    
    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length && filtered.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(i => i.id));
        }
    };
    
    // UPDATED: Bulk Delete Logic
    const handleBulkDelete = async () => {
        if(!window.confirm(`Delete ${selectedIds.length} records?`)) return;
        
        const idsToDelete = [...selectedIds];
        setSelectedIds([]); // Clear Selection immediately
        
        // Optimistic Update
        setData(prev => ({
            ...prev,
            [collection]: prev[collection].filter(item => !idsToDelete.includes(item.id))
        }));
        showToast(`${idsToDelete.length} records deleted`);

        // Update Firestore in background
        try {
            const deletePromises = idsToDelete.map(id => deleteDoc(doc(db, collection, id.toString())));
            await Promise.all(deletePromises);
        } catch (e) {
            console.error("Bulk delete error", e);
            showToast("Error syncing deletions to cloud", "error");
        }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
              <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
              />
              <h1 className="text-xl font-bold">{title}</h1>
          </div>
          <div className="flex gap-2">
              {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-xl flex items-center gap-1 text-sm px-4 font-bold">
                      <Trash2 size={16}/> Delete ({selectedIds.length})
                  </button>
              )}
              <button 
                onClick={() => setModal({ type })}
                className="p-2 bg-blue-600 text-white rounded-xl flex items-center gap-1 text-sm px-4"
              >
                <Plus size={18} /> Add
              </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
            placeholder={`Search ${title}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          {filtered.map(item => (
            <div 
              key={item.id}
              className={`p-3 bg-white border rounded-2xl flex items-center gap-3 active:scale-95 transition-transform ${selectedIds.includes(item.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : ''}`}
            >
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
              <div className="flex-1" onClick={() => onRowClick ? onRowClick(item) : setModal({ type, data: item })}>
                <p className="font-bold text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">{item.id} • {item.category || item.mobile || item.role}</p>
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
    const [filter, setFilter] = useState('all');
    const filtered = data.transactions
      .filter(tx => filter === 'all' || tx.type === filter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Accounting</h1>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-2 bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-1 text-gray-600">
               <Share2 size={14} /> PDF
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'purchase', 'expense', 'payment'].map(t => (
            <button 
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            const totals = getBillLogic(tx);
            
            // Icon Selection
            let Icon = ReceiptText;
            let iconColor = 'text-gray-600';
            let bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
            if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }

            return (
              <div 
                key={tx.id}
                onClick={() => setViewDetail({ type: 'transaction', id: tx.id })}
                className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform"
              >
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-full ${bg} ${iconColor}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
                    
                    {/* NEW: Tags for Transactions */}
                    <div className="flex gap-1 mt-1">
                        {/* Status for Sales/Purchase/Expense */}
                        {['sales', 'purchase', 'expense'].includes(tx.type) && (
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${totals.status === 'PAID' ? 'bg-green-100 text-green-700' : totals.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {totals.status}
                            </span>
                        )}

                        {/* Status for Payments */}
                        {tx.type === 'payment' && (
                            <>
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${isIncoming ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isIncoming ? 'PAYMENT IN' : 'PAYMENT OUT'}
                                </span>
                                <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-gray-100 text-gray-600">
                                    {(() => {
                                        const totalAmt = parseFloat(tx.amount || 0);
                                        const linkedAmt = (tx.linkedBills || []).reduce((acc, l) => acc + parseFloat(l.amount || 0), 0);
                                        if (linkedAmt >= totalAmt - 0.1 && totalAmt > 0) return 'USED';
                                        if (linkedAmt > 0) return 'PARTIAL';
                                        return 'UNUSED';
                                    })()}
                                </span>
                            </>
                        )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncoming ? '+' : '-'}{formatCurrency(totals.amount)}
                  </p>
                  {/* NEW: Balance Due Display */}
                  {['sales', 'purchase'].includes(tx.type) && totals.status !== 'PAID' && (
                      <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(totals.pending)}</p>
                  )}
                  
                  <div className="flex justify-end gap-1 mt-1">
                     <button onClick={(e) => { e.stopPropagation(); printInvoice(tx); }} className="text-gray-400 hover:text-blue-600"><Share2 size={12}/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const TaskModule = () => {
    const pending = data.tasks.filter(t => t.status !== 'Done' && t.status !== 'Converted');
    const done = data.tasks.filter(t => t.status === 'Done' || t.status === 'Converted');

    const TaskItem = ({ task }) => (
      <div 
        onClick={() => setViewDetail({ type: 'task', id: task.id })}
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
          <button onClick={() => setModal({ type: 'task' })} className="p-2 bg-blue-600 text-white rounded-xl"><Plus /></button>
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

  const PartyForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', mobile: '', email: '', openingBal: 0, type: 'CR', address: '', location: '', reference: '' });
    
    const handleSave = () => {
      if (!form.name) return;
      if (!record && data.parties.some(p => p.name.toLowerCase() === form.name.toLowerCase())) {
        alert("Party name already exists!");
        return;
      }
      saveRecord('parties', form, 'party');
    };

    return (
      <div className="space-y-4">
        {form.id && <p className="text-xs font-bold text-gray-400 uppercase">ID: {form.id}</p>}
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Party Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
          <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="flex gap-2 items-center">
          <input className="flex-1 p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Opening Balance" value={form.openingBal} onChange={e => setForm({...form, openingBal: e.target.value})} />
          <select className="p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="CR">CR</option>
            <option value="DR">DR</option>
          </select>
        </div>
        <SearchableSelect label="Reference" options={data.parties} value={form.reference} onChange={v => setForm({...form, reference: v})} />
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">Save Party</button>
          {record && <button onClick={() => setConfirmDelete({ collection: 'parties', id: record.id })} className="p-4 bg-red-100 text-red-600 rounded-xl"><Trash2 /></button>}
        </div>
      </div>
    );
  };

  const ItemForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', unit: 'PCS', sellPrice: 0, buyPrice: 0, category: 'General', type: 'Goods', openingStock: 0, description: '' });

    const handleSave = () => {
      if (!form.name || !form.category) {
        alert("Item Name and Category are required!");
        return;
      }
      if (!record && data.items.some(i => i.name.toLowerCase() === form.name.toLowerCase())) {
        alert("Item name already exists!");
        return;
      }
      saveRecord('items', form, 'item');
    };

    return (
      <div className="space-y-4">
        {form.id && <p className="text-xs font-bold text-gray-400 uppercase">ID: {form.id}</p>}
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Item Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        
        {/* ADDED: Description Field */}
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-20" placeholder="Item Description (Optional)" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />

        <SearchableSelect 
          label="Category" 
          options={data.categories.item.map(c => ({ id: c, name: c }))} 
          value={form.category} 
          onChange={v => setForm({...form, category: v})} 
          onAddNew={() => {
            const name = prompt("New Item Category:");
            if (name && !data.categories.item.includes(name)) {
              setData(prev => ({ ...prev, categories: { ...prev.categories, item: [...prev.categories.item, name] } }));
            }
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          <select className="p-3 bg-gray-50 border rounded-xl" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option>Goods</option>
            <option>Service</option>
            <option>Expense Item</option>
          </select>
          <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Unit (e.g. PCS, KG)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 ml-2">Sale Price</label>
            <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 ml-2">Purchase Price</label>
            <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 ml-2">Opening Stock</label>
          <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} />
        </div>
        
        <div className="flex gap-2 pt-4">
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">Save Item</button>
          {record && <button onClick={() => setConfirmDelete({ collection: 'items', id: record.id })} className="p-4 bg-red-100 text-red-600 rounded-xl"><Trash2 /></button>}
        </div>
      </div>
    );
  };

  const TransactionForm = ({ type, record }) => {
    const isEdit = !!record;
    
    // Initialize State
    const [tx, setTx] = useState(() => {
      if (record) {
        return {
          ...record,
          linkedBills: record.linkedBills || [], 
          items: record.items || [],
          description: record.description || ''
        };
      }
      return {
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
      };
    });

    const [showLinking, setShowLinking] = useState(false);

    const totals = getTransactionTotals(tx);

    // Filter unpaid/partially paid bills for this party
    const unpaidBills = useMemo(() => {
      if (!tx.partyId) return [];
      return data.transactions.filter(t => 
        t.partyId === tx.partyId && 
        ['sales', 'purchase', 'expense'].includes(t.type) &&
        (getBillLogic(t).status !== 'PAID' || tx.linkedBills.some(l => l.billId === t.id))
      );
    }, [tx.partyId, data.transactions, tx.linkedBills]);

    const addLineItem = () => {
      setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]});
    };

    const updateLine = (idx, field, val) => {
      const newItems = [...tx.items];
      newItems[idx][field] = val;
      if (field === 'itemId') {
        const item = data.items.find(i => i.id === val);
        newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice;
        newItems[idx].buyPrice = item.buyPrice;
      }
      setTx({...tx, items: newItems});
    };

    const handleSave = () => {
      if (!tx.partyId && type !== 'expense') return alert("Select Party");
      saveRecord('transactions', { ...tx, ...totals }, 'transaction');
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

        {type === 'expense' && (
          <SearchableSelect 
            label="Category" 
            options={data.categories.expense.map(c => ({ id: c.name || c, name: c.name || c }))} 
            value={tx.category} 
            onChange={v => setTx({...tx, category: v})} 
            onAddNew={() => {
              const name = prompt("New Category Name:");
              if (name) {
                 const expenseType = window.confirm("Is this a DIRECT Expense? OK for Direct, Cancel for Indirect") ? "Direct" : "Indirect";
                 const newCat = { name, type: expenseType };
                 setData(prev => ({ ...prev, categories: { ...prev.categories, expense: [...prev.categories.expense, newCat] } }));
                 setTx(prev => ({ ...prev, category: name }));
              }
            }}
          />
        )}

        <SearchableSelect 
          label="Party" 
          options={data.parties} 
          value={tx.partyId} 
          onChange={v => setTx({...tx, partyId: v})} 
          onAddNew={() => setModal({ type: 'party' })}
        />

        {type !== 'payment' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-gray-400 uppercase">Items</h4>
              <button onClick={addLineItem} className="text-blue-600 text-xs font-bold">+ Add Item</button>
            </div>
            {tx.items.map((line, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border rounded-xl relative">
                <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12} /></button>
                <SearchableSelect 
                  label="Select Item" 
                  options={data.items} 
                  value={line.itemId} 
                  onChange={v => updateLine(idx, 'itemId', v)} 
                  onAddNew={() => setModal({ type: 'item' })}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <input type="number" className="w-full p-2 border rounded-lg text-sm" value={line.qty} placeholder="Qty" onChange={e => updateLine(idx, 'qty', e.target.value)} />
                  <input type="number" className="w-full p-2 border rounded-lg text-sm" value={line.price} placeholder="Price" onChange={e => updateLine(idx, 'price', e.target.value)} />
                  {type === 'sales' && (
                    <input type="number" className="w-full p-2 border rounded-lg text-sm bg-yellow-50" value={line.buyPrice || 0} placeholder="Buy Price" onChange={e => updateLine(idx, 'buyPrice', e.target.value)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {type !== 'payment' ? (
            <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <select className="p-2 text-xs border rounded-lg" value={tx.discountType} onChange={e => setTx({...tx, discountType: e.target.value})}><option>%</option><option>Amt</option></select>
                <input type="number" className="flex-1 p-2 border rounded-lg text-xs" placeholder="Discount" value={tx.discountValue || ''} onChange={e => setTx({...tx, discountValue: e.target.value})} />
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span><span>{formatCurrency(totals.final)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  className="flex-1 p-3 border rounded-xl font-bold text-green-600" 
                  placeholder={type === 'sales' ? "Received Amt" : "Paid Amt"} 
                  value={(type === 'sales' ? tx.received : tx.paid) || ''} 
                  onChange={e => setTx({...tx, [type === 'sales' ? 'received' : 'paid']: e.target.value})} 
                />
                <select className="p-3 border rounded-xl text-xs" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}>
                  <option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option>
                </select>
              </div>
            </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <label className="text-xs font-bold text-blue-600 uppercase">Amount</label>
              <input type="number" className="w-full bg-transparent text-2xl font-bold focus:ring-0 border-none p-0" placeholder="0.00" value={tx.amount || ''} onChange={e => setTx({...tx, amount: e.target.value, finalTotal: e.target.value})} />
            </div>
            
             <div className="flex gap-2">
                 {(() => {
                     const used = tx.linkedBills?.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;
                     const total = parseFloat(tx.amount || 0);
                     let status = 'UNUSED';
                     if (used >= total - 0.1 && total > 0) status = 'FULLY USED';
                     else if (used > 0) status = 'PARTIALLY USED';
                     return <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-500">Status: {status}</span>;
                 })()}
             </div>

            <button onClick={() => setShowLinking(!showLinking)} className="w-full p-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">
              {showLinking ? "Hide Bill Linking" : "Link Bills (Advanced)"}
            </button>

            {showLinking && (
              <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-xl">
                {unpaidBills.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">No unpaid bills found</p> : 
                  unpaidBills.map(bill => {
                    const bt = getBillLogic(bill);
                    const link = tx.linkedBills?.find(l => l.billId === bill.id);
                    return (
                      <div key={bill.id} className="flex justify-between items-center p-2 border-b last:border-0">
                        <div className="text-[10px]">
                          <p className="font-bold">{bill.id}</p>
                          <p>{formatDate(bill.date)} • Bal: {formatCurrency(bt.pending)}</p>
                        </div>
                        <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Amt" value={link?.amount || ''} 
                          onChange={e => {
                            const others = tx.linkedBills?.filter(l => l.billId !== bill.id) || [];
                            setTx({...tx, linkedBills: [...others, { billId: bill.id, amount: e.target.value }]});
                          }} 
                        />
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        )}

        {/* MOVED: Description to bottom */}
        <textarea 
          className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-16 resize-none" 
          placeholder="Description / Notes (Optional)" 
          value={tx.description || ''} 
          onChange={e => setTx({...tx, description: e.target.value})} 
        />

        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">Save Transaction</button>
          {isEdit && <button onClick={() => setConfirmDelete({ collection: 'transactions', id: record.id })} className="p-4 bg-red-100 text-red-600 rounded-xl"><Trash2 /></button>}
        </div>
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
    const [form, setForm] = useState(record || { name: '', partyId: '', description: '', status: 'To Do', dueDate: '', assignedStaff: [], assignedTo: '' });
    const party = data.parties.find(p => p.id === form.partyId);

    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        
        <SearchableSelect 
          label="Assign To (Optional)" 
          options={data.staff} 
          value={form.assignedTo} 
          onChange={v => setForm({...form, assignedTo: v})} 
        />

        <SearchableSelect 
          label="Related Party" 
          options={data.parties} 
          value={form.partyId} 
          onChange={v => setForm({...form, partyId: v})} 
        />
        {party && (
          <div className="p-3 bg-blue-50 rounded-xl text-xs space-y-1">
            <p className="flex items-center gap-2"><Phone size={12}/> {party.mobile}</p>
            <p className="flex items-center gap-2"><MapPin size={12}/> {party.address}</p>
          </div>
        )}
        <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-24" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 ml-2">Due Date</label>
            <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 ml-2">Status</label>
            <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option>To Do</option>
              <option>In Progress</option>
              <option>Done</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => saveRecord('tasks', form, 'task')} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
          {record && <button onClick={() => setConfirmDelete({ collection: 'tasks', id: record.id })} className="p-4 bg-red-100 text-red-600 rounded-xl"><Trash2 /></button>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Detail View */}
      <DetailView />

      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div>
          <span className="font-black text-gray-800 tracking-tight">SMEES Pro</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab('accounting')} className="p-2 hover:bg-gray-100 rounded-full"><Search size={20} className="text-gray-500" /></button>
          <button onClick={() => setModal({ type: 'company' })} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm font-bold">Syncing Data...</p>
            </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'accounting' && <TransactionList />}
            {activeTab === 'tasks' && <TaskModule />}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                
                {/* NEW: Masters Sub-Navigation */}
                {mastersView === null ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setMastersView('items')} className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors">
                            <Package size={32} className="text-blue-600"/>
                            <span className="font-bold text-blue-800">Manage Items</span>
                        </button>
                        <button onClick={() => setMastersView('parties')} className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-100 transition-colors">
                            <Users size={32} className="text-emerald-600"/>
                            <span className="font-bold text-emerald-800">Manage Parties</span>
                        </button>
                        <button onClick={() => setMastersView('staff')} className="p-6 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-purple-100 transition-colors">
                            <Briefcase size={32} className="text-purple-600"/>
                            <span className="font-bold text-purple-800">Manage Staff</span>
                        </button>
                    </div>
                ) : (
                    <div>
                        <button onClick={() => setMastersView(null)} className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800">
                            <ArrowLeft size={18}/> Back to Menu
                        </button>
                        
                        {mastersView === 'items' && (
                            <MasterList 
                              title="Items" 
                              collection="items" 
                              type="item" 
                              onRowClick={(item) => setViewDetail({type: 'item', id: item.id})} 
                            />
                        )}
                        {mastersView === 'parties' && (
                            <MasterList 
                              title="Parties" 
                              collection="parties" 
                              type="party" 
                              onRowClick={(item) => setViewDetail({type: 'party', id: item.id})} 
                            />
                        )}
                        {mastersView === 'staff' && (
                            <MasterList title="Staff" collection="staff" type="staff" />
                        )}
                    </div>
                )}
                
                {mastersView === null && (
                    <div className="p-6 bg-white border rounded-2xl">
                      <h2 className="font-bold mb-4">Backup & Export</h2>
                      <div className="flex gap-4">
                        <button onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
                          const downloadAnchorNode = document.createElement('a');
                          downloadAnchorNode.setAttribute("href", dataStr);
                          downloadAnchorNode.setAttribute("download", "erp_backup.json");
                          document.body.appendChild(downloadAnchorNode);
                          downloadAnchorNode.click();
                          downloadAnchorNode.remove();
                        }} className="flex-1 p-4 bg-gray-100 rounded-xl font-bold flex flex-col items-center gap-2 text-xs">
                           Export Full Backup
                        </button>
                      </div>
                    </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-2 flex justify-between items-center z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', icon: <LayoutDashboard />, label: 'Home' },
          { id: 'accounting', icon: <ReceiptText />, label: 'Accounts' },
          { id: 'tasks', icon: <CheckSquare />, label: 'Tasks' },
          { id: 'staff', icon: <Users />, label: 'Masters' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Modals Container */}
      <Modal 
        isOpen={!!modal.type} 
        onClose={() => setModal({ type: null, data: null })} 
        title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}
      >
        {modal.type === 'company' && <CompanyForm />}
        {modal.type === 'party' && <PartyForm record={modal.data} />}
        {modal.type === 'item' && <ItemForm record={modal.data} />}
        {modal.type === 'staff' && <StaffForm record={modal.data} />}
        {modal.type === 'task' && <TaskForm record={modal.data} />}
        {['sales', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} />}
      </Modal>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-xs text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Are you sure?</h3>
            <p className="text-gray-500 text-sm mb-6">This record will be permanently deleted from the database.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 p-3 font-bold text-gray-500 bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={() => deleteRecord(confirmDelete.collection, confirmDelete.id)} className="flex-1 p-3 font-bold text-white bg-red-600 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDED: Convert Task Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
             <h3 className="font-bold text-lg mb-4">Convert to Sale</h3>
             <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-500">Sale Date</label>
                  <input type="date" id="convert_date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded-xl font-bold text-blue-600"/>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500">Received Amount</label>
                  <input type="number" id="convert_received" className="w-full p-2 border rounded-xl" placeholder="0.00"/>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500">Payment Mode</label>
                  <select id="convert_mode" className="w-full p-2 border rounded-xl">
                    <option>Cash</option><option>UPI</option><option>Bank</option>
                  </select>
               </div>
               <div className="flex gap-3 pt-2">
                  <button onClick={() => setConvertModal(null)} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-gray-500">Cancel</button>
                  <button onClick={handleConvertTask} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Confirm Sale</button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}