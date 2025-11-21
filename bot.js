// ============================================
// SPOTIFY TELEGRAM BOT - ULTIMATE VERSION WITH TOP-UP
// Developer: Adeebaabkhan (@itsmeaab)
// Updated: 2025-01-28 13:29:04 UTC
// Version: 7.0.0 - Added Complete Top-Up System
// ============================================

process.noDeprecation = true;

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = '8279412794:AAFJyxlXrWGvzeruwOoDMjTTlb6ZkOlyg3M';
const ADMIN_USERNAME = '@itsmeaab';
const ADMIN_TELEGRAM_ID = 7680006005;
const MAX_ORDER_QUANTITY = 50000;
const DAILY_CLAIM_BASE = 25;
const DAILY_CLAIM_INCREMENT = 25;
const CLAIM_RESET_DAYS = 7;
const LOW_STOCK_ALERT = 5;
const ORDER_EXPIRY_MINUTES = 30;
const ACCOUNT_MESSAGE_LIMIT = 20;
const MIN_TOPUP_AMOUNT = 0;
const MAX_TOPUP_AMOUNT = 100000;
const ACCOUNT_PRICE_IDR = 650;

// File paths
const ORDERS_FILE = 'orders.json';
const USERS_FILE = 'users.json';
const STOCK_FILE = 'stock.json';
const PRICING_FILE = 'pricing.json';
const BALANCES_FILE = 'balances.json';
const CLAIMS_FILE = 'claims.json';
const COUPONS_FILE = 'coupons.json';
const COUNTER_FILE = 'counter.json';
const QRIS_FILE = 'qris_payment.json';
const PENDING_PAYMENTS_FILE = 'pending_payments.json';
const TOPUPS_FILE = 'topups.json';
const GIFT_MESSAGES_FILE = 'gift_messages.json';
const BONUSES_FILE = 'bonuses.json';
const ACCOUNTS_FILE = 'accounts.json';
const CUSTOM_CONTENT_FILE = 'custom_content.json';

// Default pricing
const DEFAULT_PRICING = {
    "1-99": 500,
    "100-199": 450,
    "200-499": 400,
    "500-999": 350,
    "1000+": 300
};

const DEFAULT_BONUSES = [];

const DEFAULT_COUPONS = {
    "AAB": {
        code: "AAB",
        discount_percent: 10,
        description: "10% off - First time users only",
        min_order: 1,
        max_uses: null,
        used_count: 0,
        used_by: [],
        expires_at: null,
        active: true,
        first_order_only: true,
        created_at: new Date().toISOString()
    }
};

const userStates = {};

const userRequestTimestamps = {};
function isRateLimited(userId) {
    const now = Date.now();
    if (!userRequestTimestamps[userId]) userRequestTimestamps[userId] = [];
    userRequestTimestamps[userId] = userRequestTimestamps[userId].filter(t => now - t < 2000);
    if (userRequestTimestamps[userId].length >= 5) return true;
    userRequestTimestamps[userId].push(now);
    return false;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/`/g, '\\`')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/>/g, '\\>')
        .replace(/\|/g, '\\|')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/\-/g, '\\-')
        .replace(/\=/g, '\\=')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.');
}

function escapeInlineCode(text) {
    if (!text) return '';
    return String(text).replace(/`/g, '\\`');
}

function loadJSON(filename, defaultValue = {}) {
    try {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`⚠️ Error loading ${filename}:`, error.message);
    }
    return defaultValue;
}

function saveJSON(filename, data) {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`⚠️ Error saving ${filename}:`, error.message);
        return false;
    }
}

function getOrderCounter() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = fs.readFileSync(COUNTER_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading counter:', error.message);
    }
    return { last_order_id: 0, last_topup_id: 0 };
}

function getNextOrderId() {
    const counter = getOrderCounter();
    counter.last_order_id += 1;
    saveJSON(COUNTER_FILE, counter);
    return counter.last_order_id;
}

function getNextTopupId() {
    const counter = getOrderCounter();
    counter.last_topup_id = (counter.last_topup_id || 0) + 1;
    saveJSON(COUNTER_FILE, counter);
    return counter.last_topup_id;
}

function getStock() {
    return loadJSON(STOCK_FILE, { current_stock: 0, links: [] });
}

function getAccountStock() {
    return loadJSON(ACCOUNTS_FILE, { accounts: [] });
}

function updateAccountStock(accounts = []) {
    saveJSON(ACCOUNTS_FILE, { accounts });
}

