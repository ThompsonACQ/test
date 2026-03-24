// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCs7_YN0HPh7XE1iyHiSVHTdT9oYTgClB4",
  authDomain: "goes-dd3e3.firebaseapp.com",
  projectId: "goes-dd3e3",
  storageBucket: "goes-dd3e3.firebasestorage.app",
  messagingSenderId: "856551069308",
  appId: "1:856551069308:web:c644afa41cf1e3a8449bf9",
  measurementId: "G-7TY9P05TBP"
};

// Initialize
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Restaurant menu (hardcoded)
const menuItems = [
  { id: 1, name: 'Burger', price: 12.99, image: '🍔' },
  { id: 2, name: 'Pizza', price: 15.99, image: '🍕' },
  { id: 3, name: 'Pasta', price: 10.99, image: '🍝' },
  { id: 4, name: 'Salad', price: 8.99, image: '🥗' },
  { id: 5, name: 'Soda', price: 2.99, image: '🥤' }
];

// Cart
let cart = [];

// Validation helper
function validateInput(email, password, isSignup = false) {
  email = email.trim();
  password = password.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Enter a valid email.');
    return false;
  }
  if (!password || password.length < 6) {
    alert('Password must be at least 6 characters.');
    return false;
  }
  return {email, password};
}

// Load menu
function loadMenu() {
  const menuList = document.getElementById('menu-list');
  menuList.innerHTML = '';
  menuItems.forEach(item => {
    const div = document.createElement('div');
    div.style.border = '1px solid #ccc';
    div.style.margin = '10px';
    div.style.padding = '10px';
    div.style.display = 'inline-block';
    div.style.width = '200px';
    div.innerHTML = `
      <div style="font-size: 30px;">${item.image}</div>
      <h4>${item.name}</h4>
      <p>$${item.price.toFixed(2)}</p>
      <button onclick="addToCart(${item.id})">Add to Cart</button>
    `;
    menuList.appendChild(div);
  });
}

// Add to cart
window.addToCart = function(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  cart.push(item);
  loadCart();
  alert(`${item.name} added to cart!`);
};

// Load cart
function loadCart() {
  const cartItems = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  cartCount.textContent = cart.length;
  cartItems.innerHTML = '';
  let total = 0;
  cart.forEach((item, index) => {
    const div = document.createElement('div');
    div.innerHTML = `${item.name} - $${item.price.toFixed(2)} <button onclick="removeFromCart(${index})">Remove</button>`;
    cartItems.appendChild(div);
    total += item.price;
  });
  cartItems.innerHTML += `<p><strong>Total: $${total.toFixed(2)}</strong></p>`;
}

// Remove from cart
window.removeFromCart = function(index) {
  cart.splice(index, 1);
  loadCart();
};

// Place order
window.placeOrder = function() {
  if (cart.length === 0) {
    alert('Cart empty!');
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    alert('Must be logged in!');
    return;
  }
  const order = {
    userId: user.uid,
    items: cart,
    total: cart.reduce((sum, item) => sum + item.price, 0),
    timestamp: firebase.firestore.Timestamp.now(),
    status: 'placed'
  };
  db.collection('orders').add(order)
    .then(() => {
      alert('Order placed! Check your orders.');
      cart = [];
      loadCart();
      loadOrders(user.uid);
    })
    .catch(err => alert(err.message));
};

// Load orders
function loadOrders(userId) {
  const ordersList = document.getElementById('orders-list');
  ordersList.innerHTML = '<p>Loading...</p>';
  db.collection('orders').where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get()
    .then(snapshot => {
      ordersList.innerHTML = '';
      if (snapshot.empty) {
        ordersList.innerHTML = '<p>No orders yet.</p>';
        return;
      }
      snapshot.forEach(doc => {
        const order = doc.data();
        const div = document.createElement('div');
        div.style.border = '1px solid #ccc';
        div.style.margin = '10px';
        div.style.padding = '10px';
        div.innerHTML = `
          <h4>Order #${doc.id.slice(-4)}</h4>
          <p>Items: ${order.items.map(i => i.name).join(', ')}</p>
          <p>Total: $${order.total.toFixed(2)} | Status: ${order.status}</p>
        `;
        ordersList.appendChild(div);
      });
    })
    .catch(err => {
      ordersList.innerHTML = '<p>Error loading orders.</p>';
      console.error(err);
    });
}

// Auth functions (signup, login, logout, validateInput) - existing code here
// ... (keep all previous auth code)

window.signup = function () {
  const input = validateInput(
    document.getElementById("email").value,
    document.getElementById("password").value,
    true
  );
  if (!input) return;

  auth.createUserWithEmailAndPassword(input.email, input.password)
    .then((userCredential) => {
      const user = userCredential.user;
      return db.collection("users").add({
        uid: user.uid,
        email: user.email,
        createdAt: firebase.firestore.Timestamp.now()
      });
    })
    .then(() => {
      alert("Signed up and logged in! Data saved to Firestore.");
    })
    .catch((err) => {
      alert(err.message);
    });
};

window.login = function () {
  const input = validateInput(
    document.getElementById("email").value,
    document.getElementById("password").value
  );
  if (!input) return;

  auth.signInWithEmailAndPassword(input.email, input.password)
    .then(() => {
      alert("Logged in successfully!");
    })
    .catch((err) => {
      alert(err.message);
    });
};

window.logout = function () {
  auth.signOut()
    .then(() => {
      alert("Logged out!");
    })
    .catch((err) => {
      alert(err.message);
    });
};

// Auth state
auth.onAuthStateChanged((user) => {
  const statusDiv = document.getElementById('user-status');
  const authSection = document.getElementById('auth-section');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboard = document.getElementById('dashboard');
  if (user) {
    statusDiv.textContent = `Logged in as: ${user.email}`;
    statusDiv.style.display = 'block';
    authSection.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    dashboard.style.display = 'block';
    loadMenu();
    loadCart();
    loadOrders(user.uid);
  } else {
    statusDiv.style.display = 'none';
    authSection.style.display = 'block';
    logoutBtn.style.display = 'none';
    dashboard.style.display = 'none';
  }
});
