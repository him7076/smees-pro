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
        <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Settings size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{isEdit ? 'Edit Asset' : 'New Asset'}</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{party?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isEdit && (
                        <button onClick={handleDelete} className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all border border-rose-100">
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all border border-slate-200">
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 animate-in slide-in-from-left-2"><Package size={12}/> Asset Name</label>
                    <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. 1.5 Ton Split AC" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                    />
                </div>
                <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 animate-in slide-in-from-left-2"><ShieldCheck size={12}/> Brand</label>
                    <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. Panasonic" 
                        value={form.brand} 
                        onChange={e => setForm({...form, brand: e.target.value})} 
                    />
                </div>
                <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Model Number</label>
                    <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. CS-PU18XKY-1" 
                        value={form.model} 
                        onChange={e => setForm({...form, model: e.target.value})} 
                    />
                </div>
                <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial / Unit ID</label>
                    <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-sm"
                        placeholder="e.g. SN-99201" 
                        value={form.serialNo} 
                        onChange={e => setForm({...form, serialNo: e.target.value})} 
                    />
                </div>
            </div>

            <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Service Interval</label>
                        <select 
                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer hover:bg-slate-50"
                            value={form.serviceInterval}
                            onChange={e => {
                                const val = parseInt(e.target.value);
                                const ns = new Date(form.lastServiceDate || new Date());
                                ns.setMonth(ns.getMonth() + val);
                                setForm({...form, serviceInterval: val, nextServiceDate: ns.toISOString().split('T')[0]});
                            }}
                        >
                            {Array.from({length: 36}, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{m} {m === 1 ? 'Month' : 'Months'}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5 px-1 focus-within:scale-[1.01] transition-transform">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Next Service Date</label>
                        <input 
                            type="date"
                            className="w-full p-4 bg-white border border-emerald-100 rounded-2xl text-sm font-black outline-none shadow-sm text-emerald-700"
                            value={form.nextServiceDate}
                            onChange={e => setForm({...form, nextServiceDate: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <div className="pt-2">
                <button 
                    onClick={handleSave}
                    className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <Save size={18}/>
                    Commit Record
                </button>
            </div>
        </div>
    );
};

export default AssetForm;
