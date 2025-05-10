// Sayfadaki elementleri seç
const averageRatingsContainer = document.querySelector('.average-progress-container');
const menuTableBody = document.querySelector('tbody');
const cardDate = document.querySelector('.card-date');

// Şablonları seç
const averageProgressItemTemplate = document.getElementById('average-progress-item-template');
const menuRowTemplate = document.getElementById('menu-row-template');

// Şablonların seçildiğini kontrol et
console.log('averageProgressItemTemplate:', averageProgressItemTemplate);
console.log('menuRowTemplate:', menuRowTemplate);

// Container'ların seçildiğini kontrol et
console.log('averageRatingsContainer:', averageRatingsContainer);
console.log('menuTableBody:', menuTableBody);
console.log('cardDate:', cardDate);

// API’den verileri çek
async function fetchMenuData() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Oturum açmanız gerekiyor');
        }

        const response = await fetch('http://127.0.0.1:8001/menu', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: Menü yüklenemedi`);
        }

        const data = await response.json();
        console.log('Çekilen veri:', data);
        return data;
    } catch (error) {
        console.error('Veri çekme hatası:', error);
        showErrorToast(error.message || 'Menü yüklenemedi, lütfen tekrar deneyin');
        return null;
    }
}

async function updateMenu() {
    const menuData = await fetchMenuData();
    if (!menuData || menuData.error || !menuData.menu) {
        console.error('Hata: Veri çekilemedi veya menü bulunamadı', menuData);
        averageRatingsContainer.innerHTML = '<p>Bugün için yemek verisi bulunmuyor, lütfen daha sonra tekrar deneyin.</p>';
        menuTableBody.innerHTML = '<tr><td colspan="2">Veriler yüklenemedi.</td></tr>';
        cardDate.textContent = new Date().toLocaleDateString('tr-TR');
        if (menuData?.error) {
            showErrorToast(menuData.error || 'Menü verileri yüklenemedi');
        }
        return;
    }

    // Tarihi güncelle
    cardDate.textContent = menuData.date || new Date().toLocaleDateString('tr-TR');
    console.log('Güncellenen tarih:', cardDate.textContent);

    // Ortalama Puanlar (average-ratings) bölümünü güncelle
    averageRatingsContainer.innerHTML = '';
    menuData.menu.forEach(item => {
        console.log('Ortalama puanlar için işlenen yemek:', item);
        const itemDiv = averageProgressItemTemplate.content.cloneNode(true);
        const dishNameElement = itemDiv.querySelector('.dish-name');
        const progressValueElement = itemDiv.querySelector('.small-progress-value');
        const circleElement = itemDiv.querySelector('.small-progress-ring__circle');

        dishNameElement.textContent = item.name || 'Bilinmeyen Yemek';
        progressValueElement.textContent = (item.rating || 0).toFixed(1);
        circleElement.setAttribute('data-value', item.rating || 0);
        averageRatingsContainer.appendChild(itemDiv);
    });

    // Günün Menüsü tablosunu güncelle
    menuTableBody.innerHTML = '';
    menuData.menu.forEach(item => {
        console.log('Tablo için işlenen yemek:', item);
        const row = menuRowTemplate.content.cloneNode(true);
        const isMain = item.type === 'main';

        // Yemek adı
        const dishNameElement = row.querySelector('.dish-name');
        dishNameElement.textContent = item.name || 'Bilinmeyen Yemek';

        // Badge
        const badge = row.querySelector('.badge');
        badge.textContent = `(${isMain ? 'Ana Menü' : 'Seçenek'})`;
        badge.className = isMain ? 'badge-main' : 'badge-optional';
        if (!isMain) {
            badge.style.color = '#777';
            badge.style.fontSize = '0.8rem';
        }

        // Radio button
        const radio = row.querySelector('.optional-radio');
        radio.style.display = isMain ? 'none' : 'inline';

        // Slider container
        const sliderContainer = row.querySelector('.slider-container');
        if (!isMain) {
            sliderContainer.classList.add('optional-slider-container');
            sliderContainer.style.display = 'none';
        }

        // Slider sınıfı
        const slider = row.querySelector('.slider');
        slider.classList.add(isMain ? 'main-slider' : 'optional-slider');

        menuTableBody.appendChild(row);
    });

    // Dairesel ilerleme çubuklarını güncelle
    updateProgressBars();

    // Slider’ları başlat
    initializeSliders();

    // info-box'ı koru
    ensureInfoBox();
}

// Dairesel ilerleme çubuklarını güncelleyen fonksiyon
function updateProgressBars() {
    document.querySelectorAll('.small-progress-ring__circle').forEach(circle => {
        const value = parseFloat(circle.getAttribute('data-value'));
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (value / 10) * circumference;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    });
}

// Slider'ları başlat
function initializeSliders() {
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
        updateSliderColor(slider);
        if (!slider.disabled) {
            slider.addEventListener('input', function() {
                updateSliderColor(this);
            });
        }
    });
}

document.querySelector('.menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.header-nav').classList.toggle('active');
});

// Slider rengini güncelle
function updateSliderColor(slider) {
    const value = slider.value;
    const percentage = value / 10;
    const hue = percentage * 120;
    slider.style.background = `linear-gradient(to right, #ddd 0%, hsl(${hue}, 80%, 50%) ${percentage * 100}%, #ddd ${percentage * 100}%)`;
}

// Seçenek slider'larını kontrol et
function toggleOptionalSliders() {
    const radios = document.querySelectorAll('.optional-radio');
    const optionalContainers = document.querySelectorAll('.optional-slider-container');
    
    optionalContainers.forEach(container => {
        container.style.display = 'none';
    });
    
    radios.forEach(radio => {
        if (radio.checked) {
            const container = radio.parentElement.nextElementSibling.querySelector('.optional-slider-container');
            container.style.display = 'flex';
            updateSliderColor(container.querySelector('.optional-slider'));
        }
    });
}

async function updateOverallAverage() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    try {
        const response = await fetch(`http://127.0.0.1:8001/api/averages/${today}`);
        const data = await response.json();
        
        // Büyük circular bar'ı güncelle
        const mainCircle = document.querySelector('.progress-ring__circle');
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - data.overall_average / 10);
        mainCircle.style.strokeDashoffset = offset;
        
        // Metni güncelle
        document.querySelector('.progress-value').textContent = data.overall_average.toFixed(1);
    } catch (error) {
        console.error("Ortalama güncellenemedi:", error);
    }
}

