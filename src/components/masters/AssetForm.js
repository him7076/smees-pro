import React, { useState } from 'react';
import { X, Save, ShieldCheck, Clock, Settings, Package, Trash2 } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const AssetForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    
    // record can be { partyId: '...' } for NEW
    // or { ...asset, partyId: '...', assetIndex: 0 } for EDIT
    const partyId = record?.partyId;
    const isEdit = record?.assetIndex !== undefined;

    const [form, setForm] = useState({
        name: '',
        brand: '',
        model: '',
        serialNo: '',
        serviceInterval: 3,
        lastServiceDate: new Date().toISOString().split('T')[0],
        nextServiceDate: '',
        ...(record || {})
    });

    const party = data.parties.find(p => p.id === partyId);

    const handleSave = async () => {
        if (!form.name) return alert("Asset Name is required");
        if (!party) return alert("Party not found");

        let updatedAssets = [...(party.assets || [])];
        
        // Remove helper fields before saving to DB
        const { partyId: _p, assetIndex: _i, ...assetToSave } = form;

        // Auto-calculate next service if changed lastService or interval
        if (!assetToSave.nextServiceDate || assetToSave.lastServiceDate !== record?.lastServiceDate || assetToSave.serviceInterval !== record?.serviceInterval) {
            const ns = new Date(assetToSave.lastServiceDate);
            ns.setMonth(ns.getMonth() + parseInt(assetToSave.serviceInterval || 3));
            assetToSave.nextServiceDate = ns.toISOString().split('T')[0];
        }

        if (isEdit) {
            updatedAssets[record.assetIndex] = assetToSave;
        } else {
            updatedAssets.push(assetToSave);
        }

        try {
            await saveRecord('parties', { ...party, assets: updatedAssets }, 'party');
            onClose();
        } catch (error) {
            console.error("Asset Save Failed", error);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Remove this asset forever?")) return;
        let updatedAssets = party.assets.filter((_, i) => i !== record.assetIndex);
        await saveRecord('parties', { ...party, assets: updatedAssets }, 'party');
        onClose();
    };

    return (
        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
            <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -z-0"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover:rotate-12 transition-transform">
                        <Settings size={32} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-2 leading-none">Operational Unit</p>
                        <h2 className="text-3xl font-black tracking-tighter">{isEdit ? 'Asset Override' : 'Asset Registry'}</h2>
                    </div>
                    {isEdit && (
                        <button onClick={handleDelete} className="p-4 bg-rose-500/20 text-rose-400 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                            <Trash2 size={24} />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Package size={12}/> Primary Identifier</label>
                    <input 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. 2.0 Ton AC - Lobby" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><ShieldCheck size={12}/> Brand / OEM</label>
                    <input 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. Daikin / Voltas" 
                        value={form.brand} 
                        onChange={e => setForm({...form, brand: e.target.value})} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Model Number</label>
                    <input 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. FTKF-50" 
                        value={form.model} 
                        onChange={e => setForm({...form, model: e.target.value})} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Serial / Unit ID</label>
                    <input 
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. NX-102554-A" 
                        value={form.serialNo} 
                        onChange={e => setForm({...form, serialNo: e.target.value})} 
                    />
                </div>
            </div>

            <div className="bg-blue-50/50 rounded-[40px] p-8 border border-blue-100/50 space-y-6">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={16}/> Service Interval Matrix</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Interval (Months)</label>
                        <select 
                            className="w-full p-4 bg-white border border-blue-100 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/10"
                            value={form.serviceInterval}
                            onChange={e => setForm({...form, serviceInterval: e.target.value})}
                        >
                            {[1,2,3,4,6,12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'Month' : 'Months'}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8"
            >
                <Save size={20}/>
                Commit Asset to Registry
            </button>
        </div>
    );
};

export default AssetForm;
