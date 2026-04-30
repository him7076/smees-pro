import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Bot, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { getNextId } from '../../utils/helpers';
import { useDatabase } from '../../hooks/useDatabase';

const AIVoiceAssistant = ({ data, setData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [statusText, setStatusText] = useState('How can I help you?');
    const [successMessage, setSuccessMessage] = useState('');
    
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
            setStatusText('Listening...');
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

    const processWithAI = async (text) => {
        setIsProcessing(true);
        setStatusText('Processing with AI...');
        
        try {
            // Simplified Database Context for AI
            const contextData = {
                parties: data.parties.map(p => ({ id: p.id, name: p.name })),
                items: data.items.map(i => ({ id: i.id, name: i.name, type: i.type, category: i.category, sellPrice: i.sellPrice, buyPrice: i.buyPrice })),
                staff: data.staff.map(s => ({ id: s.id, name: s.name }))
            };

            const prompt = `
You are Jarvis, an AI assistant for an ERP system. 
Parse the following user voice command in Hindi/Hinglish/English and figure out what action to take.
The user might ask to create a "Task" or a "Transaction" (like an expense, sale, or payment).

Available Database Context:
${JSON.stringify(contextData)}

Rules for Output:
Return ONLY a strictly valid JSON object (no markdown, no backticks, no comments).
Format:
{
  "action": "CREATE_TASK" | "CREATE_TRANSACTION" | "UNKNOWN",
  "data": { ...record details... }
}

If CREATE_TASK:
"data" must have:
- "name": string (e.g., "AC Repair")
- "partyId": number (match the client name to party id from context. If not found, leave null or try to guess)
- "status": "Pending"
- "description": string (any extra info)

If CREATE_TRANSACTION:
"data" must have:
- "type": "sales" | "purchase" | "expense" | "payment" (guess based on command, e.g., "petrol" -> expense)
- "partyId": number (if applicable)
- "category": string (e.g., "Vehicle Expenses")
- "amount": number (extract amount)
- "notes": string

User Command: "${text}"
`;

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "AIzaSyDxf3BgmftWckaBLyjyn71b1hnRGc6BwqI";
            if (!apiKey) {
                throw new Error("Gemini API key is missing.");
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error.message);
            }

            const rawContent = result.candidates[0].content.parts[0].text;
            let parsedAction = null;
            try {
                parsedAction = JSON.parse(rawContent.trim());
            } catch (e) {
                console.error("Failed to parse JSON from AI:", rawContent);
                throw new Error("AI returned malformed data.");
            }

            if (parsedAction.action === "CREATE_TASK") {
                const nextId = getNextId(data.tasks);
                const newTask = {
                    id: nextId,
                    name: parsedAction.data.name || 'New Task',
                    partyId: parsedAction.data.partyId || '',
                    status: parsedAction.data.status || 'Pending',
                    description: parsedAction.data.description || text,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await saveRecord('tasks', newTask, 'task');
                setSuccessMessage(`Task Created: ${newTask.name}`);
                setTimeout(() => { setIsOpen(false); setTranscript(''); setSuccessMessage(''); }, 3000);
            } 
            else if (parsedAction.action === "CREATE_TRANSACTION") {
                const nextId = getNextId(data.transactions);
                const isPayment = parsedAction.data.type === 'payment';
                const newTx = {
                    id: nextId,
                    type: parsedAction.data.type || 'expense',
                    partyId: parsedAction.data.partyId || '',
                    category: parsedAction.data.category || '',
                    notes: parsedAction.data.notes || text,
                    amount: parsedAction.data.amount || 0,
                    finalTotal: parsedAction.data.amount || 0,
                    grossTotal: parsedAction.data.amount || 0,
                    paymentMode: 'Cash', // Default
                    items: [], // Blank items array for expense
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                if (isPayment) {
                    newTx.subType = 'out'; // Assume payment out by default unless specified
                } else if (newTx.type === 'expense' || newTx.type === 'purchase') {
                    newTx.paid = newTx.amount;
                } else if (newTx.type === 'sales') {
                    newTx.received = newTx.amount;
                }

                await saveRecord('transactions', newTx, newTx.type);
                setSuccessMessage(`${newTx.type.toUpperCase()} Logged: ₹${newTx.amount}`);
                setTimeout(() => { setIsOpen(false); setTranscript(''); setSuccessMessage(''); }, 3000);
            } 
            else {
                setStatusText("Sorry, I didn't understand the command.");
                setIsProcessing(false);
                return;
            }

            setStatusText('');
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setStatusText('Failed: ' + error.message);
        } finally {
            setIsProcessing(false);
            // Auto close handled in the success blocks or manual close on error
        }
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-6 z-[200] w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl shadow-blue-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            >
                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Sparkles size={24} className="relative z-10" />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-6 relative animate-in slide-in-from-bottom-8 overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 tracking-tight leading-none mb-1">Jarvis AI</h3>
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{isProcessing ? 'Processing' : isListening ? 'Listening...' : 'Ready'}</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); if(isListening) recognitionRef.current?.stop(); }} className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-95">
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-[120px] flex flex-col items-center justify-center relative z-10 mb-8">
                    {successMessage ? (
                        <div className="flex flex-col items-center gap-3 animate-in zoom-in">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={32} />
                            </div>
                            <p className="font-black text-emerald-600 text-center text-lg">{successMessage}</p>
                        </div>
                    ) : isProcessing ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">{statusText}</p>
                        </div>
                    ) : (
                        <div className="w-full text-center">
                            <p className="text-lg font-medium text-slate-800 leading-relaxed italic">
                                "{transcript || statusText}"
                            </p>
                        </div>
                    )}
                </div>

                {!successMessage && !isProcessing && (
                    <div className="flex flex-col items-center relative z-10">
                        <button 
                            onClick={toggleListening}
                            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                                isListening 
                                    ? 'bg-rose-500 text-white shadow-rose-500/50 scale-110 animate-pulse' 
                                    : 'bg-slate-900 text-white shadow-slate-900/30 hover:scale-105 active:scale-95'
                            }`}
                        >
                            <Mic size={32} />
                        </button>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6">
                            Tap to speak
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIVoiceAssistant;
