const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 
const readline = require('readline');
const pQueue = require('p-queue'); 

// Muat variabel lingkungan
dotenv.config();
puppeteer.use(pluginStealth());

// Konfigurasi Dasar
const headless = 'new'; // HEADLESS MODE BARU
const CONCURRENT_LIMIT = 1; // Eksekusi Serial

// Konfigurasi dari ENV (dapat diubah lewat prompt runtime)
const defaultConfig = {
    password: process.env.CHATGPT_PASSWORD || '',
    domain: process.env.EMAIL_SERVICE_DOMAIN || '',
    apiKey: process.env.EMAIL_SERVICE_API_KEY || '',
    emailMode: (process.env.EMAIL_MODE || 'api').toLowerCase(),
    customDomains: (process.env.GENERATOR_CUSTOM_DOMAINS || '')
        .split(',')
        .map(d => d.trim())
        .filter(Boolean)
};

let config = { ...defaultConfig };

// --- FUNGSI UTILITY (Tidak Berubah) ---

const generateRandomEmail = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let username = '';
    for (let i = 0; i < 6; i++) {
        username += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return `${username}@wzieemail.my.id`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateCleanUsername = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const pool = letters + numbers;
    let username = '';
    const length = Math.floor(Math.random() * 6) + 6; // 6-11 chars
    for (let i = 0; i < length; i++) {
        username += pool.charAt(Math.floor(Math.random() * pool.length));
    }
    return username;
};

const generateRandomName = () => {
    const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'Robert', 'Jessica'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
};

const generateRandomBirthday = () => {
    const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
    const day = (Math.floor(Math.random() * 28) + 1).toString().padStart(2, '0'); 
    const year = (Math.floor(Math.random() * (2000 - 1980 + 1)) + 1980).toString(); 
    return { month, day, year, full: `${month}/${day}/${year}` };
};

const saveToAccountsFile = (email, password) => {
    const filePath = path.join(__dirname, 'accounts.txt');
    const content = `${email}:${password}\n`;
    fs.appendFileSync(filePath, content);
    console.log(`✅ Kredensial akun disimpan di accounts.txt`);
};

const fetchVerificationCodeFromApi = async (userEmail) => {
    const apiUrl = `${config.domain}/${userEmail}/${config.apiKey}`;

    const config = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json' 
        },
        timeout: 15000 
    };
    
    try {
        const response = await axios.get(apiUrl, config); 
        
        if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
            
            const latestEmail = response.data[0];
            const emailSubject = latestEmail.subject;
            const regex = /\d{6}/;
            const match = emailSubject.match(regex);

            if (match && match.length > 0) {
                const realCode = match[0]; 
                return realCode;
            } else {
                return '999999'; 
            }
        } else {
            return null; 
        }
        
    } catch (error) {
        if (error.response && error.response.status >= 400) {
            return '111111'; 
        }
        return null;
    }
};

const fetchCapcutDomains = async () => {
    try {
        const response = await axios.get('https://generator.email/', { timeout: 15000 });
        const html = response.data;
        const match = html.match(/class="e7m tt-suggestions"([\s\S]*?)<\/div>/);
        if (!match) return [];
        const domainMatches = match[1].match(/<p[^>]*>([^<]+)<\/p>/g) || [];
        const domains = domainMatches
            .map(block => block.replace(/<[^>]+>/g, '').trim())
            .filter(text => text.includes('.'));
        return Array.from(new Set(domains));
    } catch (error) {
        console.error('⚠️ Gagal mengambil domain generator.email:', error.message);
        return [];
    }
};

const generateGeneratorAutoEmail = async () => {
    const domains = await fetchCapcutDomains();
    if (!domains.length) {
        throw new Error('Tidak ada domain generator.email yang tersedia');
    }
    const user = generateCleanUsername();
    const domainChoice = domains[Math.floor(Math.random() * domains.length)];
    const emailAddr = `${user}@${domainChoice}`;
    console.log(`🔮 Generator Auto Email: ${emailAddr}`);
    return emailAddr;
};

