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

let userLocation = null;

export async function placeOrder() {
    if (cart.length === 0) return showToast("Cart is empty", 'error');
    if (!auth.currentUser) return showToast("Please login first", 'error');

    // Reset Modal
    document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');
    document.getElementById('success-msg').classList.add('hidden');
    document.getElementById('processing-msg').classList.remove('hidden');
    document.getElementById('checkout-modal').style.display = 'flex';
    
    // Start Geolocation
    requestLocation();

    // Reset button text to default
    const toStep3Btn = document.getElementById('to-step-3');
    if (toStep3Btn) toStep3Btn.textContent = "Place Order 🚀"; // Cash is default
}

// Geolocation Logic
function requestLocation() {
    const status = document.getElementById('location-status');
    const manualGroup = document.getElementById('manual-address-group');
    
    if (!navigator.geolocation) {
        status.textContent = "Geolocation not supported.";
        manualGroup.classList.remove('hidden');
        return;
    }

    status.textContent = "📍 Detecting location...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            status.innerHTML = `✅ Location captured! <br><small>(${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})</small>`;
            manualGroup.classList.add('hidden');
        },
        (err) => {
            console.warn("Location error:", err);
            status.textContent = "❌ Permission denied. Please enter address manually.";
            manualGroup.classList.remove('hidden');
            userLocation = null;
        },
        { timeout: 10000 }
    );
}

// Navigation & Logic for Steps
document.addEventListener('click', async (e) => {
    const id = e.target.id;
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    // Monitor radio changes (even though we use delegating listeners for clicks)
    if (e.target.name === 'payment-method') {
        const btn = document.getElementById('to-step-3');
        if (btn) {
            btn.textContent = e.target.value === 'cash' ? "Place Order 🚀" : "Continue ➔";
        }
    }

    // Step 1 -> Step 2
    if (id === 'to-step-2') {
        const phone = document.getElementById('checkout-phone').value.trim();
        const address = document.getElementById('checkout-address').value.trim();
        
        if (!phone || phone.length < 8) return showToast("Please enter a valid phone number", 'error');
        if (!userLocation && !address) return showToast("Please provide your location or address", 'error');
        
        switchStep('step-1', 'step-2');
    }

    // Step 2 -> Step 3 (Logic)
    if (id === 'to-step-3') {
        const method = document.querySelector('input[name="payment-method"]:checked').value;
        if (method === 'cash') {
            submitFinalOrder('cash', 'pending');
        } else if (method === 'card') {
            switchStep('step-2', 'step-3-card');
        } else if (method === 'momo') {
            switchStep('step-2', 'step-3-momo');
        }
    }

    // Confirm Card
    if (id === 'confirm-card-btn') {
        const num = document.getElementById('card-num').value.replace(/\s/g, '');
        if (num.length < 16) return showToast("Invalid card number", 'error');
        submitFinalOrder('card', 'paid');
    }

    // Confirm MoMo
    if (id === 'confirm-momo-btn') {
        submitFinalOrder('momo', 'initiated');
    }

    // Back Buttons
    if (id === 'back-to-step-1') switchStep('step-2', 'step-1');
    if (id === 'back-to-step-2-card') switchStep('step-3-card', 'step-2');
    if (id === 'back-to-step-2-momo') switchStep('step-3-momo', 'step-2');

    // Close / Finish / Cancel
    if (id === 'close-checkout-btn' || id === 'cancel-checkout-btn') {
        modal.style.display = 'none';
        if (id === 'close-checkout-btn') {
            const navOrders = document.getElementById('nav-orders');
            if (navOrders) navOrders.click();
        }
    }
    
    // Refresh Location
    if (id === 'get-location-btn') requestLocation();
});

function switchStep(from, to) {
    document.getElementById(from).classList.remove('active');
    document.getElementById(to).classList.add('active');
}

async function submitFinalOrder(method, pStatus) {
    document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-final').classList.add('active');
    
    const phone = document.getElementById('checkout-phone').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    const orderData = {
        customerId: auth.currentUser.uid,
        customerEmail: auth.currentUser.email,
        phoneNumber: phone,
        location: userLocation || { address: address },
        items: cart,
        totalPrice: total,
        paymentMethod: method,
        paymentStatus: pStatus,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        // Dynamic Processing Message
        const msgEl = document.getElementById('processing-msg');
        if (method === 'momo') {
            msgEl.innerHTML = `
                <div class="spinner"></div>
                <h3>Waiting for PIN Authorization...</h3>
                <p style="font-size:0.9rem; color:var(--primary);">A prompt has been sent to <strong>${phone}</strong></p>
                <div style="font-size:0.8rem; margin-top:10px; opacity:0.7;">Please enter your PIN on your phone to complete.</div>
            `;
            await new Promise(r => setTimeout(r, 4000)); // Longer wait for Momo
        } else if (method === 'card') {
            msgEl.innerHTML = `
                <div class="spinner"></div>
                <h3>Contacting Bank Security...</h3>
                <p style="font-size:0.8rem; opacity:0.7;">Verifying card details and processing payment.</p>
            `;
            await new Promise(r => setTimeout(r, 3000));
        } else {
            // Cash delay
            await new Promise(r => setTimeout(r, 1500));
        }
        
        await addDoc(collection(db, "orders"), orderData);
        
        cart = [];
        localStorage.setItem('cart', '[]');
        document.dispatchEvent(new CustomEvent('cart-updated'));
        
        document.getElementById('processing-msg').classList.add('hidden');
        document.getElementById('success-msg').classList.remove('hidden');
        
        // Update summary based on status
        const summary = document.getElementById('order-summary-msg');
        if (method === 'momo') {
            summary.textContent = "Order placed! Watch for the Mobile Money prompt on your phone.";
        } else if (method === 'card') {
            summary.textContent = "Payment successful! Your order is being prepared.";
        } else {
            summary.textContent = "Order received! Please have Cash ready for delivery.";
        }
    } catch (e) {
        console.error(e);
        showToast("Order failed: " + e.message, 'error');
        switchStep('step-final', 'step-2');
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
