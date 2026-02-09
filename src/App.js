import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics"; // <--- YE LINE MISSING THI, ISE ADD KAREIN
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, // <--- Added this
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
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
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
  RefreshCw,
  Landmark,
   ShieldCheck,
   Copy
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
// 2. PERSONAL CONFIG (New)
const personalConfig = {
  apiKey: "AIzaSyCILMKJfFSOdyKA9wTh6zzXsPMc0wt_Wtc",
  authDomain: "personal-data-a2bce.firebaseapp.com",
  projectId: "personal-data-a2bce",
  storageBucket: "personal-data-a2bce.firebasestorage.app",
  messagingSenderId: "680628699537",
  appId: "1:680628699537:web:2cd444a4eaea83df945a30",
  measurementId: "G-DTQH641PS3"
};
// Initialize BOTH Apps
const app = initializeApp(firebaseConfig, "business"); // Business App
const personalApp = initializeApp(personalConfig, "personal"); // Personal App
const analytics = getAnalytics(app);

// Business Services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Personal Services (New Variable)
const personalDb = getFirestore(personalApp);
const INITIAL_DATA = {
  company: { name: "My Enterprise", mobile: "", address: "", financialYear: "2024-25", currency: "₹" },
  parties: [],
  items: [],
  staff: [],
  attendance: [],
  transactions: [],
  tasks: [],
  personalTasks: [],        // NEW: Personal tasks
  personalTransactions: [], // NEW: Personal finance
  categories: {
    expense: ["Rent", "Electricity", "Marketing", "Salary"],
    item: ["Electronics", "Grocery", "General", "Furniture", "Pharmacy"],
    taskStatus: ["To Do", "In Progress", "Done"],
    amc: ["General", "Premium", "Comprehensive"] // FIX 2: Added AMC Category
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

    // Ye check karega ki koi bhi transaction (Sale/Purchase/Payment) is current bill/payment ko link kar raha hai ya nahi
    const totalLinkedToThis = transactions
        .filter(t => t.status !== 'Cancelled' && t.linkedBills && t.id !== bill.id)
        .reduce((sum, t) => {
             const link = t.linkedBills.find(l => l.billId === bill.id);
             return sum + (link ? parseFloat(link.amount || 0) : 0);
        }, 0);

    // Ye check karega ki is current bill/payment ne kitne doosre records ko link kiya hai
    const totalLinkedByThis = (bill.linkedBills || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

    let status = 'UNPAID';
    if(bill.type === 'payment') {
         const totalUsed = totalLinkedToThis + totalLinkedByThis;
         const totalAvailable = parseFloat(bill.amount || 0) + parseFloat(bill.discountValue || 0);

         if (totalUsed >= totalAvailable - 0.1 && totalAvailable > 0) status = 'FULLY USED';
         else if (totalUsed > 0.1) status = 'PARTIALLY USED';
         else status = 'UNUSED';
         return { ...basic, used: totalUsed, status, totalAvailable, amount: parseFloat(bill.amount || 0) }; 
    }

    const totalPaid = basic.paid + totalLinkedToThis + totalLinkedByThis;
    if (totalPaid >= basic.final - 0.1) status = 'PAID';
    else if (totalPaid > 0.1) status = 'PARTIAL';
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

// --- HELPER: Date Diff in Days ---
const getDaysDiff = (d1, d2) => Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));

// --- PROFESSIONAL AI BUSINESS REPORT GENERATOR ---
const generateAIReport = (data, startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const now = new Date();

    // 1. PREPARE DATA POOLS
    // A. Period Data (Strictly within selected range)
    const periodTasks = data.tasks.filter(t => {
        const d = new Date(t.createdAt); // Count based on Creation for volume analysis
        return d >= start && d <= end;
    });
    
    const periodCompletedTasks = data.tasks.filter(t => {
        if (t.status !== 'Done' || !t.completedAt) return false;
        const d = new Date(t.completedAt);
        return d >= start && d <= end;
    });

    const periodTx = data.transactions.filter(t => {
        const d = new Date(t.date);
        return t.status !== 'Cancelled' && d >= start && d <= end;
    });

    const periodSales = periodTx.filter(t => t.type === 'sales');
    const periodExpenses = periodTx.filter(t => t.type === 'expense');

    // ==========================================
    // 1. TASKS & PRODUCTIVITY (Creation vs Completion)
    // ==========================================
    let taskStats = { 
        created: periodTasks.length, 
        completedOnTime: 0, 
        completedLate: 0, 
        pending: 0, 
        overdue: 0 
    };

    // Analyze Completion Quality (on tasks completed in this period)
    periodCompletedTasks.forEach(t => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const done = new Date(t.completedAt);
        // Buffer of 1 day allowed
        if (due && done > new Date(due.getTime() + 86400000)) taskStats.completedLate++;
        else taskStats.completedOnTime++;
    });

    // Analyze Pending Load (Snapshot of all active tasks, regardless of date)
    const allActiveTasks = data.tasks.filter(t => t.status !== 'Done' && t.status !== 'Converted');
    taskStats.pending = allActiveTasks.length;
    taskStats.overdue = allActiveTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;

    // ==========================================
    // 2. STAFF PERFORMANCE (Weighted Revenue)
    // ==========================================
    const staffMetrics = {};
    data.staff.forEach(s => staffMetrics[s.id] = { name: s.name, hours: 0, revenue: 0, tasksDone: 0, salary: parseFloat(s.salary || 0) });

    // A. Work Hours (From TimeLogs in period)
    data.tasks.forEach(t => {
        (t.timeLogs || []).forEach(log => {
            const logDate = new Date(log.start);
            if (logDate >= start && logDate <= end && staffMetrics[log.staffId]) {
                staffMetrics[log.staffId].hours += (parseFloat(log.duration || 0) / 60);
            }
        });
    });

    // B. Revenue Attribution (Logic: Net Sales split by Work Effort)
    periodSales.forEach(sale => {
        if (sale.convertedFromTask) {
            const task = data.tasks.find(t => t.id === sale.convertedFromTask);
            if (task) {
                const logs = task.timeLogs || [];
                const totalDuration = logs.reduce((sum, l) => sum + parseFloat(l.duration || 0), 0);
                const netSale = parseFloat(sale.finalTotal || 0); // Use Final (Net) not Gross

                if (totalDuration > 0) {
                    // Weighted Split based on Hours Worked
                    logs.forEach(log => {
                        if (staffMetrics[log.staffId]) {
                            const share = (parseFloat(log.duration) / totalDuration) * netSale;
                            staffMetrics[log.staffId].revenue += share;
                        }
                    });
                } else {
                    // Fallback: Equal Split
                    const assigned = task.assignedStaff || [];
                    if (assigned.length > 0) {
                        const share = netSale / assigned.length;
                        assigned.forEach(sid => {
                            if (staffMetrics[sid]) staffMetrics[sid].revenue += share;
                        });
                    }
                }
            }
        }
    });

    // ==========================================
    // 3. PROFIT & LOSS (Accounting Standard)
    // ==========================================
    let financial = {
        revenue: 0,      // Total Net Sales
        cogs: 0,         // Cost of Goods Sold
        grossProfit: 0,  // Revenue - COGS
        operatingExp: 0, // Expenses
        netProfit: 0,    // Gross - Exp
        totalDiscount: 0,
        grossSales: 0    // Before Discount
    };

    periodSales.forEach(s => {
        const net = parseFloat(s.finalTotal || 0);
        financial.revenue += net;
        
        // Calculate COGS
        (s.items || []).forEach(i => {
            const buyPrice = parseFloat(i.buyPrice || 0);
            const qty = parseFloat(i.qty || 0);
            financial.cogs += (buyPrice * qty);
        });

        // Discount Tracking
        const disc = parseFloat(s.discountValue || 0);
        financial.totalDiscount += disc;
        financial.grossSales += (s.grossTotal || (net + disc));
    });

    // Operating Expenses
    periodExpenses.forEach(e => {
        financial.operatingExp += parseFloat(e.finalTotal || e.amount || 0);
    });

    // Final Calculations
    financial.grossProfit = financial.revenue - financial.cogs;
    financial.netProfit = financial.grossProfit - financial.operatingExp;
    const profitMargin = financial.revenue > 0 ? ((financial.netProfit / financial.revenue) * 100).toFixed(1) : 0;

    // ==========================================
    // 4. PAYMENTS & AGING (Lifetime Risk)
    // ==========================================
    let aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, totalDue: 0 };
    let riskClients = [];

    // Scan ALL Valid Sales (Lifetime) for Pending Balance
    data.transactions.filter(t => t.type === 'sales' && t.status !== 'Cancelled').forEach(sale => {
        const stats = getTransactionTotals(sale); // Uses existing helper
        const due = stats.final - stats.paid;
        
        if (due > 1) { // Ignore rounding errors < 1
            aging.totalDue += due;
            const daysOld = getDaysDiff(now, sale.date);
            
            if (daysOld <= 30) aging['0-30'] += due;
            else if (daysOld <= 60) aging['31-60'] += due;
            else if (daysOld <= 90) aging['61-90'] += due;
            else {
                aging['90+'] += due;
                // Add to Risk List
                const pName = data.parties.find(p => p.id === sale.partyId)?.name;
                if(pName && !riskClients.includes(pName)) riskClients.push(pName);
            }
        }
    });

    // ==========================================
    // 5. ASSETS & AMC PREDICTION
    // ==========================================
    let amc = { upcoming: 0, potentialRev: 0 };
    const next30Days = new Date();
    next30Days.setDate(now.getDate() + 30);

    data.parties.forEach(p => {
        (p.assets || []).forEach(a => {
            if (a.nextServiceDate) {
                const sDate = new Date(a.nextServiceDate);
                if (sDate >= now && sDate <= next30Days) {
                    amc.upcoming++;
                    // Use specific price or fallback to 500
                    amc.potentialRev += parseFloat(a.servicePrice || 500); 
                }
            }
        });
    });

    // ==========================================
    // 6. EXPENSE ANALYSIS
    // ==========================================
    const expenseMap = {};
    periodExpenses.forEach(e => {
        const cat = e.category || 'Uncategorized';
        expenseMap[cat] = (expenseMap[cat] || 0) + parseFloat(e.finalTotal || 0);
    });
    const topExpenses = Object.entries(expenseMap).sort((a,b) => b[1] - a[1]).slice(0, 3);

    // ==========================================
    // BUILD TEXT REPORT
    // ==========================================
    let r = `AI BUSINESS INTELLIGENCE REPORT\n`;
    r += `Period: ${startDate} to ${endDate}\n`;
    r += `Generated: ${now.toLocaleString()}\n\n`;

    r += `================================\n`;
    r += `1. FINANCIAL HEALTH\n`;
    r += `================================\n`;
    r += `• Net Revenue:     ${formatCurrency(financial.revenue)}\n`;
    r += `• COGS (Material): ${formatCurrency(financial.cogs)}\n`;
    r += `• Gross Profit:    ${formatCurrency(financial.grossProfit)} (Margin: ${((financial.grossProfit/financial.revenue)*100 || 0).toFixed(1)}%)\n`;
    r += `• Op. Expenses:    ${formatCurrency(financial.operatingExp)}\n`;
    r += `• NET PROFIT:      ${formatCurrency(financial.netProfit)} (${profitMargin}%)\n\n`;

    r += `================================\n`;
    r += `2. PAYMENTS & RISK (Lifetime)\n`;
    r += `================================\n`;
    r += `• Total Pending:   ${formatCurrency(aging.totalDue)}\n`;
    r += `• 0-30 Days:       ${formatCurrency(aging['0-30'])}\n`;
    r += `• 31-60 Days:      ${formatCurrency(aging['31-60'])}\n`;
    r += `• CRITICAL (90+):  ${formatCurrency(aging['90+'])}\n`;
    if(riskClients.length > 0) r += `⚠️ Risk Clients: ${riskClients.slice(0, 3).join(', ')}\n\n`;
    else r += `\n`;

    r += `================================\n`;
    r += `3. WORKFORCE & PRODUCTIVITY\n`;
    r += `================================\n`;
    r += `• Tasks Created: ${taskStats.created} | Completed: ${taskStats.completedOnTime + taskStats.completedLate}\n`;
    r += `• On-Time Rate:  ${((taskStats.completedOnTime / (taskStats.completedOnTime + taskStats.completedLate || 1))*100).toFixed(0)}%\n`;
    r += `• Current Load:  ${taskStats.pending} Pending (${taskStats.overdue} Overdue)\n`;
    r += `\nStaff Performance (Hours | Revenue):\n`;
    
    Object.values(staffMetrics)
        .filter(s => s.hours > 0 || s.revenue > 0)
        .sort((a,b) => b.revenue - a.revenue)
        .forEach(s => {
            const costRatio = s.salary > 0 ? ((s.revenue / s.salary) * 100).toFixed(0) + '%' : 'N/A';
            r += `- ${s.name.padEnd(10)}: ${s.hours.toFixed(1)} hrs | Gen: ${formatCurrency(s.revenue)}\n`;
        });
    r += `\n`;

    r += `================================\n`;
    r += `4. ASSETS & FUTURE\n`;
    r += `================================\n`;
    r += `• Upcoming AMC (30 Days): ${amc.upcoming}\n`;
    r += `• Projected Revenue:      ${formatCurrency(amc.potentialRev)}\n`;
    r += `• Top Expense:            ${topExpenses[0] ? `${topExpenses[0][0]} (${formatCurrency(topExpenses[0][1])})` : 'None'}\n\n`;

    r += `================================\n`;
    r += `💡 ACTION INSIGHTS\n`;
    r += `================================\n`;
    
    if (financial.netProfit < 0) r += `! URGENT: Business is running at a LOSS. Review COGS and Expenses.\n`;
    if (aging['90+'] > 10000) r += `! CASHFLOW: Collect ${formatCurrency(aging['90+'])} from old dues immediately.\n`;
    if (taskStats.overdue > 5) r += `! OPERATIONS: ${taskStats.overdue} tasks are overdue. Re-assign staff.\n`;
    if (financial.totalDiscount > (financial.revenue * 0.1)) r += `! PRICING: Discounts are high (${((financial.totalDiscount/financial.revenue)*100).toFixed(1)}% of sales). Control leaks.\n`;
    
    r += `\n[End of Report]`;

    return r;
};



