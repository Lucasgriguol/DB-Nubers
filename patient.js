import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

let currentUser = null;
let patientRef = null;

/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    patientRef = doc(db, "users", user.uid);

    loadPatientData();
});

/* =========================
   LOAD PATIENT DATA REALTIME
========================= */

function loadPatientData() {

    onSnapshot(patientRef, (snap) => {

        if (!snap.exists()) return;

        const data = snap.data();

        /* =========================
           STATS PRINCIPALES
        ========================= */

        const weightEl = document.getElementById("weightValue");
        const heightEl = document.getElementById("heightValue");
        const bmiEl = document.getElementById("bmiValue");

        if (weightEl) weightEl.textContent = data.weight ?? "--";
        if (heightEl) heightEl.textContent = data.height ?? "--";

        const bmi =
            data.weight && data.height
                ? (data.weight / ((data.height / 100) ** 2)).toFixed(1)
                : "--";

        if (bmiEl) bmiEl.textContent = bmi;

        /* =========================
           INFO PERFIL
        ========================= */

        const info = document.getElementById("patientData");

        if (info) {
            info.innerHTML = `
                <p><strong>Nombre:</strong> ${data.name || ""}</p>
                <p><strong>Email:</strong> ${data.email || ""}</p>
                <p><strong>Estado:</strong> Activo</p>
            `;
        }

        /* =========================
           PLAN NUTRICIONAL
        ========================= */

        const plan = document.getElementById("planContainer");

        if (plan) {

            if (data.planUrl) {
                plan.innerHTML = `
                    <a href="${data.planUrl}" target="_blank">
                        Abrir plan nutricional
                    </a>
                `;
            } else {
                plan.innerHTML = `<p class="empty">Todavía no tienes un plan nutricional asignado.</p>`;
            }
        }
    });
}

/* =========================
   LOGOUT
========================= */

window.logout = () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
};

/* =========================
   VIEW SWITCH
========================= */

window.showView = (id) => {

    document.querySelectorAll(".view").forEach(v => {
        v.style.display = "none";
    });

    const el = document.getElementById(id);
    if (el) el.style.display = "block";
};