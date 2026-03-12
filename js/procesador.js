// --- 1. REFERENCIAS AL DOM ---
const elements = {
    inputImage: document.getElementById('input-image'),
    inputAncho: document.getElementById('input-ancho'),
    unitAncho: document.getElementById('unit-ancho'),
    inputAlto: document.getElementById('input-alto'),
    unitAlto: document.getElementById('unit-alto'),
    inputMm: document.getElementById('input-mm-diamante'),
    infoCalculo: document.getElementById('res-calculada'),
    btnGenerar: document.getElementById('btn-generar'),
    checkSimbolos: document.getElementById('check-simbolos'),
    canvasPixelado: document.getElementById('canvas-pixelado'),
    canvasBuffer: document.getElementById('canvas-buffer'),
    resumenMaterial: document.getElementById('resumen-material'),
    qrBuffer: document.getElementById('qrcode-buffer'),
    btnPdf: document.getElementById('btn-descargar-pdf'),
    btnDescargarLienzo: document.getElementById('btn-descargar-lienzo'),
    btnDescargarGuia: document.getElementById('btn-descargar-guia')
};

// --- 2. ESTADO GLOBAL ---
let imagenOriginal = null;
let usoMaterialActual = {};

// --- 3. FUNCIONES DE APOYO (Símbolos y Datos) ---
function obtenerInventarioConSimbolos() {
    const inventario = typeof getInventario === 'function' ? getInventario() : [];
    const simbolosStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$&%*+!?";
    return inventario.map((d, i) => ({
        ...d,
        simbolo: simbolosStr[i % simbolosStr.length]
    }));
}

// --- 4. INICIALIZACIÓN Y EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    elements.inputImage.addEventListener('change', manejarCargaImagen);
    [elements.inputAncho, elements.unitAncho, elements.inputAlto, elements.unitAlto, elements.inputMm]
        .forEach(el => el.addEventListener('input', actualizarInfo));

    elements.btnGenerar.addEventListener('click', procesarLienzo);
    elements.btnDescargarLienzo.addEventListener('click', descargarLienzoPNG);
    elements.btnDescargarGuia.addEventListener('click', descargarGuiaPNG);
    elements.btnPdf.addEventListener('click', descargarPDF);
});

