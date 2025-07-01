// Date filtering utilities
const DateFilters = {
    getDateRange(filterType) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (filterType) {
            case 'today':
                return {
                    start: today,
                    end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                };
            case 'yesterday':
                return {
                    start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
                    end: today
                };
            case 'thisWeek':
                const thisWeekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                return {
                    start: thisWeekStart,
                    end: new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
                };
            case 'lastWeek':
                const lastWeekStart = new Date(today.setDate(today.getDate() - today.getDay() - 7));
                return {
                    start: lastWeekStart,
                    end: new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
                };
            case 'thisMonth':
                return {
                    start: new Date(now.getFullYear(), now.getMonth(), 1),
                    end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                };
            case 'lastMonth':
                return {
                    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    end: new Date(now.getFullYear(), now.getMonth(), 0)
                };
            case 'custom':
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                return {
                    start: startDate ? new Date(startDate) : null,
                    end: endDate ? new Date(endDate) : null
                };
            default:
                return { start: null, end: null };
        }
    },

    isDateInRange(date, range) {
        if (!range.start && !range.end) return true;
        const timestamp = new Date(date).getTime();
        const start = range.start ? range.start.getTime() : -Infinity;
        const end = range.end ? range.end.getTime() : Infinity;
        return timestamp >= start && timestamp <= end;
    }
};

// Report generation functionality
class ReportGenerator {
    constructor() {
        // Wait for jsPDF to be available
        if (typeof window.jspdf === 'undefined') {
            console.error('jsPDF is not loaded');
            return;
        }
        
        // Initialize jsPDF
        this.jsPDF = window.jspdf.jsPDF;
        
        // Check if autoTable plugin is available
        if (typeof window.jspdf.autoTable === 'undefined') {
            console.error('jsPDF-AutoTable plugin is not loaded');
            return;
        }
    }

