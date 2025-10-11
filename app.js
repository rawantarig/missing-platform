// app.js - التطبيق الرئيسي بعد فصل قاعدة البيانات

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
        // المستخدم مسجل دخول - جلب بياناته
        const result = await database.getUserById(user.uid);
        if (result.success && result.user) {
            appData.currentUser = result.user;
            localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
            
            // توجيه المستخدم حسب الصلاحية
            if (appData.currentUser.role === 'user') {
                await showUserDashboard();
            } else if (appData.currentUser.role === 'police') {
                await showPoliceDashboard();
            } else if (appData.currentUser.role === 'volunteer') {
                await showVolunteerDashboard();
            }
        }
    } else {
        // المستخدم غير مسجل دخول
        appData.currentUser = null;
        localStorage.removeItem('currentUser');
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

// ==================== دوال EmailJS ====================
function sendLoginNotification(toEmail, userName, report) {
    console.log('📧 محاولة إرسال إيميل إلى:', toEmail);
    
    emailjs.send("service_sbkepx6", "template_m7905go", {
        to_email: toEmail,
        to_name: userName,
        missing_name: report.missingName,
        missing_age: report.missingAge,
        missing_type: report.missingType,
        last_call: report.lastCall,
        last_location: report.lastLocation,
        missing_height: report.missingHeight,
        missing_description: report.missingDescription,
        reporter_phone: report.reporterPhone,
        reporter_name: report.reporterName,
        additional_contact: report.additionalContact || 'لا يوجد'
    })
    .then(function(response) {
        console.log('✅ تم إرسال الإيميل بنجاح', response.status, response.text);
        showAlert('✅ تم إرسال الإشعار بنجاح إلى ' + toEmail, 'success');
    }, function(error) {
        console.log('❌ فشل إرسال الإيميل', error);
        showAlert('❌ فشل إرسال الإيميل، تم استخدام النظام البديل', 'warning');
        sendAlternativeNotification(toEmail, report);
    });
}

function sendAlternativeNotification(email, report) {
    console.log('🔄 استخدام النظام البديل للإشعارات');
    const backupNotification = {
        id: Date.now(),
        to: email,
        report: report,
        timestamp: new Date().toLocaleString('ar-EG'),
        type: 'backup'
    };
    
    let backups = JSON.parse(localStorage.getItem('emailBackups')) || [];
    backups.push(backupNotification);
    localStorage.setItem('emailBackups', JSON.stringify(backups));
    
    showAlert('💾 تم حفظ الإشعار في النظام البديل', 'info');
}

// ==================== دوال المستخدمين المعدلة ====================
async function registerUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (name && email && phone && password) {
        const result = await database.registerUser({ name, email, phone, password });
        
        if (result.success) {
            showAlert("تم إنشاء الحساب بنجاح!", "success");
            showLogin('user');
        } else {
            let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
            
            if (result.error && result.error.code === 'auth/email-already-in-use') {
                errorMessage = "هذا البريد الإلكتروني مسجل بالفعل";
            } else if (result.error && result.error.code === 'auth/weak-password') {
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
    
    const result = await database.loginUser(email, password);
    
    if (result.success) {
        appData.currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(appData.currentUser));
        
        if (appData.currentUser.role === 'user') {
            await showUserDashboard();
        } else if (appData.currentUser.role === 'police') {
            await showPoliceDashboard();
        } else if (appData.currentUser.role === 'volunteer') {
            await showVolunteerDashboard();
        }
    } else {
        let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        
        if (result.error && result.error.code === 'auth/user-not-found') {
            errorMessage = "المستخدم غير موجود";
        } else if (result.error && result.error.code === 'auth/wrong-password') {
            errorMessage = "كلمة المرور غير صحيحة";
        } else if (result.error && result.error.code === 'auth/invalid-email') {
            errorMessage = "البريد الإلكتروني غير صالح";
        }
        
        showAlert(errorMessage, "error");
    }
}

// ==================== إضافة دالة الخروج ====================
async function logoutUser() {
    const result = await database.logoutUser();
    
    if (result.success) {
        appData.currentUser = null;
        localStorage.removeItem('currentUser');
        showMainPage();
        showAlert("تم تسجيل الخروج بنجاح", "success");
    } else {
        showAlert("حدث خطأ أثناء تسجيل الخروج", "error");
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

// ==================== دوال البلاغات المعدلة ====================
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
                date: new Date().toLocaleDateString('ar-EG')
            };
            
            // حفظ البلاغ باستخدام قاعدة البيانات المنفصلة
            const result = await database.addReport(newReport);
            
            if (result.success) {
                // إرسال إشعار للمستخدم
                await database.addNotification({
                    userId: appData.currentUser.id,
                    message: `تم إرسال بلاغك بنجاح عن: ${missingName}`,
                    type: 'success',
                    read: false
                });
                
                // إرسال إشعار للشرطة
                await database.addNotification({
                    type: 'police',
                    message: `بلاغ جديد من ${appData.currentUser.name} عن: ${missingName}`,
                    reportId: result.reportId,
                    read: false
                });
                
                showAlert("تم إرسال البلاغ بنجاح! تم إخطار الشرطة", "success");
                resetReportForm();
                await loadUserReports();
            } else {
                showAlert("حدث خطأ أثناء إرسال البلاغ", "error");
            }
            
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
    
    const result = await database.getUserReports(appData.currentUser.id);
    
    if (result.success) {
        if (result.reports.length === 0) {
            myReportsList.innerHTML = '<p>لم تقم بإضافة أي بلاغات بعد</p>';
            return;
        }
        
        result.reports.forEach(report => {
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
    } else {
        console.error("Error loading user reports: ", result.error);
        myReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل البلاغات</p>';
    }
}

async function editUserReport(reportId) {
    try {
        const result = await database.getReportById(reportId);
        if (!result.success) return;
        
        const report = result.report;
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
        
        const result = await database.updateReport(reportId, {
            missingName,
            missingAge,
            lastLocation,
            missingDescription
        });
        
        if (result.success) {
            document.getElementById(`edit-form-${reportId}`).style.display = 'none';
            await loadUserReports();
            showAlert('تم حفظ التعديلات بنجاح', 'success');
        } else {
            showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
        }
    } catch (error) {
        console.error("Error saving report: ", error);
        showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
    }
}

async function deleteUserReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا البلاغ؟')) {
        const result = await database.deleteReport(reportId);
        
        if (result.success) {
            await loadUserReports();
            await updateUserBadges();
            showAlert('تم حذف البلاغ بنجاح', 'success');
        } else {
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
        const userReportsResult = await database.getUserReports(appData.currentUser.id);
        
        if (!userReportsResult.success || userReportsResult.reports.length === 0) {
            policeReportsList.innerHTML = '<p>لا توجد تقارير من الشرطة بعد</p>';
            return;
        }
        
        const userReportIds = userReportsResult.reports.map(report => report.id);
        
        // جلب تقارير الشرطة المرتبطة ببلاغات المستخدم
        let hasPoliceReports = false;
        
        for (const reportId of userReportIds) {
            const policeReportsResult = await database.getPoliceReportsForReport(reportId);
            
            if (policeReportsResult.success && policeReportsResult.policeReports.length > 0) {
                hasPoliceReports = true;
                
                policeReportsResult.policeReports.forEach(policeReport => {
                    const reportItem = document.createElement('div');
                    reportItem.className = 'report-item';
                    reportItem.innerHTML = `
                        <h3>تقرير الشرطة عن: ${policeReport.missingName || 'مفقود'}</h3>
                        <p><strong>محتوى التقرير:</strong> ${policeReport.content}</p>
                        <p><strong>تاريخ التقرير:</strong> ${new Date(policeReport.createdAt?.toDate()).toLocaleDateString('ar-EG')}</p>
                        <p><strong>من:</strong> ${policeReport.policeName}</p>
                    `;
                    policeReportsList.appendChild(reportItem);
                });
            }
        }
        
        if (!hasPoliceReports) {
            policeReportsList.innerHTML = '<p>لا توجد تقارير من الشرطة بعد</p>';
        }
        
    } catch (error) {
        console.error("Error loading police reports: ", error);
        policeReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل تقارير الشرطة</p>';
    }
}

// ==================== دوال الإشعارات المعدلة ====================
async function loadUserNotifications() {
    const notificationsList = document.getElementById('user-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    const result = await database.getUserNotifications(appData.currentUser.id);
    
    if (result.success) {
        if (result.notifications.length === 0) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        result.notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt?.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markNotificationAsRead('${notification.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
    } else {
        console.error("Error loading notifications: ", result.error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markNotificationAsRead(notificationId) {
    const result = await database.markNotificationAsRead(notificationId);
    
    if (result.success) {
        await loadUserNotifications();
        await updateUserBadges();
    } else {
        console.error("Error marking notification as read: ", result.error);
    }
}

async function updateUserBadges() {
    try {
        // تحديث شارة الإشعارات
        const notificationsResult = await database.getUserNotifications(appData.currentUser.id);
        const notificationsBadge = document.getElementById('user-notifications-badge');
        
        if (notificationsBadge) {
            if (notificationsResult.success && notificationsResult.notifications.length > 0) {
                notificationsBadge.textContent = notificationsResult.notifications.length;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // تحديث شارة البلاغات
        const reportsResult = await database.getUserReports(appData.currentUser.id);
        const reportsBadge = document.getElementById('my-reports-badge');
        
        if (reportsBadge) {
            if (reportsResult.success && reportsResult.reports.length > 0) {
                reportsBadge.textContent = reportsResult.reports.length;
                reportsBadge.style.display = 'inline-block';
            } else {
                reportsBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating badges: ", error);
    }
}

// ==================== دوال الشرطة ====================
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

async function loadAllReports() {
    const newReportsList = document.getElementById('new-reports-list');
    const inProgressList = document.getElementById('in-progress-list');
    const resolvedList = document.getElementById('resolved-list');
    
    if (!newReportsList) return;
    
    newReportsList.innerHTML = '';
    inProgressList.innerHTML = '';
    resolvedList.innerHTML = '';
    
    const result = await database.getAllReports();
    
    if (result.success) {
        if (result.reports.length === 0) {
            newReportsList.innerHTML = '<p>لا توجد بلاغات</p>';
            return;
        }
        
        appData.allReports = result.reports;
        
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
                    <button class="btn btn-primary" onclick="showReportDetails('${report.id}')">عرض التفاصيل</button>
                    <button class="btn btn-success" onclick="updateReportStatus('${report.id}', 'قيد المعالجة')">بدأ المعالجة</button>
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
    } else {
        console.error("Error loading all reports: ", result.error);
        newReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل البلاغات</p>';
    }
}

async function updateReportStatus(reportId, newStatus) {
    const result = await database.updateReportStatus(reportId, newStatus);
    
    if (result.success) {
        // إرسال إشعار للمستخدم
        const reportResult = await database.getReportById(reportId);
        if (reportResult.success) {
            const report = reportResult.report;
            await database.addNotification({
                userId: report.userId,
                message: `تم تحديث حالة بلاغك عن ${report.missingName} إلى: ${newStatus}`,
                type: 'info',
                read: false
            });
        }
        
        await loadAllReports();
        showAlert(`تم تحديث حالة البلاغ إلى: ${newStatus}`, 'success');
    } else {
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
        const policeReport = {
            reportId: caseId,
            content: content,
            policeName: appData.currentUser.name
        };
        
        const result = await database.addPoliceReport(policeReport);
        
        if (result.success) {
            // إرسال إشعار للمستخدم
            const reportResult = await database.getReportById(caseId);
            if (reportResult.success) {
                const report = reportResult.report;
                await database.addNotification({
                    userId: report.userId,
                    message: `تم إضافة تقرير جديد من الشرطة عن بلاغك: ${report.missingName}`,
                    type: 'info',
                    read: false
                });
            }
            
            showAlert("تم إرسال التقرير بنجاح!", "success");
            document.getElementById('report-content').value = '';
            document.getElementById('upload-reports').classList.add('hidden');
        } else {
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
    
    const result = await database.getPoliceNotifications();
    
    if (result.success) {
        if (result.notifications.length === 0) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        result.notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt?.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markPoliceNotificationAsRead('${notification.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
    } else {
        console.error("Error loading police notifications: ", result.error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markPoliceNotificationAsRead(notificationId) {
    const result = await database.markNotificationAsRead(notificationId);
    
    if (result.success) {
        await loadPoliceNotifications();
        await updatePoliceBadges();
    } else {
        console.error("Error marking police notification as read: ", result.error);
    }
}

async function updatePoliceBadges() {
    try {
        // شارة الإشعارات
        const notificationsResult = await database.getPoliceNotifications();
        const notificationsBadge = document.getElementById('police-notifications-badge');
        
        if (notificationsBadge) {
            if (notificationsResult.success && notificationsResult.notifications.length > 0) {
                notificationsBadge.textContent = notificationsResult.notifications.length;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // شارة البلاغات الجديدة
        const reportsResult = await database.getAllReports();
        const newReportsBadge = document.getElementById('new-reports-badge');
        
        if (newReportsBadge && reportsResult.success) {
            const newReportsCount = reportsResult.reports.filter(report => report.status === 'جديد').length;
            if (newReportsCount > 0) {
                newReportsBadge.textContent = newReportsCount;
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

async function loadCasesForVolunteer() {
    const casesList = document.getElementById('cases-list');
    if (!casesList) return;
    
    casesList.innerHTML = '';
    
    const result = await database.getAllReports();
    
    if (result.success) {
        const availableCases = result.reports.filter(report => 
            report.status === 'جديد' || report.status === 'قيد المعالجة'
        );
        
        if (availableCases.length === 0) {
            casesList.innerHTML = '<p>لا توجد حالات متاحة حالياً</p>';
            return;
        }
        
        availableCases.forEach(report => {
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
                <button class="btn btn-primary" onclick="selectCaseForVolunteer('${report.id}')">اختيار هذه الحالة</button>
            `;
            casesList.appendChild(caseItem);
        });
    } else {
        console.error("Error loading cases for volunteer: ", result.error);
        casesList.innerHTML = '<p>حدث خطأ أثناء تحميل الحالات</p>';
    }
}

function selectCaseForVolunteer(reportId) {
    appData.currentReportId = reportId;
    document.getElementById('select-case').classList.add('hidden');
    document.getElementById('case-details').classList.remove('hidden');
    document.getElementById('volunteer-case').value = reportId;
}

async function addVolunteerReport() {
    const caseId = document.getElementById('volunteer-case').value;
    const info = document.getElementById('volunteer-info').value;
    const phone1 = document.getElementById('volunteer-phone-1').value;
    const phone2 = document.getElementById('volunteer-phone-2').value;
    const email = document.getElementById('volunteer-email').value;
    
    if (caseId && info) {
        const volunteerReport = {
            reportId: caseId,
            volunteerId: appData.currentUser.id,
            volunteerName: appData.currentUser.name,
            volunteerEmail: email || appData.currentUser.email,
            volunteerPhone1: phone1,
            volunteerPhone2: phone2,
            content: info,
            date: new Date().toLocaleDateString('ar-EG')
        };
        
        const result = await database.addVolunteerReport(volunteerReport);
        
        if (result.success) {
            // إرسال إشعار للشرطة
            const reportResult = await database.getReportById(caseId);
            if (reportResult.success) {
                const report = reportResult.report;
                await database.addNotification({
                    type: 'police',
                    message: `تقرير جديد من المتطوع ${appData.currentUser.name} عن الحالة: ${report.missingName}`,
                    read: false
                });
            }
            
            // إرسال إشعار للمتطوع
            await database.addNotification({
                userId: appData.currentUser.id,
                message: `تم إرسال تقريرك بنجاح عن الحالة: ${reportResult.report.missingName}`,
                type: 'success',
                read: false
            });
            
            showAlert("تم إرسال التقرير بنجاح! تم إخطار الشرطة", "success");
            
            // إعادة تعيين الحقول
            document.getElementById('volunteer-info').value = '';
            document.getElementById('volunteer-phone-1').value = '';
            document.getElementById('volunteer-phone-2').value = '';
            document.getElementById('volunteer-email').value = appData.currentUser.email;
            document.getElementById('case-details').classList.add('hidden');
            document.getElementById('volunteer-case').value = '';
            
            await loadMyVolunteerReports();
            await updateVolunteerBadges();
        } else {
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
    
    const result = await database.getVolunteerReportsByVolunteer(appData.currentUser.id);
    
    if (result.success) {
        if (result.volunteerReports.length === 0) {
            myReportsList.innerHTML = '<p>لم تقم برفع أي تقارير بعد</p>';
            return;
        }
        
        // جلب بيانات البلاغات المرتبطة
        for (const vReport of result.volunteerReports) {
            const reportResult = await database.getReportById(vReport.reportId);
            
            if (reportResult.success) {
                const report = reportResult.report;
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
                        <button class="btn btn-primary" onclick="editVolunteerReport('${vReport.id}')">تعديل التقرير</button>
                        <button class="btn btn-danger" onclick="deleteVolunteerReport('${vReport.id}')">حذف التقرير</button>
                    </div>
                    <div id="edit-volunteer-form-${vReport.id}" class="edit-form"></div>
                `;
                myReportsList.appendChild(reportItem);
            }
        }
    } else {
        console.error("Error loading volunteer reports: ", result.error);
        myReportsList.innerHTML = '<p>حدث خطأ أثناء تحميل التقارير</p>';
    }
}

async function editVolunteerReport(reportId) {
    try {
        const result = await database.getVolunteerReportById(reportId);
        if (!result.success) return;
        
        const vReport = result.volunteerReport;
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

        const result = await database.updateVolunteerReport(reportId, {
            content,
            volunteerEmail,
            volunteerPhone1,
            volunteerPhone2
        });

        if (result.success) {
            document.getElementById(`edit-volunteer-form-${reportId}`).style.display = 'none';
            await loadMyVolunteerReports();
            showAlert('تم حفظ التعديلات بنجاح', 'success');
        } else {
            showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
        }
    } catch (error) {
        console.error("Error saving volunteer report: ", error);
        showAlert("حدث خطأ أثناء حفظ التعديلات", "error");
    }
}

async function deleteVolunteerReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
        const result = await database.deleteVolunteerReport(reportId);
        
        if (result.success) {
            await loadMyVolunteerReports();
            await updateVolunteerBadges();
            showAlert('تم حذف التقرير بنجاح', 'success');
        } else {
            showAlert('حدث خطأ أثناء حذف التقرير', 'error');
        }
    }
}

async function loadVolunteerReports() {
    const volunteerReportsList = document.getElementById('volunteer-reports-list');
    if (!volunteerReportsList) return;
    
    volunteerReportsList.innerHTML = '';
    
    const result = await database.getAllVolunteerReports();
    
    if (result.success) {
        if (result.volunteerReports.length === 0) {
            volunteerReportsList.innerHTML = '<p>لا توجد تقارير من المتطوعين</p>';
            return;
        }
        
        // جلب بيانات البلاغات المرتبطة
        for (const vReport of result.volunteerReports) {
            const reportResult = await database.getReportById(vReport.reportId);
            
            if (reportResult.success) {
                const report = reportResult.report;
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
                        <button class="btn btn-danger" onclick="deleteVolunteerReportFromPolice('${vReport.id}')">حذف التقرير</button>
                    </div>
                `;
                volunteerReportsList.appendChild(reportItem);
            }
        }
    } else {
        console.error("Error loading volunteer reports: ", result.error);
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
        const result = await database.deleteVolunteerReport(reportId);
        
        if (result.success) {
            await loadVolunteerReports();
            await updatePoliceBadges();
            showAlert('تم حذف التقرير بنجاح', 'success');
        } else {
            showAlert('حدث خطأ أثناء حذف التقرير', 'error');
        }
    }
}

async function loadVolunteerNotifications() {
    const notificationsList = document.getElementById('volunteer-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    const result = await database.getUserNotifications(appData.currentUser.id);
    
    if (result.success) {
        if (result.notifications.length === 0) {
            notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
            return;
        }
        
        result.notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item unread';
            notificationItem.innerHTML = `
                <p><strong>${notification.message}</strong></p>
                <p><small>${new Date(notification.createdAt?.toDate()).toLocaleString('ar-EG')}</small></p>
                <button class="mark-read" onclick="markVolunteerNotificationAsRead('${notification.id}')">تمت المشاهدة</button>
            `;
            notificationsList.appendChild(notificationItem);
        });
    } else {
        console.error("Error loading volunteer notifications: ", result.error);
        notificationsList.innerHTML = '<p>حدث خطأ أثناء تحميل الإشعارات</p>';
    }
}

async function markVolunteerNotificationAsRead(notificationId) {
    const result = await database.markNotificationAsRead(notificationId);
    
    if (result.success) {
        await loadVolunteerNotifications();
        await updateVolunteerBadges();
    } else {
        console.error("Error marking volunteer notification as read: ", result.error);
    }
}

async function updateVolunteerBadges() {
    try {
        // شارة الإشعارات
        const notificationsResult = await database.getUserNotifications(appData.currentUser.id);
        const notificationsBadge = document.getElementById('volunteer-notifications-badge');
        
        if (notificationsBadge) {
            if (notificationsResult.success && notificationsResult.notifications.length > 0) {
                notificationsBadge.textContent = notificationsResult.notifications.length;
                notificationsBadge.style.display = 'inline-block';
            } else {
                notificationsBadge.style.display = 'none';
            }
        }
        
        // شارة التقارير
        const reportsResult = await database.getVolunteerReportsByVolunteer(appData.currentUser.id);
        const reportsBadge = document.getElementById('my-volunteer-reports-badge');
        
        if (reportsBadge) {
            if (reportsResult.success && reportsResult.volunteerReports.length > 0) {
                reportsBadge.textContent = reportsResult.volunteerReports.length;
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

function showUserSection(section) {
    document.getElementById('add-report').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('user-notifications').classList.add('hidden');
    document.getElementById('police-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
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

function showVolunteerSection(section) {
    document.getElementById('all-reports').classList.add('hidden');
    document.getElementById('select-case').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById('volunteer-notifications').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
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
    
    // إضافة أزرار الخروج
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', logoutUser);
    });
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
