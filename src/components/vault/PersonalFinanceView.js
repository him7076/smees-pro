import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, TrendingUp, TrendingDown, 
  RefreshCcw, Calendar, History, Trash2, Edit2, ChevronRight, 
  Banknote, Plus, ShoppingCart, Users, CreditCard, Wallet,
  PieChart as PieIcon, Layout, MoreVertical, Target, Share2,
  Landmark, CreditCard as CardIcon
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    
    // Legacy Views: 'transactions', 'accounts', 'stats'
    const [financeView, setFinanceView] = useState('transactions'); 
    const [selectedAccountForTx, setSelectedAccountForTx] = useState(null);
    const [search, setSearch] = useState('');

    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [{ id: 'cash', name: 'Cash', group: 'Cash', initialBalance: 0 }];

    // Calculations - Legacy Parity
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
            groups[gName].push({ ...a, balance: bals[a.name] || 0 });
            total += (bals[a.name] || 0);
        });
        return { accountGroups: groups, totalBalance: total };
    }, [transactions, accounts]);

    const filtered = useMemo(() => {
        return transactions.filter(t => {
            const searchTerm = (t.category || '').toLowerCase() + (t.subCategory || '').toLowerCase() + (t.note || '').toLowerCase() + (t.account || '').toLowerCase();
            if (search && !searchTerm.includes(search.toLowerCase())) return false;
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, search]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-500 scrollbar-hide flex flex-col">
            {/* STICKY HEADER - LEGACY MATCH */}
            <div className="bg-slate-900 text-white pt-14 pb-0 px-4 shadow-lg shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ArrowLeft size={18}/></button>
                        <h2 className="text-xl font-bold flex items-center gap-2">🔐 My Vault</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setModal({ type: 'personalFinance' })} className="p-2.5 bg-blue-600 rounded-full shadow-lg active:scale-95"><Plus size={20}/></button>
                    </div>
                </div>
                <div className="flex">
                    <button onClick={() => setFinanceView('transactions')} className={`flex-1 py-3 font-bold border-b-4 ${financeView === 'transactions' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}>LEGDERS</button>
                    <button onClick={() => { setFinanceView('accounts'); setSelectedAccountForTx(null); }} className={`flex-1 py-3 font-bold border-b-4 ${financeView === 'accounts' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400'}`}>WALLETS</button>
                    <button onClick={() => setFinanceView('stats')} className={`flex-1 py-3 font-bold border-b-4 ${financeView === 'stats' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400'}`}>ANALYSIS</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
                {/* 1. TRANSACTIONS VIEW */}
                {financeView === 'transactions' && (
                    <div className="space-y-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                            <input className="w-full pl-11 pr-4 py-4 bg-white border border-slate-100 rounded-[24px] text-xs font-bold shadow-sm outline-none" placeholder="Search categories, notes or accounts..." value={search} onChange={e => setSearch(e.target.value)}/>
                        </div>
                        <div className="space-y-3">
                            {filtered.map((t, idx) => (
                                <div key={idx} onClick={() => setModal({ type: 'personalFinance', data: t })} className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {t.type === 'income' ? <TrendingUp size={18}/> : t.type === 'expense' ? <ShoppingCart size={18}/> : <RefreshCcw size={18}/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-slate-900 flex items-center gap-1.5 uppercase tracking-tight">
                                                {t.category || t.note || 'Transfer'} 
                                                {t.subCategory && <span className="text-[9px] bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-slate-400 font-bold tracking-widest">{t.subCategory}</span>}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <Wallet size={10} className="text-blue-400"/> {t.account} {t.toAccount ? `➦ ${t.toAccount}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-base font-black tracking-tighter ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </p>
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{formatDate(t.date)}</p>
                                    </div>
                                </div>
                            ))}
                            {filtered.length === 0 && <div className="py-20 text-center opacity-30"><History size={48} className="mx-auto mb-4"/><p className="text-[10px] font-black uppercase tracking-[0.3em]">No Secure Records</p></div>}
                        </div>
                    </div>
                )}

                {/* 2. ACCOUNTS / WALLETS VIEW */}
                {financeView === 'accounts' && !selectedAccountForTx && (
                    <div className="space-y-6">
                        <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-4 shadow-xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Aggregate Liquidity</p>
                            <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalBalance)}</h2>
                            <div className="flex gap-4">
                                <div className="px-4 py-2 bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp size={10} className="text-emerald-400"/> Active Assets
                                </div>
                            </div>
                        </div>
                        {Object.entries(accountGroups).map(([group, accs]) => (
                            <div key={group} className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">{group} Collection</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {accs.map(acc => (
                                        <div key={acc.name} onClick={() => setSelectedAccountForTx(acc)} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex justify-between items-center group active:scale-95 transition-all cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    {acc.type === 'Bank' ? <Landmark size={20}/> : acc.type === 'Card' ? <CardIcon size={20}/> : <Banknote size={20}/>}
                                                </div>
                                                <span className="font-black text-sm text-slate-800 uppercase tracking-tight">{acc.name}</span>
                                            </div>
                                            <span className={`text-base font-black tracking-tighter ${acc.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(acc.balance)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. ACCOUNT LEDGER VIEW (LEGACY) */}
                {financeView === 'accounts' && selectedAccountForTx && (
                    <div className="space-y-4 animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between bg-white p-4 rounded-[32px] shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedAccountForTx(null)} className="p-2 bg-slate-50 text-slate-400 rounded-full"><ArrowLeft size={18}/></button>
                                <div>
                                    <h2 className="font-black text-slate-900 text-sm uppercase tracking-tight">{selectedAccountForTx.name}</h2>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Statement</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-black text-sm ${selectedAccountForTx.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(selectedAccountForTx.balance)}</p>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Balance</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {transactions.filter(t => t.account === selectedAccountForTx.name || t.toAccount === selectedAccountForTx.name).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(tx => {
                                const isIncoming = (tx.type === 'income' && tx.account === selectedAccountForTx.name) || (tx.type === 'transfer' && tx.toAccount === selectedAccountForTx.name);
                                return (
                                <div key={tx.id} onClick={() => setModal({ type: 'personalFinance', data: tx })} className="p-4 bg-white rounded-[28px] border border-slate-100 flex justify-between items-center shadow-sm cursor-pointer active:scale-95 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isIncoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {isIncoming ? <TrendingUp size={16} /> : <ShoppingCart size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-slate-800 uppercase tracking-tight">{tx.category || tx.note || 'Transfer'}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDate(tx.date)} {tx.note ? `• ${tx.note}` : ''}</p>
                                        </div>
                                    </div>
                                    <span className={`font-black text-sm tracking-tighter ${isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </span>
                                </div>
                            )})}
                        </div>
                    </div>
                )}

                {/* 4. STATS VIEW (Placeholder for legacy style) */}
                {financeView === 'stats' && (
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Strategic Analysis</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Financial Intel</h3>
                            </div>
                            <PieIcon size={40} className="text-slate-100"/>
                        </div>
                        <div className="py-20 text-center opacity-30">
                            <Target size={48} className="mx-auto mb-4"/>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Intelligence Pending</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalFinanceView;
