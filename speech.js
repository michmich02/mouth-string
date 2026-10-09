export class SpeechManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        
        // Accumulate recent words spoken
        this.recentWords = [];
        this.maxWords = 20; // Keep the last 20 words for the ribbon
        
        // This will be called whenever a new word is spoken (to drop physical letters)
        this.onNewWord = null; 

        this.init();
    }

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech Recognition API not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        let lastTranscriptLength = 0;

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const fullTranscript = (finalTranscript + interimTranscript).trim();
            const words = fullTranscript.split(/\s+/);
            
            // Very simple approach: just check if we have more words than last time in this continuous block
            if (words.length > lastTranscriptLength && words[words.length - 1].length > 0) {
                const newWord = words[words.length - 1];
                this.addWord(newWord);
                if (this.onNewWord) {
                    this.onNewWord(newWord);
                }
                lastTranscriptLength = words.length;
            }

            // Reset length if the result is final (it starts a new block)
            if (finalTranscript.length > 0 && interimTranscript.length === 0) {
                lastTranscriptLength = 0;
            }
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
        };

        this.recognition.onend = () => {
            // Keep restarting if we are still meant to be listening
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.error("Error restarting recognition", e);
                }
            }
        };
    }

    addWord(word) {
        this.recentWords.push(word);
        if (this.recentWords.length > this.maxWords) {
            this.recentWords.shift();
        }
    }

    start() {
        if (this.recognition && !this.isListening) {
            this.isListening = true;
            try {
                this.recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    }

    stop() {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    getRibbonText() {
        if (this.recentWords.length === 0) {
            return "silence falls like snow"; // Poetic fallback
        }
        return this.recentWords.join(' ');
    }
}
