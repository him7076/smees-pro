import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Send, Eye, AlertCircle, Check, XCircle, Pencil, ChevronRight, Cpu, Cloud, DownloadCloud } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

// Rate limiter
let lastGeminiCall = 0;
let requestQueue = Promise.resolve();

// Global Singleton for AI Engine to prevent reloading on every open
let globalEngine = null;
let globalDownloadProgress = 0;
let globalIsDownloading = false;

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
    const [localMode, setLocalMode] = useState(localStorage.getItem('smees_ai_local') === 'true');
    
    // Use local state but sync with global to trigger re-renders
    const [engine, setEngine] = useState(globalEngine);
    const [downloadProgress, setDownloadProgress] = useState(globalDownloadProgress);
    const [isDownloading, setIsDownloading] = useState(globalIsDownloading);
    const [pendingAction, setPendingAction] = useState(null);
    const [isEditingText, setIsEditingText] = useState(false);
    const [editText, setEditText] = useState('');
    
    const recognitionRef = useRef(null);
    const { saveRecord } = useDatabase(data, setData);

    // ─── Speech Recognition Setup ───
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

    // ─── Jarvis Voice ───
    const speakJarvis = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const pick = voices.find(v => /hindi/i.test(v.name) && !/female/i.test(v.name))
            || voices.find(v => /\bhi[-_]IN\b/i.test(v.lang) && !/female/i.test(v.name))
            || voices.find(v => /david/i.test(v.name))
            || voices.find(v => /\ben[-_]/i.test(v.lang) && !/female/i.test(v.name))
            || voices[0];
        if (pick) u.voice = pick;
        u.lang = 'hi-IN'; u.pitch = 0.65; u.rate = 0.95; u.volume = 1.0;
        window.speechSynthesis.speak(u);
    };

    // --- Local AI Init ---
    useEffect(() => {
        if (localMode && !globalEngine && !globalIsDownloading) {
            const loadEngine = async () => {
                globalIsDownloading = true;
                setIsDownloading(true);
                try {
                    const webLLM = await import('@mlc-ai/web-llm');
                    const newEngine = new webLLM.MLCEngine();
                    newEngine.setInitProgressCallback((report) => {
                        const prog = Math.round(report.progress * 100);
                        globalDownloadProgress = prog;
                        setDownloadProgress(prog);
                    });
                    // Using Gemma-2b for better mobile performance
                    await newEngine.reload("gemma-2b-it-q4f16_1-MLC");
                    globalEngine = newEngine;
                    setEngine(newEngine);
                } catch (e) {
                    console.error("Local AI Init Error:", e);
                    alert("Local AI failed. Your device might not support WebGPU.");
                    setLocalMode(false);
                } finally {
                    globalIsDownloading = false;
                    setIsDownloading(false);
                }
            };
            loadEngine();
        }
    }, [localMode]);

    // Cleanup reference if engine was reset elsewhere
    useEffect(() => {
        if (engine !== globalEngine) setEngine(globalEngine);
    }, [isOpen]);

    const toggleLocalMode = () => {
        const newVal = !localMode;
        setLocalMode(newVal);
        localStorage.setItem('smees_ai_local', newVal);
        if (newVal) setStatusText('Initializing Gemma 4...');
        else setStatusText('Switched to Gemini Cloud.');
    };

    // ─── Auto-process when speech ends ───
    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            if (pendingAction) {
                const t = transcript.toLowerCase().trim();
                if (/^(haan|han|yes|ha|ok|confirm|kar do|karo|theek|thik|done|sahi)/.test(t)) confirmAction();
                else if (/^(nahi|nhi|no|cancel|mat|ruk|band|naa|chhodo|rehne)/.test(t)) cancelAction();
                else applyCorrection(transcript);
            } else {
                processCommand(transcript);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const resetState = () => {
        setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null);
        setError(''); setStatusText('JARVIS Online.'); setIsProcessing(false);
        setPendingAction(null); setIsEditingText(false); setEditText('');
        setAmbiguousData(null);
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); return; }
        if (!pendingAction) resetState();
        setTranscript('');
        setStatusText(pendingAction ? 'Haan, Cancel, ya Correction bolo...' : 'Listening...');
        try { recognitionRef.current.start(); setIsListening(true); }
        catch (e) { setError('Mic: ' + e.message); }
    };

    // ─── Preview Text Generator ───
    const getPreview = (parsed) => {
        if (!parsed?.action) return 'Unknown';
        const d = parsed.data || {};
        if (parsed.action === 'VIEW_TASK') return `📋 Task ${d.taskId} dekhna hai`;
        if (parsed.action === 'MODIFY_TASK') {
            const task = (data?.tasks || []).find(t => t.id === d.taskId);
            const taskLabel = task ? `"${task.name}"` : (d.taskId || 'active task');
            return `✏️ ${taskLabel} mein add: ${d.itemName || 'item'} × ${d.qty || 1}${d.price ? ` @ ₹${d.price}` : ''}`;
        }
        if (parsed.action === 'CREATE_TASK') {
            const party = d.partyId ? (data?.parties || []).find(p => p.id === d.partyId)?.name : null;
            return `📝 Naya Task: "${d.name || 'New Task'}"${party ? ` (${party})` : ''}`;
        }
        if (parsed.action === 'CREATE_TRANSACTION') {
            const itemNames = (d.items || []).map(i => {
                const it = (data?.items || []).find(x => x.id === i.itemId);
                return it?.name || i.itemName || i.name || 'item';
            }).join(', ');
            return `💰 ${(d.type || 'expense').toUpperCase()}: ₹${d.amount || 0}${itemNames ? ` (${itemNames})` : ''}`;
        }
        if (parsed.action === 'ASK_QUESTION') return `❓ ${d.answer || d.question || ''}`;
        return `❓ ${parsed.action}`;
    };

    // ─── Apply Correction to Pending Action ───
    const applyCorrection = (corrText) => {
        if (!pendingAction) return;
        // Send the correction + original context to Gemini for re-parsing
        const combined = `Original: "${pendingAction.originalText}". Correction: "${corrText}". Apply the correction.`;
        setPendingAction(null);
        processCommand(combined);
    };

    // ─── Gemini AI Call (PRIMARY BRAIN) ───
    const callGemini = async (text) => {
        return requestQueue = requestQueue.then(async () => {
            const now = Date.now();
            const wait = Math.max(0, 1000 - (now - lastGeminiCall));
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            lastGeminiCall = Date.now();

            // --- START AI REQUEST ---

            // --- SMART CONTEXT FILTERING (For Local Mode) ---
            let localCtx = null;
            if (localMode) {
                const keywords = text.toLowerCase().split(' ');
                const filteredParties = (data?.parties || [])
                    .filter(p => keywords.some(k => p.name.toLowerCase().includes(k)))
                    .slice(0, 15)
                    .map(p => ({ id: p.id, name: p.name }));
                
                const filteredItems = (data?.items || [])
                    .filter(i => keywords.some(k => i.name.toLowerCase().includes(k)))
                    .slice(0, 10)
                    .map(i => ({ id: i.id, name: i.name, category: i.category }));

                localCtx = { parties: filteredParties, items: filteredItems };
            }

            const ctx = localMode ? localCtx : {
                parties: (data?.parties || []).slice(0, 400).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).slice(0, 200).map(i => ({ id: i.id, name: i.name, sellPrice: i.sellPrice, category: i.category })),
                openTasks: (data?.tasks || []).filter(t => t.status !== 'Done' && t.status !== 'Converted').slice(0, 50).map(t => {
                    const party = (data?.parties || []).find(p => p.id === t.partyId);
                    return { id: t.id, name: t.name, status: t.status, partyId: t.partyId, partyName: party?.name || '' };
                })
            };

            // --- STRICT MODE SELECTION ---
            if (localMode) {
                if (!engine) throw new Error("Local AI is still loading. Ek minute rukein.");
                
                try {
                    const reply = await engine.chat.completions.create({
                        messages: [
                            { role: "system", content: "You are JARVIS. Output JSON ONLY. Actions: CREATE_TASK, CREATE_TRANSACTION, VIEW_TASK, MODIFY_TASK." },
                            { role: "user", content: `CTX: ${JSON.stringify(ctx)}\nCMD: "${text}"` }
                        ],
                        max_tokens: 1024,
                        temperature: 0.1
                    });
                    const raw = reply.choices[0].message.content;
                    const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
                    return { ...parsed, engineUsed: 'Gemma-4 (Local)' };
                } catch (localErr) {
                    console.error("Local Engine Error:", localErr);
                    
                    // IF GPU ERROR, RESET ENGINE
                    if (localErr.message.includes("Instance") || localErr.message.includes("GPU")) {
                        globalEngine = null;
                        setEngine(null); // This triggers useEffect to reload
                        throw new Error("Phone ne AI connection tod diya. Maine reset kar diya hai, dobara bolein.");
                    }
                    
                    throw new Error("Local AI Error: " + localErr.message);
                }
            }

            // --- CLOUD ONLY (Gemini) ---
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error('Gemini API Key nahi mili. Please settings mein key check karein ya .env file check karein.');

            const prompt = `STRICT RULES:
1. Return ONLY valid JSON. No explanation.
2. Match party/item/task names from CONTEXT using IDs. Use fuzzy matching.
3. IMPORTANT: If a name matches MULTIPLE parties (e.g. "Amit" matches "Amit Lalwani" and "Amit Commission"), return AMBIGUOUS_PARTY action.
4. "task 778" means taskId "T-778".
5. For MODIFY_TASK: Find EXACT task by matching party AND keywords.
6. Default qty=1, price=0.

ACTIONS:
- VIEW_TASK: {"action":"VIEW_TASK","data":{"taskId":"T-xxx"}}
- MODIFY_TASK: {"action":"MODIFY_TASK","data":{"taskId":"T-xxx","itemName":"","itemId":"","qty":1,"price":0,"brand":""}}
- CREATE_TASK: {"action":"CREATE_TASK","data":{"name":"","partyId":""}}
- CREATE_TRANSACTION: {"action":"CREATE_TRANSACTION","data":{"type":"expense|sales|purchase","partyId":"","category":"","amount":0,"items":[{"itemId":"","itemName":"","qty":1,"price":0,"brand":""}]}}
- ASK_QUESTION: {"action":"ASK_QUESTION","data":{"question":"original question","answer":"your helpful answer in Hinglish"}}
- AMBIGUOUS_PARTY: {"action":"AMBIGUOUS_PARTY","data":{"matches":[{"id":"","name":""}], "originalCommand": ""}}

CONTEXT:
${JSON.stringify(ctx)}

COMMAND: "${text}"`;

            // Try primary model, fallback to lite if rate limited
            // Verified 2026 Model List from Google API
            const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-2.0-flash'];
            let lastError = null;

            for (const model of models) {
                try {
                    const ctrl = new AbortController();
                    const tm = setTimeout(() => ctrl.abort(), 30000);

                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: ctrl.signal,
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                        })
                    });
                    clearTimeout(tm);

                    if (res.status === 429) {
                        lastError = new Error('Rate limited on ' + model);
                        await new Promise(r => setTimeout(r, 2000));
                        continue; // Try next model
                    }

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error?.message || 'API Error: ' + res.status);
                    }

                    const json = await res.json();
                    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!raw) throw new Error('AI ne jawab nahi diya.');
                    return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
                } catch (e) {
                    if (e.name === 'AbortError') throw new Error('Timeout. Dobara try karo.');
                    lastError = e;
                    if (!e.message.includes('Rate limited')) throw e;
                }
            }
            throw lastError || new Error('AI busy hai. 30 sec mein try karo.');
        });
    };

    // ─── Execute Action (AFTER confirmation) ───
    const [ambiguousData, setAmbiguousData] = useState(null);

    const executeAction = async (parsed, originalText) => {
        if (!parsed?.action) throw new Error('Command samajh nahi aaya.');

        if (parsed.action === 'AMBIGUOUS_PARTY') {
            setAmbiguousData(parsed.data);
            setIsProcessing(false);
            speakJarvis(`${parsed.data.matches.length} accounts mile. Sahi wala select karo.`);
            return;
        }

        if (parsed.action === 'VIEW_TASK') {
            const task = (data?.tasks || []).find(t => t.id === parsed.data.taskId);
            if (task) {
                const party = (data?.parties || []).find(p => p.id === task.partyId);
                setSuccessMessage(`Task: ${task.name}${party ? ` (${party.name})` : ''} — ${task.status}`);
                setLastCreatedRecord({ id: task.id, type: 'task', data: task });
                speakJarvis(`Task mila. ${task.name}. Status ${task.status}.`);
            } else throw new Error(`Task ${parsed.data.taskId} nahi mila.`);
            setIsProcessing(false); return;
        }

        if (parsed.action === 'MODIFY_TASK') {
            const task = (data?.tasks || []).find(t => t.id === parsed.data.taskId);
            if (!task) throw new Error(`Task ${parsed.data.taskId} nahi mila.`);
            
            const items = task.itemsUsed || [];
            const idx = parsed.data.itemId ? items.findIndex(i => i.itemId === parsed.data.itemId) : -1;
            let updated, msg;
            if (idx >= 0) {
                updated = [...items];
                updated[idx] = { ...updated[idx], qty: parseFloat(updated[idx].qty || 0) + (parsed.data.qty || 1) };
                msg = `${parsed.data.itemName} qty update: ${updated[idx].qty}`;
            } else {
                updated = [...items, { itemId: parsed.data.itemId || '', qty: parsed.data.qty || 1, price: parsed.data.price || 0, brand: parsed.data.brand || '', itemName: parsed.data.itemName || '' }];
                msg = `${parsed.data.itemName || 'Item'} add kiya: ${task.name}`;
            }
            await saveRecord('tasks', { ...task, itemsUsed: updated, updatedAt: new Date().toISOString() }, 'task');
            setSuccessMessage(msg);
            setLastCreatedRecord({ id: task.id, type: 'task', data: { ...task, itemsUsed: updated } });
            speakJarvis(msg); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TASK') {
            const task = { name: parsed.data?.name || 'New Task', partyId: parsed.data?.partyId || '', status: 'To Do', description: originalText, createdAt: new Date().toISOString() };
            const id = await saveRecord('tasks', task, 'task');
            setSuccessMessage(`Task: ${task.name}`);
            setLastCreatedRecord({ id, type: 'task', data: { ...task, id } });
            speakJarvis(`Task ban gaya. ${task.name}`); setIsProcessing(false); return;
        }

        if (parsed.action === 'CREATE_TRANSACTION') {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({ ...i, qty: parseFloat(i.qty || 1), price: parseFloat(i.price || 0), isBundle: false, subItems: [] }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);
            const tx = { type, partyId: parsed.data?.partyId || '', category: parsed.data?.category || '', notes: originalText, amount: total, finalTotal: total, grossTotal: total, paymentMode: 'Cash', items, date: new Date().toISOString().split('T')[0] };
            if (type === 'expense' || type === 'purchase') tx.paid = total;
            else if (type === 'sales') tx.received = total;
            const id = await saveRecord('transactions', tx, type);
            setSuccessMessage(`${type.toUpperCase()}: ₹${total}`);
            setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakJarvis(`${type} entry. ${total} rupaye.`); setIsProcessing(false); return;
        }

        if (parsed.action === 'ASK_QUESTION') {
            setSuccessMessage(parsed.data?.answer || parsed.data?.question || 'Koi jawab nahi mila.');
            speakJarvis(parsed.data?.answer || 'Samajh nahi aaya.');
            setIsProcessing(false); return;
        }

        throw new Error('Command samajh nahi aaya.');
    };

    // ─── Confirm / Cancel ───
    const confirmAction = async () => {
        if (!pendingAction) return;
        const { parsed, originalText } = pendingAction;
        setPendingAction(null); setIsEditingText(false);
        setIsProcessing(true); setStatusText('Executing...');
        try { await executeAction(parsed, originalText); }
        catch (e) { setError(e.message); speakJarvis(e.message); setIsProcessing(false); }
    };

    const cancelAction = () => {
        setPendingAction(null); setIsEditingText(false);
        setTranscript(''); setStatusText('Cancel. Naya command do.');
        speakJarvis('Cancel kar diya.');
    };

    // ─── Main Pipeline ───
    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Soch raha hoon...'); setSuccessMessage(''); setError('');
        const safety = setTimeout(() => { setIsProcessing(false); setError('Timeout. Dobara try karo.'); }, 20000);

        try {
            const parsed = await callGemini(text);
            clearTimeout(safety);

            // VIEW_TASK and ASK_QUESTION execute instantly
            if (parsed.action === 'VIEW_TASK' || parsed.action === 'ASK_QUESTION') {
                await executeAction(parsed, text);
                return;
            }

            // All other actions need confirmation
            const preview = getPreview(parsed);
            setPendingAction({ parsed, originalText: text, preview });
            setIsProcessing(false); setTranscript('');
            speakJarvis('Ye karna hai? Confirm karo ya Cancel.');
        } catch (e) {
            clearTimeout(safety);
            setTranscript(''); setError(e.message || 'Error');
            speakJarvis(e.message || 'Error aa gaya.');
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
                                {pendingAction ? '● CONFIRM?' : !data ? '● OFFLINE' : isProcessing ? '● THINKING' : isListening ? '● LISTENING' : (localMode ? '● GEMMA 4 ACTIVE' : '● GEMINI ONLINE')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleLocalMode} 
                            disabled={isDownloading}
                            className={`p-2.5 rounded-full transition-all flex items-center gap-2 ${localMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            title={localMode ? 'Switch to Cloud (Gemini)' : 'Switch to Local (Gemma 4)'}
                        >
                            {isDownloading ? <DownloadCloud size={18} className="animate-bounce" /> : localMode ? <Cpu size={18} /> : <Cloud size={18} />}
                            {isDownloading && <span className="text-[9px] font-black tabular-nums">{downloadProgress}%</span>}
                        </button>
                        <button onClick={() => { setIsOpen(false); resetState(); if(isListening) { recognitionRef.current?.stop(); setIsListening(false); } }} className="p-2.5 bg-white/5 rounded-full text-slate-400 hover:bg-white/10 transition-colors"><X size={18} /></button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[150px] flex flex-col items-center justify-center mb-6 relative z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-4 text-center px-4">
                            <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20"><AlertCircle className="text-rose-400" size={28} /></div>
                            <p className="font-bold text-rose-400 text-sm">{error}</p>
                            <button onClick={resetState} className="text-[10px] font-black text-blue-400 uppercase tracking-widest">↻ Naya Command</button>
                        </div>

                    ) : ambiguousData ? (
                        <div className="flex flex-col items-center gap-4 text-center w-full px-2">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Select Party</p>
                            <div className="grid grid-cols-1 gap-2 w-full max-h-[200px] overflow-y-auto pr-1">
                                {ambiguousData.matches.map(m => (
                                    <button 
                                        key={m.id}
                                        onClick={() => {
                                            const cmd = `Party ID ${m.id} use karke: ${ambiguousData.originalCommand || transcript}`;
                                            setAmbiguousData(null);
                                            processCommand(cmd);
                                        }}
                                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center hover:bg-white/10 transition-all text-left"
                                    >
                                        <div>
                                            <p className="text-white font-bold text-sm leading-none mb-1">{m.name}</p>
                                            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">ID: {m.id}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-white/20"/>
                                    </button>
                                ))}
                            </div>
                            <button onClick={resetState} className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">↻ Cancel</button>
                        </div>
                    ) : pendingAction ? (
                        <div className="flex flex-col items-center gap-4 text-center w-full px-2">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Confirm Action</p>
                            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                                <p className="text-white font-bold text-base leading-relaxed">{pendingAction.preview}</p>
                            </div>
                            
                            {isEditingText ? (
                                <form onSubmit={(e) => { e.preventDefault(); if(editText.trim()) { applyCorrection(editText.trim()); setEditText(''); } }} className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                                    <input autoFocus type="text" className="flex-1 bg-transparent px-3 py-2 text-sm font-bold outline-none text-white placeholder:text-white/30" placeholder="Correction likho..." value={editText} onChange={e => setEditText(e.target.value)} />
                                    <button type="submit" disabled={!editText.trim()} className="w-10 h-10 bg-amber-600 disabled:bg-amber-600/30 text-white rounded-xl flex items-center justify-center"><Send size={16} /></button>
                                    <button type="button" onClick={() => setIsEditingText(false)} className="w-10 h-10 bg-white/5 text-white/40 rounded-xl flex items-center justify-center"><X size={16} /></button>
                                </form>
                            ) : (
                                <>
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
                                    <p className="text-[10px] text-white/30 font-bold">🎤 Haan / Cancel / ya Correction bolo</p>
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
                            <button onClick={resetState} className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mt-2">↻ Naya Command</button>
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
                {!successMessage && !isProcessing && !error && !isEditingText && (
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