const generateGeneratorCustomEmail = () => {
    if (!config.customDomains.length) {
        throw new Error('Mohon set GENERATOR_CUSTOM_DOMAINS untuk mode generator_custom');
    }
    const user = generateCleanUsername();
    const domainChoice = config.customDomains[Math.floor(Math.random() * config.customDomains.length)];
    const emailAddr = `${user}@${domainChoice}`;
    console.log(`🎯 Generator Custom Email: ${emailAddr}`);
    return emailAddr;
};

const extractOtpFromHtml = (html) => {
    if (!html) return null;
    const patterns = [
        /<p[^>]*font-size:\s*24px[^>]*>[\s\n]*(\d{6})[\s\n]*<\/p>/i,
        /Your ChatGPT code is (\d{6})/i,
        /<title>.*?(\d{6}).*?<\/title>/i,
        /verification code[:\s]*(\d{6})/i,
        /code[:\s]*(\d{6})/i,
        /(\b\d{6}\b)/,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

const fetchGeneratorOtp = async (emailAddress) => {
    const [local, domainPart] = emailAddress.split('@');
    const inboxUrl = `https://generator.email/${domainPart}/${local}/`;
    console.log('⏳ Mengecek inbox generator.email...');
    const start = Date.now();
    while (Date.now() - start < 120000) {
        try {
            const response = await axios.get(inboxUrl, { timeout: 15000 });
            const otp = extractOtpFromHtml(response.data);
            if (otp) {
                const seconds = ((Date.now() - start) / 1000).toFixed(1);
                console.log(`🔑 OTP dari generator.email: ${otp} (${seconds}s)`);
                return otp;
            }
        } catch (error) {
            console.log('⚠️ Gagal mengambil inbox generator.email, mencoba lagi...');
        }
        await delay(3000);
    }
    console.error('❌ Timeout membaca OTP dari generator.email');
    return null;
};

const generateEmail = async () => {
    if (config.emailMode === 'generator_auto') {
        return generateGeneratorAutoEmail();
    }
    if (config.emailMode === 'generator_custom') {
        return generateGeneratorCustomEmail();
    }
    return generateRandomEmail();
};

const fetchVerificationCode = async (userEmail) => {
    if (config.emailMode === 'generator_auto' || config.emailMode === 'generator_custom') {
        return fetchGeneratorOtp(userEmail);
    }
    return fetchVerificationCodeFromApi(userEmail);
};

const captureDebugArtifacts = async (page, accountIndex, label) => {
    if (!page) return;
    try {
        const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_');
        const screenshotPath = path.join(__dirname, `debug-${accountIndex}-${safeLabel}.png`);
        const htmlPath = path.join(__dirname, `debug-${accountIndex}-${safeLabel}.html`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const html = await page.content();
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`🖼️ Screenshot disimpan: ${screenshotPath}`);
        console.log(`📝 HTML snapshot disimpan: ${htmlPath}`);
    } catch (error) {
        console.log(`⚠️ Gagal menyimpan artefak debug: ${error.message}`);
    }
};

const waitForFullNameInput = async (page, accountIndex) => {
    const candidates = [
        { type: 'xpath', selector: `//div[.//div[contains(text(), 'Full name')]]//input` },
        { type: 'css', selector: 'input[name="name"]' },
        { type: 'css', selector: 'input#fullName' },
        { type: 'css', selector: 'input[data-testid="name"]' },
    ];

    const timeoutMs = 20000;
    const deadline = Date.now() + timeoutMs;
    for (const candidate of candidates) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
            const handle = candidate.type === 'xpath'
                ? await page.waitForXPath(candidate.selector, { timeout: remaining })
                : await page.waitForSelector(candidate.selector, { timeout: remaining });
            if (handle) {
                if (candidate.type === 'css') {
                    console.log(`[STEP 5 Akun #${accountIndex}] Selector fallback terpakai: ${candidate.selector}`);
                }
                return handle;
            }
        } catch (error) {
            continue;
        }
    }
    throw new Error('Input nama lengkap tidak ditemukan setelah menunggu beberapa selector.');
};

