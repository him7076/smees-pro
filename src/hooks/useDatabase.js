import { doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getNextId } from "../utils/helpers";

export const useDatabase = (data, setData) => {
    
    const saveRecord = async (collectionName, record, type) => {
        try {
            const isNew = !record.id;
            let finalRecord = { ...record };
            let nextCounters = data.counters;

            // 1. ID Generation Logic
            if (isNew) {
                const { id, nextCounters: updatedCounters } = getNextId(data, type);
                finalRecord.id = id;
                finalRecord.createdAt = new Date().toISOString();
                nextCounters = updatedCounters;
            }
            finalRecord.updatedAt = new Date().toISOString();

            // 2. Update Local State (Optimistic)
            const updatedList = isNew 
                ? [finalRecord, ...data[collectionName]] 
                : data[collectionName].map(r => r.id === finalRecord.id ? finalRecord : r);
            
            const newData = { 
                ...data, 
                [collectionName]: updatedList,
                counters: nextCounters
            };

            setData(newData);
            localStorage.setItem('smees_data', JSON.stringify(newData));

            // 3. Update Firestore
            // Save the record
            await setDoc(doc(db, collectionName, finalRecord.id), finalRecord, { merge: true });
            
            // Update counters in settings/counters (or wherever they are stored)
            if (isNew) {
                await setDoc(doc(db, "settings", "counters"), nextCounters, { merge: true });
                // Also update the personal data doc if it's a personal transaction/task
                if (collectionName.startsWith('personal')) {
                    await setDoc(doc(db, "companies", "smees_pro_data"), { 
                        [collectionName]: updatedList,
                        counters: nextCounters 
                    }, { merge: true });
                }
            }

            return finalRecord.id;
        } catch (error) {
            console.error("Error saving record:", error);
            throw error;
        }
    };

    const deleteRecord = async (collectionName, id) => {
        try {
            if (!window.confirm("Are you sure you want to delete this record?")) return;

            // 1. Update Local State
            const updatedList = data[collectionName].filter(r => r.id !== id);
            const newData = { ...data, [collectionName]: updatedList };
            
            setData(newData);
            localStorage.setItem('smees_data', JSON.stringify(newData));

            // 2. Update Firestore
            await deleteDoc(doc(db, collectionName, id));

            // 3. Update personal data doc if necessary
            if (collectionName.startsWith('personal')) {
                await setDoc(doc(db, "companies", "smees_pro_data"), { 
                    [collectionName]: updatedList 
                }, { merge: true });
            }

        } catch (error) {
            console.error("Error deleting record:", error);
            throw error;
        }
    };

    return { saveRecord, deleteRecord };
};
