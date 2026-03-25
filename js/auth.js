import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { showToast } from './utils.js';

export function initAuth(onUserChange) {
    onAuthStateChanged(auth, async (user) => {
        let role = 'guest';
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    role = userDoc.data().role || 'customer';
                }
            } catch (e) {
                console.error("Error fetching user role", e);
            }
        }
        onUserChange(user, role);
    });
}

export async function login(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Logged in successfully', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

export async function signup(email, password, name, phone) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            name: name,
            phone: phone,
            email: email, 
            role: 'customer', 
            uid: cred.user.uid, 
            createdAt: new Date()
        });
        showToast('Account created!', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

export const logoutUser = () => signOut(auth).then(() => showToast('Logged out'));