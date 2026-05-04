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
            recognitionRef.current.lang = 'hi-IN'; // Works for Hinglish

            recognitionRef.current.onresult = (event) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
            
            recognitionRef.current.onerror = (event) => {
                setIsListening(false);
                setStatusText('Error: ' + event.error);
                if (event.error === 'not-allowed') {
                    setStatusText('Microphone access denied.');
                }
            };
        } else {
            console.error("Speech Recognition API not supported in this browser.");
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('Speech Recognition is not supported in your browser.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setTranscript('');
            setSuccessMessage('');
            setLastCreatedRecord(null);
            if (!chatHistory.length) {
                setStatusText('Listening...');
            }
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    // Auto process when listening stops and transcript is not empty
    useEffect(() => {
        if (!isListening && transcript && !isProcessing && !successMessage) {
            processWithAI(transcript);
        }
    }, [isListening, transcript]);

    const handleSendText = (e) => {
        e.preventDefault();
        if (inputText.trim() && !isProcessing) {
            setTranscript(inputText);
            processWithAI(inputText);
            setInputText('');
            setLastCreatedRecord(null);
        }
    };

    const speakText = (text, onEndCallback = null) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang === 'en-IN' && v.name.includes('Google')) || voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang === 'hi-IN');
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            } else {
                utterance.lang = 'en-IN'; 
            }

            if (onEndCallback) {
                utterance.onend = onEndCallback;
            }
            window.speechSynthesis.speak(utterance);
        } else if (onEndCallback) {
            onEndCallback();
        }
    };

    const attemptLocalParsing = (text) => {
        const cleanText = text.toLowerCase().trim();
        
        // 1. Extract Amount
        const amountMatch = cleanText.match(/(\d+)\s*(rs|rupay|rupees|₹)/i) || cleanText.match(/(?:amount|rs|price|₹)\s*(\d+)/i) || cleanText.match(/^(\d+)$/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

        // 2. Extract Qty
        const qtyMatch = cleanText.match(/(\d+)\s*(qty|quantity|nug|piece|pcs)/i);
        const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

        // 3. Match Items & Parties
        let foundItem = null;
        let foundParty = null;
        let foundBrand = null;

        // Sort items by name length (longest first)
        const sortedItems = [...(data.items || [])].sort((a, b) => (b.name || '').length - (a.name || '').length);
        for (const item of sortedItems) {
            if (item.name && cleanText.includes(item.name.toLowerCase())) {
                foundItem = item;
                break;
            }
            if (item.brands) {
                for (const brand of item.brands) {
                    if (brand.name && cleanText.includes(brand.name.toLowerCase())) {
                        foundItem = item;
                        foundBrand = brand;
                        break;
                    }
                }
            }
            if (foundItem) break;
        }

        const sortedParties = [...(data.parties || [])].sort((a, b) => (b.name || '').length - (a.name || '').length);
        for (const party of sortedParties) {
            if (party.name && cleanText.includes(party.name.toLowerCase())) {
                foundParty = party;
                break;
            }
        }

        // 4. Decision Logic
        if (amount !== null && (foundItem || foundParty)) {
            const isTask = /task|kaam|service|remind|reminder/i.test(cleanText);
            
            if (isTask) {
                return {
                    action: 'CREATE_TASK',
                    data: {
                        name: foundItem ? foundItem.name : 'Quick Task',
                        partyId: foundParty ? foundParty.id : '',
                        status: 'To Do',
                        description: text
                    }
                };
            } else {
                return {
                    action: 'CREATE_TRANSACTION',
                    data: {
                        type: 'expense',
                        partyId: foundParty ? foundParty.id : '',
                        category: foundItem ? foundItem.category : 'General',
                        amount: amount,
                        items: foundItem ? [{
                            itemId: foundItem.id,
                            qty: qty,
                            price: amount / qty,
                            brand: foundBrand ? foundBrand.name : ''
                        }] : []
                    }
                };
            }
        }

        return null;
    };

    const handleParsedAction = async (parsedAction, originalText) => {
        if (parsedAction.action === "ASK_QUESTION") {
            setChatHistory([...chatHistory, { role: 'user', text: originalText }, { role: 'assistant', text: parsedAction.data.question }]);
            setTranscript('');
            setStatusText(parsedAction.data.question);
            speakText(parsedAction.data.question, () => {
                setIsListening(true);
                recognitionRef.current?.start();
            });
            setIsProcessing(false);
            return;
        }

        setChatHistory([]);

        if (parsedAction.action === "CREATE_TASK") {
            const newTask = {
                name: parsedAction.data.name || 'New Task',
                partyId: parsedAction.data.partyId || '',
                status: parsedAction.data.status || 'To Do',
                description: parsedAction.data.description || originalText,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const id = await saveRecord('tasks', newTask, 'task');
            const clientName = data.parties.find(p => p.id === newTask.partyId)?.name || '';
            const msg = `Task create ho gaya: ${newTask.name} ${clientName}`;
            setTranscript('');
            setSuccessMessage(msg);
            setLastCreatedRecord({ id, type: 'task', data: { ...newTask, id } });
            speakText(msg);
            setIsProcessing(false);
            setTimeout(() => { if(!lastCreatedRecord) setIsOpen(false); setSuccessMessage(''); }, 6000);
        } 
        else if (parsedAction.action === "CREATE_TRANSACTION") {
            const items = (parsedAction.data.items || []).map(item => {
                const qty = parseFloat(item.qty || 1);
                let price = parseFloat(item.price || 0);
                let buyPrice = parseFloat(item.buyPrice || 0);

                if (price === 0 && item.itemId) {
                    const master = data.items.find(i => i.id === item.itemId);
                    if (master) {
                        if (item.brand) {
                            const brand = master.brands?.find(b => b.name === item.brand);
                            if (brand) { price = brand.sellPrice; buyPrice = brand.buyPrice; }
                        } else { price = master.sellPrice; buyPrice = master.buyPrice; }
                    }
                }
                return { ...item, qty, price, buyPrice, isBundle: false, subItems: [] };
            });

            const totalAmount = items.reduce((acc, i) => acc + (i.qty * i.price), 0) || parsedAction.data.amount || 0;

            const newTx = {
                type: parsedAction.data.type || 'expense',
                partyId: parsedAction.data.partyId || '',
                category: parsedAction.data.category || '',
                notes: parsedAction.data.notes || originalText,
                amount: totalAmount,
                finalTotal: totalAmount,
                grossTotal: totalAmount,
                paymentMode: 'Cash',
                items: items,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            if (newTx.type === 'expense' || newTx.type === 'purchase') newTx.paid = newTx.amount;
            else if (newTx.type === 'sales') newTx.received = newTx.amount;

            const id = await saveRecord('transactions', newTx, newTx.type);
            const msg = `${newTx.type} entry done: ₹${newTx.amount}.`;
            setTranscript('');
            setSuccessMessage(msg);
            setLastCreatedRecord({ id, type: 'transaction', data: { ...newTx, id } });
            speakText(msg);
            setIsProcessing(false);
            setTimeout(() => { if(!lastCreatedRecord) setIsOpen(false); setSuccessMessage(''); }, 6000);
        } 
        else {
            const msg = "Sorry, main samajh nahi paya.";
            setTranscript('');
            setStatusText(msg);
            speakText(msg);
            setIsProcessing(false);
        }
    };

    const processWithAI = async (text) => {
        setIsProcessing(true);
        setStatusText('Instant Scanning...');
        
        // 1. Try Local Parsing First
        const localResult = attemptLocalParsing(text);
        if (localResult) {
            await new Promise(r => setTimeout(r, 400)); // Small delay for visual feedback
            handleParsedAction(localResult, text);
            return;
        }

        // 2. Fallback to Gemini
        setStatusText('AI Thinking...');
        try {
            const contextData = {
                parties: data.parties.map(p => ({ id: p.id, name: p.name })),
                items: data.items.map(i => ({ 
                    id: i.id, name: i.name, type: i.type, category: i.category, 
                    sellPrice: i.sellPrice, buyPrice: i.buyPrice, brands: i.brands || [] 
                }))
            };

            const prompt = `
You are Jarvis, an AI for an ERP. Parse user command into JSON.
Return ONLY valid JSON. 
{ "action": "CREATE_TASK" | "CREATE_TRANSACTION" | "ASK_QUESTION", "data": { ... } }
Rules: Match itemId/partyId exactly. Default task status: "To Do". Default qty: 1.
Context: ${JSON.stringify(contextData)}
Command: "${text}"
`;

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) throw new Error("API key missing.");

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                })
            });

            const result = await response.json();
            if (result.error) {
                if (result.error.code === 429) throw new Error("Limit full. Wait 60s.");
                throw new Error(result.error.message);
            }

            const rawContent = result.candidates[0].content.parts[0].text;
            const parsedAction = JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim());
            handleParsedAction(parsedAction, text);
        } catch (error) {
            console.error(error);
            setStatusText(error.message);
            speakText('Error aa raha hai.');
            setIsProcessing(false);
        }
    };

    const handleViewEntry = () => {
        if (lastCreatedRecord && setViewDetail) {
            setViewDetail(lastCreatedRecord);
            setIsOpen(false);
            setSuccessMessage('');
            setLastCreatedRecord(null);
        }
    };

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group">
                <Sparkles size={24} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-6 relative animate-in slide-in-from-bottom-8 overflow-hidden">
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 leading-none mb-1">Jarvis AI</h3>
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{isProcessing ? statusText : isListening ? 'Listening...' : 'Ready'}</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); setChatHistory([]); if(isListening) recognitionRef.current?.stop(); }} className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-95"><X size={18} /></button>
                </div>

                <div className="min-h-[120px] flex flex-col items-center justify-center relative z-10 mb-6">
                    {successMessage ? (
                        <div className="flex flex-col items-center gap-3 animate-in zoom-in text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 size={32} /></div>
                            <div>
                                <p className="font-black text-emerald-600 text-lg mb-1">{successMessage}</p>
                                {lastCreatedRecord && (
                                    <button onClick={handleViewEntry} className="mt-2 px-6 py-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 mx-auto shadow-lg"><Eye size={14}/> Show Entry</button>
                                )}
                            </div>
                        </div>
                    ) : isProcessing ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{statusText}</p>
                        </div>
                    ) : (
                        <div className="w-full text-center px-2"><p className="text-lg font-medium text-slate-800 italic">"{transcript || statusText}"</p></div>
                    )}
                </div>

                {!successMessage && !isProcessing && (
                    <div className="flex flex-col items-center relative z-10 gap-4">
                        <button onClick={toggleListening} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 text-white hover:scale-105 active:scale-95'}`}><Mic size={28} /></button>
                        <form onSubmit={handleSendText} className="w-full flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                            <input type="text" className="flex-1 bg-transparent px-3 py-2 text-sm font-bold outline-none text-slate-700" placeholder="Type command..." value={inputText} onChange={e => setInputText(e.target.value)} />
                            <button type="submit" disabled={!inputText.trim()} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95"><Send size={16}/></button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIVoiceAssistant;
