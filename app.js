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

// بيانات التطبيق
const appData = {
    currentUser: null,
    currentReportId: null,
    editingReportId: null,
    allReports: []
};

// ==================== مستمع حالة المصادقة ====================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // المستخدم مسجل دخول - جلب بياناته من Firestore
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                appData.currentUser = {
                    id: user.uid,
                    ...userData
                };
                localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
                
                // توجيه المستخدم حسب الصلاحية
                if (userData.role === 'user') {
                    showUserDashboard();
                } else if (userData.role === 'police') {
                    showPoliceDashboard();
                } else if (userData.role === 'volunteer') {
                    showVolunteerDashboard();
                }
            }
        }).catch((error) => {
            console.error("Error getting user data:", error);
        });
    } else {
        // المستخدم غير مسجل دخول
        appData.currentUser = null;
        localStorage.removeItem('currentUser');
        showMainPage();
    }
});

// ==================== دوال المساعدة ====================
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#FF9800' : '#2196F3'};
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

function getStatusClass(status) {
    const statusClasses = {
        'جديد': 'new',
        'قيد المعالجة': 'in-progress',
        'تم الحل': 'resolved'
    };
    return statusClasses[status] || 'new';
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==================== دوال التسجيل والدخول ====================

// دوال الشرطة
async function registerPolice() {
    const name = document.getElementById('police-name').value;
    const email = document.getElementById('police-email').value;
    const password = document.getElementById('police-password').value;
    const policeNumber = document.getElementById('police-number').value;
    
    if (name && email && password && policeNumber) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                policeNumber: policeNumber,
                role: 'police',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب الشرطة بنجاح!", "success");
            showLogin('police');
            
        } catch (error) {
            console.error("Error registering police: ", error);
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل بالفعل";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل";
            }
            
            showAlert(errorMessage, "error");
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginPolice() {
    const email = document.getElementById('police-login-email').value;
    const password = document.getElementById('police-login-password').value;
    
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            appData.currentUser = {
                id: user.uid,
                ...userData
            };
            
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            if (userData.role === 'police') {
                await showPoliceDashboard();
            } else {
                showAlert("ليس لديك صلاحية الدخول كشرطة", "error");
                logoutUser();
            }
        } else {
            showAlert("بيانات المستخدم غير موجودة", "error");
        }
        
    } catch (error) {
        console.error("Error logging in police: ", error);
        let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "المستخدم غير موجود";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "كلمة المرور غير صحيحة";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "البريد الإلكتروني غير صالح";
        }
        
        showAlert(errorMessage, "error");
    }
}

// دوال المتطوعين
async function registerVolunteer() {
    const name = document.getElementById('volunteer-name').value;
    const email = document.getElementById('volunteer-email').value;
    const phone = document.getElementById('volunteer-phone').value;
    const password = document.getElementById('volunteer-password').value;
    
    if (name && email && phone && password) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                phone: phone,
                role: 'volunteer',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب المتطوع بنجاح!", "success");
            showLogin('volunteer');
            
        } catch (error) {
            console.error("Error registering volunteer: ", error);
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل بالفعل";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل";
            }
            
            showAlert(errorMessage, "error");
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginVolunteer() {
    const email = document.getElementById('volunteer-login-email').value;
    const password = document.getElementById('volunteer-login-password').value;
    
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            appData.currentUser = {
                id: user.uid,
                ...userData
            };
            
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            if (userData.role === 'volunteer') {
                await showVolunteerDashboard();
            } else {
                showAlert("ليس لديك صلاحية الدخول كمتطوع", "error");
                logoutUser();
            }
        } else {
            showAlert("بيانات المستخدم غير موجودة", "error");
        }
        
    } catch (error) {
        console.error("Error logging in volunteer: ", error);
        let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "المستخدم غير موجود";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "كلمة المرور غير صحيحة";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "البريد الإلكتروني غير صالح";
        }
        
        showAlert(errorMessage, "error");
    }
}

// دوال المستخدمين
async function registerUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (name && email && phone && password) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                phone: phone,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء الحساب بنجاح!", "success");
            showLogin('user');
            
        } catch (error) {
            console.error("Error registering user: ", error);
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل بالفعل";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل";
            }
            
            showAlert(errorMessage, "error");
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginUser() {
    const email = document.getElementById('user-login-email').value;
    const password = document.getElementById('user-login-password').value;
    
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            appData.currentUser = {
                id: user.uid,
                ...userData
            };
            
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            if (userData.role === 'user') {
                await showUserDashboard();
            } else {
                showAlert("ليس لديك صلاحية الدخول كمستخدم", "error");
                logoutUser();
            }
        } else {
            showAlert("بيانات المستخدم غير موجودة", "error");
        }
        
    } catch (error) {
        console.error("Error logging in: ", error);
        let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "المستخدم غير موجود";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "كلمة المرور غير صحيحة";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "البريد الإلكتروني غير صالح";
        }
        
        showAlert(errorMessage, "error");
    }
}

