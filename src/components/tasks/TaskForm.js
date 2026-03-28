import React, { useState, useMemo } from 'react';
import { 
    X, Plus, Trash2, Edit2, Package, Calendar, Clock, 
    Link as LinkIcon, ShoppingBag, MapPin, Phone, 
    CheckCircle2, AlertCircle, Info, Layout
} from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';
import { 
    getNextId, getItemStock, formatCurrency 
} from '../../utils/helpers';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../../services/firebase';

const TaskForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [form, setForm] = useState(record ? { 
        ...record, 
        itemsUsed: record.itemsUsed || [], 
        assignedStaff: record.assignedStaff || [],
        selectedContacts: record.selectedContacts || [], 
        estimateTime: record.estimateTime || '',
        priority: record.priority || 'Medium',
        parentId: record.parentId || null
    } : { 
        name: '', 
        partyId: '', 
        description: '', 
        status: 'To Do', 
        dueDate: new Date().toISOString().split('T')[0], 
        estimateTime: '',
        assignedStaff: [], 
        itemsUsed: [], 
        priority: 'Medium', 
        parentId: null,
        address: '', mobile: '', lat: '', lng: '', locationLabel: '', 
        selectedContacts: [],
        photosLink: ''
    });

    const [showItems, setShowItems] = useState(false);
    const [showLocPicker, setShowLocPicker] = useState(false);
    const [addBrandModal, setAddBrandModal] = useState(null);

    const nextId = useMemo(() => {
        if (record) return record.id;
        return getNextId(data, 'task').id;
    }, [data, record]);

    const itemStock = useMemo(() => getItemStock(data), [data]);
    const selectedParty = useMemo(() => data.parties.find(p => p.id === form.partyId), [data.parties, form.partyId]);

    const updateItem = (idx, field, val) => {
        const n = [...form.itemsUsed];
        n[idx][field] = val;
        const item = data.items.find(i => i.id === n[idx].itemId);

        if (field === 'itemId' && item) {
            n[idx].price = item.sellPrice || 0;
            n[idx].buyPrice = item.buyPrice || 0;
            n[idx].description = item.description || '';
            n[idx].brand = '';
            n[idx].linkedItems = item.linkedItems || [];
        }

        if (field === 'brand' && item && item.brands) {
            const brandData = item.brands.find(b => b.name === val);
            if (brandData) {
                n[idx].price = brandData.sellPrice || 0;
                n[idx].buyPrice = brandData.buyPrice || 0;
            } else {
                n[idx].price = item.sellPrice || 0;
                n[idx].buyPrice = item.buyPrice || 0;
            }
        }
        setForm({ ...form, itemsUsed: n });
    };

    const addLinkedItem = (parentIdx, linkIdx) => {
        const parentLine = form.itemsUsed[parentIdx];
        const linkInfo = parentLine.linkedItems[linkIdx];
        if(!linkInfo) return;
        const linkedData = data.items.find(i => i.name === linkInfo.name);
        if(!linkedData) return alert("Linked Item not found!");

        const master = data.items.find(i=>i.id === linkedData.id);
        const newLine = { 
            itemId: linkedData.id, 
            qty: parentLine.qty, 
            brand: linkInfo.brand || '', 
            price: linkInfo.price || master?.sellPrice || 0, 
            buyPrice: master?.buyPrice || 0, 
            description: linkedData.description || 'Service Charge' 
        };
        
        const newItems = [...form.itemsUsed];
        newItems.splice(parentIdx + 1, 0, newLine); 
        setForm({ ...form, itemsUsed: newItems });
    };

    const handleLocationSelect = (loc) => {
        setForm({ ...form, address: loc.address, mobile: loc.mobile || selectedParty?.mobile || '', lat: loc.lat || '', lng: loc.lng || '', locationLabel: loc.label });
        setShowLocPicker(false);
    };

    const handleSave = async () => {
        if (!form.name) return alert("Task Name required");
        if (!form.partyId && !form.parentId) return alert("Client required");
        
        await saveRecord('tasks', { 
            ...form, 
            id: nextId, 
            updatedAt: new Date().toISOString(),
            createdAt: record?.createdAt || new Date().toISOString()
        });
        onClose();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-32 scrollbar-hide">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 p-4 shadow-sm flex justify-between items-center bg-white/80 backdrop-blur-xl">
                <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Record Editor</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {nextId}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="p-3 bg-slate-100 text-slate-400 rounded-2xl active:scale-95 transition-all"><X size={20}/></button>
                    <button onClick={handleSave} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center gap-2">OK <CheckCircle2 size={16}/></button>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-6 max-w-2xl mx-auto w-full">
                {/* Primary Fields */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objective</label>
                            <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-slate-800" placeholder="e.g. AC Service / Repair" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        </div>
                        <div className="w-1/3 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                            <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none shadow-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                {(data.categories?.taskStatus || ["To Do", "In Progress", "Done"]).map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority Level</label>
                            <SearchableSelect 
                                options={(data.categories?.taskPriority || ['High', 'Medium', 'Low']).map(p => ({ id: p, name: p }))} 
                                value={form.priority} 
                                onChange={v => setForm({...form, priority: v})}
                                onAddNew={async (newP) => {
                                    if(!newP) return;
                                    const updated = { ...data.categories, taskPriority: [...(data.categories.taskPriority || ['High', 'Medium', 'Low']), newP] };
                                    setData(prev => ({ ...prev, categories: updated }));
                                    await setDoc(doc(db, "settings", "categories"), updated, { merge: true });
                                    setForm({...form, priority: newP});
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Est. Window</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="2 hrs / 3 days" value={form.estimateTime} onChange={e => setForm({...form, estimateTime: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Staff Allocation */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Ground Staff</label>
                    <div className="flex flex-wrap gap-2">
                        {form.assignedStaff.map(sid => {
                            const s = data.staff.find(st => st.id === sid);
                            return (
                                <span key={sid} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 flex items-center gap-2 animate-in zoom-in-95">
                                    {s?.name} 
                                    <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})} className="hover:text-rose-500 transition-colors"><X size={12}/></button>
                                </span>
                            );
                        })}
                    </div>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none shadow-sm text-slate-600" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); e.target.value = ""; }}>
                        <option value="">+ Allocate Additional Staff Member</option>
                        {data.staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    </select>
                </div>

                {/* Client / Target Section */}
                {!form.parentId && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Terminal</label>
                        <SearchableSelect options={data.parties} value={form.partyId} onChange={v => setForm({...form, partyId: v, locationLabel: '', address: ''})} placeholder="Identify Client..." />
                        
                        {selectedParty && (selectedParty.locations?.length > 0 || selectedParty.mobileNumbers?.length > 0) && (
                            <div className="relative pt-2">
                                <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-3xl border border-blue-100/50">
                                     <div className="text-[10px] text-slate-800 flex-1 min-w-0 pr-4">
                                         <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="font-black text-blue-400 uppercase tracking-widest text-[8px]">Selected Vector: </span> 
                                            <span className="font-black bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[8px] uppercase">{form.locationLabel || 'Default Handle'}</span>
                                         </div>
                                         <div className="font-black text-slate-900 leading-tight">
                                            {(form.selectedContacts && form.selectedContacts.length > 0) 
                                                ? form.selectedContacts.map(c => `${c.label}: ${c.number}`).join(' | ') 
                                                : (form.mobile || selectedParty.mobile)
                                            }
                                         </div>
                                         <div className="truncate text-slate-500 mt-1 font-bold text-[9px]">{form.address || selectedParty.address}</div>
                                     </div>
                                     <button onClick={() => setShowLocPicker(!showLocPicker)} className="text-[9px] font-black bg-white border border-blue-100 px-4 py-2.5 rounded-2xl shadow-sm text-blue-600 active:scale-95 transition-all uppercase tracking-widest">Interface</button>
                                </div>
                                {showLocPicker && (
                                    <div className="absolute z-[120] w-full mt-2 bg-white border border-slate-200 rounded-[32px] shadow-2xl p-4 space-y-3 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-4 origin-top">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Connectivity Options</p>
                                            <button onClick={() => setShowLocPicker(false)} className="p-1.5 bg-slate-100 rounded-full text-slate-400"><X size={14}/></button>
                                        </div>

                                        <div onClick={() => { setForm({ ...form, address: selectedParty.address, mobile: selectedParty.mobile, selectedContacts: [], locationLabel: '', lat: selectedParty.lat || '', lng: selectedParty.lng || '' }); setShowLocPicker(false); }} className="p-4 hover:bg-slate-50 border border-slate-100 cursor-pointer bg-slate-50 rounded-2xl transition-all active:scale-[0.98]">
                                            <div className="flex justify-between items-center">
                                                <span className="font-black text-[10px] text-blue-600 uppercase tracking-widest">Master Direct</span>
                                                <CheckCircle2 size={16} className={!form.locationLabel && !form.selectedContacts?.length ? 'text-blue-600' : 'text-slate-200'}/>
                                            </div>
                                            <div className="text-xs font-black text-slate-900 mt-1">{selectedParty.mobile}</div>
                                            <div className="text-[9px] font-bold text-slate-500 mt-0.5 truncate">{selectedParty.address}</div>
                                        </div>

                                        {selectedParty.mobileNumbers?.length > 0 && (
                                            <div className="space-y-2 pt-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Multi-Contact Selection</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {selectedParty.mobileNumbers.map((mob, idx) => {
                                                        const isSelected = form.selectedContacts?.some(c => c.number === mob.number);
                                                        return (
                                                            <div key={idx} onClick={(e) => { e.stopPropagation(); let current = [...(form.selectedContacts || [])]; if (isSelected) current = current.filter(c => c.number !== mob.number); else current.push(mob); setForm({ ...form, selectedContacts: current, locationLabel: current.length ? 'Multi-Contact' : '' }); }} className={`p-3.5 cursor-pointer rounded-2xl border flex justify-between items-center transition-all active:scale-[0.98] ${isSelected ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'hover:bg-slate-50 border-slate-100'}`}>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{mob.label}</p>
                                                                    <p className={`text-xs font-black ${isSelected ? 'text-emerald-700' : 'text-slate-900'}`}>{mob.number}</p>
                                                                </div>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200'}`}>
                                                                    {isSelected && <CheckCircle2 size={14} strokeWidth={3}/>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {selectedParty.locations?.length > 0 && (
                                            <div className="space-y-2 pt-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Strategic Locations</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {selectedParty.locations.map((loc, idx) => {
                                                        const isSelected = form.locationLabel === loc.label;
                                                        return (
                                                            <div key={idx} onClick={() => { handleLocationSelect(loc); setForm(prev => ({ ...prev, selectedContacts: [] })); }} className={`p-4 hover:bg-blue-50 cursor-pointer rounded-2xl border transition-all active:scale-[0.98] ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-slate-100'}`}>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[10px] font-black text-blue-600 flex items-center gap-1.5 uppercase tracking-widest"><MapPin size={12}/> {loc.label}</span>
                                                                    {isSelected && <CheckCircle2 size={14} className="text-blue-600"/>}
                                                                </div>
                                                                <div className="text-[10px] font-black text-slate-500 leading-relaxed mb-1.5">{loc.address}</div>
                                                                {loc.mobile && <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1.5"><Phone size={10}/> {loc.mobile}</div>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Description & Media */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Briefing</label>
                        <textarea className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[28px] text-sm font-bold shadow-sm min-h-[100px] outline-none" placeholder="Provide operational details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photos / Album Cloud Link</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none" placeholder="Paste Google Photos/Album Link..." value={form.photosLink || ''} onChange={e => setForm({...form, photosLink: e.target.value})} />
                        </div>
                    </div>
                </div>

                {/* Items & Logistics */}
                {!form.parentId && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Operational Items / Inventory</h4>
                            <button onClick={() => setShowItems(!showItems)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showItems ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {showItems ? 'Hide Items' : 'Manage List'}
                            </button>
                        </div>
                        {showItems && (
                            <div className="space-y-4 pt-2 animate-in slide-in-from-top-4">
                                {form.itemsUsed.map((line, idx) => {
                                    const master = data.items.find(i => i.id === line.itemId);
                                    return (
                                        <div key={idx} className="p-5 border border-slate-100 rounded-[32px] bg-slate-50 relative space-y-4 shadow-sm">
                                            <button onClick={() => setForm({ ...form, itemsUsed: form.itemsUsed.filter((_, i) => i !== idx) })} className="absolute -top-3 -right-3 bg-white p-2 rounded-full shadow-xl border border-slate-50 text-rose-500"><Trash2 size={16}/></button>
                                    
                                            <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
                                                <SearchableSelect options={data.items.map(i => ({ id: i.id, name: i.name, subText: `Stk: ${itemStock[i.id] || 0}` }))} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} placeholder="Identify Product..." />
                                                {master && (
                                                    <SearchableSelect 
                                                        placeholder={master.brands?.length ? "Brand/Variant" : "No Variants"}
                                                        options={master.brands?.map(b => ({ id: b.name, name: b.name, subText: `₹${b.sellPrice}` })) || []}
                                                        value={line.brand || ''}
                                                        onChange={v => updateItem(idx, 'brand', v)}
                                                        onAddNew={() => setAddBrandModal({ item: master, idx })}
                                                    />
                                                )}
                                            </div>
                                            
                                            {(line.linkedItems || []).map((lItem, lIdx) => (
                                                <button key={lIdx} onClick={() => addLinkedItem(idx, lIdx)} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest border border-indigo-100 active:scale-95 transition-all shadow-sm">
                                                    <Plus size={14}/> Add Related: {lItem.name} {lItem.brand ? `(${lItem.brand})` : ''}
                                                </button>
                                            ))}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                                                    <input type="number" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-xs font-black" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Rate</label>
                                                    <input type="number" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-xs font-black" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                                                </div>
                                            </div>
                                            <input className="w-full text-xs p-3 bg-white border border-slate-100 rounded-xl font-bold" placeholder="Line memo (e.g. Broken part replacement)" value={line.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                        </div>
                                    );
                                })}
                                <button onClick={() => setForm({ ...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0, buyPrice: 0 }] })} className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Plus size={16}/> New Line Item</button>
                            </div>
                        )}
                        {!showItems && form.itemsUsed.length > 0 && <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 p-2 rounded-xl border border-indigo-100 text-center">{form.itemsUsed.length} Material Entries Defined</p>}
                    </div>
                )}
            </div>

            {/* Fixed Save Button for Mobile (Floating Look) */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[120] flex gap-4 max-w-2xl mx-auto rounded-t-[40px] shadow-2xl">
                <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Discard</button>
                <button onClick={handleSave} className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <CheckCircle2 size={20}/>
                    Commit Record
                </button>
            </div>
        </div>
    );
};

export default TaskForm;
