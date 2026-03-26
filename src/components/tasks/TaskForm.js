import React, { useState } from 'react';
import { 
  X, Search, MapPin, Plus, Edit2, ShieldCheck, 
  Trash2, Save, Calendar, Clock, AlertTriangle 
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import SearchableSelect from '../ui/SearchableSelect';
import { formatCurrency } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const TaskForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [showItems, setShowItems] = useState(!!record?.itemsUsed?.length);
    const [showLocPicker, setShowLocPicker] = useState(false);
    const [addBrandModal, setAddBrandModal] = useState(null);

    const [form, setForm] = useState(record ? { 
        ...record, 
        itemsUsed: record.itemsUsed || [], 
        assignedStaff: record.assignedStaff || [],
        selectedContacts: record.selectedContacts || [], 
        estimateTime: record.estimateTime || '',
        priority: record.priority || 'Medium',
        parentId: record.parentId || null,
        photosLink: record.photosLink || ''
    } : { 
        name: '', partyId: '', description: '', status: 'To Do', dueDate: new Date().toISOString().split('T')[0], 
        estimateTime: '1h 0m', assignedStaff: [], itemsUsed: [], priority: 'Medium', parentId: null,
        address: '', mobile: '', lat: '', lng: '', locationLabel: '', 
        selectedContacts: [], photosLink: ''
    });

    const selectedParty = data.parties.find(p => p.id === form.partyId);
    
    const itemOptions = data.items.map(i => ({ 
        id: i.id,
        name: i.name,
        subText: `Stk: 0`, // Simplified for now
        subtitle: `₹${i.sellPrice || 0}`
    }));

    const updateItem = (idx, field, val) => {
        const n = [...form.itemsUsed];
        const item = data.items.find(i => i.id === (field === 'itemId' ? val : n[idx].itemId));

        if (field === 'itemId' && item) {
            n[idx] = {
                ...n[idx],
                itemId: val,
                price: item.sellPrice || 0,
                buyPrice: item.buyPrice || 0,
                description: item.description || '',
                brand: '',
                qty: n[idx].qty || 1,
                linkedItems: item.linkedItems || []
            };
        } else if (field === 'brand' && item && item.brands) {
            const brandData = item.brands.find(b => b.name === val);
            n[idx].brand = val;
            n[idx].price = brandData ? brandData.sellPrice : item.sellPrice;
            n[idx].buyPrice = brandData ? brandData.buyPrice : item.buyPrice;
        } else {
            n[idx][field] = val;
        }
        setForm({ ...form, itemsUsed: n });
    };

    const addLinkedItem = (parentIdx, linkIdx) => {
        const parentLine = form.itemsUsed[parentIdx];
        const linkInfo = parentLine.linkedItems[linkIdx];
        const linkedData = data.items.find(i => i.name === linkInfo.name);
        
        if(!linkedData) return alert("Linked Item not found in Master!");

        const newLine = { 
            itemId: linkedData.id, 
            qty: parentLine.qty || 1,
            brand: linkInfo.brand || '',       
            price: parseFloat(linkInfo.price || linkedData.sellPrice || 0), 
            buyPrice: parseFloat(linkedData.buyPrice || 0), 
            description: linkedData.description || '' 
        };
        
        const newItems = [...form.itemsUsed];
        newItems.splice(parentIdx + 1, 0, newLine); 
        setForm({ ...form, itemsUsed: newItems });
    };

    const handleSave = async () => {
        if(!form.name) return alert("Task name required");
        await saveRecord('tasks', form, 'task');
        onClose();
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Context</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. AC Installation - Hall" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                        {['To Do', 'In Progress', 'Awaiting Parts', 'Done', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SearchableSelect 
                    label="Client / Party" 
                    options={data.parties.map(p => ({ id: p.id, name: p.name, subText: p.mobile }))} 
                    value={form.partyId} 
                    onChange={v => setForm({...form, partyId: v})} 
                />
                <SearchableSelect 
                    label="Priority" 
                    options={['High', 'Medium', 'Low'].map(p => ({ id: p, name: p }))} 
                    value={form.priority} 
                    onChange={v => setForm({...form, priority: v})} 
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Team</label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {form.assignedStaff.map(sid => {
                        const s = data.staff.find(st => st.id === sid);
                        return (
                            <span key={sid} className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                                {s?.name} 
                                <button onClick={() => setForm({...form, assignedStaff: form.assignedStaff.filter(id => id !== sid)})}><X size={12}/></button>
                            </span>
                        );
                    })}
                </div>
                <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" onChange={e => { if(e.target.value && !form.assignedStaff.includes(e.target.value)) setForm({...form, assignedStaff: [...form.assignedStaff, e.target.value]}); }}>
                    <option value="">+ Assign Staff Member</option>
                    {data.staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Description / SOP</label>
                <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px]" placeholder="Specific instructions for the team..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory & Spare Parts</h4>
                    <button onClick={() => setShowItems(!showItems)} className="text-[10px] font-black text-blue-600 bg-white border border-blue-100 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all">
                        {showItems ? 'Hide Items' : 'Show Items'}
                    </button>
                </div>

                {showItems && (
                    <div className="space-y-3">
                        {form.itemsUsed.map((line, idx) => (
                            <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl relative space-y-3 shadow-sm">
                                <button onClick={() => { const newItems = form.itemsUsed.filter((_, i) => i !== idx); setForm({ ...form, itemsUsed: newItems }); }} className="absolute -top-2 -right-2 bg-white p-2 rounded-full shadow-lg border border-slate-100 text-rose-500 hover:scale-110 transition-transform"><X size={14}/></button>
                                
                                <SearchableSelect options={itemOptions} value={line.itemId} onChange={v => updateItem(idx, 'itemId', v)} placeholder="Select Spare Part/Item"/>
                                
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-300 uppercase ml-1">Qty</label>
                                        <input type="number" className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold" value={line.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-300 uppercase ml-1">Rate</label>
                                        <input type="number" className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold" value={line.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-300 uppercase ml-1">Total</label>
                                        <div className="w-full p-2 bg-slate-100 border border-slate-100 rounded-xl text-xs font-black text-slate-800 flex items-center justify-end">
                                            {formatCurrency((parseFloat(line.qty)||0) * (parseFloat(line.price)||0))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setForm({...form, itemsUsed: [...form.itemsUsed, { itemId: '', qty: 1, price: 0 }]})} className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/30 transition-all">
                            + Add Spare Part
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deadline Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="date" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimated Effort</label>
                    <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. 2h 30m" value={form.estimateTime} onChange={e => setForm({...form, estimateTime: e.target.value})} />
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                <Save size={20}/> Finalize Task
            </button>
        </div>
    );
};

export default TaskForm;
