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
const db = firebase.firestore();

// بيانات التطبيق
const appData = {
    currentUser: null,
    currentReportId: null,
    editingReportId: null,
    allReports: []
};

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
        'تم الحل': 'resolved',
        'قيد المتابعة': 'in-progress'
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

// ==================== دوال التحقق من البيانات ====================
async function checkEmailExists(email) {
    try {
        const querySnapshot = await db.collection('users')
            .where('email', '==', email.toLowerCase().trim())
            .get();
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
}

async function checkPhoneExists(phone) {
    try {
        const querySnapshot = await db.collection('users')
            .where('phone', '==', phone.trim())
            .get();
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking phone:', error);
        return false;
    }
}

// ==================== دوال التسجيل والدخول ====================

// دوال المستخدمين - بدون مصادقة
async function registerUser() {
    const fullName = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (fullName && email && phone && password) {
        try {
            console.log('🚀 بدء عملية إنشاء حساب...');
            
            // تعطيل الزر لمنع النقر المتعدد
            const registerBtn = document.querySelector('#user-register-btn');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.textContent = 'جاري إنشاء الحساب...';
            }

            // التحقق من وجود البريد الإلكتروني في قاعدة البيانات
            console.log('🔍 التحقق من وجود البريد في قاعدة البيانات...');
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل", "error");
                return;
            }

            // التحقق من وجود رقم الهاتف في قاعدة البيانات
            console.log('🔍 التحقق من وجود رقم الهاتف في قاعدة البيانات...');
            const phoneExists = await checkPhoneExists(phone);
            if (phoneExists) {
                showAlert("رقم الهاتف مسجل مسبقاً", "error");
                return;
            }

            // إنشاء معرف فريد للمستخدم
            const userId = generateUserId();
            
            // حفظ بيانات المستخدم في Firestore
            console.log('💾 حفظ بيانات المستخدم في Firestore...');
            const userData = {
                id: userId,
                fullName: fullName.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                password: password, // في الواقع يجب تشفير كلمة المرور
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(userId).set(userData);
            console.log('✅ تم حفظ بيانات المستخدم في Firestore');

            // تحديث بيانات المستخدم في التطبيق
            appData.currentUser = userData;
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));

            showAlert("تم إنشاء الحساب بنجاح! ✅", "success");
            console.log('🎉 تم إنشاء الحساب بنجاح');

            // الانتقال إلى لوحة التحكم مباشرة
            setTimeout(() => {
                showUserDashboard();
            }, 1500);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الحساب:', error);
            showAlert("حدث خطأ أثناء إنشاء الحساب: " + error.message, "error");
        } finally {
            // إعادة تمكين الزر
            const registerBtn = document.querySelector('#user-register-btn');
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.textContent = 'إنشاء الحساب';
            }
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginUser() {
    const email = document.getElementById('user-login-email').value;
    const password = document.getElementById('user-login-password').value;
    
    try {
        // البحث عن المستخدم في قاعدة البيانات
        const userQuery = await db.collection('users')
            .where('email', '==', email.toLowerCase().trim())
            .where('password', '==', password)
            .where('role', '==', 'user')
            .get();
        
        if (userQuery.empty) {
            showAlert("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
            return;
        }
        
        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        
        // تحديث آخر دخول
        await db.collection('users').doc(userDoc.id).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // تحديث بيانات المستخدم في التطبيق
        appData.currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        showUserDashboard();
        
    } catch (error) {
        console.error("Error logging in user: ", error);
        showAlert("حدث خطأ أثناء تسجيل الدخول", "error");
    }
}

// دوال الشرطة - بدون مصادقة
async function registerPolice() {
    const name = document.getElementById('police-name').value;
    const email = document.getElementById('police-email').value;
    const password = document.getElementById('police-password').value;
    const phone = document.getElementById('police-phone').value;
    
    if (name && email && password && phone) {
        try {
            // تعطيل الزر
            const registerBtn = document.querySelector('#police-register-btn');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.textContent = 'جاري إنشاء الحساب...';
            }

            // التحقق من البريد الإلكتروني في قاعدة البيانات
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل", "error");
                return;
            }

            // إنشاء معرف فريد للشرطة
            const policeId = generateUserId();
            
            await db.collection('users').doc(policeId).set({
                id: policeId,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                password: password,
                role: 'police',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب الشرطة بنجاح!", "success");
            
            // تسجيل الدخول تلقائياً
            appData.currentUser = {
                id: policeId,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                role: 'police'
            };
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            setTimeout(() => {
                showPoliceDashboard();
            }, 1500);
            
        } catch (error) {
            console.error("Error registering police: ", error);
            showAlert("حدث خطأ أثناء إنشاء الحساب", "error");
        } finally {
            // إعادة تمكين الزر
            const registerBtn = document.querySelector('#police-register-btn');
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.textContent = 'إنشاء الحساب';
            }
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginPolice() {
    const email = document.getElementById('police-login-email').value;
    const password = document.getElementById('police-login-password').value;
    
    try {
        // البحث عن الشرطة في قاعدة البيانات
        const policeQuery = await db.collection('users')
            .where('email', '==', email.toLowerCase().trim())
            .where('password', '==', password)
            .where('role', '==', 'police')
            .get();
        
        if (policeQuery.empty) {
            showAlert("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
            return;
        }
        
        const policeDoc = policeQuery.docs[0];
        const policeData = policeDoc.data();
        
        // تحديث آخر دخول
        await db.collection('users').doc(policeDoc.id).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // تحديث بيانات الشرطة في التطبيق
        appData.currentUser = policeData;
        localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        showPoliceDashboard();
        
    } catch (error) {
        console.error("Error logging in police: ", error);
        showAlert("حدث خطأ أثناء تسجيل الدخول", "error");
    }
}

// دوال المتطوعين - بدون مصادقة
async function registerVolunteer() {
    const name = document.getElementById('volunteer-name').value;
    const email = document.getElementById('volunteer-email').value;
    const password = document.getElementById('volunteer-password').value;
    
    if (name && email && password) {
        try {
            // تعطيل الزر
            const registerBtn = document.querySelector('#volunteer-register-btn');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.textContent = 'جاري إنشاء الحساب...';
            }

            // التحقق من البريد الإلكتروني في قاعدة البيانات
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل", "error");
                return;
            }

            // إنشاء معرف فريد للمتطوع
            const volunteerId = generateUserId();
            
            await db.collection('users').doc(volunteerId).set({
                id: volunteerId,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: password,
                active: true,
                registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
                reportHandled: 0,
                volunteerId: volunteerId,
                role: 'volunteer',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب المتطوع بنجاح!", "success");
            
            // تسجيل الدخول تلقائياً
            appData.currentUser = {
                id: volunteerId,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                role: 'volunteer',
                active: true,
                reportHandled: 0
            };
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            setTimeout(() => {
                showVolunteerDashboard();
            }, 1500);
            
        } catch (error) {
            console.error("Error registering volunteer: ", error);
            showAlert("حدث خطأ أثناء إنشاء الحساب", "error");
        } finally {
            // إعادة تمكين الزر
            const registerBtn = document.querySelector('#volunteer-register-btn');
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.textContent = 'إنشاء الحساب';
            }
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

async function loginVolunteer() {
    const email = document.getElementById('volunteer-login-email').value;
    const password = document.getElementById('volunteer-login-password').value;
    
    try {
        // البحث عن المتطوع في قاعدة البيانات
        const volunteerQuery = await db.collection('users')
            .where('email', '==', email.toLowerCase().trim())
            .where('password', '==', password)
            .where('role', '==', 'volunteer')
            .get();
        
        if (volunteerQuery.empty) {
            showAlert("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
            return;
        }
        
        const volunteerDoc = volunteerQuery.docs[0];
        const volunteerData = volunteerDoc.data();
        
        // تحديث آخر دخول
        await db.collection('users').doc(volunteerDoc.id).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // تحديث بيانات المتطوع في التطبيق
        appData.currentUser = volunteerData;
        localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        showVolunteerDashboard();
        
    } catch (error) {
        console.error("Error logging in volunteer: ", error);
        showAlert("حدث خطأ أثناء تسجيل الدخول", "error");
    }
}

// ==================== إضافة دالة الخروج ====================
async function logoutUser() {
    appData.currentUser = null;
    localStorage.removeItem('currentUser');
    showMainPage();
    showAlert("تم تسجيل الخروج بنجاح", "success");
}

// ==================== دوال لوحة التحكم ====================
function showUserDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    
    if (appData.currentUser) {
        document.getElementById('user-welcome').textContent = `مرحباً ${appData.currentUser.fullName}`;
        document.getElementById('user-phone-display').textContent = appData.currentUser.phone;
        document.getElementById('user-email-display').textContent = appData.currentUser.email;
        document.getElementById('reporter-phone').value = appData.currentUser.phone;
    }
    
    loadUserNotifications();
    loadUserReports();
    loadPoliceReportsForUser();
    updateUserBadges();
}

function showPoliceDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
    document.getElementById('police-dashboard').classList.remove('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    
    if (appData.currentUser) {
        document.getElementById('police-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    }
    
    loadAllReports();
    loadPoliceNotifications();
    loadVolunteerReports();
    updatePoliceBadges();
}

function showVolunteerDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.add('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.remove('hidden');
    
    if (appData.currentUser) {
        document.getElementById('volunteer-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
        document.getElementById('volunteer-stats').innerHTML = `
            <p>عدد البلاغات المكلف بها: ${appData.currentUser.reportHandled || 0}</p>
            <p>حالة الحساب: ${appData.currentUser.active ? 'نشط' : 'غير نشط'}</p>
        `;
    }
    
    loadCasesForVolunteer();
    loadMyVolunteerReports();
    loadVolunteerNotifications();
    updateVolunteerBadges();
}

// ==================== دوال التنقل ====================
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

// ==================== دوال لوحة المستخدم ====================
function showUserSection(section) {
    document.getElementById('add-report').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('user-notifications').classList.add('hidden');
    document.getElementById('police-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

// دوال البلاغات للمستخدم
async function addUserReport() {
    const name = document.getElementById('missing-name').value;
    const age = document.getElementById('missing-age').value;
    const gender = document.getElementById('missing-gender').value;
    const lastCall = document.getElementById('last-call').value;
    const lastSeenLocation = document.getElementById('last-location').value;
    const height = document.getElementById('missing-height').value;
    const description = document.getElementById('missing-description').value;
    const phone1 = document.getElementById('reporter-phone').value;
    const phone2 = document.getElementById('phone-2').value;
    const phone3 = document.getElementById('phone-3').value;
    const photoInput = document.getElementById('missing-photo');
    
    if (name && age && lastSeenLocation && phone1) {
        try {
            let image = null;
            
            if (photoInput.files[0]) {
                image = await readFileAsDataURL(photoInput.files[0]);
            }
            
            const reportId = generateReportId();
            const newReport = {
                reportId: reportId,
                userId: appData.currentUser.id,
                name: name,
                age: parseInt(age),
                gender: gender,
                last_call: lastCall,
                last_seen_location: lastSeenLocation,
                height: height,
                description: description,
                phone1: phone1,
                phone2: phone2,
                phone3: phone3,
                image: image,
                status: "جديد",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // حفظ البلاغ في Firestore
            await db.collection('reports').doc(reportId).set(newReport);
            
            // إرسال إشعار للمستخدم
            await db.collection('notifications').add({
                userId: appData.currentUser.id,
                message: `تم إرسال بلاغك بنجاح عن: ${name}`,
                type: 'success',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // إرسال إشعار للشرطة
            await db.collection('notifications').add({
                type: 'police',
                message: `بلاغ جديد من ${appData.currentUser.fullName} عن: ${name}`,
                reportId: reportId,
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

// ==================== دوال إدارة البلاغات ====================
async function loadUserReports() {
    try {
        const reportsSnapshot = await db.collection('reports')
            .where('userId', '==', appData.currentUser.id)
            .orderBy('createdAt', 'desc')
            .get();
        
        const reportsContainer = document.getElementById('user-reports-list');
        if (!reportsContainer) return;
        
        reportsContainer.innerHTML = '';
        
        if (reportsSnapshot.empty) {
            reportsContainer.innerHTML = '<p class="no-data">لا توجد بلاغات سابقة</p>';
            return;
        }
        
        reportsSnapshot.forEach(doc => {
            const report = doc.data();
            const reportElement = createReportElement(doc.id, report, 'user');
            reportsContainer.appendChild(reportElement);
        });
        
    } catch (error) {
        console.error("Error loading user reports: ", error);
        showAlert("حدث خطأ أثناء تحميل البلاغات", "error");
    }
}

async function loadAllReports() {
    try {
        const reportsSnapshot = await db.collection('reports')
            .orderBy('createdAt', 'desc')
            .get();
        
        const reportsContainer = document.getElementById('all-reports-list');
        if (!reportsContainer) return;
        
        reportsContainer.innerHTML = '';
        
        if (reportsSnapshot.empty) {
            reportsContainer.innerHTML = '<p class="no-data">لا توجد بلاغات</p>';
            return;
        }
        
        reportsSnapshot.forEach(doc => {
            const report = doc.data();
            const reportElement = createReportElement(doc.id, report, 'police');
            reportsContainer.appendChild(reportElement);
        });
        
    } catch (error) {
        console.error("Error loading all reports: ", error);
        showAlert("حدث خطأ أثناء تحميل البلاغات", "error");
    }
}

function createReportElement(reportId, report, userType) {
    const reportElement = document.createElement('div');
    reportElement.className = `report-item ${getStatusClass(report.status)}`;
    reportElement.innerHTML = `
        <div class="report-header">
            <h3>${report.name}</h3>
            <span class="status-badge ${getStatusClass(report.status)}">${report.status}</span>
        </div>
        <div class="report-details">
            <p><strong>العمر:</strong> ${report.age}</p>
            <p><strong>الجنس:</strong> ${report.gender || 'غير محدد'}</p>
            <p><strong>آخر مكان شوهد فيه:</strong> ${report.last_seen_location}</p>
            <p><strong>تاريخ البلاغ:</strong> ${new Date(report.createdAt?.toDate()).toLocaleDateString('ar-EG')}</p>
            ${report.image ? `<img src="${report.image}" alt="صورة المفقود" class="report-image">` : ''}
        </div>
        <div class="report-actions">
            <button onclick="viewReportDetails('${reportId}')">عرض التفاصيل</button>
            ${userType === 'police' ? `<button onclick="assignToVolunteer('${reportId}')">تعيين لمتطوع</button>` : ''}
            ${userType === 'police' ? `<button onclick="updateReportStatus('${reportId}', 'قيد المتابعة')">تغيير للحالة</button>` : ''}
        </div>
    `;
    return reportElement;
}

// ==================== دوال التقارير ====================
async function addReport() {
    const reportContent = document.getElementById('report-content').value;
    const relatedReportId = document.getElementById('related-report-id').value;
    
    if (reportContent && relatedReportId) {
        try {
            const reportDocId = generateReportId();
            const newReportDoc = {
                reportId: reportDocId,
                reportContent: reportContent,
                relatedReportId: relatedReportId,
                reportDate: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'قيد المتابعة'
            };
            
            // إضافة المعرفات حسب نوع المستخدم
            if (appData.currentUser.role === 'police') {
                newReportDoc.relatedPoliceId = appData.currentUser.id;
            } else if (appData.currentUser.role === 'volunteer') {
                newReportDoc.relatedVolunteerId = appData.currentUser.id;
            }
            
            // إضافة التقرير
            await db.collection('reports').doc(relatedReportId).collection('subReports').add(newReportDoc);
            
            // تحديث حالة البلاغ الأصلي
            await db.collection('reports').doc(relatedReportId).update({
                status: 'قيد المتابعة',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إضافة التقرير بنجاح", "success");
            
        } catch (error) {
            console.error("Error adding report: ", error);
            showAlert("حدث خطأ أثناء إضافة التقرير", "error");
        }
    } else {
        showAlert("يرجى ملء جميع الحقول", "warning");
    }
}

// ==================== دوال إضافية ====================
async function viewReportDetails(reportId) {
    try {
        const reportDoc = await db.collection('reports').doc(reportId).get();
        if (reportDoc.exists) {
            const report = reportDoc.data();
            
            alert(`تفاصيل البلاغ:\nالاسم: ${report.name}\nالعمر: ${report.age}\nالجنس: ${report.gender}\nآخر مكان: ${report.last_seen_location}`);
        }
    } catch (error) {
        console.error("Error viewing report details: ", error);
        showAlert("حدث خطأ أثناء تحميل التفاصيل", "error");
    }
}

async function assignToVolunteer(reportId) {
    try {
        const volunteersSnapshot = await db.collection('users')
            .where('role', '==', 'volunteer')
            .where('active', '==', true)
            .get();
        
        if (!volunteersSnapshot.empty) {
            const volunteer = volunteersSnapshot.docs[0].data();
            const volunteerId = volunteersSnapshot.docs[0].id;
            
            // تحديث البلاغ بإضافة المتطوع
            await db.collection('reports').doc(reportId).update({
                relatedVolunteerId: volunteerId,
                status: 'قيد المتابعة',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // تحديث إحصائيات المتطوع
            await db.collection('users').doc(volunteerId).update({
                reportHandled: firebase.firestore.FieldValue.increment(1)
            });
            
            showAlert(`تم تعيين البلاغ للمتطوع: ${volunteer.name}`, "success");
        } else {
            showAlert("لا يوجد متطوعون متاحون حالياً", "warning");
        }
    } catch (error) {
        console.error("Error assigning to volunteer: ", error);
        showAlert("حدث خطأ أثناء تعيين المتطوع", "error");
    }
}

async function updateReportStatus(reportId, newStatus) {
    try {
        await db.collection('reports').doc(reportId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert(`تم تحديث حالة البلاغ إلى: ${newStatus}`, "success");
        
        // إعادة تحميل البلاغات
        if (appData.currentUser.role === 'police') {
            loadAllReports();
        } else if (appData.currentUser.role === 'user') {
            loadUserReports();
        }
        
    } catch (error) {
        console.error("Error updating report status: ", error);
        showAlert("حدث خطأ أثناء تحديث الحالة", "error");
    }
}

// ==================== دوال الإشعارات ====================
async function loadUserNotifications() {
    try {
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', appData.currentUser.id)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const notificationsContainer = document.getElementById('user-notifications-list');
        if (!notificationsContainer) return;
        
        notificationsContainer.innerHTML = '';
        
        if (notificationsSnapshot.empty) {
            notificationsContainer.innerHTML = '<p class="no-data">لا توجد إشعارات</p>';
            return;
        }
        
        notificationsSnapshot.forEach(doc => {
            const notification = doc.data();
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
            notificationElement.innerHTML = `
                <p>${notification.message}</p>
                <small>${new Date(notification.createdAt?.toDate()).toLocaleString('ar-EG')}</small>
            `;
            notificationsContainer.appendChild(notificationElement);
        });
        
    } catch (error) {
        console.error("Error loading notifications: ", error);
    }
}

// ==================== دوال توليد المعرفات ====================
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateReportId() {
    return 'report_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==================== جعل الدوال متاحة عالمياً ====================
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
window.registerPolice = registerPolice;
window.loginPolice = loginPolice;
window.registerVolunteer = registerVolunteer;
window.loginVolunteer = loginVolunteer;
window.viewReportDetails = viewReportDetails;
window.assignToVolunteer = assignToVolunteer;
window.updateReportStatus = updateReportStatus;
window.addReport = addReport;

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
        
        // توجيه المستخدم حسب الصلاحية
        if (appData.currentUser.role === 'user') {
            showUserDashboard();
        } else if (appData.currentUser.role === 'police') {
            showPoliceDashboard();
        } else if (appData.currentUser.role === 'volunteer') {
            showVolunteerDashboard();
        }
    }
});

// ==================== دوال إضافية للوحات التحكم ====================
function showPoliceSection(section) {
    document.querySelectorAll('#police-dashboard .dashboard-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(section).classList.remove('hidden');
}

function showVolunteerSection(section) {
    document.querySelectorAll('#volunteer-dashboard .dashboard-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(section).classList.remove('hidden');
}

function resetReportForm() {
    document.getElementById('missing-name').value = '';
    document.getElementById('missing-age').value = '';
    document.getElementById('missing-gender').value = '';
    document.getElementById('last-call').value = '';
    document.getElementById('last-location').value = '';
    document.getElementById('missing-height').value = '';
    document.getElementById('missing-description').value = '';
    document.getElementById('phone-2').value = '';
    document.getElementById('phone-3').value = '';
    document.getElementById('missing-photo').value = '';
    
    const preview = document.getElementById('photo-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
}

// دوال تحميل الإحصائيات
function updateUserBadges() {
    // تحديث إحصائيات المستخدم
}

function updatePoliceBadges() {
    // تحديث إحصائيات الشرطة
}

function updateVolunteerBadges() {
    // تحديث إحصائيات المتطوع
}

// دوال تحميل التقارير الأخرى
async function loadPoliceReportsForUser() {
    // تحميل تقارير الشرطة للمستخدم
}

async function loadPoliceNotifications() {
    // تحميل إشعارات الشرطة
}

async function loadVolunteerReports() {
    // تحميل تقارير المتطوعين
}

async function loadCasesForVolunteer() {
    // تحميل الحالات للمتطوع
}

async function loadMyVolunteerReports() {
    // تحميل تقارير المتطوع
}

async function loadVolunteerNotifications() {
    // تحميل إشعارات المتطوع
                }
