// Kullanıcı e-posta doğrulama ve kayıt işlemi
// Bu kod signup.js dosyasına eklenmeli

let verifiedEmail = null; // Doğrulanmış e-posta adresini tutacak değişken

// E-posta ve şifre doğrulama
function validateEmailAndPassword() {
    const email = document.getElementById('mail_input').value;
    const password = document.getElementById('password_input').value;
    const emailError = document.getElementById('email_error');
    const passwordError = document.getElementById('password_error');
    
    // E-posta doğrulama regex: 9 rakam + @kku.edu.tr
    const emailRegex = /^[0-9]{9}@kku\.edu\.tr$/;
    
    // Şifre doğrulama regex: En az 8 karakter, 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    let valid = true;
    
    // E-posta doğrulama
    if (!emailRegex.test(email)) {
        emailError.textContent = "❌ Geçersiz e-posta! Lütfen 9 rakam ve @kku.edu.tr ile biten bir e-posta girin.";
        emailError.style.visibility = "visible";
        valid = false;
    } else {
        emailError.style.visibility = "hidden";
    }
    
    // Şifre doğrulama
    if (!passwordRegex.test(password)) {
        passwordError.textContent = "❌ Şifre en az 8 karakter olmalı, büyük/küçük harf, rakam ve özel karakter içermelidir.";
        passwordError.style.visibility = "visible";
        valid = false;
    } else {
        passwordError.style.visibility = "hidden";
    }
    
    // Eğer hata varsa işlemi durdur
    if (!valid) return;
    
    // Eğer her şey doğruysa FastAPI'ye e-posta gönderme isteği gönder
    sendVerificationEmail(email);
}

// Doğrulama e-postası gönder
function sendVerificationEmail(email) {
    const emailError = document.getElementById('email_error');
    
    fetch('https://kkuyemekhanepuanla.com.tr/send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Doğrulama kodu girişi için formu göster
            showVerificationForm(email);
        } else {
            emailError.textContent = data.detail || "⚠️ E-posta gönderilirken bir hata oluştu.";
            emailError.style.visibility = "visible";
        }
    })
    .catch(error => {
        emailError.textContent = "⚠️ Bir hata oluştu. Lütfen tekrar deneyin.";
        emailError.style.visibility = "visible";
        console.error('Error:', error);
    });
}

// Doğrulama formunu göster
function showVerificationForm(email) {
    // Mevcut formu gizle
    const signupForm = document.querySelector('form');
    signupForm.style.display = 'none';
    
    // Yeni doğrulama formu oluştur
    const verificationForm = document.createElement('div');
    verificationForm.className = 'verification-form';
    verificationForm.innerHTML = `
        <h3>E-posta Doğrulama</h3>
        <p>Lütfen ${email} adresine gönderilen 6 haneli doğrulama kodunu girin:</p>
        <div class="input-container">
            <input type="text" id="verification_code" placeholder="Doğrulama Kodu" maxlength="6">
            <p id="verification_error" class="error_message" style="color: red; visibility: hidden;"></p>
        </div>
        <button id="verify_button">Doğrula</button>
        <button id="resend_button">Kodu Tekrar Gönder</button>
        <button id="cancel_button">İptal</button>
    `;
    
    // Formu sayfaya ekle
    signupForm.parentNode.insertBefore(verificationForm, signupForm.nextSibling);
    
    // Doğrulama butonu olayı
    document.getElementById('verify_button').addEventListener('click', function() {
        verifyCode(email);
    });
    
    // Tekrar gönder butonu olayı
    document.getElementById('resend_button').addEventListener('click', function() {
        sendVerificationEmail(email);
    });
    
    // İptal butonu olayı
    document.getElementById('cancel_button').addEventListener('click', function() {
        verificationForm.remove();
        signupForm.style.display = 'block';
    });
}

// Doğrulama kodunu kontrol et
function verifyCode(email) {
    const code = document.getElementById('verification_code').value;
    const verificationError = document.getElementById('verification_error');
    
    if (!code || code.length !== 6) {
        verificationError.textContent = "❌ Lütfen geçerli bir doğrulama kodu girin.";
        verificationError.style.visibility = "visible";
        return;
    }
    
    fetch('https://kkuyemekhanepuanla.com.tr/verify-code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email, code: code })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.verified) {
            // Doğrulama başarılı, kayıt formunu göster
            verifiedEmail = email;
            showRegistrationForm(email);
        } else {
            verificationError.textContent = data.detail || "❌ Geçersiz doğrulama kodu.";
            verificationError.style.visibility = "visible";
        }
    })
    .catch(error => {
        verificationError.textContent = "⚠️ Bir hata oluştu. Lütfen tekrar deneyin.";
        verificationError.style.visibility = "visible";
        console.error('Error:', error);
    });
}

// Kayıt formunu göster
function showRegistrationForm(email) {
    // Doğrulama formunu kaldır
    const verificationForm = document.querySelector('.verification-form');
    verificationForm.remove();
    
    // Orijinal formu tekrar göster ve e-posta alanını doldur
    const signupForm = document.querySelector('form');
    signupForm.style.display = 'block';
    document.getElementById('mail_input').value = email;
    document.getElementById('mail_input').readOnly = true; // E-posta alanını salt okunur yap
    
    // Form gönderme olayını değiştir
    signupForm.onsubmit = function(event) {
        event.preventDefault();
        completeRegistration();
    };
    
    // "Giriş Yap" butonunu "Kayıt Ol" olarak değiştir
    const submitButton = signupForm.querySelector('input[type="submit"]');
    submitButton.value = "Kayıt Ol";
    
    alert('✅ E-posta doğrulaması başarılı! Lütfen şifrenizi girerek kaydınızı tamamlayın.');
}

