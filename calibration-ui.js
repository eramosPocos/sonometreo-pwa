// calibration-ui.js - SISTEMA DE CALIBRACIÓN Y PERFILES
class CalibrationManager {
  constructor() {
    this.calibrationFactors = [];
    this.currentFrequencyIndex = 0;
    this.physBackgroundLevels = [];
    this.lastBgValue = null;
  }

  init() {
    this.centerFrequencies = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
    // Inicializamos vacío. El valor 'null' se reservará exclusivamente para las bandas que se salten
    this.calibrationFactors = new Array(this.centerFrequencies.length);
    this.physBackgroundLevels = Array(this.centerFrequencies.length).fill(null); // al hacrlo así y no así:Array(this.centerFrequencies.length).fill(null), entiendo que queda "undefined"
    this.currentFrequencyIndex = 0;
    window.calibrationFactorsDB = this.calibrationFactors;
  }

  selectFrequency(index) {
    window.currentCalibrationIndex = index;
    this.currentFrequencyIndex = index;
    document.getElementById('current-frequency').textContent = this.centerFrequencies[index] + ' Hz';

    // Mostrar el offset actual en el ajuste fino
    const currentOffset = this.calibrationFactors[index];
    let offsetText = "No calibrada";

    if (currentOffset !== undefined && currentOffset !== null) {
      offsetText = (currentOffset >= 0 ? '+' : '') + currentOffset.toFixed(1) + ' dB';
    } else if (currentOffset === null) {
      offsetText = "Saltada";
    }
    const offsetEl = document.getElementById('current-offset');
    if (offsetEl) offsetEl.textContent = offsetText;

    const bgInput = document.getElementById('bg-input');
    const saveBgBtn = document.getElementById('save-bg-btn');
    const saveCalBtn = document.getElementById('save-calibration');

    // Rellenamos con el último valor como ayuda, PERO no sobrescribimos el fondo de esta banda
    if (this.lastBgValue !== null) {
      bgInput.value = this.lastBgValue;
    }

    // Comprobamos si esta banda en concreto YA tiene su propio fondo guardado
    const hasOwnBackground = this.physBackgroundLevels[index] !== null && this.physBackgroundLevels[index] !== undefined;

    if (hasOwnBackground) {
      // Si ya lo tiene, permitimos calibrar o actualizar fondo
      saveBgBtn.disabled = false;
      saveCalBtn.disabled = false;
      document.getElementById('calibration-status').textContent = `Fondo guardado (${this.physBackgroundLevels[index]} dB). Puede calibrar o actualizar fondo.`;
    } else {
      document.getElementById('calibration-status').textContent = "Paso 1: Mida RUIDO DE FONDO sin tono y guárdelo.";
      saveBgBtn.disabled = false;
      saveCalBtn.disabled = true;
    }
  }

  savePhysBackground(value) {
    const bgDB = parseFloat(value);
    if (isNaN(bgDB)) { alert("Número no válido."); return; }

    this.lastBgValue = bgDB;
    this.physBackgroundLevels[this.currentFrequencyIndex] = bgDB; // Se guarda específico para esta banda

    document.getElementById('calibration-status').textContent = `Fondo actualizado a ${bgDB} dB para ${this.centerFrequencies[this.currentFrequencyIndex]}Hz.`;
    document.getElementById('save-calibration').disabled = false;
  }

  // NUEVO: Método para saltar bandas que el altavoz no puede reproducir
  skipFrequency() {
    const currentIndex = this.currentFrequencyIndex;
    this.calibrationFactors[currentIndex] = null; // Forzamos que no sume
    window.calibrationFactorsDB = this.calibrationFactors;
    console.log(`Banda ${this.centerFrequencies[currentIndex]}Hz saltada (no suma en Global).`);

    // Avanzamos a la siguiente
    if (currentIndex < this.centerFrequencies.length - 1) {
      setTimeout(() => this.selectFrequency(currentIndex + 1), 500);
    } else {
      document.getElementById('calibration-status').textContent = '¡Calibración completada (algunas bandas se saltaron)!';
    }
  }

