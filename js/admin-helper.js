import { db, auth } from './firebase.js';
import { doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

/**
 * Run this function in your browser console while logged in 
 * to promote your current account to Admin.
 */
async function makeMeAdmin() {
    const user = auth.currentUser;
    if (!user) {
        console.error("You must be logged in to promote yourself.");
        return;
    }
    
    try {
        await updateDoc(doc(db, "users", user.uid), {
            role: 'admin'
        });
        console.log("Success! You are now an admin. Refresh the page to access admin panel.");
        alert("You are now an admin! Please refresh the page.");
    } catch (e) {
        console.error("Failed to promote to admin:", e);
    }
}

window.makeMeAdmin = makeMeAdmin;

/**
 * Creates a default admin account if needed.
 */
export async function seedAdmin(email, password) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            name: "Default Admin",
            email: email,
            role: 'admin',
            uid: cred.user.uid,
            createdAt: new Date()
        });
        console.log("Admin account created successfully!");
        alert("Admin account created: " + email);
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            console.log("Admin email already exists.");
        } else {
            console.error("Error creating admin:", e);
        }
    }
}

window.seedAdmin = seedAdmin;
console.log("Admin Helper Loaded. Call makeMeAdmin() or seedAdmin(email, pass).");
