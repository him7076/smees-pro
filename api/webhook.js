import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, query, getDocs, where, limit } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const WEBHOOK_SECRET = "SMEES_SECRET_123";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const clientSecret = req.headers['x-api-key'];
    if (clientSecret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

    const { action, text, data } = req.body;

    try {
        switch (action) {
            case 'add_expense':
                return await handleAddExpense(text, res);
            case 'create_task':
                return await handleCreateTask(data, res);
            case 'get_due_tasks':
                return await handleGetDueTasks(res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        console.error("Webhook Error:", err);
        return res.status(500).json({ error: err.message });
    }
}

async function handleAddExpense(text, res) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `STRICT JSON ONLY: Parse "${text}". Return: {"amount": number, "itemName": string, "category": string, "paymentMode": "Cash"|"Bank"}. Use "General Expense" if unsure.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const json = JSON.parse(response.text().replace(/```json/g, '').replace(/```/g, '').trim());

    const docId = `TX-${Date.now()}`;
    const txData = {
        id: docId,
        ...json,
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "transactions", docId), txData);
    return res.status(200).json({ success: true, message: "Expense Saved", data: txData });
}

async function handleCreateTask(data, res) {
    const docId = `T-${Date.now()}`;
    const taskData = {
        id: docId,
        name: data.name || "Voice Command Task",
        status: 'Pending',
        priority: 'High',
        createdAt: new Date().toISOString(),
        ...data
    };
    await setDoc(doc(db, "tasks", docId), taskData);
    return res.status(200).json({ success: true, id: docId });
}

async function handleGetDueTasks(res) {
    const q = query(collection(db, "tasks"), where("status", "==", "Pending"), limit(10));
    const snap = await getDocs(q);
    const tasks = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
    return res.status(200).json({ tasks });
}
