/*
Nombre del archivo: carr.firebase.js
Ubicación: carreras/backend/carr.firebase.js
Función:
- Inicializar Firebase
- Inicializar Firestore
- Exportar app y db para el resto del módulo
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const carrFirebaseConfig = {
  apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
  authDomain: "utet-4387a.firebaseapp.com",
  projectId: "utet-4387a",
  storageBucket: "utet-4387a.firebasestorage.app",
  messagingSenderId: "902848131454",
  appId: "1:902848131454:web:47f515eb6480834724c32f"
};

const carrApp = initializeApp(carrFirebaseConfig);
const carrDb = getFirestore(carrApp);

export { carrApp, carrDb };