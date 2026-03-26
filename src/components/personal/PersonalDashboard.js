import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RefreshCw, 
  LogOut, 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Banknote, 
  CreditCard,
  CheckCircle2,
  Trash2,
  Lock,
  ArrowRightLeft,
  ChevronRight,
  PieChart,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from '../../services/firebase';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PersonalDashboard = ({ data, setData, showToast, onClose }) => {
    const [mainTab, setMainTab] = useState('finance'); 
    const [financeView, setFinanceView] = useState('transactions'); 
    const [showAddForm, setShowAddForm] = useState(false);
    const [filterType, setFilterType] = useState('Monthly'); 
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustom, setFilterCustom] = useState({ start: '', end: '' });
    const [editingPTx, setEditingPTx] = useState(null);
    const [selectedPTask, setSelectedPTask] = useState(null);

    // Sync Logic
    useEffect(() => {
        const cached = localStorage.getItem('smees_data');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.personalTransactions) {
                setData(prev => ({ 
                    ...prev, 
                    personalTransactions: parsed.personalTransactions || [], 
                    personalAccounts: parsed.personalAccounts || [], 
                    personalCategories: parsed.personalCategories || [], 
                    personalTasks: parsed.personalTasks || [] 
                }));
            }
        }

        const unsub = onSnapshot(doc(db, "companies", "smees_pro_data"), (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                setData(prev => {
                    const newData = { 
                        ...prev, 
                        personalTransactions: cloudData.personalTransactions || [], 
                        personalAccounts: cloudData.personalAccounts || [], 
                        personalCategories: cloudData.personalCategories || [], 
                        personalTasks: cloudData.personalTasks || [] 
                    };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
            }
        });
        return () => unsub();
    }, [setData]);

    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [{ id: 'cash', name: 'Cash', group: 'Cash', initialBalance: 0 }];
    const categories = data.personalCategories || { income: ['Salary'], expense: ['Food'], transfer: [] };

    const { totalBalance } = useMemo(() => {
        let total = 0;
        const bals = {};
        accounts.forEach(a => bals[a.name] = parseFloat(a.initialBalance || 0));
        transactions.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') bals[t.account] = (bals[t.account] || 0) + amt;
            else if (t.type === 'expense') bals[t.account] = (bals[t.account] || 0) - amt;
            else if (t.type === 'transfer') {
                bals[t.account] = (bals[t.account] || 0) - amt;
                bals[t.toAccount] = (bals[t.toAccount] || 0) + amt;
            }
        });
        accounts.forEach(a => total += (bals[a.name] || 0));
        return { totalBalance: total };
    }, [transactions, accounts]);

    const filteredTxs = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);
            const now = new Date();
            const fDate = new Date(filterDate);
            if (filterType === 'Date') return t.date === filterDate;
            if (filterType === 'Weekly') {
                const start = new Date(now);
                start.setDate(start.getDate() - start.getDay());
                start.setHours(0,0,0,0);
                return d >= start;
            }
            if (filterType === 'Monthly') return d.getMonth() === fDate.getMonth() && d.getFullYear() === fDate.getFullYear();
            return true; 
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filterDate, filterType]);

    const handleManualSync = async () => {
        try {
            const docSnap = await getDoc(doc(db, "companies", "smees_pro_data"));
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                setData(prev => {
                    const newData = { ...prev, personalTransactions: cloudData.personalTransactions || [], personalAccounts: cloudData.personalAccounts || [], personalCategories: cloudData.personalCategories || [], personalTasks: cloudData.personalTasks || [] };
                    localStorage.setItem('smees_data', JSON.stringify(newData));
                    return newData;
                });
                alert("Vault Synced!");
            }
        } catch(e) { alert("Sync Failed!"); }
    };

    return (
        <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-200">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 pt-12 pb-4 px-6 shadow-2xl shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Lock size={20} className="text-white"/></div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white">My Vault</h2>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Secured Storage</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleManualSync} className="p-3 bg-slate-800 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all"><RefreshCw size={18}/></button>
                        <button onClick={onClose} className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><LogOut size={18}/></button>
                    </div>
                </div>
                
                {/* Balance Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-[32px] shadow-xl shadow-indigo-900/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><PieChart size={120} /></div>
                    <p className="text-xs font-black text-indigo-100 uppercase tracking-widest mb-1 opacity-80">Total Wealth</p>
                    <h1 className="text-3xl font-black text-white tracking-tight">{formatCurrency(totalBalance)}</h1>
                    <div className="mt-4 flex gap-4">
                        <div className="bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md flex items-center gap-2">
                            <TrendingUp size={14} className="text-emerald-400"/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Safe</span>
                        </div>
                        <div className="bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-indigo-300"/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Encrypted</span>
                        </div>
                    </div>
                </div>

                <div className="flex mt-8 gap-4">
                    <button onClick={() => setMainTab('finance')} className={`flex-1 py-1 font-black text-xs uppercase tracking-[0.2em] transition-all ${mainTab === 'finance' ? 'text-white border-b-2 border-indigo-500 pb-3' : 'text-slate-500 border-transparent'}`}>Finance</button>
                    <button onClick={() => setMainTab('tasks')} className={`flex-1 py-1 font-black text-xs uppercase tracking-[0.2em] transition-all ${mainTab === 'tasks' ? 'text-white border-b-2 border-indigo-500 pb-3' : 'text-slate-500 border-transparent'}`}>Tasks</button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
                {mainTab === 'finance' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-6 h-[1px] bg-slate-800"></span>
                                Transactions
                            </h3>
                            <button onClick={() => setShowAddForm(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"><Plus/></button>
                        </div>

                        <div className="space-y-3 pb-32">
                            {filteredTxs.map(t => (
                                <div key={t.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-3xl flex justify-between items-center group hover:bg-slate-900 transition-all">
                                    <div className="flex gap-4 items-center">
                                        <div className={`p-3 rounded-2xl ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : t.type === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {t.type === 'income' ? <TrendingUp size={18}/> : t.type === 'expense' ? <TrendingDown size={18}/> : <ArrowRightLeft size={18}/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm tracking-tight">{t.category || 'Transfer'}</p>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{t.account} • {formatDate(t.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-sm ${t.type === 'income' ? 'text-emerald-500' : t.type === 'expense' ? 'text-rose-500' : 'text-blue-400'}`}>
                                            {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {filteredTxs.length === 0 && <p className="text-center text-slate-700 py-10 uppercase text-[10px] font-black tracking-[0.3em]">No activity found</p>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex gap-3">
                            <input className="flex-1 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Quick capture task..." id="personal_task_in"/>
                            <button onClick={async () => {
                                const val = document.getElementById('personal_task_in').value;
                                if(!val) return;
                                const newTask = { id: Date.now().toString(), text: val, status: 'To Do', date: new Date().toISOString() };
                                const updated = [newTask, ...(data.personalTasks || [])];
                                setData({ ...data, personalTasks: updated });
                                await setDoc(doc(db, "companies", "smees_pro_data"), { personalTasks: updated }, { merge: true });
                                document.getElementById('personal_task_in').value = '';
                            }} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all"><Plus/></button>
                        </div>

                        <div className="space-y-3 pb-32">
                            {(data.personalTasks || []).map(t => (
                                <div key={t.id} className="p-5 bg-slate-900/50 border border-slate-800 rounded-[28px] flex justify-between items-center group transition-all hover:bg-slate-900 shadow-sm">
                                    <div className="flex gap-4 items-center">
                                        <div className={`w-3 h-3 rounded-full ${t.status === 'Done' ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                        <p className="font-bold text-slate-200 text-sm tracking-tight">{t.text}</p>
                                    </div>
                                    <button onClick={async () => {
                                        const updated = data.personalTasks.filter(x => x.id !== t.id);
                                        setData({ ...data, personalTasks: updated });
                                        await setDoc(doc(db, "companies", "smees_pro_data"), { personalTasks: updated }, { merge: true });
                                    }} className="p-2 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* FAB - Quick Add Link */}
            {mainTab === 'finance' && !showAddForm && (
                <div className="fixed bottom-10 right-8 flex flex-col gap-4 animate-in slide-in-from-bottom-10">
                    <button className="bg-indigo-600 w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 ring-4 ring-slate-950 hover:scale-110 active:scale-90 transition-all"><Plus size={32}/></button>
                </div>
            )}
        </div>
    );
};

export default PersonalDashboard;
