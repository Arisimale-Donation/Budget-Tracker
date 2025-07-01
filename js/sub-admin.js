// Sub-admin dashboard functionality
let currentSection = 'home';
let availableItems = {};
let shoppingCart = [];
let transactionHistory = {};
let accountData = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Require sub-admin authentication
    try {
        await requireAuth('subadmin');
        console.log('Sub-admin authenticated successfully');
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
    // Setup bottom navigation
    setupBottomNavigation();
    
    // Setup real-time listeners
    setupRealtimeListeners();
    
    // Load initial section
    showSection('home');
    
    // Setup pull-to-refresh
    setupPullToRefresh();
}

// Setup event listeners
function setupEventListeners() {
    // Quick action buttons
    document.getElementById('requestMoneyBtn').addEventListener('click', showRequestMoneyModal);
    document.getElementById('transferBalanceBtn').addEventListener('click', showTransferBalanceModal);
    document.getElementById('shopItemsBtn').addEventListener('click', () => showSection('shop'));
    document.getElementById('viewHistoryBtn').addEventListener('click', () => showSection('history'));
    
    // Header buttons
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('notificationBtn').addEventListener('click', showNotifications);
    
    // Shop section
    document.getElementById('cartBtn').addEventListener('click', showCartModal);
    document.getElementById('itemSearch').addEventListener('input', filterItems);
    document.getElementById('closeCartModal').addEventListener('click', hideCartModal);
    document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);
    document.getElementById('addItemBtn').addEventListener('click', showAddItemModal);
    
    // History tabs
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            filterHistory(type);
            
            // Update active tab
            document.querySelectorAll('.history-tab').forEach(t => {
                t.classList.remove('bg-white', 'text-purple-600', 'shadow-sm');
                t.classList.add('text-gray-600');
            });
            e.target.classList.add('bg-white', 'text-purple-600', 'shadow-sm');
            e.target.classList.remove('text-gray-600');
        });
    });
    
    // Settings buttons
    document.getElementById('changePasswordBtn').addEventListener('click', showChangePasswordModal);
    document.getElementById('notificationSettingsBtn').addEventListener('click', showNotificationSettings);
    
    // View all buttons
    document.getElementById('viewAllMoneyHistory').addEventListener('click', () => {
        showSection('history');
        filterHistory('money_received');
    });
    document.getElementById('viewAllPurchases').addEventListener('click', () => {
        showSection('history');
        filterHistory('purchase');
    });
}

// Setup bottom navigation
function setupBottomNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const section = button.getAttribute('data-section');
            if (section) {
                showSection(section);
                
                // Update active state
                navButtons.forEach(btn => {
                    btn.classList.remove('text-purple-600');
                    btn.classList.add('text-gray-500');
                });
                button.classList.add('text-purple-600');
                button.classList.remove('text-gray-500');
            }
        });
    });
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
        
        // Load section-specific data
        loadSectionData(sectionName);
        
        // Update header title
        const titles = {
            home: 'Dashboard',
            shop: 'Shop Items',
            history: 'History',
            settings: 'Settings'
        };
        document.querySelector('header h2').textContent = titles[sectionName] || 'Dashboard';
    }
}

// Load section-specific data
function loadSectionData(section) {
    switch (section) {
        case 'home':
            loadDashboardData();
            break;
        case 'shop':
            loadAvailableItems();
            break;
        case 'history':
            loadTransactionHistory();
            break;
        case 'settings':
            // Settings data is loaded from auth.js
            break;
    }
}

