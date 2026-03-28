import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './services/firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { checkPermission, formatCurrency, getPartyBalances, getItemStock, getBillStats, getFilteredAttendance } from './utils/helpers';
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from './services/firebase';
import { Plus, TrendingUp, FileText, FileMinus, FileCheck, RefreshCw, X } from 'lucide-react';

// Layout & Auth
import LoginScreen from './components/auth/LoginScreen';
import AppLayout from './components/layout/AppLayout';

// Modules
import TransactionList from './components/accounting/TransactionList';
import TaskModule from './components/tasks/TaskModule';
import MasterModule from './components/masters/MasterModule';
import PersonalDashboard from './components/vault/PersonalDashboard';

// Forms & Modals
import PartyForm from './components/masters/PartyForm';
import ItemForm from './components/masters/ItemForm';
import StaffForm from './components/staff/StaffForm';
import TransactionForm from './components/accounting/TransactionForm';
import ConvertTaskModal from './components/tasks/ConvertTaskModal';
import AssetForm from './components/masters/AssetForm';
import TaskForm from './components/tasks/TaskForm';
import PersonalFinanceForm from './components/vault/PersonalFinanceForm';

// Views
import PersonalFinanceView from './components/vault/PersonalFinanceView';
import PersonalTasksView from './components/vault/PersonalTasksView';
import TransactionDetailView from './components/accounting/TransactionDetailView';
import TaskDetailView from './components/tasks/TaskDetailView';
import ItemDetailView from './components/masters/ItemDetailView';
import PartyProfileView from './components/masters/PartyProfileView';
import StaffDetailView from './components/staff/StaffDetailView';

