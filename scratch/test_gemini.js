const apiKey = "AIzaSyBngUVYfms68ZYghWqN4nYiUKJPm1qwB5I";

const contextData = {
    parties: [{ id: 1, name: "Umesh 1" }, { id: 2, name: "Umesh 2" }],
    items: [],
    staff: []
};

async function chat() {
    let chatHistory = [];
    
    // Turn 1
    const text1 = "Umesh bhaiya me task create kar do";
    console.log("User:", text1);
    
    let historyText = chatHistory.length > 0 ? 
        "\nPrevious Conversation Context:\n" + chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n') + "\n" 
        : "";

    let prompt = `
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
${historyText}
User Command: "${text1}"
`;

    let r1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    
    let res1 = await r1.json();
    console.log(res1);
    let action1 = JSON.parse(res1.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());
    console.log("AI:", action1);
    
    if (action1.action === "ASK_QUESTION") {
        chatHistory = [...chatHistory, { role: 'user', text: text1 }, { role: 'assistant', text: action1.data.question }];
        
        // Turn 2
        const text2 = "Umesh 1 me kar do";
        console.log("User:", text2);
        
        historyText = chatHistory.length > 0 ? 
            "\nPrevious Conversation Context:\n" + chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n') + "\n" 
            : "";
            
        prompt = `
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
${historyText}
User Command: "${text2}"
`;

        let r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        let res2 = await r2.json();
        console.log(JSON.stringify(res2, null, 2));
    }
}

chat();
