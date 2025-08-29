
class AudioProcessor {
    constructor() {
        this.audio = new Audio();
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.monoData = null;
        this.sampleRate = 44100;
        this.isInitialized = false;
    }
    
    async loadFile(file) {
        try {
            if (this.audioContext) {
                await this.cleanup();
            }
            
            this.audio = new Audio();
            
            const url = URL.createObjectURL(file);
            this.audio.src = url;
            
            await new Promise((resolve, reject) => {
                this.audio.addEventListener('loadeddata', resolve, { once: true });
                this.audio.addEventListener('error', reject, { once: true });
                this.audio.load();
            });
            
            await this.initializeAudioContext();
            
            const audioData = await this.processAudioData(url);
            
            return audioData;
            
        } catch (error) {
            console.error('Error loading audio file:', error);
            throw new Error(`Failed to load audio: ${error.message}`);
        }
    }
    
    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;
            
            this.source = this.audioContext.createMediaElementSource(this.audio);
            
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing audio context:', error);
            throw new Error(`Failed to initialize audio context: ${error.message}`);
        }
    }
    
    async processAudioData(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sampleRate = audioBuffer.sampleRate;
            
            if (audioBuffer.numberOfChannels === 1) {
                this.monoData = audioBuffer.getChannelData(0);
            } else {
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = audioBuffer.getChannelData(1);
                this.monoData = new Float32Array(leftChannel.length);
                
                for (let i = 0; i < leftChannel.length; i++) {
                    this.monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
                }
            }
            
            return {
                buffer: audioBuffer,
                monoData: this.monoData,
                sampleRate: this.sampleRate,
                duration: audioBuffer.duration
            };
            
        } catch (error) {
            console.error('Error processing audio data:', error);
            throw new Error(`Failed to process audio data: ${error.message}`);
        }
    }
    
    async play() {
        if (!this.isInitialized) {
            throw new Error('Audio processor not initialized');
        }
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.audio.currentTime = 0;
            
            await this.audio.play();
            
        } catch (error) {
            console.error('Error starting playback:', error);
            throw new Error(`Failed to start playback: ${error.message}`);
        }
    }
    
    stop() {
        try {
            this.audio.pause();
            this.audio.currentTime = 0;
        } catch (error) {
            console.error('Error stopping playback:', error);
        }
    }
    
    pause() {
        try {
            this.audio.pause();
        } catch (error) {
            console.error('Error pausing playback:', error);
        }
    }
    
    getCurrentTime() {
        return this.audio.currentTime || 0;
    }
    
    getDuration() {
        return this.audio.duration || 0;
    }
    
    getAnalysisData() {
        if (!this.analyser || !this.dataArray) {
            return null;
        }
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const rms = Math.sqrt(
            Array.from(this.dataArray).reduce((sum, value) => sum + value * value, 0) / this.dataArray.length
        ) / 255;
        
        const frequencyData = this.getFrequencyBins();
        
        return {
            rms,
            frequencyData,
            rawData: this.dataArray
        };
    }
    
    getFrequencyBins() {
        if (!this.dataArray) return null;
        
        const bins = {
            bass: 0,
            lowMid: 0,
            mid: 0,
            highMid: 0,
            treble: 0
        };
        
        const nyquist = this.sampleRate / 2;
        const binWidth = nyquist / this.dataArray.length;
        
        let bassCount = 0, lowMidCount = 0, midCount = 0, highMidCount = 0, trebleCount = 0;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            const frequency = i * binWidth;
            const value = this.dataArray[i];
            
            if (frequency <= 250) {
                bins.bass += value;
                bassCount++;
            } else if (frequency <= 500) {
                bins.lowMid += value;
                lowMidCount++;
            } else if (frequency <= 2000) {
                bins.mid += value;
                midCount++;
            } else if (frequency <= 4000) {
                bins.highMid += value;
                highMidCount++;
            } else {
                bins.treble += value;
                trebleCount++;
            }
        }
        
        bins.bass = bassCount > 0 ? (bins.bass / bassCount) / 255 : 0;
        bins.lowMid = lowMidCount > 0 ? (bins.lowMid / lowMidCount) / 255 : 0;
        bins.mid = midCount > 0 ? (bins.mid / midCount) / 255 : 0;
        bins.highMid = highMidCount > 0 ? (bins.highMid / highMidCount) / 255 : 0;
        bins.treble = trebleCount > 0 ? (bins.treble / trebleCount) / 255 : 0;
        
        return bins;
    }
    
    getAmplitudeAtTime(time) {
        if (!this.monoData || !this.sampleRate) {
            return 0;
        }
        
        const sampleIndex = Math.floor(time * this.sampleRate);
        
        if (sampleIndex >= 0 && sampleIndex < this.monoData.length) {
            return Math.abs(this.monoData[sampleIndex]);
        }
        
        return 0;
    }
    
    getAverageAmplitudeRange(startTime, endTime, samples = 100) {
        if (!this.monoData || !this.sampleRate) {
            return 0;
        }
        
        const startIndex = Math.floor(startTime * this.sampleRate);
        const endIndex = Math.floor(endTime * this.sampleRate);
        const step = Math.max(1, Math.floor((endIndex - startIndex) / samples));
        
        let sum = 0;
        let count = 0;
        
        for (let i = startIndex; i < endIndex && i < this.monoData.length; i += step) {
            sum += Math.abs(this.monoData[i]);
            count++;
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    analyzeAudioForVisualization(fps) {
        if (!this.monoData || !this.sampleRate) {
            return [];
        }
        
        const duration = this.monoData.length / this.sampleRate;
        const frameDuration = 1 / fps;
        const totalFrames = Math.floor(duration * fps);
        const samplesPerFrame = Math.floor(this.sampleRate * frameDuration);
        
        const frames = [];
        
        for (let frame = 0; frame < totalFrames; frame++) {
            const startSample = frame * samplesPerFrame;
            const endSample = Math.min(startSample + samplesPerFrame, this.monoData.length);
            
            // Calculate RMS for this frame
            let sum = 0;
            for (let i = startSample; i < endSample; i++) {
                sum += this.monoData[i] * this.monoData[i];
            }
            
            const rms = Math.sqrt(sum / (endSample - startSample));
            frames.push(rms);
        }
        
        const maxRms = Math.max(...frames);
        if (maxRms > 0) {
            return frames.map(frame => frame / maxRms);
        }
        
        return frames;
    }
    
    async cleanup() {
        try {
            this.stop();
            
            if (this.source) {
                this.source.disconnect();
                this.source = null;
            }
            
            if (this.analyser) {
                this.analyser.disconnect();
                this.analyser = null;
            }
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
            }
            
            this.audioContext = null;
            this.dataArray = null;
            this.monoData = null;
            this.isInitialized = false;
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    
    onEnded(callback) {
        this.audio.addEventListener('ended', callback);
    }
    
    onTimeUpdate(callback) {
        this.audio.addEventListener('timeupdate', callback);
    }
    
    onError(callback) {
        this.audio.addEventListener('error', callback);
    }
    
    isPlaying() {
        return !this.audio.paused;
    }
    
    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }
    
    getVolume() {
        return this.audio.volume;
    }
    
    setPlaybackRate(rate) {
        this.audio.playbackRate = Math.max(0.25, Math.min(4, rate));
    }
    
    getPlaybackRate() {
        return this.audio.playbackRate;
    }
}

export default AudioProcessor;