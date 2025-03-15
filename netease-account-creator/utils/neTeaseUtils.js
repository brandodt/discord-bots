// NetEase Account Creator utility functions
const axios = require('axios');
const crypto = require('crypto');
const md5 = require('md5');
const fs = require('fs').promises;
const path = require('path');

// Generate a random device ID
function generateDeviceId() {
  return Array.from({ length: 32 }, () => {
    return '0123456789abcdef'[Math.floor(Math.random() * 16)];
  }).join('');
}

// Create a ticket for registration
async function createTicket(deviceId) {
  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'device-id': deviceId,
      'origin': 'https://account.neteasegames.com',
      'priority': 'u=1, i',
      'referer': 'https://account.neteasegames.com/account/login?client_id=official&lang=en_US&redirect_uri=https%3A%2F%2Faccount.neteasegames.com%2Faccount%2Fhome%3Flang%3Den_US&response_type=cookie&state=official_state',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1', // Added sec-gpc header from Python implementation
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' // Using exact same user-agent as Python
    };

    const data = new URLSearchParams({
      'client_id': 'official',
      'response_type': 'cookie',
      'redirect_uri': 'https://account.neteasegames.com/account/home?lang=en_US',
      'state': 'official_state'
    });

    console.log('Creating ticket with device ID:', deviceId);
    const response = await axios.post(
      'https://account.neteasegames.com/oauth/ticket/register/create_ticket?lang=en_US',
      data,
      { headers }
    );

    console.log('Ticket creation response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating ticket:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    return { code: -1, msg: error.message };
  }
}

// Check email availability
async function checkEmailAvailability(email, deviceId, ticket) {
  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'device-id': deviceId,
      'origin': 'https://account.neteasegames.com',
      'priority': 'u=1, i',
      'referer': `https://account.neteasegames.com/account/register?client_id=official&lang=en_US&ticket=${ticket}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1', // Added sec-gpc header from Python implementation
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    };

    const data = new URLSearchParams({ 'email': email });

    console.log('Checking email availability for:', email);
    const response = await axios.post(
      'https://account.neteasegames.com/oauth/register/email/check_email?lang=en_US',
      data,
      { headers }
    );

    console.log('Email availability response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking email availability:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    return { code: -1, msg: error.message };
  }
}

// Generate a recaptcha token
function generateRecaptchaToken() {
  // Using exact same format as Python implementation
  const base = "HF" + Array.from({ length: 300 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
  }).join('');
  return base;
}

// Send verification code
async function sendVerificationCode(email, deviceId, ticket) {
  try {
    const recaptchaToken = generateRecaptchaToken();
    
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'device-id': deviceId,
      'origin': 'https://account.neteasegames.com',
      'priority': 'u=1, i',
      'recaptcha-token': recaptchaToken,
      'referer': `https://account.neteasegames.com/account/register?client_id=official&lang=en_US&ticket=${ticket}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1', // Added sec-gpc header from Python implementation
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    };

    // Match exactly the Python implementation's data fields and order
    const data = new URLSearchParams({
      'email': email,
      'iso_code': 'PH', // Using PH as in Python implementation
      'agreement_ids': 'license', // Using only 'license' as in Python implementation
      'client_id': 'official',
      'ticket': ticket
    });

    console.log('Sending verification code to:', email);
    console.log('Request data:', {
      deviceId,
      ticket,
      recaptchaToken: recaptchaToken.substring(0, 20) + '...' // Log only part of the token for security
    });
    
    const response = await axios.post(
      'https://account.neteasegames.com/oauth/register/email/send_code?lang=en_US',
      data,
      { headers }
    );

    console.log('Verification code response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending verification code:', error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
      console.error('Error headers:', error.response.headers);
    }
    return { code: -1, msg: error.message };
  }
}

// Check username availability
async function checkUsernameAvailability(username, deviceId, ticket) {
  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'device-id': deviceId,
      'origin': 'https://account.neteasegames.com',
      'priority': 'u=1, i',
      'referer': `https://account.neteasegames.com/account/register?client_id=official&lang=en_US&ticket=${ticket}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1', // Added sec-gpc header from Python implementation
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    };

    const data = new URLSearchParams({ 'account_name': username });

    console.log('Checking username availability for:', username);
    const response = await axios.post(
      'https://account.neteasegames.com/oauth/register/email/check_account_name?lang=en_US',
      data,
      { headers }
    );

    console.log('Username availability response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking username availability:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    return { code: -1, msg: error.message };
  }
}

// Verify code and register account
async function verifyAndRegister(email, code, username, password, deviceId, ticket) {
  try {
    // Hash the password for sending - using MD5 as in Python implementation
    const hashedPassword = md5(password);

    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'device-id': deviceId,
      'origin': 'https://account.neteasegames.com',
      'priority': 'u=1, i',
      'referer': `https://account.neteasegames.com/account/register?client_id=official&lang=en_US&ticket=${ticket}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1', // Added sec-gpc header from Python implementation
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    };

    // Exactly match the Python implementation's data fields and order
    const data = new URLSearchParams({
      'email': email,
      'code': code,
      'iso_code': 'PH', // Using PH as in Python implementation
      'hash_password': hashedPassword,
      'account_name': username,
      'agreement_ids': 'license', // Using only 'license' as in Python implementation
      'password_strength': '1',
      'client_id': 'official',
      'ticket': ticket
    });

    console.log('Verifying and registering account for:', email);
    const response = await axios.post(
      'https://account.neteasegames.com/oauth/register/email/verify_code?lang=en_US',
      data,
      { headers }
    );

    console.log('Registration response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error registering account:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    return { code: -1, msg: error.message };
  }
}

