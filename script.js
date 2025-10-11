
// بيانات التطبيق
const appData = {
    police: [],
    users: [],
    volunteers: [],
    reports: [],
    policeReports: [],
    volunteerReports: [],
    userNotifications: [],
    policeNotifications: [],
    volunteerNotifications: [],
    currentUser: null,
    currentReportId: null,
    editingReportId: null
};

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
        showCustomNotification('✅ تم إرسال الإشعار بنجاح إلى ' + toEmail, 'success');
    }, function(error) {
        console.log('❌ فشل إرسال الإيميل', error);
        showCustomNotification('❌ فشل إرسال الإيميل، تم استخدام النظام البديل', 'warning');
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
    
    showCustomNotification('💾 تم حفظ الإشعار في النظام البديل', 'info');
}

function showCustomNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
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
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#FF9800';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ==================== دوال التسجيل والمستخدمين ====================
function registerUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value;
    const password = document.getElementById('user-password').value;
    
    if (name && email && phone && password) {
        const newUser = {
            id: appData.users.length + 1,
            name: name,
            email: email,
            phone: phone,
            password: password
        };
        
        appData.users.push(newUser);
        alert("تم إنشاء الحساب بنجاح!");
        showLogin('user');
    } else {
        alert("يرجى ملء جميع الحقول");
    }
}

function loginUser() {
    const email = document.getElementById('user-login-email').value;
    const password = document.getElementById('user-login-password').value;
    
    const user = appData.users.find(u => u.email === email && u.password === password);
    
    if (user) {
        appData.currentUser = user;
        showUserDashboard();
    } else {
        alert("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }
}

function showUserDashboard() {
    document.getElementById('main-page').classList.add('hidden');
    document.getElementById('user-dashboard').classList.remove('hidden');
    document.getElementById('user-welcome').textContent = `مرحباً ${appData.currentUser.name}`;
    
    document.getElementById('user-phone-display').textContent = appData.currentUser.phone;
    document.getElementById('user-email-display').textContent = appData.currentUser.email;
    document.getElementById('reporter-phone').value = appData.currentUser.phone;
    
    loadUserNotifications();
    loadUserReports();
    loadPoliceReportsForUser();
    updateUserBadges();
}

// ==================== إصلاح: عرض تقارير الشرطة للمستخدم ====================
function loadPoliceReportsForUser() {
    const policeReportsList = document.getElementById('police-reports-list');
    if (!policeReportsList) return;
    
    policeReportsList.innerHTML = '';
    
    // الحصول على تقارير الشرطة المرتبطة ببلاغات المستخدم
    const userReportsIds = appData.reports
        .filter(report => report.userId === appData.currentUser.email)
        .map(report => report.id);
    
    const userPoliceReports = appData.policeReports.filter(pReport => 
        userReportsIds.includes(pReport.reportId)
    );
    
    if (userPoliceReports.length === 0) {
        policeReportsList.innerHTML = '<p>لا توجد تقارير من الشرطة بعد</p>';
        return;
    }
    
    userPoliceReports.forEach(pReport => {
        const report = appData.reports.find(r => r.id === pReport.reportId);
        if (report) {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            reportItem.innerHTML = `
                <h3>تقرير الشرطة عن: ${report.missingName}</h3>
                <p><strong>محتوى التقرير:</strong> ${pReport.content}</p>
                <p><strong>تاريخ التقرير:</strong> ${pReport.date}</p>
                <p><strong>حالة البلاغ:</strong> ${report.status}</p>
            `;
            policeReportsList.appendChild(reportItem);
        }
    });
}

// ==================== دوال إضافة البلاغ مع الصور ====================
function addUserReport() {
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
        let photoData = null;
        
        if (photoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                photoData = e.target.result;
                completeReportSubmission(photoData);
            };
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            completeReportSubmission(null);
        }
        
        function completeReportSubmission(photo) {
            const newReport = {
                id: appData.reports.length + 1,
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
                status: "جديد",
                date: new Date().toLocaleDateString('ar-EG'),
                photo: photo
            };
            
            appData.reports.push(newReport);
          // إرسال إشعار للشرطة
            sendPoliceNotification(`تقرير جديد من المتطوع ${appData.currentUser.name} عن الحالة: ${report.missingName}`);
            
            // إرسال إشعار للمتطوع
            sendVolunteerNotification(`تم إرسال تقريرك بنجاح عن الحالة: ${report.missingName}`);
            
            alert("تم إرسال التقرير بنجاح! تم إخطار الشرطة");
            
            // إعادة تعيين الحقول
            document.getElementById('volunteer-info').value = '';
            document.getElementById('volunteer-phone-1').value = '';
            document.getElementById('volunteer-phone-2').value = '';
            document.getElementById('volunteer-email').value = appData.currentUser.email;
            document.getElementById('case-details').classList.add('hidden');
            document.getElementById('volunteer-case').value = '';
            
            loadMyVolunteerReports();
            updateVolunteerBadges();
        }
    } else {
        alert("يرجى اختيار حالة وإدخال المعلومات المطلوبة");
    }
}