function updateStock(quantity, links = null) {
    const stock = getStock();
    const previousStock = stock.current_stock;
    const previousLinkCount = stock.links.length;
    
    stock.current_stock = quantity;
    if (links !== null) {
        stock.links = links;
    }
    saveJSON(STOCK_FILE, stock);
    
    if (links !== null && links.length <= LOW_STOCK_ALERT && links.length < previousLinkCount) {
        if (bot && botReady) {
            bot.sendMessage(ADMIN_TELEGRAM_ID,
                `⚠️ *LOW STOCK ALERT!*\n\n` +
                `🔗 Only *${links.length}* links remaining!\n\n` +
                `Please add more links via Upload button\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
    }
    
    if (links !== null && quantity > previousStock) {
        const stockAdded = quantity - previousStock;
        setTimeout(() => {
            broadcastRestock(quantity).then(result => {
                if (bot && botReady) {
                    bot.sendMessage(ADMIN_TELEGRAM_ID,
                        `📢 *AUTO-BROADCAST SENT!*\n\n` +
                        `📦 Restock: +${stockAdded} links\n` +
                        `✅ Success: ${result.success}\n` +
                        `❌ Failed: ${result.failed}\n` +
                        `📊 Total users: ${result.total}`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }
            }).catch(() => {});
        }, 2000);
    }
}

function getCustomContent() {
    const content = loadJSON(CUSTOM_CONTENT_FILE, { products: [], buttons: [] });
    return {
        products: Array.isArray(content.products) ? content.products : [],
        buttons: Array.isArray(content.buttons) ? content.buttons : []
    };
}

function saveCustomContent(content) {
    const normalized = {
        products: Array.isArray(content.products) ? content.products : [],
        buttons: Array.isArray(content.buttons) ? content.buttons : []
    };
    saveJSON(CUSTOM_CONTENT_FILE, normalized);
}

function chunkCustomButtons(buttons = []) {
    if (!Array.isArray(buttons) || buttons.length === 0) return [];
    return buttons.map(btn => [{ text: btn.label, url: btn.url }]);
}

function getOrders() {
    return loadJSON(ORDERS_FILE, []);
}

function addOrder(order) {
    const orders = getOrders();
    orders.push(order);
    saveJSON(ORDERS_FILE, orders);
}

function updateOrder(orderId, updates) {
    const orders = getOrders();
    const orderIndex = orders.findIndex(o => o.order_id === orderId);
    if (orderIndex !== -1) {
        orders[orderIndex] = { ...orders[orderIndex], ...updates };
        saveJSON(ORDERS_FILE, orders);
        return orders[orderIndex];
    }
    return null;
}

function getUsers() {
    return loadJSON(USERS_FILE, {});
}

function addUser(userId, userData) {
    const users = getUsers();
    const isNewUser = !users[userId];
    
    if (!users[userId]) {
        users[userId] = {
            user_id: userId,
            username: userData.username || 'No username',
            first_name: userData.first_name || 'Unknown',
            last_name: userData.last_name || '',
            language_code: userData.language_code || 'unknown',
            joined: new Date().toISOString(),
            total_orders: 0,
            completed_orders: 0,
            total_topups: 0
        };
    }
    
    users[userId].last_interaction = new Date().toISOString();
    saveJSON(USERS_FILE, users);
    return isNewUser;
}

function getBalances() {
    return loadJSON(BALANCES_FILE, {});
}

function getBalance(userId) {
    const balances = getBalances();
    return balances[userId] || 0;
}

function updateBalance(userId, amount) {
    const balances = getBalances();
    balances[userId] = (balances[userId] || 0) + amount;
    saveJSON(BALANCES_FILE, balances);
    return balances[userId];
}

function getClaims() {
    return loadJSON(CLAIMS_FILE, {});
}

function canClaim(userId) {
    const claims = getClaims();
    const lastClaim = claims[userId];
    
    if (!lastClaim) return true;
    
    const lastClaimDate = new Date(lastClaim.timestamp);
    const now = new Date();
    const hoursDiff = (now - lastClaimDate) / (1000 * 60 * 60);
    
    return hoursDiff >= 24;
}

function recordClaim(userId, streakDay) {
    const claims = getClaims();
    claims[userId] = {
        timestamp: new Date().toISOString(),
        streak_day: streakDay
    };
    saveJSON(CLAIMS_FILE, claims);
}

function getNextClaimTime(userId) {
    const claims = getClaims();
    const lastClaim = claims[userId];
    
    if (!lastClaim) return 'Now';
    
    const lastClaimDate = new Date(lastClaim.timestamp);
    const nextClaimDate = new Date(lastClaimDate.getTime() + (24 * 60 * 60 * 1000));
    const now = new Date();
    const diff = nextClaimDate - now;
    
    if (diff <= 0) return 'Now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function getClaimAmount(userId) {
    const claims = getClaims();
    const lastClaim = claims[userId];
    
    if (!lastClaim) {
        return { amount: DAILY_CLAIM_BASE, day: 1, isNewStreak: true };
    }
    
    const lastClaimDate = new Date(lastClaim.timestamp);
    const now = new Date();
    const hoursDiff = (now - lastClaimDate) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) {
        return { amount: 0, day: lastClaim.streak_day, canClaim: false };
    }
    
    if (hoursDiff >= 48) {
        return { amount: DAILY_CLAIM_BASE, day: 1, isNewStreak: true };
    }
    
    let nextDay = lastClaim.streak_day + 1;
    if (nextDay > CLAIM_RESET_DAYS) {
        nextDay = 1;
    }
    
    const amount = DAILY_CLAIM_BASE + (DAILY_CLAIM_INCREMENT * (nextDay - 1));
    return { amount: amount, day: nextDay, isNewStreak: false };
}

function getPricing() {
    return loadJSON(PRICING_FILE, DEFAULT_PRICING);
}

function updatePricing(pricing) {
    saveJSON(PRICING_FILE, pricing);
}

function getBonuses() {
    const bonuses = loadJSON(BONUSES_FILE, DEFAULT_BONUSES);
    if (!Array.isArray(bonuses)) return [];

    return bonuses
        .map(bonus => {
            const min = parseInt(bonus.min_quantity);
            const bonusQty = parseInt(bonus.bonus_quantity);
            if (isNaN(min) || min < 1 || isNaN(bonusQty) || bonusQty < 1) {
                return null;
            }
            const description = bonus.description && String(bonus.description).trim().length > 0
                ? String(bonus.description).trim()
                : `Buy ${min}+ get ${bonusQty} free`;
            return {
                min_quantity: min,
                bonus_quantity: bonusQty,
                description
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.min_quantity - b.min_quantity);
}

function saveBonuses(bonuses) {
    saveJSON(BONUSES_FILE, bonuses);
}

function getActiveBonus(quantity) {
    if (!quantity || quantity < 1) return null;
    const bonuses = getBonuses();
    let active = null;

    bonuses.forEach(bonus => {
        if (quantity >= bonus.min_quantity) {
            if (!active || bonus.min_quantity >= active.min_quantity) {
                active = bonus;
            }
        }
    });

    return active;
}

function getBonusQuantity(quantity) {
    const activeBonus = getActiveBonus(quantity);
    return activeBonus ? activeBonus.bonus_quantity : 0;
}

function formatBonusDealsList() {
    const bonuses = getBonuses();
    if (bonuses.length === 0) {
        return 'No bonus deals are active right now.';
    }

    return bonuses.map(bonus =>
        `• Buy ${bonus.min_quantity}+ get ${bonus.bonus_quantity} free (${escapeMarkdown(bonus.description)})`
    ).join('\n');
}

function getOrderTotalQuantity(order) {
    if (!order) return 0;
    if (typeof order.total_quantity === 'number') {
        return order.total_quantity;
    }
    const baseQuantity = order.quantity || 0;
    const bonusQuantity = order.bonus_quantity || 0;
    return baseQuantity + bonusQuantity;
}

function formatOrderQuantitySummary(order) {
    if (!order) return '0 links';
    if (order.product === 'account' || order.type === 'account') {
        const total = getOrderTotalQuantity(order);
        return `${total} account${total > 1 ? 's' : ''}`;
    }
    const total = getOrderTotalQuantity(order);
    if (order.bonus_quantity && order.bonus_quantity > 0) {
        return `${order.quantity} + ${order.bonus_quantity} bonus = ${total} links`;
    }
    return `${order.quantity} links`;
}

function getCoupons() {
    const coupons = loadJSON(COUPONS_FILE, DEFAULT_COUPONS);
    if (!coupons.AAB) coupons.AAB = DEFAULT_COUPONS.AAB;
    saveJSON(COUPONS_FILE, coupons);
    return coupons;
}

function saveCoupons(coupons) {
    saveJSON(COUPONS_FILE, coupons);
}

function addCoupon(couponData) {
    const coupons = getCoupons();
    coupons[couponData.code.toUpperCase()] = couponData;
    saveCoupons(coupons);
}

function deleteCoupon(code) {
    const coupons = getCoupons();
    delete coupons[code.toUpperCase()];
    saveCoupons(coupons);
}

function toggleCouponStatus(code) {
    const coupons = getCoupons();
    const coupon = coupons[code.toUpperCase()];
    if (coupon) {
        coupon.active = !coupon.active;
        saveCoupons(coupons);
        return coupon.active;
    }
    return null;
}

function calculatePrice(quantity) {
    if (!quantity || typeof quantity !== 'number' || isNaN(quantity)) {
        throw new Error('Invalid quantity: must be a valid number');
    }
    
    if (quantity < 1) {
        throw new Error('Invalid quantity: must be at least 1');
    }
    
    if (quantity > MAX_ORDER_QUANTITY) {
        throw new Error(`Invalid quantity: maximum is ${MAX_ORDER_QUANTITY}`);
    }
    
    const pricing = getPricing();
    
    if (!pricing || typeof pricing !== 'object' || Object.keys(pricing).length === 0) {
        throw new Error('Pricing data not available');
    }
    
    const sortedRanges = Object.keys(pricing).sort((a, b) => {
        const aMin = parseInt(a.split('-')[0]);
        const bMin = parseInt(b.split('-')[0]);
        return bMin - aMin;
    });
    
    for (const range of sortedRanges) {
        if (range.includes('+')) {
            const min = parseInt(range.replace('+', ''));
            if (quantity >= min) {
                return quantity * pricing[range];
            }
        } else {
            const [min, max] = range.split('-').map(n => parseInt(n));
            if (quantity >= min && quantity <= max) {
                return quantity * pricing[range];
            }
        }
    }
    
    const firstRange = Object.keys(pricing)[0];
    return quantity * pricing[firstRange];
}

function getPricePerUnit(quantity) {
    const pricing = getPricing();
    const sortedRanges = Object.keys(pricing).sort((a, b) => {
        const aMin = parseInt(a.split('-')[0]);
        const bMin = parseInt(b.split('-')[0]);
        return bMin - aMin;
    });
    
    for (const range of sortedRanges) {
        if (range.includes('+')) {
            const min = parseInt(range.replace('+', ''));
            if (quantity >= min) {
                return pricing[range];
            }
        } else {
            const [min, max] = range.split('-').map(n => parseInt(n));
            if (quantity >= min && quantity <= max) {
                return pricing[range];
            }
        }
    }
    
    const firstRange = Object.keys(pricing)[0];
    return pricing[firstRange];
}

function calculateQuantityForBudget(budget) {
    const pricing = getPricing();
    let bestQuantity = 0;
    let bestPrice = 0;
    
    const sortedRanges = Object.keys(pricing).sort((a, b) => {
        const aMin = parseInt(a.split('-')[0]);
        const bMin = parseInt(b.split('-')[0]);
        return bMin - aMin;
    });
    
    for (const range of sortedRanges) {
        const pricePerUnit = pricing[range];
        const qty = Math.floor(budget / pricePerUnit);
        
        if (qty > 0) {
            if (range.includes('+')) {
                const min = parseInt(range.replace('+', ''));
                if (qty >= min) {
                    const totalPrice = qty * pricePerUnit;
                    if (totalPrice <= budget && qty > bestQuantity) {
                        bestQuantity = qty;
                        bestPrice = totalPrice;
                    }
                }
            } else {
                const [min, max] = range.split('-').map(n => parseInt(n));
                if (qty >= min && qty <= max) {
                    const totalPrice = qty * pricePerUnit;
                    if (totalPrice <= budget && qty > bestQuantity) {
                        bestQuantity = qty;
                        bestPrice = totalPrice;
                    }
                }
            }
        }
    }
    
    return { quantity: bestQuantity, price: bestPrice, pricePerUnit: bestQuantity > 0 ? Math.floor(bestPrice / bestQuantity) : 0 };
}

function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID').format(amount);
}

function isAdmin(userId) {
    return userId === ADMIN_TELEGRAM_ID;
}

function getCurrentDateTime() {
    const now = new Date();
    return now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function validateCoupon(code, userId, quantity) {
    const coupons = getCoupons();
    const coupon = coupons[code.toUpperCase()];
    
    if (!coupon) {
        return { valid: false, message: '❌ Invalid coupon code!' };
    }
    
    if (!coupon.active) {
        return { valid: false, message: '❌ This coupon is inactive!' };
    }
    
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, message: '❌ This coupon has expired!' };
    }
    
    if (quantity < coupon.min_order) {
        return { valid: false, message: `❌ Minimum ${coupon.min_order} links required!` };
    }
    
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        return { valid: false, message: '❌ Coupon usage limit reached!' };
    }
    
    if (coupon.first_order_only) {
        const orders = getOrders();
        const userHasOrders = orders.some(o => o.user_id === userId && o.status === 'completed');
        if (userHasOrders) {
            return { valid: false, message: '❌ This coupon is for first-time customers only!' };
        }
    }
    
    if (coupon.used_by && coupon.used_by.includes(userId)) {
        return { valid: false, message: '❌ You have already used this coupon!' };
    }
    
    return { valid: true, coupon: coupon };
}

function applyCoupon(code, userId) {
    const coupons = getCoupons();
    const coupon = coupons[code.toUpperCase()];
    
    if (coupon) {
        coupon.used_count = (coupon.used_count || 0) + 1;
        if (!coupon.used_by) coupon.used_by = [];
        if (!coupon.used_by.includes(userId)) {
            coupon.used_by.push(userId);
        }
        saveCoupons(coupons);
    }
}

function getQRIS() {
    return loadJSON(QRIS_FILE, { file_id: null, uploaded_at: null });
}

function setQRIS(fileId) {
    const qris = {
        file_id: fileId,
        uploaded_at: new Date().toISOString()
    };
    saveJSON(QRIS_FILE, qris);
    return qris;
}

function getPendingPayments() {
    return loadJSON(PENDING_PAYMENTS_FILE, {});
}

function addPendingPayment(userId, orderId, photoFileId) {
    const pending = getPendingPayments();
    if (!pending[userId]) pending[userId] = [];
    pending[userId].push({
        order_id: orderId,
        photo_file_id: photoFileId,
        timestamp: new Date().toISOString()
    });
    saveJSON(PENDING_PAYMENTS_FILE, pending);
}

function removePendingPayment(userId, orderId) {
    const pending = getPendingPayments();
    if (pending[userId]) {
        pending[userId] = pending[userId].filter(p => p.order_id !== orderId);
        if (pending[userId].length === 0) delete pending[userId];
        saveJSON(PENDING_PAYMENTS_FILE, pending);
    }
}

// ============================================
// TOP-UP SYSTEM FUNCTIONS
// ============================================

function getTopups() {
    return loadJSON(TOPUPS_FILE, []);
}

function addTopup(topup) {
    const topups = getTopups();
    topups.push(topup);
    saveJSON(TOPUPS_FILE, topups);
}

function updateTopup(topupId, updates) {
    const topups = getTopups();
    const topupIndex = topups.findIndex(t => t.topup_id === topupId);
    if (topupIndex !== -1) {
        topups[topupIndex] = { ...topups[topupIndex], ...updates };
        saveJSON(TOPUPS_FILE, topups);
        return topups[topupIndex];
    }
    return null;
}

function getPendingTopups() {
    const topups = getTopups();
    return topups.filter(t => t.status === 'pending');
}

function getUserTopups(userId) {
    const topups = getTopups();
    return topups.filter(t => t.user_id === userId);
}
// ============================================
// GIFT MESSAGE SYSTEM FUNCTIONS
// ============================================

function getGiftMessages() {
    return loadJSON(GIFT_MESSAGES_FILE, []);
}

function addGiftMessage(giftMessage) {
    const giftMessages = getGiftMessages();
    giftMessages.push(giftMessage);
    saveJSON(GIFT_MESSAGES_FILE, giftMessages);
}

function updateGiftMessage(giftId, updates) {
    const giftMessages = getGiftMessages();
    const giftIndex = giftMessages.findIndex(g => g.gift_id === giftId);
    if (giftIndex !== -1) {
        giftMessages[giftIndex] = { ...giftMessages[giftIndex], ...updates };
        saveJSON(GIFT_MESSAGES_FILE, giftMessages);
        return giftMessages[giftIndex];
    }
    return null;
}

function getActiveGiftMessages() {
    const giftMessages = getGiftMessages();
    return giftMessages.filter(g => g.active);
}

function canClaimGift(userId, giftId) {
    const giftMessages = getGiftMessages();
    const gift = giftMessages.find(g => g.gift_id === giftId);
    
    if (!gift || !gift.active) return { can_claim: false, reason: 'Gift not available' };
    
    if (gift.max_claims && gift.claimed_count >= gift.max_claims) {
        return { can_claim: false, reason: 'All gifts claimed' };
    }
    
    // Check one_claim_per_user setting
    if (gift.one_claim_per_user && gift.claimed_by && gift.claimed_by.includes(userId)) {
        return { can_claim: false, reason: 'Already claimed' };
    }
    
    if (gift.expires_at && new Date(gift.expires_at) < new Date()) {
        return { can_claim: false, reason: 'Gift expired' };
    }
    
    return { can_claim: true, gift: gift };
}

function recordGiftClaim(userId, giftId) {
    const giftMessages = getGiftMessages();
    const giftIndex = giftMessages.findIndex(g => g.gift_id === giftId);
    
    if (giftIndex !== -1) {
        if (!giftMessages[giftIndex].claimed_by) {
            giftMessages[giftIndex].claimed_by = [];
        }
        // Only add to claimed_by if one_claim_per_user is enabled
        if (giftMessages[giftIndex].one_claim_per_user) {
            giftMessages[giftIndex].claimed_by.push(userId);
        }
        giftMessages[giftIndex].claimed_count = (giftMessages[giftIndex].claimed_count || 0) + 1;
        saveJSON(GIFT_MESSAGES_FILE, giftMessages);
        return true;
    }
    return false;
}

function getNextGiftId() {
    const counter = getOrderCounter();
    counter.last_gift_id = (counter.last_gift_id || 0) + 1;
    saveJSON(COUNTER_FILE, counter);
    return counter.last_gift_id;
}

function toggleGiftOneClaimPerUser(giftId) {
    const giftMessages = getGiftMessages();
    const giftIndex = giftMessages.findIndex(g => g.gift_id === giftId);
    
    if (giftIndex !== -1) {
        giftMessages[giftIndex].one_claim_per_user = !giftMessages[giftIndex].one_claim_per_user;
        saveJSON(GIFT_MESSAGES_FILE, giftMessages);
        return giftMessages[giftIndex];
    }
    return null;
}
// ============================================
// DELIVERY & BROADCAST FUNCTIONS
// ============================================

async function deliverlinks(userId, orderId, quantity, bonusQuantity = 0) {
    try {
        // Validate inputs
        const totalQuantity = quantity + (bonusQuantity || 0);
        if (!userId || !orderId || !quantity) {
            throw new Error('Missing required parameters');
        }

        if (totalQuantity < 1) {
            throw new Error('Invalid quantity');
        }

        const stock = getStock();
        
        // Validate stock
        if (!stock || !stock.links || !Array.isArray(stock.links)) {
            throw new Error('Stock data is corrupted');
        }
        
        if (stock.links.length < totalQuantity) {
            bot.sendMessage(ADMIN_TELEGRAM_ID,
                `❌ *INSUFFICIENT STOCK!*\n\n` +
                `Order #${orderId} needs ${totalQuantity} links\n` +
                `Available: ${stock.links.length}\n\n` +
                `Please add more links!`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
            return false;
        }

        const linksToDeliver = stock.links.slice(0, totalQuantity);
        const remainingLinks = stock.links.slice(totalQuantity);

        updateStock(stock.current_stock - totalQuantity, remainingLinks);

        const bonusInfo = bonusQuantity > 0
            ? `🎁 Bonus: +${bonusQuantity} links\n📦 Total Delivered: ${totalQuantity} links`
            : '';

        if (totalQuantity <= ACCOUNT_MESSAGE_LIMIT) {
            await bot.sendMessage(userId,
                `✅ *LINKS DELIVERED!*\n\n` +
                `📋 Order #${orderId}\n` +
                `📦 Quantity: ${quantity} Links${bonusInfo ? `\n${bonusInfo}\n` : '\n'}` +
                `🎵 Here are your Spotify Links:\n` +
                `👇 *Tap each link to copy:*`,
                { parse_mode: 'Markdown' }
            );

            for (let i = 0; i < linksToDeliver.length; i++) {
                await bot.sendMessage(userId,
                    `\`${linksToDeliver[i]}\`\n\n` +
                    `📌 Account ${i + 1} of ${totalQuantity}\n` +
                    `👆 Tap link above to copy`,
                    { parse_mode: 'Markdown' }
                );

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            await bot.sendMessage(userId,
                `🎉 *ALL ${totalQuantity} Links DELIVERED!*\n\n` +
                `✅ Complete\n` +
                `📱 Contact ${ADMIN_USERNAME} for support\n\n` +
                `Thank you! 🙏`,
                { parse_mode: 'Markdown' }
            );
            
        } else {
            const fileContent = linksToDeliver.map(link => link).join('\n');
            
            const timestamp = Date.now();
            const filename = `spotify_links_order${orderId}_${timestamp}.txt`;
            const filePath = `./${filename}`;
            
            let fileCreated = false;
            
            const MAX_FILE_SIZE = 50 * 1024 * 1024;
            if (fileContent.length > MAX_FILE_SIZE) {
                throw new Error('File too large to deliver');
            }

            try {
                fs.writeFileSync(filePath, fileContent, 'utf8');
                fileCreated = true;
                
                const documentQuantityText = bonusQuantity > 0
                    ? `📦 ${quantity} paid + ${bonusQuantity} bonus (${totalQuantity} total) links\n\n`
                    : `📦 ${quantity} Spotify Premium Student links\n\n`;

                await bot.sendDocument(userId, filePath, {
                    caption:
                        `✅ *LINKS DELIVERED!*\n\n` +
                        `📋 Order #${orderId}\n` +
                        documentQuantityText +
                        `📄 All links in this file\n` +
                        `👆 *Open file and tap any link to copy*\n\n` +
                        `📱 Support: ${ADMIN_USERNAME}\n` +
                        `Thank you! 🎉`,
                    parse_mode: 'Markdown'
                });
            } finally {
                if (fileCreated && fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Cleaned up temp file: ${filename}`);
                    } catch (err) {
                        console.error(`⚠️ Failed to delete ${filename}:`, err.message);
                    }
                }
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('Error delivering links:', error.message);
        return false;
    }
}

async function deliverAccount(userId, orderId = 'N/A') {
    try {
        const accountStock = getAccountStock();

        if (!accountStock.accounts || accountStock.accounts.length === 0) {
            return { success: false, message: '❌ No accounts available to deliver!' };
        }

        const nextAccount = accountStock.accounts.shift();
        updateAccountStock(accountStock.accounts);

        const safeAccount = escapeMarkdown(nextAccount);

        const message =
            `✅ *ACCOUNT DELIVERED!*\n\n` +
            `📋 Order #: ${orderId}\n` +
            `💵 Price: Rp ${formatIDR(ACCOUNT_PRICE_IDR)} (no bulk)\n\n` +
            `🔑 Credentials:\n\`${safeAccount}\`\n\n` +
            `🌐 Access: generator.email / omanin\n` +
            `📱 Support: ${ADMIN_USERNAME}\n\n` +
            `Thank you! 🙏`;

        await bot.sendMessage(userId, message, { parse_mode: 'Markdown' });

        return { success: true, delivered: nextAccount };
    } catch (error) {
        console.error('Error delivering account:', error.message);
        return { success: false, message: '❌ Failed to deliver account.' };
    }
}

function broadcastToAll(message, options = {}) {
    const users = getUsers();
    const userIds = Object.keys(users).filter(id => parseInt(id) !== ADMIN_TELEGRAM_ID);
    
    let success = 0;
    let failed = 0;
    
    const promises = userIds.map(userId => {
        return bot.sendMessage(userId, message, options)
            .then(() => { success++; })
            .catch(() => { failed++; });
    });
    
    return Promise.all(promises).then(() => ({ success, failed, total: userIds.length }));
}

function broadcastNewCoupon(couponData) {
    const message =
        `🎉 *NEW COUPON AVAILABLE!*\n\n` +
        `🎟️ Code: *${couponData.code}*\n` +
        `💰 Discount: *${couponData.discount_percent}% OFF*\n` +
        `📦 Min Order: ${couponData.min_order} links\n` +
        `${couponData.first_order_only ? '⭐ First-time customers only\n' : ''}` +
        `${couponData.max_uses ? `🔢 Limited to ${couponData.max_uses} uses\n` : '🔢 Unlimited uses\n'}` +
        `${couponData.expires_at ? `⏰ Valid until: ${new Date(couponData.expires_at).toLocaleString('id-ID')}\n` : ''}` +
        `\n💡 Use this code when placing your order to get instant discount!\n\n` +
        `📱 Order now: /start`;

    return broadcastToAll(message, { parse_mode: 'Markdown' });
}

function broadcastAccountRestock(addedCount, totalCount) {
    const message = [
        '🎉 *VERIFIED ACCOUNTS RESTOCKED!*',
        `📤 Added: *${addedCount}* account${addedCount > 1 ? 's' : ''}`,
        `🔑 Total Stock: *${totalCount}* ready to claim`,
        '',
        `💵 Price: Rp ${formatIDR(ACCOUNT_PRICE_IDR)} (no bulk)`,
        '🌐 Access: generator.email / omanin',
        '',
        '⚡ Grab yours now before they sell out!'
    ].join('\n');

    return broadcastToAll(message, { parse_mode: 'Markdown' });
}

function broadcastRestock(quantity) {
    const pricing = getPricing();
    const pricingText = Object.keys(pricing).slice(0, 4).map(range =>
        `• ${range}: Rp ${formatIDR(pricing[range])}/account`
    ).join('\n');
    
    const coupons = getCoupons();
    const activeCoupons = Object.values(coupons).filter(c => c.active);
    const couponText = activeCoupons.length > 0 
        ? `🎟️ Active coupons: ${activeCoupons.map(c => c.code).join(', ')}\n` 
        : '';
    
    const message =
        `📦 *STOCK RESTOCKED!*\n\n` +
        `✅ *${quantity} Spotify PREMIUM STUDENT LINKS* now available!\n\n` +
        `💰 *Current Pricing:*\n` +
        `${pricingText}\n\n` +
        `${couponText}` +
        `🧮 Use calculator to check pricing!\n` +
        `⚡ Instant delivery after payment\n\n` +
        `Order now: /start`;
    
    return broadcastToAll(message, { parse_mode: 'Markdown' });
}

// ============================================
// ORDER CREATION FUNCTIONS
// ============================================

function createOrder(chatId, userId, user, quantity, coupon) {
    try {
        const originalPrice = calculatePrice(quantity);
        let totalPrice = originalPrice;
        let discountPercent = 0;
        let couponCode = null;
        const activeBonus = getActiveBonus(quantity);
        const bonusQuantity = activeBonus ? activeBonus.bonus_quantity : 0;
        const totalQuantity = quantity + bonusQuantity;

        if (coupon) {
            discountPercent = coupon.discount_percent;
            totalPrice = Math.floor(originalPrice * (1 - discountPercent / 100));
            couponCode = coupon.code;
            applyCoupon(couponCode, userId);
        }

        const orderId = getNextOrderId();
        const users = getUsers();

        const order = {
            order_id: orderId,
            user_id: userId,
            username: users[userId]?.username || user.username || 'unknown',
            quantity: quantity,
            bonus_quantity: bonusQuantity,
            total_quantity: totalQuantity,
            bonus_description: activeBonus ? activeBonus.description : null,
            original_price: originalPrice,
            total_price: totalPrice,
            discount_percent: discountPercent,
            coupon_code: couponCode,
            status: 'awaiting_payment',
            payment_method: 'manual',
            date: new Date().toISOString()
        };
        
        addOrder(order);
        delete userStates[chatId];
        
        users[userId].total_orders = (users[userId].total_orders || 0) + 1;
        saveJSON(USERS_FILE, users);
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                [{ text: '📝 My Orders', callback_data: 'my_orders' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };
        
        let orderMessage = `✅ *ORDER CREATED!*\n\n` +
            `📋 Order ID: *#${orderId}*\n` +
            `📦 Quantity: ${quantity} links\n` +
            `${activeBonus ? `🎁 Bonus: +${bonusQuantity} links (${escapeMarkdown(activeBonus.description)})\n📦 Total Delivered: ${totalQuantity} links\n` : ''}` +
            `💵 Price per account: Rp ${formatIDR(getPricePerUnit(quantity))}\n`;
        
        if (coupon) {
            orderMessage += `\n🎟️ Coupon Applied: *${couponCode}*\n` +
                `💰 Original Price: Rp ${formatIDR(originalPrice)}\n` +
                `🎁 Discount: ${discountPercent}% OFF\n` +
                `💳 Final Price: *Rp ${formatIDR(totalPrice)}*\n` +
                `💸 You saved: Rp ${formatIDR(originalPrice - totalPrice)}!\n`;
        } else {
            orderMessage += `💰 Total: *Rp ${formatIDR(totalPrice)}*\n`;
        }
        
        orderMessage += `\n📱 Status: Awaiting Payment\n` +
            `⏰ Expires in: ${ORDER_EXPIRY_MINUTES} minutes\n\n`;
        
        const gopay = getQRIS();
        if (gopay.file_id) {
            bot.sendPhoto(chatId, gopay.file_id, {
                caption: 
                    `📱 *PAYMENT METHOD - GOPAY*\n\n` +
                    `Scan this QR code to pay\n` +
                    `💰 Amount: *Rp ${formatIDR(totalPrice)}*\n\n` +
                    `After payment, send screenshot with:\n` +
                    `Caption: #${orderId}\n\n` +
                    `⏰ Order expires in ${ORDER_EXPIRY_MINUTES} minutes`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📱 DM Admin @itsmeaab', url: 'https://t.me/itsmeaab' }]
                    ]
                }
            }).catch(() => {});
        } else {
            bot.sendMessage(chatId,
                `📱 *PAYMENT INSTRUCTIONS*\n\n` +
                `💰 Amount: *Rp ${formatIDR(totalPrice)}*\n\n` +
                `Contact admin for payment details:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 DM Admin @itsmeaab', url: 'https://t.me/itsmeaab' }]
                        ]
                    }
                }
            ).catch(() => {});
        }
        
        orderMessage += `💡 Send payment proof photo with caption: #${orderId}\n` +
            `Or contact ${ADMIN_USERNAME} for payment details`;
        
        bot.sendMessage(chatId, orderMessage, { 
            parse_mode: 'Markdown', 
            reply_markup: keyboard 
        }).catch(() => {});
        
        let adminMessage = `📝 *NEW ORDER*\n\n` +
            `Order ID: #${orderId}\n` +
            `Customer: @${escapeMarkdown(users[userId]?.username || 'unknown')}\n` +
            `User ID: ${userId}\n` +
            `Quantity: ${quantity} links${activeBonus ? ` (+${bonusQuantity} bonus = ${totalQuantity})` : ''}\n`;
        
        if (coupon) {
            adminMessage += `\n🎟️ Coupon: ${couponCode} (-${discountPercent}%)\n` +
                `Original: Rp ${formatIDR(originalPrice)}\n` +
                `Discount: Rp ${formatIDR(originalPrice - totalPrice)}\n`;
        }
        
        adminMessage += `💰 Total: Rp ${formatIDR(totalPrice)}\n` +
            `Status: Awaiting Payment\n\n` +
            `💡 Waiting for payment proof...`;
        
        bot.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, { parse_mode: 'Markdown' }).catch(() => {});
        
    } catch (error) {
        console.error('Error in createOrder:', error.message);
        bot.sendMessage(chatId, '❌ Error creating order. Please try again.').catch(() => {});
    }
}

function processBalanceOrder(chatId, userId, user, quantity, coupon) {
    try {
        const originalPrice = calculatePrice(quantity);
        let totalPrice = originalPrice;
        let discountPercent = 0;
        let couponCode = null;
        const activeBonus = getActiveBonus(quantity);
        const bonusQuantity = activeBonus ? activeBonus.bonus_quantity : 0;
        const totalQuantity = quantity + bonusQuantity;

        if (coupon) {
            discountPercent = coupon.discount_percent;
            totalPrice = Math.floor(originalPrice * (1 - discountPercent / 100));
            couponCode = coupon.code;
            applyCoupon(couponCode, userId);
        }
        
        const balance = getBalance(userId);
        
        if (totalPrice > balance) {
            bot.sendMessage(chatId, 
                `❌ Insufficient balance after discount!\n\n` +
                `Need: Rp ${formatIDR(totalPrice)}\n` +
                `Balance: Rp ${formatIDR(balance)}`
            ).catch(() => {});
            delete userStates[chatId];
            return;
        }
        
        updateBalance(userId, -totalPrice);
        
        const orderId = getNextOrderId();
        const users = getUsers();
        
        const order = {
            order_id: orderId,
            user_id: userId,
            username: users[userId]?.username || user.username || 'unknown',
            quantity: quantity,
            bonus_quantity: bonusQuantity,
            total_quantity: totalQuantity,
            bonus_description: activeBonus ? activeBonus.description : null,
            original_price: originalPrice,
            total_price: totalPrice,
            discount_percent: discountPercent,
            coupon_code: couponCode,
            status: 'completed',
            payment_method: 'balance',
            date: new Date().toISOString(),
            completed_at: new Date().toISOString()
        };
        
        addOrder(order);
        
        users[userId].total_orders = (users[userId].total_orders || 0) + 1;
        users[userId].completed_orders = (users[userId].completed_orders || 0) + 1;
        saveJSON(USERS_FILE, users);
        
        delete userStates[chatId];
        
        const newBalance = getBalance(userId);
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                [{ text: '📝 My Orders', callback_data: 'my_orders' }],
                [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
            ]
        };
        
        let orderMessage = `✅ *ORDER COMPLETED INSTANTLY!*\n\n` +
            `📋 Order ID: *#${orderId}*\n` +
            `📦 Quantity: ${quantity} links\n` +
            `${activeBonus ? `🎁 Bonus: +${bonusQuantity} links (${escapeMarkdown(activeBonus.description)})\n📦 Total Delivered: ${totalQuantity} links\n` : ''}` +
            `💵 Price per account: Rp ${formatIDR(getPricePerUnit(quantity))}\n`;
        
        if (coupon) {
            orderMessage += `\n🎟️ Coupon Applied: *${couponCode}*\n` +
                `💰 Original: Rp ${formatIDR(originalPrice)}\n` +
                `🎁 Discount: ${discountPercent}% OFF\n` +
                `💳 Paid: *Rp ${formatIDR(totalPrice)}*\n` +
                `💸 Saved: Rp ${formatIDR(originalPrice - totalPrice)}!\n`;
        } else {
            orderMessage += `💰 Total Paid: *Rp ${formatIDR(totalPrice)}*\n`;
        }
        
        orderMessage += `\n💳 Balance Deducted: Rp ${formatIDR(totalPrice)}\n` +
            `💰 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
            `🎵 Delivering your ${totalQuantity} links now...\n\n` +
            `Please wait...`;
        
        bot.sendMessage(chatId, orderMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }).then(() => {
            deliverlinks(userId, orderId, quantity, bonusQuantity);
        }).catch(() => {});
        
        let adminMessage = `✅ *INSTANT BALANCE ORDER*\n\n` +
            `Order ID: #${orderId}\n` +
            `Customer: @${escapeMarkdown(users[userId]?.username || 'unknown')}\n` +
            `User ID: ${userId}\n` +
            `Quantity: ${quantity} links${activeBonus ? ` (+${bonusQuantity} bonus = ${totalQuantity})` : ''}\n`;
        
        if (coupon) {
            adminMessage += `\n🎟️ Coupon: ${couponCode} (-${discountPercent}%)\n` +
                `Original: Rp ${formatIDR(originalPrice)}\n` +
                `Discount: Rp ${formatIDR(originalPrice - totalPrice)}\n`;
        }
        
        adminMessage += `💰 Paid: Rp ${formatIDR(totalPrice)}\n` +
            `Status: ✅ COMPLETED\n` +
            `Payment: Balance (Auto)\n\n` +
            `👉 links being delivered automatically!`;
        
        bot.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, { parse_mode: 'Markdown' }).catch(() => {});
        
    } catch (error) {
        console.error('Error in processBalanceOrder:', error.message);
    }
}

// ============================================
// INITIALIZE BOT
// ============================================

let bot;
let botReady = false;

function initializeBot() {
    try {
        if (!BOT_TOKEN || BOT_TOKEN.length < 20) {
            throw new Error('Invalid BOT_TOKEN');
        }

        bot = new TelegramBot(BOT_TOKEN, { 
            polling: {
                interval: 2000,
                autoStart: false,
                params: {
                    timeout: 60,
                    allowed_updates: ['message', 'callback_query'],
                    limit: 100
                }
            },
            request: {
                agentOptions: {
                    keepAlive: true,
                    keepAliveMsecs: 30000
                }
            }
        });

        bot.on('polling_start', () => {
            botReady = true;
            console.log('✅ Bot polling started successfully');
        });

        bot.on('polling_error', handlePollingError);
        bot.on('error', handleBotError);

        startPollingWithRetry();

        console.log('🤖 Bot initialization complete');
    } catch (error) {
        console.error('❌ Bot initialization failed:', error.message);
        setTimeout(initializeBot, 5000);
    }
}

let errorCount = 0;
const MAX_ERROR_COUNT = 5;
let lastErrorTime = Date.now();

function handlePollingError(error) {
    const now = Date.now();
    
    if (now - lastErrorTime > 120000) {
        errorCount = 0;
    }
    
    lastErrorTime = now;
    errorCount++;

    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || 'UNKNOWN';

    console.error(`⚠️ Polling error (${errorCount}/${MAX_ERROR_COUNT}):`, errorCode, errorMsg);

    if (errorCount >= MAX_ERROR_COUNT) {
        console.error('❌ Too many errors! Restarting...');
        errorCount = 0;
        
        try {
            if (bot && bot.isPolling()) {
                bot.stopPolling().catch(() => {});
            }
            
            setTimeout(() => {
                startPollingWithRetry();
            }, 5000);
        } catch (e) {
            console.error('Error during restart:', e.message);
            setTimeout(initializeBot, 10000);
        }
    }
}

function handleBotError(error) {
    const errorMsg = error?.message || String(error);
    console.error('⚠️ Bot error:', errorMsg);
    
    if (errorMsg.includes('EFATAL') || errorMsg.includes('ENOTFOUND')) {
        console.error('❌ Critical error! Attempting recovery...');
        
        try {
            if (bot && bot.isPolling()) {
                bot.stopPolling().catch(() => {});
            }
        } catch (e) {
            console.error('Error stopping polling:', e.message);
        }
        
        setTimeout(() => {
            console.log('🔄 Reinitializing bot...');
            botReady = false;
            initializeBot();
        }, 8000);
    }
}

function startPollingWithRetry(retryCount = 0) {
    const maxRetries = 3;
    
    if (retryCount > maxRetries) {
        console.error('❌ Failed to start polling');
        setTimeout(() => initializeBot(), 15000);
        return;
    }
    
    try {
        if (!bot) {
            console.error('❌ Bot not initialized');
            return;
        }

        bot.startPolling({
            allowed_updates: ['message', 'callback_query'],
            interval: 2000,
            timeout: 60
        }).then(() => {
            console.log('✅ Polling started');
            botReady = true;
        }).catch(err => {
            console.error(`❌ Polling failed (${retryCount + 1}/${maxRetries + 1}):`, err.message);
            setTimeout(() => {
                startPollingWithRetry(retryCount + 1);
            }, 3000 * (retryCount + 1));
        });
    } catch (err) {
        console.error('Exception during polling:', err.message);
        setTimeout(() => {
            startPollingWithRetry(retryCount + 1);
        }, 3000 * (retryCount + 1));
    }
}

initializeBot();

process.on('SIGINT', () => {
    console.log('\n⏹️ Shutting down...');
    if (bot) {
        bot.stopPolling().then(() => {
            console.log('✅ Bot stopped');
            process.exit(0);
        }).catch(() => {
            process.exit(1);
        });
    } else {
        process.exit(0);
    }
});

// Order expiry checker
setInterval(() => {
    if (!bot || !botReady) return;
    
    try {
        const orders = getOrders();
        const now = new Date();
        
        orders.forEach(order => {
            if (order.status === 'awaiting_payment') {
                const orderDate = new Date(order.date);
                const diffMinutes = (now - orderDate) / 1000 / 60;
                
                if (diffMinutes >= ORDER_EXPIRY_MINUTES) {
                    updateOrder(order.order_id, {
                        status: 'expired',
                        expired_at: new Date().toISOString()
                    });
                    
                    bot.sendMessage(order.user_id,
                        `⏰ *ORDER EXPIRED*\n\n` +
                        `Order ID: #${order.order_id}\n` +
                        `Your order expired after ${ORDER_EXPIRY_MINUTES} minutes.\n\n` +
                        `Contact ${ADMIN_USERNAME} if you still want to order.`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                    
                    bot.sendMessage(ADMIN_TELEGRAM_ID,
                        `⏰ *ORDER EXPIRED*\n\n` +
                        `Order #${order.order_id}\n` +
                        `User: @${escapeMarkdown(order.username)}\n` +
                        `Total: Rp ${formatIDR(order.total_price)}`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }
            }
        });
    } catch (error) {
        console.error('Error checking expired orders:', error.message);
    }
}, 5 * 60 * 1000);

// ============================================
// COMMANDS (Only /start for users)
// ============================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userId = user.id;
    
    if (isRateLimited(userId)) {
        return;
    }
    
    try {
        const isNewUser = addUser(userId, user);
        
        if (isAdmin(userId)) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📊 Statistics', callback_data: 'admin_stats' },
                        { text: '📝 Orders', callback_data: 'admin_orders' }
                    ],
                    [
                        { text: '👥 Users', callback_data: 'admin_users' },
                        { text: '💰 Revenue', callback_data: 'admin_revenue' }
                    ],
                    [
                        { text: '📈 Analytics', callback_data: 'admin_analytics' },
                        { text: '📦 Stock', callback_data: 'admin_stock' }
                    ],
                    [
                        { text: '🔑 Accounts', callback_data: 'admin_accounts' },
                        { text: '💵 Pricing', callback_data: 'admin_pricing' },
                        { text: '🎟️ Coupons', callback_data: 'admin_coupons' }
                    ],
                    [
                        { text: '📱 GoPay', callback_data: 'admin_qris' },
                        { text: '🛒 Custom Order', callback_data: 'admin_custom_order' }
                    ],
                    [
                        { text: '📋 Pending Top-ups', callback_data: 'admin_pending_topups' },
                        { text: '💰 Add Balance', callback_data: 'admin_add_balance' }
                    ],
                    [
                        { text: '🎁 Create Gift', callback_data: 'admin_create_gift' },
                        { text: '📋 View Gifts', callback_data: 'admin_view_gifts' }
                    ],
                    [{ text: '📥 Get Test Links', callback_data: 'admin_get_links' }],
                    [
                        { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
                    ]
                ]
            };
            
            const users = getUsers();
            const orders = getOrders();
            const stock = getStock();
            const accountStock = getAccountStock();
            const pendingTopups = getPendingTopups();
            
            bot.sendMessage(chatId, 
                `🔐 *ADMIN PANEL*\n\n` +
                `Welcome ${escapeMarkdown(user.first_name)}!\n\n` +
                `📊 Quick Stats:\n` +
                `• Users: ${Object.keys(users).length}\n` +
                `• Orders: ${orders.length}\n` +
                `• Stock: ${stock.current_stock}\n` +
                `• Links: ${stock.links.length}\n` +
                `• Accounts: ${accountStock.accounts?.length || 0}\n` +
                `• Pending Top-ups: ${pendingTopups.length}\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
            return;
        }
        
        const balance = getBalance(userId);
        const stock = getStock();
        const pricing = getPricing();
        const pricingText = Object.keys(pricing).slice(0, 3).map(range =>
            `• ${range}: Rp ${formatIDR(pricing[range])}`
        ).join('\n');
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '🎵 Order Spotify', callback_data: 'order' }],
                [{ text: '🔑 Buy Account (Rp 650)', callback_data: 'buy_account' }],
                [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                [{ text: '💵 Top Up Balance', callback_data: 'topup_balance' }],
                [{ text: '🧮 Price Calculator', callback_data: 'open_calculator' }],
                [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                [{ text: '📦 Stock', callback_data: 'check_stock' }],
                [{ text: '📝 My Orders', callback_data: 'my_orders' }],
                [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }],
            ]
        };
        
        bot.sendMessage(chatId,
            `🎉 *Welcome to Spotify Store!*\n\n` +
            `Hi ${escapeMarkdown(user.first_name)}! 👋\n\n` +
            `🎵 Spotify Student PREMIUM\n` +
            `🔑 Verified Account: Rp ${formatIDR(ACCOUNT_PRICE_IDR)} (balance only)\n` +
            `💳 Balance: Rp ${formatIDR(balance)}\n` +
            `📦 Stock: ${stock.current_stock} links\n\n` +
            `💰 *Pricing:*\n` +
            `${pricingText}\n\n` +
            `🎁 Daily bonus available!\n` +
            `💵 Top up balance easily!\n` +
            `🧮 Use calculator for pricing\n` +
            `🎟️ Use code AAB for 10% off!\n\n` +
            `📱 Admin: ${ADMIN_USERNAME}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
        ).catch(() => {});
        
        if (isNewUser) {
            bot.sendMessage(ADMIN_TELEGRAM_ID,
                `🆕 *NEW USER*\n\n` +
                `${escapeMarkdown(user.first_name)} (@${escapeMarkdown(user.username || 'no_username')})\n` +
                `ID: ${user.id}\n\n` +
                `Total users: ${Object.keys(getUsers()).length}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
    } catch (error) {
        console.error('Error in /start:', error.message);
        bot.sendMessage(chatId, '❌ An error occurred. Please try again.').catch(() => {});
    }
});

// ============================================
// PHOTO HANDLER (Payment Receipts, GoPay Upload & Top-up Proofs)
// ============================================

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const photo = msg.photo[msg.photo.length - 1];
    const caption = msg.caption || '';
    
    try {
        const state = userStates[chatId];
        
        // GoPay image upload handler
        if (state && state.state === 'awaiting_qris_image' && isAdmin(userId)) {
            setQRIS(photo.file_id);
            delete userStates[chatId];
            
            bot.sendMessage(chatId,
                `✅ *GOPAY IMAGE UPDATED!*\n\n` +
                `📱 New GoPay QR image saved successfully!\n\n` +
                `💡 Customers will now see this when ordering or topping up.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
            return;
        }
        
        // Broadcast photo handler
        if (state && state.state === 'awaiting_broadcast' && isAdmin(userId)) {
            const users = getUsers();
            const userIds = Object.keys(users).filter(id => parseInt(id) !== ADMIN_TELEGRAM_ID);
            
            if (userIds.length === 0) {
                bot.sendMessage(chatId, '❌ No users to broadcast!').catch(() => {});
                delete userStates[chatId];
                return;
            }
            
            let success = 0;
            let failed = 0;
            
            bot.sendMessage(chatId, `📤 Broadcasting to ${userIds.length} users...`).then(statusMsg => {
                const promises = userIds.map(uId => {
                    return bot.sendPhoto(uId, photo.file_id, { caption: caption, parse_mode: 'Markdown' })
                        .then(() => { success++; })
                        .catch(() => {
                            return bot.sendPhoto(uId, photo.file_id, { caption: caption })
                                .then(() => { success++; })
                                .catch(() => { failed++; });
                        });
                });
                
                Promise.all(promises).then(() => {
                    bot.editMessageText(
                        `✅ *Broadcast Complete!*\n\n` +
                        `✅ Success: ${success}\n` +
                        `❌ Failed: ${failed}\n` +
                        `📊 Total: ${userIds.length}`,
                        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                    ).catch(() => {});
                    delete userStates[chatId];
                });
            }).catch(() => {});
            return;
        }
        
        // Check if it's a top-up payment proof
        if (caption.toUpperCase().includes('#TOPUP')) {
            const topups = getTopups();
            const userPendingTopups = topups.filter(t => 
                t.user_id === userId && 
                t.status === 'pending' &&
                !t.payment_receipt
            ).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (userPendingTopups.length === 0) {
                bot.sendMessage(chatId,
                    `❌ *No pending top-up found!*\n\n` +
                    `Please create a top-up request first.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
                return;
            }
            
            const topup = userPendingTopups[0];
            updateTopup(topup.topup_id, {
                payment_receipt: photo.file_id,
                receipt_uploaded_at: new Date().toISOString()
            });
            
            bot.sendMessage(chatId,
                `✅ *PAYMENT PROOF RECEIVED!*\n\n` +
                `💵 Top-up ID: #T${topup.topup_id}\n` +
                `💰 Amount: Rp ${formatIDR(topup.amount)}\n\n` +
                `⏳ Your payment is being verified by admin...\n\n` +
                `📱 You'll receive balance once verified!\n\n` +
                `⏰ Uploaded: ${getCurrentDateTime()}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve Top-up', callback_data: `approve_topup_${topup.topup_id}` }
                    ],
                    [
                        { text: '❌ Reject Top-up', callback_data: `reject_topup_${topup.topup_id}` }
                    ]
                ]
            };
            
            const users = getUsers();
            const username = users[userId]?.username || 'unknown';
            
            bot.sendPhoto(ADMIN_TELEGRAM_ID, photo.file_id, {
                caption:
                    `💳 *TOP-UP PAYMENT PROOF*\n\n` +
                    `💵 Top-up ID: #T${topup.topup_id}\n` +
                    `👤 Customer: @${escapeMarkdown(username)}\n` +
                    `🆔 User ID: ${userId}\n\n` +
                    `💰 Amount: Rp ${formatIDR(topup.amount)}\n` +
                    `📝 Type: ${topup.topup_type === 'user_request' ? 'User Request' : 'Admin Credit'}\n` +
                    `\n⏰ Uploaded: ${getCurrentDateTime()}\n\n` +
                    `👇 Click button to verify or reject:`,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }).catch(() => {});
            
            return;
        }
        
        // Order payment proof handler
        let orderId = null;
        const orderIdMatch = caption.match(/#(\d+)/);
        if (orderIdMatch) {
            orderId = parseInt(orderIdMatch[1]);
        } else {
            const orders = getOrders();
            const userOrders = orders.filter(o => 
                o.user_id === userId && 
                o.status === 'awaiting_payment'
            ).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (userOrders.length > 0) {
                orderId = userOrders[0].order_id;
            }
        }
        
        if (!orderId) {
            bot.sendMessage(chatId,
                `❌ *No pending order found!*\n\n` +
                `Please include your Order ID in the caption:\n` +
                `Example: #123\n\n` +
                `For top-up payment, use: #TOPUP\n\n` +
                `Or create a new order first.`,
                { parse_mode:                 'Markdown' }
            ).catch(() => {});
            return;
        }
        
        const orders = getOrders();
        const order = orders.find(o => o.order_id === orderId && o.user_id === userId);
        
        if (!order) {
            bot.sendMessage(chatId,
                `❌ *Order #${orderId} not found!*\n\n` +
                `Please check your order ID.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
            return;
        }
        
        if (order.status !== 'awaiting_payment') {
            bot.sendMessage(chatId,
                `❌ *Order #${orderId} is ${order.status}!*\n\n` +
                `This order cannot accept payment proof.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
            return;
        }
        
        updateOrder(orderId, {
            payment_receipt: photo.file_id,
            receipt_uploaded_at: new Date().toISOString()
        });
        
        addPendingPayment(userId, orderId, photo.file_id);
        
        bot.sendMessage(chatId,
            `✅ *PAYMENT RECEIPT RECEIVED!*\n\n` +
            `📋 Order ID: #${orderId}\n` +
            `💰 Amount: Rp ${formatIDR(order.total_price)}\n\n` +
            `⏳ Your payment is being verified by admin...\n\n` +
            `📱 You'll receive your links once verified!\n\n` +
            `⏰ Uploaded: ${getCurrentDateTime()}`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Verify & Send links', callback_data: `verify_payment_${orderId}` }
                ],
                [
                    { text: '❌ Reject Payment', callback_data: `reject_payment_${orderId}` }
                ]
            ]
        };
        
        const users = getUsers();
        const username = users[userId]?.username || 'unknown';
        
        bot.sendPhoto(ADMIN_TELEGRAM_ID, photo.file_id, {
            caption:
                `💳 *ORDER PAYMENT RECEIPT*\n\n` +
                `📋 Order ID: #${orderId}\n` +
                `👤 Customer: @${escapeMarkdown(username)}\n` +
                `🆔 User ID: ${userId}\n\n` +
                `📦 Quantity: ${formatOrderQuantitySummary(order)}\n` +
                `💰 Total: Rp ${formatIDR(order.total_price)}\n` +
                `💵 Price/Unit: Rp ${formatIDR(getPricePerUnit(order.quantity))}\n` +
                `${order.coupon_code ? `🎟️ Coupon: ${order.coupon_code} (-${order.discount_percent}%)\n` : ''}` +
                `\n⏰ Uploaded: ${getCurrentDateTime()}\n\n` +
                `👇 Click button to verify or reject:`,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }).catch(() => {});
        
    } catch (error) {
        console.error('Error handling photo:', error.message);
    }
});

// ============================================
// DOCUMENT HANDLER (Stock Upload with Auto-Broadcast)
// ============================================

bot.on('document', (msg) => {
    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!isAdmin(userId)) return;

        const state = userStates[chatId];
        const uploadMode = state?.state;
        const isAccountUpload = uploadMode === 'awaiting_account_upload';
        const isLinkUpload = uploadMode === 'awaiting_stock_upload' || !uploadMode;

        if (!isAccountUpload && !isLinkUpload) return;

        const document = msg.document;
        
        if (!document.file_name.endsWith('.txt')) {
            bot.sendMessage(chatId, '❌ Send .txt file only!').catch(() => {});
            return;
        }
        
        const uploadingText = isAccountUpload ? '⏳ Uploading accounts...' : '⏳ Uploading links...';

        bot.sendMessage(chatId, uploadingText).then(statusMsg => {
            bot.getFile(document.file_id).then(file => {
                const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
                
                const https = require('https');
                https.get(fileUrl, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        if (isAccountUpload) {
                            if (lines.length === 0) {
                                bot.editMessageText(
                                    '❌ No valid accounts found! Add one credential per line.',
                                    { chat_id: chatId, message_id: statusMsg.message_id }
                                ).catch(() => {});
                                delete userStates[chatId];
                                return;
                            }

                            const accountStock = getAccountStock();
                            const merged = [...(accountStock.accounts || []), ...lines];
                            updateAccountStock(merged);

                            bot.editMessageText(
                                `✅ *ACCOUNTS UPLOADED!*\n\n` +
                                `📤 Added: ${lines.length} accounts\n` +
                                `🔑 Total Accounts: ${merged.length}\n\n` +
                                `Thank you!`,
                                {
                                    chat_id: chatId,
                                    message_id: statusMsg.message_id,
                                    parse_mode: 'Markdown'
                                }
                            ).catch(() => {});

                            delete userStates[chatId];
                            return;
                        }

                        const links = lines.filter(l => l.startsWith('http'));

                        if (links.length === 0) {
                            bot.editMessageText(
                                '❌ No valid links found!\n\nLinks must start with http',
                                { chat_id: chatId, message_id: statusMsg.message_id }
                            ).catch(() => {});
                            delete userStates[chatId];
                            return;
                        }

                        const stock = getStock();

                        links.forEach(link => stock.links.push(link));

                        const newCount = stock.links.length;
                        const newStock = stock.current_stock + links.length;
                        const stockAdded = links.length;

                        updateStock(newStock, stock.links);

                        bot.editMessageText(
                            `✅ *UPLOAD SUCCESS!*\n\n` +
                            `📤 Added: ${links.length} links\n` +
                            `🔗 Total Links: ${newCount}\n` +
                            `📊 Display Stock: ${newStock}\n\n` +
                            `${stockAdded >= AUTO_BROADCAST_MIN_STOCK ? `📢 Auto-broadcasting to all users...\n\n` : ''}` +
                            `✅ Complete!`,
                            {
                                chat_id: chatId,
                                message_id: statusMsg.message_id,
                                parse_mode: 'Markdown'
                            }
                        ).catch(() => {});

                        delete userStates[chatId];
                    });
                }).on('error', (err) => {
                    console.error('Download error:', err.message);
                    bot.editMessageText(
                        '❌ Failed to download file!',
                        { chat_id: chatId, message_id: statusMsg.message_id }
                    ).catch(() => {});
                });
            }).catch(err => {
                console.error('Get file error:', err.message);
                bot.editMessageText(
                    '❌ Failed to process file!',
                    { chat_id: chatId, message_id: statusMsg.message_id }
                ).catch(() => {});
            });
        }).catch(() => {});
    } catch (error) {
        console.error('Error in document handler:', error.message);
    }
});

