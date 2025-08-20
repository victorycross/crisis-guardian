// Crisis Guardian Frontend Application
class CrisisGuardian {
    constructor() {
        this.apiBase = 'https://api.brightpathtechnology.io';
        this.apiKey = localStorage.getItem('crisis-guardian-api-key');
        this.isAdmin = false;
        this.incidents = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadIncidents();
        this.updateUI();
    }

    setupEventListeners() {
        // Admin toggle
        document.getElementById('admin-toggle').addEventListener('click', () => {
            this.toggleAdminMode();
        });

        // API Key modal
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.saveApiKey();
        });
        
        document.getElementById('cancel-api-key').addEventListener('click', () => {
            this.hideApiKeyModal();
        });

        // Create incident
        document.getElementById('create-incident-btn').addEventListener('click', () => {
            this.showCreateForm();
        });
        
        document.getElementById('cancel-create').addEventListener('click', () => {
            this.hideCreateForm();
        });

        // Incident form submission
        document.getElementById('incident-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createIncident();
        });

        // Filter incidents
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filterIncidents(e.target.value);
        });

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadIncidents();
        });
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.isAdmin && this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            this.showError(`API Error: ${error.message}`);
            throw error;
        }
    }

    async loadIncidents() {
        try {
            this.showLoading(true);
            this.incidents = await this.apiRequest('/incidents');
            this.renderIncidents();
            this.updateStats();
        } catch (error) {
            this.showError('Failed to load incidents');
        } finally {
            this.showLoading(false);
        }
    }

    async createIncident() {
        const form = document.getElementById('incident-form');
        const formData = new FormData(form);
        const data = {
            title: formData.get('title'),
            description: formData.get('description')
        };

        // Add Turnstile response if present
        const turnstileResponse = document.querySelector('.cf-turnstile textarea');
        if (turnstileResponse && turnstileResponse.value) {
            data.cf_turnstile_response = turnstileResponse.value;
        }

        try {
            await this.apiRequest('/incidents', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            this.showSuccess('Incident reported successfully');
            this.hideCreateForm();
            form.reset();
            this.loadIncidents();
        } catch (error) {
            this.showError('Failed to create incident');
        }
    }

    async updateIncidentStatus(id, status) {
        if (!this.isAdmin) {
            this.showError('Admin access required');
            return;
        }

        try {
            await this.apiRequest(`/incidents/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });

            this.showSuccess('Incident updated successfully');
            this.loadIncidents();
        } catch (error) {
            this.showError('Failed to update incident');
        }
    }

    renderIncidents() {
        const container = document.getElementById('incidents-container');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');

        loading.classList.add('hidden');

        if (this.incidents.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        container.innerHTML = this.incidents.map(incident => this.renderIncidentCard(incident)).join('');
    }

    renderIncidentCard(incident) {
        const statusColors = {
            'open': 'bg-red-100 text-red-800',
            'in_progress': 'bg-yellow-100 text-yellow-800',
            'resolved': 'bg-green-100 text-green-800',
            'closed': 'bg-gray-100 text-gray-800'
        };

        const statusColor = statusColors[incident.status] || 'bg-gray-100 text-gray-800';
        const createdAt = new Date(incident.created_at).toLocaleString();

        const adminActions = this.isAdmin ? `
            <div class="flex space-x-2 mt-3">
                <select onchange="app.updateIncidentStatus('${incident.id}', this.value)" 
                        class="text-sm px-2 py-1 border border-gray-300 rounded">
                    <option value="open" ${incident.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in_progress" ${incident.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="resolved" ${incident.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="closed" ${incident.status === 'closed' ? 'selected' : ''}>Closed</option>
                </select>
                <button onclick="app.viewIncidentDetails('${incident.id}')" 
                        class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                    View Details
                </button>
            </div>
        ` : '';

        return `
            <div class="incident-card bg-white rounded-lg shadow p-6 cursor-pointer" 
                 onclick="app.viewIncidentDetails('${incident.id}')">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${this.escapeHtml(incident.title)}</h3>
                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span>ID: ${incident.id}</span>
                            <span>${createdAt}</span>
                            ${incident.created_by ? `<span>By: ${incident.created_by}</span>` : ''}
                        </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                        ${incident.status.replace('_', ' ')}
                    </span>
                </div>
                ${adminActions}
            </div>
        `;
    }

    async viewIncidentDetails(id) {
        try {
            const incident = await this.apiRequest(`/incidents/${id}`);
            this.showIncidentModal(incident);
        } catch (error) {
            this.showError('Failed to load incident details');
        }
    }

    showIncidentModal(incident) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-auto">
                <div class="px-6 py-4 border-b border-gray-200">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-semibold text-gray-900">${this.escapeHtml(incident.title)}</h2>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <div class="mb-4">
                        <h3 class="text-sm font-medium text-gray-700 mb-2">Description</h3>
                        <p class="text-gray-900">${this.escapeHtml(incident.description)}</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                            <span class="font-medium text-gray-700">Status:</span>
                            <span class="ml-2">${incident.status.replace('_', ' ')}</span>
                        </div>
                        <div>
                            <span class="font-medium text-gray-700">Created:</span>
                            <span class="ml-2">${new Date(incident.created_at).toLocaleString()}</span>
                        </div>
                        ${incident.created_by ? `
                        <div>
                            <span class="font-medium text-gray-700">Created by:</span>
                            <span class="ml-2">${incident.created_by}</span>
                        </div>
                        ` : ''}
                    </div>

                    ${incident.notes && incident.notes.length > 0 ? `
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 mb-2">Notes</h3>
                        <div class="space-y-2">
                            ${incident.notes.map(note => `
                                <div class="bg-gray-50 rounded p-3">
                                    <p class="text-sm text-gray-900">${this.escapeHtml(note.note)}</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        ${new Date(note.created_at).toLocaleString()}
                                        ${note.created_by ? ` by ${note.created_by}` : ''}
                                    </p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    filterIncidents(status) {
        if (!status) {
            this.loadIncidents();
            return;
        }

        const filtered = this.incidents.filter(incident => incident.status === status);
        this.incidents = filtered;
        this.renderIncidents();
        this.updateStats();
    }

    updateStats() {
        const stats = this.incidents.reduce((acc, incident) => {
            acc[incident.status] = (acc[incident.status] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('critical-count').textContent = stats.critical || 0;
        document.getElementById('open-count').textContent = stats.open || 0;
        document.getElementById('progress-count').textContent = stats.in_progress || 0;
        document.getElementById('resolved-count').textContent = stats.resolved || 0;
    }

    toggleAdminMode() {
        if (this.isAdmin) {
            this.isAdmin = false;
            this.apiKey = null;
            localStorage.removeItem('crisis-guardian-api-key');
            this.updateUI();
        } else {
            this.showApiKeyModal();
        }
    }

    showApiKeyModal() {
        document.getElementById('api-key-modal').classList.remove('hidden');
        document.getElementById('api-key-input').focus();
    }

    hideApiKeyModal() {
        document.getElementById('api-key-modal').classList.add('hidden');
        document.getElementById('api-key-input').value = '';
    }

    saveApiKey() {
        const key = document.getElementById('api-key-input').value.trim();
        if (key) {
            this.apiKey = key;
            this.isAdmin = true;
            localStorage.setItem('crisis-guardian-api-key', key);
            this.hideApiKeyModal();
            this.updateUI();
            this.showSuccess('Admin mode enabled');
        }
    }

    showCreateForm() {
        document.getElementById('create-form').classList.remove('hidden');
        document.getElementById('title').focus();
    }

    hideCreateForm() {
        document.getElementById('create-form').classList.add('hidden');
    }

    updateUI() {
        const adminToggle = document.getElementById('admin-toggle');
        const createBtn = document.getElementById('create-incident-btn');
        
        if (this.isAdmin) {
            adminToggle.textContent = 'Exit Admin';
            adminToggle.className = 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors';
            createBtn.classList.remove('hidden');
        } else {
            adminToggle.textContent = 'Admin Mode';
            adminToggle.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors';
            createBtn.classList.add('hidden');
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
const app = new CrisisGuardian();

// Auto-refresh every 30 seconds
setInterval(() => {
    app.loadIncidents();
}, 30000);