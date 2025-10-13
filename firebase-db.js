// firebase-db.js - ملف قاعدة البيانات المنفصل مع Authentication

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
    onSnapshot,
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

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

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ========================
// خدمات Authentication
// ========================
const authService = {
    // تسجيل مستخدم جديد
    async registerUser(userData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                userData.email, 
                userData.password
            );
            
            const user = userCredential.user;
            
            // حفظ بيانات إضافية في Firestore
            await addDoc(collection(db, "User"), {
                uid: user.uid,
                email: userData.email,
                full_name: userData.fullName,
                phone: userData.phone,
                role: "user",
                createdAt: new Date()
            });
            
            return { success: true, user: user };
        } catch (error) {
            console.error("Error registering user:", error);
            return { success: false, error: error.message };
        }
    },

    // تسجيل شرطة جديد
    async registerPolice(policeData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                policeData.email, 
                policeData.password
            );
            
            const user = userCredential.user;
            
            // حفظ بيانات إضافية في Firestore
            await addDoc(collection(db, "Police"), {
                uid: user.uid,
                name: policeData.name,
                number: policeData.number,
                email: policeData.email,
                role: "police",
                createdAt: new Date()
            });
            
            return { success: true, user: user };
        } catch (error) {
            console.error("Error registering police:", error);
            return { success: false, error: error.message };
        }
    },

    // تسجيل متطوع جديد
    async registerVolunteer(volunteerData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                volunteerData.email, 
                volunteerData.password
            );
            
            const user = userCredential.user;
            
            // حفظ بيانات إضافية في Firestore
            await addDoc(collection(db, "Volunteer"), {
                uid: user.uid,
                name: volunteerData.name,
                email: volunteerData.email,
                phone: volunteerData.phone,
                active: true,
                role: "volunteer",
                registration_date: new Date(),
                report_handled: 0,
                createdAt: new Date()
            });
            
            return { success: true, user: user };
        } catch (error) {
            console.error("Error registering volunteer:", error);
            return { success: false, error: error.message };
        }
    },

    // تسجيل الدخول
    async loginUser(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // جلب بيانات المستخدم الإضافية من Firestore
            const userData = await this.getUserData(user.uid, email);
            
            return { 
                success: true, 
                user: {
                    uid: user.uid,
                    email: user.email,
                    ...userData
                }
            };
        } catch (error) {
            console.error("Error logging in:", error);
            return { success: false, error: error.message };
        }
    },

    // جلب بيانات المستخدم من Firestore
    async getUserData(uid, email) {
        try {
            // البحث في جميع المجموعات
            const collections = ['User', 'Police', 'Volunteer'];
            
            for (let collectionName of collections) {
                const q = query(
                    collection(db, collectionName), 
                    where("email", "==", email)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    return { 
                        id: querySnapshot.docs[0].id,
                        ...userData 
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error("Error getting user data:", error);
            return null;
        }
    },

    // تسجيل الخروج
    async logout() {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            console.error("Error logging out:", error);
            return { success: false, error: error.message };
        }
    },

    // مراقبة حالة المصادقة
    onAuthStateChange(callback) {
        return onAuthStateChanged(auth, callback);
    },

    // الحصول على المستخدم الحالي
    getCurrentUser() {
        return auth.currentUser;
    }
};

// ========================
// خدمات جدول User
// ========================
const userService = {
    async createUser(userData) {
        try {
            const docRef = await addDoc(collection(db, "User"), {
                email: userData.email,
                full_name: userData.fullName,
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
    },

    async updateUser(userId, updateData) {
        try {
            const userRef = doc(db, "User", userId);
            await updateDoc(userRef, {
                ...updateData,
                updatedAt: new Date()
            });
            return { success: true };
        } catch (error) {
            console.error("Error updating user:", error);
            return { success: false, error: error.message };
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
                phone: volunteerData.phone,
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
                report_handled: (volunteer.report_handled || 0) + 1,
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
    },

    async getVolunteerByEmail(email) {
        try {
            const q = query(collection(db, "Volunteer"), where("email", "==", email));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty 
                ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } 
                : null;
        } catch (error) {
            console.error("Error getting volunteer by email:", error);
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
    },

    async getPoliceByEmail(email) {
        try {
            const q = query(collection(db, "Police"), where("email", "==", email));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty 
                ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } 
                : null;
        } catch (error) {
            console.error("Error getting police by email:", error);
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
                user_id: reportData.userId,
                reporter_name: reportData.reporterName || "",
                reporter_phone: reportData.reporterPhone || ""
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

    async getReportsByStatus(status) {
        try {
            const q = query(
                collection(db, "Report"), 
                where("status", "==", status),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting reports by status:", error);
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

    async updateReport(reportId, updateData) {
        try {
            const reportRef = doc(db, "Report", reportId);
            await updateDoc(reportRef, {
                ...updateData,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error updating report:", error);
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

    async deleteReport(reportId) {
        try {
            await deleteDoc(doc(db, "Report", reportId));
            return { success: true };
        } catch (error) {
            console.error("Error deleting report:", error);
            return { success: false, error: error.message };
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
    },

    listenToAllReports(callback) {
        const q = query(collection(db, "Report"), orderBy("createdAt", "desc"));
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
                status: "جديد",
                createdAt: new Date()
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
    },

    async getPoliceRelations(policeId) {
        try {
            const q = query(
                collection(db, "Reports"), 
                where("related_police_id", "==", policeId),
                orderBy("report_date", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting police relations:", error);
            throw error;
        }
    },

    async getUserRelations(userId) {
        try {
            const q = query(
                collection(db, "Reports"), 
                where("related_user_id", "==", userId),
                orderBy("report_date", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting user relations:", error);
            throw error;
        }
    }
};

// ========================
// خدمات الإشعارات
// ========================
const notificationService = {
    async createNotification(notificationData) {
        try {
            const docRef = await addDoc(collection(db, "Notifications"), {
                user_id: notificationData.userId,
                title: notificationData.title,
                message: notificationData.message,
                type: notificationData.type || "info",
                read: false,
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating notification:", error);
            throw error;
        }
    },

    async getUserNotifications(userId) {
        try {
            const q = query(
                collection(db, "Notifications"), 
                where("user_id", "==", userId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting user notifications:", error);
            throw error;
        }
    },

    async markAsRead(notificationId) {
        try {
            const notificationRef = doc(db, "Notifications", notificationId);
            await updateDoc(notificationRef, {
                read: true,
                readAt: new Date()
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
            throw error;
        }
    },

    listenToUserNotifications(userId, callback) {
        const q = query(
            collection(db, "Notifications"), 
            where("user_id", "==", userId),
            orderBy("createdAt", "desc")
        );
        return onSnapshot(q, snapshot => {
            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(notifications);
        });
    }
};

// ========================
// تصدير جميع الخدمات
// ========================
const DatabaseService = {
    // خدمات Firebase الأساسية
    auth: authService,
    db,
    
    // خدمات البيانات
    user: userService,
    volunteer: volunteerService,
    police: policeService,
    report: reportService,
    reportsRelation: reportsRelationService,
    notification: notificationService,

    // دوال مساعدة
    async getCurrentUserData() {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            return await authService.getUserData(currentUser.uid, currentUser.email);
        }
        return null;
    },

    // دالة لتهيئة مستمع المصادقة
    initAuthListener(callback) {
        return authService.onAuthStateChange(callback);
    }
};

// تصدير عالمي لاستخدامه في أي مكان
window.DatabaseService = DatabaseService;
export default DatabaseService;
