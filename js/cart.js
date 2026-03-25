import { showToast, formatPrice } from './utils.js';

let cart = JSON.parse(localStorage.getItem('cart')) || [];

function save() {
    localStorage.setItem('cart', JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent('cart-updated'));
}

export function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    save();
    showToast(`${item.name} added to cart`, 'success');
}

export function removeFromCart(index) {
    cart.splice(index, 1);
    save();
}

export function clearCart() {
    cart = [];
    save();
}

export function getCart() { return cart; }

export function renderCart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (cart.length === 0) {
        container.innerHTML = '<p>Your cart is empty.</p>';
        return;
    }

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `<div><strong>${item.name}</strong> x ${item.qty}</div> <div>${formatPrice(item.price * item.qty)} <button class="remove-btn" data-idx="${index}">Remove</button></div>`;
        container.appendChild(div);
    });
    container.innerHTML += `<div class="cart-total">Total: ${formatPrice(total)}</div>`;
}