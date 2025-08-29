
class Visualizers {
    constructor() {
        this.barHeights = [];
        this.barDecayFactor = 0.85;
        this.barAttackFactor = 0.6;
    }
    
    renderFrame(ctx, width, height, settings, audioTime, audioAnalysis, audioData) {
        const {
            style,
            opacityMode,
            dotSize,
            dotSpacing,
            dotColor,
            bgColor,
            amplitude,
            windowSize
        } = settings;
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        
        const dotColorRgb = this.hexToRgb(dotColor);
        const bgColorRgb = this.hexToRgb(bgColor);
        
        switch (style) {
            case 'scrolling':
                this.renderScrollingWaveform(ctx, width, height, settings, audioTime, audioData, dotColorRgb, bgColorRgb);
                break;
            case 'breathing':
                this.renderBreathingWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb);
                break;
            case 'radial':
                this.renderRadialWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb);
                break;
            case 'bars':
                this.renderBarsWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb);
                break;
            default:
                this.renderScrollingWaveform(ctx, width, height, settings, audioTime, audioData, dotColorRgb, bgColorRgb);
        }
    }
    
    renderScrollingWaveform(ctx, width, height, settings, audioTime, audioData, dotColorRgb, bgColorRgb) {
        const { dotSize, dotSpacing, amplitude, windowSize, opacityMode } = settings;
        const centerY = height / 2;
        const maxHeight = (height * amplitude) / 200; // Convert percentage to pixels
        
        if (!audioData || !audioData.monoData) {
            return;
        }
        
        const middleDotSize = dotSize * 0.6;
        const middleColor = `rgba(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b}, 0.3)`;
        
        for (let x = dotSpacing / 2; x < width; x += dotSpacing * 1.5) {
            this.drawDot(ctx, x, centerY, middleDotSize, middleColor);
        }
        
        for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
            const timeOffset = (x / width) * windowSize - windowSize / 2;
            const sampleTime = audioTime + timeOffset;
            
            let amplitudeValue = 0;
            if (sampleTime >= 0 && sampleTime < audioData.duration) {
                const sampleIndex = Math.floor(sampleTime * audioData.sampleRate);
                if (sampleIndex < audioData.monoData.length) {
                    amplitudeValue = Math.abs(audioData.monoData[sampleIndex]);
                }
            }
            
            let centerColor, dotColor;
            if (opacityMode !== 'uniform') {
                const baseOpacity = 0.5;
                const isRandomPeak = this.getSeededRandom(sampleTime * 50) < 0.25;
                const centerOpacity = isRandomPeak ? 1.0 : Math.min(1.0, baseOpacity + amplitudeValue * 0.5);
                
                const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                centerColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, centerOpacity, levels);
            } else {
                centerColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
            }
            
            this.drawDot(ctx, x, centerY, dotSize, centerColor);
            
            const actualSpacing = Math.max(dotSpacing, dotSize + 1); // Ensure minimum spacing
            const maxDotsPerColumn = Math.floor(maxHeight / actualSpacing);
            const amplitudeDotsCount = Math.floor(amplitudeValue * maxDotsPerColumn);
            
            for (let i = 0; i < amplitudeDotsCount; i++) {
                const dotOffset = (i + 1) * actualSpacing;
                const yUp = centerY - dotOffset;
                const yDown = centerY + dotOffset;
                
                if (opacityMode !== 'uniform') {
                    const isBrightSpot = this.getSeededRandom((sampleTime + i * 0.1) * 1000) < 0.18;
                    let dotOpacity;
                    
                    if (isBrightSpot) {
                        dotOpacity = 1.0;
                    } else {
                        const distanceFactor = amplitudeDotsCount > 0 ? 1.0 - (i / amplitudeDotsCount) : 1.0;
                        dotOpacity = Math.max(0.3, distanceFactor * 0.8);
                    }
                    
                    const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                    dotColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, dotOpacity, levels);
                } else {
                    dotColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
                }
                
                if (yUp >= 0) {
                    this.drawDot(ctx, x, yUp, dotSize, dotColor);
                }
                if (yDown < height) {
                    this.drawDot(ctx, x, yDown, dotSize, dotColor);
                }
            }
        }
    }
    
    renderBreathingWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb) {
        const { dotSize, dotSpacing, amplitude, opacityMode } = settings;
        const centerY = height / 2;
        const maxHeight = (height * amplitude) / 200;
        
        const rms = audioAnalysis?.rms || 0;
        
        let finalDotColor;
        if (opacityMode === '5_levels' || opacityMode === '10_levels') {
            const levels = opacityMode === '5_levels' ? 5 : 10;
            finalDotColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, rms, levels);
            
            if (opacityMode !== '10_levels' && this.colorsEqual(finalDotColor, bgColorRgb)) {
                return;
            }
        } else {
            finalDotColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
        }
        
        for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
            const currentHeight = rms * maxHeight;
            const actualSpacing = Math.max(dotSpacing, dotSize + 1);
            const dotsCount = Math.floor(currentHeight / actualSpacing);
            
            for (let j = 0; j < dotsCount; j++) {
                const yUp = centerY - (j + 1) * actualSpacing;
                const yDown = centerY + (j + 1) * actualSpacing;
                
                if (yUp >= 0) {
                    this.drawDot(ctx, x, yUp, dotSize, finalDotColor);
                }
                if (yDown < height) {
                    this.drawDot(ctx, x, yDown, dotSize, finalDotColor);
                }
            }
        }
    }
    
    renderRadialWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb) {
        const { dotSize, dotSpacing, amplitude, opacityMode } = settings;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxPossibleRadius = Math.min(width, height) / 2;
        const maxRadius = maxPossibleRadius * (amplitude / 100);
        
        const rms = audioAnalysis?.rms || 0;
        const actualSpacing = Math.max(dotSpacing, dotSize + 1);
        const ringCount = Math.floor(rms * maxRadius / actualSpacing);
        
        for (let ring = 0; ring < ringCount; ring++) {
            const radius = ring * actualSpacing;
            const circumference = 2 * Math.PI * radius;
            const dotsInRing = Math.max(1, Math.floor(circumference / actualSpacing));
            
            let discreteColor;
            if (opacityMode !== 'uniform') {
                const ringFade = ringCount > 0 ? 1.0 - ring / ringCount : 1.0;
                const ringOpacity = rms * ringFade;
                const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                discreteColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, ringOpacity, levels);
                
                // Only draw if visible or in 10-level mode
                if (opacityMode !== '10_levels' && this.colorsEqual(discreteColor, bgColorRgb)) {
                    continue;
                }
            } else {
                discreteColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
            }
            
            for (let i = 0; i < dotsInRing; i++) {
                const angle = (2 * Math.PI * i) / dotsInRing;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    this.drawDot(ctx, x, y, dotSize, discreteColor);
                }
            }
        }
    }
    
    renderBarsWaveform(ctx, width, height, settings, audioAnalysis, dotColorRgb, bgColorRgb) {
        const { dotSize, dotSpacing, amplitude, opacityMode } = settings;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxVisHeight = (height * amplitude) / 200;
        const actualSpacing = Math.max(dotSpacing, dotSize + 1);
        const numBars = Math.floor(width / actualSpacing);
        const halfBars = Math.floor(numBars / 2);
        
        if (this.barHeights.length !== numBars) {
            this.barHeights = new Array(numBars).fill(0);
        }
        
        const currentAmplitude = audioAnalysis?.rms || 0;
        
        for (let i = 0; i < numBars; i++) {
            const x = i * actualSpacing + actualSpacing / 2;
            
            const distanceFromCenter = halfBars > 0 ? Math.abs(i - halfBars) / halfBars : 0;
            const bellCurve = Math.exp(-4 * distanceFromCenter * distanceFromCenter);
            
            const heightBoost = 1.0 + (amplitude / 100.0);
            const targetAmplitude = currentAmplitude * bellCurve * heightBoost;
            
            if (targetAmplitude > this.barHeights[i]) {
                this.barHeights[i] = this.barHeights[i] * this.barAttackFactor + targetAmplitude * (1 - this.barAttackFactor);
            } else {
                this.barHeights[i] *= this.barDecayFactor;
            }
            
            const barHeight = Math.floor(this.barHeights[i] * maxVisHeight);
            
            let barColor;
            if (opacityMode !== 'uniform') {
                const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                barColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, this.barHeights[i], levels);
            } else {
                barColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
            }
            
            if (barHeight > 0) {
                const yStart = centerY - barHeight / 2;
                const yEnd = centerY + barHeight / 2;
                
                if (typeof barColor === 'string' && barColor.startsWith('rgb')) {
                    ctx.fillStyle = barColor;
                    ctx.fillRect(x - dotSize / 2, yStart, dotSize, yEnd - yStart);
                }
            }
        }
    }
    
    drawDot(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    hexToRgb(hex) {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 210, b: 255 };
    }
    
    getDiscreteOpacityColor(baseColor, bgColor, amplitude, levels) {
        let opacity;
        
        if (levels === 3) {
            if (amplitude <= 0.15) {
                opacity = 0.0;
            } else if (amplitude <= 0.65) {
                opacity = 0.5;
            } else {
                opacity = 1.0;
            }
        } else if (levels === 5) {
            if (amplitude <= 0.05) {
                opacity = 0.0;
            } else if (amplitude <= 0.25) {
                opacity = 0.25;
            } else if (amplitude <= 0.5) {
                opacity = 0.5;
            } else if (amplitude <= 0.75) {
                opacity = 0.75;
            } else {
                opacity = 1.0;
            }
        } else { // 10 levels
            if (amplitude <= 0.1) {
                opacity = 0.1;
            } else if (amplitude <= 0.2) {
                opacity = 0.2;
            } else if (amplitude <= 0.3) {
                opacity = 0.3;
            } else if (amplitude <= 0.4) {
                opacity = 0.4;
            } else if (amplitude <= 0.5) {
                opacity = 0.5;
            } else if (amplitude <= 0.6) {
                opacity = 0.6;
            } else if (amplitude <= 0.7) {
                opacity = 0.7;
            } else if (amplitude <= 0.8) {
                opacity = 0.8;
            } else if (amplitude <= 0.9) {
                opacity = 0.9;
            } else {
                opacity = 1.0;
            }
        }
        
        if (levels === 10 && opacity < 0.1) {
            opacity = 0.1;
        }
        
        if (opacity <= 0.0) {
            return `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
        } else {
            const r = Math.round(bgColor.r * (1 - opacity) + baseColor.r * opacity);
            const g = Math.round(bgColor.g * (1 - opacity) + baseColor.g * opacity);
            const b = Math.round(bgColor.b * (1 - opacity) + baseColor.b * opacity);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    
    colorsEqual(color1, color2) {
        if (typeof color1 === 'string' && color1.startsWith('rgb')) {
            // Extract RGB values from string
            const rgb1Match = color1.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (!rgb1Match) return false;
            
            const rgb1 = {
                r: parseInt(rgb1Match[1]),
                g: parseInt(rgb1Match[2]),
                b: parseInt(rgb1Match[3])
            };
            
            return rgb1.r === color2.r && rgb1.g === color2.g && rgb1.b === color2.b;
        }
        
        return false;
    }
    
    getSeededRandom(seed) {
            const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    generatePreview(ctx, width, height, settings) {
        const {
            style,
            opacityMode,
            dotSize,
            dotSpacing,
            dotColor,
            bgColor,
            amplitude,
            windowSize
        } = settings;
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        
        const dotColorRgb = this.hexToRgb(dotColor);
        const bgColorRgb = this.hexToRgb(bgColor);
        const centerY = height / 2;
        const maxHeight = (height * amplitude) / 200;
        
        if (style === 'scrolling') {
            for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
                const normalizedX = x / width;
                const fakeAmplitude = 0.3 + 0.7 * Math.abs(Math.sin(normalizedX * Math.PI * 3));
                
                let centerColor;
                if (opacityMode !== 'uniform') {
                    const isRandomPeak = this.getSeededRandom(x) < 0.15;
                    const centerOpacity = isRandomPeak ? 1.0 : 0.5 + fakeAmplitude * 0.3;
                    const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                    centerColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, centerOpacity, levels);
                } else {
                    centerColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
                }
                
                this.drawDot(ctx, x, centerY, dotSize, centerColor);
                
                const maxDotsPerColumn = Math.floor(maxHeight / dotSpacing);
                for (let i = 0; i < maxDotsPerColumn; i++) {
                    const yUp = centerY - (i + 1) * dotSpacing;
                    const yDown = centerY + (i + 1) * dotSpacing;
                    
                    const threshold = (i + 1) / maxDotsPerColumn;
                    if (fakeAmplitude >= threshold) {
                        let dotColor;
                        if (opacityMode !== 'uniform') {
                            const excess = threshold < 1.0 ? (fakeAmplitude - threshold) / (1.0 - threshold) : 1.0;
                            const dotOpacity = Math.max(0.1, excess);
                            const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                            dotColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, dotOpacity, levels);
                        } else {
                            dotColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
                        }
                        
                        if (yUp >= 0) {
                            this.drawDot(ctx, x, yUp, dotSize, dotColor);
                        }
                        if (yDown < height) {
                            this.drawDot(ctx, x, yDown, dotSize, dotColor);
                        }
                    }
                }
            }
        } else if (style === 'breathing') {
            const fakeAmplitude = 0.6;
            
            let previewColor;
            if (opacityMode === '5_levels' || opacityMode === '10_levels') {
                const levels = opacityMode === '5_levels' ? 5 : 10;
                previewColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, fakeAmplitude, levels);
            } else {
                previewColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
            }
            
            for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
                const currentHeight = fakeAmplitude * maxHeight;
                const dotsCount = Math.floor(currentHeight / dotSpacing);
                
                for (let j = 0; j < dotsCount; j++) {
                    const yUp = centerY - (j + 1) * dotSpacing;
                    const yDown = centerY + (j + 1) * dotSpacing;
                    
                    if (yUp >= 0) {
                        this.drawDot(ctx, x, yUp, dotSize, previewColor);
                    }
                    if (yDown < height) {
                        this.drawDot(ctx, x, yDown, dotSize, previewColor);
                    }
                }
            }
        } else if (style === 'bars') {
            const fakeAmplitude = 0.7;
            const numBars = Math.floor(width / dotSpacing);
            const halfBars = Math.floor(numBars / 2);
            
            for (let i = 0; i < numBars; i++) {
                const x = i * dotSpacing + dotSpacing / 2;
                const distanceFromCenter = halfBars > 0 ? Math.abs(i - halfBars) / halfBars : 0;
                const bellCurve = Math.exp(-4 * distanceFromCenter * distanceFromCenter);
                const heightBoost = 1.0 + (amplitude / 100.0);
                const barAmplitude = fakeAmplitude * bellCurve * heightBoost;
                
                const barHeight = Math.floor(barAmplitude * maxHeight);
                
                let barColor;
                if (opacityMode !== 'uniform') {
                    const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                    barColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, barAmplitude, levels);
                } else {
                    barColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
                }
                
                const yStart = centerY - barHeight / 2;
                const yEnd = centerY + barHeight / 2;
                
                if (barHeight > 0) {
                    ctx.fillStyle = barColor;
                    ctx.fillRect(x - dotSize / 2, yStart, dotSize, yEnd - yStart);
                }
            }
        } else {
            const centerX = width / 2;
            const maxPossibleRadius = Math.min(width, height) / 2;
            const maxRadius = maxPossibleRadius * (amplitude / 100);
            const fakeAmplitude = 0.7;
            const ringCount = Math.floor(fakeAmplitude * maxRadius / dotSpacing);
            
            for (let ring = 0; ring < ringCount; ring++) {
                const radius = ring * dotSpacing;
                const circumference = 2 * Math.PI * radius;
                const dotsInRing = Math.max(1, Math.floor(circumference / dotSpacing));
                
                let discreteColor;
                if (opacityMode !== 'uniform') {
                    const ringFade = ringCount > 0 ? 1.0 - ring / ringCount : 1.0;
                    const ringOpacity = fakeAmplitude * ringFade;
                    const levels = opacityMode === '3_levels' ? 3 : (opacityMode === '5_levels' ? 5 : 10);
                    discreteColor = this.getDiscreteOpacityColor(dotColorRgb, bgColorRgb, ringOpacity, levels);
                } else {
                    discreteColor = `rgb(${dotColorRgb.r}, ${dotColorRgb.g}, ${dotColorRgb.b})`;
                }
                
                for (let i = 0; i < dotsInRing; i++) {
                    const angle = (2 * Math.PI * i) / dotsInRing;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        this.drawDot(ctx, x, y, dotSize, discreteColor);
                    }
                }
            }
        }
    }
}

export default Visualizers;