// ==================== إضافة دالة الخروج ====================
async function logoutUser() {
    try {
        await firebase.auth().signOut();
        appData.currentUser = null;
        localStorage.removeItem('currentUser');
        showMainPage();
        showAlert("تم تسجيل الخروج بنجاح", "success");
    } catch (error) {
        console.error("Error signing out: ", error);
    }
}

// ==================== دوال لوحة المستخدم ====================
async function showUserDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    
    document.getElementById('user-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    document.getElementById('user-phone-display').textContent = appData.currentUser.phone;
    document.getElementById('user-email-display').textContent = appData.currentUser.email;
    document.getElementById('reporter-phone').value = appData.currentUser.phone;
    
    await loadUserNotifications();
    await loadUserReports();
    await loadPoliceReportsForUser();
    await updateUserBadges();
}

function showUserSection(section) {
    document.getElementById('add-report').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('user-notifications').classList.add('hidden');
    document.getElementById('police-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

// ==================== دوال البلاغات للمستخدم ====================
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
                photoData = await readFileAsDataURL(photoInput.files[0]);
            }
            
            const newReport = {
                userId: appData.currentUser.id,
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
                photo: photoData,
                status: "جديد",
                date: new Date().toLocaleDateString('ar-EG'),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // حفظ البلاغ في Firestore
            const reportRef = await db.collection('reports').add(newReport);
            
            // إرسال إشعار للمستخدم
            await db.collection('notifications').add({
                userId: appData.currentUser.id,
                message: `تم إرسال بلاغك بنجاح عن: ${missingName}`,
                type: 'success',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // إرسال إشعار للشرطة
            await db.collection('notifications').add({
                type: 'police',
                message: `بلاغ جديد من ${appData.currentUser.name} عن: ${missingName}`,
                reportId: reportRef.id,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إرسال البلاغ بنجاح! تم إخطار الشرطة", "success");
            resetReportForm();
            await loadUserReports();
            
        } catch (error) {
            console.error("Error adding report: ", error);
            showAlert("حدث خطأ أثناء إرسال البلاغ", "error");
        }
    } else {
        showAlert("يرجى ملء الحقول الإلزامية: اسم المفقود، العمر، آخر مكان، ورقم الهاتف", "warning");
    }
}

async function loadUserReports() {
    const myReportsList = document.getElementById('my-reports-list');
    if (!myReportsList) return;
    
    myReportsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('reports')
            .where('userId', '==', appData.currentUser.id)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            myReportsList.innerHTML = '<p>لم تقم بإضافة أي بلاغات بعد</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const report = {
                id: doc.id,
                ...doc.data()
            };
            
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
                    <button class="btn btn-primary" onclick="editUserReport('${doc.id}')">تعديل</button>
                    <button class="btn btn-danger" onclick="deleteUserReport('${doc.id}')">حذف</button>
                </div>
                <div id="edit-form-${doc.id}" class="edit-form"></div>
            `;
            
            myReportsList.appendChild(reportItem);
        });
        
    } catch (error) {
        console.error("Error loading user reports: ", error);
        myReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل البلاغات</p>';
    }
}

async function editUserReport(reportId) {
    try {
        const doc = await db.collection('reports').doc(reportId).get();
        if (!doc.exists) return;
        
        const report = doc.data();
        const editForm = document.getElementById(`edit-form-${reportId}`);
        editForm.innerHTML = `
            <div class="edit-form-content">
                <h4>تعديل البلاغ</h4>
                <div class="form-group">
                    <label for="edit-missing-name-${reportId}">اسم المفقود</label>
                    <input type="text" id="edit-missing-name-${reportId}" value="${report.missingName}">
                </div>
                <div class="form-group">
                    <label for="edit-missing-age-${reportId}">عمر المفقود</label>
                    <input type="text" id="edit-missing-age-${reportId}" value="${report.missingAge}">
                </div>
                <div class="form-group">
                    <label for="edit-last-location-${reportId}">آخر مكان</label>
                    <input type="text" id="edit-last-location-${reportId}" value="${report.lastLocation}">
                </div>
                <div class="form-group">
                    <label for="edit-missing-description-${reportId}">الوصف</label>
                    <textarea id="edit-missing-description-${reportId}" rows="3">${report.missingDescription || ''}</textarea>
                </div>
                <button class="btn btn-success" onclick="saveUserReport('${reportId}')">حفظ التعديلات</button>
                <button class="btn btn-danger" onclick="cancelEdit('${reportId}')">إلغاء</button>
            </div>
        `;
        editForm.style.display = 'block';
    } catch (error) {
        console.error("Error editing report: ", error);
        showAlert("حدث خطأ أثناء تحميل البيانات", "error");
    }
}

async function saveUserReport(reportId) {
    try {
        const missingName = document.getElementById(`edit-missing-name-${reportId}`).value;
        const missingAge = document.getElementById(`edit-missing-age-${reportId}`).value;
        const lastLocation = document.getElementById(`edit-last-location-${reportId}`).value;
        const missingDescription = document.getElementById(`edit-missing-description-${reportId}`).value;
        
        await db.collection('reports').doc(reportId).update({
            missingName: missingName,
            missingAge: missingAge,
            lastLocation: lastLocation,
            missingDescription: missingDescription,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        document.getElementById(`edit-form-${reportId}`).style.display = 'none';
        await loadUserReports();
        showAlert('تم حفظ التعديلات بنجاح', 'success');
    } catch (error) {
        console.error("Error saving report: ", error);
        showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
    }
}

async function deleteUserReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا البلاغ؟')) {
        try {
            await db.collection('reports').doc(reportId).delete();
            await loadUserReports();
            await updateUserBadges();
            showAlert('تم حذف البلاغ بنجاح', 'success');
        } catch (error) {
            console.error("Error deleting report: ", error);
            showAlert('حدث خطأ أثناء حذف البلاغ', 'error');
        }
    }
}

async function loadPoliceReportsForUser() {
    const policeReportsList = document.getElementById('police-reports-list');
    if (!policeReportsList) return;
    
    policeReportsList.innerHTML = '';
    
    try {
        // الحصول على تقارير الشرطة المرتبطة ببلاغات المستخدم
        const userReportsSnapshot = await db.collection('reports')
            .where('userId', '==', appData.currentUser.id)
            .get();
        
        if (userReportsSnapshot.empty) {
            policeReportsList.innerHTML = '<p>لا توجد تقارير من الشرطة بعد</p>';
            return;
        }
        
        const userReportIds = userReportsSnapshot.docs.map(doc => doc.id);
        
        const policeReportsSnapshot = await db.collection('policeReports')
            .where('reportId', 'in', userReportIds)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (policeReportsSnapshot.empty) {
            policeReportsList.innerHTML = '<p>لا توجد تقارير من الشرطة بعد</p>';
            return;
        }
        
        policeReportsSnapshot.forEach(async (doc) => {
            const policeReport = {
                id: doc.id,
                ...doc.data()
            };
            
            const reportDoc = await db.collection('reports').doc(policeReport.reportId).get();
            if (reportDoc.exists) {
                const report = reportDoc.data();
                const reportItem = document.createElement('div');
                reportItem.className = 'report-item';
                reportItem.innerHTML = `
                    <h3>تقرير الشرطة عن: ${report.missingName}</h3>
                    <p><strong>محتوى التقرير:</strong> ${policeReport.content}</p>
                    <p><strong>تاريخ التقرير:</strong> ${new Date(policeReport.createdAt.toDate()).toLocaleDateString('ar-EG')}</p>
                    <p><strong>حالة البلاغ:</strong> ${report.status}</p>
                `;
                policeReportsList.appendChild(reportItem);
            }
        });
        
    } catch (error) {
        console.error("Error loading police reports: ", error);
        policeReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل تقارير الشرطة</p>';
    }
}

// ==================== دوال الإشعارات للمستخدم ====================
async function loadUserNotifications() {
    const notificationsList = document.getElementById('user-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', appData.currentUser.id)
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const notification = {
                id: doc.id,
                ...doc.data()
            };
            
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markNotificationAsRead('${doc.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
        
    } catch (error) {
        console.error("Error loading notifications: ", error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
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
        // تحديث شارة الإشعارات
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', appData.currentUser.id)
            .where('read', '==', false)
            .get();
        
        const notificationsBadge = document.getElementById('user-notifications-badge');
        if (notificationsBadge) {
            if (!notificationsSnapshot.empty) {
                notificationsBadge.textContent = notificationsSnapshot.size;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // تحديث شارة البلاغات
        const reportsSnapshot = await db.collection('reports')
            .where('userId', '==', appData.currentUser.id)
            .get();
        
        const reportsBadge = document.getElementById('my-reports-badge');
        if (reportsBadge) {
            if (!reportsSnapshot.empty) {
                reportsBadge.textContent = reportsSnapshot.size;
                reportsBadge.style.display = 'inline-block';
            } else {
                reportsBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating badges: ", error);
    }
}

// ==================== دوال لوحة الشرطة ====================
async function showPoliceDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
    document.getElementById('police-dashboard').classList.remove('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    
    document.getElementById('police-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    
    await loadAllReports();
    await loadPoliceNotifications();
    await loadVolunteerReports();
    await updatePoliceBadges();
}

function showPoliceSection(section) {
    document.getElementById('new-reports').classList.add('hidden');
    document.getElementById('in-progress-reports').classList.add('hidden');
    document.getElementById('resolved-reports').classList.add('hidden');
    document.getElementById('volunteer-reports').classList.add('hidden');
    document.getElementById('upload-reports').classList.add('hidden');
    document.getElementById('police-notifications').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

async function loadAllReports() {
    const newReportsList = document.getElementById('new-reports-list');
    const inProgressList = document.getElementById('in-progress-list');
    const resolvedList = document.getElementById('resolved-list');
    
    if (!newReportsList) return;
    
    newReportsList.innerHTML = '';
    inProgressList.innerHTML = '';
    resolvedList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('reports')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            newReportsList.innerHTML = '<p>لا توجد بلاغات</p>';
            return;
        }
        
        appData.allReports = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        appData.allReports.forEach(report => {
            const reportItem = document.createElement('div');
            reportItem.className = `report-item status-${getStatusClass(report.status)}`;
            reportItem.innerHTML = `
                <h3>${report.missingName}</h3>
                <p><strong>المبلغ:</strong> ${report.reporterName}</p>
                <p><strong>هاتف المبلغ:</strong> ${report.reporterPhone}</p>
                <p><strong>العمر:</strong> ${report.missingAge}</p>
                <p><strong>آخر مكان:</strong> ${report.lastLocation}</p>
                <p><strong>الحالة:</strong> ${report.status}</p>
                <p><strong>التاريخ:</strong> ${report.date}</p>
                ${report.photo ? `
                    <div class="photo-preview-container">
                        <img src="${report.photo}" class="case-image" alt="صورة ${report.missingName}">
                    </div>
                ` : ''}
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="updateReportStatus('${report.id}', 'قيد المعالجة')">بدأ المعالجة</button>
                    <button class="btn btn-warning" onclick="updateReportStatus('${report.id}', 'تم الحل')">تم الحل</button>
                    <button class="btn btn-info" onclick="showAddPoliceReport('${report.id}')">إضافة تقرير</button>
                </div>
            `;
            
            if (report.status === 'جديد') {
                newReportsList.appendChild(reportItem);
            } else if (report.status === 'قيد المعالجة') {
                inProgressList.appendChild(reportItem);
            } else if (report.status === 'تم الحل') {
                resolvedList.appendChild(reportItem);
            }
        });
        
    } catch (error) {
        console.error("Error loading all reports: ", error);
        newReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل البلاغات</p>';
    }
}

async function updateReportStatus(reportId, newStatus) {
    try {
        await db.collection('reports').doc(reportId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // إرسال إشعار للمستخدم
        const reportDoc = await db.collection('reports').doc(reportId).get();
        if (reportDoc.exists) {
            const report = reportDoc.data();
            await db.collection('notifications').add({
                userId: report.userId,
                message: `تم تحديث حالة بلاغك عن ${report.missingName} إلى: ${newStatus}`,
                type: 'info',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await loadAllReports();
        showAlert(`تم تحديث حالة البلاغ إلى: ${newStatus}`, 'success');
    } catch (error) {
        console.error("Error updating report status: ", error);
        showAlert("حدث خطأ أثناء تحديث حالة البلاغ", "error");
    }
}

async function showAddPoliceReport(reportId) {
    appData.currentReportId = reportId;
    document.getElementById('upload-reports').classList.remove('hidden');
    document.getElementById('report-case').value = reportId;
}

async function sendPoliceReport() {
    const caseId = document.getElementById('report-case').value;
    const content = document.getElementById('report-content').value;
    
    if (caseId && content) {
        try {
            const policeReport = {
                reportId: caseId,
                content: content,
                policeName: appData.currentUser.name,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('policeReports').add(policeReport);
            
            // إرسال إشعار للمستخدم
            const reportDoc = await db.collection('reports').doc(caseId).get();
            if (reportDoc.exists) {
                const report = reportDoc.data();
                await db.collection('notifications').add({
                    userId: report.userId,
                    message: `تم إضافة تقرير جديد من الشرطة عن بلاغك: ${report.missingName}`,
                    type: 'info',
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            showAlert("تم إرسال التقرير بنجاح!", "success");
            document.getElementById('report-content').value = '';
            document.getElementById('upload-reports').classList.add('hidden');
            
        } catch (error) {
            console.error("Error sending police report: ", error);
            showAlert("حدث خطأ أثناء إرسال التقرير", "error");
        }
    } else {
        showAlert("يرجى اختيار بلاغ وإدخال محتوى التقرير", "warning");
    }
}

async function loadPoliceNotifications() {
    const notificationsList = document.getElementById('police-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('notifications')
            .where('type', '==', 'police')
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const notification = {
                id: doc.id,
                ...doc.data()
            };
            
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markPoliceNotificationAsRead('${doc.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
        
    } catch (error) {
        console.error("Error loading police notifications: ", error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markPoliceNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true
        });
        await loadPoliceNotifications();
        await updatePoliceBadges();
    } catch (error) {
        console.error("Error marking police notification as read: ", error);
    }
}

async function updatePoliceBadges() {
    try {
        // شارة الإشعارات
        const notificationsSnapshot = await db.collection('notifications')
            .where('type', '==', 'police')
            .where('read', '==', false)
            .get();
        
        const notificationsBadge = document.getElementById('police-notifications-badge');
        if (notificationsBadge) {
            if (!notificationsSnapshot.empty) {
                notificationsBadge.textContent = notificationsSnapshot.size;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // شارة البلاغات الجديدة
        const newReportsSnapshot = await db.collection('reports')
            .where('status', '==', 'جديد')
            .get();
        
        const newReportsBadge = document.getElementById('new-reports-badge');
        if (newReportsBadge) {
            if (!newReportsSnapshot.empty) {
                newReportsBadge.textContent = newReportsSnapshot.size;
                newReportsBadge.style.display = 'inline-block';
            } else {
                newReportsBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating police badges: ", error);
    }
}

// ==================== دوال المتطوعين ====================
async function showVolunteerDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.remove('hidden');
    
    document.getElementById('volunteer-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    
    await loadCasesForVolunteer();
    await loadMyVolunteerReports();
    await loadVolunteerNotifications();
    await updateVolunteerBadges();
}

function showVolunteerSection(section) {
    document.getElementById('all-reports').classList.add('hidden');
    document.getElementById('select-case').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('volunteer-notifications').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

async function loadCasesForVolunteer() {
    const casesList = document.getElementById('all-reports-list');
    if (!casesList) return;
    
    casesList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('reports')
            .where('status', 'in', ['جديد', 'قيد المعالجة'])
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            casesList.innerHTML = '<p>لا توجد حالات متاحة حالياً</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const report = {
                id: doc.id,
                ...doc.data()
            };
            
            const caseItem = document.createElement('div');
            caseItem.className = 'case-item';
            caseItem.innerHTML = `
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
                <button class="btn btn-primary" onclick="selectCaseForVolunteer('${doc.id}')">اختيار هذه الحالة</button>
            `;
            casesList.appendChild(caseItem);
        });
        
    } catch (error) {
        console.error("Error loading cases for volunteer: ", error);
        casesList.innerHTML = '<p>حدث خطأ أثناء تحميل الحالات</p>';
    }
}

function selectCaseForVolunteer(reportId) {
    appData.currentReportId = reportId;
    showVolunteerSection('select-case');
    document.getElementById('volunteer-case').value = reportId;
    
    // تحميل تفاصيل الحالة
    loadCaseDetails(reportId);
}

async function loadCaseDetails(reportId) {
    try {
        const doc = await db.collection('reports').doc(reportId).get();
        if (doc.exists) {
            const report = doc.data();
            const caseInfo = document.getElementById('case-info');
            caseInfo.innerHTML = `
                <div class="case-details">
                    <h4>${report.missingName}</h4>
                    <p><strong>العمر:</strong> ${report.missingAge}</p>
                    <p><strong>النوع:</strong> ${report.missingType}</p>
                    <p><strong>آخر مكان:</strong> ${report.lastLocation}</p>
                    <p><strong>آخر مكالمة:</strong> ${report.lastCall}</p>
                    <p><strong>الوصف:</strong> ${report.missingDescription}</p>
                    ${report.photo ? `<img src="${report.photo}" class="case-image" alt="صورة ${report.missingName}">` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading case details: ", error);
    }
}

async function addVolunteerReport() {
    const caseId = document.getElementById('volunteer-case').value;
    const info = document.getElementById('volunteer-info').value;
    const phone1 = document.getElementById('volunteer-phone-1').value;
    const phone2 = document.getElementById('volunteer-phone-2').value;
    const email = document.getElementById('volunteer-email').value;
    
    if (caseId && info) {
        try {
            const volunteerReport = {
                reportId: caseId,
                volunteerId: appData.currentUser.id,
                volunteerName: appData.currentUser.name,
                volunteerEmail: email || appData.currentUser.email,
                volunteerPhone1: phone1,
                volunteerPhone2: phone2,
                content: info,
                date: new Date().toLocaleDateString('ar-EG'),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('volunteerReports').add(volunteerReport);
            
            // إرسال إشعار للشرطة
            const reportDoc = await db.collection('reports').doc(caseId).get();
            if (reportDoc.exists) {
                const report = reportDoc.data();
                await db.collection('notifications').add({
                    type: 'police',
                    message: `تقرير جديد من المتطوع ${appData.currentUser.name} عن الحالة: ${report.missingName}`,
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // إرسال إشعار للمتطوع
            await db.collection('notifications').add({
                userId: appData.currentUser.id,
                message: `تم إرسال تقريرك بنجاح عن الحالة: ${reportDoc.data().missingName}`,
                type: 'success',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إرسال التقرير بنجاح! تم إخطار الشرطة", "success");
            
            // إعادة تعيين الحقول
            document.getElementById('volunteer-info').value = '';
            document.getElementById('volunteer-phone-1').value = '';
            document.getElementById('volunteer-phone-2').value = '';
            document.getElementById('volunteer-email').value = appData.currentUser.email;
            
            await loadMyVolunteerReports();
            await updateVolunteerBadges();
            
        } catch (error) {
            console.error("Error adding volunteer report: ", error);
            showAlert("حدث خطأ أثناء إرسال التقرير", "error");
        }
    } else {
        showAlert("يرجى اختيار حالة وإدخال المعلومات المطلوبة", "warning");
    }
}

async function loadMyVolunteerReports() {
    const myReportsList = document.getElementById('my-volunteer-reports-list');
    if (!myReportsList) return;
    
    myReportsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('volunteerReports')
            .where('volunteerId', '==', appData.currentUser.id)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            myReportsList.innerHTML = '<p>لم تقم برفع أي تقارير بعد</p>';
            return;
        }
        
        snapshot.forEach(async (doc) => {
            const vReport = {
                id: doc.id,
                ...doc.data()
            };
            
            const reportDoc = await db.collection('reports').doc(vReport.reportId).get();
            if (reportDoc.exists) {
                const report = reportDoc.data();
                const reportItem = document.createElement('div');
                reportItem.className = 'report-item';
                reportItem.innerHTML = `
                    <h3>${report.missingName}</h3>
                    <p><strong>معلوماتك:</strong> ${vReport.content}</p>
                    <div class="contact-info">
                        <h4>📞 معلومات الاتصال التي قدمتها:</h4>
                        <p><strong>البريد الإلكتروني:</strong> ${vReport.volunteerEmail}</p>
                        <p><strong>رقم الهاتف 1:</strong> ${vReport.volunteerPhone1 || 'غير متوفر'}</p>
                        ${vReport.volunteerPhone2 ? `<p><strong>رقم الهاتف 2:</strong> ${vReport.volunteerPhone2}</p>` : ''}
                    </div>
                    <p><strong>تاريخ الإرسال:</strong> ${vReport.date}</p>
                    <p><strong>حالة البلاغ:</strong> ${report.status}</p>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="editVolunteerReport('${doc.id}')">تعديل التقرير</button>
                        <button class="btn btn-danger" onclick="deleteVolunteerReport('${doc.id}')">حذف التقرير</button>
                    </div>
                    <div id="edit-volunteer-form-${doc.id}" class="edit-form"></div>
                `;
                myReportsList.appendChild(reportItem);
            }
        });
        
    } catch (error) {
        console.error("Error loading volunteer reports: ", error);
        myReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل التقارير</p>';
    }
}

async function editVolunteerReport(reportId) {
    try {
        const doc = await db.collection('volunteerReports').doc(reportId).get();
        if (!doc.exists) return;
        
        const vReport = doc.data();
        const editForm = document.getElementById(`edit-volunteer-form-${reportId}`);
        editForm.innerHTML = `
            <div class="edit-form-content">
                <h4>تعديل التقرير</h4>
                <div class="form-group">
                    <label for="edit-volunteer-info-${reportId}">المعلومات</label>
                    <textarea id="edit-volunteer-info-${reportId}" rows="5">${vReport.content}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-volunteer-email-${reportId}">البريد الإلكتروني</label>
                    <input type="email" id="edit-volunteer-email-${reportId}" value="${vReport.volunteerEmail}">
                </div>
                <div class="form-group">
                    <label for="edit-volunteer-phone1-${reportId}">رقم الهاتف 1</label>
                    <input type="tel" id="edit-volunteer-phone1-${reportId}" value="${vReport.volunteerPhone1 || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-volunteer-phone2-${reportId}">رقم الهاتف 2</label>
                    <input type="tel" id="edit-volunteer-phone2-${reportId}" value="${vReport.volunteerPhone2 || ''}">
                </div>
                <button class="btn btn-success" onclick="saveVolunteerReport('${reportId}')">حفظ التعديلات</button>
                <button class="btn btn-danger" onclick="cancelVolunteerEdit('${reportId}')">إلغاء</button>
            </div>
        `;
        editForm.style.display = 'block';
    } catch (error) {
        console.error("Error editing volunteer report: ", error);
        showAlert("حدث خطأ أثناء تحميل البيانات", "error");
    }
}

async function saveVolunteerReport(reportId) {
    try {
        const content = document.getElementById(`edit-volunteer-info-${reportId}`).value;
        const volunteerEmail = document.getElementById(`edit-volunteer-email-${reportId}`).value;
        const volunteerPhone1 = document.getElementById(`edit-volunteer-phone1-${reportId}`).value;
        const volunteerPhone2 = document.getElementById(`edit-volunteer-phone2-${reportId}`).value;

        await db.collection('volunteerReports').doc(reportId).update({
            content: content,
            volunteerEmail: volunteerEmail,
            volunteerPhone1: volunteerPhone1,
            volunteerPhone2: volunteerPhone2,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById(`edit-volunteer-form-${reportId}`).style.display = 'none';
        await loadMyVolunteerReports();
        showAlert('تم حفظ التعديلات بنجاح', 'success');
    } catch (error) {
        console.error("Error saving volunteer report: ", error);
        showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
    }
}

async function deleteVolunteerReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
        try {
            await db.collection('volunteerReports').doc(reportId).delete();
            await loadMyVolunteerReports();
            await updateVolunteerBadges();
            showAlert('تم حذف التقرير بنجاح', 'success');
        } catch (error) {
            console.error("Error deleting volunteer report: ", error);
            showAlert('حدث خطأ أثناء حذف التقرير', 'error');
        }
    }
}

async function loadVolunteerReports() {
    const volunteerReportsList = document.getElementById('volunteer-reports-list');
    if (!volunteerReportsList) return;
    
    volunteerReportsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('volunteerReports')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            volunteerReportsList.innerHTML = '<p>لا توجد تقارير من المتطوعين</p>';
            return;
        }
        
        snapshot.forEach(async (doc) => {
            const vReport = {
                id: doc.id,
                ...doc.data()
            };
            
            const reportDoc = await db.collection('reports').doc(vReport.reportId).get();
            if (reportDoc.exists) {
                const report = reportDoc.data();
                const reportItem = document.createElement('div');
                reportItem.className = 'report-item';
                reportItem.innerHTML = `
                    <h3>تقرير من المتطوع: ${vReport.volunteerName}</h3>
                    <p><strong>عن الحالة:</strong> ${report.missingName}</p>
                    <p><strong>معلومات المتطوع:</strong> ${vReport.content}</p>
                    
                    <div class="contact-info">
                        <h4>📞 معلومات الاتصال بالمتطوع:</h4>
                        <p><strong>البريد الإلكتروني:</strong> ${vReport.volunteerEmail}</p>
                        <p><strong>رقم الهاتف 1:</strong> ${vReport.volunteerPhone1 || 'غير متوفر'}</p>
                        <p><strong>رقم الهاتف 2:</strong> ${vReport.volunteerPhone2 || 'غير متوفر'}</p>
                    </div>
                    
                    <p><strong>تاريخ الإرسال:</strong> ${vReport.date}</p>
                    <div class="action-buttons">
                        <button class="btn btn-success" onclick="contactVolunteer('${vReport.volunteerEmail}', '${vReport.volunteerPhone1}', '${vReport.volunteerPhone2}', '${vReport.volunteerName}')">📞 الاتصال بالمتطوع</button>
                        <button class="btn btn-danger" onclick="deleteVolunteerReportFromPolice('${doc.id}')">حذف التقرير</button>
                    </div>
                `;
                volunteerReportsList.appendChild(reportItem);
            }
        });
        
    } catch (error) {
        console.error("Error loading volunteer reports: ", error);
        volunteerReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل تقارير المتطوعين</p>';
    }
}

function contactVolunteer(email, phone1, phone2, name) {
    let contactInfo = `معلومات الاتصال بالمتطوع ${name}:\n`;
    contactInfo += `📧 البريد الإلكتروني: ${email}\n`;
    contactInfo += `📞 رقم الهاتف 1: ${phone1 || 'غير متوفر'}\n`;
    if (phone2) {
        contactInfo += `📞 رقم الهاتف 2: ${phone2}\n`;
    }
    
    showAlert(contactInfo, 'info');
}

async function deleteVolunteerReportFromPolice(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
        try {
            await db.collection('volunteerReports').doc(reportId).delete();
            await loadVolunteerReports();
            await updatePoliceBadges();
            showAlert('تم حذف التقرير بنجاح', 'success');
        } catch (error) {
            console.error("Error deleting volunteer report from police: ", error);
            showAlert('حدث خطأ أثناء حذف التقرير', 'error');
        }
    }
}

async function loadVolunteerNotifications() {
    const notificationsList = document.getElementById('volunteer-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', appData.currentUser.id)
            .where('read', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const notification = {
                id: doc.id,
                ...doc.data()
            };
            
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markVolunteerNotificationAsRead('${doc.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
        
    } catch (error) {
        console.error("Error loading volunteer notifications: ", error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markVolunteerNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true
        });
        await loadVolunteerNotifications();
        await updateVolunteerBadges();
    } catch (error) {
        console.error("Error marking volunteer notification as read: ", error);
    }
}

async function updateVolunteerBadges() {
    try {
        // شارة الإشعارات
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', appData.currentUser.id)
            .where('read', '==', false)
            .get();
        
        const notificationsBadge = document.getElementById('volunteer-notifications-badge');
        if (notificationsBadge) {
            if (!notificationsSnapshot.empty) {
                notificationsBadge.textContent = notificationsSnapshot.size;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // شارة التقارير
        const reportsSnapshot = await db.collection('volunteerReports')
            .where('volunteerId', '==', appData.currentUser.id)
            .get();
        
        const reportsBadge = document.getElementById('my-volunteer-reports-badge');
        if (reportsBadge) {
            if (!reportsSnapshot.empty) {
                reportsBadge.textContent = reportsSnapshot.size;
                reportsBadge.style.display = 'inline-block';
            } else {
                reportsBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating volunteer badges: ", error);
    }
}

// ==================== دوال التنقل العامة ====================
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
    localStorage.removeItem('currentUser');
}

function resetReportForm() {
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
    
    const preview = document.getElementById('photo-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
}

function cancelEdit(reportId) {
    document.getElementById(`edit-form-${reportId}`).style.display = 'none';
}

function cancelVolunteerEdit(reportId) {
    document.getElementById(`edit-volunteer-form-${reportId}`).style.display = 'none';
}

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', function() {
    // معالجة عرض الصور المرفوعة
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
    
    // تحميل المستخدم من localStorage إذا كان موجوداً
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        appData.currentUser = JSON.parse(savedUser);
    }
});

// جعل جميع الدوال متاحة globally
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.addUserReport = addUserReport;
window.showPlatform = showPlatform;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.showMainPage = showMainPage;
window.showUserSection = showUserSection;
window.showPoliceSection = showPoliceSection;
window.showVolunteerSection = showVolunteerSection;
window.editUserReport = editUserReport;
window.saveUserReport = saveUserReport;
window.deleteUserReport = deleteUserReport;
window.cancelEdit = cancelEdit;
window.markNotificationAsRead = markNotificationAsRead;
window.updateReportStatus = updateReportStatus;
window.sendPoliceReport = sendPoliceReport;
window.showAddPoliceReport = showAddPoliceReport;
window.markPoliceNotificationAsRead = markPoliceNotificationAsRead;
window.selectCaseForVolunteer = selectCaseForVolunteer;
window.addVolunteerReport = addVolunteerReport;
window.editVolunteerReport = editVolunteerReport;
window.saveVolunteerReport = saveVolunteerReport;
window.deleteVolunteerReport = deleteVolunteerReport;
window.cancelVolunteerEdit = cancelVolunteerEdit;
window.contactVolunteer = contactVolunteer;
window.deleteVolunteerReportFromPolice = deleteVolunteerReportFromPolice;
window.markVolunteerNotificationAsRead = markVolunteerNotificationAsRead;
window.registerPolice = registerPolice;
window.loginPolice = loginPolice;
window.registerVolunteer = registerVolunteer;
window.loginVolunteer = loginVolunteer;
window.submitVolunteerReport = addVolunteerReport; // إضافة اسم بديل للدالة
