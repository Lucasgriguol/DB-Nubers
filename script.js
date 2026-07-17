import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    deleteUser,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
// ========================================
// CLASIFICACIÓN DEL IMC
// ========================================

function getIMCClassification(bmi) {
    if (bmi < 18.5) {
        return { text: 'Bajo Peso', color: '#f39c12' };
    } else if (bmi >= 18.5 && bmi <= 24.99) {
        return { text: 'Peso Saludable', color: '#2ecc71' };
    } else if (bmi >= 25 && bmi <= 29.99) {
        return { text: 'Sobrepeso', color: '#e67e22' };
    } else if (bmi >= 30) {
        return { text: 'Obesidad', color: '#e74c3c' };
    } else {
        return { text: '--', color: '#95a5a6' };
    }
}
// ========================================
// LIMPIAR SESIÓN ANTERIOR
// ========================================

async function limpiarSesionFirebase() {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes('firebase') || key.includes('auth') || key.includes('__session')) {
                localStorage.removeItem(key);
            }
        });

        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach(key => {
            if (key.includes('firebase') || key.includes('auth') || key.includes('__session')) {
                sessionStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.warn('⚠️ Error limpiando sesión:', error);
    }
}

// ========================================
// CONFIGURAR PERSISTENCIA
// ========================================

try {
    await setPersistence(auth, browserLocalPersistence);
} catch (error) {
    console.error('❌ Error configurando persistencia:', error);
}

await limpiarSesionFirebase();

// ========================================
// STATE
// ========================================

let currentUser = null;
let currentUserData = null;
let selectedPatient = null;

// ========================================
// MESSAGE
// ========================================

function message(text, type = "error") {
    const el = document.getElementById("message");
    if (!el) return;

    el.textContent = text;
    el.style.color = type === "success" ? "#2ecc71" : "#e74c3c";
}

// ========================================
// AUTH - ESTADO DE AUTENTICACIÓN
// ========================================

onAuthStateChanged(auth, async (user) => {
    const page = window.location.pathname.split("/").pop() || "index.html";

    if (!user) {
        currentUser = null;
        currentUserData = null;

        if (page !== "index.html") {
            window.location.href = "index.html";
        }
        return;
    }

    currentUser = user;

    try {
        const ref = doc(db, "users", user.uid);
        const docSnap = await getDoc(ref);

        if (docSnap.exists()) {
            currentUserData = docSnap.data();
        } else {
            currentUserData = null;
        }

        // REDIRECCIÓN DESDE INDEX.HTML
        if (page === "index.html") {
            if (currentUserData?.role === "patient") {
                window.location.href = "patient-dashboard.html";
            } else {
                window.location.href = "dashboard.html";
            }
            return;
        }

        // REDIRECCIÓN DESDE OTRAS PÁGINAS
        if (page === "dashboard.html") {
            if (currentUserData?.role === "patient") {
                window.location.href = "patient-dashboard.html";
                return;
            }
            loadPatients();
            loadStats();
        } else if (page === "patient-dashboard.html") {
            if (currentUserData?.role !== "patient") {
                window.location.href = "dashboard.html";
                return;
            }
        }

    } catch (error) {
        console.error("❌ Error en autenticación:", error);
    }
});

// ========================================
// LOGIN
// ========================================

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        message("Por favor, completa todos los campos");
        return;
    }

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);

        const ref = doc(db, "users", result.user.uid);
        const docSnap = await getDoc(ref);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.role === "patient") {
                window.location.href = "patient-dashboard.html";
            } else {
                window.location.href = "dashboard.html";
            }
        } else {
            window.location.href = "dashboard.html";
        }

    } catch (err) {
        let mensaje = "Credenciales incorrectas";
        if (err.code === "auth/user-not-found") {
            mensaje = "Usuario no encontrado";
        } else if (err.code === "auth/wrong-password") {
            mensaje = "Contraseña incorrecta";
        } else if (err.code === "auth/too-many-requests") {
            mensaje = "Demasiados intentos, espera un momento";
        } else if (err.code === "auth/unauthorized-domain") {
            mensaje = "Dominio no autorizado. Contacta al administrador.";
        }
        message(mensaje);
    }
});

// ========================================
// LOGOUT
// ========================================

window.logout = () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    }).catch(err => {
        console.error("❌ Error al cerrar sesión:", err);
    });
};

