import { db, auth } from './firebase.js';
import { collection, addDoc, getDocs, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { showToast, formatPrice } from './utils.js';

let cart = JSON.parse(localStorage.getItem('cart') || '[]');

export async function loadMenu(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading our delicious menu...</div>';

    const q = query(collection(db, "menuItems"), where("available", "==", true));
    
    // Switch to real-time for immediate visibility
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state">Nothing on the menu right now. Check back soon!</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'menu-grid';

        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const el = document.createElement('div');
            el.className = 'menu-item';
            
            // Handle both emojis and image URLs
            const isEmoji = !item.image.includes('http') && item.image.length < 5;
            const imgHtml = isEmoji 
                ? `<div class="menu-emoji">${item.image}</div>`
                : `<img src="${item.image}" class="menu-img" style="width:100%; height:150px; object-fit:cover; border-radius:12px; margin-bottom:15px;">`;

            el.innerHTML = `
                ${imgHtml}
                <div class="menu-info">
                    <h3>${item.name}</h3>
                    <p style="font-size:0.85rem; color:#777; margin-bottom:10px;">${item.description || ''}</p>
                    <span class="price">${formatPrice(item.price)}</span>
                </div>
                <button class="add-btn" data-id="${item.id}">Add to Cart</button>
            `;
            el.querySelector('.add-btn').onclick = () => addToCart(item);
            grid.appendChild(el);
        });
        container.appendChild(grid);
    });
}

export function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    saveCart();
    showToast(`${item.name} added to cart!`);
}

export function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart('cart-container');
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent('cart-updated'));
}

export function renderCart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Your cart is empty 🛒</div>';
        return;
    }

    container.innerHTML = '';
    cart.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div>
                <strong>${item.name}</strong> x ${item.qty}
                <div style="font-size:0.8em; color:#666;">${formatPrice(item.price * item.qty)}</div>
            </div>
            <button class="remove-btn" data-idx="${idx}">Remove</button>
        `;
        el.querySelector('.remove-btn').onclick = () => removeFromCart(idx);
        container.appendChild(el);
    });

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalEl = document.createElement('div');
    totalEl.className = 'cart-total';
    totalEl.innerHTML = `Total: ${formatPrice(total)}`;
    container.appendChild(totalEl);
}

export async function placeOrder() {
    if (cart.length === 0) return showToast("Cart is empty", 'error');
    if (!auth.currentUser) return showToast("Please login first", 'error');

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const orderData = {
        customerEmail: auth.currentUser.email,
        customerId: auth.currentUser.uid,
        items: cart,
        totalPrice: total,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), orderData);
        cart = [];
        saveCart();
        showToast("Order placed successfully!", 'success');
        // Switch to orders view
        const navOrders = document.getElementById('nav-orders');
        if (navOrders) navOrders.click();
    } catch (e) {
        showToast("Order failed: " + e.message, 'error');
    }
}

export async function loadOrders(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !auth.currentUser) return;

    container.innerHTML = '<div class="loading">Fetching your orders...</div>';

    const q = query(
        collection(db, "orders"), 
        where("customerId", "==", auth.currentUser.uid)
    );

    // Using real-time for customer orders too
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state">No orders found. Time to eat! 🍕</div>';
            return;
        }

        snapshot.forEach(doc => {
            const order = doc.data();
            const el = document.createElement('div');
            el.className = 'list-item order-item';
            const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'Just now';
            el.innerHTML = `
                <div>
                    <div><strong>Order #${doc.id.slice(-5)}</strong> - <span class="status-${order.status}">${order.status.toUpperCase()}</span></div>
                    <div style="font-size:0.85em; color:#777;">${order.items.length} items • ${formatPrice(order.totalPrice)} • ${date}</div>
                </div>
            `;
            container.appendChild(el);
        });
    });
}