// Kayıt işlemini tamamla
function completeRegistration() {
    const password = document.getElementById('password_input').value;
    const passwordError = document.getElementById('password_error');
    
    // Şifre doğrulama regex
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!passwordRegex.test(password)) {
        passwordError.textContent = "❌ Şifre en az 8 karakter olmalı, büyük/küçük harf, rakam ve özel karakter içermelidir.";
        passwordError.style.visibility = "visible";
        return;
    }
    
    // Kayıt isteği gönder
    fetch('https://kkuyemekhanepuanla.com.tr/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: verifiedEmail, password: password })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        // Başarılı kayıt sonrası giriş sayfasına yönlendir
        window.location.href = '/static/giris.html';
    })
    .catch(error => {
        passwordError.textContent = "⚠️ Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.";
        passwordError.style.visibility = "visible";
        console.error('Error:', error);
    });
}

// Giriş yap formu için
function loginUser() {
    const email = document.getElementById('mail_input').value;
    const password = document.getElementById('password_input').value;
    const emailError = document.getElementById('email_error');
    const passwordError = document.getElementById('password_error');
    
    // E-posta ve şifre doğrulama
    const emailRegex = /^[0-9]{9}@kku\.edu\.tr$/;
    
    let valid = true;
    
    if (!emailRegex.test(email)) {
        emailError.textContent = "❌ Geçersiz e-posta! Lütfen 9 rakam ve @kku.edu.tr ile biten bir e-posta girin.";
        emailError.style.visibility = "visible";
        valid = false;
    } else {
        emailError.style.visibility = "hidden";
    }
    
    if (!password) {
        passwordError.textContent = "❌ Lütfen şifrenizi girin.";
        passwordError.style.visibility = "visible";
        valid = false;
    } else {
        passwordError.style.visibility = "hidden";
    }
    
    if (!valid) return;
    
    // Giriş isteği gönder
    fetch('https://kkuyemekhanepuanla.com.tr/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === "Giriş başarılı!") {
            alert('✅ Giriş başarılı!');
            // Ana sayfaya yönlendir
            window.location.href = '/static/index.html';
        } else {
            alert('⚠️ ' + data.detail);
        }
    })
    .catch(error => {
        alert('⚠️ Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        console.error('Error:', error);
    });
}

// Slider Kontrol Fonksiyonu (Güncellendi)
function toggleSlider(sliderId, element) {
    // Tüm SEÇENEK slider'larını gizle
    document.querySelectorAll('.seçenek .slider-container').forEach(slider => {
        slider.style.display = 'none';
    });

    if(element.checked) {
        const targetSlider = document.getElementById(sliderId);
        targetSlider.style.display = 'flex'; // Ana yemeklerle aynı hizalamada
    }
}

// Sayfa Yüklendiğinde (Güncellendi)
document.addEventListener('DOMContentLoaded', function() {
    // Ana yemek slider'larını göster
    document.querySelectorAll('tr:not(.seçenek) .slider-container').forEach(slider => {
        slider.style.display = 'flex'; // Flex ile hizalama
    });
    
    // Seçenekleri gizle
    document.querySelectorAll('.seçenek .slider-container').forEach(slider => {
        slider.style.display = 'none';
    });
});

// Değerlendirme Gönderme
document.getElementById('submitRatings').addEventListener('click', function() {
    const ratings = {};
    const comments = document.getElementById('commentInput').value;

    // Zorunlu yemeklerin puanlarını topla
    document.querySelectorAll('tr:not(.seçenek) .slider').forEach(slider => {
        const foodName = slider.closest('tr').querySelector('strong').innerText;
        ratings[foodName] = parseFloat(slider.value);
    });

    // Seçilen seçenek yemeğin puanını topla
    const selectedOptional = document.querySelector('input[name="yemek"]:checked');
    if(selectedOptional) {
        const foodName = selectedOptional.value;
        const sliderValue = document.querySelector(`#${selectedOptional.id}Slider .slider`).value;
        ratings[foodName] = parseFloat(sliderValue);
    }

    // Verileri sunucuya gönder (Örnek)
    console.log('Gönderilen Veriler:', {
        ratings,
        comments
    });

    alert('Değerlendirmeniz başarıyla gönderildi! Teşekkür ederiz 🎉');
});

// Yorum Ekleme Fonksiyonu
function addComment() {
    const commentInput = document.getElementById('commentInput');
    const commentList = document.getElementById('commentList');

    if(commentInput.value.trim()) {
        const newComment = document.createElement('div');
        newComment.className = 'comment-item';
        newComment.innerHTML = `
            <p>${commentInput.value}</p>
        `;
        commentList.prepend(newComment);
        commentInput.value = '';
    }
}

// Sayfa Yüklendiğinde Zorunlu Slider'ları Göster
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('tr:not(.seçenek) .slider-container').forEach(slider => {
        slider.style.display = 'block';
    });
});