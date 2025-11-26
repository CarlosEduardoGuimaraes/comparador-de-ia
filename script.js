// --- CONFIGURAÇÃO DOS MODELOS ---
const MODELS = {
    // Modelo 1.5 Flash (Rápido e barato/gratuito)
    gemini: 'gemini-1.5-flash-latest', 

    // Groq: Llama 3.3 (Smart)
    groqSmart: 'llama-3.3-70b-versatile',

    // Groq: Llama 3.1 (Fast)
    groqFast: 'llama-3.1-8b-instant'
};

// ---------------------------------------------------------
// 🔒 COLE SUA NOVA CHAVE DO AI STUDIO ABAIXO (DENTRO DAS ASPAS)
// ---------------------------------------------------------
const MY_GEMINI_KEY = ''; 

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DICA: Se a chave antiga continuar aparecendo, descomente a linha abaixo,
    // recarregue a página, e depois comente novamente.
    // localStorage.removeItem('gemini_key'); 

    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    // Carrega chaves salvas ou usa a fixa do código
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

        // 1. Tenta pegar do armazenamento do navegador
        let geminiKey = localStorage.getItem('gemini_key');
        
        // 2. Se não tiver no navegador, usa a constante do código
        if (!geminiKey) {
            geminiKey = MY_GEMINI_KEY;
            // Se a constante estiver preenchida, salva para o futuro
            if (geminiKey) {
                localStorage.setItem('gemini_key', geminiKey);
            }
        }

        // Validação final da chave
        if (!geminiKey) {
            alert('Você precisa configurar uma chave API do Gemini (no código ou no botão de engrenagem).');
            modal.classList.remove('hidden');
            return;
        }

        const groqKey = localStorage.getItem('groq_key');

        // Resetar UI e Timers
        setLoading('gemini', 'Gemini 1.5 Flash');
        if(groqKey) {
            setLoading('groq1', 'Llama 3.3 (Smart)');
            setLoading('groq2', 'Llama 3.1 (Fast)');
        } else {
             document.getElementById(`output-groq1`).innerHTML = '<small style="opacity:0.5">Sem chave Groq configurada</small>';
             document.getElementById(`output-groq2`).innerHTML = '<small style="opacity:0.5">Sem chave Groq configurada</small>';
        }

        // Disparar requisições
        fetchGemini(prompt, geminiKey);
        
        if (groqKey) {
            fetchGroq(prompt, groqKey, MODELS.groqSmart, 'groq1');
            fetchGroq(prompt, groqKey, MODELS.groqFast, 'groq2');
        } else {
            // Apenas avisa se não tiver Groq, mas não trava o Gemini
            console.log("Groq não configurado, pulando...");
        }
    };

    function loadKeys() {
        // Tenta carregar do storage. Se não existir, tenta carregar da constante.
        const savedGemini = localStorage.getItem('gemini_key');
        
        // Prioridade visual: Storage > Constante Code
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

    // --- GOOGLE GEMINI (API V1BETA) ---
    async function fetchGemini(prompt, apiKey) {
        const start = performance.now();
        try {
            // URL da API (usando v1beta para garantir suporte ao Flash 1.5)
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

            // Tratamento de erros detalhado
            if (data.error) {
                let msg = data.error.message || "Erro desconhecido.";
                if (msg.includes("API key not valid")) msg = "Sua chave API está inválida ou expirada.";
                if (msg.includes("not found")) msg = "Modelo não encontrado. Verifique se a chave API tem acesso ao 'Google AI Studio'.";
                throw new Error(msg);
            }

            // Extração da resposta
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "O Gemini não retornou texto.";

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

