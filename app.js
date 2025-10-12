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

// التحقق من اتصال Firebase
async function checkFirebaseConnection() {
    try {
        console.log('🔍 التحقق من اتصال Firebase...');
        
        // محاولة قراءة بسيطة من Firestore
        const testRef = db.collection('test').doc('connection');
        await testRef.set({ 
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            test: true 
        });
        
        console.log('✅ اتصال Firebase يعمل بشكل صحيح');
        return true;
    } catch (error) {
        console.error('❌ فشل الاتصال بـ Firebase:', error);
        showAlert('مشكلة في الاتصال بقاعدة البيانات', 'error');
        return false;
    }
}

// استدعاء التحقق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    checkFirebaseConnection();
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

// دوال المستخدمين - مصححة
async function registerUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (name && email && phone && password) {
        try {
            console.log('🚀 بدء عملية إنشاء حساب...');
            
            // تعطيل الزر لمنع النقر المتعدد
            const registerBtn = document.querySelector('#user-register-btn');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.textContent = 'جاري إنشاء الحساب...';
            }

            // 1. إنشاء المستخدم في Authentication
            console.log('📝 إنشاء مستخدم في Authentication...');
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('✅ تم إنشاء المستخدم في Authentication:', user.uid);

            // 2. حفظ بيانات المستخدم في Firestore
            console.log('💾 حفظ بيانات المستخدم في Firestore...');
            const userData = {
                name: name,
                email: email,
                phone: phone,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).set(userData);
            console.log('✅ تم حفظ بيانات المستخدم في Firestore');

            // 3. إعداد بيانات المستخدم في التطبيق
            appData.currentUser = {
                id: user.uid,
                ...userData
            };
            
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));

            showAlert("تم إنشاء الحساب بنجاح! ✅", "success");
            console.log('🎉 تم إنشاء الحساب بنجاح');

            // الانتقال إلى صفحة الدخول بعد نجاح التسجيل
            setTimeout(() => {
                showLogin('user');
            }, 1500);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الحساب:', error);
            
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            // ✅ معالجة محددة لكل نوع خطأ - مصححة
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل بالفعل";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة - يجب أن تكون 6 أحرف على الأقل";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "البريد الإلكتروني غير صالح";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "مشكلة في الاتصال بالإنترنت";
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = "عملية التسجيل غير مفعلة";
            } else {
                errorMessage = "حدث خطأ غير متوقع: " + error.message;
            }
            
            showAlert(errorMessage, "error");
            
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
        console.error("Error logging in user: ", error);
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

// ==================== دوال لوحة التحكم ====================
function showUserDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
    document.getElementById('police-dashboard').classList.add('hidden');
    document.getElementById('volunteer-dashboard').classList.add('hidden');
    
    if (appData.currentUser) {
        document.getElementById('user-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
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

// ... (استمرار دوال إدارة البلاغات والإشعارات - نفس الكود السابق)

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