// Change: Added setAdjustCashModal to props// --- OPTIMIZED TRANSACTION LIST (Fix: Paid Status & Build Error) ---
// --- OPTIMIZED TRANSACTION LIST (Final Fix: Includes Direct Received/Paid) ---
const TransactionList = ({ searchQuery, setSearchQuery, dateRange, setDateRange, data, listFilter, listPaymentMode, categoryFilter, pushHistory, setViewDetail, setAdjustCashModal }) => {
    const [sort, setSort] = useState('DateDesc');
    const [filter, setFilter] = useState(listFilter);
    const [visibleCount, setVisibleCount] = useState(50);
    // NEW: Selection States
    const [selectedIds, setSelectedIds] = useState([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const longPressTimer = useRef(null);

    useEffect(() => { setFilter(listFilter); }, [listFilter]);

    // Handle Back Button Warning
    useEffect(() => {
        const handleBack = () => {
            if (isSelectionMode) {
                if(window.confirm("Selection will be lost. Exit selection mode?")) {
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                }
                window.history.pushState(null, '', ''); 
            }
        };
        if(isSelectionMode) {
            window.history.pushState(null, '', ''); 
            window.addEventListener('popstate', handleBack);
        }
        return () => window.removeEventListener('popstate', handleBack);
    }, [isSelectionMode]);

    const linksMap = useMemo(() => {
        const map = {}; 
        data.transactions.forEach(tx => {
            if (tx.linkedBills && tx.status !== 'Cancelled') {
                tx.linkedBills.forEach(link => {
                    const targetId = String(link.billId);
                    if (!map[targetId]) map[targetId] = 0;
                    map[targetId] += parseFloat(link.amount || 0);
                });
            }
        });
        return map;
    }, [data.transactions]);

    const filtered = useMemo(() => {
        return data.transactions.filter(tx => {
            if (filter !== 'all' && tx.type !== filter) return false;
            if (listPaymentMode && (tx.paymentMode || 'Cash') !== listPaymentMode) return false;
            if (categoryFilter && tx.category !== categoryFilter) return false;
            if (dateRange.start && tx.date < dateRange.start) return false;
            if (dateRange.end && tx.date > dateRange.end) return false;if (listPaymentMode) {
                // REQ 1: Exclude Estimates from Cash/Bank Book
                if (tx.type === 'estimate') return false;
                
                const amt = ['sales'].includes(tx.type) ? parseFloat(tx.received||0) : 
                           ['purchase','expense'].includes(tx.type) ? parseFloat(tx.paid||0) : parseFloat(tx.amount||0);
                if (amt <= 0) return false;
            }
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                const party = data.parties.find(p => p.id === tx.partyId);
                const matchVoucher = tx.id.toLowerCase().includes(lowerQuery);
                const matchName = (party?.name || tx.category || '').toLowerCase().includes(lowerQuery);
                const matchDesc = (tx.description || '').toLowerCase().includes(lowerQuery);
                const matchAmount = (tx.amount || tx.finalTotal || 0).toString().includes(lowerQuery);
                return matchVoucher || matchName || matchDesc || matchAmount;
            }
            return true;
        });
    }, [data.transactions, filter, listPaymentMode, categoryFilter, dateRange, searchQuery, data.parties]);

    const statsData = useMemo(() => {
        return filtered.reduce((acc, tx) => {
            const amount = parseFloat(tx.amount || tx.finalTotal || 0);
            acc.total += amount;
            if(['sales', 'purchase', 'expense'].includes(tx.type)) {
               const linkedPaid = linksMap[String(tx.id)] || 0;
                const directPaid = parseFloat(tx.received || tx.paid || 0);
                const totalPaid = linkedPaid + directPaid;
                const pending = Math.max(0, amount - totalPaid);
                acc.pending += pending;
            }
            return acc;
        }, { total: 0, pending: 0 });
    }, [filtered, linksMap]);

    // Calculate Selected Total
    const selectedTotal = useMemo(() => {
        return filtered
            .filter(t => selectedIds.includes(t.id))
            .reduce((sum, t) => sum + parseFloat(t.amount || t.finalTotal || 0), 0);
    }, [selectedIds, filtered]);

    const sortedData = useMemo(() => sortData(filtered, sort), [filtered, sort]);
    const visibleData = sortedData.slice(0, visibleCount);

    // Interaction Handlers (Fixed for Mixed Mode)
    const ignoreClick = useRef(false);

    const handleHold = (id) => {
        longPressTimer.current = setTimeout(() => {
            ignoreClick.current = true; // Long press detected, ignore next click
            setIsSelectionMode(true);
            toggleSelect(id);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
    };

    const handleRelease = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleClick = (tx) => {
        // If this click was triggered by the long press release, ignore it
        if (ignoreClick.current) {
            ignoreClick.current = false;
            return;
        }
        // Otherwise, always open details (Checkbox handles selection separately)
        pushHistory(); 
        setViewDetail({ type: 'transaction', id: tx.id });
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
           {isSelectionMode ? (
               <div className="bg-blue-600 p-4 rounded-xl text-white flex justify-between items-center animate-in slide-in-from-top sticky top-0 z-20 shadow-xl">
                   <div>
                       <p className="text-xs font-bold opacity-80">{selectedIds.length} Selected</p>
                       <p className="text-2xl font-black">{formatCurrency(selectedTotal)}</p>
                   </div>
                   <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="p-2 bg-white/20 rounded-full"><X/></button>
               </div>
           ) : (
               <>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold">
                        {listPaymentMode ? `${listPaymentMode} Book` : `Accounting ${categoryFilter ? `(${categoryFilter})` : ''}`}
                      </h1>
                      {listPaymentMode && (
                          <button onClick={() => setAdjustCashModal({ type: listPaymentMode })} className="px-2 py-1 bg-gray-800 text-white text-[10px] rounded-lg font-bold">Adjust {listPaymentMode}</button>
                      )}
                  </div>
                  <div className="flex gap-2 items-center">
                      <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={sort} onChange={e => setSort(e.target.value)}><option value="DateDesc">Newest</option><option value="DateAsc">Oldest</option><option value="AmtDesc">High Amt</option><option value="AmtAsc">Low Amt</option></select>
                  </div>
                </div>
                <div className="flex gap-2">
                    <input type="date" className="w-1/2 p-2 border rounded-xl text-xs bg-white" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                    <input type="date" className="w-1/2 p-2 border rounded-xl text-xs bg-white" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                </div>
                </>
           )}

            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl text-sm" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
        </div>

        {!isSelectionMode && (
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
                <div className="flex gap-4">
                    <div><p className="text-[10px] font-bold text-blue-500 uppercase">Total Amount</p><p className="text-lg font-black text-blue-800">{formatCurrency(statsData.total)}</p></div>
                    <div><p className="text-[10px] font-bold text-red-500 uppercase">Total Due</p><p className="text-lg font-black text-red-800">{formatCurrency(statsData.pending)}</p></div>
                </div>
                <div className="bg-white px-3 py-1 rounded-lg text-xs font-bold text-blue-600 shadow-sm border border-blue-100">Count: {filtered.length}</div>
            </div>
        )}

        {!isSelectionMode && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['all', 'sales', 'estimate', 'purchase', 'expense', 'payment'].map(t => (
                    <button key={t} onClick={() => { setFilter(t); setSearchQuery(''); }} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                ))}
            </div>
        )}

        <div className="space-y-3">
          {visibleData.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            
            let totalAmt = parseFloat(tx.amount || tx.finalTotal || 0);
            if (listPaymentMode) {
                 if (tx.type === 'sales') totalAmt = parseFloat(tx.received || 0);
                 else if (tx.type === 'purchase' || tx.type === 'expense') totalAmt = parseFloat(tx.paid || 0);
            }
            
            const linkedPaid = linksMap[tx.id] || 0;
            const directPaid = parseFloat(tx.received || tx.paid || 0);
            const totalPaid = linkedPaid + directPaid;
            const pendingAmt = Math.max(0, totalAmt - totalPaid);
            
            let status = 'UNPAID';
            if (pendingAmt <= 0.5) status = 'PAID'; 
            else if (totalPaid > 0) status = 'PARTIAL';
            
            let paymentUnused = 0;
            if (tx.type === 'payment') {
                 const usedInternally = (tx.linkedBills || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
                 paymentUnused = totalAmt - (usedInternally + linkedPaid);
            }

            let typeLabel = tx.type;
            if(tx.type === 'payment') typeLabel = tx.subType === 'in' ? 'Payment IN' : 'Payment OUT';

            const mode = tx.paymentMode || 'Cash';
            const ModeIcon = (mode === 'Bank' || mode === 'UPI') ? Landmark : Banknote;
            const showPayIcon = (['sales','purchase','expense'].includes(tx.type) && (parseFloat(tx.received||0) > 0 || parseFloat(tx.paid||0) > 0));

            let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
            if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
            if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
            if (tx.type === 'payment') { Icon = ModeIcon; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }
            
            const isCancelled = tx.status === 'Cancelled';
            const isSelected = selectedIds.includes(tx.id);
            
            return (
              <div 
                key={tx.id} 
                onTouchStart={() => handleHold(tx.id)}
                onTouchEnd={handleRelease}
                onMouseDown={() => handleHold(tx.id)}
                onMouseUp={handleRelease}
                onMouseLeave={handleRelease}
                onClick={() => handleClick(tx)}
                className={`p-4 border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-all relative overflow-hidden ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : 'bg-white'} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
              >
                {isSelectionMode && (
                    <div className="mr-3 p-2 -ml-2" onClick={(e) => { e.stopPropagation(); toggleSelect(tx.id); }}>
                         <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                             {isSelected && <CheckCircle2 size={12} className="text-white"/>}
                         </div>
                    </div>
                )}
                <div className="flex gap-4 items-center flex-1">
                  <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                  <div>
                    <div className="flex items-center gap-2"><p className="font-bold text-gray-800">{party?.name || tx.category || 'N/A'}</p></div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">
                        {tx.type === 'payment' ? (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600">{typeLabel} #{tx.id.split(':')[1] || tx.id}</span>
                                <span className="text-gray-400"><ModeIcon size={12}/></span>
                                <span>{formatDate(tx.date)}</span>
                            </div>
                        ) : (
                            <span className="flex items-center gap-1">
                                {tx.id} 
                                {showPayIcon && <span className="text-green-600 ml-1" title={mode}><ModeIcon size={10}/></span>}
                                <span className="text-gray-300 mx-1">•</span> {formatDate(tx.date)}
                            </span>
                        )} 
                    </div>
                    {(tx.type === 'payment' || (searchQuery && tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase()))) && tx.description && ( 
                        <p className="text-[9px] text-gray-500 italic truncate max-w-[150px]">{tx.description}</p> 
                    )}
                    <div className="flex gap-1 mt-1">
                        {isCancelled ? (
                            <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-gray-200 text-gray-600">CANCELLED</span>
                        ) : (
                            <>
                                {['sales', 'purchase', 'expense'].includes(tx.type) && (
                                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${status === 'PAID' ? 'bg-green-100 text-green-700' : status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {status}
                                    </span>
                                )}
                                {tx.type === 'payment' && (() => {
                                    const payStats = getBillStats(tx, data.transactions);
                                    return (
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${payStats.status === 'FULLY USED' ? 'bg-green-100 text-green-700' : payStats.status === 'PARTIALLY USED' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {payStats.status}
                                        </span>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isCancelled ? 'text-gray-400 line-through' : isIncoming ? 'text-green-600' : 'text-red-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(totalAmt)}</p>
                  {['sales', 'purchase', 'expense'].includes(tx.type) && status !== 'PAID' && !isCancelled && <p className="text-[10px] font-bold text-orange-600">Bal: {formatCurrency(pendingAmt)}</p>}
                  {tx.type === 'payment' && !isCancelled && paymentUnused > 0.1 && <p className="text-[10px] font-bold text-orange-600">Unused: {formatCurrency(paymentUnused)}</p>}
                </div>
              </div>
            );
          })}
          {visibleCount < filtered.length && ( <button onClick={() => setVisibleCount(prev => prev + 50)} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200">Load More ({filtered.length - visibleCount})</button> )}
        </div>
      </div>
    );
};

const TaskModule = ({ data, user, pushHistory, setViewDetail, setModal, checkPermission,deleteRecord }) => {
    // 1. States
    const [sort, setSort] = useState(localStorage.getItem('smees_task_sort') || 'DateAsc');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('To Do');
    const [viewMode, setViewMode] = useState('tasks');
    const [duplicateView, setDuplicateView] = useState(null); // REQ 4: Duplicate Check State 
    
    // NEW STATES (For AMC Search & Grouping)
    const [amcSearch, setAmcSearch] = useState('');
    const [amcGroup, setAmcGroup] = useState(localStorage.getItem('smees_amc_group') || 'Month');

    useEffect(() => { localStorage.setItem('smees_task_sort', sort); }, [sort]);
    useEffect(() => { localStorage.setItem('smees_amc_group', amcGroup); }, [amcGroup]);

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
    
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (statusFilter === 'Converted') {
             // Sort by convertedDate desc (Newest first)
             const dateA = a.convertedDate || a.updatedAt || 0;
             const dateB = b.convertedDate || b.updatedAt || 0;
             return new Date(dateB) - new Date(dateA);
        }
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);
        if (sort === 'DateAsc') return dateA - dateB;
        if (sort === 'DateDesc') return dateB - dateA;
        if (sort === 'A-Z') return a.name.localeCompare(b.name);
        return 0;
    });

    const groupTasksByDate = (tasks) => {
        if(sort === 'A-Z') return { 'All Tasks': tasks };
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
    const sortedKeys = Object.keys(groupedTasks).sort((a,b) => {
        if(a === 'Today') return -1;
        if(b === 'Today') return 1;
        if(a === 'Tomorrow') return -1;
        if(b === 'Tomorrow') return 1;
        if(a === 'No Due Date') return 1;
        if(b === 'No Due Date') return -1;
        return a.localeCompare(b);
    });

    // NEW AMC LOGIC
   // NEW AMC LOGIC (Updated for Req 5)
    const amcData = useMemo(() => {
        if (viewMode !== 'amc') return { grouped: {}, keys: [] };
        
        const list = [];
        const today = new Date();
        
        data.parties.forEach(p => {
            (p.assets || []).forEach(a => {
                // REQ 5: Logic for 'All' vs 'Upcoming'
                const hasServiceDate = !!a.nextServiceDate;
                
                // For 'All', we take everything matching search. For 'Upcoming', need date.
                if (amcGroup === 'All' || hasServiceDate) {
                    const d = hasServiceDate ? new Date(a.nextServiceDate) : null;
                    const matchesSearch = !amcSearch || 
                        a.name.toLowerCase().includes(amcSearch.toLowerCase()) || 
                        p.name.toLowerCase().includes(amcSearch.toLowerCase());

                    if (matchesSearch) {
                        list.push({ 
                            party: p, 
                            asset: a, 
                            date: a.nextServiceDate, 
                            dateObj: d || new Date(9999, 11, 31), // Push no-date items to end if sorting
                            isOverdue: d ? d < today : false 
                        });
                    }
                }
            });
        });

        list.sort((a,b) => a.dateObj - b.dateObj);

        const grouped = {};
        
        if (amcGroup === 'All') {
            grouped['All Assets'] = list; // Single Group
        } else {
            // Existing Grouping Logic
            list.forEach(item => {
                let key = 'Others';
                if (!item.date) key = 'No Service Date';
                else if(amcGroup === 'Date') key = formatDate(item.date);
                else if(amcGroup === 'Week') { /* ... existing week logic ... */ }
                else if(amcGroup === 'Month') {
                    key = new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                }
                if(!grouped[key]) grouped[key] = [];
                grouped[key].push(item);
            });
        }

        return { grouped, keys: Object.keys(grouped) };
    }, [data.parties, viewMode, amcSearch, amcGroup]);

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
                {party && (
                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold truncate max-w-[150px] border border-blue-100">{party.name}</span>
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
    {/* Fix: AMC Tab hidden for non-admins */}
    {user.role === 'admin' && (
        <button onClick={()=>setViewMode('amc')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode==='amc' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>AMC / Assets</button>
    )}
</div>
          {viewMode === 'amc' && (
             <div className="flex gap-2 mb-3 border-b pb-2">
                 <button onClick={()=>setAmcGroup('Month')} className={`px-3 py-1 rounded-full text-xs font-bold ${amcGroup !== 'All' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>Upcoming AMC</button>
                 <button onClick={()=>setAmcGroup('All')} className={`px-3 py-1 rounded-full text-xs font-bold ${amcGroup === 'All' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>All Assets</button>
             </div>
        )}
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
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
                    {filterOptions.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200'}`}>{s}</button>
                    ))}

                    {/* REQ 4: Duplicate Invoice Checker Button */}
                    {statusFilter === 'Converted' && (
                        <button onClick={() => {
                            const duplicates = {};
                            data.tasks.forEach(t => {
                                if(t.generatedSaleId) {
                                    duplicates[t.generatedSaleId] = (duplicates[t.generatedSaleId] || 0) + 1;
                                }
                            });
                            const dupIds = Object.keys(duplicates).filter(id => duplicates[id] > 1);
                            const dupTasks = data.tasks.filter(t => dupIds.includes(t.generatedSaleId));
                            
                            if(dupTasks.length === 0) alert("No duplicate invoice numbers found.");
                            else setDuplicateView(dupTasks);
                        }} className="px-3 py-2 bg-red-100 text-red-600 rounded-full border border-red-200 text-xs font-bold whitespace-nowrap flex items-center gap-1 shrink-0">
                            <AlertTriangle size={12}/> Check Duplicates
                        </button>
                    )}
                </div>

                {/* REQ 4: Duplicate List Modal (Inline) */}
                {duplicateView && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-red-600">Duplicate Invoices Found</h3>
                                <button onClick={() => setDuplicateView(null)} className="p-2 bg-gray-100 rounded-full"><X size={18}/></button>
                            </div>
                            <div className="space-y-3">
                                {duplicateView.map(t => (
                                    <div key={t.id} className="p-3 border rounded-xl flex justify-between items-center bg-red-50">
                                        <div>
                                            <p className="font-bold text-sm">Task #{t.id}</p>
                                            <p className="text-xs text-gray-600">Inv: <span className="font-bold">{t.generatedSaleId}</span></p>
                                        </div>
                                        <button onClick={async () => {
                                            if(!window.confirm(`Clear Invoice ID from Task #${t.id}? This will allow re-conversion.`)) return;
                                            const updatedTask = { ...t, generatedSaleId: null, status: 'Done' }; // Revert to Done
                                            await setDoc(doc(db, "tasks", t.id), updatedTask);
                                            
                                            // Update Local Data immediately to reflect change
                                            const newTasks = data.tasks.map(x => x.id === t.id ? updatedTask : x);
                                            // Note: setData is passed as prop to TaskModule
                                            // If setData is not available directly, we rely on Firebase onSnapshot updates.
                                            // But for instant feedback in modal:
                                            setDuplicateView(prev => prev.filter(x => x.id !== t.id));
                                        }} className="px-3 py-1 bg-white border text-red-600 text-xs font-bold rounded-lg hover:bg-red-100">Clear & Fix</button>
                                    </div>
                                ))}
                                {duplicateView.length === 0 && <p className="text-center text-green-600 font-bold">All duplicates resolved!</p>}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="space-y-2 pb-20">
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
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2 text-gray-400" size={14}/>
                        <input className="w-full pl-8 p-2 border rounded-xl text-xs" placeholder="Search Asset/Client..." value={amcSearch} onChange={e=>setAmcSearch(e.target.value)} />
                    </div>
                    <select className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none" value={amcGroup} onChange={e=>setAmcGroup(e.target.value)}>
                        <option value="Date">By Date</option>
                        <option value="Week">By Week</option>
                        <option value="Month">By Month</option>
                    </select>
                </div>

                {amcData.keys.length === 0 && <div className="text-center text-gray-400 py-10">No upcoming services found.</div>}
                
                {amcData.keys.map(groupKey => (
                    <div key={groupKey}>
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-wider mb-2 mt-4 ml-1 sticky top-0 bg-gray-50 py-1 z-10">{groupKey}</h3>
                        {amcData.grouped[groupKey].map((item, idx) => {
                            // FIX: Robust check for existing task (Auto or Manual)
// FIX 1: Robust check that ignores Date Change
// FIX 7: Link by Open Status (Ignore Date Change)
        const existingTask = data.tasks.find(t => {
            const isSameParty = t.partyId === item.party.id;
            const isSameAsset = t.linkedAssetStr === item.asset.name;
            // Check if any task is Active (Not Converted/Cancelled)
            // Isse agar aap date change bhi karoge to bhi yahi task link rahega
            const isOpen = t.status !== 'Converted' && t.status !== 'Cancelled'; 
            return isSameParty && isSameAsset && isOpen;
        });
                            
                            return (
                                <div 
                                    key={idx} 
                                    // REQ 4: Clickable Row (Deep Link to Asset Detail)
                                    onClick={() => setViewDetail({ type: 'party', id: item.party.id, openAsset: item.asset.name })}
                                    className={`p-4 bg-white border rounded-2xl flex justify-between items-center mb-2 cursor-pointer active:scale-95 transition-all ${item.isOverdue ? 'border-red-200 bg-red-50' : ''}`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800">{item.asset.name}</span>
                                            {item.isOverdue && <span className="text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">OVERDUE</span>}
                                        </div>
                                        <p className="text-xs text-gray-600 font-bold">{item.party.name}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">Due: {formatDate(item.date)} ({item.asset.brand})</p>
                                    </div>
                                    
                                    {/* REQ 3 & 1: Created Status with Undo Option */}
                                    {existingTask ? (
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    pushHistory();
                                                    setViewDetail({ type: 'task', id: existingTask.id });
                                                }}
                                                className="px-3 py-2 bg-green-100 text-green-700 rounded-xl font-bold text-xs whitespace-nowrap flex items-center gap-1"
                                            >
                                                <CheckCircle2 size={12}/> Created
                                            </button>
                                            {/* Undo Button */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if(window.confirm('Undo auto-created task?')) {
                                                        deleteRecord('tasks', existingTask.id);
                                                    }
                                                }}
                                                className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                                                title="Undo / Delete Task"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
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
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        )}
      </div>
    );
};
// --- EXTERNALIZED SUB-COMPONENTS END ---

const ReportModal = ({ isOpen, onClose, data }) => {
    const [range, setRange] = useState('This Month');
    const [dates, setDates] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [reportText, setReportText] = useState('');

    useEffect(() => {
        if (!isOpen) { setReportText(''); return; }
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (range === 'This Month') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
        else if (range === 'Last Month') { start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0); }
        else if (range === 'This Week') { start.setDate(today.getDate() - today.getDay()); }

        if (range !== 'Custom') setDates({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    }, [range, isOpen]);

    const handleGenerate = () => setReportText(generateAIReport(data, dates.start, dates.end));
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-xl text-purple-700 flex items-center gap-2">🤖 AI Business Report</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-3 mb-4">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['This Month', 'Last Month', 'Custom'].map(r => <button key={r} onClick={() => setRange(r)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${range === r ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>{r}</button>)}
                    </div>
                    {range === 'Custom' && <div className="flex gap-2"><input type="date" className="w-1/2 p-2 border rounded-lg text-xs" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} /><input type="date" className="w-1/2 p-2 border rounded-lg text-xs" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} /></div>}
                    <button onClick={handleGenerate} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg">Generate Report</button>
                </div>
                {reportText && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 rounded-xl border relative">
                        <textarea readOnly className="flex-1 w-full p-3 text-xs font-mono text-gray-700 bg-transparent resize-none focus:outline-none" value={reportText}/>
                        <button onClick={() => { navigator.clipboard.writeText(reportText); alert("Copied!"); }} className="absolute top-2 right-2 p-2 bg-white shadow rounded-lg text-purple-600 font-bold text-xs flex items-center gap-1"><Copy size={12}/> Copy</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const LoginScreen = ({ setUser }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async () => {
      if(id === 'him23' && pass === 'Himanshu#3499sp') {
        try {
            // FIX: Admin ke liye bhi Firebase Auth zaruri hai
            await signInAnonymously(auth); 
            
            const adminUser = { name: 'Admin', role: 'admin', permissions: { canViewAccounts: true, canViewMasters: true, canViewTasks: true, canEditTasks: true, canViewDashboard: true } };
            setUser(adminUser);
            localStorage.setItem('smees_user', JSON.stringify(adminUser));
        } catch (e) {
            alert("Login Failed: Check Internet or Firebase Console");
            console.error(e);
        }
    }else {
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

// ==========================================
// PERSONAL MODE COMPONENTS (FIXED & TESTED)
// ==========================================

const PersonalDashboard = ({ data, setData, pushHistory, showToast, onClose }) => {
    // 1. STATE DEFINITIONS
    const [mainTab, setMainTab] = useState('finance'); 
    const [financeView, setFinanceView] = useState('transactions'); 
    const [showAddForm, setShowAddForm] = useState(false);
    const [filterType, setFilterType] = useState('Month'); 
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [taskSearch, setTaskSearch] = useState('');
    
    // FIX: Define viewDetail locally for Personal Mode
    const [viewDetail, setViewDetail] = useState(null); 
    
    // --- DATA HELPERS ---
    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [
        { id: 'cash', name: 'Cash', group: 'Cash', initialBalance: 0 }, 
        { id: 'bank', name: 'Bank Account', group: 'Bank', initialBalance: 0 }
    ];
    const categories = data.personalCategories || { 
        income: ['Salary', 'Business Profit', 'Interest'], 
        expense: ['Food', 'Travel', 'Shopping', 'Bills', 'Rent'],
        transfer: []
    };

    // --- CALCULATIONS ---
    const { accountGroups, totalBalance } = useMemo(() => {
        const groups = {}; 
        const bals = {};
        let total = 0;
        
        accounts.forEach(a => {
            const gName = a.group || 'General';
            if(!groups[gName]) groups[gName] = [];
            bals[a.name] = parseFloat(a.initialBalance || 0);
        });
        
        transactions.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') bals[t.account] = (bals[t.account] || 0) + amt;
            else if (t.type === 'expense') bals[t.account] = (bals[t.account] || 0) - amt;
            else if (t.type === 'transfer') {
                bals[t.account] = (bals[t.account] || 0) - amt;
                bals[t.toAccount] = (bals[t.toAccount] || 0) + amt;
            }
        });

        accounts.forEach(a => {
            const gName = a.group || 'General';
            const finalBal = bals[a.name] || 0;
            groups[gName].push({ ...a, balance: finalBal });
            total += finalBal;
        });

        return { accountGroups: groups, totalBalance: total };
    }, [transactions, accounts]);

    const filteredTxs = useMemo(() => {
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            const fDate = new Date(filterDate);
            if (filterType === 'Date') return t.date === filterDate;
            if (filterType === 'Month') return tDate.getMonth() === fDate.getMonth() && tDate.getFullYear() === fDate.getFullYear();
            return true; 
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filterDate, filterType]);

    // --- ACTIONS ---
    const handleSaveTransaction = async (entry, reset) => {
        const newTx = { 
            id: Date.now().toString(), 
            createdAt: new Date().toISOString(),
            date: entry.date || new Date().toISOString().split('T')[0],
            type: entry.type || 'expense',
            amount: parseFloat(entry.amount || 0),
            account: entry.account || '',       
            toAccount: entry.toAccount || '',
            category: entry.category || '',
            note: entry.note || '',
            desc: entry.desc || '',
            fee: parseFloat(entry.fee || 0)
        };
        
        let txsToSave = [newTx];
        if (newTx.type === 'transfer' && newTx.fee > 0) {
            txsToSave.push({
                ...newTx, id: (Date.now() + 1).toString(), type: 'expense', amount: newTx.fee,
                account: newTx.account, toAccount: '', category: 'Transfer Charges',
                note: `Fee: ${newTx.toAccount}`, fee: 0
            });
        }
        
        const updatedTxs = [...txsToSave, ...transactions];
        let updatedAccounts = [...accounts];
        [newTx.account, newTx.toAccount].forEach(n => {
            if(n && !accounts.some(a=>a.name===n)) updatedAccounts.push({id:Date.now().toString(), name:n, group:'General', initialBalance:0});
        });

        let updatedCats = { ...categories };
        if (newTx.category && !categories[newTx.type]?.includes(newTx.category)) {
            updatedCats[newTx.type] = [...(categories[newTx.type] || []), newTx.category];
        }

        const newData = { ...data, personalTransactions: updatedTxs, personalAccounts: updatedAccounts, personalCategories: updatedCats };
        setData(newData);

        try {
            await setDoc(doc(personalDb, "my_vault", "main_data"), {
                personalTransactions: updatedTxs, personalAccounts: updatedAccounts, personalCategories: updatedCats
            }, { merge: true });
        } catch (e) { alert("Save Error: " + e.message); }

        if (reset) return true;
        setShowAddForm(false);
    };

    // --- SUB-COMPONENTS ---
    const TransactionForm = ({ onSave, onCancel }) => {
        const [type, setType] = useState('expense'); 
        const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', fee: '', account: '', toAccount: '', category: '', note: '', desc: '' });
        
        const save = (reset = false) => {
            if (!form.amount || !form.account) return alert("Required fields missing!");
            onSave({ ...form, type }, reset);
            if (reset) setForm({ ...form, amount: '', fee: '', note: '', desc: '' });
        };

        return (
            <div className="fixed inset-0 z-[110] bg-white flex flex-col animate-in slide-in-from-bottom">
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                    <button onClick={onCancel} className="p-2"><X size={24} /></button>
                    <h2 className="font-bold text-lg">Add {type.toUpperCase()}</h2>
                    <div className="w-8"></div>
                </div>
                <div className="flex p-2 gap-2 bg-white">
                    {['income', 'expense', 'transfer'].map(t => (
                        <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-xl font-bold capitalize text-sm border ${type === t ? (t === 'income' ? 'bg-green-100 text-green-700 border-green-200' : t === 'expense' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200') : 'bg-gray-50 border-transparent'}`}>{t}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Date</label><input type="date" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
                        <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Amount</label><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-lg" placeholder="0.00" autoFocus value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">From Account</label><SearchableSelect options={accounts.map(a => ({ id: a.name, name: a.name }))} value={form.account} onChange={v => setForm({...form, account: v})} onAddNew={v => setForm({...form, account: v})} placeholder="Select Account" /></div>
                    {type === 'transfer' && (
                        <div className="flex gap-2">
                            <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 uppercase">To Account</label><SearchableSelect options={accounts.map(a => ({ id: a.name, name: a.name }))} value={form.toAccount} onChange={v => setForm({...form, toAccount: v})} onAddNew={v => setForm({...form, toAccount: v})} placeholder="Destination" /></div>
                            <div className="w-24"><label className="text-[10px] font-bold text-gray-400 uppercase">Fee</label><input type="number" className="w-full p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold" placeholder="0" value={form.fee} onChange={e => setForm({...form, fee: e.target.value})} /></div>
                        </div>
                    )}
                    {type !== 'transfer' && (
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Category</label><SearchableSelect options={(categories[type] || []).map(c => ({ id: c, name: c }))} value={form.category} onChange={v => setForm({...form, category: v})} onAddNew={v => setForm({...form, category: v})} placeholder="Category" /></div>
                    )}
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Note / Tag</label><SearchableSelect options={[...new Set(transactions.map(t => t.note).filter(Boolean))].map(n => ({ id: n, name: n }))} value={form.note} onChange={v => setForm({...form, note: v})} onAddNew={v => setForm({...form, note: v})} placeholder="Details" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Description</label><textarea className="w-full p-3 bg-gray-50 border rounded-xl" rows="3" placeholder="..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} /></div>
                </div>
                <div className="p-4 border-t bg-white flex gap-3">
                    <button onClick={() => save(false)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-700">Save</button>
                    <button onClick={() => save(true)} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${type === 'income' ? 'bg-green-600' : 'bg-blue-600'}`}>Save & Continue</button>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---
    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white pt-4 pb-0 px-4 shadow-lg shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">🔐 My Vault</h2>
                    <div className="flex gap-2">
                        <button onClick={() => alert("Auto-sync enabled!")} className="p-2 bg-slate-800 rounded-full"><RefreshCw size={18} className="text-blue-400"/></button>
                        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full"><LogOut size={18} className="text-red-400"/></button>
                    </div>
                </div>
                <div className="flex">
                    <button onClick={() => setMainTab('finance')} className={`flex-1 py-3 font-bold border-b-4 transition-colors ${mainTab === 'finance' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}>FINANCE</button>
                    <button onClick={() => setMainTab('tasks')} className={`flex-1 py-3 font-bold border-b-4 transition-colors ${mainTab === 'tasks' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400'}`}>TASKS</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 relative">
                
                {/* --- TASKS TAB --- */}
                {mainTab === 'tasks' && (
                    <div className="p-4 space-y-4">
                        <div className="flex gap-2">
                            <input className="flex-1 p-3 bg-white border rounded-xl shadow-sm" placeholder="Search Tasks..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
                            <button onClick={() => setShowAddForm('task')} className="bg-purple-600 text-white px-4 rounded-xl font-bold flex items-center gap-2"><Plus/> New Task</button>
                        </div>
                        <div className="space-y-3 pb-24">
                            {(data.personalTasks || []).filter(t => t.text.toLowerCase().includes(taskSearch.toLowerCase())).map(t => (
                                <div key={t.id} className="p-3 bg-white rounded-xl border shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3 items-center cursor-pointer" onClick={() => setViewDetail({ type: 'personalTask', id: t.id })}>
                                            <div className={`w-3 h-3 rounded-full ${t.status === 'Done' ? 'bg-green-500' : t.status === 'In Progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                                            <div>
                                                <p className={`font-bold ${t.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}</p>
                                                {t.desc && <p className="text-[10px] text-gray-500 line-clamp-1">{t.desc}</p>}
                                            </div>
                                        </div>
                                        <select 
                                            className="text-[10px] font-bold py-1 px-2 rounded border bg-gray-50"
                                            value={t.status || 'To Do'}
                                            onChange={async (e) => {
                                                const updated = data.personalTasks.map(task => task.id === t.id ? { ...task, status: e.target.value } : task);
                                                setData({ ...data, personalTasks: updated });
                                                await setDoc(doc(personalDb, "my_vault", "main_data"), { personalTasks: updated }, { merge: true });
                                            }}
                                        >
                                            <option>To Do</option><option>In Progress</option><option>Done</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-between items-center pl-6">
                                        <span className="text-[10px] flex items-center gap-1 text-gray-400"><Calendar size={10}/> {t.dueDate || 'No Date'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- FINANCE TAB --- */}
                {mainTab === 'finance' && (
                    <div className="flex flex-col h-full">
                        {financeView === 'transactions' && (
                            <div className="p-4 bg-white border-b space-y-4">
                                <div className="flex gap-2">
                                    <select className="bg-gray-100 p-2 rounded-lg text-xs font-bold" value={filterType} onChange={e => setFilterType(e.target.value)}><option>Month</option><option>Week</option><option>Date</option></select>
                                    <input type={filterType === 'Month' ? 'month' : 'date'} className="flex-1 bg-gray-100 p-2 rounded-lg text-xs font-bold" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-green-50 p-2 rounded-lg border border-green-100"><p className="text-[10px] text-green-600 uppercase font-bold">Income</p><p className="font-bold text-green-700">{formatCurrency(filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0))}</p></div>
                                    <div className="bg-red-50 p-2 rounded-lg border border-red-100"><p className="text-[10px] text-red-600 uppercase font-bold">Expense</p><p className="font-bold text-red-700">{formatCurrency(filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0))}</p></div>
                                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100"><p className="text-[10px] text-blue-600 uppercase font-bold">Balance</p><p className="font-bold text-blue-700">{formatCurrency(totalBalance)}</p></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
                            {financeView === 'transactions' && filteredTxs.map(t => (
                                <div key={t.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : t.type === 'expense' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {t.type === 'income' ? <TrendingUp size={16}/> : t.type === 'expense' ? <ShoppingCart size={16}/> : <Share2 size={16}/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{t.category || t.note || 'Transfer'}</p>
                                            <p className="text-[10px] text-gray-500">{t.desc || t.account} {t.toAccount ? `→ ${t.toAccount}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}

                            {financeView === 'accounts' && (
                                <div className="space-y-4">
                                    <div className="flex justify-end"><button onClick={() => {
                                        const group = prompt("Group Name (e.g. Cash):", "Cash"); if(!group) return;
                                        const name = prompt("Account Name (e.g. Wallet):"); if(!name) return;
                                        const newAccs = [...accounts, {id: Date.now().toString(), name, group, initialBalance: 0}];
                                        setData({...data, personalAccounts: newAccs});
                                        setDoc(doc(personalDb, "my_vault", "main_data"), { personalAccounts: newAccs }, { merge: true });
                                    }} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded-lg">+ Add Account</button></div>
                                    
                                    {Object.entries(accountGroups).map(([group, accs]) => (
                                        <div key={group} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                            <div className="bg-gray-50 p-2 px-3 font-bold text-xs text-gray-500 uppercase flex justify-between"><span>{group}</span><span>{formatCurrency(accs.reduce((s,a)=>s+a.balance,0))}</span></div>
                                            <div className="divide-y">
                                                {accs.map(acc => (
                                                    <div key={acc.name} onClick={() => setViewDetail({ type: 'personalAccount', id: acc.name })} className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                                                        <span className="font-bold text-sm text-gray-700">{acc.name}</span>
                                                        <span className={`font-bold text-sm ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(acc.balance)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {financeView === 'transactions' && <button onClick={() => setShowAddForm(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-[105]"><Plus size={28} /></button>}
                        <div className="bg-white border-t p-2 flex justify-around shrink-0 pb-6">
                            <button onClick={() => setFinanceView('transactions')} className={`flex flex-col items-center p-2 rounded-lg ${financeView==='transactions'?'text-blue-600 bg-blue-50':'text-gray-400'}`}><ReceiptText size={20}/><span className="text-[10px] font-bold mt-1">Trans</span></button>
                            <button onClick={() => setFinanceView('stats')} className={`flex flex-col items-center p-2 rounded-lg ${financeView==='stats'?'text-purple-600 bg-purple-50':'text-gray-400'}`}><TrendingUp size={20}/><span className="text-[10px] font-bold mt-1">Stats</span></button>
                            <button onClick={() => setFinanceView('accounts')} className={`flex flex-col items-center p-2 rounded-lg ${financeView==='accounts'?'text-orange-600 bg-orange-50':'text-gray-400'}`}><Banknote size={20}/><span className="text-[10px] font-bold mt-1">Accounts</span></button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS & OVERLAYS */}
            
            {showAddForm === true && <TransactionForm onSave={handleSaveTransaction} onCancel={() => setShowAddForm(false)} />}

            {showAddForm === 'task' && (
                <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-4 animate-in slide-in-from-bottom">
                        <h3 className="font-bold text-lg">New Task</h3>
                        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" id="p_task_name" autoFocus />
                        <textarea className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Description..." id="p_task_desc" rows="3"></textarea>
                        <div className="flex gap-2">
                            <input type="date" className="flex-1 p-3 bg-gray-50 border rounded-xl" id="p_task_date" />
                            <select className="flex-1 p-3 bg-gray-50 border rounded-xl" id="p_task_status"><option>To Do</option><option>In Progress</option><option>Done</option></select>
                        </div>
                        <button onClick={async () => {
                            const name = document.getElementById('p_task_name').value;
                            if(!name) return alert("Name required");
                            const newTask = {
                                id: Date.now().toString(),
                                text: name,
                                desc: document.getElementById('p_task_desc').value,
                                dueDate: document.getElementById('p_task_date').value,
                                status: document.getElementById('p_task_status').value,
                                date: new Date().toISOString()
                            };
                            const updatedTasks = [newTask, ...(data.personalTasks || [])];
                            setData({ ...data, personalTasks: updatedTasks });
                            await setDoc(doc(personalDb, "my_vault", "main_data"), { personalTasks: updatedTasks }, { merge: true });
                            setShowAddForm(false);
                        }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold">Create Task</button>
                        <button onClick={() => setShowAddForm(false)} className="w-full py-3 text-gray-500 font-bold">Cancel</button>
                    </div>
                </div>
            )}

            {/* DETAIL VIEWS */}
            {viewDetail?.type === 'personalTask' && (() => {
                const t = (data.personalTasks || []).find(x => x.id === viewDetail.id);
                if(!t) return null;
                return (
                    <div className="fixed inset-0 z-[130] bg-white flex flex-col animate-in slide-in-from-right">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <button onClick={() => setViewDetail(null)} className="flex items-center gap-2"><ArrowLeft/> Back</button>
                            <div className="flex gap-2">
                                <button onClick={async () => {
                                    if(window.confirm("Delete Task?")) {
                                        const updated = data.personalTasks.filter(x => x.id !== t.id);
                                        setData({ ...data, personalTasks: updated });
                                        await setDoc(doc(personalDb, "my_vault", "main_data"), { personalTasks: updated }, { merge: true });
                                        setViewDetail(null);
                                    }
                                }} className="p-2 bg-slate-800 rounded-full text-red-400"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <h2 className="text-2xl font-bold">{t.text}</h2>
                            <p className="text-gray-600">{t.desc || 'No Description'}</p>
                            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                                <div className="flex justify-between"><span className="text-gray-500 font-bold text-xs uppercase">Status</span><span className="font-bold text-sm">{t.status}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500 font-bold text-xs uppercase">Due Date</span><span className="font-bold text-sm">{t.dueDate || 'N/A'}</span></div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {viewDetail?.type === 'personalAccount' && (() => {
                const acc = accounts.find(a => a.name === viewDetail.id);
                if(!acc) return null;
                const accTxs = transactions.filter(t => t.account === acc.name || t.toAccount === acc.name);
                return (
                    <div className="fixed inset-0 z-[130] bg-white flex flex-col animate-in slide-in-from-right">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <button onClick={() => setViewDetail(null)} className="flex items-center gap-2"><ArrowLeft/> Back</button>
                            <button onClick={async () => {
                                if(window.confirm("Delete Account?")) {
                                    const updated = accounts.filter(a => a.name !== acc.name);
                                    setData({ ...data, personalAccounts: updated });
                                    await setDoc(doc(personalDb, "my_vault", "main_data"), { personalAccounts: updated }, { merge: true });
                                    setViewDetail(null);
                                }
                            }} className="p-2 bg-slate-800 rounded-full text-red-400"><Trash2 size={18}/></button>
                        </div>
                        <div className="bg-blue-50 p-8 flex flex-col items-center border-b">
                            <h2 className="text-2xl font-bold text-gray-800">{acc.name}</h2>
                            <p className="text-xs font-bold text-gray-500 uppercase">{acc.group}</p>
                            <h3 className={`text-3xl font-black mt-2 ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(acc.balance)}</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <h4 className="font-bold text-gray-400 text-xs uppercase">Recent Activity</h4>
                            {accTxs.map(t => (
                                <div key={t.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : t.type === 'expense' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {t.type === 'income' ? <TrendingUp size={16}/> : t.type === 'expense' ? <ShoppingCart size={16}/> : <Share2 size={16}/>}
                                        </div>
                                        <div><p className="font-bold text-sm">{t.category || t.note || 'Transfer'}</p><p className="text-[10px] text-gray-500">{new Date(t.date).toLocaleDateString()}</p></div>
                                    </div>
                                    <span className={`font-bold ${(t.type==='income' && t.account===acc.name)||(t.type==='transfer'&&t.toAccount===acc.name)?'text-green-600':'text-red-600'}`}>{(t.type==='income' && t.account===acc.name)||(t.type==='transfer'&&t.toAccount===acc.name)?'+':'-'}{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// ==========================================
// 💰 ENHANCED PERSONAL FINANCE COMPONENT
// Features: Udhar Management, Credit Card Tracking
// ==========================================

// YE CODE Line 1276 ke baad PersonalFinanceView को REPLACE kar dega

const PersonalFinanceView = ({ data, setData, onBack, showToast }) => {
  const [filter, setFilter] = useState('all'); // all, income, expense, udhar, credit
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [form, setForm] = useState({ 
    type: 'expense', 
    amount: '', 
    category: '', 
    note: '', 
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    // NEW: For Udhar
    personName: '',
    udharType: 'given', // given or taken
    // NEW: For Credit Card
    creditCardName: '',
    dueDate: ''
  });
  
  const transactions = data.personalTransactions || [];
  
  // Filter Logic - Enhanced
  const filteredTx = filter === 'all' 
    ? transactions 
    : filter === 'udhar'
      ? transactions.filter(t => t.category === 'Udhar Given' || t.category === 'Udhar Taken' || t.category === 'Udhar Return')
      : filter === 'credit'
        ? transactions.filter(t => t.paymentMode === 'Credit Card')
        : transactions.filter(t => t.type === filter);
  
  // Enhanced Categories
  const expenseCategories = [
    'Food & Dining', 
    'Transport', 
    'Shopping', 
    'Bills & Utilities', 
    'Health & Medical', 
    'Entertainment', 
    'Education',
    'Groceries',
    'Fuel',
    'Credit Card Bill',
    'Other'
  ];
  
  const incomeCategories = [
    'Salary', 
    'Freelance', 
    'Investment Returns', 
    'Gift Received', 
    'Bonus',
    'Side Income',
    'Other'
  ];
  
  const udharCategories = [
    'Udhar Given',
    'Udhar Taken', 
    'Udhar Return'
  ];
  
  const handleSave = () => {
    if (!form.amount) {
      showToast('Please enter amount', 'error');
      return;
    }
    
    // Validation for Udhar
    if ((form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return') && !form.personName) {
      showToast('Please enter person name', 'error');
      return;
    }
    
    // Validation for Credit Card
    if (form.paymentMode === 'Credit Card' && !form.creditCardName) {
      showToast('Please enter credit card name', 'error');
      return;
    }
    
    if (!form.category) {
      showToast('Please select category', 'error');
      return;
    }
    
    const newTx = {
      id: editingTx?.id || `PTX-${Date.now()}`,
      ...form,
      amount: parseFloat(form.amount),
      createdAt: new Date().toISOString()
    };
    
    const updated = editingTx 
      ? transactions.map(t => t.id === editingTx.id ? newTx : t)
      : [...transactions, newTx];
    
    setData({ ...data, personalTransactions: updated });
    localStorage.setItem('smees_data', JSON.stringify({ ...data, personalTransactions: updated }));
    
    showToast(editingTx ? 'Updated!' : 'Added!', 'success');
    setShowForm(false);
    setEditingTx(null);
    resetForm();
  };
  
  const resetForm = () => {
    setForm({ 
      type: 'expense', 
      amount: '', 
      category: '', 
      note: '', 
      date: new Date().toISOString().split('T')[0], 
      paymentMode: 'Cash',
      personName: '',
      udharType: 'given',
      creditCardName: '',
      dueDate: ''
    });
  };
  
  const handleDelete = (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    const updated = transactions.filter(t => t.id !== id);
    setData({ ...data, personalTransactions: updated });
    localStorage.setItem('smees_data', JSON.stringify({ ...data, personalTransactions: updated }));
    showToast('Deleted!', 'success');
  };
  
  // Stats - Enhanced
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  
  // NEW: Udhar Stats
  const udharGiven = transactions
    .filter(t => t.category === 'Udhar Given')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const udharTaken = transactions
    .filter(t => t.category === 'Udhar Taken')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const udharReturned = transactions
    .filter(t => t.category === 'Udhar Return')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  
  const netUdharReceivable = udharGiven - udharReturned; // Kitna milna hai
  const netUdharPayable = udharTaken - udharReturned; // Kitna dena hai
  
  // NEW: Credit Card Stats
  const creditCardExpenses = transactions
    .filter(t => t.paymentMode === 'Credit Card')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b p-4 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg flex-1">💰 Money Manager</h2>
          <button 
            onClick={() => { setShowForm(true); setEditingTx(null); }}
            className="p-2 bg-blue-600 text-white rounded-full"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {/* Summary Cards - Enhanced */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="text-xs text-green-600 mb-1">💵 Income</div>
            <div className="font-black text-green-700">{formatCurrency(totalIncome)}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-200">
            <div className="text-xs text-red-600 mb-1">💸 Expense</div>
            <div className="font-black text-red-700">{formatCurrency(totalExpense)}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
            <div className="text-xs text-blue-600 mb-1">📥 To Receive</div>
            <div className="font-black text-blue-700">{formatCurrency(netUdharReceivable)}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
            <div className="text-xs text-orange-600 mb-1">📤 To Pay</div>
            <div className="font-black text-orange-700">{formatCurrency(netUdharPayable)}</div>
          </div>
          {creditCardExpenses > 0 && (
            <div className="col-span-2 bg-purple-50 rounded-xl p-3 border border-purple-200">
              <div className="text-xs text-purple-600 mb-1">💳 Credit Card</div>
              <div className="font-black text-purple-700">{formatCurrency(creditCardExpenses)}</div>
            </div>
          )}
        </div>
        
        {/* Filter Tabs - Enhanced */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All', icon: '📊' },
            { key: 'income', label: 'Income', icon: '💰' },
            { key: 'expense', label: 'Expense', icon: '💸' },
            { key: 'udhar', label: 'Udhar', icon: '🤝' },
            { key: 'credit', label: 'Credit', icon: '💳' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 ${
                filter === f.key 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Transaction List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filteredTx.length === 0 ? (
          <div className="text-center py-12">
            <Banknote size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No transactions yet</p>
          </div>
        ) : (
          filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => {
            const isUdhar = tx.category === 'Udhar Given' || tx.category === 'Udhar Taken' || tx.category === 'Udhar Return';
            const isCreditCard = tx.paymentMode === 'Credit Card';
            
            return (
              <div 
                key={tx.id}
                className="bg-white rounded-xl p-4 border flex items-center gap-3 active:bg-gray-50"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isUdhar 
                    ? 'bg-blue-100' 
                    : isCreditCard 
                      ? 'bg-purple-100'
                      : tx.type === 'income' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                }`}>
                  {isUdhar ? (
                    <span className="text-xl">🤝</span>
                  ) : isCreditCard ? (
                    <span className="text-xl">💳</span>
                  ) : tx.type === 'income' ? (
                    <TrendingUp size={20} className="text-green-600" />
                  ) : (
                    <ShoppingCart size={20} className="text-red-600" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <div className="font-bold text-gray-800">
                    {tx.category}
                    {tx.personName && <span className="text-blue-600"> • {tx.personName}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(tx.date)} • {tx.paymentMode}
                    {tx.creditCardName && <span className="text-purple-600"> ({tx.creditCardName})</span>}
                  </div>
                  {tx.note && <div className="text-xs text-gray-400 mt-1">{tx.note}</div>}
                </div>
                
                {/* Amount & Actions */}
                <div className="text-right">
                  <div className={`font-black ${
                    isUdhar 
                      ? tx.category === 'Udhar Given' || tx.category === 'Udhar Return'
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                      : tx.type === 'income' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => { setEditingTx(tx); setForm(tx); setShowForm(true); }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Edit2 size={14} className="text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Add/Edit Form Modal - ENHANCED */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingTx ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingTx(null); resetForm(); }}>
                <X size={24} />
              </button>
            </div>
            
            {/* Type Selection */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'expense', label: 'Expense', color: 'red' },
                { key: 'income', label: 'Income', color: 'green' },
                { key: 'udhar', label: 'Udhar', color: 'blue' }
              ].map(type => (
                <button
                  key={type.key}
                  onClick={() => {
                    if (type.key === 'udhar') {
                      setForm({ ...form, type: 'expense', category: 'Udhar Given' });
                    } else {
                      setForm({ ...form, type: type.key, category: '' });
                    }
                  }}
                  className={`py-3 rounded-xl font-bold capitalize ${
                    (form.type === type.key && type.key !== 'udhar') || 
                    (type.key === 'udhar' && (form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return'))
                      ? type.color === 'green' 
                        ? 'bg-green-600 text-white' 
                        : type.color === 'blue'
                          ? 'bg-blue-600 text-white'
                          : 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            
            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Amount</label>
              <input
                type="number"
                className="w-full p-3 bg-gray-50 border rounded-xl text-lg font-bold"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            
            {/* Category - Dynamic based on type */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Category</label>
              <select
                className="w-full p-3 bg-gray-50 border rounded-xl"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select Category</option>
                {(form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return'
                  ? udharCategories
                  : form.type === 'expense' 
                    ? expenseCategories 
                    : incomeCategories
                ).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {/* Person Name - Show only for Udhar */}
            {(form.category === 'Udhar Given' || form.category === 'Udhar Taken' || form.category === 'Udhar Return') && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                  Person Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-gray-50 border rounded-xl"
                  placeholder="Friend/Family name"
                  value={form.personName}
                  onChange={e => setForm({ ...form, personName: e.target.value })}
                />
              </div>
            )}
            
            {/* Date */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Date</label>
              <input
                type="date"
                className="w-full p-3 bg-gray-50 border rounded-xl"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            
            {/* Payment Mode */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Payment Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {['Cash', 'Bank', 'UPI', 'Credit Card'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setForm({ ...form, paymentMode: mode })}
                    className={`py-2 rounded-lg font-bold text-xs ${
                      form.paymentMode === mode
                        ? mode === 'Credit Card'
                          ? 'bg-purple-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Credit Card Name - Show only if payment mode is Credit Card */}
            {form.paymentMode === 'Credit Card' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                  Credit Card Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-gray-50 border rounded-xl"
                  placeholder="e.g., HDFC Regalia"
                  value={form.creditCardName}
                  onChange={e => setForm({ ...form, creditCardName: e.target.value })}
                />
              </div>
            )}
            
            {/* Note */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Note (Optional)</label>
              <textarea
                className="w-full p-3 bg-gray-50 border rounded-xl"
                rows="2"
                placeholder="Add a note..."
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold"
            >
              {editingTx ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PersonalTasksView = ({ data, setData, onBack, showToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    time: '',
    priority: 'medium',
    status: 'pending'
  });
  
  const tasks = data.personalTasks || [];
  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'Done');
  
  const handleSave = () => {
    if (!form.title) {
      showToast('Please enter task title', 'error');
      return;
    }
    
    const newTask = {
      id: editingTask?.id || `PT-${Date.now()}`,
      ...form,
      createdAt: new Date().toISOString()
    };
    
    const updated = editingTask
      ? tasks.map(t => t.id === editingTask.id ? newTask : t)
      : [...tasks, newTask];
    
    setData({ ...data, personalTasks: updated });
    localStorage.setItem('smees_data', JSON.stringify({ ...data, personalTasks: updated }));
    
    showToast(editingTask ? 'Updated!' : 'Added!', 'success');
    setShowForm(false);
    setEditingTask(null);
    setForm({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], time: '', priority: 'medium', status: 'pending' });
  };
  
  const handleToggleStatus = (task) => {
    const updated = tasks.map(t => 
      t.id === task.id 
        ? { ...t, status: t.status === 'Done' ? 'pending' : 'Done' }
        : t
    );
    setData({ ...data, personalTasks: updated });
    localStorage.setItem('smees_data', JSON.stringify({ ...data, personalTasks: updated }));
    showToast('Status updated!', 'success');
  };
  
  const handleDelete = (id) => {
    if (!window.confirm('Delete this task?')) return;
    const updated = tasks.filter(t => t.id !== id);
    setData({ ...data, personalTasks: updated });
    localStorage.setItem('smees_data', JSON.stringify({ ...data, personalTasks: updated }));
    showToast('Deleted!', 'success');
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b p-4 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg flex-1">Personal Tasks</h2>
          <button 
            onClick={() => { setShowForm(true); setEditingTask(null); }}
            className="p-2 bg-purple-600 text-white rounded-full"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
            <div className="text-xs text-orange-600 mb-1">Pending</div>
            <div className="font-black text-orange-700">{pending.length}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="text-xs text-green-600 mb-1">Completed</div>
            <div className="font-black text-green-700">{completed.length}</div>
          </div>
        </div>
      </div>
      
      {/* Task List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No tasks yet</p>
          </div>
        ) : (
          <>
            {/* Pending Tasks */}
            {pending.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">Pending</h3>
                {pending.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onToggle={handleToggleStatus}
                    onEdit={() => { setEditingTask(task); setForm(task); setShowForm(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
            
            {/* Completed Tasks */}
            {completed.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-gray-500 text-xs uppercase mb-2">Completed</h3>
                {completed.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onToggle={handleToggleStatus}
                    onEdit={() => { setEditingTask(task); setForm(task); setShowForm(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingTask(null); }}>
                <X size={24} />
              </button>
            </div>
            
            {/* Title */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Task Title</label>
              <input
                type="text"
                className="w-full p-3 bg-gray-50 border rounded-xl"
                placeholder="e.g., Complete project report"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Description (Optional)</label>
              <textarea
                className="w-full p-3 bg-gray-50 border rounded-xl"
                rows="3"
                placeholder="Add details..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Due Date</label>
                <input
                  type="date"
                  className="w-full p-3 bg-gray-50 border rounded-xl"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Time (Optional)</label>
                <input
                  type="time"
                  className="w-full p-3 bg-gray-50 border rounded-xl"
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>
            
            {/* Priority */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {['low', 'medium', 'high'].map(p => (
                  <button
                    key={p}
                    onClick={() => setForm({ ...form, priority: p })}
                    className={`py-2 rounded-lg font-bold text-sm capitalize ${
                      form.priority === p
                        ? p === 'high' ? 'bg-red-600 text-white' :
                          p === 'medium' ? 'bg-orange-600 text-white' :
                          'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold"
            >
              {editingTask ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Component for Task Card
const TaskCard = ({ task, onToggle, onEdit, onDelete }) => {
  const isOverdue = task.status !== 'Done' && new Date(task.dueDate) < new Date();
  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-orange-200 bg-orange-50',
    low: 'border-green-200 bg-green-50'
  };
  
  return (
    <div className={`rounded-xl p-4 border mb-2 ${task.status === 'Done' ? 'bg-gray-50 opacity-60' : priorityColors[task.priority] || 'bg-white'}`}>
      <div className="flex gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            task.status === 'Done' 
              ? 'bg-green-600 border-green-600' 
              : 'border-gray-300 hover:border-green-600'
          }`}
        >
          {task.status === 'Done' && <CheckCircle2 size={16} className="text-white" />}
        </button>
        
        {/* Content */}
        <div className="flex-1">
          <div className={`font-bold ${task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="text-sm text-gray-600 mt-1">{task.description}</div>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}>
              📅 {formatDate(task.dueDate)}
              {task.time && ` • ${task.time}`}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              task.priority === 'high' ? 'bg-red-200 text-red-700' :
              task.priority === 'medium' ? 'bg-orange-200 text-orange-700' :
              'bg-green-200 text-green-700'
            }`}>
              {task.priority}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-white rounded"
          >
            <Edit2 size={16} className="text-blue-600" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 hover:bg-white rounded"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================

const ConvertTaskModal = ({ task, data, onClose, saveRecord, setViewDetail }) => {
  const record = task || data;
  const party = data.parties.find(p => p.id === record.partyId);
  
  // FIX: Auto-Select Linked Asset from Task
  const initialAssets = [];
  if(record.linkedAssetStr) {
      // Find asset in party
      const assetMatch = party?.assets?.find(a => a.name === record.linkedAssetStr);
      if(assetMatch) {
           // CHANGE 6: Use Asset Default
           const interval = assetMatch.serviceInterval ? parseInt(assetMatch.serviceInterval) : 3;
           const d = new Date();
           d.setMonth(d.getMonth() + interval);
           initialAssets.push({ name: assetMatch.name, nextServiceDate: d.toISOString().split('T')[0] });
      }
  }

  // REQ 5: Description initially blank
  const [form, setForm] = useState({ 
      date: new Date().toISOString().split('T')[0], 
      received: '', 
      mode: 'Cash',
      linkedAssets: initialAssets,
      description: '' // Manual description field
  });

  const handleAddAsset = (assetName) => {
      // CHANGE 6: Auto Calculate for Convert Task
      const assetObj = party?.assets?.find(a => a.name === assetName);
      const interval = assetObj?.serviceInterval ? parseInt(assetObj.serviceInterval) : 3;

      const d = new Date(form.date);
      d.setMonth(d.getMonth() + interval); 
      const nextDate = d.toISOString().split('T')[0];
      setForm(prev => ({...prev, linkedAssets: [...prev.linkedAssets, { name: assetName, nextServiceDate: nextDate }] }));
  };

  if (!record) return null;

  const handleConfirm = async () => {
      // FIX 6: Refresh Counters & Let saveRecord handle ID (Prevents Overwrite)
      try {
          const counterSnap = await getDoc(doc(db, "settings", "counters"));
          if(counterSnap.exists()) {
              // Local Counters ko update kar do taaki getNextId (inside saveRecord) sahi Fresh ID banaye
              // Hum yahan 'data' prop ko directly mutate kar rahe hain temporary fix ke liye
              data.counters = { ...data.counters, ...counterSnap.data() };
          }
      } catch(e) {
          console.error("Counter Sync Error", e);
      }

      const saleItems = (record.itemsUsed || []).map(i => ({ 
          itemId: i.itemId, 
          qty: i.qty, 
          price: i.price, 
          buyPrice: i.buyPrice || 0, 
          description: i.description || '',
          brand: i.brand || '' 
      }));

      const gross = saleItems.reduce((acc, i) => acc + (parseFloat(i.qty || 0)*parseFloat(i.price || 0)), 0);
      const workDoneBy = (record.timeLogs || []).map(l => `${l.staffName} (${l.duration}m)`).join(', ');
      const totalMins = (record.timeLogs || []).reduce((acc,l) => acc + (parseFloat(l.duration)||0), 0);
      const workSummary = totalMins > 0 ? `${workDoneBy} | Total: ${totalMins} mins` : '';
     // REQ 7: Pre-check if next invoice number is already used
      const currentCounter = data.counters?.sales || 0;
      const nextIdToCheck = `Sales:${currentCounter + 1}`; // Assuming format is Sales:123
      const isDuplicate = data.tasks.some(t => t.generatedSaleId === nextIdToCheck);
      
      if(isDuplicate) {
          alert(`CRITICAL ERROR: The next Invoice Number (${nextIdToCheck}) is ALREADY assigned to another Task! Please check "Converted" tasks or fix counters.`);
          return;
      }
      const newSale = { 
          // FIX: Removed 'id' field so saveRecord treats it as NEW and increments counter
          // id: nextId, <--- REMOVED
          type: 'sales', 
          date: form.date, 
          partyId: record.partyId, 
          items: saleItems, 
          discountType: '%', 
          discountValue: 0, 
          received: parseFloat(form.received || 0), 
          paymentMode: form.mode, 
          grossTotal: gross, 
          finalTotal: gross, 
          convertedFromTask: record.id, 
          workSummary: workSummary, 
          description: form.description, // REQ 5: Use manual description
          linkedAssets: form.linkedAssets 
      };
      
      // FIX 5: Robust Asset Date Update with Timestamp
      if (form.linkedAssets.length > 0 && party && party.assets) {
          const timestamp = new Date().toISOString();
          const updatedAssets = party.assets.map(a => {
              const match = form.linkedAssets.find(la => la.name === a.name);
              return match ? { ...a, nextServiceDate: match.nextServiceDate } : a;
          });
          
          const updatedParty = { ...party, assets: updatedAssets, updatedAt: timestamp };
          
          // 1. Update Local Data Immediately
          // Note: App.js ka setData hum yahan direct access nahi kar sakte prop ke bina,
          // but Firebase update + Sync will handle it. Better to trigger refresh.
          
          // 2. Update Firebase
          await setDoc(doc(db, "parties", party.id), updatedParty); 
      }

      // 2. Save Sale
      // Note: saveRecord will handle ID generation logic inside App.js too, 
      // but providing ID overrides it.
      // Better to let saveRecord handle ID to keep counters synced in App state.
      // We pass 'sales' type so it increments counter.
      const saleId = await saveRecord('transactions', newSale, 'sales');
      
      // 3. Update Task Status
      const updatedTask = { ...record, status: 'Converted', generatedSaleId: saleId, convertedDate: new Date().toISOString()};
      await saveRecord('tasks', updatedTask, 'task');
      
      if(onClose) onClose();
      if(setViewDetail) setViewDetail({ type: 'transaction', id: saleId });
      // FIX 1: Update Linked Asset Service Date
          if (form.linkedAssets && form.linkedAssets.length > 0 && party.assets) {
              const updatedAssets = party.assets.map(asset => {
                  const linked = form.linkedAssets.find(la => la.name === asset.name);
                  if (linked) {
                      // Calculate Next Date: Current Next Date + Interval (Default 3 months)
                      const currentNext = new Date(asset.nextServiceDate || new Date());
                      const interval = parseInt(asset.serviceInterval || 3);
                      currentNext.setMonth(currentNext.getMonth() + interval);
                      return { ...asset, nextServiceDate: currentNext.toISOString().split('T')[0] };
                  }
                  return asset;
              });
              
              // Save updated assets to Party
              await updateDoc(doc(db, "parties", party.id), { assets: updatedAssets });
              
              // Update Local Data
              const updatedParty = { ...party, assets: updatedAssets };
              data.parties = data.parties.map(p => p.id === party.id ? updatedParty : p);
          };
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">Convert to Sale</h3>
                <button onClick={onClose} className="p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
                {/* Basic Fields */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Conversion Date</label>
                    <input type="date" className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Mode</label>
                        <select className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}><option>Cash</option><option>Bank</option><option>UPI</option></select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Received</label>
                        <input type="number" className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-sm" placeholder="0.00" value={form.received} onChange={e => setForm({...form, received: e.target.value})}/>
                    </div>
                </div>
               <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 block mb-1">Description (Optional)</label>
                  <textarea 
                    className="w-full p-3 border rounded-xl text-sm bg-gray-50 h-20" 
                    placeholder="Enter invoice description..."
                    value={form.description} 
                    onChange={e => setForm({...form, description: e.target.value})}
                  />
              </div>
                {/* --- NEW: Link Assets Section --- */}
                {party?.assets?.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-2">
                        <label className="text-xs font-bold text-blue-700 uppercase">Link Assets / AMC</label>
                        <select 
                            className="w-full p-2 border rounded-lg text-xs" 
                            value="" 
                            onChange={(e) => handleAddAsset(e.target.value)}
                        >
                            <option value="">+ Select Asset to Link</option>
                            {party.assets.map((a, i) => (
                                <option key={i} value={a.name} disabled={form.linkedAssets.some(la => la.name === a.name)}>
                                    {a.name} ({a.brand}) {form.linkedAssets.some(la => la.name === a.name) ? '✓' : ''}
                                </option>
                            ))}
                        </select>
                        {/* List Selected */}
                        {form.linkedAssets.map((asset, idx) => (
                            <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-xs text-blue-900">{asset.name}</p>
                                    <input type="date" className="mt-1 p-1 border rounded text-[10px]" value={asset.nextServiceDate} onChange={(e) => {
                                        const n = [...form.linkedAssets]; n[idx].nextServiceDate = e.target.value;
                                        setForm({...form, linkedAssets: n});
                                    }}/>
                                </div>
                                <button onClick={() => setForm(prev => ({...prev, linkedAssets: prev.linkedAssets.filter((_,i)=>i!==idx)}))} className="text-red-500"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-3 pt-2 mt-2">
                    <button onClick={onClose} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-200">Cancel</button>
                    <button onClick={handleConfirm} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700">Confirm & Save</button>
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

          // Item Details Row (Improved)
          let detailsHTML = '';
          if (showItems && tx.items && tx.items.length > 0) {
              const itemsList = tx.items.map(item => {
                  const iName = data.items.find(x => x.id === item.itemId)?.name || 'Item';
                  // CHANGE: Format -> Name (Brand) - Desc | Qty x Rate = Total
                  const brandStr = item.brand ? `(${item.brand})` : '';
                  const descStr = item.description ? `- ${item.description}` : '';
                  return `<div style="font-size:10px; color:#555; padding-left:10px; margin-bottom:2px;">
                      • <strong>${iName} ${brandStr}</strong> ${descStr} <br/>
                      <span style="color:#888;">&nbsp;&nbsp; Qty: ${item.qty} x ₹${item.price} = ₹${(item.qty * item.price).toFixed(2)}</span>
                  </div>`;
              }).join('');
              detailsHTML = `<div style="margin-top:4px; padding-top:2px; border-top:1px dashed #eee;">${itemsList}</div>`;
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
    // FIX: Increased z-index to 200 so it appears ABOVE StaffDetailView (which is z-50)
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          // FIX: Default blank if not provided
          const initial = manualAttModal.isEdit ? manualAttModal : { 
              date: new Date().toISOString().split('T')[0], 
              checkIn: '09:00', 
              checkOut: '', 
              lunchStart: '', 
              lunchEnd: '' 
          };
          setForm({
              date: initial.date,
              in: initial.checkIn || '09:00',
              // FIX 3: Keep blank if checkOut is empty
out: initial.checkOut || '',
              lStart: initial.lunchStart || '',
              lEnd: initial.lunchEnd || ''
          });
      }
  }, [manualAttModal]);
  if (!manualAttModal) return null;
    
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
    if(!manualAttModal.isEdit) {
        record.createdAt = timestamp;
    }
    
    const newAtt = [...data.attendance.filter(a => a.id !== attId), record];
    setData(prev => ({ ...prev, attendance: newAtt }));
    
    await setDoc(doc(db, "attendance", attId), record);
    
    setManualAttModal(false); 
    // handleCloseUI(); // Note: Agar aapne edit button se pushHistory hataya h to iski zarurat nahi, par safe side rakh sakte hain
    showToast(manualAttModal.isEdit ? "Updated" : "Added");
};

  return (
    // FIX: Z-Index increased to 200
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          <button onClick={() => setManualAttModal(null)} className="w-full p-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
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
                start: log.start ? new Date(new Date(log.start).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '',
                end: log.end ? new Date(new Date(log.end).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''
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
                <div className="flex flex-col">
                    <span>{name}</span>
                    {/* CHANGE: Show Subtitle (Prices) below Name */}
                    {opt.subtitle && <span className="text-[9px] text-gray-500 font-bold">{opt.subtitle}</span>}
                </div>
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
};const ItemPnLModal = ({ isOpen, onClose, data, setViewDetail }) => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('ProfitDesc');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    if(!isOpen) return null;

    const report = data.items.map(item => {
        let revenue = 0;
        let cost = 0;
        let qtySold = 0;

        data.transactions.forEach(tx => {
            if(tx.status === 'Cancelled' || tx.type !== 'sales') return;
            if(dateRange.start && tx.date < dateRange.start) return;
            if(dateRange.end && tx.date > dateRange.end) return;

            tx.items?.forEach(line => {
                if(line.itemId === item.id) {
                    const q = parseFloat(line.qty || 0);
                    const s = parseFloat(line.price || 0);
                    const b = parseFloat(line.buyPrice || 0);
                    revenue += (q * s);
                    cost += (q * b);
                    qtySold += q;
                }
            });
        });

        return { ...item, revenue, cost, profit: revenue - cost, qtySold };
    }).filter(i => i.name.toLowerCase().includes(search.toLowerCase()) && (i.revenue > 0 || i.cost > 0));

    report.sort((a,b) => {
        if(sort === 'ProfitDesc') return b.profit - a.profit;
        if(sort === 'ProfitAsc') return a.profit - b.profit;
        if(sort === 'QtyDesc') return b.qtySold - a.qtySold;
        return 0;
    });

    // REQ 5: Total Calculation
    const totalProfit = report.reduce((sum, i) => sum + i.profit, 0);

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-bottom">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                <div><h2 className="font-bold text-lg">Item-wise Profit & Loss</h2></div>
                <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="p-4 space-y-4">
                <div className="flex gap-2">
                    <input type="date" className="w-1/2 p-2 border rounded text-xs bg-gray-50" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start:e.target.value})}/>
                    <input type="date" className="w-1/2 p-2 border rounded text-xs bg-gray-50" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end:e.target.value})}/>
                </div>
                <div className="flex gap-2">
                    <input className="flex-1 p-2 border rounded text-xs" placeholder="Search Item..." value={search} onChange={e=>setSearch(e.target.value)}/>
                    <select className="p-2 border rounded text-xs" value={sort} onChange={e=>setSort(e.target.value)}><option value="ProfitDesc">High Profit</option><option value="ProfitAsc">Low Profit</option><option value="QtyDesc">High Qty</option></select>
                </div>

                {/* REQ 5: Total Row */}
                <div className={`p-3 rounded-xl border flex justify-between items-center ${totalProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="font-bold text-gray-600 uppercase text-xs">Total Net Profit</span>
                    <span className={`font-black text-lg ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalProfit)}</span>
                </div>
                
                <div className="space-y-2 mt-2 pb-20">
                    {report.map(item => (
                        <div key={item.id} onClick={() => { onClose(); setViewDetail({ type: 'item', id: item.id }); }} className="p-3 border rounded-xl bg-white flex justify-between items-center shadow-sm cursor-pointer active:scale-95 transition-transform">
                            <div>
                                <p className="font-bold text-sm text-gray-800">{item.name}</p>
                                <div className="flex gap-2 items-center">
                                    <span className="text-[10px] bg-gray-100 px-1 rounded text-gray-500">{item.type || 'Goods'}</span>
                                    <span className="text-[10px] text-gray-500 font-bold">Sold: {item.qtySold} {item.unit}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-black text-sm ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.profit)}</p>
                                <p className="text-[10px] text-gray-400">Rev: {formatCurrency(item.revenue)}</p>
                            </div>
                        </div>
                    ))}
                    {report.length === 0 && <p className="text-center text-gray-400 py-10">No data found.</p>}
                </div>
            </div>
        </div>
    );
};
const MasterList = ({ title, collection, type, onRowClick, search, setSearch, data, setData, user, partyBalances, itemStock, partyFilter, pushHistory, setViewDetail, setModal }) => {
    const [sort, setSort] = useState('A-Z');
    const [selectedIds, setSelectedIds] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [selectedCat, setSelectedCat] = useState(null);
    const [showMenu, setShowMenu] = useState(false); 
    const [showPnL, setShowPnL] = useState(false);

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
              {/* OLD IMPORT BUTTON (Only for Party now) */}
              {type === 'party' && checkPermission(user, 'canViewMasters') && (
                  <label className="p-2 bg-gray-100 rounded-xl cursor-pointer"><Upload size={18} className="text-gray-600"/><input type="file" hidden accept=".xlsx, .xls" onChange={handleImport} /></label>
              )}

              {/* NEW 3-DOT MENU (Only for Items) */}
              {type === 'item' && checkPermission(user, 'canViewMasters') && (
                  <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"><MoreHorizontal size={20} className="text-gray-700"/></button>
                    {showMenu && (
                        <div className="absolute right-0 top-12 bg-white border shadow-2xl rounded-xl w-48 z-50 p-2 space-y-1 animate-in zoom-in-95 origin-top-right">
                            <button 
                                onClick={() => { setShowPnL(true); setShowMenu(false); }} 
                                className="w-full text-left p-2 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-2"
                            >
                                <TrendingUp size={16}/> Item-wise P&L Report
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <label className="w-full text-left p-2 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer">
                                <Upload size={16}/> Import Items (Excel)
                                <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => { handleImport(e); setShowMenu(false); }} />
                            </label>
                        </div>
                    )}
                  </div>
              )}

              {/* DELETE / ADD BUTTONS (Existing Logic) */}
              {selectedIds.length > 0 ? (
                  <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-xl flex items-center gap-1 text-sm px-4 font-bold"><Trash2 size={16}/> ({selectedIds.length})</button>
              ) : (
                  checkPermission(user, 'canViewMasters') && <button onClick={() => { pushHistory(); setModal({ type }); }} className="p-2 bg-blue-600 text-white rounded-xl flex items-center gap-1 text-sm px-4 shadow-lg shadow-blue-200"><Plus size={18} /> Add</button>
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
                                {type === 'staff' && (
                                         <span className={`text-[9px] px-1.5 rounded font-bold uppercase ${item.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.active ? 'Active' : 'Inactive'}
                                         </span>
                                     )}
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
    
    {/* RENDER P&L MODAL */}
    {showPnL && <ItemPnLModal isOpen={showPnL} onClose={()=>setShowPnL(false)} data={data} setViewDetail={setViewDetail} />}
  </div>
);

};
// Add this helper function at the top near other helpers
const formatDurationHrs = (minutes) => {
    const mins = parseInt(minutes || 0);
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
// --- SIMPLE PHOTO SYSTEM (WHATSAPP MODE) ---

const TaskPhotoWhatsApp = ({ task, party, companyMobile, saveRecord }) => {
    // 1. WhatsApp Function
    const sendPhotosToAdmin = () => {
        // Admin Mobile Number (Default to Company Mobile)
        const adminNumber = companyMobile || "919876543210"; // Apna number yahan hardcode bhi kar sakte hain
        const text = `*📸 Photos for Task #${task.id}*\n\n*Client:* ${party?.name || 'Unknown'}\n*Task:* ${task.name}\n\n(Sending photos now...)`;
        
        window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // 2. Save Link Function
    const saveLink = async () => {
        const link = document.getElementById('gphotos_link').value;
        if (!link) return alert("Please paste a link first");
        
        const updatedTask = { ...task, photosLink: link };
        await saveRecord('tasks', updatedTask, 'task');
        alert("Link Updated!");
    };

    return (
        <div className="bg-white p-4 rounded-2xl border mt-4 space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">📸 Task Photos</h3>
            
            {/* Step 1: Send to Admin */}
            <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                <p className="text-[10px] font-bold text-green-700 uppercase mb-2">Step 1: Send Photos to Office</p>
                <button 
                    onClick={sendPhotosToAdmin}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-transform"
                >
                    <MessageCircle size={20} /> Send Photos on WhatsApp
                </button>
                <p className="text-[10px] text-center text-green-600 mt-2">Photos will be saved directly to Admin's Phone.</p>
            </div>

            {/* Step 2: Paste Link (Admin/Staff) */}
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-700 uppercase mb-2">Step 2: Link Google Photos Album</p>
                
                {task.photosLink ? (
                    <div className="space-y-2">
                        <a href={task.photosLink} target="_blank" rel="noreferrer" className="block w-full p-2 bg-white border border-blue-200 rounded-lg text-blue-600 text-xs font-bold text-center truncate">
                            🔗 Open Attached Album
                        </a>
                        <button onClick={() => {
                             if(window.confirm("Remove link?")) saveRecord('tasks', { ...task, photosLink: '' }, 'task');
                        }} className="w-full text-[10px] text-red-500 font-bold">Remove Link</button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input 
                            id="gphotos_link" 
                            className="flex-1 p-2 border rounded-lg text-xs" 
                            placeholder="Paste Link here..." 
                        />
                        <button onClick={saveLink} className="bg-blue-600 text-white px-3 rounded-lg font-bold text-xs">Save</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
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
  useEffect(() => {
    const restoreSession = async () => {
        const savedUser = localStorage.getItem('smees_user');
        
        if (savedUser) {
            try { 
                const u = JSON.parse(savedUser);
                
                // --- FIX: Firebase Auth Restore Logic ---
                // User set karne se pehle wait karein ki Firebase connect ho jaye
                await new Promise(resolve => {
                    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
                        if (firebaseUser) {
                            // Already connected
                            resolve();
                            unsub();
                        } else {
                            // Not connected, force login
                            signInAnonymously(auth).then(() => {
                                resolve();
                                unsub();
                            }).catch((err) => {
                                console.error("Auto-login failed", err);
                                resolve(); // Error aaye to bhi aage badho
                            });
                        }
                    });
                });
                // ----------------------------------------

                if (u.active === false) {
                    localStorage.clear(); 
                    setUser(null);
                    setData(INITIAL_DATA);
                    alert("Your account is INACTIVE. Contact Admin.");
                } else {
                    setUser(u); // Ab user set karein, jab Firebase ready ho
                }
            } catch (e) { console.error(e); }
        }

        // Load Data
        const savedData = localStorage.getItem('smees_data');
        if (savedData) {
            try { setData(JSON.parse(savedData)); } catch (e) { console.error(e); }
        }
    };

    restoreSession();
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [appMode, setAppMode] = useState('business'); // NEW: Business/Personal Toggle
  const [mastersView, setMastersView] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportView, setReportView] = useState(null);
  const [statementModal, setStatementModal] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false); // REQ: AI Report State

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
  const [taskDraft, setTaskDraft] = useState(null);
  const [txDraft, setTxDraft] = useState(null); // Fix for Transaction Restore

  // REQ 2: Deep Linking (Open Task from URL) - Fixed History
  useEffect(() => {
      if (data.tasks && data.tasks.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const taskId = params.get('taskId');
          
          if (taskId) {
              const task = data.tasks.find(t => t.id === taskId);
              if (task) {
                  // Fix: Push state so back button works instead of closing app
                  window.history.pushState({ page: 'home' }, '', window.location.pathname); // Clear URL
                  window.history.pushState({ modal: true }, '', ''); // Push Modal state
                  
                  setActiveTab('tasks');
                  setViewDetail({ type: 'task', id: taskId });
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
         { name: 'transactions' },
         { name: 'taskPhotos' }
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
  // CHANGE: Strict Inactive Check (Real-time monitoring)
  useEffect(() => {
      if (!user) return;

      // Current user ka latest status check karo data me se
      const currentUserRecord = data.staff.find(s => s.id === user.id);

      // Agar record mil gaya aur usme active === false hai
      if (currentUserRecord && currentUserRecord.active === false) {
          // 1. Alert user
          alert("Your account has been DEACTIVATED by Admin.\nYou are being logged out.");
          
          // 2. Clear All Data (Offline protection)
          localStorage.clear();
          
          // 3. Reset State to logout
          setUser(null);
          setData(INITIAL_DATA);
          
          // 4. Force Reload (Optional, for safety)
          window.location.reload();
      }
  }, [data.staff, user]); // Jab bhi staff data update hoga (sync se), ye check chalega
  // REQ 4: Real-time Background Sync (Zero-Read Overhead Logic)
  // This listens only for changes happening AFTER the app loaded
  useEffect(() => {
    if (!user) return;
    
    // Start Time (Listen for changes from NOW onwards)
    const nowISO = new Date().toISOString();
    
    // Listeners
    const qTasks = query(collection(db, "tasks"), where("updatedAt", ">", nowISO));
    const qAtt = query(collection(db, "attendance"), where("updatedAt", ">", nowISO));
    
    const handleRealtimeUpdate = (snapshot, collectionKey) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added" || change.type === "modified") {
                const docData = change.doc.data();
                setData(prev => {
                    const list = prev[collectionKey] || [];
                    const idx = list.findIndex(i => i.id === docData.id);
                    let newList = [...list];
                    if(idx > -1) newList[idx] = docData;
                    else newList.push(docData);
                    return { ...prev, [collectionKey]: newList };
                });
            }
        });
    };

    const unsubTasks = onSnapshot(qTasks, (snap) => handleRealtimeUpdate(snap, 'tasks'));
    const unsubAtt = onSnapshot(qAtt, (snap) => handleRealtimeUpdate(snap, 'attendance'));
    
    return () => { unsubTasks(); unsubAtt(); };
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
                      // FIX: Strict check using Linked Asset Name AND Due Date to prevent duplicates on refresh
                      const alreadyExists = data.tasks.some(t => 
                          t.partyId === p.id && 
                          t.linkedAssetStr === asset.name && 
                          t.dueDate === asset.nextServiceDate
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
          // CHANGE 4: Reset Cash/Bank Filter on Back
          else if (listPaymentMode) { setListPaymentMode(null); setActiveTab('dashboard'); }
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
  }, [modal, viewDetail, mastersView, reportView, convertModal, showPnlReport, timerConflict, editingTimeLog, statementModal, manualAttModal, adjustCashModal, selectedTimeLog, navStack, listPaymentMode]);

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
    
    // FIX: Track Completion Date for Reports (Required for On-Time analysis)
    if (collectionName === 'tasks') {
        if (record.status === 'Done' && !record.completedAt) {
            record.completedAt = new Date().toISOString();
        } else if (record.status !== 'Done') {
            record.completedAt = null; 
        }
    }

    const safeRecord = cleanData(record);
    
    // ... (Baki ka code same rahega: setData, setDoc, Toast etc.) ...
    // CHANGE: Use Functional State Update to ensure Instant Reflection
    setData(prev => {
        const updatedList = record.id && prev[collectionName].some(r => r.id === record.id)
            ? prev[collectionName].map(r => r.id === record.id ? record : r)
            : [...prev[collectionName], record];
            
        return {
            ...prev,
            [collectionName]: updatedList,
            counters: newCounters || prev.counters
        };
    });
    
    try {
        await setDoc(doc(db, collectionName, finalId.toString()), safeRecord);
        if (newCounters) await setDoc(doc(db, "settings", "counters"), newCounters);
        
        // REQ: Use Targeted Sync instead of full sync
        // Note: Yahan hum abhi full sync nahi kar rahe, local state update ho chuka hai
        // await refreshSingleRecord(collectionName, finalId); <--- Isse hata bhi sakte hain agar local update sahi hai
    } catch (e) { console.error(e); showToast("Save Error", "error"); }
    // REQ 5: Restore Task Draft if coming back from Party Creation
    if (collectionName === 'parties' && taskDraft) {
        setModal({ type: 'task', data: { ...taskDraft, partyId: finalId } });
        setTaskDraft(null);
    }
    // REQ 6: Restore Transaction Draft if coming back from Item Creation
    if (collectionName === 'items' && txDraft) {
        setModal({ type: txDraft.type, data: txDraft });
        setTxDraft(null);
    }
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
    
    const timestamp = new Date().toISOString(); // NEW: Get current time

    // 1. Update local state immediately
    const updatedTransactions = data.transactions.map(t => 
        t.id === id ? { ...t, status: 'Cancelled', updatedAt: timestamp } : t
    );
    setData(prev => ({ ...prev, transactions: updatedTransactions }));
    
    // 2. Update Firebase
    try {
        const tx = data.transactions.find(t => t.id === id);
        if (tx) {
            // FIX: Added 'updatedAt' so sync respects this change
            await setDoc(doc(db, "transactions", id), { ...tx, status: 'Cancelled', updatedAt: timestamp });
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

 // Change: Added setModal to props
const StaffDetailView = ({ staff, data, setData, user, pushHistory, setManualAttModal, setSelectedTimeLog, showToast, setViewDetail, setModal }) => {
      const [sTab, setSTab] = useState('attendance');
      const [attFilter, setAttFilter] = useState('This Month');
      const [attCustom, setAttCustom] = useState({ start: '', end: '' });

      // --- 1. Helper Functions (DEFINED AT TOP) ---
      const getMins = (t) => {
          if(!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
      };

      const formatDur = (m) => {
          if(m <= 0) return '-';
          const h = Math.floor(m / 60);
          const mins = m % 60;
          return `${h}h ${mins}m`;
      };

      const formatTime = (isoString) => {
        if(!isoString) return '';
        return new Date(isoString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      };

      const formatDate = (dateStr) => {
         if(!dateStr) return '';
         return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      // --- 2. Data Preparation ---
      const attToday = (data && data.attendance) ? (data.attendance.find(a => a.staffId === staff.id && a.date === new Date().toISOString().split('T')[0]) || {}) : {};

      const getFilteredAttendance = () => {
          const now = new Date();
          if(!data || !data.attendance) return [];

          return data.attendance.filter(a => {
              if(a.staffId !== staff.id) return false;
              const d = new Date(a.date);
              
              if(attFilter === 'This Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              if(attFilter === 'Last Month') {
                  const last = new Date(); last.setMonth(last.getMonth() - 1);
                  return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
              }
              if(attFilter === 'This Week') {
                  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
                  return d >= start;
              }
              if(attFilter === 'Custom' && attCustom.start && attCustom.end) {
                  return d >= new Date(attCustom.start) && d <= new Date(attCustom.end);
              }
              return true; // All Time
          }).sort((a,b) => new Date(b.date) - new Date(a.date));
      };

      const filteredAtt = getFilteredAttendance();

      const attStats = filteredAtt.reduce((acc, item) => {
          const inM = getMins(item.checkIn);
          const outM = getMins(item.checkOut);
          const lsM = getMins(item.lunchStart);
          const leM = getMins(item.lunchEnd);
          let dailyNet = 0;
          
          if (item.checkIn && item.checkOut) {
              const gross = outM - inM;
              const lunch = (item.lunchStart && item.lunchEnd) ? (leM - lsM) : 0;
              dailyNet = gross - lunch;
          }
          return { count: acc.count + 1, mins: acc.mins + dailyNet };
      }, { count: 0, mins: 0 });
      
      const workLogs = (data && data.tasks) ? data.tasks.flatMap(t => 
        (t.timeLogs || []).map((l, i) => ({ ...l, taskId: t.id, originalIndex: i, taskName: t.name }))
        .filter(l => l.staffId === staff.id)
      ).sort((a,b) => new Date(b.start) - new Date(a.start)) : [];


      // --- 3. Check-In/Out Logic ---
      const handleAttendance = async (type) => {
          // Safety Check: Agar User nahi hai to alert do (Debugging ke liye)
          if (!user) { alert("Error: User session not found. Please reload."); return; }

          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
          const timestamp = new Date().toISOString();
          
          const attId = `ATT-${staff.id}-${todayStr}`;
          
          const updatePayload = { updatedAt: timestamp };
          if (type === 'checkIn') updatePayload.checkIn = timeStr;
          if (type === 'checkOut') updatePayload.checkOut = timeStr;
          if (type === 'lunchStart') updatePayload.lunchStart = timeStr;
          if (type === 'lunchEnd') updatePayload.lunchEnd = timeStr;

          const existingDoc = data.attendance.find(a => a.id === attId);
          let newAttRecord;
          
          if (existingDoc) {
              newAttRecord = { ...existingDoc, ...updatePayload };
          } else {
              newAttRecord = {
                  id: attId,
                  staffId: staff.id,
                  date: todayStr,
                  status: 'Present',
                  createdAt: timestamp,
                  ...updatePayload
              };
              // Fill missing fields to avoid undefined errors
              ['checkIn', 'checkOut', 'lunchStart', 'lunchEnd'].forEach(k => {
                  if(!newAttRecord[k]) newAttRecord[k] = '';
              });
          }

          // 1. Update UI Instantly
          const newAttList = [...data.attendance.filter(a => a.id !== attId), newAttRecord];
          setData(prev => ({ ...prev, attendance: newAttList }));

          // 2. Update Firebase
          try {
              await setDoc(doc(db, "attendance", attId), newAttRecord, { merge: true });
              if(showToast) showToast(`${type} Recorded`);
          } catch (e) {
              console.error(e);
              if(showToast) showToast("Error Saving Attendance", "error");
          }
      };

      const deleteAtt = async (id) => {
      if(!window.confirm("Delete this attendance record?")) return;
      
      // FIX: Update Local State First & Persist to LocalStorage
      const newAtt = data.attendance.filter(a => a.id !== id);
      const newData = { ...data, attendance: newAtt };
      setData(newData);
      localStorage.setItem('smees_data', JSON.stringify(newData)); // Persist

      // Then delete from Cloud
      try {
        await deleteDoc(doc(db, "attendance", id));
      } catch(e) { console.error("Del Error", e); }
}
      
      const editAtt = (record) => {
          if(pushHistory) pushHistory();
          if(setManualAttModal) setManualAttModal({ ...record, isEdit: true });
      }

      return (
<div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
             <div className="p-4 space-y-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setViewDetail(null)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                      <h2 className="font-bold text-lg">{staff.name}</h2>
                  </div>
                  {/* CHANGE: Edit Button Added inside Component */}
                  {user && user.role === 'admin' && (
                      <button onClick={() => { pushHistory(); setModal({ type: 'staff', data: staff }); setViewDetail(null); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
                  )}
               </div>

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
                             <button onClick={() => handleAttendance('checkOut')} disabled={!!attToday.checkOut} className="p-3 bg-red-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:bg-gray-400">Check Out <br/> <span className="text-xs font-normal">{attToday.checkOut || '--:--'}</span></button>
                             <button onClick={() => handleAttendance('lunchStart')} disabled={!!attToday.lunchStart} className="p-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"><Coffee size={14}/> Start Lunch <br/>{attToday.lunchStart}</button>
                             <button onClick={() => handleAttendance('lunchEnd')} disabled={!!attToday.lunchEnd} className="p-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"><Briefcase size={14}/> End Lunch <br/>{attToday.lunchEnd}</button>
                         </div>
                     </div>
                     
                     {/* ADMIN ADD ATTENDANCE BUTTON */}
                     {user && user.role === 'admin' && (
                         <button onClick={() => { pushHistory(); setManualAttModal({ staffId: staff.id }); }} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50">+ Add/Edit Attendance (Admin)</button>
                     )}

                     <div className="bg-white p-3 rounded-xl border space-y-3">
                         <div className="flex gap-2">
                             <select value={attFilter} onChange={e=>setAttFilter(e.target.value)} className="bg-gray-100 p-2 rounded-lg text-xs font-bold flex-1">
                                 <option>This Month</option>
                                 <option>Last Month</option>
                                 <option>This Week</option>
                                 <option>All Time</option>
                                 <option>Custom</option>
                             </select>
                             {attFilter === 'Custom' && (
                                 <div className="flex gap-1 flex-1">
                                     <input type="date" className="w-1/2 text-[10px] p-1 border rounded" value={attCustom.start} onChange={e=>setAttCustom({...attCustom, start:e.target.value})} />
                                     <input type="date" className="w-1/2 text-[10px] p-1 border rounded" value={attCustom.end} onChange={e=>setAttCustom({...attCustom, end:e.target.value})} />
                                 </div>
                             )}
                         </div>
                         <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                             <div className="text-center flex-1 border-r">
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Present Days</p>
                                 <p className="text-lg font-black text-blue-600">{attStats.count}</p>
                             </div>
                             <div className="text-center flex-1">
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Total Hours</p>
                                 <p className="text-lg font-black text-green-600">{formatDurationHrs(attStats.mins)}</p>
                             </div>
                         </div>
                     </div>
                     <div className="space-y-2">
                         {filteredAtt.map(item => {
                             const inM = getMins(item.checkIn);
                             const outM = getMins(item.checkOut);
                             const lsM = getMins(item.lunchStart);
                             const leM = getMins(item.lunchEnd);
                             
                             let gross = 0, lunch = 0, net = 0;
                             if (item.checkIn && item.checkOut) gross = outM - inM;
                             if (item.lunchStart && item.lunchEnd) lunch = leM - lsM;
                             net = gross - lunch;
                             
                             return (
                                 <div key={item.id} className="p-3 border rounded-xl bg-white text-xs relative">
                                     {user && user.role === 'admin' && (
                                         <div className="absolute top-2 right-2 flex gap-2">
                                             <button onClick={() => editAtt(item)} className="text-blue-500"><Edit2 size={14}/></button>
                                             <button onClick={() => deleteAtt(item.id)} className="text-red-500"><Trash2 size={14}/></button>
                                         </div>
                                     )}
                                     <div className="flex justify-between font-bold text-gray-800 mb-1"><span>{formatDate(item.date)}</span></div>
                                     <div className="flex justify-between text-gray-600"><span>In: {item.checkIn || '-'}</span><span>Out: {item.checkOut || '-'}</span></div>
                                     {item.lunchStart && <div className="text-gray-400 mt-1">Lunch: {item.lunchStart} - {item.lunchEnd}</div>}
                                     
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
                             <div className="flex justify-between text-gray-500"><span>{formatTime(item.start)} - {item.end ? formatTime(item.end) : 'Active'}</span><span className="font-bold">{formatDurationHrs(item.duration)}</span></div>
                         </div>
                     ))}
                 </div>
              )}
             </div>
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
                 profit += ((sell - buy) * qty);
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
            .filter(t => t.status !== 'Cancelled' && checkDate(t.date, expFilter, expDates))
            .reduce((acc, tx) => {
                // Case A: Normal Expense
                if (tx.type === 'expense') {
                    return acc + parseFloat(getTransactionTotals(tx).final || 0);
                }
                // Case B: Payment In Discount (Treat as Expense)
                if (tx.type === 'payment' && tx.subType === 'in' && parseFloat(tx.discountValue || 0) > 0) {
                    return acc + parseFloat(tx.discountValue);
                }
                return acc;
            }, 0);
      }, [data.transactions, expFilter, expDates]);

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1><p className="text-sm text-gray-500">FY {data.company.financialYear}</p></div>
            <div className="flex gap-2">
                {/* Photo Manager (Admin Only) */}
                {user.role === 'admin' && <button onClick={() => setViewDetail({ type: 'photo_manager' })} className="p-2 bg-blue-100 text-blue-700 rounded-xl"><RefreshCw size={20} /></button>}
                
                <button onClick={() => setReportModalOpen(true)} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl font-bold text-xs flex items-center gap-1">🤖 AI Report</button>
                <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 bg-gray-100 rounded-xl"><Settings className="text-gray-600" /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              {/* GROSS PROFIT CARD (Renamed & Fixed Dropdown) */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-2xl text-white shadow-lg cursor-pointer relative z-0" onClick={() => { pushHistory(); setShowPnlReport(true); }}>
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs opacity-80 font-bold mb-1">GROSS PROFIT</p>
                        <p className="text-2xl font-black">{formatCurrency(pnlData)}</p>
                    </div>
                    {/* UI Fix: Added relative positioning and z-index to dropdown container */}
                    <div className="relative z-50">
                        <select onClick={(e)=>e.stopPropagation()} value={pnlFilter} onChange={(e)=>setPnlFilter(e.target.value)} className="bg-blue-900 text-xs border-none rounded p-1 outline-none text-white">
                            <option value="Today">Today</option><option value="Weekly">Weekly</option><option value="Monthly">Month</option><option value="Yearly">Year</option><option value="Custom">Custom</option>
                        </select>
                    </div>
                  </div>
                  {pnlFilter === 'Custom' && (
                    <div onClick={(e)=>e.stopPropagation()} className="flex gap-1 mt-2">
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.start} onChange={e=>setPnlCustomDates({...pnlCustomDates, start:e.target.value})} />
                        <input type="date" className="text-black text-[10px] p-1 rounded w-full" value={pnlCustomDates.end} onChange={e=>setPnlCustomDates({...pnlCustomDates, end:e.target.value})} />
                    </div>
                  )}
              </div>
              
              {/* CASH / BANK CARD - Adjust button removed */}
              <div className="bg-white p-4 rounded-2xl border shadow-sm relative group">
                  <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-gray-400">CASH / BANK</p>
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
      // CHANGE: Selected Category State for drill-down
      const [selectedCategory, setSelectedCategory] = useState(null);

      // 1. Filter Transactions by Date
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
          return true;
      });

      // 2. Prepare Data (Expenses + Payment In Discounts)
      const categoryTotals = {};
      const categoryTransactions = {};

      dateFilteredTxs.forEach(tx => {
          // A. Regular Expenses
          if (tx.type === 'expense') {
              const cat = tx.category || 'Uncategorized';
              categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(tx.finalTotal || tx.amount || 0);
              
              if(!categoryTransactions[cat]) categoryTransactions[cat] = [];
              categoryTransactions[cat].push(tx);
          }

          // B. CHANGE: Discount on Payment In (Treated as Expense)
          if (tx.type === 'payment' && tx.subType === 'in') {
               const discVal = parseFloat(tx.discountValue || 0);
               if(discVal > 0) {
                   const catName = "Discount Allowed (Payment In)";
                   // Isko total me add karo
                   categoryTotals[catName] = (categoryTotals[catName] || 0) + discVal;
                   
                   if(!categoryTransactions[catName]) categoryTransactions[catName] = [];
                   // Transaction push karte waqt dhyan rakhe ki display me kya dikhana hai
                   categoryTransactions[catName].push(tx);
               }
          }
      });

      const totalExpenseAmount = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

      // --- RENDER ---
      return (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                   {/* Back Button Logic */}
                  <div className="flex items-center gap-2">
                      <button onClick={() => selectedCategory ? setSelectedCategory(null) : handleCloseUI()} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                      <h2 className="font-bold text-lg">{selectedCategory ? selectedCategory : 'Expenses Breakdown'}</h2>
                  </div>
                  
                  {!selectedCategory && (
                      <select value={eFilter} onChange={(e)=>setEFilter(e.target.value)} className="bg-gray-100 text-xs font-bold p-2 rounded-xl border-none outline-none">
                          <option value="All">All Time</option><option value="Today">Today</option><option value="Weekly">Weekly</option><option value="Monthly">Month</option><option value="Yearly">Year</option><option value="Custom">Custom</option>
                      </select>
                  )}
              </div>
              
              {!selectedCategory && eFilter === 'Custom' && (
                  <div className="flex gap-2 p-2 bg-gray-50 justify-center border-b">
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.start} onChange={e=>setEDates({...eDates, start:e.target.value})} />
                      <input type="date" className="p-1 rounded border text-xs" value={eDates.end} onChange={e=>setEDates({...eDates, end:e.target.value})} />
                  </div>
              )}

              <div className="p-4 space-y-4">
                  {selectedCategory ? (
                      // --- DETAIL VIEW (Transaction List) ---
                      <div className="space-y-3">
                          <p className="text-xs text-gray-500 mb-2">Transactions for {selectedCategory}</p>
                          {categoryTransactions[selectedCategory]?.map(tx => {
                              // CHANGE: Agar Discount category hai to Discount Value dikhao, warn Amount
                              const isDiscountCat = selectedCategory === "Discount Allowed (Payment In)";
                              const amountToShow = isDiscountCat ? parseFloat(tx.discountValue || 0) : parseFloat(tx.finalTotal || tx.amount || 0);
                              
                              return (
                                <div key={tx.id} onClick={() => { handleCloseUI(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-3 border rounded-xl flex justify-between items-center bg-white shadow-sm cursor-pointer hover:bg-gray-50">
                                    <div>
                                        <p className="font-bold text-gray-800">{tx.category || 'Discount'}</p>
                                        <p className="text-[10px] text-gray-400">{formatDate(tx.date)} • {tx.id}</p>
                                        {/* Party Name dikhao agar available hai */}
                                        {tx.partyId && <p className="text-[10px] text-blue-600 font-bold">{data.parties.find(p=>p.id===tx.partyId)?.name}</p>}
                                    </div>
                                    <span className="font-bold text-red-600 text-lg">
                                        ₹{formatCurrency(amountToShow)}
                                    </span>
                                </div>
                              );
                          })}
                      </div>
                  ) : (
                      // --- MAIN VIEW (Category List) ---
                      <>
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100 mt-2 flex justify-between items-center mb-6">
                             <div>
                                <span className="text-xs font-bold text-red-400 uppercase block">Total Expenses</span>
                                <span className="font-black text-2xl text-red-700">{formatCurrency(totalExpenseAmount)}</span>
                             </div>
                             <TrendingUp className="text-red-300" size={32} />
                        </div>

                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Categories (Click to view)</h3>
                        <div className="space-y-3">
                            {Object.entries(categoryTotals).map(([cat, total]) => (
                                  <div 
                                    key={cat} 
                                    onClick={() => setSelectedCategory(cat)} // CHANGE: Clickable Category
                                    className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all hover:border-blue-300"
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg ${cat === 'Discount Allowed (Payment In)' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                                              {cat === 'Discount Allowed (Payment In)' ? <Banknote size={18}/> : <ReceiptText size={18}/>}
                                          </div>
                                          <span className="font-bold text-gray-700">{cat}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
                                          <ChevronRight size={14} className="text-gray-300"/>
                                      </div>
                                  </div>
                            ))}
                            {Object.keys(categoryTotals).length === 0 && (
                                <p className="text-center text-gray-400 py-10">No expenses found for this period.</p>
                            )}
                        </div>
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
        // Sirf Sales aur jo Cancelled nahi hai
        let txs = data.transactions.filter(t => ['sales'].includes(t.type) && t.status !== 'Cancelled');
        
        return txs.filter(t => {
            const d = new Date(t.date);
            const tDate = d.toDateString();
            const nDate = now.toDateString();
            
            if (pnlFilter === 'Today') return tDate === nDate;
            if (pnlFilter === 'Weekly') {
                const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
                return d >= start;
            }
            if (pnlFilter === 'Monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (pnlFilter === 'Yearly') return d.getFullYear() === now.getFullYear();
            if (pnlFilter === 'Custom' && pnlCustomDates.start && pnlCustomDates.end) {
                return d >= new Date(pnlCustomDates.start) && d <= new Date(pnlCustomDates.end);
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
                <div className="w-9" />
            </div>
            <div className="p-4 space-y-4">
                {visibleData.map(tx => {
                    // 1. PROFIT CALCULATION
                    let serviceP = 0, goodsP = 0;
                    (tx.items || []).forEach(item => {
                        const m = data.items.find(i => i.id === item.itemId);
                        const type = m?.type || 'Goods';
                        const buy = parseFloat(item.buyPrice || m?.buyPrice || 0);
                        const sell = parseFloat(item.price || 0);
                        const qty = parseFloat(item.qty || 0);
                        // Change: Service Logic Updated
const itemProfit = (sell - buy) * qty;
if(type === 'Service') serviceP += itemProfit;
else goodsP += itemProfit;
                    });
                    const totalP = serviceP + goodsP - parseFloat(tx.discountValue || 0);

                    // 2. PARTY INFO
                    const party = data.parties.find(p => p.id === tx.partyId);
                    
                    // --- 3. ROBUST PAYMENT & BALANCE LOGIC ---
                    
                    // A. Invoice Total (Total Bill Amount)
                    // Fix: Calculate Final Total correctly using getTransactionTotals (includes Discount)
const invoiceTotal = getTransactionTotals(tx).final;

                    // B. Direct Received (Jo bill banate time mila)
                    const directReceived = parseFloat(tx.received || 0);

                    // C. Linked Payments (Ab ye har tarah ka link check karega)
                    // Payment Transactions only
                    const paymentTxs = data.transactions.filter(t => t.type === 'payment' && t.status !== 'Cancelled');
                    
                    const paidViaLinks = paymentTxs.reduce((sum, p) => {
                        // Check 1: Direct Link (Simple ID match)
                        if (p.linkedTxId === tx.id) {
                            return sum + parseFloat(p.amount || 0);
                        }
                        // Check 2: Multi-Bill Link (Agar linkedBills array me ye bill ID hai)
                        if (p.linkedBills && Array.isArray(p.linkedBills)) {
                            const match = p.linkedBills.find(l => l.billId === tx.id);
                            if (match) {
                                return sum + parseFloat(match.amount || 0);
                            }
                        }
                        return sum;
                    }, 0);
                    
                    // D. Total Paid
                    const totalReceived = directReceived + paidViaLinks;
                    
                    // E. Actual Balance
                    const balance = invoiceTotal - totalReceived;
                    
                    // F. Status
                    let status = 'UNPAID';
                    let statusColor = 'bg-red-100 text-red-700';
                    
                    if (balance <= 0.5) { 
                        status = 'PAID';
                        statusColor = 'bg-green-100 text-green-700';
                    } else if (totalReceived > 0.1) {
                        status = 'PARTIAL';
                        statusColor = 'bg-yellow-100 text-yellow-700';
                    }

                    return (
                        <div 
                            key={tx.id} 
                            // --- FIX 4: CLICKABLE ROW ---
                            onClick={() => { 
                                pushHistory(); 
                                setViewDetail({ type: 'transaction', id: tx.id }); 
                            }}
                            className="p-4 border rounded-xl bg-white shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-transform"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">#{tx.id} • {formatDate(tx.date)}</p>
                                    <p className="text-xs text-blue-600 font-bold">{party?.name || 'Cash Sale'}</p>
                                </div>
                                <div className="text-right">
                                    {/* --- FIX 1: INVOICE TOTAL HERE (NOT BALANCE) --- */}
                                    <p className="font-black text-lg text-gray-800">{formatCurrency(invoiceTotal)}</p>
                                    
                                    {/* Status me Balance */}
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>
                                        {status} {balance > 0.5 ? `(Bal: ${Math.round(balance)})` : ''}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded-lg mb-2">
                                <span>Goods Profit: <span className="font-bold">{formatCurrency(goodsP)}</span></span>
                                <span>Service Profit: <span className="font-bold">{formatCurrency(serviceP)}</span></span>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-xs text-gray-500">Net Profit</span>
                                <span className="font-black text-xl text-green-600">{formatCurrency(totalP)}</span>
                            </div>
                        </div>
                    );
                })}
                {visibleCount < filteredDate.length && (
                    <button onClick={() => setVisibleCount(prev => prev + 50)} className="w-full py-3 bg-gray-100 font-bold rounded-xl text-sm">Load More</button>
                )}
            </div>
        </div>
    );
  };

  const DetailView = () => {
    // --- NEW STATES FOR MENU & ITEMS ---
    const [showTaskMenu, setShowTaskMenu] = useState(false);
    const [showItems, setShowItems] = useState(false);
    const [showAllStaff, setShowAllStaff] = useState(false); // Change 2: State for Toggle
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
           // Change: Service Profit uses Buy Price now
const iProfit = (sell - buy) * qty;
if (type === 'Service') pnl.service += iProfit;
else pnl.goods += iProfit;
          });
          
          // 4. Net Profit
          pnl.total = (pnl.service + pnl.goods) - pnl.discount;
      }
      {/* CHANGE: Show Note/Description */}
                {tx.description && (
                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 mt-3">
                        <p className="text-[10px] text-yellow-700 font-bold uppercase mb-1">Note / Description</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{tx.description}</p>
                    </div>
                )}
      // --- UPDATE THIS FUNCTION INSIDE DetailView ---
      // New Professional Share/Print Logic
      const shareInvoice = () => {
      const record = viewDetail.type === 'transaction' 
          ? data.transactions.find(t => t.id === viewDetail.id) 
          : data.tasks.find(t => t.id === viewDetail.id);
      
      if (!record) return;

      const party = data.parties.find(p => p.id === record.partyId) || {};
      const company = data.company || {};
      
      // Calculate Totals (if transaction)
      let itemsHtml = '';
      let totalAmount = 0;
      
      if (record.items) {
          record.items.forEach((item, index) => {
              const itemMaster = data.items.find(i => i.id === item.itemId);
              const itemName = itemMaster ? itemMaster.name : (item.itemName || 'Item');
              const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
              totalAmount += lineTotal;

              // --- FIX: Warranty Logic for PDF ---
              let warrantyText = '';
              if(item.warrantyDate) {
                  const start = new Date(record.date || new Date()); // Bill Date
                  const end = new Date(item.warrantyDate);
                  
                  // Simple calculation for display (Months/Days)
                  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                  let days = end.getDate() - start.getDate();
                  if (days < 0) { months--; days += 30; } // Approx adjust
                  
                  let durationStr = [];
                  if(months > 0) durationStr.push(`${months} Month${months>1?'s':''}`);
                  if(days > 0) durationStr.push(`${days} Day${days>1?'s':''}`);
                  
                  const durText = durationStr.length > 0 ? `(${durationStr.join(' ')})` : '';
                  warrantyText = `<br/><span style="color:#444; font-size:9px; font-weight:bold;">Warranty Till: ${formatDate(item.warrantyDate)} ${durText}</span>`;
              }
              // -----------------------------------

              itemsHtml += `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9f9f9'};">
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">
                      <b>${itemName}</b> ${item.brand ? `(${item.brand})` : ''}
                      ${item.description ? `<br/><span style="color:#666; font-size:10px;">${item.description}</span>` : ''}
                      ${warrantyText} 
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price)}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(lineTotal)}</td>
                </tr>
              `;
          });
      }

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${record.id}</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
              .container { max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .company-name { font-size: 24px; font-weight: bold; color: #2563eb; }
              .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
              table { w-full; border-collapse: collapse; width: 100%; }
              th { background: #f3f4f6; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
              .totals { margin-top: 20px; text-align: right; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="company-name">${company.name || 'My Company'}</div>
                <div>${company.address || ''}</div>
                <div>Phone: ${company.mobile || ''}</div>
              </div>
              
              <div class="meta">
                <div>
                  <strong>Billed To:</strong><br/>
                  ${party.name || 'Cash Sale'} ${record.locationLabel ? `(${record.locationLabel})` : ''}<br/>
                  ${(record.mobile || party.mobile) ? `Phone: ${record.mobile || party.mobile}<br/>` : ''}
                  ${(record.address || party.address) ? `${record.address || party.address}` : ''}
                </div>
                <div style="text-align: right;">
                  <strong>Invoice No:</strong> ${record.id}<br/>
                  <strong>Date:</strong> ${formatDate(record.date)}<br/>
                  <strong>Mode:</strong> ${record.paymentMode || 'Cash'}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="text-align: center; width: 50px;">#</th>
                    <th>Item Description</th>
                    <th style="text-align: center; width: 60px;">Qty</th>
                    <th style="text-align: right; width: 100px;">Price</th>
                    <th style="text-align: right; width: 100px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="totals">
                <p><strong>Sub Total:</strong> ${formatCurrency(record.grossTotal || totalAmount)}</p>
                ${record.discountValue ? `<p>Discount: -${formatCurrency(record.discountValue)}</p>` : ''}
                <p style="font-size: 18px;"><strong>Grand Total: ${formatCurrency(record.finalTotal || totalAmount)}</strong></p>
                <p>Paid: ${formatCurrency(record.received || 0)}</p>
                <p>Balance: ${formatCurrency((record.finalTotal || totalAmount) - (record.received || 0))}</p>
              </div>

              <div class="footer">
                <div style="border-top: 1px solid #eee; padding-top: 10px; margin-bottom: 20px; font-style: italic; color: #666;">
                    <p>This invoice is generated for record and information purpose only.</p>
                    <p>Sun Electricals is currently not registered under GST, hence GST is not applicable.</p>
                    <p>This bill is for internal accounting and service reference only.</p>
                    <p>It is not a tax invoice.</p>
                </div>
                <p>Thank you for your business!</p>
                <p>Generated by SMEES Pro</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
  };

      return (
        <div className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-2">
                <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            </div>
            <div className="flex gap-2">
               {tx.status !== 'Cancelled' && 
               <button onClick={shareInvoice} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-1"><Share2 size={16}/> PDF</button>}
               
               {/* --- FIX 3: OLD BUTTON LOGIC RESTORED --- */}
               {checkPermission(user, 'canEditTasks') && (
                   <>
                       {tx.status !== 'Cancelled' ? (
                          <button onClick={() => cancelTransaction(tx.id)} className="p-2 bg-gray-100 text-gray-600 rounded-lg border hover:bg-red-50 hover:text-red-600 font-bold text-xs">Cancel</button>
                       ) : (
                          <div className="flex items-center gap-2">
                              <span className="px-2 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs border border-red-200">CANCELLED</span>
                              {/* RESTORE BUTTON */}
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
            {/* NEW HEADER INSIDE CONTENT */}
            <div className="bg-white p-4 rounded-2xl border mb-4 shadow-sm text-center relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 ${['sales','payment'].includes(tx.type)?'bg-green-500':'bg-red-500'}`}></div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{tx.type} VOUCHER</p>
                <h1 className="text-3xl font-black text-gray-800">{formatCurrency(totals.final)}</h1>
                <div className="flex justify-center gap-3 mt-2 text-xs font-bold text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">#{tx.id}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{formatDate(tx.date)}</span>
                </div>
            </div>

            {/* FIX 4: Description & Payment Info Block */}
            {tx.description && (
                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-center">
                    <p className="text-[10px] text-yellow-700 font-bold uppercase mb-1">Description</p>
                    <p className="text-sm text-gray-700">{tx.description}</p>
                </div>
            )}

            {/* Show Payment Details for Sales/Purchase/Expense/Payment */}
            {(() => {
                const amt = tx.type === 'sales' ? tx.received : (tx.type === 'payment' ? tx.amount : tx.paid);
                if (parseFloat(amt) > 0) {
                    const mode = tx.paymentMode || 'Cash';
                    return (
                        <div className="flex justify-center items-center gap-2 bg-green-50 p-2 rounded-xl border border-green-100">
                            <span className="text-xs font-bold text-green-700 uppercase">{tx.type === 'sales' || (tx.type==='payment' && tx.subType==='in') ? 'Received' : 'Paid'}:</span>
                            <span className="font-black text-green-800">{formatCurrency(amt)}</span>
                            <span className="flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-1 rounded text-gray-600 border">
                                {mode === 'Cash' ? <Banknote size={12}/> : <Landmark size={12}/>} {mode}
                            </span>
                        </div>
                    );
                }
            })()}
            
            {/* CHANGE: Party Card Clickable for Admin Only */}
            <div 
                onClick={() => {
                    // Sirf Admin hi click kar paye
                    if(user.role === 'admin' && tx.partyId) {
                        setViewDetail({ type: 'party', id: tx.partyId });
                    }
                }}
                className={`bg-gray-50 p-4 rounded-2xl border ${user.role === 'admin' ? 'cursor-pointer hover:bg-gray-100 active:scale-95 transition-all' : ''}`}
            >
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">{isPayment ? 'Paid Via' : 'Party'} {user.role === 'admin' && <span className="text-[9px] text-blue-600 ml-1">(View Profile)</span>}</p>
              <p className="font-bold text-lg">{party?.name || tx.category || 'Unknown'}</p>
              <p className="text-sm text-gray-500">{tx.mobile || party?.mobile}</p>
              
              {/* REQ 1: Transaction Specific Address */}
              {tx.address && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-start gap-2">
                      <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5"/>
                      <p className="text-xs text-gray-600">
                          {tx.address} 
                          {tx.locationLabel && <span className="bg-gray-200 px-1 rounded text-[9px] ml-1 font-bold">{tx.locationLabel}</span>}
                      </p>
                  </div>
              )}
            </div>

            {/* REQ 2: Linked Assets Section (In Detail View) */}
            {tx.linkedAssets && tx.linkedAssets.length > 0 && (
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <h3 className="font-bold text-indigo-900 text-xs uppercase mb-2 flex items-center gap-1"><Package size={14}/> Linked Assets (AMC)</h3>
                    <div className="space-y-2">
                        {tx.linkedAssets.map((a, idx) => (
                            <div key={idx} className="bg-white p-2 rounded-lg border flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-700">{a.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400">Next Service:</span>
                                    <span className="font-bold text-indigo-600">{a.nextServiceDate ? formatDate(a.nextServiceDate) : 'N/A'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
            {/* RELATED TASK TIME LOGS (Req 2) */}
            {tx.convertedFromTask && (() => {
                const sourceTask = data.tasks.find(t => t.id === tx.convertedFromTask);
                const logs = sourceTask?.timeLogs || [];
                // Use a unique ID for toggle logic
                const toggleId = `logs-${tx.id}`; 
                
                if(logs.length === 0) return null;

                return (
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-2">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Clock size={16}/> Work Logs (Task)</h3>
                             {logs.length > 5 && (
                                 <button 
                                    onClick={(e) => {
                                        const el = document.getElementById(toggleId);
                                        const btn = e.target;
                                        if(el.classList.contains('hidden')) {
                                            el.classList.remove('hidden');
                                            btn.innerText = 'Show Less';
                                        } else {
                                            el.classList.add('hidden');
                                            btn.innerText = 'Show All';
                                        }
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-1 rounded shadow-sm"
                                 >
                                    Show All
                                 </button>
                             )}
                        </div>
                        
                        <div className="space-y-1">
                            {/* First 5 entries */}
                            {logs.slice(0, 5).map((l, i) => (
                                <div key={i} className="flex justify-between text-xs bg-white/60 p-1.5 rounded">
                                    <span className="font-bold text-indigo-800">{l.staffName}</span>
                                    <span className="text-gray-600">{formatDate(l.start)} ({formatDurationHrs(l.duration)})</span>
                                </div>
                            ))}
                            
                            {/* Hidden Remaining Entries */}
                            <div id={toggleId} className="hidden space-y-1">
                                {logs.slice(5).map((l, i) => (
                                    <div key={i + 5} className="flex justify-between text-xs bg-white/60 p-1.5 rounded">
                                        <span className="font-bold text-indigo-800">{l.staffName}</span>
                                        <span className="text-gray-600">{formatDate(l.start)} ({formatDurationHrs(l.duration)})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
            subText: `Stk: ${itemStock[i.id] || 0}`, 
            subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-green-600',
            subtitle: `Buy: ${i.buyPrice || 0} | Sell: ${i.sellPrice || 0}`
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
          <div className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
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
                    
                    {/* REQ 2: 3-Dot Menu for Task Actions (Edit, Delete, WhatsApp) */}
                    {checkPermission(user, 'canEditTasks') && (
                        <div className="relative">
                            <button 
                                onClick={() => setShowTaskMenu(!showTaskMenu)} 
                                className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                <MoreHorizontal size={20} className="text-gray-600"/>
                            </button>
                            
                            {showTaskMenu && (
                                <div className="absolute right-0 top-12 bg-white border shadow-2xl rounded-xl w-48 z-50 p-2 space-y-1 animate-in zoom-in-95 origin-top-right">
                                   {/* Edit Option (Fix: Removed setViewDetail(null) to stay on detail screen) */}
<button 
    onClick={() => { pushHistory(); setModal({ type: 'task', data: task }); }} 
    className="w-full text-left p-2 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-2"
>
    <Edit2 size={16}/> Edit Task
</button>
                                    
                                    {/* WhatsApp Option with Logo */}
                                    <button 
                                        onClick={() => {
                                            const msg = `Update on Task: ${task.name}\nStatus: ${task.status}`;
                                            window.open(`https://wa.me/${party?.mobile}?text=${encodeURIComponent(msg)}`, '_blank');
                                        }} 
                                        className="w-full text-left p-2 hover:bg-green-50 text-green-600 rounded-lg text-xs font-bold flex items-center gap-2"
                                    >
                                        {/* Logo Logic: Using MessageCircle with Green Fill */}
                                        <MessageCircle size={16} fill="currentColor" className="text-green-500"/> 
                                        WhatsApp Update
                                    </button>

                                    <div className="h-px bg-gray-100 my-1"></div>
                                    
                                    {/* Delete Option */}
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('Are you sure you want to delete this task?')) {
                                                deleteRecord('tasks', task.id);
                                            }
                                        }} 
                                        className="w-full text-left p-2 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2"
                                    >
                                        <Trash2 size={16}/> Delete Task
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
              </div>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <h1 className="text-xl font-black text-gray-800 mb-2">{task.name}</h1>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'Converted' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                    {/* REQ 1: Display Estimate Time */}
                    {task.estimateTime && (
                        <div className="mt-2 flex items-center gap-2 text-xs bg-white border px-3 py-2 rounded-lg w-fit">
                            <Clock size={14} className="text-orange-500"/>
                            <span className="font-bold text-gray-500">Est. Time:</span>
                            <span className="font-black text-gray-800">{task.estimateTime}</span>
                        </div>
                    )}
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

     {/* CHANGE: Client Card Clickable for Admin Only */}
           {/* FIXED: Single Clean Client Card */}
                    <div className="bg-white p-4 rounded-2xl border mb-2 shadow-sm relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Client</span>
                                    {task.locationLabel && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{task.locationLabel}</span>}
                                    {user.role === 'admin' && (
                                        <button 
                                            onClick={() => setViewDetail({ type: 'party', id: party.id })}
                                            className="text-[9px] font-bold text-blue-500 hover:underline"
                                        >
                                            (View Profile)
                                        </button>
                                    )}
                                </div>
                                <p className="font-bold text-gray-800 text-lg leading-tight">{party.name}</p>
                            </div>
                            
                            {/* Get Direction Button (Right Side) */}
                             {(task.lat || party.lat) && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${task.lat || party.lat},${task.lng || party.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform hover:bg-blue-700"
                                >
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Get Direction</span>
                                    <MapPin size={16} fill="currentColor" className="text-white"/>
                    </a>
                )}
                        </div>

                        {/* Contact Numbers */}
                        <div className="mt-3 space-y-1 relative z-10">
                            {((task.selectedContacts && task.selectedContacts.length > 0) ? task.selectedContacts : [{ label: 'Primary', number: party.mobile }]).map((c, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-[10px] bg-gray-100 px-1.5 rounded text-gray-500 font-bold min-w-[50px] text-center">{c.label}</span>
                                    <a href={`tel:${c.number}`} onClick={e=>e.stopPropagation()} className="text-sm font-bold text-gray-700 flex items-center gap-1 hover:text-blue-600">
                                        <Phone size={14} className="text-gray-400"/> {c.number}
                                    </a>
                                  </div>
                            ))}
                        </div>

                        {/* Address Text */}
                        {(task.address || party.address) && (
                            <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2">
                                <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5"/>
                                <p className="text-xs text-gray-500">{task.address || party.address}</p>
                            </div>
                        )}
                    </div>
                    
                    {/* SIMPLE WHATSAPP PHOTO SECTION */}
            <TaskPhotoWhatsApp 
                task={task}
                party={party}
                companyMobile={data.company.mobile}
                saveRecord={saveRecord}
            />

                    {/* Time Logs List with Summary & Toggle */}
                    <div className="bg-gray-50 rounded-xl border p-3 mb-4">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-gray-500 uppercase">Time Logs</h4>
                             <button 
                                onClick={() => {
                                    // Local state toggle hack since we can't easily add state to this huge component without refactor
                                    const el = document.getElementById('timelog-container');
                                    const btn = document.getElementById('timelog-btn');
                                    if(el) {
                                        if(el.style.display === 'none') {
                                            el.style.display = 'block';
                                            btn.innerText = 'Hide Logs';
                                        } else {
                                            el.style.display = 'none';
                                            btn.innerText = 'Show Logs';
                                        }
                                    }
                                }} 
                                id="timelog-btn"
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded"
                             >
                                Show Logs
                             </button>
                        </div>

                        {/* Staff Wise Summary */}
                        <div className="flex flex-wrap gap-2 mb-3 border-b border-gray-200 pb-2">
                             {Object.entries((task.timeLogs || []).reduce((acc, log) => {
                                 const staff = log.staffName || 'Unknown';
                                 acc[staff] = (acc[staff] || 0) + parseFloat(log.duration || 0);
                                 return acc;
                             }, {})).map(([name, mins]) => (
                                 <div key={name} className="bg-white border px-2 py-1 rounded-lg text-xs">
                                     <span className="text-gray-500 font-medium">{name}: </span>
                                     <span className="font-bold text-gray-800">{formatDurationHrs(mins)}</span>
                                 </div>
                             ))}
                             {(task.timeLogs || []).length === 0 && <span className="text-xs text-gray-400 italic">No time recorded.</span>}
                        </div>

                        {/* Collapsible List */}
                        <div id="timelog-container" style={{ display: 'none' }} className="space-y-2 max-h-60 overflow-y-auto">
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
                                        <span className="font-bold bg-gray-100 px-2 py-1 rounded">{formatDurationHrs(log.duration)}</span>
                                        <ChevronRight size={14} className="text-gray-400"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Staff Timer Controls (CHANGE 2: Limit to 3) */}
                    <div className="flex flex-col gap-2 mb-4">
                        {(showAllStaff ? visibleStaff : visibleStaff.slice(0, 3)).map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-xl border"><span className="text-sm font-bold text-gray-700">{s.name}</span><button onClick={() => toggleTimer(s.id)} className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{isRunning ? <><Square size={10} fill="currentColor"/> STOP</> : <><Play size={10} fill="currentColor"/> START</>}</button></div>
                            );
                        })}
                        {visibleStaff.length > 3 && (
                            <button onClick={() => setShowAllStaff(!showAllStaff)} className="text-xs font-bold text-blue-600 bg-blue-50 py-2 rounded-lg">
                                {showAllStaff ? 'Show Less' : `Show All (${visibleStaff.length})`}
                            </button>
                        )}
                    </div>
                </div>

                {/* REQ 1: Items Used Section */}
                {/* REQ 4: Items Section (Admin Only, Toggle, P&L) */}
                {user.role === 'admin' && (
                    <div className="bg-gray-50 p-4 rounded-2xl border mb-4">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package size={18}/> Items / Parts</h3>
                             <button 
                                onClick={() => setShowItems(!showItems)}
                                className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-sm"
                             >
                                {showItems ? 'Hide Items' : 'Show Items'}
                             </button>
                        </div>

                        {showItems && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                                {(task.itemsUsed || []).map((line, idx) => {
                                    const profit = (parseFloat(line.price||0) - parseFloat(line.buyPrice||0)) * parseFloat(line.qty||0);
                                    return (
                                        <div key={idx} className="p-2 border rounded-xl bg-white relative space-y-1">
                                            <button onClick={() => { const n = [...task.itemsUsed]; n.splice(idx, 1); updateTaskItems(n); }} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                                            
                                            <div className="flex justify-between text-xs font-bold">
                                                <span>{data.items.find(i=>i.id===line.itemId)?.name || 'Unknown Item'}</span>
                                                <span>{formatCurrency(line.qty * line.price)}</span>
                                            </div>
                                            
                                            {/* Item P&L */}
                                            <div className="flex justify-end text-[10px] font-bold">
                                                <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                                                    P&L: {formatCurrency(profit)}
                                                </span>
                                            </div>

                                            <div className="flex gap-2 mt-1">
                                                <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateLineItem(idx, 'qty', e.target.value)} />
                                                <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Price" value={line.price} onChange={e => updateLineItem(idx, 'price', e.target.value)} />
                                                <input className="flex-1 p-1 border rounded text-xs" placeholder="Desc" value={line.description || ''} onChange={e => updateLineItem(idx, 'description', e.target.value)} />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Total Value & Total P&L Summary */}
{task.itemsUsed && task.itemsUsed.length > 0 && (
    <div className="pt-3 mt-2 border-t border-gray-200 space-y-1">
        <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase">Total Amount</span>
            <span className="text-lg font-black text-gray-800">
                {formatCurrency(task.itemsUsed.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)), 0))}
            </span>
        </div>
        <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg">
            <span className="text-xs font-bold text-blue-600 uppercase">Estimated P&L</span>
            <span className={`font-black text-sm ${(task.itemsUsed.reduce((sum, item) => sum + ((parseFloat(item.price||0) - parseFloat(item.buyPrice||0)) * parseFloat(item.qty||0)), 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(task.itemsUsed.reduce((sum, item) => sum + ((parseFloat(item.price||0) - parseFloat(item.buyPrice||0)) * parseFloat(item.qty||0)), 0))}
            </span>
        </div>
    </div>
)}

                                {task.status !== 'Converted' && (
                                    <SearchableSelect 
                                        placeholder="+ Add Item to Task" 
                                        options={itemOptions} 
                                        value="" 
                                        onChange={v => addItem(v)} 
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* CHANGE: Check if linkedTxId exists. Agar sale ban chuki hai to button mat dikhao */}
                    {/* CHANGE: Prevent Double Conversion Logic */}
                {task.generatedSaleId ? (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-green-700 uppercase flex items-center gap-1">
                                <CheckCircle2 size={14}/> Converted
                            </span>
                            <span className="text-[10px] text-gray-500">Invoice Already Generated</span>
                        </div>
                        <button 
                            onClick={() => setViewDetail({ type: 'transaction', id: task.generatedSaleId })}
                            className="w-full py-3 bg-white border border-green-200 text-green-700 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                        >
                            View Invoice #{task.generatedSaleId} <ExternalLink size={14}/>
                        </button>
                    </div>
                ) : (
                    task.status !== 'Converted' && checkPermission(user, 'canEditTasks') && (
                        <button 
                            onClick={() => setModal({ type: 'convertTask', data: task })} 
                            className="w-full py-3 mt-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                        >
                            Convert to Sale
                        </button>
                    )
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
        // CHANGE: Removed wrapper div and passed setModal prop
        return (
            <StaffDetailView 
                staff={staff} 
                data={data} 
                setData={setData} 
                user={user} 
                pushHistory={pushHistory} 
                setManualAttModal={setManualAttModal} 
                setSelectedTimeLog={setSelectedTimeLog} 
                showToast={showToast}
                setViewDetail={setViewDetail}
                setModal={setModal} // <--- Added setModal here
            />
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
                <div id="detail-scroller" className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
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
                                            
                                            {/* REQ 6: Detailed Pricing & P&L */}
                                            <div className="text-[9px] font-bold text-gray-400 flex flex-col items-end">
                                                <span>Buy: {line.buyPrice || 0} | Sell: {line.price}</span>
                                                {isOut && (
                                                    <span className={`${(line.price - (line.buyPrice||0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        P&L: {formatCurrency((line.price - (line.buyPrice||0)) * qty)}
                                                    </span>
                                                )}
                                            </div>
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
            // NEW: Task Filter State
            const [taskStatusFilter, setTaskStatusFilter] = useState('To Do');
            const [taskSearch, setTaskSearch] = useState('');
            // FIX: Open specific asset if passed in viewDetail
            const [selectedAsset, setSelectedAsset] = useState(
                viewDetail.openAsset ? record.assets.find(a => a.name === viewDetail.openAsset) : null
            );
            const [editingAsset, setEditingAsset] = useState(null);
            // CHANGE: Search States for Party Detail Tabs
            const [txSearch, setTxSearch] = useState('');
            const [assetSearch, setAssetSearch] = useState('');
            
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
                
                // 1. Clean Data (Remove index field)
                const { index, ...cleanAsset } = editingAsset;
                
                // REQ 2: Get Old Asset Name to find linked transactions
                const oldAssetName = record.assets[index]?.name;
                
                const updatedAssets = record.assets.map((a, i) => i === index ? cleanAsset : a);
                
                // 2. Add Timestamp (CRITICAL for Sync)
                const updatedParty = { 
                    ...record, 
                    assets: updatedAssets, 
                    updatedAt: new Date().toISOString() 
                };

                // 3. Update Linked Transactions (If name changed)
                let updatedTransactions = [...data.transactions];
                if (oldAssetName && oldAssetName !== cleanAsset.name) {
                    updatedTransactions = updatedTransactions.map(tx => {
                        if (tx.partyId === record.id && tx.linkedAssets && tx.linkedAssets.some(a => a.name === oldAssetName)) {
                            // Replace old name with new name in linkedAssets
                            const newLinked = tx.linkedAssets.map(a => a.name === oldAssetName ? { ...a, name: cleanAsset.name } : a);
                            const updatedTx = { ...tx, linkedAssets: newLinked, updatedAt: new Date().toISOString() };
                            // Fire & Forget update
                            setDoc(doc(db, "transactions", tx.id), updatedTx); 
                            return updatedTx;
                        }
                        return tx;
                    });
                }

                // 4. Update Local State & Storage Immediately
                const newData = { 
                    ...data, 
                    parties: data.parties.map(p => p.id === record.id ? updatedParty : p),
                    transactions: updatedTransactions 
                };
                setData(newData);
                localStorage.setItem('smees_data', JSON.stringify(newData)); // Persistence Fix
                
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
                             {/* CHANGE: Edit/Delete Buttons MOVED HERE */}
                             <div className="flex gap-2 mb-2">
                                <button onClick={() => { setEditingAsset({...selectedAsset, index: record.assets.findIndex(a => a.name === selectedAsset.name)}); setSelectedAsset(null); }} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-blue-100"><Edit2 size={14}/> Edit Asset</button>
                                <button onClick={() => { handleDeleteAsset(selectedAsset.name); setSelectedAsset(null); }} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-red-100"><Trash2 size={14}/> Delete Asset</button>
                             </div>

                             <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                                <div className="flex justify-between"><span className="text-xs font-bold text-gray-500 uppercase">Next Service</span><span className={`font-bold ${new Date(selectedAsset.nextServiceDate) <= new Date() ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>{selectedAsset.nextServiceDate || 'Not Set'}</span></div>
                                <button onClick={() => {
    // REQ 6: Professional Format
    const msg = `*Service Reminder*\n\nDear ${record.name},\n\nThis is a gentle reminder regarding the upcoming AMC service for your asset:\n\n*Item:* ${selectedAsset.name} (${selectedAsset.brand})\n*Due Date:* ${formatDate(selectedAsset.nextServiceDate)}\n\nPlease let us know a convenient time to visit.\n\nRegards,\n*${data.company.name}*`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}}className="w-full mt-2 py-2 bg-green-100 text-green-700 rounded-lg font-bold flex items-center justify-center gap-2"><MessageCircle size={16}/> WhatsApp Reminder</button>
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
              <div id="detail-scroller" className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                  <button onClick={handleCloseUI} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                  <h2 className="font-bold text-lg">{record.name}</h2>
                  <div className="flex gap-2">
     <button onClick={() => { pushHistory(); setStatementModal({ partyId: record.id }); }} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1"><FileText size={12}/> Stmt</button>
     <button onClick={() => { pushHistory(); setModal({ type: 'party', data: record }); }} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg">Edit</button>
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
                       <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'tasks' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Tasks</button>
                   </div>

                   {activeTab === 'transactions' && (
                       <div className="space-y-3">
                         <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{['All', 'Sales', 'Purchase', 'Payment', 'Expense'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>{f}</button>)}</div>
                         {/* CHANGE: Transaction Search Bar */}
                         <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                            <input 
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs" 
                                placeholder="Search Bill No, Amount..." 
                                value={txSearch} 
                                onChange={e => setTxSearch(e.target.value)} 
                            />
                         </div>
                         {history.filter(t => 
                            !txSearch || 
                            t.id.toLowerCase().includes(txSearch.toLowerCase()) || 
                            (t.amount || 0).toString().includes(txSearch)
                         ).map(tx => {
                           const totals = getBillStats(tx, data.transactions);
                           const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
                           const unusedAmount = tx.type === 'payment' ? (totals.amount - (totals.used || 0)) : 0;
                           
                           // --- UI STYLE MATCHING ACCOUNTS TAB ---
                           let typeLabel = tx.type;
                           if(tx.type === 'payment') typeLabel = tx.subType === 'in' ? 'Payment IN' : 'Payment OUT';

                           const mode = tx.paymentMode || 'Cash';
                           const ModeIcon = (mode === 'Bank' || mode === 'UPI') ? Landmark : Banknote;
                           
                           let Icon = ReceiptText, iconColor = 'text-gray-600', bg = 'bg-gray-100';
                           if (tx.type === 'sales') { Icon = TrendingUp; iconColor = 'text-green-600'; bg = 'bg-green-100'; }
                           if (tx.type === 'purchase') { Icon = ShoppingCart; iconColor = 'text-blue-600'; bg = 'bg-blue-100'; }
                           if (tx.type === 'payment') { Icon = ModeIcon; iconColor = 'text-purple-600'; bg = 'bg-purple-100'; }

                           const displayAmount = totals.amount;
                           
                           return (
                             <div key={tx.id} onClick={() => { const el = document.getElementById('detail-scroller'); if(el) scrollPos.current[record.id] = el.scrollTop; setNavStack(prev => [...prev, viewDetail]); pushHistory(); setViewDetail({ type: 'transaction', id: tx.id }); }} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform mb-2">
                               <div className="flex gap-4 items-center">
                                 <div className={`p-3 rounded-full ${bg} ${iconColor}`}><Icon size={18} /></div>
                                 <div>
                                   <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-800 text-xs uppercase">{typeLabel} #{tx.id.split(':')[1] || tx.id}</p>
                                        {tx.type === 'payment' && <span className="text-[9px] bg-gray-100 px-1 rounded border">{mode}</span>}
                                   </div>
                                   <p className="text-[10px] text-gray-400 font-bold">{formatDate(tx.date)}</p>
                                   
                                   {/* REQ 3: Show Linked Assets in List */}
                                   {tx.linkedAssets && tx.linkedAssets.length > 0 && (
                                       <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                           {tx.linkedAssets.map((a, idx) => (
                                               <span key={idx} className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-bold flex items-center gap-1">
                                                   <Package size={8}/> {a.name}
                                               </span>
                                           ))}
                                       </div>
                                   )}

                                   {/* Show Description if any */}
                                   {tx.description && <p className="text-[9px] text-gray-500 italic truncate max-w-[120px]">{tx.description}</p>}
                                   
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
                       <div className="space-y-3">{/* CHANGE: Asset Search Bar */}
                       <div className="relative mb-3">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                            <input 
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs" 
                                placeholder="Search Asset Name, Brand..." 
                                value={assetSearch} 
                                onChange={e => setAssetSearch(e.target.value)} 
                            />
                       </div>
                           {(record.assets || []).length === 0 ? <div className="text-center py-10 text-gray-400">No Assets</div> : 
                           
                            record.assets
                            .filter(a => !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.brand.toLowerCase().includes(assetSearch.toLowerCase()))
                            .map((asset, idx) => {
                                const isDue = asset.nextServiceDate && new Date(asset.nextServiceDate) <= new Date();
                                return (
                                   <div key={idx} onClick={() => setSelectedAsset(asset)} className={`p-4 bg-white border rounded-2xl relative group mb-2 cursor-pointer active:scale-95 transition-all ${isDue ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
                                       {/* CHANGE: Buttons removed from here (Moved to Detail View) */}
                                       <div>
                                           <div className="flex justify-between items-start mb-2">
                                               <div>
                                                   <p className="font-bold text-gray-800 text-lg">{asset.name}</p>
                                                   <p className="text-xs text-gray-500 font-bold">{asset.brand} {asset.model}</p>
                                               </div>
                                               {isDue && <span className="bg-red-100 text-red-700 text-[9px] font-black px-2 py-1 rounded uppercase animate-pulse">Due</span>}
                                           </div>
                                           <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                                               <Calendar size={14}/> <span>Next Service: <span className={`font-bold ${isDue ? 'text-red-600' : 'text-green-600'}`}>{asset.nextServiceDate ? formatDate(asset.nextServiceDate) : 'N/A'}</span></span>
                                           </div>
                                           {asset.photosLink && <div className="mt-1 text-[9px] text-blue-600 font-bold flex items-center gap-1">📸 Photo Attached</div>}
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
                                   
                                   {/* NEW: Service Interval in Edit Mode */}
                                   <div>
                                       <label className="text-[10px] font-bold text-gray-400 uppercase">Service Interval</label>
                                       <select 
                                           className="w-full p-2 border rounded-lg bg-gray-50 text-xs"
                                           value={editingAsset.serviceInterval || '3'} 
                                           onChange={e => setEditingAsset({...editingAsset, serviceInterval: e.target.value})}
                                       >
                                           <option value="1">Every 1 Month</option>
                                           <option value="2">Every 2 Months</option>
                                           <option value="3">Every 3 Months</option>
                                           <option value="4">Every 4 Months</option>
                                           <option value="6">Every 6 Months</option>
                                           <option value="12">Every 1 Year</option>
                                       </select>
                                   </div>

                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Next Service Date</label><input type="date" className="w-full p-2 border rounded-lg bg-red-50" value={editingAsset.nextServiceDate} onChange={e => setEditingAsset({...editingAsset, nextServiceDate: e.target.value})} /></div>
                               </div>
                               <div className="grid grid-cols-2 gap-3 mt-4">
                                   <button onClick={() => setEditingAsset(null)} className="p-3 bg-gray-100 text-gray-600 font-bold rounded-xl">Cancel</button>
                                   <button onClick={handleUpdateAsset} className="p-3 bg-blue-600 text-white font-bold rounded-xl">Update</button>
                               </div>
                           </div>
                       </div>
                   )}
                   {activeTab === 'tasks' && (
                       <div className="space-y-3">
                           {/* Task Search Bar */}
                           <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl text-xs" placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                           </div>

                           {/* Filter Buttons */}
                           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
                {["To Do", "In Progress", "Done", "Converted"].map(s => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border ${filter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{s}</button>
                ))}
                
            </div>

    
                           
                           {/* Task List (With Search Filter) */}
                           {data.tasks
                               .filter(t => t.partyId === record.id && t.status === taskStatusFilter && (!taskSearch || t.name.toLowerCase().includes(taskSearch.toLowerCase()) || (t.description||'').toLowerCase().includes(taskSearch.toLowerCase())))
                               .map(task => (
                                   <div key={task.id} onClick={() => setViewDetail({ type: 'task', id: task.id })} className="p-4 bg-white border rounded-2xl flex justify-between items-start cursor-pointer active:scale-95 transition-transform">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : 'bg-orange-500'}`} />
                                            <p className="font-bold text-gray-800">{task.name}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                                        <div className="flex gap-3 mt-2 text-[10px] font-bold text-gray-400 uppercase"><span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.dueDate)}</span></div>
                                      </div>
                                      <div className="text-right"><p className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">#{task.id}</p></div>
                                   </div>
                               ))
                           }
                           {data.tasks.filter(t => t.partyId === record.id && t.status === taskStatusFilter && (!taskSearch || t.name.toLowerCase().includes(taskSearch.toLowerCase()) || (t.description||'').toLowerCase().includes(taskSearch.toLowerCase()))).length === 0 && <p className="text-center text-gray-400 py-10">No tasks found in {taskStatusFilter}.</p>}
                       </div>
                   )}
                </div>
              </div>
            );
        };
        
        return <PartyDetailInner record={record} />;
    }
    
    // ==========================================
    // PERSONAL FINANCE VIEW
    // ==========================================
    if (viewDetail.type === 'personalFinance') {
      return (
        <PersonalFinanceView 
          data={data}
          setData={setData}
          onBack={handleCloseUI}
          showToast={showToast}
        />
      );
    }
    
    // ==========================================
    // PERSONAL TASKS VIEW
    // ==========================================
    if (viewDetail.type === 'personalTasks') {
      return (
        <PersonalTasksView 
          data={data}
          setData={setData}
          onBack={handleCloseUI}
          showToast={showToast}
        />
      );
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
  const TransactionForm = ({ type, record, setModal, setTxDraft }) => {
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
    const [addBrandModal, setAddBrandModal] = useState(null); // State for Brand Form
    const [linkSearch, setLinkSearch] = useState('');
    // Helper for Salary Calc
    const getMins = (t) => {
        if(!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // ... (Helpers: currentVoucherId, totals, selectedParty, handleLocationSelect, unpaidBills, updateLine, itemOptions, partyOptions, handleLinkChange, allBrands) ...
    // Note: In helpers ko wesa hi rakhein jaisa pichle code me tha.

    // COPY THESE HELPERS FROM YOUR PREVIOUS CODE OR KEEP AS IS
    const currentVoucherId = useMemo(() => { if (record?.id) return record.id; return getNextId(data, type).id; }, [data, type, record]);
    const totals = getTransactionTotals(tx);
    const selectedParty = data.parties.find(p => p.id === tx.partyId);
    const handleLocationSelect = (loc) => { setTx({...tx, address: loc.address, mobile: loc.mobile || selectedParty?.mobile || '', lat: loc.lat || '', lng: loc.lng || '', locationLabel: loc.label }); setShowLocPicker(false); };
    // --- FIX: Logical Link Bill (Smart Credit vs Debit Matching) ---
    const unpaidBills = useMemo(() => {
        if (!tx.partyId) return [];
        return data.transactions.filter(t => {
            // 1. Basic Filters (Party check, Self check, Cancelled check)
            if (t.partyId !== tx.partyId || t.id === tx.id || t.type === 'estimate' || t.status === 'Cancelled') return false;

            // 2. Always show if already linked (taki edit karte waqt link na gayab ho)
            const isAlreadyLinked = tx.linkedBills?.some(l => l.billId === t.id);
            if (isAlreadyLinked) return true;

            // 3. Identify Nature (Credit vs Debit)
            // Current Form being filled (Source)
            // Credit = Payment In, Purchase, Expense
            // Debit = Payment Out, Sales
            const isSourceCredit = (type === 'payment' && tx.subType === 'in') || type === 'purchase' || type === 'expense';
            
            // Item in List (Target)
            const isTargetCredit = (t.type === 'payment' && t.subType === 'in') || t.type === 'purchase' || t.type === 'expense';

            // 4. MAIN LOGIC: Link only Opposites (Credit to Debit OR Debit to Credit)
            // Agar same nature hai (Cr-Cr ya Dr-Dr) to mat dikhao
            if (isSourceCredit === isTargetCredit) return false;

            // 5. Check Status (Don't show fully settled items)
            const stats = getBillStats(t, data.transactions);
            
            if (['sales', 'purchase', 'expense'].includes(t.type)) {
                return stats.status !== 'PAID'; // Only show Unpaid Bills
            } else if (t.type === 'payment') {
                return stats.status !== 'FULLY USED'; // Only show Payments with Balance
            }

            return false;
        });
    }, [tx.partyId, data.transactions, tx.linkedBills, type, tx.subType]);
    const updateLine = (idx, field, val) => { 
        const newItems = [...tx.items]; 
        newItems[idx][field] = val; 
        
        if (field === 'itemId') { 
            const item = data.items.find(i => i.id === val); 
            if (item) { 
                newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice; 
                newItems[idx].buyPrice = item.buyPrice; 
                newItems[idx].description = item.description || ''; 
                newItems[idx].brand = '';
                newItems[idx].linkedItem = item.linkedItem || null; // Carry link info
            } 
        } 
        
        if (field === 'brand') { 
            const item = data.items.find(i => i.id === newItems[idx].itemId); 
            if (item && item.brands) { 
                const brandData = item.brands.find(b => b.name === val); 
                if (brandData) { 
                    newItems[idx].price = type === 'purchase' ? brandData.buyPrice : brandData.sellPrice; 
                    newItems[idx].buyPrice = brandData.buyPrice; 
                } 
            } 
        } 
        setTx({ ...tx, items: newItems }); 
    };

    // Helper: Add Linked Item (Auto Qty Sync)
    const addLinkedItem = (parentIdx) => {
        const parentLine = tx.items[parentIdx];
        const linkInfo = parentLine.linkedItem;
        
        if(!linkInfo) return;
        
        const linkedData = data.items.find(i => i.name === linkInfo.name);
        if(!linkedData) return;

        let finalPrice = linkInfo.price || linkedData.sellPrice;
        let finalBuyPrice = linkedData.buyPrice;

        if(linkInfo.brand) {
             const bData = linkedData.brands?.find(b => b.name === linkInfo.brand);
             if(bData) {
                 finalPrice = linkInfo.price || bData.sellPrice; 
                 finalBuyPrice = bData.buyPrice;
             }
        }

        // Calculate Qty based on Parent
        const parentQty = parseFloat(parentLine.qty || 1);
        const ratioQty = parseFloat(linkInfo.qty || 1);
        const finalQty = parentQty * ratioQty;

        const newLine = { 
            itemId: linkedData.id, 
            qty: finalQty,                   // <--- UPDATED
            brand: linkInfo.brand || '', 
            price: parseFloat(finalPrice), 
            buyPrice: parseFloat(finalBuyPrice), 
            description: linkedData.description || 'Service Charge' 
        };
        
        const newItems = [...tx.items];
        newItems.splice(parentIdx + 1, 0, newLine); 
        setTx({ ...tx, items: newItems });
    };
    // FIX: Show Last Prices (Master Prices) & Stock
// FIX: Clean Qty & Subtitle for Prices
    const itemOptions = data.items.map(i => ({ 
        ...i, 
        subText: `Stk: ${itemStock[i.id] || 0}`, 
        subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-blue-600',
        subtitle: `Buy: ${i.buyPrice || 0} | Sell: ${i.sellPrice || 0}`
    }));
    const partyOptions = data.parties.map(p => ({ ...p, subText: partyBalances[p.id] ? formatCurrency(Math.abs(partyBalances[p.id])) + (partyBalances[p.id]>0?' DR':' CR') : 'Settled', subColor: partyBalances[p.id]>0?'text-green-600':partyBalances[p.id]<0?'text-red-600':'text-gray-400' }));
    const handleLinkChange = (billId, value) => { const amt = parseFloat(value) || 0; let maxLimit = totals.final; if (type === 'payment') { const baseAmt = parseFloat(tx.amount || 0); const disc = parseFloat(tx.discountValue || 0); maxLimit = baseAmt + disc; } if (maxLimit <= 0) { alert("Please enter the Payment Amount first."); return; } let newLinked = [...(tx.linkedBills || [])]; const existingIdx = newLinked.findIndex(l => l.billId === billId); if (existingIdx >= 0) { if (amt <= 0) newLinked.splice(existingIdx, 1); else newLinked[existingIdx] = { ...newLinked[existingIdx], amount: amt }; } else if (amt > 0) { newLinked.push({ billId, amount: amt }); } const currentTotal = newLinked.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0); if (currentTotal > maxLimit) { alert(`Cannot link more than the Payment Amount (${maxLimit}). Current Total: ${currentTotal}`); return; } setTx({ ...tx, linkedBills: newLinked }); };
    
    // --- Helper to add asset ---

    // --- State update for Duration ---
    const [serviceInterval, setServiceInterval] = useState(3); // Default 3 Months
    const handleAddAsset = (assetName) => {
        if (!assetName) return;
        // CHANGE 6: Auto Calculate based on Asset Default
        const assetObj = selectedParty?.assets?.find(a => a.name === assetName);
        const interval = assetObj?.serviceInterval ? parseInt(assetObj.serviceInterval) : parseInt(serviceInterval);

        const d = new Date(tx.date);
        d.setMonth(d.getMonth() + interval);
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

                    {/* NEW: ADD ASSET ONLY (Duration Selector Removed) */}
                    <div className="flex gap-2">
                        {/* Add Asset Dropdown */}
                        <select 
                            className="w-full p-2 border rounded-lg text-xs bg-white text-indigo-600 font-bold outline-none"
                            value=""
                            onChange={(e) => handleAddAsset(e.target.value)}
                        >
                            <option value="">+ Add Asset to Link</option>
                            {selectedParty.assets.map((a, i) => (
                                <option key={i} value={a.name} disabled={tx.linkedAssets.some(la => la.name === a.name)}>
                                    {a.name} ({a.brand}) {tx.linkedAssets.some(la => la.name === a.name) ? '✓' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
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
        {type === 'expense' && ( <SearchableSelect 
    label="Expense Category" 
    options={(data.categories.expense || []).map(c => ({ id: c, name: c }))} 
    value={tx.category} 
    onChange={v => setTx({...tx, category: v})} 
    placeholder="Select Category..."
    onAddNew={async (newCat) => {
        // FIX 3: Save New Expense Category to Firebase
        if(!newCat) return;
        const updatedCats = [...(data.categories.expense || []), newCat];
        
        // Update Local
        const newCategories = { ...data.categories, expense: updatedCats };
        setData(prev => ({ ...prev, categories: newCategories }));
        
        // Update Firebase (Assuming categories are stored in a settings doc)
        try {
            // Adjust "settings/categories" path if your DB structure is different
            await setDoc(doc(db, "settings", "categories"), newCategories, { merge: true });
        } catch(e) { console.log("Auto-save cat failed, works locally"); }
        
        setTx({ ...tx, category: newCat });
    }}
/> )}
        {type !== 'payment' && (
            <div className="space-y-3 pt-2 border-t">
                <h4 className="text-xs font-bold text-gray-400 uppercase">Items / Services</h4>
                {tx.items.map((line, idx) => {
                    const selectedItemMaster = data.items.find(i => i.id === line.itemId);
                    const specificBrandOptions = selectedItemMaster?.brands?.map(b => ({ id: b.name, name: b.name, subText: `₹${b.sellPrice}`, subColor: 'text-green-600' })) || [];
                    
                    return (
                        <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2 animate-in slide-in-from-left-2">
                            <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                    
                            <SearchableSelect 
                                options={itemOptions} 
                                value={line.itemId} 
                                onChange={v => updateLine(idx, 'itemId', v)} 
                                placeholder="Select Item"
                                onAddNew={() => {
                                    if(setTxDraft) setTxDraft({ ...tx, type });
                                    if(setModal) setModal({ type: 'item' });
                                }}
                            />

                            {/* SHOW LINKED ITEM BUTTON */}
                            {line.linkedItem && (
                                <button 
                                    onClick={() => addLinkedItem(idx)}
                                    className="text-[10px] bg-orange-100 text-orange-700 py-1 px-2 rounded-lg flex items-center gap-1 font-bold w-full justify-center border border-orange-200"
                                >
                                    <Plus size={10}/> Add Linked: {line.linkedItem.name} (₹{line.linkedItem.price})
                                </button>
                            )}
                            
                            {selectedItemMaster && ( 
                                <SearchableSelect 
                                    placeholder={specificBrandOptions.length > 0 ? "Select Brand" : "No Brands (Add New)"} 
                                    options={specificBrandOptions} 
                                    value={line.brand || ''} 
                                    onChange={v => updateLine(idx, 'brand', v)} 
                                    onAddNew={() => setAddBrandModal({ item: selectedItemMaster, idx })}
                                /> 
                            )}
                            <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
                            
                            {/* FIX: Warranty Field Added */}
                            <div className="flex gap-2 items-center bg-blue-100 p-1.5 rounded-lg border border-blue-200">
                                <ShieldCheck size={14} className="text-blue-600"/>
                                <span className="text-[10px] font-bold text-blue-700 uppercase">Till:</span>
                                <input type="date" className="p-1 border rounded text-[10px] bg-white w-24" value={line.warrantyDate || ''} onChange={(e) => updateLine(idx, 'warrantyDate', e.target.value)} />
                                <select className="p-1 border rounded text-[10px] bg-white flex-1" onChange={(e) => {
                                    if(!e.target.value) return;
                                    const d = new Date(tx.date || new Date()); 
                                    d.setMonth(d.getMonth() + parseInt(e.target.value));
                                    updateLine(idx, 'warrantyDate', d.toISOString().split('T')[0]);
                                }}>
                                    <option value="">Duration...</option>
                                    <option value="1">1 Month</option>
                                    <option value="3">3 Months</option>
                                    <option value="6">6 Months</option>
                                    <option value="12">1 Year</option>
                                    <option value="24">2 Years</option>
                                </select>
                            </div>

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
        {/* FIX 1: Brand Add Form Modal */}
        {addBrandModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white p-5 rounded-2xl w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                    <h3 className="font-bold text-lg mb-2 text-gray-800">Add Brand</h3>
                    <p className="text-xs text-gray-500 mb-4">Item: {addBrandModal.item.name}</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Brand Name</label>
                            <input id="new_brand_name" autoFocus className="w-full p-2 border rounded-lg font-bold text-sm" placeholder="e.g. Havells" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 ">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Sell Price</label>
                                <input id="new_brand_sell" type="number" className="w-full p-2 border rounded-lg" defaultValue={addBrandModal.item.sellPrice} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Buy Price</label>
                                <input id="new_brand_buy" type="number" className="w-full p-2 border rounded-lg bg-yellow-50" defaultValue={addBrandModal.item.buyPrice} />
                            </div>
                        </div>
                       
                        
                        <button 
                            onClick={async () => {
                                const name = document.getElementById('new_brand_name').value;
                                const sell = document.getElementById('new_brand_sell').value;
                                const buy = document.getElementById('new_brand_buy').value;
                                
                                if(!name) return alert("Brand Name is required");
                                
                                const item = addBrandModal.item;
                                const newBrandObj = { name, sellPrice: parseFloat(sell||0), buyPrice: parseFloat(buy||0) };
                                
                                // 1. Firebase Save
                                const updatedItem = { ...item, brands: [...(item.brands || []), newBrandObj] };
                                await setDoc(doc(db, "items", item.id), updatedItem);
                                
                                // 2. Update Local Data (Without Resetting Form)
                                const newData = { ...data };
                                const itemIdx = newData.items.findIndex(i => i.id === item.id);
                                if(itemIdx > -1) newData.items[itemIdx] = updatedItem;
                                setData(newData); 

                                // 3. Update Line Item
                                updateLine(addBrandModal.idx, 'brand', name);
                                setAddBrandModal(null); 
                            }}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-2"
                        >
                            Save Brand & Sync
                        </button>
                        <button onClick={() => setAddBrandModal(null)} className="w-full py-3 text-gray-500 font-bold text-xs">Cancel</button>
                    </div>
                </div>
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
            onClick={async () => { handleCloseUI();
                if(!tx.partyId) return alert("Party is Required");
                if(type === 'expense' && !tx.category) return alert("Category is Required");
                
                let finalAmount = totals.final;
                if (type === 'payment') finalAmount = parseFloat(tx.amount || 0);

                const finalRecord = { ...tx, ...totals, amount: finalAmount };

                // Asset Date Logic.// Fix: Actual Asset Update Logic restored
                if (type === 'sales' && tx.partyId && tx.linkedAssets?.length > 0) {
                     const partyRef = data.parties.find(p => p.id === tx.partyId);
                     if(partyRef && partyRef.assets) {
                         const updatedAssets = partyRef.assets.map(a => {
                             const match = tx.linkedAssets.find(la => la.name === a.name);
                             return match ? { ...a, nextServiceDate: match.nextServiceDate } : a;
                         });
                         // Fix: Add updatedAt timestamp
const updatedParty = { ...partyRef, assets: updatedAssets, updatedAt: new Date().toISOString() };
 
 // Update Local & Firebase
 setData(prev => ({
     ...prev,
     parties: prev.parties.map(p => p.id === updatedParty.id ? updatedParty : p)
 }));
                         setDoc(doc(db, "parties", updatedParty.id), updatedParty);
                     }
                }

                await saveRecord('transactions', finalRecord, tx.type); 
                
                // CHANGE: Save ke baad turant close karo (Back to previous screen)
                handleCloseUI(); 
            }} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
        >
            Save {type}
        </button>
      </div>
    );
};

  const TaskForm = ({ record }) => {
    const [showItems, setShowItems] = useState(false);
    const [form, setForm] = useState(record ? { 
        ...record, 
        itemsUsed: record.itemsUsed || [], 
        assignedStaff: record.assignedStaff || [],
        selectedContacts: record.selectedContacts || [], 
        estimateTime: record.estimateTime || ''
    } : { 
        name: '', partyId: '', description: '', status: 'To Do', dueDate: '', estimateTime: '',
        assignedStaff: [], itemsUsed: [], 
        address: '', mobile: '', lat: '', lng: '', locationLabel: '', 
        selectedContacts: []
    });
    const [showLocPicker, setShowLocPicker] = useState(false);
    const [addBrandModal, setAddBrandModal] = useState(null); 
    
    // FIX: Show Last Prices (Master Prices) & Stock
    const itemOptions = data.items.map(i => ({ 
        ...i, 
        subText: `Stk: ${itemStock[i.id] || 0}`, 
        subColor: (itemStock[i.id] || 0) < 0 ? 'text-red-500' : 'text-blue-600',
        subtitle: `Buy: ${i.buyPrice || 0} | Sell: ${i.sellPrice || 0}`
    }));
    const selectedParty = data.parties.find(p => p.id === form.partyId);
    
    // --- UPDATED ITEM LOGIC (With Linked Item Support) ---
    const updateItem = (idx, field, val) => {
        const n = [...form.itemsUsed];
        n[idx][field] = val;
        const item = data.items.find(i => i.id === n[idx].itemId);

        if (field === 'itemId' && item) {
            n[idx].price = item.sellPrice || 0;
            n[idx].buyPrice = item.buyPrice || 0;
            n[idx].description = item.description || '';
            n[idx].brand = ''; 
            n[idx].linkedItem = item.linkedItem || null; // Carry Linked Info
        }

        if (field === 'brand' && item && item.brands) {
            const brandData = item.brands.find(b => b.name === val);
            if (brandData) {
                n[idx].price = brandData.sellPrice || 0;
                n[idx].buyPrice = brandData.buyPrice || 0;
            } else {
                n[idx].price = item.sellPrice || 0;
                n[idx].buyPrice = item.buyPrice || 0;
            }
        }
        setForm({ ...form, itemsUsed: n });
    };

    // --- NEW: ADD LINKED ITEM HELPER (AUTO QTY SYNC) ---
    const addLinkedItem = (parentIdx) => {
        const parentLine = form.itemsUsed[parentIdx];
        const linkInfo = parentLine.linkedItem; 
        
        if(!linkInfo) return;
        
        const linkedData = data.items.find(i => i.name === linkInfo.name);
        if(!linkedData) return alert("Linked Item not found in Master!");

        // 1. Calculate Price based on Saved Brand
        let finalPrice = linkInfo.price || linkedData.sellPrice;
        let finalBuyPrice = linkedData.buyPrice;
        
        if(linkInfo.brand) {
             const bData = linkedData.brands?.find(b => b.name === linkInfo.brand);
             if(bData) {
                 finalPrice = linkInfo.price || bData.sellPrice; 
                 finalBuyPrice = bData.buyPrice;
             }
        }

        // 2. Calculate Qty (Parent Qty * Master Config Qty)
        // Example: Parent Qty 3 hai, aur Master me set hai ki 1 item ke sath 1 service charge lagta hai.
        // To Total Qty = 3 * 1 = 3.
        const parentQty = parseFloat(parentLine.qty || 1);
        const ratioQty = parseFloat(linkInfo.qty || 1);
        const finalQty = parentQty * ratioQty;

        const newLine = { 
            itemId: linkedData.id, 
            qty: finalQty,                     // <--- UPDATED: Dynamic Qty
            brand: linkInfo.brand || '',       
            price: parseFloat(finalPrice), 
            buyPrice: parseFloat(finalBuyPrice), 
            description: linkedData.description || 'Service Charge' 
        };
        
        const newItems = [...form.itemsUsed];
        newItems.splice(parentIdx + 1, 0, newLine); 
        setForm({ ...form, itemsUsed: newItems });
    };
    
    const handleLocationSelect = (loc) => {
        setForm({ ...form, address: loc.address, mobile: loc.mobile || selectedParty?.mobile || '', lat: loc.lat || '', lng: loc.lng || '', locationLabel: loc.label });
        setShowLocPicker(false);
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
            <input className="flex-1 p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <select className="w-1/3 p-3 bg-gray-50 border rounded-xl font-bold text-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                {(data.categories.taskStatus || ["To Do", "In Progress", "Done"]).map(s => <option key={s}>{s}</option>)}
            </select>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border"><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Assigned Staff</label><div className="flex flex-wrap gap-2 mb-2">{form.assignedStaff.map(sid => { const s = data.staff.find(st => st.id === sid); return (<span key={sid} className="bg-white border px-2 py-1 rounded-full text-xs flex items-center gap-1">{s?.name} <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button></span>); })}</div><select className="w-full p-2 border rounded-lg text-sm bg-white" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}><option value="">+ Add Staff</option>{data.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        
        <div>
            <SearchableSelect label="Client" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v, locationLabel: '', address: ''})} />
            {(selectedParty?.locations?.length > 0 || selectedParty?.mobileNumbers?.length > 0) && (
                <div className="relative mt-1 mb-2">
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                         <div className="text-xs text-blue-800 overflow-hidden">
                             <span className="font-bold">Contacts: </span> 
                             <div className="text-gray-600 mt-0.5 font-bold">
                                {(form.selectedContacts && form.selectedContacts.length > 0) ? form.selectedContacts.map(c => c.number).join(', ') : (form.mobile || selectedParty.mobile)}
                             </div>
                         </div>
                         <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[10px] font-bold bg-white border px-3 py-2 rounded-lg shadow-sm text-blue-600 whitespace-nowrap">Change</button>
                    </div>
                    {showLocPicker && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto">
                            <div onClick={() => { setForm({ ...form, mobile: selectedParty.mobile, selectedContacts: [] }); }} className="p-2 hover:bg-gray-50 border-b cursor-pointer bg-gray-50 rounded mb-1"><span className="font-bold text-xs text-gray-600">Primary Mobile</span><div className="text-[10px]">{selectedParty.mobile}</div></div>
                            {selectedParty.mobileNumbers?.map((mob, idx) => {
                                const isSelected = form.selectedContacts?.some(c => c.number === mob.number);
                                return (
                                    <div key={`mob-${idx}`} onClick={(e) => { e.stopPropagation(); let current = form.selectedContacts ? [...form.selectedContacts] : []; if (isSelected) { current = current.filter(c => c.number !== mob.number); } else { current.push(mob); } setForm({ ...form, selectedContacts: current }); }} className={`p-2 cursor-pointer border-b flex justify-between items-center ${isSelected ? 'bg-green-50' : ''}`}><span className="text-xs font-bold">{mob.label}</span><span>{mob.number} {isSelected && '✓'}</span></div>
                                );
                            })}
                            {selectedParty.locations?.map((loc, idx) => (<div key={`loc-${idx}`} onClick={() => handleLocationSelect(loc)} className="p-2 hover:bg-blue-50 cursor-pointer border-b"><span className="text-xs font-bold text-blue-600 flex items-center gap-1"><MapPin size={10}/> {loc.label}</span><div className="text-[10px] truncate text-gray-500">{loc.address}</div></div>))}
                        </div>
                    )}
                </div>
            )}
        </div>

        <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl text-sm mt-2" placeholder="Paste Google Photos/Album Link" value={form.photosLink || ''} onChange={e => setForm({...form, photosLink: e.target.value})} />
        
        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border">
            <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items / Parts</h4><button onClick={() => setShowItems(!showItems)} className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1 rounded-full">{showItems ? 'Hide Items' : 'Show Items'}</button></div>
            {showItems && (
                <div className="space-y-2 pt-2">
                    {form.itemsUsed.map((line, idx) => {
                    const selectedItemMaster = data.items.find(i => i.id === line.itemId);
                    const specificBrandOptions = selectedItemMaster?.brands?.map(b => ({ id: b.name, name: b.name, subText: `₹${b.sellPrice}`, subColor: 'text-green-600' })) || [];
                    
                    return (
                        <div key={idx} className="p-2 border rounded-xl bg-gray-50 relative space-y-2 animate-in slide-in-from-left-2">
                            <button onClick={() => { const newItems = form.itemsUsed.filter((_, i) => i !== idx); setForm({ ...form, itemsUsed: newItems }); }} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12}/></button>
                    
                            <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} placeholder="Select Item"/>
                            
                            {/* --- NEW: LINKED ITEM BUTTON --- */}
                            {line.linkedItem && (
                                <button 
                                    onClick={() => addLinkedItem(idx)}
                                    className="text-[10px] bg-orange-100 text-orange-700 py-1 px-2 rounded-lg flex items-center gap-1 font-bold w-full justify-center border border-orange-200 hover:bg-orange-200"
                                >
                                    <Plus size={10}/> Add Linked: {line.linkedItem.name} {line.linkedItem.brand ? `(${line.linkedItem.brand})` : ''} - ₹{line.linkedItem.price} (Qty: {line.linkedItem.qty || 1})
                                </button>
                            )}

                            {selectedItemMaster && ( 
                                <SearchableSelect 
                                    placeholder={specificBrandOptions.length > 0 ? "Select Brand" : "No Brands (Add New)"} 
                                    options={specificBrandOptions} 
                                    value={line.brand || ''} 
                                    onChange={v => updateItem(idx, 'brand', v)} 
                                    onAddNew={() => setAddBrandModal({ item: selectedItemMaster, idx })}
                                /> 
                            )}

                            <input className="w-full text-xs p-2 border rounded-lg" placeholder="Description" value={line.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} />
                            
                            <div className="flex gap-2 items-center bg-blue-100 p-1.5 rounded-lg border border-blue-200">
                                <ShieldCheck size={14} className="text-blue-600"/>
                                <span className="text-[10px] font-bold text-blue-700 uppercase">Till:</span>
                                <input type="date" className="p-1 border rounded text-[10px] bg-white w-24" value={line.warrantyDate || ''} onChange={(e) => updateItem(idx, 'warrantyDate', e.target.value)} />
                                <select className="p-1 border rounded text-[10px] bg-white flex-1" onChange={(e) => {
                                    if(!e.target.value) return;
                                    const d = new Date(); d.setMonth(d.getMonth() + parseInt(e.target.value));
                                    updateItem(idx, 'warrantyDate', d.toISOString().split('T')[0]);
                                }}>
                                    <option value="">Duration...</option><option value="1">1 Mo</option><option value="3">3 Mo</option><option value="6">6 Mo</option><option value="12">1 Yr</option>
                                </select>
                            </div>
                            
                            <div className="flex gap-2">
                                <input type="number" className="w-16 p-1 border rounded text-xs" placeholder="Qty" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                                <input type="number" className="w-20 p-1 border rounded text-xs" placeholder="Sale" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                                <input type="number" className="w-20 p-1 border rounded text-xs bg-yellow-50 text-gray-600" placeholder="Buy" value={line.buyPrice} onChange={e => updateItem(idx, 'buyPrice', e.target.value)} />
                                <div className="flex-1 text-right self-end text-xs font-bold text-gray-500 pb-2">{formatCurrency((parseFloat(line.qty)||0) * (parseFloat(line.price)||0))}</div>
                            </div>
                        </div>
                    );
                  })}

{form.itemsUsed.length > 0 && (
    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1">
        <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase">Total Amount</span><span className="text-lg font-black text-gray-800">{formatCurrency(form.itemsUsed.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)), 0))}</span></div>
    </div>
)}
                    <button onClick={() => setForm({...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0, buyPrice: 0 }]})} className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl font-bold text-sm">+ Add Item</button>
                </div>
            )}
        </div>

        {/* Brand Modal */}
        {addBrandModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white p-5 rounded-2xl w-full max-w-xs shadow-2xl">
                    <h3 className="font-bold text-lg mb-2">Add Brand</h3>
                    <input id="task_brand_name" autoFocus className="w-full p-2 border rounded-lg font-bold text-sm mb-3" placeholder="Brand Name" />
                    <button onClick={async () => {
                            const name = document.getElementById('task_brand_name').value;
                            if(!name) return alert("Required");
                            const item = addBrandModal.item;
                            const updatedItem = { ...item, brands: [...(item.brands || []), { name, sellPrice: item.sellPrice || 0, buyPrice: item.buyPrice || 0 }] };
                            await setDoc(doc(db, "items", item.id), updatedItem);
                            const itemIdx = data.items.findIndex(i => i.id === item.id);
                            if(itemIdx > -1) data.items[itemIdx] = updatedItem;
                            
                            const newItems = [...form.itemsUsed];
                            newItems[addBrandModal.idx].brand = name;
                            setForm({ ...form, itemsUsed: newItems });
                            setAddBrandModal(null);
                        }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Save Brand</button>
                    <button onClick={() => setAddBrandModal(null)} className="w-full py-3 text-gray-500 font-bold text-xs mt-1">Cancel</button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Due Date</label><input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /></div>
            <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Est. Duration</label>
                 <div className="flex gap-1">
                    <select className="w-full p-3 bg-gray-50 border rounded-xl" value={parseInt((form.estimateTime || '0h').split('h')[0]) || 0} onChange={e => { const h = e.target.value; const m = (form.estimateTime||'').includes(' ')?parseInt((form.estimateTime||'').split(' ')[1]):0; setForm({...form, estimateTime: `${h}h ${m}m`}); }}>{[...Array(51).keys()].map(i => <option key={i} value={i}>{i}h</option>)}</select>
                    <select className="w-full p-3 bg-gray-50 border rounded-xl" value={(form.estimateTime || '').includes(' ') ? parseInt((form.estimateTime || '').split(' ')[1]) : 0} onChange={e => { const m = e.target.value; const h = parseInt((form.estimateTime||'0h').split('h')[0])||0; setForm({...form, estimateTime: `${h}h ${m}m`}); }}>{[0,5,10,15,20,30,45].map(i => <option key={i} value={i}>{i}m</option>)}</select>
                 </div>
            </div>
        </div>
        <button onClick={() => { 
            const isEdit = !!form.id;
            if(isEdit) { setModal({ type: null }); handleCloseUI(); setViewDetail({ type: 'task', id: form.id }); } 
            else { handleCloseUI(); }
            saveRecord('tasks', form, 'task');
        }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
      </div>
    );
  };

  const StaffForm = ({ record }) => {
    const [form, setForm] = useState({ name: '', mobile: '', role: 'Staff', active: true, salary: '', dutyHours: '9', loginId: '', password: '', permissions: { canViewAccounts: false, canViewMasters: false, canViewTasks: true, canEditTasks: false, canViewDashboard: true }, ...(record || {}) });
    const togglePerm = (p) => setForm({ ...form, permissions: { ...form.permissions, [p]: !form.permissions[p] } });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Staff Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <div className="grid grid-cols-2 gap-4"><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Login ID" value={form.loginId} onChange={e => setForm({...form, loginId: e.target.value})} /><input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
        <select className="w-full p-3 bg-gray-50 border rounded-xl" value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option>Admin</option><option>Staff</option><option>Manager</option></select>
        <div className="p-4 bg-gray-50 rounded-xl border"><p className="font-bold text-xs uppercase text-gray-500 mb-2">Permissions</p><div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewDashboard} onChange={() => togglePerm('canViewDashboard')}/> View Home</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewAccounts} onChange={() => togglePerm('canViewAccounts')}/> View Accounts</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewMasters} onChange={() => togglePerm('canViewMasters')}/> View Masters</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canViewTasks} onChange={() => togglePerm('canViewTasks')}/> View Tasks</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.canEditTasks} onChange={() => togglePerm('canEditTasks')}/> Edit Tasks</label></div></div>
        <label className={`flex items-center gap-3 p-4 border rounded-xl font-bold cursor-pointer transition-colors ${form.active ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
        {/* CHANGE: Salary & Duty Hours Fields */}
        <div className="grid grid-cols-2 gap-4">
            <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Monthly Salary" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} />
            <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Daily Duty (Hours)" value={form.dutyHours} onChange={e => setForm({...form, dutyHours: e.target.value})} />
        </div>
            <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-blue-600 focus:ring-0" 
                checked={form.active !== false} // Default true rahega
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>{form.active !== false ? 'Staff Account is ACTIVE' : 'Staff Account is INACTIVE (Blocked)'}</span>
        </label>
        <button onClick={async () => { handleCloseUI();await saveRecord('staff', form, 'staff');  }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Staff</button>
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
                            className="w-20 p-2 bg-gray-50 border rounded-lg text-xs" 
                        placeholder="Lat" 
                        value={newLoc.lat} 
                        onChange={e => setNewLoc({...newLoc, lat: e.target.value})} 
                        />
        <input 
            className="w-20 p-2 bg-gray-50 border rounded-lg text-xs" 
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
                    <div className="flex gap-2">
                         <input id="new_asset_name" className="flex-1 p-2 border rounded-lg text-xs" placeholder="Asset Name (e.g. Bedroom AC)" />
                         {/* FIX 2: AMC Category Select */}
                         <select id="new_asset_category" className="w-1/3 p-2 border rounded-lg text-xs bg-white">
                             <option value="">- Cat -</option>
                             {(data.categories.amc || []).map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                    </div>
                    <div className="flex gap-2">
                        <input id="new_asset_brand" className="w-1/2 p-2 border rounded-lg text-xs" placeholder="Brand (e.g. Voltas)" />
                        <input id="new_asset_model" className="w-1/2 p-2 border rounded-lg text-xs" placeholder="Model No." />
                    </div>
                    {/* --- NEW: GOOGLE PHOTOS LINK INPUT --- */}
                    <input id="new_asset_photo" className="w-full p-2 border rounded-lg text-xs text-blue-600" placeholder="Paste Google Photos Link" />
                    
                    {/* CHANGE 6: Service Interval Field (FIXED) */}
                    <select id="new_asset_interval" defaultValue="3" className="w-full p-2 border rounded-lg text-xs bg-gray-50">
                        <option value="1">Service Every 1 Month</option>
                        <option value="2">Service Every 2 Months</option>
                        <option value="3">Service Every 3 Months (Default)</option>
                        <option value="4">Service Every 4 Months</option>
                        <option value="6">Service Every 6 Months</option>
                        <option value="12">Service Every 1 Year</option>
                    </select>

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
                            const interval = document.getElementById('new_asset_interval').value; // CHANGE 6
                            const installDate = document.getElementById('new_asset_install').value;
                            const nextServiceDate = document.getElementById('new_asset_next').value;
                            
                            if(!name) return alert("Asset Name is required");

                            const newAsset = { name, brand, model, photosLink: photo, installDate, nextServiceDate, serviceInterval: interval }; // Add to object
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
           <button onClick={async () => { 
    const savedId = await saveRecord('parties', form, 'party'); 
    if(form.id) {
         setModal({ type: null });
         handleCloseUI();
         setViewDetail({ type: 'party', id: savedId });
    } else {
         handleCloseUI();
    }
}} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save</button>
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
        linkedItem: null, // { name, brand, price, qty }
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
                    setData(prev => ({ ...prev, categories: newCats }));

                    // 3. Save to Firebase
                    await setDoc(doc(db, "categories", "lists"), newCats);
                    
                    setForm({...form, category: newCat});
                }}
             />

             {/* FIXED: Removed Duplicate "Link Service Item" block that was here */}

             <div className="grid grid-cols-2 gap-3">
                <div>
                     <label className="text-[10px] font-bold text-gray-400 uppercase">Type</label>
                     <select className="w-full p-2 bg-white border rounded-lg" value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option>Goods</option><option>Service</option></select>
                </div>
                <div>
                     <label className="text-[10px] font-bold text-gray-400 uppercase">Unit</label>
                     <select className="w-full p-2 bg-white border rounded-lg" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}><option>pcs</option><option>mtr</option><option>kg</option><option>liter</option><option>set</option><option>box</option></select>
                </div>
             </div>
             
             <input type="number" className="w-full p-2 bg-white border rounded-lg text-sm" placeholder="Opening Stock" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} />
             
             {/* Warranty Field */}
            <div className="flex items-center gap-2 mt-2">
                <ShieldCheck size={16} className="text-blue-500" />
                <span className="text-xs font-bold text-gray-500">Warranty Till:</span>
                <input type="date" className="flex-1 p-2 bg-white border rounded-lg text-xs" value={form.warrantyDate || ''} onChange={e => setForm({...form, warrantyDate: e.target.value})} />
            </div>

            {/* NEW: LINKED SERVICE ITEM (With Qty Support) */}
            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 mt-2">
                <p className="text-[10px] font-bold text-orange-700 uppercase mb-1">Link Service Item (e.g. Fitting Charge)</p>
                <div className="flex flex-col gap-2">
                    <SearchableSelect 
                        options={data.items.filter(i=>i.id !== form.id).map(i=>({id:i.name, name:i.name}))} 
                        value={form.linkedItem?.name} 
                        onChange={v => {
                            const i = data.items.find(x=>x.name===v);
                            // Auto-set Price & Qty
                            setForm({...form, linkedItem: { name: v, brand: '', price: i?.sellPrice || 0, qty: 1 }})
                        }} 
                        placeholder="Select Service Item..."
                    />
                    
                    <div className="flex gap-2">
                        {/* Brand Select */}
                        <div className="flex-1">
                            <select 
                                className="w-full p-2 border rounded-lg text-xs bg-white h-[34px]"
                                value={form.linkedItem?.brand || ''}
                                onChange={e => {
                                    const brandName = e.target.value;
                                    const linkedMaster = data.items.find(i => i.name === form.linkedItem?.name);
                                    const brandData = linkedMaster?.brands?.find(b => b.name === brandName);
                                    const newPrice = brandData ? brandData.sellPrice : (linkedMaster?.sellPrice || 0);
                                    
                                    setForm({...form, linkedItem: { ...form.linkedItem, brand: brandName, price: newPrice }});
                                }}
                            >
                                <option value="">- Default Brand -</option>
                                {data.items.find(i => i.name === form.linkedItem?.name)?.brands?.map(b => (
                                    <option key={b.name} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* NEW: Qty Input */}
                        <input 
                            type="number" 
                            placeholder="Qty" 
                            className="w-12 p-2 border rounded-lg text-xs h-[34px] bg-yellow-50 text-center font-bold"
                            value={form.linkedItem?.qty || 1}
                            onChange={e=>setForm({...form, linkedItem: {...form.linkedItem, qty: e.target.value}})}
                        />

                        {/* Price Input */}
                        <input 
                            type="number" 
                            placeholder="Price" 
                            className="w-20 p-2 border rounded-lg text-xs h-[34px] font-bold text-gray-700"
                            value={form.linkedItem?.price || ''}
                            onChange={e=>setForm({...form, linkedItem: {...form.linkedItem, price: e.target.value}})}
                        />
                    </div>
                </div>
            </div>

         </div>

         <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase">Brands & Pricing</h4>
            
            {/* Base Price */}
            <div className="flex gap-2 mb-2">
                <div className="w-1/3 pt-2 text-xs font-bold text-gray-400">Base Price</div>
                <input type="number" className="flex-1 p-2 border rounded-lg text-sm" placeholder="Sell" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} />
                <input type="number" className="flex-1 p-2 border rounded-lg text-sm bg-yellow-50" placeholder="Buy" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
            </div>

            {/* Brands List */}
            {form.brands && form.brands.map((brand, idx) => (
                <div key={idx} className="p-2 border rounded-xl bg-gray-50 mb-2 relative animate-in slide-in-from-left-2">
                    {/* Delete Button (Top Right) */}
                    <button onClick={() => removeBrandRow(idx)} className="absolute top-2 right-2 text-red-400 p-1 hover:bg-red-50 rounded-full"><Trash2 size={14}/></button>
                    
                    {/* Brand Name (Full Width) */}
                    <input 
                        className="w-full p-2 border rounded-lg text-sm font-bold mb-2 pr-8" 
                        placeholder="Brand Name (e.g. Havells)" 
                        value={brand.name} 
                        onChange={e => updateBrand(idx, 'name', e.target.value)} 
                    />
                    
                    {/* Prices (Side by Side) */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Sell Price</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm bg-white" placeholder="0" value={brand.sellPrice} onChange={e => updateBrand(idx, 'sellPrice', e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Buy Price</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm bg-yellow-50" placeholder="0" value={brand.buyPrice} onChange={e => updateBrand(idx, 'buyPrice', e.target.value)} />
                        </div>
                    </div>
                </div>
            ))}
            
            <button onClick={addBrandRow} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-1">+ Add Another Brand</button>
         </div>

         <button onClick={async () => {
             // Validation
             if(!form.name) return alert("Item Name Required");
             if(form.brands && form.brands.some(b => !b.name)) return alert("Brand Name cannot be empty");

             await saveRecord('items', form, 'item');
         }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200">Save Item</button>
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">S</div>
          <span className="font-black text-gray-800 tracking-tight">SMEES Pro</span>
          
          {/* PERSONAL MODE TOGGLE - Only for him23 */}
          {user.role === 'admin' && (
            <div className="ml-3 flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setAppMode('business')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  appMode === 'business' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Business
              </button>
              <button
                onClick={() => setAppMode('personal')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  appMode === 'personal' 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Personal
              </button>
            </div>
          )}
        </div>
       <div className="flex gap-3">
            <button onClick={() => syncData(false)} className={`p-2 hover:bg-gray-100 rounded-full ${loading ? 'animate-spin' : ''}`}><RefreshCw size={20} className="text-blue-600" /></button>
            <button onClick={() => { pushHistory(); setModal({ type: 'company' }); }} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={20} className="text-gray-500" /></button>
            {/* REQ 3: Logout Button */}
            <button onClick={() => {
                if(window.confirm("Logout?")) {
                    localStorage.removeItem('smees_user');
                    setUser(null);
                    setData(INITIAL_DATA);
                }
            }} className="p-2 hover:bg-red-50 rounded-full"><LogOut size={20} className="text-red-500" /></button>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4">
        {loading ? <div className="flex flex-col items-center justify-center h-64 text-gray-400"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div><p className="text-sm font-bold">Syncing Data...</p></div> : (
          <>
            {/* PERSONAL MODE - Show Personal Dashboard */}
            {appMode === 'personal' && user.role === 'admin' && activeTab === 'dashboard' && (
              <PersonalDashboard 
                data={data}
                setData={setData}
                pushHistory={pushHistory}
                setViewDetail={setViewDetail}
                showToast={showToast}
              />
            )}
            
            {/* BUSINESS MODE - Show Business Dashboard */}
            {appMode === 'business' && activeTab === 'dashboard' && checkPermission(user, 'canViewDashboard') && <Dashboard />}
            
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
                    setAdjustCashModal={setAdjustCashModal} // <--- Ye Line Add Karni Hai
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
                    deleteRecord={deleteRecord}
                />
            )}
            
            {/* Staff Section */}
            {activeTab === 'staff' && (
                <div className="space-y-4">
                    {mastersView === null ? (
                        <div className="space-y-4">
                            <MasterList 
                                title="Team Members" 
                                collection="staff" 
                                type="staff" 
                                search={staffSearch}        
                                setSearch={setStaffSearch}  
                                onRowClick={(s) => { pushHistory(); setViewDetail({type: 'staff', id: s.id}); }} 
                                // CHANGE 1: Admin role walo ko sab dikhega
                                data={user.role === 'admin' ? data : { ...data, staff: data.staff.filter(s => s.id === user.id) }}
                                setData={setData}
                                user={user}
                                // ... baaki props same rahenge
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
                        
   {/* UPDATED: Cash & Bank Buttons with Balance & Redirect */}
                        <button onClick={() => { 
                            pushHistory(); 
                            setActiveTab('accounting'); // Go to Accounting Tab
                            setListFilter('all');       // Reset filters
                            setListPaymentMode('Cash'); // Set Mode to Cash
                        }} className="p-4 bg-green-50 border border-green-100 rounded-2xl flex flex-col items-center justify-between hover:bg-green-100">
                            <Banknote size={28} className="text-green-600"/>
                            <div className="text-center mt-2">
                                <span className="font-bold text-green-800 block">Cash</span>
                                <span className="text-xs font-black text-green-600">{formatCurrency(stats.cashInHand)}</span>
                            </div>
                        </button>
                        
                        <button onClick={() => { 
                            pushHistory(); 
                            setActiveTab('accounting'); // Go to Accounting Tab
                            setListFilter('all'); 
                            setListPaymentMode('Bank'); // Set Mode to Bank
                        }} className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl flex flex-col items-center justify-between hover:bg-cyan-100">
                            <Briefcase size={28} className="text-cyan-600"/>
                             <div className="text-center mt-2">
                                <span className="font-bold text-cyan-800 block">Bank</span>
                                <span className="text-xs font-black text-cyan-600">{formatCurrency(stats.bankBalance)}</span>
                            </div>
                        </button>

                        {/* UPDATED: Expense Categories Button Name */}
                        <button onClick={() => { pushHistory(); setMastersView('categories'); }} className="p-6 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-red-100"><ReceiptText size={32} className="text-red-600"/><span className="font-bold text-red-800 text-center text-xs">Manage<br/>Categories</span></button>

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
      {/* Bottom Navigation - Hide in Personal Mode */}
      {appMode === 'business' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {[{ id: 'dashboard', icon: <LayoutDashboard />, label: 'Home', perm: 'canViewDashboard' }, { id: 'accounting', icon: <ReceiptText />, label: 'Accounts', perm: 'canViewAccounts' }, { id: 'tasks', icon: <CheckSquare />, label: 'Tasks', perm: 'canViewTasks' }, { id: 'masters', icon: <Package />, label: 'Masters', perm: 'canViewMasters' }, { id: 'staff', icon: <Users />, label: 'Staff' }].map(tab => {
            if (tab.perm && !checkPermission(user, tab.perm)) return null;
            return <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMastersView(null); setListFilter('all'); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>{tab.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span></button>;
        })}
      </nav>)}
      {/* CHANGE: Added check to ignore 'convertTask' */}
<Modal isOpen={!!modal.type && modal.type !== 'convertTask'} onClose={handleCloseUI} title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}>
        {modal.type === 'company' && <CompanyForm />}
        {modal.type === 'party' && <PartyForm record={modal.data} />}
        {modal.type === 'item' && <ItemForm record={modal.data} />}
        {modal.type === 'staff' && <StaffForm record={modal.data} />}
        {modal.type === 'task' && <TaskForm record={modal.data} />}
        {['sales', 'estimate', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} setModal={setModal} setTxDraft={setTxDraft} />}
      </Modal>
      {timerConflict && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center"><AlertTriangle className="text-yellow-600 mx-auto mb-4" size={32}/><h3 className="font-bold">Timer Conflict</h3><p className="text-sm my-2">Another task is active.</p><button onClick={() => setTimerConflict(null)} className="p-2 bg-gray-100 rounded font-bold">Dismiss</button></div></div>}
      {showPnlReport && <PnlReportView />}
      
      {/* RENDER MODALS OUTSIDE MAIN FLOW WITH PROPS */}
      {/* CHANGE: Correctly render ConvertTaskModal using modal state */}
      {modal?.type === 'convertTask' && (
        <ConvertTaskModal 
            task={modal.data} 
            data={data}
            setData={setData}
            syncData={syncData}
            onClose={handleCloseUI} 
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
      
      {/* REQ: AI Report Modal */}
      <ReportModal 
        isOpen={reportModalOpen} 
        onClose={() => setReportModalOpen(false)} 
        data={data} 
      />
      
     
      
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