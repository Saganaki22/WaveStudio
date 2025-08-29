
class VideoExporter {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.audioStream = null;
        this.canvasStream = null;
        this.combinedStream = null;
    }
    
    async startRecording(canvas, audioData, settings, progressCallback, audioProcessor = null, exportFormat = 'mp4') {
        try {
            if (this.isRecording) {
                throw new Error('Recording already in progress');
            }
            
            this.recordedChunks = [];
            this.isRecording = true;
            
            const fps = settings.fps || 30;
            this.canvasStream = canvas.captureStream(fps);
            
            if (audioProcessor && audioProcessor.audio) {
                try {
                    this.audioStream = await this.captureHTMLAudioElement(audioProcessor.audio);
                    console.log('✅ Direct HTML audio element captured');
                } catch (error) {
                    console.error('Failed to capture HTML audio element:', error);
                    this.audioStream = null;
                }
            } else {
                this.audioStream = null;
            }
            
            if (this.audioStream && this.audioStream.getTracks().length > 0) {
                this.combinedStream = new MediaStream([
                    ...this.canvasStream.getTracks(),
                    ...this.audioStream.getTracks()
                ]);
                console.log('✅ Combined video + audio stream created');
            } else {
                this.combinedStream = this.canvasStream;
                console.log('⚠️ Video-only stream created (no audio)');
            }
            
            const userFormat = exportFormat || settings.format || 'mp4';
            const { mimeType, fileExtension } = this.getVideoFormat(userFormat);
            console.log(`User requested: ${userFormat}, Using: ${fileExtension}`);
            
            const options = {
                mimeType: mimeType,
                videoBitsPerSecond: this.getVideoBitrate(canvas.width, canvas.height, fps)
            };
            
            if (this.audioStream && this.audioStream.getTracks().length > 0) {
                options.audioBitsPerSecond = 320000;
            }
            
            this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.finishRecording(fileExtension, progressCallback);
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                throw new Error(`Recording failed: ${event.error}`);
            };
            
            this.mediaRecorder.start(250);
            
            if (progressCallback) {
                this.trackProgress(audioData.duration, progressCallback);
            }
            
            this.setupAutoStop(audioData.duration);
            
            return { mimeType, fileExtension };
            
        } catch (error) {
            this.cleanup();
            throw error;
        }
    }
    
    async captureHTMLAudioElement(audioElement) {
        try {
            if (audioElement.captureStream) {
                const stream = audioElement.captureStream();
                console.log('🎵 Using native HTMLMediaElement.captureStream()');
                return stream;
            } else if (audioElement.mozCaptureStream) {
                const stream = audioElement.mozCaptureStream();
                console.log('🎵 Using Firefox mozCaptureStream()');
                return stream;
            } else {
                throw new Error('Browser does not support HTMLMediaElement.captureStream()');
            }
        } catch (error) {
            console.error('Direct HTML audio capture failed:', error);
            throw error;
        }
    }
    
    async createMinimalAudioStream(audioProcessor) {
        try {
            const originalSampleRate = audioProcessor.sampleRate;
            console.log(`Using original sample rate: ${originalSampleRate}Hz`);
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: originalSampleRate
            });
            
            const buffer = audioContext.createBuffer(1, audioProcessor.monoData.length, originalSampleRate);
            const channelData = buffer.getChannelData(0);
            
            for (let i = 0; i < audioProcessor.monoData.length; i++) {
                channelData[i] = audioProcessor.monoData[i];
            }
            
            const source = audioContext.createBufferSource();
            const destination = audioContext.createMediaStreamDestination();
            
            source.buffer = buffer;
            source.connect(destination);
            source.start(0);
            
            this.minimalAudioContext = audioContext;
            this.minimalSource = source;
            
            console.log(`✅ Audio buffer created: ${audioProcessor.monoData.length} samples at ${originalSampleRate}Hz`);
            return destination.stream;
            
        } catch (error) {
            console.error('Error creating minimal audio:', error);
            throw error;
        }
    }
    
    async captureAudioFromProcessor(audioProcessor) {
        try {
            const exportAudioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100, // Standard sample rate
                latencyHint: 'playback'
            });
            
            const source = exportAudioContext.createBufferSource();
            const destination = exportAudioContext.createMediaStreamDestination();
            
            const audioData = audioProcessor.monoData;
            const sampleRate = audioProcessor.sampleRate || 44100;
            
            if (audioData && audioData.length > 0) {
                const buffer = exportAudioContext.createBuffer(2, audioData.length, sampleRate);
                const leftChannel = buffer.getChannelData(0);
                const rightChannel = buffer.getChannelData(1);
                
                for (let i = 0; i < audioData.length; i++) {
                    leftChannel[i] = audioData[i] * 0.8;
                    rightChannel[i] = audioData[i] * 0.8;
                }
                
                source.buffer = buffer;
                source.connect(destination);
                source.start(0);
                
                this.exportAudioContext = exportAudioContext;
                this.exportBufferSource = source;
                
                console.log('🎵 Clean export audio stream created');
                return destination.stream;
            } else {
                return destination.stream;
            }
            
        } catch (error) {
            console.error('Error capturing clean audio for export:', error);
            try {
                const silentContext = new (window.AudioContext || window.webkitAudioContext)();
                return silentContext.createMediaStreamDestination().stream;
            } catch (e) {
                return null;
            }
        }
    }
    
    async createRealAudioStream(audioData) {
        try {
            // Create audio context with optimal settings
            const audioContextOptions = {
                sampleRate: Math.min(48000, Math.max(44100, audioData.sampleRate)), // Clamp to common rates
                latencyHint: 'playback'
            };
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
            
            // Wait for context to be ready
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create buffer from audio data with exact sample rate matching
            const buffer = this.audioContext.createBuffer(
                2, // stereo
                audioData.monoData.length,
                audioData.sampleRate
            );
            
            // Enhanced anti-pop processing with longer fades and DC bias removal
            const fadeLength = Math.min(4410, audioData.monoData.length / 20); // 100ms or 5% of length
            
            // Calculate DC bias (average value) to remove it
            let dcBias = 0;
            for (let i = 0; i < audioData.monoData.length; i++) {
                dcBias += audioData.monoData[i];
            }
            dcBias /= audioData.monoData.length;
            
            const leftChannel = buffer.getChannelData(0);
            const rightChannel = buffer.getChannelData(1);
            
            for (let i = 0; i < audioData.monoData.length; i++) {
                let sample = audioData.monoData[i];
                
                sample -= dcBias;
                
                sample = Math.tanh(sample * 0.8) * 1.25;
                
                if (i < fadeLength) {
                    const fadeRatio = i / fadeLength;
                    const fadeGain = 0.5 * (1 - Math.cos(Math.PI * fadeRatio));
                    sample *= fadeGain;
                }
                
                if (i > audioData.monoData.length - fadeLength) {
                    const fadeRatio = (audioData.monoData.length - i) / fadeLength;
                    const fadeGain = 0.5 * (1 - Math.cos(Math.PI * fadeRatio));
                    sample *= fadeGain;
                }
                
                sample = Math.max(-1, Math.min(1, sample));
                
                leftChannel[i] = sample;
                rightChannel[i] = sample;
            }
            
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            
            const lowPassFilter = this.audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.setValueAtTime(18000, this.audioContext.currentTime);
            lowPassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.75, this.audioContext.currentTime + 0.05);
            
            const destination = this.audioContext.createMediaStreamDestination();
            
            source.connect(lowPassFilter);
            lowPassFilter.connect(gainNode);
            gainNode.connect(destination);
            
            source.start(0);
            
            this.bufferSource = source;
            this.gainNode = gainNode;
            this.lowPassFilter = lowPassFilter;
            
            console.log('🎵 Audio buffer created with anti-pop measures');
            
            return destination.stream;
            
        } catch (error) {
            console.error('Error creating real audio stream:', error);
            throw error;
        }
    }
    
    async createSimpleAudioStream(audioData) {
        try {
            // Create a simple silent audio stream for MediaRecorder
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const destination = audioContext.createMediaStreamDestination();
            
            // Create a silent tone
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            gain.gain.setValueAtTime(0, audioContext.currentTime); // Silent
            
            oscillator.connect(gain);
            gain.connect(destination);
            
            oscillator.start();
            
            // Store context for cleanup
            this.audioContext = audioContext;
            this.oscillator = oscillator;
            
            // Stop after duration
            setTimeout(() => {
                try {
                    if (this.oscillator) {
                        this.oscillator.stop();
                    }
                } catch (e) {
                    // Ignore if already stopped
                }
            }, (audioData.duration + 1) * 1000);
            
            return destination.stream;
            
        } catch (error) {
            console.error('Error creating audio stream:', error);
            // Return empty stream
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return audioContext.createMediaStreamDestination().stream;
        }
    }
    
    async createAudioStream(audioData, settings) {
        return this.createSimpleAudioStream(audioData);
    }
    
    getVideoFormat(preferredFormat = 'mp4') {
        // Always prioritize WebM for clean audio - MP4 has AAC encoding issues
        console.log(`User requested: ${preferredFormat}, but using WebM for clean audio`);
        
        const webmFormats = [
            { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
            { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
            { mimeType: 'video/webm', extension: 'webm' }
        ];
        
        for (const format of webmFormats) {
            if (MediaRecorder.isTypeSupported(format.mimeType)) {
                console.log(`Using clean audio format: ${format.mimeType}`);
                return { mimeType: format.mimeType, fileExtension: format.extension };
            }
        }
        
        // Fallback to MP4 only if WebM completely unavailable (rare)
        const mp4Formats = [
            { mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
            { mimeType: 'video/mp4;codecs=avc1,mp4a', extension: 'mp4' },
            { mimeType: 'video/mp4', extension: 'mp4' }
        ];
        
        for (const format of mp4Formats) {
            if (MediaRecorder.isTypeSupported(format.mimeType)) {
                console.log(`⚠️ Fallback to MP4 (may have audio pops): ${format.mimeType}`);
                return { mimeType: format.mimeType, fileExtension: format.extension };
            }
        }
        
        // Last resort
        console.log('Using basic WebM fallback');
        return { mimeType: 'video/webm', fileExtension: 'webm' };
    }
    
    getBestVideoFormat() {
        // Prioritize WebM with Opus audio (often cleaner for audio)
        const formats = [
            { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
            { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
            { mimeType: 'video/webm', extension: 'webm' },
            { mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
            { mimeType: 'video/mp4;codecs=avc1,mp4a', extension: 'mp4' },
            { mimeType: 'video/mp4', extension: 'mp4' }
        ];
        
        for (const format of formats) {
            if (MediaRecorder.isTypeSupported(format.mimeType)) {
                console.log(`Using format: ${format.mimeType}`);
                return { mimeType: format.mimeType, fileExtension: format.extension };
            }
        }
        
        // Fallback to basic WebM if nothing else works
        return { mimeType: 'video/webm', fileExtension: 'webm' };
    }
    
    getVideoBitrate(width, height, fps) {
        // Calculate appropriate bitrate based on resolution and FPS
        const pixelsPerSecond = width * height * fps;
        
        // Base bitrate calculation (rough approximation)
        let bitrate;
        
        if (pixelsPerSecond > 2073600) { // 1080p60 or 4K30
            bitrate = 8000000; // 8 Mbps
        } else if (pixelsPerSecond > 1036800) { // 1080p30 or 720p60
            bitrate = 5000000; // 5 Mbps
        } else if (pixelsPerSecond > 518400) { // 720p30
            bitrate = 2500000; // 2.5 Mbps
        } else {
            bitrate = 1000000; // 1 Mbps
        }
        
        return bitrate;
    }
    
    trackProgress(duration, progressCallback) {
        const startTime = Date.now();
        
        const updateProgress = () => {
            if (!this.isRecording) return;
            
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            
            progressCallback(progress);
            
            if (progress < 1) {
                setTimeout(updateProgress, 100);
            }
        };
        
        updateProgress();
    }
    
    setupAutoStop(duration) {
        setTimeout(() => {
            if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.stopRecording();
            }
        }, (duration + 0.5) * 1000); // Add 0.5s buffer
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }
    
    finishRecording(fileExtension, progressCallback) {
        try {
            if (this.recordedChunks.length === 0) {
                throw new Error('No data recorded');
            }
            
            // Create blob from recorded chunks
            const mimeType = this.mediaRecorder.mimeType;
            const blob = new Blob(this.recordedChunks, { type: mimeType });
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `waveform_${timestamp}.${fileExtension}`;
            
            // Create download link and trigger download
            this.downloadBlob(blob, filename);
            
            // Cleanup
            this.cleanup();
            
            // Final progress update
            if (progressCallback) {
                progressCallback(1);
            }
            
        } catch (error) {
            console.error('Error finishing recording:', error);
            this.cleanup();
            throw error;
        }
    }
    
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    cleanup() {
        this.isRecording = false;
        
        // Stop MediaRecorder
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused') {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }
        
        // Stop all tracks
        if (this.combinedStream) {
            this.combinedStream.getTracks().forEach(track => track.stop());
            this.combinedStream = null;
        }
        
        if (this.canvasStream) {
            this.canvasStream.getTracks().forEach(track => track.stop());
            this.canvasStream = null;
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        // Clean up oscillator
        if (this.oscillator) {
            try {
                this.oscillator.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.oscillator = null;
        }
        
        // Clean up buffer source
        if (this.bufferSource) {
            try {
                this.bufferSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.bufferSource = null;
        }
        
        // Clean up gain node
        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (e) {
                // Ignore if already disconnected
            }
            this.gainNode = null;
        }
        
        // Clean up low-pass filter
        if (this.lowPassFilter) {
            try {
                this.lowPassFilter.disconnect();
            } catch (e) {
                // Ignore if already disconnected
            }
            this.lowPassFilter = null;
        }
        
        // Note: We don't disconnect the analyser since it's owned by AudioProcessor
        
        // Clean up export audio context
        if (this.exportAudioContext) {
            try {
                this.exportAudioContext.close();
            } catch (e) {
                // Ignore if already closed
            }
            this.exportAudioContext = null;
        }
        
        // Clean up export buffer source
        if (this.exportBufferSource) {
            try {
                this.exportBufferSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.exportBufferSource = null;
        }
        
        // Clean up minimal audio
        if (this.minimalSource) {
            try {
                this.minimalSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.minimalSource = null;
        }
        
        if (this.minimalAudioContext) {
            try {
                this.minimalAudioContext.close();
            } catch (e) {
                // Ignore if already closed
            }
            this.minimalAudioContext = null;
        }
        
        // Clean up audio context
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (e) {
                // Ignore if already closed
            }
            this.audioContext = null;
        }
        
        // Clear recorded chunks
        this.recordedChunks = [];
    }
    
    async exportWithOptions(canvas, audioData, settings, aspectRatio = '16:9', quality = 'HD', format = 'mp4', progressCallback, audioProcessor = null) {
        try {
            // Get the correct export dimensions
            const dimensions = this.getDimensions(aspectRatio, quality);
            const originalWidth = canvas.width;
            const originalHeight = canvas.height;
            
            console.log(`Export dimensions: ${dimensions.width}x${dimensions.height} (was ${originalWidth}x${originalHeight})`);
            
            // Temporarily resize canvas to exact export dimensions
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            
            // Start recording with exact dimensions
            const result = await this.startRecording(canvas, audioData, settings, progressCallback, audioProcessor, format);
            
            // Restore original canvas size immediately after starting recording
            setTimeout(() => {
                canvas.width = originalWidth;
                canvas.height = originalHeight;
                console.log(`Canvas restored to: ${originalWidth}x${originalHeight}`);
            }, 500); // Give MediaRecorder time to initialize
            
            return result;
            
        } catch (error) {
            console.error('Export with options failed:', error);
            throw error;
        }
    }
    
    getDimensions(aspectRatio, quality) {
        const aspectRatios = {
            '16:9': {
                'SD': { width: 854, height: 480 },
                'HD': { width: 1280, height: 720 },
                'Full HD': { width: 1920, height: 1080 }
            },
            '9:16': {
                'SD': { width: 480, height: 854 },
                'HD': { width: 720, height: 1280 },
                'Full HD': { width: 1080, height: 1920 }
            },
            '1:1': {
                'SD': { width: 480, height: 480 },
                'HD': { width: 720, height: 720 },
                'Full HD': { width: 1080, height: 1080 }
            }
        };
        
        return aspectRatios[aspectRatio]?.[quality] || aspectRatios['16:9']['HD'];
    }
    
    static getExportOptions() {
        return {
            aspectRatios: [
                { value: '16:9', name: 'Landscape (16:9)', description: 'YouTube, Vimeo' },
                { value: '9:16', name: 'Portrait (9:16)', description: 'TikTok, Instagram Stories' },
                { value: '1:1', name: 'Square (1:1)', description: 'Instagram Posts' }
            ],
            qualities: [
                { value: 'SD', name: 'SD', description: '480p' },
                { value: 'HD', name: 'HD', description: '720p' },
                { value: 'Full HD', name: 'Full HD', description: '1080p' }
            ]
        };
    }
    
    static getSupportedFormats() {
        const formats = [
            { name: 'MP4 (H.264)', mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
            { name: 'MP4 (AVC1)', mimeType: 'video/mp4;codecs=avc1,mp4a', extension: 'mp4' },
            { name: 'MP4 (Basic)', mimeType: 'video/mp4', extension: 'mp4' },
            { name: 'WebM (VP9)', mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
            { name: 'WebM (VP8)', mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
            { name: 'WebM (Basic)', mimeType: 'video/webm', extension: 'webm' }
        ];
        
        return formats.filter(format => MediaRecorder.isTypeSupported(format.mimeType));
    }
    
    static isMP4Supported() {
        return MediaRecorder.isTypeSupported('video/mp4') ||
               MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac') ||
               MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a');
    }
    
    static isWebMSupported() {
        return MediaRecorder.isTypeSupported('video/webm') ||
               MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ||
               MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus');
    }
}

export default VideoExporter;