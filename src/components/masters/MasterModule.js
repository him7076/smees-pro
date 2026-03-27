import React, { useState } from 'react';
import { Users, Package, UserCircle, Search, Plus, Filter, ChevronRight, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const MasterModule = ({ data, setModal, setViewDetail }) => {
    const [view, setView] = useState('parties');
    const [search, setSearch] = useState('');

    const parties = data.parties || [];
    const items = data.items || [];
    const staff = data.staff || [];

    const filteredParties = parties.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.mobile?.includes(search));
    const filteredItems = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
    const filteredStaff = staff.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-32">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Master Repository</h1>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-2 ml-1">Central Data Governance</p>
                </div>
                <button 
                    onClick={() => setModal({ type: view === 'parties' ? 'party' : view === 'items' ? 'item' : 'staff' })}
                    className="p-4 bg-slate-900 text-white rounded-[24px] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                    <Plus size={20}/> New {view.slice(0, -1)}
                </button>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-[28px] shadow-inner">
                {[
                    { id: 'parties', label: 'Parties', icon: <Users size={16}/> },
                    { id: 'items', label: 'Inventory', icon: <Package size={16}/> },
                    { id: 'staff', label: 'Team', icon: <UserCircle size={16}/> }
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setView(t.id)} 
                        className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${view === t.id ? 'bg-white text-blue-600 shadow-xl scale-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18}/>
                <input className="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-[32px] text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder={`Search among ${view}...`} value={search} onChange={e => setSearch(e.target.value)}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {view === 'parties' && filteredParties.map(p => (
                    <div key={p.id} onClick={() => setViewDetail({ type: 'party', id: p.id })} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Users size={18}/>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">#{p.id}</span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 truncate">{p.name}</h3>
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2"><Phone size={12} className="text-slate-300"/> {p.mobile || 'No Contact'}</p>
                            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-2 truncate text-xs"><MapPin size={12} className="text-slate-300"/> {p.address || 'No Address'}</p>
                        </div>
                    </div>
                ))}

                {view === 'items' && filteredItems.map(i => (
                    <div key={i.id} onClick={() => setViewDetail({ type: 'item', id: i.id })} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-emerald-100 transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                <Package size={18}/>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">STK: 0</span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight mb-0.5 truncate">{i.name}</h3>
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-3">{i.category || 'General'}</p>
                        <div className="flex justify-between items-end border-t border-slate-50 pt-3 mt-3">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase">Sell Price</p>
                                <p className="text-sm font-black text-slate-900">{formatCurrency(i.sellPrice)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Buy Price</p>
                                <p className="text-xs font-bold text-slate-400">{formatCurrency(i.buyPrice)}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {view === 'staff' && filteredStaff.map(s => (
                    <div key={s.id} onClick={() => setViewDetail({ type: 'staff', id: s.id })} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <ShieldCheck size={18}/>
                            </div>
                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-widest">{s.role}</span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 truncate">{s.name}</h3>
                        <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2 mb-3"><Phone size={12} className="text-slate-300"/> {s.mobile}</p>
                    </div>
                ))}
            </div>

            {((view === 'parties' && filteredParties.length === 0) || (view === 'items' && filteredItems.length === 0) || (view === 'staff' && filteredStaff.length === 0)) && (
                <div className="py-32 text-center grayscale opacity-20">
                    <Search size={64} className="mx-auto mb-6" strokeWidth={1}/>
                    <p className="text-lg font-black uppercase tracking-[0.3em]">No records in this scope</p>
                </div>
            )}
        </div>
    );
};

export default MasterModule;
