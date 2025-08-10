
export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private voiceId = 'MXGyTMlsvQgQ4BL0emIa'; // Sanjay's custom voice

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    console.log('ElevenLabs API key status:', this.apiKey ? `Found (${this.apiKey.substring(0, 10)}...)` : 'Not found');
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found');
    }
  }

  // Text-to-Speech for Sanjay's responses
  async generateSpeech(text: string): Promise<ArrayBuffer | null> {
    if (!this.apiKey) {
      console.error('ElevenLabs API key not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('TTS generation failed:', error);
      return null;
    }
  }

  // Play generated audio
  async playAudio(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };

      audio.play().catch(reject);
    });
  }

  // Speech-to-Text for user input
  async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    if (!this.apiKey) {
      console.error('ElevenLabs API key not configured');
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      formData.append('model_id', 'whisper-1');

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs STT error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || null;
    } catch (error) {
      console.error('STT transcription failed:', error);
      return null;
    }
  }
}

// Enhanced Voice Recorder with ElevenLabs STT
export class ElevenLabsVoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private elevenLabs: ElevenLabsService;
  
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
    this.elevenLabs = new ElevenLabsService();
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        
        // Convert to WAV for ElevenLabs compatibility
        const wavBlob = await this.convertToWav(audioBlob);
        const transcript = await this.elevenLabs.transcribeAudio(wavBlob);
        
        if (transcript) {
          this.onTranscriptUpdate(transcript);
        } else {
          this.onError('Failed to transcribe audio');
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.onRecordingStateChange(true);

    } catch (error) {
      this.onError(`Failed to start recording: ${error}`);
    }
  }

  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    this.isRecording = false;
    this.onRecordingStateChange(false);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private async convertToWav(blob: Blob): Promise<Blob> {
    // Simple conversion - in production, you might want a more robust solution
    const arrayBuffer = await blob.arrayBuffer();
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}