import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { doc, getDoc, setDoc, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
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

export async function signup(email, password, name, phone, address) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            name: name,
            phone: phone,
            address: address,
            email: email, 
            role: 'customer', 
            uid: cred.user.uid, 
            createdAt: new Date()
        });
        showToast('Account created!', 'success');
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            showToast('Email already in use. Please login.', 'error');
        } else {
            showToast(e.message, 'error');
        }
    }
}

export async function verifyAndResetPassword(email, name, phone, address) {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showToast("No account found with this email.", "error");
            return false;
        }

        const userData = querySnapshot.docs[0].data();
        
        // Verify identity fields
        if (userData.name === name && userData.phone === phone && userData.address === address) {
            await sendPasswordResetEmail(auth, email);
            showToast("Identity verified! Reset link sent to your email.", "success");
            return true;
        } else {
            showToast("Identity verification failed. Information does not match.", "error");
            return false;
        }
    } catch (e) {
        showToast(e.message, "error");
        return false;
    }
}

export const logoutUser = () => signOut(auth).then(() => showToast('Logged out'));