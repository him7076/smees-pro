import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit2, Trash2, Phone, MapPin, Search, Calendar, Landmark, Banknote, TrendingUp, ShoppingCart, ReceiptText, Smartphone } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PartyProfileView = ({ record, data, onBack, setViewDetail, setModal, user, deleteRecord, partyBalances, getBillStats }) => {
    const [activeTab, setActiveTab] = useState('transactions');
    const [filter, setFilter] = useState('All');
    const [taskStatusFilter, setTaskStatusFilter] = useState('All');
    const [txSearch, setTxSearch] = useState('');
    const [pnlDuration, setPnlDuration] = useState('This Month');
    const [customPnlDate, setCustomPnlDate] = useState({ start: '', end: '' });

    // 1. P&L Logic
    const calculatePnL = () => {
        let filteredTxs = data.transactions.filter(tx => tx.partyId === record.id);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

        if (pnlDuration === 'This Month') filteredTxs = filteredTxs.filter(t => t.date >= startOfMonth);
        else if (pnlDuration === 'Last Month') filteredTxs = filteredTxs.filter(t => t.date >= startOfLastMonth && t.date <= endOfLastMonth);
        else if (pnlDuration === 'This Year') filteredTxs = filteredTxs.filter(t => t.date >= startOfYear);
        else if (pnlDuration === 'Custom' && customPnlDate.start && customPnlDate.end) filteredTxs = filteredTxs.filter(t => t.date >= customPnlDate.start && t.date <= customPnlDate.end);

        const income = filteredTxs.filter(t => ['sales', 'income'].includes(t.type)).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const expense = filteredTxs.filter(t => ['purchase', 'expense'].includes(t.type)).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        return income - expense;
    };

    const partyTasks = (data.tasks || []).filter(t => t.partyId === record.id);
    const filteredTasks = taskStatusFilter === 'All' ? partyTasks : partyTasks.filter(t => t.status === taskStatusFilter);

    const getHistory = () => {
        return data.transactions
            .filter(tx => tx.partyId === record.id)
            .filter(tx => {
                if (filter === 'All') return true;
                if (filter === 'Sales') return tx.type === 'sales';
                if (filter === 'Purchase') return tx.type === 'purchase';
                if (filter === 'Expense') return tx.type === 'expense';
                if (filter === 'Payment') return tx.type === 'payment';
                return true;
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
    };

    const history = getHistory();
    const mobiles = String(record.mobile || '').split(',').map(m => m.trim()).filter(Boolean);

    if (!record) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300 pb-24">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-black text-slate-800 tracking-tight">Party Profile</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'party', data: record })} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                        <Edit2 size={20}/>
                    </button>
                    {user?.role === 'admin' && (
                        <button 
                            onClick={async () => {
                                if(window.confirm('Delete this party and history?')) {
                                    await deleteRecord('parties', record.id);
                                    onBack();
                                }
                            }} 
                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                        >
                            <Trash2 size={20}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                            <div className="flex-1">
                                <h1 className="text-3xl font-black tracking-tighter mb-4">{record.name}</h1>
                                <div className="space-y-2">
                                    {mobiles.map((m, idx) => (
                                        <p key={idx} className="flex items-center gap-2 text-sm font-bold text-slate-400 group cursor-pointer" onClick={() => window.open(`tel:${m}`)}>
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Phone size={14}/></div>
                                            {m}
                                        </p>
                                    ))}
                                    {record.address && (
                                        <p className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2">
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><MapPin size={14}/></div>
                                            {record.address}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="w-full sm:w-auto p-6 bg-white/5 rounded-[24px] backdrop-blur-sm border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Ledger</p>
                                <p className={`text-2xl font-black tracking-tighter ${partyBalances[record.id] > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatCurrency(Math.abs(partyBalances[record.id] || 0))} 
                                    <span className="text-xs font-bold uppercase ml-1 opacity-60">{partyBalances[record.id] > 0 ? 'Dr' : 'Cr'}</span>
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10">
                             <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">P&L Stats</span>
                                <select 
                                    className="bg-white/10 text-[10px] border-none rounded-xl px-3 py-1.5 font-black text-white outline-none cursor-pointer" 
                                    value={pnlDuration} 
                                    onChange={(e) => setPnlDuration(e.target.value)}
                                >
                                    <option className="text-slate-900">This Month</option>
                                    <option className="text-slate-900">Last Month</option>
                                    <option className="text-slate-900">This Year</option>
                                    <option className="text-slate-900">Custom Range</option>
                                </select>
                            </div>
                            {pnlDuration === 'Custom Range' && (
                                <div className="flex gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
                                    <input type="date" className="flex-1 text-[10px] p-2 rounded-xl bg-white/5 border-none text-white font-bold" value={customPnlDate.start} onChange={e=>setCustomPnlDate({...customPnlDate, start:e.target.value})} />
                                    <input type="date" className="flex-1 text-[10px] p-2 rounded-xl bg-white/5 border-none text-white font-bold" value={customPnlDate.end} onChange={e=>setCustomPnlDate({...customPnlDate, end:e.target.value})} />
                                </div>
                            )}
                            <p className={`text-3xl font-black ${calculatePnL() >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {calculatePnL() >= 0 ? '+' : ''}{formatCurrency(calculatePnL())}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl sticky top-[72px] z-10">
                    {['transactions', 'assets', 'tasks', 'contacts'].map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)} 
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {activeTab === 'transactions' && (
                        <div className="space-y-6">
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                {['All', 'Sales', 'Purchase', 'Payment', 'Expense'].map(f => (
                                    <button 
                                        key={f} 
                                        onClick={() => setFilter(f)} 
                                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${filter === f ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                <input 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none" 
                                    placeholder="Search Bill No, Note, Amount..." 
                                    value={txSearch} 
                                    onChange={e => setTxSearch(e.target.value)} 
                                />
                            </div>

                            <div className="space-y-3">
                                {history.filter(t => !txSearch || t.id.toLowerCase().includes(txSearch.toLowerCase()) || (t.amount||0).toString().includes(txSearch) || (t.description||'').toLowerCase().includes(txSearch.toLowerCase())).map(tx => {
                                    const stats = getBillStats(tx, data.transactions); 
                                    const isIncoming = tx.type === 'sales' || (tx.type === 'payment' && tx.subType === 'in');
                                    const isCancelled = tx.status === 'Cancelled';
                                    
                                    let Icon = ReceiptText, bg = 'bg-slate-100', color = 'text-slate-500';
                                    if (tx.type === 'sales') { Icon = TrendingUp; bg = 'bg-emerald-50'; color = 'text-emerald-600'; }
                                    if (tx.type === 'purchase') { Icon = ShoppingCart; bg = 'bg-blue-50'; color = 'text-blue-600'; }
                                    if (tx.type === 'payment') { Icon = tx.paymentMode === 'Bank' ? Landmark : Banknote; bg = 'bg-purple-50'; color = 'text-purple-600'; }
                                    if (tx.type === 'expense') { Icon = ShoppingCart; bg = 'bg-rose-50'; color = 'text-rose-600'; }

                                    return (
                                        <div 
                                            key={tx.id} 
                                            onClick={() => setViewDetail({ type: 'transaction', id: tx.id })}
                                            className={`p-5 bg-white border border-slate-100 rounded-[24px] flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-50 shadow-sm ${isCancelled ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${bg} ${color}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm tracking-tight uppercase mb-1">
                                                        {tx.type} #{tx.id.slice(-4)}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {formatDate(tx.date)} • {tx.paymentMode || 'Cash'}
                                                    </p>
                                                    {tx.description && (
                                                        <p className="text-[10px] text-slate-500 mt-1 italic opacity-60 truncate max-w-[140px]">{tx.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xl font-black tracking-tighter ${isCancelled ? 'text-slate-300 line-through' : isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {isIncoming ? '+' : '-'}{formatCurrency(stats.amount)}
                                                </p>
                                                {!isCancelled && stats.status !== 'PAID' && (
                                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Bal: {formatCurrency(stats.pending)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'assets' && (
                        <div className="space-y-6">
                            <button onClick={() => setModal({ type: 'asset', data: { partyId: record.id } })} className="w-full py-6 border-2 border-dashed border-slate-200 text-slate-400 rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-50 hover:border-blue-200 hover:text-blue-500 transition-all">
                                + Add New Asset
                            </button>
                            <div className="space-y-3">
                                {(record.assets || []).map((asset, idx) => (
                                    <div key={idx} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm relative overflow-hidden group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="font-black text-slate-800 text-lg mb-1">{asset.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{asset.brand} • {asset.model}</p>
                                            </div>
                                            <Landmark size={40} className="text-slate-50 opacity-20 absolute -right-2 -bottom-2" />
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                                            <Calendar size={18} className="text-slate-400"/>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Service</p>
                                                <p className={`font-black tracking-tight ${new Date(asset.nextServiceDate) <= new Date() ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                                                    {asset.nextServiceDate ? formatDate(asset.nextServiceDate) : 'NOT SET'}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => setModal({ type: 'asset', data: { ...asset, partyId: record.id, assetIndex: idx } })}
                                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-6">
                             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                {['All', 'To Do', 'In Progress', 'Done'].map(st => (
                                    <button key={st} onClick={() => setTaskStatusFilter(st)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${taskStatusFilter === st ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>
                                        {st}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                {filteredTasks.map(task => (
                                    <div key={task.id} onClick={() => setViewDetail({ type: 'task', id: task.id })} className="p-5 bg-white border border-slate-100 rounded-[24px] flex justify-between items-center cursor-pointer shadow-sm active:scale-[0.98] transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${task.status === 'Done' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            <div>
                                                <p className={`font-bold text-slate-800 ${task.status === 'Done' ? 'line-through opacity-40' : ''}`}>{task.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Due: {task.dueDate ? formatDate(task.dueDate) : 'No due date'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest border ${task.status === 'Done' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setModal({ type: 'task', data: { partyId: record.id } })} className="w-full py-6 border-2 border-dashed border-slate-200 text-slate-400 rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-500 transition-all">
                                + Create New Task
                            </button>
                        </div>
                    )}

                    {activeTab === 'contacts' && (
                        <div className="space-y-6">
                            <div className="bg-emerald-50 rounded-[32px] border border-emerald-100 p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2"><Smartphone size={16}/> Contact Registry</p>
                                </div>
                                <div className="space-y-3">
                                    {(record.mobileNumbers || []).map((mob, idx) => (
                                        <div key={idx} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-emerald-100">
                                            <div>
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">{mob.label}</span>
                                                <p className="font-black text-slate-800 tracking-tight">{mob.number}</p>
                                            </div>
                                            <button className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-[32px] border border-blue-100 p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2"><MapPin size={16}/> Address Vault</p>
                                </div>
                                <div className="space-y-3">
                                    {(record.locations || []).map((loc, idx) => (
                                        <div key={idx} className="bg-white p-5 rounded-2xl flex justify-between items-start shadow-sm border border-blue-100">
                                            <div className="flex-1">
                                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">{loc.label}</span>
                                                <p className="text-sm font-bold text-slate-700 leading-relaxed pr-4">{loc.address}</p>
                                                {loc.mobile && <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Contact: {loc.mobile}</p>}
                                            </div>
                                            <button className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PartyProfileView;
