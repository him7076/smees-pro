import React, { useState } from 'react';
import { 
    Plus, Search, Calendar, CheckCircle2, 
    X, ArrowLeft, Trash2, Clock, ShieldCheck 
} from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { formatDate } from '../../utils/helpers';

const PersonalTasksView = ({ data, setData, onBack, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('To Do');

    const tasks = data.personalTasks || [];
    
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                             t.description.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' ? true : t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        return dateA - dateB;
    });

    return (
        <div className="fixed inset-0 z-[150] bg-white flex flex-col animate-in slide-in-from-right duration-300">
            {/* STICKY HEADER */}
            <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><ArrowLeft size={24} /></button>
                    <div>
                        <h2 className="font-black text-slate-900 uppercase tracking-widest text-sm leading-none">Private Tasks</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{filteredTasks.length} Active Items</p>
                    </div>
                </div>
                <button 
                    onClick={() => setModal({ type: 'task', context: 'personal' })} 
                    className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all"
                >
                    <Plus size={20}/>
                </button>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="p-4 space-y-4 bg-slate-50/50 border-b border-slate-100">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm" 
                        placeholder="Search private backlog..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {['All', 'To Do', 'In Progress', 'Done'].map(s => (
                        <button 
                            key={s} 
                            onClick={() => setStatusFilter(s)} 
                            className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                                statusFilter === s 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* TASK LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white pb-24">
                {sortedTasks.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => setModal({ type: 'task', data: t, context: 'personal' })}
                        className="p-4 bg-white border border-slate-100 rounded-[28px] shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex justify-between items-center group"
                    >
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${t.status === 'Done' ? 'bg-emerald-500' : t.status === 'In Progress' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                <h3 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{t.name}</h3>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 font-bold mb-3">"{t.description || 'No description provided'}"</p>
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase flex items-center gap-1.5">
                                    <Calendar size={12}/> {formatDate(t.dueDate)}
                                </span>
                                {t.priority && (
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase ${
                                        t.priority === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                        t.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                        {t.priority}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete private task?')) deleteRecord('personalTasks', t.id, 'task'); }}
                                className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}

                {sortedTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                        <CheckCircle2 size={64} strokeWidth={1}/>
                        <p className="text-xs font-black uppercase tracking-[0.2em] mt-4 text-center">Zen Space Clear<br/>No {statusFilter} Tasks</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalTasksView;
