import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Sparkles, Send, Eye, AlertCircle } from 'lucide-react';
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
    const [voicesLoaded, setVoicesLoaded] = useState(false);
    
    const recognitionRef = useRef(null);
    const { saveRecord } = useDatabase(data, setData);

    // ─── Speech Recognition Setup ───
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            const r = new SR();
            r.continuous = false;
            r.interimResults = true;
            r.lang = 'en-IN'; // Latin script Hinglish
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

    // ─── Voice Loading (needed for mobile) ───
    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis?.getVoices();
            if (v && v.length > 0) setVoicesLoaded(true);
        };
        loadVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // ─── Jarvis Voice (Male/Deep) ───
    const speakJarvis = (text, cb = null) => {
        if (!('speechSynthesis' in window)) { cb?.(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Priority: Male voice > Google UK Male > Any en-IN > First available
        const male = voices.find(v => /\bmale\b/i.test(v.name) && /en/i.test(v.lang))
            || voices.find(v => /david/i.test(v.name))
            || voices.find(v => /google.*uk.*english.*male/i.test(v.name))
            || voices.find(v => /\ben[-_]IN\b/i.test(v.lang) && !/female/i.test(v.name))
            || voices.find(v => /\ben[-_]/i.test(v.lang) && !/female/i.test(v.name))
            || voices[0];
        
        if (male) u.voice = male;
        u.lang = 'en-IN';
        u.pitch = 0.75;  // Deep robotic tone
        u.rate = 1.05;   // Crisp delivery
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

    // ─── Local Smart Parser (Instant, No API) ───
    const parseLocally = (text) => {
        if (!text || !data) return null;
        const t = text.toLowerCase().trim();

        // Extract amount: "100 rs", "₹200", "50 rupay"
        const amtMatch = t.match(/(\d+)\s*(?:rs|rupay|rupees|₹|rupes)/i) 
                       || t.match(/(?:₹|rs\.?)\s*(\d+)/i);
        const amount = amtMatch ? parseFloat(amtMatch[1]) : null;

        // Match items and brands from master data
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

        // Need at least amount + (item or party) to proceed locally
        if (amount !== null && (foundItem || foundParty)) {
            if (/task|kaam|service|remind/i.test(t)) {
                return { action: 'CREATE_TASK', data: { name: foundItem?.name || 'Task', partyId: foundParty?.id || '' } };
            }
            return {
                action: 'CREATE_TRANSACTION',
                data: {
                    type: 'expense',
                    partyId: foundParty?.id || '',
                    category: foundItem?.category || '',
                    amount,
                    items: foundItem ? [{ itemId: foundItem.id, qty: 1, price: amount, brand: foundBrand?.name || '' }] : []
                }
            };
        }
        return null;
    };

    // ─── Execute Parsed Action ───
    const executeAction = async (parsed, originalText) => {
        if (!parsed?.action) throw new Error('Command not recognized.');

        if (parsed.action === 'CREATE_TASK') {
            const task = {
                name: parsed.data?.name || 'New Task',
                partyId: parsed.data?.partyId || '',
                status: 'To Do',
                description: originalText,
                createdAt: new Date().toISOString()
            };
            const id = await saveRecord('tasks', task, 'task');
            setTranscript(''); setSuccessMessage(`Task created: ${task.name}`);
            setLastCreatedRecord({ id, type: 'task', data: { ...task, id } });
            speakJarvis('Task created successfully.');
            setIsProcessing(false);
            return;
        }

        if (parsed.action === 'CREATE_TRANSACTION') {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({
                ...i,
                qty: parseFloat(i.qty || 1),
                price: parseFloat(i.price || 0),
                isBundle: false, subItems: []
            }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);
            const tx = {
                type,
                partyId: parsed.data?.partyId || '',
                category: parsed.data?.category || '',
                notes: originalText,
                amount: total, finalTotal: total, grossTotal: total,
                paymentMode: 'Cash',
                items,
                date: new Date().toISOString().split('T')[0]
            };
            if (type === 'expense' || type === 'purchase') tx.paid = total;
            else if (type === 'sales') tx.received = total;

            const id = await saveRecord('transactions', tx, type);
            setTranscript(''); setSuccessMessage(`${type.toUpperCase()} saved: ₹${total}`);
            setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakJarvis(`${type} of ${total} rupees recorded.`);
            setIsProcessing(false);
            return;
        }

        if (parsed.action === 'ASK_QUESTION') {
            const q = parsed.data?.question || 'Please clarify.';
            setTranscript(''); setStatusText(q);
            speakJarvis(q, () => { try { recognitionRef.current?.start(); setIsListening(true); } catch(e){} });
            setIsProcessing(false);
            return;
        }

        throw new Error('Unknown action type.');
    };

    // ─── Main Processing Pipeline ───
    const processCommand = async (text) => {
        if (!text) return;
        setIsProcessing(true); setStatusText('Scanning...'); setSuccessMessage(''); setError('');

        try {
            // Step 1: Try local parsing (instant, no API)
            const local = parseLocally(text);
            if (local) {
                await new Promise(r => setTimeout(r, 300));
                await executeAction(local, text);
                return;
            }

            // Step 2: Fallback to Gemini AI
            setStatusText('AI Processing...');
            const ctx = {
                parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category, brands: (i.brands || []).map(b => b.name) }))
            };

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error('Gemini API key not configured.');

            // Use gemini-2.5-flash (latest stable model, May 2026)
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `You are an ERP assistant. Parse user command into JSON.
Return ONLY JSON: {"action":"CREATE_TASK"|"CREATE_TRANSACTION"|"ASK_QUESTION","data":{...}}
For CREATE_TRANSACTION: include type(expense/sales/purchase), partyId, category, amount, items:[{itemId,qty,price,brand}]
For CREATE_TASK: include name, partyId
Match IDs from context. Default qty=1, default status="To Do".
Context: ${JSON.stringify(ctx)}
Command: "${text}"` }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                })
            });

            const json = await res.json();
            
            if (json.error) {
                const msg = json.error.message || '';
                if (msg.includes('expired') || msg.includes('API_KEY_INVALID')) {
                    throw new Error('API Key expired. Generate a new key at aistudio.google.com');
                }
                if (json.error.code === 429) {
                    throw new Error('Rate limited. Wait 60 seconds.');
                }
                if (msg.includes('not found') || msg.includes('not supported')) {
                    throw new Error('AI model unavailable. Contact developer.');
                }
                throw new Error(msg);
            }

            const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) throw new Error('AI returned empty response.');

            const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
            await executeAction(parsed, text);

        } catch (e) {
            console.error('Jarvis Error:', e);
            setTranscript('');
            setError(e.message);
            speakJarvis('Error detected. Check the display.');
            setIsProcessing(false);
        }
    };

    // ─── UI Render ───
    if (!isOpen) return (
        <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-slate-900 text-blue-400 rounded-full shadow-2xl shadow-blue-500/20 flex items-center justify-center border-2 border-blue-500/30 active:scale-95 transition-all"
        >
            <Bot size={24} />
        </button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-[40px] shadow-2xl shadow-blue-500/10 p-6 relative overflow-hidden" style={{animation: 'slideUp 0.3s ease-out'}}>
                {/* Ambient Glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-2xl flex items-center justify-center">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-white leading-none mb-1 tracking-tight text-lg">J.A.R.V.I.S</h3>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{color: !data ? '#ef4444' : isProcessing ? '#f59e0b' : isListening ? '#22d3ee' : '#3b82f6'}}>
                                {!data ? '● OFFLINE' : isProcessing ? '● SYNCING' : isListening ? '● LISTENING' : '● ONLINE'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setIsOpen(false); if(isListening) { recognitionRef.current?.stop(); setIsListening(false); } }}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="min-h-[150px] flex flex-col items-center justify-center mb-6 relative z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-4 text-center px-4">
                            <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20">
                                <AlertCircle className="text-rose-400" size={28} />
                            </div>
                            <p className="font-bold text-rose-400 text-sm leading-relaxed">{error}</p>
                            <button onClick={() => { setError(''); setStatusText('JARVIS Online. Awaiting command.'); }} className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors">
                                ↻ Clear & Retry
                            </button>
                        </div>
                    ) : successMessage ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="text-emerald-400" size={32} />
                            </div>
                            <p className="font-black text-emerald-400 text-lg">{successMessage}</p>
                            {lastCreatedRecord && (
                                <button 
                                    onClick={() => { if (setViewDetail) { setViewDetail(lastCreatedRecord); setIsOpen(false); } }}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-2"
                                >
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
                            <p className="text-xl font-bold text-white/90 tracking-tight leading-relaxed">
                                {transcript || statusText}
                            </p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {!successMessage && !isProcessing && !error && (
                    <div className="flex flex-col items-center gap-5 relative z-10">
                        {/* Mic Button with Glow */}
                        <div className="relative">
                            {isListening && <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl animate-pulse scale-150" />}
                            <button 
                                onClick={toggleListening}
                                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${
                                    isListening 
                                        ? 'bg-rose-500 text-white shadow-rose-500/40 scale-105' 
                                        : 'bg-slate-800 text-blue-400 border-2 border-blue-500/20 hover:border-blue-500/40 active:scale-95'
                                }`}
                            >
                                <Mic size={32} />
                            </button>
                        </div>
                        
                        {/* Text Input */}
                        <form 
                            onSubmit={(e) => { e.preventDefault(); const v = inputText.trim(); if (v && !isProcessing) { setTranscript(v); processCommand(v); setInputText(''); } }}
                            className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10"
                        >
                            <input 
                                type="text"
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none text-white placeholder:text-white/20"
                                placeholder="Type command..."
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                            />
                            <button 
                                type="submit"
                                disabled={!inputText.trim()}
                                className="w-10 h-10 bg-blue-600 disabled:bg-blue-600/30 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AIVoiceAssistant;
