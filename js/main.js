
import AudioProcessor from './audio-processor.js';
import Visualizers from './visualizers.js';
import VideoExporter from './export.js';

class WaveformStudio {
    constructor() {
        this.audioProcessor = new AudioProcessor();
        this.visualizers = new Visualizers();
        this.videoExporter = new VideoExporter();
        
        this.state = {
            hasAudio: false,
            isPlaying: false,
            isRecording: false,
            currentPreset: null,
            theme: localStorage.getItem('theme') || 'dark'
        };
        
        this.elements = {};
        this.animationId = null;
        this.presets = JSON.parse(localStorage.getItem('wavestudio-presets') || '[]');
        
        this.init();
    }
    
    async init() {
        try {
            this.showConsoleImage();
            this.initializeElements();
            this.setupEventListeners();
            this.setupTheme();
            this.updateValueDisplays();
            this.loadPresets();
            this.updateStatus('Ready to create your visual masterpiece');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.updateStatus('Failed to initialize application', 'error');
        }
    }
    
    showConsoleImage() {
        const imageUrl = 'https://i.ibb.co/6RYR9PVH/1718611696956.jpg';
        
        console.log(
            '%c ',
            `font-size: 150px; 
             background: url("${imageUrl}") no-repeat center center; 
             background-size: 300px 200px; 
             line-height: 150px; 
             padding: 75px 150px; 
             border: 2px solid #00d2ff; 
             border-radius: 10px;`
        );
        
        console.log(
            '%c' + 
            '╔══════════════════════════════════════╗\n' +
            '║          🎵 WAVE STUDIO          ║\n' +
            '║                                      ║\n' +
            '║    ●●●   ●●●●   ●●   ●●●●   ●●●     ║\n' +
            '║   ●   ● ●    ● ●  ● ●    ● ●   ●    ║\n' +
            '║   ●   ● ●    ● ●  ● ●    ● ●   ●    ║\n' +
            '║    ●●●   ●●●●   ●●   ●●●●   ●●●     ║\n' +
            '║                                      ║\n' +
            '║        Hey Developer! 👋             ║\n' +
            '╚══════════════════════════════════════╝',
            'font-family: monospace; color: #00d2ff; font-size: 12px; line-height: 1.2;'
        );
        
        console.log(
            '%c🎵 Waveform Studio',
            'font-size: 24px; font-weight: bold; color: #00d2ff; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);'
        );
        
        console.log(
            '%cHey Developer! 👋 Thanks for checking out the code!\n' +
            '🎨 Transform audio into mesmerizing visual art\n' +
            '🔧 Built with HTML5 Canvas, Web Audio API & MediaRecorder\n' +
            '⚡ Real-time waveform visualization\n' +
            '🎬 Export to MP4/WebM with clean audio\n\n' +
            'Made with ❤️ and lots of debugging 🐛\n' +
            '🌟 Star us if you like it!',
            'font-size: 14px; color: #a0a0c0; line-height: 1.6; font-family: "Fira Code", monospace;'
        );
        
        console.log(
            '%cTip: Try the preset system and experiment with different visualizations!',
            'font-size: 12px; color: #00d2ff; background: rgba(0, 210, 255, 0.1); padding: 5px 10px; border-radius: 5px; margin: 10px 0;'
        );
    }
    
    initializeElements() {
        const elementIds = [
            'dropZone', 'audioFile', 'canvas', 'playBtn', 
            'recordBtn', 'playText', 'recordText', 'status',
            'removeAudio', 'themeToggle', 'style', 'opacityMode', 'dotSize', 
            'dotSpacing', 'dotColor', 'bgColor', 'amp', 'fps', 'window', 'aspectRatio',
            'presetBtn', 'presetModal', 'modalClose', 'presetList', 'presetName', 
            'savePreset', 'exportOptions', 'exportFormat', 'exportQuality',
            'exportProgress', 'progressFill', 'progressText', 'windowGroup',
            'confirmExportBtn', 'stopExportBtn'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements[id] = element;
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        });
        
        this.elements.canvasContainer = document.querySelector('.canvas-container');
        this.elements.controlsSection = document.querySelector('.controls-section');
        
