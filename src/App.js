import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './services/firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { usePushNotifications } from './hooks/usePushNotifications';
import { checkPermission, formatCurrency, getPartyBalances, getItemStock, getBillStats, getFilteredAttendance, getTransactionTotals } from './utils/helpers';
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from './services/firebase';
import { Plus, TrendingUp, FileText, FileMinus, FileCheck, RefreshCw, X, ChevronRight } from 'lucide-react';

// Layout & Auth
import LoginScreen from './components/auth/LoginScreen';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/layout/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

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
import PersonalAccountForm from './components/vault/PersonalAccountForm';

// Views
import PersonalFinanceView from './components/vault/PersonalFinanceView';
import PersonalTasksView from './components/vault/PersonalTasksView';
import PersonalSettingsView from './components/vault/PersonalSettingsView';
import TransactionDetailView from './components/accounting/TransactionDetailView';
import TaskDetailView from './components/tasks/TaskDetailView';
import ItemDetailView from './components/masters/ItemDetailView';
import PartyProfileView from './components/masters/PartyProfileView';
import StaffDetailView from './components/staff/StaffDetailView';
import AssetDetailView from './components/masters/AssetDetailView';
import BackupRestore from './components/layout/BackupRestore';
import SystemMenu from './components/layout/SystemMenu';
import TaskSettings from './components/tasks/TaskSettings';
import CloseFYModal from './components/layout/CloseFYModal';


