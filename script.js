// --- CONFIGURAÇÃO DOS MODELOS ---
const MODELS = {
    // Trocamos para o Gemma 2 (Google) hospedado no HF. 
    // Ele é muito rápido e raramente dá erro de "Failed to fetch" no free tier.
    hf: 'google/gemma-2-2b-it', 

    // Groq: Llama 3.3 (Smart)
    groqSmart: 'llama-3.3-70b-versatile',

    // Groq: Llama 3.1 (Fast)
    groqFast: 'llama-3.1-8b-instant'
};

// ---------------------------------------------------------
// 🔒 COLE SEU TOKEN AQUI (SE QUISER FIXAR NO CÓDIGO)
// Hugging Face começa com: "hf_..."
// Groq começa com: "gsk_..."
// ---------------------------------------------------------
const MY_HF_TOKEN = ''; 
const MY_GROQ_KEY = ''; // Adicionei opção de fixar a Groq também se quiser

document.addEventListener('DOMContentLoaded', () => {

    // --- LIMPEZA DE CACHE INTELIGENTE ---
    // Atualiza as chaves se elas existirem no código
    if (MY_HF_TOKEN && MY_HF_TOKEN.length > 5) {
        localStorage.setItem('hf_key', MY_HF_TOKEN.trim());
        console.log("Token HF atualizado via código.");
    }
    if (MY_GROQ_KEY && MY_GROQ_KEY.length > 5) {
        localStorage.setItem('groq_key', MY_GROQ_KEY.trim());
        console.log("Key Groq atualizada via código.");
    }

    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    loadKeys();

    // -- Modal Config --
    configBtn.onclick = () => modal.classList.remove('hidden');

    // -- Botão Salvar (Modal) --
    saveKeysBtn.onclick = () => {
        // Pega os valores e remove espaços extras (trim)
        const hfVal = document.getElementById('gemini-key').value.trim();
        const groqVal = document.getElementById('groq-key').value.trim();

        if (hfVal) localStorage.setItem('hf_key', hfVal);
        if (groqVal) localStorage.setItem('groq_key', groqVal);

        modal.classList.add('hidden');
        alert('Chaves salvas! Tente disparar novamente.');
        
        // Recarrega para garantir
        loadKeys();
    };

    // -- Botão Enviar --
    sendBtn.onclick = async () => {
        const prompt = promptInput.value;
        if (!prompt) return alert('Digite um prompt!');

        // Recupera chaves limpas
        let hfKey = localStorage.getItem('hf_key');
        let groqKey = localStorage.getItem('groq_key');

        // Validação
        if (!hfKey) {
            alert('Falta o Token do Hugging Face (hf_...). Configure no botão de engrenagem.');
            modal.classList.remove('hidden');
            return;
        }

        // Resetar UI
        setLoading('gemini', 'Hugging Face (Gemma 2)'); // Usando slot do Gemini
        
        if(groqKey) {
            setLoading('groq1', 'Llama 3.3 (Smart)');
            setLoading('groq2', 'Llama 3.1 (Fast)');
        } else {
             document.getElementById(`output-groq1`).innerHTML = '<small>Sem chave Groq</small>';
             document.getElementById(`output-groq2`).innerHTML = '<small>Sem chave Groq</small>';
        }

        // Disparar requisições
        console.log("Iniciando requisições...");
        fetchHuggingFace(prompt, hfKey);
        
        if (groqKey) {
            fetchGroq(prompt, groqKey, MODELS.groqSmart, 'groq1');
            fetchGroq(prompt, groqKey, MODELS.groqFast, 'groq2');
        }
    };

    function loadKeys() {
        // Carrega a chave HF no input (que tem ID gemini-key no HTML)
        const savedHf = localStorage.getItem('hf_key');
        const savedGroq = localStorage.getItem('groq_key');

        document.getElementById('gemini-key').value = savedHf || '';
        document.getElementById('groq-key').value = savedGroq || '';
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

    // --- HUGGING FACE API ---
    async function fetchHuggingFace(prompt, apiKey) {
        const start = performance.now();
        try {
            // Log para debug (não mostra a chave inteira por segurança)
            console.log(`Chamando HF (${MODELS.hf}) com chave iniciando em: ${apiKey.substring(0,4)}...`);

            const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.hf}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 512,
                        return_full_text: false,
                        temperature: 0.7
                    }
                })
            });

            if (!response.ok) {
                // Tenta ler o erro detalhado da API
                const errData = await response.json().catch(() => ({}));
                console.error("Erro HF:", response.status, errData);
                
                if (response.status === 401) throw new Error("Chave HF Inválida (401). Verifique o token.");
                if (response.status === 503) throw new Error("Modelo carregando (503). Tente novamente em 30s.");
                throw new Error(errData.error || `Erro HTTP ${response.status}`);
            }

            const data = await response.json();

            let text = "Sem resposta.";
            if (Array.isArray(data) && data.length > 0) {
                text = data[0].generated_text;
            } else if (data.generated_text) {
                text = data.generated_text;
            }

            updateResult('gemini', text, start);

        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (msg.includes("Failed to fetch")) {
                msg = "Falha de Rede (CORS/Bloqueio). Verifique se sua chave HF está correta e tem permissão 'Read'.";
            }
            showError('gemini', msg);
        }
    }

    // --- GROQ API ---
    async function fetchGroq(prompt, apiKey, model, elementId) {
        const start = performance.now();
        try {
            console.log(`Chamando Groq (${model}) com chave iniciando em: ${apiKey.substring(0,4)}...`);

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
                console.error("Erro Groq:", data.error);
                throw new Error(data.error.message);
            }

            const text = data.choices?.[0]?.message?.content || "Sem resposta.";
            updateResult(elementId, text, start);
        } catch (error) {
            showError(elementId, error.message);
        }
    }
});
