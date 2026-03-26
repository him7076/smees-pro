import { useState, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase';

export const useTimer = (data, setData, user) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const getLocation = () => new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 
                () => resolve(null),
                { timeout: 10000 }
            );
        } else resolve(null);
    });

    const toggleTimer = useCallback(async (taskId, staffId = user?.id) => {
        if (!user || !taskId || !staffId) return;
        
        setIsSyncing(true);
        try {
            const taskRef = doc(db, "tasks", taskId);
            const taskSnap = await getDoc(taskRef);
            
            if (!taskSnap.exists()) throw new Error("Task not found");

            const latestTask = taskSnap.data();
            const now = new Date().toISOString();
            let newLogs = [...(latestTask.timeLogs || [])];
            
            const activeLogIndex = newLogs.findIndex(l => l.staffId === staffId && !l.end);

            if (activeLogIndex >= 0) {
                // STOP TIMER
                const start = new Date(newLogs[activeLogIndex].start);
                const end = new Date(now);
                const duration = ((end - start) / 1000 / 60).toFixed(0);
                
                newLogs[activeLogIndex] = { 
                    ...newLogs[activeLogIndex], 
                    end: now, 
                    duration: parseInt(duration) 
                };
            } else {
                // START TIMER
                // 1. Conflict Check: Is staff timing on ANOTHER task?
                const otherActiveTask = data.tasks.find(t => 
                    t.id !== taskId && 
                    (t.timeLogs || []).some(l => l.staffId === staffId && !l.end)
                );

                if (otherActiveTask) {
                    alert(`Conflict: You already have an active timer on Task #${otherActiveTask.id}. Please stop it first.`);
                    setIsSyncing(false);
                    return;
                }

                // 2. Start new log with location
                const locData = await getLocation();
                const staffMember = data.staff?.find(s => s.id === staffId);

                newLogs.push({
                    staffId,
                    staffName: staffMember?.name || user.name || 'Staff',
                    start: now,
                    end: null,
                    duration: 0,
                    location: locData
                });
            }

            const updatedTask = { 
                ...latestTask, 
                timeLogs: newLogs, 
                updatedAt: now 
            };

            // Save to Firestore
            await setDoc(taskRef, updatedTask, { merge: true });

            // Update local state
            setData(prev => ({
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
            }));

        } catch (error) {
            console.error("Timer Sync Error:", error);
            alert("Failed to update timer. Check connection.");
        } finally {
            setIsSyncing(false);
        }
    }, [data, setData, user]);

    return { toggleTimer, isSyncing };
};
