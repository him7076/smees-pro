import React, { useState } from 'react';
import { Users, Package, UserCircle, Search, Plus, Filter, ChevronRight, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const MasterModule = ({ data, setModal, setViewDetail }) => {
    const [view, setView] = useState('parties');
    const [search, setSearch] = useState('');

    const parties = data.parties || [];
    const items = data.items || [];
    const staff = data.staff || [];

    const filteredParties = parties.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || String(p.mobile || '').includes(search));
    const filteredItems = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
    const filteredStaff = staff.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-32">
            <div className="flex justify-between items-center gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Master Hub</h1>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Data Governance</p>
                </div>
                <button 
                    onClick={() => setModal({ type: view === 'parties' ? 'party' : view === 'items' ? 'item' : 'staff' })}
                    className="p-4 bg-slate-900 text-white rounded-[20px] shadow-xl shadow-slate-200 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"
                >
                    <Plus size={16}/> New {view.slice(0, -1)}
                </button>
            </div>

            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-inner">
                {[
                    { id: 'parties', label: 'Parties', icon: <Users size={14}/> },
                    { id: 'items', label: 'Items', icon: <Package size={14}/> },
                    { id: 'staff', label: 'Team', icon: <UserCircle size={14}/> }
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setView(t.id)} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${view === t.id ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                <input className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-[24px] text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300" placeholder={`Search ${view}...`} value={search} onChange={e => setSearch(e.target.value)}/>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {view === 'parties' && filteredParties.map(p => (
                    <div key={p.id} onClick={() => setViewDetail({ type: 'party', id: p.id })} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-2">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Users size={14}/>
                            </div>
                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">#{p.id?.slice(-4)}</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 tracking-tight truncate leading-none mb-1.5">{p.name}</h3>
                        <div className="space-y-0.5">
                            <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1.5"><Phone size={10} className="text-slate-200"/> {p.mobile || 'Private'}</p>
                            <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1.5 truncate"><MapPin size={10} className="text-slate-200"/> {p.address || 'Direct'}</p>
                        </div>
                    </div>
                ))}

                {view === 'items' && filteredItems.map(i => (
                    <div key={i.id} onClick={() => setViewDetail({ type: 'item', id: i.id })} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-2">
                            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                <Package size={14}/>
                            </div>
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Stk: 0</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 tracking-tight truncate leading-none mb-1">{i.name}</h3>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1">{i.category || 'General'}</p>
                        <div className="flex justify-between items-end mt-1">
                            <div>
                                <p className="text-[7px] font-black text-slate-400 uppercase">Sell</p>
                                <p className="text-xs font-black text-slate-900">{formatCurrency(i.sellPrice)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-300">{formatCurrency(i.buyPrice)}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {view === 'staff' && filteredStaff.map(s => (
                    <div key={s.id} onClick={() => setViewDetail({ type: 'staff', id: s.id })} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group active:scale-95">
                        <div className="flex justify-between items-start mb-2">
                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <ShieldCheck size={14}/>
                            </div>
                            <span className="text-[7px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-lg uppercase tracking-widest">{s.role}</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 tracking-tight truncate leading-none mb-1.5">{s.name}</h3>
                        <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1.5"><Phone size={10} className="text-slate-200"/> {s.mobile || 'Private'}</p>
                    </div>
                ))}
            </div>

            {((view === 'parties' && filteredParties.length === 0) || (view === 'items' && filteredItems.length === 0) || (view === 'staff' && filteredStaff.length === 0)) && (
                <div className="py-24 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-200">
                        <Search size={32}/>
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching records found</p>
                </div>
            )}
        </div>
    );
};

export default MasterModule;