const askQuestionWithDefault = (question, defaultValue = '') => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => {
        rl.question(question, (answer) => {
            rl.close();
            const value = answer.trim();
            resolve(value || defaultValue);
        });
    });
};

const promptConfiguration = async () => {
    console.log('\n--- PENGATURAN EMAIL ---');

    const passwordMask = config.password ? '****' : 'kosong';
    const passwordPrompt = `🔒 Password ChatGPT (default: ${passwordMask}): `;
    config.password = await askQuestionWithDefault(passwordPrompt, config.password);

    if (!config.password) {
        console.error('❌ ERROR FATAL: Password tidak boleh kosong.');
        process.exit(1);
    }

    const modeOptions = {
        '1': 'api',
        '2': 'generator_auto',
        '3': 'generator_custom',
    };

    const defaultModeNumber = Object.entries(modeOptions).find(([, mode]) => mode === config.emailMode)?.[0] || '1';
    const modePrompt =
        `📧 Pilih mode email:
1) api
2) generator_auto
3) generator_custom
Pilih [1/2/3] (default: ${defaultModeNumber} = ${config.emailMode}): `;

    const rawMode = (await askQuestionWithDefault(modePrompt, defaultModeNumber)).toLowerCase();
    const chosenMode = modeOptions[rawMode] || rawMode;

    if (!['api', 'generator_auto', 'generator_custom'].includes(chosenMode)) {
        console.error('❌ ERROR FATAL: Mode email tidak valid. Pilih 1/2/3 atau api/generator_auto/generator_custom.');
        process.exit(1);
    }
    config.emailMode = chosenMode;

    if (config.emailMode === 'api') {
        const domainPrompt = `🌐 EMAIL_SERVICE_DOMAIN (default: ${config.domain || 'kosong'}): `;
        config.domain = await askQuestionWithDefault(domainPrompt, config.domain);

        const keyPrompt = `🔑 EMAIL_SERVICE_API_KEY (default: ${config.apiKey ? '****' : 'kosong'}): `;
        config.apiKey = await askQuestionWithDefault(keyPrompt, config.apiKey);

        if (!config.domain || !config.apiKey) {
            console.error('❌ ERROR FATAL: EMAIL_SERVICE_DOMAIN dan EMAIL_SERVICE_API_KEY wajib diisi untuk mode api.');
            process.exit(1);
        }
    }

    if (config.emailMode === 'generator_custom') {
        const defaultDomains = config.customDomains.join(', ');
        const domainsPrompt = `🎯 GENERATOR_CUSTOM_DOMAINS pisahkan dengan koma (default: ${defaultDomains || 'kosong'}): `;
        const domainInput = await askQuestionWithDefault(domainsPrompt, defaultDomains);
        config.customDomains = domainInput
            .split(',')
            .map(d => d.trim())
            .filter(Boolean);

        if (!config.customDomains.length) {
            console.error('❌ ERROR FATAL: Setidaknya satu domain harus diisi di GENERATOR_CUSTOM_DOMAINS.');
            process.exit(1);
        }
    }

    console.log('\n--- KONFIGURASI DIPAKAI ---');
    console.log(`Mode Email: ${config.emailMode}`);
    if (config.emailMode === 'api') {
        console.log(`Domain API: ${config.domain}`);
    }
    if (config.emailMode === 'generator_custom') {
        console.log(`Domain Custom: ${config.customDomains.join(', ')}`);
    }
    console.log('-------------------------\n');
};

