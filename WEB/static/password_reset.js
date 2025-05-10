async function requestReset(event) {
    event.preventDefault();
    const email = document.getElementById('mail_input').value;
    const emailError = document.getElementById('email_error');

    try {
        const response = await fetch('/reset_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            alert(result.message); // "Doğrulama kodu mailinize gönderildi."
            document.getElementById('reset_request_form').style.display = 'none';
            document.getElementById('reset_confirm_form').style.display = 'block';
        } else {
            emailError.textContent = result.detail || 'Bir hata oluştu.';
            emailError.style.visibility = 'visible';
        }
    } catch (error) {
        emailError.textContent = 'Sunucu hatası!';
        emailError.style.visibility = 'visible';
    }
}

async function confirmReset(event) {
    event.preventDefault();
    const email = document.getElementById('mail_input').value;
    const code = document.getElementById('code_input').value;
    const newPassword = document.getElementById('new_password').value;
    const codeError = document.getElementById('code_error');

    try {
        const response = await fetch('/confirm_reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, new_password: newPassword })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            alert(result.message); // "Şifreniz başarıyla güncellendi."
            window.location.href = '/static/giris.html'; // Giriş sayfasına yönlendir
        } else {
            codeError.textContent = result.detail || 'Kod hatalı!';
            codeError.style.visibility = 'visible';
        }
    } catch (error) {
        codeError.textContent = 'Sunucu hatası!';
        codeError.style.visibility = 'visible';
    }
}