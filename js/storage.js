const DB_NAME = 'mis_diamantes';

function getInventario() {
    return JSON.parse(localStorage.getItem(DB_NAME)) || [];
}

function saveInventario(data) {
    localStorage.setItem(DB_NAME, JSON.stringify(data));
}