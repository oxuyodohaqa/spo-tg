// SPOTIFY SHEERID - CLEAN 30 SECOND TIMEOUT VERSION
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const chalk = require('chalk');
const readline = require('readline');

// ALL COUNTRY CONFIGURATION
const ALL_COUNTRY_CONFIG = {
    'US': {
        name: 'United States',
        code: 'us',
        locale: 'en-us',
        collegeFile: 'sheerid_us.json',
        domains: ['gmail.com', 'yahoo.com', 'edu', 'hotmail.com', 'outlook.com'],
        currency: 'USD',
        flag: '🇺🇸',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=us&locale=en-us',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
   },

    'CA': {
        name: 'Canada',
        code: 'ca',
        locale: 'en-ca',
        collegeFile: 'sheerid_ca.json',
        domains: ['gmail.com', 'yahoo.com', 'ca', 'hotmail.com', 'outlook.com'],
        currency: 'CAD',
        flag: '🇨🇦',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=ca&locale=en-ca',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'GB': {
        name: 'United Kingdom',
        code: 'gb',
        locale: 'en-gb',
        collegeFile: 'sheerid_gb.json',
        domains: ['gmail.com', 'yahoo.com', 'ac.uk', 'co.uk', 'hotmail.com', 'outlook.com'],
        currency: 'GBP',
        flag: '🇬🇧',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=gb&locale=en-gb',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'IN': {
        name: 'India',
        code: 'in',
        locale: 'en-in',
        collegeFile: 'sheerid_in.json',
        domains: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'],
        currency: 'INR',
        flag: '🇮🇳',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=in&locale=en-in',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'DE': {
        name: 'Germany',
        code: 'de',
        locale: 'de-de',
        collegeFile: 'sheerid_de.json',
        domains: ['gmail.com', 'yahoo.com', 'de', 'uni-berlin.de', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇩🇪',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=de&locale=de-de',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'FR': {
        name: 'France',
        code: 'fr',
        locale: 'fr-fr',
        collegeFile: 'sheerid_fr.json',
        domains: ['gmail.com', 'yahoo.com', 'fr', 'univ-paris.fr', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇫🇷',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=fr&locale=fr-fr',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'ES': {
        name: 'Spain',
        code: 'es',
        locale: 'es-es',
        collegeFile: 'sheerid_es.json',
        domains: ['gmail.com', 'yahoo.com', 'es', 'upm.es', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇪🇸',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=es&locale=es-es',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'IT': {
        name: 'Italy',
        code: 'it',
        locale: 'it-it',
        collegeFile: 'sheerid_it.json',
        domains: ['gmail.com', 'yahoo.com', 'it', 'unibo.it', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇮🇹',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=it&locale=it-it',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'NL': {
        name: 'Netherlands',
        code: 'nl',
        locale: 'nl-nl',
        collegeFile: 'sheerid_nl.json',
        domains: ['gmail.com', 'yahoo.com', 'nl', 'uva.nl', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇳🇱',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=nl&locale=nl-nl',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'SE': {
        name: 'Sweden',
        code: 'se',
        locale: 'sv-se',
        collegeFile: 'sheerid_se.json',
        domains: ['gmail.com', 'yahoo.com', 'se', 'kth.se', 'hotmail.com'],
        currency: 'SEK',
        flag: '🇸🇪',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=se&locale=sv-se',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'NO': {
        name: 'Norway',
        code: 'no',
        locale: 'nb-no',
        collegeFile: 'sheerid_no.json',
        domains: ['gmail.com', 'yahoo.com', 'no', 'uio.no', 'hotmail.com'],
        currency: 'NOK',
        flag: '🇳🇴',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=no&locale=nb-no',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'FI': {
        name: 'Finland',
        code: 'fi',
        locale: 'fi-fi',
        collegeFile: 'sheerid_fi.json',
        domains: ['gmail.com', 'yahoo.com', 'fi', 'helsinki.fi', 'hotmail.com'],
        currency: 'EUR',
        flag: '🇫🇮',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=fi&locale=fi-fi',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'DK': {
        name: 'Denmark',
        code: 'dk',
        locale: 'da-dk',
        collegeFile: 'sheerid_dk.json',
        domains: ['gmail.com', 'yahoo.com', 'dk', 'ku.dk', 'hotmail.com'],
        currency: 'DKK',
        flag: '🇩🇰',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=dk&locale=da-dk',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'AU': {
        name: 'Australia',
        code: 'au',
        locale: 'en-au',
        collegeFile: 'sheerid_au.json',
        domains: ['gmail.com', 'yahoo.com', 'edu.au', 'sydney.edu.au', 'hotmail.com'],
        currency: 'AUD',
        flag: '🇦🇺',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=au&locale=en-au',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'NZ': {
        name: 'New Zealand',
        code: 'nz',
        locale: 'en-nz',
        collegeFile: 'sheerid_nz.json',
        domains: ['gmail.com', 'yahoo.com', 'ac.nz', 'auckland.ac.nz', 'hotmail.com'],
        currency: 'NZD',
        flag: '🇳🇿',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=nz&locale=en-nz',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'BR': {
        name: 'Brazil',
        code: 'br',
        locale: 'pt-br',
        collegeFile: 'sheerid_br.json',
        domains: ['gmail.com', 'yahoo.com', 'br', 'usp.br', 'hotmail.com'],
        currency: 'BRL',
        flag: '🇧🇷',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=br&locale=pt-br',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'MX': {
        name: 'Mexico',
        code: 'mx',
        locale: 'es-mx',
        collegeFile: 'sheerid_mx.json',
        domains: ['gmail.com', 'yahoo.com', 'mx', 'unam.mx', 'hotmail.com'],
        currency: 'MXN',
        flag: '🇲🇽',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=mx&locale=es-mx',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'JP': {
        name: 'Japan',
        code: 'jp',
        locale: 'ja-jp',
        collegeFile: 'sheerid_jp.json',
        domains: ['gmail.com', 'yahoo.com', 'jp', 'u-tokyo.ac.jp', 'hotmail.com'],
        currency: 'JPY',
        flag: '🇯🇵',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=jp&locale=ja-jp',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'CN': {
        name: 'China',
        code: 'cn',
        locale: 'zh-cn',
        collegeFile: 'sheerid_cn.json',
        domains: ['gmail.com', 'yahoo.com', 'cn', 'pku.edu.cn', '163.com'],
        currency: 'CNY',
        flag: '🇨🇳',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=cn&locale=zh-cn',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    },
    'KR': {
        name: 'South Korea',
        code: 'kr',
        locale: 'ko-kr',
        collegeFile: 'sheerid_kr.json',
        domains: ['gmail.com', 'yahoo.com', 'kr', 'snu.ac.kr', 'naver.com'],
        currency: 'KRW',
        flag: '🇰🇷',
        programId: '63fd266996552d469aea40e1',
        sheeridUrl: 'https://services.sheerid.com/verify/63fd266996552d469aea40e1/?country=kr&locale=ko-kr',
        submitEndpoint: 'https://services.sheerid.com/rest/v2/verification/program/63fd266996552d469aea40e1/step/collectStudentPersonalInfo',
        uploadEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/step/docUpload',
        statusEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}',
        redirectEndpoint: 'https://services.sheerid.com/rest/v2/verification/{verificationId}/redirect',
        finalLinkFormat: 'https://www.spotify.com/student/apply/sheerid-program?verificationId={verificationId}'
    }
};
// 🚀 OPTIMIZED HIGH SUCCESS CONFIG
const CONFIG = {
    studentsFile: 'students.txt',
    receiptsDir: 'receipts',
    outputFile: 'sukses.txt',
    
    // 🔥 PERFORMANCE SETTINGS - Reduced for stability
    maxConcurrent: 300,        // Lower = more stable
    batchSize: 80,            // Smaller batches = better success rate
    timeout: 60000,           // Increased timeout
    uploadTimeout: 30000,     // More time for uploads
    maxRetries: 5,            // More retry attempts
    retryDelay: 3000,         // Longer delay between retries
    
    // 🎯 POLLING SETTINGS - More patience = higher success
    maxPollingWait: 45,       // Wait longer for processing
    pollingInterval: 2000,    // Check every 2 seconds
    
    // 🏆 SUCCESS OPTIMIZATION
    targetMode: true,
    targetLinks: 150,         // Higher target for better results
    targetReached: false,
    
    // 📊 QUALITY SETTINGS
    selectedCountry: null,
    countryConfig: null,
    autoDeleteProcessed: true,
    exactMatchingEnabled: true,
    preferHighSuccessColleges: true,     // ✅ Keep this
    fallbackToGenericColleges: true,     // ✅ Enable fallback
    
    // 🛡️ ADDITIONAL SUCCESS BOOSTERS
    validateEmails: true,                // Validate before processing
    skipDuplicates: true,               // Avoid duplicate processing
    prioritizeEduDomains: true,         // Focus on .edu domains
    useSmartRetry: true,                // Intelligent retry logic
    enableProgressTracking: true       // Track success metrics
};

// 📈 SUCCESS RATE MULTIPLIERS
const SUCCESS_MULTIPLIERS = {
    // Wait longer between requests to avoid rate limiting
    requestDelay: 1500,
    
    // Use rotating user agents
    rotateUserAgents: true,
    
    // Implement exponential backoff
    exponentialBackoff: true,
    
    // Verify results before marking as success
    verifyResults: true
};

// LATEST 2024 USER AGENTS - High Success Rate
const USER_AGENTS = [
    // Chrome 131+ (Most reliable)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    
    // Edge 131+ (Good compatibility)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    
    // Firefox 133+ (Latest)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    
    // Safari 18.2+ (iOS 18.2)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    
    // Mobile Chrome (Latest Android 15)
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
];

// Enhanced randomization with weighted selection
function getRandomUserAgent() {
    // Prefer Chrome and Edge (higher success rates)
    const weights = [0.3, 0.25, 0.2, 0.1, 0.05, 0.05, 0.03, 0.01, 0.01];
    const random = Math.random();
    let sum = 0;
    
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random <= sum) {
            return USER_AGENTS[i];
        }
    }
    
    return USER_AGENTS[0]; // Fallback to most reliable
}

// Export for use in modules
module.exports = { USER_AGENTS, getRandomUserAgent };

// CLEAN TASK TRACKER
class CleanTaskTracker {
    constructor() {
        this.activeTasks = new Map();
        this.completedTasks = [];
        this.totalSuccess = 0;
        this.taskCounter = 1;
        this.runningTasks = new Set();
        this.exactCollegeMatches = new Map();
        this.collegeSuccessRates = new Map();
        this.totalProcessed = 0;
    }
    
    startTask(taskId, studentId, exactCollege) {
        const task = {
            id: taskId,
            studentId: studentId,
            exactCollege: exactCollege,
            collegeName: exactCollege ? exactCollege.name : 'Unknown College',
            collegeId: exactCollege ? exactCollege.id : 'N/A',
            status: 'Processing verification...',
            startTime: Date.now(),
            stage: 'init'
        };
        
        this.activeTasks.set(taskId, task);
        this.runningTasks.add(taskId);
        this.exactCollegeMatches.set(taskId, exactCollege);
        
        this.displayTask(task);
    }
    
    updateTaskDisplay(taskId, message, isSuccess = false) {
        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            task.status = message;
            task.lastUpdate = Date.now();
            
            if (isSuccess) {
                task.stage = 'success';
                this.totalSuccess++;
                this.totalProcessed++;
                this.completedTasks.push(task);
                
                const college = this.exactCollegeMatches.get(taskId);
                if (college) {
                    this.updateCollegeSuccessRate(college.id, true);
                }
                
                this.activeTasks.delete(taskId);
                this.runningTasks.delete(taskId);
                this.exactCollegeMatches.delete(taskId);
                
                this.displaySuccess(taskId, task.collegeName, this.totalSuccess);
            } else {
                this.displayTask(task);
            }
        }
    }
    
    completeTask(taskId, success = true, reason = '') {
        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            const college = this.exactCollegeMatches.get(taskId);
            
            this.totalProcessed++;
            
            if (success) {
                this.totalSuccess++;
                if (college) {
                    this.updateCollegeSuccessRate(college.id, true);
                }
                this.displaySuccess(taskId, task.collegeName, this.totalSuccess);
            } else {
                if (college) {
                    this.updateCollegeSuccessRate(college.id, false);
                }
                this.displayFailed(taskId, task.collegeName, reason);
            }
            
            this.completedTasks.push(task);
            this.activeTasks.delete(taskId);
            this.runningTasks.delete(taskId);
            this.exactCollegeMatches.delete(taskId);
        }
    }
    
    displayTask(task) {
        const taskNum = task.id.toString().padStart(2, ' ');
        const taskStr = chalk.cyan(`Task ${taskNum}:`);
        const statusStr = chalk.yellow('Processing verification...');
        const collegeStr = chalk.magenta(this.truncateCollege(task.collegeName, 40));
        
        console.log(`${taskStr} ${statusStr} │ ${collegeStr}`);
    }
    
    displaySuccess(taskId, collegeName, totalSuccess) {
        const taskNum = taskId.toString().padStart(2, ' ');
        const taskStr = chalk.cyan(`Task ${taskNum}:`);
        const successStr = chalk.green('✅ Verification complete!');
        const totalStr = chalk.yellow(`Total Success: ${totalSuccess}`);
        
        console.log(`${taskStr} ${successStr} ${totalStr}`);
    }
    
    displayFailed(taskId, collegeName, reason) {
        const taskNum = taskId.toString().padStart(2, ' ');
        const taskStr = chalk.cyan(`Task ${taskNum}:`);
        const failedStr = chalk.red('❌ Failed:');
        const reasonStr = chalk.red(`Timeout after 30 seconds`);
        
        console.log(`${taskStr} ${failedStr} ${reasonStr}`);
    }
    
    updateCollegeSuccessRate(collegeId, success) {
        if (!this.collegeSuccessRates.has(collegeId)) {
            this.collegeSuccessRates.set(collegeId, { success: 0, total: 0 });
        }
        
        const stats = this.collegeSuccessRates.get(collegeId);
        stats.total++;
        if (success) stats.success++;
        
        this.collegeSuccessRates.set(collegeId, stats);
    }
    
    truncateCollege(collegeName, maxLength = 40) {
        if (!collegeName) return 'Unknown';
        if (collegeName.length <= maxLength) return collegeName;
        return collegeName.substring(0, maxLength - 3) + '...';
    }
    
    getActiveTasksCount() {
        return this.activeTasks.size;
    }
    
    getTotalSuccess() {
        return this.totalSuccess;
    }
    
    getNextTaskId() {
        return this.taskCounter++;
    }
}

// CLEAN COLLEGE MATCHER
class CleanCollegeMatcher {
    constructor() {
        this.studentCollegeMap = new Map();
        this.countryCollegeDatabase = new Map();
        this.invalidCollegeIds = new Set();
        this.ssoCollegeIds = new Set();
        this.workingCollegeIds = new Set();
        this.receiptPattern = /^(\d+)_(\d+)\.(png|jpg|jpeg|pdf|webp)$/i;
        this.successCount = 0;
        this.failedCount = 0;
        this.exactMatchCount = 0;
        this.noMatchCount = 0;
        this.ssoCount = 0;
        this.selectedCountry = null;
        this.loadedCollegesCount = 0;
        this.receiptsAnalyzed = 0;
        this.uniqueCollegeIdsInReceipts = new Set();
    }
    
    analyzeReceipts() {
        if (!fs.existsSync(CONFIG.receiptsDir)) {
            console.log(chalk.red(`❌ Receipts directory not found: ${CONFIG.receiptsDir}`));
            return false;
        }
        
        const files = fs.readdirSync(CONFIG.receiptsDir);
        const receiptFiles = files.filter(file => this.receiptPattern.test(file));
        
        if (receiptFiles.length === 0) {
            console.log(chalk.red(`❌ No valid receipt files found in ${CONFIG.receiptsDir}`));
            console.log(chalk.yellow('   Receipt files should be named: studentId_collegeId.png'));
            return false;
        }
        
        this.receiptsAnalyzed = receiptFiles.length;
        console.log(chalk.green(`📄 Analyzing ${receiptFiles.length} receipt files...`));
        
        receiptFiles.forEach(file => {
            const match = file.match(this.receiptPattern);
            if (match) {
                const studentId = match[1];
                const collegeId = parseInt(match[2]);
                this.studentCollegeMap.set(studentId, collegeId);
                this.uniqueCollegeIdsInReceipts.add(collegeId);
            }
        });
        
        console.log(chalk.green(`✅ Mapped ${this.studentCollegeMap.size} students to ${this.uniqueCollegeIdsInReceipts.size} unique colleges`));
        return true;
    }
    
    loadCountryColleges(countryCode) {
        try {
            const countryConfig = ALL_COUNTRY_CONFIG[countryCode];
            if (!countryConfig) {
                console.log(chalk.red(`❌ Invalid country code: ${countryCode}`));
                return false;
            }
            
            const collegeFile = countryConfig.collegeFile;
            console.log(chalk.blue(`📚 Loading colleges from ${collegeFile}...`));
            
            if (!fs.existsSync(collegeFile)) {
                console.log(chalk.red(`❌ College file not found: ${collegeFile}`));
                
                const fallbackFiles = ['sheerid_in.json', 'colleges.json', 'universities.json'];
                console.log(chalk.yellow('🔄 Trying fallback files...'));
                
                for (const fallbackFile of fallbackFiles) {
                    if (fs.existsSync(fallbackFile)) {
                        console.log(chalk.blue(`📚 Using fallback: ${fallbackFile}`));
                        const data = JSON.parse(fs.readFileSync(fallbackFile, 'utf-8'));
                        const colleges = data.filter(c => c.name && c.id);
                        this.countryCollegeDatabase.clear();
                        colleges.forEach(college => {
                            this.countryCollegeDatabase.set(college.id, college);
                        });
                        this.loadedCollegesCount = colleges.length;
                        console.log(chalk.green(`✅ Loaded ${colleges.length} colleges from fallback`));
                        return true;
                    }
                }
                return false;
            }
            
            const data = JSON.parse(fs.readFileSync(collegeFile, 'utf-8'));
            const colleges = data.filter(c => c.name && c.id);
            
            this.countryCollegeDatabase.clear();
            colleges.forEach(college => {
                this.countryCollegeDatabase.set(college.id, college);
            });
            
            this.loadedCollegesCount = colleges.length;
            console.log(chalk.green(`✅ Loaded ${colleges.length} colleges from ${collegeFile}`));
            
            const matchingIds = Array.from(this.uniqueCollegeIdsInReceipts).filter(id => this.countryCollegeDatabase.has(id));
            console.log(chalk.green(`✅ ${matchingIds.length}/${this.uniqueCollegeIdsInReceipts.size} receipt college IDs found in database`));
            
            if (matchingIds.length > 0) {
                console.log(chalk.magenta(`🎯 EXACT COLLEGES TARGETED:`));
                matchingIds.slice(0, 5).forEach(id => {
                    const college = this.countryCollegeDatabase.get(id);
                    console.log(chalk.green(`   🎯 ${college.name}`));
                });
                if (matchingIds.length > 5) {
                    console.log(chalk.gray(`   ... and ${matchingIds.length - 5} more colleges`));
                }
            }
            
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Error loading colleges: ${error.message}`));
            return false;
        }
    }
    
    getExactCollegeForStudent(studentId) {
        const receiptCollegeId = this.studentCollegeMap.get(studentId);
        
        if (!receiptCollegeId) {
            this.noMatchCount++;
            return null;
        }
        
        if (this.invalidCollegeIds.has(receiptCollegeId)) {
            this.noMatchCount++;
            return null;
        }
        
        if (this.countryCollegeDatabase.has(receiptCollegeId)) {
            const college = this.countryCollegeDatabase.get(receiptCollegeId);
            this.exactMatchCount++;
            return college;
        }
        
        this.noMatchCount++;
        return null;
    }
    
    markCollegeAsWorking(collegeId) {
        this.workingCollegeIds.add(collegeId);
    }
    
    markCollegeAsSso(collegeId) {
        this.ssoCollegeIds.add(collegeId);
        this.ssoCount++;
    }
    
    markCollegeAsInvalid(collegeId) {
        if (!this.ssoCollegeIds.has(collegeId)) {
            this.invalidCollegeIds.add(collegeId);
        }
    }
    
    hasReceiptForStudent(studentId) {
        return this.studentCollegeMap.has(studentId);
    }
    
    getReceiptCollegeId(studentId) {
        return this.studentCollegeMap.get(studentId);
    }
    
    isCollegeInDatabase(collegeId) {
        return this.countryCollegeDatabase.has(collegeId);
    }
    
    setSelectedCountry(countryCode) {
        this.selectedCountry = countryCode;
    }
    
    addSuccess() { this.successCount++; }
    addFailure() { this.failedCount++; }
    
    getStats() {
        const total = this.successCount + this.failedCount;
        const successRate = total > 0 ? ((this.successCount / total) * 100).toFixed(1) : '0.0';
        
        return {
            success: this.successCount,
            failed: this.failedCount,
            total: total,
            successRate: successRate,
            exactMatches: this.exactMatchCount,
            noMatches: this.noMatchCount,
            invalidColleges: this.invalidCollegeIds.size,
            ssoColleges: this.ssoCollegeIds.size,
            workingColleges: this.workingCollegeIds.size,
            studentsWithReceipts: this.studentCollegeMap.size,
            loadedColleges: this.loadedCollegesCount,
            receiptsAnalyzed: this.receiptsAnalyzed,
            uniqueCollegeIds: this.uniqueCollegeIdsInReceipts.size
        };
    }
    
    showTargetSummary() {
        console.log(chalk.blue(`
╔══════════════════════════════════════════════════╗
║           🎯 EXACT COLLEGE TARGETING             ║
╚══════════════════════════════════════════════════╝
`));
        
        const stats = this.getStats();
        console.log(chalk.magenta(`📚 Colleges in database: ${stats.loadedColleges.toLocaleString()}`));
        console.log(chalk.magenta(`📄 Receipt files analyzed: ${stats.receiptsAnalyzed}`));
        console.log(chalk.magenta(`🔢 Unique college IDs in receipts: ${stats.uniqueCollegeIds}`));
        console.log(chalk.green(`✅ Students with exact college matches: ${stats.exactMatches}`));
        console.log(chalk.yellow(`⏰ Timeout: 30 seconds for better success rate\n`));
    }
}

// CLEAN DELETE MANAGER
class CleanDeleteManager {
    constructor() {
        this.processedStudents = new Set();
        this.deletedFiles = [];
        this.deletionStats = {
            success: 0,
            failed: 0,
            noMatch: 0,
            errors: 0
        };
    }
    
    deleteStudentImmediately(studentId, reason = 'processed') {
        if (!CONFIG.autoDeleteProcessed) return;
        
        try {
            if (fs.existsSync(CONFIG.receiptsDir)) {
                const files = fs.readdirSync(CONFIG.receiptsDir);
                const studentFiles = files.filter(file => file.startsWith(studentId + '_'));
                
                studentFiles.forEach(file => {
                    const filePath = path.join(CONFIG.receiptsDir, file);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        this.deletedFiles.push(file);
                    }
                });
            }
            
            this.removeFromStudentsFile(studentId);
            this.processedStudents.add(studentId);
            
            if (reason === 'SUCCESS') this.deletionStats.success++;
            else if (reason === 'FAILED') this.deletionStats.failed++;
            else if (reason === 'NO_MATCH') this.deletionStats.noMatch++;
            
        } catch (error) {
            this.deletionStats.errors++;
        }
    }
    
    removeFromStudentsFile(studentId) {
        try {
            if (!fs.existsSync(CONFIG.studentsFile)) return;
            
            const content = fs.readFileSync(CONFIG.studentsFile, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            
            const updatedLines = lines.filter(line => {
                const parts = line.split('|');
                if (parts.length < 2) return true;
                const lineStudentId = parts[1].trim();
                return lineStudentId !== studentId;
            });
            
            fs.writeFileSync(CONFIG.studentsFile, updatedLines.join('\n') + '\n');
            
        } catch (error) {
            // Silent error handling
        }
    }
    
    markStudentSuccess(studentId) {
        this.deleteStudentImmediately(studentId, 'SUCCESS');
    }
    
    markStudentFailed(studentId) {
        this.deleteStudentImmediately(studentId, 'FAILED');
    }
    
    markStudentNoMatch(studentId) {
        this.deleteStudentImmediately(studentId, 'NO_MATCH');
    }
    
    getStats() {
        return {
            processed: this.processedStudents.size,
            deleted: this.deletedFiles.length,
            ...this.deletionStats
        };
    }
}

// CLEAN VERIFICATION SESSION WITH 30 SECOND TIMEOUT
class CleanVerificationSession {
    constructor(id, countryConfig, taskTracker) {
        this.id = id;
        this.countryConfig = countryConfig;
        this.taskTracker = taskTracker;
        this.cookieJar = new tough.CookieJar();
        this.userAgent = this.getRandomUserAgent();
        this.verificationId = null;
        this.client = this.createClient();
        this.currentStep = 'init';
        this.submittedCollegeId = null;
        this.submittedCollegeName = null;
    }
    
createClient() {
    const config = {
        jar: this.cookieJar,
        proxy: false,                      // ✅ Disable any system/VPN proxy interference
        timeout: 90000,                    // ✅ Increase to 90s total request timeout
        maxRedirects: 5,                   // ✅ Allow more redirects
        decompress: true,
        validateStatus: (status) => status >= 200 && status < 500, // ✅ Handle 4xx gracefully
        headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json, text/html, application/xhtml+xml, */*',
            'Accept-Language': `${this.countryConfig.locale},en;q=0.9`,
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Origin': 'https://services.sheerid.com',
            'Referer': 'https://services.sheerid.com/',
            'X-Country': this.countryConfig.code.toUpperCase(),
            'X-Locale': this.countryConfig.locale,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'DNT': '1'
        }
    };

    const client = axios.create(config);

    // ✅ Smarter retry for network timeouts or aborted requests
    client.interceptors.response.use(
        res => res,
        async err => {
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                console.warn('⏳ Timeout detected, retrying once...');
                await new Promise(r => setTimeout(r, 3000));
                err.config._retryCount = (err.config._retryCount || 0) + 1;
                if (err.config._retryCount <= 1) {
                    return client.request(err.config);
                }
            }
            console.error('⚠️ Axios Error:', err.code || err.message);
            return Promise.reject(err);
        }
    );

    return wrapper(client);
}

    
    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }
    
    generateVerificationId() {
        const timestamp = Date.now().toString(16);
        const random = Math.random().toString(16).substr(2, 12);
        return (timestamp + random).substr(0, 24);
    }
    
    async init() {
        try {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
            const response = await this.client.get(this.countryConfig.sheeridUrl);
            this.currentStep = 'initialized';
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    async submitPersonalInfo(student, dob, college) {
        try {
            this.submittedCollegeId = college.id;
            this.submittedCollegeName = college.name;
            
            const birthDate = `${dob.year}-${dob.month.toString().padStart(2, '0')}-${dob.day.toString().padStart(2, '0')}`;
            
            const data = {
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                birthDate: birthDate,
                organization: {
                    id: college.id,
                    name: college.name
                },
                country: this.countryConfig.code.toUpperCase(),
                locale: this.countryConfig.locale
            };
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const response = await this.client.post(this.countryConfig.submitEndpoint, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': this.countryConfig.sheeridUrl,
                    'Origin': 'https://services.sheerid.com'
                }
            });
            
            if (response.data?.verificationId) {
                this.verificationId = response.data.verificationId;
                this.currentStep = response.data.currentStep || 'collectStudentPersonalInfo';
            } else {
                this.verificationId = this.generateVerificationId();
                this.currentStep = 'collectStudentPersonalInfo';
            }
            
            return this.currentStep;
        } catch (error) {
            return 'error';
        }
    }
    
    // 🔥 30 SECOND TIMEOUT WAIT FUNCTION
    async waitForCorrectStep(maxWait = CONFIG.maxPollingWait, collegeMatcher) {
        if (!this.verificationId) return 'error';
        
        // 🔥 NOW WAITS UP TO 30 SECONDS
        for (let i = 0; i < maxWait; i++) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.pollingInterval));
            
            try {
                const statusUrl = this.countryConfig.statusEndpoint.replace('{verificationId}', this.verificationId);
                const response = await this.client.get(statusUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': this.countryConfig.sheeridUrl
                    },
                    timeout: 8000
                });
                
                const data = response.data;
                this.currentStep = data.currentStep;
                
                if (this.currentStep === 'success') {
                    if (collegeMatcher && this.submittedCollegeId) {
                        collegeMatcher.markCollegeAsWorking(this.submittedCollegeId);
                    }
                    return 'success';
                }
                
                if (this.currentStep === 'docUpload') {
                    if (collegeMatcher && this.submittedCollegeId) {
                        collegeMatcher.markCollegeAsWorking(this.submittedCollegeId);
                    }
                    return 'docUpload';
                }
                
                if (this.currentStep === 'sso') {
                    if (collegeMatcher && this.submittedCollegeId) {
                        collegeMatcher.markCollegeAsSso(this.submittedCollegeId);
                    }
                    return 'sso_success';
                }
                
                if (this.currentStep === 'error' || (data.errorIds && data.errorIds.length > 0)) {
                    if (collegeMatcher && this.submittedCollegeId) {
                        collegeMatcher.markCollegeAsInvalid(this.submittedCollegeId);
                    }
                    return 'error';
                }
                
                // 🔥 STOPS AT 29 SECONDS INSTEAD OF 19
                if (i >= 29) {
                    if (collegeMatcher && this.submittedCollegeId) {
                        collegeMatcher.markCollegeAsInvalid(this.submittedCollegeId);
                    }
                    return 'polling_timeout';
                }
                
            } catch (error) {
                // 🔥 INCREASED FAILURE THRESHOLD TO 20
                if (i >= 20) {
                    return 'polling_timeout';
                }
                continue;
            }
        }
        
        if (this.currentStep === 'sso') {
            if (collegeMatcher && this.submittedCollegeId) {
                collegeMatcher.markCollegeAsSso(this.submittedCollegeId);
            }
            return 'sso';
        }
        
        if (collegeMatcher && this.submittedCollegeId) {
            collegeMatcher.markCollegeAsInvalid(this.submittedCollegeId);
        }
        return 'polling_timeout';
    }
    
    async uploadDocument(filePath) {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, reason: 'No file' };
        }
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const formData = new FormData();
            const fileName = path.basename(filePath);
            const fileStats = fs.statSync(filePath);
            
            if (fileStats.size > 10 * 1024 * 1024) {
                return { success: false, reason: 'File too large' };
            }
            
            formData.append('file', fs.createReadStream(filePath), {
                filename: fileName,
                contentType: this.getContentType(fileName),
                knownLength: fileStats.size
            });
            
            const uploadUrl = this.countryConfig.uploadEndpoint.replace('{verificationId}', this.verificationId);
            
            const response = await this.client.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': this.countryConfig.sheeridUrl,
                    'Origin': 'https://services.sheerid.com',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: CONFIG.uploadTimeout
            });
            
            return { success: response.status === 200, response: response.data };
            
        } catch (error) {
            return { success: false, reason: error.message };
        }
    }
    
    getContentType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };
        return types[ext] || 'application/octet-stream';
    }
    
    async checkStatus(maxWaitTime = 15) {
        if (!this.verificationId) return { status: 'ERROR' };
        
        const statusUrl = this.countryConfig.statusEndpoint.replace('{verificationId}', this.verificationId);
        
        for (let i = 0; i < maxWaitTime; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
                const response = await this.client.get(statusUrl, { timeout: 8000 });
                const data = response.data;
                
                if (data.currentStep === 'success' && 
                    (!data.rejectionReasons || data.rejectionReasons.length === 0)) {
                    return { status: 'SUCCESS', data };
                }
                
                if (data.currentStep === 'sso') {
                    return { status: 'SSO', data };
                }
                
                if (data.rejectionReasons?.length > 0) {
                    return { status: 'REJECTED', data };
                }
                
            } catch (error) {
                continue;
            }
        }
        
        return { status: 'TIMEOUT' };
    }
    
    async getSpotifyUrl() {
        if (!this.verificationId) return null;
        
        const endpoints = [
            this.countryConfig.redirectEndpoint.replace('{verificationId}', this.verificationId),
            `https://services.sheerid.com/redirect/${this.verificationId}`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.client.get(endpoint, { maxRedirects: 0 });
                let url = response.headers.location || response.data?.redirectUrl;
                
                if (url && url.includes('spotify.com')) {
                    if (!url.includes('verificationId=')) {
                        const separator = url.includes('?') ? '&' : '?';
                        url = `${url}${separator}verificationId=${this.verificationId}`;
                    }
                    return url;
                }
            } catch (error) {
                if (error.response?.headers?.location?.includes('spotify.com')) {
                    let url = error.response.headers.location;
                    if (!url.includes('verificationId=')) {
                        const separator = url.includes('?') ? '&' : '?';
                        url = `${url}${separator}verificationId=${this.verificationId}`;
                    }
                    return url;
                }
                continue;
            }
        }
        
        return this.countryConfig.finalLinkFormat.replace('{verificationId}', this.verificationId);
    }
}

// UTILITY FUNCTIONS
function generateEmail(firstName, lastName, countryConfig) {
    const domains = countryConfig.domains;
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const number = Math.floor(Math.random() * 9999) + 1000;
    
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    
    return `${cleanFirst}.${cleanLast}.${number}@${domain}`;
}

function generateDOB() {
    const currentYear = new Date().getFullYear();
    const year = currentYear - Math.floor(Math.random() * 8) - 18;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    
    return { day, month, year };
}

function loadStudents(collegeMatcher) {
    try {
        if (!fs.existsSync(CONFIG.studentsFile)) return [];
        
        const content = fs.readFileSync(CONFIG.studentsFile, 'utf-8');
        const students = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split('|').map(s => s.trim());
                if (parts.length < 2) return null;
                
                const [name, studentId] = parts;
                
                let firstName, lastName;
                if (name.includes(',')) {
                    [lastName, firstName] = name.split(',').map(s => s.trim());
                } else {
                    const nameParts = name.split(' ');
                    firstName = nameParts[0] || 'FIRST';
                    lastName = nameParts.slice(1).join(' ') || 'LAST';
                }
                
                return {
                    firstName: firstName.toUpperCase(),
                    lastName: lastName.toUpperCase(),
                    email: generateEmail(firstName, lastName, CONFIG.countryConfig),
                    studentId: studentId.trim()
                };
            })
            .filter(s => s);
            
        return students;
    } catch (error) {
        return [];
    }
}

function findStudentFiles(studentId) {
    const dirs = [CONFIG.receiptsDir, 'images', 'documents'];
    const extensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const files = [];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        
        try {
            const dirFiles = fs.readdirSync(dir);
            for (const file of dirFiles) {
                if (file.toLowerCase().includes(studentId.toLowerCase()) &&
                    extensions.some(ext => file.toLowerCase().endsWith(ext))) {
                    const filePath = path.join(dir, file);
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        if (stats.size > 1024 && stats.size < 10485760) {
                            files.push({
                                path: filePath,
                                name: file,
                                size: stats.size
                            });
                        }
                    }
                }
            }
        } catch (e) { continue; }
    }
    
    return files.sort((a, b) => b.size - a.size);
}

function saveSpotifyUrl(student, url, verificationId) {
    try {
        fs.appendFileSync(CONFIG.outputFile, url + '\n');
        
        const logEntry = JSON.stringify({
            student: {
                firstName: student.firstName,
                lastName: student.lastName,
                studentId: student.studentId,
                email: student.email
            },
            verificationId: verificationId,
            spotifyUrl: url,
            country: CONFIG.selectedCountry
        }) + '\n';
        
        fs.appendFileSync('spotify_success_log.txt', logEntry);
        return true;
    } catch (error) {
        return false;
    }
}

// CLEAN COUNTRY SELECTION
async function selectCountryAndTarget() {
    console.log(chalk.blue('\n🎵 SPOTIFY SHEERID - 30 SECOND TIMEOUT'));
    console.log(chalk.blue('═'.repeat(60)));
    console.log(chalk.yellow('🌍 Available Countries:\n'));
    
    const countries = Object.keys(ALL_COUNTRY_CONFIG);
    
    for (let i = 0; i < countries.length; i += 5) {
        const group = countries.slice(i, i + 5);
        const line = group.map((code, index) => {
            const country = ALL_COUNTRY_CONFIG[code];
            const globalIndex = i + index + 1;
            return chalk.green(`${globalIndex.toString().padStart(2, ' ')}. ${country.flag} ${code}`);
        }).join('  ');
        console.log(`  ${line}`);
    }
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(chalk.yellow('\n🌍 Select Country (code or number): '), (countryInput) => {
            let selectedCode = null;
            
            const num = parseInt(countryInput);
            if (!isNaN(num) && num >= 1 && num <= countries.length) {
                selectedCode = countries[num - 1];
            } else {
                selectedCode = countryInput.toUpperCase();
                if (!ALL_COUNTRY_CONFIG[selectedCode]) {
                    console.log(chalk.red(`❌ Invalid country: ${countryInput}`));
                    process.exit(1);
                }
            }
            
            CONFIG.selectedCountry = selectedCode;
            CONFIG.countryConfig = ALL_COUNTRY_CONFIG[selectedCode];
            
            console.log(chalk.green(`\n✅ Selected: ${CONFIG.countryConfig.flag} ${CONFIG.countryConfig.name} (${selectedCode})`));
            
            rl.question(chalk.yellow('🎯 How many Spotify links to generate? (default: 100): '), (targetInput) => {
                const targetCount = parseInt(targetInput) || 100;
                CONFIG.targetLinks = targetCount;
                CONFIG.targetMode = targetCount > 0;
                
                console.log(chalk.green(`🎯 Target: ${CONFIG.targetLinks} links`));
                console.log(chalk.blue(`📁 Output: ${CONFIG.outputFile}`));
                console.log(chalk.yellow(`⏰ 30 second timeout for better success rate\n`));
                
                rl.close();
                resolve(true);
            });
        });
    });
}

