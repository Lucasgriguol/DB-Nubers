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
    inMemoryPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ========================================
// 🔥 LOG: INICIO DE LA APLICACIÓN
// ========================================

console.log("🚀 ========================================");
console.log("🚀 INICIANDO DB NUBERS - PANEL ADMIN");
console.log("🚀 ========================================");
console.log("📍 URL actual:", window.location.href);
console.log("📍 Pathname:", window.location.pathname);
console.log("📍 Hostname:", window.location.hostname);
console.log("=========================================");

// ========================================
// 🔥 FIX: LIMPIAR SESIÓN ANTERIOR
// ========================================

async function limpiarSesionFirebase() {
    console.log("🧹 Iniciando limpieza de sesión Firebase...");
    
    try {
        // LocalStorage
        const keys = Object.keys(localStorage);
        console.log("📦 Claves en localStorage:", keys.length);
        
        let eliminadas = 0;
        keys.forEach(key => {
            if (key.includes('firebase') || key.includes('auth') || key.includes('__session')) {
                localStorage.removeItem(key);
                console.log('🗑️ Eliminado localStorage:', key);
                eliminadas++;
            }
        });

        // SessionStorage
        const sessionKeys = Object.keys(sessionStorage);
        console.log("📦 Claves en sessionStorage:", sessionKeys.length);
        
        sessionKeys.forEach(key => {
            if (key.includes('firebase') || key.includes('auth') || key.includes('__session')) {
                sessionStorage.removeItem(key);
                console.log('🗑️ Eliminado sessionStorage:', key);
                eliminadas++;
            }
        });

        console.log(`✅ Sesión de Firebase limpiada (${eliminadas} elementos eliminados)`);
    } catch (error) {
        console.warn('⚠️ Error limpiando sesión:', error);
    }
}

// ========================================
// CONFIGURAR PERSISTENCIA
// ========================================

console.log("⚙️ Configurando persistencia de Firebase...");

try {
    await setPersistence(auth, inMemoryPersistence);
    console.log('✅ Persistencia configurada a "inMemory" (no guarda sesión)');
} catch (error) {
    console.error('❌ Error configurando persistencia:', error);
}

// Limpiar sesión anterior
await limpiarSesionFirebase();

console.log("=========================================");
console.log("⏳ Esperando eventos de autenticación...");
console.log("=========================================");

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
    console.log(`📨 Mensaje: ${text} (${type})`);
    const el = document.getElementById("message");
    if (!el) {
        console.warn("⚠️ Elemento #message no encontrado");
        return;
    }

    el.textContent = text;
    el.style.color = type === "success" ? "#2ecc71" : "#e74c3c";
}

// ========================================
// AUTH - ESTADO DE AUTENTICACIÓN
// ========================================

console.log("👤 Configurando listener de autenticación...");