// Generate a strong random password
function generatePassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';

  // Ensure at least one of each character type
  let password = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];

  // Add more random characters to reach desired length (12)
  const allChars = lowercase + uppercase + digits + special;
  for (let i = 0; i < 8; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  // Shuffle the password characters
  password = password.sort(() => 0.5 - Math.random());
  
  return password.join('');
}

// Validate email format
function validateEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

// Generate a random username
function generateUsername(length = 10) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  
  // Start with a letter
  let username = letters[Math.floor(Math.random() * letters.length)];
  
  // Add remaining characters
  const allChars = letters + digits;
  for (let i = 0; i < length - 1; i++) {
    username += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return username;
}

// Add dots to Gmail email
function addDotsToEmail(email) {
  if (!email.toLowerCase().includes('@gmail.com')) {
    return email;
  }
  
  const [name, domain] = email.split('@');
  
  // Don't add dots if name is too short
  if (name.length <= 3) {
    return email;
  }
  
  // Decide how many dots to add (1-3)
  const numDots = Math.floor(Math.random() * Math.min(3, name.length - 2)) + 1;
  
  // Find positions where dots can be inserted
  const validPositions = Array.from({ length: name.length - 2 }, (_, i) => i + 1);
  
  if (validPositions.length === 0) {
    return email;
  }
  
  // Shuffle and pick positions
  const positions = validPositions.sort(() => 0.5 - Math.random()).slice(0, numDots).sort((a, b) => a - b);
  
  // Insert dots
  let newName = '';
  let lastPos = 0;
  
  for (const pos of positions) {
    newName += name.substring(lastPos, pos) + '.';
    lastPos = pos;
  }
  
  newName += name.substring(lastPos);
  
  return `${newName}@${domain}`;
}

// Add plus addressing to Gmail
function addPlusToEmail(email) {
  if (!email.toLowerCase().includes('@gmail.com')) {
    return email;
  }
  
  const [name, domain] = email.split('@');
  
  // Generate random tag
  const tagLength = Math.floor(Math.random() * 6) + 3; // 3-8 characters
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const tag = Array.from({ length: tagLength }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${name}+${tag}@${domain}`;
}

// Modify Gmail address with either dot or plus trick
function modifyGmailAddress(email) {
  if (!email.toLowerCase().includes('@gmail.com')) {
    return email;
  }
  
  // Randomly choose between dot trick and plus trick
  return Math.random() < 0.5 ? addDotsToEmail(email) : addPlusToEmail(email);
}

// Generate multiple email variations
function generateMultipleEmailVariations(baseEmail, count = 5) {
  if (!validateEmail(baseEmail)) {
    return [baseEmail];
  }
  
  const variations = [];
  const [name, domain] = baseEmail.split('@');
  
  // Only use Gmail tricks if it's a Gmail address
  if (domain.toLowerCase() === 'gmail.com') {
    // Generate variations using both methods
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        variations.push(addDotsToEmail(baseEmail));
      } else {
        variations.push(addPlusToEmail(baseEmail));
      }
    }
  } else {
    // For non-Gmail, just use the original email
    variations.push(baseEmail);
  }
  
  // Remove duplicates
  const uniqueVariations = [...new Set(variations)];
  
  // If we don't have enough variations, add the original
  if (uniqueVariations.length < count && !uniqueVariations.includes(baseEmail)) {
    uniqueVariations.push(baseEmail);
  }
  
  return uniqueVariations.slice(0, count);
}

// Save account information to a file
async function saveAccountInfo(email, username, password) {
  try {
    const accountsFile = process.env.ACCOUNTS_FILE || './accounts.txt';
    const data = `Email: ${email}, Username: ${username}, Password: ${password}\n`;
    await fs.appendFile(accountsFile, data);
    return true;
  } catch (error) {
    console.error('Error saving account info:', error.message);
    return false;
  }
}

// Read accounts from the file
async function getAccounts() {
  try {
    const accountsFile = process.env.ACCOUNTS_FILE || './accounts.txt';
    const data = await fs.readFile(accountsFile, 'utf8');
    
    const accounts = [];
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      const emailMatch = line.match(/Email: ([^,]+)/);
      const usernameMatch = line.match(/Username: ([^,]+)/);
      const passwordMatch = line.match(/Password: ([^\n]+)/);
      
      if (emailMatch && usernameMatch && passwordMatch) {
        accounts.push({
          email: emailMatch[1].trim(),
          username: usernameMatch[1].trim(),
          password: passwordMatch[1].trim()
        });
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('Error reading accounts:', error.message);
    return [];
  }
}

module.exports = {
  generateDeviceId,
  createTicket,
  checkEmailAvailability,
  sendVerificationCode,
  checkUsernameAvailability,
  verifyAndRegister,
  generatePassword,
  validateEmail,
  generateUsername,
  modifyGmailAddress,
  generateMultipleEmailVariations,
  saveAccountInfo,
  getAccounts
};