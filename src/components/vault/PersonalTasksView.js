import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Plus, CheckCircle2, Circle, CheckSquare, 
  Trash2, Edit2, Calendar, LayoutGrid, List, User, Lock, Save, X
} from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const PersonalTasksView = ({ data, setData, onBack }) => {
    const { saveRecord, deleteRecord } = useDatabase(data, setData);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('To Do');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    const tasks = data.personalTasks || [];

    const filtered = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'All' || t.status === filter;
            return matchesSearch && matchesFilter;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [tasks, search, filter]);

    const handleToggleDone = async (task) => {
        const updated = { ...task, status: task.status === 'Done' ? 'To Do' : 'Done' };
        await saveRecord('personalTasks', updated, 'personalTask');
    };

    return (
        <div className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Private Backlog</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Vault Task Sync</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/20 active:scale-95 transition-all"><Plus size={20}/></button>
            </div>

            <div className="p-6 space-y-6 pb-20">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                    <input className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Search private items..." value={search} onChange={e => setSearch(e.target.value)}/>
                </div>

                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                    {['To Do', 'Done', 'All'].map(s => (
                        <button key={s} onClick={() => setFilter(s)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{s}</button>
                    ))}
                </div>

                <div className="space-y-3">
                    {filtered.map((t, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex justify-between items-center group transition-all hover:shadow-xl hover:border-blue-100/50 active:scale-[0.98]">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <button onClick={() => handleToggleDone(t)} className={`transition-all duration-300 ${t.status === 'Done' ? 'text-emerald-500' : 'text-slate-200'}`}>
                                    {t.status === 'Done' ? <CheckCircle2 size={28} strokeWidth={2.5}/> : <Circle size={28} strokeWidth={2.5}/>}
                                </button>
                                <div className="min-w-0">
                                    <p className={`text-sm font-black uppercase tracking-tight truncate ${t.status === 'Done' ? 'text-slate-300 line-through decoration-emerald-500/30' : 'text-slate-800'}`}>{t.name}</p>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 mt-0.5">
                                        <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(t.date)}</span>
                                        {t.description && <span className="flex items-center gap-1 italic truncate max-w-[150px]">"{t.description}"</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingTask(t); setShowForm(true); }} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                                <button onClick={() => deleteRecord('personalTasks', t.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><CheckSquare className="text-slate-200" size={40}/></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching private tasks</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Simple Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingTask ? 'Revise Task' : 'New Vault Task'}</h3>
                            <button onClick={() => { setShowForm(false); setEditingTask(null); }} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                        </div>
                        <form className="space-y-4" onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const taskData = {
                                id: editingTask?.id || null,
                                name: formData.get('name'),
                                description: formData.get('description'),
                                date: formData.get('date') || new Date().toISOString().split('T')[0],
                                status: editingTask?.status || 'To Do',
                                updatedAt: new Date().toISOString()
                            };
                            if(!taskData.name) return alert("Context required");
                            await saveRecord('personalTasks', taskData, 'personalTask');
                            setShowForm(false);
                            setEditingTask(null);
                        }}>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Context</label>
                                <input name="name" defaultValue={editingTask?.name} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="What needs to be done?" required autoFocus />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                                <textarea name="description" defaultValue={editingTask?.description} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Optional details..." rows={2} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Date</label>
                                <input name="date" type="date" defaultValue={editingTask?.date || new Date().toISOString().split('T')[0]} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" />
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                <Save size={20}/> Commit to Vault
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalTasksView;