// --- FUNGSI UTAMA OTOMASI PER AKUN ---
async function runAutomation(accountIndex) {
    const email = await generateEmail();
    const fullName = generateRandomName();
    const birthdayData = generateRandomBirthday();

    let browser;
    let page;

    try {
        browser = await puppeteer.launch({
            headless: headless, 
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        // --- LOGGING DETEKSI URL BARU DAN RESPON JARINGAN (DIRINGKAS) ---
        const shortenUrl = (url) => {
            try {
                const parsed = new URL(url);
                const path = parsed.pathname + parsed.search;
                return `${parsed.hostname}${path.length > 50 ? path.substring(0, 47) + '...' : path}`;
            } catch {
                return url.substring(0, 50) + '...';
            }
        };

        page.on('response', async (response) => {
            const url = response.url();
            const status = response.status();
            if (url.includes('openai.com') && status !== 200 && status !== 304 || url.includes('api/messages')) {
                console.log(`[NETWORK 🌐 Akun #${accountIndex}] ${shortenUrl(url)} | STATUS: ${status}`);
            }
        });
        page.on('load', async () => {
            const url = page.url();
            console.log(`[NAVIGASI ➡️ Akun #${accountIndex}] URL: ${shortenUrl(url)}`);
        });
        // ----------------------------------------------------------------------

        console.log(`\n--- START AKUN #${accountIndex} (Email: ${email}) ---`);
        
        // --- STEP 1: Navigasi dan Klik Signup ---
        console.log(`[STEP 1 Akun #${accountIndex}] Memulai navigasi dan klik "Sign up".`);
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2', timeout: 90000 }); 
        await page.click('button[data-testid="signup-button"]');
        await page.waitForSelector('input#email[type="email"]', { timeout: 10000 });
        await page.type('input#email[type="email"]', email, { delay: 50 });
        
        await page.evaluate(() => {
            const continueBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(el => el.textContent.includes('Continue'));
            if (continueBtn) continueBtn.click();
        });
        await delay(2000);
        
        // --- STEP 2: Input Password ---
        console.log(`[STEP 2 Akun #${accountIndex}] Mengisi password.`);
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.type('input[type="password"]', config.password, { delay: 50 });
        await page.evaluate(() => {
            const continueBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue'));
            if (continueBtn) continueBtn.click();
        });

        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
        await delay(3000);

        // --- STEP 3: Fetch Kode Verifikasi (Delay 7 detik) ---
        
        console.log(`[STEP 3 Akun #${accountIndex}] ⏱️ Menunggu 7 detik untuk email masuk...`);
        await delay(7000);
        
        console.log(`[STEP 3 Akun #${accountIndex}] Memanggil API untuk mendapatkan kode...`);
        const verificationCode = await fetchVerificationCode(email);

        if (verificationCode) {
            console.log(`[STEP 3 Akun #${accountIndex}] ✅ Kode didapatkan: ${verificationCode}`);

            // --- STEP 4: Input Kode Verifikasi & Continue ---
            const codeInputSelector = 'input[type="text"]';
            console.log(`[STEP 4 Akun #${accountIndex}] Mengisi kode dan klik "Continue".`);

            await page.waitForSelector(codeInputSelector, { timeout: 10000 });
            const codeToType = String(verificationCode);
            await page.type(codeInputSelector, codeToType, { delay: 100 });

            await page.waitForSelector('button[data-dd-action-name="Continue"]', { timeout: 10000 });
            await page.click('button[data-dd-action-name="Continue"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            await delay(3000);


            // --- STEP 5: Input Full Name (SELECTOR DIPERBAIKI) ---
            console.log(`[STEP 5 Akun #${accountIndex}] Mengisi Nama Lengkap: ${fullName}`);
            let fullNameInput;
            try {
                fullNameInput = await waitForFullNameInput(page, accountIndex);
            } catch (error) {
                await captureDebugArtifacts(page, accountIndex, 'full-name-missing');
                throw error;
            }
            await fullNameInput.evaluate(el => el.value = '');
            await fullNameInput.type(fullName, { delay: 50 });


            // --- STEP 6: Input Birthday ---
            const monthSelector = 'div[role="spinbutton"][data-type="month"]';
            const daySelector = 'div[role="spinbutton"][data-type="day"]';
            const yearSelector = 'div[role="spinbutton"][data-type="year"]';
            
            console.log(`[STEP 6 Akun #${accountIndex}] Mengisi Tanggal Lahir: ${birthdayData.full}`);
            await page.waitForSelector(monthSelector, { timeout: 10000 });
            await page.type(monthSelector, birthdayData.month, { delay: 50 });
            await page.type(daySelector, birthdayData.day, { delay: 50 });
            await page.type(yearSelector, birthdayData.year, { delay: 50 });


            // --- STEP 7: Klik Continue Profile ---
            console.log(`[STEP 7 Akun #${accountIndex}] Klik "Continue" untuk Profil.`);
            await page.click('button[data-dd-action-name="Continue"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});

            // --- SELESAI ---
            saveToAccountsFile(email, config.password);
            return true;

        } else {
            console.error(`[FATAL Akun #${accountIndex}] Gagal: Kode verifikasi tidak bisa didapatkan atau API gagal.`);
            return false;
        }


    } catch (error) {
        console.error(`[FATAL Akun #${accountIndex}] ERROR: Otomasi Terhenti secara mendadak: ${error.message}`);
        await captureDebugArtifacts(page, accountIndex, 'error');
        return false;
    } finally {
         if (browser) {
            await browser.close();
        }
    }
}


// --- FUNGSI UTAMA: LOOP PARALEL (Sekarang Serial karena CONCURRENT_LIMIT = 1) ---

(async () => {
    await promptConfiguration();
    
    // 1. CETAK LOGO TERLEBIH DAHULU
    console.log(`\n██╗  ██╗ ██████╗███████╗      ██████╗ ███████╗██╗  ██╗`);
    console.log(`╚██╗██╔╝██╔════╝╚══███╔╝      ██╔══██╗██╔════╝██║  ██║`);
    console.log(` ╚███╔╝ ██║       ███╔╝█████╗██║  ██║█████╗  ██║  ██║`);
    console.log(` ██╔██╗ ██║      ███╔╝ ╚════╝██║  ██║██╔══╝  ╚██╗ ██╔╝`);
    console.log(`██╔╝ ██╗╚██████╗███████╗      ██████╔╝███████╗ ╚████╔╝ `);
    console.log(`╚═╝  ╚═╝ ╚═════╝╚══════╝      ╚═════╝ ╚══════╝  ╚═══╝  `);
    console.log(`=============================================================`);
    
    // 2. Tanyakan jumlah akun yang ingin dibuat
    const maxAccountsStr = await askQuestionWithDefault(`Masukkan jumlah akun yang ingin dibuat (Contoh: 5): `);
    const MAX_ACCOUNTS = parseInt(maxAccountsStr);

    if (isNaN(MAX_ACCOUNTS) || MAX_ACCOUNTS <= 0) {
        console.error("❌ INPUT TIDAK VALID: Mohon masukkan angka positif.");
        process.exit(1);
    }
    
    const queue = new pQueue.default({ concurrency: CONCURRENT_LIMIT });
    const accountTasks = [];
    
    // Tambahkan info Konfigurasi setelah input (sebelum loop dimulai)
    console.log(`\n--- KONFIGURASI ---`);
    console.log(`Jumlah Akun: ${MAX_ACCOUNTS}`);
    console.log(`Konkurensi Paralel: ${CONCURRENT_LIMIT} (Serial)`);
    console.log(`Mode Email: ${config.emailMode}`);
    console.log(`-------------------\n`);

    for (let i = 1; i <= MAX_ACCOUNTS; i++) {
        accountTasks.push(
            queue.add(async () => {
                let success = false;
                try {
                    success = await runAutomation(i); 
                } catch (error) {
                    console.error(`[FATAL ERROR AKUN #${i}] Gagal saat eksekusi: ${error.message}`);
                }

                const randomDelay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
                console.log(`\n[JEDA 💤 Slot #${i}] Menunggu ${randomDelay / 1000} detik sebelum slot berikutnya siap.`);
                await delay(randomDelay);
                
                return success;
            })
        );
    }
    
    const results = await Promise.all(accountTasks); 
    const successCount = results.filter(r => r).length;

    console.log(`\n=============================================================`);
    console.log(`🎉 OTOMASI SELESAI.`);
    console.log(`Total Akun Dibuat: ${successCount} / ${MAX_ACCOUNTS}`);
    console.log(`=============================================================`);
})();
