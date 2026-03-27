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

    if (!task) return null;

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
                    {task.status !== 'Converted' && (
                        <button 
                            onClick={() => setModal({ type: 'convertTask', data: task })}
                            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                            <ShoppingCart size={16}/> Convert to Sale
                        </button>
                    )}
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
                {/* PRIMARY INFO CARD */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            task.status === 'Done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50 shadow-lg' :
                            task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-blue-50 shadow-lg' :
                            'bg-amber-50 text-amber-700 border-amber-100 shadow-amber-50 shadow-lg'
                        }`}>
                            {task.status}
                        </span>
                    </div>

                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 pr-32">{task.name}</h1>
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                        {task.priority && (
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                task.priority === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                task.priority === 'Medium' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                {task.priority} Priority
                            </span>
                        )}
                        {task.estimateTime && (
                           <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                               <Clock size={12}/> Est: {task.estimateTime}
                           </span>
                        )}
                        {task.assignedStaff?.length > 0 && (
                            <div className="flex gap-1 items-center">
                                {task.assignedStaff.map(sid => {
                                    const s = data.staff.find(sm => sm.id === sid);
                                    return <span key={sid} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black border border-indigo-100 uppercase truncate max-w-[80px]">{s?.name || 'User'}</span>;
                                })}
                            </div>
                        )}
                    </div>

                    <p className="text-slate-600 leading-relaxed text-sm font-medium border-t border-slate-50 pt-6">{task.description || 'No brief provided.'}</p>
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
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden transition-all">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-50 pb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Interface</p>
                                    {task.locationLabel && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">{task.locationLabel}</span>}
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{party?.name || 'Ad-hoc Client'}</h3>
                            </div>
                            {(task.location || party?.lat) && (
                                <a href={`https://www.google.com/maps?q=${task.location?.lat || party?.lat},${task.location?.lng || party?.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest">
                                    <MapPin size={18} fill="white"/> Navigate
                                </a>
                            )}
                        </div>

                        {/* Contacts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {((task.selectedContacts?.length > 0) ? task.selectedContacts : [{ label: 'Primary', number: party?.mobile }]).filter(c => c.number).map((c, i) => (
                                <a key={i} href={`tel:${c.number}`} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl hover:bg-slate-100 transition-all group">
                                    <div className="w-10 h-10 bg-white text-slate-400 rounded-xl flex items-center justify-center shadow-sm group-hover:text-blue-600"><Phone size={18}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{c.label}</p>
                                        <p className="text-sm font-black text-slate-800">{c.number}</p>
                                    </div>
                                </a>
                            ))}
                        </div>

                        {(task.address || party?.address) && (
                            <div className="mt-6 flex items-start gap-3 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                                <MapPin size={16} className="text-blue-500 mt-1 shrink-0"/>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed">{task.address || party?.address}</p>
                            </div>
                        )}
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

                {/* SUB TASKS SECTION */}
                {!task.parentId && (
                    <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Component Tasks</p>
                            <button onClick={() => setModal({ type: 'task', data: { parentId: task.id, partyId: task.partyId } })} className="p-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase active:scale-90 transition-all"><Plus size={18}/></button>
                        </div>
                        <div className="px-4 pb-6 space-y-3">
                            {subTasks.map(st => (
                                <div key={st.id} onClick={() => setViewDetail({ type: 'task', id: st.id })} className="p-5 bg-slate-50 rounded-[28px] border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-white transition-all hover:shadow-xl hover:border-blue-100 active:scale-[0.98]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${st.status === 'Done' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {st.status === 'Done' ? <CheckCircle2 size={18}/> : <RefreshCw size={18}/>}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-black text-slate-800 tracking-tight ${st.status === 'Done' ? 'line-through opacity-40' : ''}`}>{st.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{st.status}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors"/>
                                </div>
                            ))}
                            {subTasks.length === 0 && <p className="text-center py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-50">Operational - No Sub-tasks</p>}
                        </div>
                    </div>
                )}

                {/* TIME LOGS RE-IMAGINED */}
                <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency Ledger</p>
                        <button onClick={() => setShowLogs(!showLogs)} className="text-[9px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl active:scale-95 transition-all">{showLogs ? 'Minimize' : 'Expose Logs'}</button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {Object.entries(staffSummary).map(([name, mins]) => (
                            <div key={name} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase">{name}: </span>
                                <span className="text-[11px] font-black text-slate-900">{formatMins(mins)}</span>
                            </div>
                        ))}
                    </div>

                    {showLogs && (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide animate-in slide-in-from-top-2">
                            {(task.timeLogs || []).sort((a,b) => new Date(b.start) - new Date(a.start)).map((log, idx) => (
                                <div key={idx} className="p-5 bg-slate-50/50 border border-slate-50 rounded-[28px] flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100"><Clock size={20}/></div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 tracking-tight">{log.staffName}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{formatTime(log.start)} - {log.end ? formatTime(log.end) : 'Running'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-slate-900 bg-white border border-slate-100 px-3 py-1.5 rounded-xl">{formatMins(log.duration)}</span>
                                        {log.location && (
                                            <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MapPin size={16}/></a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ITEMS USED & P&L - ADMIN ONLY */}
                {user.role === 'admin' && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-[40px] p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Job Costing & Parts</p>
                            <button onClick={() => setShowItems(!showItems)} className="text-[9px] font-black text-emerald-700 bg-white border border-emerald-200 px-4 py-2 rounded-xl active:scale-95 transition-all">{showItems ? 'Hide Analysis' : 'Show Analysis'}</button>
                        </div>

                        {showItems && (
                            <div className="space-y-4">
                                {(task.itemsUsed || []).map((line, idx) => {
                                    const profit = (parseFloat(line.price||0) - parseFloat(line.buyPrice||0)) * parseFloat(line.qty||0);
                                    return (
                                        <div key={idx} className="bg-white p-5 rounded-[32px] border border-emerald-100 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Product</p>
                                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{data.items.find(i=>i.id===line.itemId)?.name || 'Generic Item'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Profitability</p>
                                                    <p className={`text-xs font-black ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(profit)}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase">Qty</p>
                                                    <p className="text-xs font-black text-slate-900">{line.qty}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase">Rate</p>
                                                    <p className="text-xs font-black text-slate-900">{formatCurrency(line.price)}</p>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase">Invoiced</p>
                                                    <p className="text-xs font-black text-slate-900">{formatCurrency(line.qty * line.price)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="pt-6 border-t border-emerald-200 flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Total Valuation</p>
                                        <h3 className="text-4xl font-black text-emerald-900 tracking-tighter">
                                            {formatCurrency((task.itemsUsed || []).reduce((acc, l) => acc + (parseFloat(l.qty||0)*parseFloat(l.price||0)), 0))}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Job Margin</p>
                                        <p className="text-xl font-black text-emerald-800">
                                            {formatCurrency((task.itemsUsed || []).reduce((acc, l) => acc + (parseFloat(l.qty||0)*(parseFloat(l.price||0)-parseFloat(l.buyPrice||0))), 0))}
                                        </p>
                                    </div>
                                </div>
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
            </div>
        </div>
    );
};

export default TaskDetailView;