// ==================== إصلاح: عرض تقارير المتطوع مع إمكانية التعديل ====================
function loadMyVolunteerReports() {
    const myReportsList = document.getElementById('my-volunteer-reports-list');
    if (!myReportsList) return;
    
    myReportsList.innerHTML = '';
    
    const myReports = appData.volunteerReports.filter(report => 
        report.volunteerId === appData.currentUser.id
    );
    
    if (myReports.length === 0) {
        myReportsList.innerHTML = '<p>لم تقم برفع أي تقارير بعد</p>';
    } else {
        myReports.forEach(vReport => {
            const report = appData.reports.find(r => r.id === vReport.reportId);
            if (report) {
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
                        <button class="btn btn-primary" onclick="editVolunteerReport(${vReport.id})">تعديل التقرير</button>
                        <button class="btn btn-danger" onclick="deleteVolunteerReport(${vReport.id})">حذف التقرير</button>
                    </div>
                    <div id="edit-volunteer-form-${vReport.id}" class="edit-form"></div>
                `;
                myReportsList.appendChild(reportItem);
            }
        });
    }
}

function editVolunteerReport(reportId) {
    const vReport = appData.volunteerReports.find(r => r.id === reportId);
    if (vReport) {
        const editForm = document.getElementById(`edit-volunteer-form-${reportId}`);
        editForm.innerHTML = `
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
            <button class="btn btn-success" onclick="saveVolunteerReport(${reportId})">حفظ التعديلات</button>
            <button class="btn btn-danger" onclick="cancelVolunteerEdit(${reportId})">إلغاء</button>
        `;
        editForm.style.display = 'block';
    }
}

function saveVolunteerReport(reportId) {
    const vReport = appData.volunteerReports.find(r => r.id === reportId);
    if (vReport) {
        vReport.content = document.getElementById(`edit-volunteer-info-${reportId}`).value;
        vReport.volunteerEmail = document.getElementById(`edit-volunteer-email-${reportId}`).value;
        vReport.volunteerPhone1 = document.getElementById(`edit-volunteer-phone1-${reportId}`).value;
        vReport.volunteerPhone2 = document.getElementById(`edit-volunteer-phone2-${reportId}`).value;

        document.getElementById(`edit-volunteer-form-${reportId}`).style.display = 'none';
        loadMyVolunteerReports();
        showCustomNotification('تم حفظ التعديلات بنجاح', 'success');
    }
}

function cancelVolunteerEdit(reportId) {
    document.getElementById(`edit-volunteer-form-${reportId}`).style.display = 'none';
}

function deleteVolunteerReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
        appData.volunteerReports = appData.volunteerReports.filter(r => r.id !== reportId);
        loadMyVolunteerReports();
        updateVolunteerBadges();
        showCustomNotification('تم حذف التقرير بنجاح', 'success');
    }
}

// ==================== دوال إشعارات الشرطة ====================
function sendPoliceNotification(message) {
    const notification = {
        id: appData.policeNotifications.length + 1,
        message: message,
        type: 'info',
        date: new Date().toLocaleString('ar-EG'),
        read: false
    };
    
    appData.policeNotifications.push(notification);
    updatePoliceBadges();
}

function loadPoliceNotifications() {
    const notificationsList = document.getElementById('police-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    if (appData.policeNotifications.length === 0) {
        notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
        return;
    }
    
    appData.policeNotifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <p><strong>${notification.message}</strong></p>
            <p><small>${notification.date}</small></p>
            ${!notification.read ? `<button class="mark-read" onclick="markPoliceNotificationAsRead(${notification.id})">تمت المشاهدة</button>` : ''}
        `;
        notificationsList.appendChild(notificationItem);
    });
}

function markPoliceNotificationAsRead(notificationId) {
    const notification = appData.policeNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        loadPoliceNotifications();
        updatePoliceBadges();
    }
}

// ==================== دوال إشعارات المستخدم ====================
function sendUserNotification(message, userEmail = null) {
    const targetEmail = userEmail || appData.currentUser.email;
    
    const notification = {
        id: appData.userNotifications.length + 1,
        userId: targetEmail,
        message: message,
        type: 'info',
        date: new Date().toLocaleString('ar-EG'),
        read: false
    };
    
    appData.userNotifications.push(notification);
    
    // إذا كان المستخدم مسجل دخول حالياً، قم بتحديث الإشعارات
    if (appData.currentUser && appData.currentUser.email === targetEmail) {
        loadUserNotifications();
        updateUserBadges();
    }
}

function loadUserNotifications() {
    const notificationsList = document.getElementById('user-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    const userNotifications = appData.userNotifications.filter(n => n.userId === appData.currentUser.email);
    
    if (userNotifications.length === 0) {
        notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
        return;
    }
    
    userNotifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <p><strong>${notification.message}</strong></p>
            <p><small>${notification.date}</small></p>
            ${!notification.read ? `<button class="mark-read" onclick="markUserNotificationAsRead(${notification.id})">تمت المشاهدة</button>` : ''}
        `;
        notificationsList.appendChild(notificationItem);
    });
}

function markUserNotificationAsRead(notificationId) {
    const notification = appData.userNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        loadUserNotifications();
        updateUserBadges();
    }
}

// ==================== دوال إشعارات المتطوعين ====================
function sendVolunteerNotification(message) {
    const notification = {
        id: appData.volunteerNotifications.length + 1,
        message: message,
        type: 'info',
        date: new Date().toLocaleString('ar-EG'),
        read: false
    };
    
    appData.volunteerNotifications.push(notification);
    updateVolunteerBadges();
}

function loadVolunteerNotifications() {
    const notificationsList = document.getElementById('volunteer-notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    if (appData.volunteerNotifications.length === 0) {
        notificationsList.innerHTML = '<p>لا توجد إشعارات</p>';
        return;
    }
    
    appData.volunteerNotifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <p><strong>${notification.message}</strong></p>
            <p><small>${notification.date}</small></p>
            ${!notification.read ? `<button class="mark-read" onclick="markVolunteerNotificationAsRead(${notification.id})">تمت المشاهدة</button>` : ''}
        `;
        notificationsList.appendChild(notificationItem);
    });
}

