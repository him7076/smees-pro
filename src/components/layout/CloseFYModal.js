import React, { useState } from 'react';
import { X, Calendar, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert } from 'lucide-react';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../../services/firebase';

const CloseFYModal = ({ data, setData, onClose }) => {
    const [step, setStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    // Current config or fallback to 2026-27
    const currentFY = data.financialYear || {
        activeYear: '2026-2027',
        transitionDate: '2026-04-01',
        prefix: '2026-2027_',
        counterKey: 'counters_26_27'
    };

    // Calculate Next FY Automatically
    const lastYear = parseInt(currentFY.activeYear.split('-')[1]);
    const nextStartYear = lastYear;
    const nextEndYear = lastYear + 1;
    const nextFYStr = `${nextStartYear}-${nextEndYear}`;
    const nextPrefix = `${nextFYStr}_`;
    const nextCounterKey = `counters_${nextStartYear % 100}_${nextEndYear % 100}`;
    const nextTransitionDate = `${nextStartYear}-04-01`;

    const handleCloseYear = async () => {
        setIsProcessing(true);
        try {
            const newConfig = {
                activeYear: nextFYStr,
                transitionDate: nextTransitionDate,
                prefix: nextPrefix,
                counterKey: nextCounterKey,
                updatedAt: new Date().toISOString()
            };

            // 1. Initialize new counters in Firestore (Reset to 1)
            const initialCounters = { sales: 1, purchase: 1, expense: 1, payment: 1, estimate: 1 };
            await setDoc(doc(db, "settings", nextCounterKey), initialCounters);

            // 2. Update Financial Year config in Firestore settings
            await setDoc(doc(db, "settings", "financial_year"), newConfig);

            // 3. Update Local State for instant effect
            setData(prev => ({
                ...prev,
                financialYear: newConfig,
                [nextCounterKey]: initialCounters
            }));

            alert(`Success! Financial Year ${nextFYStr} is now active.`);
            onClose();
        } catch (error) {
            console.error("FY Transition Error:", error);
            alert("Error: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                            <Calendar size={24}/>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Close Financial Year</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit Transition Engine</p>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Current Engine</span>
                                    <span className="text-[10px] font-black text-slate-800 bg-white px-3 py-1 rounded-full border border-slate-100">{currentFY.activeYear}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Next Destination</span>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{nextFYStr}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Impact Analysis</h4>
                                <ul className="space-y-2.5">
                                    {[
                                        "Voucher counters will reset to START (1)",
                                        `IDs will use new prefix: ${nextPrefix}`,
                                        "Backdating to historical records remains safe",
                                        "Current sequence will be archived in DB"
                                    ].map((t,i) => (
                                        <li key={i} className="flex gap-3 text-[10px] font-bold text-slate-500 leading-relaxed">
                                            <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0"/>
                                            {t}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button onClick={() => setStep(2)} className="w-full py-5 bg-slate-900 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-800">
                                INITIALIZE TRANSITION <ArrowRight size={18}/>
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 py-4">
                            <div className="text-center space-y-2">
                                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500 animate-pulse">
                                    <ShieldAlert size={40}/>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Final Warning</h3>
                                <p className="text-[11px] font-bold text-slate-400 px-2">This is a structural change. New invoices will follow the {nextFYStr} sequence starting now. Continue?</p>
                            </div>

                            <div className="space-y-3 pt-4">
                                <button 
                                    onClick={handleCloseYear}
                                    disabled={isProcessing}
                                    className="w-full py-6 bg-rose-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : "YES, SEAL AND CLOSE"}
                                </button>
                                <button onClick={() => setStep(1)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-[28px] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">ABORT PROCESS</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloseFYModal;
