import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Send, Eye, AlertCircle } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

// Rate limiter: min 4 sec between Gemini calls
let lastGeminiCall = 0;

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
    
    const recognitionRef = useRef(null);
    const { saveRecord } = useDatabase(data, setData);

    // ─── Speech Recognition ───
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            const r = new SR();
            r.continuous = false;
            r.interimResults = true;
            r.lang = 'en-IN';
            r.onresult = (e) => {
                let t = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) t += e.results[i][0].transcript;
                setTranscript(t);
            };
            r.onend = () => setIsListening(false);
            r.onerror = (e) => { setIsListening(false); setError('Mic: ' + e.error); };
            recognitionRef.current = r;
        }
    }, []);

    // ─── Voice Loading ───
    useEffect(() => {
        const load = () => window.speechSynthesis?.getVoices();
        load();
        if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
    }, []);

    // ─── Jarvis Voice ───
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

    // ─── Auto-process when speech ends ───
    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            processCommand(transcript);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); return; }
        setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null); setError('');
        setStatusText('Listening...');
        try { recognitionRef.current.start(); setIsListening(true); }
        catch (e) { setError('Mic failed: ' + e.message); }
    };

    // ─── SMART Local Parser ───
    const parseLocally = (text) => {
        if (!text || !data) return null;
        const t = text.toLowerCase().trim();

        // STEP 1: Detect intent FIRST (before extracting numbers)
        const isTask = /task|kaam|service|remind/i.test(t);
        const isModify = /add|jod|jodo|update|modify|badal|daal|dal do|me dal|item dal|add kar/i.test(t);
        const isExpense = /expense|kharcha|kharche|kharch|bill|payment|pay/i.test(t);
        const isSale = /sale|sell|bech|bikri/i.test(t);
        const isPurchase = /purchase|kharid|buy|liya/i.test(t);
        const isCreate = /create|bana|banao|kar do|kardo|likho|likh|dal do|dalo/i.test(t);

        // STEP 2: Extract Task ID — ONLY numbers near "task/T-" context
        const taskIdMatch = t.match(/(?:task\s*(?:number|no|num|#)?\s*(\d+))|(?:t[-\s]?(\d{2,}))/i);
        const taskId = taskIdMatch ? `T-${taskIdMatch[1] || taskIdMatch[2]}` : null;

        // STEP 3: Extract Amount — ONLY when explicitly marked with rs/rupay/₹
        const amtMatch = t.match(/(\d+)\s*(?:rs|rupay|rupees|₹|rupes|rupiya)/i) 
                       || t.match(/(?:₹|rs\.?)\s*(\d+)/i)
                       || t.match(/(?:price|rate|amount|total)\s*(\d+)/i);
        const amount = amtMatch ? parseFloat(amtMatch[1]) : null;

        // STEP 4: Extract Qty
        const qtyMatch = t.match(/(\d+)\s*(?:qty|quantity|piece|pcs|nug)/i);
        const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

        // STEP 5: Match items, parties from master data
        let foundItem = null, foundParty = null, foundBrand = null;
        for (const item of (data.items || [])) {
            const n = (item.name || '').toLowerCase();
            if (n && n.length > 1 && t.includes(n)) { foundItem = item; break; }
            for (const b of (item.brands || [])) {
                const bn = (b.name || '').toLowerCase();
                if (bn && bn.length > 1 && t.includes(bn)) { foundItem = item; foundBrand = b; break; }
            }
            if (foundItem) break;
        }
        for (const p of (data.parties || [])) {
            const pn = (p.name || '').toLowerCase();
            if (pn && pn.length > 1 && t.includes(pn)) { foundParty = p; break; }
        }

        // ── RULE 1: Task with number = Task reference (NOT expense) ──
        if (isTask && taskId) {
            if (foundItem) {
                return { action: 'MODIFY_TASK', data: { taskId, itemName: foundItem.name, itemId: foundItem.id, qty, price: amount || foundBrand?.sellPrice || foundItem.sellPrice || 0, brand: foundBrand?.name || '' } };
            }
            // "task 778 open karo" or "task 778 dekhao"
            return { action: 'VIEW_TASK', data: { taskId } };
        }

        // ── RULE 2: Modify task (add item) ──
        if (isModify && foundItem) {
            return { action: 'MODIFY_TASK', data: { taskId: null, itemName: foundItem.name, itemId: foundItem.id, qty, price: amount || foundBrand?.sellPrice || foundItem.sellPrice || 0, brand: foundBrand?.name || '' } };
        }

        // ── RULE 3: Create task ──
        if (isTask && !taskId) {
            const taskName = foundItem?.name || foundParty?.name || text.replace(/task|create|banao|bana|karo|kar do|kaam/gi, '').trim() || 'New Task';
            return { action: 'CREATE_TASK', data: { name: taskName, partyId: foundParty?.id || '' } };
        }

        // ── RULE 4: Expense/Sale/Purchase with explicit amount ──
        if (amount !== null) {
            let type = 'expense';
            if (isSale) type = 'sales';
            else if (isPurchase) type = 'purchase';
            return { action: 'CREATE_TRANSACTION', data: { type, partyId: foundParty?.id || '', category: foundItem?.category || '', amount, items: foundItem ? [{ itemId: foundItem.id, qty, price: amount / qty, brand: foundBrand?.name || '' }] : [] } };
        }

        // ── RULE 5: Expense with item but no amount ──
        if ((isExpense || isCreate) && (foundItem || foundParty)) {
            return { action: 'CREATE_TRANSACTION', data: { type: 'expense', partyId: foundParty?.id || '', category: foundItem?.category || '', amount: 0, items: foundItem ? [{ itemId: foundItem.id, qty: 1, price: foundItem.sellPrice || 0, brand: '' }] : [] } };
        }

        return null; // Can't parse locally → will go to Gemini
    };

    // ─── Execute Action ───
    const executeAction = async (parsed, originalText) => {
        if (!parsed?.action) throw new Error('Command samajh nahi aaya.');

        if (parsed.action === 'VIEW_TASK') {
            const tasks = data?.tasks || [];
            const task = tasks.find(t => t.id === parsed.data.taskId);
            if (task) {
                setTranscript(''); setSuccessMessage(`Task: ${task.name} (${task.status})`);
                setLastCreatedRecord({ id: task.id, type: 'task', data: task });
                speakJarvis(`Task mila. ${task.name}. Status ${task.status}.`);
            } else {
                throw new Error(`Task ${parsed.data.taskId} nahi mila.`);
            }
            setIsProcessing(false);
            return;
        }

        if (parsed.action === 'MODIFY_TASK') {
            const tasks = data?.tasks || [];
            let targetTask;
            if (parsed.data.taskId) targetTask = tasks.find(t => t.id === parsed.data.taskId);
            if (!targetTask) targetTask = tasks.find(t => t.status !== 'Done' && t.status !== 'Converted');
            if (!targetTask) throw new Error('Koi active task nahi mila.');

            const existingItems = targetTask.itemsUsed || [];
            const idx = existingItems.findIndex(i => i.itemId === parsed.data.itemId);
            let updatedItems, msg;
            if (idx >= 0) {
                updatedItems = [...existingItems];
                updatedItems[idx] = { ...updatedItems[idx], qty: parseFloat(updatedItems[idx].qty || 0) + parsed.data.qty };
                msg = `${parsed.data.itemName} pehle se tha. Qty: ${updatedItems[idx].qty}`;
            } else {
                updatedItems = [...existingItems, { itemId: parsed.data.itemId, qty: parsed.data.qty, price: parsed.data.price, brand: parsed.data.brand }];
                msg = `${parsed.data.itemName} add kiya: ${targetTask.name}`;
            }
            await saveRecord('tasks', { ...targetTask, itemsUsed: updatedItems, updatedAt: new Date().toISOString() }, 'task');
            setTranscript(''); setSuccessMessage(msg);
            setLastCreatedRecord({ id: targetTask.id, type: 'task', data: { ...targetTask, itemsUsed: updatedItems } });
            speakJarvis(msg); setIsProcessing(false);
            return;
        }

        if (parsed.action === 'CREATE_TASK') {
            const task = { name: parsed.data?.name || 'New Task', partyId: parsed.data?.partyId || '', status: 'To Do', description: originalText, createdAt: new Date().toISOString() };
            const id = await saveRecord('tasks', task, 'task');
            setTranscript(''); setSuccessMessage(`Task: ${task.name}`);
            setLastCreatedRecord({ id, type: 'task', data: { ...task, id } });
            speakJarvis(`Task ban gaya, ${task.name}`); setIsProcessing(false);
            return;
        }

        if (parsed.action === 'CREATE_TRANSACTION') {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({ ...i, qty: parseFloat(i.qty || 1), price: parseFloat(i.price || 0), isBundle: false, subItems: [] }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);
            const tx = { type, partyId: parsed.data?.partyId || '', category: parsed.data?.category || '', notes: originalText, amount: total, finalTotal: total, grossTotal: total, paymentMode: 'Cash', items, date: new Date().toISOString().split('T')[0] };
            if (type === 'expense' || type === 'purchase') tx.paid = total;
            else if (type === 'sales') tx.received = total;
            const id = await saveRecord('transactions', tx, type);
            setTranscript(''); setSuccessMessage(`${type.toUpperCase()}: ₹${total}`);
            setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakJarvis(`${type} entry, ${total} rupaye.`); setIsProcessing(false);
            return;
        }

        throw new Error('Command samajh nahi aaya.');
    };

    // ─── Gemini AI Call (with rate limiter) ───
    const callGemini = async (text) => {
        const now = Date.now();
        const gap = now - lastGeminiCall;
        if (gap < 4000) {
            // Wait for remaining cooldown
            await new Promise(r => setTimeout(r, 4000 - gap));
        }
        lastGeminiCall = Date.now();

        const ctx = {
            parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
            items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category })),
            recentTasks: (data?.tasks || []).filter(t => t.status !== 'Done').slice(0, 10).map(t => ({ id: t.id, name: t.name, status: t.status }))
        };

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key not set.');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: `You are JARVIS, an ERP assistant. Parse this Hinglish/Hindi command into JSON action.

RULES:
- Return ONLY valid JSON, nothing else
- Actions: CREATE_TASK, CREATE_TRANSACTION, MODIFY_TASK, VIEW_TASK, ASK_QUESTION
- For CREATE_TRANSACTION: {"action":"CREATE_TRANSACTION","data":{"type":"expense|sales|purchase","partyId":"","category":"","amount":0,"items":[{"itemId":"","qty":1,"price":0,"brand":""}]}}
- For CREATE_TASK: {"action":"CREATE_TASK","data":{"name":"","partyId":""}}
- For MODIFY_TASK: {"action":"MODIFY_TASK","data":{"taskId":"T-xxx","itemName":"","itemId":"","qty":1,"price":0,"brand":""}}
- For VIEW_TASK: {"action":"VIEW_TASK","data":{"taskId":"T-xxx"}}
- For ASK_QUESTION: {"action":"ASK_QUESTION","data":{"question":"your question in Hinglish"}}
- "task 778" or "task number 778" means taskId "T-778", NOT amount 778
- If qty missing, default 1. If price missing, use 0.
- Match party/item names from context. Use IDs from context.

CONTEXT:
${JSON.stringify(ctx)}

USER COMMAND: "${text}"` }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
            })
        });
        clearTimeout(timer);

        const json = await res.json();
        if (json.error) {
            if (json.error.code === 429) throw new Error('AI busy hai. 1 min baad try karo.');
            throw new Error(json.error.message || 'AI error');
        }
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error('AI ne jawab nahi diya.');
        return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
    };

    // ─── Main Pipeline: Local first → Gemini fallback ───
    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Processing...'); setSuccessMessage(''); setError('');

        const safetyTimer = setTimeout(() => {
            setIsProcessing(false); setTranscript('');
            setError('Timeout. Try again.');
        }, 15000);

        try {
            // Try local parsing first (instant)
            const local = parseLocally(text);
            if (local) {
                await executeAction(local, text);
                clearTimeout(safetyTimer);
                return;
            }

            // Fallback: Ask Gemini AI (with rate limiter)
            setStatusText('AI soch raha hai...');
            const aiResult = await callGemini(text);
            await executeAction(aiResult, text);
            clearTimeout(safetyTimer);

        } catch (e) {
            clearTimeout(safetyTimer);
            setTranscript(''); setError(e.message || 'Error');
            speakJarvis(e.message || 'Error aa gaya');
            setIsProcessing(false);
        }
    };

    // ─── UI ───
    if (!isOpen) return (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-slate-900 text-blue-400 rounded-full shadow-2xl shadow-blue-500/20 flex items-center justify-center border-2 border-blue-500/30 active:scale-95 transition-all">
            <Bot size={24} />
        </button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-[40px] shadow-2xl shadow-blue-500/10 p-6 relative overflow-hidden" style={{animation: 'jarvisSlide 0.3s ease-out'}}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-2xl flex items-center justify-center"><Bot size={20} /></div>
                        <div>
                            <h3 className="font-black text-white leading-none mb-1 tracking-tight text-lg">J.A.R.V.I.S</h3>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{color: !data ? '#ef4444' : isProcessing ? '#f59e0b' : isListening ? '#22d3ee' : '#3b82f6'}}>
                                {!data ? '● OFFLINE' : isProcessing ? '● PROCESSING' : isListening ? '● LISTENING' : '● ONLINE'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); if(isListening) { recognitionRef.current?.stop(); setIsListening(false); } }} className="p-2.5 bg-white/5 rounded-full text-slate-400"><X size={18} /></button>
                </div>

                <div className="min-h-[150px] flex flex-col items-center justify-center mb-6 relative z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-4 text-center px-4">
                            <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20"><AlertCircle className="text-rose-400" size={28} /></div>
                            <p className="font-bold text-rose-400 text-sm">{error}</p>
                            <button onClick={() => { setError(''); setStatusText('JARVIS Online.'); }} className="text-[10px] font-black text-blue-400 uppercase tracking-widest">↻ Clear</button>
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

                {!successMessage && !isProcessing && !error && (
                    <div className="flex flex-col items-center gap-5 relative z-10">
                        <div className="relative">
                            {isListening && <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl animate-pulse scale-150" />}
                            <button onClick={toggleListening} className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${isListening ? 'bg-rose-500 text-white shadow-rose-500/40 scale-105' : 'bg-slate-800 text-blue-400 border-2 border-blue-500/20 active:scale-95'}`}>
                                <Mic size={32} />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); const v = inputText.trim(); if (v && !isProcessing) { setTranscript(v); processCommand(v); setInputText(''); } }} className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                            <input type="text" className="flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none text-white placeholder:text-white/20" placeholder="Type command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                            <button type="submit" disabled={!inputText.trim()} className="w-10 h-10 bg-blue-600 disabled:bg-blue-600/30 text-white rounded-xl flex items-center justify-center active:scale-95"><Send size={16} /></button>
                        </form>
                    </div>
                )}
            </div>
            <style>{`@keyframes jarvisSlide { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
    );
};

export default AIVoiceAssistant;
