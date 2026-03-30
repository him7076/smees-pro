import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const TaskSettings = ({ data, setData, onClose }) => {
    const [statusInput, setStatusInput] = useState('');
    const [priorityInput, setPriorityInput] = useState('');
    const [activeTab, setActiveTab] = useState('status');

    const categories = data.categories || {};
    const taskStatus = categories.taskStatus || ["To Do", "In Progress", "Done"];
    const taskPriority = categories.taskPriority || ["High", "Medium", "Low"];

    const updateCategories = async (updated) => {
        setData(prev => ({ ...prev, categories: updated }));
        await setDoc(doc(db, "settings", "categories"), updated, { merge: true });
    };

    const addStatus = () => {
        if (!statusInput.trim()) return;
        if (taskStatus.includes(statusInput.trim())) return alert("Already exists");
        updateCategories({ ...categories, taskStatus: [...taskStatus, statusInput.trim()] });
        setStatusInput('');
    };

    const deleteStatus = (s) => {
        if (!window.confirm(`Delete status "${s}"?`)) return;
        updateCategories({ ...categories, taskStatus: taskStatus.filter(x => x !== s) });
    };

    const addPriority = () => {
        if (!priorityInput.trim()) return;
        if (taskPriority.includes(priorityInput.trim())) return alert("Already exists");
        updateCategories({ ...categories, taskPriority: [...taskPriority, priorityInput.trim()] });
        setPriorityInput('');
    };

    const deletePriority = (p) => {
        if (!window.confirm(`Delete priority "${p}"?`)) return;
        updateCategories({ ...categories, taskPriority: taskPriority.filter(x => x !== p) });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in slide-in-from-right duration-300">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-4 shadow-sm flex justify-between items-center bg-white/80 backdrop-blur-xl">
                 <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Settings Master</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Operational Parameters</p>
                </div>
                <button onClick={onClose} className="p-3 bg-slate-100 text-slate-400 rounded-2xl active:scale-95 transition-all"><X size={20}/></button>
            </div>

            <div className="p-4 md:p-10 max-w-2xl mx-auto w-full space-y-8 pb-32">
                 <div className="bg-white p-1.5 rounded-2xl flex shadow-inner mb-6">
                    <button onClick={() => setActiveTab('status')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'status' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>Manage Status</button>
                    <button onClick={() => setActiveTab('priority')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'priority' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>Manage Priority</button>
                 </div>

                 {activeTab === 'status' ? (
                     <div className="space-y-6">
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-black text-sm outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-slate-800" 
                                placeholder="New Status Name..." 
                                value={statusInput} 
                                onChange={e => setStatusInput(e.target.value)}
                            />
                            <button onClick={addStatus} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 py-4 active:scale-95 transition-all"><Plus size={20}/></button>
                        </div>

                        <div className="space-y-2">
                             {taskStatus.map(s => (
                                 <div key={s} className="p-5 bg-white border border-slate-100 rounded-[28px] flex justify-between items-center group shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                                     <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/50 shadow-sm"><CheckCircle2 size={18}/></div>
                                         <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{s}</span>
                                     </div>
                                     {!["To Do", "In Progress", "Done"].includes(s) && (
                                         <button onClick={() => deleteStatus(s)} className="p-2.5 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                                     )}
                                 </div>
                             ))}
                        </div>
                     </div>
                 ) : (
                     <div className="space-y-6">
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-black text-sm outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-slate-800" 
                                placeholder="New Priority Name..." 
                                value={priorityInput} 
                                onChange={e => setPriorityInput(e.target.value)}
                            />
                            <button onClick={addPriority} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 py-4 active:scale-95 transition-all"><Plus size={20}/></button>
                        </div>

                        <div className="space-y-2">
                             {taskPriority.map(p => (
                                 <div key={p} className="p-5 bg-white border border-slate-100 rounded-[28px] flex justify-between items-center group shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                                     <div className="flex items-center gap-4">
                                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm ${p === 'High' ? 'bg-rose-50 text-rose-500 border-rose-100' : p === 'Medium' ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                                            <AlertTriangle size={18}/>
                                         </div>
                                         <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{p}</span>
                                     </div>
                                     {!["High", "Medium", "Low"].includes(p) && (
                                         <button onClick={() => deletePriority(p)} className="p-2.5 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
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

export default TaskSettings;