// ============================================
// CALLBACK QUERY HANDLER - ALL BUTTONS (PART 1)
// ============================================

bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const userId = query.from.id;
        
        bot.answerCallbackQuery(query.id).catch(() => {});
        
        // ===== TOP-UP APPROVAL/REJECTION BUTTONS =====
        if (data.startsWith('approve_topup_')) {
            if (!isAdmin(userId)) return;
            
            const topupId = parseInt(data.replace('approve_topup_', ''));
            const topups = getTopups();
            const topup = topups.find(t => t.topup_id === topupId);
            
            if (!topup) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Top-up not found!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            if (topup.status !== 'pending') {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Top-up already processed!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            // Credit balance
            const newBalance = updateBalance(topup.user_id, topup.amount);
            
            // Update topup status
            updateTopup(topupId, {
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: userId
            });
            
            // Update user stats
            const users = getUsers();
            if (users[topup.user_id]) {
                users[topup.user_id].total_topups = (users[topup.user_id].total_topups || 0) + 1;
                saveJSON(USERS_FILE, users);
            }
            
            // Notify user
            bot.sendMessage(topup.user_id,
                `✅ *TOP-UP APPROVED!*\n\n` +
                `💵 Top-up ID: #T${topupId}\n` +
                `💰 Amount: Rp ${formatIDR(topup.amount)}\n` +
                `💳 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
                `✅ Balance credited successfully!\n` +
                `You can now use it to buy Spotify links!\n\n` +
                `⏰ ${getCurrentDateTime()}`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                            [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                        ]
                    }
                }
            ).catch(() => {});
            
            // Update admin message
            bot.editMessageCaption(
                `✅ *TOP-UP APPROVED!*\n\n` +
                `💵 Top-up ID: #T${topupId}\n` +
                `👤 @${escapeMarkdown(topup.username)}\n` +
                `💰 Amount: Rp ${formatIDR(topup.amount)}\n` +
                `💳 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
                `✅ Approved by admin\n` +
                `⏰ ${getCurrentDateTime()}`,
                { 
                    chat_id: chatId, 
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            ).catch(() => {});
        }
        
        else if (data.startsWith('reject_topup_')) {
            if (!isAdmin(userId)) return;
            
            const topupId = parseInt(data.replace('reject_topup_', ''));
            const topup = updateTopup(topupId, {
                status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: userId
            });
            
            if (topup) {
                // Notify user
                bot.sendMessage(topup.user_id,
                    `❌ *TOP-UP REJECTED*\n\n` +
                    `💵 Top-up ID: #T${topupId}\n` +
                    `💰 Amount: Rp ${formatIDR(topup.amount)}\n\n` +
                    `Your top-up request was rejected.\n` +
                    `Contact ${ADMIN_USERNAME} for help.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
                
                // Update admin message
                bot.editMessageCaption(
                    `❌ *TOP-UP REJECTED*\n\n` +
                    `💵 Top-up ID: #T${topupId}\n` +
                    `👤 @${escapeMarkdown(topup.username)}\n` +
                    `💰 Amount: Rp ${formatIDR(topup.amount)}\n\n` +
                    `❌ Rejected by admin\n` +
                    `⏰ ${getCurrentDateTime()}`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                ).catch(() => {});
            }
        }
        
        // ===== PAYMENT VERIFICATION BUTTONS =====
        else if (data.startsWith('verify_payment_')) {
            if (!isAdmin(userId)) return;
            
            const orderId = parseInt(data.replace('verify_payment_', ''));
            const orders = getOrders();
            const order = orders.find(o => o.order_id === orderId);
            
            if (!order) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Order not found!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            const deliveryQuantity = getOrderTotalQuantity(order);
            const bonusNote = order.bonus_quantity ? ` (includes +${order.bonus_quantity} bonus)` : '';

            bot.editMessageCaption(
                `⏳ *PROCESSING PAYMENT...*\n\n` +
                `Order #${orderId}\n` +
                `Delivering ${deliveryQuantity} links${bonusNote}...`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            ).catch(() => {});
            
            const delivered = await deliverlinks(order.user_id, orderId, order.quantity, order.bonus_quantity || 0);
            
            if (delivered) {
                updateOrder(orderId, {
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    verified_by: userId
                });
                
                const users = getUsers();
                if (users[order.user_id]) {
                    users[order.user_id].completed_orders = (users[order.user_id].completed_orders || 0) + 1;
                    saveJSON(USERS_FILE, users);
                }
                
                removePendingPayment(order.user_id, orderId);
                
                bot.editMessageCaption(
                    `✅ *VERIFIED & DELIVERED!*\n\n` +
                    `📋 Order #${orderId}\n` +
                    `👤 @${escapeMarkdown(order.username)}\n` +
                    `📦 ${formatOrderQuantitySummary(order)}\n` +
                    `💰 Rp ${formatIDR(order.total_price)}\n\n` +
                    `✅ links sent!\n` +
                    `⏰ ${getCurrentDateTime()}`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                ).catch(() => {});
            } else {
                bot.editMessageCaption(
                    `❌ *INSUFFICIENT STOCK!*\n\n` +
                    `Order #${orderId}\n` +
                    `Need: ${deliveryQuantity}\n` +
                    `Available: ${getStock().links.length}\n\n` +
                    `Add more links!`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                ).catch(() => {});
            }
        }
        
        else if (data.startsWith('reject_payment_')) {
            if (!isAdmin(userId)) return;
            
            const orderId = parseInt(data.replace('reject_payment_', ''));
            const order = updateOrder(orderId, {
                status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: userId
            });
            
            if (order) {
                if (order.payment_method === 'balance') {
                    updateBalance(order.user_id, order.total_price);
                }
                
                removePendingPayment(order.user_id, orderId);
                
                bot.sendMessage(order.user_id,
                    `❌ *PAYMENT REJECTED*\n\n` +
                    `Order #${orderId}\n` +
                    `${order.payment_method === 'balance' ? `Refunded: Rp ${formatIDR(order.total_price)}\n\n` : ''}` +
                    `Contact ${ADMIN_USERNAME} for help.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
                
                bot.editMessageCaption(
                    `❌ *PAYMENT REJECTED*\n\n` +
                    `Order #${orderId} - Rejected\n` +
                    `⏰ ${getCurrentDateTime()}`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                ).catch(() => {});
            }
        }
        
        // ===== TOP-UP BALANCE BUTTON =====
        else if (data === 'topup_balance') {
            const balance = getBalance(userId);
            const userTopups = getUserTopups(userId);
            const pendingTopups = userTopups.filter(t => t.status === 'pending');
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '💵 Request Top-Up', callback_data: 'request_topup' }],
                    [{ text: '📋 My Top-ups', callback_data: 'my_topups' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };
            
            bot.editMessageText(
                `💵 *TOP-UP BALANCE*\n\n` +
                `💳 Current Balance: Rp ${formatIDR(balance)}\n` +
                `📋 Total Top-ups: ${userTopups.length}\n` +
                `⏳ Pending: ${pendingTopups.length}\n\n` +
                `💰 Amount Range: Rp ${formatIDR(MIN_TOPUP_AMOUNT)} - ${formatIDR(MAX_TOPUP_AMOUNT)}\n\n` +
                `💡 Request a top-up to add balance!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'request_topup') {
            userStates[chatId] = { state: 'awaiting_topup_amount', userId: userId };
            
            bot.editMessageText(
                `💵 *REQUEST TOP-UP*\n\n` +
                `Enter amount to top-up:\n\n` +
                `💰 Min: Rp ${formatIDR(MIN_TOPUP_AMOUNT)}\n` +
                `💰 Max: Rp ${formatIDR(MAX_TOPUP_AMOUNT)}\n\n` +
                `📝 Send the amount (example: 50000)`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'my_topups') {
            const userTopups = getUserTopups(userId).slice(-10).reverse();
            
            if (userTopups.length === 0) {
                bot.editMessageText(
                    `📋 *MY TOP-UPS*\n\n` +
                    `No top-ups yet!\n\n` +
                    `Request your first top-up to add balance.`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId, 
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💵 Request Top-Up', callback_data: 'request_topup' }],
                                [{ text: '🔙 Back', callback_data: 'topup_balance' }]
                            ]
                        }
                    }
                ).catch(() => {});
                return;
            }
            
            let text = '📋 *MY TOP-UPS*\n\n';
            
            userTopups.forEach(topup => {
                const emoji = topup.status === 'approved' ? '✅' : 
                             topup.status === 'pending' ? '⏳' : '❌';
                text += `${emoji} Top-up #T${topup.topup_id}\n`;
                text += `   Amount: Rp ${formatIDR(topup.amount)}\n`;
                text += `   Status: ${topup.status}\n`;
                text += `   Type: ${topup.topup_type === 'admin_credit' ? 'Admin Gift' : 'Request'}\n`;
                text += `   Date: ${new Date(topup.date).toLocaleString('id-ID')}\n\n`;
            });
            
            text += `\nShowing last ${Math.min(userTopups.length, 10)} top-ups`;
            
            bot.editMessageText(text, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💵 Request Top-Up', callback_data: 'request_topup' }],
                        [{ text: '🔙 Back', callback_data: 'topup_balance' }]
                    ]
                }
            }).catch(() => {});
        }
        
        // ===== ADMIN PENDING TOP-UPS =====
        else if (data === 'admin_pending_topups') {
            if (!isAdmin(userId)) return;
            
            const pendingTopups = getPendingTopups();
            
            const keyboard = {
                inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]]
            };
            
            if (pendingTopups.length === 0) {
                bot.editMessageText(
                    `📋 *PENDING TOP-UPS*\n\n` +
                    `No pending top-ups!`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
                ).catch(() => {});
                return;
            }
            
            let text = `📋 *PENDING TOP-UPS* (${pendingTopups.length})\n\n`;
            
            pendingTopups.slice(0, 10).forEach(topup => {
                text += `💵 Top-up #T${topup.topup_id}\n`;
                text += `   User: @${escapeMarkdown(topup.username)}\n`;
                text += `   ID: \`${topup.user_id}\`\n`;
                text += `   Amount: Rp ${formatIDR(topup.amount)}\n`;
                text += `   Date: ${new Date(topup.date).toLocaleString('id-ID')}\n`;
                text += `   Proof: ${topup.payment_receipt ? '✅ Uploaded' : '⏳ Waiting'}\n\n`;
            });
            
            if (pendingTopups.length > 10) {
                text += `\nShowing 10 of ${pendingTopups.length} pending`;
            }
            
            bot.editMessageText(text, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }).catch(() => {});
        }
        
        // ===== ADMIN ADD BALANCE =====
        else if (data === 'admin_add_balance') {
            if (!isAdmin(userId)) return;
            
            userStates[chatId] = { state: 'awaiting_add_balance', step: 'user_id' };
            
            bot.editMessageText(
                `💰 *ADD USER BALANCE*\n\n` +
                `Step 1/2: Enter USER ID\n\n` +
                `Example: 123456789\n\n` +
                `💡 User can get their ID with /start`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        // ===== ADMIN GIFT MESSAGE BUTTONS =====
else if (data === 'admin_create_gift') {
    if (!isAdmin(userId)) return;
    
    userStates[chatId] = { state: 'awaiting_gift_amount' };
    
    bot.editMessageText(
        `🎁 *CREATE GIFT MESSAGE*\n\n` +
        `Step 1/4: Enter BALANCE AMOUNT\n\n` +
        `💰 Range: ${formatIDR(MIN_TOPUP_AMOUNT)} - ${formatIDR(MAX_TOPUP_AMOUNT)}\n\n` +
        `Example: 50000\n\n` +
        `💡 This amount will be given to each user who claims`,
        { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
    ).catch(() => {});
}

else if (data === 'admin_view_gifts') {
    if (!isAdmin(userId)) return;
    
    const giftMessages = getGiftMessages();
    
    if (giftMessages.length === 0) {
        bot.editMessageText(
            `📋 *GIFT MESSAGES*\n\n` +
            `No gift messages created yet!`,
            { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎁 Create Gift', callback_data: 'admin_create_gift' }],
                        [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                    ]
                }
            }
        ).catch(() => {});
        return;
    }
    
    let text = `📋 *ALL GIFT MESSAGES*\n\n`;
    const buttons = [];
    
    giftMessages.forEach((gift, index) => {
        const status = gift.active ? '✅' : '❌';
        const claimed = gift.claimed_count || 0;
        const total = gift.max_claims || '∞';
        const onePerUser = gift.one_claim_per_user ? '✅' : '❌';
        
        text += `${index + 1}. ${status} Gift #G${gift.gift_id}\n`;
        text += `   Amount: Rp ${formatIDR(gift.amount)}\n`;
        text += `   Message: ${gift.message.substring(0, 30)}...\n`;
        text += `   Claimed: ${claimed}/${total}\n`;
        text += `   One/User: ${onePerUser}\n`;
        text += `   Status: ${gift.active ? 'Active' : 'Inactive'}\n\n`;
        
        buttons.push([
            { text: `${status} Active`, callback_data: `gift_toggle_${gift.gift_id}` },
            { text: `${onePerUser} 1/User`, callback_data: `gift_toggle_limit_${gift.gift_id}` }
        ]);
        buttons.push([
            { text: `📊 Stats #G${gift.gift_id}`, callback_data: `gift_stats_${gift.gift_id}` },
            { text: `🗑️ Delete`, callback_data: `gift_delete_${gift.gift_id}` }
        ]);
    });
    
    buttons.push([{ text: '🎁 Create New Gift', callback_data: 'admin_create_gift' }]);
    buttons.push([{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]);
    
    bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    }).catch(() => {});
}

else if (data.startsWith('gift_toggle_limit_')) {
    if (!isAdmin(userId)) return;
    const giftId = parseInt(data.replace('gift_toggle_limit_', ''));
    const gift = toggleGiftOneClaimPerUser(giftId);
    
    if (gift) {
        bot.answerCallbackQuery(query.id, {
            text: `One claim per user is now ${gift.one_claim_per_user ? 'ENABLED ✅' : 'DISABLED ❌'}`,
            show_alert: true
        }).catch(() => {});
        
        setTimeout(() => {
            bot.emit('callback_query', { ...query, data: 'admin_view_gifts' });
        }, 500);
    }
}

else if (data.startsWith('gift_stats_')) {
    if (!isAdmin(userId)) return;
    const giftId = parseInt(data.replace('gift_stats_', ''));
    const giftMessages = getGiftMessages();
    const gift = giftMessages.find(g => g.gift_id === giftId);
    
    if (!gift) {
        bot.answerCallbackQuery(query.id, {
            text: '❌ Gift not found!',
            show_alert: true
        }).catch(() => {});
        return;
    }
    
    const claimedUsers = gift.claimed_by || [];
    const users = getUsers();
    
    let usersList = '';
    if (claimedUsers.length > 0) {
        claimedUsers.slice(0, 10).forEach((uId, idx) => {
            const user = users[uId];
            usersList += `${idx + 1}. @${escapeMarkdown(user?.username || 'unknown')} (\`${uId}\`)\n`;
        });
        if (claimedUsers.length > 10) {
            usersList += `\n...and ${claimedUsers.length - 10} more`;
        }
    } else {
        usersList = 'No claims yet';
    }
    
    bot.editMessageText(
        `📊 *GIFT STATISTICS*\n\n` +
        `🎁 Gift ID: #G${gift.gift_id}\n` +
        `💰 Amount: Rp ${formatIDR(gift.amount)}\n` +
        `📝 Message: ${gift.message}\n\n` +
        `📈 *Stats:*\n` +
        `✅ Total Claims: ${gift.claimed_count || 0}\n` +
        `🔢 Max Claims: ${gift.max_claims || 'Unlimited'}\n` +
        `👥 Unique Users: ${claimedUsers.length}\n` +
        `🔒 One/User: ${gift.one_claim_per_user ? 'Enabled ✅' : 'Disabled ❌'}\n` +
        `⚡ Status: ${gift.active ? 'Active ✅' : 'Inactive ❌'}\n\n` +
        `👥 *Claimed By:*\n${usersList}\n\n` +
        `📅 Created: ${new Date(gift.created_at).toLocaleString('id-ID')}`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Gifts', callback_data: 'admin_view_gifts' }]
                ]
            }
        }
    ).catch(() => {});
}