function markVolunteerNotificationAsRead(notificationId) {
    const notification = appData.volunteerNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        loadVolunteerNotifications();
        updateVolunteerBadges();
    }
}

// ==================== دوال تقارير المتطوعين مع إضافة أرقام الهواتف والبريد الإلكتروني ====================
function loadVolunteerReports() {
    const volunteerReportsList = document.getElementById('volunteer-reports-list');
    if (!volunteerReportsList) return;
    
    volunteerReportsList.innerHTML = '';
    
    if (appData.volunteerReports.length === 0) {
        volunteerReportsList.innerHTML = '<p>لا توجد تقارير من المتطوعين</p>';
        return;
    }
    
    appData.volunteerReports.forEach(vReport => {
        const report = appData.reports.find(r => r.id === vReport.reportId);
        if (report) {
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
                    <button class="btn btn-danger" onclick="deleteVolunteerReportFromPolice(${vReport.id})">حذف التقرير</button>
                </div>
            `;
            volunteerReportsList.appendChild(reportItem);
        }
    });
}

function contactVolunteer(email, phone1, phone2, name) {
    let contactInfo = `معلومات الاتصال بالمتطوع ${name}:\n`;
    contactInfo += `📧 البريد الإلكتروني: ${email}\n`;
    contactInfo += `📞 رقم الهاتف 1: ${phone1 || 'غير متوفر'}\n`;
    if (phone2) {
        contactInfo += `📞 رقم الهاتف 2: ${phone2}\n`;
    }
    
    showCustomNotification(contactInfo, 'info');
}

function deleteVolunteerReportFromPolice(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
        appData.volunteerReports = appData.volunteerReports.filter(r => r.id !== reportId);
        loadVolunteerReports();
        updatePoliceBadges();
        showCustomNotification('تم حذف التقرير بنجاح', 'success');
    }
}

// ==================== دوال تحديث الشارات ====================
function updateUserBadges() {
    // تحديث شارات الإشعارات للمستخدم
    const userNotificationsBadge = document.getElementById('user-notifications-badge');
    const unreadUserNotifications = appData.userNotifications.filter(n => 
        n.userId === appData.currentUser.email && !n.read
    ).length;
    
    if (userNotificationsBadge) {
        if (unreadUserNotifications > 0) {
            userNotificationsBadge.textContent = unreadUserNotifications;
            userNotificationsBadge.classList.remove('hidden');
        } else {
            userNotificationsBadge.classList.add('hidden');
        }
    }
    
    // تحديث شارات بلاغاتي
    const myReportsBadge = document.getElementById('my-reports-badge');
    const myReportsCount = appData.reports.filter(r => 
        r.userId === appData.currentUser.email
    ).length;
    
    if (myReportsBadge && myReportsCount > 0) {
        myReportsBadge.textContent = myReportsCount;
        myReportsBadge.classList.remove('hidden');
    } else if (myReportsBadge) {
        myReportsBadge.classList.add('hidden');
    }
    
    // تحديث شارات تقارير الشرطة
    const policeReportsBadge = document.getElementById('police-reports-badge');
    const userReportsIds = appData.reports
        .filter(report => report.userId === appData.currentUser.email)
        .map(report => report.id);
    const userPoliceReportsCount = appData.policeReports.filter(pReport => 
        userReportsIds.includes(pReport.reportId)
    ).length;
    
    if (policeReportsBadge && userPoliceReportsCount > 0) {
        policeReportsBadge.textContent = userPoliceReportsCount;
        policeReportsBadge.classList.remove('hidden');
    } else if (policeReportsBadge) {
        policeReportsBadge.classList.add('hidden');
    }
}

function updatePoliceBadges() {// تحديث شارات الإشعارات للشرطة
    const policeNotificationsBadge = document.getElementById('police-notifications-badge');
    const unreadPoliceNotifications = appData.policeNotifications.filter(n => !n.read).length;
    
    if (policeNotificationsBadge) {
        if (unreadPoliceNotifications > 0) {
            policeNotificationsBadge.textContent = unreadPoliceNotifications;
            policeNotificationsBadge.classList.remove('hidden');
        } else {
            policeNotificationsBadge.classList.add('hidden');
        }
    }
    
    // تحديث شارات البلاغات الجديدة
    const newReportsBadge = document.getElementById('new-reports-badge');
    const newReportsCount = appData.reports.filter(r => r.status === 'جديد').length;
    
    if (newReportsBadge && newReportsCount > 0) {
        newReportsBadge.textContent = newReportsCount;
        newReportsBadge.classList.remove('hidden');
    } else if (newReportsBadge) {
        newReportsBadge.classList.add('hidden');
    }
    
    // تحديث شارات تقارير المتطوعين
    const volunteerReportsBadge = document.getElementById('volunteer-reports-badge');
    const volunteerReportsCount = appData.volunteerReports.length;
    
    if (volunteerReportsBadge && volunteerReportsCount > 0) {
        volunteerReportsBadge.textContent = volunteerReportsCount;
        volunteerReportsBadge.classList.remove('hidden');
    } else if (volunteerReportsBadge) {
        volunteerReportsBadge.classList.add('hidden');
    }
}

function updateVolunteerBadges() {
    // تحديث شارات الإشعارات للمتطوعين
    const volunteerNotificationsBadge = document.getElementById('volunteer-notifications-badge');
    const unreadVolunteerNotifications = appData.volunteerNotifications.filter(n => !n.read).length;
    
    if (volunteerNotificationsBadge) {
        if (unreadVolunteerNotifications > 0) {
            volunteerNotificationsBadge.textContent = unreadVolunteerNotifications;
            volunteerNotificationsBadge.classList.remove('hidden');
        } else {
            volunteerNotificationsBadge.classList.add('hidden');
        }
    }
    
    // تحديث شارات تقاريري
    const myVolunteerReportsBadge = document.getElementById('my-volunteer-reports-badge');
    const myVolunteerReportsCount = appData.volunteerReports.filter(r => 
        r.volunteerId === appData.currentUser.id
    ).length;
    
    if (myVolunteerReportsBadge && myVolunteerReportsCount > 0) {
        myVolunteerReportsBadge.textContent = myVolunteerReportsCount;
        myVolunteerReportsBadge.classList.remove('hidden');
    } else if (myVolunteerReportsBadge) {
        myVolunteerReportsBadge.classList.add('hidden');
    }
}

// ==================== دوال التنقل ====================
function showPlatform(platform) {
    // إخفاء جميع محتويات المنصات
    document.querySelectorAll('.platform-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // إظهار المحتوى المحدد
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
    document.getElementById('police-reports').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
    
    if (section === 'police-reports') {
        loadPoliceReportsForUser();
    }
}

function showPoliceSection(section) {
    document.getElementById('new-reports').classList.add('hidden');
    document.getElementById('in-progress-reports').classList.add('hidden');
    document.getElementById('resolved-reports').classList.add('hidden');
    document.getElementById('volunteer-reports').classList.add('hidden');
    document.getElementById('upload-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
}

function showVolunteerSection(section) {
    document.getElementById('all-reports').classList.add('hidden');
    document.getElementById('select-case').classList.add('hidden');
    document.getElementById('my-reports').classList.add('hidden');
    document.getElementById(section).classList.remove('hidden');
    
    if (section === 'select-case') {
        loadCasesForVolunteer();
    } else if (section === 'my-reports') {
        loadMyVolunteerReports();
    }
}

// ==================== دوال إضافية للمستخدمين ====================
function loadUserReports() {
    const myReportsList = document.getElementById('my-reports-list');
    if (!myReportsList) return;
    
    myReportsList.innerHTML = '';
    
    const userReports = appData.reports.filter(report => report.userId === appData.currentUser.email);
    
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
                <button class="btn btn-primary" onclick="editUserReport(${report.id})">تعديل</button>
                <button class="btn btn-danger" onclick="deleteUserReport(${report.id})">حذف</button>
            </div>
            <div id="edit-form-${report.id}" class="edit-form"></div>
        `;
        
        myReportsList.appendChild(reportItem);
    });
}

function editUserReport(reportId) {
    const report = appData.reports.find(r => r.id === reportId);
    if (report) {
        const editForm = document.getElementById(`edit-form-${reportId}`);
        editForm.innerHTML = `
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
            <button class="btn btn-success" onclick="saveUserReport(${reportId})">حفظ التعديلات</button>
            <button class="btn btn-danger" onclick="cancelEdit(${reportId})">إلغاء</button>
        `;
        editForm.style.display = 'block';
    }
}

function saveUserReport(reportId) {
    const report = appData.reports.find(r => r.id === reportId);
    if (report) {
        report.missingName = document.getElementById(`edit-missing-name-${reportId}`).value;
        report.missingAge = document.getElementById(`edit-missing-age-${reportId}`).value;
        report.lastLocation = document.getElementById(`edit-last-location-${reportId}`).value;
        
        document.getElementById(`edit-form-${reportId}`).style.display = 'none';
        loadUserReports();
        showCustomNotification('تم حفظ التعديلات بنجاح', 'success');
    }
}

function cancelEdit(reportId) {
    document.getElementById(`edit-form-${reportId}`).style.display = 'none';
}

function deleteUserReport(reportId) {
    if (confirm('هل أنت متأكد من حذف هذا البلاغ؟')) {
        appData.reports = appData.reports.filter(r => r.id !== reportId);
        loadUserReports();
        updateUserBadges();
        showCustomNotification('تم حذف البلاغ بنجاح', 'success');
    }
}

// ==================== تهيئة البيانات عند تحميل الصفحة ====================
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
                    preview.src = e.target.result;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// ==================== دالة إرسال تقارير الشرطة ====================
function sendPoliceReport() {
    const caseId = document.getElementById('report-case').value;
    const content = document.getElementById('report-content').value;
    
    if (caseId && content) {
        const report = appData.reports.find(r => r.id == caseId);
        if (report) {
            const newPoliceReport = {
                id: appData.policeReports.length + 1,
                reportId: parseInt(caseId),
                content: content,
                date: new Date().toLocaleString('ar-EG'),
                read: false
            };
            
            appData.policeReports.push(newPoliceReport);
            
            // إرسال إشعار للمستخدم
            const user = appData.users.find(u => u.email === report.userId);
            if (user) {
                sendUserNotification(`تم إضافة تقرير جديد من الشرطة عن بلاغك: ${report.missingName}`, user.email);
            }
            
            alert("تم إرسال التقرير بنجاح!");
            document.getElementById('report-content').value = '';
            document.getElementById('report-case').value = '';
        }
    } else {
        alert("يرجى اختيار بلاغ وإدخال محتوى التقرير");
    }
}
import { auth, db } from './firebase.js';

``
