from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from pydantic import BaseModel
from typing import Dict
import bcrypt
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, date
import jwt
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from pathlib import Path
import locale
from fastapi.responses import FileResponse, RedirectResponse


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Veritabanı bağlantısı için dependency
def get_db():
    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="2024",
        database="yemekhane"
    )
    try:
        yield connection
    finally:
        connection.close()

def get_user_by_email(email: str, db):  #emaili olan kullanıcının bilgilerini çekmek için
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    return user

# E-posta ayarları
email_settings = {
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "kkuyemekhane.000@gmail.com",
    "password": "xpqb veaj dtbp amza"
}

# Pydantic modeller
class EmailRequest(BaseModel):
    email: str

class VerificationRequest(BaseModel):
    email: str
    code: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RatingsRequest(BaseModel):
    ratings: Dict[str, float]  # Yemek adı ve puanı (örneğin: {"Yoğurt Çorba": 8.5})

class CommentRequest(BaseModel):
    comment: str  # Yorum metni

class ResetPasswordRequest(BaseModel):
    email: str

class ConfirmResetRequest(BaseModel):
    email: str
    code: str
    new_password: str

@app.get("/aylik", response_class=HTMLResponse)
async def get_aylik_menu():
    return FileResponse(Path(__file__).parent / "static" / "aylik.html")


@app.get("/istatistikler", response_class=HTMLResponse)
async def get_istatistikler():
    return FileResponse(Path(__file__).parent / "static" / "istatistikler.html")

# index.html için de özel bir endpoint ekleyin
@app.get("/", response_class=HTMLResponse)
async def get_index():
    # Bugünün tarihini al
    today = date.today().strftime("%Y-%m-%d")  # Format: YYYY-MM-DD
    # Ortalama değerleri çekerek index.html'i render et
    return RedirectResponse(f"/averages/{today}")


# Şifre hashleme
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Doğrulama kodu oluşturma
def generate_verification_code():
    return str(random.randint(100000, 999999))

# E-posta gönderme
def send_verification_email(to_email, verification_code):
    try:
        message = MIMEMultipart()
        message["From"] = email_settings["sender_email"]
        message["To"] = to_email
        message["Subject"] = f"KKÜ Yemekhane - Kodunuz: {verification_code}"
        body = f"Merhaba,\n\nDoğrulama kodunuz: {verification_code}\n\nTeşekkürler,\nKKÜ Yemekhane Değerlendirme Uygulaması"
        message.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(email_settings["smtp_server"], email_settings["smtp_port"]) as server:
            server.starttls()
            server.login(email_settings["sender_email"], email_settings["password"])
            server.send_message(message)
        print(f"E-posta gönderildi: {to_email}")
        return True
    except Exception as e:
        print(f"E-posta hatası: {e}")
        return False

