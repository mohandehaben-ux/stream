# 📺 Xtream Panel - لوحة إدارة IPTV

نظام إدارة اشتراكات IPTV متكامل مع لوحة تحكم للمسؤول والمشرفين.

## 🚀 المميزات

- ✅ نظام تسجيل دخول آمن (SHA-256 Password Hashing)
- ✅ لوحة تحكم مزدوجة (Admin / Reseller)
- ✅ متجر أكواد IPTV مع نظام رصيد (Credits)
- ✅ متجر Xtream لإنشاء اشتراكات مباشرة
- ✅ إدارة المشتركين مع تتبع تواريخ الانتهاء
- ✅ وضع داكن / مضيء
- ✅ دعم اللغة العربية

## ⚙️ التثبيت والتشغيل

### 1. المتطلبات
```bash
pip install flask flask-cors requests
```

### 2. إعداد ملف البيئة
```bash
# انسخ ملف القالب
copy .env.example .env

# افتح .env وضع بياناتك
```

### 3. محتوى ملف `.env`
```
SB_URL=https://your-project.supabase.co
SB_KEY=your-supabase-service-role-key
PORT=5000
```

### 4. تشغيل السيرفر
```bash
python server.py
```

ثم افتح المتصفح على: **http://localhost:5000**

## 🔐 الأمان

> **هام:** ملف `.env` يحتوي على مفاتيح سرية ولا يُرفع على GitHub أبدًا (محمي بـ `.gitignore`)

- جميع مفاتيح Supabase محفوظة في السيرفر فقط
- المتصفح لا يرى أي مفاتيح أو بيانات سرية
- الكلمات السرية مشفرة بـ SHA-256 قبل إرسالها

## 📋 هيكل المجلد

```
crm-main/
├── server.py        # Flask Backend (يحتوي الـ API)
├── index.html       # واجهة المستخدم
├── script.js        # منطق الواجهة
├── style.css        # التصميم
├── config.js        # إعدادات عامة
├── .env             # 🔒 المفاتيح السرية (لا يُرفع على GitHub)
├── .env.example     # ✅ قالب آمن للمشاركة
└── .gitignore       # حماية الملفات السرية
```
