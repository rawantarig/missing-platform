// database.js

// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCd5KilOByaq7s5r3sGo6sl555q9QKSpxE",
    authDomain: "missing-platform-db.firebaseapp.com",
    projectId: "missing-platform-db",
    storageBucket: "missing-platform-db.firebasestorage.app",
    messagingSenderId: "960039466245",
    appId: "1:960039466245:web:185365d1eefe93e6edb36c"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== دوال المصادقة ====================

/**
 * تسجيل مستخدم جديد
 */
async function registerUser(userData) {
    try {
        const { name, email, phone, password, role = 'user' } = userData;
        
        // إنشاء المستخدم في Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // حفظ بيانات المستخدم في Firestore
        await db.collection('users').doc(user.uid).set({
            name,
            email,
            phone,
            role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, user: { id: user.uid, name, email, phone, role } };
    } catch (error) {
        console.error("Error registering user: ", error);
        return { success: false, error };
    }
}

/**
 * تسجيل دخول مستخدم
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // جلب بيانات المستخدم من Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            return { 
                success: true, 
                user: { 
                    id: user.uid, 
                    ...userData 
                } 
            };
        } else {
            return { success: false, error: { message: "بيانات المستخدم غير موجودة" } };
        }
    } catch (error) {
        console.error("Error logging in: ", error);
        return { success: false, error };
    }
}

/**
 * تسجيل خروج المستخدم
 */
async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error("Error signing out: ", error);
        return { success: false, error };
    }
}

/**
 * الحصول على بيانات المستخدم الحالي
 */
async function getCurrentUser() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    resolve({
                        id: user.uid,
                        ...userDoc.data()
                    });
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
}

// ==================== دوال البلاغات ====================

/**
 * إضافة بلاغ جديد
 */
async function addReport(reportData) {
    try {
        const reportRef = await db.collection('reports').add({
            ...reportData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, reportId: reportRef.id };
    } catch (error) {
        console.error("Error adding report: ", error);
        return { success: false, error };
    }
}

/**
 * جلب بلاغات المستخدم
 */
async function getUserReports(userId) {
    try {
        const snapshot = await db.collection('reports')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, reports };
    } catch (error) {
        console.error("Error loading user reports: ", error);
        return { success: false, error };
    }
}

/**
 * جلب جميع البلاغات (للوحة الشرطة)
 */
async function getAllReports() {
    try {
        const snapshot = await db.collection('reports')
            .orderBy('createdAt', 'desc')
            .get();
        
        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, reports };
    } catch (error) {
        console.error("Error loading all reports: ", error);
        return { success: false, error };
    }
}

/**
 * تحديث حالة البلاغ
 */
async function updateReportStatus(reportId, newStatus) {
    try {
        await db.collection('reports').doc(reportId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error updating report status: ", error);
        return { success: false, error };
    }
}

/**
 * تحديث بيانات البلاغ
 */
async function updateReport(reportId, updateData) {
    try {
        await db.collection('reports').doc(reportId).update({
            ...updateData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error updating report: ", error);
        return { success: false, error };
    }
}

/**
 * حذف بلاغ
 */
async function deleteReport(reportId) {
    try {
        await db.collection('reports').doc(reportId).delete();
        return { success: true };
    } catch (error) {
        console.error("Error deleting report: ", error);
        return { success: false, error };
    }
}

// ==================== دوال الإشعارات ====================

/**
 * إضافة إشعار جديد
 */
async function addNotification(notificationData) {
    try {
        await db.collection('notifications').add({
            ...notificationData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error adding notification: ", error);
        return { success: false, error };
    }
}

/**
 * جلب إشعارات المستخدم
 */
async function getUserNotifications(userId) {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        
        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, notifications };
    } catch (error) {
        console.error("Error loading user notifications: ", error);
        return { success: false, error };
    }
}

/**
 * جلب إشعارات الشرطة
 */
async function getPoliceNotifications() {
    try {
        const snapshot = await db.collection('notifications')
            .where('type', '==', 'police')
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        
        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, notifications };
    } catch (error) {
        console.error("Error loading police notifications: ", error);
        return { success: false, error };
    }
}

/**
 * تحديث حالة الإشعار كمقروء
 */
async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error marking notification as read: ", error);
        return { success: false, error };
    }
}

// ==================== دوال تقارير الشرطة ====================

/**
 * إضافة تقرير شرطة
 */
