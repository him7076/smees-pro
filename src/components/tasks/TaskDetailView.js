import React, { useState } from 'react';
import { 
    ArrowLeft, RefreshCw, MessageCircle, MoreHorizontal, Edit2, Trash2, 
    Clock, CheckCircle2, AlertCircle, Play, Square, MapPin, ChevronRight, 
    ShieldCheck, Package, Phone, Share2, Plus, Info, Layout, ShoppingCart
} from 'lucide-react';
import { formatCurrency, formatDate, formatTime, checkPermission } from '../../utils/helpers';

const TaskDetailView = ({ task, data, user, onBack, setViewDetail, setModal, deleteRecord, showToast, toggleTimer, refreshSingleRecord }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [showItems, setShowItems] = useState(false);
    const [showAllStaff, setShowAllStaff] = useState(false);

    const party = data.parties.find(p => p.id === task.partyId);
    const subTasks = data.tasks.filter(t => t.parentId === task.id);
    const isMyTimerRunning = (task.timeLogs || []).some(l => l.staffId === user?.id && !l.end);

    const shareTask = () => {
        const link = `${window.location.origin}?taskId=${task.id}`;
        const text = `*Task Details*\nID: ${task.id}\nTask: ${task.name}\nClient: ${party?.name || 'N/A'}\nStatus: ${task.status}\n\nLink: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const formatMins = (m) => {
        if(!m || m <= 0) return '0m';
        const h = Math.floor(m / 60);
        const mins = Math.round(m % 60);
        return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
    };

    const staffSummary = (task.timeLogs || []).reduce((acc, log) => {
        const name = log.staffName || 'Staff';
        acc[name] = (acc[name] || 0) + parseFloat(log.duration || 0);
        return acc;
    }, {});

    const visibleStaff = data.staff.filter(s => user.role === 'admin' || s.id === user.id);

    // Task-specific Profit Engine (Tiered)
    const profitData = React.useMemo(() => {
        if (!task || !task.itemsUsed) return { items: [], normalMaterialPnL:0, normalServicePnL:0, bundleActualPnL:0, netPnL:0 };
        
        let normalMaterialPnL = 0;
        let normalServicePnL = 0;
        let bundleActualPnL = 0;
        
        const items = (task.itemsUsed || []).map(item => {
            const master = (data.items || []).find(mi => mi.id === item.itemId) || (data.bundles || []).find(bi => bi.id === item.itemId);
            const sell = parseFloat(item.price || 0);
            const qty = parseFloat(item.qty || 1);
            const buy = parseFloat(item.buyPrice || item.purchasePrice || master?.buyPrice || 0);
            const grossTotal = sell * qty;
            const linePnL = (sell - buy) * qty;

            let subItems = [];
            let bundleGoodsPnL = 0;
            let bundleServicePnL = 0;

            if (item.isBundle && item.subItems?.length > 0) {
                bundleActualPnL += linePnL;
                item.subItems.forEach(sub => {
                    const subMaster = data.items.find(mi => mi.id === sub.itemId);
                    const sSell = parseFloat(sub.price || 0);
                    const sBuy = parseFloat(sub.buyPrice || 0);
                    const sQty = parseFloat(sub.qty || 1);
                    const sTotalQty = sQty * qty;
                    const sPnL = (sSell - sBuy) * sTotalQty;
                    
                    const isSrv = (subMaster?.category || subMaster?.type || '').toLowerCase().includes('service');
                    if (isSrv) bundleServicePnL += sPnL;
                    else bundleGoodsPnL += sPnL;

                    subItems.push({
                        name: subMaster?.name || 'Item',
                        brand: sub.brand,
                        qty: sQty,
                        totalQty: sTotalQty,
                        sell: sSell,
                        buy: sBuy,
                        gross: sSell * sTotalQty,
                        pnl: sPnL,
                        isService: isSrv
                    });
                });
            } else {
                const isSrv = master?.type === 'Service' || (master?.category || '').toLowerCase().includes('service');
                if (isSrv) normalServicePnL += linePnL;
                else normalMaterialPnL += linePnL;
            }

            return {
                ...item,
                itemName: item.name || master?.name || 'Generic Item',
                sell,
                buy,
                qty,
                grossTotal,
                linePnL,
                subItems,
                bundleGoodsPnL,
                bundleServicePnL
            };
        });

        const netPnL = normalMaterialPnL + normalServicePnL + bundleActualPnL;
        return { items, normalMaterialPnL, normalServicePnL, bundleActualPnL, netPnL };
    }, [task.itemsUsed, data.items, data.bundles]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* STICKY HEADER */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-[110]">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="font-black text-slate-900 tracking-tight leading-none text-sm uppercase">Task Intel</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {task.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={async () => {
                            showToast("Syncing...");
                            await refreshSingleRecord('tasks', task.id);
                            showToast("Synced!");
                        }}
                        className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 active:scale-95 transition-all"
                    >
                        <RefreshCw size={20}/>
                    </button>
                    <button onClick={shareTask} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 active:scale-95 transition-all">
                        <Share2 size={20}/>
                    </button>
                    {checkPermission(user, 'canEditTasks') && (
                        <div className="relative">
                            <button onClick={() => setShowMenu(!showMenu)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all">
                                <MoreHorizontal size={20}/>
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-14 bg-white border border-slate-100 shadow-2xl rounded-3xl w-56 z-[120] p-3 space-y-2 animate-in zoom-in-95 origin-top-right">
                                    <button onClick={() => { setModal({ type: 'task', data: task }); setShowMenu(false); }} className="w-full text-left p-3 hover:bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3"><Edit2 size={16}/> Edit Record</button>
                                    <button onClick={() => { shareTask(); setShowMenu(false); }} className="w-full text-left p-3 hover:bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3"><MessageCircle size={16}/> WhatsApp Details</button>
                                    <div className="h-px bg-slate-50 my-1 mx-2"></div>
                                    <button onClick={() => { if(window.confirm('Delete Task?')) deleteRecord('tasks', task.id); }} className="w-full text-left p-3 hover:bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3"><Trash2 size={16}/> Delete Task</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-6 pb-24">
                {/* Header Card (HIGH-FIDELITY P&L DASHBOARD) */}
                {user.role === 'admin' && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm text-center relative overflow-hidden">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pt-2">
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Normal (Goods)</p>
                                <p className="text-xs font-black text-emerald-600">{formatCurrency(profitData.normalMaterialPnL)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Normal (Srv)</p>
                                <p className="text-xs font-black text-blue-600">{formatCurrency(profitData.normalServicePnL)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Bundle Actual</p>
                                <p className="text-xs font-black text-indigo-600">{formatCurrency(profitData.bundleActualPnL)}</p>
                            </div>
                            <div className="p-3 bg-slate-900 rounded-2xl shadow-lg">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-white/50">Job Net P&L</p>
                                <p className="text-xs font-black text-emerald-400">{formatCurrency(profitData.netPnL)}</p>
                            </div>
                        </div>
                        
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Total Job Value</p>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(task.itemsUsed?.reduce((acc,l)=>acc+(parseFloat(l.qty||0)*parseFloat(l.price||0)),0))}</h1>
                    </div>
                )}

                {/* PRIMARY INFO CARD */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                            task.status === 'Done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50 shadow-lg' :
                            task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-blue-50 shadow-lg' :
                            'bg-amber-50 text-amber-700 border-amber-100 shadow-amber-50 shadow-lg'
                        }`}>
                            {task.status}
                        </span>
                    </div>

                    <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2 pr-24">{task.name}</h1>
                    
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {task.priority && (
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                task.priority === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                task.priority === 'Medium' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                {task.priority}
                            </span>
                        )}
                        {task.estimateTime && (
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                               <Clock size={10}/> {task.estimateTime}
                           </span>
                        )}
                        {task.assignedStaff?.length > 0 && (
                            <div className="flex gap-1 items-center">
                                {task.assignedStaff.map(sid => {
                                    const s = data.staff.find(sm => sm.id === sid);
                                    return <span key={sid} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[7px] font-black border border-indigo-100 uppercase truncate max-w-[60px]">{s?.name || 'User'}</span>;
                                })}
                            </div>
                        )}
                    </div>

                    <p className="text-slate-600 leading-snug text-xs font-medium border-t border-slate-50 pt-4">{task.description || 'No brief provided.'}</p>
                </div>

                {/* PARENT LINK if applicable */}
                {task.parentId && (() => {
                    const parent = data.tasks.find(t => t.id === task.parentId);
                    return parent ? (
                        <div onClick={() => setViewDetail({ type: 'task', id: parent.id })} className="p-6 bg-indigo-900 text-white rounded-[32px] cursor-pointer active:scale-95 shadow-xl shadow-indigo-100 flex justify-between items-center group transition-all">
                            <div>
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Sub-task of Command:</p>
                                <p className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors">{parent.name}</p>
                            </div>
                            <Layout className="text-indigo-400 group-hover:rotate-12 transition-transform"/>
                        </div>
                    ) : null;
                })()}

                {/* CLIENT CARD - MODULAR */}
                {(party || task.address) && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden transition-all">
                        <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Interface</p>
                                    {task.locationLabel && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest">{task.locationLabel}</span>}
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{party?.name || 'Ad-hoc Client'}</h3>
                            </div>
                            {(task.location || party?.lat) && (
                                <a href={`https://www.google.com/maps?q=${task.location?.lat || party?.lat},${task.location?.lng || party?.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest">
                                    <MapPin size={14} fill="white"/> Map
                                </a>
                            )}
                        </div>

                        {/* Contacts & Address Split */}
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex flex-wrap gap-2">
                                {((task.selectedContacts?.length > 0) ? task.selectedContacts : [{ label: 'Primary', number: party?.mobile }]).filter(c => c.number).map((c, i) => (
                                    <a key={i} href={`tel:${c.number}`} className="flex-1 flex items-center gap-3 bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-all group min-w-[140px]">
                                        <div className="w-8 h-8 bg-white text-slate-400 rounded-lg flex items-center justify-center shadow-sm group-hover:text-blue-600"><Phone size={14}/></div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">{c.label}</p>
                                            <p className="text-[11px] font-black text-slate-800">{c.number}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                            {(task.address || party?.address) && (
                                <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-[20px] border border-slate-100">
                                    <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0"/>
                                    <p className="text-[10px] font-bold text-slate-600 leading-tight">{task.address || party?.address}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SESSIONS & TIMER */}
                <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Sessions</p>
                            <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest">Active Workforce</h4>
                        </div>
                        {isMyTimerRunning && <span className="flex items-center gap-2 px-3 py-1 bg-rose-500 text-white rounded-full text-[9px] font-black animate-pulse uppercase tracking-widest">My Timer Active</span>}
                    </div>

                    <div className="space-y-4">
                        {(showAllStaff ? visibleStaff : visibleStaff.slice(0, 3)).map(s => {
                            const isRunning = task.timeLogs?.some(l => l.staffId === s.id && !l.end);
                            return (
                                <div key={s.id} className="flex justify-between items-center p-4 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 shadow-emerald-500 shadow-lg' : 'bg-slate-700'}`}></div>
                                        <span className="text-sm font-black text-slate-200">{s.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => toggleTimer(task.id, s.id)}
                                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                            isRunning ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                                        }`}
                                    >
                                        {isRunning ? 'Stop' : 'Start'}
                                    </button>
                                </div>
                            );
                        })}
                        {visibleStaff.length > 3 && (
                            <button onClick={() => setShowAllStaff(!showAllStaff)} className="w-full py-4 text-[9px] font-black text-blue-400 uppercase tracking-widest bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                                {showAllStaff ? 'Show Fewer Members' : `Monitor All (${visibleStaff.length})`}
                            </button>
                        )}
                    </div>
                </div>

                {/* OPERATIONAL LEDGER (Detailed Costing) */}
                {user.role === 'admin' && profitData.items.length > 0 && (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                        <div className="flex justify-between items-center px-1">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 leading-none"><Package size={14}/> Operational Ledger</h4>
                            <button onClick={() => setShowItems(!showItems)} className="text-[9px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl active:scale-95 transition-all">{showItems ? 'Minimize' : 'Show Grid'}</button>
                        </div>
                        
                        {showItems && (
                            <div className="space-y-4">
                                {profitData.items.map((item, i) => (
                                    <div key={i} className={`p-5 rounded-[32px] border transition-all ${item.isBundle ? 'bg-blue-50/20 border-blue-100' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-md'}`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-xs font-black text-slate-900 tracking-tight leading-tight uppercase">{item.itemName}</p>
                                                    {item.isBundle && <span className="bg-blue-600 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">Bundle</span>}
                                                </div>
                                                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    <span>{item.qty} Qty</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{item.sell} S</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{item.buy} B</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900 tracking-tight">{formatCurrency(item.grossTotal)}</p>
                                                <p className={`text-[9px] font-black mt-1 px-2 py-0.5 rounded-lg inline-block ${item.linePnL >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    P&L: {formatCurrency(item.linePnL)}
                                                </p>
                                            </div>
                                        </div>

                                        {item.isBundle && item.subItems?.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-blue-200/50 space-y-3">
                                                <div className="flex justify-between text-[7px] font-black text-blue-400 uppercase tracking-widest px-2 mb-1">
                                                    <span className="flex-[2]">Component Trace</span>
                                                    <span className="flex-1 text-center">Qty | Sell | Buy</span>
                                                    <span className="flex-1 text-right">P&L (Total)</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {item.subItems.map((sub, sidx) => (
                                                        <div key={sidx} className="flex justify-between items-center text-[9px] font-bold text-slate-600 bg-white p-3 rounded-[20px] border border-blue-50">
                                                            <div className="flex-[2] truncate pr-2">
                                                                <span className={sub.isService ? 'text-blue-600' : 'text-slate-800'}>{sub.name}</span>
                                                                {sub.brand && <span className="text-[7px] text-slate-400 ml-1">[{sub.brand}]</span>}
                                                            </div>
                                                            <div className="flex-1 text-center text-[8px] text-slate-500 font-black">
                                                                {sub.qty} | {sub.sell} | {sub.buy}
                                                            </div>
                                                            <div className="flex-1 text-right text-emerald-600 font-black">
                                                                +{formatCurrency(sub.pnl)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between items-center pt-3 mt-1 border-t border-blue-200/30">
                                                    <div className="flex gap-2">
                                                        <div className="text-[7px] font-black px-2 py-1 rounded-full uppercase bg-emerald-50/50 text-emerald-600">G: {formatCurrency(item.bundleGoodsPnL)}</div>
                                                        <div className="text-[7px] font-black px-2 py-1 rounded-full uppercase bg-blue-50/50 text-blue-600">S: {formatCurrency(item.bundleServicePnL)}</div>
                                                    </div>
                                                    <div className="text-[8px] font-black text-blue-900 uppercase tracking-widest">
                                                        Bundle Profit: <span className="text-[10px] ml-1">{formatCurrency(item.linePnL)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PHOTOS ALIAS */}
                {!task.parentId && task.photosLink && (
                    <a href={task.photosLink} target="_blank" rel="noreferrer" className="block w-full p-8 bg-blue-600 text-white rounded-[40px] text-center shadow-2xl shadow-blue-200 active:scale-95 transition-all group overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                        <div className="relative z-10 flex items-center justify-center gap-4">
                            <span className="text-2xl">📸</span>
                            <span className="text-sm font-black uppercase tracking-[0.2em]">View Operational Album</span>
                        </div>
                    </a>
                )}

                {/* CONVERSION INTERFACE - MOVED TO BOTTOM */}
                <div className="pt-4 animate-in slide-in-from-bottom duration-500">
                    {task.status === 'Converted' ? (
                        <button 
                            onClick={() => setViewDetail({ type: 'transaction', id: task.generatedSaleId })}
                            className="w-full p-6 bg-emerald-600 text-white rounded-[32px] shadow-2xl shadow-emerald-200 active:scale-95 transition-all flex flex-col items-center gap-1 group"
                        >
                            <ShoppingCart size={24} className="mb-1 group-hover:scale-110 transition-transform"/>
                            <span className="text-xs font-black uppercase tracking-[0.2em]">View Linked Invoice</span>
                            <span className="text-[9px] opacity-60 font-black uppercase tracking-widest">Marked as Converted on {formatDate(task.convertedDate)}</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => setModal({ type: 'convertTask', data: task })}
                            className="w-full p-8 bg-slate-900 text-white rounded-[40px] shadow-2xl shadow-slate-900/40 active:scale-[0.98] transition-all flex items-center justify-between group overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -z-0"></div>
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 group-hover:rotate-12 transition-transform">
                                    <ShoppingCart size={24}/>
                                </div>
                                <div className="text-left">
                                    <h4 className="text-lg font-black tracking-tight leading-none">Convert to Sale</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-60">Generate tax invoice / receipt</p>
                                </div>
                            </div>
                            <div className="relative z-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <ChevronRight size={24} className="text-white"/>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDetailView;
