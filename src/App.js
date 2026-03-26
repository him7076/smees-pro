import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './services/firebase';
import { useFirebaseSync } from './hooks/useFirebaseSync';

// Pages & Components
import LoginScreen from './components/auth/LoginScreen';
import AppLayout from './components/layout/AppLayout';
import TransactionList from './components/accounting/TransactionList';
import TaskModule from './components/tasks/TaskModule';
import PersonalDashboard from './components/personal/PersonalDashboard';
import ReportModal from './components/reports/ReportModal';

// Placeholder for missing components (temporarily)
const Dashboard = ({ data }) => (
  <div className="space-y-8 animate-in fade-in duration-700">
    <div className="flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h1>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-2 ml-1">Live Intelligence & Growth Metrics</p>
        </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
            { label: 'Active Pipeline', value: data.tasks.filter(t => t.status !== 'Done').length, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
            { label: 'Pending Receivables', value: '₹0.00', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Open Issues', value: 0, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' }
        ].map((card, i) => (
            <div key={i} className={`p-8 rounded-[40px] border shadow-sm ${card.bg} hover:shadow-xl transition-all group cursor-pointer active:scale-95`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-slate-600">{card.label}</p>
                <h3 className={`text-4xl font-black ${card.color} tracking-tighter`}>{card.value}</h3>
            </div>
        ))}
    </div>

    <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm min-h-[400px] flex flex-col items-center justify-center opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Main Analytics Loading...</p>
    </div>
  </div>
);

const App = () => {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { data, setData, loading: dataLoading } = useFirebaseSync();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                // Determine role (simplified for demo)
                setUser({ 
                    uid: authUser.uid, 
                    email: authUser.email, 
                    role: authUser.email?.includes('admin') ? 'admin' : 'staff' 
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
            <Routes>
                <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to="/" />} />
                
                <Route path="/" element={user ? <AppLayout user={user}><Dashboard data={data} /></AppLayout> : <Navigate to="/login" />} />
                
                <Route path="/accounts" element={user ? (
                    <AppLayout user={user}>
                        <TransactionList data={data} user={user} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />

                <Route path="/tasks" element={user ? (
                    <AppLayout user={user}>
                        <TaskModule data={data} user={user} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />

                <Route path="/vault" element={user ? (
                    <AppLayout user={user}>
                        <PersonalDashboard data={data} setData={setData} onClose={() => {}} />
                    </AppLayout>
                ) : <Navigate to="/login" />} />

                <Route path="/masters" element={user?.role === 'admin' ? (
                    <AppLayout user={user}>
                        <div className="p-20 text-center opacity-20">
                            <h2 className="text-3xl font-black uppercase tracking-widest">Master Data Module</h2>
                            <p className="mt-4">Migrating legacy masters structure...</p>
                        </div>
                    </AppLayout>
                ) : <Navigate to="/" />} />

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;