else if (data.startsWith('gift_toggle_')) {
    if (!isAdmin(userId)) return;
    const giftId = parseInt(data.replace('gift_toggle_', ''));
    const gift = updateGiftMessage(giftId, { active: null });
    
    if (gift) {
        const newStatus = !gift.active;
        updateGiftMessage(giftId, { active: newStatus });
        
        bot.answerCallbackQuery(query.id, {
            text: `Gift #G${giftId} is now ${newStatus ? 'ACTIVE ✅' : 'INACTIVE ❌'}`,
            show_alert: true
        }).catch(() => {});
        
        setTimeout(() => {
            bot.emit('callback_query', { ...query, data: 'admin_view_gifts' });
        }, 500);
    }
}

else if (data.startsWith('gift_delete_')) {
    if (!isAdmin(userId)) return;
    const giftId = parseInt(data.replace('gift_delete_', ''));
    
    const giftMessages = getGiftMessages();
    const updatedGifts = giftMessages.filter(g => g.gift_id !== giftId);
    saveJSON(GIFT_MESSAGES_FILE, updatedGifts);
    
    bot.answerCallbackQuery(query.id, {
        text: `✅ Gift #G${giftId} deleted!`,
        show_alert: true
    }).catch(() => {});
    
    setTimeout(() => {
        bot.emit('callback_query', { ...query, data: 'admin_view_gifts' });
    }, 500);
}

