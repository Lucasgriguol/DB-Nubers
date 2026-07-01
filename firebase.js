import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBIy15VNxiqQ_ZcV-nHty45mIyF5R9Xgjw",
    authDomain: "db-nubers.firebaseapp.com",
    projectId: "db-nubers",
    storageBucket: "db-nubers.firebasestorage.app",
    messagingSenderId: "370495140412",
    appId: "1:370495140412:web:f7d9ad339961f77236c939"
};

/* =========================
   APP PRINCIPAL
========================= */

const app = initializeApp(firebaseConfig);

/* =========================
   APP SECUNDARIA
========================= */

const secondaryApp = initializeApp(
    firebaseConfig,
    "secondary"
);

/* =========================
   AUTH
========================= */

const auth = getAuth(app);
const secondaryAuth = getAuth(secondaryApp);

/* =========================
   DATABASE
========================= */

const db = getFirestore(app);

export {
    auth,
    secondaryAuth,
    db
};