// Setup real-time listeners
function setupRealtimeListeners() {
    if (!currentUser) return;
    
    // Listen to account balance changes
    database.ref(`accounts/${currentUser.uid}`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            accountData = snapshot.val();
            updateBalanceDisplay();
            updateQuickStats();
        }
    });
    
    // Listen to transactions involving this user
    database.ref('transactions').orderByChild('toUserId').equalTo(currentUser.uid).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const receivedTransactions = snapshot.val() || {};
            
            // Also get sent transactions
            database.ref('transactions').orderByChild('fromUserId').equalTo(currentUser.uid).once('value', (sentSnapshot) => {
                const sentTransactions = sentSnapshot.val() || {};
                
                // Combine all transactions
                transactionHistory = { ...receivedTransactions, ...sentTransactions };
                
                if (currentSection === 'history') {
                    displayTransactionHistory();
                }
                if (currentSection === 'home') {
                    loadRecentActivity();
                }
            });
        }
    });
    
    // Listen to item assignments for this user
    database.ref('itemAssignments').orderByChild('subAdminId').equalTo(currentUser.uid).on('value', (snapshot) => {
        if (snapshot.exists()) {
            loadAvailableItems();
        }
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        await Promise.all([
            loadAccountData(),
            loadRecentActivity()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load account data
async function loadAccountData() {
    try {
        const balance = await getUserBalance(currentUser.uid);
        accountData.balance = balance;
        updateBalanceDisplay();
        updateQuickStats();
    } catch (error) {
        console.error('Error loading account data:', error);
    }
}

// Update balance display
function updateBalanceDisplay() {
    const balance = accountData.balance || 0;
    document.getElementById('currentBalance').textContent = formatCurrency(balance);
    document.getElementById('lastUpdated').textContent = formatDate(accountData.updatedAt);
    
    // Calculate total spent from transaction history
    let totalSpent = 0;
    Object.values(transactionHistory || {}).forEach(transaction => {
        if (transaction.fromUserId === currentUser.uid && transaction.type === 'purchase') {
            totalSpent += transaction.amount || 0;
        }
    });
    
    // Calculate usage percentage based on Total Spend / Current Balance * 100%
    const percentage = balance > 0 ? Math.min((totalSpent / balance) * 100, 100) : 0;
    document.getElementById('budgetProgress').style.width = `${percentage}%`;
    document.getElementById('budgetPercentage').textContent = `${Math.round(percentage)}%`;
}

// Update quick stats
function updateQuickStats() {
    let totalReceived = 0;
    let totalSpent = 0;
    
    // Calculate totals from transaction history
    Object.values(transactionHistory).forEach(transaction => {
        if (transaction.toUserId === currentUser.uid && transaction.type === 'money_given') {
            totalReceived += transaction.amount || 0;
        } else if (transaction.fromUserId === currentUser.uid && transaction.type === 'purchase') {
            // Only include purchase transactions in total spent
            totalSpent += transaction.amount || 0;
        }
    });
    
    document.getElementById('totalReceived').textContent = formatCurrency(totalReceived);
    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
}

// Load recent activity
function loadRecentActivity() {
    loadRecentMoneyHistory();
    loadRecentPurchases();
}

// Load recent money history
function loadRecentMoneyHistory() {
    const container = document.getElementById('recentMoneyHistory');
    const moneyTransactions = Object.entries(transactionHistory)
        .filter(([id, transaction]) => 
            transaction.type === 'money_given' && transaction.toUserId === currentUser.uid
        )
        .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 5);
    
    if (moneyTransactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-history text-2xl mb-2"></i>
                <p class="text-sm">No recent money history</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = moneyTransactions.map(([id, transaction]) => `
        <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
            <div class="flex items-center">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <i class="fas fa-arrow-down text-green-600"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-800">Money Received</p>
                    <p class="text-sm text-gray-500">${formatDate(transaction.timestamp)}</p>
                </div>
            </div>
            <span class="font-semibold text-green-600">+${formatCurrency(transaction.amount || 0)}</span>
        </div>
    `).join('');
}

// Load recent purchases
function loadRecentPurchases() {
    const purchasesList = document.getElementById('recentPurchases');
    if (!purchasesList) return;
    
    // Get recent purchases from transaction history
    const recentPurchases = Object.entries(transactionHistory)
        .filter(([_, transaction]) => transaction.type === 'purchase')
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 5);
    
    if (recentPurchases.length === 0) {
        purchasesList.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p>No recent purchases</p>
            </div>
        `;
        return;
    }
    
    const purchasesHtml = recentPurchases.map(([_, transaction]) => {
        const items = transaction.items || [];
        const itemsList = items.map(item => `
            <div class="flex justify-between items-center text-sm">
                <span class="text-gray-600">${item.name} x${item.quantity}</span>
                <span class="font-medium">${formatCurrency(item.price * item.quantity)}</span>
            </div>
        `).join('');
        
        return `
            <div class="bg-white rounded-xl card-shadow p-4 mb-3">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="text-sm text-gray-600">${formatDate(transaction.timestamp)}</p>
                        <p class="font-medium text-gray-800">Purchase Transaction</p>
                    </div>
                    <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                        ${formatCurrency(transaction.amount)}
                    </span>
                </div>
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${itemsList}
                </div>
            </div>
        `;
    }).join('');
    
    purchasesList.innerHTML = purchasesHtml;
}

// Get item name by ID
function getItemName(itemId) {
    return availableItems[itemId]?.name || 'Unknown Item';
}

// Show add item modal
function showAddItemModal() {
    const modalContent = `
        <form id="addItemForm" class="space-y-4">
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Item Name</label>
                <input type="text" id="itemName" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Quantity</label>
                <input type="number" id="itemQuantity" required min="1"
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Price</label>
                <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500">$</span>
                    <input type="number" id="itemPrice" required min="0.01" step="0.01"
                           class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                </div>
            </div>
            <div class="flex justify-end space-x-3">
                <button type="button" onclick="closeModal()" 
                        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                    Cancel
                </button>
                <button type="submit" 
                        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
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
        price: parseFloat(document.getElementById('itemPrice').value),
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        available: true,
        isSubAdminItem: true // Flag to identify items added by sub-admin
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
        
        // Refresh items list
        loadAvailableItems();
        
    } catch (error) {
        console.error('Error adding item:', error);
        showNotification('Error adding item', 'error');
    }
}

// Load available items
async function loadAvailableItems() {
    try {
        const itemsRef = database.ref('items');
        availableItems = {};

        // Get items assigned to this sub-admin
        const assignedSnapshot = await itemsRef.orderByChild('assignedTo').equalTo(currentUser.uid).once('value');
        if (assignedSnapshot.exists()) {
            const items = assignedSnapshot.val();
            Object.entries(items).forEach(([itemId, item]) => {
                if (item.quantity > 0) {
                    availableItems[itemId] = { ...item, isAssigned: true };
                }
            });
        }

        // Get items created by this sub-admin
        const ownItemsSnapshot = await itemsRef.orderByChild('createdBy').equalTo(currentUser.uid).once('value');
        if (ownItemsSnapshot.exists()) {
            const items = ownItemsSnapshot.val();
            Object.entries(items).forEach(([itemId, item]) => {
                if (item.quantity > 0 && item.isSubAdminItem) {
                    availableItems[itemId] = { ...item, isOwn: true };
                }
            });
        }
        
        displayAvailableItems();
    } catch (error) {
        console.error('Error loading available items:', error);
        showNotification('Error loading items', 'error');
    }
}

// Display available items
function displayAvailableItems() {
    const itemsGrid = document.getElementById('itemsGrid');
    
    if (!availableItems || Object.keys(availableItems).length === 0) {
        itemsGrid.innerHTML = `
            <div class="text-center text-gray-500 col-span-full py-12">
                <i class="fas fa-box text-3xl mb-4"></i>
                <p>No items available</p>
            </div>
        `;
        return;
    }
    
    const searchTerm = document.getElementById('itemSearch').value.toLowerCase();
    const filteredItems = Object.entries(availableItems).filter(([_, item]) => {
        return item.name.toLowerCase().includes(searchTerm) && item.quantity > 0;
    });
    
    if (filteredItems.length === 0) {
        itemsGrid.innerHTML = `
            <div class="text-center text-gray-500 col-span-full py-12">
                <i class="fas fa-search text-3xl mb-4"></i>
                <p>No items match your search</p>
            </div>
        `;
        return;
    }
    
    const itemsHtml = filteredItems.map(([itemId, item]) => `
        <div class="bg-white rounded-xl card-shadow p-4 item-card">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-semibold text-gray-800">${item.name}</h4>
                </div>
                <div class="flex flex-col items-end space-y-1">
                    ${item.isAssigned ? 
                        `<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                            Admin Assigned
                        </span>` :
                        `<span class="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                            Your Item
                        </span>`
                    }
                </div>
            </div>
            <div class="space-y-2 mb-4">
                <p class="text-sm">
                    <span class="font-medium text-gray-700">Available Quantity:</span>
                    <span class="text-gray-600">${item.quantity}</span>
                </p>
                ${item.isAssigned ? 
                    `<p class="text-sm">
                        <span class="font-medium text-gray-700">Assigned:</span>
                        <span class="text-gray-600">${formatDate(item.assignedAt)}</span>
                    </p>` : ''
                }
                <div class="flex items-center space-x-2">
                    <span class="font-medium text-gray-700 text-sm">Price:</span>
                    <div class="relative flex-1">
                        <span class="absolute left-3 top-2 text-gray-500">$</span>
                        <input type="number" 
                               value="${item.price || ''}"
                               placeholder="Set price"
                               min="0"
                               step="0.01"
                               class="w-full pl-7 pr-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                               onchange="updateItemPrice('${itemId}', this.value)"
                               onkeypress="return event.charCode >= 48 && event.charCode <= 57 || event.charCode === 46">
                    </div>
                </div>
            </div>
            <div class="flex justify-end">
                <button onclick="addToCart('${itemId}')" 
                        class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200">
                    <i class="fas fa-cart-plus mr-2"></i>Add to Cart
                </button>
            </div>
        </div>
    `).join('');
    
    itemsGrid.innerHTML = itemsHtml;
}

function addToCart(itemId) {
    const item = availableItems[itemId];
    if (!item) return;
    
    // Check if price is set
    if (!item.price) {
        showNotification('Please set a price before adding to cart', 'error');
        return;
    }
    
    // Rest of the existing addToCart logic
    const existingItem = shoppingCart.find(cartItem => cartItem.id === itemId);
    
    if (existingItem) {
        if (existingItem.quantity < item.quantity) {
            existingItem.quantity++;
            showNotification('Item quantity increased', 'success');
        } else {
            showNotification('Maximum quantity reached', 'error');
            return;
        }
    } else {
        shoppingCart.push({
            id: itemId,
            name: item.name,
            price: item.price,
            quantity: 1,
            maxQuantity: item.quantity
        });
        showNotification('Item added to cart', 'success');
    }
    
    updateCartDisplay();
}

// Update cart display
function updateCartDisplay() {
    const cartCount = shoppingCart.reduce((total, item) => total + item.quantity, 0);
    const cartCountElement = document.getElementById('cartCount');
    
    if (cartCount > 0) {
        cartCountElement.textContent = cartCount;
        cartCountElement.classList.remove('hidden');
    } else {
        cartCountElement.classList.add('hidden');
    }
}

// Show cart modal
function showCartModal() {
    const modal = document.getElementById('cartModal');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    
    if (shoppingCart.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-shopping-cart text-3xl mb-2"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        cartFooter.classList.add('hidden');
    } else {
        cartItems.innerHTML = shoppingCart.map(item => `
            <div class="flex items-center justify-between py-3 border-b border-gray-100">
                <div class="flex-1">
                    <h4 class="font-medium">${item.name}</h4>
                    <p class="text-sm text-gray-600">${formatCurrency(item.price)} each</p>
                </div>
                <div class="flex items-center space-x-3">
                    <button onclick="updateCartQuantity('${item.id}', -1)" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                    <span class="font-medium">${item.quantity}</span>
                    <button onclick="updateCartQuantity('${item.id}', 1)" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                    <button onclick="removeFromCart('${item.id}')" class="text-red-500 ml-2">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        const total = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        document.getElementById('cartTotal').textContent = formatCurrency(total);
        cartFooter.classList.remove('hidden');
    }
    
    modal.classList.remove('hidden');
}

// Hide cart modal
function hideCartModal() {
    document.getElementById('cartModal').classList.add('hidden');
}

// Update cart quantity
function updateCartQuantity(itemId, change) {
    const item = shoppingCart.find(cartItem => cartItem.id === itemId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(itemId);
    } else if (newQuantity <= item.maxQuantity) {
        item.quantity = newQuantity;
        updateCartDisplay();
        showCartModal(); // Refresh modal
    } else {
        showNotification(`Maximum quantity (${item.maxQuantity}) reached`, 'warning');
    }
}

// Remove from cart
function removeFromCart(itemId) {
    shoppingCart = shoppingCart.filter(item => item.id !== itemId);
    updateCartDisplay();
    showCartModal(); // Refresh modal
}

// Handle checkout
async function handleCheckout() {
    if (shoppingCart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    const total = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const currentBalance = await getUserBalance(currentUser.uid);
    
    if (currentBalance < total) {
        showNotification('Insufficient balance', 'error');
        return;
    }
    
    try {
        // Get admin's ID
        const adminSnapshot = await database.ref('users')
            .orderByChild('role')
            .equalTo('admin')
            .once('value');
        
        const adminId = Object.keys(adminSnapshot.val())[0];
        
        // Separate items by type
        const adminItems = [];
        const ownItems = [];
        
        shoppingCart.forEach(item => {
            const fullItem = availableItems[item.id];
            if (fullItem.isAssigned) {
                adminItems.push(item);
            } else {
                ownItems.push(item);
            }
        });
        
        // Create purchase transaction for admin-assigned items
        if (adminItems.length > 0) {
            const adminTransaction = {
                type: 'purchase',
                fromUserId: currentUser.uid,
                toUserId: adminId,
                amount: adminItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                description: `Purchase of ${adminItems.length} admin-assigned item(s)`,
                items: adminItems.map(item => ({
                    itemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                status: 'completed',
                timestamp: Date.now()
            };
            
            // Add transaction to database
            await database.ref('transactions').push().set(adminTransaction);
        }
        
        // Create purchase transaction for own items
        if (ownItems.length > 0) {
            const ownTransaction = {
                type: 'purchase',
                fromUserId: currentUser.uid,
                toUserId: currentUser.uid, // Self-transaction for own items
                amount: ownItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                description: `Purchase of ${ownItems.length} own item(s)`,
                items: ownItems.map(item => ({
                    itemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                status: 'completed',
                timestamp: Date.now(),
                isOwnItemPurchase: true // Flag to identify self-purchases
            };
            
            // Add transaction to database
            await database.ref('transactions').push().set(ownTransaction);
        }
        
        // Update sub-admin's balance (reduce it)
        await database.ref(`accounts/${currentUser.uid}/balance`).transaction(balance => {
            return (balance || 0) - total;
        });
        
        // Update item quantities
        for (const item of shoppingCart) {
            await database.ref(`items/${item.id}`).update({
                quantity: availableItems[item.id].quantity - item.quantity
            });
        }
        
        // Clear cart
        shoppingCart = [];
        updateCartDisplay();
        hideCartModal();
        
        showNotification('Purchase completed successfully!', 'success');
        
        // Refresh items display
        loadAvailableItems();
        
    } catch (error) {
        console.error('Error processing checkout:', error);
        showNotification('Error processing purchase: ' + error.message, 'error');
    }
}

// Load transaction history
function loadTransactionHistory() {
    displayTransactionHistory();
}

// Display transaction history
function displayTransactionHistory() {
    const container = document.getElementById('historyList');
    const transactions = Object.entries(transactionHistory)
        .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-history text-3xl mb-4"></i>
                <p>No transaction history</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(([id, transaction]) => {
        // Generate item list for purchases
        let description = '';
        if (transaction.type === 'purchase' && transaction.items && transaction.items.length > 0) {
            const itemsList = transaction.items.map(item => 
                `${item.name} (${item.quantity}x)`
            ).join(', ');
            description = itemsList;
        }

        return `
        <div class="bg-white rounded-xl card-shadow p-4">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                    <div class="w-10 h-10 ${getTransactionColor(transaction.type)} rounded-lg flex items-center justify-center mr-3">
                        <i class="fas ${getTransactionIcon(transaction.type)} text-white"></i>
                    </div>
                    <div>
                        <h4 class="font-medium">${getTransactionTitle(transaction)}</h4>
                        <p class="text-sm text-gray-500">${formatDate(transaction.timestamp)}</p>
                    </div>
                </div>
                <span class="font-semibold ${transaction.type === 'purchase' || transaction.type === 'transfer' ? 'text-red-600' : 'text-green-600'}">
                    ${transaction.type === 'purchase' || transaction.type === 'transfer' ? '-' : '+'}${formatCurrency(transaction.amount || 0)}
                </span>
            </div>
            ${description ? `<p class="text-sm text-gray-600 ml-13">${description}</p>` : ''}
        </div>
        `;
    }).join('');
}

// Get transaction color
function getTransactionColor(type) {
    const colors = {
        money_given: 'bg-green-500',
        money_returned: 'bg-blue-500',
        purchase: 'bg-red-500',
        transfer: 'bg-purple-500'
    };
    return colors[type] || 'bg-gray-500';
}

// Get transaction icon
function getTransactionIcon(type) {
    const icons = {
        money_given: 'fa-arrow-down',
        money_returned: 'fa-arrow-up',
        purchase: 'fa-shopping-cart',
        transfer: 'fa-paper-plane'
    };
    return icons[type] || 'fa-circle';
}

// Get transaction title
function getTransactionTitle(transaction) {
    const titles = {
        money_given: 'Money Received',
        money_returned: 'Money Returned',
        purchase: transaction.isOwnItemPurchase ? 'Own Purchase' : 'Admin Item Purchase',
        transfer: 'Transfer to Admin'
    };
    return titles[transaction.type] || 'Transaction';
}

// Filter history
function filterHistory(type) {
    const transactions = document.querySelectorAll('#historyList > div');
    
    transactions.forEach(transaction => {
        const transactionType = getTransactionTypeFromElement(transaction);
        
        if (type === 'all' || transactionType === type) {
            transaction.style.display = 'block';
        } else {
            transaction.style.display = 'none';
        }
    });
}

// Get transaction type from element
function getTransactionTypeFromElement(element) {
    const title = element.querySelector('h4').textContent;
    
    if (title.includes('Money Received')) return 'money_received';
    if (title.includes('Purchase')) return 'purchase';
    if (title.includes('Transfer')) return 'transfer';
    
    return 'all';
}

// Show request money modal
function showRequestMoneyModal() {
    const modal = createModal('Request Money', `
        <form id="requestMoneyForm">
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Amount</label>
                <input type="number" id="requestAmount" step="0.01" min="0" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Reason</label>
                <textarea id="requestReason" rows="3" required
                          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Please explain why you need additional funds"></textarea>
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">Send Request</button>
            </div>
        </form>
    `);
    
    document.getElementById('requestMoneyForm').addEventListener('submit', handleRequestMoney);
}

// Handle request money
async function handleRequestMoney(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('requestAmount').value);
    const reason = document.getElementById('requestReason').value;
    
    try {
        // Create a request transaction (pending status)
        const transactionData = {
            type: 'money_request',
            fromUserId: currentUser.uid,
            toUserId: currentUserData.adminId,
            amount: amount,
            description: `Money request: ${reason}`,
            status: 'pending'
        };
        
        const transactionId = database.ref('transactions').push().key;
        await database.ref(`transactions/${transactionId}`).set({
            ...transactionData,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            reference: transactionId
        });
        
        showNotification('Money request sent successfully', 'success');
        closeModal();
        
    } catch (error) {
        console.error('Error sending money request:', error);
        showNotification('Error sending request: ' + error.message, 'error');
    }
}

// Show transfer balance modal
function showTransferBalanceModal() {
    const currentBalance = accountData.balance || 0;
    
    const modal = createModal('Transfer Balance', `
        <div class="mb-4">
            <p class="text-sm text-gray-600 mb-4">Current Balance: <span class="font-semibold">${formatCurrency(currentBalance)}</span></p>
        </div>
        <form id="transferBalanceForm">
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Amount to Transfer</label>
                <input type="number" id="transferAmount" step="0.01" min="0" max="${currentBalance}" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <button type="button" onclick="document.getElementById('transferAmount').value = ${currentBalance}" 
                        class="text-purple-600 text-sm mt-1">Transfer All</button>
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">description</label>
                <textarea id="transferdescription" rows="3"
                          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Optional: Reason for transfer"></textarea>
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">Transfer</button>
            </div>
        </form>
    `);
    
    document.getElementById('transferBalanceForm').addEventListener('submit', handleTransferBalance);
}

// Handle transfer balance
async function handleTransferBalance(e) {
    e.preventDefault();
    
    try {
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const description = document.getElementById('transferdescription').value;
        
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid amount');
        }
        
        // Get current balance
        const currentBalance = await getUserBalance(currentUser.uid);
        
        if (amount > currentBalance) {
            throw new Error('Insufficient balance for transfer');
        }
        
        // Get admin's ID
        const adminSnapshot = await database.ref('users')
            .orderByChild('role')
            .equalTo('admin')
            .once('value');
        
        const adminId = Object.keys(adminSnapshot.val())[0];
        
        // Create transaction record
        const transaction = {
            type: 'transfer',
            fromUserId: currentUser.uid,
            toUserId: adminId,
            amount: amount,
            description: description,
            status: 'completed',
            timestamp: Date.now()
        };
        
        // Add transaction to database
        const newTransactionRef = database.ref('transactions').push();
        await newTransactionRef.set(transaction);
        
        // Update balances
        await Promise.all([
            // Reduce sub-admin's balance
            database.ref(`accounts/${currentUser.uid}/balance`).transaction(balance => {
                return (balance || 0) - amount;
            }),
            // Increase admin's balance
            database.ref(`accounts/${adminId}/balance`).transaction(balance => {
                return (balance || 0) + amount;
            })
        ]);
        
        closeModal();
        showNotification('Money transferred successfully', 'success');
        
        // Refresh dashboard data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error transferring balance:', error);
        showNotification(error.message, 'error');
    }
}

// Show change password modal
function showChangePasswordModal() {
    const modal = createModal('Change Password', `
        <form id="changePasswordForm">
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Current Password</label>
                <input type="password" id="currentPassword" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">New Password</label>
                <input type="password" id="newPassword" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Confirm New Password</label>
                <input type="password" id="confirmNewPassword" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">Change Password</button>
            </div>
        </form>
    `);
    
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
}

// Handle change password
async function handleChangePassword(e) {
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
        closeModal();
        
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('Error changing password: ' + error.message, 'error');
    }
}

// Show notification settings
function showNotificationSettings() {
    showNotification('Notification settings coming soon', 'info');
}

// Show notifications
function showNotifications() {
    showNotification('No new notifications', 'info');
}

// Refresh data
async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('pulse-animation');
    
    try {
        await loadDashboardData();
        showNotification('Data refreshed', 'success');
    } catch (error) {
        showNotification('Error refreshing data', 'error');
    } finally {
        setTimeout(() => {
            refreshBtn.classList.remove('pulse-animation');
        }, 1000);
    }
}

// Setup pull-to-refresh
function setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isPulling) {
            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 100) {
                // Trigger refresh
                refreshData();
                isPulling = false;
            }
        }
    });
    
    document.addEventListener('touchend', () => {
        isPulling = false;
    });
}

// Create modal
function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-full max-w-md">
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
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.closeModal = closeModal;

// Update item price
async function updateItemPrice(itemId, price) {
    try {
        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice) || numericPrice < 0) {
            showNotification('Please enter a valid price', 'error');
            return;
        }

        // Update the price in Firebase
        await database.ref(`items/${itemId}`).update({
            price: numericPrice,
            priceUpdatedAt: Date.now(),
            priceUpdatedBy: currentUser.uid
        });

        // Update local data
        if (availableItems[itemId]) {
            availableItems[itemId].price = numericPrice;
        }

        showNotification('Price updated successfully', 'success');
    } catch (error) {
        console.error('Error updating price:', error);
        showNotification('Error updating price', 'error');
    }
}

// Filter items
function filterItems() {
    const searchTerm = document.getElementById('itemSearch').value.toLowerCase();
    const itemCards = document.querySelectorAll('.item-card');
    
    itemCards.forEach(card => {
        const itemName = card.querySelector('h4').textContent.toLowerCase();
        const itemDescription = card.querySelector('p').textContent.toLowerCase();
        const itemCategory = card.querySelector('.bg-purple-100').textContent.toLowerCase();
        
        const matches = itemName.includes(searchTerm) || 
                       itemDescription.includes(searchTerm) || 
                       itemCategory.includes(searchTerm);
        
        card.style.display = matches ? 'block' : 'none';
    });
    
    // Show/hide empty state message
    const visibleItems = Array.from(itemCards).filter(card => card.style.display !== 'none');
    const emptyState = document.querySelector('.text-center.text-gray-500');
    
    if (emptyState) {
        if (visibleItems.length === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <i class="fas fa-search text-3xl mb-4"></i>
                <p>No items match your search</p>
            `;
        } else {
            emptyState.style.display = 'none';
        }
    }
}

// Format date helper function
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

