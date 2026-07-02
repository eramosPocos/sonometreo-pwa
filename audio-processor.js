// audio-processor.js - MOTOR DE AUDIO Y MATEMÁTICAS DEFINITIVO (dBC en barras, dBA en Global)

window.audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Fórmula estándar IEC 61672 para Ponderación 'A'
function getAWeighting(f) {
    const f2 = f * f;
    const ra = (12194 * 12194 * f2 * f2) / (
        (f2 + 20.6 * 20.6) * 
        Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * 
        (f2 + 12194 * 12194)
    );
    return 20 * Math.log10(ra) + 2.00; 
}

// Fórmula estándar IEC 61672 para Ponderación 'C'
function getCWeighting(f) {
    const f2 = f * f;
    const rc = (12194 * 12194 * f2) / ((f2 + 20.6 * 20.6) * (f2 + 12194 * 12194));
    return 20 * Math.log10(rc) + 0.06; 
}

window.startMicrophone = function() {
    if (window.audioContext.state === 'suspended') window.audioContext.resume();
    window.currentCalibrationIndex = 0; // Valor por defecto para el selector de gráfica

    const centerFrequencies = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
    let calibrationOffsetDB = 100; // Offset para ver dB SPL

    window.audioProcessor = {
        bandResultsDB: new Array(centerFrequencies.length).fill(0),
        globalDBA: 0,
        centerFrequencies: centerFrequencies
    };

    // PEDIMOS AUDIO RAW DESACTIVANDO EL AGC
    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false 
        } 
    })
    .then(stream => {
        const microphone = window.audioContext.createMediaStreamSource(stream);
        const analyzer = window.audioContext.createAnalyser();
        analyzer.fftSize = 8192; 
        analyzer.smoothingTimeConstant = 0.3;
        microphone.connect(analyzer);
        
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        const sampleRate = window.audioContext.sampleRate;
        
        function processAudio() {
            analyzer.getFloatFrequencyData(dataArray);
            
            const bandEnergy = new Array(centerFrequencies.length).fill(0);
            const bandCounts = new Array(centerFrequencies.length).fill(0);
            let totalAWeightedEnergy = 0; 
            
            for(let i = 0; i < bufferLength; i++) {
                const freq = (i * sampleRate) / analyzer.fftSize;
                centerFrequencies.forEach((cf, bandIndex) => {
                    const lower = cf / Math.pow(2, 1/6);
                    const upper = cf * Math.pow(2, 1/6);
                    
                    if(freq >= lower && freq <= upper) {
                        const linearPower = Math.pow(10, dataArray[i] / 10);
                        bandEnergy[bandIndex] += linearPower;
                        bandCounts[bandIndex]++;
                    }
                });
            }
            
            centerFrequencies.forEach((cf, i) => {
                if (bandCounts[i] > 0) {
                    const avgPower = bandEnergy[i] / bandCounts[i];
                    let dbValue = 10 * Math.log10(avgPower) + calibrationOffsetDB;
                    
                    let isSkipped = false; 
                    
                    // Comprobamos la calibración
                    if (window.calibrationFactorsDB && window.calibrationFactorsDB[i] !== undefined) {
                        if (window.calibrationFactorsDB[i] === null) {
                            isSkipped = true; 
                        } else {
                            dbValue += window.calibrationFactorsDB[i]; // Aplicamos corrección (Hecha en dBC)
                        }
                    }
                    
                    // APLICAMOS LA CURVA 'C' A LA BARRA VISUAL
                    const displayDBC = dbValue + getCWeighting(cf);
                    window.audioProcessor.bandResultsDB[i] = displayDBC;
                    
                    // Sumamos al Global dBA solo si NO se saltó
                    if (!isSkipped) {
                        // Matemática limpia: Usamos el lineal + Curva A para el Global
                        const linearPower = Math.pow(10, (dbValue + getAWeighting(cf)) / 10);
                        totalAWeightedEnergy += linearPower;
                    }
                } else {
                    window.audioProcessor.bandResultsDB[i] = -Infinity;
                }
            });
            
            // Calcular el Global dBA final
            window.audioProcessor.globalDBA = 10 * Math.log10(totalAWeightedEnergy);

            // --- VISUALIZACIÓN ---
            const canvas = document.getElementById('visualizer');
            if(canvas) {
                const ctx = canvas.getContext('2d');
                const w = canvas.width;
                const h = canvas.height;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.fillRect(0, 0, w, h);
                const barWidth = w / centerFrequencies.length;
                const minDB = 30;
                const maxDB = 100;
                
                // Dibujar líneas guías
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.font = '10px monospace';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'left';
                for(let db = 40; db <= 90; db += 10) {
                    const y = h - ((db - minDB) / (maxDB - minDB)) * h;
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                    ctx.fillText(db, 2, y - 3);
                }
                
                // Dibujar las barras
                centerFrequencies.forEach((cf, i) => {
                    let db = window.audioProcessor.bandResultsDB[i];
                    if(!isFinite(db)) db = minDB; 
                    if(db < minDB) db = minDB;
                    if(db > maxDB) db = maxDB;
                    const barHeight = ((db - minDB) / (maxDB - minDB)) * h;
                    
                    let color = db < 60 ? '#00ff00' : db < 80 ? '#ffff00' : db < 90 ? '#ff8800' : '#ff0000';
                    ctx.fillStyle = color;
                    ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
                    
                    // INDICADOR DE BANDA SELECCIONADA
                    const isSelected = (i === window.currentCalibrationIndex);
                    if (isSelected) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        const centerX = (i * barWidth) + ((barWidth - 1) / 2);
                        ctx.moveTo(centerX - 5, h);
                        ctx.lineTo(centerX + 5, h);
                        ctx.lineTo(centerX, h - 8);
                        ctx.closePath();
                        ctx.fill();
                    }
                    
                    // Números dB
                    if (barHeight > 20) {
                        ctx.save();
                        ctx.fillStyle = isSelected ? '#ffffff' : '#cccccc';
                        ctx.font = 'bold 7px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(db.toFixed(1), (i * barWidth) + (barWidth / 2), h - barHeight - 3);
                        ctx.restore();
                    }
                });
                
                // Etiquetas del eje X
                ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 9px Arial';
                ctx.fillText('20', (0 * barWidth) + (barWidth/2), h - 2);
                ctx.fillText('20k', ((centerFrequencies.length - 1) * barWidth) + (barWidth/2), h - 2);
                ctx.font = '8px Arial'; ctx.fillStyle = '#aaa';
                [100, 200, 500, 1000, 2000, 5000, 10000].forEach(freq => {
                    const index = centerFrequencies.indexOf(freq);
                    if(index !== -1) {
                         const label = freq >= 1000 ? (freq/1000) + 'k' : freq;
                         ctx.fillText(label, (index * barWidth) + (barWidth/2), h - 2);
                    }
                });
            }
            requestAnimationFrame(processAudio);
        }
        processAudio();
    })
    .catch(err => console.error('Error al acceder al micrófono:', err));
};