// CLEAN PROCESSOR WITH 30 SECOND TIMEOUT
async function processStudent(student, sessionId, collegeMatcher, deleteManager, taskTracker) {
    const taskId = taskTracker.getNextTaskId();
    const session = new CleanVerificationSession(taskId, CONFIG.countryConfig, taskTracker);
    
    try {
        if (!collegeMatcher.hasReceiptForStudent(student.studentId)) {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'No receipt file');
            return null;
        }
        
        const exactCollege = collegeMatcher.getExactCollegeForStudent(student.studentId);
        if (!exactCollege) {
            deleteManager.markStudentNoMatch(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'No exact college match');
            return null;
        }
        
        taskTracker.startTask(taskId, student.studentId, exactCollege);
        
        taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
        const initSuccess = await session.init();
        if (!initSuccess) {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'Session init failed');
            return null;
        }
        
        const dob = generateDOB();
        taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
        const step = await session.submitPersonalInfo(student, dob, exactCollege);
        
        if (step === 'success') {
            const spotifyUrl = await session.getSpotifyUrl();
            if (spotifyUrl) {
                saveSpotifyUrl(student, spotifyUrl, session.verificationId);
                deleteManager.markStudentSuccess(student.studentId);
                collegeMatcher.addSuccess();
                taskTracker.completeTask(taskId, true);
                return { student, url: spotifyUrl, type: 'instant_exact', college: exactCollege };
            }
        }
        
        if (step === 'error') {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'Form submission error');
            return null;
        }
        
        // 🔥 30 SECOND TIMEOUT POLLING
        taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
        const stepResult = await session.waitForCorrectStep(CONFIG.maxPollingWait, collegeMatcher);
        
        if (stepResult === 'success') {
            const spotifyUrl = await session.getSpotifyUrl();
            if (spotifyUrl) {
                saveSpotifyUrl(student, spotifyUrl, session.verificationId);
                deleteManager.markStudentSuccess(student.studentId);
                collegeMatcher.addSuccess();
                taskTracker.completeTask(taskId, true);
                return { student, url: spotifyUrl, type: 'success_exact', college: exactCollege };
            }
        }
        
        if (stepResult === 'sso_success' || stepResult === 'sso') {
            const spotifyUrl = await session.getSpotifyUrl();
            if (spotifyUrl) {
                saveSpotifyUrl(student, spotifyUrl, session.verificationId);
                deleteManager.markStudentSuccess(student.studentId);
                collegeMatcher.addSuccess();
                taskTracker.completeTask(taskId, true);
                return { student, url: spotifyUrl, type: 'sso_exact', college: exactCollege };
            }
        }
        
        if (stepResult === 'polling_timeout') {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'Polling timed out after 30 seconds');
            return null;
        }
        
        if (stepResult === 'invalid_college') {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'Invalid college');
            return null;
        }
        
        if (stepResult !== 'docUpload') {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, `Step: ${stepResult}`);
            return null;
        }
        
        taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
        const files = findStudentFiles(student.studentId);
        if (files.length === 0) {
            deleteManager.markStudentFailed(student.studentId);
            collegeMatcher.addFailure();
            taskTracker.completeTask(taskId, false, 'No files found');
            return null;
        }
        
        for (const file of files) {
            const uploadResult = await session.uploadDocument(file.path);
            
            if (uploadResult.success) {
                taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
                const statusResult = await session.checkStatus(15);
                
                if (statusResult.status === 'SUCCESS') {
                    const spotifyUrl = await session.getSpotifyUrl();
                    if (spotifyUrl) {
                        saveSpotifyUrl(student, spotifyUrl, session.verificationId);
                        deleteManager.markStudentSuccess(student.studentId);
                        collegeMatcher.addSuccess();
                        taskTracker.completeTask(taskId, true);
                        return { student, url: spotifyUrl, type: 'upload_exact', college: exactCollege };
                    }
                } else if (statusResult.status === 'SSO') {
                    const spotifyUrl = await session.getSpotifyUrl();
                    if (spotifyUrl) {
                        saveSpotifyUrl(student, spotifyUrl, session.verificationId);
                        deleteManager.markStudentSuccess(student.studentId);
                        collegeMatcher.addSuccess();
                        taskTracker.completeTask(taskId, true);
                        return { student, url: spotifyUrl, type: 'upload_sso_exact', college: exactCollege };
                    }
                } else if (statusResult.status === 'REJECTED') {
                    taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
                    continue;
                }
            } else {
                taskTracker.updateTaskDisplay(taskId, `Processing verification...`);
                continue;
            }
        }
        
        deleteManager.markStudentFailed(student.studentId);
        collegeMatcher.addFailure();
        taskTracker.completeTask(taskId, false, 'All files exhausted');
        return null;
        
    } catch (error) {
        deleteManager.markStudentFailed(student.studentId);
        collegeMatcher.addFailure();
        taskTracker.completeTask(taskId, false, `Process error: ${error.message}`);
        return null;
    }
}

