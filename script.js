class GitHubSync {
    constructor() {
        this.gistId = localStorage.getItem('todoGistId');
        this.token = localStorage.getItem('githubToken');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('githubToken', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('githubToken');
        localStorage.removeItem('todoGistId');
        this.gistId = null;
    }

    hasToken() {
        return !!this.token;
    }

    async findExistingGist() {
        if (!this.token) {
            throw new Error('GitHub token not set');
        }

        try {
            const response = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `token ${this.token}`,
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const gists = await response.json();
            const todoGist = gists.find(gist => 
                gist.description === 'Todo App Data Backup' && 
                gist.files['todo-data.json']
            );

            if (todoGist) {
                this.gistId = todoGist.id;
                localStorage.setItem('todoGistId', this.gistId);
                return todoGist.id;
            }

            return null;
        } catch (error) {
            console.error('Error finding existing gist:', error);
            return null;
        }
    }

    async createOrUpdateGist(data) {
        if (!this.token) {
            throw new Error('GitHub token not set');
        }

        // If we don't have a gist ID, try to find existing one
        if (!this.gistId) {
            await this.findExistingGist();
        }

        const gistData = {
            description: 'Todo App Data Backup',
            public: false,
            files: {
                'todo-data.json': {
                    content: JSON.stringify(data, null, 2)
                }
            }
        };

        try {
            let response;
            
            if (this.gistId) {
                // Update existing gist
                response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
            } else {
                // Create new gist
                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (!this.gistId) {
                this.gistId = result.id;
                localStorage.setItem('todoGistId', this.gistId);
            }

            return result;
        } catch (error) {
            console.error('GitHub API Error:', error);
            throw error;
        }
    }

    async downloadFromGist() {
        if (!this.token) {
            throw new Error('GitHub token not set');
        }

        // If we don't have a gist ID, try to find existing one
        if (!this.gistId) {
            await this.findExistingGist();
        }

        if (!this.gistId) {
            throw new Error('No todo gist found');
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const gist = await response.json();
            const fileContent = gist.files['todo-data.json']?.content;
            
            if (!fileContent) {
                throw new Error('Todo data file not found in gist');
            }

            return JSON.parse(fileContent);
        } catch (error) {
            console.error('Download Error:', error);
            throw error;
        }
    }
}

class TaskTODOPlanner {
    constructor() {
        this.currentDate = new Date();
        this.currentTab = 'personal';
        this.tasks = this.loadTasks();
        this.draggedElement = null;
        this.draggedTaskId = null;
        this.calendarDate = new Date();
        this.githubSync = new GitHubSync();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCalendarDropZones();
        this.updateDateDisplay();
        this.renderTasks();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Date navigation
        document.querySelectorAll('.prev-day').forEach(btn => {
            btn.addEventListener('click', () => this.changeDate(-1));
        });
        
        document.querySelectorAll('.next-day').forEach(btn => {
            btn.addEventListener('click', () => this.changeDate(1));
        });

        // Add task functionality
        document.getElementById('add-btn').addEventListener('click', () => {
            this.addTask('personal');
        });
        
        document.getElementById('add-btn-work').addEventListener('click', () => {
            this.addTask('work');
        });

        // Enter key for adding tasks
        document.getElementById('todo-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask('personal');
        });
        
        document.getElementById('todo-input-work').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask('work');
        });

        // Calendar functionality
        document.getElementById('current-date').addEventListener('click', () => {
            this.toggleCalendar();
        });

        document.getElementById('current-date-work').addEventListener('click', () => {
            this.toggleCalendar();
        });

        document.getElementById('prev-month').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Close calendar when clicking outside
        document.addEventListener('click', (e) => {
            const calendar = document.getElementById('calendar-popup');
            const dateButton = document.getElementById('current-date');
            const dateButtonWork = document.getElementById('current-date-work');
            
            if (!calendar.contains(e.target) && 
                !dateButton.contains(e.target) && 
                !dateButtonWork.contains(e.target)) {
                this.hideCalendar();
            }
        });

        // Sync functionality
        document.getElementById('sync-btn').addEventListener('click', () => {
            this.handleSync();
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            this.hideSettings();
        });

        document.getElementById('save-token').addEventListener('click', () => {
            this.saveGitHubToken();
        });

        document.getElementById('clear-token').addEventListener('click', () => {
            this.clearGitHubToken();
        });

        // Close settings modal when clicking outside
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideSettings();
            }
        });
    }

    setupCalendarDropZones() {
        // Set up drop zones for prev/next day buttons
        document.querySelectorAll('.prev-day, .next-day').forEach(button => {
            button.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedTaskId) {
                    button.classList.add('drag-over');
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            button.addEventListener('dragleave', (e) => {
                button.classList.remove('drag-over');
            });

            button.addEventListener('drop', (e) => {
                e.preventDefault();
                button.classList.remove('drag-over');
                
                if (this.draggedTaskId) {
                    // Determine direction based on button class
                    const daysOffset = button.classList.contains('prev-day') ? -1 : 1;
                    this.moveTaskToDate(this.currentTab, this.draggedTaskId, daysOffset);
                }
            });

            // Prevent the button's normal click behavior when dragging
            button.addEventListener('dragenter', (e) => {
                e.preventDefault();
            });
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tab);
        });
        
        this.updateDateDisplay();
        this.renderTasks();
    }

    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.updateDateDisplay();
        this.renderTasks();
    }

    updateDateDisplay() {
        const dateStr = this.currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (this.currentTab === 'personal') {
            document.getElementById('current-date').textContent = dateStr;
        } else {
            document.getElementById('current-date-work').textContent = dateStr;
        }
    }

    addTask(category) {
        const inputId = category === 'personal' ? 'todo-input' : 'todo-input-work';
        const input = document.getElementById(inputId);
        const text = input.value.trim();
        
        if (!text) return;
        
        const dateKey = this.getDateKey();
        const task = {
            id: Date.now(),
            text: text,
            status: 'pending', // pending, in-progress, completed
            completed: false,
            completedDate: null,
            moved: false,
            originalDate: dateKey
        };
        
        if (!this.tasks[category]) {
            this.tasks[category] = {};
        }
        
        if (!this.tasks[category][dateKey]) {
            this.tasks[category][dateKey] = [];
        }
        
        this.tasks[category][dateKey].push(task);
        this.saveTasks();
        this.renderTasks();
        
        input.value = '';
    }

    completeTask(category, taskId) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            task.completed = true;
            task.status = 'completed';
            task.completedDate = this.getDateKey();
            this.saveTasks();
            this.renderTasks();
        }
    }

    uncompleteTask(category, taskId) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            task.completed = false;
            task.status = 'pending';
            task.completedDate = null;
            this.saveTasks();
            this.renderTasks();
        }
    }

    toggleTaskInProgress(category, taskId) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            if (task.status === 'in-progress') {
                // Remove in progress status
                task.status = 'pending';
            } else if (task.status === 'pending') {
                // Set to in progress
                task.status = 'in-progress';
            }
            task.completed = false;
            this.saveTasks();
            this.renderTasks();
        }
    }

    editTask(category, taskId, newText) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const task = tasks.find(t => t.id === taskId);
        
        if (task && newText.trim()) {
            task.text = newText.trim();
            this.saveTasks();
            this.renderTasks();
        }
    }

    startEditTask(taskTextElement, task) {
        const currentText = task.text;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'todo-text editable';
        
        const finishEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                this.editTask(this.currentTab, task.id, newText);
            } else {
                taskTextElement.textContent = currentText;
                taskTextElement.style.display = 'inline';
            }
            input.remove();
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                taskTextElement.textContent = currentText;
                taskTextElement.style.display = 'inline';
                input.remove();
            }
        });
        
        taskTextElement.style.display = 'none';
        taskTextElement.parentNode.insertBefore(input, taskTextElement.nextSibling);
        input.focus();
        input.select();
    }

    moveTaskToDate(category, taskId, daysOffset) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = tasks[taskIndex];
            
            // Mark original task as moved
            task.moved = true;
            
            // Get target day
            const targetDay = new Date(this.currentDate);
            targetDay.setDate(targetDay.getDate() + daysOffset);
            const targetDateKey = this.formatDateKey(targetDay);
            
            // Create new task for target day
            const newTask = {
                ...task,
                id: Date.now(),
                moved: false,
                originalDate: task.originalDate
            };
            
            if (!this.tasks[category][targetDateKey]) {
                this.tasks[category][targetDateKey] = [];
            }
            
            this.tasks[category][targetDateKey].push(newTask);
            this.saveTasks();
            this.renderTasks();
        }
    }

    deleteTask(category, taskId) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            tasks.splice(taskIndex, 1);
            this.saveTasks();
            this.renderTasks();
        }
    }

    reorderTasks(category, draggedTaskId, targetTaskId, insertBefore = true) {
        const dateKey = this.getDateKey();
        const tasks = this.tasks[category][dateKey];
        
        const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
        const targetIndex = tasks.findIndex(t => t.id === targetTaskId);
        
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            const draggedTask = tasks.splice(draggedIndex, 1)[0];
            
            const newTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
            const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
            
            tasks.splice(insertIndex, 0, draggedTask);
            
            this.saveTasks();
            this.renderTasks();
        }
    }

    setupDragAndDrop(taskElement, taskId) {
        taskElement.draggable = true;
        
        taskElement.addEventListener('dragstart', (e) => {
            this.draggedElement = taskElement;
            this.draggedTaskId = taskId;
            taskElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', taskElement.outerHTML);
        });
        
        taskElement.addEventListener('dragend', (e) => {
            taskElement.classList.remove('dragging');
            this.draggedElement = null;
            this.draggedTaskId = null;
            
            // Remove drag-over class from all items and calendar buttons
            document.querySelectorAll('.todo-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            document.querySelectorAll('.prev-day, .next-day').forEach(button => {
                button.classList.remove('drag-over');
            });
        });
        
        taskElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (this.draggedElement && this.draggedElement !== taskElement) {
                taskElement.classList.add('drag-over');
            }
        });
        
        taskElement.addEventListener('dragleave', (e) => {
            taskElement.classList.remove('drag-over');
        });
        
        taskElement.addEventListener('drop', (e) => {
            e.preventDefault();
            taskElement.classList.remove('drag-over');
            
            if (this.draggedTaskId && this.draggedTaskId !== taskId) {
                // Determine if we should insert before or after based on mouse position
                const rect = taskElement.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const insertBefore = e.clientY < midpoint;
                
                this.reorderTasks(this.currentTab, this.draggedTaskId, taskId, insertBefore);
            }
        });
    }

    renderTasks() {
        const dateKey = this.getDateKey();
        const listId = this.currentTab === 'personal' ? 'todo-list' : 'todo-list-work';
        const list = document.getElementById(listId);
        
        list.innerHTML = '';
        
        const tasks = this.tasks[this.currentTab]?.[dateKey] || [];
        
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            
            // Add drag handle
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.innerHTML = '⋮⋮';
            dragHandle.title = 'Drag to reorder';
            
            const taskText = document.createElement('span');
            taskText.className = 'todo-text';
            taskText.textContent = task.text;
            
            // Apply styling based on status
            if (task.status === 'in-progress') {
                taskText.classList.add('in-progress');
            } else if (task.completed || task.status === 'completed') {
                const today = this.getDateKey();
                const originalDate = task.originalDate;
                const completedDate = task.completedDate;
                
                if (completedDate === originalDate) {
                    // Completed on original day
                    taskText.classList.add('completed-today');
                } else if (completedDate > originalDate) {
                    // Completed after original day
                    taskText.classList.add('completed-future');
                } else if (completedDate < originalDate) {
                    // Completed early
                    taskText.classList.add('completed-early');
                }
            } else if (task.moved) {
                taskText.classList.add('moved');
            }
            
            const actions = document.createElement('div');
            actions.className = 'todo-actions';
            
            // Edit button (always available)
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '✎';
            editBtn.title = 'Edit task';
            editBtn.onclick = () => this.startEditTask(taskText, task);
            actions.appendChild(editBtn);
            
            if (task.status === 'completed') {
                // Uncomplete button
                const uncompleteBtn = document.createElement('button');
                uncompleteBtn.className = 'uncomplete-btn';
                uncompleteBtn.textContent = '↶';
                uncompleteBtn.title = 'Mark as incomplete';
                uncompleteBtn.onclick = () => this.uncompleteTask(this.currentTab, task.id);
                actions.appendChild(uncompleteBtn);
            } else if (!task.moved) {
                // Progress toggle button (only for pending and in-progress tasks)
                if (task.status === 'pending' || task.status === 'in-progress') {
                    const progressBtn = document.createElement('button');
                    progressBtn.className = 'progress-btn';
                    
                    if (task.status === 'in-progress') {
                        progressBtn.textContent = '⏸';
                        progressBtn.title = 'Remove in progress status';
                    } else {
                        progressBtn.textContent = '⏳';
                        progressBtn.title = 'Mark as in progress';
                    }
                    
                    progressBtn.onclick = () => this.toggleTaskInProgress(this.currentTab, task.id);
                    actions.appendChild(progressBtn);
                }
                
                // Complete button
                const completeBtn = document.createElement('button');
                completeBtn.className = 'complete-btn';
                completeBtn.textContent = '✓';
                completeBtn.title = 'Mark as complete';
                completeBtn.onclick = () => this.completeTask(this.currentTab, task.id);
                actions.appendChild(completeBtn);
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => this.deleteTask(this.currentTab, task.id);
            
            actions.appendChild(deleteBtn);
            
            li.appendChild(dragHandle);
            li.appendChild(taskText);
            li.appendChild(actions);
            
            // Setup drag and drop for this task
            this.setupDragAndDrop(li, task.id);
            
            list.appendChild(li);
        });
    }

    getDateKey() {
        return this.formatDateKey(this.currentDate);
    }

    formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    saveTasks() {
        localStorage.setItem('taskTodoPlanner', JSON.stringify(this.tasks));
    }

    toggleCalendar() {
        const calendar = document.getElementById('calendar-popup');
        
        if (calendar.classList.contains('show')) {
            this.hideCalendar();
        } else {
            this.showCalendar();
        }
    }

    showCalendar() {
        this.calendarDate = new Date(this.currentDate);
        this.renderCalendar();
        document.getElementById('calendar-popup').classList.add('show');
    }

    hideCalendar() {
        document.getElementById('calendar-popup').classList.remove('show');
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar-popup');
        const monthYear = document.getElementById('calendar-month-year');
        const grid = document.getElementById('calendar-grid');
        
        // Update month/year display
        monthYear.textContent = this.calendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        
        // Clear existing days (but keep headers)
        const dayHeaders = grid.querySelectorAll('.calendar-day-header');
        grid.innerHTML = '';
        dayHeaders.forEach(header => grid.appendChild(header));
        
        // Get first day of month and number of days
        const firstDay = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), 1);
        const lastDay = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 0);
        const today = new Date();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            grid.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const dayDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), day);
            
            // Mark today
            if (dayDate.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            // Mark selected date
            if (dayDate.toDateString() === this.currentDate.toDateString()) {
                dayElement.classList.add('selected');
            }
            
            // Add click handler
            dayElement.addEventListener('click', () => {
                this.selectDate(dayDate);
            });
            
            grid.appendChild(dayElement);
        }
    }

    selectDate(date) {
        this.currentDate = new Date(date);
        this.updateDateDisplay();
        this.renderTasks();
        this.hideCalendar();
    }

    async handleSync() {
        if (!this.githubSync.hasToken()) {
            this.showSettings();
            this.showNotification('Please set your GitHub token first', 'warning');
            return;
        }

        const syncBtn = document.getElementById('sync-btn');
        syncBtn.classList.add('syncing');
        syncBtn.title = 'Syncing...';

        try {
            // Always try to download first (this will find existing gists)
            try {
                const cloudData = await this.githubSync.downloadFromGist();
                this.mergeTaskData(cloudData);
            } catch (downloadError) {
                // If download fails (no gist exists), that's ok - we'll create one
                console.log('No existing gist found, will create new one');
            }
            
            // Upload current data
            await this.githubSync.createOrUpdateGist(this.tasks);
            this.showNotification('Tasks synced successfully!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification(`Sync failed: ${error.message}`, 'error');
        } finally {
            syncBtn.classList.remove('syncing');
            syncBtn.title = 'Sync with GitHub';
        }
    }

    mergeTaskData(cloudData) {
        // Simple merge strategy: keep local data but add any cloud data that's newer
        for (const category in cloudData) {
            if (!this.tasks[category]) {
                this.tasks[category] = {};
            }
            for (const date in cloudData[category]) {
                if (!this.tasks[category][date]) {
                    this.tasks[category][date] = cloudData[category][date];
                } else {
                    // Merge tasks by ID, keeping the newer ones
                    const localTasks = this.tasks[category][date];
                    const cloudTasks = cloudData[category][date];
                    
                    // Add any cloud tasks that don't exist locally
                    cloudTasks.forEach(cloudTask => {
                        const existsLocally = localTasks.some(localTask => localTask.id === cloudTask.id);
                        if (!existsLocally) {
                            localTasks.push(cloudTask);
                        }
                    });
                }
            }
        }
        this.saveTasks();
        this.renderTasks();
    }

    showSettings() {
        const modal = document.getElementById('settings-modal');
        const tokenInput = document.getElementById('github-token');
        
        if (this.githubSync.token) {
            tokenInput.value = this.githubSync.token;
        }
        
        modal.classList.add('show');
        tokenInput.focus();
    }

    hideSettings() {
        document.getElementById('settings-modal').classList.remove('show');
    }

    saveGitHubToken() {
        const token = document.getElementById('github-token').value.trim();
        
        if (!token) {
            this.showNotification('Please enter a valid GitHub token', 'warning');
            return;
        }
        
        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            this.showNotification('Token should start with "ghp_" or "github_pat_"', 'warning');
            return;
        }
        
        this.githubSync.setToken(token);
        this.hideSettings();
        this.showNotification('GitHub token saved successfully', 'success');
    }

    clearGitHubToken() {
        this.githubSync.clearToken();
        document.getElementById('github-token').value = '';
        this.hideSettings();
        this.showNotification('GitHub token cleared', 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    loadTasks() {
        const stored = localStorage.getItem('taskTodoPlanner');
        return stored ? JSON.parse(stored) : { personal: {}, work: {} };
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskTODOPlanner();
});