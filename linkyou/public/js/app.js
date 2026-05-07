// LinkYou - Main Application JavaScript

// Global state
let currentUser = null;
let authToken = null;
let socket = null;
let currentConversation = null;

// API Base URL
const API_URL = window.location.origin + '/api';

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    initializeSocket();
    
    // Check for auth callback from OAuth
    if (window.location.hash.includes('auth-callback')) {
        handleOAuthCallback();
    }
});

// Setup navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Initialize Socket.IO
function initializeSocket() {
    socket = io(window.location.origin);
    
    socket.on('new_message', (data) => {
        if (currentConversation && data.conversationId === currentConversation.id) {
            appendMessage(data);
        }
        loadConversations();
    });
    
    socket.on('user_typing', (data) => {
        // Show typing indicator
        console.log('User is typing:', data.userId);
    });
}

// Check authentication status
function checkAuth() {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedToken && storedUser) {
        authToken = storedToken;
        currentUser = JSON.parse(storedUser);
        updateUIForLoggedInUser();
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'block';
    
    const avatarImg = document.getElementById('user-avatar-img');
    if (currentUser.avatar_url) {
        avatarImg.src = currentUser.avatar_url;
    } else {
        avatarImg.src = '/images/default-avatar.png';
    }
    
    // Show admin link if admin
    if (currentUser.is_admin) {
        document.getElementById('admin-link').style.display = 'block';
    }
    
    // Load profile data
    loadProfileData();
}

// Toggle user dropdown
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('user-menu');
    const dropdown = document.getElementById('user-dropdown');
    
    if (!userMenu.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// Show section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show requested section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Load section-specific data
    switch(sectionName) {
        case 'search':
            searchUsers();
            break;
        case 'chat':
            loadConversations();
            break;
        case 'admin':
            loadAdminData();
            break;
    }
    
    // Close dropdown
    document.getElementById('user-dropdown').classList.remove('show');
}

// Show login
function showLogin() {
    showSection('login');
}

// Show register
function showRegister() {
    showSection('register');
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const firstName = document.getElementById('register-firstname').value;
    const lastName = document.getElementById('register-lastname').value;
    const gender = document.getElementById('register-gender').value;
    const birthDate = document.getElementById('register-birthdate').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                firstName,
                lastName,
                gender,
                birthDate
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('Регистрация успешна!');
            updateUIForLoggedInUser();
            showSection('profile');
        } else {
            showNotification(data.error || 'Ошибка регистрации', true);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('Вход выполнен!');
            updateUIForLoggedInUser();
            showSection('profile');
        } else {
            showNotification(data.error || 'Ошибка входа', true);
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Logout
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    document.getElementById('admin-link').style.display = 'none';
    
    showSection('home');
    showNotification('Вы вышли из аккаунта');
}

// OAuth handlers
function telegramLogin() {
    // In production, use Telegram Login Widget
    // For demo, simulate login
    simulateSocialLogin('telegram');
}

function vkLogin() {
    // Redirect to VK OAuth
    window.location.href = `${API_URL}/auth/vk/callback`;
}

function googleLogin() {
    // Redirect to Google OAuth
    window.location.href = `${API_URL}/auth/google/callback`;
}

// Handle OAuth callback
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('token');
    const userId = params.get('userId');
    
    if (token && userId) {
        authToken = token;
        localStorage.setItem('authToken', token);
        
        // Fetch user data
        fetchCurrentUser();
    }
}

// Simulate social login for demo
async function simulateSocialLogin(provider) {
    const authData = {
        id: Date.now(),
        first_name: 'Demo',
        last_name: 'User',
        photo_url: '/images/default-avatar.png'
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ auth_data: authData })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('Вход через ' + provider + ' выполнен!');
            updateUIForLoggedInUser();
            showSection('profile');
        } else {
            showNotification(data.error || 'Ошибка входа', true);
        }
    } catch (error) {
        console.error('Social login error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Fetch current user
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUIForLoggedInUser();
            showSection('profile');
        }
    } catch (error) {
        console.error('Fetch user error:', error);
    }
}

// Load profile data
function loadProfileData() {
    if (!currentUser) return;
    
    document.getElementById('profile-firstname').value = currentUser.first_name || '';
    document.getElementById('profile-lastname').value = currentUser.last_name || '';
    document.getElementById('profile-gender').value = currentUser.gender || 'male';
    document.getElementById('profile-birthdate').value = currentUser.birth_date || '';
    document.getElementById('profile-height').value = currentUser.height || '';
    document.getElementById('profile-weight').value = currentUser.weight || '';
    document.getElementById('profile-bodytype').value = currentUser.body_type || '';
    document.getElementById('profile-city').value = currentUser.location_city || '';
    document.getElementById('profile-country').value = currentUser.location_country || '';
    document.getElementById('profile-aboutme').value = currentUser.about_me || '';
    document.getElementById('profile-lookingfor-gender').value = currentUser.looking_for_gender || 'female';
    document.getElementById('profile-lookingfor-age-min').value = currentUser.looking_for_age_min || 18;
    document.getElementById('profile-lookingfor-age-max').value = currentUser.looking_for_age_max || 99;
    
    if (currentUser.avatar_url) {
        document.getElementById('profile-avatar-preview').src = currentUser.avatar_url;
    }
}

