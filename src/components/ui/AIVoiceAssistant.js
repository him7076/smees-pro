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

    const speakText = (text, onEndCallback = null) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop any ongoing speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'hi-IN'; 
            if (onEndCallback) {
                utterance.onend = onEndCallback;
            }
            window.speechSynthesis.speak(utterance);
        } else if (onEndCallback) {
            onEndCallback();
        }
    };

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

Available Database Context:
${JSON.stringify(contextData)}

Rules for Output:
Return ONLY a strictly valid JSON object.
Format:
{
  "action": "CREATE_TASK" | "CREATE_TRANSACTION" | "ASK_QUESTION" | "UNKNOWN",
  "data": { ...record details... }
}

Important Rules:
- "partyId" MUST be exact integer ID from the context. If you find multiple matches (e.g. user says "Umesh bhaiya" but context has "Umesh 1" and "Umesh 2"), you MUST return action="ASK_QUESTION" and data.question="Mujhe do Umesh mile hain, Umesh 1 ya Umesh 2, kisme banana hai?".
- If data is missing to complete the request safely, return ASK_QUESTION.
- If it's a task: { "name": "Task Name", "partyId": 123, "description": "...", "status": "Pending" }
- If it's a transaction/expense: { "type": "expense", "category": "Vehicle", "amount": 500, "notes": "..." }

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
                let cleanedContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
                parsedAction = JSON.parse(cleanedContent);
            } catch (e) {
                console.error("Failed to parse JSON from AI:", rawContent);
                throw new Error("AI returned malformed data.");
            }

            if (parsedAction.action === "ASK_QUESTION") {
                setTranscript('');
                setStatusText(parsedAction.data.question);
                speakText(parsedAction.data.question, () => {
                    // Trigger listening again
                    setStatusText('Listening...');
                    setIsListening(true);
                    recognitionRef.current?.start();
                });
                setIsProcessing(false);
                return;
            }

            if (parsedAction.action === "CREATE_TASK") {
                const nextId = getNextId(data.tasks || []);
                const newTask = {
                    id: nextId,
                    name: parsedAction.data.name || 'New Task',
                    partyId: parsedAction.data.partyId || parsedAction.data.party_id || '',
                    status: parsedAction.data.status || 'Pending',
                    description: parsedAction.data.description || text,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await saveRecord('tasks', newTask, 'task');
                
                const clientName = data.parties.find(p => p.id === newTask.partyId)?.name || '';
                const msg = `Task save ho gaya hai: ${newTask.name} ${clientName}`;
                setTranscript('');
                setSuccessMessage(msg);
                speakText(msg);
                setTimeout(() => { setIsOpen(false); setSuccessMessage(''); }, 3000);
            } 
            else if (parsedAction.action === "CREATE_TRANSACTION") {
                const nextId = getNextId(data.transactions || []);
                const isPayment = parsedAction.data.type === 'payment';
                const newTx = {
                    id: nextId,
                    type: parsedAction.data.type || 'expense',
                    partyId: parsedAction.data.partyId || parsedAction.data.party_id || '',
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
                const msg = `${newTx.type} record ho gaya hai, amount hai ${newTx.amount} rupay.`;
                setTranscript('');
                setSuccessMessage(msg);
                speakText(msg);
                setTimeout(() => { setIsOpen(false); setSuccessMessage(''); }, 3000);
            } 
            else {
                const msg = "Sorry, main command samajh nahi paya.";
                setTranscript('');
                setStatusText(msg);
                speakText(msg);
                setIsProcessing(false);
                return;
            }

            setStatusText('');
        } catch (error) {
            console.error("AI Assistant Error:", error);
            const msg = 'Network ya AI error aa gaya hai.';
            setTranscript('');
            setStatusText(msg);
            speakText(msg);
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
