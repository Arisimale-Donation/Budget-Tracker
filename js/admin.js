// Admin dashboard functionality
let currentSection = 'dashboard';
let subAdminsData = {};
let itemsData = {};
let transactionsData = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Require admin authentication
    try {
        await requireAuth('admin');
        console.log('Admin authenticated successfully');
    } catch (error) {
        console.error('Authentication failed:', error);
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    setupEventListeners();
    loadDashboardData();
});

// Initialize dashboard components
function initializeDashboard() {
    // Setup sidebar navigation
    setupSidebarNavigation();
    
    // Setup real-time listeners
    setupRealtimeListeners();
    
    // Load initial section
    showSection('dashboard');
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Quick action buttons
    document.getElementById('addSubAdminBtn').addEventListener('click', () => showAddSubAdminModal());
    document.getElementById('transferMoneyBtn').addEventListener('click', () => showSection('financial'));
    document.getElementById('assignItemsBtn').addEventListener('click', () => showSection('items'));
    document.getElementById('viewReportsBtn').addEventListener('click', () => showSection('history'));
    
    // Sub-Admin Management button
    document.getElementById('addNewSubAdmin').addEventListener('click', () => showAddSubAdminModal());
    
    // Form submissions
    document.getElementById('addMoneyForm').addEventListener('submit', handleAddMoney);
    document.getElementById('transferMoneyForm').addEventListener('submit', handleTransferMoney);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
    
    // Search and filters
    document.getElementById('subAdminSearch').addEventListener('input', filterSubAdmins);
    document.getElementById('subAdminStatusFilter').addEventListener('change', filterSubAdmins);
    document.getElementById('globalSearch').addEventListener('input', handleGlobalSearch);
    
    // History filters
    document.getElementById('historyFromDate').addEventListener('change', filterHistory);
    document.getElementById('historyToDate').addEventListener('change', filterHistory);
    document.getElementById('historyTypeFilter').addEventListener('change', filterHistory);
    document.getElementById('exportHistory').addEventListener('click', exportHistory);
}

// Setup sidebar navigation
function setupSidebarNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) {
                showSection(section);
                
                // Update active state
                navLinks.forEach(l => l.classList.remove('bg-gray-700'));
                link.classList.add('bg-gray-700');
            }
        });
    });
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('sidebar-collapsed');
}

// Show section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        currentSection = sectionName;
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard Overview',
            subadmins: 'Sub-Admin Management',
            financial: 'Financial Management',
            items: '',
            history: 'Transaction History',
            settings: 'Settings'
        };
        document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';
        
        // Load section-specific data
        loadSectionData(sectionName);
    }
}

// Load section-specific data
function loadSectionData(section) {
    switch (section) {
        case 'dashboard':
            loadDashboardMetrics();
            loadRecentActivity();
            break;
        case 'subadmins':
            loadSubAdmins();
            break;
        case 'financial':
            loadSubAdminsForTransfer();
            break;
        case 'items':
            loadItems();
            break;
        case 'history':
            loadTransactionHistory();
            break;
        case 'settings':
            loadProfileSettings();
            break;
    }
}

