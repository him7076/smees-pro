import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, CheckCircle2, X } from 'lucide-react';

const SearchableSelect = ({ label, options = [], value, onChange, onAddNew, placeholder = "Search..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = options.filter(opt => {
        const name = typeof opt === 'string' ? opt : opt.name || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const selectedOption = options.find(opt => (typeof opt === 'string' ? opt : opt.id) === value);
    const selectedName = selectedOption ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.name) : '';

    const inputRef = useRef(null);
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => {
                inputRef.current.focus();
                inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, [isOpen]);

    return (
        <div className="space-y-1.5" ref={wrapperRef}>
            {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
            <div className="relative group">
                <button 
                    type="button"
                    onClick={() => setIsOpen(!isOpen)} 
                    className={`w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm transition-all text-left flex justify-between items-center group-focus-within:ring-4 group-focus-within:ring-blue-500/10 ${isOpen ? 'ring-4 ring-blue-500/10 border-blue-500/20' : 'hover:border-blue-200'}`}
                >
                    <span className={selectedName ? 'text-slate-900' : 'text-slate-400'}>{selectedName || placeholder}</span>
                    <Search size={16} className="text-slate-400"/>
                </button>

                {isOpen && (
                    <div className={`absolute z-[200] w-full mt-2 bg-white border border-slate-100 rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-3 space-y-2 ${
                        wrapperRef.current && wrapperRef.current.getBoundingClientRect().bottom > window.innerHeight - 300 ? 'bottom-full mb-4' : 'top-full'
                    }`}>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                            <input 
                                ref={inputRef}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white transition-all capitalize" 
                                placeholder="Type to filter..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-hide py-1">
                            {filteredOptions.map((opt, idx) => {
                                const id = typeof opt === 'string' ? opt : opt.id;
                                const name = typeof opt === 'string' ? opt : opt.name;
                                const subText = typeof opt === 'object' ? opt.subText : null;
                                const isSelected = id === value;

                                return (
                                    <button 
                                        key={id || idx}
                                        type="button"
                                        onClick={() => { onChange(id); setIsOpen(false); setSearch(''); }}
                                        className={`w-full flex justify-between items-center p-3.5 rounded-xl transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-700'}`}>{name}</span>
                                            {subText && <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : (opt.subColor || 'text-slate-400')} uppercase`}>{subText}</span>}
                                        </div>
                                        {isSelected && <CheckCircle2 size={16}/>}
                                    </button>
                                );
                            })}
                            
                            {onAddNew && (
                                <button 
                                    type="button"
                                    onClick={() => { onAddNew(search); setIsOpen(false); }}
                                    className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-emerald-50 text-emerald-600 border border-dashed border-emerald-200 mt-2 transition-all"
                                >
                                    <Plus size={16}/>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Create New: "{search || 'Entry'}"</span>
                                </button>
                            )}
                            
                            {filteredOptions.length === 0 && !onAddNew && (
                                <div className="p-8 text-center opacity-20">
                                    <Search size={40} className="mx-auto mb-2" strokeWidth={1}/>
                                    <p className="text-[10px] font-black uppercase tracking-widest">No results found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableSelect;