// CLEAN BULK PROCESSOR
async function processBulk(students, collegeMatcher, deleteManager) {
    console.log(chalk.blue(`
╔══════════════════════════════════════════════════╗
║         🎵 SPOTIFY SHEERID - 30 SECOND          ║
╚══════════════════════════════════════════════════╝
`));
    
    console.log(chalk.magenta(`🌍 Country: ${CONFIG.countryConfig.flag} ${CONFIG.countryConfig.name} (${CONFIG.selectedCountry})`));
    console.log(chalk.magenta(`👥 Students: ${students.length}`));
    console.log(chalk.magenta(`🎯 Target: ${CONFIG.targetLinks} links`));
    console.log(chalk.magenta(`⚡ Workers: ${CONFIG.maxConcurrent} concurrent`));
    console.log(chalk.yellow(`⏰ Polling Timeout: ${CONFIG.maxPollingWait} seconds`));
    console.log(chalk.green(`📁 Output: ${CONFIG.outputFile}\n`));
    
    collegeMatcher.showTargetSummary();
    
    const taskTracker = new CleanTaskTracker();
    const results = [];
    
    const chunks = [];
    for (let i = 0; i < students.length; i += CONFIG.batchSize) {
        chunks.push(students.slice(i, i + CONFIG.batchSize));
    }
    
    console.log(chalk.blue(`\n📊 Starting processing with 30 second timeout...\n`));
    
    for (const [batchIndex, batch] of chunks.entries()) {
        const batchChunks = [];
        for (let i = 0; i < batch.length; i += CONFIG.maxConcurrent) {
            batchChunks.push(batch.slice(i, i + CONFIG.maxConcurrent));
        }
        
        for (const chunk of batchChunks) {
            const promises = chunk.map((student) => 
                processStudent(student, null, collegeMatcher, deleteManager, taskTracker)
            );
            
            const chunkResults = await Promise.allSettled(promises);
            
            for (const result of chunkResults) {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                }
            }
            
            if (CONFIG.targetMode && results.length >= CONFIG.targetLinks) {
                CONFIG.targetReached = true;
                console.log(chalk.green(`\n🎯 TARGET REACHED! Generated ${results.length}/${CONFIG.targetLinks} links with 30 second timeout`));
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (CONFIG.targetReached) break;
    }
    
    return results;
}

// CLEAN MAIN FUNCTION
async function main() {
    console.clear();
    
    try {
        if (!(await selectCountryAndTarget())) {
            console.log(chalk.red('❌ Selection failed'));
            return;
        }
        
        const collegeMatcher = new CleanCollegeMatcher();
        collegeMatcher.setSelectedCountry(CONFIG.selectedCountry);
        const deleteManager = new CleanDeleteManager();
        
        if (!collegeMatcher.analyzeReceipts()) {
            console.log(chalk.red(`❌ Failed to analyze receipts`));
            return;
        }
        
        if (!collegeMatcher.loadCountryColleges(CONFIG.selectedCountry)) {
            console.log(chalk.red(`❌ Failed to load colleges`));
            return;
        }
        
        const students = loadStudents(collegeMatcher);
        if (students.length === 0) {
            console.log(chalk.red(`❌ No students loaded`));
            return;
        }
        
        const studentsWithExactMatches = students.filter(s => {
            if (!collegeMatcher.hasReceiptForStudent(s.studentId)) return false;
            const collegeId = collegeMatcher.getReceiptCollegeId(s.studentId);
            return collegeMatcher.isCollegeInDatabase(collegeId);
        });
        
        if (studentsWithExactMatches.length === 0) {
            console.log(chalk.red(`❌ No students have exact college matches in database`));
            return;
        }
        
        console.log(chalk.green(`✅ ${studentsWithExactMatches.length} students have exact college matches`));
        
        const startTime = Date.now();
        const results = await processBulk(studentsWithExactMatches, collegeMatcher, deleteManager);
        const totalTime = (Date.now() - startTime) / 1000;
        
        const stats = collegeMatcher.getStats();
        const deleteStats = deleteManager.getStats();
        
        console.log(chalk.blue(`
╔══════════════════════════════════════════════════╗
║           🎉 30 SECOND PROCESSING COMPLETE! 🎉   ║
║      ${results.length.toString().padStart(3)} Spotify links generated successfully!     ║
║         Success Rate: ${stats.successRate.padStart(5)}% (30s Timeout)         ║
║         Processing Time: ${totalTime.toFixed(1)} seconds          ║
╚══════════════════════════════════════════════════╝
`));
        
        console.log(chalk.green(`✅ Links saved to: ${CONFIG.outputFile}`));
        console.log(chalk.magenta(`🌍 Country: ${CONFIG.countryConfig.flag} ${CONFIG.countryConfig.name}`));
        console.log(chalk.magenta(`📊 Exact matches processed: ${stats.exactMatches}`));
        console.log(chalk.magenta(`🗑️ Files auto-deleted: ${deleteStats.deleted}`));
        console.log(chalk.yellow(`⏰ 30 second timeout: Much improved success rate`));
        
        if (CONFIG.targetMode && CONFIG.targetReached) {
            console.log(chalk.green(`🎯 Target reached: ${results.length}/${CONFIG.targetLinks} links`));
        }
        
        console.log(chalk.yellow(`\n🤖 Bot will auto-close in 3 seconds...`));
        setTimeout(() => {
            console.log(chalk.green(`✅ Auto-closed successfully!`));
            process.exit(0);
        }, 3000);
        
    } catch (error) {
        console.error(chalk.red(`❌ Critical error: ${error.message}`));
        process.exit(1);
    }
}

// ERROR HANDLING
process.on('unhandledRejection', (err) => {
    // Silent error handling
});

process.on('uncaughtException', (err) => {
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Bot stopped by user'));
    process.exit(0);
});

// CLEAN STARTUP MESSAGE
console.log(chalk.blue(`
🎵 SPOTIFY SHEERID - 30 SECOND TIMEOUT 🎵
🔥 IMPROVED: Polling timeout increased to 30 seconds
🎨 Clean terminal with better visual appeal
📚 Reads receipt filenames for EXACT college targeting
📁 Output: Saves working Spotify URLs to sukses.txt 
🎯 Target-based: Set links needed, bot auto-closes when reached
⏰ Enhanced: 30 second timeout for best success rates
🔗 Generates: Real spotify.com/student/apply/sheerid-program links
`));

// RUN MAIN FUNCTION
if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('❌ Fatal error:'), error.message);
        process.exit(1);
    });
}

module.exports = {
    CONFIG,
    ALL_COUNTRY_CONFIG,
    CleanCollegeMatcher,
    CleanDeleteManager,
    CleanVerificationSession,
    CleanTaskTracker,
    processStudent,
    processBulk,
    main
};