onAuthStateChanged(auth, async (user) => {
    console.log("=========================================");
    console.log("🔔 onAuthStateChanged EJECUTADO");
    console.log("=========================================");
    console.log("👤 Usuario recibido:", user ? `UID: ${user.uid}` : "null");
    console.log("📍 Página actual:", window.location.pathname);
    
    const page = window.location.pathname.split("/").pop() || "index.html";
    console.log("📄 Nombre de página:", page);

    if (!user) {
        console.log("❌ No hay usuario autenticado");
        currentUser = null;
        currentUserData = null;

        console.log(`🔍 Verificando si debemos redirigir a login...`);
        console.log(`   - Página actual: "${page}"`);
        console.log(`   - ¿Es index.html? ${page === "index.html"}`);
        
        if (page !== "index.html") {
            console.log(`🔄 Redirigiendo a index.html desde "${page}"`);
            window.location.href = "index.html";
        } else {
            console.log("✅ Ya estamos en index.html, no redirigimos");
        }
        console.log("=========================================");
        return;
    }

    console.log("✅ Usuario autenticado correctamente");
    currentUser = user;
    console.log(`📧 Email: ${user.email}`);

    try {
        console.log("📡 Cargando datos del usuario desde Firestore...");
        const ref = doc(db, "users", user.uid);
        const docSnap = await getDoc(ref);
        
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            console.log("✅ Datos del usuario cargados:");
            console.log("   - Nombre:", currentUserData.name || "Sin nombre");
            console.log("   - Email:", currentUserData.email || "Sin email");
            console.log("   - Rol:", currentUserData.role || "Sin rol");
            console.log("   - ID:", user.uid);
        } else {
            console.warn("⚠️ El documento del usuario NO existe en Firestore");
            currentUserData = null;
        }

        console.log("=========================================");
        console.log("🔍 DECIDIENDO REDIRECCIÓN");
        console.log("=========================================");
        console.log(`📄 Página actual: "${page}"`);
        console.log(`🎭 Rol del usuario: "${currentUserData?.role || 'undefined'}"`);
        console.log(`🔗 ¿Es index.html? ${page === "index.html"}`);

        // REDIRECCIÓN DESDE INDEX.HTML
        if (page === "index.html") {
            console.log("🔄 Estamos en index.html, redirigiendo según rol...");
            
            if (currentUserData?.role === "patient") {
                console.log("🚀 Redirigiendo a patient-dashboard.html (rol: patient)");
                window.location.replace("patient-dashboard.html");
            } else if (currentUserData?.role === "admin" || currentUserData?.role === "nutritionist") {
                console.log("🚀 Redirigiendo a dashboard.html (rol:", currentUserData?.role, ")");
                window.location.replace("dashboard.html");
            } else {
                console.warn("⚠️ Rol desconocido o no definido:", currentUserData?.role);
                console.log("🔄 Redirigiendo a dashboard.html por defecto");
                window.location.replace("dashboard.html");
            }
            console.log("=========================================");
            return;
        }

        // REDIRECCIÓN DESDE OTRAS PÁGINAS
        if (page === "dashboard.html") {
            console.log("📊 Estamos en dashboard.html, cargando datos...");
            if (currentUserData?.role === "patient") {
                console.warn("⚠️ Un paciente está en dashboard.html, redirigiendo a patient-dashboard.html");
                window.location.replace("patient-dashboard.html");
                return;
            }
            loadPatients();
            loadStats();
            console.log("✅ Dashboard cargado correctamente");
        } else if (page === "patient-dashboard.html") {
            console.log("👤 Estamos en patient-dashboard.html");
            if (currentUserData?.role !== "patient") {
                console.warn("⚠️ Un no-paciente está en patient-dashboard.html, redirigiendo a dashboard.html");
                window.location.replace("dashboard.html");
                return;
            }
            console.log("✅ Portal del paciente cargado correctamente");
        } else {
            console.log(`📄 Página actual: "${page}" - No se requiere redirección especial`);
        }

        console.log("=========================================");

    } catch (error) {
        console.error("❌ Error en onAuthStateChanged:", error);
        console.error("   - Mensaje:", error.message);
        console.error("   - Stack:", error.stack);
        console.log("=========================================");
    }
});

console.log("✅ Listener de autenticación configurado");

// ========================================
// LOGIN
// ========================================

console.log("🔑 Configurando formulario de login...");

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    console.log("=========================================");
    console.log("🔐 INTENTO DE LOGIN");
    console.log("=========================================");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    console.log(`📧 Email ingresado: ${email}`);
    console.log(`🔑 Contraseña: ${password ? "****" : "vacía"}`);

    if (!email || !password) {
        console.warn("⚠️ Email o contraseña vacíos");
        message("Por favor, completa todos los campos");
        console.log("=========================================");
        return;
    }

    try {
        console.log("📡 Enviando petición a Firebase Authentication...");
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login EXITOSO");
        console.log(`   - UID: ${result.user.uid}`);
        console.log(`   - Email: ${result.user.email}`);
        console.log(`   - Email verificado: ${result.user.emailVerified}`);

        // Cargar datos del usuario
        console.log("📡 Cargando datos del usuario logueado...");
        const ref = doc(db, "users", result.user.uid);
        const docSnap = await getDoc(ref);
        
        if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log("✅ Datos del usuario:");
            console.log(`   - Nombre: ${userData.name || "Sin nombre"}`);
            console.log(`   - Rol: ${userData.role || "Sin rol"}`);
            
            console.log("🔄 Redirigiendo según rol...");
            if (userData.role === "patient") {
                console.log("🚀 Redirigiendo a patient-dashboard.html");
                window.location.replace("patient-dashboard.html");
            } else {
                console.log("🚀 Redirigiendo a dashboard.html");
                window.location.replace("dashboard.html");
            }
        } else {
            console.warn("⚠️ El usuario no tiene documento en Firestore");
            console.log("🔄 Redirigiendo a dashboard.html por defecto");
            window.location.replace("dashboard.html");
        }
        
        console.log("=========================================");

    } catch (err) {
        console.error("❌ Error de login:");
        console.error(`   - Código: ${err.code}`);
        console.error(`   - Mensaje: ${err.message}`);
        console.log("=========================================");
        message("Credenciales incorrectas");
    }
});

