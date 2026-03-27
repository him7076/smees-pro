import React from 'react';
import { ArrowLeft, RefreshCw, MessageCircle, MoreHorizontal, Edit2, Trash2, Clock, CheckCircle2, AlertCircle, Play, Square, MapPin, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const TaskDetailView = ({ task, data, user, onBack, setViewDetail, setModal, deleteRecord, showToast, toggleTimer, checkPermission, refreshSingleRecord }) => {
    if (!task) return null;

    const party = data.parties.find(p => p.id === task.partyId);
    const subTasks = data.tasks.filter(t => t.parentId === task.id);
    const logs = task.timeLogs || [];

    const isMyTimerRunning = logs.some(l => l.staffId === user?.id && !l.end);

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                    <h2 className="font-black text-slate-800 tracking-tight">Task View</h2>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={async () => {
                            showToast("Syncing Task...");
                            await refreshSingleRecord('tasks', task.id);
                            showToast("Synced Successfully");
                        }} 
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                        <RefreshCw size={20}/>
                    </button>
                    {checkPermission(user, 'canEditTasks') && (
                        <button onClick={() => setModal({ type: 'task', data: task })} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
                            <Edit2 size={20}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 max-w-2xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-4`}>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            task.status === 'Done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                            {task.status}
                        </span>
                    </div>
                    
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 pr-24">{task.name}</h1>
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                        {task.priority && (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                task.priority === 'High' ? 'bg-rose-100 text-rose-600' :
                                task.priority === 'Low' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {task.priority} Priority
                            </span>
                        )}
                        {task.estimateTime && (
                           <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                               <Clock size={12}/> Est: {task.estimateTime}
                           </span>
                        )}
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black tracking-widest uppercase">ID: {task.id}</span>
                    </div>

                    <p className="text-slate-600 leading-relaxed text-sm font-medium">{task.description || 'No description provided.'}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div onClick={() => { if(user?.role === 'admin' && task.partyId) setViewDetail({ type: 'party', id: task.partyId }); }} className={`p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all ${user?.role === 'admin' ? 'cursor-pointer hover:bg-slate-50 active:scale-[0.98]' : ''}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Client Info</p>
                        <p className="font-black text-slate-800 tracking-tight">{party?.name || 'Walk-in Client'}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">{party?.mobile || 'No contact'}</p>
                        {party?.address && (
                            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-50">
                                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5"/>
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">{party.address}</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-900 rounded-[24px] text-white flex flex-col justify-between shadow-xl shadow-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Session</p>
                        <div className="my-4">
                            {isMyTimerRunning ? (
                                <p className="text-emerald-400 text-xs font-black animate-pulse flex items-center gap-2">● TIMER ACTIVE</p>
                            ) : (
                                <p className="text-slate-400 text-xs font-black italic">No active session</p>
                            )}
                        </div>
                        <button 
                            onClick={() => toggleTimer(user?.id)}
                            className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                                isMyTimerRunning ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                            }`}
                        >
                            {isMyTimerRunning ? <><Square size={16} fill="white"/> Stop Timer</> : <><Play size={16} fill="white"/> Start Timer</>}
                        </button>
                    </div>
                </div>

                {subTasks.length > 0 && (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-tasks Breakdown</p>
                            <span className="bg-white border px-2 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase">{subTasks.length} ITEMS</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {subTasks.map(st => (
                                <div key={st.id} onClick={() => setViewDetail({ type: 'task', id: st.id })} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${st.status === 'Done' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <div>
                                            <p className={`text-sm font-black text-slate-800 ${st.status === 'Done' ? 'line-through opacity-50' : ''}`}>{st.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{st.status}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-slate-500 transition-colors"/>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {logs.length > 0 && (
                    <div className="bg-blue-50 rounded-[32px] border border-blue-100 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Productivity Logs</p>
                        </div>
                        <div className="space-y-3">
                            {logs.sort((a,b) => new Date(b.start) - new Date(a.start)).map((log, i) => (
                                <div key={i} className="p-4 bg-white rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-black">{log.staffName?.charAt(0)}</div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800">{log.staffName}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                {formatDate(log.start)} • {log.duration || 0} mins
                                            </p>
                                        </div>
                                    </div>
                                    {log.location && (
                                        <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors">
                                            <MapPin size={16} />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskDetailView;
