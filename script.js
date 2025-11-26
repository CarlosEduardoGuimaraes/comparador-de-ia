/* Configuração global dos modelos de IA e 
   definição da chave fixa (opcional) para a Groq.
*/
const MODELS = {
    pollinations: 'openai', 
    groqSmart: 'llama-3.3-70b-versatile',
    groqFast: 'llama-3.1-8b-instant'
};

const MY_GROQ_KEY = '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'; 

document.addEventListener('DOMContentLoaded', () => {

    /* Inicialização: Gerenciamento de chaves no LocalStorage 
       e limpeza de dados legados (chaves antigas).
    */
    if (MY_GROQ_KEY && MY_GROQ_KEY.length > 10) {
        localStorage.setItem('groq_key', MY_GROQ_KEY.trim());
    }

    localStorage.removeItem('hf_key'); 
    localStorage.removeItem('gemini_key');

    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const configBtn = document.getElementById('config-btn');
    const modal = document.getElementById('config-modal');
    const saveKeysBtn = document.getElementById('save-keys');

    updateInterfaceNames();
    loadKeys();

    /* Configuração dos Event Listeners para controle do Modal 
       de configurações e salvamento manual das chaves.
    */
    configBtn.onclick = () => modal.classList.remove('hidden');

    saveKeysBtn.onclick = () => {
        const groqVal = document.getElementById('groq-key').value.trim();
        if (groqVal) localStorage.setItem('groq_key', groqVal);

        modal.classList.add('hidden');
        alert('Chave Groq salva!');
        loadKeys();
    };

    /* Lógica principal de envio: Validação do prompt, redefinição da UI,
       verificação de chaves e disparo paralelo das requisições.
    */
    sendBtn.onclick = async () => {
        const prompt = promptInput.value;
        if (!prompt) return alert('Digite um prompt!');

        const groqKey = localStorage.getItem('groq_key');

        setLoading('gemini', 'Pollinations.ai (GPT-4o-mini)'); 
        
        if(groqKey) {
            setLoading('groq1', 'Llama 3.3 (Smart)');
            setLoading('groq2', 'Llama 3.1 (Fast)');
        } else {
             document.getElementById(`output-groq1`).innerHTML = '<small>Sem chave Groq</small>';
             document.getElementById(`output-groq2`).innerHTML = '<small>Sem chave Groq</small>';
        }

        fetchPollinations(prompt);
        
        if (groqKey) {
            if (!groqKey.startsWith('gsk_')) {
                showError('groq1', 'Chave Groq inválida. Ela deve começar com "gsk_". Verifique nas configurações.');
                showError('groq2', 'Chave inválida.');
            } else {
                fetchGroq(prompt, groqKey, MODELS.groqSmart, 'groq1');
                fetchGroq(prompt, groqKey, MODELS.groqFast, 'groq2');
            }
        }
    };

    /* Funções auxiliares para manipulação do DOM, controle de estado 
       de carregamento, renderização de Markdown e exibição de erros.
    */
    function updateInterfaceNames() {
        const header1 = document.querySelector('.hf-header span') || document.querySelector('.gemini-header span');
        if(header1) header1.innerText = "🔮 Pollinations (GPT-4o)";
        
        const input1 = document.getElementById('gemini-key');
        if(input1) {
            input1.disabled = true;
            input1.placeholder = "Não é necessária chave para este modelo!";
            input1.style.opacity = "0.5";
            const label = input1.previousElementSibling;
            if(label) label.innerText = "Pollinations AI (Grátis - Sem Chave):";
        }
    }

    function loadKeys() {
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

    /* Integração com a API da Pollinations.ai (Modelo Gratuito).
       Realiza requisição GET e processa a resposta como texto puro.
    */
    async function fetchPollinations(prompt) {
        const start = performance.now();
        try {
            const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${MODELS.pollinations}`;

            const response = await fetch(url);

            if (!response.ok) throw new Error("Erro na Pollinations AI");

            const text = await response.text();
            
            updateResult('gemini', text, start);

        } catch (error) {
            showError('gemini', "Pollinations falhou: " + error.message);
        }
    }

    /* Integração com a API da Groq (Llama).
       Realiza requisição POST com autenticação Bearer e processa JSON.
    */
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
                let msg = data.error.message;
                if(msg.includes("API key")) msg = "Chave Groq Inválida. Verifique se começa com 'gsk_'.";
                throw new Error(msg);
            }

            const text = data.choices?.[0]?.message?.content || "Sem resposta.";
            updateResult(elementId, text, start);
        } catch (error) {
            showError(elementId, error.message);
        }
    }
});