console.log("✅ Formulario de login configurado");

// ========================================
// LOGOUT
// ========================================

window.logout = () => {
    console.log("=========================================");
    console.log("🚪 CERRANDO SESIÓN");
    console.log("=========================================");
    signOut(auth).then(() => {
        console.log("✅ Sesión cerrada correctamente");
        console.log("🔄 Redirigiendo a index.html");
        window.location.href = "index.html";
    }).catch(err => {
        console.error("❌ Error al cerrar sesión:", err);
    });
};

// ========================================
// VIEWS
// ========================================

console.log("📱 Configurando vistas...");

const views = document.querySelectorAll(".view");
console.log(`📄 Vistas encontradas: ${views.length}`);

function showView(id) {
    console.log(`📱 Mostrando vista: ${id}`);
    views.forEach(v => v.style.display = "none");
    const el = document.getElementById(id);
    if (el) {
        el.style.display = "block";
        console.log(`✅ Vista ${id} mostrada`);
    } else {
        console.warn(`⚠️ Vista ${id} no encontrada`);
    }
}

document.getElementById("dashboardBtn")?.addEventListener("click", () => {
    console.log("🖱️ Click en botón Dashboard");
    showView("dashboardView");
});
document.getElementById("patientsBtn")?.addEventListener("click", () => {
    console.log("🖱️ Click en botón Pacientes");
    showView("patientsView");
});
document.getElementById("settingsBtn")?.addEventListener("click", () => {
    console.log("🖱️ Click en botón Configuración");
    showView("settingsView");
});

console.log("✅ Vistas configuradas");

// ========================================
// MODAL
// ========================================

console.log("🪟 Configurando modal...");

const modal = document.getElementById("patientModal");
if (modal) {
    console.log("✅ Modal encontrado");
} else {
    console.warn("⚠️ Modal #patientModal no encontrado");
}

document.getElementById("newPatientBtn")?.addEventListener("click", () => {
    console.log("🖱️ Click en Nuevo Paciente - Abriendo modal");
    if (modal) modal.style.display = "flex";
});

document.getElementById("closeModal")?.addEventListener("click", () => {
    console.log("🖱️ Click en cerrar modal");
    if (modal) modal.style.display = "none";
});

window.onclick = (e) => {
    if (e.target === modal) {
        console.log("🖱️ Click fuera del modal - Cerrando");
        if (modal) modal.style.display = "none";
    }
};

console.log("✅ Modal configurado");

// ========================================
// CREATE PATIENT
// ========================================

console.log("👤 Configurando creación de pacientes...");