  applyCalibration(totalValue) {
    const totalDB = parseFloat(totalValue);
    if (isNaN(totalDB)) { alert("Número no válido."); return; }
    const currentIndex = this.currentFrequencyIndex;
    const bgDB = this.physBackgroundLevels[currentIndex];

    if (bgDB === null || bgDB === undefined) {
      alert("Error: Debe guardar el ruido de fondo para esta banda primero.");
      return;
    }

    const energyTotal = Math.pow(10, totalDB / 10);
    const energyBg = Math.pow(10, bgDB / 10);
    if (energyTotal <= energyBg) { alert("Error: El Total debe ser mayor que el Fondo."); return; }

    const energyTone = energyTotal - energyBg;
    const realToneLevelDB = 10 * Math.log10(energyTone);

    // --- LA MAGIA PARA EVITAR EL DOBLE CONTEO ---
    // Leemos lo que marca la PWA (que YA tiene el factor viejo aplicado)
    const pwaReadingWithTone = window.audioProcessor.bandResultsDB[currentIndex];

    // Restamos el factor viejo para obtener el valor CRUDO del micro en este instante
    const oldFactor = (this.calibrationFactors[currentIndex] !== undefined && this.calibrationFactors[currentIndex] !== null) ? this.calibrationFactors[currentIndex] : 0;
    const pwaRawReading = pwaReadingWithTone - oldFactor;

    // Calculamos el nuevo factor
    this.calibrationFactors[currentIndex] = realToneLevelDB - pwaRawReading;
    window.calibrationFactorsDB = this.calibrationFactors;

    // Actualizamos el ajuste fino en pantalla inmediatamente
    const offsetEl = document.getElementById('current-offset');
    if (offsetEl) offsetEl.textContent = (this.calibrationFactors[currentIndex] >= 0 ? '+' : '') + this.calibrationFactors[currentIndex].toFixed(1) + ' dB';

    document.getElementById('calibration-status').textContent = `¡Banda ${this.centerFrequencies[currentIndex]}Hz corregida a ${this.calibrationFactors[currentIndex].toFixed(1)} dB!`;
    document.getElementById('save-calibration').disabled = true;
    document.getElementById('total-input').value = '';

    if (currentIndex < this.centerFrequencies.length - 1) {
      setTimeout(() => this.selectFrequency(currentIndex + 1), 1500);
    } else {
      document.getElementById('calibration-status').textContent = '¡CALIBRACIÓN COMPLETADA! Guarde el perfil abajo.';
    }
  }

  exportCalibration() {
    const profileData = {
      nombreDispositivo: navigator.userAgent.substring(0, 50),
      fechaCreacion: new Date().toLocaleString(),
      frecuencias: this.centerFrequencies,
      factoresCorreccion: this.calibrationFactors,
      globalOffset: window.globalOffsetDB || 0.0  // <-- Guardamos el offset

    };
    const blob = new Blob([JSON.stringify(profileData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    // Generamos un formato de fecha legible: AAAA-MM-DD_HH-MM
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    a.download = `PerfilCalibracion_${fecha}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    document.getElementById('calibration-status').textContent = "¡Perfil descargado!";
  }

  importCalibration(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.frecuencias.length === this.centerFrequencies.length) {
          this.calibrationFactors = data.factoresCorreccion;
          window.calibrationFactorsDB = this.calibrationFactors;

          // NUEVO: Avisar al HTML de que ya hay calibración para que quite el aviso naranja
          if (typeof window.checkCalibrationStatus === 'function') {
            window.checkCalibrationStatus();
          }

          // NUEVO: Recuperar y aplicar el Offset Global
          if (data.globalOffset !== undefined) {
            window.globalOffsetDB = data.globalOffset;
            // Actualizamos la cajita del HTML para que se vea el valor cargado
            document.getElementById('global-offset-input').value = data.globalOffset.toFixed(1);
          }

          document.getElementById('calibration-status').innerHTML = `¡Perfil CARGADO!<br>Origen: ${data.nombreDispositivo}`;
        } else { alert("Archivo no válido."); }
      } catch (error) { alert("Error leyendo JSON."); }
    };
    reader.readAsText(file);
  }
  // NUEVO: Ajuste manual de la banda seleccionada
  manualAdjust(deltaDB) {
    const idx = this.currentFrequencyIndex;

    // Si la banda estaba vacía (undefined) o saltada (null), la inicializamos a 0
    if (this.calibrationFactors[idx] === null || this.calibrationFactors[idx] === undefined) {
      this.calibrationFactors[idx] = 0.0;
    }

    // Aplicamos el ajuste
    this.calibrationFactors[idx] += deltaDB;
    window.calibrationFactorsDB = this.calibrationFactors;

    // Actualizamos la pantalla con el nuevo valor
    const valorActual = this.calibrationFactors[idx];
    document.getElementById('current-offset').textContent = (valorActual >= 0 ? '+' : '') + valorActual.toFixed(1) + ' dB';
    document.getElementById('calibration-status').textContent = `Ajuste manual en ${this.centerFrequencies[idx]}Hz aplicado.`;
  }
  // Función para generar el texto JSON sin forzar la descarga (lo hace el HTML)
  generateJSONString() {
    const profileData = {
      nombreDispositivo: navigator.userAgent.substring(0, 50),
      fechaCreacion: new Date().toLocaleString(),
      frecuencias: this.centerFrequencies,
      factoresCorreccion: this.calibrationFactors,
      globalOffset: window.globalOffsetDB || 0.0
    };
    return JSON.stringify(profileData, null, 2);
  }
}