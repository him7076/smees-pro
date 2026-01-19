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
  limit, 
  onSnapshot, 
  enableIndexedDbPersistence, 
  startAfter
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
  Map as MapIcon, 
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
    item: ["Electronics", "Grocery", "General", "Furniture", "Pharmacy"],
    taskStatus: ["To Do", "In Progress", "Done"]
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
  // 1. CANCELLED CHECK: Agar Cancelled hai to sab 0 return karega. 
  // Isse Party Balance, Stock, Sales, Cash/Bank sab jagah value 0 ho jayegi automatically.
  if (tx.status === 'Cancelled') return { gross: 0, final: 0, paid: 0, status: 'CANCELLED', amount: 0, roundOff: 0 };

  const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
  
  let discVal = parseFloat(tx.discountValue || 0);
  if (tx.discountType === '%') discVal = (gross * discVal) / 100;
  
  // 2. ROUND OFF LOGIC ADDED
  const roundOff = parseFloat(tx.roundOff || 0); 
  
  // Final = Gross - Discount + Round Off
  const final = gross - discVal + roundOff;
  
  const paid = parseFloat(tx.received || tx.paid || 0);
  
  let status = 'UNPAID';
  if (paid >= final - 0.1 && final > 0) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';

  return { gross, final, paid, status, amount: parseFloat(tx.amount || 0) || final, roundOff };
};

// --- FIX: Logic updated for Bidirectional Linking ---
const getBillStats = (bill, transactions) => {
    if (bill.type === 'estimate') return { ...getTransactionTotals(bill), status: 'ESTIMATE', pending: 0, paid: 0 };
    
    const basic = getTransactionTotals(bill);

    // 1. EXTERNAL LINKS: Koi Payment jo is Bill ko point kar raha ho
    const linkedFromPayments = transactions
        .filter(t => t.type === 'payment' && t.linkedBills && t.status !== 'Cancelled')
        .reduce((sum, p) => {
             const link = p.linkedBills.find(l => l.billId === bill.id);
             return sum + (link ? parseFloat(link.amount || 0) : 0);
        }, 0);

    // 2. INTERNAL LINKS: Agar Bill khud kisi Payment ko point kar raha ho (Reverse Link)
    // Ye sales/purchase/expense me kaam karega jo aapne "Link Bills" feature add kiya hai
    const linkedToPayments = (bill.linkedBills || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

    // --- PAYMENT STATUS LOGIC ---
    let status = 'UNPAID';
    if(bill.type === 'payment') {
         // Payment ke case me 'linkedToPayments' wo hai jo Payment ne bills ko settle kiya
         // Aur 'linkedFromPayments' wo hai jo Bills ne is Payment ko use kiya (Reverse)
         
         const usedInternal = linkedToPayments;
         
         // Check karo ki koi Sale/Purchase is payment ko use kar rhi h kya
         const usedExternal = transactions
            .filter(t => ['sales', 'purchase', 'expense'].includes(t.type) && t.status !== 'Cancelled' && t.linkedBills)
            .reduce((sum, t) => {
                const link = t.linkedBills.find(l => l.billId === bill.id);
                return sum + (link ? parseFloat(link.amount || 0) : 0);
            }, 0);

         const totalUsed = usedInternal + usedExternal;
         
         // Fix: Payment Available = Amount + Discount
         const payAmt = parseFloat(bill.amount || 0);
         const payDisc = parseFloat(bill.discountValue || 0);
         const totalAvailable = payAmt + payDisc;

         if (totalUsed >= totalAvailable - 0.1 && totalAvailable > 0) status = 'FULLY USED';
         else if (totalUsed > 0) status = 'PARTIALLY USED';
         else status = 'UNUSED';
         
         return { ...basic, used: totalUsed, status, totalAvailable }; 
    }

    // --- BILL (Sale/Purchase/Expense) STATUS LOGIC ---
    const totalPaid = basic.paid + linkedFromPayments + linkedToPayments;
    
    if (totalPaid >= basic.final - 0.1) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    
    return { ...basic, totalPaid, pending: basic.final - totalPaid, status };
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



const TransactionList = ({ searchQuery, setSearchQuery, dateRange, setDateRange, data, listFilter, listPaymentMode, categoryFilter, pushHistory, setViewDetail }) => {
    const [sort, setSort] = useState('DateDesc');
    const [filter, setFilter] = useState(listFilter);
    const [visibleCount, setVisibleCount] = useState(50); 
    
    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    let filtered = data.transactions.filter(tx => {
        if (filter !== 'all' && tx.type !== filter) return false;
        if (listPaymentMode && (tx.paymentMode || 'Cash') !== listPaymentMode) return false;
        if (categoryFilter && tx.category !== categoryFilter) return false;

        if (dateRange.start && tx.date < dateRange.start) return false;
        if (dateRange.end && tx.date > dateRange.end) return false;

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            const party = data.parties.find(p => p.id === tx.partyId);
            
            const matchVoucher = tx.id.toLowerCase().includes(lowerQuery);
            const matchName = (party?.name || tx.category || '').toLowerCase().includes(lowerQuery);
            const matchDesc = (tx.description || '').toLowerCase().includes(lowerQuery);
            const matchAddress = (party?.address || '').toLowerCase().includes(lowerQuery);
            const matchAmount = (tx.amount || tx.finalTotal || 0).toString().includes(lowerQuery);

            return matchVoucher || matchName || matchDesc || matchAddress || matchAmount;
        }

        return true;
    });

    const filteredTotal = filtered.reduce((acc, tx) => acc + parseFloat(tx.amount || tx.finalTotal || 0), 0);

    filtered = sortData(filtered, sort);
    const visibleData = filtered.slice(0, visibleCount);

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Accounting {categoryFilter && `(${categoryFilter})`}</h1>
              <div className="flex gap-2 items-center">
                  <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option><option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option></select>
              </div>
            </div>

            <div className="flex gap-2">
                <input type="date" className="w-1/2 p-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                <input type="date" className="w-1/2 p-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                    className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-blue-500" 
                    placeholder="Search Name, Address, Desc, Amount..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
            </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
            <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase">Filtered Total</p>
                <p className="text-lg font-black text-blue-800">{formatCurrency(filteredTotal)}</p>
            </div>
            <div className="bg-white px-3 py-1 rounded-lg text-xs font-bold text-blue-600 shadow-sm border border-blue-100">
                Count: {filtered.length}
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
  {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
    <button 
        key={t} 
        onClick={() => { 
            setFilter(t); // <--- YE MISSING THA
            setSearchQuery(''); 
        }} 
        className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
    >
        {t}
    </button>
  ))}
</div>

        <div className="space-y-3">
          {visibleData.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            const totals = getBillStats(tx, data.transactions);
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
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p>
                        {/* CHANGE: Party Link Icon */}
                        {party && (
                            <button onClick={(e) => { 
                                e.stopPropagation(); // Taki transaction na khule
                                setViewDetail({ type: 'party', id: party.id }); 
                            }} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                                <ExternalLink size={12}/>
                            </button>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
                    {searchQuery && tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase()) && (
                        <p className="text-[9px] text-gray-500 italic truncate max-w-[150px]">{tx.description}</p>
                    )}
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
                  {/* FIX #2: Add 'expense' here */}
{['sales', 'purchase', 'expense'].includes(tx.type) && totals.status !== 'PAID' && !isCancelled && <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(totals.pending)}</p>}
                  {tx.type === 'payment' && !isCancelled && unusedAmount > 0.1 && <p className="text-[10px] font-bold text-orange-600">Unused: {formatCurrency(unusedAmount)}</p>}
                </div>
              </div>
            );
          })}
          
          <div className="flex flex-col gap-2 mt-4">
            {visibleCount < filtered.length && (
                <button 
                    onClick={() => setVisibleCount(prev => prev + 50)} 
                    className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors"
                >
                    Load More Transactions ({filtered.length - visibleCount} remaining)
                </button>
            )}
          </div>
        </div>
      </div>
    );
};

