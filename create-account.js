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

// Konfigurasi dari ENV
const password = process.env.CHATGPT_PASSWORD; 
const domain = process.env.EMAIL_SERVICE_DOMAIN; 
const apikey = process.env.EMAIL_SERVICE_API_KEY; 

// --- FUNGSI UTILITY (Tidak Berubah) ---

const fetchCapcutDomains = async () => {
    try {
        const response = await axios.get('https://generator.email/');
        const match = response.data.match(/class="e7m tt-suggestions".*?<\/div>/s);

        if (!match) return [];

        const domainMatches = [...match[0].matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map((m) => m[1].trim());
        return Array.from(new Set(domainMatches.filter((d) => d.includes('.'))));
    } catch (error) {
        console.error('❌ Gagal mengambil domain generator.email:', error.message);
        return [];
    }
};

const generateCleanUsername = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const randomLength = Math.floor(Math.random() * 5) + 6; // 6-10 huruf
    let username = '';
    for (let i = 0; i < randomLength; i++) {
        username += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return username;
};

const generateGeneratorAutoEmail = (domains) => {
    if (!domains || domains.length === 0) {
        throw new Error('Domain generator.email tidak tersedia');
    }
    const user = generateCleanUsername();
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${user}@${domain}`;
};

const generateGeneratorCustomEmail = (customDomain) => {
    const user = generateCleanUsername();
    return `${user}@${customDomain}`;
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

const fetchVerificationCode = async (userEmail) => {
    const apiUrl = `${domain}/${userEmail}/${apikey}`;

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

function getUserInput(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    // Menambahkan console.log kosong untuk membersihkan output setelah logo dicetak
    process.stdout.write('\n'); 
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer);
    }));
}

// --- FUNGSI UTAMA OTOMASI PER AKUN ---
async function runAutomation(accountIndex, generateEmail) {
    const email = generateEmail();
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // --- STEP 2: Input Password ---
        console.log(`[STEP 2 Akun #${accountIndex}] Mengisi password.`);
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.type('input[type="password"]', password, { delay: 50 });
        await page.evaluate(() => {
            const continueBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue'));
            if (continueBtn) continueBtn.click();
        });
        
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 3000));

        // --- STEP 3: Fetch Kode Verifikasi (Delay 7 detik) ---
        
        console.log(`[STEP 3 Akun #${accountIndex}] ⏱️ Menunggu 7 detik untuk email masuk...`);
        await new Promise(resolve => setTimeout(resolve, 7000)); 
        
        console.log(`[STEP 3 Akun #${accountIndex}] Memanggil API untuk mendapatkan kode...`);
        const verificationCode = await fetchVerificationCode(email);

        if (verificationCode) {
            console.log(`[STEP 3 Akun #${accountIndex}] ✅ Kode didapatkan: ${verificationCode}`);
            
            // --- STEP 4: Input Kode Verifikasi & Continue ---
            const codeInputSelector = 'input[type="text"]'; 
            console.log('[STEP 4 Akun #${accountIndex}] Mengisi kode dan klik "Continue".');
            await page.waitForSelector(codeInputSelector, { timeout: 10000 }); 
            await page.type(codeInputSelector, verificationCode, { delay: 100 });
            await page.click('button[data-dd-action-name="Continue"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 3000));


            // --- STEP 5: Input Full Name (SELECTOR DIPERBAIKI) ---
            
            const fullNameInputXPath = `//div[.//div[contains(text(), 'Full name')]]//input`;
            console.log(`[STEP 5 Akun #${accountIndex}] Mengisi Nama Lengkap: ${fullName}`);
            const fullNameInput = await page.waitForXPath(fullNameInputXPath, { timeout: 10000 });
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
            saveToAccountsFile(email, password);
            return true;

        } else {
            console.error(`[FATAL Akun #${accountIndex}] Gagal: Kode verifikasi tidak bisa didapatkan atau API gagal.`);
            return false;
        }


    } catch (error) {
        console.error(`[FATAL Akun #${accountIndex}] ERROR: Otomasi Terhenti secara mendadak: ${error.message}`);
        return false;
    } finally {
         if (browser) {
            await browser.close(); 
        }
    }
}


// --- FUNGSI UTAMA: LOOP PARALEL (Sekarang Serial karena CONCURRENT_LIMIT = 1) ---

(async () => {
    if (!password || !domain || !apikey) {
        console.error("❌ ERROR FATAL: Pastikan semua variabel (PASSWORD, DOMAIN, API_KEY) terisi di file .env");
        process.exit(1);
    }
    
    // 1. CETAK LOGO TERLEBIH DAHULU
    console.log(`\n██╗  ██╗ ██████╗███████╗      ██████╗ ███████╗██╗  ██╗`);
    console.log(`╚██╗██╔╝██╔════╝╚══███╔╝      ██╔══██╗██╔════╝██║  ██║`);
    console.log(` ╚███╔╝ ██║       ███╔╝█████╗██║  ██║█████╗  ██║  ██║`);
    console.log(` ██╔██╗ ██║      ███╔╝ ╚════╝██║  ██║██╔══╝  ╚██╗ ██╔╝`);
    console.log(`██╔╝ ██╗╚██████╗███████╗      ██████╔╝███████╗ ╚████╔╝ `);
    console.log(`╚═╝  ╚═╝ ╚═════╝╚══════╝      ╚═════╝ ╚══════╝  ╚═══╝  `);
    console.log(`=============================================================`);
    
    // 2. Pilih mode email
    const emailModeInput = await getUserInput(`Pilih mode email [random/custom]: `);
    const emailMode = emailModeInput.trim().toLowerCase() === 'custom' ? 'custom' : 'random';
    let customDomain = '';
    let generatorDomains = [];

    if (emailMode === 'custom') {
        customDomain = (await getUserInput(`Masukkan custom domain (contoh: mydomain.com): `)).trim();

        if (!customDomain || !customDomain.includes('.')) {
            console.error('❌ INPUT TIDAK VALID: Domain harus mengandung titik, contoh: example.com');
            process.exit(1);
        }
    } else {
        generatorDomains = await fetchCapcutDomains();
        if (generatorDomains.length === 0) {
            console.error('❌ Tidak ada domain generator.email yang tersedia. Coba lagi nanti.');
            process.exit(1);
        }
    }

    // 3. Tanyakan jumlah akun yang ingin dibuat
    const maxAccountsStr = await getUserInput(`Masukkan jumlah akun yang ingin dibuat (Contoh: 5): `);
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
    console.log(`Mode Email: ${emailMode === 'custom' ? `Custom (${customDomain})` : 'Random (generator.email)'}`);
    console.log(`-------------------\n`);

    const generateEmail = () => {
        return emailMode === 'custom'
            ? generateGeneratorCustomEmail(customDomain)
            : generateGeneratorAutoEmail(generatorDomains);
    };

    for (let i = 1; i <= MAX_ACCOUNTS; i++) {
        accountTasks.push(
            queue.add(async () => {
                let success = false;
                try {
                    success = await runAutomation(i, generateEmail);
                } catch (error) {
                    console.error(`[FATAL ERROR AKUN #${i}] Gagal saat eksekusi: ${error.message}`);
                }

                const randomDelay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; 
                console.log(`\n[JEDA 💤 Slot #${i}] Menunggu ${randomDelay / 1000} detik sebelum slot berikutnya siap.`);
                await new Promise(resolve => setTimeout(resolve, randomDelay));
                
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