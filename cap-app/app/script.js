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

    input.focus();
});
