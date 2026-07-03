// Generador de tonos WAV para calibración

class ToneGenerator {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.centerFrequencies = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000]; // Frecuencias principales
    
    // Configurar evento después de carga del DOM
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('generate-tones');
      if (btn) {
        btn.addEventListener('click', () => {
          alert('Iniciando generación de tonos WAV. Se descargarán uno por uno.');
          new ToneGenerator().generateAllTones();
        });
      } else {
        console.error('No se encontró el botón generate-tones');
      }
    });
  }

  async generateAllTones() {
    try {
      document.getElementById('calibration-status').textContent = 'Generando tonos WAV...';
      
      // Mostrar contenedor de progreso
      const progressContainer = document.createElement('div');
      progressContainer.id = 'progress-container';
      progressContainer.style.margin = '10px';
      progressContainer.style.padding = '10px';
      progressContainer.style.border = '1px solid #ddd';
      document.querySelector('.calibration-panel').appendChild(progressContainer);
      
      for (const freq of this.centerFrequencies) {
        progressContainer.innerHTML = `Generando tono de ${freq}Hz...`;
        await this.downloadTone(freq);
        await new Promise(resolve => setTimeout(resolve, 500)); // Esperar entre descargas
      }
      
      progressContainer.innerHTML += '<br>¡Todos los tonos generados!<br>Por favor guárdalos en la carpeta /tones';
      document.getElementById('calibration-status').textContent = 'Tonos generados con éxito';    
    } catch (error) {
      console.error('Error generando tonos:', error);
      alert('Error generando tonos: ' + error.message);
    }
  }

  // Constructor duplicado eliminado

  // Crear buffer de audio WAV
  async generateToneWAV(frequency) {
    return new Promise((resolve) => {
      const duration = 5; // segundos
      const sampleRate = this.audioContext.sampleRate;
      const numChannels = 1;
      
      const buffer = this.audioContext.createBuffer(
        numChannels, 
        sampleRate * duration, 
        sampleRate
      );
      
      // Generar onda senoidal
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.25;
      }
      
      resolve(buffer);
    });
  }

  // Descargar archivo WAV
  async downloadTone(frequency) {
    const buffer = await this.generateToneWAV(frequency);
    const blob = this.bufferToWAV(buffer);
    
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `tono_${frequency}Hz.wav`;
    anchor.click();
  }

  // Convertir buffer a WAV (adaptado de audiobuffer-to-wav)
  bufferToWAV(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferWAV = new ArrayBuffer(length);
    const view = new DataView(bufferWAV);
    
    // Escribir encabezado WAV
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * numOfChan * 2, true);
    
    // Escribir datos de audio
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChan; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(44 + (i * numOfChan + channel) * 2, sample * 0x7FFF, true);
      }
    }
    
    return new Blob([view], { type: 'audio/wav' });
  }
  
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}