// Setup real-time listeners
function setupRealtimeListeners() {
    if (!currentUser) return;
    
    // Listen to accounts changes
    database.ref('accounts').on('value', (snapshot) => {
        if (snapshot.exists()) {
            updateDashboardMetrics();
        }
    });
    
    // Listen to users changes
    database.ref('users').on('value', (snapshot) => {
        if (snapshot.exists()) {
            subAdminsData = {};
            snapshot.forEach((childSnapshot) => {
                const userData = childSnapshot.val();
                if (userData.role === 'subadmin') {
                    subAdminsData[childSnapshot.key] = userData;
                }
            });
            
            if (currentSection === 'subadmins') {
                displaySubAdmins();
            }
            updateSubAdminCount();
        }
    });
    
    // Listen to transactions changes
    database.ref('transactions').on('value', (snapshot) => {
        if (snapshot.exists()) {
            transactionsData = snapshot.val() || {};
            
            if (currentSection === 'history') {
                displayTransactionHistory();
            }
            if (currentSection === 'dashboard') {
                loadRecentActivity();
                // Immediately update balance when receiving a transfer
                loadDashboardMetrics();
            }
            updateFinancialMetrics();
        }
    });
    
    // Listen to items changes
    database.ref('items').on('value', (snapshot) => {
        if (snapshot.exists()) {
            itemsData = snapshot.val() || {};
            
            if (currentSection === 'items') {
                displayItems();
            }
        }
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load all necessary data
        await Promise.all([
            loadDashboardMetrics(),
            loadRecentActivity(),
            loadSubAdmins(),
            loadItems()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load dashboard metrics
async function loadDashboardMetrics() {
    try {
        // Get admin's main account balance
        const adminBalance = await getUserBalance(currentUser.uid);
        document.getElementById('mainBalance').textContent = formatCurrency(adminBalance);
        
        // Calculate other metrics from transactions
        updateFinancialMetrics();
        updateSubAdminCount();
        
    } catch (error) {
        console.error('Error loading dashboard metrics:', error);
    }
}

// Update financial metrics
function updateFinancialMetrics() {
    let moneyGiven = 0;
    let moneyReturned = 0;
    
    Object.values(transactionsData).forEach(transaction => {
        if (transaction.fromUserId === currentUser.uid) {
            if (transaction.type === 'money_given') {
                moneyGiven += transaction.amount || 0;
            }
        } else if (transaction.toUserId === currentUser.uid) {
            if (transaction.type === 'money_returned' || transaction.type === 'transfer') {
                moneyReturned += transaction.amount || 0;
            }
        }
    });
    
    document.getElementById('moneyDistributed').textContent = formatCurrency(moneyGiven);
    document.getElementById('moneyReturned').textContent = formatCurrency(moneyReturned);
}

// Update sub-admin count
function updateSubAdminCount() {
    const count = Object.keys(subAdminsData).length;
    document.getElementById('totalSubAdmins').textContent = count;
}

// Load recent activity
function loadRecentActivity() {
    const recentActivityContainer = document.getElementById('recentActivity');
    const recentTransactions = Object.entries(transactionsData)
        .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 10);
    
    if (recentTransactions.length === 0) {
        recentActivityContainer.innerHTML = `
            <div class="text-gray-500 text-center py-8">
                <i class="fas fa-history text-3xl mb-2"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    recentActivityContainer.innerHTML = recentTransactions.map(([id, transaction]) => {
        const date = formatDate(transaction.timestamp);
        const amount = formatCurrency(transaction.amount || 0);
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <i class="fas ${getTransactionIcon(transaction.type)} text-blue-600 text-sm"></i>
                    </div>
                    <div>
                        <p class="font-medium">${getTransactionDescription(transaction)}</p>
                        <p class="text-sm text-gray-500">${date}</p>
                    </div>
                </div>
                <span class="font-semibold ${transaction.type === 'purchase' ? 'text-blue-600' : transaction.type === 'money_given' ? 'text-red-600' : 'text-green-600'}">
                    ${transaction.type === 'money_given' ? '-' : transaction.type === 'purchase' ? '✓' : '+'}${amount}
                </span>
            </div>
        `;
    }).join('');
}

// Get transaction icon
function getTransactionIcon(type) {
    const icons = {
        money_given: 'fa-arrow-up',
        money_returned: 'fa-arrow-down',
        purchase: 'fa-shopping-cart',
        transfer: 'fa-exchange-alt'
    };
    return icons[type] || 'fa-circle';
}

// Get transaction description
function getTransactionDescription(transaction) {
    if (transaction.type === 'purchase' && transaction.items && transaction.items.length > 0) {
        const itemsList = transaction.items.map(item => 
            `${item.name} (${item.quantity}x at ${formatCurrency(item.price)})`
        ).join(', ');
        return transaction.isOwnItemPurchase ? 
            `Own Purchase: ${itemsList}` : 
            `Admin Item Purchase: ${itemsList}`;
    }

    const descriptions = {
        money_given: 'Money sent to sub-admin',
        money_returned: 'Money returned from sub-admin',
        purchase: 'Item purchased',
        transfer: 'Balance transferred'
    };
    return descriptions[transaction.type] || 'Transaction';
}

// Load sub-admins
async function loadSubAdmins() {
    // Real-time listener handles this
    displaySubAdmins();
}

// Display sub-admins
async function displaySubAdmins() {
    const tableBody = document.getElementById('subAdminsTableBody');
    const subAdminsList = Object.entries(subAdminsData);
    
    if (subAdminsList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No sub-admins found</td></tr>';
        return;
    }
    
    // Get balances for all sub-admins
    const balancePromises = subAdminsList.map(async ([uid, userData]) => {
        const balance = await getUserBalance(uid);
        return { uid, userData, balance };
    });
    
    const subAdminsWithBalances = await Promise.all(balancePromises);
    
    tableBody.innerHTML = subAdminsWithBalances.map(({ uid, userData, balance }) => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <i class="fas fa-user text-gray-600 text-sm"></i>
                    </div>
                    <span class="font-medium">${userData.name || 'N/A'}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${userData.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">${formatCurrency(balance)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                    userData.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${userData.status || 'active'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editSubAdmin('${uid}')" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="toggleSubAdminStatus('${uid}')" class="text-yellow-600 hover:text-yellow-900 mr-3">
                    <i class="fas fa-toggle-${userData.status === 'active' ? 'on' : 'off'}"></i>
                </button>
                <button onclick="deleteSubAdmin('${uid}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Filter sub-admins
function filterSubAdmins() {
    const searchTerm = document.getElementById('subAdminSearch').value.toLowerCase();
    const statusFilter = document.getElementById('subAdminStatusFilter').value;
    
    const rows = document.querySelectorAll('#subAdminsTableBody tr');
    rows.forEach(row => {
        const name = row.querySelector('td:first-child span').textContent.toLowerCase();
        const email = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const status = row.querySelector('td:nth-child(4) span').textContent.toLowerCase();
        
        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
        const matchesStatus = !statusFilter || status.includes(statusFilter);
        
        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

// Show add sub-admin modal
function showAddSubAdminModal() {
    const modal = createModal('Add Sub-Admin', `
        <form id="addSubAdminForm">
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Name</label>
                <input type="text" id="subAdminName" required 
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                <input type="email" id="subAdminEmail" required 
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Phone</label>
                <input type="tel" id="subAdminPhone" 
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Initial Budget</label>
                <input type="number" id="subAdminBudget" step="0.01" min="0" 
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">Add Sub-Admin</button>
            </div>
        </form>
    `);
    
    document.getElementById('addSubAdminForm').addEventListener('submit', handleAddSubAdmin);
}

// Handle add sub-admin
async function handleAddSubAdmin(e) {
    e.preventDefault();
    
    const name = document.getElementById('subAdminName').value;
    const email = document.getElementById('subAdminEmail').value;
    const phone = document.getElementById('subAdminPhone').value;
    const budget = parseFloat(document.getElementById('subAdminBudget').value) || 0;
    
    try {
        // Generate temporary password
        const tempPassword = generateTempPassword();
        
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, tempPassword);
        const user = userCredential.user;
        
        // Create user in database
        await createUserInDatabase(user.uid, {
            name,
            email,
            phone,
            role: 'subadmin',
            adminId: currentUser.uid
        });
        
        // Transfer initial budget if specified
        if (budget > 0) {
            await transferMoneyToSubAdmin(user.uid, budget, 'Initial budget allocation');
        }
        
        showNotification(`Sub-admin added successfully. Temporary password: ${tempPassword}`, 'success');
        closeModal();
        
        // Sign back in as admin
        await auth.signInWithEmailAndPassword(currentUser.email, 'admin-password');
        
    } catch (error) {
        console.error('Error adding sub-admin:', error);
        showNotification('Error adding sub-admin: ' + error.message, 'error');
    }
}

// Generate temporary password
function generateTempPassword() {
    return Math.random().toString(36).slice(-8);
}

// Transfer money to sub-admin
async function transferMoneyToSubAdmin(subAdminId, amount, description) {
    try {
        // Get current balances
        const adminBalance = await getUserBalance(currentUser.uid);
        const subAdminBalance = await getUserBalance(subAdminId);
        
        if (adminBalance < amount) {
            throw new Error('Insufficient balance');
        }
        
        // Create transaction
        const transactionData = {
            type: 'money_given',
            fromUserId: currentUser.uid,
            toUserId: subAdminId,
            amount: amount,
            description: description,
            status: 'completed'
        };
        
        // Update balances
        const updates = {
            [`accounts/${currentUser.uid}/balance`]: adminBalance - amount,
            [`accounts/${subAdminId}/balance`]: subAdminBalance + amount,
            [`accounts/${currentUser.uid}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP,
            [`accounts/${subAdminId}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Add transaction
        const transactionId = database.ref('transactions').push().key;
        updates[`transactions/${transactionId}`] = {
            ...transactionData,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            reference: transactionId
        };
        
        await database.ref().update(updates);
        return true;
        
    } catch (error) {
        console.error('Error transferring money:', error);
        throw error;
    }
}

// Handle add money to main account
async function handleAddMoney(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('addMoneyAmount').value);
    const source = document.getElementById('moneySource').value;
    const description = document.getElementById('moneyDescription').value;
    
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    if (!source) {
        showNotification('Please select a money source', 'error');
        return;
    }
    
    try {
        const currentBalance = await getUserBalance(currentUser.uid);
        const newBalance = currentBalance + amount;
        
        const transactionData = {
            type: 'money_added',
            toUserId: currentUser.uid,
            amount: amount,
            description: `${source}: ${description}`,
            status: 'completed'
        };
        
        await updateUserBalance(currentUser.uid, newBalance, transactionData);
        
        showNotification(`Successfully added ${formatCurrency(amount)} to main account`, 'success');
        
        // Reset form
        document.getElementById('addMoneyForm').reset();
        
    } catch (error) {
        console.error('Error adding money:', error);
        showNotification('Error adding money: ' + error.message, 'error');
    }
}

// Handle transfer money
async function handleTransferMoney(e) {
    e.preventDefault();
    
    const subAdminId = document.getElementById('transferToSubAdmin').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const description = document.getElementById('transferdescription').value;
    
    if (!subAdminId) {
        showNotification('Please select a sub-admin', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        await transferMoneyToSubAdmin(subAdminId, amount, description);
        showNotification(`Successfully transferred ${formatCurrency(amount)}`, 'success');
        
        // Reset form
        document.getElementById('transferMoneyForm').reset();
        
    } catch (error) {
        console.error('Error transferring money:', error);
        showNotification('Error transferring money: ' + error.message, 'error');
    }
}

// Load sub-admins for transfer dropdown
function loadSubAdminsForTransfer() {
    const select = document.getElementById('transferToSubAdmin');
    select.innerHTML = '<option value="">Select sub-admin</option>';
    
    Object.entries(subAdminsData).forEach(([uid, userData]) => {
        if (userData.status === 'active') {
            const option = document.createElement('option');
            option.value = uid;
            option.textContent = `${userData.name} (${userData.email})`;
            select.appendChild(option);
        }
    });
}

// Load items
function loadItems() {
    displayItems();
}

// Show add item modal
function showAddItemModal() {
    const modalContent = `
        <form id="addItemForm" class="space-y-4">
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Item Name</label>
                <input type="text" id="itemName" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="Enter item name">
            </div>
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Quantity</label>
                <input type="number" id="itemQuantity" required min="1"
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="Enter quantity">
            </div>
            <div class="flex justify-end space-x-3">
                <button type="button" onclick="closeModal()" 
                        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                    Cancel
                </button>
                <button type="submit" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                    Add Item
                </button>
            </div>
        </form>
    `;
    
    createModal('Add New Item', modalContent);
    
    // Add form submit handler
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
}

// Handle add item form submission
async function handleAddItem(e) {
    e.preventDefault();
    
    const itemData = {
        name: document.getElementById('itemName').value.trim(),
        quantity: parseInt(document.getElementById('itemQuantity').value),
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        available: true,
        assignedTo: null
    };
    
    try {
        // Generate a new item ID
        const newItemRef = database.ref('items').push();
        
        // Save the item data
        await newItemRef.set(itemData);
        
        // Close the modal
        closeModal();
        
        // Show success notification
        showNotification('Item added successfully', 'success');
        
    } catch (error) {
        console.error('Error adding item:', error);
        showNotification('Error adding item', 'error');
    }
}

// Show assign item modal
function showAssignItemModal(itemId) {
    const item = itemsData[itemId];
    if (!item) return;
    
    const modalContent = `
        <form id="assignItemForm" class="space-y-4" data-item-id="${itemId}">
            <div>
                <p class="text-gray-700 font-bold">Item: ${item.name}</p>
            </div>
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Select Sub-Admin</label>
                <select id="assignToSubAdmin" required
                        class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select sub-admin</option>
                    ${Object.entries(subAdminsData)
                        .map(([id, admin]) => `<option value="${id}">${admin.name}</option>`)
                        .join('')}
                </select>
            </div>
            <div class="flex justify-end space-x-3">
                <button type="button" onclick="closeModal()" 
                        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                    Cancel
                </button>
                <button type="submit" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                    Assign Item
                </button>
            </div>
        </form>
    `;
    
    createModal('Assign Item', modalContent);
    
    // Add form submit handler
    document.getElementById('assignItemForm').addEventListener('submit', handleAssignItem);
}

async function handleAssignItem(e) {
    e.preventDefault();
    
    const itemId = e.target.getAttribute('data-item-id');
    const subAdminId = document.getElementById('assignToSubAdmin').value;
    
    if (!itemId || !subAdminId) return;
    
    try {
        // Update item assignment
        await database.ref(`items/${itemId}`).update({
            assignedTo: subAdminId,
            assignedAt: Date.now(),
            available: false
        });
        
        // Close the modal
        closeModal();
        
        // Show success notification
        showNotification('Item assigned successfully', 'success');
        
    } catch (error) {
        console.error('Error assigning item:', error);
        showNotification('Error assigning item', 'error');
    }
}

// Display items
function displayItems() {
    const itemsList = document.getElementById('itemsList');
    
    if (!itemsData || Object.keys(itemsData).length === 0) {
        itemsList.innerHTML = `
            <div class="text-center text-gray-500 col-span-full py-8">
                <i class="fas fa-box text-3xl mb-2"></i>
                <p>No items found</p>
            </div>
        `;
        return;
    }
    
    // Filter out sub-admin's custom items
    const adminItems = Object.entries(itemsData).filter(([_, item]) => !item.isSubAdminItem);
    
    if (adminItems.length === 0) {
        itemsList.innerHTML = `
            <div class="text-center text-gray-500 col-span-full py-8">
                <i class="fas fa-box text-3xl mb-2"></i>
                <p>No admin items found</p>
            </div>
        `;
        return;
    }
    
    const itemsHtml = adminItems.map(([itemId, item]) => {
        const assignedTo = item.assignedTo ? subAdminsData[item.assignedTo]?.name || 'Unknown Sub-Admin' : 'Not Assigned';
        const statusClass = item.available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const statusText = item.available ? 'Available' : 'Assigned';
        
        return `
            <div class="bg-white p-6 rounded-lg shadow-sm border">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-800">${item.name}</h4>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </div>
                <div class="space-y-2">
                    <p class="text-sm">
                        <span class="font-medium">Quantity:</span> 
                        <span class="text-gray-600">${item.quantity}</span>
                    </p>
                    <p class="text-sm">
                        <span class="font-medium">Assigned To:</span> 
                        <span class="text-gray-600">${assignedTo}</span>
                    </p>
                </div>
                <div class="mt-4 flex justify-end">
                    ${item.available ? 
                        `<button onclick="showAssignItemModal('${itemId}')" 
                                 class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                            <i class="fas fa-user-plus mr-2"></i>Assign
                        </button>` : 
                        `<button onclick="unassignItem('${itemId}')" 
                                 class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                            <i class="fas fa-user-minus mr-2"></i>Unassign
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');
    
    itemsList.innerHTML = itemsHtml;
}

// Unassign item from sub-admin
async function unassignItem(itemId) {
    try {
        await database.ref(`items/${itemId}`).update({
            assignedTo: null,
            available: true
        });
        
        showNotification('Item unassigned successfully', 'success');
    } catch (error) {
        console.error('Error unassigning item:', error);
        showNotification('Error unassigning item', 'error');
    }
}

// Add event listener for the Add Item button
document.addEventListener('DOMContentLoaded', () => {
    const addNewItemBtn = document.getElementById('addNewItem');
    if (addNewItemBtn) {
        addNewItemBtn.addEventListener('click', showAddItemModal);
    }
});

// Load transaction history
function loadTransactionHistory() {
    displayTransactionHistory();
}

// Display transaction history
function displayTransactionHistory() {
    const tableBody = document.getElementById('historyTableBody');
    const transactions = Object.entries(transactionsData)
        .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No transactions found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = transactions.map(([id, transaction]) => {
        // Generate detailed description for purchases
        let description = transaction.description || '';
        if (transaction.type === 'purchase' && transaction.items && transaction.items.length > 0) {
            const itemsList = transaction.items.map(item => 
                `${item.name} (${item.quantity}x at ${formatCurrency(item.price)})`
            ).join(', ');
            description = transaction.isOwnItemPurchase ? 
                `Own Purchase: ${itemsList}` : 
                `Admin Item Purchase: ${itemsList}`;
        }

        return `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(transaction.timestamp)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${transaction.type.replace('_', ' ')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${getTransactionParty(transaction)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${
                transaction.type === 'money_given' ? 'text-red-600' : 
                transaction.type === 'money_returned' ? 'text-green-600' : 
                'text-gray-900'
            }">${formatCurrency(transaction.amount || 0)}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${description || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                    transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                }">
                    ${transaction.status || 'completed'}
                </span>
            </td>
        </tr>
        `;
    }).join('');
}

// Get transaction party (from/to)
function getTransactionParty(transaction) {
    // For money request transactions, show who requested the money
    if (transaction.type === 'money_request') {
        const subAdmin = subAdminsData[transaction.fromUserId];
        return subAdmin ? `Requested by ${subAdmin.name}` : 'Unknown';
    }
    
    // For sub-admin's own item purchases
    if (transaction.type === 'purchase' && transaction.isOwnItemPurchase) {
        const subAdmin = subAdminsData[transaction.fromUserId];
        return subAdmin ? `${subAdmin.name} (Own Purchase)` : 'Unknown';
    }
    
    // For other transaction types
    if (transaction.fromUserId === currentUser.uid) {
        const subAdmin = subAdminsData[transaction.toUserId];
        return subAdmin ? subAdmin.name : 'Unknown';
    } else if (transaction.toUserId === currentUser.uid) {
        const subAdmin = subAdminsData[transaction.fromUserId];
        return subAdmin ? subAdmin.name : 'Unknown';
    } else if (transaction.fromUserId === transaction.toUserId) {
        // Self-transactions (like sub-admin's own purchases)
        const subAdmin = subAdminsData[transaction.fromUserId];
        return subAdmin ? `${subAdmin.name} (Self)` : 'Unknown';
    }
    
    return 'N/A';
}

// Filter history
function filterHistory() {
    const fromDate = document.getElementById('historyFromDate').value;
    const toDate = document.getElementById('historyToDate').value;
    const typeFilter = document.getElementById('historyTypeFilter').value;
    
    const rows = document.querySelectorAll('#historyTableBody tr');
    rows.forEach(row => {
        const dateCell = row.querySelector('td:first-child');
        const typeCell = row.querySelector('td:nth-child(2)');
        
        if (!dateCell || !typeCell) return;
        
        const rowDate = new Date(dateCell.textContent);
        const rowType = typeCell.textContent.toLowerCase().replace(' ', '_');
        
        let showRow = true;
        
        if (fromDate && rowDate < new Date(fromDate)) showRow = false;
        if (toDate && rowDate > new Date(toDate)) showRow = false;
        if (typeFilter && rowType !== typeFilter) showRow = false;
        
        row.style.display = showRow ? '' : 'none';
    });
}

// Export history
function exportHistory() {
    const transactions = Object.entries(transactionsData)
        .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0));
    
    const csvContent = [
        ['Date', 'Type', 'From/To', 'Amount', 'Description', 'Status'],
        ...transactions.map(([id, transaction]) => [
            formatDate(transaction.timestamp),
            transaction.type.replace('_', ' '),
            getTransactionParty(transaction),
            transaction.amount || 0,
            transaction.description || 'N/A',
            transaction.status || 'completed'
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Load profile settings
function loadProfileSettings() {
    if (currentUserData) {
        document.getElementById('profileName').value = currentUserData.name || '';
        document.getElementById('profileEmail').value = currentUserData.email || '';
        document.getElementById('profilePhone').value = currentUserData.phone || '';
    }
}

// Handle profile update
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    
    try {
        await database.ref(`users/${currentUser.uid}`).update({
            name,
            phone,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('Profile updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile: ' + error.message, 'error');
    }
}

// Handle password change
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        // Re-authenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
        await currentUser.reauthenticateWithCredential(credential);
        
        // Update password
        await currentUser.updatePassword(newPassword);
        
        showNotification('Password changed successfully', 'success');
        
        // Reset form
        document.getElementById('passwordForm').reset();
        
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('Error changing password: ' + error.message, 'error');
    }
}

// Handle global search
function handleGlobalSearch() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
    
    if (searchTerm.length < 2) return;
    
    // Search in current section
    switch (currentSection) {
        case 'subadmins':
            document.getElementById('subAdminSearch').value = searchTerm;
            filterSubAdmins();
            break;
        // Add more search functionality for other sections
    }
}

// Create modal
function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">${title}</h3>
                <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${content}
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    return modal;
}

// Close modal
function closeModal() {
    const modalContainer = document.getElementById('modalContainer');
    modalContainer.innerHTML = '';
}

// Global functions for onclick handlers
window.editSubAdmin = function(uid) {
    console.log('Edit sub-admin:', uid);
    // Implement edit functionality
};

window.toggleSubAdminStatus = function(uid) {
    console.log('Toggle sub-admin status:', uid);
    // Implement toggle functionality
};

window.deleteSubAdmin = function(uid) {
    if (confirm('Are you sure you want to delete this sub-admin?')) {
        console.log('Delete sub-admin:', uid);
        // Implement delete functionality
    }
};

window.editItem = function(id) {
    console.log('Edit item:', id);
    // Implement edit functionality
};

window.assignItem = function(id) {
    console.log('Assign item:', id);
    // Implement assign functionality
};

window.deleteItem = function(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        console.log('Delete item:', id);
        // Implement delete functionality
    }
};

window.closeModal = closeModal;

// Show notification
function showNotification(message, type = 'info') {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
    } text-white`;
    
    notificationContainer.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                'fa-info-circle'
            } mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notificationContainer);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notificationContainer.remove();
    }, 3000);
}

// Update dashboard metrics
async function updateDashboardMetrics() {
    try {
        // Update main account balance
        const mainBalance = await getUserBalance(currentUser.uid);
        document.getElementById('mainBalance').textContent = formatCurrency(mainBalance);

        // Update money distributed and returned
        const moneyDistributed = Object.values(transactionsData || {})
            .filter(t => t.type === 'money_given')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const moneyReturned = Object.values(transactionsData || {})
            .filter(t => t.type === 'money_returned')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        document.getElementById('moneyDistributed').textContent = formatCurrency(moneyDistributed);
        document.getElementById('moneyReturned').textContent = formatCurrency(moneyReturned);
    } catch (error) {
        console.error('Error updating dashboard metrics:', error);
        showNotification('Failed to update dashboard metrics', 'error');
    }
}

