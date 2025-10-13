// firebase-db.js - ملف قاعدة البيانات المنفصل

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy,
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ========================
// تكوين Firebase
// ========================
const firebaseConfig = {
    apiKey: "AIzaSyCd5KilOByaq7s5r3sGo6sl555q9QKSpxE",
    authDomain: "missing-platform-db.firebaseapp.com",
    projectId: "missing-platform-db",
    storageBucket: "missing-platform-db.appspot.com",
    messagingSenderId: "960039466245",
    appId: "1:960039466245:web:185365d1eefe93e6edb36c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================
// خدمات جدول User
// ========================
const userService = {
    async createUser(userData) {
        try {
            const docRef = await addDoc(collection(db, "User"), {
                email: userData.email,
                full_name: userData.fullName,
                password: userData.password,
                phone: userData.phone,
                role: "user",
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating user:", error);
            throw error;
        }
    },

    async getUserById(userId) {
        try {
            const docRef = doc(db, "User", userId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error("Error getting user:", error);
            throw error;
        }
    },

    async getUserByEmail(email) {
        try {
            const q = query(collection(db, "User"), where("email", "==", email));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty 
                ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } 
                : null;
        } catch (error) {
            console.error("Error getting user by email:", error);
            throw error;
        }
    }
};

// ========================
// خدمات جدول Volunteer
// ========================
const volunteerService = {
    async createVolunteer(volunteerData) {
        try {
            const docRef = await addDoc(collection(db, "Volunteer"), {
                active: true,
                email: volunteerData.email,
                name: volunteerData.name,
                password: volunteerData.password,
                registration_date: new Date(),
                report_handled: 0,
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating volunteer:", error);
            throw error;
        }
    },

    async getActiveVolunteers() {
        try {
            const q = query(collection(db, "Volunteer"), where("active", "==", true));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting active volunteers:", error);
            throw error;
        }
    },

    async updateVolunteerReports(volunteerId) {
        try {
            const volunteer = await this.getVolunteerById(volunteerId);
            if (!volunteer) throw new Error("Volunteer not found");
            const volunteerRef = doc(db, "Volunteer", volunteerId);
            await updateDoc(volunteerRef, {
                report_handled: volunteer.report_handled + 1,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error updating volunteer reports:", error);
            throw error;
        }
    },

    async getVolunteerById(volunteerId) {
        try {
            const docRef = doc(db, "Volunteer", volunteerId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error("Error getting volunteer:", error);
            throw error;
        }
    }
};

// ========================
// خدمات جدول Police
// ========================
const policeService = {
    async getAllPolice() {
        try {
            const querySnapshot = await getDocs(collection(db, "Police"));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting all police:", error);
            throw error;
        }
    },

    async getPoliceById(policeId) {
        try {
            const docRef = doc(db, "Police", policeId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error("Error getting police:", error);
            throw error;
        }
    }
};

// ========================
// خدمات جدول Report
// ========================
const reportService = {
    async createReport(reportData) {
        try {
            const docRef = await addDoc(collection(db, "Report"), {
                Age: reportData.age,
                Phone1: reportData.phone1,
                Phone2: reportData.phone2 || "",
                Phone3: reportData.phone3 || "",
                createdAt: new Date(),
                description: reportData.description,
                gender: reportData.gender,
                height: reportData.height,
                imageurl: reportData.imageUrl || "",
                last_call: reportData.lastCall || null,
                last_location: reportData.lastLocation || null,
                name: reportData.name,
                status: "قيد المتابعة",
                updatedAt: new Date(),
                user_id: reportData.userId
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating report:", error);
            throw error;
        }
    },

    async getUserReports(userId) {
        try {
            const q = query(
                collection(db, "Report"), 
                where("user_id", "==", userId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting user reports:", error);
            throw error;
        }
    },

    async getAllReports() {
        try {
            const q = query(collection(db, "Report"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting all reports:", error);
            throw error;
        }
    },

    async updateReportStatus(reportId, newStatus) {
        try {
            const reportRef = doc(db, "Report", reportId);
            await updateDoc(reportRef, {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error updating report status:", error);
            throw error;
        }
    },

    async getReportById(reportId) {
        try {
            const docRef = doc(db, "Report", reportId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error("Error getting report:", error);
            throw error;
        }
    },

    listenToUserReports(userId, callback) {
        const q = query(
            collection(db, "Report"), 
            where("user_id", "==", userId),
            orderBy("createdAt", "desc")
        );
        return onSnapshot(q, snapshot => {
            const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(reports);
        });
    }
};

// ========================
// خدمات جدول Reports (الوسيط)
// ========================
const reportsRelationService = {
    async createReportRelation(data) {
        try {
            const docRef = await addDoc(collection(db, "Reports"), {
                related_police_id: data.policeId || "",
                related_user_id: data.userId,
                related_volunteer_id: data.volunteerId || "",
                report_content: data.content,
                report_date: new Date(),
                report_id: data.reportId,
                status: "جديد"
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating report relation:", error);
            throw error;
        }
    },

    async getVolunteerRelations(volunteerId) {
        try {
            const q = query(
                collection(db, "Reports"), 
                where("related_volunteer_id", "==", volunteerId),
                orderBy("report_date", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting volunteer relations:", error);
            throw error;
        }
    }
};

// ========================
// تصدير جميع الخدمات
// ========================
const DatabaseService = {
    db,
    user: userService,
    volunteer: volunteerService,
    police: policeService,
    report: reportService,
    reportsRelation: reportsRelationService
};

// تصدير عالمي لاستخدامه في أي مكان
window.DatabaseService = DatabaseService;
export default DatabaseService;
