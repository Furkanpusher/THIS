document.getElementById('verify-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const verificationCode = document.getElementById('verification-code').value.trim();
    const emailError = document.getElementById('code-error');

    if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
        emailError.textContent = "❌ Lütfen 6 haneli bir sayı girin.";
        emailError.style.visibility = "visible";
        return;
    }

    emailError.style.visibility = "hidden";

    try {
        const email = new URLSearchParams(window.location.search).get('email'); // URL'den e-postayı al
        const response = await fetch('http://127.0.0.1:8001/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, code: verificationCode })
        });

        const data = await response.json();
        console.log("Doğrulama yanıtı:", data);

        if (response.ok && data.success) {
            const signupResponse = await fetch('http://127.0.0.1:8001/kaydol', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password: new URLSearchParams(window.location.search).get('password') })
            });

            const signupData = await signupResponse.json();
            console.log("Kayıt yanıtı:", signupData);

            if (signupResponse.ok) {
                alert("✅ Kayıt başarılı! Ana sayfaya yönlendiriliyorsunuz..");
                window.location.href = "http://127.0.0.1:8001/static/index.html";

;
            } else {
                alert(signupData.detail || "⚠️ Kayıt sırasında bir hata oluştu.");
            }
        } else {
            emailError.textContent = data.detail || "⚠️ Geçersiz doğrulama kodu.";
            emailError.style.visibility = "visible";
        }
    } catch (error) {
        emailError.textContent = "⚠️ Bir hata oluştu. Lütfen tekrar deneyin.";
        emailError.style.visibility = "visible";
        console.error("Doğrulama hatası:", error);
    }
});

// 60 saniyelik zamanlayıcı
let timeLeft = 60;
const timerElement = document.getElementById('timer');

const timer = setInterval(() => {
    timeLeft--;
    timerElement.textContent = timeLeft;
    if (timeLeft <= 0) {
        clearInterval(timer);
        document.getElementById('code-error').textContent = "❌ Doğrulama kodunuzun süresi doldu. Lütfen tekrar deneyin.";
        document.getElementById('code-error').style.visibility = "visible";
        document.getElementById('verify-form').reset(); // Formu sıfırla
    }
}, 1000);