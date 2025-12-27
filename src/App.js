import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, ReceiptText, CheckSquare, Users, Plus, Search, 
  ChevronRight, Trash2, ArrowUpRight, ArrowDownLeft, Package, Settings, 
  X, Calendar, Phone, MapPin, Download, Upload, FileSpreadsheet, 
  CheckCircle2, AlertCircle, History, Share2, Clock, Play, Square, ShoppingCart, Info
} from 'lucide-react';

// 🔴 STEP 1: YAHAN APNA GOOGLE APPS SCRIPT URL PASTE KAREIN (Double quotes ke andar)
const SHEET_API_URL = "https://script.google.com/macros/library/d/1JeHsPox0wgLiX48nZpiqkAYTZRA9IsLko_RzomzyQWbSZ4qJ6sDRM8S6/3"; 

const INITIAL_DATA = {
  company: { name: "My Enterprise", mobile: "", address: "", financialYear: "2024-25", currency: "₹" },
  parties: [],
  items: [],
  staff: [],
  transactions: [],
  tasks: [],
  categories: {
    expense: [{name: "Rent", type: "Indirect"}, {name: "Salary", type: "Indirect"}],
    item: ["Electronics", "Service", "General"]
  },
  counters: { party: 100, item: 100, staff: 100, sales: 561, purchase: 1, expense: 1, payment: 1, task: 1 }
};

// --- HELPER FUNCTIONS ---

