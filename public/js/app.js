class App {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupApp();
            });
        } else {
            this.setupApp();
        }
    }

    setupApp() {
        // Check if user is authenticated and load contacts if they are
        if (window.auth.token && window.auth.user) {
            // Load contacts after a short delay to ensure the app is fully initialized
            setTimeout(() => {
                window.contactManager.loadContacts();
            }, 100);
        }

        // Set up global error handling
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showNotification('An error occurred. Please refresh the page.', 'error');
        });

        // Set up unhandled promise rejection handling
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showNotification('An error occurred. Please try again.', 'error');
        });

        // Set up keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Ctrl/Cmd + R refreshes contacts
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                if (window.auth.token) {
                    window.contactManager.loadContacts();
                }
            }
        });

        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        console.log('Attorney CRM App initialized successfully');
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        modals.forEach(modal => {
            modal.classList.add('hidden');
        });
        
        // Reset any modal-specific state
        if (window.contactManager) {
            window.contactManager.selectedContactId = null;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: '500',
            zIndex: '10000',
            minWidth: '300px',
            maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            backdrop: 'blur(10px)',
            transition: 'all 0.3s ease',
            transform: 'translateX(100%)',
            opacity: '0'
        });

        // Set background color based on type
        switch (type) {
            case 'error':
                notification.style.background = 'rgba(231, 76, 60, 0.9)';
                break;
            case 'success':
                notification.style.background = 'rgba(46, 204, 113, 0.9)';
                break;
            case 'warning':
                notification.style.background = 'rgba(243, 156, 18, 0.9)';
                break;
            default:
                notification.style.background = 'rgba(52, 152, 219, 0.9)';
        }

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }

    // Utility method to format dates
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Utility method to format phone numbers
    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }

    // Utility method to validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Utility method to debounce function calls
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Method to export contacts to CSV
    exportToCSV() {
        if (!window.contactManager.contacts.length) {
            this.showNotification('No contacts to export', 'warning');
            return;
        }

        const headers = ['First Name', 'Last Name', 'Company', 'Email', 'Events'];
        if (window.contactManager.currentEventFilter) {
            headers.push('RSVP Status', 'Attended');
        }

        const csvContent = [
            headers.join(','),
            ...window.contactManager.contacts.map(contact => {
                const row = [
                    `"${contact.firstName || ''}"`,
                    `"${contact.lastName || ''}"`,
                    `"${contact.companyName || ''}"`,
                    `"${contact.email || ''}"`,
                    `"${contact.events ? contact.events.map(e => e.name).join('; ') : ''}"`
                ];
                
                if (window.contactManager.currentEventFilter) {
                    row.push(`"${contact.rsvpStatus || 'Pending'}"`);
                    row.push(`"${contact.attended ? 'Yes' : 'No'}"`);
                }
                
                return row.join(',');
            })
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Contacts exported successfully', 'success');
    }
}

// Initialize the app
window.app = new App();

// Add export functionality and debug buttons
document.addEventListener('DOMContentLoaded', () => {
    // Add export button next to refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export CSV';
        exportBtn.id = 'exportBtn';
        exportBtn.addEventListener('click', () => {
            window.app.exportToCSV();
        });
        refreshBtn.parentNode.insertBefore(exportBtn, refreshBtn.nextSibling);
    }

    // Add debug button functionality
    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
        debugBtn.addEventListener('click', async () => {
            console.log('=== DEBUG API TEST ===');
            
            try {
                // Test authentication first
                console.log('Testing auth...');
                const authResponse = await window.auth.makeAuthenticatedRequest('/api/auth/verify');
                console.log('Auth response status:', authResponse.status);
                console.log('Auth response headers:', authResponse.headers);
                
                const authText = await authResponse.text();
                console.log('Auth raw response:', authText);
                
                if (authResponse.ok) {
                    try {
                        const authResult = JSON.parse(authText);
                        console.log('Auth result:', authResult);
                    } catch (e) {
                        console.log('Auth response is not JSON');
                    }
                }
                
                // Test contacts endpoint
                console.log('Testing contacts...');
                const contactsResponse = await window.auth.makeAuthenticatedRequest('/api/contacts');
                console.log('Contacts response status:', contactsResponse.status);
                
                const contactsText = await contactsResponse.text();
                console.log('Contacts raw response:', contactsText);
                
                if (contactsResponse.ok) {
                    try {
                        const contactsResult = JSON.parse(contactsText);
                        console.log('Contacts result:', contactsResult);
                    } catch (e) {
                        console.log('Contacts response is not JSON');
                    }
                }
                
            } catch (error) {
                console.error('Debug test failed:', error);
            }
        });
    }

    // Add debug fields button functionality
    const debugFieldsBtn = document.getElementById('debugFieldsBtn');
    if (debugFieldsBtn) {
        debugFieldsBtn.addEventListener('click', async () => {
            console.log('=== DEBUG FIELDS TEST ===');
            
            try {
                const response = await window.auth.makeAuthenticatedRequest('/api/contacts/debug-fields');
                console.log('Debug fields response status:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Available fields in Contacts table:', result.availableFields);
                    console.log('Sample contact data:', result.sampleData);
                    
                    // Show in alert for easy viewing
                    alert(`Available fields: ${result.availableFields.join(', ')}\n\nCheck console for full sample data.`);
                } else {
                    const errorText = await response.text();
                    console.error('Debug fields error:', errorText);
                    alert('Error getting field info. Check console.');
                }
                
            } catch (error) {
                console.error('Debug fields test failed:', error);
                alert('Debug fields test failed. Check console.');
            }
        });
    }
});