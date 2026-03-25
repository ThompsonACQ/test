import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { addToCart } from './cart.js';
import { formatPrice } from './utils.js';

export async function loadMenu(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div style="text-align:center">Loading menu...</div>';

    const q = query(collection(db, "menuItems"), where("available", "==", true));
    const snapshot = await getDocs(q);
    
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'menu-grid';

    snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const el = document.createElement('div');
        el.className = 'menu-item';
        el.innerHTML = `
            <div class="menu-emoji">${item.image || '🍽️'}</div>
            <h3>${item.name}</h3>
            <p class="price">${formatPrice(item.price)}</p>
            <button class="add-btn">Add to Cart</button>
        `;
        el.querySelector('.add-btn').onclick = () => addToCart(item);
        grid.appendChild(el);
    });
    container.appendChild(grid);
}