// --- CONFIGURAÇÃO DOS MODELOS ---
const MODELS = {
    // Substituindo Gemini por Hugging Face (Mistral 7B é ótimo e free)
    hf: 'mistralai/Mistral-7B-Instruct-v0.3', 

    // Groq: Llama 3.3 (Smart)
    groqSmart: 'llama-3.3-70b-versatile',

    // Groq: Llama 3.1 (Fast)
    groqFast: 'llama-3.1-8b-instant'
};

// ---------------------------------------------------------
// 🔒 COLE SEU TOKEN DO HUGGING FACE AQUI
// (Começa com "hf_...")
// ---------------------------------------------------------
const MY_HF_TOKEN = ''; 

document.addEventListener('DOMContentLoaded', () => {

    // --- ATUALIZAÇÃO DE CHAVE ---
    // Se você preencheu o MY_HF_TOKEN acima, ele salva automaticamente
    // como 'hf_key' no navegador e ignora a antiga gemini_key.
    if (MY_HF_TOKEN && MY_HF_TOKEN.trim() !== '') {
        const currentSaved = localStorage.getItem('hf_key');
        if (currentSaved !== MY_HF_TOKEN) {
            console.log("Atualizando token Hugging Face...");
            localStorage.setItem('hf_key', MY_HF_TOKEN);
        }
    }

    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    // Carrega chaves
    loadKeys();

    // -- Modal Config --
    configBtn.onclick = () => modal.classList.remove('hidden');

    saveKeysBtn.onclick = () => {
        // OBS: Estamos usando o input que tem ID 'gemini-key' no HTML 
        // para guardar a chave da Hugging Face, para você não precisar mudar o HTML.
        const hfVal = document.getElementById('gemini-key').value.trim();
        const groqVal = document.getElementById('groq-key').value.trim();

        if (hfVal) localStorage.setItem('hf_key', hfVal);
        if (groqVal) localStorage.setItem('groq_key', groqVal);

        modal.classList.add('hidden');
        alert('Chaves salvas! A chave "Gemini" agora é sua chave Hugging Face.');
    };

    // -- Botão Enviar --
    sendBtn.onclick = async () => {
        const prompt = promptInput.value;
        if (!prompt) return alert('Digite um prompt!');

        // 1. Tenta pegar a chave HF do storage
        let hfKey = localStorage.getItem('hf_key');
        
        // 2. Fallback para a constante
        if (!hfKey) {
            hfKey = MY_HF_TOKEN;
        }

        if (!hfKey) {
            alert('Você precisa configurar o Token da Hugging Face (no lugar da chave Gemini).');
            modal.classList.remove('hidden');
            return;
        }

        const groqKey = localStorage.getItem('groq_key');

        // Resetar UI (Usando o output do Gemini para mostrar o HF)
        setLoading('gemini', 'Hugging Face (Mistral)');
        
        if(groqKey) {
            setLoading('groq1', 'Llama 3.3 (Smart)');
            setLoading('groq2', 'Llama 3.1 (Fast)');
        } else {
             document.getElementById(`output-groq1`).innerHTML = '<small style="opacity:0.5">Sem chave Groq</small>';
             document.getElementById(`output-groq2`).innerHTML = '<small style="opacity:0.5">Sem chave Groq</small>';
        }

        // Disparar requisições
        fetchHuggingFace(prompt, hfKey);
        
        if (groqKey) {
            fetchGroq(prompt, groqKey, MODELS.groqSmart, 'groq1');
            fetchGroq(prompt, groqKey, MODELS.groqFast, 'groq2');
        } else {
            console.log("Groq não configurado, pulando...");
        }
    };

    function loadKeys() {
        // Carrega a chave HF dentro do input que se chama 'gemini-key'
        const savedHf = localStorage.getItem('hf_key');
        document.getElementById('gemini-key').value = savedHf || MY_HF_TOKEN;
        
        // Se quiser mudar o placeholder para facilitar o entendimento:
        document.getElementById('gemini-key').placeholder = "Cole seu Token Hugging Face aqui";
        
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

    // --- HUGGING FACE INFERENCE API ---
    async function fetchHuggingFace(prompt, apiKey) {
        const start = performance.now();
        try {
            const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.hf}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 512, // Limite de resposta
                        return_full_text: false, // Não repete a pergunta na resposta
                        temperature: 0.7
                    }
                })
            });

            const data = await response.json();

            // Tratamento de erro específico do HF
            if (data.error) {
                // Erro comum: Modelo carregando (Cold Boot)
                if (data.error.includes("loading")) {
                    throw new Error("O modelo está 'acordando'. Aguarde 20s e tente de novo.");
                }
                throw new Error(data.error);
            }

            // A resposta do HF geralmente é um array: [{ generated_text: "..." }]
            let text = "Sem resposta.";
            if (Array.isArray(data) && data.length > 0) {
                text = data[0].generated_text;
            } else if (data.generated_text) {
                text = data.generated_text;
            }

            updateResult('gemini', text, start); // Usando o slot visual do Gemini

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

            if (data.error) throw new Error(data.error.message);

            const text = data.choices?.[0]?.message?.content || "Sem resposta.";
            updateResult(elementId, text, start);
        } catch (error) {
            showError(elementId, error.message);
        }
    }
});
