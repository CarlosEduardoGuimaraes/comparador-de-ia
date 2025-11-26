document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    // Carregar configurações salvas
    loadKeys();

    // Eventos do Modal
    configBtn.onclick = () => modal.classList.remove('hidden');
    saveKeysBtn.onclick = () => {
        localStorage.setItem('gemini_key', document.getElementById('gemini-key').value);
        localStorage.setItem('groq_key', document.getElementById('groq-key').value);
        modal.classList.add('hidden');
    };

    // Botão Enviar
    sendBtn.onclick = async () => {
        const prompt = promptInput.value;
        if (!prompt) return alert('Por favor, digite um prompt!');

        const geminiKey = localStorage.getItem('gemini_key');
        const groqKey = localStorage.getItem('groq_key');

        if (!geminiKey || !groqKey) {
            alert('Configure as chaves API primeiro!');
            modal.classList.remove('hidden');
            return;
        }

        // Limpar UI
        setLoading('gemini');
        setLoading('llama');
        setLoading('mixtral');

        // Disparar requisições em paralelo
        fetchGemini(prompt, geminiKey);
        // Groq roda tanto Llama quanto Mixtral
        fetchGroq(prompt, groqKey, 'llama-3.1-70b-versatile', 'llama'); 
        fetchGroq(prompt, groqKey, 'mixtral-8x7b-32768', 'mixtral');
    };

    function loadKeys() {
        document.getElementById('gemini-key').value = localStorage.getItem('gemini_key') || '';
        document.getElementById('groq-key').value = localStorage.getItem('groq_key') || '';
    }

    function setLoading(id) {
        document.getElementById(`output-${id}`).innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">⏳ Pensando...</div>';
        document.getElementById(`timer-${id}`).innerText = '--';
    }

    function updateResult(id, text, startTime) {
        const contentDiv = document.getElementById(`output-${id}`);
        contentDiv.innerHTML = marked.parse(text);
        
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        document.getElementById(`timer-${id}`).innerText = `${duration}s`;
    }

    // --- API Google Gemini ---
    async function fetchGemini(prompt, apiKey) {
        const start = performance.now();
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
            updateResult('gemini', text, start);
        } catch (error) {
            document.getElementById('output-gemini').innerText = `Erro: ${error.message}`;
        }
    }

    // --- API Groq (Para Llama e Mixtral) ---
    async function fetchGroq(prompt, apiKey, model, elementId) {
        const start = performance.now();
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    model: model,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const text = data.choices[0].message.content;
            updateResult(elementId, text, start);
        } catch (error) {
            document.getElementById(`output-${elementId}`).innerText = `Erro: ${error.message}`;
        }
    }
});