else if (data.startsWith('claim_gift_')) {
    const giftId = parseInt(data.replace('claim_gift_', ''));
    
    const claimCheck = canClaimGift(userId, giftId);
    
    if (!claimCheck.can_claim) {
        bot.answerCallbackQuery(query.id, {
            text: `❌ ${claimCheck.reason}`,
            show_alert: true
        }).catch(() => {});
        return;
    }
    
    const gift = claimCheck.gift;
    
    // Credit balance
    const newBalance = updateBalance(userId, gift.amount);
    
    // Record claim
    recordGiftClaim(userId, giftId);
    
    bot.answerCallbackQuery(query.id, {
        text: `✅ Claimed Rp ${formatIDR(gift.amount)}!`,
        show_alert: false
    }).catch(() => {});
    
    bot.sendMessage(chatId,
        `🎁 *GIFT CLAIMED SUCCESSFULLY!*\n\n` +
        `✅ You received: Rp ${formatIDR(gift.amount)}\n` +
        `💳 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
        `🎉 Thank you for being with us!\n` +
        `${gift.one_claim_per_user ? '🔒 You can only claim this once\n' : '💡 You can claim again while available\n'}\n` +
        `⏰ ${getCurrentDateTime()}`,
        { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                    [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                ]
            }
        }
    ).catch(() => {});
    
    // Notify admin
    const users = getUsers();
    const updatedGift = getGiftMessages().find(g => g.gift_id === giftId);
    bot.sendMessage(ADMIN_TELEGRAM_ID,
        `🎁 *GIFT CLAIMED*\n\n` +
        `Gift ID: #G${giftId}\n` +
        `User: @${escapeMarkdown(users[userId]?.username || 'unknown')}\n` +
        `User ID: \`${userId}\`\n` +
        `Amount: Rp ${formatIDR(gift.amount)}\n` +
        `Total Claims: ${updatedGift.claimed_count}/${gift.max_claims || '∞'}\n` +
        `Unique Users: ${updatedGift.claimed_by?.length || 0}\n\n` +
        `📅 ${getCurrentDateTime()}`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}
        // ===== ADMIN ANALYTICS BUTTON =====
        else if (data === 'admin_analytics') {
            if (!isAdmin(userId)) return;
            
            const orders = getOrders();
            const users = getUsers();
            const topups = getTopups();
            const now = new Date();
            
            // Today's stats
            const todayOrders = orders.filter(o => {
                const orderDate = new Date(o.date);
                return orderDate.toDateString() === now.toDateString();
            });
            
            const todayRevenue = todayOrders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + o.total_price, 0);
            
            const todayTopups = topups.filter(t => {
                const topupDate = new Date(t.date);
                return topupDate.toDateString() === now.toDateString() && t.status === 'approved';
            });
            
            const todayTopupTotal = todayTopups.reduce((sum, t) => sum + t.amount, 0);
            
            // This week
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekOrders = orders.filter(o => new Date(o.date) > weekAgo);
            const weekRevenue = weekOrders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + o.total_price, 0);
            
            const weekTopups = topups.filter(t => new Date(t.date) > weekAgo && t.status === 'approved');
            const weekTopupTotal = weekTopups.reduce((sum, t) => sum + t.amount, 0);
            
            // Conversion rate
            const completedOrders = orders.filter(o => o.status === 'completed');
            const completedRate = orders.length > 0 
                ? ((completedOrders.length / orders.length) * 100).toFixed(1)
                : 0;
            
            // Average order value
            const avgOrderValue = completedOrders.length > 0
                ? Math.floor(completedOrders.reduce((sum, o) => sum + o.total_price, 0) / completedOrders.length)
                : 0;
            
            // Average topup value
            const approvedTopups = topups.filter(t => t.status === 'approved');
            const avgTopupValue = approvedTopups.length > 0
                ? Math.floor(approvedTopups.reduce((sum, t) => sum + t.amount, 0) / approvedTopups.length)
                : 0;
            
            const keyboard = {
                inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]]
            };
            
            bot.editMessageText(
                `📈 *ANALYTICS DASHBOARD*\n\n` +
                `📅 *TODAY:*\n` +
                `• Orders: ${todayOrders.length}\n` +
                `• Revenue: Rp ${formatIDR(todayRevenue)}\n` +
                `• Top-ups: ${todayTopups.length} (Rp ${formatIDR(todayTopupTotal)})\n` +
                `• Completed: ${todayOrders.filter(o => o.status === 'completed').length}\n\n` +
                `📊 *THIS WEEK:*\n` +
                `• Orders: ${weekOrders.length}\n` +
                `• Revenue: Rp ${formatIDR(weekRevenue)}\n` +
                `• Top-ups: ${weekTopups.length} (Rp ${formatIDR(weekTopupTotal)})\n` +
                `• Completed: ${weekOrders.filter(o => o.status === 'completed').length}\n\n` +
                `💡 *INSIGHTS:*\n` +
                `• Conversion Rate: ${completedRate}%\n` +
                `• Avg Order: Rp ${formatIDR(avgOrderValue)}\n` +
                `• Avg Top-up: Rp ${formatIDR(avgTopupValue)}\n` +
                `• Active Users (7d): ${Object.values(users).filter(u => {
                    const last = new Date(u.last_interaction);
                    return (now - last) / (1000 * 60 * 60 * 24) <= 7;
                }).length}\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        // ===== ADMIN USERS WITH TAP-TO-COPY =====
        else if (data === 'admin_users' || data.startsWith('admin_users_page_')) {
            if (!isAdmin(userId)) return;
            
            const users = getUsers();
            const orders = getOrders();
            const balances = getBalances();
            const topups = getTopups();
            
            const userList = Object.values(users).filter(u => u.user_id !== ADMIN_TELEGRAM_ID);
            const totalUsers = userList.length;
            const totalBalance = Object.values(balances).reduce((sum, bal) => sum + bal, 0);
            
            // Pagination
            const USERS_PER_PAGE = 10;
            let currentPage = 1;
            if (data.startsWith('admin_users_page_')) {
                currentPage = parseInt(data.replace('admin_users_page_', ''));
            }
            
            const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);
            const startIndex = (currentPage - 1) * USERS_PER_PAGE;
            const endIndex = startIndex + USERS_PER_PAGE;
            const pageUsers = userList.slice(startIndex, endIndex);
            
            let text = `👥 *ALL USERS* (Page ${currentPage}/${totalPages})\n\n`;
            text += `📊 Total: ${totalUsers} users\n`;
            text += `💳 Total Balance: Rp ${formatIDR(totalBalance)}\n\n`;
            text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            pageUsers.forEach((user, index) => {
                const userOrders = orders.filter(o => o.user_id === user.user_id);
                const completedOrders = userOrders.filter(o => o.status === 'completed');
                const userBalance = balances[user.user_id] || 0;
                const userTopupCount = topups.filter(t => t.user_id === user.user_id && t.status === 'approved').length;
                
                text += `👤 *User #${startIndex + index + 1}*\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `👤 Name: ${escapeMarkdown(user.first_name)}\n`;
                text += `🆔 Username: \`@${user.username}\`\n`;
                text += `🔢 User ID: \`${user.user_id}\`\n`;
                text += `💳 Balance: Rp ${formatIDR(userBalance)}\n`;
                text += `📦 Orders: ${userOrders.length} (${completedOrders.length} done)\n`;
                text += `💵 Top-ups: ${userTopupCount}\n`;
                text += `📅 Joined: ${new Date(user.joined).toLocaleDateString('id-ID')}\n`;
                text += `━━━━━━━━━━━━━━━\n\n`;
            });
            
            text += `💡 *Tap username or ID to copy*\n\n`;
            
            // Navigation buttons
            const keyboard = {
                inline_keyboard: []
            };
            
            if (totalPages > 1) {
                const navButtons = [];
                if (currentPage > 1) {
                    navButtons.push({ text: '⬅️ Previous', callback_data: `admin_users_page_${currentPage - 1}` });
                }
                if (currentPage < totalPages) {
                    navButtons.push({ text: 'Next ➡️', callback_data: `admin_users_page_${currentPage + 1}` });
                }
                if (navButtons.length > 0) {
                    keyboard.inline_keyboard.push(navButtons);
                }
            }
            
            keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]);
            
            bot.editMessageText(text, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }).catch(() => {});
        }
        
        // Continue with rest of the callback handlers...
        // (I'll provide the continuation in the next part)
        // ===== ADMIN PRICING BUTTONS =====
        else if (data === 'admin_pricing') {
            if (!isAdmin(userId)) return;
            
            const pricing = getPricing();
            const pricingText = Object.keys(pricing).map((range, idx) => 
                `${idx + 1}. ${range}: Rp ${formatIDR(pricing[range])}`
            ).join('\n');
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '✏️ Edit Pricing', callback_data: 'edit_pricing' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };
            
            bot.editMessageText(
                `💵 *PRICING MANAGEMENT*\n\n` +
                `Current Pricing:\n${pricingText}\n\n` +
                `Choose an option:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'edit_pricing') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_new_pricing' };

            bot.editMessageText(
                `✏️ *EDIT PRICING*\n\n` +
                `Send new pricing in this format:\n\n` +
                `1-99=500 100-199=450 200+=400\n\n` +
                `💡 Separate each range with space`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        else if (data === 'admin_bonuses') {
            if (!isAdmin(userId)) return;

            const bonuses = getBonuses();
            const bonusText = bonuses.length > 0
                ? formatBonusDealsList()
                : 'No bonus deals are active right now.';

            const keyboard = {
                inline_keyboard: [
                    [{ text: '✏️ Edit Bonus Deals', callback_data: 'edit_bonuses' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };

            bot.editMessageText(
                `🎁 *BONUS DEAL MANAGEMENT*\n\n` +
                `${bonusText}\n\n` +
                `Bonuses give extra free links automatically when users hit the minimum quantity.`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        else if (data === 'edit_bonuses') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_bonus_input' };

            bot.editMessageText(
                `✏️ *EDIT BONUS DEALS*\n\n` +
                `Send each deal on a new line in this format:\n` +
                `MIN=BONUS|Description (optional)\n\n` +
                `Example:\n100=10|Buy 100 get 10 free\n250=35\n\n` +
                `Send 0 to disable all bonus deals.`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        // ===== ADMIN CUSTOM ORDER BUTTON =====
        else if (data === 'admin_custom_order') {
            if (!isAdmin(userId)) return;
            
            userStates[chatId] = { state: 'awaiting_custom_order', step: 'user_id' };
            
            bot.editMessageText(
                `🛒 *CREATE CUSTOM ORDER*\n\n` +
                `Step 1/3: Enter USER ID\n\n` +
                `Example: 123456789\n\n` +
                `💡 User can get their ID with /start`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        // ===== ADMIN GOPAY/QRIS BUTTONS =====
        else if (data === 'admin_qris') {
            if (!isAdmin(userId)) return;
            
            const gopay = getQRIS();
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📱 Upload New GoPay QR', callback_data: 'upload_qris' }],
                    [{ text: '👁️ View Current QR', callback_data: 'view_qris' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };
            
            bot.editMessageText(
                `📱 *GOPAY QR MANAGEMENT*\n\n` +
                `${gopay.file_id ? `✅ GoPay QR Active\n⏰ Updated: ${new Date(gopay.uploaded_at).toLocaleString('id-ID')}` : '❌ No GoPay QR uploaded'}\n\n` +
                `Choose an option:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'upload_qris') {
            if (!isAdmin(userId)) return;
            
            userStates[chatId] = { state: 'awaiting_qris_image' };
            
            bot.sendMessage(chatId,
                `📱 *UPLOAD GOPAY QR*\n\n` +
                `Send GoPay QR code image now.\n\n` +
                `💡 This shows to customers when ordering or topping up.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'view_qris') {
            if (!isAdmin(userId)) return;
            
            const gopay = getQRIS();
            
            if (!gopay.file_id) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ No GoPay QR uploaded yet!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            bot.sendPhoto(chatId, gopay.file_id, {
                caption: `📱 *CURRENT GOPAY QR*\n\n⏰ Updated: ${new Date(gopay.uploaded_at).toLocaleString('id-ID')}`,
                parse_mode: 'Markdown'
            }).catch(() => {});
        }
        
        // ===== ADMIN STOCK BUTTON =====
        else if (data === 'admin_stock') {
            if (!isAdmin(userId)) return;
            
            const stock = getStock();
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📤 Upload Stock File', callback_data: 'upload_stock_instruction' }],
                    [{ text: '📊 Update Display Number', callback_data: 'update_display_stock' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };
            
            bot.editMessageText(
                `📦 *STOCK MANAGEMENT*\n\n` +
                `📊 Display Stock: ${stock.current_stock}\n` +
                `🔗 Actual Links: ${stock.links.length}\n\n` +
                `${stock.links.length <= LOW_STOCK_ALERT ? '⚠️ *LOW STOCK WARNING!*\n\n' : ''}` +
                `Choose an option:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }

        else if (data === 'admin_custom_content') {
            if (!isAdmin(userId)) return;

            const customContent = getCustomContent();
            const productsCount = (customContent.products || []).length;
            const buttonsCount = (customContent.buttons || []).length;

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '➕ Add Product', callback_data: 'admin_add_custom_product' },
                        { text: '🔗 Add Custom Button', callback_data: 'admin_add_custom_button' }
                    ],
                    [{ text: '🗑️ Manage Buttons', callback_data: 'admin_manage_custom_buttons' }],
                    [{ text: '👀 Preview User View', callback_data: 'custom_products' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };

            bot.editMessageText(
                `🛍️ *CUSTOM BUTTONS & PRODUCTS*\n\n` +
                `• Products: ${productsCount}\n` +
                `• Extra buttons: ${buttonsCount}\n\n` +
                `Use the options below to add new entries or preview how users see them.`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        else if (data === 'admin_manage_custom_buttons') {
            if (!isAdmin(userId)) return;

            const customContent = getCustomContent();
            const hasButtons = (customContent.buttons || []).length > 0;
            const keyboard = buildCustomButtonsManager(customContent);

            bot.editMessageText(
                `🗑️ *MANAGE CUSTOM BUTTONS*\n\n` +
                `${hasButtons ? 'Tap a button to remove it.' : 'No custom buttons yet.'}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }

        else if (data === 'admin_add_custom_product') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_custom_product' };

            bot.sendMessage(chatId,
                `➕ *ADD CUSTOM PRODUCT*\n\n` +
                `Send details in one line using pipes (|):\n` +
                `Title | Price | Description | Button Text | Button URL\n\n` +
                `Example:\nPremium Panel | 25000 | Lifetime access | Buy Now | https://example.com`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }

        else if (data === 'admin_add_custom_button') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_custom_button' };

            bot.sendMessage(chatId,
                `🔗 *ADD CUSTOM BUTTON*\n\n` +
                `Send in this format:\n` +
                `Button text | https://link`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        else if (data.startsWith('remove_custom_button:')) {
            if (!isAdmin(userId)) return;

            const buttonId = data.replace('remove_custom_button:', '');
            const content = getCustomContent();
            const beforeCount = (content.buttons || []).length;
            content.buttons = (content.buttons || []).filter(btn => `${btn.id}` !== buttonId);

            if (beforeCount === content.buttons.length) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Button not found',
                    show_alert: true
                }).catch(() => {});
                return;
            }

            saveCustomContent(content);

            const keyboard = buildCustomButtonsManager(content);
            const hasButtons = content.buttons.length > 0;

            bot.editMessageText(
                `🗑️ *MANAGE CUSTOM BUTTONS*\n\n` +
                `${hasButtons ? '✅ Button removed. Tap another to delete.' : '✅ Button removed. No custom buttons left.'}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'upload_stock_instruction') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_stock_upload' };
            
            bot.sendMessage(chatId,
                `📤 *UPLOAD STOCK*\n\n` +
                `Send .txt file with links now.\n\n` +
                `Format:\n` +
                `• One link per line\n` +
                `• Must start with http\n\n` +
                `💡 Auto-broadcast if 50+ links added!`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }

        else if (data === 'admin_accounts') {
            if (!isAdmin(userId)) return;

            const accountStock = getAccountStock();
            const available = accountStock.accounts?.length || 0;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📤 Upload Accounts File', callback_data: 'upload_account_instruction' }],
                    [{ text: '📊 Check Account Stock', callback_data: 'check_account_stock' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                ]
            };

            bot.editMessageText(
                `🔑 *ACCOUNT INVENTORY*\n\n` +
                `📦 Accounts available: ${available}\n\n` +
                `Use the options below to upload or check stock.`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }

        else if (data === 'upload_account_instruction') {
            if (!isAdmin(userId)) return;

            userStates[chatId] = { state: 'awaiting_account_upload' };

            bot.sendMessage(chatId,
                `📤 *UPLOAD VERIFIED ACCOUNTS*\n\n` +
                `Send a .txt file now with one credential per line.\n\n` +
                `Example:\n` +
                `email:password\n` +
                `user|pass` +
                `\n\nKeep each account on its own line.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }

        else if (data === 'check_account_stock') {
            if (!isAdmin(userId)) return;

            const accountStock = getAccountStock();
            const available = accountStock.accounts?.length || 0;

            bot.answerCallbackQuery(query.id, {
                text: `📦 Accounts available: ${available}`,
                show_alert: true
            }).catch(() => {});
        }
        
        else if (data === 'update_display_stock') {
            if (!isAdmin(userId)) return;
            
            userStates[chatId] = { state: 'awaiting_display_stock' };
            
            bot.sendMessage(chatId,
                `📊 *UPDATE DISPLAY STOCK*\n\n` +
                `Enter new stock display number:\n\n` +
                `Example: 5000\n\n` +
                `💡 This is what customers see`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        // ===== ADMIN GET LINKS =====
        else if (data === 'admin_get_links') {
            if (!isAdmin(userId)) return;
            
            const stock = getStock();
            
            if (stock.links.length === 0) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ No links available!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            userStates[chatId] = { state: 'awaiting_admin_link_quantity' };
            
            bot.editMessageText(
                `📥 *GET TEST LINKS (ADMIN ONLY)*\n\n` +
                `📦 Available: ${stock.links.length} links\n` +
                `📊 Display Stock: ${stock.current_stock}\n\n` +
                `💡 How many links do you need?\n\n` +
                `📝 Send quantity (Max: ${Math.min(10000, stock.links.length)})`,
                { 
                    chat_id: chatId, 
                    message_id: messageId, 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Cancel', callback_data: 'back_to_admin_main' }]
                        ]
                    }
                }
            ).catch(() => {});
        }
        
        // ===== CALCULATOR BUTTONS =====
        else if (data === 'open_calculator') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '💰 By Budget', callback_data: 'calc_budget' }],
                    [{ text: '📦 By Quantity', callback_data: 'calc_quantity' }],
                    [{ text: '💵 View Pricing', callback_data: 'calc_view_pricing' }],
                    [{ text: '🎁 Bonus Deals', callback_data: 'view_bonus_deals' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };

            const pricing = getPricing();
            const pricingText = Object.keys(pricing).map(range =>
                `• ${range}: Rp ${formatIDR(pricing[range])}/acc`
            ).join('\n');
            const bonuses = getBonuses();
            const bonusText = bonuses.length > 0
                ? `\n\n🎁 Bonus Deals apply automatically!`
                : '';

            bot.editMessageText(
                `🧮 *SMART CALCULATOR*\n\n` +
                `💰 Pricing:\n${pricingText}${bonusText}\n\n` +
                `What to calculate?`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'calc_budget') {
            userStates[chatId] = { state: 'awaiting_budget_calc' };
            
            bot.editMessageText(
                `💰 *CALCULATE BY BUDGET*\n\n` +
                `Enter your budget:\n\n` +
                `Example: 50000\n\n` +
                `💡 I'll show how many links you can buy!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'calc_quantity') {
            userStates[chatId] = { state: 'awaiting_quantity_calc' };
            
            bot.editMessageText(
                `📦 *CALCULATE BY QUANTITY*\n\n` +
                `Enter number of links:\n\n` +
                `Example: 100\n\n` +
                `💡 I'll show you the total price!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'calc_view_pricing') {
            const pricing = getPricing();
            const pricingDetails = Object.keys(pricing).map(range => {
                const price = pricing[range];
                let examples = '';
                
                if (range.includes('-')) {
                    const [min, max] = range.split('-').map(n => parseInt(n));
                    examples = `\n   Example: ${min} links = Rp ${formatIDR(min * price)}`;
                } else {
                    const min = parseInt(range.replace('+', ''));
                    examples = `\n   Example: ${min} links = Rp ${formatIDR(min * price)}`;
                }
                
                return `📌 *${range} links*\n` +
                       `   Price: Rp ${formatIDR(price)}/account${examples}`;
            }).join('\n\n');
            const bonuses = getBonuses();
            const bonusText = bonuses.length > 0
                ? `\n\n🎁 *Bonus Deals:*\n${formatBonusDealsList()}`
                : '';

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🧮 Calculate', callback_data: 'open_calculator' }],
                    [{ text: '🛒 Order Now', callback_data: 'order' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };

            bot.editMessageText(
                `💵 *COMPLETE PRICING TABLE*\n\n` +
                `${pricingDetails}${bonusText}\n\n` +
                `💡 Bulk orders get better pricing!\n` +
                `🎟️ Use coupon codes for extra discounts!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        else if (data === 'view_bonus_deals') {
            const bonuses = getBonuses();
            const bonusText = bonuses.length > 0
                ? formatBonusDealsList()
                : 'No bonus deals are active right now.';

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🛒 Order Now', callback_data: 'order' }],
                    [{ text: '🧮 Calculator', callback_data: 'open_calculator' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };

            bot.editMessageText(
                `🎁 *BONUS DEALS*\n\n` +
                `${bonusText}\n\n` +
                `Bonuses apply automatically when you reach the minimum quantity!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        // ===== USER MAIN MENU BUTTONS =====
        else if (data === 'buy_account') {
            const balance = getBalance(userId);
            const accountStock = getAccountStock();
            const available = accountStock.accounts?.length || 0;
            const canBuy = available > 0 && balance >= ACCOUNT_PRICE_IDR;

            const keyboard = {
                inline_keyboard: [
                    [{ text: `🛒 Order Account (Rp ${formatIDR(ACCOUNT_PRICE_IDR)})`, callback_data: 'confirm_buy_account' }],
                    [{ text: '💵 Top Up Balance', callback_data: 'topup_balance' }],
                    [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };

            const statusLine = available === 0
                ? '❌ Out of stock! Add more accounts first.'
                : canBuy
                    ? '✅ Ready to deliver instantly!'
                    : '⚠️ You can order now and top up if needed.';

            bot.editMessageText(
                `🔑 *BUY VERIFIED ACCOUNT*\n\n` +
                `💵 Price: Rp ${formatIDR(ACCOUNT_PRICE_IDR)} (no bulk)\n` +
                `📦 Accounts available: ${available}\n\n` +
                `💳 Your balance: Rp ${formatIDR(balance)}\n` +
                `${statusLine}\n\n` +
                `📦 What you get:\n` +
                `• Spotify verified login + password\n` +
                `• Inbox access for verification (email provided)\n\n` +
                `🛒 How to order (same as links, no coupon needed):\n` +
                `1) Tap *Order Account* for 1 verified account\n` +
                `2) Balance auto-deducts on delivery — top up with QRIS/links if short`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }

        else if (data === 'confirm_buy_account') {
            const balance = getBalance(userId);
            const accountStock = getAccountStock();
            const available = accountStock.accounts?.length || 0;

            if (available === 0) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ No accounts in stock!',
                    show_alert: true
                }).catch(() => {});
                return;
            }

            if (balance < ACCOUNT_PRICE_IDR) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Not enough balance! Top up first.',
                    show_alert: true
                }).catch(() => {});
                return;
            }

            updateBalance(userId, -ACCOUNT_PRICE_IDR);

            const orderId = getNextOrderId();
            const users = getUsers();
            const order = {
                order_id: orderId,
                user_id: userId,
                username: users[userId]?.username || query.from.username || 'unknown',
                quantity: 1,
                total_quantity: 1,
                original_price: ACCOUNT_PRICE_IDR,
                total_price: ACCOUNT_PRICE_IDR,
                status: 'completed',
                payment_method: 'balance',
                date: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                product: 'account'
            };

            addOrder(order);

            if (!users[userId]) {
                addUser(userId, query.from);
            }

            const updatedUsers = getUsers();
            updatedUsers[userId].total_orders = (updatedUsers[userId].total_orders || 0) + 1;
            updatedUsers[userId].completed_orders = (updatedUsers[userId].completed_orders || 0) + 1;
            saveJSON(USERS_FILE, updatedUsers);

            const delivery = await deliverAccount(userId, orderId);
            const newBalance = getBalance(userId);

            if (delivery.success) {
                bot.editMessageText(
                    `✅ *ACCOUNT PURCHASED!*\\n\\n` +
                    `📋 Order: #${orderId}\\n` +
                    `💵 Paid: Rp ${formatIDR(ACCOUNT_PRICE_IDR)}\\n` +
                    `💳 Balance left: Rp ${formatIDR(newBalance)}\\n\\n` +
                    `🔑 Credentials sent in a separate message.`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                                [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                            ]
                        }
                    }
                ).catch(() => {});

                bot.sendMessage(ADMIN_TELEGRAM_ID,
                    `🆕 *ACCOUNT SOLD*\\n\\n` +
                    `User: @${escapeMarkdown(updatedUsers[userId]?.username || 'unknown')} (${userId})\\n` +
                    `Order: #${orderId}\\n` +
                    `Price: Rp ${formatIDR(ACCOUNT_PRICE_IDR)}\\n` +
                    `Remaining accounts: ${(getAccountStock().accounts || []).length}`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            } else {
                updateBalance(userId, ACCOUNT_PRICE_IDR);
                updateOrder(orderId, { status: 'failed' });

                bot.editMessageText(
                    `❌ *DELIVERY FAILED*\\n\\n` +
                    `Order: #${orderId}\\n` +
                    `Your payment has been refunded.\\n\\n` +
                    `Please contact ${ADMIN_USERNAME} for help.`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                ).catch(() => {});
            }
        }

        else if (data === 'order') {
            const pricing = getPricing();
            const stock = getStock();
            const bonuses = getBonuses();

            const keyboard = {
                inline_keyboard: [
                    [{ text: '✅ Order Now', callback_data: 'confirm_order' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };

            const pricingText = Object.keys(pricing).map(range =>
                `• ${range}: Rp ${formatIDR(pricing[range])}`
            ).join('\n');

            const bonusText = bonuses.length > 0
                ? `\n🎁 *Bonus Deals:*\n${formatBonusDealsList()}\n`
                : '';

            bot.editMessageText(
                `🎵 *SPOTIFY PREMIUM STUDENT*\n\n` +
                `📦 Stock: ${stock.current_stock} links\n\n` +
                `💰 Pricing:\n` +
                `${pricingText}\n\n` +
                `${bonusText}` +
                `🎟️ Use coupon codes for discounts!\n` +
                `📱 Admin: ${ADMIN_USERNAME}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'confirm_order') {
            const stock = getStock();
            
            if (stock.current_stock === 0 || stock.links.length === 0) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Out of stock!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            userStates[chatId] = { state: 'awaiting_order_quantity', userId: userId };
            
            bot.editMessageText(
                `📝 *CREATE ORDER*\n\n` +
                `How many links do you want?\n\n` +
                `📦 Available: ${stock.current_stock}\n` +
                `📊 Min: 1 | Max: ${Math.min(MAX_ORDER_QUANTITY, stock.current_stock)}\n\n` +
                `💡 Send quantity number:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'buy_with_balance') {
            const balance = getBalance(userId);
            const stock = getStock();
            const pricing = getPricing();
            const firstPrice = pricing[Object.keys(pricing)[0]];
            const canBuy = balance >= firstPrice && stock.links.length > 0;
            
            const keyboard = {
                inline_keyboard: canBuy ? [
                    [{ text: '✅ Buy Now', callback_data: 'confirm_balance_order' }],
                    [{ text: '💵 Top Up', callback_data: 'topup_balance' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ] : [
                    [{ text: '💵 Top Up Balance', callback_data: 'topup_balance' }],
                    [{ text: '🎁 Get Daily Bonus', callback_data: 'daily_bonus' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };
            
            bot.editMessageText(
                `💰 *BUY WITH BALANCE*\n\n` +
                `Your Balance: Rp ${formatIDR(balance)}\n` +
                `Stock: ${stock.current_stock} links\n` +
                `Min Price: Rp ${formatIDR(firstPrice)}/account\n\n` +
                `${canBuy ? '✅ Ready to order!' : '❌ Insufficient balance or out of stock\n\n💡 Top up to add balance!'}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'confirm_balance_order') {
            const balance = getBalance(userId);
            const stock = getStock();
            const pricing = getPricing();
            const firstPrice = pricing[Object.keys(pricing)[0]];
            
            if (balance < firstPrice) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Insufficient balance!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            if (stock.current_stock === 0 || stock.links.length === 0) {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Out of stock!',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            
            userStates[chatId] = { state: 'awaiting_balance_order_quantity', userId: userId };
            
            const maxCanBuy = Math.min(Math.floor(balance / firstPrice), stock.current_stock, stock.links.length, MAX_TOPUP_AMOUNT / firstPrice);
            
            bot.editMessageText(
                `💳 *BUY WITH BALANCE*\n\n` +
                `Your Balance: Rp ${formatIDR(balance)}\n` +
                `Price: Rp ${formatIDR(firstPrice)}/account\n\n` +
                `How many links?\n\n` +
                `Max you can buy: ${maxCanBuy}\n\n` +
                `💡 Send quantity number:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'check_balance') {
            const balance = getBalance(userId);
            const canClaimNow = canClaim(userId);
            const nextClaimTime = getNextClaimTime(userId);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }],
                    [{ text: '💵 Top Up Balance', callback_data: 'topup_balance' }],
                    [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };
            
            bot.editMessageText(
                `💳 *YOUR BALANCE*\n\n` +
                `Balance: Rp ${formatIDR(balance)}\n\n` +
                `🎁 Daily claim: ${canClaimNow ? '✅ Available!' : `⏰ Next in ${nextClaimTime}`}\n` +
                `💵 Top up anytime: 0-100k IDR`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'check_stock') {
            const stock = getStock();
            const pricing = getPricing();
            const pricingText = Object.keys(pricing).map(range => 
                `• ${range}: Rp ${formatIDR(pricing[range])}`
            ).join('\n');
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🛒 Order Now', callback_data: 'order' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };
            
            bot.editMessageText(
                `📦 *STOCK AVAILABLE*\n\n` +
                `Available: ${stock.current_stock} links\n\n` +
                `💰 Current Prices:\n` +
                `${pricingText}\n\n` +
                `🎟️ Use coupon codes for extra discounts!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'my_orders') {
            const orders = getOrders().filter(o => o.user_id === userId);
            const userTopups = getUserTopups(userId);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 View Top-ups', callback_data: 'my_topups' }],
                    [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                ]
            };
            
            if (orders.length === 0) {
                bot.editMessageText(
                    `📝 *MY ORDERS & TOP-UPS*\n\n` +
                    `No orders yet!\n` +
                    `Top-ups: ${userTopups.length}`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard 
                    }
                ).catch(() => {});
                return;
            }
            
            let text = '📝 *MY ORDERS*\n\n';
            
            orders.slice(-10).reverse().forEach(order => {
                const emoji = order.status === 'completed' ? '✅' : 
                             order.status === 'awaiting_payment' ? '⏳' : 
                             order.status === 'expired' ? '⏰' : '❌';
                text += `${emoji} Order #${order.order_id}\n`;
                text += `   Qty: ${formatOrderQuantitySummary(order)}\n`;
                text += `   Total: Rp ${formatIDR(order.total_price)}\n`;
                if (order.coupon_code) {
                    text += `   Coupon: ${order.coupon_code}\n`;
                }
                text += `   Status: ${order.status}\n\n`;
            });
            
            text += `\nShowing last ${Math.min(orders.length, 10)} orders\n`;
            text += `💵 Top-ups: ${userTopups.length}`;
            
            bot.editMessageText(text, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }).catch(() => {});
        }
        
        else if (data === 'daily_bonus') {
            const claimInfo = getClaimAmount(userId);
            
            if (claimInfo.canClaim === false) {
                const nextClaimTime = getNextClaimTime(userId);
                const claims = getClaims();
                const lastClaim = claims[userId];
                const lastClaimDate = new Date(lastClaim.timestamp);
                const nextClaimDate = new Date(lastClaimDate.getTime() + (24 * 60 * 60 * 1000));
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔙 Back', callback_data: 'back_to_main' }]
                    ]
                };
                
                bot.editMessageText(
                    `⏰ *ALREADY CLAIMED!*\n\n` +
                    `You already claimed today.\n\n` +
                    `📅 *Streak Day:* ${claimInfo.day} of ${CLAIM_RESET_DAYS}\n\n` +
                    `⏰ *Last claim:*\n` +
                    `${lastClaimDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                    `⏳ *Next claim in:*\n` +
                    `${nextClaimTime}\n\n` +
                    `🕐 *Can claim at:*\n` +
                    `${nextClaimDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                    `💡 Come back in 24 hours!`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
                ).catch(() => {});
                return;
            }
            
            const amount = claimInfo.amount;
            const day = claimInfo.day;
            const newBalance = updateBalance(userId, amount);
            const claimTime = new Date();
            recordClaim(userId, day);
            
            const nextClaimDate = new Date(claimTime.getTime() + (24 * 60 * 60 * 1000));
            const nextDay = day >= CLAIM_RESET_DAYS ? 1 : day + 1;
            const nextAmount = DAILY_CLAIM_BASE + (DAILY_CLAIM_INCREMENT * (nextDay - 1));
            
            const progressBar = '🟢'.repeat(day) + '⚪'.repeat(CLAIM_RESET_DAYS - day);
            
            let streakMessage = '';
            if (claimInfo.isNewStreak) {
                streakMessage = `\n🔄 *New Streak Started!*\n`;
            } else if (day === CLAIM_RESET_DAYS) {
                streakMessage = `\n🎉 *MAX BONUS! Cycle complete!*\n`;
            }
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                    [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                ]
            };
            
            bot.editMessageText(
                `✅ *CLAIM SUCCESS!*\n` +
                `${streakMessage}\n` +
                `📅 *Streak Day ${day}/${CLAIM_RESET_DAYS}*\n` +
                `${progressBar}\n\n` +
                `🎁 *Today's Bonus:* Rp ${formatIDR(amount)}\n` +
                `💳 *New Balance:* Rp ${formatIDR(newBalance)}\n\n` +
                `⏰ *Claimed at:*\n` +
                `${claimTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                `🕐 *Next claim:*\n` +
                `${nextClaimDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                `💰 *Tomorrow's bonus:* Rp ${formatIDR(nextAmount)} (Day ${nextDay})\n\n` +
                `⏳ Don't forget to claim tomorrow!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'back_to_main') {
            const balance = getBalance(userId);
            const stock = getStock();
            const pricing = getPricing();
            const pricingText = Object.keys(pricing).slice(0, 3).map(range =>
                `• ${range}: Rp ${formatIDR(pricing[range])}`
            ).join('\n');
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🎵 Order Spotify', callback_data: 'order' }],
                    [{ text: '🔑 Buy Account (Rp 650)', callback_data: 'buy_account' }],
                    [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                    [{ text: '💵 Top Up Balance', callback_data: 'topup_balance' }],
                    [{ text: '🧮 Price Calculator', callback_data: 'open_calculator' }],
                    [{ text: '🎁 Bonus Deals', callback_data: 'view_bonus_deals' }],
                    [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                    [{ text: '📦 Stock', callback_data: 'check_stock' }],
                    [{ text: '📝 My Orders', callback_data: 'my_orders' }],
                    [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }],
                ]
            };

            const bonuses = getBonuses();
            const bonusText = bonuses.length > 0 ? `\n\n🎁 *Bonus Deals:*\n${formatBonusDealsList()}` : '';

                bot.editMessageText(
                    `🎉 *Welcome Back!*\n\n` +
                    `Hi ${escapeMarkdown(query.from.first_name)}! 👋\n\n` +
                    `💳 Balance: Rp ${formatIDR(balance)}\n` +
                    `🔑 Verified Account: Rp ${formatIDR(ACCOUNT_PRICE_IDR)} (balance only)\n` +
                    `📦 Stock: ${stock.current_stock} links\n\n` +
                    `💰 Prices:\n${pricingText}${bonusText}`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
                ).catch(() => {});
        }
        
        else if (data === 'back_to_admin_main') {
            if (!isAdmin(userId)) return;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📊 Stats', callback_data: 'admin_stats' }, { text: '📝 Orders', callback_data: 'admin_orders' }],
                    [{ text: '👥 Users', callback_data: 'admin_users' }, { text: '💰 Revenue', callback_data: 'admin_revenue' }],
                    [{ text: '📈 Analytics', callback_data: 'admin_analytics' }, { text: '📦 Stock', callback_data: 'admin_stock' }],
                    [{ text: '💵 Pricing', callback_data: 'admin_pricing' }, { text: '🎟️ Coupons', callback_data: 'admin_coupons' }],
                    [{ text: '🎁 Bonuses', callback_data: 'admin_bonuses' }],
                    [{ text: '📱 GoPay', callback_data: 'admin_qris' }, { text: '🛒 Custom Order', callback_data: 'admin_custom_order' }],
                    [{ text: '📋 Pending Top-ups', callback_data: 'admin_pending_topups' }, { text: '💰 Add Balance', callback_data: 'admin_add_balance' }],
                    [{ text: '📥 Get Test Links', callback_data: 'admin_get_links' }],
                    [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }]
                ]
            };
            
            bot.editMessageText(
                `🔐 *ADMIN PANEL*\n\nWelcome back!`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        

            else if (data === 'admin_stats') {
            if (!isAdmin(userId)) return;
            
            const users = getUsers();
            const orders = getOrders();
            const stock = getStock();
            const counter = getOrderCounter();
            const topups = getTopups();
            
            const totalUsers = Object.keys(users).length;
            const totalOrders = orders.length;
            const awaitingPayment = orders.filter(o => o.status === 'awaiting_payment').length;
            const completedOrders = orders.filter(o => o.status === 'completed').length;
            const totalRevenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total_price, 0);
            
            const approvedTopups = topups.filter(t => t.status === 'approved');
            const totalTopupAmount = approvedTopups.reduce((sum, t) => sum + t.amount, 0);
            const pendingTopupsCount = topups.filter(t => t.status === 'pending').length;
            
            const keyboard = {
                inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]]
            };
            
            bot.editMessageText(
                `📊 *STATISTICS*\n\n` +
                `👥 Total Users: ${totalUsers}\n` +
                `📝 Total Orders: ${totalOrders}\n` +
                `🔢 Next Order ID: #${counter.last_order_id + 1}\n` +
                `⏳ Awaiting Payment: ${awaitingPayment}\n` +
                `✅ Completed: ${completedOrders}\n\n` +
                `💵 *Top-ups:*\n` +
                `• Total: ${topups.length}\n` +
                `• Approved: ${approvedTopups.length}\n` +
                `• Pending: ${pendingTopupsCount}\n` +
                `• Total Amount: Rp ${formatIDR(totalTopupAmount)}\n\n` +
                `📦 Display Stock: ${stock.current_stock}\n` +
                `🔗 Actual Links: ${stock.links.length}\n` +
                `${stock.links.length <= LOW_STOCK_ALERT ? `⚠️ *LOW STOCK ALERT!*\n` : ''}` +
                `💰 Total Revenue: Rp ${formatIDR(totalRevenue)}\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
              ).catch(() => {});
        }
        
        else if (data === 'admin_orders') {
            if (!isAdmin(userId)) return;
            
            const orders = getOrders().slice(-15).reverse();
            
            const keyboard = {
                inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]]
            };
            
            if (orders.length === 0) {
                bot.editMessageText('📝 No orders yet!', { 
                    chat_id: chatId, 
                    message_id: messageId, 
                    reply_markup: keyboard 
                }).catch(() => {});
                return;
            }
            
            let text = '📝 *ALL ORDERS* (Last 15)\n\n';
            
            orders.forEach(order => {
                const emoji = order.status === 'completed' ? '✅' : 
                             order.status === 'awaiting_payment' ? '⏳' : 
                             order.status === 'expired' ? '⏰' : '❌';
                
                text += `${emoji} #${order.order_id} - @${escapeMarkdown(order.username)}\n`;
                text += `   Qty: ${formatOrderQuantitySummary(order)} | Rp ${formatIDR(order.total_price)}\n`;
                if (order.coupon_code) {
                    text += `   Coupon: ${order.coupon_code} (-${order.discount_percent}%)\n`;
                }
                text += `   ${order.status} | ${order.payment_method}\n\n`;
            });
            
            bot.editMessageText(text, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }).catch(() => {});
        }
        
        else if (data === 'admin_revenue') {
            if (!isAdmin(userId)) return;
            
            const orders = getOrders();
            const completed = orders.filter(o => o.status === 'completed');
            const topups = getTopups();
            const approvedTopups = topups.filter(t => t.status === 'approved');
            
            const totalRevenue = completed.reduce((sum, o) => sum + o.total_price, 0);
            const totallinks = completed.reduce((sum, o) => sum + getOrderTotalQuantity(o), 0);
            const autoRevenue = completed.filter(o => o.payment_method === 'balance').reduce((sum, o) => sum + o.total_price, 0);
            const manualRevenue = completed.filter(o => o.payment_method === 'manual').reduce((sum, o) => sum + o.total_price, 0);
            
            const totalTopupAmount = approvedTopups.reduce((sum, t) => sum + t.amount, 0);
            const userRequestTopups = approvedTopups.filter(t => t.topup_type === 'user_request');
            const adminCreditTopups = approvedTopups.filter(t => t.topup_type === 'admin_credit');
            
            const couponOrders = completed.filter(o => o.coupon_code);
            const totalDiscounts = couponOrders.reduce((sum, o) => sum + (o.original_price - o.total_price), 0);
            
            const keyboard = {
                inline_keyboard: [[{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]]
            };
            
            bot.editMessageText(
                `💰 *REVENUE REPORT*\n\n` +
                `💵 Total Revenue: Rp ${formatIDR(totalRevenue)}\n` +
                `📦 Total links Sold: ${totallinks}\n` +
                `📊 Completed Orders: ${completed.length}\n\n` +
                `*Payment Methods:*\n` +
                `💳 Balance: Rp ${formatIDR(autoRevenue)}\n` +
                `💰 Manual: Rp ${formatIDR(manualRevenue)}\n\n` +
                `*Top-ups:*\n` +
                `💵 Total: Rp ${formatIDR(totalTopupAmount)}\n` +
                `👤 User Requests: ${userRequestTopups.length} (Rp ${formatIDR(userRequestTopups.reduce((sum, t) => sum + t.amount, 0))})\n` +
                `🎁 Admin Credits: ${adminCreditTopups.length} (Rp ${formatIDR(adminCreditTopups.reduce((sum, t) => sum + t.amount, 0))})\n\n` +
                `*Coupons:*\n` +
                `🎟️ Orders with coupons: ${couponOrders.length}\n` +
                `💸 Total discounts given: Rp ${formatIDR(totalDiscounts)}\n\n` +
                `📈 Average/Order: Rp ${formatIDR(completed.length > 0 ? Math.floor(totalRevenue / completed.length) : 0)}\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
        }
        
        else if (data === 'admin_coupons') {
            if (!isAdmin(userId)) return;
            
            const coupons = getCoupons();
            const couponsList = Object.values(coupons);
            
            if (couponsList.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '➕ Add New Coupon', callback_data: 'coupon_add_new' }],
                        [{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]
                    ]
                };
                
                bot.editMessageText(
                    `🎟️ *COUPON MANAGEMENT*\n\n` +
                    `No coupons yet!\n\n` +
                    `Click below to create your first coupon.`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard }
                ).catch(() => {});
                return;
            }
            
            let text = `🎟️ *COUPON MANAGEMENT*\n\n`;
            const buttons = [];
            
            couponsList.forEach((coupon, index) => {
                const status = coupon.active ? '✅' : '❌';
                text += `${index + 1}. ${status} *${coupon.code}*\n`;
                text += `   • Discount: ${coupon.discount_percent}%\n`;
                text += `   • Min Order: ${coupon.min_order} links\n`;
                text += `   • Used: ${coupon.used_count}/${coupon.max_uses || '∞'} times\n`;
                text += `   • Users: ${coupon.used_by ? coupon.used_by.length : 0}\n\n`;
                
                buttons.push([
                    { text: `${status} ${coupon.code}`, callback_data: `coupon_toggle_${coupon.code}` },
                    { text: `🗑️ Delete`, callback_data: `coupon_delete_${coupon.code}` }
                ]);
            });
            
            text += `\nTotal: ${couponsList.length} coupons`;
            buttons.push([{ text: '➕ Add New Coupon', callback_data: 'coupon_add_new' }]);
            buttons.push([{ text: '🔙 Back', callback_data: 'back_to_admin_main' }]);
            
            const keyboard = { inline_keyboard: buttons };
            
            bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }).catch(() => {});
        }
        
        else if (data.startsWith('coupon_toggle_')) {
            if (!isAdmin(userId)) return;
            const code = data.replace('coupon_toggle_', '');
            const newStatus = toggleCouponStatus(code);
            bot.answerCallbackQuery(query.id, {
                text: `${code} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}`,
                show_alert: false
            }).catch(() => {});
            
            setTimeout(() => {
                bot.emit('callback_query', { ...query, data: 'admin_coupons' });
            }, 500);
        }
        
        else if (data.startsWith('coupon_delete_')) {
            if (!isAdmin(userId)) return;
            const code = data.replace('coupon_delete_', '');
            deleteCoupon(code);
            bot.answerCallbackQuery(query.id, {
                text: `✅ Coupon ${code} deleted!`,
                show_alert: false
            }).catch(() => {});
            
            setTimeout(() => {
                bot.emit('callback_query', { ...query, data: 'admin_coupons' });
            }, 500);
        }
        
        else if (data === 'coupon_add_new') {
            if (!isAdmin(userId)) return;
            userStates[chatId] = { state: 'awaiting_coupon_data', step: 'code' };
            
            bot.sendMessage(chatId,
                `🎟️ *ADD NEW COUPON*\n\n` +
                `Step 1/6: Enter coupon CODE\n\n` +
                `Example: SUMMER2025\n\n` +
                `💡 Code must be UPPERCASE, no spaces`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'admin_broadcast') {
            if (!isAdmin(userId)) return;
            
            userStates[chatId] = { state: 'awaiting_broadcast' };
            
            bot.sendMessage(chatId, 
                '📢 *BROADCAST*\n\nSend photo or text message to broadcast:', 
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        else if (data === 'skip_coupon') {
            const state = userStates[chatId];
            if (state && state.state === 'awaiting_coupon_code') {
                createOrder(chatId, state.userId, state.user, state.quantity, null);
            }
        }
        
        else if (data === 'skip_balance_coupon') {
            const state = userStates[chatId];
            if (state && state.state === 'awaiting_balance_coupon') {
                processBalanceOrder(chatId, state.userId, state.user, state.quantity, null);
            }
        }
        
    } catch (error) {
        console.error('Error in callback query:', error.message);
    }
});

// ============================================
// ADMIN COMMANDS
// ============================================

bot.onText(/\/deliver_account\s+(\d+)(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) return;

    const targetUserId = parseInt(match[1]);
    const orderId = match[2] ? parseInt(match[2]) : 'manual';

    if (isNaN(targetUserId)) {
        bot.sendMessage(chatId, '❌ Please provide a valid user ID!').catch(() => {});
        return;
    }

    const result = await deliverAccount(targetUserId, orderId);

    if (result.success) {
        bot.sendMessage(chatId,
            `✅ Account sent to user ${targetUserId}!\n\n` +
            `📋 Order #: ${orderId}\n` +
            `🔑 Delivered: ${result.delivered}`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    } else {
        bot.sendMessage(chatId, result.message || '❌ Failed to deliver account.').catch(() => {});
    }
});

// ============================================
// MESSAGE HANDLER (Text Input Processing)
// ============================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    
    if (!text || text.startsWith('/')) return;
    
    const state = userStates[chatId];
    if (!state) return;
    
    try {
        // Top-up amount input
        if (state.state === 'awaiting_topup_amount') {
            const amount = parseInt(text.replace(/\D/g, ''));
            
            if (isNaN(amount) || amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
                bot.sendMessage(chatId, 
                    `❌ Invalid amount!\n\n` +
                    `💰 Min: Rp ${formatIDR(MIN_TOPUP_AMOUNT)}\n` +
                    `💰 Max: Rp ${formatIDR(MAX_TOPUP_AMOUNT)}`
                ).catch(() => {});
                return;
            }
            
            const topupId = getNextTopupId();
            const users = getUsers();
            
            const topup = {
                topup_id: topupId,
                user_id: userId,
                username: users[userId]?.username || msg.from.username || 'unknown',
                amount: amount,
                status: 'pending',
                topup_type: 'user_request',
                date: new Date().toISOString()
            };
            
            addTopup(topup);
            delete userStates[chatId];
            
            const gopay = getQRIS();
            
            if (gopay.file_id) {
                bot.sendPhoto(chatId, gopay.file_id, {
                    caption: 
                        `📱 *GOPAY PAYMENT*\n\n` +
                        `💵 Top-up ID: #T${topupId}\n` +
                        `💰 Amount: *Rp ${formatIDR(amount)}*\n\n` +
                        `Scan this QR code to pay\n\n` +
                        `After payment, send screenshot with:\n` +
                        `Caption: #TOPUP\n\n` +
                        `Or contact admin directly:`,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 DM Admin @itsmeaab', url: 'https://t.me/itsmeaab' }],
                            [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                            [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                        ]
                    }
                }).catch(() => {});
            } else {
                bot.sendMessage(chatId,
                    `✅ *TOP-UP REQUEST CREATED!*\n\n` +
                    `💵 Top-up ID: #T${topupId}\n` +
                    `💰 Amount: *Rp ${formatIDR(amount)}*\n\n` +
                    `📱 Contact admin for payment:\n` +
                    `⏳ Status: Pending\n\n` +
                    `💡 Send payment proof with caption: #TOPUP`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📱 DM Admin @itsmeaab', url: 'https://t.me/itsmeaab' }],
                                [{ text: '💳 Check Balance', callback_data: 'check_balance' }],
                                [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                            ]
                        }
                    }
                ).catch(() => {});
            }
            
            // Notify admin
            bot.sendMessage(ADMIN_TELEGRAM_ID,
                `💵 *NEW TOP-UP REQUEST*\n\n` +
                `Top-up ID: #T${topupId}\n` +
                `Customer: @${escapeMarkdown(users[userId]?.username || 'unknown')}\n` +
                `User ID: \`${userId}\`\n` +
                `Amount: Rp ${formatIDR(amount)}\n\n` +
                `⏳ Waiting for payment proof...\n\n` +
                `📅 ${getCurrentDateTime()}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        
        // Admin add balance
        else if (state.state === 'awaiting_add_balance' && isAdmin(userId)) {
            if (state.step === 'user_id') {
                const targetUserId = parseInt(text.replace(/\D/g, ''));
                
                if (isNaN(targetUserId)) {
                    bot.sendMessage(chatId, '❌ Invalid user ID!').catch(() => {});
                    return;
                }
                
                const users = getUsers();
                if (!users[targetUserId]) {
                    bot.sendMessage(chatId, '❌ User not found in database!').catch(() => {});
                    return;
                }
                
                state.target_user_id = targetUserId;
                state.step = 'amount';
                userStates[chatId] = state;
                
                bot.sendMessage(chatId,
                    `✅ User ID: ${targetUserId}\n` +
                    `👤 @${escapeMarkdown(users[targetUserId].username)}\n\n` +
                    `Step 2/2: Enter AMOUNT\n\n` +
                    `💰 Range: ${formatIDR(MIN_TOPUP_AMOUNT)} - ${formatIDR(MAX_TOPUP_AMOUNT)}\n\n` +
                    `Example: 50000`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            else if (state.step === 'amount') {
                const amount = parseInt(text.replace(/\D/g, ''));
                
                if (isNaN(amount) || amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
                    bot.sendMessage(chatId, 
                        `❌ Invalid amount!\n\n` +
                        `💰 Min: Rp ${formatIDR(MIN_TOPUP_AMOUNT)}\n` +
                        `💰 Max: Rp ${formatIDR(MAX_TOPUP_AMOUNT)}`
                    ).catch(() => {});
                    return;
                }
                
                const topupId = getNextTopupId();
                const users = getUsers();
                const targetUser = users[state.target_user_id];
                
                // Create topup record
                const topup = {
                    topup_id: topupId,
                    user_id: state.target_user_id,
                    username: targetUser.username,
                    amount: amount,
                    status: 'approved',
                    topup_type: 'admin_credit',
                    date: new Date().toISOString(),
                    approved_at: new Date().toISOString(),
                    approved_by: userId,
                    note: 'Admin credited balance'
                };
                
                addTopup(topup);
                
                // Credit balance
                const newBalance = updateBalance(state.target_user_id, amount);
                
                // Update user stats
                if (users[state.target_user_id]) {
                    users[state.target_user_id].total_topups = (users[state.target_user_id].total_topups || 0) + 1;
                    saveJSON(USERS_FILE, users);
                }
                
                delete userStates[chatId];
                
                // Notify user
                bot.sendMessage(state.target_user_id,
                    `🎁 *BALANCE CREDITED!*\n\n` +
                    `💰 Amount: Rp ${formatIDR(amount)}\n` +
                    `💳 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
                    `✅ Admin credited your account!\n` +
                    `You can now use it to buy Spotify links!\n\n` +
                    `⏰ ${getCurrentDateTime()}`,
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💰 Buy with Balance', callback_data: 'buy_with_balance' }],
                                [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                            ]
                        }
                    }
                ).catch(() => {});
                
                // Confirm to admin
                bot.sendMessage(chatId,
                    `✅ *BALANCE ADDED SUCCESSFULLY!*\n\n` +
                    `💵 Top-up ID: #T${topupId}\n` +
                    `👤 User: @${escapeMarkdown(targetUser.username)}\n` +
                    `🆔 User ID: ${state.target_user_id}\n` +
                    `💰 Amount: Rp ${formatIDR(amount)}\n` +
                    `💳 New Balance: Rp ${formatIDR(newBalance)}\n\n` +
                    `✅ User has been notified!\n\n` +
                    `📅 ${getCurrentDateTime()}`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
        }
// ===== GIFT MESSAGE CREATION =====
else if (state.state === 'awaiting_gift_amount' && isAdmin(userId)) {
    const amount = parseInt(text.replace(/\D/g, ''));
    
    if (isNaN(amount) || amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
        bot.sendMessage(chatId, 
            `❌ Invalid amount!\n\n` +
            `💰 Min: Rp ${formatIDR(MIN_TOPUP_AMOUNT)}\n` +
            `💰 Max: Rp ${formatIDR(MAX_TOPUP_AMOUNT)}`
        ).catch(() => {});
        return;
    }
    
    state.gift_amount = amount;
    state.state = 'awaiting_gift_message';
    userStates[chatId] = state;
    
    bot.sendMessage(chatId,
        `✅ Amount: Rp ${formatIDR(amount)}\n\n` +
        `Step 2/4: Enter GIFT MESSAGE\n\n` +
        `This message will be sent to all users with claim button.\n\n` +
        `Example:\n` +
        `"🎉 Special Gift for Our Members!\n` +
        `Get FREE Rp 50,000 balance now!\n` +
        `Click below to claim! 🎁"\n\n` +
        `💡 Send your message now:`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

else if (state.state === 'awaiting_gift_message' && isAdmin(userId)) {
    state.gift_message = text;
    state.state = 'awaiting_gift_max_claims';
    userStates[chatId] = state;
    
    bot.sendMessage(chatId,
        `✅ Message saved!\n\n` +
        `Step 3/4: MAXIMUM CLAIMS\n\n` +
        `How many total claims allowed?\n\n` +
        `Examples:\n` +
        `• 0 = Unlimited total claims\n` +
        `• 100 = Stop after 100 total claims\n` +
        `• 1 = Only 1 total claim allowed\n\n` +
        `Enter number:`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

else if (state.state === 'awaiting_gift_max_claims' && isAdmin(userId)) {
    const maxClaims = parseInt(text.replace(/\D/g, ''));
    
    if (isNaN(maxClaims) || maxClaims < 0) {
        bot.sendMessage(chatId, '❌ Enter 0 or positive number!').catch(() => {});
        return;
    }
    
    state.gift_max_claims = maxClaims === 0 ? null : maxClaims;
    state.state = 'awaiting_gift_one_per_user';
    userStates[chatId] = state;
    
    bot.sendMessage(chatId,
        `✅ Max Claims: ${maxClaims === 0 ? 'Unlimited' : maxClaims}\n\n` +
        `Step 4/4: ONE CLAIM PER USER?\n\n` +
        `Should each user claim only once?\n\n` +
        `Reply:\n` +
        `• YES = Users can claim only once\n` +
        `• NO = Users can claim multiple times (until max reached)\n\n` +
        `💡 You can toggle this later in gift settings`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

else if (state.state === 'awaiting_gift_one_per_user' && isAdmin(userId)) {
    const answer = text.trim().toUpperCase();
    
    if (answer !== 'YES' && answer !== 'NO') {
        bot.sendMessage(chatId, '❌ Reply YES or NO only!').catch(() => {});
        return;
    }
    
    const giftId = getNextGiftId();
    
    const giftMessage = {
        gift_id: giftId,
        amount: state.gift_amount,
        message: state.gift_message,
        max_claims: state.gift_max_claims,
        one_claim_per_user: (answer === 'YES'),
        claimed_count: 0,
        claimed_by: [],
        active: true,
        created_by: userId,
        created_at: new Date().toISOString(),
        expires_at: null
    };
    
    addGiftMessage(giftMessage);
    delete userStates[chatId];
    
    bot.sendMessage(chatId,
        `✅ *GIFT MESSAGE CREATED!*\n\n` +
        `🎁 Gift ID: #G${giftId}\n` +
        `💰 Amount: Rp ${formatIDR(giftMessage.amount)}\n` +
        `🔢 Max Claims: ${giftMessage.max_claims || 'Unlimited'}\n` +
        `🔒 One/User: ${giftMessage.one_claim_per_user ? 'Yes ✅' : 'No ❌'}\n` +
        `✅ Status: Active\n\n` +
        `💡 You can toggle "One/User" later in gift settings\n\n` +
        `📢 Broadcasting to all users now...`,
        { parse_mode: 'Markdown' }
    ).then(() => {
        // Broadcast to all users
        const users = getUsers();
        const userIds = Object.keys(users).filter(id => parseInt(id) !== ADMIN_TELEGRAM_ID);
        
        let success = 0;
        let failed = 0;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: `🎁 Claim Rp ${formatIDR(giftMessage.amount)}`, callback_data: `claim_gift_${giftId}` }]
            ]
        };
        
        const promises = userIds.map(uId => {
            return bot.sendMessage(uId, 
                `${giftMessage.message}\n\n` +
                `💰 Free Balance: Rp ${formatIDR(giftMessage.amount)}\n` +
                `${giftMessage.max_claims ? `⚡ Limited: ${giftMessage.max_claims} total claims!\n` : ''}` +
                `${giftMessage.one_claim_per_user ? `🔒 One claim per user only!\n` : ''}` +
                `👇 Click button below to claim!`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            )
            .then(() => { success++; })
            .catch(() => { failed++; });
        });
        
        Promise.all(promises).then(() => {
            bot.sendMessage(chatId,
                `📢 *Broadcast Complete!*\n\n` +
                `✅ Success: ${success}\n` +
                `❌ Failed: ${failed}\n` +
                `📊 Total users: ${userIds.length}\n\n` +
                `Users can now claim the gift!\n` +
                `Use 📋 View Gifts to manage it.`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        });
    }).catch(() => {});
}        
        // Budget calculator
        else if (state.state === 'awaiting_budget_calc') {
            const budget = parseInt(text.replace(/\D/g, ''));
            
            if (isNaN(budget) || budget < 1) {
                bot.sendMessage(chatId, '❌ Please enter a valid amount!').catch(() => {});
                return;
            }
            
            const result = calculateQuantityForBudget(budget);
            
            if (result.quantity === 0) {
                bot.sendMessage(chatId,
                    `💰 *BUDGET CALCULATION*\n\n` +
                    `Your Budget: Rp ${formatIDR(budget)}\n\n` +
                    `❌ Budget too low!\n\n` +
                    `Minimum price: Rp ${formatIDR(getPricePerUnit(1))}/account`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            } else {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: `🛒 Order ${result.quantity} links`, callback_data: 'order' }],
                        [{ text: '🧮 Calculate Again', callback_data: 'open_calculator' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                    ]
                };
                const bonusQuantity = getBonusQuantity(result.quantity);
                const totalQuantity = result.quantity + bonusQuantity;
                const bonusText = bonusQuantity > 0
                    ? `🎁 Bonus: +${bonusQuantity} links (Total delivered: ${totalQuantity})\n\n`
                    : '';

                bot.sendMessage(chatId,
                    `💰 *BUDGET CALCULATION*\n\n` +
                    `Your Budget: Rp ${formatIDR(budget)}\n\n` +
                    `✅ You can buy: *${result.quantity} links*\n` +
                    `💵 Price per account: Rp ${formatIDR(result.pricePerUnit)}\n` +
                    `💳 Total cost: Rp ${formatIDR(result.price)}\n` +
                    `💰 Change: Rp ${formatIDR(budget - result.price)}\n\n` +
                    bonusText +
                    `🎟️ Use coupon codes for extra discounts!`,
                    { parse_mode: 'Markdown', reply_markup: keyboard }
                ).catch(() => {});
            }
            
            delete userStates[chatId];
        }
        
        // Quantity calculator
        else if (state.state === 'awaiting_quantity_calc') {
            const quantity = parseInt(text.replace(/\D/g, ''));
            
            if (isNaN(quantity) || quantity < 1) {
                bot.sendMessage(chatId, '❌ Please enter a valid number!').catch(() => {});
                return;
            }
            
            const totalPrice = calculatePrice(quantity);
            const pricePerUnit = getPricePerUnit(quantity);
            
            const pricing = getPricing();
            const firstRangePrice = pricing[Object.keys(pricing)[0]];
            const savings = (firstRangePrice - pricePerUnit) * quantity;
            const bonusQuantity = getBonusQuantity(quantity);
            const totalQuantity = quantity + bonusQuantity;

            const keyboard = {
                inline_keyboard: [
                    [{ text: `🛒 Order ${quantity} links`, callback_data: 'order' }],
                    [{ text: '🧮 Calculate Again', callback_data: 'open_calculator' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_main' }]
                ]
            };
            
            let savingsText = '';
            if (savings > 0) {
                savingsText = `\n💸 You save: Rp ${formatIDR(savings)} vs regular price!\n`;
            }
            const bonusText = bonusQuantity > 0
                ? `\n🎁 Bonus: +${bonusQuantity} links (Total delivered: ${totalQuantity})\n`
                : '';

            bot.sendMessage(chatId,
                `📦 *QUANTITY CALCULATION*\n\n` +
                `Quantity: *${quantity} links*\n\n` +
                `💵 Price per account: Rp ${formatIDR(pricePerUnit)}\n` +
                `💰 Total price: *Rp ${formatIDR(totalPrice)}*\n` +
                `${savingsText}${bonusText}\n` +
                `🎟️ Use coupon codes for extra discounts!`,
                { parse_mode: 'Markdown', reply_markup: keyboard }
            ).catch(() => {});
            
            delete userStates[chatId];
        }
        
        // Pricing update
        else if (state.state === 'awaiting_new_pricing' && isAdmin(userId)) {
            const parts = text.trim().split(/\s+/);
            const newPricing = {};

            let valid = true;
            parts.forEach(part => {
                const match = part.match(/^(.+)=(\d+)$/);
                if (match) {
                    newPricing[match[1]] = parseInt(match[2]);
                } else {
                    valid = false;
                }
            });
            
            if (!valid || Object.keys(newPricing).length === 0) {
                bot.sendMessage(chatId, '❌ Invalid format! Example: 1-99=500 100-199=450 200+=400').catch(() => {});
                return;
            }
            
            updatePricing(newPricing);
            
            const pricingText = Object.keys(newPricing).map(range => 
                `• ${range}: Rp ${formatIDR(newPricing[range])}`
            ).join('\n');
            
            bot.sendMessage(chatId,
                `✅ *PRICING UPDATED!*\n\n` +
                `${pricingText}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});

            delete userStates[chatId];
        }
        else if (state.state === 'awaiting_custom_product' && isAdmin(userId)) {
            const parts = text.split('|').map(p => p.trim()).filter(Boolean);

            if (parts.length < 3) {
                bot.sendMessage(chatId,
                    '❌ Invalid format! Use: Title | Price | Description | Button Text | Button URL'
                ).catch(() => {});
                return;
            }

            const [title, priceRaw, description, buttonLabel, buttonUrl] = parts;
            const price = parseInt(priceRaw.replace(/\D/g, '')) || 0;

            const content = getCustomContent();
            const product = {
                id: Date.now(),
                title,
                price,
                description,
                button_label: buttonLabel || null,
                button_url: buttonUrl || null
            };

            content.products = [...(content.products || []), product];
            saveCustomContent(content);

            bot.sendMessage(chatId,
                `✅ *CUSTOM PRODUCT SAVED*\n\n` +
                `• ${escapeMarkdown(title)} — Rp ${formatIDR(price)}\n` +
                `${description ? `📝 ${escapeMarkdown(description)}` : ''}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});

            delete userStates[chatId];
        }
        else if (state.state === 'awaiting_custom_button' && isAdmin(userId)) {
            const parts = text.split('|').map(p => p.trim()).filter(Boolean);

            if (parts.length < 2) {
                bot.sendMessage(chatId, '❌ Invalid format! Use: Button text | https://link').catch(() => {});
                return;
            }

            const [label, url] = parts;
            if (!url.startsWith('http')) {
                bot.sendMessage(chatId, '❌ URL must start with http/https!').catch(() => {});
                return;
            }

            const content = getCustomContent();
            content.buttons = [
                ...(content.buttons || []),
                { id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, label, url }
            ];
            saveCustomContent(content);

            bot.sendMessage(chatId,
                `✅ *BUTTON ADDED*\n\n` +
                `• ${escapeMarkdown(label)}\n` +
                `${url}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});

            delete userStates[chatId];
        }
        else if (state.state === 'awaiting_bonus_input' && isAdmin(userId)) {
            const raw = text.trim();
            if (raw === '0') {
                saveBonuses([]);
                bot.sendMessage(chatId, '✅ All bonus deals disabled!').catch(() => {});
                delete userStates[chatId];
                return;
            }

            const lines = raw.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            if (lines.length === 0) {
                bot.sendMessage(chatId, '❌ Please send at least one bonus rule or 0 to clear.').catch(() => {});
                return;
            }

            const newBonuses = [];
            for (const line of lines) {
                const [configPart, descriptionPart] = line.split('|').map(part => part.trim());
                const match = configPart.match(/^(\d+)\s*(?:[:=x])\s*(\d+)$/i);
                if (!match) {
                    bot.sendMessage(chatId, `❌ Invalid format: "${configPart}"\nUse MIN=BONUS`).catch(() => {});
                    return;
                }
                const min = parseInt(match[1]);
                const bonusQty = parseInt(match[2]);
                if (min < 1 || bonusQty < 1) {
                    bot.sendMessage(chatId, '❌ Min and bonus must be at least 1!').catch(() => {});
                    return;
                }
                newBonuses.push({
                    min_quantity: min,
                    bonus_quantity: bonusQty,
                    description: descriptionPart && descriptionPart.length > 0
                        ? descriptionPart
                        : `Buy ${min}+ get ${bonusQty} free`
                });
            }

            newBonuses.sort((a, b) => a.min_quantity - b.min_quantity);
            saveBonuses(newBonuses);

            bot.sendMessage(chatId,
                `✅ *Bonus deals updated!*\n\n${formatBonusDealsList()}`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});

            delete userStates[chatId];
        }
        
        // Display stock update
        else if (state.state === 'awaiting_display_stock' && isAdmin(userId)) {
            const quantity = parseInt(text.replace(/\D/g, ''));
            
            if (isNaN(quantity) || quantity < 0) {
                bot.sendMessage(chatId, '❌ Invalid number!').catch(() => {});
                return;
            }
            
            const stock = getStock();
            updateStock(quantity, stock.links);
            
            bot.sendMessage(chatId, `✅ Display stock updated to ${quantity}!`).catch(() => {});
            delete userStates[chatId];
        }
        
        // Order quantity input
        else if (state.state === 'awaiting_order_quantity') {
            const quantity = parseInt(text);
            const stock = getStock();
            const bonusQuantity = getBonusQuantity(quantity);
            const totalRequired = quantity + bonusQuantity;

            if (isNaN(quantity) || quantity < 1) {
                bot.sendMessage(chatId, '❌ Please send a valid number!').catch(() => {});
                return;
            }

            if (totalRequired > stock.current_stock) {
                bot.sendMessage(chatId, `❌ Need ${totalRequired} links but only ${stock.current_stock} available!`).catch(() => {});
                return;
            }

            if (totalRequired > stock.links.length) {
                bot.sendMessage(chatId, `❌ Need ${totalRequired} links but actual stock is ${stock.links.length}!`).catch(() => {});
                return;
            }

            if (quantity > MAX_ORDER_QUANTITY) {
                bot.sendMessage(chatId, `❌ Maximum order: ${MAX_ORDER_QUANTITY} links!`).catch(() => {});
                return;
            }
            
            userStates[chatId] = {
                state: 'awaiting_coupon_code',
                userId: userId,
                quantity: quantity,
                user: msg.from,
                timestamp: Date.now()
            };
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '⏭️ Skip (No Coupon)', callback_data: 'skip_coupon' }]
                ]
            };

            bot.sendMessage(chatId,
                `✅ Quantity: ${quantity} links${bonusQuantity > 0 ? ` (+${bonusQuantity} bonus = ${totalRequired})` : ''}\n` +
                `${bonusQuantity > 0 ? `🎁 Bonus applied automatically!\n\n` : '\n'}` +
                `🎟️ Do you have a coupon code?\n\n` +
                `💡 Enter coupon code now to get instant discount!\n` +
                `Or click Skip to continue without coupon.`,
                { reply_markup: keyboard }
            ).catch(() => {});
        }
        
        // Admin get links handler
        else if (state.state === 'awaiting_admin_link_quantity' && isAdmin(userId)) {
            const quantity = parseInt(text.replace(/\D/g, ''));
            const stock = getStock();
            
            if (isNaN(quantity) || quantity < 1) {
                bot.sendMessage(chatId, '❌ Please enter a valid number!').catch(() => {});
                return;
            }
            
            if (quantity > stock.links.length) {
                bot.sendMessage(chatId, 
                    `❌ Only ${stock.links.length} links available!\n\n` +
                    `Try a smaller number.`
                ).catch(() => {});
                return;
            }
            
            if (quantity > 10000) {
                bot.sendMessage(chatId, '❌ Maximum 10000 links at a time!').catch(() => {});
                return;
            }
            
            delete userStates[chatId];
            
            const orderId = `ADMIN-${Date.now()}`;
            
            const adminOrder = {
                order_id: orderId,
                user_id: userId,
                username: 'ADMIN_REQUEST',
                quantity: quantity,
                original_price: 0,
                total_price: 0,
                discount_percent: 0,
                coupon_code: null,
                status: 'completed',
                payment_method: 'admin_test',
                date: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                admin_request: true,
                admin_note: 'Admin requested test links'
            };
            
            addOrder(adminOrder);
            
            bot.sendMessage(chatId, 
                `⏳ *PROCESSING...*\n\n` +
                `Preparing ${quantity} links for admin...\n\n` +
                `Please wait...`,
                { parse_mode: 'Markdown' }
            ).then(() => {
                deliverlinks(userId, orderId, quantity, 0).then(success => {
                    if (success) {
                        bot.sendMessage(chatId,
                            `✅ *DELIVERY COMPLETE*\n\n` +
                            `📋 Request ID: ${orderId}\n` +
                            `📦 Delivered: ${quantity} links\n` +
                            `🔗 Remaining: ${getStock().links.length}\n\n` +
                            `✅ Links sent successfully!\n\n` +
                            `📅 ${getCurrentDateTime()}`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                    } else {
                        bot.sendMessage(chatId,
                            `❌ *DELIVERY FAILED*\n\n` +
                            `Could not deliver links.\n` +
                            `Check stock availability.`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                    }
                });
            }).catch(() => {});
        }
        
        // Coupon code input
        else if (state.state === 'awaiting_coupon_code') {
            const quantity = state.quantity;
            const couponCode = text.trim().toUpperCase();
            
            if (couponCode === 'SKIP') {
                createOrder(chatId, userId, msg.from, quantity, null);
                return;
            }
            
            const validation = validateCoupon(couponCode, userId, quantity);
            
            if (!validation.valid) {
                bot.sendMessage(chatId,
                    `${validation.message}\n\n` +
                    `💡 Try another code or type SKIP to continue without coupon.`
                ).catch(() => {});
                return;
            }
            
            createOrder(chatId, userId, msg.from, quantity, validation.coupon);
        }
        
        // Balance order quantity
        else if (state.state === 'awaiting_balance_order_quantity') {
            const quantity = parseInt(text.replace(/\D/g, ''));
            const balance = getBalance(userId);
            const stock = getStock();
            const originalPrice = calculatePrice(quantity);
            const bonusQuantity = getBonusQuantity(quantity);
            const totalRequired = quantity + bonusQuantity;

            if (isNaN(quantity) || quantity < 1) {
                bot.sendMessage(chatId, '❌ Please send a valid number!').catch(() => {});
                return;
            }

            if (totalRequired > stock.current_stock || totalRequired > stock.links.length) {
                const available = Math.min(stock.current_stock, stock.links.length);
                bot.sendMessage(chatId, `❌ Need ${totalRequired} links but only ${available} available!`).catch(() => {});
                return;
            }
            
            if (originalPrice > balance) {
                bot.sendMessage(chatId, 
                    `❌ Insufficient balance!\n\n` +
                    `Need: Rp ${formatIDR(originalPrice)}\n` +
                    `Your balance: Rp ${formatIDR(balance)}\n\n` +
                    `💡 Top up or get daily bonus to increase balance!`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💵 Top Up', callback_data: 'topup_balance' }],
                                [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }]
                            ]
                        }
                    }
                ).catch(() => {});
                return;
            }
            
            if (originalPrice > MAX_TOPUP_AMOUNT) {
                bot.sendMessage(chatId,
                    `❌ Order exceeds maximum!\n\n` +
                    `Max transaction: Rp ${formatIDR(MAX_TOPUP_AMOUNT)}\n` +
                    `Your order: Rp ${formatIDR(originalPrice)}\n\n` +
                    `💡 Try a smaller quantity.`
                ).catch(() => {});
                return;
            }
            
            const coupons = getCoupons();
            const activeCoupons = Object.values(coupons).filter(c => 
                c.active && 
                quantity >= c.min_order &&
                (!c.max_uses || c.used_count < c.max_uses) &&
                (!c.used_by || !c.used_by.includes(userId))
            );
            
            if (activeCoupons.length > 0) {
                userStates[chatId] = {
                    state: 'awaiting_balance_coupon',
                    userId: userId,
                    quantity: quantity,
                    user: msg.from
                };
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '⏭️ Skip (No Coupon)', callback_data: 'skip_balance_coupon' }]
                    ]
                };
                
                bot.sendMessage(chatId,
                    `✅ Quantity: ${quantity} links${bonusQuantity > 0 ? ` (+${bonusQuantity} bonus = ${totalRequired})` : ''}\n` +
                    `💰 Price: Rp ${formatIDR(originalPrice)}\n\n` +
                    `🎟️ You can use a coupon code!\n\n` +
                    `💡 Enter coupon code to get discount\n` +
                    `Or click Skip to continue.`,
                    { reply_markup: keyboard }
                ).catch(() => {});
                return;
            }
            
            processBalanceOrder(chatId, userId, msg.from, quantity, null);
        }
        
        // Balance order coupon
        else if (state.state === 'awaiting_balance_coupon') {
            const couponCode = text.trim().toUpperCase();
            
            if (couponCode === 'SKIP') {
                processBalanceOrder(chatId, userId, state.user, state.quantity, null);
                return;
            }
            
            const validation = validateCoupon(couponCode, userId, state.quantity);
            
            if (!validation.valid) {
                bot.sendMessage(chatId,
                    `${validation.message}\n\n` +
                    `💡 Try another code or type SKIP.`
                ).catch(() => {});
                return;
            }
            
            processBalanceOrder(chatId, userId, state.user, state.quantity, validation.coupon);
        }
        
        // Broadcast handler
        else if (state.state === 'awaiting_broadcast' && isAdmin(userId)) {
            handleBroadcastText(chatId, text);
        }
        
        // Custom order handler
        else if (state.state === 'awaiting_custom_order' && isAdmin(userId)) {
            if (state.step === 'user_id') {
                const targetUserId = parseInt(text.replace(/\D/g, ''));
                
                if (isNaN(targetUserId)) {
                    bot.sendMessage(chatId, '❌ Invalid user ID!').catch(() => {});
                    return;
                }
                
                state.target_user_id = targetUserId;
                state.step = 'quantity';
                userStates[chatId] = state;
                
                bot.sendMessage(chatId,
                    `✅ User ID: ${targetUserId}\n\n` +
                    `Step 2/3: Enter QUANTITY\n\n` +
                    `Example: 100`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            else if (state.step === 'quantity') {
                const quantity = parseInt(text.replace(/\D/g, ''));
                
                if (isNaN(quantity) || quantity < 1) {
                    bot.sendMessage(chatId, '❌ Invalid quantity!').catch(() => {});
                    return;
                }
                
                state.quantity = quantity;
                state.step = 'price';
                userStates[chatId] = state;
                
                const defaultPrice = calculatePrice(quantity);
                
                bot.sendMessage(chatId,
                    `✅ Quantity: ${quantity}\n\n` +
                    `Step 3/3: Enter CUSTOM PRICE\n\n` +
                    `Default price: Rp ${formatIDR(defaultPrice)}\n\n` +
                    `Enter custom price (or 0 for free):`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            else if (state.step === 'price') {
                const customPrice = parseInt(text.replace(/\D/g, ''));

                if (isNaN(customPrice) || customPrice < 0) {
                    bot.sendMessage(chatId, '❌ Invalid price!').catch(() => {});
                    return;
                }

                const orderId = getNextOrderId();
                const users = getUsers();
                const targetUser = users[state.target_user_id];
                const activeBonus = getActiveBonus(state.quantity);
                const bonusQuantity = activeBonus ? activeBonus.bonus_quantity : 0;
                const totalQuantity = state.quantity + bonusQuantity;

                if (!targetUser) {
                    bot.sendMessage(chatId, '❌ User not found in database!').catch(() => {});
                    delete userStates[chatId];
                    return;
                }

                const order = {
                    order_id: orderId,
                    user_id: state.target_user_id,
                    username: targetUser.username,
                    quantity: state.quantity,
                    bonus_quantity: bonusQuantity,
                    total_quantity: totalQuantity,
                    bonus_description: activeBonus ? activeBonus.description : null,
                    original_price: customPrice,
                    total_price: customPrice,
                    discount_percent: 0,
                    coupon_code: null,
                    status: 'completed',
                    payment_method: 'custom',
                    date: new Date().toISOString(),
                    completed_at: new Date().toISOString(),
                    custom_order: true,
                    created_by_admin: userId
                };
                
                addOrder(order);
                
                if (users[state.target_user_id]) {
                    users[state.target_user_id].total_orders = (users[state.target_user_id].total_orders || 0) + 1;
                    users[state.target_user_id].completed_orders = (users[state.target_user_id].completed_orders || 0) + 1;
                    saveJSON(USERS_FILE, users);
                }
                
                delete userStates[chatId];

                const delivered = await deliverlinks(state.target_user_id, orderId, state.quantity, bonusQuantity);

                if (delivered) {
                    bot.sendMessage(chatId,
                        `✅ *CUSTOM ORDER CREATED & DELIVERED!*\n\n` +
                        `📋 Order ID: #${orderId}\n` +
                        `👤 User: @${escapeMarkdown(targetUser.username)}\n` +
                        `📦 Quantity: ${state.quantity}${bonusQuantity > 0 ? ` (+${bonusQuantity} bonus = ${totalQuantity})` : ''}\n` +
                        `💰 Price: Rp ${formatIDR(customPrice)}\n\n` +
                        `✅ links sent successfully!`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                } else {
                    bot.sendMessage(chatId,
                        `❌ *ORDER CREATED BUT DELIVERY FAILED!*\n\n` +
                        `Insufficient stock!\n` +
                        `Order #${orderId}`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }
            }
        }
        
        // Coupon creation handler
        else if (state.state === 'awaiting_coupon_data' && isAdmin(userId)) {
            handleCouponCreation(chatId, text, userId);
        }
        
    } catch (error) {
        console.error('Error in message handler:', error.message);
    }
});

// ============================================
// BROADCAST HANDLERS
// ============================================

function handleBroadcastText(chatId, text) {
    try {
        const users = getUsers();
        const userIds = Object.keys(users).filter(id => parseInt(id) !== ADMIN_TELEGRAM_ID);
        
        if (userIds.length === 0) {
            bot.sendMessage(chatId, '❌ No users to broadcast!').catch(() => {});
            delete userStates[chatId];
            return;
        }
        
        let success = 0;
        let failed = 0;
        
        bot.sendMessage(chatId, `📤 Broadcasting to ${userIds.length} users...`).then(statusMsg => {
            const promises = userIds.map(userId => {
                return bot.sendMessage(userId, text, { parse_mode: 'Markdown' })
                    .then(() => { success++; })
                    .catch(() => {
                        return bot.sendMessage(userId, text)
                            .then(() => { success++; })
                            .catch(() => { failed++; });
                    });
            });
            
            Promise.all(promises).then(() => {
                bot.editMessageText(
                    `✅ *Broadcast Complete!*\n\n` +
                    `✅ Success: ${success}\n` +
                    `❌ Failed: ${failed}\n` +
                    `📊 Total: ${userIds.length}`,
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                ).catch(() => {});
                delete userStates[chatId];
            });
        }).catch(() => {});
    } catch (error) {
        console.error('Error in handleBroadcastText:', error.message);
    }
}

// ============================================
// COUPON CREATION HANDLER
// ============================================

function handleCouponCreation(chatId, text, userId) {
    try {
        if (!isAdmin(userId)) return;
        
        const state = userStates[chatId];
        
        if (state.step === 'code') {
            const code = text.trim().toUpperCase().replace(/\s/g, '');
            if (code.length < 2) {
                bot.sendMessage(chatId, '❌ Code must be at least 2 characters!').catch(() => {});
                return;
            }
            
            const coupons = getCoupons();
            if (coupons[code]) {
                bot.sendMessage(chatId, `❌ Coupon "${code}" already exists!`).catch(() => {});
                return;
            }
            
            state.couponData = { code: code };
            state.step = 'discount';
            userStates[chatId] = state;
            
            bot.sendMessage(chatId,
                `✅ Code: *${code}*\n\n` +
                `Step 2/6: Enter DISCOUNT percentage\n\n` +
                `Example: 10 (for 10% off)\n` +
                `Range: 1-100`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        } 
        else if (state.step === 'discount') {
            const discount = parseInt(text);
            if (isNaN(discount) || discount < 1 || discount > 100) {
                bot.sendMessage(chatId, '❌ Enter a number between 1-100!').catch(() => {});
                return;
            }
            
            state.couponData.discount_percent = discount;
            state.step = 'min_order';
            userStates[chatId] = state;
            
            bot.sendMessage(chatId,
                `✅ Discount: *${discount}%*\n\n` +
                `Step 3/6: MINIMUM order quantity\n\n` +
                `Example: 1 (any order) or 10 (min 10 links)\n` +
                `Enter number:`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        } 
        else if (state.step === 'min_order') {
            const minOrder = parseInt(text);
            if (isNaN(minOrder) || minOrder < 1) {
                bot.sendMessage(chatId, '❌ Enter valid number (minimum 1)!').catch(() => {});
                return;
            }
            
            state.couponData.min_order = minOrder;
            state.step = 'max_uses';
            userStates[chatId] = state;
            
            bot.sendMessage(chatId,
                `✅ Min Order: *${minOrder} links*\n\n` +
                `Step 4/6: MAXIMUM USES\n\n` +
                `Examples:\n` +
                `• 0 = Unlimited uses\n` +
                `• 100 = Can be used 100 times total\n` +
                `• 1 = Single use only\n\n` +
                `Enter number:`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        } 
        else if (state.step === 'max_uses') {
            const maxUses = parseInt(text);
            if (isNaN(maxUses) || maxUses < 0) {
                bot.sendMessage(chatId, '❌ Enter 0 or positive number!').catch(() => {});
                return;
            }
            
            state.couponData.max_uses = maxUses === 0 ? null : maxUses;
            state.step = 'users_limit';
            userStates[chatId] = state;
            
            bot.sendMessage(chatId,
                `✅ Max Uses: *${maxUses === 0 ? 'Unlimited' : maxUses}*\n\n` +
                `Step 5/6: PER USER LIMIT\n\n` +
                `How many times can ONE user use this?\n\n` +
                `Examples:\n` +
                `• 0 = No limit per user\n` +
                `• 1 = Each user can use only once\n\n` +
                `Enter number:`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
        else if (state.step === 'users_limit') {
            const usersLimit = parseInt(text);
            if (isNaN(usersLimit) || usersLimit < 0) {
                bot.sendMessage(chatId, '❌ Enter 0 or positive number!').catch(() => {});
                return;
            }
            
            state.couponData.per_user_limit = usersLimit === 0 ? null : usersLimit;
            state.step = 'first_order';
            userStates[chatId] = state;
            
            bot.sendMessage(chatId,
                `✅ Per User Limit: *${usersLimit === 0 ? 'No limit' : usersLimit + ' time(s)'}*\n\n` +
                `Step 6/6: FIRST ORDER ONLY?\n\n` +
                `Reply:\n` +
                `• YES = Only for first-time customers\n` +
                `• NO = Anyone can use it\n\n` +
                `💡 First-time = users with no completed orders`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        } 
        else if (state.step === 'first_order') {
            const answer = text.trim().toUpperCase();
            if (answer !== 'YES' && answer !== 'NO') {
                bot.sendMessage(chatId, '❌ Reply YES or NO only!').catch(() => {});
                return;
            }
            
            const couponData = {
                code: state.couponData.code,
                discount_percent: state.couponData.discount_percent,
                description: `${state.couponData.discount_percent}% off`,
                min_order: state.couponData.min_order,
                max_uses: state.couponData.max_uses,
                per_user_limit: state.couponData.per_user_limit,
                used_count: 0,
                used_by: [],
                user_usage: {},
                expires_at: null,
                active: true,
                first_order_only: (answer === 'YES'),
                created_at: new Date().toISOString()
            };
            
            addCoupon(couponData);
            
            bot.sendMessage(chatId,
                `✅ *COUPON CREATED SUCCESSFULLY!*\n\n` +
                `🎟️ *Code:* ${couponData.code}\n` +
                `💰 *Discount:* ${couponData.discount_percent}% OFF\n` +
                `📦 *Min Order:* ${couponData.min_order} links\n` +
                `🔢 *Max Uses:* ${couponData.max_uses || 'Unlimited'}\n` +
                `👤 *Per User:* ${couponData.per_user_limit || 'No limit'}\n` +
                `👥 *First Order Only:* ${couponData.first_order_only ? 'Yes' : 'No'}\n` +
                `✅ *Status:* Active\n\n` +
                `📢 Broadcasting to all users now...`,
                { parse_mode: 'Markdown' }
            ).then(() => {
                broadcastNewCoupon(couponData).then(result => {
                    bot.sendMessage(chatId,
                        `📢 *Broadcast Complete!*\n\n` +
                        `✅ Success: ${result.success}\n` +
                        `❌ Failed: ${result.failed}\n` +
                        `📊 Total users: ${result.total}`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }).catch(() => {});
            }).catch(() => {});
            
            delete userStates[chatId];
        }
    } catch (error) {
        console.error('Error in handleCouponCreation:', error.message);
    }
}

// ============================================
// STARTUP MESSAGE
// ============================================

console.log('\n╔════════════════════════════════════════════════╗');
console.log('║   ✅ BOT INITIALIZATION SUCCESSFUL            ║');
console.log('║   🚀 VERSION 7.0.0 - TOP-UP SYSTEM ADDED     ║');
console.log('╚════════════════════════════════════════════════╝\n');
console.log('✨ ALL FEATURES - 100% BUTTON-BASED:');
console.log('  ✅ Payment Verification - Admin Buttons');
console.log('  💵 Top-Up System (0-100k IDR)');
console.log('  💰 Admin Add Balance (0-100k IDR)');
console.log('  📱 GoPay QR Payment Support');
console.log('  👥 Users List with Tap-to-Copy');
console.log('  🧮 Smart Price Calculator');
console.log('  📢 Auto-Broadcast on Stock Updates');
console.log('  📋 Tap-to-Copy Links Delivery');
console.log('  💳 Balance-Based Ordering');
console.log('  🎟️ Advanced Coupon System');
console.log('  🛒 Custom Orders for Admin');
console.log('  📊 Complete Admin Panel');
console.log('  📈 Analytics Dashboard');
console.log('  📥 Admin Test Links Feature');
console.log('  ⚡ Enhanced Error Handling\n');
console.log('📊 Bot Configuration:');
console.log(`  👤 Admin: ${ADMIN_USERNAME}`);
console.log(`  🆔 Admin ID: ${ADMIN_TELEGRAM_ID}`);
console.log(`  💵 Top-up Range: ${formatIDR(MIN_TOPUP_AMOUNT)} - ${formatIDR(MAX_TOPUP_AMOUNT)}`);
console.log(`  📅 Started: ${getCurrentDateTime()}`);
console.log(`  🔢 Order Counter: #${getOrderCounter().last_order_id}`);
console.log(`  🔢 Top-up Counter: #T${getOrderCounter().last_topup_id || 0}`);
console.log(`  🎁 Gift Counter: #G${getOrderCounter().last_gift_id || 0}`);
console.log('  🎁 Free Gift Messages Feature');
console.log('\n🎯 Bot Status: READY & WAITING');
console.log('💡 Users: Tap buttons to use all features!\n');
console.log('═══════════════════════════════════════════════════\n');
console.log('👨‍💻 Developer: Adeebaabkhan (@itsmeaab)');
console.log('📅 Updated: 2025-01-28 13:39:30 UTC');
console.log('🚀 Version 7.0.0 - Complete Top-Up System\n');
console.log('✨ FULLY FUNCTIONAL - ALL BUTTONS WORKING! ✨\n');
console.log('═══════════════════════════════════════════════════\n');
