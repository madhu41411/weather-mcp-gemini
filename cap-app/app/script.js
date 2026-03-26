document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('topicInput');
    const button = document.getElementById('searchButton');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    const resultContainer = document.getElementById('resultContainer');
    const resultContent = document.getElementById('resultContent');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');

    function setLoading(isLoading) {
        if (isLoading) {
            button.disabled = true;
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
            input.disabled = true;
            resultContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
        } else {
            button.disabled = false;
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            input.disabled = false;
        }
    }

    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
    }

    function showResult(text) {
        // Simple markdown to HTML conversion for bullet points and bold text
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n- (.*?)(?=\n|$)/g, '<br>• $1');

        resultContent.innerHTML = formattedText;
        resultContainer.classList.remove('hidden');
    }

    async function handleSearch() {
        const topic = input.value.trim();
        if (!topic) return;

        setLoading(true);

        try {
            // Encode the topic to be safe in the URL
            const odataUrl = `/odata/v4/aiassist/askAI(topic='${encodeURIComponent(topic)}')`;
            
            const response = await fetch(odataUrl);
            const data = await response.json();

            if (!response.ok) {
                const errMsg = data.error?.message || data.value || `Server Error: ${response.status}`;
                throw new Error(errMsg);
            }

            if (data.value) {
                if (data.value.startsWith("Error:")) {
                    throw new Error(data.value.substring(6).trim());
                }
                showResult(data.value);
            } else {
                throw new Error("Received empty response from the AI assistant.");
            }

        } catch (err) {
            console.error('Search failed:', err);
            showError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
            input.focus();
        }
    }

    button.addEventListener('click', handleSearch);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Modal logic
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const cancelSettings = document.getElementById('cancelSettings');
    const saveSettings = document.getElementById('saveSettings');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modalError = document.getElementById('modalError');
    const modalSuccess = document.getElementById('modalSuccess');

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        modalError.classList.add('hidden');
        modalSuccess.classList.add('hidden');
        apiKeyInput.value = '';
        setTimeout(() => apiKeyInput.focus(), 100);
    });

    const closeModal = () => {
        settingsModal.classList.add('hidden');
    };

    cancelSettings.addEventListener('click', closeModal);

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });

    saveSettings.addEventListener('click', async () => {
        const newKey = apiKeyInput.value.trim();
        if (!newKey) {
            modalError.textContent = "API Key cannot be empty.";
            modalError.classList.remove('hidden');
            modalSuccess.classList.add('hidden');
            return;
        }

        modalError.classList.add('hidden');
        modalSuccess.classList.add('hidden');
        saveSettings.disabled = true;
        saveSettings.textContent = 'Saving...';

        try {
            const response = await fetch('/odata/v4/aiassist/updateApiKey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: newKey })
            });

            if (!response.ok) throw new Error("Failed to update API Key on backend.");

            modalSuccess.textContent = "API Key successfully updated!";
            modalSuccess.classList.remove('hidden');
            
            setTimeout(() => {
                closeModal();
                input.focus();
            }, 1500);

        } catch (err) {
            modalError.textContent = err.message || "An error occurred.";
            modalError.classList.remove('hidden');
        } finally {
            saveSettings.disabled = false;
            saveSettings.textContent = 'Save Key';
        }
    });

    input.focus();
});
