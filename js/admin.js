import { db, auth, storage } from './firebase.js';
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, 
    onSnapshot, query, orderBy, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
import { showToast, formatPrice } from './utils.js';
import { logoutUser } from './auth.js';

console.log("Admin module initializing with high-quality fixes...");

// --- Auth Protection ---
auth.onAuthStateChanged((user) => {
    if (!user || user.email !== 'admin@thompsons.com') {
        window.location.replace('login.html');
        return;
    }
    initAdminListeners();
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = () => logoutUser().then(() => window.location.replace('login.html'));
}

// --- Navigation ---
const sections = {
    dashboard: document.getElementById('dashboard-section'),
    menu: document.getElementById('menu-section'),
    orders: document.getElementById('orders-section'),
    users: document.getElementById('users-section')
};

document.querySelectorAll('.admin-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href').replace('#', '');
        document.querySelectorAll('.admin-nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        Object.values(sections).forEach(s => s && s.classList.add('hidden'));
        if (sections[target]) sections[target].classList.remove('hidden');
    });
});

function initAdminListeners() {
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
        renderOrders(snapshot);
        updateOverview(snapshot);
    });

    onSnapshot(collection(db, "menuItems"), (snapshot) => {
        renderMenu(snapshot);
    });

    onSnapshot(collection(db, "users"), (snapshot) => {
        const tbody = document.querySelector('#users-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        document.getElementById('total-users').textContent = snapshot.size;
        snapshot.forEach(doc => {
            const u = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td><span class="badge">${u.role}</span></td>
                <td>${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td><button onclick="deleteUser('${doc.id}')" class="btn-sm btn-delete">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// --- Menu Management ---
const menuForm = document.getElementById('menu-form');
if (menuForm) {
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Submitting menu item...");
        
        const id = menuForm.dataset.editId;
        const name = document.getElementById('item-name').value.trim();
        const priceStr = document.getElementById('item-price').value;
        const price = parseFloat(priceStr);
        const category = document.getElementById('item-cat').value;
        const available = document.getElementById('item-available').checked;
        const statusEl = document.getElementById('upload-status');
        
        let imageUrl = document.getElementById('item-img').value.trim() || '🍽️';

        console.log("Starting image upload...");
        try {
            const file = document.getElementById("image").files[0];
            if (file) {
                if (statusEl) statusEl.textContent = "Uploading image...";
                const storageRef = ref(storage, "menuImages/" + Date.now() + "_" + file.name);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
                console.log("Image upload success:", imageUrl);
                if (statusEl) statusEl.textContent = "Upload successful!";
            }
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Storage Error: " + error.message + ". Item will still be saved.");
        }

        try {
            const itemData = {
                name,
                price,
                category,
                available,
                image: imageUrl || "🍽️",
                updatedAt: new Date()
            };

            if (id) {
                await updateDoc(doc(db, "menuItems", id), itemData);
                alert("Success: Item updated!");
            } else {
                await addDoc(collection(db, "menuItems"), {
                    ...itemData,
                    createdAt: new Date()
                });
                alert("Success: Item added!");
            }
            
            closeModal();
            const menuBtn = document.querySelector('a[href="#menu"]');
            if (menuBtn) menuBtn.click();
        } catch (error) {
            console.error("Firestore Save Error:", error);
            alert("Firestore Error: " + error.message);
        }
    });
}

function renderMenu(snapshot) {
    const tbody = document.querySelector('#menu-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    snapshot.forEach(d => {
        const i = d.data();
        const tr = document.createElement('tr');
        const isEmoji = i.image && !i.image.includes('http') && i.image.length < 5;
        const imgHtml = isEmoji 
            ? `<span style="font-size:1.5rem;">${i.image}</span>`
            : `<img src="${i.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">`;

        tr.innerHTML = `
            <td>${imgHtml}</td>
            <td>${i.name}</td>
            <td>${formatPrice(i.price)}</td>
            <td>${i.category}</td>
            <td><span class="status-badge">${i.available ? 'Yes' : 'No'}</span></td>
            <td>
                <button onclick="editItem('${d.id}')" class="btn-sm">Edit</button>
                <button onclick="deleteItem('${d.id}')" class="btn-sm btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editItem = async (id) => {
    try {
        const d = await getDoc(doc(db, "menuItems", id));
        if (!d.exists()) return;
        const i = d.data();
        document.getElementById('item-name').value = i.name;
        document.getElementById('item-price').value = i.price;
        document.getElementById('item-cat').value = i.category;
        document.getElementById('item-img').value = (i.image && !i.image.includes('http')) ? i.image : '';
        document.getElementById('item-available').checked = i.available !== false;
        menuForm.dataset.editId = id;
        openModal("Edit Item");
    } catch (err) { console.error(err); }
};

window.deleteItem = async (id) => { 
    if(confirm("Delete this item?")) await deleteDoc(doc(db, "menuItems", id)).catch(err => alert(err.message)); 
};

function renderOrders(snapshot) {
    const tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    snapshot.forEach(d => {
        const o = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${d.id.slice(-5)}</td>
            <td>${o.customerEmail}</td>
            <td>${formatPrice(o.totalPrice)}</td>
            <td>${o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString() : '...'}</td>
            <td>
                <select onchange="updateOrderStatus('${d.id}', this.value)" class="status-select">
                    <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
                    <option value="preparing" ${o.status==='preparing'?'selected':''}>Preparing</option>
                    <option value="completed" ${o.status==='completed'?'selected':''}>Completed</option>
                </select>
            </td>
            <td><button onclick="deleteOrder('${d.id}')" class="btn-sm btn-delete">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateOverview(snapshot) {
    let revenue = 0, active = 0;
    snapshot.forEach(d => {
        const o = d.data();
        if (o.status === 'completed') revenue += o.totalPrice;
        if (o.status !== 'completed') active++;
    });
    const el1 = document.getElementById('total-orders'), el2 = document.getElementById('total-revenue'), el3 = document.getElementById('active-orders');
    if (el1) el1.textContent = snapshot.size;
    if (el2) el2.textContent = formatPrice(revenue);
    if (el3) el3.textContent = active;
}

window.updateOrderStatus = async (id, status) => { await updateDoc(doc(db, "orders", id), { status }); showToast("Status updated"); };
window.deleteOrder = async (id) => { if(confirm("Delete order?")) await deleteDoc(doc(db, "orders", id)); };
window.deleteUser = async (id) => { if(confirm("Remove user?")) await deleteDoc(doc(db, "users", id)); };

window.openModal = (title = "Add Menu Item") => {
    const modal = document.getElementById('item-modal');
    const submitBtn = menuForm.querySelector('button[type="submit"]');
    if (title === "Add Menu Item") {
        menuForm.reset();
        delete menuForm.dataset.editId;
        if (submitBtn) submitBtn.textContent = "Add Item";
    } else {
        if (submitBtn) submitBtn.textContent = "Save Changes";
    }
    modal.style.display = "flex";
    document.querySelector('#item-modal h3').textContent = title;
};

window.closeModal = () => {
    document.getElementById('item-modal').style.display = "none";
    menuForm.reset();
    delete menuForm.dataset.editId;
};