// ========================================
// VIEWS
// ========================================

const views = document.querySelectorAll(".view");

function showView(id) {
    views.forEach(v => v.style.display = "none");
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
}

document.getElementById("dashboardBtn")?.addEventListener("click", () => showView("dashboardView"));
document.getElementById("patientsBtn")?.addEventListener("click", () => showView("patientsView"));
document.getElementById("settingsBtn")?.addEventListener("click", () => showView("settingsView"));

// ========================================
// MODAL
// ========================================

const modal = document.getElementById("patientModal");

document.getElementById("newPatientBtn")?.addEventListener("click", () => {
    if (modal) modal.style.display = "flex";
});

document.getElementById("closeModal")?.addEventListener("click", () => {
    if (modal) modal.style.display = "none";
});

window.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
};

// ========================================
// CREATE PATIENT
// ========================================

document.getElementById("patientForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser) {
        message("Debes iniciar sesión primero");
        return;
    }

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("patientEmail").value.trim();
    const password = document.getElementById("patientPassword").value.trim();

    if (!name || !email || !password) {
        message("Completa todos los campos");
        return;
    }

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

            birthDate: "",
            age: 0,
            waistMax: 0,
            waistMin: 0,
            hip: 0,
            armFlexed: 0,
            thighMid: 0,
            calf: 0,

            fatMassKg: 0,
            muscleMassKg: 0,
            boneMassKg: 0,

            musclePercent: 0,
            fatPercent: 0,
            bonePercent: 0,
            residualPercent: 0,

            skinfoldsSum: 0,
            muscleBoneIndex: 0,
            waistHipIndex: 0,
            muscleFatIndex: 0,

            notes: "",
            planUrl: "",
            history: [],
            createdAt: new Date()
        });

        modal.style.display = "none";
        e.target.reset();
        message("Paciente creado correctamente", "success");

    } catch (err) {
        console.error("❌ Error creando paciente:", err);
        message("Error creando paciente: " + err.message);
    }
});

// ========================================
// LOAD PATIENTS
// ========================================

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
            container.innerHTML = "<p class='empty'>No hay pacientes registrados.</p>";
        }
    });
}

// ========================================
// DELETE PATIENT
// ========================================

async function deletePatient(patientId, patientName, patientEmail) {
    if (!confirm(`¿Estás seguro de eliminar al paciente "${patientName}"?\n\nEmail: ${patientEmail}\n\nEsta acción no se puede deshacer y eliminará:\n• Todos los datos del paciente\n• La cuenta de acceso del paciente`)) {
        return false;
    }

    try {
        try {
            if (auth.currentUser && auth.currentUser.uid === patientId) {
                await deleteUser(auth.currentUser);
            }
        } catch (authError) {
            // Ignorar error de Authentication
        }

        await deleteDoc(doc(db, "users", patientId));
        message(`Paciente "${patientName}" eliminado correctamente`, "success");
        return true;

    } catch (err) {
        console.error("❌ Error al eliminar:", err);
        message(`Error: ${err.message}`, "error");
        return false;
    }
}

// ========================================
// SHOW PATIENT
// ========================================

