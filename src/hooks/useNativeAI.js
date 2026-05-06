import { useState, useCallback } from 'react';
import NativeLLM from '../plugins/NativeLLM';
import { localDB } from '../utils/localDB';

/**
 * useNativeAI Hook
 * Connects the React UI to the Native Android LLM Plugin.
 * Handles parsing, saving to local storage, and state management.
 */
export const useNativeAI = (data, setData) => {
    const [isThinking, setIsThinking] = useState(false);

    const processCommand = useCallback(async (userText) => {
        setIsThinking(true);
        try {
            // 1. Call the Native Android LLM
            // We provide context so it knows what to do
            const systemPrompt = `You are an ERP Assistant. Convert the following command into a JSON object.
            Actions: ADD_TASK (data: {name, partyId}), ADD_TRANSACTION (data: {type, amount, partyId, items: []}).
            Command: "${userText}"`;

            const { response } = await NativeLLM.generate({ prompt: systemPrompt });

            // 2. Clean and Parse Response
            const cleanJson = response.replace(/```json|```/g, '').trim();
            const action = JSON.parse(cleanJson);

            // 3. Update Local Storage and State
            const activeComp = localStorage.getItem('smees_active_comp') || 'default';
            const storageKey = `smees_data_${activeComp}`;
            
            const updatedData = { ...data };

            if (action.action === 'CREATE_TASK') {
                const newTask = { 
                    ...action.data, 
                    id: `T-${Date.now()}`, 
                    status: 'To Do', 
                    createdAt: new Date().toISOString() 
                };
                updatedData.tasks = [newTask, ...(updatedData.tasks || [])];
            } else if (action.action === 'CREATE_TRANSACTION') {
                const newTx = { 
                    ...action.data, 
                    id: `TX-${Date.now()}`, 
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString() 
                };
                updatedData.transactions = [newTx, ...(updatedData.transactions || [])];
            }

            // Save to IndexedDB
            await localDB.set(storageKey, updatedData);
            setData(updatedData);

            return { success: true, message: action.message || "Command processed successfully!" };
        } catch (err) {
            console.error("Native AI Error:", err);
            return { success: false, error: "AI failed to process. Make sure model is initialized." };
        } finally {
            setIsThinking(false);
        }
    }, [data, setData]);

    return { processCommand, isThinking };
};
