import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Sparkles, Send, Eye } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';

const AIVoiceAssistant = ({ data, setData, setViewDetail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [inputText, setInputText] = useState('');
    const [statusText, setStatusText] = useState('How can I help you?');
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
            recognitionRef.current.lang = 'hi-IN';

            recognitionRef.current.onresult = (event) => {
                let text = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    text += event.results[i][0].transcript;
                }
                setTranscript(text);
            };
            recognitionRef.current.onend = () => { setIsListening(false); };
            recognitionRef.current.onerror = (e) => { setIsListening(false); setStatusText('Mic Error: ' + e.error); };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('Speech not supported.');
        if (isListening) recognitionRef.current.stop();
        else {
            setTranscript(''); setSuccessMessage(''); setLastCreatedRecord(null);
            setStatusText('Listening...');
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            processWithAI(transcript);
        }
    }, [isListening, transcript]);

    const speakText = (text, cb = null) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'hi-IN';
            if (cb) u.onend = cb;
            window.speechSynthesis.speak(u);
        } else if (cb) cb();
    };

    const attemptLocalParsing = (text) => {
        if (!text || !data) return null;
        const clean = text.toLowerCase();
        
        // Match Amount
        const amtMatch = clean.match(/(\d+)\s*(rs|rupay|rupees|₹)/i) || clean.match(/(?:amount|rs|price|₹)\s*(\d+)/i) || clean.match(/^(\d+)$/);
        const amount = amtMatch ? parseFloat(amtMatch[1]) : null;

        // Match Item/Party
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
                return { action: 'CREATE_TASK', data: { name: foundItem?.name || 'Quick Task', partyId: foundParty?.id || '', status: 'To Do' } };
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
        if (!parsed || !parsed.action) throw new Error("I couldn't understand that.");

        if (parsed.action === "CREATE_TASK") {
            const task = {
                name: parsed.data?.name || 'New Task',
                partyId: parsed.data?.partyId || '',
                status: 'To Do',
                description: originalText,
                createdAt: new Date().toISOString()
            };
            const id = await saveRecord('tasks', task, 'task');
            const msg = `Task create ho gaya: ${task.name}`;
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
            const msg = `${type.toUpperCase()} entry saved: ₹${total}`;
            setSuccessMessage(msg); setLastCreatedRecord({ id, type: 'transaction', data: { ...tx, id } });
            speakText(msg); setIsProcessing(false);
            return;
        }

        if (parsed.action === "ASK_QUESTION") {
            const q = parsed.data?.question || "Can you clarify?";
            setStatusText(q); speakText(q, () => { setIsListening(true); recognitionRef.current?.start(); });
            setIsProcessing(false);
            return;
        }

        throw new Error("Action not supported.");
    };

    const processWithAI = async (text) => {
        if (!text) return;
        setIsProcessing(true);
        setStatusText('Scanning...');
        setSuccessMessage('');
        
        try {
            const local = attemptLocalParsing(text);
            if (local) {
                await new Promise(r => setTimeout(r, 400));
                await handleParsedAction(local, text);
                return;
            }

            setStatusText('AI Thinking...');
            const context = {
                parties: (data?.parties || []).map(p => ({ id: p.id, name: p.name })),
                items: (data?.items || []).map(i => ({ id: i.id, name: i.name, category: i.category, brands: i.brands || [] }))
            };

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error("API Key Missing");

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `
You are an ERP Assistant. Parse the command into JSON.
JSON Format: { "action": "CREATE_TASK" | "CREATE_TRANSACTION" | "ASK_QUESTION", "data": { ... } }
For Transactions, include: type (sales/purchase/expense/payment), amount, partyId, category, items: [{itemId, qty, price, brand}].
Rules: Use IDs from context. Default task status is "To Do". 
Context: ${JSON.stringify(context)}
Command: "${text}"
` }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                })
            });

            const resData = await response.json();
            if (resData.error) throw new Error(resData.error.message);
            
            const raw = resData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) throw new Error("AI returned nothing.");

            await handleParsedAction(JSON.parse(raw.trim()), text);

        } catch (e) {
            console.error(e);
            setStatusText("Error: " + e.message);
            speakText("Sorry, error aa raha hai.");
            setIsProcessing(false);
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
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"><Sparkles size={24} /></button>
    );

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-6 relative animate-in slide-in-from-bottom-8 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center"><Bot size={20} /></div>
                        <div>
                            <h3 className="font-black text-slate-900 leading-none mb-1">Jarvis AI</h3>
                            <p className="text-[9px] font-black uppercase text-blue-600">{!data ? 'Connecting...' : isProcessing ? statusText : isListening ? 'Listening...' : 'Ready'}</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); setIsListening(false); recognitionRef.current?.stop(); }} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={18} /></button>
                </div>

                <div className="min-h-[120px] flex flex-col items-center justify-center mb-6">
                    {successMessage ? (
                        <div className="flex flex-col items-center gap-3 animate-in zoom-in text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 size={32} /></div>
                            <p className="font-black text-emerald-600 text-lg">{successMessage}</p>
                            {lastCreatedRecord && <button onClick={handleViewEntry} className="mt-2 px-6 py-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Eye size={14}/> View</button>}
                        </div>
                    ) : (
                        <div className="w-full text-center px-2">
                            <p className="text-lg font-medium text-slate-800 italic">"{transcript || statusText}"</p>
                        </div>
                    )}
                </div>

                {!successMessage && !isProcessing && (
                    <div className="flex flex-col items-center gap-4">
                        <button onClick={toggleListening} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 text-white active:scale-95'}`}><Mic size={28} /></button>
                        <form onSubmit={handleSendText} className="w-full flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border">
                            <input type="text" className="flex-1 bg-transparent px-3 py-2 text-sm font-bold outline-none" placeholder="Type command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                            <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><Send size={16}/></button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIVoiceAssistant;
