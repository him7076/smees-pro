import React, { useState } from 'react';
import { X, Plus, Package, Edit2, Trash2, Save, ShoppingBag, ShieldCheck } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import { useDatabase } from '../../hooks/useDatabase';

const ItemForm = ({ data, setData, record, onClose }) => {
    const { saveRecord } = useDatabase(data, setData);
    const [form, setForm] = useState({ 
        name: '', type: 'Goods', unit: 'pcs', openingStock: '0', 
        sellPrice: '', buyPrice: '', brands: [], category: '',
        linkedItems: [], 
        ...(record || {}) 
    });

    const [tempLinkedItem, setTempLinkedItem] = useState({ name: '', brand: '', price: '', qty: 1 });

    const handleSave = async () => {
        if (!form.name) return alert("Item Name Required");
        await saveRecord('items', form, 'item');
        onClose();
    };

    const addBrand = () => {
        const nameInput = document.getElementById('item_new_brand_name');
        const sellInput = document.getElementById('item_new_brand_sell');
        const buyInput = document.getElementById('item_new_brand_buy');
        
        const name = nameInput?.value;
        const sell = parseFloat(sellInput?.value || 0);
        const buy = parseFloat(buyInput?.value || 0);
        
        if (!name) return alert("Brand name required");
        
        setForm(prev => ({
            ...prev,
            brands: [...(prev.brands || []), { name, sellPrice: sell, buyPrice: buy }]
        }));

        if (nameInput) nameInput.value = '';
    };

    const removeBrand = (idx) => {
        setForm(prev => ({
            ...prev,
            brands: prev.brands.filter((_, i) => i !== idx)
        }));
    };

    return (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Name</label>
                    <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="e.g. 6Amp Switch" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                
                <SearchableSelect 
                    label="Category"
                    options={data.categories.item || []}
                    value={form.category}
                    onChange={v => setForm({...form, category: v})}
                    onAddNew={async (newCat) => {
                        const updatedList = [...(data.categories.item || []), newCat];
                        const newCats = { ...data.categories, item: updatedList };
                        setData(prev => ({ ...prev, categories: newCats }));
                        // In real app, we would update this in Firebase settings too
                        setForm({...form, category: newCat});
                    }}
                    placeholder="Select or Create Category"
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                        <select className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                            <option>Goods</option>
                            <option>Service</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label>
                        <select className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                            <option>pcs</option><option>mtr</option><option>kg</option><option>liter</option><option>set</option><option>box</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Sell Price</label>
                        <input type="number" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" placeholder="0.00" value={form.sellPrice} onChange={e => setForm({...form, sellPrice: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Buy Price</label>
                        <input type="number" className="w-full p-4 bg-yellow-50/30 border border-yellow-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-yellow-500/10 transition-all outline-none" placeholder="0.00" value={form.buyPrice} onChange={e => setForm({...form, buyPrice: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* Brand Management */}
            <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50 space-y-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><ShoppingBag size={14}/> Brand Extensions & Pricing</p>
                
                <div className="grid grid-cols-1 gap-2">
                    {form.brands && form.brands.map((brand, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm group">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{brand.name}</span>
                                <div className="flex gap-4">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Sell: ₹{brand.sellPrice}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Buy: ₹{brand.buyPrice}</span>
                                </div>
                            </div>
                            <button onClick={() => removeBrand(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-blue-100">
                    <div className="flex gap-2">
                        <input id="item_new_brand_name" className="flex-1 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Brand Name (e.g. Havells)" />
                        <input id="item_new_brand_sell" type="number" className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Sell Price" />
                        <input id="item_new_brand_buy" type="number" className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none" placeholder="Buy Price" />
                        <button onClick={addBrand} className="px-5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"><Plus size={18}/></button>
                    </div>
                </div>
            </div>

            {/* Linked Items (Kits) */}
            <div className="p-6 bg-orange-50/50 rounded-[32px] border border-orange-100/50 space-y-4">
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Linked Items (Bundle Strategy)</p>
                
                <div className="space-y-2">
                    {(form.linkedItems || []).map((li, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-orange-100 shadow-sm animate-in slide-in-from-left">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">{li.name} {li.brand && `(${li.brand})`}</span>
                                <span className="text-[10px] font-bold text-orange-600 uppercase">Default Added: ₹{li.price}</span>
                            </div>
                            <button onClick={() => setForm({...form, linkedItems: form.linkedItems.filter((_, i) => i !== idx)})} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 bg-white p-4 rounded-2xl border border-orange-100 shadow-sm">
                    <SearchableSelect 
                        options={data.items.filter(i => i.id !== form.id).map(i => ({ id: i.name, name: i.name, brands: i.brands, sellPrice: i.sellPrice }))} 
                        value={tempLinkedItem.name} 
                        onChange={v => {
                            const itemMaster = data.items.find(x => x.name === v);
                            setTempLinkedItem({ name: v, brand: '', price: itemMaster?.sellPrice || 0, qty: 1 });
                        }} 
                        placeholder="Select Item to Bundle..."
                    />
                    
                    {tempLinkedItem.name && (
                        <div className="flex gap-2">
                            <select 
                                className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none"
                                value={tempLinkedItem.brand}
                                onChange={e => {
                                    const bName = e.target.value;
                                    const item = data.items.find(x => x.name === tempLinkedItem.name);
                                    const bData = item?.brands?.find(b => b.name === bName);
                                    setTempLinkedItem({...tempLinkedItem, brand: bName, price: bData ? bData.sellPrice : item.sellPrice});
                                }}
                            >
                                <option value="">Default Brand</option>
                                {data.items.find(x => x.name === tempLinkedItem.name)?.brands?.map(b => (
                                    <option key={b.name} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                            <input type="number" placeholder="Override Price" className="w-24 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-700" value={tempLinkedItem.price} onChange={e => setTempLinkedItem({...tempLinkedItem, price: e.target.value})} />
                            <button onClick={() => {
                                if (!tempLinkedItem.name) return;
                                setForm(prev => ({...prev, linkedItems: [...(prev.linkedItems || []), tempLinkedItem]}));
                                setTempLinkedItem({ name: '', brand: '', price: '', qty: 1 });
                            }} className="px-6 bg-orange-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-600/20 active:scale-95 transition-all">Link</button>
                        </div>
                    )}
                </div>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8">
                <Save size={20}/>
                Synchronize Master Entry
            </button>
        </div>
    );
};

export default ItemForm;
