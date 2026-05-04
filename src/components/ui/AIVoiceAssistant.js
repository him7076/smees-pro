import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Send, Eye, AlertCircle } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const AIVoiceAssistant = ({ data, setData, setViewDetail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [inputText, setInputText] = useState('');
    const [statusText, setStatusText] = useState('JARVIS Online. Awaiting command.');
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
            r.onerror = (e) => { setIsListening(false); setError('Microphone: ' + e.error); };
            recognitionRef.current = r;
        }
    }, []);

    // ─── Voice Loading (mobile needs this) ───
    useEffect(() => {
        const load = () => window.speechSynthesis?.getVoices();
        load();
        if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
    }, []);

    // ─── Jarvis Voice: Deep Male Hindi ───
    const speakJarvis = (text, cb = null) => {
        if (!('speechSynthesis' in window)) { cb?.(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Priority for Hindi Male Deep Voice (Iron Man Hindi Dub style)
        const pick = voices.find(v => /hindi/i.test(v.name) && !/female/i.test(v.name))
            || voices.find(v => /\bhi[-_]IN\b/i.test(v.lang) && !/female/i.test(v.name))
            || voices.find(v => /male/i.test(v.name) && /en/i.test(v.lang))
            || voices.find(v => /david/i.test(v.name))
            || voices.find(v => /\ben[-_]IN\b/i.test(v.lang) && !/female/i.test(v.name))
            || voices.find(v => /\ben[-_]/i.test(v.lang) && !/female/i.test(v.name))
            || voices[0];
        
        if (pick) u.voice = pick;
        u.lang = 'hi-IN';    // Hindi language for Jarvis Hindi dub feel
        u.pitch = 0.65;      // Very deep
        u.rate = 0.95;       // Measured, confident
        u.volume = 1.0;
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

    // ─── Local Smart Parser (handles 90% of commands without API) ───
    const parseLocally = (text) => {
        if (!text || !data) return null;
        const t = text.toLowerCase().trim();

        // Extract numbers
        const amtMatch = t.match(/(\d+)\s*(?:rs|rupay|rupees|₹|rupes)/i) || t.match(/(?:₹|rs\.?)\s*(\d+)/i);
        const amount = amtMatch ? parseFloat(amtMatch[1]) : null;
        const qtyMatch = t.match(/(\d+)\s*(?:qty|quantity|piece|pcs|nug)/i);
        const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

        // Extract Task ID (T-778, t778, etc.)
        const taskIdMatch = t.match(/t[-\s]?(\d+)/i);
        const taskId = taskIdMatch ? `T-${taskIdMatch[1]}` : null;

        // Match items, parties, brands from local data
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

        // Intent detection
        const isModify = /add|jod|jodo|update|modify|change|edit|badal|daal|dal do|me dal/i.test(t);
        const isTask = /task|kaam|service|remind/i.test(t);
        const isExpense = /expense|kharcha|kharche|kharch/i.test(t);
        const isCreate = /create|bana|banao|kar do|kardo|likho|likh/i.test(t);

        // 1. MODIFY TASK: "T-778 me petrol add karo" or "task me item daal do"
        if ((isModify || isTask) && foundItem && (taskId || isTask)) {
            return {
                action: 'MODIFY_TASK',
                data: {
                    taskId: taskId,
                    itemName: foundItem.name,
                    itemId: foundItem.id,
                    qty: qty,
                    price: amount || foundBrand?.sellPrice || foundItem.sellPrice || 0,
                    brand: foundBrand?.name || ''
                }
            };
        }

        // 2. CREATE TASK: "task banao AC service" or "remind karo"
        if (isTask && (isCreate || !isModify)) {
            const taskName = foundItem?.name || foundParty?.name || text.replace(/task|create|banao|bana|karo|kar do/gi, '').trim() || 'New Task';
            return {
                action: 'CREATE_TASK',
                data: { name: taskName, partyId: foundParty?.id || '' }
            };
        }

        // 3. CREATE TRANSACTION: "100 rs petrol" or "expense 50 samosa"
        if (amount !== null && (foundItem || foundParty || isExpense)) {
            return {
                action: 'CREATE_TRANSACTION',
                data: {
                    type: 'expense',
                    partyId: foundParty?.id || '',
                    category: foundItem?.category || '',
                    amount,
                    items: foundItem ? [{ itemId: foundItem.id, qty, price: amount / qty, brand: foundBrand?.name || '' }] : []
                }
            };
        }

        return null;
    };

    // ─── Execute Action ───
    const executeAction = async (parsed, originalText) => {
        if (!parsed?.action) throw new Error('Command not recognized.');

        // ── MODIFY TASK ──
        if (parsed.action === 'MODIFY_TASK') {
            const tasks = data?.tasks || [];
            // Find task by ID or most recent active
            let targetTask;
            if (parsed.data.taskId) {
                targetTask = tasks.find(t => t.id === parsed.data.taskId);
            }
            if (!targetTask) {
                targetTask = tasks.find(t => t.status !== 'Done' && t.status !== 'Converted');
            }
            if (!targetTask) throw new Error('Koi active task nahi mila.');

            const existingItems = targetTask.itemsUsed || [];
            const existingIdx = existingItems.findIndex(i => i.itemId === parsed.data.itemId);
            
            let updatedItems, msg;
            if (existingIdx >= 0) {
                updatedItems = [...existingItems];
                updatedItems[existingIdx] = {
                    ...updatedItems[existingIdx],
                    qty: parseFloat(updatedItems[existingIdx].qty || 0) + parsed.data.qty
                };
                msg = `${parsed.data.itemName} pehle se tha. Qty badhakar ${updatedItems[existingIdx].qty} kar di.`;
            } else {
                updatedItems = [...existingItems, {
                    itemId: parsed.data.itemId, qty: parsed.data.qty,
                    price: parsed.data.price, brand: parsed.data.brand
                }];
                msg = `${parsed.data.itemName} add kiya task: ${targetTask.name}.`;
            }

            const updatedTask = { ...targetTask, itemsUsed: updatedItems, updatedAt: new Date().toISOString() };
            await saveRecord('tasks', updatedTask, 'task');
            setTranscript(''); setSuccessMessage(msg);
            setLastCreatedRecord({ id: targetTask.id, type: 'task', data: updatedTask });
            speakJarvis(msg); setIsProcessing(false);
            return;
        }

        // ── CREATE TASK ──
        if (parsed.action === 'CREATE_TASK') {
            const task = {
                name: parsed.data?.name || 'New Task',
                partyId: parsed.data?.partyId || '',
                status: 'To Do',
                description: originalText,
                createdAt: new Date().toISOString()
            };
            const id = await saveRecord('tasks', task, 'task');
            setTranscript(''); setSuccessMessage(`Task banaya: ${task.name}`);
            setLastCreatedRecord({ id, type: 'task', data: { ...task, id } });
            speakJarvis(`Task ban gaya hai, ${task.name}.`);
            setIsProcessing(false);
            return;
        }

        // ── CREATE TRANSACTION ──
        if (parsed.action === 'CREATE_TRANSACTION') {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({
                ...i, qty: parseFloat(i.qty || 1), price: parseFloat(i.price || 0),
                isBundle: false, subItems: []
            }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);
            const tx = {
                type, partyId: parsed.data?.partyId || '', category: parsed.data?.category || '',
                notes: originalText, amount: total, finalTotal: total, grossTotal: total,
                paymentMode: 'Cash', items, date: new Date().toISOString().split('T')[0]
            };
            if (type === 'expense' || type === 'purchase') tx.paid = total;
            else if (type === 'sales') tx.received = total;

            const id = await saveRecord('transactions', tx, type);
            setTranscript(''); setSuccessMessage(`${type.toUpperCase()} saved: ₹${total}`);
            setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakJarvis(`${type} entry ban gayi hai, ${total} rupaye ki.`);
            setIsProcessing(false);
            return;
        }

        if (parsed.action === 'ASK_QUESTION') {
            const q = parsed.data?.question || 'Thoda aur detail dijiye.';
            setTranscript(''); setStatusText(q);
            speakJarvis(q, () => { try { recognitionRef.current?.start(); setIsListening(true); } catch(e){} });
            setIsProcessing(false);
            return;
        }

        throw new Error('Action not supported.');
    };

    // ─── Main Pipeline ───
    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Scanning...'); setSuccessMessage(''); setError('');

        try {
            // Step 1: Local parse (instant, no API, no reads)
            const local = parseLocally(text);
            if (local) {
                await new Promise(r => setTimeout(r, 300));
                await executeAction(local, text);
                return;
            }

            // Step 2: Gemini AI fallback with 10s TIMEOUT
            setStatusText('AI Processing...');
            const ctx = {
                parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category, brands: (i.brands || []).map(b => b.name) })),
                recentTasks: (data?.tasks || []).filter(t => t.status !== 'Done').slice(0, 5).map(t => ({ id: t.id, name: t.name, status: t.status }))
            };

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error('API Key not set.');

            // Timeout wrapper - 10 seconds max
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Parse ERP command. JSON only: {action, data}. Actions: CREATE_TASK, CREATE_TRANSACTION, MODIFY_TASK, ASK_QUESTION. Context: ${JSON.stringify(ctx)}. Command: "${text}"` }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                })
            });
            clearTimeout(timeoutId);

            const json = await res.json();
            if (json.error) {
                if (json.error.code === 429) throw new Error('AI busy. 60 sec wait karo.');
                if (json.error.message?.includes('expired')) throw new Error('API Key expired.');
                if (json.error.message?.includes('not found')) throw new Error('AI model unavailable.');
                throw new Error(json.error.message);
            }
            const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) throw new Error('AI ne kuch nahi bheja.');

            await executeAction(JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim()), text);

        } catch (e) {
            console.error('Jarvis:', e);
            const msg = e.name === 'AbortError' ? 'AI timed out. Try again.' : (e.message || 'Unknown error');
            setTranscript(''); setError(msg);
            speakJarvis('Error aa gaya hai. Screen dekhiye.');
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

                {/* Header */}
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

                {/* Content */}
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

                {/* Controls */}
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
