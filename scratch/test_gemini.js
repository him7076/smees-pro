const apiKey = "AIzaSyDxf3BgmftWckaBLyjyn71b1hnRGc6BwqI";
const prompt = `
You are Jarvis, an AI assistant for an ERP system. 
Parse the following user voice command in Hindi/Hinglish/English and figure out what action to take.
The user might ask to create a "Task" or a "Transaction" (like an expense, sale, or payment).

Available Database Context:
{"parties":[{"id":1,"name":"Jacky Bhaiya"}],"items":[],"staff":[]}

Rules for Output:
Return ONLY a strictly valid JSON object (no markdown, no backticks, no comments).
Format:
{
  "action": "CREATE_TASK" | "CREATE_TRANSACTION" | "UNKNOWN" | "ASK_QUESTION",
  "data": { ...record details... }
}

User Command: "Jacky bhaiya ka ac repair task add kardo"
`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    })
}).then(r => r.json()).then(res => {
    console.log(JSON.stringify(res, null, 2));
}).catch(console.error);
