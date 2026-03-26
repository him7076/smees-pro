import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './services/firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { checkPermission, formatCurrency } from './utils/helpers';

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
import TaskForm from './components/tasks/TaskForm'; // Added TaskForm import

// Views
import PersonalFinanceView from './components/vault/PersonalFinanceView';
import PersonalTasksView from './components/vault/PersonalTasksView';

const Dashboard = ({ data, setModal }) => {
    const stats = useMemo(() => {
        let receivables = 0, payables = 0;
        // Simple balance calculation (Real app would use getPartyBalances)
        data.parties.forEach(p => {
            const bal = parseFloat(p.openingBal || 0);
            if (p.type === 'DR') receivables += bal;
            else payables += bal;
        });

        const activeTasks = data.tasks.filter(t => t.status !== 'Done' && t.status !== 'Converted').length;
        const todaySales = data.transactions
            .filter(t => t.type === 'sales' && t.date === new Date().toISOString().split('T')[0])
            .reduce((acc, t) => acc + parseFloat(t.finalTotal || 0), 0);

        return { receivables, payables, activeTasks, todaySales };
    }, [data]);

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h1>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-2 ml-1">Live Intelligence & Growth Metrics</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setModal({ type: 'sales' })} className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">+ Quick Sale</button>
                    <button onClick={() => setModal({ type: 'task' })} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all">+ Dispatch</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Pipeline', value: stats.activeTasks, sub: 'Work Orders', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
                    { label: 'Receivables', value: formatCurrency(stats.receivables), sub: 'To Collect', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                    { label: 'Payables', value: formatCurrency(stats.payables), sub: 'To Pay', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
                    { label: 'Today\'s Revenue', value: formatCurrency(stats.todaySales), sub: 'Gross Sales', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' }
                ].map((card, i) => (
                    <div key={i} className={`p-8 rounded-[40px] border shadow-sm ${card.bg} hover:shadow-2xl transition-all group cursor-pointer active:scale-95 relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-slate-600 relative z-10">{card.label}</p>
                        <h3 className={`text-3xl font-black ${card.color} tracking-tighter relative z-10`}>{card.value}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 relative z-10">{card.sub}</p>
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
                <div className="bg-slate-900 p-10 rounded-[48px] shadow-2xl space-y-6 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/5 pb-4">System Alerts</h4>
                    <div className="space-y-4 relative z-10">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Synchronized with Vercel Edge Server</p>
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Dual Firebase Instances Connected</p>
                        </div>
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

    // UI States
    const [modal, setModal] = useState(null); // { type: 'party', data: null }
    const [viewDetail, setViewDetail] = useState(null); // { type: 'party', id: 'P01' }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                // In production, fetch staff role/permissions from Firestore
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
            {/* Global Modal Layer */}
            {modal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-t-[48px] md:rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 h-full md:h-auto">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{modal.type} Editor</h3>
                            <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">Close</button>
                        </div>
                        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {modal.type === 'party' && <PartyForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'item' && <ItemForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'staff' && <StaffForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {['sales', 'purchase', 'expense', 'payment', 'estimate'].includes(modal.type) && (
                                <TransactionForm data={data} setData={setData} type={modal.type} record={modal.data} onClose={() => setModal(null)} />
                            )}
                            {modal.type === 'task' && <TaskForm data={data} setData={setData} record={modal.data} onClose={() => setModal(null)} />}
                            {modal.type === 'convertTask' && <ConvertTaskModal task={modal.data} data={data} setData={setData} onClose={() => setModal(null)} />}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Detail View Layer */}
            {viewDetail && (
                <div className="fixed inset-0 z-[90] bg-white overflow-hidden">
                    {/* Components will render full-screen inside here with their own Back button */}
                    {viewDetail.type === 'personalFinance' && <PersonalFinanceView data={data} setData={setData} onBack={() => setViewDetail(null)} accountId={viewDetail.accountId} />}
                    {viewDetail.type === 'personalTasks' && <PersonalTasksView data={data} setData={setData} onBack={() => setViewDetail(null)} />}
                    {/* Other detailed views like PartyProfile or TransactionDetail can go here */}
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