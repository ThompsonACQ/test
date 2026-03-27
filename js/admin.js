import { db, auth } from './firebase.js';
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, 
    onSnapshot, query, orderBy, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { showToast, formatPrice } from './utils.js';
import { logoutUser } from './auth.js';

console.log("Admin module initializing with high-quality fixes...");

// --- Environment Check ---
if (window.location.protocol === 'file:') {
    alert("⚠️ WARNING: You are running this as a local file (file://). Firebase Storage and CORS will FAIL unless you run this from a local server (like Live Server in VS Code) or deploy to GitHub Pages.");
    console.error("CORS will fail on file:// protocol. Use a local server.");
}

// --- Cloudinary Configuration ---
// IMPORTANT: Replace these with your actual Cloudinary Cloud Name and Unsigned Upload Preset!
const CLOUD_NAME = "dkcfhjkps"; 
const UPLOAD_PRESET = "restaurant_upload";

// --- Image Preview & Drag and Drop ---
const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('image-preview');
const dropzone = document.getElementById('dropzone');

function handleImageSelection(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            imagePreview.src = ev.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.style.display = 'none';
    }
}

if (imageInput && imagePreview && dropzone) {
    imageInput.addEventListener('change', (e) => {
        handleImageSelection(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            imageInput.files = e.dataTransfer.files;
            handleImageSelection(e.dataTransfer.files[0]);
        }
    });
}

// --- Image Compression Helper ---
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

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
                <td>${u.name || 'N/A'}</td>
                <td>${u.email}</td>
                <td>${u.phone || 'N/A'}</td>
                <td><small>${u.address || 'N/A'}</small></td>
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
        
        const submitBtn = menuForm.querySelector('button[type="submit"]');
        const emojiInput = document.getElementById('item-img').value.trim();
        let imageUrl = emojiInput || '🍽️';

        try {
            const fileInput = document.getElementById("image");
            let file = fileInput.files[0];
            
            if (file) {
                if (file.size > 10 * 1024 * 1024) throw new Error("File too large (>10MB). Cloudinary limit or your network may struggle.");
                
                if (submitBtn) submitBtn.disabled = true;
                if (statusEl) statusEl.textContent = "Compressing image...";

                // Compress image to save bandwidth and storage
                file = await compressImage(file, 800, 800, 0.8);

                if (statusEl) statusEl.textContent = "Uploading to Cloudinary 🚀...";

                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", UPLOAD_PRESET);

                // Check if user forgot to set credentials
                if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
                    throw new Error("Please configure your Cloudinary CLOUD_NAME and UPLOAD_PRESET in admin.js!");
                }

                // Cloudinary unsigned upload endpoint
                const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

                const response = await fetch(cloudinaryUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || "Cloudinary upload failed!");
                }

                const data = await response.json();
                imageUrl = data.secure_url;

                console.log("Success! Image URL:", imageUrl);
                if (statusEl) statusEl.textContent = "✅ Upload successful!";
            }
        } catch (error) {
            console.error("Upload Error:", error);
            const msg = error.message || "Upload failed";
            if (statusEl) {
                statusEl.innerHTML = `❌ ${msg} <br> <button type="button" onclick="forceSaveEmoji()" style="font-size:0.7rem; margin-top:5px; background:var(--gold); border:none; padding:2px 5px; cursor:pointer; border-radius:3px;">Force Save with Emoji</button>`;
            }
            showToast(msg, "error");
            if (submitBtn) submitBtn.disabled = false;
            return; // Stop form submission if image upload fails
        } finally {
            // Keep button disabled if we are proceeding to Firestore save
            if (submitBtn && !document.getElementById("image").files[0]) submitBtn.disabled = false; 
        }

        // Helper for the force save button
        window.forceSaveEmoji = async () => {
            const statusEl = document.getElementById('upload-status');
            if (statusEl) statusEl.textContent = "🚀 Forcing save with emoji...";
            
            // Clear file so it doesn't try to upload again
            document.getElementById('image').value = "";
            
            // Re-collect data and save immediately
            const name = document.getElementById('item-name').value.trim();
            const price = parseFloat(document.getElementById('item-price').value);
            const category = document.getElementById('item-cat').value;
            const description = document.getElementById('item-desc').value.trim();
            const available = document.getElementById('item-available').checked;
            const emojiInput = document.getElementById('item-img').value.trim();
            const id = menuForm.dataset.editId;

            try {
                const itemData = {
                    name, price, category, description, available,
                    image: emojiInput || "🍽️",
                    updatedAt: new Date()
                };

                if (id) {
                    await updateDoc(doc(db, "menuItems", id), itemData);
                } else {
                    await addDoc(collection(db, "menuItems"), { ...itemData, createdAt: new Date() });
                }
                
                alert("Success: Item added via Force Save!");
                closeModal();
            } catch (err) {
                console.error("Force Save Error:", err);
                alert("Firestore Error: " + err.message);
            }
        };

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

        const desc = i.description || '';
        const displayDesc = desc.length > 30 ? desc.substring(0, 27) + '...' : desc;

        tr.innerHTML = `
            <td>${imgHtml}</td>
            <td>${i.name}</td>
            <td>${formatPrice(i.price)}</td>
            <td>${i.category || 'N/A'}</td>
            <td><small style="opacity:0.7;">${displayDesc}</small></td>
            <td><span class="status-badge ${i.available ? 'yes' : 'no'}">${i.available ? 'Yes' : 'No'}</span></td>
            <td style="white-space:nowrap;">
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

// --- Visual Category Selection ---
const categorySelector = document.getElementById('category-selector');
const hiddenCatInput = document.getElementById('item-cat');

function selectCategoryChip(name) {
    hiddenCatInput.value = name;
    // Visually highlight active chip
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.name === name);
    });
}

onSnapshot(collection(db, "categories"), (snapshot) => {
    if (catList) catList.innerHTML = '';
    if (categorySelector) categorySelector.innerHTML = '';
    
    const groups = {};
    snapshot.forEach(doc => {
        const cat = doc.data();
        const type = cat.type || 'other';

        // Summary List on Categories Page
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

        if (!groups[type]) groups[type] = [];
        groups[type].push(cat.name);
    });

    // Populate Visual Chips in Add Item Modal
    if (categorySelector) {
        Object.keys(groups).sort().forEach(type => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'cat-type-group';
            groupDiv.innerHTML = `
                <div class="cat-type-label">${type}</div>
                <div class="cat-chip-row" id="row-${type}"></div>
            `;
            categorySelector.appendChild(groupDiv);

            const row = document.getElementById(`row-${type}`);
            groups[type].sort().forEach(name => {
                const chip = document.createElement('div');
                chip.className = 'cat-chip';
                chip.dataset.name = name;
                chip.textContent = name;
                chip.onclick = () => selectCategoryChip(name);
                row.appendChild(chip);
            });
        });
    }

    if (snapshot.empty && catList) {
        catList.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">No categories yet.</p>';
        if (categorySelector) categorySelector.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">Create categories first on the Categories page.</p>';
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
        selectCategoryChip(i.category || '');
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