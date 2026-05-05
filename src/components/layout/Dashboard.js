import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getTransactionTotals, formatDate } from '../../utils/helpers';
import { Plus, TrendingUp, FileText, ChevronRight, Banknote, Landmark } from 'lucide-react';

const Dashboard = ({ data, setModal, setViewDetail }) => {
    const navigate = useNavigate();
    const isRescue = JSON.parse(localStorage.getItem('smees_user') || '{}').isOffline;

    const downloadLocalBackup = () => {
        if (!data) return alert("No data to backup!");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smees_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const [fType, setFType] = useState('Monthly');
    const [customRange, setCustomRange] = useState({ 
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });

    const stats = useMemo(() => {
        // ... (existing logic)
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

        const filtered = (data.transactions || []).filter(t => {
            const d = new Date(t.date);
            return d >= start && d <= end && t.status !== 'Cancelled';
        });
        
        const sales = filtered.filter(t => t.type === 'sales').reduce((s, t) => s + (getTransactionTotals(t)?.final || 0), 0);
        const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (getTransactionTotals(t)?.amount || 0), 0);
        
        let grossProfit = 0;
        filtered.filter(t => t.type === 'sales').forEach(s => {
            (s.items || []).forEach(i => { 
                const master = (data.items || []).find(mi => mi.id === i.itemId);
                const buy = parseFloat(i.buyPrice || i.purchasePrice || master?.buyPrice || 0);
                const sell = parseFloat(i.price || 0);
                const qty = parseFloat(i.qty || 1);
                
                const itemName = i.itemName || master?.name || '';
                const type = master?.type || 'Goods';
                const isService = type === 'Service' || itemName.toLowerCase().includes('service');
                
                grossProfit += (sell - buy) * qty; 
            });
            grossProfit -= parseFloat(s.discountValue || 0);
        });


        const cashBal = (data.transactions || []).reduce((acc, t) => {
            if (t.status === 'Cancelled' || t.status === 'cancelled') return acc;
            const isCash = (t.paymentMode || 'Cash') === 'Cash';
            if (!isCash) return acc;
            const amt = parseFloat(t.received || t.paid || (['payment','expense'].includes(t.type) ? t.amount : 0));
            const isIn = t.type === 'sales' || (t.type === 'payment' && t.subType === 'in');
            return acc + (isIn ? amt : -amt);
        }, 0);

        const bankBal = (data.transactions || []).reduce((acc, t) => {
            if (t.status === 'Cancelled' || t.status === 'cancelled') return acc;
            const isBank = t.paymentMode === 'Bank' || t.paymentMode === 'UPI';
            if (!isBank) return acc;
            const amt = parseFloat(t.received || t.paid || (['payment','expense'].includes(t.type) ? t.amount : 0));
            const isIn = t.type === 'sales' || (t.type === 'payment' && t.subType === 'in');
            return acc + (isIn ? amt : -amt);
        }, 0);

        const activeTasks = (data.tasks || []).filter(t => t.status !== 'Done' && t.status !== 'Converted').length;

        return { sales, expenses, activeTasks, grossProfit, filteredTxs: filtered, cashBal, bankBal };
    }, [data, fType, customRange]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-20">
            {/* Cloud Sync Active - Normal Mode */}
            <div className="bg-slate-900 p-5 rounded-[40px] shadow-2xl space-y-6 text-white overflow-hidden relative border border-white/5">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Execution Suite</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest border border-blue-500/30 px-2 py-0.5 rounded-full">v2.1 Stable</p>
                                <button 
                                    onClick={() => setModal({ type: 'task' })}
                                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    <Plus size={10}/> New Task
                                </button>
                            </div>
                        </div>
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
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">Command Hub</h1>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] ml-1 opacity-50">Intelligent Operations</p>
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
                    { label: 'Total Sales', value: formatCurrency(stats.sales), sub: 'Gross Revenue', color: 'bg-emerald-600 shadow-emerald-600/20', type: 'sales', icon: <TrendingUp size={16}/> },
                    { label: 'Total Expenses', value: formatCurrency(stats.expenses), sub: 'Operational Outflow', color: 'bg-rose-600 shadow-rose-600/20', type: 'expense', icon: <FileText size={16}/> },
                    { label: 'Gross Profit', value: formatCurrency(stats.grossProfit), sub: 'Net Yield', color: 'bg-blue-600 shadow-blue-600/20', type: 'profit', icon: <TrendingUp size={16}/> },
                    { label: 'Liquid Balance', value: formatCurrency(stats.cashBal + stats.bankBal), sub: `C: ${formatCurrency(stats.cashBal)} | B: ${formatCurrency(stats.bankBal)}`, color: 'bg-indigo-600 shadow-indigo-600/20', type: 'liquid_assets', icon: <Banknote size={16}/> },
                ].map((card, i) => (
                    <div 
                        key={i} 
                        onClick={() => {
                            if (card.type === 'liquid_assets') {
                                setModal({ type: 'financial_book' });
                            } else {
                                setModal({ type: 'dashboard_drilldown', filter: card.type, items: stats.filteredTxs.filter(t => t.type === card.type || (card.type === 'profit' && t.type === 'sales')) });
                            }
                        }} 
                        className={`p-6 rounded-[36px] shadow-2xl ${card.color} text-white hover:scale-[1.02] transition-all cursor-pointer group active:scale-95 relative overflow-hidden`}
                    >
                        <div className="absolute top-4 right-4 opacity-20">{card.icon}</div>
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
                        {[...data.transactions].sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 5).map(t => (
                            <div key={t.id} onClick={() => setViewDetail({ type: 'transaction', id: t.id })} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer">
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

export default Dashboard;