// Yeni fonksiyon: Her yemeğin ortalamasını güncelle
async function updateDishAverages() {
    const today = new Date().toISOString().split('T')[0];
    try {
        const response = await fetch(`http://127.0.0.1:8001/api/dish-averages/${today}`);
        const data = await response.json();
        const dishAverages = data.dish_averages;

        document.querySelectorAll('.average-progress-item').forEach(item => {
            const dishName = item.querySelector('.dish-name').textContent;
            const average = dishAverages[dishName] || 0; // Eğer veri yoksa 0 kullan

            const circle = item.querySelector('.small-progress-ring__circle');
            const valueSpan = item.querySelector('.small-progress-value');
            const radius = 22;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference * (1 - average / 10);

            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = offset;
            circle.dataset.value = average; // data-value güncelle
            valueSpan.textContent = average.toFixed(1); // Metni güncelle
        });
    } catch (error) {
        console.error("Yemek ortalamaları güncellenemedi:", error);
    }
}

function showErrorToast(message) {
    const toast = document.getElementById("error-toast");
    const messageElement = document.getElementById("error-message");
    if (!toast || !messageElement) {
        console.error("Hata: error-toast veya error-message elementi bulunamadı!");
        alert(message); // Fallback olarak alert kullan
        return;
    }
    console.log("Error mesajı"); 
    messageElement.textContent = message;
    toast.style.display = "block"; // Baloncuğu görünür yap
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
        toast.style.display = "none"; // 3 saniye sonra gizle
    }, 3000); // 3 saniye sonra balon kaybolur
}
// Değerlendirme gönderme fonksiyonu
async function handleRatingSubmission() {
    const token = localStorage.getItem("access_token");
    if (!token) {
        showErrorToast("Lütfen önce giriş yapın!");
        return;
    }

    const button = this;
    if (button.disabled) return;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

    const ratings = {};
    const visibleSliders = document.querySelectorAll(".slider-container:not([style*='display: none']) .slider");
    visibleSliders.forEach((slider) => {
        const row = slider.closest("tr");
        const dishName = row.querySelector(".dish-name").textContent;
        ratings[dishName] = parseFloat(slider.value);
    });

    try {
        const response = await fetch("http://127.0.0.1:8001/submit-ratings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ratings }),
        });

        const data = await response.json();
        console.log("Backend response:", response.status, data);

        if (!response.ok) {
            let errorMessage = data.detail || "Bilinmeyen bir hata oluştu";
            if (errorMessage === "Günlük iki kez değerlendirme hakkınızı doldurunuz!") {
                errorMessage = "Günde sadece iki kez değerlendirme yapabilirsiniz.";
                button.disabled = true; // Disable button for the session
                button.innerHTML = "Günlük Limit Doldu";
                button.style.backgroundColor = "gray";
                // Optionally, re-enable the next day
                setTimeout(() => {
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> Değerlendirme Gönder';
                    button.style.backgroundColor = "";
                }, getMsUntilMidnight());
            } else if (response.status === 500) {
                errorMessage = "Sunucu hatası: Lütfen daha sonra tekrar deneyin";
            }
            throw new Error(errorMessage);
        }

        await promiseAllSettled([updateOverallAverage(), updateDishAverages()]);

        button.innerHTML = '<i class="fas fa-check"></i> Gönderildi!';
        button.style.backgroundColor = "var(--success-color)";
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> Değerlendirme Gönder';
            button.style.backgroundColor = "";
            button.disabled = false;
        }, 2000);
    } catch (error) {
        console.error("Hata:", error.message);
        showErrorToast(error.message || "Bir hata oluştu, lütfen tekrar deneyin");
        if (!button.innerHTML.includes("Limit Doldu")) {
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> Değerlendirme Gönder';
                button.disabled = false;
            }, 1000);
        }
    }
}

function getMsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
}

function previewImage(input) {  // bura sayesinde resim de ekleyebileceğiz
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = ''; // Önceki önizlemeyi temizle
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100px'; // Önizleme boyutu
            preview.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
} 

// Yorum ve resim ekleme DE OLACAK
async function addComment() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Lütfen önce giriş yapın!");
        return;
    }

    const commentInput = document.getElementById("commentInput");
    const imageInput = document.getElementById("imageInput");
    const commentText = commentInput.value.trim();

    // Yorum veya resimden en az biri olmalı
    if (!commentText && !imageInput.files[0]) {
        alert("Lütfen bir yorum yazın veya bir resim seçin!");
        return;
    }

    const formData = new FormData();
    if (commentText) {
        formData.append("comment", commentText);
    }
    if (imageInput.files[0]) {
        formData.append("file", imageInput.files[0]);
    }

    try {
        const response = await fetch('http://127.0.0.1:8001/submit-comment', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Yorum gönderilemedi: ${errorText}`);
        }

        const data = await response.json();
        const commentList = document.getElementById("commentList");
        const commentItem = document.createElement("div");
        commentItem.classList.add("comment-item");

        if (commentText) {
            const commentPara = document.createElement("p");
            commentPara.textContent = commentText;
            commentItem.appendChild(commentPara);
        }

        if (data.image_path) {
            const commentImg = document.createElement("img");
            commentImg.src = data.image_path;
            commentImg.style.maxWidth = "100px";
            commentItem.appendChild(commentImg);
        }

        commentList.prepend(commentItem);
        commentInput.value = "";
        imageInput.value = "";
        document.getElementById("imagePreview").innerHTML = "";

        commentItem.style.backgroundColor = "#e3f2fd";
        setTimeout(() => {
            commentItem.style.backgroundColor = "";
        }, 1000);
    } catch (error) {
        console.error('Hata:', error);
        alert(`Yorum gönderilirken hata oluştu: ${error.message}`);
    }
}

// Tüm progress bar'ları başlat (Büyük + Küçük)
function initializeAllProgressBars() {
    // Büyük progress bar
    const mainCircle = document.querySelector('.progress-ring__circle');
    if (mainCircle) {
        const value = parseFloat(document.querySelector('.progress-value').textContent);
        const circumference = 2 * Math.PI * 90; // r=90
        const offset = circumference * (1 - value / 10);
        mainCircle.style.strokeDashoffset = offset;
    }

    // Küçük progress bar'lar (Ortalama puanlar)
    document.querySelectorAll('.small-progress-ring__circle').forEach(circle => {
        const value = parseFloat(circle.dataset.value);
        const radius = 22; // SVG'de r=22
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - value / 10);
        circle.style.strokeDashoffset = offset;
        circle.style.strokeDasharray = circumference;
    });
}


// Tüm başlangıç işlemlerini tek bir DOMContentLoaded içinde yap
document.addEventListener('DOMContentLoaded', function() {
    // Kullanıcı giriş yapmamışsa yönlendir
    const token = localStorage.getItem('access_token');
    if (!token) {
        showErrorToast('Lütfen önce giriş yapın!');
        window.location.href = "http://127.0.0.1:8001/static/giris.html";
        return;
    }

    // Event listener çakışmasını önlemek için mevcut listener'ı kaldır
    const submitButton = document.getElementById("submitRatings");
    submitButton.removeEventListener("click", handleRatingSubmission);
    submitButton.addEventListener("click", handleRatingSubmission);

    // Başlangıç fonksiyonlarını çağır
    updateMenu();
    initializeSliders();
    initializeAllProgressBars();
    updateOverallAverage();
    updateDishAverages();

    // info-box'ı koru
    ensureInfoBox();
});

function ensureInfoBox() {
    const submitButtonContainer = document.querySelector('#submitRatings').parentElement;
    if (!submitButtonContainer.querySelector('.info-box')) {
        const infoBox = document.createElement('div');
        infoBox.className = 'info-box';
        infoBox.textContent = 'Gün içinde en fazla 2 değerlendirme yapabilirsiniz';
        infoBox.style.marginTop = '0.5rem';
        submitButtonContainer.appendChild(infoBox);
    }
}