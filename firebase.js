// استيراد SDK من CDN فقط (الطريقة الأولى)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// أو استيراد من npm (الطريقة الثانية) - اختر واحدة فقط
// import { initializeApp } from "firebase/app";
// import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCd5KilOByaq7s5r3sGo6sl555q9QKSpxE",
  authDomain: "missing-platform-db.firebaseapp.com",
  projectId: "missing-platform-db",
  storageBucket: "missing-platform-db.firebasestorage.app",
  messagingSenderId: "960039466245",
  appId: "1:960039466245:web:185365d1eefe93e6edb36c"
};

// تهيئة Firebase مرة واحدة فقط
const app = initializeApp(firebaseConfig);

// تصدير auth و firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