function showPatient() {
    const view = document.getElementById("patientView");
    if (!selectedPatient || !view) return;

    showView("patientView");

    const p = selectedPatient;
    const bmi = p.weight && p.height
        ? (p.weight / ((p.height / 100) ** 2)).toFixed(2)
        : "";

    view.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
            <div>
                <h1 style="margin:0;">${p.name || "Sin nombre"}</h1>
                <p style="margin:0.25rem 0; color:#60697E;">${p.email || ""}</p>
                <p style="margin:0.25rem 0; font-size:0.9rem; color:#8e9aaf;">
                    ID: ${p.id}
                </p>
            </div>
            <button id="deletePatientBtn" style="background:#e74c3c; color:white; border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">
                🗑️ Eliminar paciente
            </button>
        </div>

        <hr style="margin:1rem 0;">

        <div class="measurements-grid">
            <div class="measure-group">
                <h3 style="margin-top:0;">📋 Datos personales</h3>
                <label>
                    <span>Fecha de nacimiento</span>
                    <input type="date" id="birthDate" value="${p.birthDate || ""}">
                </label>
                <label>
                    <span>Edad (años)</span>
                    <input type="number" id="age" value="${p.age || ""}" step="1" min="0">
                </label>
            </div>

            <div class="measure-group">
                <h3 style="margin-top:0;">📏 Medidas básica</h3>
                <label>
                    <span>Talla (cm)</span>
                    <input type="number" id="height" value="${p.height || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Peso (kg)</span>
                    <input type="number" id="weight" value="${p.weight || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>IMC</span>
                    <input type="text" id="bmi" value="${bmi}" readonly style="background:#f0f2f5; width:40%;">
                </label>
                <label>
                    <span>Clasificación</span>
                    <input type="text" id="bmiClassification" value="${bmi ? getIMCClassification(parseFloat(bmi)).text : '--'}" readonly style="background:#f0f2f5; color:${bmi ? getIMCClassification(parseFloat(bmi)).color : '#95a5a6'}; font-weight:600; width:40%;">
                </label>
            </div>

            <div class="measure-group">
                <h3 style="margin-top:0;">📐 Perímetros (cm)</h3>
                <label>
                    <span>Cintura máxima</span>
                    <input type="number" id="waistMax" value="${p.waistMax || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Cintura mínima</span>
                    <input type="number" id="waistMin" value="${p.waistMin || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Caderas</span>
                    <input type="number" id="hip" value="${p.hip || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Brazo flexionado</span>
                    <input type="number" id="armFlexed" value="${p.armFlexed || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Muslo medio</span>
                    <input type="number" id="thighMid" value="${p.thighMid || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Pantorrilla</span>
                    <input type="number" id="calf" value="${p.calf || ""}" step="0.1" min="0">
                </label>
            </div>

            <div class="measure-group">
                <h3 style="margin-top:0;">⚖️ Composición corporal (kg)</h3>
                <label>
                    <span>Masa grasa</span>
                    <input type="number" id="fatMassKg" value="${p.fatMassKg || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Masa muscular</span>
                    <input type="number" id="muscleMassKg" value="${p.muscleMassKg || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Masa ósea</span>
                    <input type="number" id="boneMassKg" value="${p.boneMassKg || ""}" step="0.1" min="0">
                </label>
            </div>

            <div class="measure-group">
                <h3 style="margin-top:0;">📊 Composición corporal (%)</h3>
                <label>
                    <span>% Masa muscular</span>
                    <input type="number" id="musclePercent" value="${p.musclePercent || ""}" step="0.1" min="0" max="100">
                </label>
                <label>
                    <span>% Masa adiposa</span>
                    <input type="number" id="fatPercent" value="${p.fatPercent || ""}" step="0.1" min="0" max="100">
                </label>
                <label>
                    <span>% Masa ósea</span>
                    <input type="number" id="bonePercent" value="${p.bonePercent || ""}" step="0.1" min="0" max="100">
                </label>
                <label>
                    <span>% Residual y piel</span>
                    <input type="number" id="residualPercent" value="${p.residualPercent || ""}" step="0.1" min="0" max="100">
                </label>
            </div>

            <div class="measure-group">
                <h3 style="margin-top:0;">🧮 Índices y sumatorias</h3>
                <label>
                    <span>Sumatoria 6 pliegues</span>
                    <input type="number" id="skinfoldsSum" value="${p.skinfoldsSum || ""}" step="0.1" min="0">
                </label>
                <label>
                    <span>Índice Músculo-Óseo</span>
                    <input type="number" id="muscleBoneIndex" value="${p.muscleBoneIndex || ""}" step="0.01" min="0">
                </label>
                <label>
                    <span>Índice Cintura-Cadera</span>
                    <input type="number" id="waistHipIndex" value="${p.waistHipIndex || ""}" step="0.01" min="0">
                </label>
                <label>
                    <span>Índice Músculo-Adiposo</span>
                    <input type="number" id="muscleFatIndex" value="${p.muscleFatIndex || ""}" step="0.01" min="0">
                </label>
            </div>
        </div>

        <div style="display:flex; gap:1rem; flex-wrap:wrap; margin:1.5rem 0;">
            <button id="saveStatsBtn" style="background:#2ecc71; color:white; border:none; padding:0.7rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600;">
                💾 Guardar todas las medidas
            </button>
        </div>

        <hr style="margin:1.5rem 0;">

        <h3 style="margin-top:0;">📄 Plan nutricional</h3>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <input id="planUrl" value="${p.planUrl || ""}" placeholder="URL del plan (ej: Google Drive, PDF)" style="flex:1; padding:0.5rem; border:1px solid #d0d7e2; border-radius:6px; min-width:200px;">
            <button id="savePlanBtn" style="background:#3498db; color:white; border:none; padding:0.5rem 1.2rem; border-radius:6px; cursor:pointer;">
                Guardar Plan
            </button>
        </div>

        <hr style="margin:1.5rem 0;">

        <h3 style="margin-top:0;">📝 Notas clínicas</h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <textarea id="notes" rows="4" style="width:100%; padding:0.5rem; border:1px solid #d0d7e2; border-radius:6px; font-family:inherit; resize:vertical;">${p.notes || ""}</textarea>
            <button id="saveNotesBtn" style="background:#3498db; color:white; border:none; padding:0.5rem 1.2rem; border-radius:6px; cursor:pointer; align-self:flex-start;">
                Guardar Notas
            </button>
        </div>
    `;

    document.getElementById("deletePatientBtn")?.addEventListener("click", async () => {
        const success = await deletePatient(p.id, p.name, p.email);
        if (success) {
            showView("patientsView");
            selectedPatient = null;
        }
    });
}

// ========================================
// GUARDAR DATOS
// ========================================

document.addEventListener("click", async (e) => {
    if (!selectedPatient) return;

    const ref = doc(db, "users", selectedPatient.id);

    if (e.target.id === "saveStatsBtn") {
        const weight = parseFloat(document.getElementById("weight").value) || 0;
        const height = parseFloat(document.getElementById("height").value) || 0;
        const bmi = weight && height ? weight / ((height / 100) ** 2) : 0;

        const updates = {
            weight,
            height,
            bmi,
            birthDate: document.getElementById("birthDate").value || "",
            age: parseInt(document.getElementById("age").value) || 0,
            waistMax: parseFloat(document.getElementById("waistMax").value) || 0,
            waistMin: parseFloat(document.getElementById("waistMin").value) || 0,
            hip: parseFloat(document.getElementById("hip").value) || 0,
            armFlexed: parseFloat(document.getElementById("armFlexed").value) || 0,
            thighMid: parseFloat(document.getElementById("thighMid").value) || 0,
            calf: parseFloat(document.getElementById("calf").value) || 0,
            fatMassKg: parseFloat(document.getElementById("fatMassKg").value) || 0,
            muscleMassKg: parseFloat(document.getElementById("muscleMassKg").value) || 0,
            boneMassKg: parseFloat(document.getElementById("boneMassKg").value) || 0,
            musclePercent: parseFloat(document.getElementById("musclePercent").value) || 0,
            fatPercent: parseFloat(document.getElementById("fatPercent").value) || 0,
            bonePercent: parseFloat(document.getElementById("bonePercent").value) || 0,
            residualPercent: parseFloat(document.getElementById("residualPercent").value) || 0,
            skinfoldsSum: parseFloat(document.getElementById("skinfoldsSum").value) || 0,
            muscleBoneIndex: parseFloat(document.getElementById("muscleBoneIndex").value) || 0,
            waistHipIndex: parseFloat(document.getElementById("waistHipIndex").value) || 0,
            muscleFatIndex: parseFloat(document.getElementById("muscleFatIndex").value) || 0
        };

        try {
            await updateDoc(ref, updates);
            message("✅ Medidas actualizadas correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar medidas:", err);
            message("Error al guardar medidas: " + err.message);
        }
    }

    if (e.target.id === "savePlanBtn") {
        const planUrl = document.getElementById("planUrl").value.trim();
        try {
            await updateDoc(ref, { planUrl });
            message("✅ Plan guardado correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar plan:", err);
            message("Error al guardar plan: " + err.message);
        }
    }

    if (e.target.id === "saveNotesBtn") {
        const notes = document.getElementById("notes").value.trim();
        try {
            await updateDoc(ref, { notes });
            message("✅ Notas guardadas correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar notas:", err);
            message("Error al guardar notas: " + err.message);
        }
    }
});

// ========================================
// ESTADÍSTICAS
// ========================================

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
                if (!isNaN(bmi) && isFinite(bmi)) {
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

// ========================================
// BÚSQUEDA
// ========================================

document.getElementById("searchPatient")?.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll(".patient-card");

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(value) ? "block" : "none";
    });
});