async function addPoliceReport(policeReportData) {
    try {
        await db.collection('policeReports').add({
            ...policeReportData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error adding police report: ", error);
        return { success: false, error };
    }
}

/**
 * جلب تقارير الشرطة لبلاغ معين
 */
async function getPoliceReportsForReport(reportId) {
    try {
        const snapshot = await db.collection('policeReports')
            .where('reportId', '==', reportId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const policeReports = [];
        snapshot.forEach(doc => {
            policeReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, policeReports };
    } catch (error) {
        console.error("Error loading police reports: ", error);
        return { success: false, error };
    }
}

// ==================== دوال تقارير المتطوعين ====================

/**
 * إضافة تقرير متطوع
 */
async function addVolunteerReport(volunteerReportData) {
    try {
        await db.collection('volunteerReports').add({
            ...volunteerReportData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error adding volunteer report: ", error);
        return { success: false, error };
    }
}

/**
 * جلب تقارير متطوع معين
 */
async function getVolunteerReportsByVolunteer(volunteerId) {
    try {
        const snapshot = await db.collection('volunteerReports')
            .where('volunteerId', '==', volunteerId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const volunteerReports = [];
        snapshot.forEach(doc => {
            volunteerReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, volunteerReports };
    } catch (error) {
        console.error("Error loading volunteer reports: ", error);
        return { success: false, error };
    }
}

/**
 * جلب جميع تقارير المتطوعين
 */
async function getAllVolunteerReports() {
    try {
        const snapshot = await db.collection('volunteerReports')
            .orderBy('createdAt', 'desc')
            .get();
        
        const volunteerReports = [];
        snapshot.forEach(doc => {
            volunteerReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, volunteerReports };
    } catch (error) {
        console.error("Error loading all volunteer reports: ", error);
        return { success: false, error };
    }
}

/**
 * تحديث تقرير متطوع
 */
async function updateVolunteerReport(reportId, updateData) {
    try {
        await db.collection('volunteerReports').doc(reportId).update({
            ...updateData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error updating volunteer report: ", error);
        return { success: false, error };
    }
}

/**
 * حذف تقرير متطوع
 */
async function deleteVolunteerReport(reportId) {
    try {
        await db.collection('volunteerReports').doc(reportId).delete();
        return { success: true };
    } catch (error) {
        console.error("Error deleting volunteer report: ", error);
        return { success: false, error };
    }
}

// ==================== دوال الإحصائيات ====================

/**
 * جبل عدد البلاغات حسب الحالة
 */
async function getReportsCountByStatus() {
    try {
        const snapshot = await db.collection('reports').get();
        const counts = {
            new: 0,
            inProgress: 0,
            resolved: 0,
            total: snapshot.size
        };
        
        snapshot.forEach(doc => {
            const status = doc.data().status;
            if (status === 'جديد') counts.new++;
            else if (status === 'قيد المعالجة') counts.inProgress++;
            else if (status === 'تم الحل') counts.resolved++;
        });
        
        return { success: true, counts };
    } catch (error) {
        console.error("Error getting reports count: ", error);
        return { success: false, error };
    }
}

/**
 * جبل عدد المستخدمين حسب النوع
 */
async function getUsersCountByRole() {
    try {
        const snapshot = await db.collection('users').get();
        const counts = {
            user: 0,
            police: 0,
            volunteer: 0,
            total: snapshot.size
        };
        
        snapshot.forEach(doc => {
            const role = doc.data().role;
            if (role === 'user') counts.user++;
            else if (role === 'police') counts.police++;
            else if (role === 'volunteer') counts.volunteer++;
        });
        
        return { success: true, counts };
    } catch (error) {
        console.error("Error getting users count: ", error);
        return { success: false, error };
    }
}

// ==================== التصدير ====================

// تصدير كائن قاعدة البيانات
const database = {
    // المصادقة
    auth,
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    
    // البلاغات
    addReport,
    getUserReports,
    getAllReports,
    updateReportStatus,
    updateReport,
    deleteReport,
    
    // الإشعارات
    addNotification,
    getUserNotifications,
    getPoliceNotifications,
    markNotificationAsRead,
    
    // تقارير الشرطة
    addPoliceReport,
    getPoliceReportsForReport,
    
    // تقارير المتطوعين
    addVolunteerReport,
    getVolunteerReportsByVolunteer,
    getAllVolunteerReports,
    updateVolunteerReport,
    deleteVolunteerReport,
    
    // الإحصائيات
    getReportsCountByStatus,
    getUsersCountByRole
};

// تصدير للاستخدام في المتصفح
if (typeof window !== 'undefined') {
    window.database = database;
}

// تصدير للاستخدام في ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = database;
        }
