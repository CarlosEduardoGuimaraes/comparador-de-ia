// --- CONFIGURAÇÃO DOS MODELOS ---
const MODELS = {
    // Modelo estável e rápido para sua chave
    gemini: 'gemini-1.5-flash', 

    // Groq: Llama 3.3 (Smart)
    groqSmart: 'llama-3.3-70b-versatile',

    // Groq: Llama 3.1 (Fast)
    groqFast: 'llama-3.1-8b-instant'
};

// SUA CHAVE DA API (Inserida conforme solicitado)
const MY_GEMINI_KEY = 'AIzaSyBiJu8Uhv2SNjKLHhixP9FWsIaM4kVMjHw';

document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    // Carrega chaves salvas ou usa a sua chave padrão
    loadKeys();

    // -- Modal Config --
    configBtn.onclick = () => modal.classList.remove('hidden');

    saveKeysBtn.onclick = () => {
        const geminiVal = document.getElementById('gemini-key').value.trim();
        const groqVal = document.getElementById('groq-key').value.trim();

        if (geminiVal) localStorage.setItem('gemini_key', geminiVal);
        if (groqVal) localStorage.setItem('groq_key', groqVal);

        modal.classList.add('hidden');
        alert('Chaves salvas! Tente disparar novamente.');
    };

    // -- Botão Enviar --
    sendBtn.onclick = async () => {
        const prompt = promptInput.value;
        if (!prompt) return alert('Digite um prompt!');

        // Recupera as chaves (do storage ou a fixa do código)
        let geminiKey = localStorage.getItem('gemini_key');
        
        // SE não tiver chave salva, usa a que você forneceu
        if (!geminiKey) {
            geminiKey = MY_GEMINI_KEY;
            // Salva automaticamente para facilitar
            localStorage.setItem('gemini_key', geminiKey);
        }

        const groqKey = localStorage.getItem('groq_key');

        // Verifica apenas Groq, pois Gemini já garantimos acima
        if (!groqKey) {
            alert('A chave do Gemini foi configurada, mas falta a da Groq (Llama). Configure no botão de engrenagem se quiser usar os outros modelos!');
            // Se quiser permitir rodar só o Gemini, remova o return abaixo
            // modal.classList.remove('hidden');
            // return; 
        }

        // Resetar UI e Timers
        setLoading('gemini', 'Gemini 1.5 Flash');
        if(groqKey) {
            setLoading('groq1', 'Llama 3.3 (Smart)');
            setLoading('groq2', 'Llama 3.1 (Fast)');
        } else {
             document.getElementById(`output-groq1`).innerHTML = '<small>Sem chave Groq</small>';
             document.getElementById(`output-groq2`).innerHTML = '<small>Sem chave Groq</small>';
        }

        // Disparar requisições
        fetchGemini(prompt, geminiKey);
        
        if (groqKey) {
            fetchGroq(prompt, groqKey, MODELS.groqSmart, 'groq1');
            fetchGroq(prompt, groqKey, MODELS.groqFast, 'groq2');
        }
    };

    function loadKeys() {
        // Preenche o input com o que está no storage, ou com a sua chave fixa
        const savedGemini = localStorage.getItem('gemini_key');
        document.getElementById('gemini-key').value = savedGemini || MY_GEMINI_KEY;
        
        document.getElementById('groq-key').value = localStorage.getItem('groq_key') || '';
    }

    function setLoading(id, name) {
        const el = document.getElementById(`output-${id}`);
        if(el) {
            el.innerHTML = `
                <div style="text-align:center; padding:20px; opacity:0.6; color: #89b4fa;">
                    ⏳ Consultando <b>${name}</b>...
                </div>`;
        }
        const timer = document.getElementById(`timer-${id}`);
        if(timer) timer.innerText = '--';
    }

    function updateResult(id, text, startTime) {
        const contentDiv = document.getElementById(`output-${id}`);
        if (!contentDiv) return;

        try {
            // Verifica se a biblioteca marked existe, senão usa texto puro
            if (typeof marked !== 'undefined') {
                contentDiv.innerHTML = marked.parse(text);
            } else {
                contentDiv.innerText = text;
            }
        } catch (e) {
            contentDiv.innerText = text;
        }
        
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        const timerEl = document.getElementById(
            id === 'gemini' ? 'timer-gemini' :
            id === 'groq1' ? 'timer-groq1' :
            'timer-groq2'
        );
        if (timerEl) timerEl.innerText = `${duration}s`;
    }

    function showError(id, msg) {
        const el = document.getElementById(`output-${id}`);
        if(el) {
            el.innerHTML = `
                <div style="color: #ff8888; border: 1px solid #ff5555; background: rgba(255,0,0,0.1); padding: 10px; border-radius: 5px; font-size: 0.85rem;">
                    ⚠️ <b>Erro:</b> ${msg}
                </div>`;
        }
    }

    // --- GOOGLE GEMINI (API V1BETA / V1) ---
    async function fetchGemini(prompt, apiKey) {
        const start = performance.now();
        try {
            // URL corrigida para garantir compatibilidade
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) {
                let msg = data.error.message || "Erro desconhecido.";
                if (msg.includes("API key not valid")) msg = "Sua chave API está inválida.";
                throw new Error(msg);
            }

            // --- CORREÇÃO PRINCIPAL AQUI ---
            // A estrutura correta é candidates[0].content.parts[0].text
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do Gemini.";

            updateResult('gemini', text, start);

        } catch (error) {
            showError('gemini', error.message);
        }
    }

    // --- GROQ (Llama) ---
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

            if (data.error) {
                throw new Error(data.error.message);
            }

            const text = data.choices?.[0]?.message?.content || "Sem resposta.";
            updateResult(elementId, text, start);
        } catch (error) {
            showError(elementId, error.message);
        }
    }
});