document.getElementById("patientForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    console.log("=========================================");
    console.log("➕ CREANDO NUEVO PACIENTE");
    console.log("=========================================");

    if (!currentUser) {
        console.error("❌ No hay usuario autenticado para crear paciente");
        message("Debes iniciar sesión primero");
        console.log("=========================================");
        return;
    }

    console.log(`👤 Nutricionista: ${currentUser.uid}`);

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("patientEmail").value.trim();
    const password = document.getElementById("patientPassword").value.trim();

    console.log(`📧 Email del nuevo paciente: ${email}`);
    console.log(`👤 Nombre: ${name}`);

    if (!name || !email || !password) {
        console.warn("⚠️ Faltan campos obligatorios");
        message("Completa todos los campos");
        console.log("=========================================");
        return;
    }

    try {
        console.log("📡 Creando usuario en Firebase Authentication...");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log("✅ Usuario creado en Authentication:", cred.user.uid);

        console.log("📡 Creando documento en Firestore...");
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
        console.log("✅ Documento creado en Firestore");

        modal.style.display = "none";
        e.target.reset();

        console.log("✅ Paciente creado exitosamente");
        message("Paciente creado correctamente", "success");
        console.log("=========================================");

    } catch (err) {
        console.error("❌ Error creando paciente:");
        console.error(`   - Código: ${err.code}`);
        console.error(`   - Mensaje: ${err.message}`);
        message("Error creando paciente: " + err.message);
        console.log("=========================================");
    }
});

console.log("✅ Creación de pacientes configurada");

// ========================================
// LOAD PATIENTS
// ========================================

function loadPatients() {
    console.log("📋 Cargando lista de pacientes...");
    
    const container = document.getElementById("patientsList");
    if (!container) {
        console.warn("⚠️ #patientsList no encontrado");
        return;
    }

    const q = query(collection(db, "users"));
    console.log("📡 Escuchando cambios en colección 'users'...");

    onSnapshot(q, (snap) => {
        console.log(`📋 Snapshots recibidos: ${snap.size} documentos`);
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
                console.log(`🖱️ Click en paciente: ${p.name || "Sin nombre"} (${d.id})`);
                selectedPatient = { id: d.id, ...p };
                showPatient();
            };

            container.appendChild(div);
        });

        console.log(`✅ ${count} pacientes cargados`);
        if (count === 0) {
            container.innerHTML = "<p class='empty'>No hay pacientes registrados.</p>";
        }
    });
}

console.log("✅ Función loadPatients definida");

// ========================================
// DELETE PATIENT
// ========================================

async function deletePatient(patientId, patientName, patientEmail) {
    console.log("=========================================");
    console.log("🗑️ ELIMINANDO PACIENTE");
    console.log("=========================================");
    console.log(`   - ID: ${patientId}`);
    console.log(`   - Nombre: ${patientName}`);
    console.log(`   - Email: ${patientEmail}`);

    if (!confirm(`¿Estás seguro de eliminar al paciente "${patientName}"?\n\nEmail: ${patientEmail}\n\nEsta acción no se puede deshacer y eliminará:\n• Todos los datos del paciente\n• La cuenta de acceso del paciente`)) {
        console.log("❌ Eliminación cancelada por el usuario");
        console.log("=========================================");
        return false;
    }

    try {
        // Intentar eliminar de Authentication
        console.log("📡 Intentando eliminar de Authentication...");
        try {
            if (auth.currentUser && auth.currentUser.uid === patientId) {
                await deleteUser(auth.currentUser);
                console.log("✅ Usuario eliminado de Authentication");
            } else {
                console.warn("⚠️ No se puede eliminar a otro usuario de Authentication desde el frontend");
                message("Paciente eliminado de Firestore. Para eliminar también de Authentication, usa el panel de Firebase.", "warning");
            }
        } catch (authError) {
            console.warn("⚠️ Error al eliminar de Authentication:", authError);
        }

        // Eliminar de Firestore
        console.log("📡 Eliminando documento de Firestore...");
        await deleteDoc(doc(db, "users", patientId));
        console.log("✅ Documento eliminado de Firestore");
        
        message(`Paciente "${patientName}" eliminado correctamente`, "success");
        console.log("✅ Paciente eliminado exitosamente");
        console.log("=========================================");
        return true;

    } catch (err) {
        console.error("❌ Error al eliminar:");
        console.error(`   - Mensaje: ${err.message}`);
        console.log("=========================================");
        message(`Error: ${err.message}`, "error");
        return false;
    }
}

console.log("✅ Función deletePatient definida");

// ========================================
// SHOW PATIENT
// ========================================