// Handle profile update
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const profileData = {
        firstName: document.getElementById('profile-firstname').value,
        lastName: document.getElementById('profile-lastname').value,
        gender: document.getElementById('profile-gender').value,
        birthDate: document.getElementById('profile-birthdate').value,
        height: document.getElementById('profile-height').value,
        weight: document.getElementById('profile-weight').value,
        bodyType: document.getElementById('profile-bodytype').value,
        locationCity: document.getElementById('profile-city').value,
        locationCountry: document.getElementById('profile-country').value,
        aboutMe: document.getElementById('profile-aboutme').value,
        lookingForGender: document.getElementById('profile-lookingfor-gender').value,
        lookingForAgeMin: document.getElementById('profile-lookingfor-age-min').value,
        lookingForAgeMax: document.getElementById('profile-lookingfor-age-max').value
    };
    
    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showNotification('Профиль обновлен!');
        } else {
            showNotification(data.error || 'Ошибка обновления', true);
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Handle photo upload
async function handlePhotoUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('profile-photo-input');
    const isPrimary = document.getElementById('photo-is-primary').checked;
    
    if (!fileInput.files[0]) {
        showNotification('Выберите файл', true);
        return;
    }
    
    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('isPrimary', isPrimary);
    
    try {
        const response = await fetch(`${API_URL}/users/photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.avatar_url = data.photoUrl;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('profile-avatar-preview').src = data.photoUrl;
            document.getElementById('user-avatar-img').src = data.photoUrl;
            showNotification('Фото загружено!');
        } else {
            showNotification(data.error || 'Ошибка загрузки', true);
        }
    } catch (error) {
        console.error('Photo upload error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Search users
async function searchUsers() {
    const filters = {
        gender: document.getElementById('search-gender').value,
        lookingForGender: document.getElementById('search-lookingfor').value,
        ageMin: document.getElementById('search-age-min').value,
        ageMax: document.getElementById('search-age-max').value,
        bodyType: document.getElementById('search-bodytype').value,
        location: document.getElementById('search-location').value
    };
    
    const queryString = new URLSearchParams(filters).toString();
    
    try {
        const response = await fetch(`${API_URL}/users/search?${queryString}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displaySearchResults(data.users);
        } else {
            showNotification(data.error || 'Ошибка поиска', true);
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Display search results
function displaySearchResults(users) {
    const container = document.getElementById('search-results');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Анкеты не найдены</p>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="profile-card">
            <img src="${user.avatar_url || '/images/default-avatar.png'}" alt="${user.first_name}" class="profile-card-img">
            <div class="profile-card-info">
                <div class="profile-card-name">${user.first_name} ${user.last_name || ''}</div>
                <div class="profile-card-age">${calculateAge(user.birth_date)} лет</div>
                <div class="profile-card-location">
                    <i class="fas fa-map-marker-alt"></i> ${user.location_city || 'Город не указан'}
                </div>
                <div class="profile-card-actions">
                    <button class="btn btn-primary" onclick="likeUser(${user.id})">
                        <i class="fas fa-heart"></i> Лайк
                    </button>
                    <button class="btn btn-outline" onclick="startChat(${user.id}, '${user.first_name}', '${user.avatar_url || ''}')">
                        <i class="fas fa-comment"></i> Написать
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Calculate age
function calculateAge(birthDate) {
    if (!birthDate) return '?';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Like user
async function likeUser(userId) {
    try {
        const response = await fetch(`${API_URL}/users/like/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.isMatch) {
                showNotification('Это взаимно! Начните общение 💕');
            } else {
                showNotification('Лайк отправлен!');
            }
        } else {
            showNotification(data.error || 'Ошибка', true);
        }
    } catch (error) {
        console.error('Like error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Start chat
async function startChat(userId, userName, userAvatar) {
    try {
        const response = await fetch(`${API_URL}/chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ otherUserId: userId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentConversation = data.conversation;
            openChat({
                id: userId,
                first_name: userName,
                avatar_url: userAvatar
            });
            showSection('chat');
        }
    } catch (error) {
        console.error('Start chat error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Load conversations
async function loadConversations() {
    try {
        const response = await fetch(`${API_URL}/chat/conversations`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayConversations(data.conversations);
        }
    } catch (error) {
        console.error('Load conversations error:', error);
    }
}

// Display conversations
function displayConversations(conversations) {
    const container = document.getElementById('conversations-list');
    
    if (!conversations || conversations.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Нет сообщений</p>';
        return;
    }
    
    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="openConversation(${conv.id}, ${JSON.stringify(conv.otherUser).replace(/"/g, '&quot;')})">
            <img src="${conv.otherUser.avatar_url || '/images/default-avatar.png'}" alt="${conv.otherUser.first_name}" class="conversation-avatar">
            <div class="conversation-info">
                <div class="conversation-name">${conv.otherUser.first_name} ${conv.otherUser.last_name || ''}</div>
                <div class="conversation-last-message">${conv.lastMessage || 'Нет сообщений'}</div>
            </div>
        </div>
    `).join('');
}

// Open conversation
async function openConversation(conversationId, otherUser) {
    currentConversation = { id: conversationId, ...otherUser };
    
    // Mark as active
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Join socket room
    socket.emit('join_conversation', conversationId);
    
    // Load messages
    await loadMessages(conversationId);
    
    // Show chat window
    document.getElementById('chat-window').style.display = 'flex';
    document.getElementById('chat-user-name').textContent = `${otherUser.first_name} ${otherUser.last_name || ''}`;
    document.getElementById('chat-user-avatar').src = otherUser.avatar_url || '/images/default-avatar.png';
}

// Open chat (from search)
function openChat(otherUser) {
    document.getElementById('chat-window').style.display = 'flex';
    document.getElementById('chat-user-name').textContent = `${otherUser.first_name} ${otherUser.last_name || ''}`;
    document.getElementById('chat-user-avatar').src = otherUser.avatar_url || '/images/default-avatar.png';
}

// Close chat
function closeChat() {
    document.getElementById('chat-window').style.display = 'none';
    currentConversation = null;
}

// Load messages
async function loadMessages(conversationId) {
    try {
        const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const container = document.getElementById('chat-messages');
            container.innerHTML = data.messages.map(msg => `
                <div class="message ${msg.sender_id === currentUser.id ? 'sent' : ''}">
                    <img src="${msg.avatar_url || '/images/default-avatar.png'}" alt="" class="message-avatar">
                    <div class="message-content">
                        ${msg.message_text}
                        <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
                    </div>
                </div>
            `).join('');
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

// Send message
async function sendMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText || !currentConversation) return;
    
    try {
        const response = await fetch(`${API_URL}/chat/conversations/${currentConversation.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ messageText })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            socket.emit('send_message', {
                conversationId: currentConversation.id,
                senderId: currentUser.id,
                messageText
            });
            
            input.value = '';
            loadConversations();
        }
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('Ошибка отправки сообщения', true);
    }
}

// Append message to chat
function appendMessage(message) {
    const container = document.getElementById('chat-messages');
    const isSent = message.sender_id === currentUser.id;
    
    const messageHtml = `
        <div class="message ${isSent ? 'sent' : ''}">
            <img src="${message.avatar_url || '/images/default-avatar.png'}" alt="" class="message-avatar">
            <div class="message-content">
                ${message.message_text}
                <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', messageHtml);
    container.scrollTop = container.scrollHeight;
}

// Load admin data
async function loadAdminData() {
    if (!currentUser || !currentUser.is_admin) {
        showNotification('Доступ запрещен', true);
        return;
    }
    
    try {
        // Load stats
        const statsResponse = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const statsData = await statsResponse.json();
        
        if (statsResponse.ok) {
            document.getElementById('admin-stats').innerHTML = `
                <div class="stat-card">
                    <h3>${statsData.stats.totalUsers}</h3>
                    <p>Всего пользователей</p>
                </div>
                <div class="stat-card">
                    <h3>${statsData.stats.activeUsers}</h3>
                    <p>Активных</p>
                </div>
                <div class="stat-card">
                    <h3>${statsData.stats.totalConversations}</h3>
                    <p>Диалогов</p>
                </div>
                <div class="stat-card">
                    <h3>${statsData.stats.pendingReports}</h3>
                    <p>Жалоб</p>
                </div>
            `;
        }
        
        // Load users
        const usersResponse = await fetch(`${API_URL}/admin/users?limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const usersData = await usersResponse.json();
        
        if (usersResponse.ok) {
            document.getElementById('admin-users-table').innerHTML = usersData.users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.first_name} ${user.last_name || ''}</td>
                    <td>${user.email || '-'}</td>
                    <td>
                        <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                            ${user.is_active ? 'Активен' : 'Заблокирован'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-outline" style="padding: 5px 10px;" onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                            ${user.is_active ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load admin data error:', error);
    }
}

// Toggle user status
async function toggleUserStatus(userId, isActive) {
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isActive })
        });
        
        if (response.ok) {
            showNotification(isActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
            loadAdminData();
        } else {
            showNotification('Ошибка обновления', true);
        }
    } catch (error) {
        console.error('Toggle user status error:', error);
        showNotification('Ошибка подключения к серверу', true);
    }
}

// Show notification
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Handle default avatar error
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.src.includes('default-avatar')) {
        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23ff4757"/><circle cx="50" cy="40" r="20" fill="white"/><ellipse cx="50" cy="80" rx="30" ry="25" fill="white"/></svg>';
    }
}, true);
