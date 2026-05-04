import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Send, Eye, AlertCircle, Check, XCircle, Pencil } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

// Rate limiter: min 4 sec between Gemini calls
let lastGeminiCall = 0;

// ─── SMART FUZZY HELPERS ───
const getSimilarity = (s1, s2) => {
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 80;
    
    // Simple word match score
    const w1 = a.split(/[\s-]+/);
    const w2 = b.split(/[\s-]+/);
    let matches = 0;
    w1.forEach(x => { if (x.length > 2 && w2.some(y => y.includes(x) || x.includes(y))) matches++; });
    return (matches / Math.max(w1.length, w2.length)) * 70;
};

const findBestMatch = (text, list, minScore = 30) => {
    let best = null;
    let max = -1;
    list.forEach(item => {
        const score = getSimilarity(text, item.name || '');
        if (score > max) { max = score; best = item; }
    });
    return max >= minScore ? { item: best, score: max } : null;
};

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
    const [pendingAction, setPendingAction] = useState(null); // {parsed, originalText, preview}
    
    // ─── Local Learning Memory ───
    const getLearningData = () => {
        try { return JSON.parse(localStorage.getItem('jarvis_learning') || '{}'); } catch { return {}; }
    };
    const learnMatch = (text, itemId) => {
        const memory = getLearningData();
        memory[text.toLowerCase().trim()] = itemId;
        localStorage.setItem('jarvis_learning', JSON.stringify(memory));
    };
    
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

    useEffect(() => { const l = () => window.speechSynthesis?.getVoices(); l(); if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = l; }, []);

    const speakJarvis = (text, cb = null) => {
        if (!('speechSynthesis' in window)) { cb?.(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const pick = voices.find(v => /hindi/i.test(v.name) && !/female/i.test(v.name))
            || voices.find(v => /\bhi[-_]IN\b/i.test(v.lang) && !/female/i.test(v.name))
            || voices.find(v => /male/i.test(v.name) && /en/i.test(v.lang))
            || voices.find(v => /david/i.test(v.name))
            || voices.find(v => /\ben[-_]/i.test(v.lang) && !/female/i.test(v.name))
            || voices[0];
        if (pick) u.voice = pick;
        u.lang = 'hi-IN'; u.pitch = 0.65; u.rate = 0.95; u.volume = 1.0;
        if (cb) u.onend = cb;
        window.speechSynthesis.speak(u);
    };

    // Auto-process OR auto-confirm via voice
    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            if (pendingAction) {
                const t = transcript.toLowerCase().trim();
                if (/^(haan|han|yes|ha|ok|confirm|kar do|karo|theek|thik|done|sahi)/.test(t)) {
                    confirmAction();
                } else if (/^(nahi|nhi|no|cancel|mat|ruk|band|naa|chhodo|rehne|rehne do)/.test(t)) {
                    cancelAction();
                } else {
                    // Treat as CORRECTION → update pending action
                    applyCorrection(transcript);
                }
            } else {
                processCommand(transcript);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const resetState = () => {
        setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null);
        setError(''); setStatusText('JARVIS Online.'); setIsProcessing(false);
        setPendingAction(null);
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); return; }
        if (!pendingAction) resetState();
        setTranscript('');
        setStatusText(pendingAction ? 'Confirm: Haan ya Nahi?' : 'Listening...');
        try { recognitionRef.current.start(); setIsListening(true); }
        catch (e) { setError('Mic: ' + e.message); }
    };

    // ─── Generate human-readable preview of action ───
    const getPreview = (parsed) => {
        if (!parsed?.action) return 'Unknown action';
        const d = parsed.data || {};
        if (parsed.action === 'VIEW_TASK') return `📋 Task ${d.taskId} dekhna hai`;
        if (parsed.action === 'MODIFY_TASK') {
            const taskLabel = d.taskId || 'latest active task';
            return `✏️ ${taskLabel} mein add: ${d.itemName || 'item'} × ${d.qty || 1}${d.price ? ` @ ₹${d.price}` : ''}`;
        }
        if (parsed.action === 'CREATE_TASK') return `📝 Naya Task: "${d.name || 'New Task'}"`;
        if (parsed.action === 'CREATE_TRANSACTION') {
            const itemNames = (d.items || []).map(i => { const item = (data?.items || []).find(x => x.id === i.itemId); return item?.name || 'item'; }).join(', ');
            return `💰 ${(d.type || 'expense').toUpperCase()}: ₹${d.amount || 0}${itemNames ? ` (${itemNames})` : ''}`;
        }
        return `❓ ${parsed.action}`;
    };

    // ─── Apply correction to pending action ───
    const applyCorrection = (correctionText) => {
        if (!pendingAction) return;
        const t = correctionText.toLowerCase().trim();
        const updated = JSON.parse(JSON.stringify(pendingAction.parsed)); // deep clone

        // Try to find a new item in the correction
        let newItem = null, newBrand = null;
        const memory = getLearningData();
        const learnedId = memory[t];
        
        if (learnedId) {
            newItem = (data?.items || []).find(i => i.id === learnedId);
        }

        if (!newItem) {
            const words = t.split(/[\s-]+/);
            let bestScore = 0;
            for (const item of (data?.items || [])) {
                const n = (item.name || '').toLowerCase();
                let score = 0;
                if (t.includes(n)) score += 10;
                const itemWords = n.split(/[\s-]+/);
                itemWords.forEach(iw => {
                    if (iw.length > 1 && words.some(w => w === iw || w.includes(iw))) score += 5;
                });
                if (score > bestScore) { bestScore = score; newItem = item; }
            }
        }

        // Try to extract new qty
        const qtyMatch = t.match(/(\d+)\s*(?:qty|quantity|piece|pcs)/i) || t.match(/(?:qty|quantity)\s*(\d+)/i);
        const newQty = qtyMatch ? parseFloat(qtyMatch[1]) : null;

        // Try to extract new amount
        const amtMatch = t.match(/(\d+)\s*(?:rs|rupay|rupees|₹)/i) || t.match(/(?:₹|rs\.?)\s*(\d+)/i);
        const newAmount = amtMatch ? parseFloat(amtMatch[1]) : null;

        // Try to find new party
        let newParty = null;
        for (const p of (data?.parties || [])) { const pn = (p.name || '').toLowerCase(); if (pn && pn.length > 1 && t.includes(pn)) { newParty = p; break; } }

        // Apply corrections to the action data
        if (updated.action === 'MODIFY_TASK' || updated.action === 'CREATE_TRANSACTION') {
            if (newItem) {
                updated.data.itemName = newItem.name;
                updated.data.itemId = newItem.id;
                if (!newAmount) updated.data.price = newBrand?.sellPrice || newItem.sellPrice || updated.data.price;
                updated.data.brand = newBrand?.name || '';
                // For transactions, update items array
                if (updated.data.items && updated.data.items.length > 0) {
                    updated.data.items[0].itemId = newItem.id;
                    updated.data.items[0].brand = newBrand?.name || '';
                }
            }
            if (newQty !== null) {
                updated.data.qty = newQty;
                if (updated.data.items && updated.data.items.length > 0) updated.data.items[0].qty = newQty;
            }
            if (newAmount !== null) {
                updated.data.price = newAmount;
                updated.data.amount = newAmount;
                if (updated.data.items && updated.data.items.length > 0) updated.data.items[0].price = newAmount;
            }
        }
        if (updated.action === 'CREATE_TASK' && newItem) updated.data.name = newItem.name;
        if (newParty) updated.data.partyId = newParty.id;

        // Learn this correction!
        if (newItem) learnMatch(t, newItem.id);

        const newPreview = getPreview(updated);
        setPendingAction({ parsed: updated, originalText: correctionText, preview: newPreview });
        setTranscript('');
        setIsEditingText(false);
        speakJarvis('Theek hai, update kar diya. Ab confirm karo.');
    };

    // ─── Local Parser (DISABLED for now as requested) ───
    const parseLocally = (text) => {
        // ALWAYS return null to force Gemini AI usage
        return null;
    };

    // ─── Execute Action (runs AFTER confirmation) ───
    const executeAction = async (parsed, originalText) => {
        if (!parsed?.action) throw new Error('Command samajh nahi aaya.');

        if (parsed.action === 'VIEW_TASK') {
            const task = (data?.tasks || []).find(t => t.id === parsed.data.taskId);
            if (task) { setSuccessMessage(`Task: ${task.name} (${task.status})`); setLastCreatedRecord({ id: task.id, type: 'task', data: task }); speakJarvis(`Task mila. ${task.name}.`); }
            else throw new Error(`Task ${parsed.data.taskId} nahi mila.`);
            setIsProcessing(false); return;
        }

        if (parsed.action === 'MODIFY_TASK') {
            const tasks = data?.tasks || [];
            let t;
            
            if (parsed.data.taskId) {
                t = tasks.find(x => x.id === parsed.data.taskId);
            } else {
                // Smart Task Search
                let pool = tasks.filter(x => x.status !== 'Done' && x.status !== 'Converted');
                
                // 1. Filter by Party if provided
                if (parsed.data.partyId) {
                    const partyTasks = pool.filter(x => x.partyId === parsed.data.partyId);
                    if (partyTasks.length > 0) pool = partyTasks;
                }
                
                // 2. Score tasks based on command text keywords
                if (pool.length > 1) {
                    let bestTask = pool[0];
                    let maxScore = -1;
                    
                    pool.forEach(task => {
                        const score = getSimilarity(originalText, task.name);
                        if (score > maxScore) { maxScore = score; bestTask = task; }
                    });
                    t = bestTask;
                } else {
                    t = pool[0];
                }
            }
            
            if (!t) throw new Error('Sahi task nahi mila. Task ka naam ya ID bolo.');
            const items = t.itemsUsed || []; const idx = items.findIndex(i => i.itemId === parsed.data.itemId);
            let updated, msg;
            if (idx >= 0) { updated = [...items]; updated[idx] = { ...updated[idx], qty: parseFloat(updated[idx].qty || 0) + parsed.data.qty }; msg = `${parsed.data.itemName} pehle se tha. Qty: ${updated[idx].qty}`; }
            else { updated = [...items, { itemId: parsed.data.itemId, qty: parsed.data.qty, price: parsed.data.price, brand: parsed.data.brand }]; msg = `${parsed.data.itemName} add kiya: ${t.name}`; }
            await saveRecord('tasks', { ...t, itemsUsed: updated, updatedAt: new Date().toISOString() }, 'task');
            setSuccessMessage(msg); setLastCreatedRecord({ id: t.id, type: 'task', data: { ...t, itemsUsed: updated } }); speakJarvis(msg); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TASK') {
            const task = { name: parsed.data?.name || 'New Task', partyId: parsed.data?.partyId || '', status: 'To Do', description: originalText, createdAt: new Date().toISOString() };
            const id = await saveRecord('tasks', task, 'task');
            setSuccessMessage(`Task: ${task.name}`); setLastCreatedRecord({ id, type: 'task', data: { ...task, id } }); speakJarvis(`Task ban gaya, ${task.name}`); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TRANSACTION') {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({ ...i, qty: parseFloat(i.qty || 1), price: parseFloat(i.price || 0), isBundle: false, subItems: [] }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);
            const tx = { type, partyId: parsed.data?.partyId || '', category: parsed.data?.category || '', notes: originalText, amount: total, finalTotal: total, grossTotal: total, paymentMode: 'Cash', items, date: new Date().toISOString().split('T')[0] };
            if (type === 'expense' || type === 'purchase') tx.paid = total; else if (type === 'sales') tx.received = total;
            const id = await saveRecord('transactions', tx, type);
            setSuccessMessage(`${type.toUpperCase()}: ₹${total}`); setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } }); speakJarvis(`${type} entry, ${total} rupaye.`); setIsProcessing(false); return;
        }

        throw new Error('Command samajh nahi aaya.');
    };

    // ─── Gemini AI Call ───
    const callGemini = async (text) => {
        const gap = Date.now() - lastGeminiCall;
        if (gap < 4000) await new Promise(r => setTimeout(r, 4000 - gap));
        lastGeminiCall = Date.now();

        const ctx = { 
            parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })), 
            items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category })), 
            activeTasks: (data?.tasks || []).filter(t => t.status !== 'Done').map(t => ({ id: t.id, name: t.name, partyId: t.partyId })) 
        };

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key not set.');

        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: `You are JARVIS ERP Assistant. Parse this Hinglish/Hindi command into JSON.
                
                RULES:
                - Return ONLY JSON.
                - Actions: CREATE_TASK, CREATE_TRANSACTION, MODIFY_TASK, VIEW_TASK.
                - "task 778" means taskId "T-778".
                - Match party/item names from CONTEXT.
                - For MODIFY_TASK: If user mentions a person (e.g. Sona Didi) and a task context (e.g. AC Repair), pick the matching task ID from activeTasks.
                - If qty missing, default 1.
                
                CONTEXT:
                ${JSON.stringify(ctx)}
                
                COMMAND: "${text}"` }] }], 
                generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } 
            })
        });
        clearTimeout(tm);
        const json = await res.json();
        if (json.error) { 
            if (json.error.code === 429) throw new Error('AI Busy (Rate Limit). 10 sec wait karo.'); 
            throw new Error(json.error.message || 'AI Error'); 
        }
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error('AI response missing.');
        return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
    };

    // ─── CONFIRM / CANCEL ───
    const confirmAction = async () => {
        if (!pendingAction) return;
        const { parsed, originalText } = pendingAction;
        setPendingAction(null);
        setIsProcessing(true); setStatusText('Executing...');
        try {
            await executeAction(parsed, originalText);
        } catch (e) {
            setError(e.message); speakJarvis(e.message); setIsProcessing(false);
        }
    };

    const cancelAction = () => {
        setPendingAction(null);
        setTranscript(''); setStatusText('Cancelled. Naya command do.');
        speakJarvis('Cancel kar diya.');
    };

    // ─── Main Pipeline → Parse → Show Preview → Wait for Confirm ───
    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Processing...'); setSuccessMessage(''); setError('');
        const safety = setTimeout(() => { setIsProcessing(false); setTranscript(''); setError('Timeout.'); }, 15000);

        try {
            let parsed = parseLocally(text);
            if (!parsed) {
                setStatusText('AI soch raha hai...');
                parsed = await callGemini(text);
            }
            clearTimeout(safety);

            // VIEW_TASK executes instantly (no confirmation needed)
            if (parsed.action === 'VIEW_TASK') {
                await executeAction(parsed, text);
                return;
            }

            // For all other actions: SHOW PREVIEW → WAIT FOR CONFIRMATION
            const preview = getPreview(parsed);
            setPendingAction({ parsed, originalText: text, preview });
            setIsProcessing(false);
            setTranscript('');
            speakJarvis('Ye karna hai? Confirm karo ya Cancel.');

        } catch (e) {
            clearTimeout(safety);
            setTranscript(''); setError(e.message || 'Error');
            speakJarvis(e.message || 'Error');
            setIsProcessing(false);
        }
    };

    // ─── UI ───
    if (!isOpen) return (
        <button onClick={() => { resetState(); setIsOpen(true); }} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-slate-900 text-blue-400 rounded-full shadow-2xl shadow-blue-500/20 flex items-center justify-center border-2 border-blue-500/30 active:scale-95 transition-all">
            <Bot size={24} />
        </button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-[40px] shadow-2xl shadow-blue-500/10 p-6 relative overflow-hidden" style={{animation: 'jarvisSlide 0.3s ease-out'}}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-2xl flex items-center justify-center"><Bot size={20} /></div>
                        <div>
                            <h3 className="font-black text-white leading-none mb-1 tracking-tight text-lg">J.A.R.V.I.S</h3>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{color: pendingAction ? '#f59e0b' : !data ? '#ef4444' : isProcessing ? '#f59e0b' : isListening ? '#22d3ee' : '#3b82f6'}}>
                                {pendingAction ? '● CONFIRM?' : !data ? '● OFFLINE' : isProcessing ? '● PROCESSING' : isListening ? '● LISTENING' : '● ONLINE'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); resetState(); if(isListening) { recognitionRef.current?.stop(); setIsListening(false); } }} className="p-2.5 bg-white/5 rounded-full text-slate-400"><X size={18} /></button>
                </div>

                {/* Content */}
                <div className="min-h-[150px] flex flex-col items-center justify-center mb-6 relative z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-4 text-center px-4">
                            <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20"><AlertCircle className="text-rose-400" size={28} /></div>
                            <p className="font-bold text-rose-400 text-sm">{error}</p>
                            <button onClick={resetState} className="text-[10px] font-black text-blue-400 uppercase tracking-widest">↻ Naya Command</button>
                        </div>

                    ) : pendingAction ? (
                        <div className="flex flex-col items-center gap-5 text-center w-full px-2">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Confirm Action</p>
                            
                            {isEditingText ? (
                                <div className="w-full space-y-3">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex items-center">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
                                            placeholder="Correction likho... (e.g. 3.15 mfd)"
                                            onKeyDown={(e) => { if(e.key === 'Enter' && e.target.value) applyCorrection(e.target.value); }}
                                        />
                                        <button 
                                            onClick={(e) => { const v = e.target.previousSibling.value; if(v) applyCorrection(v); }}
                                            className="p-2 text-blue-400"
                                        ><Send size={18}/></button>
                                    </div>
                                    <button onClick={() => setIsEditingText(false)} className="text-[10px] text-white/40 uppercase font-black tracking-widest">← Back</button>
                                </div>
                            ) : (
                                <>
                                    <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                                        <p className="text-white font-bold text-base leading-relaxed">{pendingAction.preview}</p>
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <button onClick={confirmAction} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                                            <Check size={16} /> Haan
                                        </button>
                                        <button onClick={() => setIsEditingText(true)} className="flex-1 py-3 bg-amber-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-amber-500/20">
                                            <Pencil size={16} /> Edit
                                        </button>
                                        <button onClick={cancelAction} className="flex-1 py-3 bg-rose-600/80 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-rose-500/20">
                                            <XCircle size={16} /> Cancel
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-white/30 font-bold">🎤 Haan / Cancel / Correction bolo</p>
                                </>
                            )}
                        </div>

                    ) : successMessage ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center"><CheckCircle2 className="text-emerald-400" size={32} /></div>
                            <p className="font-black text-emerald-400 text-lg">{successMessage}</p>
                            {lastCreatedRecord && (
                                <button onClick={() => { if (setViewDetail) { setViewDetail(lastCreatedRecord); setIsOpen(false); } }} className="px-8 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2">
                                    <Eye size={14} /> View Entry
                                </button>
                            )}
                        </div>
                    ) : isProcessing ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <Loader2 size={36} className="text-blue-400 animate-spin" />
                            <p className="text-sm font-black text-blue-400/80 uppercase tracking-widest">{statusText}</p>
                        </div>
                    ) : (
                        <div className="w-full text-center px-4">
                            <p className="text-xl font-bold text-white/90 tracking-tight leading-relaxed">{transcript || statusText}</p>
                        </div>
                    )}
                </div>

                {/* Controls — show when idle OR when confirming (for mic) */}
                {!successMessage && !isProcessing && !error && (
                    <div className="flex flex-col items-center gap-5 relative z-10">
                        <div className="relative">
                            {isListening && <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl animate-pulse scale-150" />}
                            <button onClick={toggleListening} className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${isListening ? 'bg-rose-500 text-white shadow-rose-500/40 scale-105' : 'bg-slate-800 text-blue-400 border-2 border-blue-500/20 active:scale-95'}`}>
                                <Mic size={32} />
                            </button>
                        </div>
                        {!pendingAction && (
                            <form onSubmit={(e) => { e.preventDefault(); const v = inputText.trim(); if (v && !isProcessing) { setTranscript(v); processCommand(v); setInputText(''); } }} className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                                <input type="text" className="flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none text-white placeholder:text-white/20" placeholder="Type command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                                <button type="submit" disabled={!inputText.trim()} className="w-10 h-10 bg-blue-600 disabled:bg-blue-600/30 text-white rounded-xl flex items-center justify-center active:scale-95"><Send size={16} /></button>
                            </form>
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes jarvisSlide { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
    );
};

export default AIVoiceAssistant;