function showPatient() {
    console.log("👤 Mostrando detalle del paciente...");
    const view = document.getElementById("patientView");
    if (!selectedPatient || !view) {
        console.warn("⚠️ No hay paciente seleccionado o vista no encontrada");
        return;
    }

    console.log(`   - ID: ${selectedPatient.id}`);
    console.log(`   - Nombre: ${selectedPatient.name || "Sin nombre"}`);

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
            <!-- Datos personales -->
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

            <!-- Antropometría básica -->
            <div class="measure-group">
                <h3 style="margin-top:0;">📏 Antropometría básica</h3>
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
                    <input type="text" id="bmi" value="${bmi}" readonly style="background:#f0f2f5;">
                </label>
            </div>

            <!-- Perímetros -->
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

            <!-- Composición corporal (kg) -->
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

            <!-- Composición corporal (%) -->
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

            <!-- Índices y sumatorias -->
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

    // Evento para eliminar paciente
    document.getElementById("deletePatientBtn")?.addEventListener("click", async () => {
        console.log("🖱️ Click en Eliminar Paciente");
        const success = await deletePatient(p.id, p.name, p.email);
        if (success) {
            showView("patientsView");
            selectedPatient = null;
        }
    });
}

console.log("✅ Función showPatient definida");

// ========================================
// GUARDAR DATOS
// ========================================

console.log("💾 Configurando guardado de datos...");

document.addEventListener("click", async (e) => {
    if (!selectedPatient) return;

    const ref = doc(db, "users", selectedPatient.id);

    if (e.target.id === "saveStatsBtn") {
        console.log("💾 Guardando medidas del paciente...");
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
            console.log("✅ Medidas guardadas correctamente:", updates);
            message("✅ Medidas actualizadas correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar medidas:", err);
            message("Error al guardar medidas: " + err.message);
        }
    }

    if (e.target.id === "savePlanBtn") {
        console.log("💾 Guardando plan nutricional...");
        const planUrl = document.getElementById("planUrl").value.trim();
        try {
            await updateDoc(ref, { planUrl });
            console.log("✅ Plan guardado:", planUrl);
            message("✅ Plan guardado correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar plan:", err);
            message("Error al guardar plan: " + err.message);
        }
    }

    if (e.target.id === "saveNotesBtn") {
        console.log("💾 Guardando notas clínicas...");
        const notes = document.getElementById("notes").value.trim();
        try {
            await updateDoc(ref, { notes });
            console.log("✅ Notas guardadas:", notes.substring(0, 50) + "...");
            message("✅ Notas guardadas correctamente", "success");
        } catch (err) {
            console.error("❌ Error al guardar notas:", err);
            message("Error al guardar notas: " + err.message);
        }
    }
});

console.log("✅ Guardado de datos configurado");

// ========================================
// ESTADÍSTICAS
// ========================================

function loadStats() {
    console.log("📊 Cargando estadísticas...");
    
    const q = query(collection(db, "users"));

    onSnapshot(q, (snap) => {
        console.log(`📊 Snapshot de estadísticas: ${snap.size} documentos`);

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

        console.log(`📊 Estadísticas actualizadas: ${patients} pacientes, ${plans} planes, ${notes} notas, ${bmiCount} IMCs`);
    });
}

console.log("✅ Función loadStats definida");

// ========================================
// BÚSQUEDA
// ========================================

console.log("🔍 Configurando búsqueda de pacientes...");

document.getElementById("searchPatient")?.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase().trim();
    console.log(`🔍 Buscando: "${value}"`);
    
    const cards = document.querySelectorAll(".patient-card");
    let encontrados = 0;

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const visible = text.includes(value);
        card.style.display = visible ? "block" : "none";
        if (visible) encontrados++;
    });
    
    console.log(`🔍 Resultados: ${encontrados} pacientes encontrados`);
});

console.log("✅ Búsqueda configurada");

// ========================================
// INICIALIZACIÓN COMPLETA
// ========================================

console.log("=========================================");
console.log("✅ DB Nubers - Panel de administración CARGADO COMPLETAMENTE");
console.log("=========================================");
console.log("📊 Esperando autenticación...");
console.log("=========================================");