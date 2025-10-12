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
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        console.log('🔑 مستخدم مسجل الدخول:', user.uid);
        
        try {
            // جلب بيانات المستخدم من Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                appData.currentUser = {
                    id: user.uid,
                    ...userData
                };
                
                localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
                console.log('✅ تم تحميل بيانات المستخدم:', userData.name || userData.fullName);
                
                // توجيه المستخدم حسب الصلاحية
                if (userData.role === 'user') {
                    showUserDashboard();
                } else if (userData.role === 'police') {
                    showPoliceDashboard();
                } else if (userData.role === 'volunteer') {
                    showVolunteerDashboard();
                }
            } else {
                console.error('❌ بيانات المستخدم غير موجودة في Firestore');
                showAlert("بيانات المستخدم غير مكتملة", "error");
                await logoutUser();
            }
        } catch (error) {
            console.error("Error getting user data:", error);
            showAlert("خطأ في تحميل بيانات المستخدم", "error");
        }
    } else {
        // المستخدم غير مسجل دخول
        console.log('🚫 لا يوجد مستخدم مسجل الدخول');
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

// ==================== دوال التحقق من نظام المصادقة ====================
async function checkAuthEmailExists(email) {
    try {
        const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
        return methods.length > 0;
    } catch (error) {
        console.error('Error checking auth email:', error);
        return false;
    }
}

// دالة لمعالجة الحسابات الميتة (موجودة في المصادقة ولكن ليس في Firestore)
async function handleOrphanedAccount(email, password) {
    try {
        // محاولة تسجيل الدخول أولاً
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // إذا نجح التسجيل، فهذا يعني الحساب موجود في المصادقة ولكن ليس في Firestore
        const user = firebase.auth().currentUser;
        
        if (user) {
            // إنشاء السجل المفقود في Firestore
            const userData = {
                email: email.toLowerCase().trim(),
                name: "مستخدم - يحتاج تحديث",
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(user.uid).set(userData, { merge: true });
            showAlert("تم استعادة الحساب بنجاح! يرجى تحديث بياناتك", "success");
            return true;
        }
    } catch (error) {
        console.error('Error handling orphaned account:', error);
    }
    return false;
}

// دالة لاستعادة الحسابات الميتة من واجهة المستخدم
async function recoverOrphanedAccount() {
    const email = prompt("الرجاء إدخال البريد الإلكتروني للحساب المفقود:");
    if (!email) return;
    
    const password = prompt("الرجاء إدخال كلمة المرور:");
    if (!password) return;
    
    try {
        // محاولة تسجيل الدخول
        await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = firebase.auth().currentUser;
        
        if (user) {
            // التحقق مما إذا كان الحساب موجوداً في Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // الحساب ميت - إنشاء السجل المفقود
                const userType = prompt("ما هو نوع الحساب؟ (user/police/volunteer):");
                const name = prompt("الرجاء إدخال الاسم:");
                
                const userData = {
                    email: email.toLowerCase().trim(),
                    name: name || "مستخدم - يحتاج تحديث",
                    role: userType || 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(user.uid).set(userData);
                showAlert("تم استعادة الحساب بنجاح! ✅", "success");
                
                // إعادة تحميل الصفحة
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                showAlert("الحساب موجود بالفعل في النظام", "info");
            }
        }
    } catch (error) {
        console.error("Error recovering account:", error);
        showAlert("فشل في استعادة الحساب. تأكد من البريد الإلكتروني وكلمة المرور", "error");
    }
}

// إضافة الزر إلى الواجهة (للتطوير)
function addRecoveryButton() {
    const recoveryBtn = document.createElement('button');
    recoveryBtn.textContent = 'استعادة حساب مفقود';
    recoveryBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 10px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1000;
    `;
    recoveryBtn.onclick = recoverOrphanedAccount;
    document.body.appendChild(recoveryBtn);
}

// ==================== دوال التسجيل والدخول ====================

// دوال المستخدمين - محسنة مع التحقق من نظام المصادقة
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
                registerBtn.textContent = 'جاري التحقق...';
            }

            // 1. التحقق من وجود البريد في نظام المصادقة أولاً
            console.log('🔍 التحقق من وجود البريد في نظام المصادقة...');
            const authEmailExists = await checkAuthEmailExists(email);
            if (authEmailExists) {
                // محاولة معالجة الحساب الميت
                const recovered = await handleOrphanedAccount(email, password);
                if (!recovered) {
                    showAlert("هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة. يرجى استخدام بريد إلكتروني آخر أو تسجيل الدخول", "error");
                    return;
                }
            }

            // 2. التحقق من وجود البريد الإلكتروني في قاعدة البيانات
            console.log('🔍 التحقق من وجود البريد في قاعدة البيانات...');
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل في قاعدة البيانات", "error");
                return;
            }

            // 3. التحقق من وجود رقم الهاتف في قاعدة البيانات
            console.log('🔍 التحقق من وجود رقم الهاتف في قاعدة البيانات...');
            const phoneExists = await checkPhoneExists(phone);
            if (phoneExists) {
                showAlert("رقم الهاتف مسجل مسبقاً في قاعدة البيانات", "error");
                return;
            }

            // 4. إنشاء المستخدم في Authentication
            console.log('📝 إنشاء مستخدم في Authentication...');
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('✅ تم إنشاء المستخدم في Authentication:', user.uid);

            // 5. حفظ بيانات المستخدم في Firestore
            console.log('💾 حفظ بيانات المستخدم في Firestore...');
            const userData = {
                fullName: fullName.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).set(userData);
            console.log('✅ تم حفظ بيانات المستخدم في Firestore');

            // 6. تحديث بيانات المستخدم في التطبيق
            appData.currentUser = {
                id: user.uid,
                ...userData
            };
            
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));

            showAlert("تم إنشاء الحساب بنجاح! ✅", "success");
            console.log('🎉 تم إنشاء الحساب بنجاح');

            // الانتقال إلى لوحة التحكم مباشرة
            setTimeout(() => {
                showUserDashboard();
            }, 1500);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الحساب:', error);
            
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة. يرجى استخدام بريد إلكتروني آخر";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة - يجب أن تكون 6 أحرف على الأقل";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "البريد الإلكتروني غير صالح";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "مشكلة في الاتصال بالإنترنت";
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
        
        // تحديث آخر دخول
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        
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

// دوال الشرطة - محسنة مع التحقق من نظام المصادقة
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
                registerBtn.textContent = 'جاري التحقق...';
            }

            // التحقق من وجود البريد في نظام المصادقة أولاً
            const authEmailExists = await checkAuthEmailExists(email);
            if (authEmailExists) {
                showAlert("هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة. يرجى استخدام بريد إلكتروني آخر", "error");
                return;
            }

            // التحقق من البريد الإلكتروني في قاعدة البيانات
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل في قاعدة البيانات", "error");
                return;
            }

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                role: 'police',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب الشرطة بنجاح!", "success");
            
            // تسجيل الدخول تلقائياً
            setTimeout(() => {
                showPoliceDashboard();
            }, 1500);
            
        } catch (error) {
            console.error("Error registering police: ", error);
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل";
            }
            
            showAlert(errorMessage, "error");
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
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // تحديث آخر دخول
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        
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

// دوال المتطوعين - محسنة مع التحقق من نظام المصادقة
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
                registerBtn.textContent = 'جاري التحقق...';
            }

            // التحقق من وجود البريد في نظام المصادقة أولاً
            const authEmailExists = await checkAuthEmailExists(email);
            if (authEmailExists) {
                showAlert("هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة. يرجى استخدام بريد إلكتروني آخر", "error");
                return;
            }

            // التحقق من البريد الإلكتروني في قاعدة البيانات
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showAlert("هذا البريد الإلكتروني مسجل بالفعل في قاعدة البيانات", "error");
                return;
            }

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: password,
                active: true,
                registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
                reportHandled: 0,
                volunteerId: user.uid,
                role: 'volunteer',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showAlert("تم إنشاء حساب المتطوع بنجاح!", "success");
            
            // تسجيل الدخول تلقائياً
            setTimeout(() => {
                showVolunteerDashboard();
            }, 1500);
            
        } catch (error) {
            console.error("Error registering volunteer: ", error);
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل مسبقاً في نظام المصادقة";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل";
            }
            
            showAlert(errorMessage, "error");
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
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // تحديث آخر دخول
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert("تم تسجيل الدخول بنجاح!", "success");
        
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

// دوال البلاغات للمستخدم - مكيفة مع الهيكل الجديد
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
            
            const newReport = {
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
            const reportRef = await db.collection('reports').add(newReport);
            const reportId = reportRef.id;
            
            // تحديث البلاغ بإضافة report id
            await reportRef.update({ reportId: reportId });
            
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
            const newReportDoc = {
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
            
            // عرض التفاصيل في modal أو نافذة منبثقة
            const detailsHTML = `
                <div class="report-details-modal">
                    <h3>تفاصيل البلاغ: ${report.name}</h3>
                    <p><strong>العمر:</strong> ${report.age}</p>
                    <p><strong>الجنس:</strong> ${report.gender || 'غير محدد'}</p>
                    <p><strong>الطول:</strong> ${report.height || 'غير محدد'}</p>
                    <p><strong>آخر مكالمة:</strong> ${report.last_call || 'غير محدد'}</p>
                    <p><strong>آخر مكان:</strong> ${report.last_seen_location}</p>
                    <p><strong>رقم الهاتف 1:</strong> ${report.phone1}</p>
                    <p><strong>رقم الهاتف 2:</strong> ${report.phone2 || 'غير متوفر'}</p>
                    <p><strong>رقم الهاتف 3:</strong> ${report.phone3 || 'غير متوفر'}</p>
                    <p><strong>الوصف:</strong> ${report.description || 'لا يوجد وصف'}</p>
                    <p><strong>الحالة:</strong> ${report.status}</p>
                    ${report.image ? `<img src="${report.image}" alt="صورة المفقود" style="max-width: 300px; margin-top: 10px;">` : ''}
                </div>
            `;
            
            // يمكن استبدال هذا بعرض modal حقيقي
            alert(`تفاصيل البلاغ:\nالاسم: ${report.name}\nالعمر: ${report.age}\nالجنس: ${report.gender}\nآخر مكان: ${report.last_seen_location}`);
        }
    } catch (error) {
        console.error("Error viewing report details: ", error);
        showAlert("حدث خطأ أثناء تحميل التفاصيل", "error");
    }
}

async function assignToVolunteer(reportId) {
    try {
        // في التطبيق الحقيقي، يمكن اختيار متطوع من قائمة
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

// ==================== تحديث التحقق أثناء الكتابة ====================
function setupRealTimeValidation() {
    // التحقق من البريد الإلكتروني للمستخدمين
    const userEmailInput = document.getElementById('user-email');
    const userPhoneInput = document.getElementById('user-phone');
    
    if (userEmailInput) {
        userEmailInput.addEventListener('blur', async function() {
            const email = this.value.trim();
            if (email) {
                // التحقق من نظام المصادقة أولاً
                const authExists = await checkAuthEmailExists(email);
                const dbExists = await checkEmailExists(email);
                
                if (authExists || dbExists) {
                    showAlert("هذا البريد الإلكتروني مسجل مسبقاً في النظام", "warning");
                    this.style.borderColor = '#f44336';
                } else {
                    this.style.borderColor = '#4CAF50';
                }
            }
        });
    }
    
    if (userPhoneInput) {
        userPhoneInput.addEventListener('blur', async function() {
            const phone = this.value.trim();
            if (phone) {
                const exists = await checkPhoneExists(phone);
                if (exists) {
                    showAlert("رقم الهاتف مسجل مسبقاً", "warning");
                    this.style.borderColor = '#f44336';
                } else {
                    this.style.borderColor = '#4CAF50';
                }
            }
        });
    }
    
    // التحقق من البريد الإلكتروني للشرطة
    const policeEmailInput = document.getElementById('police-email');
    const policePhoneInput = document.getElementById('police-phone');
    
    if (policeEmailInput) {
        policeEmailInput.addEventListener('blur', async function() {
            const email = this.value.trim();
            if (email) {
                // التحقق من نظام المصادقة أولاً
                const authExists = await checkAuthEmailExists(email);
                const dbExists = await checkEmailExists(email);
                
                if (authExists || dbExists) {
                    showAlert("هذا البريد الإلكتروني مسجل مسبقاً في النظام", "warning");
                    this.style.borderColor = '#f44336';
                } else {
                    this.style.borderColor = '#4CAF50';
                }
            }
        });
    }
    
    if (policePhoneInput) {
        policePhoneInput.addEventListener('blur', async function() {
            const phone = this.value.trim();
            if (phone) {
                const exists = await checkPhoneExists(phone);
                if (exists) {
                    showAlert("رقم الهاتف مسجل مسبقاً", "warning");
                    this.style.borderColor = '#f44336';
                } else {
                    this.style.borderColor = '#4CAF50';
                }
            }
        });
    }
    
    // التحقق من البريد الإلكتروني للمتطوعين
    const volunteerEmailInput = document.getElementById('volunteer-email');
    
    if (volunteerEmailInput) {
        volunteerEmailInput.addEventListener('blur', async function() {
            const email = this.value.trim();
            if (email) {
                // التحقق من نظام المصادقة أولاً
                const authExists = await checkAuthEmailExists(email);
                const dbExists = await checkEmailExists(email);
                
                if (authExists || dbExists) {
                    showAlert("هذا البريد الإلكتروني مسجل مسبقاً في النظام", "warning");
                    this.style.borderColor = '#f44336';
                } else {
                    this.style.borderColor = '#4CAF50';
                }
            }
        });
    }
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
window.recoverOrphanedAccount = recoverOrphanedAccount;

// ==================== تحديث التهيئة ====================
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
    
    // إعداد التحقق أثناء الكتابة
    setupRealTimeValidation();
    
    // التحقق من اتصال Firebase
    checkFirebaseConnection();
    
    // إضافة زر استعادة الحسابات الميتة (للتطوير)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        addRecoveryButton();
    }
});

// ==================== دوال إضافية للوحات التحكم ====================
function showPoliceSection(section) {
    // إخفاء جميع الأقسام أولاً
    document.querySelectorAll('#police-dashboard .dashboard-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    // إظهار القسم المطلوب
    document.getElementById(section).classList.remove('hidden');
}

function showVolunteerSection(section) {
    // إخفاء جميع الأقسام أولاً
    document.querySelectorAll('#volunteer-dashboard .dashboard-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    // إظهار القسم المطلوب
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
