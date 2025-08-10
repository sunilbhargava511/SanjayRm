/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VoiceSettings {
  stability: number;       // 0.0-1.0
  similarityBoost: number; // 0.0-1.0
  style: number;          // 0.0-1.0
  useSpeakerBoost: boolean;
}

export interface VoicePreset {
  name: string;
  voiceId: string;
  settings: VoiceSettings;
  description: string;
}

export interface VoiceInputSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export class EnhancedElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private audioQueue: HTMLAudioElement[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying = false;

  // Voice Presets (Sanjay's Voice)
  static readonly VOICE_PRESETS: Record<string, VoicePreset> = {
    professional: {
      name: 'Professional',
      voiceId: 'MXGyTMlsvQgQ4BL0emIa', // Sanjay's custom voice
      settings: { stability: 0.6, similarityBoost: 0.8, style: 0.4, useSpeakerBoost: true },
      description: 'Clear, professional tone for financial advice'
    },
    casual: {
      name: 'Casual',
      voiceId: 'MXGyTMlsvQgQ4BL0emIa', // Sanjay's custom voice
      settings: { stability: 0.4, similarityBoost: 0.85, style: 0.7, useSpeakerBoost: false },
      description: 'Friendly, conversational tone'
    },
    storyteller: {
      name: 'Storyteller',
      voiceId: 'MXGyTMlsvQgQ4BL0emIa', // Sanjay's custom voice
      settings: { stability: 0.7, similarityBoost: 0.75, style: 0.9, useSpeakerBoost: true },
      description: 'Engaging tone for explaining complex concepts'
    }
  };

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found - will use browser fallback');
    }
  }

  // Core TTS Generation with Error Handling
  async generateSpeech(
    text: string, 
    preset: keyof typeof EnhancedElevenLabsService.VOICE_PRESETS = 'professional'
  ): Promise<ArrayBuffer | null> {
    if (!this.apiKey) {
      console.log('No ElevenLabs API key - returning null for fallback');
      return null;
    }

    const voicePreset = EnhancedElevenLabsService.VOICE_PRESETS[preset];
    if (!voicePreset) {
      throw new Error(`Unknown voice preset: ${preset}`);
    }

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voicePreset.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: voicePreset.settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // Throw specific errors instead of returning null
        if (response.status === 429) {
          throw new Error(`ElevenLabs rate limit exceeded (429). Please wait before making more requests.`);
        } else if (response.status === 401) {
          throw new Error(`ElevenLabs API authentication failed (401). Check your API key.`);
        } else {
          throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText}`);
        }
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('TTS generation failed:', error);
      // Re-throw the error instead of returning null so the caller gets the actual error
      throw error;
    }
  }

  // Audio Playback with Queue Management
  async playAudio(audioData: ArrayBuffer): Promise<void> {
    // Stop any existing audio first
    this.interruptAudio();
    
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);

        // Set as current audio
        this.audioQueue = [audio]; // Replace queue entirely
        this.currentAudio = audio;
        this.isPlaying = true;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          this.currentAudio = null;
          this.audioQueue = [];
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          this.currentAudio = null;
          this.audioQueue = [];
          reject(error);
        };

        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Interrupt Current Audio
  interruptAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.isPlaying = false;
    }
    
    // Clear queue
    this.audioQueue.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.audioQueue = [];
  }

  // Get Available Voices
  async getVoices(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.voices || [];
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
    
    return [];
  }

  // Status Checks
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getQueueLength(): number {
    return this.audioQueue.length;
  }
}

// Browser TTS Fallback Service
export class BrowserTTSService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  // Speak with Browser TTS
  async speak(text: string, voice: string = 'default'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Browser TTS not supported'));
        return;
      }

      // Cancel any current speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Configure voice
      const voices = this.synth.getVoices();
      if (voice !== 'default') {
        const selectedVoice = voices.find(v => v.name.includes(voice));
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      // Configure speech parameters
      utterance.rate = 0.9;  // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (error) => {
        this.currentUtterance = null;
        reject(error);
      };

      this.synth.speak(utterance);
    });
  }

  // Stop current speech
  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    return this.synth ? this.synth.getVoices() : [];
  }

  // Check if speaking
  isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}

// ElevenLabs-Only Voice Service
export class VoiceService {
  private elevenLabs: EnhancedElevenLabsService;

  constructor() {
    this.elevenLabs = new EnhancedElevenLabsService();
  }

  // ElevenLabs-only speak method
  async speak(
    text: string, 
    preset: keyof typeof EnhancedElevenLabsService.VOICE_PRESETS = 'professional'
  ): Promise<void> {
    // Always stop any current audio first
    this.interruptAll();
    
    try {
      const audioData = await this.elevenLabs.generateSpeech(text, preset);
      if (audioData) {
        await this.elevenLabs.playAudio(audioData);
        return;
      } else {
        // Only null if no API key (checked in generateSpeech)
        throw new Error('No ElevenLabs API key configured');
      }
    } catch (error) {
      console.error('ElevenLabs TTS failed:', error);
      // Pass through the specific error message from generateSpeech
      throw new Error(`Voice synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Interrupt all speech
  interruptAll(): void {
    this.elevenLabs.interruptAudio();
  }

  // Check if speaking
  isSpeaking(): boolean {
    return this.elevenLabs.isCurrentlyPlaying();
  }
}

// ElevenLabs Speech-to-Text Service
export class VoiceInputService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private isListening = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private settings: VoiceInputSettings;

  constructor(settings: Partial<VoiceInputSettings> = {}) {
    this.settings = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      ...settings
    };

    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found - STT will not work');
    }
  }

  // Start listening using ElevenLabs STT
  async startListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): Promise<void> {
    if (!this.apiKey) {
      onError('ElevenLabs API key not configured');
      return;
    }

    if (this.isListening) {
      onError('Already listening');
      return;
    }

    try {
      // Get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];
      this.isListening = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());

        if (this.audioChunks.length > 0) {
          try {
            const audioBlob = new Blob(this.audioChunks, { type: mimeType });
            const transcript = await this.transcribeAudio(audioBlob);
            
            if (transcript) {
              onTranscript(transcript, true);
            }
          } catch (error) {
            console.error('Transcription error:', error);
            onError(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        onEnd();
      };

      this.mediaRecorder.onerror = (event) => {
        onError(`Recording error: ${event}`);
        this.isListening = false;
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second

    } catch (error) {
      console.error('Failed to start recording:', error);
      onError(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Transcribe audio using ElevenLabs API
  private async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model_id', 'scribe_v1');

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs STT API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ElevenLabs STT error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || null;

    } catch (error) {
      console.error('STT transcription failed:', error);
      throw error;
    }
  }

  // Stop listening
  stopListening(): void {
    if (this.mediaRecorder && this.isListening) {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('Failed to stop recording:', error);
        this.isListening = false;
      }
    }
  }

  // Check if currently listening
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Check if supported
  isSupported(): boolean {
    return !!(this.apiKey && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Update settings
  updateSettings(newSettings: Partial<VoiceInputSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }
}