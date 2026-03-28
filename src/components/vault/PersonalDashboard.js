import React, { useState, useMemo } from 'react';
import { 
  Lock, Wallet, TrendingUp, TrendingDown, RefreshCcw, 
  CheckSquare, Plus, ChevronRight, PieChart as PieIcon, 
  History, Landmark, CreditCard as CardIcon, Banknote
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const PersonalDashboard = ({ data, setData, setViewDetail, setModal }) => {
    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];
    const tasks = data.personalTasks || [];

    // 1. Calculations
    const stats = useMemo(() => {
        let monthIncome = 0, monthExpense = 0;
        let totalIncome = 0, totalExpense = 0;
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        // Account balances
        const accBals = {};
        accounts.forEach(a => accBals[a.name || a.id] = parseFloat(a.initialBalance || 0));

        transactions.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            const d = new Date(t.date);
            const accountKey = t.account || t.accountId;

            if (t.type === 'income') {
                totalIncome += amt;
                if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) monthIncome += amt;
                if (accountKey) accBals[accountKey] = (accBals[accountKey] || 0) + amt;
            } else if (t.type === 'expense') {
                totalExpense += amt;
                if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) monthExpense += amt;
                if (accountKey) accBals[accountKey] = (accBals[accountKey] || 0) - amt;
            } else if (t.type === 'transfer') {
                const fromKey = t.account || t.fromAccountId;
                const toKey = t.toAccount || t.toAccountId;
                if (fromKey) accBals[fromKey] = (accBals[fromKey] || 0) - amt;
                if (toKey) accBals[toKey] = (accBals[toKey] || 0) + amt;
            }
        });

        const totalBalance = Object.values(accBals).reduce((a, b) => a + b, 0);

        return { monthIncome, monthExpense, totalIncome, totalExpense, totalBalance, accBals };
    }, [transactions, accounts]);

    // 2. SVG Pie Chart Logic
    const Chart = ({ income, expense }) => {
        const total = (income + expense) || 1;
        const incP = (income / total) * 100;
        const expP = (expense / total) * 100;
        
        // Simple 2-segment pie
        const dashInc = `${incP} ${100 - incP}`;
        const dashExp = `${expP} ${100 - expP}`;

        return (
            <div className="relative w-28 h-28 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f1f5f9" strokeWidth="4"/>
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={dashInc} strokeDashoffset="0"/>
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f43f5e" strokeWidth="4" strokeDasharray={dashExp} strokeDashoffset={-incP}/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <PieIcon size={14} className="text-slate-300 mb-0.5"/>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Flow</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-32 px-1">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/20">
                        <Lock className="text-white" size={20}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">My Vault</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck size={10} className="text-emerald-500"/> Personal & Discrete</p>
                    </div>
                </div>
            </div>

            {/* Premium Cash Flow Card */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-1 space-y-4 text-center md:text-left">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Total Net Worth</p>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.totalBalance)}</h2>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="bg-emerald-50 px-6 py-4 rounded-[28px] border border-emerald-100/50 flex flex-col items-center md:items-start group-hover:scale-105 transition-transform">
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><TrendingUp size={10}/> Total Income</span>
                                <span className="text-lg font-black text-emerald-900">{formatCurrency(stats.totalIncome)}</span>
                                <span className="text-[8px] font-black text-emerald-400 uppercase mt-1">₹{stats.monthIncome} This Month</span>
                            </div>
                            <div className="bg-rose-50 px-6 py-4 rounded-[28px] border border-rose-100/50 flex flex-col items-center md:items-start group-hover:scale-105 transition-transform">
                                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><TrendingDown size={10}/> Total Expense</span>
                                <span className="text-lg font-black text-rose-900">{formatCurrency(stats.totalExpense)}</span>
                                <span className="text-[8px] font-black text-rose-400 uppercase mt-1">₹{stats.monthExpense} This Month</span>
                            </div>
                        </div>
                    </div>
                    <Chart income={stats.totalIncome} expense={stats.totalExpense}/>
                </div>
            </div>

            {/* Account Grid */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Accounts & Ledgers</h3>
                    <button onClick={() => setModal({ type: 'personalAccount' })} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">+ Create Account</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {accounts.map(acc => (
                        <div key={acc.id} onClick={() => setViewDetail({ type: 'personalFinance', accountId: acc.id })} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group active:scale-95">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-colors ${acc.type === 'Bank' ? 'bg-indigo-50 text-indigo-600' : acc.type === 'Card' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {acc.type === 'Bank' ? <Landmark size={20}/> : acc.type === 'Card' ? <CardIcon size={20}/> : <Banknote size={20}/>}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight mb-1">{acc.name}</p>
                            <p className="text-lg font-black text-slate-900 truncate">{formatCurrency(stats.accBals[acc.name] || stats.accBals[acc.id] || 0)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Personal Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-slate-900 rounded-[48px] shadow-2xl shadow-slate-900/40 space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/20 transition-all duration-700"></div>
                    <div>
                        <h4 className="text-xl font-black text-white tracking-tight mb-1">Financial Operations</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Internal Ledger Sync</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setModal({ type: 'personalTransaction' })} className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all flex flex-col items-center gap-3 active:scale-90">
                            <Plus className="text-white" size={24}/>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Entry</span>
                        </button>
                        <button onClick={() => setModal({ type: 'personalTransfer' })} className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all flex flex-col items-center gap-3 active:scale-90">
                            <RefreshCcw className="text-blue-400" size={24}/>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Transfer</span>
                        </button>
                    </div>
                    <button onClick={() => setViewDetail({ type: 'personalFinance' })} className="w-full flex justify-between items-center p-6 bg-blue-600 rounded-[32px] font-black text-white text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-[1.02] transition-all">
                        Complete Ledger History
                        <History size={18}/>
                    </button>
                </div>

                <div className="p-8 bg-slate-50 border border-slate-100 rounded-[48px] space-y-8 group">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight mb-1">Personal Tasks</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Private Productivity</p>
                        </div>
                        <CheckSquare className="text-slate-200 group-hover:text-blue-200 transition-colors" size={40}/>
                    </div>
                    <div className="space-y-3">
                        {tasks.slice(0, 3).map(task => (
                            <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}></div>
                                    <span className={`text-xs font-bold ${task.status === 'Done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.name}</span>
                                </div>
                                <ChevronRight size={14} className="text-slate-300"/>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="py-8 text-center bg-white/50 border border-dashed border-slate-200 rounded-3xl">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Hidden Tasks</p>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setViewDetail({ type: 'personalTasks' })} className="w-full py-5 bg-white border border-slate-200 rounded-[32px] font-black text-slate-700 text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-sm">
                        Manage Private Backlog
                        <ChevronRight size={14}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Dummy ShieldCheck icon since lucide-react might not have it or I missed it
const ShieldCheck = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
);

export default PersonalDashboard;
