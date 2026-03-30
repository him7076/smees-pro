import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings, 
  Search, 
  Calendar, 
  Users, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  Trash2 
} from 'lucide-react';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../../services/firebase';
import { formatCurrency, formatDate, checkPermission } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const TaskModule = ({ data, setData, user, setViewDetail, setModal }) => {
    const { deleteRecord } = useDatabase(data, setData);
    const [sort, setSort] = useState(localStorage.getItem('smees_task_sort') || 'DateAsc');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('To Do');
    const [viewMode, setViewMode] = useState('tasks');
    const [duplicateView, setDuplicateView] = useState(null); 
    const [amcSearch, setAmcSearch] = useState('');
    const [amcGroup, setAmcGroup] = useState(localStorage.getItem('smees_amc_group') || 'Month');

    useEffect(() => { localStorage.setItem('smees_task_sort', sort); }, [sort]);
    useEffect(() => { localStorage.setItem('smees_amc_group', amcGroup); }, [amcGroup]);

    const definedStatuses = data.categories.taskStatus || ["To Do", "In Progress", "Done"];
    const filterOptions = ['All', ...definedStatuses];
    if (!filterOptions.includes('Converted')) filterOptions.push('Converted');

    const filteredTasks = data.tasks.filter(t => {
        if (t.parentId) return false; 
        const clientName = data.parties.find(p => p.id === t.partyId)?.name || '';
        const searchText = search.toLowerCase();
        const matchesSearch = t.name.toLowerCase().includes(searchText) || t.description.toLowerCase().includes(searchText) || clientName.toLowerCase().includes(searchText);
        if (!matchesSearch) return false;
        if (statusFilter !== 'All') return t.status === statusFilter;
        if (statusFilter === 'All' && t.status === 'Converted') return false;
        return true;
    });
    
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (statusFilter === 'Converted') {
             const dateA = a.convertedDate || a.updatedAt || 0;
             const dateB = b.convertedDate || b.updatedAt || 0;
             return new Date(dateB) - new Date(dateA);
        }
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (sort === 'DateAsc' ? 9999999999999 : 0);
        if (sort === 'DateAsc') return dateA - dateB;
        if (sort === 'DateDesc') return dateB - dateA;
        if (sort === 'A-Z') return a.name.localeCompare(b.name);
        return 0;
    });

    const groupTasksByDate = (tasks) => {
        if(sort === 'A-Z') return { 'All Tasks': tasks };
        const groups = {};
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tmrwStr = tomorrow.toISOString().split('T')[0];

        tasks.forEach(t => {
            let key = t.dueDate ? t.dueDate : 'No Due Date';
            if (t.dueDate === today) key = 'Today';
            else if (t.dueDate === tmrwStr) key = 'Tomorrow';
            else if (t.dueDate && t.dueDate < today) key = 'Overdue / Past';
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });
        return groups;
    };

    const groupedTasks = groupTasksByDate(sortedTasks);
    const sortedKeys = Object.keys(groupedTasks).sort((a,b) => {
        if(a === 'Today') return -1;
        if(b === 'Today') return 1;
        if(a === 'Tomorrow') return -1;
        if(b === 'Tomorrow') return 1;
        if(a === 'No Due Date') return 1;
        if(b === 'No Due Date') return -1;
        return a.localeCompare(b);
    });

    const amcData = useMemo(() => {
        if (viewMode !== 'amc') return { grouped: {}, keys: [] };
        const list = [];
        const today = new Date();
        data.parties.forEach(p => {
            (p.assets || []).forEach(a => {
                const hasServiceDate = !!a.nextServiceDate;
                if (amcGroup === 'All' || hasServiceDate) {
                    const d = hasServiceDate ? new Date(a.nextServiceDate) : null;
                    const matchesSearch = !amcSearch || 
                        a.name.toLowerCase().includes(amcSearch.toLowerCase()) || 
                        p.name.toLowerCase().includes(amcSearch.toLowerCase());

                    if (matchesSearch) {
                        list.push({ 
                            party: p, 
                            asset: a, 
                            date: a.nextServiceDate, 
                            dateObj: d || new Date(9999, 11, 31),
                            isOverdue: d ? d < today : false 
                        });
                    }
                }
            });
        });

        list.sort((a,b) => a.dateObj - b.dateObj);
        const grouped = {};
        if (amcGroup === 'All') {
            grouped['All Assets'] = list;
        } else {
            list.forEach(item => {
                let key = 'Others';
                if (!item.date) key = 'No Service Date';
                else if(amcGroup === 'Date') key = formatDate(item.date);
                else if(amcGroup === 'Month') {
                    key = new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                }
                if(!grouped[key]) grouped[key] = [];
                grouped[key].push(item);
            });
        }
        return { grouped, keys: Object.keys(grouped) };
    }, [data.parties, viewMode, amcSearch, amcGroup]);

    const TaskItem = ({ task }) => { 
      const party = data.parties.find(p => p.id === task.partyId);
      let statusColor = 'bg-gray-300';
      let textTheme = 'text-gray-500';
      if(task.status === 'Done') { statusColor = 'bg-emerald-500'; textTheme = 'text-emerald-600'; }
      else if(task.status === 'In Progress') { statusColor = 'bg-blue-500'; textTheme = 'text-blue-600'; }
      else if(task.status === 'To Do') { statusColor = 'bg-amber-500'; textTheme = 'text-amber-600'; }
      else if(task.status === 'Converted') { statusColor = 'bg-purple-500'; textTheme = 'text-purple-600'; }
      
      return (
        <div onClick={() => setViewDetail({ type: 'task', id: task.id })} className="p-5 bg-white border border-gray-100 rounded-3xl mb-3 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all hover:shadow-md shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1.5 mb-2">
                <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full shadow-sm ${statusColor}`} />
                    <p className="font-extrabold text-gray-900 truncate">{task.name}</p>
                    <span className={`text-[9px] ${textTheme} px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-gray-50 border border-gray-100`}>{task.status}</span>
                </div>
                {party && (
                    <div className="flex items-center gap-2 ml-6">
                        <span className="text-[10px] bg-blue-50/50 text-blue-700 px-3 py-1 rounded-lg font-black tracking-tight truncate max-w-[200px] border border-blue-100/50 uppercase">{party.name}</span>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 line-clamp-1 ml-6 font-medium italic">"{task.description}"</p>
            <div className="flex gap-4 mt-3 ml-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><Calendar size={12} className="text-gray-400" /> {formatDate(task.dueDate)}</span>
                <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><Users size={12} className="text-gray-400" /> {task.assignedStaff?.length || 0} Team</span>
            </div>
          </div>
          <div className="ml-4 flex flex-col items-end gap-2">
            <p className="text-[9px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl font-black shadow-inner uppercase">#{task.id}</p>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 px-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Workflow</h1>
            <div className="flex gap-3 items-center w-full sm:w-auto">
                {checkPermission(user, 'canEditTasks') && (
                    <>
                        <button onClick={() => setModal({ type: 'task' })} className="flex-1 sm:flex-none p-4 sm:p-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 hover:bg-blue-700">
                             <Plus size={20}/> New Task
                        </button>
                        <div className="relative group">
                            <button className="p-3 bg-white border border-gray-100 text-gray-600 rounded-2xl hover:bg-gray-50 shadow-sm transition-all focus:ring-4 focus:ring-gray-100"><Settings size={22} /></button>
                            <div className="absolute right-0 top-14 mt-1 hidden group-hover:block bg-white border border-gray-100 rounded-3xl shadow-2xl w-64 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => setModal({ type: 'taskSettings' })} className="w-full text-left px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50"><Settings size={16}/> Settings</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner">
            <button onClick={()=>setViewMode('tasks')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewMode==='tasks' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>My Backlog</button>
            {user.role === 'admin' && (
                <button onClick={()=>setViewMode('amc')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewMode==='amc' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>AMC / Assets</button>
            )}
        </div>

          {viewMode === 'amc' && (
             <div className="flex gap-3 mb-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-50">
                 <button onClick={()=>setAmcGroup('Month')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${amcGroup !== 'All' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-gray-600'}`}>Upcoming</button>
                 <button onClick={()=>setAmcGroup('All')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${amcGroup === 'All' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-gray-600'}`}>Full Inventory</button>
             </div>
        )}

        {viewMode === 'tasks' ? (
            <>
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                        <input className="w-full pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-medium shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Search backlog..." value={search} onChange={e => setSearch(e.target.value)}/>
                    </div>
                    <select className="bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest p-3.5 rounded-2xl outline-none shadow-sm transition-all focus:ring-4 focus:ring-gray-100" value={sort} onChange={e => setSort(e.target.value)}>
                        <option value="DateAsc">Due Soon</option>
                        <option value="DateDesc">Due Later</option>
                        <option value="A-Z">Alphabetical</option>
                    </select>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide items-center">
                    {filterOptions.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all duration-300 ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>{s}</button>
                    ))}

                    {statusFilter === 'Converted' && (
                        <button onClick={() => {
                            const duplicates = {};
                            data.tasks.forEach(t => { if(t.generatedSaleId) duplicates[t.generatedSaleId] = (duplicates[t.generatedSaleId] || 0) + 1; });
                            const dupIds = Object.keys(duplicates).filter(id => duplicates[id] > 1);
                            const dupTasks = data.tasks.filter(t => dupIds.includes(t.generatedSaleId));
                            if(dupTasks.length === 0) alert("Clean architecture! No duplicates found.");
                            else setDuplicateView(dupTasks);
                        }} className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100 text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 hover:bg-rose-100 transition-all">
                            <AlertTriangle size={14}/> Audit Duplicates
                        </button>
                    )}
                </div>

                {duplicateView && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6 animate-in fade-in">
                        <div className="bg-white rounded-[32px] p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl relative">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl"><AlertTriangle size={24}/></div>
                                    <h3 className="font-extrabold text-xl text-slate-900">Duplicate Audit</h3>
                                </div>
                                <button onClick={() => setDuplicateView(null)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                            </div>
                            <div className="space-y-4">
                                {duplicateView.map(t => (
                                    <div key={t.id} className="p-5 bg-rose-50/50 border border-rose-100 rounded-[24px] flex justify-between items-center group hover:bg-rose-50 transition-all">
                                        <div>
                                            <p className="font-black text-xs text-rose-900 uppercase tracking-widest mb-1">Task Context ID: #{t.id}</p>
                                            <p className="text-sm font-bold text-slate-600">Locked Inv: <span className="text-rose-600 font-extrabold">{t.generatedSaleId}</span></p>
                                        </div>
                                        <button onClick={async () => {
                                            if(!window.confirm(`Force clear Invoice ID from Task #${t.id}?`)) return;
                                            const updatedTask = { ...t, generatedSaleId: null, status: 'Done' }; 
                                            await setDoc(doc(db, "tasks", t.id), updatedTask);
                                            setDuplicateView(prev => prev.filter(x => x.id !== t.id));
                                        }} className="px-5 py-2.5 bg-white border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm">Fix Leak</button>
                                    </div>
                                ))}
                                {duplicateView.length === 0 && <p className="text-center text-emerald-600 font-black uppercase tracking-widest py-8">Audit Complete. System Balanced.</p>}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="space-y-8 pb-32">
                    {sortedKeys.map(groupKey => (
                        <div key={groupKey} className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 mt-6 ml-2 flex items-center gap-2">
                                <span className="w-8 h-[1px] bg-gray-100"></span>
                                {groupKey}
                            </h3>
                            <div className="space-y-3">
                                {groupedTasks[groupKey].map(t => <TaskItem key={t.id} task={t} />)}
                            </div>
                        </div>
                    ))}
                    {sortedTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 opacity-20 grayscale">
                            <CheckCircle2 size={80} strokeWidth={1}/>
                            <p className="text-lg font-black uppercase tracking-widest mt-6">Backlog Empty</p>
                        </div>
                    )}
                </div>
            </>
        ) : (
            <div className="space-y-4 pb-32">
                <div className="flex gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                        <input className="w-full pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-medium shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Search assets or clients..." value={amcSearch} onChange={e=>setAmcSearch(e.target.value)} />
                    </div>
                    <select className="bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest p-3.5 rounded-2xl outline-none shadow-sm transition-all focus:ring-4 focus:ring-gray-100" value={amcGroup} onChange={e=>setAmcGroup(e.target.value)}>
                        <option value="Date">By Schedule</option>
                        <option value="Week">Week View</option>
                        <option value="Month">Month View</option>
                    </select>
                </div>

                {amcData.keys.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-[32px] border border-gray-50 shadow-sm">
                        <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">No active AMC schedules found.</p>
                    </div>
                )}
                
                {amcData.keys.map(groupKey => (
                    <div key={groupKey} className="animate-in fade-in duration-500">
                        <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 mt-8 ml-2 sticky top-4 bg-gray-50/80 backdrop-blur-xl py-2 z-10 rounded-full px-6 border border-indigo-100 inline-block">
                            {groupKey}
                        </h3>
                        <div className="space-y-3">
                            {amcData.grouped[groupKey].map((item, idx) => {
                                const existingTask = data.tasks.find(t => {
                                    const isSameParty = t.partyId === item.party.id;
                                    const isSameAsset = t.linkedAssetStr === item.asset.name;
                                    const isOpen = t.status !== 'Converted' && t.status !== 'Cancelled'; 
                                    return isSameParty && isSameAsset && isOpen;
                                });
                                
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => setViewDetail({ type: 'party', id: item.party.id, openAsset: item.asset.name })}
                                        className={`p-6 bg-white border rounded-[28px] flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all hover:shadow-xl group ${item.isOverdue ? 'border-rose-100 bg-rose-50/30' : 'border-gray-50 shadow-md'}`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight break-words">{item.asset.name}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-extrabold uppercase tracking-tight">{item.party.name}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                    <Calendar size={12}/> {formatDate(item.date)}
                                                    {item.isOverdue && <span className="text-rose-600 ml-2 font-black">[Overdue]</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{item.asset.brand}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="ml-4">
                                            {existingTask ? (
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setViewDetail({ type: 'task', id: existingTask.id }); }}
                                                        className="px-6 py-2.5 bg-emerald-100 text-emerald-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-200 transition-all shadow-sm"
                                                    >
                                                        <CheckCircle2 size={16}/> Active Case
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); if(window.confirm('Terminate active task link?')) deleteRecord('tasks', existingTask.id); }}
                                                        className="p-2.5 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100"
                                                    >
                                                        <Trash2 size={18}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        setModal({
                                                            type: 'task',
                                                            data: {
                                                                name: `Service: ${item.asset.name}`,
                                                                partyId: item.party.id,
                                                                description: `Scheduled maintenance for ${item.asset.brand}. Schedule: ${item.date}`,
                                                                dueDate: item.date,
                                                                status: 'To Do',
                                                                linkedAssetStr: item.asset.name 
                                                            }
                                                        });
                                                    }}
                                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all hover:bg-indigo-700"
                                                >
                                                    Create Task
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    );
};

export default TaskModule;