function manejarCargaImagen(e) {
    const reader = new FileReader();
    reader.onload = (f) => {
        imagenOriginal = new Image();
        imagenOriginal.onload = () => {
            elements.btnGenerar.disabled = false;
            if (!elements.inputAncho.value) elements.inputAncho.value = 40;
            actualizarInfo();
        };
        imagenOriginal.src = f.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
}

function actualizarInfo() {
    if (!imagenOriginal) return { dAncho: 0, dAlto: 0 };
    const mm = parseFloat(elements.inputMm.value) || 2.5;
    const getVal = (input, unit) => {
        let val = parseFloat(input.value) || 0;
        return unit.value === 'cm' ? Math.round((val * 10) / mm) : parseInt(val);
    };
    let dAncho = getVal(elements.inputAncho, elements.unitAncho);
    let dAlto = getVal(elements.inputAlto, elements.unitAlto);
    if (dAncho > 0 && !elements.inputAlto.value) {
        const escala = imagenOriginal.height / imagenOriginal.width;
        dAlto = Math.round(dAncho * escala);
    }
    elements.infoCalculo.textContent = `${dAncho || 0} x ${dAlto || 0}`;
    return { dAncho, dAlto };
}

// --- 5. NÚCLEO DEL PROCESAMIENTO ---
let escalaActual = 1;

function cambiarZoom(delta) {
    escalaActual += delta;
    escalaActual = Math.min(Math.max(0.2, escalaActual), 3);
    aplicarZoom();
}

function resetZoom() {
    escalaActual = 1;
    aplicarZoom();
}

function aplicarZoom() {
    const canvas = document.getElementById('canvas-pixelado');
    canvas.style.transform = `scale(${escalaActual})`;
    document.getElementById('zoom-nivel').textContent = `${Math.round(escalaActual * 100)}%`;
    const container = document.getElementById('canvas-resultado');
    const heightExtra = (canvas.height * escalaActual) - canvas.height;
    canvas.style.marginBottom = heightExtra > 0 ? `${heightExtra}px` : '0';
}

function procesarLienzo() {
    const inventario = obtenerInventarioConSimbolos();
    const { dAncho, dAlto } = actualizarInfo();
    const mostrarSimbolos = elements.checkSimbolos.checked;

    if (!dAncho || !dAlto) return alert("Define el tamaño.");
    if (inventario.length === 0) return alert("Añade colores al stock primero.");

    elements.canvasBuffer.width = dAncho;
    elements.canvasBuffer.height = dAlto;
    const ctxB = elements.canvasBuffer.getContext('2d', { willReadFrequently: true });
    ctxB.drawImage(imagenOriginal, 0, 0, dAncho, dAlto);
    const pixels = ctxB.getImageData(0, 0, dAncho, dAlto).data;

    const cellSize = window.innerWidth < 500 ? 12 : 20;
    elements.canvasPixelado.width = dAncho * cellSize;
    elements.canvasPixelado.height = dAlto * cellSize;
    const ctxF = elements.canvasPixelado.getContext('2d');

    usoMaterialActual = {};

    for (let y = 0; y < dAlto; y++) {
        for (let x = 0; x < dAncho; x++) {
            const i = (y * dAncho + x) * 4;
            const rgb = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };

            let mejorMatch = inventario[0];
            let distMin = Infinity;
            inventario.forEach(diam => {
                const d = Math.sqrt(Math.pow(rgb.r - diam.rgb.r, 2) + Math.pow(rgb.g - diam.rgb.g, 2) + Math.pow(rgb.b - diam.rgb.b, 2));
                if (d < distMin) { distMin = d; mejorMatch = diam; }
            });

            ctxF.fillStyle = mejorMatch.hex;
            ctxF.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

            if (mostrarSimbolos) {
                const brillo = (mejorMatch.rgb.r * 299 + mejorMatch.rgb.g * 587 + mejorMatch.rgb.b * 114) / 1000;
                ctxF.fillStyle = brillo > 128 ? 'black' : 'white';
                ctxF.font = `bold ${cellSize * 0.6}px Arial`;
                ctxF.textAlign = "center";
                ctxF.textBaseline = "middle";
                ctxF.fillText(mejorMatch.simbolo, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
            }

            ctxF.strokeStyle = "rgba(0,0,0,0.1)";
            ctxF.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);

            const idKey = String(mejorMatch.id);
            usoMaterialActual[idKey] = (usoMaterialActual[idKey] || 0) + 1;
        }
    }

    document.getElementById('resultado-container').style.display = 'block';
    document.getElementById('acciones-exportar').style.display = 'block';
    renderResumen(usoMaterialActual, inventario);
}