# Send-email endpoint
@app.post("/send-email")
async def send_email(request: EmailRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        if not request.email.endswith("@kku.edu.tr") or not request.email[:9].isdigit():
            raise HTTPException(status_code=400, detail="Geçersiz KKÜ e-posta adresi.")
        
        cursor.execute("SELECT email FROM users WHERE email = %s", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
        
        verification_code = generate_verification_code()
        cursor.execute("DELETE FROM verification_codes WHERE email = %s", (request.email,))
        cursor.execute(
            "INSERT INTO verification_codes (email, code, created_at) VALUES (%s, %s, NOW())",
            (request.email, verification_code)
        )
        db.commit()

        if not send_verification_email(request.email, verification_code):
            raise HTTPException(status_code=500, detail="E-posta gönderme hatası.")
        
        return {"success": True, "message": "Doğrulama e-postası gönderildi."}
    finally:
        cursor.close()

# Verify-code endpoint (30 saniye sınırı ile)
@app.post("/verify-code")
async def verify_code(request: VerificationRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        thirty_seconds_ago = datetime.now() - timedelta(seconds=60)
        cursor.execute(
            "SELECT code FROM verification_codes WHERE email = %s AND created_at > %s ORDER BY created_at DESC LIMIT 1",
            (request.email, thirty_seconds_ago)
        )
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=400, detail="Doğrulama kodu süresi dolmuş veya geçersiz.")
        
        stored_code = result[0]
        if stored_code != request.code:
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu.")
        
        return {"success": True, "message": "Doğrulama başarılı."}
    finally:
        cursor.close()

# Register endpoint
@app.post("/kaydol")
async def register(request: RegisterRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        cursor.execute("SELECT email FROM users WHERE email = %s", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
        
        hashed_password = hash_password(request.password)
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (%s, %s)",
            (request.email, hashed_password)
        )
        cursor.execute("DELETE FROM verification_codes WHERE email = %s", (request.email,))
        db.commit()
        return {"message": "Kayıt başarılı! Lütfen giriş yapın."}
    finally:
        cursor.close()

# JWT Token oluşturma
SECRET_KEY = "ManFlu"  # Üretimde güvenli bir yerde saklanmalı!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))  # Düzeltildi
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Login endpoint
@app.post("/giris-yap")
async def login(request: LoginRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        print(f"Giriş isteği alındı: email={request.email}")

        # Veritabanından kullanıcıyı çek
        cursor.execute("SELECT id, hashed_password FROM users WHERE email = %s", (request.email,))
        result = cursor.fetchone()
        print(f"Veritabanı sonucu: {result}")

        if not result:
            print("Kullanıcı bulunamadı")
            raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı!")

        # Şifre kontrolü
        hashed_password = result["hashed_password"]
        print(f"Hashlenmiş şifre: {hashed_password}")
        if not bcrypt.checkpw(request.password.encode('utf-8'), hashed_password.encode('utf-8')):
            print("Şifre eşleşmedi")
            raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı!")

        # Token oluştur
        access_token = create_access_token(data={"sub": request.email})
        print(f"Token oluşturuldu: {access_token}")
        return {
            "message": "Giriş başarılı",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": result["id"]
        }
    except mysql.connector.Error as db_err:
        print(f"Veritabanı hatası: {str(db_err)}")
        raise HTTPException(status_code=500, detail=f"Veritabanı hatası: {str(db_err)}")
    except HTTPException as http_err:
        raise http_err  # HTTPException’larıそのまま istemciye gönder
    except Exception as e:
        print(f"Genel hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sunucu hatası: {str(e)}")
    finally:
        cursor.close()


async def get_current_user(token: str = Depends(oauth2_scheme), db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user = get_user_by_email(user_email, db)
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi dolmuş")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

@app.post("/submit-ratings")
async def submit_ratings(
    request: RatingsRequest,
    current_user: dict = Depends(get_current_user),
    db: mysql.connector.connection.MySQLConnection = Depends(get_db)
):
    cursor = db.cursor(dictionary=True)
    try:
        today = date.today()
        print(f"Submitting ratings for user {current_user['id']} on {today}")
        print(f"Request data: {request.ratings}")

        # Count submissions for today
        cursor.execute(
            """
            SELECT COUNT(*) AS submission_count
            FROM submissions
            WHERE user_id = %s AND DATE(created_at) = %s
            """,
            (current_user["id"], today)
        )
        result = cursor.fetchone()
        submission_count = result["submission_count"] if result else 0
        print(f"Submission count for user {current_user['id']}: {submission_count}")

        if submission_count >= 2:
            print("User exceeded daily submission limit")
            raise HTTPException(
                status_code=403,
                detail="Günlük iki kez değerlendirme hakkınızı doldurunuz!"
            )

        # Insert submission record
        cursor.execute(
            """
            INSERT INTO submissions (user_id, created_at)
            VALUES (%s, NOW())
            """,
            (current_user["id"],)
        )
        submission_id = cursor.lastrowid

        # Save ratings
        for dish, rating in request.ratings.items():
            print(f"Inserting rating: dish={dish}, rating={rating}")
            cursor.execute(
                """
                INSERT INTO ratings (user_id, dish_name, rating, created_at, submission_id)
                VALUES (%s, %s, %s, NOW(), %s)
                """,
                (current_user["id"], dish, rating, submission_id)
            )
        db.commit()
        print(f"Ratings saved for user {current_user['id']}: {request.ratings}")
        return {"success": True, "message": "Puanlar kaydedildi!"}

    except mysql.connector.Error as db_err:
        db.rollback()
        print(f"Database error: {str(db_err)}")
        raise HTTPException(status_code=500, detail=f"Veritabanı hatası: {str(db_err)}")
    except HTTPException as http_err:
        print(f"HTTP exception: {str(http_err)}")
        raise http_err
    except Exception as e:
        db.rollback()
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Kayıt hatası: {str(e)}")
    finally:
        cursor.close()

@app.post("/submit-comment")
async def submit_comment(
    comment: str = Form(None),  # Yorum isteğe bağlı
    file: UploadFile = File(None),  # Resim zaten isteğe bağlı
    current_user: dict = Depends(get_current_user),
    db: mysql.connector.connection.MySQLConnection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        print(f"Comment received: {comment}")
        print(f"File received: {file.filename if file else 'None'}")

        # En az bir şeyin (yorum veya resim) gönderildiğini kontrol et
        if not comment and not file:
            raise HTTPException(status_code=400, detail="Yorum veya resimden en az biri gereklidir!")

        image_path = None
        if file:
            if not file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Yalnızca resim dosyaları yüklenebilir!")
            file_extension = file.filename.split(".")[-1]
            filename = f"comment_{current_user['id']}_{int(datetime.now().timestamp())}.{file_extension}"
            file_path = UPLOAD_DIR / filename
            print(f"Saving file to: {file_path}")
            file_content = await file.read()
            print(f"File size: {len(file_content)} bytes")
            with open(file_path, "wb") as f:
                f.write(file_content)
            image_path = f"/static/uploads/{filename}"
            print(f"Image path: {image_path}")

        # Eğer yorum yoksa boş string yerine NULL kaydet
        comment_text = comment if comment else None

        cursor.execute(
            "INSERT INTO comments (user_id, comment_text, image_path, created_at) VALUES (%s, %s, %s, NOW())",
            (current_user["id"], comment_text, image_path)
        )
        db.commit()
        return {"success": True, "message": "Yorum ve/veya resim kaydedildi!", "image_path": image_path}
    except Exception as e:
        db.rollback()
        print(f"Error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Kayıt hatası: {str(e)}")
    finally:
        cursor.close()



app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")




templates = Jinja2Templates(directory=".")



# Mevcut kodlar (veritabanı bağlantısı, modeller, diğer endpoint'ler vs.) değişmeyecek...

# GENEL ORTALAMAYI ÇEKECEK ENDPOINT
@app.get("/averages/{date}", response_class=HTMLResponse)
async def get_overall_average(date: str, request: Request, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    try:
        # Tarihin geçerli bir format olduğunu kontrol et (örnek: 2024-05-20)
        date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz tarih formatı. Lütfen YYYY-MM-DD formatında girin.")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Genel ortalama puan
        cursor.execute(
            """
            SELECT AVG(rating) as overall_average
            FROM ratings
            WHERE DATE(created_at) = %s
            """,
            (date,)
        )
        overall = cursor.fetchone()
        overall_average = overall["overall_average"] if overall["overall_average"] is not None else 0

        # Hata ayıklama için log
        print(f"Overall Average for {date}: {overall_average}")

        # HTML şablonunu render et
        return templates.TemplateResponse(
            "/static/index.html",
            {
                "request": request,
                "overall_average": round(overall_average, 1)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Veri çekme hatası: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/averages/{date}")
async def get_averages(date: str, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT AVG(rating) as overall_average FROM ratings WHERE DATE(created_at) = %s",
            (date,)
        )
        result = cursor.fetchone()
        return {"overall_average": round(result['overall_average'] or 0, 1)}
    finally:
        cursor.close()


# Her yemek için ayrı ortalama çekicez
@app.get("/api/dish-averages/{date}")
async def get_dish_averages(date: str, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT dish_name, AVG(rating) as dish_average 
            FROM ratings 
            WHERE DATE(created_at) = %s 
            GROUP BY dish_name
            """,
            (date,)
        )
        results = cursor.fetchall()
        dish_averages = {result["dish_name"]: round(result["dish_average"] or 0, 1) for result in results}
        return {"dish_averages": dish_averages}
    finally:
        cursor.close()

UPLOAD_DIR = Path("static/uploads")  #statik altında uploads adlı bir dosyada resim path adresleri tutucak
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)  # Klasör yoksa oluştur


@app.post("/submit-comment")
async def submit_comment(
    comment: str = Form(...),
    file: UploadFile = File(None),
    current_user: dict = Depends(get_current_user),
    db: mysql.connector.connection.MySQLConnection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        image_path = None
        if file:
            file_extension = file.filename.split(".")[-1]
            filename = f"comment_{current_user['id']}_{int(datetime.now().timestamp())}.{file_extension}"
            file_path = UPLOAD_DIR / filename
            with open(file_path, "wb") as f:
                f.write(await file.read())  # Direkt binary yazıyoruz
            image_path = f"/static/uploads/{filename}"

        cursor.execute(
            "INSERT INTO comments (user_id, comment_text, image_path, created_at) VALUES (%s, %s, %s, NOW())",
            (current_user["id"], comment, image_path)
        )
        db.commit()
        return {"success": True, "message": "Yorum ve resim kaydedildi!", "image_path": image_path}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Kayıt hatası: {str(e)}")
    finally:
        cursor.close()


@app.post("/reset_password")
async def reset_password(request: ResetPasswordRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        # Kullanıcının maili veritabanında var mı kontrol et
        cursor.execute("SELECT email FROM users WHERE email = %s", (request.email,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Bu e-posta adresi kayıtlı değil.")

        # Doğrulama kodu oluştur ve kaydet
        verification_code = generate_verification_code()
        cursor.execute("DELETE FROM verification_codes WHERE email = %s", (request.email,))  # Eski kodları sil
        cursor.execute(
            "INSERT INTO verification_codes (email, code, created_at) VALUES (%s, %s, NOW())",
            (request.email, verification_code)
        )
        db.commit()

        # E-posta gönder
        if not send_verification_email(request.email, verification_code):
            raise HTTPException(status_code=500, detail="E-posta gönderme hatası.")
        
        return {"success": True, "message": "Doğrulama kodu mailinize gönderildi."}
    finally:
        cursor.close()


@app.post("/confirm_reset")
async def confirm_reset(request: ConfirmResetRequest, db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        # 60 saniye sınırı ile kodu kontrol et
        thirty_seconds_ago = datetime.now() - timedelta(seconds=60)
        cursor.execute(
            "SELECT code FROM verification_codes WHERE email = %s AND created_at > %s ORDER BY created_at DESC LIMIT 1",
            (request.email, thirty_seconds_ago)
        )
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=400, detail="Doğrulama kodu süresi dolmuş veya geçersiz.")
        
        stored_code = result[0]
        if stored_code != request.code:
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu.")

        # Yeni şifreyi hash’le ve güncelle
        hashed_password = hash_password(request.new_password)
        cursor.execute(
            "UPDATE users SET hashed_password = %s WHERE email = %s",
            (hashed_password, request.email)
        )
        cursor.execute("DELETE FROM verification_codes WHERE email = %s", (request.email,))  # Kullanılan kodu sil
        db.commit()

        return {"success": True, "message": "Şifreniz başarıyla güncellendi."}
    finally:
        cursor.close()


# Günlük yemek verisini çekiyoruz
@app.get("/menu")
async def get_menu(db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        # Bugünün tarihini al
        today = datetime.today().date()  # Test için sabit tarih
        print(type(today))
        print("today değeri:", today.day)      # Hata ayıklama için

        # Türkçe tarih formatı için locale ayarı
        try:
            locale.setlocale(locale.LC_ALL, 'tr_TR.UTF-8')  # Türkçeye çevir
        except locale.Error:
            print("Locale ayarı yapılamadı, varsayılan tarih formatı kullanılacak.")
        formatted_date = today.strftime("%d %B - %A")  # Örnek: "05 Nisan - Cumartesi"

        # Bugünün yemeklerini çek
        cursor.execute("""
            SELECT y.food_names AS name, y.type, COALESCE(AVG(r.rating), 0) AS rating
            FROM aylık_yemek_data y
            LEFT JOIN ratings r ON y.food_names = r.dish_name
            WHERE DATE(y.gün) = %s
            GROUP BY y.food_names, y.type
        """, (today,))
        menu_data = cursor.fetchall()

        if not menu_data:
            return {"error": "Bugün için menü bulunamadı"}

        return {
            "date": formatted_date,
            "menu": menu_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Veri çekme hatası: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/daily-averages")
async def get_daily_averages(db: mysql.connector.connection.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        # Ayın 5'inden itibaren verileri çek (örneğin, 2025-05-05)
        start_date = "2025-05-05"
        cursor.execute(
            """
            SELECT rating_date, average_rating
            FROM daily_overall_average
            WHERE rating_date >= %s
            ORDER BY rating_date
            """,
            (start_date,)
        )
        results = cursor.fetchall()

        # Grafik için etiketler (günler) ve veriler (ortalama puanlar)
        labels = [str(result["rating_date"].day) for result in results]
        data = [round(result["average_rating"], 1) for result in results]

        return {"labels": labels, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Veri çekme hatası: {str(e)}")
    finally:
        cursor.close()
