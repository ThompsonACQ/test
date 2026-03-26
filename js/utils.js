export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function formatPrice(price) {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(price);
}