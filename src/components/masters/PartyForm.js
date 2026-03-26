import React, { useState } from 'react';
import { X, Plus, Phone, MapPin, CheckCircle2, Save, ArrowLeft } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const PartyForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [form, setForm] = useState({ 
        name: '', mobile: '', email: '', 
        address: '', lat: '', lng: '', reference: '', 
        openingBal: '', type: 'DR', 
        locations: [], 
        mobileNumbers: [],
        ...(record || {}) 
    });

    const [newLoc, setNewLoc] = useState({ label: '', address: '', mobile: '', lat: '', lng: '' });
    const [newMobile, setNewMobile] = useState({ label: '', number: '' });

    const addLocation = () => {
        if (!newLoc.label || !newLoc.address) return alert("Label and Address are required");
        setForm(prev => ({ ...prev, locations: [...(prev.locations || []), newLoc] }));
        setNewLoc({ label: '', address: '', mobile: '', lat: '', lng: '' });
    };

    const removeLocation = (idx) => {
        setForm(prev => ({ ...prev, locations: prev.locations.filter((_, i) => i !== idx) }));
    };

    const addMobile = () => {
        if (!newMobile.label || !newMobile.number) return alert("Label and Number are required");
        setForm(prev => ({ ...prev, mobileNumbers: [...(prev.mobileNumbers || []), newMobile] }));
        setNewMobile({ label: '', number: '' });
    };

    const removeMobile = (idx) => {
        setForm(prev => ({ ...prev, mobileNumbers: prev.mobileNumbers.filter((_, i) => i !== idx) }));
    };

    const handleSave = async () => {
        if (!form.name) return alert("Name is required");
        await saveRecord('parties', form, 'party');
        onClose();
    };

    return (                                                            
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
                    <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="Enter party name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference</label>
                    <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="Referred by..." value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Mobile</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="Basic number" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
                    </div>
                </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="party@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
            </div>

            {/* Multiple Mobile Numbers */}
            <div className="p-6 bg-emerald-50/50 rounded-[32px] border border-emerald-100/50 space-y-4">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Phone size={14}/> Additional Contacts</p>
                
                <div className="flex flex-wrap gap-2">
                    {(form.mobileNumbers || []).map((mob, idx) => (
                        <div key={idx} className="bg-white px-4 py-2 rounded-xl border border-emerald-100 flex items-center justify-between gap-4 shadow-sm group">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-emerald-400 uppercase">{mob.label}</span>
                                <span className="text-xs font-bold text-slate-700">{mob.number}</span>
                            </div>
                            <button onClick={() => removeMobile(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={14}/></button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input className="w-1/3 p-3 bg-white border border-emerald-100 rounded-xl text-xs font-bold outline-none" placeholder="Label (Owner)" value={newMobile.label} onChange={e => setNewMobile({...newMobile, label: e.target.value})} />
                    <input className="flex-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs font-bold outline-none" placeholder="Mobile Number" value={newMobile.number} onChange={e => setNewMobile({...newMobile, number: e.target.value})} />
                    <button onClick={addMobile} className="px-5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all"><Plus size={18}/></button>
                </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> Primary Address & GIS</p>
                <textarea className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Street, Building, City, Zip" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="w-full p-3 bg-white border border-slate-100 rounded-xl text-xs font-bold font-mono outline-none" placeholder="Latitude (optional)" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} />
                    <input className="w-full p-3 bg-white border border-slate-100 rounded-xl text-xs font-bold font-mono outline-none" placeholder="Longitude (optional)" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} />
                </div>
            </div>

            {/* Location Manager */}
            <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50 space-y-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> Secondary Locations</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(form.locations || []).map((loc, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-blue-100 flex justify-between items-start shadow-sm group">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{loc.label}</span>
                                <p className="text-xs font-bold text-slate-700 leading-tight">{loc.address}</p>
                                {loc.mobile && <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1"><Phone size={10}/> {loc.mobile}</div>}
                            </div>
                            <button onClick={() => removeLocation(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16}/></button>
                        </div>
                    ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-blue-100">
                    <div className="flex gap-2">
                        <input className="w-1/3 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Label (Warehouse)" value={newLoc.label} onChange={e => setNewLoc({...newLoc, label: e.target.value})} />
                        <input className="flex-1 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Secondary Address" value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                        <input className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-xs font-mono outline-none" placeholder="Lat" value={newLoc.lat} onChange={e => setNewLoc({...newLoc, lat: e.target.value})} />
                        <input className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-xs font-mono outline-none" placeholder="Lng" value={newLoc.lng} onChange={e => setNewLoc({...newLoc, lng: e.target.value})} />
                        <input className="flex-1 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Loc Mobile (optional)" value={newLoc.mobile} onChange={e => setNewLoc({...newLoc, mobile: e.target.value})} />
                        <button onClick={addLocation} className="px-5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"><Plus size={18}/></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Balance</label>
                    <input type="number" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="0.00" value={form.openingBal} onChange={e => setForm({...form, openingBal: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        <button onClick={() => setForm({...form, type: 'DR'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'DR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Debit (To Collect)</button>
                        <button onClick={() => setForm({...form, type: 'CR'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.type === 'CR' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Credit (To Pay)</button>
                    </div>
                </div>
            </div>
            
            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8">
                <Save size={20}/>
                Save Party Profile
            </button>
        </div>
    );
};

export default PartyForm;