        this.ctx = this.elements.canvas?.getContext('2d');
        if (!this.ctx) {
            throw new Error('Unable to get canvas 2D context');
        }
        
        this.valueDisplays = {
            dotSize: document.getElementById('dotSizeValue'),
            dotSpacing: document.getElementById('dotSpacingValue'),
            amp: document.getElementById('ampValue'),
            fps: document.getElementById('fpsValue'),
            window: document.getElementById('windowValue')
        };
    }
    
    setupEventListeners() {
        this.elements.dropZone?.addEventListener('click', () => this.handleDropZoneClick());
        this.elements.audioFile?.addEventListener('change', (e) => this.handleFileSelect(e));
        
        ['dragenter', 'dragover'].forEach(eventName => {
            this.elements.dropZone?.addEventListener(eventName, (e) => this.handleDragEnter(e));
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.elements.dropZone?.addEventListener(eventName, (e) => this.handleDragLeave(e));
        });
        
        this.elements.dropZone?.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.elements.dropZone?.addEventListener('touchstart', () => this.handleDropZoneClick());
        this.elements.dropZone?.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleDropZoneClick();
        });
        
        this.elements.playBtn?.addEventListener('click', () => this.togglePlayback());
        this.elements.recordBtn?.addEventListener('click', () => this.startRecording());
        this.elements.removeAudio?.addEventListener('click', () => this.removeAudio());
        this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        const mobileThemeToggle = document.getElementById('mobileThemeToggle');
        mobileThemeToggle?.addEventListener('click', () => this.toggleTheme());
        
        ['dotSize', 'dotSpacing', 'amp', 'window'].forEach(id => {
            this.elements[id]?.addEventListener('input', () => this.updateValueDisplays());
            this.elements[id]?.addEventListener('change', () => this.handleControlChange());
        });
        
        ['style', 'opacityMode', 'dotColor', 'bgColor', 'fps', 'aspectRatio'].forEach(id => {
            this.elements[id]?.addEventListener('change', () => this.handleControlChange());
        });
        
        this.elements.aspectRatio?.addEventListener('change', () => this.handleAspectRatioChange());
        
        this.elements.presetBtn?.addEventListener('click', () => this.showPresetModal());
        this.elements.modalClose?.addEventListener('click', () => this.hidePresetModal());
        this.elements.savePreset?.addEventListener('click', () => this.saveCurrentPreset());
        
        this.elements.confirmExportBtn?.addEventListener('click', () => this.confirmExport());
        this.elements.stopExportBtn?.addEventListener('click', () => this.stopExport());
        
        this.elements.presetModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.presetModal) {
                this.hidePresetModal();
            }
        });
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    }
    
    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
        const themeIcon = this.elements.themeToggle?.querySelector('.theme-icon');
        const mobileThemeIcon = document.getElementById('mobileThemeToggle')?.querySelector('.theme-icon');
        
        const iconContent = this.state.theme === 'dark' ? '☀️' : '🌙';
        if (themeIcon) {
            themeIcon.textContent = iconContent;
        }
        if (mobileThemeIcon) {
            mobileThemeIcon.textContent = iconContent;
        }
    }
    
    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.state.theme);
        this.setupTheme();
        
        document.documentElement.classList.add('theme-transitioning');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 300);
    }
    
    handleDropZoneClick() {
        if (!this.state.hasAudio && this.elements.audioFile) {
            this.elements.audioFile.click();
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file) {
            this.loadAudioFile(file);
        }
    }
    
    handleDragEnter(event) {
        event.preventDefault();
        if (!this.state.hasAudio) {
            this.elements.dropZone?.classList.add('drag-over');
        }
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        this.elements.dropZone?.classList.remove('drag-over');
    }
    
    handleDrop(event) {
        event.preventDefault();
        this.elements.dropZone?.classList.remove('drag-over');
        
        if (!this.state.hasAudio) {
            const files = event.dataTransfer?.files;
            if (files?.[0]) {
                this.elements.dropZone?.classList.add('file-dropped');
                setTimeout(() => {
                    this.elements.dropZone?.classList.remove('file-dropped');
                }, 600);
                this.loadAudioFile(files[0]);
            }
        }
    }
    
    async loadAudioFile(file) {
        if (!file.type.match('audio.*')) {
            this.updateStatus('Please select a valid audio file', 'error');
            return;
        }
        
        try {
            this.updateStatus(`Processing ${file.name}...`, 'loading');
            
            const audioData = await this.audioProcessor.loadFile(file);
            this.audioData = audioData;
            
            this.showAudioUI();
            this.setupCanvas();
            
            this.elements.playBtn.disabled = false;
            this.elements.recordBtn.disabled = false;
            
            this.updateStatus('Audio loaded successfully! Click Preview to begin', 'success');
            
        } catch (error) {
            console.error('Error loading audio:', error);
            this.updateStatus(`Error loading audio: ${error.message}`, 'error');
        }
    }
    
    showAudioUI() {
        this.elements.dropZone.style.display = 'none';
        this.elements.canvasContainer.style.display = 'block';
        this.elements.controlsSection.style.display = 'block';
        this.state.hasAudio = true;
        
        // Add fade-in animation
        this.elements.canvasContainer.classList.add('fade-in');
        this.elements.controlsSection.classList.add('fade-in');
    }
    
    hideAudioUI() {
        this.stopPlayback();
        this.stopRecording();
        
        this.audioProcessor.cleanup();
        this.audioData = null;
        
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        
        if (this.elements.audioFile) {
            this.elements.audioFile.value = '';
        }
        
        // Reset drop zone to original state with better layout preservation
        if (this.elements.dropZone) {
                const computedStyle = window.getComputedStyle(this.elements.dropZone);
            const originalTextAlign = computedStyle.textAlign;
            const originalFlexDirection = computedStyle.flexDirection;
            const originalAlignItems = computedStyle.alignItems;
            const originalJustifyContent = computedStyle.justifyContent;
            
                this.elements.dropZone.className = 'drop-zone';
            this.elements.dropZone.style.cssText = '';
            
                this.elements.dropZone.style.display = 'flex';
            this.elements.dropZone.style.flexDirection = 'column';
            this.elements.dropZone.style.alignItems = 'center';
            this.elements.dropZone.style.justifyContent = 'center';
            this.elements.dropZone.style.textAlign = 'center';
            
                setTimeout(() => {
                this.elements.dropZone?.classList.add('pulse');
            }, 100);
        }
        
        this.elements.canvasContainer.style.display = 'none';
        this.elements.controlsSection.style.display = 'none';
        this.state.hasAudio = false;
        
        this.elements.playBtn.disabled = true;
        this.elements.recordBtn.disabled = true;
        
        this.updateStatus('Ready to create your visual masterpiece');
    }
    
    removeAudio() {
        this.hideAudioUI();
    }
    
    setupCanvas() {
        this.updateCanvasSize();
    }
    
    updateCanvasSize() {
        const aspectRatio = this.elements.aspectRatio?.value || '16:9';
        const maxWidth = Math.min(1000, window.innerWidth - 40);
        
        let width, height;
        
        switch (aspectRatio) {
            case '16:9':
                width = maxWidth;
                height = width * 9 / 16;
                break;
            case '9:16':
                height = Math.min(600, window.innerHeight * 0.6);
                width = height * 9 / 16;
                break;
            case '1:1':
                const maxSquare = Math.min(maxWidth, window.innerHeight * 0.6);
                width = height = maxSquare;
                break;
            default:
                width = maxWidth;
                height = width * 9 / 16;
        }
        
        this.elements.canvas.width = width;
        this.elements.canvas.height = height;
        
        if (this.state.isPlaying) {
            this.draw();
        }
    }
    
    handleResize() {
        this.updateCanvasSize();
    }
    
    handleAspectRatioChange() {
        this.updateCanvasSize();
        this.handleControlChange();
    }
    
    togglePlayback() {
        if (!this.audioData) {
            this.updateStatus('No audio loaded', 'error');
            return;
        }
        
        if (this.state.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }
    
    async startPlayback() {
        try {
            this.state.isPlaying = true;
            this.elements.playText.textContent = 'Stop Preview';
            this.updateStatus('Previewing waveform animation');
            
            await this.audioProcessor.play();
            this.draw();
            
        } catch (error) {
            console.error('Playback error:', error);
            this.updateStatus(`Playback failed: ${error.message}`, 'error');
            this.state.isPlaying = false;
            this.elements.playText.textContent = 'Preview Waveform';
        }
    }
    
    stopPlayback() {
        this.state.isPlaying = false;
        this.elements.playText.textContent = 'Preview Waveform';
        this.audioProcessor.stop();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.updateStatus('Preview stopped');
    }
    
    async startRecording() {
        if (this.state.isRecording || !this.audioData) {
            return;
        }
        
        if (this.elements.exportOptions.style.display === 'none') {
            this.elements.exportOptions.style.display = 'block';
            this.elements.exportOptions.classList.add('fade-in');
            return;
        }
    }
    
    async confirmExport() {
        if (this.state.isRecording || !this.audioData) {
            return;
        }
        
        try {
            this.state.isRecording = true;
            this.elements.recordText.textContent = 'Recording...';
            this.elements.recordBtn.disabled = true;
            
                this.elements.confirmExportBtn.style.display = 'none';
            this.elements.stopExportBtn.style.display = 'block';
            
            const settings = this.getVisualizationSettings();
            const exportSettings = this.getExportSettings();
            
            this.showExportProgress();
            
                this.state.isPlaying = true; // Set playing state for draw loop
            await this.audioProcessor.play();
            this.draw(); // Start animation loop
            
                const aspectRatio = this.elements.aspectRatio?.value || '16:9';
            
                await this.videoExporter.exportWithOptions(
                this.elements.canvas,
                this.audioData,
                settings,
                aspectRatio,
                exportSettings.quality,
                exportSettings.format,
                (progress) => this.updateExportProgress(progress),
                this.audioProcessor // Pass the AudioProcessor instance
            );
            
            this.updateStatus('Recording started', 'success');
            
        } catch (error) {
            console.error('Recording error:', error);
            this.updateStatus(`Recording failed: ${error.message}`, 'error');
            this.stopRecording();
        }
    }
    
    stopExport() {
        this.videoExporter.stopRecording();
        this.stopRecording();
        this.updateStatus('Export stopped by user', 'warning');
    }
    
    getExportSettings() {
        return {
            format: this.elements.exportFormat?.value || 'mp4',
            quality: this.elements.exportQuality?.value || 'HD'
        };
    }
    
    stopRecording() {
        this.state.isRecording = false;
        this.elements.recordText.textContent = 'Export Video';
        this.elements.recordBtn.disabled = false;
        this.hideExportProgress();
        
        this.elements.confirmExportBtn.style.display = 'block';
        this.elements.stopExportBtn.style.display = 'none';
        
        if (this.elements.exportOptions.style.display === 'block') {
            setTimeout(() => {
                this.elements.exportOptions.style.display = 'none';
                this.elements.exportOptions.classList.remove('fade-in');
            }, 2000);
        }
    }
    
    draw() {
        if (!this.state.isPlaying || !this.audioData) {
            return;
        }
        
        this.animationId = requestAnimationFrame(() => this.draw());
        
        const settings = this.getVisualizationSettings();
        const audioTime = this.audioProcessor.getCurrentTime();
        const audioAnalysis = this.audioProcessor.getAnalysisData();
        
        this.visualizers.renderFrame(
            this.ctx,
            this.elements.canvas.width,
            this.elements.canvas.height,
            settings,
            audioTime,
            audioAnalysis,
            this.audioData
        );
    }
    
    getVisualizationSettings() {
        return {
            style: this.elements.style?.value || 'scrolling',
            opacityMode: this.elements.opacityMode?.value || 'uniform',
            dotSize: parseInt(this.elements.dotSize?.value || '6'),
            dotSpacing: parseInt(this.elements.dotSpacing?.value || '6'),
            dotColor: this.elements.dotColor?.value || '#00d2ff',
            bgColor: this.elements.bgColor?.value || '#000000',
            amplitude: parseInt(this.elements.amp?.value || '60'),
            fps: parseInt(this.elements.fps?.value || '30'),
            windowSize: parseFloat(this.elements.window?.value || '2'),
            aspectRatio: this.elements.aspectRatio?.value || '16:9'
        };
    }
    
    updateValueDisplays() {
        if (this.valueDisplays.dotSize && this.elements.dotSize) {
            this.valueDisplays.dotSize.textContent = this.elements.dotSize.value;
        }
        
        if (this.valueDisplays.dotSpacing && this.elements.dotSpacing) {
            this.valueDisplays.dotSpacing.textContent = this.elements.dotSpacing.value;
        }
        
        if (this.valueDisplays.amp && this.elements.amp) {
            this.valueDisplays.amp.textContent = `${this.elements.amp.value}%`;
        }
        
        if (this.valueDisplays.fps && this.elements.fps) {
            const fpsSelect = this.elements.fps;
            this.valueDisplays.fps.textContent = fpsSelect.options[fpsSelect.selectedIndex].text;
        }
        
        if (this.valueDisplays.window && this.elements.window) {
            this.valueDisplays.window.textContent = `${parseFloat(this.elements.window.value).toFixed(1)}s`;
        }
        
        const style = this.elements.style?.value;
        if (this.elements.windowGroup) {
            this.elements.windowGroup.style.display = style === 'scrolling' ? 'flex' : 'none';
        }
    }
    
    handleControlChange() {
        this.updateValueDisplays();
        
        if (this.state.isPlaying) {
            this.draw();
        }
    }
    
    showPresetModal() {
        this.elements.presetModal.style.display = 'flex';
        this.elements.presetModal.classList.add('modal-enter');
        this.renderPresetList();
    }
    
    hidePresetModal() {
        this.elements.presetModal.classList.add('modal-exit');
        setTimeout(() => {
            this.elements.presetModal.style.display = 'none';
            this.elements.presetModal.classList.remove('modal-enter', 'modal-exit');
        }, 200);
    }
    
    renderPresetList() {
        if (!this.elements.presetList) return;
        
        this.elements.presetList.innerHTML = '';
        
        if (this.presets.length === 0) {
            this.elements.presetList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No presets saved yet</p>';
            return;
        }
        
        this.presets.forEach((preset, index) => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.innerHTML = `
                <div>
                    <strong>${preset.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${preset.style} • ${preset.opacityMode} • ${preset.dotSize}px dots
                    </div>
                </div>
                <button class="btn btn-small" onclick="app.deletePreset(${index})" style="background: var(--error-color);">Delete</button>
            `;
            
            presetItem.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.loadPreset(preset);
                }
            });
            
            this.elements.presetList.appendChild(presetItem);
        });
    }
    
    saveCurrentPreset() {
        const name = this.elements.presetName?.value?.trim();
        if (!name) {
            this.updateStatus('Please enter a preset name', 'error');
            return;
        }
        
        const settings = this.getVisualizationSettings();
        const preset = { name, ...settings };
        
        this.presets.push(preset);
        localStorage.setItem('wavestudio-presets', JSON.stringify(this.presets));
        
        this.elements.presetName.value = '';
        this.renderPresetList();
        this.updateStatus(`Preset "${name}" saved!`, 'success');
    }
    
    loadPreset(preset) {
        Object.keys(preset).forEach(key => {
            if (key !== 'name' && this.elements[key]) {
                this.elements[key].value = preset[key];
            }
        });
        
        this.updateValueDisplays();
        this.hidePresetModal();
        this.updateStatus(`Preset "${preset.name}" loaded!`, 'success');
    }
    
    deletePreset(index) {
        if (index >= 0 && index < this.presets.length) {
            const presetName = this.presets[index].name;
            this.presets.splice(index, 1);
            localStorage.setItem('wavestudio-presets', JSON.stringify(this.presets));
            this.renderPresetList();
            this.updateStatus(`Preset "${presetName}" deleted`, 'warning');
        }
    }
    
    loadPresets() {
        if (this.presets.length === 0) {
            this.presets = [
                {
                    name: 'Classic Wave',
                    style: 'scrolling',
                    opacityMode: 'uniform',
                    dotSize: 6,
                    dotSpacing: 6,
                    dotColor: '#00d2ff',
                    bgColor: '#000000',
                    amplitude: 60,
                    fps: 30,
                    windowSize: 2
                },
                {
                    name: 'Neon Pulse',
                    style: 'breathing',
                    opacityMode: '5_levels',
                    dotSize: 8,
                    dotSpacing: 8,
                    dotColor: '#ff0080',
                    bgColor: '#0a0a12',
                    amplitude: 80,
                    fps: 30,
                    windowSize: 2
                },
                {
                    name: 'Retro Bars',
                    style: 'bars',
                    opacityMode: '3_levels',
                    dotSize: 4,
                    dotSpacing: 12,
                    dotColor: '#ffff00',
                    bgColor: '#2a0845',
                    amplitude: 70,
                    fps: 30,
                    windowSize: 2
                }
            ];
            localStorage.setItem('wavestudio-presets', JSON.stringify(this.presets));
        }
    }
    
    showExportProgress() {
        this.elements.exportProgress.style.display = 'block';
        this.elements.exportProgress.classList.add('fade-in');
    }
    
    hideExportProgress() {
        this.elements.exportProgress.classList.add('fade-out');
        setTimeout(() => {
            this.elements.exportProgress.style.display = 'none';
            this.elements.exportProgress.classList.remove('fade-in', 'fade-out');
        }, 300);
    }
    
    updateExportProgress(progress) {
        const percentage = Math.round(progress * 100);
        this.elements.progressFill.style.width = `${percentage}%`;
        this.elements.progressText.textContent = `Exporting... ${percentage}%`;
        
        if (progress >= 1) {
            this.elements.progressText.textContent = 'Export complete!';
            setTimeout(() => {
                this.hideExportProgress();
                this.stopRecording();
                this.updateStatus('Video exported successfully!', 'success');
            }, 1000);
        }
    }
    
    updateStatus(message, type = 'info') {
        if (!this.elements.status) return;
        
        this.elements.status.textContent = message;
        this.elements.status.className = 'status';
        
        if (type === 'loading') {
            this.elements.status.innerHTML = `<div class="btn-loading" style="display: inline-block; margin-right: 8px;"></div> ${message}`;
        } else if (type === 'success') {
            this.elements.status.classList.add('success');
        } else if (type === 'error') {
            this.elements.status.classList.add('error');
            this.elements.status.classList.add('shake');
            setTimeout(() => {
                this.elements.status.classList.remove('shake');
            }, 500);
        } else if (type === 'warning') {
            this.elements.status.classList.add('warning');
        }
        
        this.elements.status.classList.add('status-enter');
        setTimeout(() => {
            this.elements.status.classList.remove('status-enter');
        }, 300);
        
        if (type === 'success' || type === 'warning') {
            setTimeout(() => {
                if (this.elements.status.classList.contains(type)) {
                    this.elements.status.classList.remove(type);
                }
            }, 3000);
        }
    }
    
    handleKeydown(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case ' ':
                    event.preventDefault();
                    this.togglePlayback();
                    break;
                case 'r':
                    event.preventDefault();
                    if (this.state.hasAudio) {
                        this.startRecording();
                    }
                    break;
                case 's':
                    event.preventDefault();
                    this.showPresetModal();
                    break;
            }
        }
        
        if (event.key === 'Escape') {
            if (this.elements.presetModal.style.display === 'flex') {
                this.hidePresetModal();
            }
        }
    }
    
    handleBeforeUnload(event) {
        if (this.state.isRecording) {
            event.preventDefault();
            event.returnValue = 'Recording in progress. Are you sure you want to leave?';
            return event.returnValue;
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WaveformStudio();
});

// Handle module loading errors
window.addEventListener('error', (event) => {
    if (event.filename && event.filename.includes('.js')) {
        console.error('Module loading error:', event.error);
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; text-align: center; color: var(--text-primary);">
                <h1 style="color: var(--error-color); margin-bottom: 1rem;">Module Loading Error</h1>
                <p style="margin-bottom: 1rem;">Failed to load application modules. Please check your browser console for details.</p>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">This application requires a modern browser with ES6 module support.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Reload Page</button>
            </div>
        `;
    }
});

export default WaveformStudio;