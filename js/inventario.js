document.addEventListener('DOMContentLoaded', renderizarTabla);

document.getElementById('form-diamante').addEventListener('submit', (e) => {
    e.preventDefault();
    const inventario = getInventario();
    
    const hexValue = document.getElementById('colorHex').value;
    
    const r = parseInt(hexValue.slice(1, 3), 16);
    const g = parseInt(hexValue.slice(3, 5), 16);
    const b = parseInt(hexValue.slice(5, 7), 16);

    const nuevo = {
        id: Date.now(),
        nombre: document.getElementById('nombre').value || "Sin nombre",
        hex: hexValue,
        rgb: { r, g, b },
        cantidad: document.getElementById('cantidad').value || "∞"
    };

    inventario.push(nuevo);
    saveInventario(inventario);
    e.target.reset();
    renderizarTabla();
});

function renderizarTabla() {
    const lista = getInventario();
    const tbody = document.getElementById('tabla-cuerpo');
    tbody.innerHTML = '';

    lista.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td><div class="color-circle" style="background-color: ${item.hex}"></div></td>
                <td class="text-truncate fw-bold" style="max-width: 100px;">${item.nombre}</td>
                <td>
                    <input type="number" class="form-control form-control-sm border-0 bg-light" 
                           value="${item.cantidad === '∞' ? '' : item.cantidad}" 
                           placeholder="∞"
                           onchange="actualizarCantidad(${item.id}, this.value)">
                </td>
                <td class="text-end px-3">
                    <button class="btn btn-danger btn-sm px-3" onclick="eliminar(${item.id})" title="Eliminar">
                        ✕
                    </button>
                </td>
            </tr>
        `;
    });
}

function actualizarCantidad(id, nuevaCant) {
    let inventario = getInventario();
    const index = inventario.findIndex(i => i.id === id);
    if (index !== -1) {
        inventario[index].cantidad = nuevaCant === "" ? "∞" : nuevaCant;
        saveInventario(inventario);
    }
}

function eliminar(id) {
    if(confirm("¿Eliminar este color?")) {
        let inventario = getInventario();
        saveInventario(inventario.filter(i => i.id !== id));
        renderizarTabla();
    }
}

function exportarJSON() {
    const data = getInventario();
    if (data.length === 0) return alert("El inventario está vacío");
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamantes_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function importarJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                if (confirm("¿Sobrescribir inventario actual con el archivo?")) {
                    saveInventario(data);
                    renderizarTabla();
                }
            }
        } catch (err) {
            alert("El archivo no es un JSON válido");
        }
        input.value = '';
    };
    reader.readAsText(file);
}