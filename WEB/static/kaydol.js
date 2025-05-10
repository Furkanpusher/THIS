document.getElementById('signup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    validateEmailAndPassword().catch(error => {
        console.error("Hata yakalandı:", error);
        document.getElementById('email_error').textContent = "⚠️ Bir hata oluştu. Lütfen tekrar deneyin.";
        document.getElementById('email_error').style.visibility = "visible";
    });
});

async function validateEmailAndPassword() {
    const email = document.getElementById('mail_input').value.trim();
    const password = document.getElementById('password_input').value.trim();
    const emailError = document.getElementById('email_error');
    const passwordError = document.getElementById('password_error');

    const emailRegex = /^[0-9]{9}@kku\.edu\.tr$/;

    console.log("Girilen e-posta:", email);
    console.log("Girilen şifre:", password);
    console.log("Şifre uzunluğu:", password.length);

    let valid = true;

    if (!emailRegex.test(email)) {
        emailError.textContent = "❌ Geçersiz e-posta! Lütfen 9 rakam ve @kku.edu.tr ile biten bir e-posta girin.";
        emailError.style.visibility = "visible";
        valid = false;
    } else {
        emailError.style.visibility = "hidden";
    }

    if (password.length <= 7) {
        passwordError.textContent = "❌ Şifre en az 8 karakter olmalıdır.";
        passwordError.style.visibility = "visible";
        valid = false;
    } else {
        passwordError.style.visibility = "hidden";
    }

    if (!valid) return;

    console.log("Validasyon geçti, fetch gönderiliyor..."); 
    try {
        const response = await fetch('http://127.0.0.1:8001/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        console.log("Sunucu yanıtı:", data);

        if (response.ok && data.success) {
            // Prompt yerine verify.html'e yönlendir
            window.location.href = `../static/verify.html?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        } else {
            emailError.textContent = data.detail || "⚠️ E-posta gönderilirken bir hata oluştu.";
            emailError.style.visibility = "visible";
        }
    } catch (error) {
        console.error("Fetch hatası:", error.message);   // Hata burda
        emailError.textContent = "⚠️ Sunucuya ulaşılamadı. Lütfen sunucunun çalıştığından emin olun.";
        emailError.style.visibility = "visible";
    }
}