const Dashboard = ({ data, setModal }) => {
    const [fType, setFType] = useState('Monthly');
    const [customRange, setCustomRange] = useState({ 
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });

    const stats = useMemo(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        end.setHours(23, 59, 59, 999);

        if(fType === 'Weekly') start.setDate(now.getDate() - now.getDay());
        else if(fType === 'Monthly') start.setMonth(now.getMonth(), 1);
        else if(fType === 'Yearly') start.setFullYear(now.getFullYear(), 0, 1);
        else if(fType === 'Custom') {
            start = new Date(customRange.start);
            end = new Date(customRange.end);
        }
        start.setHours(0,0,0,0);

        const filtered = data.transactions.filter(t => {
            const d = new Date(t.date);
            return d >= start && d <= end && t.status !== 'Cancelled';
        });
        
        const sales = filtered.filter(t => t.type === 'sales').reduce((s, t) => s + parseFloat(t.finalTotal || 0), 0);
        const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || t.finalTotal || 0), 0);
        
        let grossProfit = 0;
        filtered.filter(t => t.type === 'sales').forEach(s => {
            (s.items || []).forEach(i => { 
                const master = data.items.find(mi => mi.id === i.itemId);
                const buy = parseFloat(i.buyPrice || master?.buyPrice || 0);
                const sell = parseFloat(i.price || 0);
                const qty = parseFloat(i.qty || 1);
                grossProfit += (sell - buy) * qty; 
            });
            // Net profit subtracts the invoice discount
            grossProfit -= parseFloat(s.discountValue || 0);
        });


        const activeTasks = data.tasks.filter(t => t.status !== 'Done' && t.status !== 'Converted').length;

        return { sales, expenses, activeTasks, grossProfit, filteredTxs: filtered };
    }, [data, fType, customRange]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-20">
            {/* Execution Suite (TOP) - Compact High Density */}
            <div className="bg-slate-900 p-5 rounded-[40px] shadow-2xl space-y-6 text-white overflow-hidden relative border border-white/5">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Execution Suite</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest border border-blue-500/30 px-2 py-0.5 rounded-full">v2.1 Stable</p>
                            </div>

                        </div>
                        <button onClick={() => setModal({ type: 'task' })} className="px-6 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] active:scale-95 transition-all shadow-xl shadow-blue-500/20 hover:bg-blue-500">+ New Operation</button>
                    </div>
                    <div className="grid grid-cols-5 gap-2.5">
                        {[
                            { label: 'Sale', type: 'sales', color: 'bg-white/[0.03] text-emerald-400 border-emerald-500/10' },
                            { label: 'Purch', type: 'purchase', color: 'bg-white/[0.03] text-blue-400 border-blue-500/10' },
                            { label: 'Exp', type: 'expense', color: 'bg-white/[0.03] text-rose-400 border-rose-500/10' },
                            { label: 'Pay', type: 'payment', color: 'bg-white/[0.03] text-indigo-400 border-indigo-500/10' },
                            { label: 'Est', type: 'estimate', color: 'bg-white/[0.03] text-amber-400 border-amber-500/10' }
                        ].map(btn => (
                            <button 
                                key={btn.label} 
                                onClick={() => setModal({ type: btn.type })} 
                                className={`py-5 rounded-[28px] border ${btn.color} hover:bg-white/10 transition-all active:scale-90 flex flex-col items-center gap-2 group`}
                            >
                                <div className="p-2 bg-white/5 rounded-xl group-hover:scale-110 transition-transform"><Plus size={16}/></div>
                                <span className="text-[8px] font-black uppercase tracking-widest leading-none opacity-60">{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-end gap-6 pt-4 px-2">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-1">Command</h1>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] ml-1">Dynamic Intelligence Hub</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {fType === 'Custom' && (
                        <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
                            <input type="date" value={customRange.start} onChange={e=>setCustomRange(p=>({...p, start:e.target.value}))} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-[9px] font-black uppercase outline-none"/>
                            <input type="date" value={customRange.end} onChange={e=>setCustomRange(p=>({...p, end:e.target.value}))} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-[9px] font-black uppercase outline-none"/>
                        </div>
                    )}
                    <select className="bg-white border border-slate-100 px-5 py-3 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest outline-none shadow-sm active:scale-95 transition-all appearance-none cursor-pointer hover:bg-slate-50" value={fType} onChange={e => setFType(e.target.value)}>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Yearly">Yearly</option>
                        <option value="Custom">Custom Range</option>
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Gross Sales', value: formatCurrency(stats.sales), sub: `${fType} Billing`, color: 'bg-emerald-500 shadow-emerald-500/20', type: 'sales' },
                    { label: 'Opex Exp', value: formatCurrency(stats.expenses), sub: `Cost Center`, color: 'bg-rose-500 shadow-rose-500/20', type: 'expense' },
                    { label: 'Gross Profit', value: formatCurrency(stats.grossProfit), sub: 'Period IQ', color: 'bg-blue-600 shadow-blue-500/20', type: 'profit' },
                    { label: 'Pipeline', value: stats.activeTasks, sub: 'Active Load', color: 'bg-slate-900 shadow-slate-900/10', type: 'tasks' }
                ].map((card, i) => (
                    <div key={i} onClick={() => setModal({ type: 'dashboard_drilldown', filter: card.type, items: stats.filteredTxs.filter(t => t.type === card.type || (card.type === 'profit' && t.type === 'sales')) })} className={`p-6 rounded-[36px] shadow-2xl ${card.color} text-white hover:scale-[1.02] transition-all cursor-pointer group active:scale-95 relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-full -z-0"></div>
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2 group-hover:text-white relative z-10">{card.label}</p>
                        <h3 className="text-xl font-black tracking-tighter relative z-10">{card.value}</h3>
                        <p className="text-[8px] font-bold text-white/30 uppercase mt-0.5 relative z-10">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-6">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-4">Recent Transactions</h4>
                    <div className="space-y-4">
                        {data.transactions.slice(0, 5).map(t => (
                            <div key={t.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase">{t.type} #{t.id}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{t.date}</p>
                                </div>
                                <span className={`text-sm font-black ${t.type === 'sales' ? 'text-emerald-600' : 'text-slate-900'}`}>{formatCurrency(t.finalTotal || t.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { data, setData, loading: dataLoading } = useFirebaseSync();

    const [modal, setModal] = useState(null); 
    const [viewDetail, setViewDetail] = useState(null); 

    const partyBalances = useMemo(() => getPartyBalances(data), [data]);
    const itemStock = useMemo(() => getItemStock(data), [data]);

    const deleteRecord = async (collectionName, id) => {
        if (!window.confirm(`Are you sure you want to delete this ${collectionName}?`)) return;
        try {
            await deleteDoc(doc(db, collectionName, id.toString()));
            setData(prev => ({
                ...prev,
                [collectionName]: prev[collectionName].filter(r => r.id !== id)
            }));
            setViewDetail(null);
        } catch (e) {
            console.error("Delete Error:", e);
        }
    };

    const handleAttendance = async (staffId, type, manualData = null) => {
        let attId, updated;
        const now = new Date();
        const todayStr = manualData?.date || now.toISOString().split('T')[0];
        const timeStr = manualData ? "" : now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        attId = `ATT-${staffId}-${todayStr}`;
        const existing = data.attendance.find(a => a.id === attId) || {
            id: attId, staffId, date: todayStr, status: 'Present',
            checkIn: '', checkOut: '', lunchStart: '', lunchEnd: ''
        };

        if (type === 'manual') {
            updated = { ...existing, ...manualData, updatedAt: now.toISOString() };
        } else {
            updated = { ...existing, [type]: timeStr, updatedAt: now.toISOString() };
        }

        await setDoc(doc(db, "attendance", attId), updated, { merge: true });
        setData(prev => ({
            ...prev,
            attendance: [...prev.attendance.filter(a => a.id !== attId), updated]
        }));
    };

    const toggleTimer = async (taskId, staffId) => {
        try {
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error("Task not found for timer:", taskId);
                return;
            }

            const now = new Date().toISOString();
            let newLogs = [...(task.timeLogs || [])];
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

            if (activeLogIndex > -1) {
                const duration = (new Date(now) - new Date(newLogs[activeLogIndex].start)) / 60000;
                newLogs[activeLogIndex] = { ...newLogs[activeLogIndex], end: now, duration: duration.toFixed(2) };
            } else {
                newLogs.push({ staffId, start: now, end: null, staffName: data.staff.find(s=>s.id===staffId)?.name || 'Unknown' });
            }

            const updatedTask = { ...task, timeLogs: newLogs, updatedAt: now };
            
            // Optimistic Update
            setData(prev => ({
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
            }));

            await setDoc(doc(db, "tasks", taskId.toString()), updatedTask, { merge: true });
        } catch (e) {
            console.error("Timer Toggle Failed:", e);
            alert("Timer Sync Error");
        }
    };

    const refreshSingleRecord = async (collection, id) => {
        try {
            if(!id) return;
            const snap = await getDoc(doc(db, collection, id.toString()));
            if (snap.exists()) {
                setData(prev => ({
                    ...prev,
                    [collection]: [...prev[collection].filter(r => r.id !== id), snap.data()]
                }));
            }
        } catch (e) {
            console.error("Refresh Error:", e);
        }
    };

    useEffect(() => {
        const handleBack = (e) => {
            if (modal) {
                setModal(null);
                e.preventDefault();
            } else if (viewDetail) {
                setViewDetail(null);
                e.preventDefault();
            }
        };
        if (modal || viewDetail) {
            window.history.pushState({ modal: true }, '', '');
            window.addEventListener('popstate', handleBack);
        }
        return () => window.removeEventListener('popstate', handleBack);
    }, [modal, viewDetail]);

    const cancelTransaction = async (id) => {
        if(!window.confirm("Cancel this transaction?")) return;
        const tx = data.transactions.find(t => t.id === id);
        const updated = { ...tx, status: 'Cancelled', updatedAt: new Date().toISOString() };
        await setDoc(doc(db, "transactions", id), updated, { merge: true });
        setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === id ? updated : t) }));
    };

    const restoreTransaction = async (id) => {
        const tx = data.transactions.find(t => t.id === id);
        const updated = { ...tx, status: 'Unpaid', updatedAt: new Date().toISOString() };
        await setDoc(doc(db, "transactions", id), updated, { merge: true });
        setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === id ? updated : t) }));
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const savedUser = JSON.parse(localStorage.getItem('smees_user'));
                setUser(savedUser || { 
                    uid: authUser.uid, 
                    email: authUser.email, 
                    role: authUser.email?.includes('admin') ? 'admin' : 'staff',
                    permissions: { canViewDashboard: true, canViewAccounts: true, canViewTasks: true, canEditTasks: true, canViewMasters: true }
                });
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    if (authLoading || dataLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] animate-pulse">Initializing SMEES Engine</p>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            {modal && (
                <div className="fixed inset-0 z-[140] bg-white md:bg-slate-900/50 md:backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full md:max-w-4xl h-full md:max-h-[90vh] md:rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-[150]">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{modal.type} Specialist</h3>
                            <button onClick={() => setModal(null)} className="p-3 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="h-[calc(100%-88px)] overflow-y-auto scrollbar-hide">
                            {modal.type === 'party' && <PartyForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'item' && <ItemForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'staff' && <StaffForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {['sales', 'purchase', 'expense', 'payment', 'estimate'].includes(modal.type) && (
                                <TransactionForm data={data} setData={setData} type={modal.type} record={modal.data} onClose={() => setModal(null)} />
                            )}
                            {modal.type === 'dashboard_drilldown' && (
                                <div className="space-y-4">
                                    <div className="flex bg-slate-900 px-6 py-6 rounded-[40px] justify-between items-center mb-6 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 border border-white/5 shadow-inner"><TrendingUp size={24}/></div>
                                            <div>
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] leading-none mb-1">Intelligence Insights</p>
                                                <h4 className="text-lg font-black text-white tracking-tighter">{modal.filter === 'profit' ? 'Gross Profit' : modal.filter.toUpperCase()} Report</h4>
                                            </div>
                                        </div>
                                        <div className="text-right relative z-10">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{modal.items.length} Data Points</p>
                                            <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1 italic">Audited Log</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {modal.items.map(t => {
                                            // Enhanced Profit Calculation Logic
                                            let serviceP = 0, goodsP = 0;
                                            (t.items || []).forEach(item => {
                                                const master = data.items.find(i => i.id === item.itemId);
                                                const type = master?.type || 'Goods';
                                                const buy = parseFloat(item.buyPrice || master?.buyPrice || 0);
                                                const sell = parseFloat(item.price || 0);
                                                const qty = parseFloat(item.qty || 0);
                                                const profit = (sell - buy) * qty;
                                                
                                                if (type === 'Service') serviceP += profit;
                                                else goodsP += profit;
                                            });
                                            const netP = serviceP + goodsP - parseFloat(t.discountValue || 0);

                                            return (
                                                <div key={t.id} onClick={() => { setModal(null); setViewDetail({ type: 'transaction', id: t.id }); }} className="p-5 bg-white border border-slate-100 rounded-[36px] items-center justify-between hover:bg-slate-50 transition-all hover:shadow-2xl cursor-pointer group active:scale-[0.98] shadow-sm">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm"><FileText size={20}/></div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1.5">{data.parties.find(p=>p.id===t.partyId)?.name || t.category || 'Direct Operation'}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">#{t.id}</p>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.date}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-black text-slate-900 tracking-tighter">{formatCurrency(t.finalTotal || t.amount || 0)}</p>
                                                            <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1.5 inline-block ${t.type === 'sales' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t.type}</div>
                                                        </div>
                                                    </div>

                                                    {modal.filter === 'profit' && (
                                                        <div className="mt-4 pt-4 border-t border-slate-50">
                                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 text-center">
                                                                    <p className="text-[8px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Material Profit</p>
                                                                    <p className="text-xs font-black text-emerald-700">{formatCurrency(goodsP)}</p>
                                                                </div>
                                                                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 text-center">
                                                                    <p className="text-[8px] font-black text-blue-600/60 uppercase tracking-widest mb-1">Service Profit</p>
                                                                    <p className="text-xs font-black text-blue-700">{formatCurrency(serviceP)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center px-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Realization</span>
                                                                    {parseFloat(t.discountValue || 0) > 0 && (
                                                                        <span className="text-[8px] font-bold text-rose-500 uppercase tracking-[0.1em] mt-0.5">Incl. {formatCurrency(t.discountValue)} Discount</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xl font-black text-emerald-600 tracking-tighter">{formatCurrency(netP)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {modal.items.length === 0 && (
                                            <div className="py-24 flex flex-col items-center justify-center opacity-30 grayscale scale-90">
                                                <TrendingUp size={48} className="text-slate-300 mb-4"/>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">No Financial Trajectories Found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {modal.type === 'personalFinance' && <PersonalFinanceForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'task' && <TaskForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'convertTask' && <ConvertTaskModal task={modal.data} data={data} setData={setData} onClose={() => setModal(null)} />}
                            {modal.type === 'asset' && <AssetForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                        </div>
                    </div>
                </div>
            )}

            {viewDetail && (
                <div className="fixed inset-0 z-[90] bg-white overflow-hidden">
                    {viewDetail.type === 'personalFinance' && <PersonalFinanceView data={data} setData={setData} onBack={() => setViewDetail(null)} accountId={viewDetail.accountId} setModal={setModal} />}
                    {viewDetail.type === 'personalTasks' && <PersonalTasksView data={data} setData={setData} onBack={() => setViewDetail(null)} />}
                    
                    {viewDetail.type === 'transaction' && (
                        <TransactionDetailView 
                            tx={data.transactions.find(t => t.id && t.id.toString() === viewDetail.id?.toString())}
                            data={data}
                            user={user}
                            onBack={() => setViewDetail(null)}
                            setViewDetail={setViewDetail}
                            setModal={setModal}
                            cancelTransaction={cancelTransaction}
                            restoreTransaction={restoreTransaction}
                            deleteRecord={deleteRecord}
                            checkPermission={checkPermission}
                        />
                    )}

                    {viewDetail.type === 'task' && (
                        <TaskDetailView 
                            task={data.tasks.find(t => t.id === viewDetail.id)}
                            data={data}
                            user={user}
                            onBack={() => setViewDetail(null)}
                            setViewDetail={setViewDetail}
                            setModal={setModal}
                            deleteRecord={deleteRecord}
                            showToast={(msg) => console.log(msg)}
                            toggleTimer={toggleTimer}
                            checkPermission={checkPermission}
                            refreshSingleRecord={refreshSingleRecord}
                        />
                    )}

                    {viewDetail.type === 'party' && (
                        <PartyProfileView 
                            record={data.parties.find(p => p.id === viewDetail.id)}
                            data={data}
                            onBack={() => setViewDetail(null)}
                            setViewDetail={setViewDetail}
                            setModal={setModal}
                            user={user}
                            deleteRecord={deleteRecord}
                            partyBalances={partyBalances}
                            getBillStats={getBillStats}
                        />
                    )}

                    {viewDetail.type === 'item' && (
                        <ItemDetailView 
                            item={data.items.find(i => i.id === viewDetail.id)}
                            data={data}
                            onBack={() => setViewDetail(null)}
                            setViewDetail={setViewDetail}
                            setModal={setModal}
                            itemStock={itemStock}
                        />
                    )}

                    {viewDetail.type === 'staff' && (
                        <StaffDetailView 
                            staff={data.staff.find(s => s.id === viewDetail.id)}
                            data={data}
                            user={user}
                            onBack={() => setViewDetail(null)}
                            setViewDetail={setViewDetail}
                            setModal={setModal}
                            deleteRecord={deleteRecord}
                            handleAttendance={(type, manual) => handleAttendance(viewDetail.id, type, manual)}
                            attToday={data.attendance.find(a => a.staffId === viewDetail.id && a.date === new Date().toISOString().split('T')[0]) || {}}
                            getFilteredAttendance={getFilteredAttendance}
                            allAttendance={data.attendance}
                            attStats={(() => {
                                const staff = data.staff.find(s => s.id === viewDetail.id);
                                const filtered = getFilteredAttendance(staff, 'This Month', {}, data.attendance);
                                return { count: filtered.length, mins: filtered.length * 480 }; 
                            })()}
                            workLogs={data.workLogs?.filter(w => w.staffId === viewDetail.id) || []}
                            formatDurationHrs={(m) => `${Math.floor(m/60)}h`}
                        />
                    )}
                </div>
            )}

            <Routes>
                <Route path="/login" element={!user ? <LoginScreen setUser={setUser} /> : <Navigate to="/" />} />
                <Route path="/" element={user ? <AppLayout user={user}><Dashboard data={data} setModal={setModal} /></AppLayout> : <Navigate to="/login" />} />
                <Route path="/accounts" element={user ? (
                    <AppLayout user={user}>
                        <TransactionList data={data} setData={setData} user={user} setViewDetail={setViewDetail} setModal={setModal} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />
                <Route path="/tasks" element={user ? (
                    <AppLayout user={user}>
                        <TaskModule data={data} setData={setData} user={user} setViewDetail={setViewDetail} setModal={setModal} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />
                <Route path="/vault" element={user ? (
                    <AppLayout user={user}>
                        <PersonalDashboard data={data} setData={setData} setViewDetail={setViewDetail} setModal={setModal} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />
                <Route path="/masters" element={user?.role === 'admin' ? (
                    <AppLayout user={user}>
                        <MasterModule data={data} setData={setData} setModal={setModal} setViewDetail={setViewDetail} />
                    </AppLayout>
                ) : <Navigate to="/" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;