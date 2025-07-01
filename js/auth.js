// Centralized authentication utilities

// Global authentication state
let currentUser = null;
let currentUserData = null;

// Initialize authentication state monitoring
document.addEventListener("DOMContentLoaded", () => {
    // Monitor authentication state
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            try {
                // Get user data from database
                const userSnapshot = await database.ref(`users/${user.uid}`).once('value');
                currentUserData = userSnapshot.val();
                
                // Update UI with user info if elements exist
                updateUserInfoDisplay();
                
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        } else {
            currentUserData = null;
            // Redirect to login if not on login page
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    });
});

// Check if user is authenticated and has required role
function requireAuth(requiredRole = null) {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                reject('User not authenticated');
                return;
            }

            try {
                // Get user data from database
                const userSnapshot = await database.ref(`users/${user.uid}`).once('value');
                const userData = userSnapshot.val();
                
                if (!userData) {
                    await auth.signOut();
                    window.location.href = 'login.html';
                    reject('User data not found');
                    return;
                }

                // Check role if required
                if (requiredRole && userData.role !== requiredRole) {
                    // Redirect to appropriate dashboard
                    if (userData.role === 'admin') {
                        window.location.href = 'admin-dashboard.html';
                    } else if (userData.role === 'subadmin') {
                        window.location.href = 'sub-admin.html';
                    } else {
                        await auth.signOut();
                        window.location.href = 'login.html';
                    }
                    reject('Insufficient permissions');
                    return;
                }

                currentUser = user;
                currentUserData = userData;
                resolve({ user, userData });
                
            } catch (error) {
                console.error('Error checking authentication:', error);
                await auth.signOut();
                window.location.href = 'login.html';
                reject(error);
            }
        });
    });
}

// Logout function
async function logout() {
    try {
        // Show loading state if logout button exists
        const logoutBtn = document.querySelector('[data-logout]');
        if (logoutBtn) {
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing out...';
            logoutBtn.disabled = true;
        }

        await auth.signOut();
        currentUser = null;
        currentUserData = null;
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error signing out: ' + error.message);
        
        // Reset button state
        if (logoutBtn) {
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Logout';
            logoutBtn.disabled = false;
        }
    }
}

// Update user info display in UI
function updateUserInfoDisplay() {
    if (!currentUserData) return;

    // Update user name displays
    const userNameElements = document.querySelectorAll('[data-user-name]');
    userNameElements.forEach(element => {
        element.textContent = currentUserData.name || currentUserData.email;
    });

    // Update user email displays
    const userEmailElements = document.querySelectorAll('[data-user-email]');
    userEmailElements.forEach(element => {
        element.textContent = currentUserData.email;
    });

    // Update user role displays
    const userRoleElements = document.querySelectorAll('[data-user-role]');
    userRoleElements.forEach(element => {
        element.textContent = currentUserData.role === 'admin' ? 'Administrator' : 'Sub-Administrator';
    });
}

// Create new user in database
async function createUserInDatabase(uid, userData) {
    try {
        await database.ref(`users/${uid}`).set({
            ...userData,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: 'active'
        });

        // Initialize user account
        await database.ref(`accounts/${uid}`).set({
            balance: 0,
            totalReceived: 0,
            totalSpent: 0,
            totalTransferred: 0,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });

        return true;
    } catch (error) {
        console.error('Error creating user in database:', error);
        throw error;
    }
}

// Update user balance
async function updateUserBalance(userId, newBalance, transactionData = null) {
    try {
        // Get current balance to ensure atomic update
        const currentBalance = await getUserBalance(userId);
        
        const updates = {
            [`accounts/${userId}/balance`]: newBalance,
            [`accounts/${userId}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP
        };

        // Add transaction if provided
        if (transactionData) {
            const transactionId = database.ref('transactions').push().key;
            updates[`transactions/${transactionId}`] = {
                ...transactionData,
                previousBalance: currentBalance,
                newBalance: newBalance,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                reference: transactionId
            };
        }

        await database.ref().update(updates);
        return true;
    } catch (error) {
        console.error('Error updating user balance:', error);
        throw error;
    }
}

// Transfer balance between users
async function transferBalance(fromUserId, toUserId, amount, reason = '') {
    try {
        const fromBalance = await getUserBalance(fromUserId);
        const toBalance = await getUserBalance(toUserId);
        
        if (fromBalance < amount) {
            throw new Error('Insufficient balance');
        }
        
        const newFromBalance = fromBalance - amount;
        const newToBalance = toBalance + amount;
        
        const transactionData = {
            type: 'transfer',
            fromUserId: fromUserId,
            toUserId: toUserId,
            amount: amount,
            description: reason || 'Balance transfer',
            status: 'completed',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        const updates = {
            [`accounts/${fromUserId}/balance`]: newFromBalance,
            [`accounts/${toUserId}/balance`]: newToBalance,
            [`accounts/${fromUserId}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP,
            [`accounts/${toUserId}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Add transaction record
        const transactionId = database.ref('transactions').push().key;
        updates[`transactions/${transactionId}`] = {
            ...transactionData,
            fromPreviousBalance: fromBalance,
            fromNewBalance: newFromBalance,
            toPreviousBalance: toBalance,
            toNewBalance: newToBalance,
            reference: transactionId
        };
        
        await database.ref().update(updates);
        return { transactionId, newFromBalance, newToBalance };
    } catch (error) {
        console.error('Error transferring balance:', error);
        throw error;
    }
}

// Get user balance
async function getUserBalance(userId) {
    try {
        const snapshot = await database.ref(`accounts/${userId}/balance`).once('value');
        return snapshot.val() || 0;
    } catch (error) {
        console.error('Error getting user balance:', error);
        return 0;
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' :
                'fa-info-circle'
            } mr-2"></i>
            <span>${message}</span>
            <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add event listeners for logout buttons
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-logout]') || e.target.closest('[data-logout]')) {
        e.preventDefault();
        
        if (confirm('Are you sure you want to sign out?')) {
            logout();
        }
    }
});

// Export functions for global use
window.requireAuth = requireAuth;
window.logout = logout;
window.createUserInDatabase = createUserInDatabase;
window.updateUserBalance = updateUserBalance;
window.transferBalance = transferBalance;
window.getUserBalance = getUserBalance;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.showNotification = showNotification;