    // Generate financial report
    async generateFinancialReport(data, options = {}) {
        try {
            if (!this.jsPDF) {
                throw new Error('jsPDF is not initialized');
            }

            const doc = new this.jsPDF();
            const title = 'Financial Report';
            const dateRange = options.dateRange || { start: null, end: null };
            const reportType = options.reportType || 'detailed';
            
            // Add report header
            doc.setFontSize(18);
            doc.text(title, 14, 20);

            // Add date range info
            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateText = dateRange.start && dateRange.end 
                ? `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                : 'Period: All Time';
            doc.text(dateText, 14, 30);

            // Calculate summary data
            const totalCredit = data.reduce((sum, t) => sum + (t.type === 'Credit' ? t.amount : 0), 0);
            const totalDebit = data.reduce((sum, t) => sum + (t.type === 'Debit' ? t.amount : 0), 0);
            const balance = totalCredit - totalDebit;

            // Add summary section
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text('Summary', 14, 40);
            
            const summaryData = [
                ['Total Credit', `$${totalCredit.toFixed(2)}`],
                ['Total Debit', `$${totalDebit.toFixed(2)}`],
                ['Net Balance', `$${balance.toFixed(2)}`]
            ];

            doc.autoTable({
                startY: 45,
                head: [['Category', 'Amount']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [66, 139, 202] },
                styles: { fontSize: 10 }
            });

            // Add transactions table for detailed report
            if (reportType === 'detailed') {
                doc.text('Transaction Details', 14, doc.autoTable.previous.finalY + 10);
                
                doc.autoTable({
                    startY: doc.autoTable.previous.finalY + 15,
                    head: [['Date', 'Description', 'Amount', 'Type']],
                    body: data.map(item => [
                        item.date,
                        item.description,
                        `$${item.amount.toFixed(2)}`,
                        item.type
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [66, 139, 202] },
                    styles: { fontSize: 10 }
                });
            }

            return doc;
        } catch (error) {
            console.error('Error in generateFinancialReport:', error);
            throw error;
        }
    }

    // Generate sub-admin activity report
    async generateSubAdminReport(data, options = {}) {
        try {
            if (!this.jsPDF) {
                throw new Error('jsPDF is not initialized');
            }

            const doc = new this.jsPDF();
            const title = 'Sub-Admin Report';
            const dateRange = options.dateRange || { start: null, end: null };
            const reportType = options.reportType || 'performance';
            
            // Add report header
            doc.setFontSize(18);
            doc.text(title, 14, 20);

            // Add date range info
            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateText = dateRange.start && dateRange.end 
                ? `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                : 'Period: All Time';
            doc.text(dateText, 14, 30);

            if (reportType === 'performance') {
                // Performance metrics table
                doc.autoTable({
                    startY: 40,
                    head: [['Name', 'Email', 'Total Transactions', 'Balance', 'Performance Score']],
                    body: data.map(item => [
                        item.name,
                        item.email,
                        item.totalTransactions,
                        `$${item.balance.toFixed(2)}`,
                        this.calculatePerformanceScore(item)
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [66, 139, 202] },
                    styles: { fontSize: 10 }
                });
            } else {
                // Activity log table
                doc.autoTable({
                    startY: 40,
                    head: [['Name', 'Email', 'Last Active', 'Status', 'Recent Activities']],
                    body: data.map(item => [
                        item.name,
                        item.email,
                        item.lastActive || 'N/A',
                        item.status || 'Active',
                        item.recentActivities || 'No recent activity'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [66, 139, 202] },
                    styles: { fontSize: 10 }
                });
            }

            return doc;
        } catch (error) {
            console.error('Error in generateSubAdminReport:', error);
            throw error;
        }
    }

    // Generate items distribution report
    async generateItemsReport(data, options = {}) {
        try {
            if (!this.jsPDF) {
                throw new Error('jsPDF is not initialized');
            }

            const doc = new this.jsPDF();
            const title = 'Items Report';
            const dateRange = options.dateRange || { start: null, end: null };
            
            // Add report header
            doc.setFontSize(18);
            doc.text(title, 14, 20);

            // Add date range info
            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateText = dateRange.start && dateRange.end 
                ? `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                : 'Period: All Time';
            doc.text(dateText, 14, 30);

            // Calculate summary data with proper type conversion
            const totalItems = data.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
            
            // Calculate total value by summing (quantity × price) for each item
            const totalValue = data.reduce((sum, item) => {
                const quantity = parseInt(item.quantity) || 0;
                const price = parseFloat(item.price) || 0;
                const itemTotal = quantity * price;
                return sum + itemTotal;
            }, 0);

            const ownPurchases = data.filter(item => item.isOwnPurchase);
            const assignedItems = data.filter(item => !item.isOwnPurchase);
            
            // Calculate total values for own purchases and assigned items
            const ownPurchasesValue = ownPurchases.reduce((sum, item) => {
                const quantity = parseInt(item.quantity) || 0;
                const price = parseFloat(item.price) || 0;
                return sum + (quantity * price);
            }, 0);

            const assignedItemsValue = assignedItems.reduce((sum, item) => {
                const quantity = parseInt(item.quantity) || 0;
                const price = parseFloat(item.price) || 0;
                return sum + (quantity * price);
            }, 0);

            const uniqueItems = data.length;
            const uniqueOwnPurchases = ownPurchases.length;
            const uniqueAssignedItems = assignedItems.length;

            // Add summary section
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text('Summary', 14, 40);

            const summaryData = [
                ['Total Unique Items', uniqueItems.toString()],
                ['Own Purchases', `${uniqueOwnPurchases} ($${ownPurchasesValue.toFixed(2)})`],
                ['Assigned Items', `${uniqueAssignedItems} ($${assignedItemsValue.toFixed(2)})`],
                ['Total Quantity', totalItems.toString()],
                ['Total Value', `$${totalValue.toFixed(2)}`],
                ['Average Price/Item', totalItems > 0 ? `$${(totalValue / totalItems).toFixed(2)}` : '$0.00']
            ];

            doc.autoTable({
                startY: 45,
                head: [['Metric', 'Value']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [66, 139, 202] },
                styles: { fontSize: 10 },
                columnStyles: {
                    0: { cellWidth: 100 },
                    1: { cellWidth: 60 }
                }
            });

            // Add detailed items table
            doc.text('Item Details', 14, doc.autoTable.previous.finalY + 10);

            doc.autoTable({
                startY: doc.autoTable.previous.finalY + 15,
                head: [['Item Name', 'Quantity', 'Price/Unit', 'Total Value', 'Purchased By', 'Purchase Date']],
                body: data.map(item => {
                    const quantity = parseInt(item.quantity) || 0;
                    const price = parseFloat(item.price) || 0;
                    const itemTotal = quantity * price;
                    return [
                        item.name || '-',
                        quantity.toString(),
                        `$${price.toFixed(2)}`,
                        `$${itemTotal.toFixed(2)}`,
                        item.purchasedBy,
                        item.purchaseDate
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: [66, 139, 202] },
                styles: { fontSize: 10 },
                columnStyles: {
                    0: { cellWidth: 40 }, // Item Name
                    1: { cellWidth: 25 }, // Quantity
                    2: { cellWidth: 25 }, // Price/Unit
                    3: { cellWidth: 25 }, // Total Value
                    4: { cellWidth: 35 }, // Purchased By
                    5: { cellWidth: 35 }  // Purchase Date
                }
            });

            return doc;
        } catch (error) {
            console.error('Error in generateItemsReport:', error);
            throw error;
        }
    }

    // Helper functions
    calculatePerformanceScore(subAdmin) {
        // Calculate performance score based on transactions and balance
        const transactionScore = Math.min(subAdmin.totalTransactions / 10, 5); // Max 5 points
        const balanceScore = Math.min(Math.abs(subAdmin.balance) / 1000, 5); // Max 5 points
        return `${(transactionScore + balanceScore).toFixed(1)}/10`;
    }

    calculateDuration(dateAssigned) {
        if (dateAssigned === 'N/A') return 'N/A';
        const assigned = new Date(dateAssigned);
        const now = new Date();
        const days = Math.floor((now - assigned) / (1000 * 60 * 60 * 24));
        return days === 0 ? 'Today' : `${days} days`;
    }

    processInventoryData(data) {
        const categories = {};
        data.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = { total: 0, assigned: 0 };
            }
            categories[category].total++;
            if (item.assignedTo !== 'Unassigned') {
                categories[category].assigned++;
            }
        });

        return Object.entries(categories).map(([category, stats]) => [
            category,
            stats.total,
            stats.assigned,
            stats.total - stats.assigned,
            `${((stats.assigned / stats.total) * 100).toFixed(1)}%`
        ]);
    }

    // Helper function to group items by category
    groupItemsByCategory(items) {
        return items.reduce((groups, item) => {
            const category = item.category || 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(item);
            return groups;
        }, {});
    }

    // Save the generated PDF
    savePDF(doc, filename) {
        try {
            if (!doc) {
                throw new Error('Document is not initialized');
            }
            doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error in savePDF:', error);
            throw error;
        }
    }
}

// Initialize the report generator after DOM content is loaded
let reportGenerator;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure jsPDF and its plugins are fully loaded
    setTimeout(() => {
        try {
            reportGenerator = new ReportGenerator();
            console.log('Report generator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize report generator:', error);
        }
    }, 1000);

    const reportsSection = document.getElementById('reports-section');
    if (!reportsSection) return;

    // Financial report generation
    document.getElementById('generateFinancialReport')?.addEventListener('click', async () => {
        const button = document.getElementById('generateFinancialReport');
        try {
            if (!reportGenerator) {
                throw new Error('Report generator is not initialized');
            }
            
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            const dateRange = DateFilters.getDateRange(dateRangeSelect.value);
            const reportType = document.getElementById('financialReportType').value;
            
            // Fetch and filter data
            let data = await fetchFinancialData();
            data = data.filter(item => DateFilters.isDateInRange(item.date, dateRange));
            
            if (data.length === 0) {
                throw new Error('No data available for the selected date range');
            }

            const doc = await reportGenerator.generateFinancialReport(data, { dateRange, reportType });
            reportGenerator.savePDF(doc, `financial-report-${reportType}`);
        } catch (error) {
            console.error('Error generating financial report:', error);
            alert('Failed to generate financial report: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-download"></i>';
        }
    });

    // Sub-admin report generation
    document.getElementById('generateSubAdminReport')?.addEventListener('click', async () => {
        const button = document.getElementById('generateSubAdminReport');
        try {
            if (!reportGenerator) {
                throw new Error('Report generator is not initialized');
            }

            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            const dateRange = DateFilters.getDateRange(dateRangeSelect.value);
            const reportType = document.getElementById('subAdminReportType').value;
            
            // Fetch and filter data
            let data = await fetchSubAdminData();
            // Filter transactions within date range
            data = data.map(subAdmin => ({
                ...subAdmin,
                transactions: (subAdmin.transactions || [])
                    .filter(t => DateFilters.isDateInRange(t.date, dateRange))
            }));
            
            if (data.length === 0) {
                throw new Error('No data available for the selected date range');
            }

            const doc = await reportGenerator.generateSubAdminReport(data, { dateRange, reportType });
            reportGenerator.savePDF(doc, `subadmin-report-${reportType}`);
        } catch (error) {
            console.error('Error generating sub-admin report:', error);
            alert('Failed to generate sub-admin report: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-download"></i>';
        }
    });

    // Items report generation
    document.getElementById('generateItemsReport')?.addEventListener('click', async () => {
        const button = document.getElementById('generateItemsReport');
        try {
            if (!reportGenerator) {
                throw new Error('Report generator is not initialized');
            }

            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            const dateRange = DateFilters.getDateRange(dateRangeSelect.value);
            const reportType = document.getElementById('itemsReportType').value;
            
            // Fetch and filter data
            let data = await fetchItemsData();
            data = data.filter(item => DateFilters.isDateInRange(item.dateAssigned, dateRange));
            
            if (data.length === 0) {
                throw new Error('No data available for the selected date range');
            }

            const doc = await reportGenerator.generateItemsReport(data, { dateRange, reportType });
            reportGenerator.savePDF(doc, `items-report-${reportType}`);
        } catch (error) {
            console.error('Error generating items report:', error);
            alert('Failed to generate items report: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-download"></i>';
        }
    });

    // Initialize items in the database if they don't exist
    initializeItemsIfNeeded();
});

// Real data fetching functions using Firebase
async function fetchFinancialData() {
    try {
        const snapshot = await database.ref('transactions').once('value');
        const transactions = snapshot.val() || {};
        
        // Convert object to array and format the data
        return Object.entries(transactions).map(([id, transaction]) => ({
            date: new Date(transaction.timestamp).toLocaleDateString(),
            description: transaction.description || 'N/A',
            amount: parseFloat(transaction.amount) || 0,
            type: transaction.type || 'N/A'
        })).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
    } catch (error) {
        console.error('Error fetching financial data:', error);
        throw new Error('Failed to fetch financial data from database');
    }
}

async function fetchSubAdminData() {
    try {
        // Fetch sub-admins
        const subAdminsSnapshot = await database.ref('subadmins').once('value');
        const subAdmins = subAdminsSnapshot.val() || {};

        // Fetch transactions to calculate totals
        const transactionsSnapshot = await database.ref('transactions').once('value');
        const transactions = transactionsSnapshot.val() || {};

        // Process sub-admin data
        return Object.entries(subAdmins).map(([id, subAdmin]) => {
            // Calculate total transactions and balance for this sub-admin
            const subAdminTransactions = Object.values(transactions).filter(
                t => t.subAdminId === id || t.userId === subAdmin.uid
            );

            const totalTransactions = subAdminTransactions.length;
            const balance = subAdminTransactions.reduce((sum, t) => {
                return sum + (t.type === 'Credit' ? parseFloat(t.amount) : -parseFloat(t.amount));
            }, 0);

            return {
                name: subAdmin.name || 'N/A',
                email: subAdmin.email || 'N/A',
                totalTransactions,
                balance
            };
        });
    } catch (error) {
        console.error('Error fetching sub-admin data:', error);
        throw new Error('Failed to fetch sub-admin data from database');
    }
}

async function fetchItemsData() {
    try {
        // Fetch items and their purchase information
        const itemsSnapshot = await database.ref('items').once('value');
        const items = itemsSnapshot.val() || {};

        // Fetch users for buyer information
        const usersSnapshot = await database.ref('users').once('value');
        const users = usersSnapshot.val() || {};

        // Fetch transactions to identify purchases
        const transactionsSnapshot = await database.ref('transactions').once('value');
        const transactions = transactionsSnapshot.val() || {};

        // Create a map of item purchases
        const itemPurchases = {};
        Object.values(transactions).forEach(transaction => {
            if (transaction.type === 'purchase' && transaction.items) {
                transaction.items.forEach(item => {
                    if (item.itemId) {
                        itemPurchases[item.itemId] = {
                            purchasedBy: transaction.fromUserId,
                            purchaseDate: transaction.timestamp,
                            isOwnPurchase: transaction.isOwnItemPurchase || false
                        };
                    }
                });
            }
        });

        // Process items data
        return Object.entries(items).map(([id, item]) => {
            // Get purchase information
            const purchaseInfo = itemPurchases[id];
            
            // Handle date - use purchase date, then assignedAt, then createdAt
            let formattedDate = 'Not Set';
            const dateToUse = purchaseInfo?.purchaseDate || item.assignedAt || item.createdAt;
            
            if (dateToUse) {
                try {
                    const date = new Date(dateToUse);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    }
                } catch (error) {
                    console.error('Error formatting date:', error);
                    formattedDate = 'Invalid Date';
                }
            }

            // Get the user's name based on purchase or assignment
            let userInfo = 'Not Assigned';
            if (purchaseInfo) {
                const purchaser = users[purchaseInfo.purchasedBy];
                if (purchaser) {
                    userInfo = purchaseInfo.isOwnPurchase ? 
                        `${purchaser.name} (Own Purchase)` : 
                        purchaser.name;
                }
            } else if (item.assignedTo && users[item.assignedTo]) {
                userInfo = users[item.assignedTo].name;
            }

            return {
                name: item.name || 'Unnamed Item',
                category: item.category || 'Uncategorized',
                quantity: parseInt(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                purchasedBy: userInfo,
                purchaseDate: formattedDate,
                serialNumber: item.serialNumber || '-',
                notes: item.notes || '-',
                isOwnPurchase: purchaseInfo?.isOwnPurchase || false
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error fetching items data:', error);
        throw new Error('Failed to fetch items data from database');
    }
}

// Initialize items in the database if they don't exist
async function initializeItemsIfNeeded() {
    try {
        const itemsRef = database.ref('items');
        const snapshot = await itemsRef.once('value');
        
        if (!snapshot.exists()) {
            // Sample items data with purchase information
            const initialItems = {
                item1: {
                    name: 'Laptop',
                    category: 'Electronics',
                    quantity: 5,
                    price: 1299.99,
                    purchasedBy: 'admin',
                    purchaseDate: '2024-01-15',
                    serialNumber: 'LT-2024-001',
                    notes: 'Dell XPS 15'
                },
                item2: {
                    name: 'Headphone',
                    category: 'Electronics',
                    quantity: 10,
                    price: 349.99,
                    purchasedBy: 'admin',
                    purchaseDate: '2024-01-20',
                    serialNumber: 'HP-2024-001',
                    notes: 'Sony WH-1000XM4'
                },
                item3: {
                    name: 'HDMI Adapter',
                    category: 'Accessories',
                    quantity: 20,
                    price: 29.99,
                    purchasedBy: 'admin',
                    purchaseDate: '2024-01-25',
                    serialNumber: 'HA-2024-001',
                    notes: 'USB-C to HDMI'
                }
            };

            await itemsRef.set(initialItems);
            console.log('Items initialized successfully');
        }
    } catch (error) {
        console.error('Error initializing items:', error);
    }
}