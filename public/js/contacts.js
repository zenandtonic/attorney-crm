class ContactManager {
    constructor() {
        this.contacts = [];
        this.events = [];
        this.cachedEvents = new Map(); // Event cache
        this.currentEventFilter = '';
        this.showAllAttorneys = false;
        this.prioritizeRSVPs = false;
        this.selectedContactId = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.pagination = {};
        this.sortField = null;
        this.sortDirection = 'asc';
        this.lastLoadTime = 0;
        this.loadThrottle = 100; // Minimum ms between loads
        this.renderQueue = [];
        this.isRendering = false;
        this.init();
    }

    init() {
        // Batch event listener setup for better performance
        this.setupEventListeners();
        this.setupSorting();
        this.setupDragAndDrop();
        this.addClearSortButton();
        this.updateControlsVisibility();
        
        // Preload critical data
        this.preloadData();
    }

    setupEventListeners() {
        // Use event delegation for better performance
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        document.addEventListener('change', this.handleDocumentChange.bind(this));
        document.addEventListener('submit', this.handleDocumentSubmit.bind(this));
        
        // Throttled resize handler
        window.addEventListener('resize', this.throttle(() => {
            this.adjustTableLayout();
        }, 250));
    }

    handleDocumentClick(e) {
        const target = e.target;
        
        // Event delegation for better performance
        if (target.id === 'refreshBtn') {
            this.currentPage = 1;
            this.loadContacts();
        } else if (target.id === 'addContactBtn') {
            this.showAddContactForm();
        } else if (target.id === 'cancelAdd') {
            this.hideAddContactModal();
        } else if (target.classList.contains('close')) {
            if (target.closest('#addContactModal')) {
                this.hideAddContactModal();
            } else if (target.closest('#addContactFormModal')) {
                this.hideAddContactForm();
            }
        } else if (target.id === 'clearSortBtn') {
            this.clearSort();
        } else if (target.classList.contains('pagination-btn') && !target.disabled) {
            const page = parseInt(target.getAttribute('data-page'));
            if (page) this.goToPage(page);
        } else if (target.hasAttribute('data-sortable')) {
            const field = target.getAttribute('data-sortable');
            this.handleSort(field);
        } else if (target.classList.contains('action-btn')) {
            const contactId = target.getAttribute('data-contact-id');
            if (contactId) this.showAddContactModal(contactId);
        }
    }

    handleDocumentChange(e) {
        const target = e.target;
        
        if (target.id === 'eventFilter') {
            this.currentEventFilter = target.value;
            this.currentPage = 1;
            this.updateControlsVisibility();
            this.debouncedLoadContacts();
        } else if (target.id === 'showAllAttorneys') {
            this.showAllAttorneys = target.checked;
            this.currentPage = 1;
            this.debouncedLoadContacts();
        } else if (target.id === 'prioritizeRSVPs') {
            this.prioritizeRSVPs = target.checked;
            this.currentPage = 1;
            this.debouncedLoadContacts();
        } else if (target.getAttribute('onchange')?.includes('changePageSize')) {
            this.changePageSize(target.value);
        }
    }

    handleDocumentSubmit(e) {
        if (e.target.id === 'addContactForm') {
            e.preventDefault();
            this.addContactToEvent();
        } else if (e.target.id === 'newContactForm') {
            e.preventDefault();
            this.submitNewContact();
        }
    }

    // Debounced load contacts to prevent excessive API calls
    debouncedLoadContacts = this.debounce(() => {
        this.loadContacts();
    }, 300);

    // Throttle utility
    throttle(func, wait) {
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

    // Debounce utility
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

    async preloadData() {
        // Preload events in background
        try {
            if (!this.events.length) {
                const eventsResponse = await window.auth.makeAuthenticatedRequest('/api/events');
                this.events = await eventsResponse.json();
                this.populateEventFilter();
            }
        } catch (error) {
            console.log('Background event preload failed:', error);
        }
    }

    setupSorting() {
        // Use more efficient event delegation
        const table = document.getElementById('contactsTable');
        if (table) {
            table.addEventListener('click', (e) => {
                if (e.target.hasAttribute('data-sortable')) {
                    const field = e.target.getAttribute('data-sortable');
                    this.handleSort(field);
                }
            });
        }
    }

    addClearSortButton() {
        const viewControls = document.querySelector('.view-controls');
        
        if (!document.getElementById('clearSortBtn')) {
            const clearSortBtn = document.createElement('button');
            clearSortBtn.id = 'clearSortBtn';
            clearSortBtn.className = 'clear-sort-btn';
            clearSortBtn.textContent = 'Clear Sort';
            clearSortBtn.disabled = true;
            
            viewControls.appendChild(clearSortBtn);
        }
    }

    clearSort() {
        this.sortField = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
        
        const clearBtn = document.getElementById('clearSortBtn');
        if (clearBtn) clearBtn.disabled = true;
        
        this.loadContacts();
    }

    handleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        
        const clearBtn = document.getElementById('clearSortBtn');
        if (clearBtn) clearBtn.disabled = false;
        
        this.currentPage = 1;
        this.loadContacts();
    }

    updateSortIndicators() {
        // Use more efficient class manipulation
        const headers = document.querySelectorAll('th[data-sortable]');
        headers.forEach(header => {
            header.className = header.className.replace(/\bsort-(asc|desc)\b/g, '');
        });
        
        if (this.sortField) {
            const currentHeader = document.querySelector(`th[data-sortable="${this.sortField}"]`);
            if (currentHeader) {
                currentHeader.classList.add(`sort-${this.sortDirection}`);
            }
        }
        
        const clearBtn = document.getElementById('clearSortBtn');
        if (clearBtn) clearBtn.disabled = !this.sortField;
    }

    updateControlsVisibility() {
        const showAllAttorneysControl = document.getElementById('showAllAttorneys').parentElement;
        const prioritizeRSVPsControl = document.getElementById('prioritizeRSVPs').parentElement;
        
        const display = this.currentEventFilter ? 'flex' : 'none';
        showAllAttorneysControl.style.display = display;
        prioritizeRSVPsControl.style.display = display;
    }

    async loadContacts() {
        // Throttle rapid successive calls
        const now = Date.now();
        if (now - this.lastLoadTime < this.loadThrottle) return;
        this.lastLoadTime = now;

        window.auth.showLoading(true);
        
        try {
            let contactsUrl = '/api/contacts';
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize
            });

            if (this.currentEventFilter) {
                contactsUrl = `/api/contacts/event/${this.currentEventFilter}`;
            }
            
            if (this.showAllAttorneys) {
                params.append('allAttorneys', 'true');
            }
            
            if (this.prioritizeRSVPs) {
                params.append('prioritizeRSVPs', 'true');
            }

            if (this.sortField) {
                params.append('sortBy', this.sortField);
                params.append('sortDirection', this.sortDirection);
            }

            const fullUrl = `${contactsUrl}?${params.toString()}`;
            
            const contactsResponse = await window.auth.makeAuthenticatedRequest(fullUrl);
            
            if (!contactsResponse.ok) {
                throw new Error(`HTTP ${contactsResponse.status}`);
            }
            
            const data = await contactsResponse.json();
            this.contacts = data.contacts || [];
            this.pagination = data.pagination || {};

            // Only load events if not cached
            if (!this.events.length) {
                const eventsResponse = await window.auth.makeAuthenticatedRequest('/api/events');
                this.events = await eventsResponse.json();
                this.populateEventFilter();
            }

            // Batch UI updates
            this.batchUpdateUI();

        } catch (error) {
            console.error('Error loading contacts:', error);
            window.app?.showNotification('Failed to load contacts. Please try again.', 'error');
        } finally {
            window.auth.showLoading(false);
        }
    }

    batchUpdateUI() {
        // Use requestAnimationFrame for smooth UI updates
        requestAnimationFrame(() => {
            this.populateEventSelect();
            this.displayContacts();
            this.displayPagination();
            this.updateSortIndicators();
            this.updateControlsVisibility();
        });
    }

    displayPagination() {
        let paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'paginationContainer';
            paginationContainer.className = 'pagination-container';
            
            const tableContainer = document.querySelector('.table-container');
            tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
        }

        if (!this.pagination.totalPages || this.pagination.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        const { currentPage, totalPages, totalContacts, limit } = this.pagination;
        const startItem = ((currentPage - 1) * limit) + 1;
        const endItem = Math.min(currentPage * limit, totalContacts);

        // Use template literals efficiently
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${totalContacts} contacts
                ${this.sortField ? `(sorted by ${this.sortField} ${this.sortDirection})` : ''}
                ${this.prioritizeRSVPs ? '<br><span class="rsvp-priority-indicator">RSVP Priority: Yes → No → Pending</span>' : ''}
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="1">First</button>
                <button class="pagination-btn" ${!this.pagination.hasPrevPage ? 'disabled' : ''} data-page="${currentPage - 1}">Previous</button>
                <span class="page-info">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" ${!this.pagination.hasNextPage ? 'disabled' : ''} data-page="${currentPage + 1}">Next</button>
                <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">Last</button>
            </div>
            <div class="page-size-controls">
                <label>Show: 
                    <select onchange="contactManager.changePageSize(this.value)">
                        <option value="25" ${limit === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${limit === 100 ? 'selected' : ''}>100</option>
                    </select>
                    per page
                </label>
            </div>
        `;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadContacts();
    }

    changePageSize(newSize) {
        this.pageSize = parseInt(newSize);
        this.currentPage = 1;
        this.loadContacts();
    }

    populateEventFilter() {
        const eventFilter = document.getElementById('eventFilter');
        const currentValue = eventFilter.value;
        
        // Only update if content changed
        const newOptions = ['<option value="">All Contacts</option>'];
        this.events.forEach(event => {
            const selected = event.id === this.currentEventFilter ? ' selected' : '';
            newOptions.push(`<option value="${event.id}"${selected}>${event.name}</option>`);
        });
        
        const newHTML = newOptions.join('');
        if (eventFilter.innerHTML !== newHTML) {
            eventFilter.innerHTML = newHTML;
        }
    }

    async populateEventSelect() {
        const eventSelect = document.getElementById('eventSelect');
        
        try {
            // Use cached events if available
            let futureEvents;
            if (this.cachedEvents.has('future')) {
                futureEvents = this.cachedEvents.get('future');
            } else {
                const response = await window.auth.makeAuthenticatedRequest('/api/contacts/events-for-adding');
                futureEvents = await response.json();
                this.cachedEvents.set('future', futureEvents);
                
                // Cache for 5 minutes
                setTimeout(() => {
                    this.cachedEvents.delete('future');
                }, 5 * 60 * 1000);
            }
            
            const options = ['<option value="">Choose an event...</option>'];
            futureEvents.forEach(event => {
                let dateDisplay = '';
                if (event.date) {
                    const eventDate = new Date(event.date + 'T00:00:00');
                    dateDisplay = ` (${eventDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })})`;
                }
                options.push(`<option value="${event.id}">${event.name}${dateDisplay}</option>`);
            });
            
            eventSelect.innerHTML = options.join('');
            
        } catch (error) {
            console.error('Error loading events for select:', error);
            eventSelect.innerHTML = '<option value="" disabled>Error loading events</option>';
        }
    }

    displayContacts() {
        const tbody = document.getElementById('contactsTableBody');
        const rsvpHeader = document.getElementById('rsvpHeader');
        const attendanceHeader = document.getElementById('attendanceHeader');
        
        // Batch class updates
        if (this.currentEventFilter) {
            rsvpHeader.classList.remove('hidden');
            attendanceHeader.classList.remove('hidden');
        } else {
            rsvpHeader.classList.add('hidden');
            attendanceHeader.classList.add('hidden');
        }

        // Pre-build all HTML as string for maximum performance
        const rows = this.contacts.map(contact => {
            const eventsDisplay = contact.events?.map(event => 
                `<span class="event-tag">${event.name}</span>`
            ).join('') || '';
            
            const rsvpColumns = this.currentEventFilter ? `
                <td class="status-${(contact.rsvpStatus || 'pending').toLowerCase()}">
                    ${contact.rsvpStatus || 'Pending'}
                </td>
                <td class="attended-${contact.attended ? 'yes' : 'no'}">
                    ${contact.attended ? 'Yes' : 'No'}
                </td>
            ` : '';
            
            return `
                <tr>
                    <td>${contact.firstName || ''}</td>
                    <td>${contact.lastName || ''}</td>
                    <td>${contact.companyName || ''}</td>
                    <td>${contact.email || ''}</td>
                    <td>${eventsDisplay}</td>
                    ${rsvpColumns}
                    <td>
                        <button class="action-btn btn-primary" data-contact-id="${contact.id}">
                            Add to Event
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Single DOM update
        tbody.innerHTML = rows;
    }

    adjustTableLayout() {
        // Optimize table for current viewport
        const table = document.getElementById('contactsTable');
        const container = document.querySelector('.table-container');
        
        if (window.innerWidth < 768) {
            table.style.minWidth = '800px';
            container.style.overflowX = 'auto';
        } else {
            table.style.minWidth = 'auto';
            container.style.overflowX = 'visible';
        }
    }

    // Optimized modal methods with minimal DOM operations
    showAddContactForm() {
        this.populateEventCheckboxes();
        document.getElementById('addContactFormModal').classList.remove('hidden');
    }

    hideAddContactForm() {
        const modal = document.getElementById('addContactFormModal');
        modal.classList.add('hidden');
        
        // Reset form efficiently
        const form = document.getElementById('newContactForm');
        form.reset();
        
        // Clear checkboxes
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    async populateEventCheckboxes() {
        const container = document.getElementById('eventCheckboxes');
        container.innerHTML = '<div class="loading-events">Loading...</div>';
        
        try {
            // Use cached events
            let futureEvents;
            if (this.cachedEvents.has('future')) {
                futureEvents = this.cachedEvents.get('future');
            } else {
                const response = await window.auth.makeAuthenticatedRequest('/api/contacts/events-for-adding');
                futureEvents = await response.json();
                this.cachedEvents.set('future', futureEvents);
            }
            
            if (futureEvents.length === 0) {
                container.innerHTML = '<div class="no-events">No future events available</div>';
                return;
            }
            
            // Build HTML string for better performance
            const checkboxHTML = futureEvents.map(event => {
                let dateDisplay = '';
                if (event.date) {
                    const eventDate = new Date(event.date + 'T00:00:00');
                    dateDisplay = ` (${eventDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })})`;
                }
                
                return `
                    <div class="checkbox-item">
                        <label>
                            <input type="checkbox" value="${event.id}" name="selectedEvents">
                            ${event.name}${dateDisplay}
                        </label>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = checkboxHTML;
            
        } catch (error) {
            console.error('Error loading future events:', error);
            container.innerHTML = '<div class="error-events">Error loading events</div>';
        }
    }

    async submitNewContact() {
        const formData = new FormData(document.getElementById('newContactForm'));
        const selectedEvents = Array.from(document.querySelectorAll('#eventCheckboxes input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);

        const contactData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            companyName: formData.get('companyName'),
            email: formData.get('email'),
            selectedEvents: selectedEvents
        };

        window.auth.showLoading(true);

        try {
            const response = await window.auth.makeAuthenticatedRequest('/api/contacts/create', {
                method: 'POST',
                body: JSON.stringify(contactData)
            });

            const result = await response.json();

            if (response.ok) {
                window.app?.showNotification('Contact added successfully!', 'success');
                this.hideAddContactForm();
                this.loadContacts();
            } else {
                window.app?.showNotification(result.error || 'Failed to add contact', 'error');
            }
        } catch (error) {
            console.error('Error adding contact:', error);
            window.app?.showNotification('Failed to add contact. Please try again.', 'error');
        } finally {
            window.auth.showLoading(false);
        }
    }

    showAddContactModal(contactId) {
        this.selectedContactId = contactId;
        document.getElementById('addContactModal').classList.remove('hidden');
    }

    hideAddContactModal() {
        document.getElementById('addContactModal').classList.add('hidden');
        this.selectedContactId = null;
        document.getElementById('eventSelect').value = '';
    }

    async addContactToEvent() {
        const eventId = document.getElementById('eventSelect').value;
        
        if (!eventId || !this.selectedContactId) {
            alert('Please select an event.');
            return;
        }

        window.auth.showLoading(true);

        try {
            const response = await window.auth.makeAuthenticatedRequest('/api/contacts/add-to-event', {
                method: 'POST',
                body: JSON.stringify({
                    contactId: this.selectedContactId,
                    eventId: eventId
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert('Contact added to event successfully!');
                this.hideAddContactModal();
                this.loadContacts();
            } else {
                alert(result.error || 'Failed to add contact to event');
            }
        } catch (error) {
            console.error('Error adding contact to event:', error);
            alert('Failed to add contact to event. Please try again.');
        } finally {
            window.auth.showLoading(false);
        }
    }

    // Simplified drag and drop for better performance
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        const addContactDropArea = document.querySelector('.drag-drop-area');
        
        if (!addContactDropArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('dragover', (e) => {
            const hasContactData = e.dataTransfer.types.some(type => 
                ['text/x-vcard', 'text/directory', 'Files', 'text/plain'].includes(type)
            );
            
            if (hasContactData) {
                const addContactModal = document.getElementById('addContactFormModal');
                if (!addContactModal.classList.contains('hidden')) {
                    addContactDropArea.classList.add('drag-active');
                } else {
                    dropZone.classList.remove('hidden');
                    dropZone.classList.add('drag-over');
                }
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (!document.elementFromPoint(e.clientX, e.clientY)) {
                dropZone.classList.add('hidden');
                dropZone.classList.remove('drag-over');
                addContactDropArea.classList.remove('drag-active');
            }
        });

        document.addEventListener('drop', async (e) => {
            dropZone.classList.add('hidden');
            dropZone.classList.remove('drag-over');
            addContactDropArea.classList.remove('drag-active');
            
            let contactData = null;
            
            // Try different data formats
            for (const type of ['text/x-vcard', 'text/directory', 'text/plain']) {
                if (e.dataTransfer.types.includes(type)) {
                    const data = e.dataTransfer.getData(type);
                    contactData = this.parseVCardData(data);
                    if (contactData) break;
                }
            }
            
            // Try files
            if (!contactData && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.vcf') || file.type.includes('vcard')) {
                    const fileContent = await this.readFileAsText(file);
                    contactData = this.parseVCardData(fileContent);
                }
            }
            
            if (contactData) {
                const addContactModal = document.getElementById('addContactFormModal');
                if (!addContactModal.classList.contains('hidden')) {
                    this.handleNewContactDrop(contactData);
                } else {
                    this.handleOutlookContact(contactData);
                }
            } else {
                window.app?.showNotification('Could not read contact data.', 'warning');
            }
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    parseVCardData(vCardData) {
        if (!vCardData) return null;
        
        try {
            const lines = vCardData.split(/\r?\n/);
            const contact = {};
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (trimmedLine.startsWith('FN:')) {
                    const fullName = trimmedLine.substring(3).trim();
                    const nameParts = fullName.split(' ');
                    contact.firstName = nameParts[0] || '';
                    contact.lastName = nameParts.slice(1).join(' ') || '';
                } else if (trimmedLine.toLowerCase().includes('email') && trimmedLine.includes(':')) {
                    const colonIndex = trimmedLine.lastIndexOf(':');
                    const email = trimmedLine.substring(colonIndex + 1).trim().replace(/[<>]/g, '');
                    if (email.includes('@') && !contact.email) {
                        contact.email = email;
                    }
                } else if (trimmedLine.startsWith('ORG:')) {
                    contact.company = trimmedLine.substring(4).trim();
                } else if (trimmedLine.startsWith('N:')) {
                    const nameParts = trimmedLine.substring(2).split(';');
                    if (!contact.lastName && nameParts[0]) {
                        contact.lastName = nameParts[0].trim();
                    }
                    if (!contact.firstName && nameParts[1]) {
                        contact.firstName = nameParts[1].trim();
                    }
                }
            }

            return contact;
        } catch (error) {
            console.error('Error parsing vCard data:', error);
            return null;
        }
    }

    handleNewContactDrop(contactData) {
        document.getElementById('firstName').value = contactData.firstName || '';
        document.getElementById('lastName').value = contactData.lastName || '';
        document.getElementById('companyName').value = contactData.company || '';
        document.getElementById('email').value = contactData.email || '';
        
        window.app?.showNotification('Contact data loaded', 'success');
    }

    handleOutlookContact(contactData) {
        if (contactData && (contactData.firstName || contactData.lastName || contactData.email)) {
            alert(`Contact: ${contactData.firstName} ${contactData.lastName} (${contactData.email})`);
        } else {
            alert('Error processing contact data.');
        }
    }
}

// Initialize contact manager when the page loads
window.contactManager = new ContactManager();