const TaskModule = ({ data, user, pushHistory, setViewDetail, setModal, checkPermission }) => {
    // CHANGE (Point 6): LocalStorage se sort uthao
    const [sort, setSort] = useState(localStorage.getItem('smees_task_sort') || 'DateAsc');
    const [search, setSearch] = useState('');
    // CHANGE (Point 5): Default filter 'To Do' kar diya
    const [statusFilter, setStatusFilter] = useState('To Do');
    const [viewMode, setViewMode] = useState('tasks'); 

    // CHANGE (Point 6): Sort save karo
    useEffect(() => { localStorage.setItem('smees_task_sort', sort); }, [sort]);

    const definedStatuses = data.categories.taskStatus || ["To Do", "In Progress", "Done"];
    const filterOptions = ['All', ...definedStatuses];
    if (!filterOptions.includes('Converted')) filterOptions.push('Converted');

    const filteredTasks = data.tasks.filter(t => {
        const clientName = data.parties.find(p => p.id === t.partyId)?.name || '';
        const searchText = search.toLowerCase();
        const matchesSearch = t.name.toLowerCase().includes(searchText) || t.description.toLowerCase().includes(searchText) || clientName.toLowerCase().includes(searchText);
        if (!matchesSearch) return false;
        if (statusFilter !== 'All') return t.status === statusFilter;
        if (statusFilter === 'All' && t.status === 'Converted') return false;
        return true;
    });
    
    // CHANGE (Point 7): Custom Sorting Logic (No Due Date Last)
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        // Handle No Date (Put at bottom)
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);

        if (sort === 'DateAsc') return dateA - dateB;
        if (sort === 'DateDesc') return dateB - dateA;
        if (sort === 'A-Z') return a.name.localeCompare(b.name);
        return 0;
    });

    // CHANGE (Point 7): Group By Date Helper
    const groupTasksByDate = (tasks) => {
        if(sort === 'A-Z') return { 'All Tasks': tasks }; // A-Z me grouping mat karo

        const groups = {};
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tmrwStr = tomorrow.toISOString().split('T')[0];

        tasks.forEach(t => {
            let key = t.dueDate ? t.dueDate : 'No Due Date';
            if (t.dueDate === today) key = 'Today';
            else if (t.dueDate === tmrwStr) key = 'Tomorrow';
            else if (t.dueDate && t.dueDate < today) key = 'Overdue / Past';
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });
        return groups;
    };

    const groupedTasks = groupTasksByDate(sortedTasks);
    // Keys sort karne ka logic (Today pehle, No Due Date last)
    const sortedKeys = Object.keys(groupedTasks).sort((a,b) => {
        if(a === 'Today') return -1;
        if(b === 'Today') return 1;
        if(a === 'Tomorrow') return -1;
        if(b === 'Tomorrow') return 1;
        if(a === 'No Due Date') return 1;
        if(b === 'No Due Date') return -1;
        return a.localeCompare(b);
    });

    const upcomingAMC = useMemo(() => {
        if (viewMode !== 'amc') return [];
        const list = [];
        const today = new Date();
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + 45); 

        data.parties.forEach(p => {
            (p.assets || []).forEach(a => {
                if (a.nextServiceDate) {
                    const d = new Date(a.nextServiceDate);
                    if (d <= limitDate) {
                        list.push({ party: p, asset: a, date: a.nextServiceDate, isOverdue: d < today });
                    }
                }
            });
        });
        return list.sort((a,b) => new Date(a.date) - new Date(b.date));
    }, [data.parties, viewMode]);

    const TaskItem = ({ task }) => { 
      const party = data.parties.find(p => p.id === task.partyId);
      let statusColor = 'bg-gray-400';
      if(task.status === 'Done') statusColor = 'bg-green-500';
      else if(task.status === 'In Progress') statusColor = 'bg-blue-500';
      else if(task.status === 'To Do') statusColor = 'bg-orange-500';
      else if(task.status === 'Converted') statusColor = 'bg-purple-500';
      return (
        <div onClick={() => { pushHistory(); setViewDetail({ type: 'task', id: task.id }); }} className="p-4 bg-white border rounded-2xl mb-2 flex justify-between items-start cursor-pointer active:scale-95 transition-transform">
          <div className="flex-1">
            <div className="flex flex-col gap-1 mb-1">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                    <p className="font-bold text-gray-800">{task.name}</p>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border uppercase">{task.status}</span>
                </div>
                {/* CHANGE (Point 4): Party Link Icon in Task List */}
                {party && (
                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold truncate max-w-[150px] border border-blue-100">{party.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setViewDetail({type:'party', id: party.id}); }} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200"><ExternalLink size={10}/></button>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-1 ml-4">{task.description}</p>
            <div className="flex gap-3 mt-2 ml-4 text-[10px] font-bold text-gray-400 uppercase"><span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.dueDate)}</span><span className="flex items-center gap-1"><Users size={10} /> {task.assignedStaff?.length || 0} Staff</span></div>
          </div>
          <div className="text-right"><p className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">{task.id}</p></div>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Tasks & AMC</h1>
            <div className="flex gap-2 items-center">
                {checkPermission(user, 'canEditTasks') && <button onClick={() => { pushHistory(); setModal({ type: 'task' }); }} className="p-2 bg-blue-600 text-white rounded-xl"><Plus /></button>}
            </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={()=>setViewMode('tasks')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode==='tasks' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>My Tasks</button>
            <button onClick={()=>setViewMode('amc')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode==='amc' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Upcoming AMC</button>
        </div>

        {viewMode === 'tasks' ? (
            <>
                <div className="flex gap-2 items-center">
                    <input className="p-2 border rounded-xl text-xs w-full" placeholder="Search Tasks..." value={search} onChange={e => setSearch(e.target.value)}/>
                    <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                        <option value="DateAsc">Due Soon</option>
                        <option value="DateDesc">Due Later</option>
                        <option value="A-Z">A-Z</option>
                    </select>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {filterOptions.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200'}`}>{s}</button>
                    ))}
                </div>
                <div className="space-y-2 pb-20">
                    {/* CHANGE (Point 7): Render Grouped Tasks */}
                    {sortedKeys.map(groupKey => (
                        <div key={groupKey}>
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 mt-4 ml-1">{groupKey}</h3>
                            {groupedTasks[groupKey].map(t => <TaskItem key={t.id} task={t} />)}
                        </div>
                    ))}
                    {sortedTasks.length === 0 && <p className="text-center text-gray-400 py-10">No tasks found.</p>}
                </div>
            </>
        ) : (
            <div className="space-y-3 pb-20">
                {upcomingAMC.length === 0 && <div className="text-center text-gray-400 py-10">No upcoming services in next 45 days.</div>}
                {upcomingAMC.map((item, idx) => (
                    <div key={idx} className={`p-4 bg-white border rounded-2xl flex justify-between items-center ${item.isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800">{item.asset.name}</span>
                                {item.isOverdue && <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">OVERDUE</span>}
                            </div>
                            <p className="text-xs text-gray-600 font-bold">{item.party.name}</p>
                            <p className="text-[10px] text-gray-500 mt-1">Due: {formatDate(item.date)} ({item.asset.brand})</p>
                        </div>
                        <button 
                            onClick={() => {
                                pushHistory();
                                setModal({
                                    type: 'task',
                                    data: {
                                        name: `Service: ${item.asset.name}`,
                                        partyId: item.party.id,
                                        description: `AMC Service for ${item.asset.brand} ${item.asset.model}. Due on ${item.date}`,
                                        dueDate: item.date,
                                        status: 'To Do',
                                        linkedAssetStr: item.asset.name 
                                    }
                                });
                            }}
                            className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs whitespace-nowrap"
                        >
                            Create Task
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>
    );
};

// --- EXTERNALIZED SUB-COMPONENTS END ---

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
          description: i.description || '',
          brand: i.brand || ''  // <--- YE LINE ADD KI (Brand carry forward hoga)
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
      
      // 1. Sale Save karo aur ID lo
      const saleId = await saveRecord('transactions', newSale, 'sales');
      
      // 2. Task Update karo
      const updatedTask = { ...task, status: 'Converted', generatedSaleId: saleId };
      await saveRecord('tasks', updatedTask, 'task');
      
      // 3. Modal band karo
      onClose(); 

      // --- FIX START: Direct Naye Invoice par jao ---
      // List par wapas jane ki jagah, seedha naye transaction ko open karo
      
      // Agar NavStack use kar rahe ho to current task ko stack me daalo (Optional)
      // setNavStack(prev => [...prev, viewDetail]); 
      
      // Naya view set karo
      setViewDetail({ type: 'transaction', id: saleId }); 
      
      // Note: Hum handleCloseUI() call NAHI karenge taki hum detail view me hi rahein
      // --- FIX END ---
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

const StatementModal = ({ isOpen, onClose, partyId, data }) => {
  const [dates, setDates] = useState({ 
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
  });
  const [showItems, setShowItems] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
      const party = data.parties.find(p => p.id === partyId);
      if(!party) return alert("Party not found");

      // 1. Sort all transactions
      const allTxs = data.transactions
          .filter(t => t.partyId === partyId && t.status !== 'Cancelled')
          .sort((a,b) => new Date(a.date) - new Date(b.date));

      // 2. Calculate Opening Balance
      let openingBal = party.type === 'DR' ? parseFloat(party.openingBal || 0) : -parseFloat(party.openingBal || 0);
      const beforeRangeTxs = allTxs.filter(t => new Date(t.date) < new Date(dates.start));
      
      beforeRangeTxs.forEach(tx => {
          const { final } = getTransactionTotals(tx);
          if (tx.type === 'sales') openingBal += final;
          if (tx.type === 'purchase' || (tx.type === 'expense')) openingBal -= final;
          if (tx.type === 'payment') {
              const amt = parseFloat(tx.amount || 0) + parseFloat(tx.discountValue || 0);
              if (tx.subType === 'in') openingBal -= amt;
              else openingBal += amt;
          }
      });

      // 3. Filter Range Transactions
      const reportTxs = allTxs.filter(t => new Date(t.date) >= new Date(dates.start) && new Date(t.date) <= new Date(dates.end));

      // 4. Generate HTML for Print
      let runningBal = openingBal;
      let totalDr = 0;
      let totalCr = 0;

      const rowsHTML = reportTxs.map(tx => {
          let debit = 0;
          let credit = 0;
          const { final } = getTransactionTotals(tx);

          if (tx.type === 'sales') debit = final;
          else if (tx.type === 'purchase' || tx.type === 'expense') credit = final;
          else if (tx.type === 'payment') {
              const amt = parseFloat(tx.amount || 0) + parseFloat(tx.discountValue || 0);
              if (tx.subType === 'in') credit = amt; else debit = amt;
          }

          runningBal = runningBal + debit - credit;
          totalDr += debit;
          totalCr += credit;

          // Item Details Row
          let detailsHTML = '';
          if (showItems && tx.items && tx.items.length > 0) {
              const itemsList = tx.items.map(item => {
                  const iName = data.items.find(x => x.id === item.itemId)?.name || 'Item';
                  return `<div style="font-size:10px; color:#666; padding-left:10px;">• ${iName} ${item.brand ? `(${item.brand})` : ''} - ${item.qty} x ${item.price}</div>`;
              }).join('');
              detailsHTML = `<div style="margin-top:2px;">${itemsList}</div>`;
          }

          // Note Row
          let noteHTML = '';
          if (showNotes && tx.description) {
              noteHTML = `<div style="font-size:10px; color:#888; font-style:italic; padding-left:10px;">Note: ${tx.description}</div>`;
          }

          return `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">${formatDate(tx.date)}</td>
                <td style="padding: 8px;">
                    <div style="font-weight:bold; text-transform:uppercase;">${tx.type} #${tx.id}</div>
                    ${detailsHTML}
                    ${noteHTML}
                </td>
                <td style="padding: 8px; text-align:right; color:#dc2626;">${debit > 0 ? formatCurrency(debit) : '-'}</td>
                <td style="padding: 8px; text-align:right; color:#16a34a;">${credit > 0 ? formatCurrency(credit) : '-'}</td>
                <td style="padding: 8px; text-align:right; font-weight:bold;">${formatCurrency(Math.abs(runningBal))} ${runningBal >= 0 ? 'DR' : 'CR'}</td>
            </tr>
          `;
      }).join('');

      const closingStatus = runningBal > 0 ? "RECEIVABLE (LENA HAI)" : runningBal < 0 ? "PAYABLE (DENA HAI)" : "SETTLED";
      const statusColor = runningBal > 0 ? "#16a34a" : runningBal < 0 ? "#dc2626" : "#000";

      const printContent = `
        <html>
          <head>
            <title>Statement - ${party.name}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th { background: #2563eb; color: white; padding: 10px; text-align: left; }
              .header { text-align: center; margin-bottom: 20px; }
              .company { font-size: 24px; font-weight: bold; color: #1e40af; }
              .party-info { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 10px; }
              .summary { margin-top: 20px; display: flex; justify-content: flex-end; }
              .summary-box { width: 40%; border: 1px solid #ccc; padding: 10px; border-radius: 8px; background: #f9fafb; }
              .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; }
              .total-row { font-size: 14px; font-weight: bold; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px; color: ${statusColor}; }
            </style>
          </head>
          <body>
            <div class="header">
                <div class="company">${data.company.name}</div>
                <div>${data.company.address} | ${data.company.mobile}</div>
                <h2 style="margin-top:10px;">ACCOUNT STATEMENT</h2>
            </div>

            <div class="party-info">
                <div>
                    <strong>To: ${party.name}</strong><br/>
                    ${party.mobile || ''}<br/>
                    ${party.address || ''}
                </div>
                <div style="text-align:right;">
                    <strong>Period:</strong> ${formatDate(dates.start)} to ${formatDate(dates.end)}<br/>
                    <strong>Generated:</strong> ${new Date().toLocaleDateString()}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="15%">Date</th>
                        <th width="40%">Particulars</th>
                        <th width="15%" style="text-align:right;">Debit</th>
                        <th width="15%" style="text-align:right;">Credit</th>
                        <th width="15%" style="text-align:right;">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#eff6ff; font-weight:bold;">
                        <td style="padding:10px;">${formatDate(dates.start)}</td>
                        <td style="padding:10px;">OPENING BALANCE B/F</td>
                        <td style="text-align:right;">-</td>
                        <td style="text-align:right;">-</td>
                        <td style="text-align:right;">${formatCurrency(Math.abs(openingBal))} ${openingBal >= 0 ? 'DR' : 'CR'}</td>
                    </tr>
                    ${rowsHTML}
                </tbody>
            </table>

            <div class="summary">
                <div class="summary-box">
                    <div class="row"><span>Total Debit:</span> <span>${formatCurrency(totalDr)}</span></div>
                    <div class="row"><span>Total Credit:</span> <span>${formatCurrency(totalCr)}</span></div>
                    <div class="total-row">
                        <span>Closing Balance:</span>
                        <span>${formatCurrency(Math.abs(runningBal))} ${runningBal >= 0 ? 'DR' : 'CR'}</span>
                    </div>
                    <div style="text-align:right; font-size:10px; margin-top:5px; font-weight:bold; color:${statusColor};">
                        ${closingStatus}
                    </div>
                </div>
            </div>
          </body>
        </html>
      `;

      const win = window.open('', '_blank');
      win.document.write(printContent);
      win.document.close();
      setTimeout(() => win.print(), 500);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">Generate Statement</h3>
        <div className="space-y-4">
          <div>
              <label className="text-xs font-bold text-gray-500 uppercase">From Date</label>
              <input type="date" className="w-full p-3 border rounded-xl" value={dates.start} onChange={e=>setDates({...dates, start:e.target.value})}/>
          </div>
          <div>
              <label className="text-xs font-bold text-gray-500 uppercase">To Date</label>
              <input type="date" className="w-full p-3 border rounded-xl" value={dates.end} onChange={e=>setDates({...dates, end:e.target.value})}/>
          </div>
          
          <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={showItems} onChange={e => setShowItems(e.target.checked)}/>
                  Show Item Details
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={showNotes} onChange={e => setShowNotes(e.target.checked)}/>
                  Show Notes
              </label>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-gray-600">Cancel</button>
            <button onClick={handleGenerate} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                <FileText size={18}/> Generate PDF
            </button>
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
    
  // --- FIX IN ManualAttendanceModal Component ---
const handleSave = async () => {
    const staffId = manualAttModal.staffId || manualAttModal.id.split('-')[1]; 
    const attId = manualAttModal.isEdit ? manualAttModal.id : `ATT-${staffId}-${form.date}`;
    const timestamp = new Date().toISOString(); 

    const record = { 
        staffId, 
        date: form.date, 
        checkIn: form.in, 
        checkOut: form.out, 
        lunchStart: form.lStart, 
        lunchEnd: form.lEnd, 
        id: attId, 
        status: 'Present',
        updatedAt: timestamp 
    };
    
    // Naya record hai to createdAt bhi daalo (optional but good practice)
    if(!manualAttModal.isEdit) {
        record.createdAt = timestamp;
    }
    
    const newAtt = [...data.attendance.filter(a => a.id !== attId), record];
    setData(prev => ({ ...prev, attendance: newAtt }));
    
    await setDoc(doc(db, "attendance", attId), record); // Save
    
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

const TimeLogDetailsModal = ({ selectedTimeLog, setSelectedTimeLog, handleCloseUI, saveRecord, setEditingTimeLog }) => {
    if (!selectedTimeLog) return null;
    const { task, index } = selectedTimeLog;
    const log = task.timeLogs[index];

    // Delete Logic
    const handleDelete = async () => {
        if(!window.confirm("Are you sure you want to delete this time log?")) return;
        
        // Remove item from array
        const updatedLogs = [...task.timeLogs];
        updatedLogs.splice(index, 1);
        
        const updatedTask = { ...task, timeLogs: updatedLogs };
        
        // Save to Firebase
        await saveRecord('tasks', updatedTask, 'task');
        
        setSelectedTimeLog(null);
        handleCloseUI();
    };

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
                                <MapIcon size={20}/>
                            </a>
                        </div>
                    )}
                    
                    {/* EDIT AND DELETE BUTTONS */}
                    <div className="flex gap-3 pt-2">
                          <button onClick={handleDelete} className="flex-1 p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Trash2 size={16}/> Delete</button>
                          <button onClick={() => { setEditingTimeLog({ task, index }); setSelectedTimeLog(null); }} className="flex-1 p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Edit2 size={16}/> Edit</button>
                    </div>
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
const MasterList = ({ title, collection, type, onRowClick, search, setSearch, data, setData, user, partyBalances, itemStock, partyFilter, pushHistory, setViewDetail, setModal }) => {
    const [sort, setSort] = useState('A-Z');
    const [selectedIds, setSelectedIds] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [selectedCat, setSelectedCat] = useState(null);

    // --- REQ 2: CATEGORY MANAGEMENT LOGIC ---
    const handleRenameCat = async (e, oldName) => {
        e.stopPropagation();
        const newName = prompt("Rename Category:", oldName);
        if (!newName || newName === oldName) return;

        // 1. Check duplicates
        const catList = data.categories.item || [];
        if (catList.includes(newName)) return alert("Category name already exists!");

        // 2. Update Category List
        const newCatList = catList.map(c => c === oldName ? newName : c);
        
        // 3. Update Items (Jo item purani category me thi unhe nayi me daalo)
        const updatedItems = data.items.map(i => i.category === oldName ? { ...i, category: newName } : i);

        // 4. Update Local State
        const newData = { 
            ...data, 
            items: updatedItems, 
            categories: { ...data.categories, item: newCatList } 
        };
        setData(newData);

        // 5. Update Firebase
        // A. Settings update
        await setDoc(doc(db, "settings", "categories"), newData.categories);
        // B. Items update (Background me chalne do)
        updatedItems.forEach(i => {
            if (i.category === newName) setDoc(doc(db, "items", i.id), i);
        });
    };

    const handleDeleteCat = async (e, catName) => {
        e.stopPropagation();
        if (!window.confirm(`Delete Category "${catName}"?\n\nItems inside will become Uncategorized.`)) return;

        // 1. Remove from Category List
        const newCatList = (data.categories.item || []).filter(c => c !== catName);

        // 2. Update Items (Category Blank kar do)
        const updatedItems = data.items.map(i => i.category === catName ? { ...i, category: '' } : i);

        // 3. Update Local State
        const newData = { 
            ...data, 
            items: updatedItems, 
            categories: { ...data.categories, item: newCatList } 
        };
        setData(newData);

        // 4. Update Firebase
        await setDoc(doc(db, "settings", "categories"), newData.categories);
        // Update affected items in Firebase
        updatedItems.forEach(i => {
            if (i.category === '') setDoc(doc(db, "items", i.id), i);
        });
    };
    // ----------------------------------------

    let listData = data[collection] || [];

    if (type === 'item') {
        listData = listData.map(i => {
             const isService = i.type === 'Service';
             const stockVal = itemStock[i.id] || 0;
             return { 
                 ...i, 
                 subText: isService ? 'Service (No Stock)' : `${stockVal} ${i.unit}`, 
                 subColor: isService ? 'text-gray-400' : (stockVal < 0 ? 'text-red-500' : 'text-green-600') 
             };
        });
        if (viewMode === 'category' && selectedCat) {
            listData = listData.filter(i => (i.category || 'Uncategorized') === selectedCat);
        }
    }

    if (type === 'party') {
        listData = listData.map(p => {
           const bal = partyBalances[p.id] || 0;
           return { ...p, subText: bal !== 0 ? formatCurrency(Math.abs(bal)) + (bal > 0 ? ' DR' : ' CR') : 'Settled', subColor: bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-gray-400', balance: bal };
        });
        if (partyFilter === 'receivable') listData = listData.filter(p => p.balance > 0);
        if (partyFilter === 'payable') listData = listData.filter(p => p.balance < 0);
    }
    
    const categoryCounts = useMemo(() => {
        if (type !== 'item') return {};
        const counts = {};
        (data.items || []).forEach(i => {
            const cat = i.category || 'Uncategorized';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [data.items, type]);

    const filtered = sortData(listData.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))), sort);

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file || !window.XLSX) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
            const jsonData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            const newRecords = [];
            let nextCounters = { ...data.counters };
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                let record = {};
                let id = '';
                if (type === 'party') {
                    const num = nextCounters.party || 1000;
                    id = `P-${num}`; nextCounters.party = num + 1;
                    record = { id, name: row[1]||'', email: row[3]||'', mobile: row[4]||'', address: row[5]||'', lat: row[6]||'', lng: row[7]||'', reference: row[8]||'', openingBal: row[10]||0, type: row[11]||'DR' };
                } else if (type === 'item') {
                    const num = nextCounters.item || 1000;
                    id = `I-${num}`; nextCounters.item = num + 1;
                    record = { id, name: row[1]||'', category: row[2]||'', type: row[3]||'Goods', sellPrice: row[4]||0, buyPrice: row[5]||0, unit: row[8]||'pcs', openingStock: 0 };
                }
                if (record.name) newRecords.push(cleanData(record));
            }
            await setDoc(doc(db, "settings", "counters"), nextCounters);
            const newData = { ...data, [collection]: [...data[collection], ...newRecords], counters: nextCounters };
            setData(newData);
            localStorage.setItem('smees_data', JSON.stringify(newData));
            newRecords.forEach(r => setDoc(doc(db, collection, r.id), r));
            alert(`Imported ${newRecords.length} records!`);
        };
        reader.readAsBinaryString(file);
    };

    const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(i => i.id));
    const handleBulkDelete = async () => {
       if(!window.confirm(`Delete ${selectedIds.length} records?`)) return;
       const ids = [...selectedIds];
       setSelectedIds([]); // Selection clear karein

       // 1. Filter Data
       const updatedList = data[collection].filter(item => !ids.includes(item.id));
       
       // 2. Prepare New Data Object
       const newData = { ...data, [collection]: updatedList };

       // 3. Update State & LocalStorage (IMPORTANT FIX)
       setData(newData);
       localStorage.setItem('smees_data', JSON.stringify(newData));

       // 4. Delete from Firebase
       try { 
           await Promise.all(ids.map(id => deleteDoc(doc(db, collection, id.toString())))); 
           alert("Deleted Successfully"); // Feedback added
       } catch (e) { 
           console.error(e); 
       }
    };

    return (
      <div className="space-y-4">
        {/* 1. HEADER SECTION (Same as before) */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
              <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleSelectAll} />
              <h1 className="text-xl font-bold">{title} {partyFilter ? `(${partyFilter})` : ''}</h1>
          </div>
          <div className="flex gap-2">
              {type === 'item' && (
                  <button 
                    onClick={() => {
                        if(viewMode === 'list') setViewMode('category');
                        else { setViewMode('list'); setSelectedCat(null); }
                    }} 
                    className={`p-2 rounded-xl flex items-center gap-1 text-sm px-3 font-bold border ${viewMode === 'category' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <Package size={18}/> {viewMode === 'category' ? 'Show All' : 'Categories'}
                  </button>
              )}
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

        {/* 2. SEARCH BAR (MOVED HERE - AB YE HAMESHA DIKHEGA) */}
        <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
                /* CHANGE: autoFocus hata diya taki keyboard apne aap na khule */
                className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                placeholder={`Search ${title}...`} 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
            />
        </div>

        {/* 3. CATEGORY GRID VIEW */}
        {type === 'item' && viewMode === 'category' && !selectedCat && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                {Object.entries(categoryCounts)
                    // Search Filter Yahan Apply Hoga
                    .filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())) 
                    .map(([cat, count]) => (
                    <div key={cat} onClick={() => setSelectedCat(cat)} className="relative p-4 bg-white border rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors shadow-sm group">
                        
                        {/* EDIT / DELETE BUTTONS */}
                        {cat !== 'Uncategorized' && checkPermission(user, 'canViewMasters') && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleRenameCat(e, cat)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={12}/></button>
                                <button onClick={(e) => handleDeleteCat(e, cat)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={12}/></button>
                            </div>
                        )}
                        
                        <Package size={24} className="text-blue-500 mb-2 opacity-50"/>
                        <span className="font-bold text-gray-800 text-center text-sm">{cat}</span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full mt-1">{count} Items</span>
                    </div>
                ))}
                {Object.entries(categoryCounts).filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())).length === 0 && <p className="text-gray-400 col-span-2 text-center text-sm">No categories found.</p>}
            </div>
        )}

        {/* 4. LIST VIEW (Items / Parties) */}
        {((type !== 'item') || (type === 'item' && (viewMode === 'list' || selectedCat))) && (
            <>
                {selectedCat && (
                    <button onClick={() => setSelectedCat(null)} className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-2">
                        <ArrowLeft size={14}/> Back to Categories
                    </button>
                )}
                
                {/* Purana Search Bar yahan se hata diya hai */}
                
                <div className="space-y-2">
                  {filtered.map(item => (
                    <div key={item.id} className={`p-3 bg-white border rounded-2xl flex items-center gap-3 active:scale-95 transition-transform ${selectedIds.includes(item.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : ''}`}>
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i!==item.id) : [...prev, item.id])} />
                      <div className="flex-1" onClick={() => onRowClick ? onRowClick(item) : (pushHistory() || setViewDetail({ type, id: item.id }))}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-gray-800">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.mobile || item.category || item.role}</p>
                            </div>
                            {item.subText && <p className={`text-xs font-bold ${item.subColor}`}>{item.subText}</p>}
                        </div>
                      </div>
                      <ChevronRight className="text-gray-300" />
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No records found</p>}
                </div>
            </>
        )}
      </div>
    );
};

export default function App() {
  // REQ 1: Persistent Data State (Fixed for Hydration / SSR)
  // Initialize with default values (null / INITIAL_DATA) to prevent Prop ID Mismatch
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
  // --- FIX 1: OFFLINE PERSISTENCE (Cache) ---
  useEffect(() => {
    const enableOffline = async () => {
      try {
        await enableIndexedDbPersistence(db);
        console.log("Offline persistence enabled");
      } catch (err) {
        if (err.code == 'failed-precondition') {
            console.log("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
        } else if (err.code == 'unimplemented') {
            console.log("The current browser does not support all of the features required to enable persistence");
        }
      }
    };
    enableOffline();
  }, []);
  
  // Load from LocalStorage ONLY on the client-side after mount
  useEffect(() => {// Load User & Check Active Status
    const savedUser = localStorage.getItem('smees_user');
    if (savedUser) {
        try { 
            const u = JSON.parse(savedUser);
            
            // --- CHANGE: Check Active/Inactive ---
            if (u.active === false) {
                // Agar user inactive hai:
                // 1. Sara Local Data Delete karo
                localStorage.clear(); 
                // 2. User state null karo (Logout)
                setUser(null);
                // 3. Data state reset karo
                setData(INITIAL_DATA);
                // 4. Message dikhao
                alert("Your account is INACTIVE. Contact Admin.");
            } else {
                // Agar active hai to normal login
                setUser(u); 
            }
        } catch (e) { console.error(e); }
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

const [txSearchQuery, setTxSearchQuery] = useState(''); 
 const [txDateRange, setTxDateRange] = useState({ start: '', end: '' }); 
 // CHANGE: Search ko alag alag kiya (Point 3)
 const [partySearch, setPartySearch] = useState(''); 
 const [itemSearch, setItemSearch] = useState('');
 const [staffSearch, setStaffSearch] = useState('');
const [navStack, setNavStack] = useState([]); // Navigation History rakhne ke liye
const scrollPos = useRef({}); // Scroll position save karne ke liye
    
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
  // --- FIX 2 & 3: SMART SYNC & PAGINATION LOGIC ---
const [lastDoc, setLastDoc] = useState(null); // Pagination tracker
const [isMoreDataAvailable, setIsMoreDataAvailable] = useState(true);

// --- UPDATED SYNCDATA (Paste in place of old syncData) ---
  const syncData = async (isBackground = false) => {
    if (!user) return;
    if (!isBackground) setLoading(true);

    try {
      // 1. Local Storage se purana data uthao
      const localStr = localStorage.getItem('smees_data');
      let currentData = localStr ? JSON.parse(localStr) : { ...INITIAL_DATA };
      
      const lastSyncTime = localStorage.getItem('smees_last_sync');
      
      // 2. Check: Kya pehli baar chala rahe hain?
      // Agar lastSyncTime nahi hai YA transactions khali hain, to Full Sync karo
      const isFirstRun = !lastSyncTime || !currentData.transactions || currentData.transactions.length === 0;

      const collectionsToSync = [
         { name: 'staff' }, 
         { name: 'tasks' }, 
         { name: 'attendance' },
         { name: 'parties' }, 
         { name: 'items' }, 
         { name: 'transactions' }
      ];

      // Admin check
      if (user.role !== 'admin') {
          collectionsToSync.pop(); // Staff ko transactions mat do
      }

      for (const col of collectionsToSync) {
          let q;
          
          // SAFETY CHECK: Agar 'updatedAt' field database me nahi hai to error aayega.
          // Isliye Step 2 wala code chalana zaruri hai.
          
          if (!isFirstRun && lastSyncTime) {
             // SMART SYNC: Sirf naya data lao
             q = query(collection(db, col.name), where("updatedAt", ">", lastSyncTime));
          } else {
             // FULL SYNC: Sab kuch lao
             q = query(collection(db, col.name));
          }

          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
              const fetchedDocs = snapshot.docs.map(doc => doc.data());
              const existingArray = currentData[col.name] || [];
              
              // MERGE LOGIC: Purane aur naye data ko mix karo
              const existingMap = new Map(existingArray.map(item => [item.id, item]));
              fetchedDocs.forEach(item => existingMap.set(item.id, item));
              
              currentData[col.name] = Array.from(existingMap.values());
          }
      }

      // Settings hamesha fresh lao
      const companySnap = await getDocs(collection(db, "settings"));
      companySnap.forEach(doc => {
        if (doc.id === 'company') currentData.company = doc.data();
        if (doc.id === 'counters') currentData.counters = { ...INITIAL_DATA.counters, ...doc.data() };
        if (doc.id === 'categories') currentData.categories = { ...INITIAL_DATA.categories, ...doc.data() };
      });

      // 3. Save Data & New Time
      const now = new Date().toISOString();
      localStorage.setItem('smees_data', JSON.stringify(currentData));
      localStorage.setItem('smees_last_sync', now);
      
      setData(currentData);
      
      if (!isBackground) {
          showToast("Data Synced Successfully");
      }

    } catch (error) {
      console.error("Sync Error:", error);
      
      // Agar index error aaye
      if (error.message && error.message.includes("requires an index")) {
          alert("PLEASE CREATE INDEX: Open Console (F12) and click the Firebase link.");
      } 
      // Agar 'failed-precondition' aaye matlab multiple tabs khule hain
      else if (error.code === 'failed-precondition') {
          console.log("Offline Persistence Active");
      } 
      else {
          showToast("Sync Error. Check Internet.", "error");
      }
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
  // --- REQ 5: AUTOMATED AMC TASK CREATION ---
  useEffect(() => {
      // Run only if user is admin and data is loaded
      if (!user || user.role !== 'admin' || data.parties.length === 0) return;

      const runAutomation = async () => {
          const today = new Date();
          // Look ahead 2 days (Tomorrow or Today)
          const thresholdDate = new Date();
          thresholdDate.setDate(today.getDate() + 2); 

          const newTasks = [];
          const timestamp = new Date().toISOString();
          let counters = { ...data.counters };

          data.parties.forEach(p => {
              if (!p.assets) return;
              p.assets.forEach(asset => {
                  if (!asset.nextServiceDate) return;
                  
                  const dueDate = new Date(asset.nextServiceDate);
                  
                  // 1. Check Date Condition (Due Today or Tomorrow)
                  if (dueDate <= thresholdDate && dueDate >= today) {
                      
                      // 2. Check Duplicate (Already task created for this asset around this date?)
                      // Logic: Check if any task exists for this party with description containing asset name AND created recently
                      const alreadyExists = data.tasks.some(t => 
                          t.partyId === p.id && 
                          t.description?.includes(asset.name) && 
                          // Create window check (e.g. task created within last 20 days to avoid duplicate for same cycle)
                          new Date(t.createdAt) > new Date(today.getTime() - (20 * 24 * 60 * 60 * 1000))
                      );

                      if (!alreadyExists) {
                          // Create Task Object
                          const { id, nextCounters } = getNextId({ counters }, 'task');
                          counters = nextCounters; // Update local counter for loop

                          newTasks.push({
                              id,
                              name: `Auto Service: ${asset.name}`,
                              partyId: p.id,
                              description: `Automated Task for ${asset.brand} ${asset.model}. Service Due: ${asset.nextServiceDate}`,
                              status: 'To Do',
                              dueDate: asset.nextServiceDate,
                              assignedStaff: [],
                              itemsUsed: [],
                              createdAt: timestamp,
                              updatedAt: timestamp,
                              taskCreatedAt: timestamp,
                              linkedAssetStr: asset.name // Tag for future checks
                          });
                      }
                  }
              });
          });

          if (newTasks.length > 0) {
              console.log("Auto-Creating Tasks:", newTasks.length);
              
              // 1. Update Local Data
              const updatedTasks = [...data.tasks, ...newTasks];
              const newData = { ...data, tasks: updatedTasks, counters };
              setData(newData); // UI Update
              
              // 2. Batch Save to Firebase
              const batch = [];
              newTasks.forEach(t => batch.push(setDoc(doc(db, "tasks", t.id), t)));
              batch.push(setDoc(doc(db, "settings", "counters"), counters));
              
              try {
                  await Promise.all(batch);
                  showToast(`Auto-created ${newTasks.length} AMC Tasks`);
              } catch (e) {
                  console.error("Auto Task Error", e);
              }
          }
      };

      // Run once on load (debounce slightly to ensure data is fresh)
      const timer = setTimeout(runAutomation, 3000);
      return () => clearTimeout(timer);

  }, [data.parties, user]); // Dependency on parties ensure it runs after sync

  // --- STEP 2: NOTIFICATION LOGIC (Paste this inside App component) ---
  useEffect(() => {
    // 1. Check if User is Admin
    if (!user || user.role !== 'admin') return;

    // 2. Request Browser Permission
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    // 3. Listen to Task Changes Real-time
    // Note: 'tasks' collection par nazar rakhenge
    const q = query(collection(db, "tasks"));
    
    let isFirstLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignore initial load (puraana data load hone par notification nahi bajna chahiye)
      if (isFirstLoad) {
        isFirstLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        // Sirf tab jab task 'modify' hua ho (add/remove par nahi)
        if (change.type === "modified") {
          const task = change.doc.data();
          const logs = task.timeLogs || [];
          
          // Agar logs exist karte hain
          if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            
            // Check karein ki ye abhi ka change hai (Comparison logic basic rakha hai)
            const partyName = data.parties.find(p => p.id === task.partyId)?.name || "Client";
            
            // Agar 'end' time null hai to START hua, nahi to STOP hua
            const action = lastLog.end ? "STOPPED" : "STARTED";
            
            // Toast Notification (Green/Red strip in app)
            showToast(`Staff: ${lastLog.staffName} ${action} Task: ${task.name}`);

            // System Notification (Browser/Windows Notification)
            if (Notification.permission === "granted") {
               const notifBody = `Client: ${partyName}\nTask: ${task.name}`;
               new Notification(`SMEES: ${lastLog.staffName} ${action}`, {
                 body: notifBody,
                 // Aap chaho to koi icon ka URL yahan daal sakte ho
                 // icon: "https://example.com/icon.png" 
               });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, data.parties]); // Jab user login kare ya parties load ho tab reset kare

  // REQ 2: Deep Linking (Open Task from URL) ke baad wala useEffect
  useEffect(() => {
      const handlePopState = () => {
          if (modal.type) setModal({ type: null, data: null });
          else if (statementModal) setStatementModal(null);
          
          // --- CHANGE START: Check Navigation Stack ---
          else if (viewDetail) {
              if (navStack.length > 0) {
                  // Agar stack me history hai, to piche wale view par jao
                  const prevView = navStack[navStack.length - 1];
                  setNavStack(prev => prev.slice(0, -1)); // Stack se last item hatao
                  setViewDetail(prevView); // Purana view dikhao
              } else {
                  // Stack khali hai, tabhi list par jao
                  setViewDetail(null); 
              }
          }
          // --- CHANGE END ---

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
      
      // IMPORTANT: Niche dependency array me 'navStack' add karna mat bhulna
  }, [modal, viewDetail, mastersView, reportView, convertModal, showPnlReport, timerConflict, editingTimeLog, statementModal, manualAttModal, adjustCashModal, selectedTimeLog, navStack]);

  const pushHistory = () => window.history.pushState({ modal: true }, '');
  const handleCloseUI = () => window.history.back();

  // --- LOGIC CALCULATIONS ---
  const getBillLogic = (bill) => getBillStats(bill, data.transactions);

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
      
      // --- FIND THIS BLOCK INSIDE partyBalances ---
if (tx.type === 'payment') {
    // FIX #11: Party Ledger = Amount + Discount
            const payAmt = parseFloat(tx.amount || 0); 
            const payDisc = parseFloat(tx.discountValue || 0);
            const totalCredit = payAmt + payDisc;

            if (tx.subType === 'in') balances[tx.partyId] = (balances[tx.partyId] || 0) - totalCredit;
            else balances[tx.partyId] = (balances[tx.partyId] || 0) + totalCredit;
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
            // FIX #11: Cash/Bank = Only Amount (Discount is separate)
            amt = parseFloat(tx.amount || 0);

            isIncome = tx.subType === 'in'; // in = Income, out = Expense
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
  }, [data.transactions, data.tasks, partyBalances]);

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

    // --- NEW CHANGE START: Timestamp Logic ---
    // Aaj ka current time (ISO format me)
    const timestamp = new Date().toISOString(); 
    // --- NEW CHANGE END ---

    if (record.id) {
      // --- CASE 1: EDITING (Purana Record) ---
      // Hum purane record me 'updatedAt' add kar rahe hain
      record = { ...record, updatedAt: timestamp }; 
      
      newData[collectionName] = data[collectionName].map(r => r.id === record.id ? record : r);
      
      // (Task conversion logic wesa hi rahega)
      if (collectionName === 'transactions' && record.type === 'sales' && record.convertedFromTask) {
         const task = newData.tasks.find(t => t.id === record.convertedFromTask);
         if (task) {
           task.itemsUsed = record.items.map(i => ({ itemId: i.itemId, qty: i.qty, price: i.price, buyPrice: i.buyPrice, description: i.description }));
           // Task update hua, to uska bhi time update karo
           const updatedTask = { ...task, updatedAt: timestamp }; 
           newData.tasks = newData.tasks.map(t => t.id === task.id ? updatedTask : t);
           setDoc(doc(db, "tasks", task.id), updatedTask);
         }
      }
    } else {
      // --- CASE 2: CREATING (Naya Record) ---
      const { id, nextCounters } = getNextId(data, idType);
      const createdField = collectionName === 'tasks' ? { taskCreatedAt: timestamp } : {};
      
      // Yahan hum 'createdAt' aur 'updatedAt' dono daal rahe hain
      record = { 
          ...record, 
          id, 
          createdAt: timestamp, 
          updatedAt: timestamp, // <--- YE ZARURI HAI SMART SYNC KE LIYE
          ...createdField 
      };
      
      newData[collectionName] = [...data[collectionName], record];
      newData.counters = nextCounters; 
      newCounters = nextCounters;
      finalId = id;
    }
    
    const safeRecord = cleanData(record);
    
    // ... (Baki ka code same rahega: setData, setDoc, Toast etc.) ...
    setData(newData); setModal({ type: null, data: null }); handleCloseUI(); showToast("Saved");
    
    try {
        await setDoc(doc(db, collectionName, finalId.toString()), safeRecord);
        if (newCounters) await setDoc(doc(db, "settings", "counters"), newCounters);
        
        // REQ: Use Targeted Sync instead of full sync
        // Note: Yahan hum abhi full sync nahi kar rahe, local state update ho chuka hai
        // await refreshSingleRecord(collectionName, finalId); <--- Isse hata bhi sakte hain agar local update sahi hai
    } catch (e) { console.error(e); showToast("Save Error", "error"); }
    return finalId; 
  };
const deleteRecord = async (collectionName, id) => {
    if (!user) return;

    // --- FIX 2: STRICT DELETE PROTECTION (Check Usage) ---
    if (collectionName === 'items') {
        // 1. Check in Transactions (Sales, Purchase, Estimates)
        const isUsedInTx = data.transactions.some(t => 
            t.status !== 'Cancelled' && // Cancelled me hai to ignore kar sakte hain, ya strict rakh sakte hain
            t.items?.some(i => String(i.itemId) === String(id))
        );
        
        // 2. Check in Tasks (Items used in service)
        const isUsedInTasks = data.tasks.some(t => 
            t.itemsUsed?.some(i => String(i.itemId) === String(id))
        );

        if (isUsedInTx || isUsedInTasks) { 
            alert("⚠️ Warning: Cannot delete this Item.\nIt is used in existing Transactions or Tasks."); 
            setConfirmDelete(null); 
            return;
        }
    }

    if (collectionName === 'parties') {
        const isUsed = data.transactions.some(t => t.partyId === id && t.status !== 'Cancelled');
        if (isUsed) { 
            alert("⚠️ Warning: Cannot delete this Party.\nThey have existing transactions."); 
            setConfirmDelete(null); 
            return;
        }
    }

    // --- FIX 1: PERMANENT DELETE (Update Storage Immediately) ---
    const updatedList = data[collectionName].filter(r => r.id !== id);
    const newData = { ...data, [collectionName]: updatedList };
    
    // 1. Update State
    setData(newData);
    // 2. Update LocalStorage IMMEDIATELY (Isse item wapas nahi aayega sync par)
    localStorage.setItem('smees_data', JSON.stringify(newData));

    setConfirmDelete(null);
    setModal({ type: null, data: null }); 
    handleCloseUI(); 
    showToast("Deleted Successfully");

    // 3. Delete from Firebase
    try { 
        await deleteDoc(doc(db, collectionName, id.toString())); 
    } catch (e) { 
        console.error("Delete Error", e);
        showToast("Error deleting from Cloud", "error");
    }
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
  // --- NEW: Restore Cancelled Transaction ---
  const restoreTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to RESTORE this transaction? It will affect calculations again.")) return;
    
    // 1. Update local state immediately
    // Hum status ko empty string set kar rahe hain taaki 'Cancelled' check fail ho jaye aur ye wapas active ho jaye
    const updatedTransactions = data.transactions.map(t => 
        t.id === id ? { ...t, status: '' } : t
    );
    setData(prev => ({ ...prev, transactions: updatedTransactions }));
    
    // 2. Update Firebase
    try {
        const tx = data.transactions.find(t => t.id === id);
        if (tx) {
            await setDoc(doc(db, "transactions", id), { ...tx, status: '' });
            // 3. Sync quietly to ensure data consistency
            await syncData(true);
            showToast("Transaction Restored Successfully");
        }
    } catch (e) {
        console.error(e);
        showToast("Error restoring", "error");
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
      
      const workLogs = data.tasks.flatMap(t => 
        (t.timeLogs || []).map((l, i) => ({ ...l, taskId: t.id, originalIndex: i, taskName: t.name }))
        .filter(l => l.staffId === staff.id)
      ).sort((a,b) => new Date(b.start) - new Date(a.start));

      // --- 1. Helper Functions (Time Calculation) ---
      // "HH:MM" string ko minutes me badalta hai
      const getMins = (t) => {
        if(!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      
      // Minutes ko "8h 30m" format me badalta hai
      const formatDur = (m) => {
        if(m <= 0) return '-';
        const h = Math.floor(m / 60);
        const mins = m % 60;
        return `${h}h ${mins}m`;
      };

  // --- FIX FOR ATTENDANCE SYNC (MERGE LOGIC) ---
const handleAttendance = async (type) => {
    if (!user) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const timestamp = new Date().toISOString();
    
    // ID Generate karo
    const attId = `ATT-${staff.id}-${todayStr}`;
    
    // Update Payload banao (Sirf wahi jo change ho rha h)
    const updatePayload = {
        updatedAt: timestamp
    };

    // Sirf specific field add karo payload me
    if (type === 'checkIn') updatePayload.checkIn = timeStr;
    if (type === 'checkOut') updatePayload.checkOut = timeStr;
    if (type === 'lunchStart') updatePayload.lunchStart = timeStr;
    if (type === 'lunchEnd') updatePayload.lunchEnd = timeStr;

    // Local State Update (UI fast dikhane ke liye)
    const existingDoc = data.attendance.find(a => a.id === attId);
    let newAttRecord;
    
    if (existingDoc) {
        // Agar record hai, to purane me naya payload mix karo
        newAttRecord = { ...existingDoc, ...updatePayload };
    } else {
        // Agar naya record hai, to mandatory fields bhi daalo
        newAttRecord = {
            id: attId,
            staffId: staff.id,
            date: todayStr,
            status: 'Present',
            createdAt: timestamp,
            ...updatePayload
        };
        // Naye record ke liye hume wo fields bhi chahiye jo updatePayload me nahi hain (taki undefined na ho)
        if(!newAttRecord.checkIn) newAttRecord.checkIn = '';
        if(!newAttRecord.checkOut) newAttRecord.checkOut = '';
        if(!newAttRecord.lunchStart) newAttRecord.lunchStart = '';
        if(!newAttRecord.lunchEnd) newAttRecord.lunchEnd = '';
    }

    const newAttList = [...data.attendance.filter(a => a.id !== attId), newAttRecord];
    setData(prev => ({ ...prev, attendance: newAttList }));

    try {
        // --- KEY FIX: merge: true ---
        // Ye server par jo data hai usse replace nahi karega, bas nayi fields mila dega
        await setDoc(doc(db, "attendance", attId), newAttRecord, { merge: true });
        showToast(`${type} Recorded`);
    } catch (e) {
        console.error(e);
        showToast("Error Saving Attendance", "error");
    }
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
                        {attHistory.map(item => {
                            // --- 2. Duration Calculations ---
                            const inM = getMins(item.checkIn);
                            const outM = getMins(item.checkOut);
                            const lsM = getMins(item.lunchStart);
                            const leM = getMins(item.lunchEnd);
                            
                            let gross = 0, lunch = 0, net = 0;
                            // Check-in se Check-out ka total time
                            if (item.checkIn && item.checkOut) gross = outM - inM;
                            // Lunch ka total time
                            if (item.lunchStart && item.lunchEnd) lunch = leM - lsM;
                            // Net (Final) Duration = Gross - Lunch
                            net = gross - lunch;
                            
                            return (
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
                                    
                                    {/* --- 3. UI Display for Durations --- */}
                                    {gross > 0 && (
                                        <div className="mt-2 pt-2 border-t flex justify-between text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg">
                                            <span>Total: {formatDur(gross)}</span>
                                            <span>Lunch: {formatDur(lunch)}</span>
                                            <span className="font-bold text-gray-800">Final: {formatDur(net)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
      // --- NEW STATES FOR PERSISTENCE (LocalStorage se load karega) ---
      const [salesFilter, setSalesFilter] = useState(() => localStorage.getItem('smees_sales_filter') || 'Today');
      const [salesDates, setSalesDates] = useState({ start: '', end: '' });
      
      const [expFilter, setExpFilter] = useState(() => localStorage.getItem('smees_expense_filter') || 'Monthly');
      const [expDates, setExpDates] = useState({ start: '', end: '' });

      // Save Filters to LocalStorage whenever they change
      useEffect(() => {
          localStorage.setItem('smees_sales_filter', salesFilter);
      }, [salesFilter]);

      useEffect(() => {
          localStorage.setItem('smees_expense_filter', expFilter);
      }, [expFilter]);

      // --- HELPER: Date Filter Logic ---
      const checkDate = (dateStr, filter, customDates) => {
          const d = new Date(dateStr);
          const now = new Date();
          const tDate = d.toDateString();
          const nDate = now.toDateString();

          if (filter === 'Today') return tDate === nDate;
          if (filter === 'Weekly') {
              const startOfWeek = new Date(now);
              startOfWeek.setDate(now.getDate() - now.getDay());
              startOfWeek.setHours(0,0,0,0);
              return d >= startOfWeek;
          }
          if (filter === 'Monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (filter === 'Yearly') return d.getFullYear() === now.getFullYear();
          if (filter === 'Custom' && customDates.start && customDates.end) {
              const s = new Date(customDates.start);
              const e = new Date(customDates.end);
              e.setHours(23,59,59,999);
              return d >= s && d <= e;
          }
          return true; // All
      };

      // --- 1. NET PROFIT CALCULATION (Existing) ---
      const pnlData = useMemo(() => {
          let filteredTx = data.transactions.filter(t => ['sales'].includes(t.type));
          filteredTx = filteredTx.filter(t => checkDate(t.date, pnlFilter, pnlCustomDates));

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

      // --- 2. SALES CARD CALCULATION (New) ---
      const salesData = useMemo(() => {
          return data.transactions
            .filter(t => t.type === 'sales' && t.status !== 'Cancelled')
            .filter(t => checkDate(t.date, salesFilter, salesDates))
            .reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
      }, [data.transactions, salesFilter, salesDates]);

      // --- 3. EXPENSE CARD CALCULATION (New) ---
      const expenseData = useMemo(() => {
          return data.transactions
            .filter(t => t.type === 'expense' && t.status !== 'Cancelled')
            .filter(t => checkDate(t.date, expFilter, expDates))
            .reduce((acc, tx) => acc + parseFloat(getTransactionTotals(tx).final || 0), 0);
      }, [data.transactions, expFilter, expDates]);

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1><p className="text-sm text-gray-500">FY {data.company.financialYear}</p></div>
            <div className="flex gap-2">
                <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 bg-gray-100 rounded-xl"><Settings className="text-gray-600" /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              {/* NET PROFIT CARD */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-2xl text-white shadow-lg cursor-pointer" onClick={() => { pushHistory(); setShowPnlReport(true); }}>
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs opacity-80 font-bold mb-1">NET PROFIT</p>
                        <p className="text-2xl font-black">{formatCurrency(pnlData)}</p>
                    </div>
                    <select onClick={(e)=>e.stopPropagation()} value={pnlFilter} onChange={(e)=>setPnlFilter(e.target.value)} className="bg-blue-900/50 text-xs border-none rounded p-1 outline-none text-white max-w-[80px]">
                        <option value="Today">Today</option><option value="Weekly">Weekly</option><option value="Monthly">Month</option><option value="Yearly">Year</option><option value="Custom">Custom</option>
                    </select>
                  </div>
                  {pnlFilter === 'Custom' && (
                    <div onClick={(e)=>e.stopPropagation()} className="flex gap-1 mt-2">
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.start} onChange={e=>setPnlCustomDates({...pnlCustomDates, start:e.target.value})} />
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.end} onChange={e=>setPnlCustomDates({...pnlCustomDates, end:e.target.value})} />
                    </div>
                  )}
              </div>
              
              {/* CASH / BANK CARD */}
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
            {/* Receivables Card */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('receivable'); }} className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-emerald-600 uppercase">Receivables</p>
               <p className="text-xl font-bold text-emerald-900">{formatCurrency(stats.totalReceivables)}</p>
            </div>
            
            {/* Payables Card */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('parties'); setPartyFilter('payable'); }} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 cursor-pointer active:scale-95 transition-transform">
               <p className="text-xs font-bold text-rose-600 uppercase">Payables</p>
               <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.totalPayables)}</p>
            </div>
            
            {/* UPDATED SALES CARD */}
            <div onClick={() => { setListFilter('sales'); setActiveTab('accounting'); }} className="bg-green-50 p-4 rounded-2xl border border-green-100 cursor-pointer active:scale-95 transition-transform relative">
              <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-green-600 uppercase">Sales</p>
                  <select onClick={(e)=>e.stopPropagation()} value={salesFilter} onChange={(e)=>setSalesFilter(e.target.value)} className="bg-green-200 text-green-800 text-[10px] font-bold border-none rounded p-1 outline-none max-w-[70px]">
                        <option value="Today">Today</option><option value="Weekly">Week</option><option value="Monthly">Month</option><option value="Yearly">Year</option><option value="Custom">Custom</option>
                  </select>
              </div>
              <p className="text-xl font-bold text-green-900">{formatCurrency(salesData)}</p>
              {salesFilter === 'Custom' && (
                    <div onClick={(e)=>e.stopPropagation()} className="flex gap-1 mt-2">
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full border border-green-200" value={salesDates.start} onChange={e=>setSalesDates({...salesDates, start:e.target.value})} />
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full border border-green-200" value={salesDates.end} onChange={e=>setSalesDates({...salesDates, end:e.target.value})} />
                    </div>
              )}
            </div>
            
            {/* UPDATED EXPENSES CARD */}
            <div onClick={() => { pushHistory(); setActiveTab('masters'); setMastersView('expenses'); }} className="bg-red-50 p-4 rounded-2xl border border-red-100 cursor-pointer active:scale-95 transition-transform relative">
              <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-red-600 uppercase">Expenses</p>
                  <select onClick={(e)=>e.stopPropagation()} value={expFilter} onChange={(e)=>setExpFilter(e.target.value)} className="bg-red-200 text-red-800 text-[10px] font-bold border-none rounded p-1 outline-none max-w-[70px]">
                        <option value="Today">Today</option><option value="Weekly">Week</option><option value="Monthly">Month</option><option value="Yearly">Year</option><option value="Custom">Custom</option>
                  </select>
              </div>
              <p className="text-xl font-bold text-red-900">{formatCurrency(expenseData)}</p>
              {expFilter === 'Custom' && (
                    <div onClick={(e)=>e.stopPropagation()} className="flex gap-1 mt-2">
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full border border-red-200" value={expDates.start} onChange={e=>setExpDates({...expDates, start:e.target.value})} />
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full border border-red-200" value={expDates.end} onChange={e=>setExpDates({...expDates, end:e.target.value})} />
                    </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
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

  // FIX #3 & #4: Expenses Breakdown with Date Filters & Net Discount Logic
  const ExpensesBreakdown = () => {
      const [eFilter, setEFilter] = useState('Monthly');
      const [eDates, setEDates] = useState({ start: '', end: '' });
      const [showDiscountDetails, setShowDiscountDetails] = useState(false); // Toggle for details view

      // 1. First filter ALL transactions by Date (Not just expenses)
      const dateFilteredTxs = data.transactions.filter(t => {
          if (t.status === 'Cancelled') return false;
          
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

      // 2. Calculate Expenses by Category (Existing Logic)
      const expenseTxs = dateFilteredTxs.filter(t => t.type === 'expense');
      
      const byCategory = expenseTxs.reduce((acc, curr) => {
          const cat = curr.category || 'Uncategorized';
          acc[cat] = (acc[cat] || 0) + parseFloat(curr.finalTotal || curr.amount || 0);
          return acc;
      }, {});

      // Calculate Total Expense for Display
      const totalExpenseAmount = Object.values(byCategory).reduce((a, b) => a + b, 0) + netDiscount;

      // 3. CHANGE (Point 9): Calculate Net Discount (Only Payment In)
      let netDiscount = 0;
      const discountTransactions = [];
      
      dateFilteredTxs.forEach(tx => {
          let discVal = parseFloat(tx.discountValue || 0);
          if(discVal <= 0) return;

          // Hame srif 'Payment In' wale discount lene hai jo savings hai
          if (tx.type === 'payment' && tx.subType === 'in') {
               // Payment In me discount ka matlab humne kam paise liye = Discount Given (Expense)
               // Sorry, user said "savings". 
               // Payment OUT (Hum pay kar rhe h) -> Discount mila -> SAVING (Income/Less Expense)
               // Payment IN (Hume mil rha h) -> Discount diya -> EXPENSE
               
               // Requirement: "usme srif payment in ke discount count ho" -> Matlab Discount Given?
               // Usually Expense Report me "Discount Received" (Savings) minus hota hai.
               // Agar user "Discount Given" (Loss) count karna chahta hai total expense me:
               
               // Let's stick to literal requirement: "payment in ke discount count ho and uski list aaye and vo total expenses total me count hona chaiye"
               // Payment IN (Customer pays us) -> We give discount -> It is an EXPENSE for us.
               
               netDiscount += discVal; 
               discountTransactions.push({ ...tx, calcDiscount: discVal, impact: 'minus' }); // Impact naming doesn't matter much here just for UI
          }
      });

      return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={() => showDiscountDetails ? setShowDiscountDetails(false) : handleCloseUI()} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                  <h2 className="font-bold text-lg">{showDiscountDetails ? 'Discount Details' : 'Expenses Breakdown'}</h2>
                  
                  {/* Date Filter Dropdown */}
                  {!showDiscountDetails && (
                      <select value={eFilter} onChange={(e)=>setEFilter(e.target.value)} className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none">
                          <option value="All">All Time</option>
                          <option value="Today">Today</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Month</option>
                          <option value="Yearly">Year</option>
                          <option value="Custom">Custom</option>
                      </select>
                  )}
                  {showDiscountDetails && <div className="w-10"></div>}
              </div>
              
              {!showDiscountDetails && eFilter === 'Custom' && (
                  <div className="flex gap-2 p-2 bg-gray-50 justify-center border-b">
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.start} onChange={e=>setEDates({...eDates, start:e.target.value})} />
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.end} onChange={e=>setEDates({...eDates, end:e.target.value})} />
                  </div>
              )}

              <div className="p-4 space-y-4">
                  {showDiscountDetails ? (
                      // DETAILED VIEW FOR DISCOUNTS
                      <div className="space-y-3">
                          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center mb-4">
                              <p className="text-xs font-bold text-purple-900 uppercase">Net Discount (Savings)</p>
                              <p className={`text-2xl font-black ${netDiscount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {netDiscount >= 0 ? '+' : ''}{formatCurrency(netDiscount)}
                              </p>
                          </div>
                          
                          {discountTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                              <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-3 border rounded-xl bg-white shadow-sm cursor-pointer hover:bg-gray-50 flex justify-between items-center active:scale-95 transition-transform">
                                  <div>
                                      <p className="font-bold text-sm text-gray-800 uppercase">{tx.type} #{tx.id}</p>
                                      <p className="text-xs text-gray-500">{formatDate(tx.date)}</p>
                                  </div>
                                  <div className={`text-right font-bold ${tx.impact === 'plus' ? 'text-green-600' : 'text-red-600'}`}>
                                      <p className="text-[10px] uppercase text-gray-400 font-extrabold tracking-wide mb-0.5">
                                        {tx.impact === 'plus' ? 'SAVINGS' : 'GIVEN'}
                                      </p>
                                      <span className="text-lg">
                                        {tx.impact === 'plus' ? '+' : '-'}{formatCurrency(tx.calcDiscount)}
                                      </span>
                                  </div>
                              </div>
                          ))}
                          {discountTransactions.length === 0 && <p className="text-center text-gray-400 py-10">No discount transactions found in this period.</p>}
                      </div>
                  ) : (
                      // SUMMARY VIEW
                      <>
                          {/* Show All Button */}
                          <div onClick={() => { setListFilter('expense'); setCategoryFilter(null); setActiveTab('accounting'); handleCloseUI(); }} className="flex justify-center items-center p-3 bg-blue-50 rounded-xl border border-blue-200 cursor-pointer mb-2 text-blue-700 font-bold text-sm">
                              Show All Expenses List
                          </div>

                          {/* Net Discount Row (Interactive) */}
                          <div onClick={() => setShowDiscountDetails(true)} className="flex justify-between items-center p-4 bg-purple-50 rounded-xl border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors">
                              <div className="flex items-center gap-2">
                                  <span className="p-1 bg-purple-200 rounded text-purple-700"><ReceiptText size={14}/></span>
                                  <span className="font-bold text-purple-900">Net Discount Savings</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className={`font-black ${netDiscount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {netDiscount >= 0 ? '+' : ''}{formatCurrency(netDiscount)}
                                  </span>
                                  <ChevronRight size={16} className="text-purple-300"/>
                              </div>
                          </div>

                          {/* Categories List */}
                          {Object.entries(byCategory).map(([cat, total]) => (
                              <div key={cat} onClick={() => { setListFilter('expense'); setCategoryFilter(cat); setActiveTab('accounting'); handleCloseUI(); }} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border cursor-pointer hover:bg-gray-100">
                                  <span className="font-bold text-gray-700">{cat}</span>
                                  <span className="font-bold text-red-600">{formatCurrency(total)}</span>
                              </div>
                          ))}

                          {/* Total Expenses Row */}
                          {totalExpenseAmount > 0 && (
                              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100 mt-4">
                                  <span className="font-black text-red-900 uppercase text-xs">Total Expenses</span>
                                  <span className="font-black text-xl text-red-700">{formatCurrency(totalExpenseAmount)}</span>
                              </div>
                          )}

                          {expenseTxs.length === 0 && <p className="text-center text-gray-400 mt-10">No expenses recorded for this period</p>}
                      </>
                  )}
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
    // --- SCROLL RESTORATION LOGIC ---
// Jab bhi viewDetail change ho, agar purana scroll saved hai to wahan jump karo
React.useLayoutEffect(() => {
    const el = document.getElementById('detail-scroller');
    if (el && viewDetail && scrollPos.current[viewDetail.id]) {
        el.scrollTop = scrollPos.current[viewDetail.id];
    }
}, [viewDetail]);
    if (!viewDetail) return null;
    
    // --- TRANSACTION DETAIL ---
    if (viewDetail.type === 'transaction') {
      const tx = data.transactions.find(t => t.id === viewDetail.id);
      if (!tx) return null;
      const party = data.parties.find(p => p.id === tx.partyId);
      const totals = getBillStats(tx, data.transactions);
      const isPayment = tx.type === 'payment';
      const paymentMode = tx.paymentMode || 'Cash';

      // --- UPDATED LINKED DATA LOGIC (Bi-Directional) ---
      // Ye logic check karega:
      // 1. Kya Is Transaction ne kisi aur ko link kiya hai? (Outgoing)
      // 2. Kya Kisi aur Transaction ne isko link kiya hai? (Incoming)
      
      const relatedDocs = data.transactions.filter(t => {
          if (t.status === 'Cancelled' || t.id === tx.id) return false;
          
          // Case A: Outgoing Link (Isne kisi ko link kiya)
          const outgoing = tx.linkedBills?.find(l => l.billId === t.id);
          
          // Case B: Incoming Link (Kisi ne isse link kiya)
          const incoming = t.linkedBills?.find(l => l.billId === tx.id);
          
          return outgoing || incoming;
      }).map(t => {
          // Amount calculation logic
          let linkAmt = 0;
          
          // Agar Outgoing hai (Is tx ne 't' ko link kiya)
          const outLink = tx.linkedBills?.find(l => l.billId === t.id);
          if (outLink) linkAmt = parseFloat(outLink.amount);
          
          // Agar Incoming hai (Us 't' ne is tx ko link kiya)
          const inLink = t.linkedBills?.find(l => l.billId === tx.id);
          if (inLink) linkAmt = parseFloat(inLink.amount);
          
          return { ...t, displayLinkAmount: linkAmt };
      });

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
      
      // --- UPDATE THIS FUNCTION INSIDE DetailView ---
      // New Professional Share/Print Logic
      const shareInvoice = () => {
        const companyName = data.company.name || "My Enterprise";
        const companyMobile = data.company.mobile || "";
        const partyName = party?.name || tx.category || "Cash Sale";
        const partyMobile = party?.mobile || "";
        const partyAddress = party?.address || "";
        
        // Calculate Totals for Display
        const subTotal = tx.items?.reduce((sum, i) => sum + (parseFloat(i.qty) * parseFloat(i.price)), 0) || 0;
        const discount = parseFloat(tx.discountValue || 0);
        const grandTotal = parseFloat(totals.amount || 0);
        const paidAmount = parseFloat(tx.received || tx.paid || 0);
        const currentDue = grandTotal - paidAmount;
        const partyTotalDue = partyBalances[tx.partyId] || 0;

        // HTML Template for Professional Invoice
        const content = `
          <html>
            <head>
              <title>Invoice ${tx.id}</title>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; }
                .company-name { font-size: 24px; font-weight: bold; color: #2563eb; text-transform: uppercase; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
                .box { width: 48%; }
                .label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
                .value { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background-color: #eff6ff; color: #1e40af; padding: 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #2563eb; }
                td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                .text-right { text-align: right; }
                .totals { display: flex; justify-content: flex-end; }
                .total-box { width: 50%; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .big-total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 5px; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #9ca3af; }
                .badge { background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="company-name">${companyName}</div>
                <div style="font-size: 12px;">${companyMobile}</div>
              </div>

              <div class="meta">
                <div class="box">
                  <div class="label">Billed To</div>
                  <div class="value">${partyName}</div>
                  <div style="font-size: 12px;">${partyMobile}</div>
                  <div style="font-size: 12px; color: #6b7280;">${partyAddress}</div>
                </div>
                <div class="box text-right">
                  <div class="label">Invoice Details</div>
                  <div class="value">#${tx.id}</div>
                  <div class="value">${formatDate(tx.date)}</div>
                  <div class="badge">${tx.type.toUpperCase()}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th class="text-right">QTY</th>
                    <th class="text-right">PRICE</th>
                    <th class="text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${(tx.items || []).map(item => {
                    const m = data.items.find(x => x.id === item.itemId);
                    return `
                      <tr>
                        <td>
                          <div style="font-weight:bold;">${m?.name || 'Item'}</div>
                          <div style="font-size:10px; color:#6b7280;">${item.description || ''}</div>
                        </td>
                        <td class="text-right">${item.qty}</td>
                        <td class="text-right">${item.price}</td>
                        <td class="text-right">${(item.qty * item.price).toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              <div class="totals">
                <div class="total-box">
                  <div class="row"><span>Sub Total</span><span>${subTotal.toFixed(2)}</span></div>
                  <div class="row"><span>Discount (${tx.discountType})</span><span>-${discount}</span></div>
                  <div class="row big-total"><span>Grand Total</span><span>${grandTotal.toFixed(2)}</span></div>
                  <div class="row" style="color: #059669; font-weight: bold;"><span>Paid Amount</span><span>${paidAmount.toFixed(2)}</span></div>
                  <div class="row" style="color: #dc2626; font-weight: bold;"><span>Balance Due (Bill)</span><span>${currentDue.toFixed(2)}</span></div>
                  <div class="row" style="margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 5px;">
                    <span style="font-size: 11px;">Total Party Due</span>
                    <span style="font-weight: bold;">${partyTotalDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div class="footer">
                <p>Thank you for your business!</p>
                <p>Generated by SMEES Pro</p>
              </div>
            </body>
          </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
          win.document.write(content);
          win.document.close();
          // Timeout to ensure styles load before printing
          setTimeout(() => {
              win.print();
          }, 500);
        }
      };

      return (
        <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <div className="flex gap-2">
               {tx.status !== 'Cancelled' && <button onClick={shareInvoice} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-1"><Share2 size={16}/> PDF</button>}
               
               {/* --- FIX: Updated Buttons for Restore --- */}
               {checkPermission(user, 'canEditTasks') && (
                   <>
                       {tx.status !== 'Cancelled' ? (
                          <button onClick={() => cancelTransaction(tx.id)} className="p-2 bg-gray-100 text-gray-600 rounded-lg border hover:bg-red-50 hover:text-red-600 font-bold text-xs">Cancel</button>
                       ) : (
                          <div className="flex items-center gap-2">
                              <span className="px-2 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs border border-red-200">CANCELLED</span>
                              {/* NEW RESTORE BUTTON */}
                              <button onClick={() => restoreTransaction(tx.id)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-xs border border-green-200 hover:bg-green-200">
                                  Restore
                              </button>
                          </div>
                       )}
                       
                       {/* Edit Button (Only show if NOT Cancelled) */}
                       {tx.status !== 'Cancelled' && (
                           <button 
                                onClick={() => { 
                                    pushHistory(); 
                                    setModal({ type: tx.type, data: tx }); 
                                    // setViewDetail(null);  <--- IS LINE KO HATA DIYA
                                }} 
                                className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full"
                           >
                                Edit
                           </button>
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
                    <h3 className="font-bold text-yellow-800 text-xs uppercase mb-2">Related Transactions</h3>
                    <div className="space-y-2">
                        {relatedDocs.map((doc, idx) => (
                             <div key={idx} onClick={() => setViewDetail({ type: 'transaction', id: doc.id })} className="bg-white p-2 rounded-lg border flex justify-between items-center text-xs cursor-pointer active:scale-95">
                                     <div>
                                         <p className="font-bold text-gray-700">{doc.type} #{doc.id}</p>
                                         <p className="text-[10px] text-gray-400">{formatDate(doc.date)}</p>
                                     </div>
                                     <div className="flex items-center gap-1">
                                         <span className="text-gray-500">Linked:</span>
                                         <span className="font-bold text-green-600">{formatCurrency(doc.displayLinkAmount)}</span>
                                         <ChevronRight size={12} className="text-gray-400"/>
                                     </div>
                             </div>
                        ))}
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
            {/* FIX #5: Photos Link Button in Transaction Detail */}
            {tx.photosLink && (
                <div className="mt-2">
                    <a href={tx.photosLink} target="_blank" rel="noreferrer" className="w-full p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                        <span>📸</span> View Attached Photos/Album
                    </a>
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
                      const sell = parseFloat(item.price || 0);
                      const buy = parseFloat(item.buyPrice || m?.buyPrice || 0);
                      const itemProfit = (sell - buy) * parseFloat(item.qty || 0);
                      return (
                        <div key={i} className="flex justify-between p-3 border rounded-xl bg-white">
                          <div className="flex-1">
                              {/* --- FIX: Removed Duplicate Name Line here --- */}
                              
                              {/* Item Details Block */}
                              <div>
                                  <p className="font-bold text-sm">
                                      {m?.name || 'Item'} 
                                      {item.brand && <span className="text-purple-600 text-[10px] ml-1">({item.brand})</span>}
                                  </p>
                                  {item.description && <p className="text-[10px] text-gray-500 italic">{item.description}</p>}
                              </div>
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
        
 // --- FIX FOR TIMER SYNC (FETCH BEFORE SAVE) ---
const toggleTimer = async (staffId) => {
    if (!user) return;
    
    // UI par loading dikhane ke liye toast
    showToast("Updating Timer...", "info");

    try {
        const taskRef = doc(db, "tasks", task.id);
        
        // 1. Sabse pehle LATEST data server se lao (Taaki purana data overwrite na ho)
        const taskSnap = await getDoc(taskRef);
        
        if (!taskSnap.exists()) {
            showToast("Task not found!", "error");
            return;
        }

        const latestTask = taskSnap.data();
        const now = new Date().toISOString();
        const timestamp = new Date().toISOString();

        let newLogs = [...(latestTask.timeLogs || [])];
        const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

        let actionType = "";

        if (activeLogIndex >= 0) {
            // STOP TIMER logic on LATEST data
            const start = new Date(newLogs[activeLogIndex].start); 
            const end = new Date(now);
            const duration = ((end - start) / 1000 / 60).toFixed(0); 
            newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration };
            actionType = "Stopped";
        } else {
            // START TIMER logic
            // Conflict check abhi bhi local data se kar sakte hain UX ke liye
            const activeTask = data.tasks.find(t => t.timeLogs && t.timeLogs.some(l => l.staffId === staffId && !l.end));
            if (activeTask && activeTask.id !== task.id) { 
                pushHistory(); 
                setTimerConflict({ staffId, activeTaskId: activeTask.id, targetTaskId: task.id }); 
                return; 
            }

            const staffMember = data.staff.find(s => s.id === staffId);
            
            // Location fetch logic same rahega
            const getLocation = () => new Promise((resolve) => {
                if (navigator.geolocation) {
                     navigator.geolocation.getCurrentPosition(
                         (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 
                         () => resolve(null)
                     );
                } else resolve(null);
            });

            const locData = await getLocation();

            newLogs.push({ 
                 staffId, 
                 staffName: staffMember?.name || 'Staff', 
                 start: now, 
                 end: null, 
                 duration: 0,
                 location: locData 
            });
            actionType = "Started";
        }

        const updatedTask = { ...latestTask, timeLogs: newLogs, updatedAt: timestamp };
        
        // 2. Ab Save karo
        await setDoc(taskRef, updatedTask);

        // 3. Local State update karo
        setData(prev => ({ 
            ...prev, 
            tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) 
        }));

        showToast(`Timer ${actionType}`);

    } catch (e) {
        console.error("Timer Error:", e);
        showToast("Error syncing timer. Try again.", "error");
    }
};

// Helper function to update state and firebase
const updateTaskState = async (updatedTask) => {
    // 1. Local State Update
    setData(prev => ({ 
        ...prev, 
        tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) 
    }));
    
    // 2. Firebase Save (updatedAt zarur hona chahiye)
    await setDoc(doc(db, "tasks", updatedTask.id), updatedTask);
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
        // Check if CURRENT USER has an active timer
const isMyTimerRunning = task.timeLogs?.some(l => l.staffId === user.id && !l.end);

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
                    {/* CHANGE: Assigned Staff Names */}
    {task.assignedStaff && task.assignedStaff.length > 0 && (
        <div className="flex gap-1">
            {task.assignedStaff.map(sid => {
                const sName = data.staff.find(s => s.id === sid)?.name || 'Unknown';
                return <span key={sid} className="text-[10px] bg-gray-100 border px-1.5 py-0.5 rounded text-gray-600 font-bold">{sName}</span>;
            })}
        </div>
    )}
                    <p className="text-sm text-gray-600 my-4">{task.description}</p>
                    {/* FIX #5: Photos Link Button in Task Detail */}
                    {task.photosLink && (
                        <div className="mb-4">
                            <a href={task.photosLink} target="_blank" rel="noreferrer" className="w-full p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                                <span>📸</span> View Attached Photos/Album
                            </a>
                        </div>
                    )}

                    {/* REQ 1: Client Details UI (Updated for Multiple Contacts) */}
{party && (() => {
    const displayAddress = task.address || party.address;
    const locationLabel = task.locationLabel || '';
    
    // Logic: Agar task me selectedContacts hain to wo dikhao, nahi to Party ka default mobile
    const contactsToShow = (task.selectedContacts && task.selectedContacts.length > 0) 
        ? task.selectedContacts 
        : [{ label: 'Primary', number: party.mobile }];

    return (
        <div className="bg-white p-3 rounded-xl border mb-4 space-y-2">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">
                        Client {locationLabel && <span className="text-blue-600">({locationLabel})</span>}
                    </p>
                    <p className="font-bold text-gray-800">{party.name}</p>
                </div>
                {/* CHANGE: Map Pin Logic Fixed */}
                        {(() => {
                            // Logic: 
                            // 1. Agar Task me address set hai (matlab user ne select kiya hai), to sirf Task ka Lat/Lng use karo.
                            // 2. Agar Task me address nahi hai (Legacy data), to Party ka Default use karo.
                            // 3. Agar Task ka Lat empty hai (Address hai par location nahi), to Map Pin MAT dikhao.
                            
                            const useTaskCoords = !!task.address; 
                            const showMap = useTaskCoords ? !!task.lat : !!party.lat;
                            const mapLat = useTaskCoords ? task.lat : party.lat;
                            const mapLng = useTaskCoords ? task.lng : party.lng;

                            if (!showMap) return null;

                            return (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <MapPin size={16}/>
                                </a>
                            );
                        })()}
            </div>

            {/* Render Multiple Mobiles */}
            <div className="space-y-1">
                {contactsToShow.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] bg-gray-100 px-1 rounded text-gray-500 font-bold">{c.label}</span>
                        <a href={`tel:${c.number}`} className="text-sm font-bold text-blue-600 flex items-center gap-1">
                            <Phone size={14}/> {c.number}
                        </a>
                      </div>
                ))}
            </div>

            {displayAddress && <p className="text-xs text-gray-500 border-t pt-2 mt-1">{displayAddress}</p>}
        </div>
    );
})()}
                    
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
                                    {/* FIX #7: Show Item Name + Brand in Task Detail */}
                                    <div className="flex flex-col">
                                        <span>{data.items.find(i=>i.id===line.itemId)?.name || 'Unknown Item'}</span>
                                        {line.brand && <span className="text-[10px] text-purple-600 font-bold">({line.brand})</span>}
                                    </div>
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
                    {/* --- NEW CODE START: Detail View Total --- */}
                {task.itemsUsed && task.itemsUsed.length > 0 && (
                    <div className="flex justify-end pt-3 border-t border-gray-200 mb-2">
                        <div className="text-right">
                            <span className="text-xs font-bold text-gray-400 uppercase mr-2">Total Value</span>
                            <span className="text-lg font-black text-gray-800">
                                {formatCurrency(
                                    task.itemsUsed.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)), 0)
                                )}
                            </span>
                        </div>
                    </div>
                )}
                {/* --- NEW CODE END --- */}
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
            {/* --- FLOATING TIMER BUTTON (NEW) --- */}
<button
    onClick={() => toggleTimer(user.id)}
    className={`fixed bottom-6 right-6 z-[70] shadow-2xl flex items-center justify-center gap-2 px-6 py-4 rounded-full transition-all active:scale-90 font-black text-white tracking-widest ${
        isMyTimerRunning 
        ? 'bg-red-600 shadow-red-200 animate-pulse' 
        : 'bg-green-600 shadow-green-200'
    }`}
>
    {isMyTimerRunning ? (
        <>
            <Square size={20} fill="currentColor" /> STOP
        </>
    ) : (
        <>
            <Play size={20} fill="currentColor" /> START
        </>
    )}
</button>
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

    // --- 1. ITEM DETAIL VIEW (Fixed: Multi-Brand Entry & Tab View) ---
    if (viewDetail.type === 'item') {
        // State for Tab switching (Default 'All')
        // Note: Hook ko conditional block me nahi daal sakte, par kyunki ye pura App component re-render hoga,
        // hum isse 'App' component ke top level state me maan kar yahan local variable use kar rahe hain.
        // BEHTAR SOLUTION: Isse alag component banana chahiye, par abhi quick fix ke liye:
        // Hum 'useState' ko yahan define nahi kar sakte agar ye conditional return ke andar hai.
        // ISLIYE: Hum 'activeBrand' state ko ItemDetailView naam ke naye component me daalenge.
        
        // --- INTERNAL COMPONENT FOR ITEM DETAIL ---
        const ItemDetailInner = ({ record }) => {
            const [activeBrand, setActiveBrand] = useState('All');

            // 1. Data Processing (Fix for Issue 1: Multiple entries in same bill)
            const processedData = useMemo(() => {
                const groups = { 'All': [] };
                const stats = { 'All': 0 }; // To track stock per brand

                // Transactions sort karein
                const sortedTxs = data.transactions
                    .filter(tx => tx.status !== 'Cancelled' && tx.items?.some(l => l.itemId === record.id))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                sortedTxs.forEach(tx => {
                    // CRITICAL FIX: .find() ki jagah .filter() use kiya
                    // Taaki agar ek bill me 2 baar item hai to dono milein
                    const matchingLines = tx.items.filter(l => l.itemId === record.id);
                    
                    matchingLines.forEach(line => {
                        const brand = line.brand || 'Uncategorized';
                        
                        // Calculation Logic
                        const qty = parseFloat(line.qty || 0);
                        const isOut = tx.type === 'sales'; // Sale hai to minus
                        const movement = isOut ? -qty : qty;

                        // 1. Add to 'All' Group
                        groups['All'].push({ tx, line });
                        stats['All'] += movement;

                        // 2. Add to Specific Brand Group
                        if (!groups[brand]) {
                            groups[brand] = [];
                            stats[brand] = 0;
                        }
                        groups[brand].push({ tx, line });
                        stats[brand] += movement;
                    });
                });
                return { groups, stats };
            }, [record, data.transactions]);

            const { groups, stats } = processedData;
            const currentList = groups[activeBrand] || [];
            
            // Available Brands for Tabs
            const brands = Object.keys(groups).filter(k => k !== 'All').sort();

            return (
                <div id="detail-scroller" className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                    <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                        <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                        <h2 className="font-bold text-lg truncate max-w-[150px]">{record.name}</h2>
                        <button onClick={() => { pushHistory(); setModal({ type: 'item', data: record }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Main Stock Card */}
                        <div className="p-4 bg-gray-50 rounded-2xl border">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Stock</p>
                                    <p className="text-2xl font-black text-blue-600">{itemStock[record.id] || 0} <span className="text-sm text-gray-400">{record.unit}</span></p>
                                </div>
                                <div className="text-right">
                                     <p className="text-[10px] font-bold text-gray-400 uppercase">Selected: {activeBrand}</p>
                                     <p className={`text-xl font-bold ${stats[activeBrand] < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {stats[activeBrand] > 0 ? '+' : ''}{stats[activeBrand]}
                                     </p>
                                </div>
                            </div>
                        </div>

                        {/* TABS (Brand Filter) */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <button 
                                onClick={() => setActiveBrand('All')} 
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${activeBrand === 'All' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                Show All ({groups['All'].length})
                            </button>
                            {brands.map(b => (
                                <button 
                                    key={b} 
                                    onClick={() => setActiveBrand(b)} 
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${activeBrand === b ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    {b} ({stats[b] > 0 ? '+' : ''}{stats[b]})
                                </button>
                            ))}
                        </div>

                        {/* TRANSACTIONS LIST */}
                        <div className="space-y-2">
                            {currentList.map(({ tx, line }, idx) => {
                                const qty = parseFloat(line.qty || 0);
                                const isOut = tx.type === 'sales';
                                const displayQty = isOut ? -qty : qty;
                                const color = isOut ? 'text-red-600' : 'text-green-600';

                                return (
                                    <div key={`${tx.id}-${idx}`} onClick={() => { pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-3 bg-white border rounded-xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800 text-xs uppercase">{tx.type} #{tx.id}</span>
                                                {/* Agar 'All' tab hai to Brand ka badge dikhao */}
                                                {activeBrand === 'All' && line.brand && (
                                                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-bold">{line.brand}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(tx.date)} • {data.parties.find(p=>p.id===tx.partyId)?.name || 'Cash'}</p>
                                        </div>
                                        
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${color}`}>
                                                {displayQty > 0 ? '+' : ''}{displayQty} {record.unit}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold">
                                                {formatCurrency(line.price * qty)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {currentList.length === 0 && <p className="text-center text-gray-400 py-10">No transactions in this category.</p>}
                        </div>
                    </div>
                </div>
            );
        };

        const record = data.items.find(r => r.id === viewDetail.id);
        if (!record) return null;

        // Render Internal Component to use Hooks properly
        return <ItemDetailInner record={record} />;
    }

    // --- 2. PARTY DETAIL VIEW (Old Logic Preserved) ---
    if (viewDetail.type === 'party') {
        const record = data.parties.find(r => r.id === viewDetail.id);
        if (!record) return null;

        // --- CHANGE 2: Filter State ---
        // Hum hook ko component ke andar define nahi kar sakte agar wo loop me hai.
        // Isliye hum yahan ek Internal Component banayenge (Jaisa ItemDetailInner banaya tha)
        const PartyDetailInner = ({ record }) => {
            const [activeTab, setActiveTab] = useState('transactions');
            const [filter, setFilter] = useState('All');
            const [selectedAsset, setSelectedAsset] = useState(null);
            const [editingAsset, setEditingAsset] = useState(null);
            
            // --- EDIT & DELETE LOGIC ---
            const handleDeleteAsset = async (assetName) => {
                if(!window.confirm(`Delete "${assetName}"?`)) return;
                const updatedAssets = record.assets.filter(a => a.name !== assetName);
                const updatedParty = { ...record, assets: updatedAssets };
                setData(prev => ({ ...prev, parties: prev.parties.map(p => p.id === record.id ? updatedParty : p) }));
                await setDoc(doc(db, "parties", record.id), updatedParty);
            };

            const handleUpdateAsset = async () => {
                if(!editingAsset || !editingAsset.name) return;
                const updatedAssets = record.assets.map((a, i) => i === editingAsset.index ? { ...editingAsset } : a);
                const updatedParty = { ...record, assets: updatedAssets };
                setData(prev => ({ ...prev, parties: prev.parties.map(p => p.id === record.id ? updatedParty : p) }));
                await setDoc(doc(db, "parties", record.id), updatedParty);
                setEditingAsset(null);
            };

            const getHistory = (assetId = null) => {
                 return data.transactions
                .filter(tx => tx.partyId === record.id)
                .filter(tx => assetId ? (tx.linkedAssets && tx.linkedAssets.some(a => a.name === assetId)) : true)
                .filter(tx => {
                    if (filter === 'All') return true;
                    if (filter === 'Sales') return tx.type === 'sales';
                    if (filter === 'Purchase') return tx.type === 'purchase';
                    if (filter === 'Expense') return tx.type === 'expense';
                    if (filter === 'Payment') return tx.type === 'payment';
                    return true;
                })
                .sort((a,b) => new Date(b.date) - new Date(a.date));
            };

            const history = getHistory(null);
            const assetHistory = selectedAsset ? getHistory(selectedAsset.name) : [];
            const mobiles = String(record.mobile || '').split(',').map(m => m.trim()).filter(Boolean);

            if (selectedAsset) {
                return (
                    <div className="fixed inset-0 z-[65] bg-white overflow-y-auto animate-in slide-in-from-right">
                        <div className="sticky top-0 bg-white border-b p-4 flex items-center gap-3 shadow-sm z-10">
                             <button onClick={() => setSelectedAsset(null)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                             <div><h2 className="font-bold text-lg">{selectedAsset.name}</h2><p className="text-xs text-gray-500">{selectedAsset.brand} • {selectedAsset.model}</p></div>
                        </div>
                        <div className="p-4 space-y-4">
                             {/* --- NEW: VIEW PHOTO BUTTON --- */}
                             {selectedAsset.photosLink && (
                                <a href={selectedAsset.photosLink} target="_blank" rel="noreferrer" className="w-full p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                                    <span>📸</span> View Asset Photos
                                </a>
                             )}

                             <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                                <div className="flex justify-between"><span className="text-xs font-bold text-gray-500 uppercase">Next Service</span><span className={`font-bold ${new Date(selectedAsset.nextServiceDate) <= new Date() ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>{selectedAsset.nextServiceDate || 'Not Set'}</span></div>
                                <button onClick={() => window.open(`https://wa.me/${record.mobile}?text=${encodeURIComponent(`Hello ${record.name}, Reminder for your ${selectedAsset.name} (${selectedAsset.brand}) service. Due: ${selectedAsset.nextServiceDate}.`)}`, '_blank')} className="w-full mt-2 py-2 bg-green-100 text-green-700 rounded-lg font-bold flex items-center justify-center gap-2"><MessageCircle size={16}/> WhatsApp Reminder</button>
                            </div>

                             <h3 className="font-bold text-gray-700">Service History</h3>
                             {assetHistory.length === 0 ? <p className="text-gray-400 text-sm italic">No service records found.</p> : assetHistory.map(tx => (
                                 <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-3 bg-white border rounded-xl flex justify-between items-center mb-2 cursor-pointer">
                                     <div><p className="font-bold text-sm text-gray-800">{tx.type} #{tx.id}</p><p className="text-xs text-gray-500">{formatDate(tx.date)}</p></div>
                                     <span className="font-bold text-blue-600">{formatCurrency(getTransactionTotals(tx).final)}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                );
            }

            return (
              <div id="detail-scroller" className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                  <h2 className="font-bold text-lg">{record.name}</h2>
                  <div className="flex gap-2">
                     <button onClick={() => { pushHistory(); setStatementModal({ partyId: record.id }); }} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1"><FileText size={12}/> Stmt</button>
                     <button onClick={() => { pushHistory(); setModal({ type: 'party', data: record }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
                  </div>
                </div>
                
                <div className="p-4 space-y-6">
                   <div className="p-4 bg-gray-50 rounded-2xl border">
                         <p className="text-[10px] font-bold text-gray-400 uppercase">Current Balance</p>
                         <p className={`text-2xl font-black ${partyBalances[record.id] > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(partyBalances[record.id] || 0))}</p>
                         <div className="flex justify-between items-end"><p className="text-[10px] font-bold text-gray-400">{partyBalances[record.id] > 0 ? 'TO PAY' : 'TO COLLECT'}</p><div className="text-right">{mobiles.map((m, i) => <p key={i} className="text-sm font-bold flex items-center justify-end gap-1"><Phone size={12}/> <a href={`tel:${m}`}>{m}</a></p>)}</div></div>
                   </div>

                   <div className="flex bg-gray-100 p-1 rounded-xl">
                       <button onClick={() => setActiveTab('transactions')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'transactions' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Transactions</button>
                       <button onClick={() => setActiveTab('assets')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'assets' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Assets / AMC</button>
                   </div>

                   {activeTab === 'transactions' && (
                       <div className="space-y-3">
                         <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{['All', 'Sales', 'Purchase', 'Payment', 'Expense'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>{f}</button>)}</div>
                         {history.map(tx => {
                           const totals = getBillStats(tx, data.transactions);
                           const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
                           const unusedAmount = tx.type === 'payment' ? (totals.amount - (totals.used || 0)) : 0;
                           let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
                           if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
                           if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
                           if (tx.type === 'payment') { Icon = Banknote; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }
                           let displayAmount = totals.amount;
                           return (
                             <div key={tx.id} onClick={() => { const el = document.getElementById('detail-scroller'); if(el) scrollPos.current[record.id] = el.scrollTop; setNavStack(prev => [...prev, viewDetail]); pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                               <div className="flex gap-4 items-center">
                                 <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                                 <div>
                                   <p className="font-bold text-gray-800 uppercase text-xs">{tx.type} #{tx.id}</p>
                                   <p className="text-[10px] text-gray-400 font-bold">{formatDate(tx.date)}</p>
{/* CHANGE: Show Linked Asset in List */}
{tx.linkedAssets && tx.linkedAssets.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1">
        {tx.linkedAssets.map((a, ai) => (
            <span key={ai} className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-bold flex items-center gap-1">
                <Package size={8}/> {a.name}
            </span>
        ))}
    </div>
)}
                                   <div className="flex gap-1 mt-1">
                                       {['sales', 'purchase', 'expense', 'payment'].includes(tx.type) && (
                                           <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${(totals.status === 'PAID' || totals.status === 'FULLY USED') ? 'bg-green-100 text-green-700' : (totals.status === 'PARTIAL' || totals.status === 'PARTIALLY USED') ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{totals.status}</span>
                                       )}
                                   </div>
                                 </div>
                               </div>
                               <div className="text-right">
                                   <p className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(displayAmount)}</p>
                                   {['sales', 'purchase', 'expense'].includes(tx.type) && totals.status !== 'PAID' && tx.status !== 'Cancelled' && <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(totals.pending)}</p>}
                                   {tx.type === 'payment' && unusedAmount > 0.1 && <p className="text-[10px] font-bold text-orange-600">Unused: {formatCurrency(unusedAmount)}</p>}
                               </div>
                             </div>
                           );
                        })}
                        {history.length === 0 && <p className="text-center text-gray-400 italic py-4">No records found.</p>}
                       </div>
                   )}

                   {activeTab === 'assets' && (
                       <div className="space-y-3">
                           {(record.assets || []).length === 0 ? <div className="text-center py-10 text-gray-400">No Assets</div> : 
                            record.assets.map((asset, idx) => {
                                const isDue = asset.nextServiceDate && new Date(asset.nextServiceDate) <= new Date();
                                return (
                                   <div key={idx} className={`p-4 bg-white border rounded-2xl relative group ${isDue ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
                                       <div className="absolute top-3 right-3 flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingAsset({...asset, index: idx}); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={14}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.name); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={14}/></button>
                                       </div>
                                       <div onClick={() => setSelectedAsset(asset)} className="cursor-pointer">
                                           <div className="flex justify-between items-start mb-2">
                                               <div>
                                                   <p className="font-bold text-gray-800 text-lg">{asset.name}</p>
                                                   <p className="text-xs text-gray-500 font-bold">{asset.brand} {asset.model}</p>
                                               </div>
                                               {isDue && <span className="bg-red-100 text-red-700 text-[9px] font-black px-2 py-1 rounded uppercase animate-pulse mr-16">Due</span>}
                                           </div>
                                           <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                                               <Calendar size={14}/> <span>Next Service: <span className={`font-bold ${isDue ? 'text-red-600' : 'text-green-600'}`}>{asset.nextServiceDate ? formatDate(asset.nextServiceDate) : 'N/A'}</span></span>
                                           </div>
                                           {/* --- NEW: PHOTO INDICATOR BADGE --- */}
                                           {asset.photosLink && <div className="mt-1 text-[9px] text-blue-600 font-bold flex items-center gap-1">📸 Photo Attached</div>}
                                           
                                           <div className="mt-2 text-[10px] text-blue-600 font-bold flex items-center justify-end gap-1">View History <ChevronRight size={12}/></div>
                                       </div>
                                   </div>
                               );
                            })
                           }
                       </div>
                   )}

                   {/* --- EDIT ASSET MODAL WITH PHOTO INPUT --- */}
                   {editingAsset && (
                       <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
                           <div className="bg-white p-4 rounded-2xl w-full max-w-sm animate-in zoom-in-95">
                               <h3 className="font-bold text-lg mb-4">Edit Asset</h3>
                               <div className="space-y-3">
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Name</label><input className="w-full p-2 border rounded-lg" value={editingAsset.name} onChange={e => setEditingAsset({...editingAsset, name: e.target.value})} /></div>
                                   <div className="flex gap-2">
                                       <div><label className="text-[10px] font-bold text-gray-400 uppercase">Brand</label><input className="w-full p-2 border rounded-lg" value={editingAsset.brand} onChange={e => setEditingAsset({...editingAsset, brand: e.target.value})} /></div>
                                       <div><label className="text-[10px] font-bold text-gray-400 uppercase">Model</label><input className="w-full p-2 border rounded-lg" value={editingAsset.model} onChange={e => setEditingAsset({...editingAsset, model: e.target.value})} /></div>
                                   </div>
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Photo Link</label><input className="w-full p-2 border rounded-lg text-blue-600" placeholder="Google Photos Link" value={editingAsset.photosLink || ''} onChange={e => setEditingAsset({...editingAsset, photosLink: e.target.value})} /></div>
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Next Service Date</label><input type="date" className="w-full p-2 border rounded-lg bg-red-50" value={editingAsset.nextServiceDate} onChange={e => setEditingAsset({...editingAsset, nextServiceDate: e.target.value})} /></div>
                               </div>
                               <div className="grid grid-cols-2 gap-3 mt-4">
                                   <button onClick={() => setEditingAsset(null)} className="p-3 bg-gray-100 text-gray-600 font-bold rounded-xl">Cancel</button>
                                   <button onClick={handleUpdateAsset} className="p-3 bg-blue-600 text-white font-bold rounded-xl">Update</button>
                               </div>
                           </div>
                       </div>
                   )}
                </div>
              </div>
            );
        };
        
        return <PartyDetailInner record={record} />;
    }
    
    return null;
};

  // --- UPDATED CATEGORY MANAGER (Button/Tag Style Layout) ---
  const CategoryManager = () => {
      const [activeType, setActiveType] = useState('expense'); // 'expense' or 'taskStatus'
      const [newCat, setNewCat] = useState('');
      const [editingCat, setEditingCat] = useState(null);
      
      const config = activeType === 'expense' 
          ? { title: 'Expense Categories', key: 'expense' } 
          : { title: 'Task Statuses', key: 'taskStatus' };

      const handleAdd = async () => {
          if(!newCat.trim()) return;
          const current = data.categories[config.key] || [];
          if(current.some(c => c.toLowerCase() === newCat.trim().toLowerCase())) return showToast("Already exists", "error");
          
          const updatedList = [...current, newCat.trim()];
          const fullCats = { ...data.categories, [config.key]: updatedList };
          
          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          setNewCat('');
          showToast("Added Successfully");
      };

      const handleUpdate = async (original, newName) => {
          if (!newName || !newName.trim()) return;
          const current = data.categories[config.key] || [];
          
          if(current.some(c => c !== original && c.toLowerCase() === newName.trim().toLowerCase())) {
              return showToast("Already exists", "error");
          }

          const updatedList = current.map(c => c === original ? newName.trim() : c);
          const fullCats = { ...data.categories, [config.key]: updatedList };
          
          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          setEditingCat(null);
          showToast("Updated Successfully");
      };

      const handleDelete = async (catName) => {
          if(!window.confirm(`Delete "${catName}"?`)) return;
          const updatedList = (data.categories[config.key] || []).filter(c => c !== catName);
          const fullCats = { ...data.categories, [config.key]: updatedList };
          setData(prev => ({ ...prev, categories: fullCats }));
          await setDoc(doc(db, "settings", "categories"), fullCats);
          showToast("Deleted");
      };

      return (
        <div className="space-y-4">
              {/* TABS (Side by Side Buttons) */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                  <button onClick={()=>setActiveType('expense')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeType==='expense' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Expense Categories</button>
                  <button onClick={()=>setActiveType('taskStatus')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeType==='taskStatus' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Task Statuses</button>
              </div>

              <div className="flex justify-between items-center mb-2">
                  <h1 className="text-xl font-bold">{config.title}</h1>
              </div>
              
              {/* ADD NEW INPUT */}
              <div className="flex gap-2">
                  <input className="flex-1 p-3 bg-gray-50 border rounded-xl" placeholder={`New ${activeType === 'expense' ? 'Category' : 'Status'}...`} value={newCat} onChange={e=>setNewCat(e.target.value)} />
                  <button onClick={handleAdd} className="p-3 bg-blue-600 text-white rounded-xl"><Plus/></button>
              </div>

              {/* LIST AREA (Changed from Vertical Stack to Flex Wrap Buttons) */}
              <div className="flex flex-wrap gap-3 pt-2">
                  {(data.categories[config.key] || []).map((cat, idx) => (
                      <div key={idx} className="animate-in zoom-in duration-200">
                          {editingCat?.original === cat ? (
                              // EDIT MODE (Small Input Bubble)
                              <div className="flex items-center gap-1 pl-2 pr-1 py-1 bg-blue-50 border border-blue-200 rounded-full shadow-sm">
                                  <input 
                                    className="bg-transparent border-none text-sm font-bold text-blue-800 w-24 focus:ring-0 px-1" 
                                    value={editingCat.current} 
                                    autoFocus 
                                    onChange={e => setEditingCat({ ...editingCat, current: e.target.value })} 
                                  />
                                  <button onClick={() => handleUpdate(cat, editingCat.current)} className="p-1.5 bg-green-100 text-green-600 rounded-full hover:bg-green-200"><CheckCircle2 size={14}/></button>
                                  <button onClick={() => setEditingCat(null)} className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"><X size={14}/></button>
                              </div>
                          ) : (
                              // VIEW MODE (Button/Pill Style)
                              <div className="flex items-center gap-2 pl-4 pr-2 py-2 bg-white border rounded-full shadow-sm hover:shadow-md transition-shadow group">
                                  <span className="font-bold text-gray-700 text-sm">{cat}</span>
                                  
                                  {/* Edit/Delete Icons (Divider ke saath) */}
                                  <div className="flex items-center gap-1 border-l pl-2 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => setEditingCat({ original: cat, current: cat })} className="text-blue-500 hover:text-blue-700"><Edit2 size={12}/></button>
                                      <button onClick={() => handleDelete(cat)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
                  
                  {(data.categories[config.key] || []).length === 0 && (
                      <p className="w-full text-center text-gray-400 py-4 italic">No items found. Add one above.</p>
                  )}
              </div>
        </div>
      );
  };

  // 2. Forms
  const TransactionForm = ({ type, record }) => {
    const [tx, setTx] = useState(record ? { 
        linkedBills: [], items: [], paymentMode: 'Cash', 
        discountType: '%', discountValue: 0, 
        linkedAssets: record.linkedAssets || [], // <--- CHANGED: Array support
        nextServiceDate: '', // For UI Input only
        ...record 
    } : { 
        type, date: new Date().toISOString().split('T')[0], 
        partyId: '', items: [], discountType: '%', discountValue: 0, 
        received: 0, paid: 0, paymentMode: 'Cash', 
        category: '', subType: type === 'payment' ? 'in' : '', amount: '', linkedBills: [], description: '',
        address: '', mobile: '', lat: '', lng: '', locationLabel: '',
        linkedAssets: [], // <--- CHANGED
        nextServiceDate: ''
    });
    // ... (States same as before) ...
    const [showLinking, setShowLinking] = useState(false);
    const [showLocPicker, setShowLocPicker] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');

    // ... (Helpers: currentVoucherId, totals, selectedParty, handleLocationSelect, unpaidBills, updateLine, itemOptions, partyOptions, handleLinkChange, allBrands) ...
    // Note: In helpers ko wesa hi rakhein jaisa pichle code me tha.

    // COPY THESE HELPERS FROM YOUR PREVIOUS CODE OR KEEP AS IS
    const currentVoucherId = useMemo(() => { if (record?.id) return record.id; return getNextId(data, type).id; }, [data, type, record]);
    const totals = getTransactionTotals(tx);
    const selectedParty = data.parties.find(p => p.id === tx.partyId);
    const handleLocationSelect = (loc) => { setTx({...tx, address: loc.address, mobile: loc.mobile || selectedParty?.mobile || '', lat: loc.lat || '', lng: loc.lng || '', locationLabel: loc.label }); setShowLocPicker(false); };
    const unpaidBills = useMemo(() => { if (!tx.partyId) return []; return data.transactions.filter(t => { if (t.partyId !== tx.partyId || t.id === tx.id || t.type === 'estimate' || t.status === 'Cancelled') return false; const isAlreadyLinked = tx.linkedBills?.some(l => l.billId === t.id); if (isAlreadyLinked) return true; const stats = getBillStats(t, data.transactions); if (type === 'payment') { return ['sales', 'purchase', 'expense'].includes(t.type) && stats.status !== 'PAID'; } if (['sales', 'purchase', 'expense'].includes(type)) { if (t.type === 'payment' && stats.status !== 'FULLY USED') { if (type === 'sales' && t.subType === 'in') return true; if ((type === 'purchase' || type === 'expense') && t.subType === 'out') return true; return false; } } return false; }); }, [tx.partyId, data.transactions, tx.linkedBills, type]);
    const updateLine = (idx, field, val) => { const newItems = [...tx.items]; newItems[idx][field] = val; if (field === 'itemId') { const item = data.items.find(i => i.id === val); if (item) { newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice; newItems[idx].buyPrice = item.buyPrice; newItems[idx].description = item.description || ''; newItems[idx].brand = ''; } } if (field === 'brand') { const item = data.items.find(i => i.id === newItems[idx].itemId); if (item && item.brands) { const brandData = item.brands.find(b => b.name === val); if (brandData) { newItems[idx].price = type === 'purchase' ? brandData.buyPrice : brandData.sellPrice; newItems[idx].buyPrice = brandData.buyPrice; } else if (!val) { newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice; newItems[idx].buyPrice = item.buyPrice; } } } setTx({ ...tx, items: newItems }); };
    const itemOptions = data.items.map(i => ({ ...i, subText: `Stock: ${itemStock[i.id] || 0}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    const partyOptions = data.parties.map(p => ({ ...p, subText: partyBalances[p.id] ? formatCurrency(Math.abs(partyBalances[p.id])) + (partyBalances[p.id]>0?' DR':' CR') : 'Settled', subColor: partyBalances[p.id]>0?'text-green-600':partyBalances[p.id]<0?'text-red-600':'text-gray-400' }));
    const handleLinkChange = (billId, value) => { const amt = parseFloat(value) || 0; let maxLimit = totals.final; if (type === 'payment') { const baseAmt = parseFloat(tx.amount || 0); const disc = parseFloat(tx.discountValue || 0); maxLimit = baseAmt + disc; } if (maxLimit <= 0) { alert("Please enter the Payment Amount first."); return; } let newLinked = [...(tx.linkedBills || [])]; const existingIdx = newLinked.findIndex(l => l.billId === billId); if (existingIdx >= 0) { if (amt <= 0) newLinked.splice(existingIdx, 1); else newLinked[existingIdx] = { ...newLinked[existingIdx], amount: amt }; } else if (amt > 0) { newLinked.push({ billId, amount: amt }); } const currentTotal = newLinked.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0); if (currentTotal > maxLimit) { alert(`Cannot link more than the Payment Amount (${maxLimit}). Current Total: ${currentTotal}`); return; } setTx({ ...tx, linkedBills: newLinked }); };
    
    // --- Helper to add asset ---

    // --- State update for Duration ---
    const [serviceInterval, setServiceInterval] = useState(3); // Default 3 Months
    const handleAddAsset = (assetName) => {
        if (!assetName) return;
        // Default Next Date: +3 Months
        const d = new Date(tx.date);
        d.setMonth(d.getMonth() + parseInt(serviceInterval));
        const defaultDate = d.toISOString().split('T')[0];
        
        // Prevent duplicate
        if (tx.linkedAssets.some(a => a.name === assetName)) return;

        setTx({
            ...tx,
            linkedAssets: [...tx.linkedAssets, { name: assetName, nextServiceDate: defaultDate }]
        });
    };

    const updateAssetDate = (idx, date) => {
        const newAssets = [...tx.linkedAssets];
        newAssets[idx].nextServiceDate = date;
        setTx({ ...tx, linkedAssets: newAssets });
    };

    const removeAsset = (idx) => {
        const newAssets = [...tx.linkedAssets];
        newAssets.splice(idx, 1);
        setTx({ ...tx, linkedAssets: newAssets });
    };

    // Auto Round Off Effect
    useEffect(() => {
        const gross = tx.items?.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.price || 0)), 0) || 0;
        let discVal = parseFloat(tx.discountValue || 0);
        if (tx.discountType === '%') discVal = (gross * discVal) / 100;
        const rawTotal = gross - discVal;
        const roundedTotal = Math.round(rawTotal);
        const autoRound = (roundedTotal - rawTotal).toFixed(2);
        if (parseFloat(tx.roundOff || 0).toFixed(2) !== autoRound) {
            setTx(prev => ({ ...prev, roundOff: autoRound }));
        }
    }, [tx.items, tx.discountValue, tx.discountType]);

    return (
      <div className="space-y-4">
        {/* Header, Date, Party Select (Same as before) */}
        <div className="flex justify-between items-center border-b pb-2">
            <div><h2 className="text-xl font-bold capitalize">{type}</h2><p className="text-xs font-bold text-gray-500">Voucher: #{currentVoucherId}</p></div>
            <div className="text-right"><p className="text-xs font-bold text-gray-400">Total</p><p className="text-xl font-black text-blue-600">{formatCurrency(totals.final)}</p></div>
        </div>
        {type === 'payment' && ( <div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={()=>setTx({...tx, subType: 'in'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType==='in' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>Received (In)</button><button onClick={()=>setTx({...tx, subType: 'out'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType==='out' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Paid (Out)</button></div> )}
        <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Date</label><input type="date" className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-sm h-[50px]" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} /></div>
        <div>
             <SearchableSelect label={type === 'expense' ? "Paid To (Party)" : "Party / Client"} options={partyOptions} value={tx.partyId} onChange={v => setTx({...tx, partyId: v, locationLabel: '', address: ''})} onAddNew={() => { pushHistory(); setModal({ type: 'party' }); }} placeholder="Select Party..." />
             
             {/* --- FIX 3: MULTIPLE ASSET LINKING SECTION --- */}
             {['sales'].includes(type) && tx.partyId && (selectedParty?.assets?.length > 0) && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3 mt-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-1"><Package size={12}/> Link Assets / AMC</label>
                        <span className="text-[9px] text-green-600 font-bold">{tx.linkedAssets?.length} Linked</span>
                    </div>
                    
                    {/* List of Selected Assets (Same as before) */}
                    <div className="space-y-2">
                        {tx.linkedAssets.map((asset, idx) => (
                            <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-xs text-indigo-900">{asset.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] text-gray-400 uppercase">Next Service:</span>
                                        <input 
                                            type="date" 
                                            className="p-1 border rounded text-[10px] font-bold" 
                                            value={asset.nextServiceDate} 
                                            onChange={(e) => updateAssetDate(idx, e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button onClick={() => removeAsset(idx)} className="text-red-400 p-1 hover:bg-red-50 rounded"><X size={14}/></button>
                            </div>
                        ))}
                    </div>

                    {/* NEW: DURATION SELECTOR & ADD ASSET */}
                    <div className="flex gap-2">
                        {/* Duration Dropdown */}
                        <select 
                            className="w-1/3 p-2 border rounded-lg text-xs bg-white font-bold"
                            value={serviceInterval}
                            onChange={(e) => setServiceInterval(parseInt(e.target.value))}
                        >
                            <option value="1">1 Month</option>
                            <option value="3">3 Months</option>
                            <option value="6">6 Months</option>
                            <option value="12">1 Year</option>
                        </select>

                        {/* Add Asset Dropdown */}
                        <select 
                            className="w-2/3 p-2 border rounded-lg text-xs bg-white text-indigo-600 font-bold outline-none"
                            value=""
                            onChange={(e) => handleAddAsset(e.target.value)}
                        >
                            <option value="">+ Add Asset ({serviceInterval}M)</option>
                            {selectedParty.assets.map((a, i) => (
                                <option key={i} value={a.name} disabled={tx.linkedAssets.some(la => la.name === a.name)}>
                                    {a.name} ({a.brand}) {tx.linkedAssets.some(la => la.name === a.name) ? '✓' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1">*Selected Assets auto-set to +{serviceInterval} Months from Invoice Date.</p>
                </div>
             )}
             
             {/* ... (Mobile/Location Picker Code same as before) ... */}
             {(selectedParty?.locations?.length > 0 || selectedParty?.mobileNumbers?.length > 0) && (
                <div className="relative mt-1 mb-2">
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                         <div className="text-xs text-blue-800 overflow-hidden"><span className="font-bold">Selected: </span> <span className="font-bold bg-white px-1 rounded ml-1">{tx.locationLabel || 'Default'}</span><div className="truncate max-w-[200px] text-gray-600 mt-0.5">{tx.address || selectedParty.address}</div><div className="font-bold text-green-700 flex items-center gap-1"><Phone size={10}/> {tx.mobile || selectedParty.mobile}</div></div>
                         <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[10px] font-bold bg-white border px-3 py-2 rounded-lg shadow-sm text-blue-600 whitespace-nowrap">Change</button>
                    </div>
                    {showLocPicker && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto">
                            <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile, lat: selectedParty.lat, lng: selectedParty.lng })} className="p-2 hover:bg-gray-50 border-b cursor-pointer bg-gray-50 rounded mb-1"><span className="font-bold text-xs text-gray-600">Default Details</span><div className="text-[10px]">{selectedParty.mobile}</div></div>
                            {selectedParty.mobileNumbers?.length > 0 && (<div className="mb-2 border-b pb-2"><div className="flex justify-between items-center mb-1"><p className="text-[10px] font-bold text-gray-400 uppercase">Mobile Numbers (Multi-Select)</p><span className="text-[9px] text-blue-400">(Tap to Add/Remove)</span></div>{selectedParty.mobileNumbers.map((mob, idx) => { const isSelected = tx.mobile?.includes(mob.number); return (<div key={`mob-${idx}`} onClick={(e) => { e.stopPropagation(); let currentNums = tx.mobile ? tx.mobile.split(', ').map(s => s.trim()).filter(Boolean) : []; if (isSelected) { currentNums = currentNums.filter(n => n !== mob.number); } else { currentNums.push(mob.number); } setTx({ ...tx, mobile: currentNums.join(', ') }); }} className={`p-2 cursor-pointer border-b flex justify-between items-center transition-colors ${isSelected ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}><span className={`text-xs font-bold flex items-center gap-1 ${isSelected ? 'text-green-700' : 'text-gray-600'}`}><Phone size={10}/> {mob.label}</span><div className="flex items-center gap-2"><span className={`text-xs font-mono ${isSelected ? 'font-bold text-black' : 'text-gray-500'}`}>{mob.number}</span>{isSelected && <CheckCircle2 size={14} className="text-green-600"/>}</div></div>); })}</div>)}
                            {selectedParty.locations?.length > 0 && (<div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Addresses</p>{selectedParty.locations.map((loc, idx) => (<div key={`loc-${idx}`} onClick={() => handleLocationSelect(loc)} className="p-2 hover:bg-blue-50 cursor-pointer border-b"><span className="text-xs font-bold text-blue-600 flex items-center gap-1"><MapPin size={10}/> {loc.label}</span><div className="text-[10px] truncate text-gray-500">{loc.address}</div>{loc.mobile && <div className="text-[10px] font-bold text-green-600">{loc.mobile}</div>}</div>))}</div>)}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Items Section (Same as before) */}
        {type === 'expense' && ( <SearchableSelect label="Expense Category" options={data.categories.expense} value={tx.category} onChange={v => setTx({...tx, category: v})} onAddNew={() => { const newCat = prompt("New Category:"); if(newCat) setData(prev => ({...prev, categories: {...prev.categories, expense: [...prev.categories.expense, newCat]}})); }} placeholder="Select Category..." /> )}
        {type !== 'payment' && (
            <div className="space-y-3 pt-2 border-t">
                <h4 className="text-xs font-bold text-gray-400 uppercase">Items / Services</h4>
                {tx.items.map((line, idx) => {
                    const selectedItemMaster = data.items.find(i => i.id === line.itemId);
                    const specificBrandOptions = selectedItemMaster?.brands?.map(b => ({ id: b.name, name: b.name, subText: `₹${b.sellPrice}`, subColor: 'text-green-600' })) || [];
                    return (
                        <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2">
                            <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                            <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateLine(idx, 'itemId', v)} placeholder="Select Item"/>
                            {selectedItemMaster && ( <SearchableSelect placeholder={specificBrandOptions.length > 0 ? "Select Brand/Variant" : "No Brands defined (Type manual)"} options={specificBrandOptions} value={line.brand || ''} onChange={v => updateLine(idx, 'brand', v)} onAddNew={() => { const newBrand = prompt(`Add new brand for ${selectedItemMaster.name}?`); if(newBrand) updateLine(idx, 'brand', newBrand); }} /> )}
                            <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
                            <div className="flex gap-2">
                                <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} />
                                <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={line.price} onChange={e => updateLine(idx, 'price', e.target.value)} />
                                {type === 'sales' && ( <input type="number" className="w-20 p-1 border rounded text-xs bg-yellow-50 text-gray-600" placeholder="Buy" value={line.buyPrice} onChange={e => updateLine(idx, 'buyPrice', e.target.value)} /> )}
                                <div className="flex-1 text-right self-end text-xs font-bold text-gray-500 pb-2">{formatCurrency(line.qty * line.price)}</div>
                            </div>
                        </div>
                    );
                })}
                <button onClick={() => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 flex items-center justify-center gap-2"><Plus size={16}/> Add Item</button>
                <div className="flex justify-end pt-2 border-t border-gray-100"><div className="text-right"><span className="text-xs font-bold text-gray-400 uppercase mr-2">Sub Total</span><span className="text-xl font-bold text-gray-800">{formatCurrency(totals.gross)}</span></div></div>
            </div>
        )}

        {/* Payment, Discount, Round Off (Same as before) */}
        {type === 'payment' && ( <div className="space-y-4 pt-2 border-t"><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Amount</label><input type="number" className="w-full bg-blue-50 text-2xl font-bold p-4 rounded-xl text-blue-600" placeholder="0.00" value={tx.amount} onChange={e=>setTx({...tx, amount: e.target.value})}/></div><div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Mode</label><select className="w-full bg-gray-50 p-4 rounded-xl font-bold h-[68px]" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}><option>Cash</option><option>Bank</option><option>UPI</option></select></div></div><div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl"><span className="text-xs font-bold text-gray-500">Discount:</span><input className="flex-1 p-2 border rounded-lg text-xs" placeholder="Amt" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})}/></div></div> )}
        {['sales', 'purchase', 'expense'].includes(type) && ( <div className="p-4 bg-gray-50 rounded-xl border space-y-3 mt-2 shadow-sm"><div className="flex justify-between items-center font-bold text-lg text-blue-900 border-b pb-2 mb-2"><span>Grand Total</span><span>{formatCurrency(totals.final)}</span></div><div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-gray-500">{type === 'sales' ? 'Received Now' : 'Paid Now'}</span><div className="flex items-center gap-2"><input type="number" className="w-24 p-2 border rounded-lg text-right font-bold" placeholder="0" value={type==='sales'?tx.received:tx.paid} onChange={e => setTx({...tx, [type==='sales'?'received':'paid']: e.target.value})} /><select className="p-2 border rounded-lg text-xs" value={tx.paymentMode} onChange={e=>setTx({...tx, paymentMode: e.target.value})}><option>Cash</option><option>Bank</option><option>UPI</option></select></div></div><div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-gray-500">Discount</span><div className="flex items-center gap-2"><input type="number" className="w-20 p-2 border rounded-lg text-right" placeholder="0" value={tx.discountValue} onChange={e => setTx({...tx, discountValue: e.target.value})} /><select className="p-2 border rounded-lg text-xs" value={tx.discountType} onChange={e=>setTx({...tx, discountType: e.target.value})}><option>%</option><option>Amt</option></select></div></div><div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-gray-500">Round Off</span><input type="number" className="w-24 p-2 border rounded-lg text-right font-bold text-gray-600" placeholder="+ / -" value={tx.roundOff || ''} onChange={e => setTx({...tx, roundOff: e.target.value})} /></div></div> )}

        {/* Link Bills (Same as before) */}
        {['payment', 'sales', 'purchase', 'expense'].includes(type) && ( <div className="mt-4 pt-2 border-t"><button onClick={() => setShowLinking(!showLinking)} className="w-full p-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg mb-2">{showLinking ? "Hide Linked Bills" : "Link Advance/Pending Bills"}</button>{showLinking && ( <div className="space-y-2 p-2 border rounded-xl bg-gray-50/50"><input className="w-full p-2 border rounded-lg text-xs mb-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search Bill No or Amount..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} /><div className="max-h-60 overflow-y-auto space-y-2 pr-1">{unpaidBills.filter(b => b.id.toLowerCase().includes(linkSearch.toLowerCase()) || (b.amount || 0).toString().includes(linkSearch)).map(b => { const stats = getBillStats(b, data.transactions); const dueAmount = b.type === 'payment' ? (stats.amount - stats.used) : stats.pending; const linkData = tx.linkedBills?.find(l => l.billId === b.id); const isLinked = !!linkData; return ( <div key={b.id} className={`flex justify-between items-center p-2 border rounded-lg transition-all ${isLinked ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}><div className="flex items-center gap-3 flex-1"><input type="checkbox" checked={isLinked} onChange={() => { if(isLinked) { handleLinkChange(b.id, ''); } else { handleLinkChange(b.id, dueAmount); } }} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/><div className="text-[10px] cursor-pointer" onClick={() => !isLinked && handleLinkChange(b.id, dueAmount)}><p className={`font-bold ${isLinked ? 'text-blue-800' : 'text-gray-700'}`}>{b.id} • {b.type === 'payment' ? (b.subType==='in'?'IN':'OUT') : b.type}</p><p className="text-gray-500">{formatDate(b.date)} • Tot: {formatCurrency(b.amount || stats.final)}</p><p className="font-bold text-red-600 mt-0.5">Due: {formatCurrency(dueAmount)}</p></div></div><input type="number" className={`w-24 p-2 border rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-blue-500 ${isLinked ? 'bg-white border-blue-200 text-blue-700' : 'bg-gray-50 text-gray-400'}`} placeholder="Amt" value={linkData?.amount || ''} onChange={e => handleLinkChange(b.id, e.target.value)} onClick={(e) => e.stopPropagation()} /></div> ); })} {unpaidBills.length === 0 && <p className="text-center text-xs text-gray-400 py-4">No bills found to link.</p>}</div></div> )}</div> )}

        <textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-16" placeholder="Notes" value={tx.description} onChange={e => setTx({...tx, description: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl text-sm mt-2" placeholder="Paste Google Photos/Album Link" value={tx.photosLink || ''} onChange={e => setTx({...tx, photosLink: e.target.value})} />
        
        {/* --- UPDATED SAVE LOGIC FOR MULTIPLE ASSETS --- */}
        <button 
            onClick={async () => { 
                if(!tx.partyId) return alert("Party is Required");
                if(type === 'expense' && !tx.category) return alert("Category is Required");
                
                // 1. Calculate Final Amount
                let finalAmount = totals.final;
                if (type === 'payment') finalAmount = parseFloat(tx.amount || 0);

                // 2. Prepare Final Record
                const finalRecord = { ...tx, ...totals, amount: finalAmount };

                // 3. AUTO-UPDATE ASSET SERVICE DATE (Fixed Logic)
                // Hum ise 'await' nahi karenge taaki UI fast rahe, par logic synchronous update karega
                if (type === 'sales' && tx.partyId && tx.linkedAssetId) {
                    const p = data.parties.find(x => x.id === tx.partyId);
                    
                    // Sirf tab update karein agar Asset exist karta ho aur Date bhari ho
                    if (p && p.assets && tx.nextServiceDate) {
                        const updatedAssets = p.assets.map(a => {
                            // Name match karte waqt trim karein taaki space ki galti na ho
                            if (a.name.trim() === tx.linkedAssetId.trim()) {
                                return { ...a, nextServiceDate: tx.nextServiceDate };
                            }
                            return a;
                        });
                        
                        const updatedParty = { ...p, assets: updatedAssets };
                        
                        // Local Data Update (Instant UI Refresh ke liye)
                        setData(prev => ({ 
                            ...prev, 
                            parties: prev.parties.map(party => party.id === p.id ? updatedParty : party) 
                        }));

                        // Firebase Update (Background)
                        setDoc(doc(db, "parties", p.id), updatedParty).catch(e => console.error("Asset Date Update Failed", e));
                    }
                }

                // 4. Save Transaction
                await saveRecord('transactions', finalRecord, tx.type); 
            }} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
        >
            Save {type}
        </button>
      </div>
    );
};

  const TaskForm = ({ record }) => {
    // TaskForm ke andar
const [form, setForm] = useState(record ? { 
    ...record, 
    itemsUsed: record.itemsUsed || [], 
    assignedStaff: record.assignedStaff || [],
    selectedContacts: record.selectedContacts || [] // <--- NEW ARRAY
} : { 
    name: '', partyId: '', description: '', status: 'To Do', dueDate: '', 
    assignedStaff: [], itemsUsed: [], 
    address: '', mobile: '', lat: '', lng: '', locationLabel: '', 
    selectedContacts: [] // <--- NEW ARRAY
});
    const [showLocPicker, setShowLocPicker] = useState(false); // Local state for location picker
    const [showMobilePicker, setShowMobilePicker] = useState(false);// mobile number picker
    
    const itemOptions = data.items.map(i => ({ ...i, subText: `Stock: ${itemStock[i.id] || 0}`, subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600' }));
    const selectedParty = data.parties.find(p => p.id === form.partyId);
    
    // TaskForm component ke andar
const updateItem = (idx, field, val) => {
    const n = [...form.itemsUsed];
    n[idx][field] = val;

    if (field === 'itemId') {
        const item = data.items.find(i => i.id === val);
        if (item) {
            // --- Last Price Fetch Logic for Tasks ---
            const lastTx = data.transactions
                .filter(t => t.status !== 'Cancelled' && t.items?.some(line => line.itemId === val))
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            const lastItemData = lastTx?.items.find(line => line.itemId === val);

            // Task me humesha Sell Price hi dikhana hota h as Price
            n[idx].price = lastItemData ? lastItemData.price : item.sellPrice;
            n[idx].buyPrice = lastItemData ? (lastItemData.buyPrice || item.buyPrice) : item.buyPrice;
            n[idx].description = item.description || '';
        }
    }
    setForm({ ...form, itemsUsed: n });
};
    
    const handleLocationSelect = (loc) => {
        setForm({
            ...form,
            address: loc.address,
            mobile: loc.mobile || selectedParty?.mobile || '',
            lat: loc.lat || '',
            lng: loc.lng || '',
            locationLabel: loc.label,
        });
        setShowLocPicker(false);
    };
  // --- FIX: Update both Array and String for compatibility ---
const toggleMobile = (mob) => {
    const exists = form.selectedContacts.find(c => c.number === mob.number);
    let newContacts;

    if (exists) {
        // Remove contact
        newContacts = form.selectedContacts.filter(c => c.number !== mob.number);
    } else {
        // Add contact
        newContacts = [...form.selectedContacts, { label: mob.label || 'Primary', number: mob.number }];
    }

    // Update form state (Save both specific contacts AND comma-separated string)
    setForm({ 
        ...form, 
        selectedContacts: newContacts,
        mobile: newContacts.map(c => c.number).join(', ') // String bhi update karein
    });
};
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <div className="p-3 bg-gray-50 rounded-xl border"><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Assigned Staff</label><div className="flex flex-wrap gap-2 mb-2">{form.assignedStaff.map(sid => { const s = data.staff.find(st => st.id === sid); return (<span key={sid} className="bg-white border px-2 py-1 rounded-full text-xs flex items-center gap-1">{s?.name} <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button></span>); })}</div><select className="w-full p-2 border rounded-lg text-sm bg-white" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}><option value="">+ Add Staff</option>{data.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        
        <div>
            <SearchableSelect label="Client" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v, locationLabel: '', address: ''})} />
            
            {/* FIX #6 (TaskForm): Multiple Contact/Location Selector */}
            {(selectedParty?.locations?.length > 0 || selectedParty?.mobileNumbers?.length > 0) && (
                <div className="relative mt-1 mb-2">
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                         <div className="text-xs text-blue-800 overflow-hidden">
                            <span className="font-bold">Selected: </span> 
                            <span className="font-bold bg-white px-1 rounded ml-1">
                                {form.locationLabel || 'Default'}
                            </span>
                            <div className="truncate max-w-[200px] text-gray-600 mt-0.5">
                                {form.address || selectedParty.address}
                            </div>
                            <div className="font-bold text-green-700 flex items-center gap-1">
                                <Phone size={10}/> {form.mobile || selectedParty.mobile}
                            </div>
                         </div>
                         <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[10px] font-bold bg-white border px-3 py-2 rounded-lg shadow-sm text-blue-600 whitespace-nowrap">
                             Change
                         </button>
                    </div>
                    
                    {showLocPicker && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto">
                            {/* 1. Default Option */}
                            <div onClick={() => handleLocationSelect({ label: '', address: selectedParty.address, mobile: selectedParty.mobile, lat: selectedParty.lat, lng: selectedParty.lng })} className="p-2 hover:bg-gray-50 border-b cursor-pointer bg-gray-50 rounded mb-1">
                                <span className="font-bold text-xs text-gray-600">Default Details</span>
                                <div className="text-[10px]">{selectedParty.mobile}</div>
                            </div>
                            {/* 2. Mobile Numbers List (Multi-Select for TaskForm) */}
                            {selectedParty.mobileNumbers?.length > 0 && (
                                <div className="mb-2 border-b pb-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Mobile Numbers (Multi-Select)</p>
                                        <span className="text-[9px] text-blue-400">(Tap to Add/Remove)</span>
                                    </div>
                                    {selectedParty.mobileNumbers.map((mob, idx) => {
                                        // FIX: Check in 'selectedContacts' array instead of string
                                        const isSelected = form.selectedContacts?.some(c => c.number === mob.number);
                                        
                                        return (
                                            <div 
                                                key={`mob-${idx}`} 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // FIX: Use the new toggle function
                                                    toggleMobile(mob);
                                                }} 
                                                className={`p-2 cursor-pointer border-b flex justify-between items-center transition-colors ${isSelected ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}
                                            >
                                                 <span className={`text-xs font-bold flex items-center gap-1 ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>
                                                    <Phone size={10}/> {mob.label}
                                                 </span>
                                                 <div className="flex items-center gap-2">
                                                     <span className={`text-xs font-mono ${isSelected ? 'font-bold text-black' : 'text-gray-500'}`}>{mob.number}</span>
                                                     {isSelected && <CheckCircle2 size={14} className="text-green-600"/>}
                                                 </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 3. Locations List */}
                            {selectedParty.locations?.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Addresses</p>
                                    {selectedParty.locations.map((loc, idx) => (
                                        <div key={`loc-${idx}`} onClick={() => handleLocationSelect(loc)} className="p-2 hover:bg-blue-50 cursor-pointer border-b">
                                            <span className="text-xs font-bold text-blue-600 flex items-center gap-1"><MapPin size={10}/> {loc.label}</span>
                                            <div className="text-[10px] truncate text-gray-500">{loc.address}</div>
                                            {loc.mobile && <div className="text-[10px] font-bold text-green-600">{loc.mobile}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        {/* FIX #5: Google Photos Link Input for Tasks */}
        <input 
            className="w-full p-3 bg-gray-50 border rounded-xl text-sm mt-2" 
            placeholder="Paste Google Photos/Album Link" 
            value={form.photosLink || ''} 
            onChange={e => setForm({...form, photosLink: e.target.value})} 
        />
        {/* MODIFIED TASK FORM ITEMS SECTION */}
        <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase">Items / Parts</h4>
            
            {/* List Items */}
            {form.itemsUsed.map((line, idx) => (
                <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2">
                    <button onClick={() => setForm({...form, itemsUsed: form.itemsUsed.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                    <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} />
                    {/* FIX #7: Brand Select for Task Items */}
                    {data.items.find(i => i.id === line.itemId)?.brands?.length > 0 && (
                        <div className="mb-2">
                             <select 
                                className="w-full p-2 border rounded-lg text-xs bg-blue-50 text-blue-800 font-bold outline-none"
                                value={line.brand || ''} 
                                onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                            >
                                <option value="">Select Brand/Variant</option>
                                {data.items.find(i => i.id === line.itemId).brands.map((b, bi) => (
                                    <option key={bi} value={b.name}>{b.name} (₹{b.sellPrice})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} />
                    <div className="flex gap-2">
                        <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                        <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                        <input type="number" className="w-20 p-1 border rounded text-xs bg-gray-100" placeholder="Buy" value={line.buyPrice} onChange={e => updateItem(idx, 'buyPrice', e.target.value)} />
                    </div>
                </div>
            ))}
            

            {/* Add Button at Bottom */}
            <button 
                onClick={() => setForm({...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} 
                className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 flex items-center justify-center gap-2"
            >
                <Plus size={16}/> Add Item
            </button>
        </div>
{/* --- NEW CODE START: Task Total Calculation --- */}
            <div className="flex justify-end pt-2 mt-2 border-t border-gray-200">
                <div className="text-right">
                    <span className="text-xs font-bold text-gray-500 uppercase mr-2">Estimated Total</span>
                    <span className="text-xl font-black text-blue-600">
                        {formatCurrency(
                            form.itemsUsed.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)), 0)
                        )}
                    </span>
                </div>
            </div>
            {/* --- NEW CODE END --- */}
        <div className="grid grid-cols-2 gap-4"><input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /><select 
    className="w-full p-3 bg-gray-50 border rounded-xl" 
    value={form.status} 
    onChange={e => setForm({...form, status: e.target.value})}
>
    {/* Dynamic Options from Settings */}
    {(data.categories.taskStatus || ["To Do", "In Progress", "Done"]).map(s => (
        <option key={s} value={s}>{s}</option>
    ))}
    {/* Converted option ko hidden rakh sakte hain ya dikha sakte hain, usually manual select nahi karte */}
    <option value="Converted">Converted (System)</option>
</select></div>
        <button onClick={() => saveRecord('tasks', form, 'task')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
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
        <label className={`flex items-center gap-3 p-4 border rounded-xl font-bold cursor-pointer transition-colors ${form.active ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-blue-600 focus:ring-0" 
                checked={form.active !== false} // Default true rahega
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>{form.active !== false ? 'Staff Account is ACTIVE' : 'Staff Account is INACTIVE (Blocked)'}</span>
        </label>
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
        mobileNumbers: [],
        ...(record || {}) 
    });

    const [newLoc, setNewLoc] = useState({ label: '', address: '', mobile: '', lat: '', lng: '' });
    const [newMobile, setNewMobile] = useState({ label: '', number: '' });

    const addLocation = () => {
        if (!newLoc.label || !newLoc.address) return alert("Label and Address are required");
        setForm(prev => ({ ...prev, locations: [...(prev.locations || []), newLoc] }));
        setNewLoc({ label: '', address: '', mobile: '', lat: '', lng: '' });
    };

    const removeLocation = (idx) => {
        setForm(prev => ({ ...prev, locations: prev.locations.filter((_, i) => i !== idx) }));
    };
    // --- Mobile Number Logic ---
const addMobile = () => {
    if (!newMobile.label || !newMobile.number) return alert("Label and Number are required");
    setForm(prev => ({ ...prev, mobileNumbers: [...(prev.mobileNumbers || []), newMobile] }));
    setNewMobile({ label: '', number: '' });
};

const removeMobile = (idx) => {
    setForm(prev => ({ ...prev, mobileNumbers: prev.mobileNumbers.filter((_, i) => i !== idx) }));
};

    return (                                                            
        <div className="space-y-4">
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
                 <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Ref By" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
            </div>
            {/* --- Multiple Mobile Numbers Section --- */}
<div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-3">
    <p className="text-xs font-bold text-green-600 uppercase flex items-center gap-2"><Phone size={12}/> Multiple Contacts</p>
    
    {/* List of Added Mobiles */}
    {(form.mobileNumbers || []).map((mob, idx) => (
        <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-center text-xs">
            <div>
                <span className="font-bold text-green-700 bg-green-100 px-1 rounded mr-2">{mob.label}</span>
                <span className="text-gray-700 font-bold">{mob.number}</span>
            </div>
            <button onClick={() => removeMobile(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded"><X size={14}/></button>
        </div>
    ))}

    {/* Add New Mobile Inputs */}
    <div className="flex gap-2 pt-2 border-t border-green-200">
        <input 
            className="w-1/3 p-2 border rounded-lg text-xs" 
            placeholder="Label (e.g. Manager)" 
            value={newMobile.label} 
            onChange={e => setNewMobile({...newMobile, label: e.target.value})} 
        />
        <input 
            className="flex-1 p-2 border rounded-lg text-xs" 
            placeholder="Mobile Number" 
            type="tel"
            value={newMobile.number} 
            onChange={e => setNewMobile({...newMobile, number: e.target.value})} 
        />
        <button onClick={addMobile} className="px-4 bg-green-600 text-white rounded-lg font-bold text-xs">Add</button>
    </div>
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
                        <input 
        className="flex-1 p-2 border rounded-lg text-xs" 
        placeholder="Lat" 
        value={newLoc.lat} 
        onChange={e => setNewLoc({...newLoc, lat: e.target.value})} 
    />
    <input 
        className="flex-1 p-2 border rounded-lg text-xs" 
        placeholder="Lng" 
        value={newLoc.lng} 
        onChange={e => setNewLoc({...newLoc, lng: e.target.value})} 
    />
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
           {/* Add New Asset Inputs */}
                <div className="bg-white p-2 rounded-xl border border-indigo-200 space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase text-center">Add New Asset</p>
                    <input id="new_asset_name" className="w-full p-2 border rounded-lg text-xs" placeholder="Asset Name (e.g. Bedroom AC)" />
                    <div className="flex gap-2">
                        <input id="new_asset_brand" className="w-1/2 p-2 border rounded-lg text-xs" placeholder="Brand (e.g. Voltas)" />
                        <input id="new_asset_model" className="w-1/2 p-2 border rounded-lg text-xs" placeholder="Model No." />
                    </div>
                    {/* --- NEW: GOOGLE PHOTOS LINK INPUT --- */}
                    <input id="new_asset_photo" className="w-full p-2 border rounded-lg text-xs text-blue-600" placeholder="Paste Google Photos Link" />
                    
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Install Date</label>
                            <input id="new_asset_install" type="date" className="w-full p-2 border rounded-lg text-xs" />
                         </div>
                         <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Next Service</label>
                            <input id="new_asset_next" type="date" className="w-full p-2 border rounded-lg text-xs bg-red-50" />
                         </div>
                    </div>
                    <button 
                        onClick={() => {
                            const name = document.getElementById('new_asset_name').value;
                            const brand = document.getElementById('new_asset_brand').value;
                            const model = document.getElementById('new_asset_model').value;
                            const photo = document.getElementById('new_asset_photo').value; // Get Photo
                            const installDate = document.getElementById('new_asset_install').value;
                            const nextServiceDate = document.getElementById('new_asset_next').value;
                            
                            if(!name) return alert("Asset Name is required");

                            const newAsset = { name, brand, model, photosLink: photo, installDate, nextServiceDate }; // Add to object
                            setForm(prev => ({ ...prev, assets: [...(prev.assets || []), newAsset] }));
                            
                            // Clear inputs
                            document.getElementById('new_asset_name').value = '';
                            document.getElementById('new_asset_brand').value = '';
                            document.getElementById('new_asset_model').value = '';
                            document.getElementById('new_asset_photo').value = '';
                            document.getElementById('new_asset_install').value = '';
                            document.getElementById('new_asset_next').value = '';
                        }}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs"
                    >
                        + Add Asset
                    </button>
                </div>
            <button onClick={() => saveRecord('parties', form, 'party')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save</button>
        </div>
    );
  };
    
  const ItemForm = ({ record }) => {
    // Default structure: brands array add kiya hai
    const [form, setForm] = useState({ 
        name: '', 
        type: 'Goods', 
        unit: 'pcs', 
        openingStock: '0', 
        sellPrice: '', // Base Price (Default)
        buyPrice: '',  // Base Price (Default)
        brands: [], // [{ name: 'Anchor', sellPrice: 20, buyPrice: 15 }]
        category: '',
        ...(record || {}) 
    });

    // Helper to update specific brand in the list
    const updateBrand = (idx, field, value) => {
        const newBrands = [...(form.brands || [])];
        newBrands[idx][field] = value;
        setForm({ ...form, brands: newBrands });
    };

    // Add new empty brand row
    const addBrandRow = () => {
        setForm({
            ...form,
            brands: [...(form.brands || []), { name: '', sellPrice: form.sellPrice, buyPrice: form.buyPrice }]
        });
    };

    // Remove brand row
    const removeBrandRow = (idx) => {
        const newBrands = [...(form.brands || [])];
        newBrands.splice(idx, 1);
        setForm({ ...form, brands: newBrands });
    };

    return (
       <div className="space-y-4">
         <div className="p-3 bg-gray-50 border rounded-xl space-y-3">
             <label className="text-xs font-bold text-gray-400 uppercase">Basic Details</label>
             <input className="w-full p-2 bg-white border rounded-lg" placeholder="Item Name (e.g. 6Amp Switch)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
    
             {/* CHANGE 4: Category Select with PERMANENT SAVE */}
             <SearchableSelect 
                label="Category"
                options={data.categories.item || []}
                value={form.category}
                onChange={v => setForm({...form, category: v})}
                onAddNew={async () => {
                    const newCat = prompt("New Item Category:");
                    if(!newCat) return;

                    // 1. Check Duplicate
                    if((data.categories.item || []).some(c => c.toLowerCase() === newCat.toLowerCase())) {
                        return alert("Category already exists!");
                    }
                    
                    // 2. Update Local State (Instant UI update)
                    const updatedList = [...(data.categories.item || []), newCat];
                    const newCats = { ...data.categories, item: updatedList };
                    setData(prev => ({...prev, categories: newCats}));

                    // 3. Update Firebase (Permanent Save)
                    try {
                        await setDoc(doc(db, "settings", "categories"), newCats);
                        // Agar toast function available h to: showToast("Category Created");
                    } catch(e) {
                        console.error(e);
                        alert("Error saving category to cloud");
                    }
                }}
                placeholder="Select Category"
             />
             <div className="grid grid-cols-2 gap-2">
                 <select className="p-2 bg-white border rounded-lg text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option>Goods</option><option>Service</option></select>
                 <input className="p-2 bg-white border rounded-lg text-sm" placeholder="Unit (pcs/mtr)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="text-[10px] text-gray-500">Default Sell Price</label>
                    <input type="number" className="w-full p-2 bg-white border rounded-lg" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] text-gray-500">Default Buy Price</label>
                    <input type="number" className="w-full p-2 bg-white border rounded-lg" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
                 </div>
             </div>
             <input type="number" className="w-full p-2 bg-white border rounded-lg text-sm" placeholder="Opening Stock" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} />
         </div>

         {/* --- BRAND / VARIANT MANAGER --- */}
         <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
             <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-blue-700 uppercase">Brands & Pricing</label>
                 <button onClick={addBrandRow} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold">+ Add Brand</button>
             </div>
             
             {(form.brands || []).length === 0 && <p className="text-xs text-gray-400 italic">No specific brands added. Default prices will be used.</p>}

             {(form.brands || []).map((b, idx) => (
                 <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border shadow-sm">
                     <div className="flex-1 space-y-1">
                         <input className="w-full p-1 border-b text-sm font-bold text-blue-900 placeholder-blue-200" placeholder="Brand Name (e.g. Havells)" value={b.name} onChange={e => updateBrand(idx, 'name', e.target.value)} />
                         <div className="flex gap-2">
                             <input type="number" className="w-1/2 p-1 bg-gray-50 rounded text-xs" placeholder="Sell" value={b.sellPrice} onChange={e => updateBrand(idx, 'sellPrice', e.target.value)} />
                             <input type="number" className="w-1/2 p-1 bg-gray-50 rounded text-xs" placeholder="Buy" value={b.buyPrice} onChange={e => updateBrand(idx, 'buyPrice', e.target.value)} />
                         </div>
                     </div>
                     <button onClick={() => removeBrandRow(idx)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                 </div>
             ))}
         </div>

         <button onClick={() => saveRecord('items', form, 'item')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200">Save Item</button>
       </div>
    );
  };
    
  const CompanyForm = ({ record }) => {
    const [form, setForm] = useState(data.company);

    // --- NEW: Restore Logic ---
    const handleRestore = async () => {
        if(!window.confirm("⚠️ Emergency Restore\n\nThis will re-download ALL data from the cloud to fix local issues.\nIt uses more reads than normal sync.\n\nContinue?")) return;
        
        // 1. Force Full Sync by removing the timestamp
        localStorage.removeItem('smees_last_sync');
        
        // 2. Call existing sync function (now it acts like a fresh install)
        await syncData();
        
        setModal({ type: null });
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Company Settings</h3>
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Company Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
            <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            
            <button onClick={() => { setData({...data, company: form}); setDoc(doc(db, "settings", "company"), form); setModal({type:null}); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200">
                Save Settings
            </button>

            {/* --- NEW: Restore Button Section --- */}
            <div className="pt-4 border-t mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Data Recovery</p>
                <button 
                    onClick={handleRestore} 
                    className="w-full p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                >
                    <RefreshCw size={16} /> Restore Cloud Data (Full Sync)
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-1">Use this only if local data seems incorrect/missing.</p>
            </div>
        </div>
    );
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
            
            {activeTab === 'accounting' && checkPermission(user, 'canViewAccounts') && (
                <TransactionList 
                    searchQuery={txSearchQuery} 
                    setSearchQuery={setTxSearchQuery}
                    dateRange={txDateRange}
                    setDateRange={setTxDateRange}
                    data={data}
                    listFilter={listFilter}
                    listPaymentMode={listPaymentMode}
                    categoryFilter={categoryFilter}
                    pushHistory={pushHistory}
                    setViewDetail={setViewDetail}
                />
            )}
            
            {activeTab === 'tasks' && checkPermission(user, 'canViewTasks') && (
                <TaskModule 
                    data={data}
                    user={user}
                    pushHistory={pushHistory}
                    setViewDetail={setViewDetail}
                    setModal={setModal}
                    checkPermission={checkPermission}
                />
            )}
            
            {/* Staff Section */}
            {activeTab === 'staff' && (
                <div className="space-y-4">
                    {/* ... Header buttons ... */}
                    {mastersView === null ? (
                        <div className="space-y-4">
                            <MasterList 
                                title="Team Members" 
                                collection="staff" 
                                type="staff" 
                                search={staffSearch}        
                                setSearch={setStaffSearch} 
                                onRowClick={(s) => { pushHistory(); setViewDetail({type: 'staff', id: s.id}); }} 
                                data={data}
                                setData={setData}
                                user={user}
                                partyBalances={partyBalances}
                                itemStock={itemStock}
                                partyFilter={partyFilter}
                                pushHistory={pushHistory}
                                setViewDetail={setViewDetail}
                                setModal={setModal}
                                syncData={syncData}
                            />
                        </div>
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
                        {mastersView === 'items' && (
                            <MasterList 
                                title="Items" 
                                collection="items" 
                                type="item" 
                                search={itemSearch} 
                                setSearch={setItemSearch} 
                                onRowClick={(item) => { pushHistory(); setViewDetail({type: 'item', id: item.id}); }} 
                                data={data}
                                setData={setData}
                                user={user}
                                partyBalances={partyBalances}
                                itemStock={itemStock}
                                partyFilter={partyFilter}
                                pushHistory={pushHistory}
                                setViewDetail={setViewDetail}
                                setModal={setModal}
                                syncData={syncData}
                            />
                        )}
                        {mastersView === 'parties' && (
                            <MasterList 
                                title="Parties" 
                                collection="parties" 
                                type="party" 
                                search={partySearch} 
                                setSearch={setPartySearch} 
                                onRowClick={(item) => { pushHistory(); setViewDetail({type: 'party', id: item.id}); }} 
                                data={data}
                                setData={setData}
                                user={user}
                                partyBalances={partyBalances}
                                itemStock={itemStock}
                                partyFilter={partyFilter}
                                pushHistory={pushHistory}
                                setViewDetail={setViewDetail}
                                setModal={setModal}
                                syncData={syncData}
                            />
                        )}
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
            partyId={statementModal.partyId} // Ye Add kiya
            data={data}                      // Ye Add kiya
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
            saveRecord={saveRecord}           // <----- Ye line honi chahiye
            setEditingTimeLog={setEditingTimeLog} // <--- Ye line honi chahiye
        />
      )}
    </div>
  );
}