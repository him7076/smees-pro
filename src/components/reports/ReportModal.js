import React, { useState, useEffect } from 'react';
import { X, Copy, Zap } from 'lucide-react';
import { generateAIReport } from '../../utils/helpers';

const ReportModal = ({ isOpen, onClose, data }) => {
    const [range, setRange] = useState('This Month');
    const [dates, setDates] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [reportText, setReportText] = useState('');

    useEffect(() => {
        if (!isOpen) { setReportText(''); return; }
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (range === 'This Month') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
        else if (range === 'Last Month') { start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0); }
        else if (range === 'This Week') { start.setDate(today.getDate() - today.getDay()); }

        if (range !== 'Custom') setDates({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    }, [range, isOpen]);

    const handleGenerate = () => setReportText(generateAIReport(data, dates.start, dates.end));
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 animate-in fade-in">
            <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
                <div className="p-8 pb-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl shadow-inner"><Zap size={24}/></div>
                        <div>
                            <h3 className="font-extrabold text-2xl text-slate-900 tracking-tight">AI Intelligence</h3>
                            <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em]">Analytical Business Insight</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={24}/></button>
                </div>
                
                <div className="px-8 py-6 space-y-6">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                        {['This Month', 'Last Month', 'Custom'].map(r => (
                            <button 
                                key={r} 
                                onClick={() => setRange(r)} 
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${range === r ? 'bg-white shadow-md text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    
                    {range === 'Custom' && (
                        <div className="flex gap-4 animate-in slide-in-from-top-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Range Start</label>
                                <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-purple-500/10 transition-all outline-none" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Range End</label>
                                <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-purple-500/10 transition-all outline-none" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} />
                            </div>
                        </div>
                    )}
                    
                    <button 
                        onClick={handleGenerate} 
                        className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-95 transition-all text-sm"
                    >
                        Process Report
                    </button>
                </div>

                {reportText ? (
                    <div className="flex-1 px-8 pb-8 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="flex-1 bg-slate-900 rounded-[32px] p-6 relative group overflow-hidden border border-slate-800 shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
                            <textarea 
                                readOnly 
                                className="w-full h-full bg-transparent text-slate-200 text-xs font-mono leading-relaxed resize-none focus:outline-none scrollbar-hide relative z-10" 
                                value={reportText}
                            />
                            <button 
                                onClick={() => { navigator.clipboard.writeText(reportText); alert("Intelligence Copied to Clipboard!"); }} 
                                className="absolute bottom-6 right-6 px-6 py-2.5 bg-white/10 backdrop-blur-xl text-white font-black text-[10px] tracking-widest uppercase rounded-xl border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <Copy size={16}/> Copy Insight
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                        <Zap size={100} strokeWidth={1} className="text-purple-600"/>
                        <p className="font-black uppercase tracking-widest text-xs mt-6">Awaiting Input</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportModal;