const getNextId = (data, type, subtype = null) => {
  let prefix = type.charAt(0).toUpperCase();
  let counterKey = type;

  if (type === 'transaction') {
    if (subtype === 'sales') { prefix = 'INV'; counterKey = 'sales'; }
    else if (subtype === 'purchase') { prefix = 'PUR'; counterKey = 'purchase'; }
    else if (subtype === 'expense') { prefix = 'EXP'; counterKey = 'expense'; }
    else if (subtype === 'payment') { prefix = 'PAY'; counterKey = 'payment'; }
  } else if (type === 'party') prefix = 'P';
  else if (type === 'item') prefix = 'I';
  else if (type === 'staff') prefix = 'ST';
  else if (type === 'task') prefix = 'TSK';

  const counters = data.counters || INITIAL_DATA.counters; 
  const num = counters[counterKey] || 1;
  
  const nextCounters = { ...counters, [counterKey]: num + 1 };
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
  
  const filtered = options.filter(opt => {
    const name = typeof opt === 'string' ? opt : (opt.name || '');
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative mb-4">
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border rounded-xl bg-gray-50 flex justify-between items-center cursor-pointer"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? (options.find(o => (o.id || o) === value)?.name || (typeof value === 'object' ? value.name : value)) : placeholder}
        </span>
        <Search size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <div className="sticky top-0 p-2 bg-white border-b">
            <input autoFocus className="w-full p-2 text-sm border-none focus:ring-0" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {filtered.map((opt, idx) => {
            const id = typeof opt === 'string' ? opt : opt.id;
            const name = typeof opt === 'string' ? opt : opt.name;
            return (
              <div key={id || idx} className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { onChange(id); setIsOpen(false); setSearchTerm(''); }}>
                {name}
              </div>
            );
          })}
          {onAddNew && (
            <div className="p-3 text-blue-600 font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-blue-50" onClick={() => { onAddNew(); setIsOpen(false); }}>
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
  const [modal, setModal] = useState({ type: null, data: null });
  const [toast, setToast] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // --- CLOUD SYNC LOGIC ---
  
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFromCloud = async () => {
    if(SHEET_API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") return; // Don't fetch if URL not set
    try {
      showToast("Syncing with Cloud...", "info");
      const res = await fetch(SHEET_API_URL);
      const cloud = await res.json();
      
      const newData = { ...INITIAL_DATA };
      
      // Map Cloud Data to App State
      if(cloud.parties) newData.parties = cloud.parties.map(p => ({...p, id: p.party_id, openingBal: p.opening_balance}));
      if(cloud.items) newData.items = cloud.items.map(i => ({...i, id: i.item_id, sellPrice: i.sales_price, buyPrice: i.purchase_price, openingStock: i.stock_qty}));
      if(cloud.staff) newData.staff = cloud.staff.map(s => ({...s, id: s.staff_id}));
      if(cloud.tasks) newData.tasks = cloud.tasks.map(t => ({...t, id: t.task_id, assignedTo: t.assigned_to, convertedSaleId: t.converted_sale_id, dueDate: t.due_date}));
      
      // Transactions
      let txs = [];
      if(cloud.sales) txs = [...txs, ...cloud.sales.map(s => ({...s, id: s.sale_id, type: 'sales', finalTotal: s.grand_total, items: []}))];
      if(cloud.purchases) txs = [...txs, ...cloud.purchases.map(s => ({...s, id: s.purchase_id, type: 'purchase', finalTotal: s.grand_total, items: []}))];
      if(cloud.expenses) txs = [...txs, ...cloud.expenses.map(s => ({...s, id: s.expense_id, type: 'expense', finalTotal: s.amount, items: []}))];
      if(cloud.payments) txs = [...txs, ...cloud.payments.map(s => ({...s, id: s.payment_id, type: 'payment', items: []}))];
      
      // Map Line Items to Transactions
      if(cloud.sales_items) {
        cloud.sales_items.forEach(item => {
          const tx = txs.find(t => t.id === item.sale_id);
          if(tx) tx.items.push({...item, itemId: item.item_id, price: item.rate});
        });
      }
      if(cloud.purchase_items) {
        cloud.purchase_items.forEach(item => {
          const tx = txs.find(t => t.id === item.purchase_id);
          if(tx) tx.items.push({...item, itemId: item.item_id, price: item.rate});
        });
      }

      newData.transactions = txs;
      setData(newData);
      showToast("Cloud Sync Complete!", "success");
    } catch (err) {
      console.error(err);
      showToast("Offline Mode / Sync Error", "error");
    }
  };

  useEffect(() => {
    fetchFromCloud();
  }, []);

  const saveToCloud = async (collection, record, action = 'ADD') => {
    if(SHEET_API_URL.includes("YOUR_GOOGLE")) return;

    let sheetName = '';
    let payload = { ...record };
    let idKey = 'id';

    // Mapping for Google Sheet Columns
    if(collection === 'parties') {
       sheetName = 'Parties'; 
       payload = { party_id: record.id, name: record.name, type: record.type, mobile: record.mobile, email: record.email, address: record.address, opening_balance: record.openingBal };
    }
    else if(collection === 'items') {
       sheetName = 'Items';
       payload = { item_id: record.id, name: record.name, category: record.category, type: record.type, unit: record.unit, sales_price: record.sellPrice, purchase_price: record.buyPrice, stock_qty: record.openingStock, description: record.description };
    }
    else if(collection === 'staff') {
       sheetName = 'Staff';
       payload = { staff_id: record.id, name: record.name, role: record.role, mobile: record.mobile };
    }
    else if(collection === 'tasks') {
       sheetName = 'Tasks';
       payload = { task_id: record.id, title: record.name, party_id: record.partyId, assigned_to: record.assignedTo, status: record.status, due_date: record.dueDate, description: record.description };
    }
    else if(collection === 'transactions') {
       if(record.type === 'sales') {
          sheetName = 'Sales';
          payload = { sale_id: record.id, date: record.date, party_id: record.partyId, total_amount: record.grossTotal, grand_total: record.finalTotal, received: record.received, status: getTransactionTotals(record).status };
          // Save Items separately loop
          record.items.forEach(item => {
             saveToCloud('sales_items', { sale_id: record.id, item_id: item.itemId, qty: item.qty, rate: item.price, amount: item.qty * item.price }, 'ADD');
          });
       } else if(record.type === 'purchase') {
          sheetName = 'Purchases';
          payload = { purchase_id: record.id, vendor_inv_no: record.vendorInv || '', date: record.date, party_id: record.partyId, grand_total: record.finalTotal, paid: record.paid, status: getTransactionTotals(record).status };
           record.items.forEach(item => {
             saveToCloud('purchase_items', { purchase_id: record.id, item_id: item.itemId, qty: item.qty, rate: item.price, amount: item.qty * item.price }, 'ADD');
          });
       } else if(record.type === 'expense') {
          sheetName = 'Expenses';
          payload = { expense_id: record.id, date: record.date, category: record.category.name || record.category, type: 'Indirect', amount: record.finalTotal, paid_via: record.paymentMode, description: record.description };
       } else if(record.type === 'payment') {
          sheetName = 'Payments';
          payload = { payment_id: record.id, date: record.date, party_id: record.partyId, txn_type: record.subType, amount: record.amount, mode: record.paymentMode, linked_txn_id: record.linkedBills?.[0]?.billId || '' };
       }
    }
    
    // Internal recursive call for items doesn't need fetch, just identifying it here
    if(collection === 'sales_items') {
      sheetName = 'Sales_Items';
      // payload is already correct from above loop
    }
    if(collection === 'purchase_items') {
       sheetName = 'Purchase_Items';
    }

    // Send to Google Sheet
    try {
      await fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action, sheet: sheetName, data: payload, idKey: collection === 'parties' ? 'party_id' : collection === 'items' ? 'item_id' : 'id' })
      });
    } catch(e) { console.error("Cloud Save Error", e); }
  };

  // --- APP LOGIC ---

  const saveRecord = (collection, record, idType) => {
    let newData = { ...data };
    let savedRecord = record;

    if (record.id) {
      // Update existing
      newData[collection] = data[collection].map(r => r.id === record.id ? record : r);
      saveToCloud(collection, record, 'UPDATE');
      showToast("Updated successfully");
    } else {
      // Create New
      const { id, nextCounters } = getNextId(data, idType, record.type);
      savedRecord = { ...record, id, createdAt: new Date().toISOString() };
      newData[collection] = [...data[collection], savedRecord];
      newData.counters = nextCounters;
      saveToCloud(collection, savedRecord, 'ADD');
      showToast("Created successfully");
    }
    
    setData(newData);
    setModal({ type: null, data: null });
  };

  const deleteRecord = (collection, id) => {
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].filter(r => r.id !== id)
    }));
    // Note: Delete from cloud not implemented in this simple version to prevent data loss
    setConfirmDelete(null);
    setModal({ type: null, data: null });
    showToast("Record deleted (Local only)", "error");
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

  const printInvoice = (tx) => {
    const party = data.parties.find(p => p.id === tx.partyId);
    const content = `
      <html>
        <head><title>Invoice ${tx.id}</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>INVOICE: ${tx.id}</h1>
          <p>Date: ${formatDate(tx.date)}</p>
          <hr/>
          <h3>${data.company.name}</h3>
          <p>To: ${party?.name || 'Cash Customer'}</p>
          <table style="width:100%; text-align:left; border-collapse: collapse; margin-top: 20px;">
            <tr style="background:#eee;"><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            ${(tx.items || []).map(i => {
                const item = data.items.find(x => x.id === i.itemId);
                return `<tr>
                    <td style="padding:8px; border-bottom:1px solid #ddd;">${item?.name || i.itemId}</td>
                    <td style="padding:8px; border-bottom:1px solid #ddd;">${i.qty}</td>
                    <td style="padding:8px; border-bottom:1px solid #ddd;">${i.price}</td>
                    <td style="padding:8px; border-bottom:1px solid #ddd;">${(i.qty * i.price).toFixed(2)}</td>
                </tr>`;
            }).join('')}
          </table>
          <h3 style="text-align:right; margin-top:20px;">Total: ${formatCurrency(tx.finalTotal)}</h3>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
  };

  // --- VIEWS ---

  const Dashboard = () => {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
        sales: data.transactions.filter(t => t.type === 'sales' && t.date === today).reduce((acc, t) => acc + parseFloat(t.finalTotal||0), 0),
        expense: data.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + parseFloat(t.finalTotal||0), 0),
        pendingTasks: data.tasks.filter(t => t.status !== 'Done').length
    };

    return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.company.name}</h1>
          <p className="text-sm text-gray-500">FY {data.company.financialYear}</p>
        </div>
        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Cloud Connected</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
          <p className="text-xs font-bold text-green-600 uppercase">Today Sales</p>
          <p className="text-xl font-bold text-green-900">{formatCurrency(stats.sales)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-xs font-bold text-red-600 uppercase">Total Expenses</p>
          <p className="text-xl font-bold text-red-900">{formatCurrency(stats.expense)}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-600 uppercase">Pending Tasks</p>
          <p className="text-xl font-bold text-blue-900">{stats.pendingTasks}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Sale', icon: <ArrowUpRight />, type: 'sales', color: 'bg-green-100 text-green-700' },
            { label: 'Purchase', icon: <ArrowDownLeft />, type: 'purchase', color: 'bg-blue-100 text-blue-700' },
            { label: 'Expense', icon: <ReceiptText />, type: 'expense', color: 'bg-red-100 text-red-700' },
            { label: 'Payment', icon: <Package />, type: 'payment', color: 'bg-purple-100 text-purple-700' }
          ].map(action => (
            <button key={action.label} onClick={() => setModal({ type: action.type })} className="flex flex-col items-center gap-2">
              <div className={`p-4 rounded-2xl ${action.color}`}>{action.icon}</div>
              <span className="text-xs font-medium text-gray-600">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )};

  const MasterList = ({ title, collection, type, onRowClick }) => {
    const [search, setSearch] = useState('');
    const filtered = data[collection].filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase())));
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{title}</h1>
          <button onClick={() => setModal({ type })} className="p-2 bg-blue-600 text-white rounded-xl flex items-center gap-1 text-sm px-4"><Plus size={18} /> Add</button>
        </div>
        <input className="w-full pl-4 pr-4 py-3 bg-gray-100 border-none rounded-xl" placeholder={`Search ${title}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} onClick={() => onRowClick ? onRowClick(item) : setModal({ type, data: item })} className="p-4 bg-white border rounded-2xl flex justify-between items-center active:scale-95 transition-transform">
              <div><p className="font-bold text-gray-800">{item.name}</p><p className="text-xs text-gray-500">{item.id} • {item.mobile || item.role || item.category}</p></div>
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
    const filtered = data.transactions.filter(tx => filter === 'all' || tx.type === filter).sort((a, b) => new Date(b.date) - new Date(a.date));
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center"><h1 className="text-xl font-bold">Accounting</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'sales', 'purchase', 'expense', 'payment'].map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap border ${filter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map(tx => {
            const party = data.parties.find(p => p.id === tx.partyId);
            const totals = getBillLogic(tx);
            const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
            return (
              <div key={tx.id} onClick={() => setViewDetail({ type: 'transaction', id: tx.id })} className="p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer active:scale-95 transition-transform">
                <div className="flex gap-4 items-center">
                  <div className={`p-2 rounded-full ${isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div>
                  <div>
                    <p className="font-bold text-gray-800">{party?.name || tx.category?.name || tx.category || 'N/A'}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{tx.id} • {formatDate(tx.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>{isIncoming ? '+' : '-'}{formatCurrency(totals.amount)}</p>
                  {['sales', 'purchase'].includes(tx.type) && <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-gray-100 text-gray-600">{totals.status}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const PartyForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', mobile: '', email: '', openingBal: 0, type: 'Customer', address: '' });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Party Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" placeholder="Opening Balance" value={form.openingBal} onChange={e => setForm({...form, openingBal: e.target.value})} />
        <button onClick={() => saveRecord('parties', form, 'party')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Party</button>
      </div>
    );
  };

  const ItemForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', unit: 'PCS', sellPrice: 0, buyPrice: 0, category: 'General', type: 'Goods', openingStock: 0, description: '' });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="Item Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <SearchableSelect label="Category" options={data.categories.item} value={form.category} onChange={v => setForm({...form, category: v})} />
        <div className="grid grid-cols-2 gap-4">
           <div><label className="text-[10px] font-bold text-gray-400">Sale Price</label><input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} /></div>
           <div><label className="text-[10px] font-bold text-gray-400">Buy Price</label><input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} /></div>
        </div>
        <div><label className="text-[10px] font-bold text-gray-400">Stock</label><input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} /></div>
        <button onClick={() => saveRecord('items', form, 'item')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Item</button>
      </div>
    );
  };

  const StaffForm = ({ record }) => {
    const [form, setForm] = useState(record || { name: '', mobile: '', role: 'Staff' });
    return (
      <div className="space-y-4">
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Mobile" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
        <button onClick={() => saveRecord('staff', form, 'staff')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Staff</button>
      </div>
    );
  };

  const TaskForm = ({ record }) => {
     const [form, setForm] = useState(record || { name: '', partyId: '', status: 'To Do', dueDate: '', assignedTo: '' });
     return (
       <div className="space-y-4">
         <input className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="Task Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
         <SearchableSelect label="Assign To" options={data.staff} value={form.assignedTo} onChange={v => setForm({...form, assignedTo: v})} />
         <SearchableSelect label="Party" options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v})} />
         <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
         <button onClick={() => saveRecord('tasks', form, 'task')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Task</button>
       </div>
     );
  };

  const TransactionForm = ({ type, record }) => {
    const [tx, setTx] = useState(record || { type, date: new Date().toISOString().split('T')[0], partyId: '', items: [], discountType: '%', discountValue: 0, received: 0, paid: 0, paymentMode: 'Cash', category: '', subType: type === 'payment' ? 'in' : '', amount: '', linkedBills: [] });
    const totals = getTransactionTotals(tx);

    const addLineItem = () => setTx({...tx, items: [...tx.items, { itemId: '', qty: 1, price: 0 }]});
    const updateLine = (idx, field, val) => {
       const newItems = [...tx.items];
       newItems[idx][field] = val;
       if (field === 'itemId') {
          const item = data.items.find(i => i.id === val);
          newItems[idx].price = type === 'purchase' ? item.buyPrice : item.sellPrice;
       }
       setTx({...tx, items: newItems});
    };

    const handleSave = () => {
       if (!tx.partyId && type !== 'expense') return alert("Select Party");
       saveRecord('transactions', { ...tx, ...totals }, 'transaction');
    };

    return (
      <div className="space-y-4 pb-10">
        <div className="flex justify-between items-center"><p className="text-xs font-bold text-gray-400 uppercase">{tx.id || 'New ' + type}</p><input type="date" className="p-1 text-sm border-none bg-transparent font-bold text-blue-600" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} /></div>
        {type === 'payment' && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
             <button onClick={() => setTx({...tx, subType: 'in'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'in' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>Payment IN</button>
             <button onClick={() => setTx({...tx, subType: 'out'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tx.subType === 'out' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}>Payment OUT</button>
          </div>
        )}
        {type === 'expense' && <SearchableSelect label="Category" options={data.categories.expense.map(c => c.name)} value={tx.category} onChange={v => setTx({...tx, category: v})} />}
        <SearchableSelect label="Party" options={data.parties} value={tx.partyId} onChange={v => setTx({...tx, partyId: v})} onAddNew={() => setModal({ type: 'party' })} />
        {type !== 'payment' ? (
           <div className="space-y-3">
              <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase">Items</h4><button onClick={addLineItem} className="text-blue-600 text-xs font-bold">+ Add Item</button></div>
              {tx.items.map((line, idx) => (
                 <div key={idx} className="p-3 bg-gray-50 border rounded-xl relative">
                    <button onClick={() => setTx({...tx, items: tx.items.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow border text-red-500"><X size={12} /></button>
                    <SearchableSelect label="" options={data.items} value={line.itemId} onChange={v => updateLine(idx, 'itemId', v)} />
                    <div className="grid grid-cols-2 gap-2 mt-2"><input type="number" className="w-full p-2 border rounded-lg text-sm" value={line.qty} placeholder="Qty" onChange={e => updateLine(idx, 'qty', e.target.value)} /><input type="number" className="w-full p-2 border rounded-lg text-sm" value={line.price} placeholder="Price" onChange={e => updateLine(idx, 'price', e.target.value)} /></div>
                 </div>
              ))}
              <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                 <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(totals.final)}</span></div>
                 <div className="flex items-center gap-2"><input type="number" className="flex-1 p-3 border rounded-xl font-bold text-green-600" placeholder={type === 'sales' ? "Received Amt" : "Paid Amt"} value={(type === 'sales' ? tx.received : tx.paid) || ''} onChange={e => setTx({...tx, [type === 'sales' ? 'received' : 'paid']: e.target.value})} /><select className="p-3 border rounded-xl text-xs" value={tx.paymentMode} onChange={e => setTx({...tx, paymentMode: e.target.value})}><option>Cash</option><option>UPI</option><option>Bank</option></select></div>
              </div>
           </div>
        ) : (
           <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl"><label className="text-xs font-bold text-blue-600 uppercase">Amount</label><input type="number" className="w-full bg-transparent text-2xl font-bold focus:ring-0 border-none p-0" placeholder="0.00" value={tx.amount || ''} onChange={e => setTx({...tx, amount: e.target.value, finalTotal: e.target.value})} /></div>
        )}
        <button onClick={handleSave} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">Save Transaction</button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans select-none">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white animate-in fade-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}><CheckCircle2 size={18} /><span className="text-sm font-bold">{toast.message}</span></div>}
      {/* Detail View Placeholder */}
      {viewDetail && <div className="fixed inset-0 z-[60] bg-white overflow-y-auto"><div className="p-4"><button onClick={() => setViewDetail(null)} className="mb-4"><X /></button><h1 className="text-2xl font-bold">Transaction {viewDetail.id}</h1><p>Details view simplified for integration...</p><button onClick={() => printInvoice(data.transactions.find(t=>t.id===viewDetail.id))} className="mt-4 bg-blue-600 text-white p-2 rounded">Print</button></div></div>}
      
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">N</div><span className="font-black text-gray-800 tracking-tight">NEXUS ERP</span></div>
      </div>

      <main className="max-w-xl mx-auto p-4">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'accounting' && <TransactionList />}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <MasterList title="Items" collection="items" type="item" onRowClick={(item) => setModal({type: 'item', data: item})} />
            <MasterList title="Parties" collection="parties" type="party" onRowClick={(item) => setModal({type: 'party', data: item})} />
            <MasterList title="Staff" collection="staff" type="staff" />
          </div>
        )}
        {activeTab === 'tasks' && <div className="space-y-4"><h1 className="text-xl font-bold">Tasks</h1><button onClick={() => setModal({ type: 'task' })} className="w-full p-2 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-1"><Plus /> Add Task</button>{data.tasks.map(t => <div key={t.id} className="p-4 bg-white border rounded-2xl"><p className="font-bold">{t.name}</p><span className="text-xs bg-gray-100 px-2 py-1 rounded">{t.status}</span></div>)}</div>}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-2 flex justify-between items-center z-50">
        {[{ id: 'dashboard', icon: <LayoutDashboard />, label: 'Home' }, { id: 'accounting', icon: <ReceiptText />, label: 'Accounts' }, { id: 'tasks', icon: <CheckSquare />, label: 'Tasks' }, { id: 'staff', icon: <Users />, label: 'Masters' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-gray-400'}`}>{tab.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span></button>
        ))}
      </nav>

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.type ? (modal.data ? `Edit ${modal.type}` : `New ${modal.type}`) : ''}>
        {modal.type === 'party' && <PartyForm record={modal.data} />}
        {modal.type === 'item' && <ItemForm record={modal.data} />}
        {modal.type === 'staff' && <StaffForm record={modal.data} />}
        {modal.type === 'task' && <TaskForm record={modal.data} />}
        {['sales', 'purchase', 'expense', 'payment'].includes(modal.type) && <TransactionForm type={modal.type} record={modal.data} />}
      </Modal>
    </div>
  );
}