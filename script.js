import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/* =========================
   STATE
========================= */

let currentUser = null;
let currentUserData = null;
let selectedPatient = null;

/* =========================
   MESSAGE
========================= */

function message(text, type = "error") {
    const el = document.getElementById("message");
    if (!el) return;

    el.textContent = text;
    el.style.color = type === "success" ? "#2ecc71" : "#e74c3c";
}

/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

    const page = window.location.pathname.split("/").pop();

    if (!user) {
        currentUser = null;
        currentUserData = null;

        if (page !== "index.html") {
            window.location.href = "index.html";
        }
        return;
    }

    currentUser = user;

    const ref = await getDoc(doc(db, "users", user.uid));
    currentUserData = ref.exists() ? ref.data() : null;

    console.log("UID:", currentUser?.uid);
    console.log("ROLE:", currentUserData?.role);

    if (page === "index.html") {
        if (currentUserData?.role === "patient") {
            window.location.href = "patient-dashboard.html";
        } else {
            window.location.href = "dashboard.html";
        }
        return;
    }

    if (page === "dashboard.html") {
        loadPatients();
        loadStats();
    }
});

/* =========================
   LOGIN
========================= */

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        console.log(err);
        message("Credenciales incorrectas");
    }
});

/* =========================
   LOGOUT
========================= */

window.logout = () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
};

/* =========================
   VIEWS
========================= */

const views = document.querySelectorAll(".view");

function showView(id) {
    views.forEach(v => v.style.display = "none");
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
}

document.getElementById("dashboardBtn")?.addEventListener("click", () => showView("dashboardView"));
document.getElementById("patientsBtn")?.addEventListener("click", () => showView("patientsView"));
document.getElementById("settingsBtn")?.addEventListener("click", () => showView("settingsView"));

/* =========================
   MODAL
========================= */

const modal = document.getElementById("patientModal");

document.getElementById("newPatientBtn")?.addEventListener("click", () => {
    modal.style.display = "flex";
});

document.getElementById("closeModal")?.addEventListener("click", () => {
    modal.style.display = "none";
});

window.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
};

/* =========================
   CREATE PATIENT
========================= */

document.getElementById("patientForm")?.addEventListener("submit", async (e) => {

    e.preventDefault();

    if (!currentUser) return;

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("patientEmail").value.trim();
    const password = document.getElementById("patientPassword").value.trim();

    try {

        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "users", cred.user.uid), {
            name,
            email,
            role: "patient",
            nutritionistId: currentUser.uid,

            weight: 0,
            height: 0,
            bmi: 0,

            notes: "",
            planUrl: "",
            history: [],

            createdAt: new Date()
        });

        modal.style.display = "none";
        e.target.reset();

        message("Paciente creado", "success");

    } catch (err) {
        console.log(err);
        message("Error creando paciente");
    }
});

/* =========================
   LOAD PATIENTS
========================= */

function loadPatients() {

    const container = document.getElementById("patientsList");
    if (!container) return;

    const q = query(collection(db, "users"));

    onSnapshot(q, (snap) => {

        container.innerHTML = "";

        let count = 0;

        snap.forEach((d) => {

            const p = d.data();

            if (p.role !== "patient") return;

            count++;

            const div = document.createElement("div");
            div.className = "patient-card";

            div.innerHTML = `
                <strong>${p.name || "Sin nombre"}</strong><br>
                <small>${p.email || ""}</small>
            `;

            div.onclick = () => {
                selectedPatient = { id: d.id, ...p };
                showPatient();
            };

            container.appendChild(div);
        });

        if (count === 0) {
            container.innerHTML = "<p>No hay pacientes</p>";
        }
    });
}

/* =========================
   PATIENT VIEW
========================= */

function showPatient() {

    const view = document.getElementById("patientView");
    if (!selectedPatient || !view) return;

    showView("patientView");

    const bmi = selectedPatient.weight && selectedPatient.height
        ? (selectedPatient.weight / ((selectedPatient.height / 100) ** 2)).toFixed(2)
        : 0;

    view.innerHTML = `
        <h1>${selectedPatient.name}</h1>
        <p>${selectedPatient.email}</p>

        <hr>

        <h3>Datos físicos</h3>
        <input id="weight" value="${selectedPatient.weight || ""}" placeholder="Peso">
        <input id="height" value="${selectedPatient.height || ""}" placeholder="Altura">
        <p><strong>IMC:</strong> ${bmi}</p>
        <button id="saveStatsBtn">Guardar</button>

        <hr>

        <h3>Plan</h3>
        <input id="planUrl" value="${selectedPatient.planUrl || ""}" placeholder="Plan">
        <button id="savePlanBtn">Guardar</button>

        <hr>

        <h3>Notas</h3>
        <textarea id="notes">${selectedPatient.notes || ""}</textarea>
        <button id="saveNotesBtn">Guardar</button>
    `;
}

/* =========================
   SAVE DATA
========================= */

document.addEventListener("click", async (e) => {

    if (!selectedPatient) return;

    const ref = doc(db, "users", selectedPatient.id);

    if (e.target.id === "saveStatsBtn") {

        const weight = Number(document.getElementById("weight").value);
        const height = Number(document.getElementById("height").value);

        const bmi = weight && height
            ? weight / ((height / 100) ** 2)
            : 0;

        await updateDoc(ref, { weight, height, bmi });

        message("Guardado", "success");
    }

    if (e.target.id === "savePlanBtn") {
        await updateDoc(ref, {
            planUrl: document.getElementById("planUrl").value
        });

        message("Plan guardado", "success");
    }

    if (e.target.id === "saveNotesBtn") {
        await updateDoc(ref, {
            notes: document.getElementById("notes").value
        });

        message("Notas guardadas", "success");
    }
});

/* =========================
   STATS REAL TIME
========================= */

function loadStats() {

    const q = query(collection(db, "users"));

    onSnapshot(q, (snap) => {

        let patients = 0;
        let plans = 0;
        let notes = 0;
        let bmiSum = 0;
        let bmiCount = 0;

        snap.forEach((d) => {

            const p = d.data();

            if (p.role !== "patient") return;

            patients++;

            if (p.planUrl && p.planUrl.trim() !== "") plans++;
            if (p.notes && p.notes.trim() !== "") notes++;

            if (p.weight && p.height) {
                const bmi = p.weight / ((p.height / 100) ** 2);
                if (!isNaN(bmi)) {
                    bmiSum += bmi;
                    bmiCount++;
                }
            }
        });

        document.getElementById("patientsCount").textContent = patients;
        document.getElementById("plansCount").textContent = plans;
        document.getElementById("notesCount").textContent = notes;
        document.getElementById("avgBmi").textContent =
            bmiCount ? (bmiSum / bmiCount).toFixed(1) : "0.0";
    });
}
document.getElementById("searchPatient")?.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase().trim();

    const cards = document.querySelectorAll(".patient-card");

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();

        if (text.includes(value)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
});