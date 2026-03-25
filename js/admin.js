import { db, auth, storage } from './firebase.js';
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, 
    onSnapshot, query, orderBy, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
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
    users: document.getElementById('users-section'),
    categories: document.getElementById('categories-section'),
    settings: document.getElementById('settings-section')
};

// --- Mobile Sidebar Toggle ---
const sidebar = document.getElementById('admin-sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');
const overlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    toggleBtn.classList.toggle('active');
}

if (toggleBtn) toggleBtn.onclick = toggleSidebar;
if (overlay) overlay.onclick = toggleSidebar;

document.querySelectorAll('.admin-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault(); 
        const target = link.getAttribute('href').replace('#', '');
        
        // Hide sidebar on mobile after clicking a link
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            toggleBtn.classList.remove('active');
        }

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
        const description = document.getElementById('item-desc').value.trim();
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
            console.error("Storage Error:", error);
            // If it's a CORS error, we inform but don't block
            showToast("Upload failed (Storage CORS). Saving item with emoji instead.", "error");
            if (statusEl) statusEl.textContent = "Upload failed. Using emoji.";
        }

        try {
            const itemData = {
                name,
                price,
                category,
                description,
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
        const img = i.image || '🍽️';
        const isEmoji = typeof img === 'string' && !img.includes('http') && img.length < 5;
        const imgHtml = isEmoji 
            ? `<span style="font-size:1.5rem;">${img}</span>`
            : `<img src="${img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">`;

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

// --- Category Management ---
const catForm = document.getElementById('category-form');
const catList = document.getElementById('category-list');
const catSelect = document.getElementById('item-cat');

onSnapshot(collection(db, "categories"), (snapshot) => {
    if (catList) catList.innerHTML = '';
    if (catSelect) catSelect.innerHTML = '<option value="">Select Category</option>';
    
    // Group categories by type for the dropdown
    const groups = {};

    snapshot.forEach(doc => {
        const cat = doc.data();
        const type = cat.type || 'other';

        // Update List in Categories Page
        if (catList) {
            const tag = document.createElement('div');
            tag.className = 'badge';
            tag.style.padding = '8px 15px';
            tag.style.display = 'flex';
            tag.style.alignItems = 'center';
            tag.style.gap = '10px';
            tag.innerHTML = `
                <small style="opacity:0.7; text-transform:uppercase; font-size:0.6rem;">${type}</small>
                <strong>${cat.name}</strong> 
                <span onclick="deleteCategory('${doc.id}')" style="cursor:pointer; color:var(--danger); font-weight:bold;">×</span>
            `;
            catList.appendChild(tag);
        }

        // Build groups for the select
        if (!groups[type]) groups[type] = [];
        groups[type].push(cat.name);
    });

    // Populate Select with optgroups
    if (catSelect) {
        Object.keys(groups).sort().forEach(type => {
            const groupEl = document.createElement('optgroup');
            groupEl.label = type.toUpperCase();
            groups[type].sort().forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                groupEl.appendChild(opt);
            });
            catSelect.appendChild(groupEl);
        });
    }

    if (snapshot.empty && catList) {
        catList.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">No categories yet. Create your first one above!</p>';
    }
});

if (catForm) {
    catForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-cat-name').value.trim();
        const type = document.getElementById('new-cat-type').value;
        if (!name) return;
        try {
            await addDoc(collection(db, "categories"), { 
                name: name, 
                type: type,
                createdAt: new Date() 
            });
            catForm.reset();
            showToast("Category added!");
        } catch (e) { showToast(e.message, 'error'); }
    });
}

window.deleteCategory = async (id) => {
    if (confirm("Delete this category? Items using it will remain but won't have a linked category.")) {
        await deleteDoc(doc(db, "categories", id));
    }
};

window.editItem = async (id) => {
    try {
        const d = await getDoc(doc(db, "menuItems", id));
        if (!d.exists()) return;
        const i = d.data();
        document.getElementById('item-name').value = i.name;
        document.getElementById('item-price').value = i.price;
        document.getElementById('item-cat').value = i.category || '';
        document.getElementById('item-desc').value = i.description || '';
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