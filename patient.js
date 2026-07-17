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
        const bmiClassificationEl = document.getElementById("bmiClassification");

        if (weightEl) weightEl.textContent = data.weight ?? "--";
        if (heightEl) heightEl.textContent = data.height ?? "--";

        const bmi = data.weight && data.height
            ? (data.weight / ((data.height / 100) ** 2)).toFixed(1)
            : "--";

        if (bmiEl) bmiEl.textContent = bmi;

        // Clasificación del IMC dentro de la misma card
        if (bmiClassificationEl && bmi !== "--") {
            const classification = getIMCClassification(parseFloat(bmi));
            bmiClassificationEl.textContent = classification.text;
            bmiClassificationEl.style.color = classification.color;
        } else if (bmiClassificationEl) {
            bmiClassificationEl.textContent = "--";
            bmiClassificationEl.style.color = '#95a5a6';
        }

        /* =========================
           INFO PERFIL
        ========================= */

        const info = document.getElementById("patientData");

        if (info) {
            info.innerHTML = `
                <p><strong>Nombre:</strong> ${data.name || "Sin nombre"}</p>
                <p><strong>Email:</strong> ${data.email || "Sin email"}</p>
                <p><strong>Estado:</strong> Activo</p>
                <p><strong>Nutricionista ID:</strong> ${data.nutritionistId || "No asignado"}</p>
            `;
        }

        /* =========================
           NOTAS DEL NUTRICIONISTA
        ========================= */

        const notesContainer = document.getElementById("notesContainer");

        if (notesContainer) {
            if (data.notes && data.notes.trim() !== "") {
                const formattedNotes = data.notes.replace(/\n/g, '<br>');
                notesContainer.innerHTML = `
                    <div style="background:#f8f9fc; padding:1rem; border-radius:8px; border-left:4px solid #3498db;">
                        <p style="margin:0; white-space:pre-wrap; line-height:1.6;">${formattedNotes}</p>
                        <p style="margin:0.5rem 0 0 0; font-size:0.8rem; color:#8e9aaf;">
                            📅 Última actualización: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                `;
            } else {
                notesContainer.innerHTML = `
                    <p class="empty">No hay notas disponibles.</p>
                    <p style="color:#60697E; font-size:0.9rem;">
                        Tu nutricionista agregará notas importantes sobre tu evolución aquí.
                    </p>
                `;
            }
        }

        /* =========================
           PLAN NUTRICIONAL
        ========================= */

        const plan = document.getElementById("planContainer");

        if (plan) {

            if (data.planUrl && data.planUrl.trim() !== "") {
                plan.innerHTML = `
                    <a href="${data.planUrl}" target="_blank" style="display:inline-block; background:#2ecc71; color:white; padding:0.8rem 1.5rem; border-radius:8px; text-decoration:none; font-weight:600;">
                        📄 Abrir plan nutricional
                    </a>
                    <p style="margin-top:0.5rem; color:#60697E; font-size:0.9rem;">
                        Haz clic para ver tu plan asignado por el nutricionista.
                    </p>
                `;
            } else {
                plan.innerHTML = `
                    <p class="empty">Todavía no tienes un plan nutricional asignado.</p>
                    <p style="color:#60697E; font-size:0.9rem;">
                        Tu nutricionista te asignará un plan personalizado pronto.
                    </p>
                `;
            }
        }

        /* =========================
           MEDIDAS COMPLETAS
        ========================= */

        // Datos personales
        document.getElementById("displayBirthDate").textContent = data.birthDate || "--";
        document.getElementById("displayAge").textContent = data.age || "--";

        // Perímetros
        document.getElementById("displayWaistMax").textContent = data.waistMax ? `${data.waistMax} cm` : "--";
        document.getElementById("displayWaistMin").textContent = data.waistMin ? `${data.waistMin} cm` : "--";
        document.getElementById("displayHip").textContent = data.hip ? `${data.hip} cm` : "--";
        document.getElementById("displayArmFlexed").textContent = data.armFlexed ? `${data.armFlexed} cm` : "--";
        document.getElementById("displayThighMid").textContent = data.thighMid ? `${data.thighMid} cm` : "--";
        document.getElementById("displayCalf").textContent = data.calf ? `${data.calf} cm` : "--";

        // Composición corporal (kg)
        document.getElementById("displayFatMassKg").textContent = data.fatMassKg ? `${data.fatMassKg} kg` : "--";
        document.getElementById("displayMuscleMassKg").textContent = data.muscleMassKg ? `${data.muscleMassKg} kg` : "--";
        document.getElementById("displayBoneMassKg").textContent = data.boneMassKg ? `${data.boneMassKg} kg` : "--";

        // Composición corporal (%)
        document.getElementById("displayMusclePercent").textContent = data.musclePercent ? `${data.musclePercent}%` : "--";
        document.getElementById("displayFatPercent").textContent = data.fatPercent ? `${data.fatPercent}%` : "--";
        document.getElementById("displayBonePercent").textContent = data.bonePercent ? `${data.bonePercent}%` : "--";
        document.getElementById("displayResidualPercent").textContent = data.residualPercent ? `${data.residualPercent}%` : "--";

        // Índices y sumatorias
        document.getElementById("displaySkinfoldsSum").textContent = data.skinfoldsSum ? `${data.skinfoldsSum} mm` : "--";
        document.getElementById("displayMuscleBoneIndex").textContent = data.muscleBoneIndex || "--";
        document.getElementById("displayWaistHipIndex").textContent = data.waistHipIndex || "--";
        document.getElementById("displayMuscleFatIndex").textContent = data.muscleFatIndex || "--";
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

console.log("✅ DB Nubers - Portal del Paciente cargado");