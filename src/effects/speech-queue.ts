export class SpeechQueue {
  private readonly synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  private queue: string[] = [];
  private enabled = false;
  private speaking = false;
  private generation = 0;

  get supported(): boolean {
    return this.synth !== null && 'SpeechSynthesisUtterance' in window;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  add(text: string): void {
    const normalized = text.trim();
    if (!this.supported || !this.enabled || !normalized) return;

    this.queue.push(normalized);
    this.pump();
  }

  setEnabled(enabled: boolean): void {
    if (!this.supported || enabled === this.enabled) return;

    this.enabled = enabled;
    this.generation++;

    if (!enabled) {
      this.queue = [];
      this.speaking = false;
      this.synth!.cancel();
      return;
    }

    this.pump();
  }

  private pump(): void {
    if (!this.enabled || this.speaking || !this.queue.length || !this.synth) return;

    const utterance = new SpeechSynthesisUtterance(this.queue.shift()!);
    const generation = this.generation;
    const voices = this.synth.getVoices();
    utterance.lang = 'es-MX';
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'es-mx')
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('es-'))
      ?? voices.find((voice) => voice.lang.toLowerCase() === 'es')
      ?? null;
    utterance.rate = 1;
    utterance.pitch = 1;

    this.speaking = true;
    const finish = () => {
      if (generation !== this.generation) return;
      this.speaking = false;
      this.pump();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.synth.speak(utterance);
  }
}
