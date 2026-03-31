import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, TrendingUp,
  RefreshCcw, Plus, ShoppingCart, Wallet,
  Landmark, CreditCard as CardIcon, Download, Filter
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalFinanceView = ({ data, setData, onBack, setModal, accountId }) => {
    const { deleteRecord } = useDatabase(data, setData);
    
    const [financeView, setFinanceView] = useState(accountId ? 'accounts' : 'transactions'); 
    const [selectedAccountForTx, setSelectedAccountForTx] = useState(accountId ? (data.personalAccounts?.find(a => a.name === accountId) || null) : null);
    const [search, setSearch] = useState('');
    const [statsTab, setStatsTab] = useState('expense');

    const [filterType, setFilterType] = useState('Monthly');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustom, setFilterCustom] = useState({ start: '', end: '' });

    const transactions = data.personalTransactions || [];
    const accounts = data.personalAccounts || [];

    const filteredByDuration = useMemo(() => {
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            if (filterType === 'Weekly') {
                const now = new Date();
                const diff = now.getDate() - now.getDay();
                const startOfWeek = new Date(now.setDate(diff));
                startOfWeek.setHours(0,0,0,0);
                return tDate >= startOfWeek;
            }
            if (filterType === 'Monthly') {
                const [year, month] = filterDate.split('-');
                return tDate.getMonth() === (parseInt(month) - 1) && tDate.getFullYear() === parseInt(year);
            }
            if (filterType === 'Yearly') {
                const year = filterDate.split('-')[0];
                return tDate.getFullYear() === parseInt(year);
            }
            if (filterType === 'Specific Date') {
                return t.date === filterDate;
            }
            if (filterType === 'Custom Range' && filterCustom.start && filterCustom.end) {
                return t.date >= filterCustom.start && t.date <= filterCustom.end;
            }
            return true;
        });
    }, [transactions, filterType, filterDate, filterCustom]);

    const filtered = useMemo(() => {
        return filteredByDuration.filter(t => {
            if (selectedAccountForTx && t.account !== selectedAccountForTx.name && t.toAccount !== selectedAccountForTx.name) return false;
            const searchTerm = (t.category || '').toLowerCase() + (t.subCategory || '').toLowerCase() + (t.note || '').toLowerCase() + (t.account || '').toLowerCase();
            if (search && !searchTerm.includes(search.toLowerCase())) return false;
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredByDuration, search]);

    const { accountGroups, totalBalance, incomeTotal, expenseTotal } = useMemo(() => {
        const groups = {}; 
        const bals = {};
        let total = 0, inc = 0, exp = 0;
        
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

        filteredByDuration.forEach(t => {
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') inc += amt;
            else if (t.type === 'expense') exp += amt;
        });

        accounts.forEach(a => {
            const gName = a.group || 'General';
            groups[gName].push({ ...a, balance: bals[a.name] || 0 });
            total += (bals[a.name] || 0);
        });
        return { accountGroups: groups, totalBalance: total, incomeTotal: inc, expenseTotal: exp };
    }, [transactions, accounts, filteredByDuration]);

    const sharePDF = (title, txList, accountName = null, initialBal = 0) => {
        let runningBal = initialBal;
        let html = `<html><head><title>${title}</title><style>
            body{font-family:sans-serif;padding:30px;color:#1e293b;} 
            .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f1f5f9;padding-bottom:20px;margin-bottom:30px;}
            .title{font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:2px;}
            table{width:100%;border-collapse:collapse;margin-top:20px;} 
            th,td{border-bottom:1px solid #f1f5f9;padding:12px 8px;text-align:left;font-size:11px;} 
            th{background:#f8fafc;font-weight:900;text-transform:uppercase;color:#64748b;} 
            .text-right{text-align:right;} .green{color:#10b981;font-weight:bold;} .red{color:#ef4444;font-weight:bold;}
            .footer{margin-top:40px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:20px;}
        </style></head><body>`;
        
        html += `<div class="header"><div><div class="title">SMEES PRIVATE VAULT</div><div style="font-size:12px;color:#64748b;margin-top:4px;">${title} • Generated on ${new Date().toLocaleString()}</div></div></div>`;
        html += `<table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="text-right">In (+)</th><th class="text-right">Out (-)</th><th class="text-right">Balance</th></tr></thead><tbody>`;
        
        if (accountName) {
            html += `<tr><td>-</td><td>Opening Balance</td><td>-</td><td>-</td><td>-</td><td class="text-right" style="font-weight:bold;">₹${runningBal.toFixed(2)}</td></tr>`;
        }

        txList.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(tx => {
            let isIncoming = (tx.type === 'income' && tx.account === accountName) || (tx.type === 'transfer' && tx.toAccount === accountName) || (!accountName && tx.type === 'income');
            let inAmt = isIncoming ? parseFloat(tx.amount||0) : 0;
            let outAmt = !isIncoming ? parseFloat(tx.amount||0) : 0;
            runningBal += (inAmt - outAmt);
            
            let desc = tx.category || tx.note || 'Transfer';
            if(tx.subCategory) desc += ` (${tx.subCategory})`;
            if(tx.note && tx.category) desc += ` • ${tx.note}`;
            if(tx.type === 'transfer') desc += `<br/><small style="color:#94a3b8">From: ${tx.account} To: ${tx.toAccount}</small>`;

            html += `<tr>
                <td>${new Date(tx.date).toLocaleDateString()}</td>
                <td>${desc}</td>
                <td style="text-transform:uppercase;font-weight:bold;font-size:9px;">${tx.type}</td>
                <td class="text-right green">${inAmt > 0 ? '₹'+inAmt : '-'}</td>
                <td class="text-right red">${outAmt > 0 ? '₹'+outAmt : '-'}</td>
                <td class="text-right" style="font-weight:bold;">₹${runningBal.toFixed(2)}</td>
            </tr>`;
        });
        
        html += `</tbody></table><div class="footer">Confidential Financial Record • SMEES ERP PRO SYSTEM</div></body></html>`;
        
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
    };

    const categoryStats = useMemo(() => {
        const currentTxs = filteredByDuration.filter(t => t.type === statsTab);
        const totals = {};
        currentTxs.forEach(t => {
            const cat = t.category || 'Other';
            totals[cat] = (totals[cat] || 0) + parseFloat(t.amount || 0);
        });
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const totalAmt = sorted.reduce((s, [_, a]) => s + a, 0);
        return { sorted, totalAmt };
    }, [filteredByDuration, statsTab]);

    const isIntegrated = !!accountId;

    return (
        <div className={`fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-500 scrollbar-hide flex flex-col ${isIntegrated ? 'pb-24' : ''}`}>
            {(!isIntegrated && !selectedAccountForTx) && (
                <div className="bg-slate-900 text-white pt-14 pb-0 px-4 shadow-lg shrink-0 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <button onClick={onBack} className="p-2 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><ArrowLeft size={18}/></button>
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2 tracking-tighter uppercase">🔐 My Vault</h2>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">Security Standard 2026</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setModal({ type: 'personalFinance' })} className="w-11 h-11 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-90 transition-all flex items-center justify-center font-black"><Plus size={20}/></button>
                        </div>
                    </div>
                    <div className="flex relative z-10">
                        <button onClick={() => setFinanceView('transactions')} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase border-b-4 transition-all ${financeView === 'transactions' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Ledgers</button>
                        <button onClick={() => { setFinanceView('accounts'); setSelectedAccountForTx(null); }} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase border-b-4 transition-all ${financeView === 'accounts' ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Wallets</button>
                        <button onClick={() => setFinanceView('stats')} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase border-b-4 transition-all ${financeView === 'stats' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Analysis</button>
                    </div>
                </div>
            )}

            <div className={`flex-1 overflow-y-auto ${!isIntegrated ? 'p-4' : 'p-2'} space-y-4 pb-40`}>
                {financeView === 'transactions' && !isIntegrated && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-3">
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                                    <select className="w-full pl-9 pr-3 py-3 bg-slate-50 rounded-xl text-[10px] font-black text-slate-800 uppercase outline-none appearance-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                        <option value="Weekly">This Week</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Yearly">Yearly</option>
                                        <option value="Custom Range">Range</option>
                                        <option value="Specific Date">Date</option>
                                    </select>
                                </div>
                                {['Monthly', 'Yearly', 'Specific Date'].includes(filterType) && (
                                    <input type={filterType === 'Monthly' ? 'month' : filterType === 'Yearly' ? 'number' : 'date'} placeholder="YYYY" className="flex-1 px-4 py-3 bg-slate-50 rounded-xl text-[10px] font-black text-slate-800 outline-none" value={filterType === 'Yearly' ? filterDate.split('-')[0] : filterDate} onChange={e => {
                                        if(filterType === 'Yearly') setFilterDate(`${e.target.value}-01-01`);
                                        else setFilterDate(e.target.value);
                                    }} />
                                )}
                            </div>
                            {filterType === 'Custom Range' && (
                                <div className="flex gap-2 animate-in slide-in-from-top-2">
                                    <input type="date" className="flex-1 px-4 py-3 bg-slate-50 rounded-xl text-[10px] font-black" value={filterCustom.start} onChange={e=>setFilterCustom({...filterCustom, start: e.target.value})}/>
                                    <input type="date" className="flex-1 px-4 py-3 bg-slate-50 rounded-xl text-[10px] font-black" value={filterCustom.end} onChange={e=>setFilterCustom({...filterCustom, end: e.target.value})}/>
                                </div>
                            )}
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                <input className="w-full pl-11 pr-4 py-4 bg-slate-50/50 border border-slate-50 rounded-[20px] text-xs font-bold outline-none" placeholder="Search memo, category..." value={search} onChange={e => setSearch(e.target.value)}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-500 p-5 rounded-[28px] text-white space-y-1 shadow-lg shadow-emerald-500/10">
                                <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest">Inflow</p>
                                <p className="text-xl font-black tracking-tighter">{formatCurrency(incomeTotal)}</p>
                            </div>
                            <div className="bg-rose-500 p-5 rounded-[28px] text-white space-y-1 shadow-lg shadow-rose-500/10">
                                <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest">Outflow</p>
                                <p className="text-xl font-black tracking-tighter">{formatCurrency(expenseTotal)}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filtered.map((t, idx) => (
                                <div key={idx} onClick={() => setModal({ type: 'personalFinance', data: t })} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100/50 text-emerald-600' : t.type === 'expense' ? 'bg-rose-100/50 text-rose-600' : 'bg-blue-100/50 text-blue-600'}`}>
                                            {t.type === 'income' ? <TrendingUp size={16}/> : t.type === 'expense' ? <ShoppingCart size={16}/> : <RefreshCcw size={16}/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-slate-900 uppercase tracking-tight truncate max-w-[150px]">{t.category || t.note || 'Transfer'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 capitalize tracking-tight">{t.account} • {formatDate(t.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black tracking-tight ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </p>
                                        {t.subCategory && <p className="text-[8px] font-black text-slate-300 uppercase italic opacity-70">"{t.subCategory}"</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {financeView === 'accounts' && !selectedAccountForTx && (
                    <div className="space-y-6">
                        <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-4 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Aggregate Liquidity</p>
                            <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalBalance)}</h2>
                        </div>
                        {Object.entries(accountGroups).map(([group, accs]) => (
                            <div key={group} className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">{group} Portfolio</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {accs.map(acc => (
                                        <div key={acc.name} onClick={() => setSelectedAccountForTx(acc)} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex justify-between items-center active:scale-95 transition-all cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                                    {acc.type === 'Bank' ? <Landmark size={22}/> : acc.type === 'Card' ? <CardIcon size={22}/> : <Wallet size={22}/>}
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

                {(financeView === 'accounts' || isIntegrated) && selectedAccountForTx && (
                    <div className="space-y-4 animate-in slide-in-from-right duration-300">
                        <div className="bg-white p-6 rounded-[36px] shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-6">
                                <button onClick={() => isIntegrated ? onBack() : setSelectedAccountForTx(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><ArrowLeft size={18}/></button>
                                <button onClick={() => {
                                    const txs = transactions.filter(t => t.account === selectedAccountForTx.name || t.toAccount === selectedAccountForTx.name);
                                    sharePDF(`${selectedAccountForTx.name} Statement`, txs, selectedAccountForTx.name, selectedAccountForTx.initialBalance);
                                }} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                                    <Download size={18}/>
                                </button>
                            </div>
                            <h2 className="font-black text-slate-900 text-2xl uppercase tracking-tighter mb-1">{selectedAccountForTx.name}</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Official Ledger Account</p>
                            <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                <div>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Live Valuation</p>
                                    <p className={`text-3xl font-black tracking-tighter ${selectedAccountForTx.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(selectedAccountForTx.balance)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {transactions.filter(t => t.account === selectedAccountForTx.name || t.toAccount === selectedAccountForTx.name).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(tx => {
                                const isIncoming = (tx.type === 'income' && tx.account === selectedAccountForTx.name) || (tx.type === 'transfer' && tx.toAccount === selectedAccountForTx.name);
                                return (
                                <div key={tx.id} onClick={() => setModal({ type: 'personalFinance', data: tx })} className="p-4 bg-white rounded-[24px] border border-slate-100 flex justify-between items-center shadow-sm active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isIncoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {isIncoming ? <TrendingUp size={16} /> : <ShoppingCart size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-slate-800 uppercase tracking-tight">{tx.category || tx.note || 'Transfer'}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDate(tx.date)}</p>
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

                {financeView === 'stats' && !isIntegrated && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flow Dynamics</h3>
                                    <h2 className="text-xl font-black text-black tracking-tighter uppercase">Category Distribution</h2>
                                </div>
                                <button onClick={() => sharePDF(`Category Summary (${statsTab.toUpperCase()})`, filteredByDuration.filter(t => t.type === statsTab))} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 transition-colors"><Download size={20}/></button>
                            </div>

                            <div className="flex bg-slate-50 p-1 rounded-2xl shadow-inner mb-6">
                                <button onClick={() => setStatsTab('income')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${statsTab === 'income' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400'}`}>Income</button>
                                <button onClick={() => setStatsTab('expense')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${statsTab === 'expense' ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400'}`}>Expense</button>
                            </div>

                            <div className="flex flex-col items-center py-6">
                                {categoryStats.totalAmt > 0 ? (
                                    <div className="relative w-48 h-48">
                                        <svg viewBox="0 0 240 240" className="w-full h-full">
                                            {(() => {
                                                let currentAngle = -Math.PI / 2;
                                                const cx = 120, cy = 120, r = 80;
                                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                                                
                                                return categoryStats.sorted.map(([cat, amt], i) => {
                                                    const percent = amt / categoryStats.totalAmt;
                                                    const angle = percent * Math.PI * 2;
                                                    const x1 = cx + r * Math.cos(currentAngle);
                                                    const y1 = cy + r * Math.sin(currentAngle);
                                                    const x2 = cx + r * Math.cos(currentAngle + angle);
                                                    const y2 = cy + r * Math.sin(currentAngle + angle);
                                                    const largeArc = angle > Math.PI ? 1 : 0;
                                                    const path = percent === 1 
                                                        ? `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`
                                                        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                                    
                                                    const d = path;
                                                    currentAngle += angle;
                                                    return <path key={i} d={d} fill={colors[i % colors.length]} stroke="white" strokeWidth="2" />;
                                                });
                                            })()}
                                            <circle cx="120" cy="120" r="45" fill="white" />
                                            <text x="120" y="125" textAnchor="middle" className="text-[12px] font-black fill-slate-900 uppercase">Analysis</text>
                                        </svg>
                                    </div>
                                ) : <div className="py-20 text-slate-300 font-black text-xs uppercase tracking-widest">No Intelligence Data</div>}
                            </div>

                            <div className="space-y-3 pt-6 border-t border-slate-50">
                                {categoryStats.sorted.map(([cat, amt], i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => { setStatsTab(statsTab); setFinanceView('ledger'); /* We could filter ledger by category if we add cat filter state */ }}
                                        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i % 8] }}></div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{cat}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-900">{formatCurrency(amt)}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => onBack()} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all">Back to Dashboard</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalFinanceView;
