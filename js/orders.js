import { db, auth } from './firebase.js';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getCart, clearCart } from './cart.js';
import { showToast, formatPrice } from './utils.js';

export async function placeOrder() {
    const cart = getCart();
    if (cart.length === 0) return showToast('Cart is empty', 'error');
    if (!auth.currentUser) return showToast('Login required', 'error');

    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const order = {
        userId: auth.currentUser.uid,
        items: cart,
        totalPrice: total,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), order);
        clearCart();
        showToast('Order placed!', 'success');
        // Refresh orders view if active (handled by UI switching)
    } catch (e) {
        showToast('Order failed: ' + e.message, 'error');
    }
}

export async function loadOrders(containerId) {
    const container = document.getElementById(containerId);
    if (!auth.currentUser) return;
    
    container.innerHTML = 'Loading...';
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    container.innerHTML = '';
    if (snapshot.empty) {
        container.innerHTML = '<p>No orders found.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.borderLeftColor = data.status === 'completed' ? 'var(--success)' : 'var(--warning)';
        div.innerHTML = `<div><strong>#${doc.id.slice(0,5)}</strong> (${data.status})<br>${data.items.length} items</div> <div>${formatPrice(data.totalPrice)}</div>`;
        container.appendChild(div);
    });
}