const App = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { data, setData, syncing, syncData, loading: dataLoading } = useFirebaseSync();

    // Initialize Push Notifications
    usePushNotifications(user);

    const [uiConfig, setUiConfig] = useState(() => {
        const saved = localStorage.getItem('smees_ui_config');
        return saved ? JSON.parse(saved) : { isCompact: false };
    });

    useEffect(() => {
        localStorage.setItem('smees_ui_config', JSON.stringify(uiConfig));
    }, [uiConfig]);

    const [mode, setMode] = useState('business');
    const [bizState, setBizState] = useState({ 
        modal: null, 
        viewDetail: null, 
        history: [], 
        lastPath: '/' 
    });
    const [persState, setPersState] = useState({ 
        modal: null, 
        viewDetail: null, 
        history: [], 
        lastPath: '/' 
    });

    const activeState = mode === 'business' ? bizState : persState;
    const setActiveState = mode === 'business' ? setBizState : setPersState;

    const modal = activeState.modal;
    const setModal = (m) => setActiveState(prev => ({ ...prev, modal: m }));
    const viewDetail = activeState.viewDetail;

    const setViewDetail = (v) => setActiveState(prev => {
        if (!v) {
            // BACK logic: pop from history
            const nextHistory = [...(prev.history || [])];
            const lastView = nextHistory.pop();
            return { ...prev, viewDetail: lastView || null, history: nextHistory };
        }
        
        // FORWARD logic: push current to history if it exists
        const nextHistory = [...(prev.history || [])];
        if (prev.viewDetail) {
            // Don't push if same as current (prevent loops)
            if (JSON.stringify(prev.viewDetail) !== JSON.stringify(v)) {
                nextHistory.push(prev.viewDetail);
            }
        }
        return { ...prev, viewDetail: v, history: nextHistory };
    });

    // Track path changes per mode
    useEffect(() => {
        const path = window.location.pathname;
        if (mode === 'business') {
            setBizState(p => ({ ...p, lastPath: path }));
        } else {
            setPersState(p => ({ ...p, lastPath: path }));
        }
    }, [window.location.pathname, mode]);

    const handleToggleMode = (newMode) => {
        if (newMode === mode) return;
        const targetState = newMode === 'business' ? bizState : persState;
        setMode(newMode);
        navigate(targetState.lastPath || '/');
    };

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
            if (!task) return;

            // Capture Location if available
            let location = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
                    location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                } catch (e) {
                    console.log("Location skipped or failed", e);
                }
            }

            const now = new Date().toISOString();
            let newLogs = [...(task.timeLogs || [])];
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

            if (activeLogIndex > -1) {
                const duration = (new Date(now) - new Date(newLogs[activeLogIndex].start)) / 60000;
                newLogs[activeLogIndex] = { 
                    ...newLogs[activeLogIndex], 
                    end: now, 
                    duration: duration.toFixed(2),
                    endLocation: location 
                };
            } else {
                newLogs.push({ 
                    staffId, 
                    start: now, 
                    end: null, 
                    staffName: data.staff.find(s=>s.id===staffId)?.name || 'Unknown',
                    startLocation: location,
                    location: location
                });
            }

            const updatedTask = { ...task, timeLogs: newLogs, updatedAt: now };
            if (location && !updatedTask.location) {
                updatedTask.location = location;
            }

            setData(prev => ({
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
            }));

            await setDoc(doc(db, "tasks", taskId.toString()), updatedTask, { merge: true });
        } catch (e) {
            console.error("Timer Toggle Failed:", e);
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
        <ErrorBoundary>
        <React.Fragment>
            <div className="app-engine-root">
                {modal && (
                    <div className="fixed inset-0 z-[140] bg-white md:bg-slate-900/50 md:backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
                        <div className="bg-white w-full md:max-w-4xl h-full md:max-h-[90vh] md:rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-[150]">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{modal.type === 'personalTransaction' ? 'Transaction' : modal.type === 'personalAccount' ? 'Account' : modal.type} {modal.data ? '(Edit)' : 'Form'}</h3>
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
                                {modal.type === 'backup' && <BackupRestore data={data} setData={setData} onClose={() => setModal(null)} />}
                                {modal.type === 'systemMenu' && <SystemMenu setModal={setModal} onClose={() => setModal(null)} />}
                                {modal.type === 'taskSettings' && <TaskSettings data={data} setData={setData} onClose={() => setModal(null)} />}
                                {modal.type === 'dashboard_drilldown' && (
                                    <div className="space-y-4">
                                        <div className="flex bg-slate-900 md:px-6 px-4 py-8 rounded-[40px] justify-between items-center mb-6 shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 border border-white/5"><TrendingUp size={20}/></div>
                                                <div>
                                                    <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] leading-none mb-1">Intelligence Insights</p>
                                                    <h4 className="text-sm font-black text-white tracking-tighter uppercase">{modal.filter === 'profit' ? 'Yield Analysis' : modal.filter} Dashboard</h4>
                                                </div>
                                            </div>
                                            <div className="text-right relative z-10">
                                                 <p className="text-[14px] font-black text-blue-400 tracking-tighter">
                                                    {formatCurrency(modal.filter === 'profit' 
                                                        ? modal.items.reduce((sum, t) => {
                                                            const sTot = getTransactionTotals(t);
                                                            let sProfit = 0;
                                                            (t.items || []).forEach(i => {
                                                                const master = data.items.find(mi => mi.id === i.itemId);
                                                                const buy = parseFloat(i.buyPrice || master?.buyPrice || 0);
                                                                const sell = parseFloat(i.price || 0);
                                                                sProfit += (sell - buy) * parseFloat(i.qty || 1);
                                                            });
                                                            return sum + (sProfit - parseFloat(t.discountValue || 0));
                                                        }, 0)
                                                        : modal.items.reduce((sum, t) => sum + getTransactionTotals(t)[modal.filter === 'expense' ? 'amount' : 'final'], 0)
                                                    )}
                                                </p>
                                                <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mt-1">Net Aggregation</p>
                                            </div>
                                        </div>
                                        {modal.filter === 'expense' && !modal.selectedCategory && (
                                            <div className="grid grid-cols-1 gap-3 md:px-4">
                                                <div 
                                                    onClick={() => setModal({...modal, selectedCategory: 'ALL'})}
                                                    className="p-5 bg-slate-900 text-white rounded-[24px] flex justify-between items-center cursor-pointer active:scale-95 transition-all shadow-xl shadow-slate-200"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center"><Plus size={16}/></div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest">All Core Transactions</p>
                                                    </div>
                                                    <ChevronRight size={18} className="text-white/20"/>
                                                </div>
                                                
                                                {/* Group by Category */}
                                                {Object.entries(modal.items.reduce((acc, t) => {
                                                    const cat = t.category || 'Uncategorized';
                                                    acc[cat] = (acc[cat] || 0) + parseFloat(t.amount || t.finalTotal || 0);
                                                    return acc;
                                                }, {})).sort((a,b) => b[1] - a[1]).map(([cat, val]) => (
                                                    <div 
                                                        key={cat}
                                                        onClick={() => setModal({...modal, selectedCategory: cat})}
                                                        className="p-5 bg-white border border-slate-100 rounded-[24px] flex justify-between items-center cursor-pointer hover:bg-slate-50 active:scale-95 transition-all"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] uppercase">{cat[0]}</div>
                                                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">{cat}</p>
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(val)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
    
                                        {/* Filtered List (or Sales/Profit List) */}
                                        {(modal.filter !== 'expense' || modal.selectedCategory) && (
                                            <div className="space-y-4">
                                                {modal.filter === 'expense' && (
                                                    <div className="px-6 flex items-center justify-between mb-2">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Filtering: {modal.selectedCategory}</p>
                                                        <button onClick={() => setModal({...modal, selectedCategory: null})} className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Back to Categories</button>
                                                    </div>
                                                )}
                                                
                                                {modal.items
                                                .filter(t => !modal.selectedCategory || modal.selectedCategory === 'ALL' || t.category === modal.selectedCategory)
                                                .map(t => {
                                                    let serviceP = 0, goodsP = 0;
                                                    (t.items || []).forEach(item => {
                                                        const master = data.items.find(i => i.id === item.itemId);
                                                        const type = master?.type || 'Goods';
                                                        const buy = parseFloat(item.buyPrice || item.purchasePrice || master?.buyPrice || 0);
                                                        const sell = parseFloat(item.price || 0);
                                                        const qty = parseFloat(item.qty || 0);
                                                        const profit = (sell - buy) * qty;
                                                        if (type === 'Service' || (item.itemName||'').toLowerCase().includes('service')) serviceP += profit;
                                                        else goodsP += profit;
                                                    });
                                                    const netP = serviceP + goodsP - parseFloat(t.discountValue || 0);
    
                                                    return (
                                                        <div key={t.id} onClick={() => { setModal(null); setViewDetail({ type: 'transaction', id: t.id }); }} className="p-4 bg-white border border-slate-100 rounded-[32px] hover:bg-slate-50 transition-all cursor-pointer group active:scale-[0.98] shadow-sm">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all"><FileText size={16}/></div>
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">{data.parties.find(p=>p.id===t.partyId)?.name || t.category || 'Direct Cash'}</p>
                                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">#{t.id} • {t.date}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-black text-slate-900 tracking-tighter">{formatCurrency(t.finalTotal || t.amount || 0)}</p>
                                                                    <div className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full mt-1 inline-block ${t.type === 'sales' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t.type}</div>
                                                                </div>
                                                            </div>
    
                                                            {modal.filter === 'profit' && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100/50 flex justify-between items-center">
                                                                    <div className="flex gap-2">
                                                                        <span className="text-[7px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">MAT {formatCurrency(goodsP)}</span>
                                                                        <span className="text-[7px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">SER {formatCurrency(serviceP)}</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-emerald-600 tracking-tighter">Yield: {formatCurrency(netP)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
    
                                        {modal.items.length === 0 && (
                                            <div className="py-24 flex flex-col items-center justify-center opacity-30 grayscale scale-90">
                                                <TrendingUp size={48} className="text-slate-300 mb-4"/>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">No Operational Trajectories Found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
    
                                {modal.type === 'personalTransaction' && <PersonalFinanceForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} intent={modal.intent} />}
                                {modal.type === 'personalAccount' && <PersonalAccountForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                                {modal.type === 'personalFinance' && <PersonalFinanceView data={data} setData={setData} onBack={() => setViewDetail(null)} accountId={viewDetail?.accountId} setModal={setModal} />}
                                {modal.type === 'task' && <TaskForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} context={modal.context} />}
                                {modal.type === 'convertTask' && <ConvertTaskModal task={modal.data} data={data} setData={setData} onClose={() => setModal(null)} />}
                                {modal.type === 'closeFY' && <CloseFYModal data={data} setData={setData} onClose={() => setModal(null)} />}
                                {modal.type === 'asset' && <AssetForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                                {modal.type === 'financial_book' && (
                                    <div className="h-full">
                                        <TransactionList 
                                            data={data} 
                                            setData={setData} 
                                            user={user} 
                                            setViewDetail={(v) => { setModal(null); setViewDetail(v); }} 
                                            setModal={setModal} 
                                            listPaymentMode={true} 
                                            listFilter="all"
                                        />
                                    </div>
                                )}
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
                                workLogs={data.workLogs?.filter(w => w.staffId === viewDetail.id) || []}
                            />
                        )}

                        {viewDetail.type === 'asset' && (
                            <AssetDetailView 
                                data={data}
                                setData={setData}
                                asset={viewDetail.data.asset}
                                party={viewDetail.data.party}
                                onClose={() => setViewDetail(null)}
                                setModal={setModal}
                                setViewDetail={setViewDetail}
                            />
                        )}
                    </div>
                )}
    
                <Routes>
                    <Route path="/login" element={!user ? <LoginScreen setUser={setUser} /> : <Navigate to="/" />} />
                    <Route path="/" element={user ? (
                        <AppLayout user={user} uiConfig={uiConfig} onToggleCompact={() => setUiConfig(p=>({...p, isCompact: !p.isCompact}))} mode={mode} onToggleMode={handleToggleMode} syncing={syncing} onSync={syncData} setModal={setModal}>
                            {mode === 'business' ? <Dashboard data={data} setModal={setModal} setViewDetail={setViewDetail} /> : <PersonalDashboard data={data} setData={setData} setViewDetail={setViewDetail} setModal={setModal} />}
                        </AppLayout>
                    ) : <Navigate to="/login" />} />
                    <Route path="/accounts" element={user ? (
                        <AppLayout user={user} uiConfig={uiConfig} onToggleCompact={() => setUiConfig(p=>({...p, isCompact: !p.isCompact}))} mode={mode} onToggleMode={handleToggleMode} syncing={syncing} onSync={syncData} setModal={setModal}>
                            {mode === 'business' ? <TransactionList data={data} setData={setData} user={user} setViewDetail={setViewDetail} setModal={setModal} /> : <PersonalDashboard data={data} setData={setData} setViewDetail={setViewDetail} setModal={setModal} />}
                        </AppLayout>
                    ) : <Navigate to="/login" />} />
                    <Route path="/tasks" element={user ? (
                        <AppLayout user={user} uiConfig={uiConfig} onToggleCompact={() => setUiConfig(p=>({...p, isCompact: !p.isCompact}))} mode={mode} onToggleMode={handleToggleMode} syncing={syncing} onSync={syncData} setModal={setModal}>
                            {mode === 'business' ? <TaskModule data={data} setData={setData} user={user} setViewDetail={setViewDetail} setModal={setModal} /> : <PersonalTasksView data={data} setData={setData} onBack={() => navigate('/')} setModal={setModal} />}
                        </AppLayout>
                    ) : <Navigate to="/login" />} />
                    <Route path="/settings" element={user ? (
                        <AppLayout user={user} uiConfig={uiConfig} onToggleCompact={() => setUiConfig(p=>({...p, isCompact: !p.isCompact}))} mode={mode} onToggleMode={handleToggleMode} syncing={syncing} onSync={syncData} setModal={setModal}>
                            <PersonalSettingsView data={data} setData={setData} setModal={setModal} onBack={() => navigate('/')} />
                        </AppLayout>
                    ) : <Navigate to="/login" />} />
                    <Route path="/masters" element={user?.role === 'admin' ? (
                        <AppLayout user={user} uiConfig={uiConfig} onToggleCompact={() => setUiConfig(p=>({...p, isCompact: !p.isCompact}))} mode={mode} onToggleMode={handleToggleMode} syncing={syncing} onSync={syncData} setModal={setModal}>
                            <MasterModule data={data} setData={setData} setModal={setModal} setViewDetail={setViewDetail} />
                        </AppLayout>
                    ) : <Navigate to="/" />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </React.Fragment>
        </ErrorBoundary>
    );
};

export default App;