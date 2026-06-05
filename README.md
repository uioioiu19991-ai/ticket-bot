# 🎫 بوت التذاكر المتقدم | Advanced Ticket Bot

## 📋 المميزات | Features
- ✅ فتح وإغلاق التذاكر | Open & Close tickets
- ✅ 4 فئات مختلفة | 4 categories (Support, Purchase, Complaint, Other)
- ✅ استلام التذاكر (Claim) | Ticket claiming
- ✅ إضافة وإزالة مستخدمين | Add/Remove users
- ✅ تسجيل المحادثات (Transcript) | Transcripts
- ✅ نظام تقييم ⭐ | Rating system
- ✅ إحصائيات متقدمة | Advanced statistics
- ✅ سجل الأحداث (Logs) | Event logging
- ✅ أوامر Slash | Slash commands
- ✅ عربي + إنجليزي | Arabic + English

## 🚀 طريقة النصب | Installation

### 1. نصب المتطلبات
```bash
npm install
```

### 2. إعداد التوكن
عدّل ملف `.env` وضع توكن البوت:
```
DISCORD_TOKEN=توكن_البوت_هنا
```

### 3. تشغيل البوت
```bash
node index.js
```

### 4. تشغيل دائم مع PM2
```bash
npm install -g pm2
pm2 start index.js --name ticket-bot
pm2 save
pm2 startup
```

## ⚙️ إعداد البوت بالسيرفر | Server Setup

1. دعوة البوت للسيرفر
2. استخدم الأمر: `/setup #قناة-التذاكر`
3. اختياري: `/setup #قناة-التذاكر logs:#قناة-السجلات staff:@رتبة-الدعم`

## 📝 الأوامر | Commands

| الأمر | الوصف |
|-------|-------|
| `/setup` | إعداد نظام التذاكر |
| `/panel` | إرسال لوحة التذاكر |
| `/stats` | عرض الإحصائيات |
| `/close` | إغلاق التذكرة |
| `/claim` | استلام التذكرة |
| `/add @user` | إضافة مستخدم |
| `/remove @user` | إزالة مستخدم |
| `/transcript` | سجل المحادثة |
