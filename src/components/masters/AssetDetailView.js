import React, { useMemo } from 'react';
import { 
  X, Edit2, Trash2, Package, Calendar, History, ArrowRight, TrendingUp, TrendingDown, Landmark, Smartphone 
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const AssetDetailView = ({ data, setData, asset, party, onClose, setModal, setViewDetail }) => {
    // Collect all transactions linked to this specific asset
    const linkedTxs = useMemo(() => {
        return (data.transactions || []).filter(t => 
            t.linkedAssets && t.linkedAssets.some(a => a.name === asset.name) && t.partyId === party.id
        ).sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [data.transactions, asset.name, party.id]);

    const handleDelete = async () => {
        if(!window.confirm(`Permanently remove asset "${asset.name}" from ${party.name}?`)) return;
        
        const nextAssets = party.assets.filter(a => a.name !== asset.name);
        const updatedParty = { ...party, assets: nextAssets, updatedAt: new Date().toISOString() };
        
        // Save to Firebase (Business)
        const { doc, setDoc } = require("firebase/firestore");
        const { db } = require("../../services/firebase");
        await setDoc(doc(db, "parties", party.id), updatedParty, { merge: true });
        
        setData(prev => ({
            ...prev,
            parties: prev.parties.map(p => p.id === party.id ? updatedParty : p)
        }));
        onClose();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Package size={24}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">{asset.name}</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Asset of {party.name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'asset', data: { party, record: asset } })} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:text-blue-600 transition-all active:scale-90 shadow-sm"><Edit2 size={18}/></button>
                    <button onClick={handleDelete} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:text-rose-600 transition-all active:scale-90 shadow-sm"><Trash2 size={18}/></button>
                    <button onClick={onClose} className="p-3 bg-slate-900 text-white rounded-xl active:scale-90 shadow-lg"><X size={18}/></button>
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
                {/* Status Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                        <Calendar size={14} className="text-blue-500 mb-2"/>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Service</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{linkedTxs[0] ? formatDate(linkedTxs[0].date) : 'No Records'}</p>
                    </div>
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                        <Package size={14} className="text-indigo-500 mb-2"/>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Service Latency</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{asset.serviceInterval || 3} Months</p>
                    </div>
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                        <History size={14} className="text-emerald-500 mb-2"/>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Lifetime Count</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{linkedTxs.length} Entries</p>
                    </div>
                    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm relative group">
                        <Landmark size={14} className="text-rose-500 mb-2"/>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Value Impact</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(linkedTxs.reduce((s,t) => s + (parseFloat(t.finalTotal || t.amount || 0)), 0))}</p>
                        <button 
                            onClick={() => {
                                const msg = `Service Reminder: Your Asset *${asset.name}* (${asset.brand} / ${asset.model}) is due for service on *${formatDate(asset.nextServiceDate)}*. Please schedule maintenance to ensure optimal performance. - Sent via SMEES ERP`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                            className="absolute -top-2 -right-2 p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                            title="Send WhatsApp Reminder"
                        >
                            <Smartphone size={14}/>
                        </button>
                    </div>
                </div>

                {/* Ledger History */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end px-2">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Asset Service Ledger</h2>
                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">Full Traceability</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {linkedTxs.length === 0 ? (
                            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                                <History size={40} className="mx-auto text-slate-100 mb-4"/>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No maintenance history recorded for this asset</p>
                            </div>
                        ) : (
                            linkedTxs.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => setViewDetail({ type: 'transaction', id: t.id })}
                                    className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${t.type === 'sales' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {t.type === 'sales' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{t.id} | {formatDate(t.date)}</p>
                                            <h4 className="text-sm font-black text-slate-900 tracking-tight mt-0.5">{t.type === 'sales' ? 'Commercial Service' : 'Expense / Upgrade'}</h4>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900">{formatCurrency(t.finalTotal || t.amount)}</p>
                                        <div className="flex items-center justify-end gap-1 mt-1 text-blue-600 group-hover:gap-2 transition-all">
                                            <span className="text-[8px] font-black uppercase">View Trail</span>
                                            <ArrowRight size={10}/>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailView;
