import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Sparkles, Send, Eye, AlertCircle } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const AIVoiceAssistant = ({ data, setData, setViewDetail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [inputText, setInputText] = useState('');
    const [statusText, setStatusText] = useState('JARVIS System Online.');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [lastCreatedRecord, setLastCreatedRecord] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    
    const recognitionRef = useRef(null);
    const { saveRecord } = useDatabase(data, setData);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-IN';

            recognitionRef.current.onresult = (event) => {
                let text = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    text += event.results[i][0].transcript;
                }
                setTranscript(text);
            };
            recognitionRef.current.onend = () => { setIsListening(false); };
            recognitionRef.current.onerror = (e) => { setIsListening(false); setError('Mic Failure: ' + e.error); };
        }
    }, []);

    const speakText = (text, cb = null) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            
            // Advanced Voice Selection for Jarvis (Male/Robotic)
            const voices = window.speechSynthesis.getVoices();
            // Try to find a Male Indian or British/US Male voice
            const jarvisVoice = voices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('google hindi') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('google uk english male')) 
                             || voices.find(v => v.lang === 'en-IN')
                             || voices[0];
            
            if (jarvisVoice) u.voice = jarvisVoice;
            u.lang = 'en-IN';
            u.pitch = 0.8; // Deeper voice
            u.rate = 1.0; 
            if (cb) u.onend = cb;
            window.speechSynthesis.speak(u);
        } else if (cb) cb();
    };

    // Reload voices when they are available
    useEffect(() => {
        window.speechSynthesis.onvoiceschanged = () => {
            console.log("Voices loaded:", window.speechSynthesis.getVoices().length);
        };
    }, []);

    const attemptLocalParsing = (text) => {
        if (!text || !data) return null;
        const clean = text.toLowerCase().trim();
        const amtMatch = clean.match(/(\d+)\s*(rs|rupay|rupees|₹)/i) || clean.match(/(?:amount|rs|price|₹)\s*(\d+)/i) || clean.match(/^(\d+)$/);
        const amount = amtMatch ? parseFloat(amtMatch[1]) : null;

        let foundItem = null, foundParty = null, foundBrand = null;
        const items = data.items || [];
        const parties = data.parties || [];

        for (const item of items) {
            if (item.name && clean.includes(item.name.toLowerCase())) { foundItem = item; break; }
            if (item.brands) {
                for (const b of item.brands) { if (b.name && clean.includes(b.name.toLowerCase())) { foundItem = item; foundBrand = b; break; } }
            }
            if (foundItem) break;
        }
        for (const p of parties) { if (p.name && clean.includes(p.name.toLowerCase())) { foundParty = p; break; } }

        if (amount !== null && (foundItem || foundParty)) {
            const isTask = /task|kaam|service|remind/i.test(clean);
            if (isTask) {
                return { action: 'CREATE_TASK', data: { name: foundItem?.name || 'Manual Task', partyId: foundParty?.id || '', status: 'To Do' } };
            } else {
                return {
                    action: 'CREATE_TRANSACTION',
                    data: {
                        type: 'expense',
                        partyId: foundParty?.id || '',
                        category: foundItem ? foundItem.category : 'General',
                        amount: amount,
                        items: foundItem ? [{ itemId: foundItem.id, qty: 1, price: amount, brand: foundBrand?.name || '' }] : []
                    }
                };
            }
        }
        return null;
    };

    const handleParsedAction = async (parsed, originalText) => {
        if (!parsed || !parsed.action) throw new Error("Protocol Error: Action Unclear.");

        if (parsed.action === "CREATE_TASK") {
            const task = {
                name: parsed.data?.name || 'New Task',
                partyId: parsed.data?.partyId || '',
                status: 'To Do',
                description: originalText,
                createdAt: new Date().toISOString()
            };
            const id = await saveRecord('tasks', task, 'task');
            const msg = `Task initiated. Data secured.`;
            setSuccessMessage(msg); setLastCreatedRecord({ id, type: 'task', data: { ...task, id } });
            speakText(msg); setIsProcessing(false);
            return;
        }

        if (parsed.action === "CREATE_TRANSACTION") {
            const type = parsed.data?.type || 'expense';
            const items = (parsed.data?.items || []).map(i => ({
                ...i,
                qty: parseFloat(i.qty || 1),
                price: parseFloat(i.price || 0),
                isBundle: false,
                subItems: []
            }));
            const total = items.reduce((s, i) => s + (i.qty * i.price), 0) || parseFloat(parsed.data?.amount || 0);

            const tx = {
                type,
                partyId: parsed.data?.partyId || '',
                category: parsed.data?.category || '',
                notes: originalText,
                amount: total,
                finalTotal: total,
                grossTotal: total,
                paymentMode: 'Cash',
                items,
                date: new Date().toISOString().split('T')[0]
            };
            
            if (type === 'expense' || type === 'purchase') tx.paid = total;
            else if (type === 'sales') tx.received = total;

            const id = await saveRecord('transactions', tx, type);
            const msg = `${type.toUpperCase()} recorded. Amount ${total}.`;
            setSuccessMessage(msg); setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakText(msg); setIsProcessing(false);
            return;
        }

        if (parsed.action === "ASK_QUESTION") {
            const q = parsed.data?.question || "Awaiting further input.";
            setStatusText(q); speakText(q, () => { setIsListening(true); recognitionRef.current?.start(); });
            setIsProcessing(false);
            return;
        }
        throw new Error("Action protocol not found.");
    };

    const processWithAI = async (text) => {
        if (!text) return;
        setIsProcessing(true);
        setStatusText('Fast Scan...');
        setSuccessMessage('');
        setError('');
        
        try {
            const local = attemptLocalParsing(text);
            if (local) {
                await new Promise(r => setTimeout(r, 400));
                await handleParsedAction(local, text);
                return;
            }

            setStatusText('Uplink to Core AI...');
            const context = {
                parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category, brands: i.brands || [] }))
            };

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error("API Key Missing.");

            // FIX: Using gemini-1.5-flash which is widely supported in v1beta
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Task: Parse ERP command. Format: {action, data}. Context: ${JSON.stringify(context)}. Command: "${text}"` }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                })
            });

            const resData = await response.json();
            if (resData.error) throw new Error(resData.error.message);
            const raw = resData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) throw new Error("AI Uplink Failed.");

            await handleParsedAction(JSON.parse(raw.trim()), text);

        } catch (e) {
            console.error(e);
            setError(e.message);
            speakText("Uplink failed. Local protocol active.");
            setIsProcessing(false);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('Speech not supported.');
        if (isListening) recognitionRef.current.stop();
        else {
            setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null); setError('');
            setStatusText('Listening...');
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleViewEntry = () => {
        if (lastCreatedRecord && setViewDetail) {
            setViewDetail(lastCreatedRecord); setIsOpen(false); setSuccessMessage(''); setLastCreatedRecord(null);
        }
    };

    const handleSendText = (e) => {
        e.preventDefault();
        if (inputText.trim() && !isProcessing) {
            setTranscript(inputText); processWithAI(inputText); setInputText('');
        }
    };

    if (!isOpen) return (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-slate-900 text-blue-400 rounded-full shadow-2xl flex items-center justify-center border-2 border-blue-500/30 active:scale-95 transition-all"><Bot size={24} /></button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-blue-500/20 rounded-[40px] shadow-2xl p-6 relative animate-in slide-in-from-bottom-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-2xl flex items-center justify-center shadow-lg"><Bot size={20} /></div>
                        <div>
                            <h3 className="font-black text-white leading-none mb-1 tracking-tight">JARVIS</h3>
                            <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest">{!data ? 'OFFLINE' : isProcessing ? 'SYNCING' : isListening ? 'LISTENING' : 'ONLINE'}</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); setIsListening(false); recognitionRef.current?.stop(); }} className="p-2 bg-white/5 rounded-full text-slate-400"><X size={18} /></button>
                </div>

                <div className="min-h-[140px] flex flex-col items-center justify-center mb-6 relative z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-3 text-center px-4">
                            <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-400 border border-rose-500/30"><AlertCircle size={28} /></div>
                            <p className="font-black text-rose-400 text-sm uppercase">{error}</p>
                            <button onClick={() => setError('')} className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Retry Link</button>
                        </div>
                    ) : successMessage ? (
                        <div className="flex flex-col items-center gap-3 animate-in zoom-in text-center">
                            <div className="w-16 h-16 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full flex items-center justify-center shadow-xl"><CheckCircle2 size={32} /></div>
                            <p className="font-black text-blue-400 text-lg uppercase tracking-tight">{successMessage}</p>
                            {lastCreatedRecord && <button onClick={handleViewEntry} className="mt-2 px-8 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/30 active:scale-95 transition-all">Open Protocol</button>}
                        </div>
                    ) : (
                        <div className="w-full text-center px-4">
                            {transcript && <p className="text-blue-400/50 text-[10px] font-black uppercase tracking-widest mb-2 animate-pulse">Scanning Signal...</p>}
                            <p className="text-xl font-bold text-white tracking-tight leading-relaxed italic">
                                {transcript || statusText}
                            </p>
                        </div>
                    )}
                </div>

                {!successMessage && !isProcessing && !error && (
                    <div className="flex flex-col items-center gap-6 relative z-10">
                        <div className="relative">
                            <div className={`absolute inset-0 bg-blue-500/20 rounded-full blur-xl transition-all ${isListening ? 'scale-150 opacity-100' : 'scale-0 opacity-0'}`}></div>
                            <button onClick={toggleListening} className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-rose-500 text-white border-4 border-rose-400/30' : 'bg-slate-800 text-blue-400 border-2 border-blue-500/20 active:scale-95'}`}><Mic size={32} /></button>
                        </div>
                        <form onSubmit={handleSendText} className="w-full flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 shadow-inner">
                            <input type="text" className="flex-1 bg-transparent px-3 py-2 text-sm font-bold outline-none text-white placeholder:text-white/20" placeholder="Direct Command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                            <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"><Send size={16}/></button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIVoiceAssistant;
