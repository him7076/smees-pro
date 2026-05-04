import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Send, Eye, AlertCircle, Check, XCircle, Pencil } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

let lastGeminiCall = 0;
let requestQueue = Promise.resolve();

const AIVoiceAssistant = ({ data, setData, setViewDetail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [inputText, setInputText] = useState('');
    const [statusText, setStatusText] = useState('JARVIS Online.');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [lastCreatedRecord, setLastCreatedRecord] = useState(null);
    const [isEditingText, setIsEditingText] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    
    const recognitionRef = useRef(null);
    const { saveRecord } = useDatabase(data, setData);

    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            const r = new SR();
            r.continuous = false; r.interimResults = true; r.lang = 'en-IN';
            r.onresult = (e) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; ++i) t += e.results[i][0].transcript; setTranscript(t); };
            r.onend = () => setIsListening(false);
            r.onerror = (e) => { setIsListening(false); setError('Mic: ' + e.error); };
            recognitionRef.current = r;
        }
    }, []);

    const speakJarvis = (text, cb = null) => {
        if (!('speechSynthesis' in window)) { cb?.(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const pick = voices.find(v => /hindi/i.test(v.name) && !/female/i.test(v.name)) || voices[0];
        if (pick) u.voice = pick;
        u.lang = 'hi-IN'; u.pitch = 0.65; u.rate = 0.95; u.volume = 1.0;
        if (cb) u.onend = cb;
        window.speechSynthesis.speak(u);
    };

    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            if (pendingAction) {
                const t = transcript.toLowerCase().trim();
                if (/^(haan|han|yes|ha|ok|confirm|kar do|karo|theek|thik|done|sahi)/.test(t)) confirmAction();
                else if (/^(nahi|nhi|no|cancel|mat|ruk|band|naa|chhodo|rehne|rehne do)/.test(t)) cancelAction();
                else processCommand(transcript);
            } else {
                processCommand(transcript);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const resetState = () => {
        setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null);
        setError(''); setStatusText('JARVIS Online.'); setIsProcessing(false);
        setPendingAction(null); setIsEditingText(false);
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); return; }
        if (!pendingAction) resetState();
        setTranscript('');
        setStatusText(pendingAction ? 'Confirmation chahiye...' : 'Listening...');
        try { recognitionRef.current.start(); setIsListening(true); }
        catch (e) { setError('Mic: ' + e.message); }
    };

    const getPreview = (parsed) => {
        if (!parsed?.action) return 'Command samajh nahi aaya.';
        const d = parsed.data || {};
        if (parsed.action === 'VIEW_TASK') return `📋 Task ${d.taskId} dekhna hai.`;
        if (parsed.action === 'MODIFY_TASK') {
            const t = (data?.tasks || []).find(x => x.id === d.taskId);
            return `✏️ Task "${t?.name || d.taskId}" mein add: ${d.itemName} × ${d.qty}${d.price ? ` @ ₹${d.price}` : ''}`;
        }
        if (parsed.action === 'CREATE_TASK') return `📝 Naya Task: "${d.name}"${d.partyId ? ` (${(data?.parties || []).find(p => p.id === d.partyId)?.name})` : ''}`;
        if (parsed.action === 'CREATE_TRANSACTION') return `💰 ${d.type.toUpperCase()}: ₹${d.amount} for ${d.items?.[0]?.itemName || 'Expense'}`;
        if (parsed.action === 'ASK_QUESTION') return `❓ ${d.question}`;
        return `❓ Action: ${parsed.action}`;
    };

    const executeAction = async (parsed, originalText) => {
        if (parsed.action === 'VIEW_TASK') {
            const task = (data?.tasks || []).find(t => t.id === parsed.data.taskId);
            if (task) { setSuccessMessage(`Task: ${task.name}`); setLastCreatedRecord({ id: task.id, type: 'task', data: task }); speakJarvis(`Mila. ${task.name}.`); }
            else throw new Error(`Task ${parsed.data.taskId} nahi mila.`);
            setIsProcessing(false); return;
        }

        if (parsed.action === 'MODIFY_TASK') {
            const task = (data?.tasks || []).find(t => t.id === parsed.data.taskId);
            if (!task) throw new Error('Task nahi mila.');
            const items = task.itemsUsed || []; 
            const idx = items.findIndex(i => i.itemId === parsed.data.itemId);
            let updated, msg;
            if (idx >= 0) {
                updated = [...items];
                updated[idx] = { ...updated[idx], qty: parseFloat(updated[idx].qty || 0) + parsed.data.qty };
                msg = `${parsed.data.itemName} qty update kar di hai.`;
            } else {
                updated = [...items, { itemId: parsed.data.itemId, qty: parsed.data.qty, price: parsed.data.price, brand: parsed.data.brand }];
                msg = `${parsed.data.itemName} add kar diya hai.`;
            }
            await saveRecord('tasks', { ...task, itemsUsed: updated, updatedAt: new Date().toISOString() }, 'task');
            setSuccessMessage(msg); setLastCreatedRecord({ id: task.id, type: 'task', data: { ...task, itemsUsed: updated } }); speakJarvis(msg); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TASK') {
            const id = await saveRecord('tasks', { name: parsed.data.name, partyId: parsed.data.partyId || '', status: 'To Do', description: originalText, createdAt: new Date().toISOString() }, 'task');
            setSuccessMessage(`Task ban gaya: ${parsed.data.name}`); speakJarvis(`Task bana diya hai.`); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TRANSACTION') {
            const total = parsed.data.amount;
            const tx = { type: parsed.data.type, partyId: parsed.data.partyId || '', category: parsed.data.category || '', notes: originalText, amount: total, finalTotal: total, paymentMode: 'Cash', items: parsed.data.items || [], date: new Date().toISOString().split('T')[0] };
            if (tx.type === 'expense') tx.paid = total; else if (tx.type === 'sales') tx.received = total;
            await saveRecord('transactions', tx, tx.type);
            setSuccessMessage(`Entry done: ₹${total}`); speakJarvis(`Entry ho gayi hai.`); setIsProcessing(false); return;
        }
        
        if (parsed.action === 'ASK_QUESTION') {
            setSuccessMessage(parsed.data.question); speakJarvis(parsed.data.question); setIsProcessing(false); return;
        }
    };

    const callGemini = async (text) => {
        return requestQueue = requestQueue.then(async () => {
            const now = Date.now();
            const wait = Math.max(0, 4000 - (now - lastGeminiCall));
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            lastGeminiCall = Date.now();

            const ctx = {
                parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).map(i => ({ id: i.id, name: i.name, sellPrice: i.sellPrice, category: i.category })),
                openTasks: (data?.tasks || []).filter(t => t.status !== 'Done').map(t => ({ id: t.id, name: t.name, partyId: t.partyId }))
            };

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error('API Key missing in .env');

            // Using the most stable model name and version
            const modelName = 'gemini-1.5-flash'; 
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `System: You are JARVIS for SMEES ERP. Parse command to JSON.
Rules:
1. Match party/item/task from CONTEXT only. Use IDs.
2. For "add item to task", identify the specific Task ID by matching party name and task name keywords.
3. Actions: VIEW_TASK, MODIFY_TASK, CREATE_TASK, CREATE_TRANSACTION, ASK_QUESTION.
4. JSON Format ONLY. No text.

CONTEXT:
${JSON.stringify(ctx)}

COMMAND: "${text}"` }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                })
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || `API Error: ${res.status}`);
            }

            const json = await res.json();
            const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) throw new Error('AI ne koi response nahi diya.');
            return JSON.parse(raw.trim());
        });
    };

    const confirmAction = async () => {
        if (!pendingAction) return;
        setIsProcessing(true); setStatusText('Executing...');
        try { await executeAction(pendingAction.parsed, pendingAction.originalText); setPendingAction(null); }
        catch (e) { setError(e.message); setIsProcessing(false); }
    };

    const cancelAction = () => { setPendingAction(null); setTranscript(''); speakJarvis('Cancel kar diya.'); };

    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Thinking...'); setSuccessMessage(''); setError('');
        try {
            const parsed = await callGemini(text);
            if (parsed.action === 'VIEW_TASK') { await executeAction(parsed, text); }
            else {
                setPendingAction({ parsed, originalText: text, preview: getPreview(parsed) });
                setIsProcessing(false); speakJarvis('Confirm kijiye.');
            }
        } catch (e) {
            setError(e.message.includes('429') ? 'Jarvis thoda busy hai, 5 sec rukiye.' : e.message);
            setIsProcessing(false);
        }
    };

    if (!isOpen) return (
        <button onClick={() => { resetState(); setIsOpen(true); }} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-slate-900 text-blue-400 rounded-full shadow-2xl border-2 border-blue-500/30 active:scale-95 transition-all"><Bot size={24} /></button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-[40px] shadow-2xl p-6 relative">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-2xl flex items-center justify-center"><Bot size={20} /></div>
                        <div><h3 className="font-black text-white text-lg">J.A.R.V.I.S</h3><p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">● ONLINE</p></div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2.5 bg-white/5 rounded-full text-slate-400"><X size={18} /></button>
                </div>

                <div className="min-h-[150px] flex flex-col items-center justify-center mb-6">
                    {error ? (
                        <div className="text-center px-4"><p className="font-bold text-rose-400 mb-4">{error}</p><button onClick={resetState} className="text-[10px] font-black text-blue-400 uppercase">↻ Retry</button></div>
                    ) : pendingAction ? (
                        <div className="flex flex-col items-center gap-5 w-full">
                            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4"><p className="text-white font-bold">{pendingAction.preview}</p></div>
                            <div className="flex gap-2 w-full">
                                <button onClick={confirmAction} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"><Check size={18} /> Haan</button>
                                <button onClick={cancelAction} className="flex-1 py-3 bg-rose-600/80 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"><XCircle size={18} /> Cancel</button>
                            </div>
                            <p className="text-[10px] text-white/30 font-bold">🎤 Haan ya Cancel bolo</p>
                        </div>
                    ) : successMessage ? (
                        <div className="text-center"><p className="font-black text-emerald-400 text-lg mb-4">{successMessage}</p>{lastCreatedRecord && <button onClick={() => { setViewDetail(lastCreatedRecord); setIsOpen(false); }} className="px-8 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2"><Eye size={14} /> View</button>}</div>
                    ) : isProcessing ? (
                        <div className="text-center"><Loader2 size={36} className="text-blue-400 animate-spin mb-4 mx-auto" /><p className="text-sm font-black text-blue-400 uppercase tracking-widest">{statusText}</p></div>
                    ) : (
                        <div className="w-full text-center px-4"><p className="text-xl font-bold text-white/90">{transcript || 'Command bolo...'}</p></div>
                    )}
                </div>

                {!successMessage && !isProcessing && !error && !pendingAction && (
                    <div className="flex flex-col items-center gap-5">
                        <button onClick={toggleListening} className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-blue-400 border-2 border-blue-500/20'}`}><Mic size={32} /></button>
                        <form onSubmit={(e) => { e.preventDefault(); const v = inputText.trim(); if (v) { processCommand(v); setInputText(''); } }} className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                            <input type="text" className="flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none text-white placeholder:text-white/20" placeholder="Type command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                            <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><Send size={16} /></button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIVoiceAssistant;
