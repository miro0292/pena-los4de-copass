import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Reemplazá estos valores por los que te da Firebase Console:
// ⚙️ Configuración del proyecto → Tus apps → ícono web </>
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
