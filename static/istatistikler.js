const ctx = document.getElementById('puanChart').getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 500);
gradient.addColorStop(0, 'rgba(52, 152, 219, 0.7)');
gradient.addColorStop(1, 'rgba(52, 152, 219, 0)');

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                font: { size: 16, family: "'Poppins', sans-serif" },
                color: '#34495e',
            },
        },
        tooltip: {
            backgroundColor: 'rgba(52, 73, 94, 0.8)',
            titleFont: { size: 18, family: "'Poppins', sans-serif" },
            bodyFont: { size: 16, family: "'Poppins', sans-serif" },
            padding: 15,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
                title: tooltipItems => `${tooltipItems[0].label}. Gün`,
                label: context => `Puan: ${context.raw.toFixed(1)}`, // Ondalıklı gösterim
            },
        },
    },
    scales: {
        y: {
            min: 0,
            max: 10,
            grid: { color: 'rgba(236, 240, 241, 0.8)', borderDash: [5, 5] },
            ticks: {
                font: { size: 14, family: "'Poppins', sans-serif" },
                color: '#34495e',
                padding: 12,
                stepSize: 0.5, // 0.5 adımlarla işaretler (0.0, 0.5, 1.0, ...)
                callback: value => value.toFixed(1), // İşaretleri bir basamak ondalıklı göster
            },
            title: {
                display: true,
                text: 'Ortalama Puan',
                font: { size: 18, family: "'Poppins', sans-serif", weight: 'bold' },
                color: '#2980b9',
                padding: { top: 15, bottom: 15 },
            },
        },
        x: {
            grid: { display: false },
            ticks: {
                font: { size: 14, family: "'Poppins', sans-serif" },
                color: '#34495e',
            },
            title: {
                display: true,
                text: 'Günler',
                font: { size: 18, family: "'Poppins', sans-serif", weight: 'bold' },
                color: '#2980b9',
                padding: { top: 15, bottom: 0 },
            },
        },
    },
    animation: { duration: 2000, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
};

async function fetchChartData() {
    try {
        const response = await fetch('http://127.0.0.1:8001/api/daily-averages');
        if (!response.ok) throw new Error('API isteği başarısız');
        const { labels, data } = await response.json();
        return {
            labels,
            datasets: [{
                label: 'Ortalama Puan',
                data,
                fill: true,
                backgroundColor: gradient,
                borderColor: '#2980b9',
                borderWidth: 4,
                tension: 0.4,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#fff',
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHoverBackgroundColor: '#e74c3c',
                pointHoverBorderWidth: 2,
            }],
        };
    } catch (error) {
        console.error('Veri çekme hatası:', error);
        throw error;
    }
}

async function updateStatsSummary(data) {
    const maxRating = data.length ? Math.max(...data).toFixed(1) : 0;
    const minRating = data.length ? Math.min(...data).toFixed(1) : 0;
    const avgRating = data.length ? (data.reduce((sum, val) => sum + val, 0) / data.length).toFixed(1) : 0;

    document.getElementById('max-rating').textContent = maxRating;
    document.getElementById('min-rating').textContent = minRating;
    document.getElementById('avg-rating').textContent = avgRating;
}

async function initChart() {
    try {
        const chartData = await fetchChartData();
        const chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions,
        });
        await updateStatsSummary(chartData.datasets[0].data);

        // Eğer veri yoksa, kullanıcıya bilgi göster
        if (!chartData.labels.length) {
            const container = document.getElementById('charts-container');
            const noDataMessage = document.createElement('p');
            noDataMessage.className = 'no-data-message';
            noDataMessage.textContent = 'Henüz veri bulunmamaktadır. Yeni veriler gece eklenecektir.';
            container.appendChild(noDataMessage);
        }
    } catch (error) {
        console.error('Grafik oluşturma hatası:', error);
        const container = document.getElementById('charts-container');
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Veriler yüklenemedi. Lütfen daha sonra tekrar deneyin.';
        container.appendChild(errorMessage);
    }
}

initChart();