function renderResumen(uso, inventario) {
    elements.resumenMaterial.innerHTML = "";
    
    Object.keys(uso).sort((a, b) => uso[b] - uso[a]).forEach(id => {
        const d = inventario.find(diam => String(diam.id).trim() === String(id).trim());
        if (!d) return;

        const cantidadNecesaria = uso[id];
        
        // 1. Lógica de Infinito mejorada
        const esInfinito = String(d.cantidad).toLowerCase().includes('infinito');
        const cantidadEnStock = esInfinito ? Infinity : (parseInt(d.cantidad) || 0);
        const faltaStock = !esInfinito && (cantidadEnStock < cantidadNecesaria);

        const item = document.createElement('div');
        
        item.className = `list-group-item d-flex align-items-center justify-content-between small ${faltaStock ? 'border-danger border-1 bg-danger-subtle bg-opacity-10' : ''}`;
        
        if (faltaStock) {
            item.style.zIndex = "1"; 
        }

        item.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1">
                <div class="fw-bold me-2 border text-center" style="width:24px; min-width:24px; background:#f8f9fa;">${d.simbolo}</div>
                <div class="color-circle me-2" style="background-color: ${d.hex}; width:15px; height:15px; min-width:15px; border-radius:50%; border:1px solid #ccc"></div>
                <div class="d-flex flex-column">
                    <span class="fw-semibold">${d.nombre}</span>
                    ${faltaStock 
                        ? `<small class="text-danger fw-bold" style="font-size: 0.75rem;">⚠️ Faltan ${cantidadNecesaria - cantidadEnStock} unidades</small>` 
                        : `<small class="text-muted" style="font-size: 0.7rem;">Stock: ${esInfinito ? '∞' : cantidadEnStock}</small>`
                    }
                </div>
            </div>
            <span class="badge ${faltaStock ? 'bg-danger' : 'bg-secondary'} rounded-pill ms-2">
                ${cantidadNecesaria} uds
            </span>`;
            
        elements.resumenMaterial.appendChild(item);
    });
}

// --- 6. EXPORTACIÓN ---
function descargarLienzoPNG() {
    const link = document.createElement('a');
    link.download = `${CONFIG_PROYECTO.nombreBaseArchivos}-lienzo.png`;
    link.href = elements.canvasPixelado.toDataURL('image/png');
    link.click();
}

async function descargarGuiaPNG() {
    const inventario = obtenerInventarioConSimbolos();
    const IDsEnUso = Object.keys(usoMaterialActual);
    if (!IDsEnUso.length) return alert("Genera el lienzo primero");

    elements.qrBuffer.innerHTML = "";
    new QRCode(elements.qrBuffer, {
        text: CONFIG_PROYECTO.urlWeb,
        width: 150, height: 150
    });

    await new Promise(r => setTimeout(r, 300));
    const qrImage = elements.qrBuffer.querySelector('img');

    const canvasGuia = document.createElement('canvas');
    const ctx = canvasGuia.getContext('2d');
    const ancho = 600;
    const padding = 30;
    const altoLinea = 45;
    const altoFinal = 150 + (IDsEnUso.length * altoLinea) + 200;

    canvasGuia.width = ancho;
    canvasGuia.height = altoFinal;

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, ancho, altoFinal);
    ctx.fillStyle = "#212529"; ctx.fillRect(0, 0, ancho, 100);
    ctx.fillStyle = "white"; ctx.font = "bold 24px Arial";
    ctx.fillText("GUÍA DE COLOR Y SÍMBOLOS", padding, 60);

    IDsEnUso.sort((a, b) => usoMaterialActual[b] - usoMaterialActual[a]).forEach((id, i) => {
        const d = inventario.find(diam => String(diam.id).trim() === String(id).trim());
        const nombreColor = d ? (d.nombre || "Color " + id) : "Desconocido (" + id + ")";
        const simboloColor = d ? d.simbolo : "?";
        const hexColor = d ? d.hex : "#cccccc";
        const y = 140 + (i * altoLinea);

        if (i % 2 === 0) {
            ctx.fillStyle = "#f8f9fa";
            ctx.fillRect(padding, y - 30, ancho - (padding * 2), altoLinea);
        }

        ctx.fillStyle = "#333";
        ctx.font = "bold 18px Courier New";
        ctx.fillText(`[${simboloColor}]`, padding + 10, y);

        ctx.beginPath();
        ctx.arc(padding + 85, y - 6, 12, 0, Math.PI * 2);
        ctx.fillStyle = hexColor;
        ctx.fill();
        ctx.strokeStyle = "#dee2e6";
        ctx.stroke();

        ctx.fillStyle = "#212529";
        ctx.font = "15px Arial";
        ctx.fillText(nombreColor, padding + 120, y);

        ctx.textAlign = "right";
        ctx.font = "bold 15px Arial";
        ctx.fillText(`${usoMaterialActual[id]} uds`, ancho - padding - 15, y);
        ctx.textAlign = "left";
    });

    const yPie = altoFinal - 160;
    if (qrImage) ctx.drawImage(qrImage, ancho - 150 - padding, yPie, 140, 140);
    
    ctx.fillStyle = "#495057"; ctx.font = "bold 16px Arial";
    ctx.fillText("ESCANEAME!!", padding, yPie + 40);
    ctx.font = "12px Arial"; ctx.fillStyle = "#6c757d";
    ctx.fillText("Link directo:", padding, yPie + 65);
    ctx.fillStyle = "#0d6efd";
    ctx.fillText(CONFIG_PROYECTO.urlWeb.substring(0, 50), padding, yPie + 85);

    const link = document.createElement('a');
    link.download = `${CONFIG_PROYECTO.nombreBaseArchivos}-guia.png`;
    link.href = canvasGuia.toDataURL('image/png');
    link.click();
}

async function descargarPDF() {
    const { jsPDF } = window.jspdf;

    const mmPorDiamante = parseFloat(elements.inputMm.value) || 2.5;
    const { dAncho, dAlto } = actualizarInfo();
    const anchoRealMm = dAncho * mmPorDiamante;
    const altoRealMm = dAlto * mmPorDiamante;
    const margen = 10;

    elements.qrBuffer.innerHTML = "";
    new QRCode(elements.qrBuffer, {
        text: CONFIG_PROYECTO.urlWeb,
        width: 150, height: 150
    });
    await new Promise(r => setTimeout(r, 350));

    const doc = new jsPDF({
        orientation: anchoRealMm > altoRealMm ? "l" : "p",
        unit: "mm",
        format: [anchoRealMm + (margen * 2), altoRealMm + (margen * 2)]
    });

    const imgData = elements.canvasPixelado.toDataURL('image/jpeg', 0.95);

    doc.setFontSize(14);
    doc.text("Diamond Studio - Diseño a Escala Real", margen, 8);
    doc.addImage(imgData, 'JPEG', margen, 10, anchoRealMm, altoRealMm);

    doc.addPage();
    await agregarPaginaMateriales(doc, margen);

    doc.save(`proyecto-real-${anchoRealMm}x${altoRealMm}mm.pdf`);
}

async function agregarPaginaMateriales(doc, margen) {
    const inventario = obtenerInventarioConSimbolos();
    const IDsEnUso = Object.keys(usoMaterialActual).sort((a, b) => usoMaterialActual[b] - usoMaterialActual[a]);

    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("GUÍA DE MATERIALES Y COLORES", margen, 20);
    const qrImage = elements.qrBuffer.querySelector('img');
    if (qrImage) {
        const qrSize = 20; 
        const paddingInterno = 3;
        const altoExtraTexto = 5;
        
        const contenedorAncho = qrSize + (paddingInterno * 2);
        const contenedorAlto = qrSize + paddingInterno + altoExtraTexto;
        
        const xContenedor = doc.internal.pageSize.getWidth() - margen - contenedorAncho;
        const yContenedor = 4;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(xContenedor, yContenedor, contenedorAncho, contenedorAlto, 1, 1, 'F'); 
        
        doc.addImage(qrImage, 'PNG', xContenedor + paddingInterno, yContenedor + paddingInterno, qrSize, qrSize);
        
        doc.setFontSize(6);
        doc.setTextColor(33, 37, 41);
        doc.setFont("helvetica", "bold");
        doc.text("¡ESCANÉAME!", xContenedor + (contenedorAncho / 2), yContenedor + qrSize + paddingInterno + 3, { align: "center" });
    }

    // 3. Tabla de materiales
    let y = 45;
    const altoLinea = 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.text("SIMB.", margen, y);
    doc.text("COLOR / NOMBRE", margen + 20, y);
    doc.text("CANTIDAD", doc.internal.pageSize.getWidth() - margen - 5, y, { align: "right" });

    y += 5;
    doc.setDrawColor(200);
    doc.line(margen, y, doc.internal.pageSize.getWidth() - margen, y);
    y += 8;

    doc.setFont("helvetica", "normal");

    IDsEnUso.forEach((id, index) => {
        const d = inventario.find(diam => String(diam.id).trim() === String(id).trim());
        if (!d) return;

        if (y > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
        }

        if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margen - 2, y - 6, doc.internal.pageSize.getWidth() - (margen * 2) + 4, altoLinea, 'F');
        }

        doc.setFont("courier", "bold");
        doc.text(`[${d.simbolo}]`, margen, y);

        doc.setFillColor(d.hex);
        doc.setDrawColor(180);
        doc.circle(margen + 23, y - 1.5, 3, 'FD');

        doc.setFont("helvetica", "normal");
        doc.text(d.nombre || `ID: ${id}`, margen + 30, y);

        doc.setFont("helvetica", "bold");
        doc.text(`${usoMaterialActual[id]} uds`, doc.internal.pageSize.getWidth() - margen - 5, y, { align: "right" });

        y += altoLinea;
    });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Proyecto generado por Diamond Studio - Escala Real`, margen, doc.internal.pageSize.getHeight() - 10);
}