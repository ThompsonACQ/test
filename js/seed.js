import { db } from './firebase.js';
import { collection, addDoc, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const menuItems = [
    { name: 'Classic Burger', price: 12.99, image: '🍔', category: 'main', available: true },
    { name: 'Pepperoni Pizza', price: 15.99, image: '🍕', category: 'main', available: true },
    { name: 'Spaghetti Carbonara', price: 10.99, image: '🍝', category: 'main', available: true },
    { name: 'Greek Salad', price: 8.99, image: '🥗', category: 'main', available: true },
    { name: 'Iced Coffee', price: 4.50, image: '☕', category: 'drink', available: true },
    { name: 'Fresh Lemonade', price: 3.99, image: '🥤', category: 'drink', available: true },
    { name: 'Chocolate Lava Cake', price: 7.99, image: '🍰', category: 'dessert', available: true }
];

export async function seedMenu() {
    const q = query(collection(db, "menuItems"), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("Seeding menu items...");
        for (const item of menuItems) {
            await addDoc(collection(db, "menuItems"), item);
        }
        console.log("Menu seeded successfully!");
    } else {
        console.log("Menu already has items, skipping seed.");
    }
}
