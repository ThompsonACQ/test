import { db, auth } from './firebase.js';
import { doc, getDoc, collection, getDocs, updateDoc, orderBy, query, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { showToast, formatPrice } from './utils.js';
import { logoutUser } from './auth.js';

// Initialize Admin
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role !== 'admin') {
            window.location.href = 'index.html'; // Redirect non-admins
        }
    } catch (e) {
        console.error("Error checking admin role:", e);
        window.location.href = 'index.html';
    }
});

document.getElementById('logout-btn').onclick = () => logoutUser().then(() => window.location.href = 'index.html');

// --- Sidebar Navigation ---
const sections = {
    menu: document.getElementById('menu-section'),
    orders: document.getElementById('orders-section'),
    users: document.getElementById('users-section')
};

document.querySelectorAll('.admin-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetKey = link.getAttribute('href').replace('#', '');
        Object.values(sections).forEach(section => section && section.classList.add('hidden'));
        if (sections[targetKey]) sections[targetKey].classList.remove('hidden');
    });
});

// --- Menu Management ---
const menuForm = document.getElementById('menu-form');
menuForm.onsubmit = async (e) => {
    e.preventDefault();
    const item = {
        name: document.getElementById('item-name').value,
        price: parseFloat(document.getElementById('item-price').value),
        category: document.getElementById('item-cat').value,
        image: '🍽️', // Placeholder
        available: true
    };
    await addDoc(collection(db, "menuItems"), item);
    showToast('Item added');
    menuForm.reset();
    loadAdminMenu();
};

async function loadAdminMenu() {
    const tbody = document.querySelector('#menu-table tbody');
    tbody.innerHTML = '';
    const snap = await getDocs(collection(db, "menuItems"));
    snap.forEach(d => {
        const i = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i.name}</td><td>${formatPrice(i.price)}</td><td>${i.category}</td>`;
        tbody.appendChild(tr);
    });
}

// --- Order Management ---
async function loadAdminOrders() {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = 'Loading...';
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    tbody.innerHTML = '';
    snap.forEach(d => {
        const o = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.id.slice(0,5)}</td>
            <td>${o.status}</td>
            <td>${formatPrice(o.totalPrice)}</td>
            <td><button onclick="updateStatus('${d.id}', 'preparing')">Prep</button> <button onclick="updateStatus('${d.id}', 'completed')">Done</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateStatus = async (id, status) => { await updateDoc(doc(db, "orders", id), { status }); loadAdminOrders(); };

// Initial Load
loadAdminMenu();
loadAdminOrders();