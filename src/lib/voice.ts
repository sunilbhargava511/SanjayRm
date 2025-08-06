/* eslint-disable @typescript-eslint/no-explicit-any */
export class VoiceRecorder {
  private recognition: any = null;
  private isListening = false;
  private onTranscriptUpdate: (transcript: string) => void;
  private onRecordingStateChange: (isRecording: boolean) => void;
  private onError: (error: string) => void;

  constructor(
    onTranscriptUpdate: (transcript: string) => void,
    onRecordingStateChange: (isRecording: boolean) => void,
    onError: (error: string) => void
  ) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onRecordingStateChange = onRecordingStateChange;
    this.onError = onError;
    this.initializeRecognition();
  }

  private initializeRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.onError('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onRecordingStateChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onRecordingStateChange(false);
    };

    this.recognition.onerror = (event: any) => {
      this.onError(`Speech recognition error: ${event.error}`);
      this.isListening = false;
      this.onRecordingStateChange(false);
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      if (fullTranscript) {
        this.onTranscriptUpdate(fullTranscript);
      }
    };
  }

  startRecording() {
    if (!this.recognition) {
      this.onError('Speech recognition not available');
      return;
    }

    if (this.isListening) {
      this.onError('Already recording');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      this.onError(`Failed to start recording: ${error}`);
    }
  }

  stopRecording() {
    if (!this.recognition || !this.isListening) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      this.onError(`Failed to stop recording: ${error}`);
    }
  }

  isRecording() {
    return this.isListening;
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}

