import { auth, db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    getDoc, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// بيانات التطبيق
const appData = {
    currentUser: null,
    currentReportId: null,
    editingReportId: null
};

// ==================== دوال Firestore ====================

// دالة مساعدة للتنبيهات
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 4000);
}

// حفظ المستخدم في Firestore
async function saveUserToFirestore(userData) {
    try {
        const docRef = await addDoc(collection(db, "users"), {
            ...userData,
            createdAt: serverTimestamp(),
            role: 'user'
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving user: ", error);
        throw error;
    }
}

// تسجيل الدخول من Firestore
async function loginUserFromFirestore(email, password) {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            if (userData.password === password) {
                return {
                    id: userDoc.id,
                    ...userData
                };
            }
        }
        return null;
    } catch (error) {
        console.error("Error logging in: ", error);
        throw error;
    }
}

// حفظ بلاغ في Firestore
async function saveReportToFirestore(reportData) {
    try {
        const docRef = await addDoc(collection(db, "reports"), {
            ...reportData,
            createdAt: serverTimestamp(),
            status: "جديد"
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving report: ", error);
        throw error;
    }
}

// جلب بلاغات المستخدم
async function getUserReportsFromFirestore(userEmail) {
    try {
        const q = query(
            collection(db, "reports"), 
            where("userId", "==", userEmail),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting user reports: ", error);
        return [];
    }
}

// جلب جميع البلاغات
async function getAllReportsFromFirestore() {
    try {
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting all reports: ", error);
        return [];
    }
}

// حفظ تقرير شرطة
async function savePoliceReportToFirestore(policeReportData) {
    try {
        const docRef = await addDoc(collection(db, "policeReports"), {
            ...policeReportData,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving police report: ", error);
        throw error;
    }
}

// جبل تقارير الشرطة لبلاغ معين
async function getPoliceReportsForReport(reportId) {
    try {
        const q = query(
            collection(db, "policeReports"), 
            where("reportId", "==", reportId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting police reports: ", error);
        return [];
    }
}

// حفظ إشعار
async function saveNotificationToFirestore(notificationData) {
    try {
        const docRef = await addDoc(collection(db, "notifications"), {
            ...notificationData,
            createdAt: serverTimestamp(),
            read: false
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving notification: ", error);
        throw error;
    }
}

// جلب إشعارات المستخدم
async function getUserNotificationsFromFirestore(userEmail) {
    try {
        const q = query(
            collection(db, "notifications"), 
            where("userId", "==", userEmail),
            where("read", "==", false),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting user notifications: ", error);
        return [];
    }
}

// تحديث حالة البلاغ
async function updateReportStatus(reportId, newStatus) {
    try {
        const reportRef = doc(db, "reports", reportId);
        await updateDoc(reportRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating report status: ", error);
        throw error;
    }
}

// ==================== دوال التسجيل والمستخدمين المحدثة ====================
async function registerUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (name && email && phone && password) {
        try {
            const newUser = {
                name: name,
                email: email,
                phone: phone,
                password: password
            };
            
            await saveUserToFirestore(newUser);
            showAlert("تم إنشاء الحساب بنجاح!", "success");
            showLogin('user');
        } catch (error) {
            showAlert("حدث خطأ أثناء إنشاء الحساب", "error");
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginUser() {
    const email = document.getElementById('user-login-email').value;
    const password = document.getElementById('user-login-password').value;
    
    try {
        const user = await loginUserFromFirestore(email, password);
        
        if (user) {
            appData.currentUser = user;
            await showUserDashboard();
        } else {
            showAlert("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
        }
    } catch (error) {
        showAlert("حدث خطأ أثناء تسجيل الدخول", "error");
    }
}

async function showUserDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
    document.getElementById('user-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    
    document.getElementById('user-phone-display').textContent = appData.currentUser.phone;
    document.getElementById('user-email-display').textContent = appData.currentUser.email;
    document.getElementById('reporter-phone').value = appData.currentUser.phone;
    
    await loadUserNotifications();
    await loadUserReports();
    await updateUserBadges();
}

// ==================== دوال البلاغات المحدثة ====================
async function addUserReport() {
    const missingName = document.getElementById('missing-name').value;
    const missingAge = document.getElementById('missing-age').value;
    const missingType = document.getElementById('missing-type').value;
    const lastCall = document.getElementById('last-call').value;
    const lastLocation = document.getElementById('last-location').value;
    const missingHeight = document.getElementById('missing-height').value;
    const missingDescription = document.getElementById('missing-description').value;
    const reporterPhone = document.getElementById('reporter-phone').value;
    const additionalContact = document.getElementById('additional-contact').value;
    const userPhone2 = document.getElementById('user-phone-2').value;
    const photoInput = document.getElementById('missing-photo');
    
    if (missingName && missingAge && lastLocation && reporterPhone) {
        try {
            let photoData = null;
            
            if (photoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    photoData = e.target.result;
                    completeReportSubmission(photoData);
                };
                reader.readAsDataURL(photoInput.files[0]);
            } else {
                await completeReportSubmission(null);
            }
            
            async function completeReportSubmission(photo) {
                const newReport = {
                    userId: appData.currentUser.email,
                    reporterName: appData.currentUser.name,
                    reporterPhone: reporterPhone,
                    additionalContact: additionalContact,
                    userPhone2: userPhone2,
                    missingName: missingName,
                    missingAge: missingAge,
                    missingType: missingType,
                    lastCall: lastCall,
                    lastLocation: lastLocation,
                    missingHeight: missingHeight,
                    missingDescription: missingDescription,
                    photo: photo,
                    date: new Date().toLocaleDateString('ar-EG')
                };
                
                await saveReportToFirestore(newReport);
                
                // إرسال إشعار
                await saveNotificationToFirestore({
                    userId: appData.currentUser.email,
                    message: `تم إرسال بلاغك بنجاح عن: ${missingName}`,
                    type: 'success'
                });
                
                showAlert("تم إرسال البلاغ بنجاح! تم إخطار الشرطة", "success");
                
                // إعادة تعيين الحقول
                document.getElementById('missing-name').value = '';
                document.getElementById('missing-age').value = '';
                document.getElementById('missing-type').value = '';
                document.getElementById('last-call').value = '';
                document.getElementById('last-location').value = '';
                document.getElementById('missing-height').value = '';
                document.getElementById('missing-description').value = '';
                document.getElementById('additional-contact').value = '';
                document.getElementById('user-phone-2').value = '';
                document.getElementById('missing-photo').value = '';
                
                // تحديث البيانات
                await loadUserReports();
                await updateUserBadges();
            }
        } catch (error) {
            showAlert("حدث خطأ أثناء إرسال البلاغ", "error");
        }
    } else {
        showAlert("يرجى ملء الحقول الإلزامية", "warning");
    }
}

async function loadUserReports() {
    const myReportsList = document.getElementById('my-reports-list');
    if (!myReportsList) return;
    
    myReportsList.innerHTML = '';
    
    try {
        const userReports = await getUserReportsFromFirestore(appData.currentUser.email);
        
        if (userReports.length === 0) {
            myReportsList.innerHTML = '<p>لم تقم بإضافة أي بلاغات بعد</p>';
            return;
        }
        
        userReports.forEach(report => {
            const reportItem = document.createElement('div');
            reportItem.className = `report-item status-${getStatusClass(report.status)}`;
            
            reportItem.innerHTML = `
                <h3>${report.missingName}</h3>
                <p><strong>العمر:</strong> ${report.missingAge}</p>
                <p><strong>النوع:</strong> ${report.missingType}</p>
                <p><strong>آخر مكان:</strong> ${report.lastLocation}</p>
                <p><strong>الحالة:</strong> ${report.status}</p>
                <p><strong>التاريخ:</strong> ${report.date}</p>
                ${report.photo ? `
                    <div class="photo-preview-container">
                        <img src="${report.photo}" class="case-image" alt="صورة ${report.missingName}">
                    </div>
                ` : ''}
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="editUserReport('${report.id}')">تعديل</button>
                    <button class="btn btn-danger" onclick="deleteUserReport('${report.id}')">حذف</button>
                </div>
                <div id="edit-form-${report.id}" class="edit-form"></div>
            `;
            
            myReportsList.appendChild(reportItem);
        });
    } catch (error) {
        myReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل البلاغات</p>';
    }
}

async function loadUserNotifications() {
    const notificationsList = document.getElementById('user-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    try {
        const notifications = await getUserNotificationsFromFirestore(appData.currentUser.email);
        
        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt?.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markNotificationAsRead('${notification.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
    } catch (error) {
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

// ==================== دوال مساعدة ====================
function getStatusClass(status) {
    const statusClasses = {
        'جديد': 'new',
        'قيد المعالجة': 'in-progress', 
        'تم الحل': 'resolved'
    };
    return statusClasses[status] || 'new';
}

async function markNotificationAsRead(notificationId) {
    try {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, {
            read: true
        });
        await loadUserNotifications();
        await updateUserBadges();
    } catch (error) {
        console.error("Error marking notification as read: ", error);
    }
}

async function updateUserBadges() {
    try {
        const notifications = await getUserNotificationsFromFirestore(appData.currentUser.email);
        const userReports = await getUserReportsFromFirestore(appData.currentUser.email);
        
        // تحديث شارة الإشعارات
        const notificationsBadge = document.getElementById('user-notifications-badge');
        if (notificationsBadge) {
            if (notifications.length > 0) {
                notificationsBadge.textContent = notifications.length;
                notificationsBadge.classList.remove('hidden');
            } else {
                notificationsBadge.classList.add('hidden');
            }
        }
        
        // تحديث شارة البلاغات
        const reportsBadge = document.getElementById('my-reports-badge');
        if (reportsBadge) {
            if (userReports.length > 0) {
                reportsBadge.textContent = userReports.length;
                reportsBadge.classList.remove('hidden');
            } else {
                reportsBadge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error("Error updating badges: ", error);
    }
}

// ==================== دوال التنقل (تبقى كما هي) ====================
function showPlatform(platform) {
    document.querySelectorAll('.platform-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${platform}-content`).classList.add('active');
}

function showRegister(platform) {
    hideAllForms();
    document.getElementById(`${platform}-register`).classList.remove('hidden');
}

function showLogin(platform) {
    hideAllForms();
    document.getElementById(`${platform}-login`).classList.remove('hidden');
}

function hideAllForms() {
    document.querySelectorAll('.form-container').forEach(form => {
        form.classList.add('hidden');
    });
}

function showMainPage() {
    document.getElementById('main-page').classList.remove('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    appData.currentUser = null;
}

function showUserSection(section) {
    document.getElementById('add-report').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('user-notifications').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

// ==================== تهيئة الصفحة ====================
document.addEventListener('DOMContentLoaded', function() {
    const photoInput = document.getElementById('missing-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('photo-preview');
                    if (preview) {
                        preview.src = e.target.result;
                        preview.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// جعل الدوال متاحة globally
window.registerUser = registerUser;
window.loginUser = loginUser;
window.addUserReport = addUserReport;
window.showPlatform = showPlatform;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.showMainPage = showMainPage;
window.showUserSection = showUserSection;
window.markNotificationAsRead = markNotificationAsRead;
