document.getElementById("giris_form").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const email = document.getElementById("mail_input").value;
    const password = document.getElementById("password_input").value;
    const emailError = document.getElementById("email_error");
    const passwordError = document.getElementById("password_error");
    
    // Hata mesajlarını sıfırla ve gizle
    emailError.textContent = "";
    passwordError.textContent = "";
    emailError.style.visibility = "hidden";
    passwordError.style.visibility = "hidden";
    
    try {
        const response = await fetch('http://127.0.0.1:8001/giris-yap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log("Sunucu yanıtı:", data); // Hata teşhisi için
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log("401 Hatası alındı, mesaj:", data.detail);
                passwordError.textContent = data.detail || "E-posta veya şifre hatalı!";
                passwordError.style.visibility = "visible"; // Hata mesajını görünür yap
            } else {
                console.log("Diğer hata kodu:", response.status);
                emailError.textContent = data.detail || "Bir hata oluştu!";
                emailError.style.visibility = "visible"; // Hata mesajını görünür yap
            }
            return;
        }
        
        // Başarılı giriş
        console.log("Giriş başarılı:", data);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user_id', data.user_id);
        
        window.location.href = "/";  // Bu, ana sayfaya yönlendirecek ve FastAPI root endpoint'i çalışacak

    } catch (error) {
        console.error("Fetch hatası:", error);
        emailError.textContent = "Sunucu hatası! Lütfen daha sonra deneyin.";
        emailError.style.visibility = "visible"; // Hata mesajını görünür yap
    }
});