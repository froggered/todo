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
        this.draggedTaskCategory = null;
        this.calendarDate = new Date();
        this.githubSync = new GitHubSync();
        this.historicalEvents = this.initHistoricalEvents();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCalendarDropZones();
        this.updateDateDisplay();
        this.renderTasks();
        this.updateHistoricalFact();
        this.initializeHistoryState();
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

        document.getElementById('add-btn-pool').addEventListener('click', () => {
            this.addPoolTask();
        });

        // Enter key for adding tasks
        document.getElementById('todo-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask('personal');
        });
        
        document.getElementById('todo-input-work').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask('work');
        });

        document.getElementById('todo-input-pool').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPoolTask();
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
        document.getElementById('download-btn').addEventListener('click', () => {
            this.handleDownload();
        });

        document.getElementById('upload-btn').addEventListener('click', () => {
            this.handleUpload();
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

        // History toggle functionality
        document.getElementById('history-toggle').addEventListener('click', () => {
            this.toggleHistorySection();
        });

        document.getElementById('history-toggle-work').addEventListener('click', () => {
            this.toggleHistorySection('work');
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
                    if (this.draggedTaskCategory === 'pool') {
                        // Move pool task to specific date
                        const targetDate = new Date(this.currentDate);
                        const daysOffset = button.classList.contains('prev-day') ? -1 : 1;
                        targetDate.setDate(targetDate.getDate() + daysOffset);
                        this.movePoolTaskToSpecificDate(this.draggedTaskId, targetDate);
                    } else {
                        // Normal date movement
                        const daysOffset = button.classList.contains('prev-day') ? -1 : 1;
                        this.moveTaskToDate(this.currentTab, this.draggedTaskId, daysOffset);
                    }
                }
            });

            // Prevent the button's normal click behavior when dragging
            button.addEventListener('dragenter', (e) => {
                e.preventDefault();
            });
        });

        // Set up drop zones for Personal/Work tabs
        document.querySelectorAll('.tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedTaskId && this.draggedTaskCategory) {
                    const targetCategory = tabBtn.dataset.tab;
                    // Only show drop zone if dragging to different category
                    if (targetCategory !== this.draggedTaskCategory) {
                        tabBtn.classList.add('drag-over');
                        e.dataTransfer.dropEffect = 'move';
                    }
                }
            });

            tabBtn.addEventListener('dragleave', (e) => {
                tabBtn.classList.remove('drag-over');
            });

            tabBtn.addEventListener('drop', (e) => {
                e.preventDefault();
                tabBtn.classList.remove('drag-over');
                
                if (this.draggedTaskId && this.draggedTaskCategory) {
                    const targetCategory = tabBtn.dataset.tab;
                    // Only move if dropping on different category
                    if (targetCategory !== this.draggedTaskCategory) {
                        if (this.draggedTaskCategory === 'pool') {
                            this.movePoolTaskToDate(targetCategory, this.draggedTaskId);
                        } else if (targetCategory === 'pool') {
                            this.moveTaskToPool(this.draggedTaskCategory, this.draggedTaskId);
                        } else {
                            this.moveTaskBetweenCategories(this.draggedTaskCategory, targetCategory, this.draggedTaskId);
                        }
                    }
                }
            });

            tabBtn.addEventListener('dragenter', (e) => {
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
        this.updateHistoricalFact();
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

    addPoolTask() {
        const input = document.getElementById('todo-input-pool');
        const text = input.value.trim();
        
        if (!text) return;
        
        const task = {
            id: Date.now(),
            text: text,
            status: 'pending',
            completed: false,
            completedDate: null,
            moved: false,
            originalDate: null // Pool tasks don't have an original date
        };
        
        if (!this.tasks.pool) {
            this.tasks.pool = [];
        }
        
        this.tasks.pool.push(task);
        this.saveTasks();
        this.renderTasks();
        
        input.value = '';
    }

    completeTask(category, taskId) {
        if (category === 'pool') {
            this.completePoolTask(taskId);
            return;
        }

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

    completePoolTask(taskId) {
        const poolTasks = this.tasks.pool;
        const taskIndex = poolTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = poolTasks[taskIndex];
            
            // Remove from pool
            poolTasks.splice(taskIndex, 1);
            
            // Add to today's personal tasks as completed
            const dateKey = this.getDateKey();
            const completedTask = {
                ...task,
                completed: true,
                status: 'completed',
                completedDate: dateKey,
                originalDate: dateKey, // Set original date to today since it's being completed today
                moved: false
            };
            
            if (!this.tasks.personal[dateKey]) {
                this.tasks.personal[dateKey] = [];
            }
            
            this.tasks.personal[dateKey].push(completedTask);
            this.saveTasks();
            this.renderTasks();
            
            this.showNotification('Task completed and moved to today!', 'success');
        }
    }

    uncompleteTask(category, taskId) {
        if (category === 'pool') {
            // Pool tasks shouldn't be in completed state, but handle just in case
            const tasks = this.tasks.pool;
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                task.completed = false;
                task.status = 'pending';
                task.completedDate = null;
                this.saveTasks();
                this.renderTasks();
            }
        } else {
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
    }

    toggleTaskInProgress(category, taskId) {
        if (category === 'pool') {
            const tasks = this.tasks.pool;
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                if (task.status === 'in-progress') {
                    task.status = 'pending';
                } else if (task.status === 'pending') {
                    task.status = 'in-progress';
                }
                task.completed = false;
                this.saveTasks();
                this.renderTasks();
            }
        } else {
            const dateKey = this.getDateKey();
            const tasks = this.tasks[category][dateKey];
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                if (task.status === 'in-progress') {
                    task.status = 'pending';
                } else if (task.status === 'pending') {
                    task.status = 'in-progress';
                }
                task.completed = false;
                this.saveTasks();
                this.renderTasks();
            }
        }
    }

    editTask(category, taskId, newText) {
        if (category === 'pool') {
            const tasks = this.tasks.pool;
            const task = tasks.find(t => t.id === taskId);
            
            if (task && newText.trim()) {
                task.text = newText.trim();
                this.saveTasks();
                this.renderTasks();
            }
        } else {
            const dateKey = this.getDateKey();
            const tasks = this.tasks[category][dateKey];
            const task = tasks.find(t => t.id === taskId);
            
            if (task && newText.trim()) {
                task.text = newText.trim();
                this.saveTasks();
                this.renderTasks();
            }
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

    moveTaskBetweenCategories(fromCategory, toCategory, taskId) {
        const dateKey = this.getDateKey();
        const fromTasks = this.tasks[fromCategory][dateKey];
        const taskIndex = fromTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = fromTasks[taskIndex];
            
            // Remove task from source category
            fromTasks.splice(taskIndex, 1);
            
            // Add task to target category with new ID
            const newTask = {
                ...task,
                id: Date.now(), // Generate new ID to avoid conflicts
                moved: false // Reset moved status since it's a category change
            };
            
            if (!this.tasks[toCategory]) {
                this.tasks[toCategory] = {};
            }
            
            if (!this.tasks[toCategory][dateKey]) {
                this.tasks[toCategory][dateKey] = [];
            }
            
            this.tasks[toCategory][dateKey].push(newTask);
            this.saveTasks();
            this.renderTasks();
            
            // Show notification about the move
            const categoryNames = { personal: 'Personal', work: 'Work' };
            this.showNotification(`Task moved to ${categoryNames[toCategory]}`, 'success');
        }
    }

    movePoolTaskToDate(targetCategory, taskId) {
        const poolTasks = this.tasks.pool;
        const taskIndex = poolTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = poolTasks[taskIndex];
            
            // Remove from pool
            poolTasks.splice(taskIndex, 1);
            
            // Add to target category on current date
            const dateKey = this.getDateKey();
            const newTask = {
                ...task,
                id: Date.now(),
                originalDate: dateKey,
                moved: false
            };
            
            if (!this.tasks[targetCategory]) {
                this.tasks[targetCategory] = {};
            }
            
            if (!this.tasks[targetCategory][dateKey]) {
                this.tasks[targetCategory][dateKey] = [];
            }
            
            this.tasks[targetCategory][dateKey].push(newTask);
            this.saveTasks();
            this.renderTasks();
            
            const categoryNames = { personal: 'Personal', work: 'Work' };
            this.showNotification(`Task moved from Pool to ${categoryNames[targetCategory]} today`, 'success');
        }
    }

    movePoolTaskToSpecificDate(taskId, targetDate) {
        const poolTasks = this.tasks.pool;
        const taskIndex = poolTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = poolTasks[taskIndex];
            
            // Remove from pool
            poolTasks.splice(taskIndex, 1);
            
            // Add to Personal category on target date
            const targetDateKey = this.formatDateKey(targetDate);
            const newTask = {
                ...task,
                id: Date.now(),
                originalDate: targetDateKey,
                moved: false
            };
            
            if (!this.tasks.personal[targetDateKey]) {
                this.tasks.personal[targetDateKey] = [];
            }
            
            this.tasks.personal[targetDateKey].push(newTask);
            this.saveTasks();
            this.renderTasks();
            
            const dateStr = targetDate.toLocaleDateString();
            this.showNotification(`Task moved from Pool to ${dateStr}`, 'success');
        }
    }

    moveTaskToPool(fromCategory, taskId) {
        const dateKey = this.getDateKey();
        const fromTasks = this.tasks[fromCategory][dateKey];
        const taskIndex = fromTasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            const task = fromTasks[taskIndex];
            
            // Remove from source category
            fromTasks.splice(taskIndex, 1);
            
            // Add to pool with new ID
            const newTask = {
                ...task,
                id: Date.now(),
                originalDate: null, // Pool tasks don't have original dates
                moved: false,
                completed: false, // Reset completion status
                status: task.status === 'completed' ? 'pending' : task.status, // Reset if completed
                completedDate: null
            };
            
            if (!this.tasks.pool) {
                this.tasks.pool = [];
            }
            
            this.tasks.pool.push(newTask);
            this.saveTasks();
            this.renderTasks();
            
            const categoryNames = { personal: 'Personal', work: 'Work' };
            this.showNotification(`Task moved from ${categoryNames[fromCategory]} to Pool`, 'success');
        }
    }

    deleteTask(category, taskId) {
        if (category === 'pool') {
            const tasks = this.tasks.pool;
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            
            if (taskIndex !== -1) {
                tasks.splice(taskIndex, 1);
                this.saveTasks();
                this.renderTasks();
            }
        } else {
            const dateKey = this.getDateKey();
            const tasks = this.tasks[category][dateKey];
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            
            if (taskIndex !== -1) {
                tasks.splice(taskIndex, 1);
                this.saveTasks();
                this.renderTasks();
            }
        }
    }

    reorderTasks(category, draggedTaskId, targetTaskId, insertBefore = true) {
        let tasks;
        
        if (category === 'pool') {
            tasks = this.tasks.pool;
        } else {
            const dateKey = this.getDateKey();
            tasks = this.tasks[category][dateKey];
        }
        
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
            this.draggedTaskCategory = this.currentTab;
            taskElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', taskElement.outerHTML);
        });
        
        taskElement.addEventListener('dragend', (e) => {
            taskElement.classList.remove('dragging');
            this.draggedElement = null;
            this.draggedTaskId = null;
            this.draggedTaskCategory = null;
            
            // Remove drag-over class from all items, calendar buttons, and tabs
            document.querySelectorAll('.todo-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            document.querySelectorAll('.prev-day, .next-day').forEach(button => {
                button.classList.remove('drag-over');
            });
            document.querySelectorAll('.tab-btn').forEach(tab => {
                tab.classList.remove('drag-over');
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
        let listId, tasks;
        
        if (this.currentTab === 'pool') {
            listId = 'todo-list-pool';
            tasks = this.tasks.pool || [];
        } else {
            const dateKey = this.getDateKey();
            listId = this.currentTab === 'personal' ? 'todo-list' : 'todo-list-work';
            tasks = this.tasks[this.currentTab]?.[dateKey] || [];
        }
        
        const list = document.getElementById(listId);
        list.innerHTML = '';
        
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
        this.updateHistoricalFact();
    }

    async handleDownload() {
        if (!this.githubSync.hasToken()) {
            this.showSettings();
            this.showNotification('Please set your GitHub token first', 'warning');
            return;
        }
        
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.classList.add('downloading');
        downloadBtn.title = 'Downloading...';

        try {
            const cloudData = await this.githubSync.downloadFromGist();
            
            // Replace local data completely with cloud data
            this.tasks = cloudData;
            this.saveTasks();
            this.renderTasks();
            
            this.showNotification('Tasks downloaded from cloud!', 'success');
        } catch (error) {
            console.error('Download error:', error);
            if (error.message.includes('No todo gist found')) {
                this.showNotification('No backup found in cloud', 'warning');
            } else {
                this.showNotification(`Download failed: ${error.message}`, 'error');
            }
        } finally {
            downloadBtn.classList.remove('downloading');
            downloadBtn.title = 'Download from GitHub';
        }
    }

    async handleUpload() {
        if (!this.githubSync.hasToken()) {
            this.showSettings();
            this.showNotification('Please set your GitHub token first', 'warning');
            return;
        }
        
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.classList.add('uploading');
        uploadBtn.title = 'Uploading...';

        try {
            await this.githubSync.createOrUpdateGist(this.tasks);
            this.showNotification('Tasks backed up to cloud!', 'success');
        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            uploadBtn.classList.remove('uploading');
            uploadBtn.title = 'Backup to GitHub';
        }
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

    initHistoricalEvents() {
        return {
            "1-1": ["1707: Acts of Union unite England and Scotland to form Kingdom of Great Britain", "1801: Act of Union creates United Kingdom of Great Britain and Ireland"],
            "1-2": ["1757: Robert Clive wins Battle of Plassey, establishing British rule in Bengal", "1839: First Opium War begins as Britain attacks China to force opium trade"],
            "1-3": ["1888: Match Girls' Strike begins in London's East End", "1642: King Charles I attempts to arrest five Members of Parliament, triggering English Civil War"],
            "1-4": ["1643: Sir Isaac Newton born in Woolsthorpe Manor, Lincolnshire", "1948: Burma gains independence from British Empire"],
            "1-5": ["1066: Edward the Confessor dies, triggering Norman Conquest of England", "1919: Irish War of Independence begins with Soloheadbeg ambush"],
            "1-6": ["1540: King Henry VIII marries Anne of Cleves at Greenwich Palace", "1912: New Mexico becomes U.S. state, ending British territorial claims"],
            "1-7": ["1558: Calais falls to France, ending England's last continental possession", "1841: British occupy Hong Kong during First Opium War"],
            "1-8": ["1297: William Wallace begins Scottish resistance against Edward I", "1815: Battle of New Orleans fought two weeks after Treaty of Ghent signed"],
            "1-9": ["1799: Income tax first introduced in Britain by William Pitt to fund war against Napoleon", "1806: Admiral Lord Nelson given state funeral at St. Paul's Cathedral"],
            "1-10": ["1863: London Underground opens between Paddington and Farringdon, world's first subway", "1840: Penny Post introduced across Britain by Rowland Hill"],
            "1-11": ["1569: First official lottery held in England to raise funds for harbours", "1787: William Herschel discovers Uranus from his garden in Bath"],
            "1-12": ["1904: British South Africa Company begins administration of Northern Rhodesia", "1848: Sir John Franklin's lost Arctic expedition confirmed, all 129 men dead"],
            "1-13": ["1842: British forces retreat from Kabul in disastrous First Afghan War", "1898: Fashoda Incident nearly causes war between Britain and France over Sudan"],
            "1-14": ["1878: Alexander Graham Bell demonstrates telephone to Queen Victoria at Osborne House", "1526: Treaty of Madrid signed, releasing Francis I but ceding territory to Charles V"],
            "1-15": ["1559: Elizabeth I crowned Queen of England at Westminster Abbey", "1934: Great Storm hits Britain, causing widespread flooding and damage"],
            "1-16": ["1547: Ivan IV 'The Terrible' crowned Tsar, becoming rival to English trade interests", "1909: Ernest Shackleton reaches within 97 miles of South Pole"],
            "1-17": ["1912: Captain Robert Falcon Scott reaches South Pole, beaten by Norwegians", "1773: Captain James Cook becomes first to cross Antarctic Circle"],
            "1-18": ["1778: Captain James Cook discovers Hawaiian Islands for Britain", "1788: First Fleet arrives at Botany Bay, establishing British Australia"],
            "1-19": ["1840: Treaty of Waitangi signed, establishing British sovereignty over New Zealand", "1915: First Zeppelin raids hit Great Yarmouth and King's Lynn"],
            "1-20": ["1265: First English Parliament called by Simon de Montfort at Westminster", "1936: King George V dies at Sandringham, succeeded by Edward VIII"],
            "1-21": ["1606: Guy Fawkes executed for Gunpowder Plot against James I and Parliament", "1919: Sinn Féin declares Irish independence, starting conflict with Britain"],
            "1-22": ["1901: Queen Victoria dies at Osborne House, ending Victorian era", "1879: Battle of Rorke's Drift - 150 British soldiers hold off 4,000 Zulus"],
            "1-23": ["1806: William Pitt the Younger dies, architect of resistance to Napoleon", "1328: Treaty of Edinburgh-Northampton recognizes Scottish independence"],
            "1-24": ["1984: Apple Macintosh launched, challenging British computing companies like Amstrad", "1848: Gold discovered in California, affecting British shipping routes"],
            "1-25": ["1533: Henry VIII secretly marries pregnant Anne Boleyn", "1759: Robert Burns born in Alloway, Scotland, future national poet"],
            "1-26": ["1788: First Fleet lands at Sydney Cove, beginning European settlement of Australia", "1950: India becomes a republic, completing separation from British Crown"],
            "1-27": ["1901: Verdi dies in Milan, mourned across British Empire where his operas were popular", "1888: National Geographic Society founded with British Royal patronage"],
            "1-28": ["1547: Henry VIII dies at Whitehall Palace, succeeded by nine-year-old Edward VI", "1935: Iceland becomes sovereign state, ending union with Denmark"],
            "1-29": ["1820: King George III dies at Windsor Castle, succeeded by George IV", "1856: Victoria Cross instituted by Queen Victoria for military gallantry"],
            "1-30": ["1649: King Charles I executed for treason at Whitehall", "1969: Beatles perform final public concert on Apple Corps rooftop in London"],
            "1-31": ["1606: Guy Fawkes executed at Old Palace Yard for Gunpowder Plot", "1858: Great Stink forces Parliament to address London's sewage crisis"],
            "2-1": ["1327: Edward II deposed in favour of his son Edward III", "1884: First volume of Oxford English Dictionary published"],
            "2-2": ["1461: Battle of Mortimer's Cross - Edward IV defeats Lancastrians in Wars of the Roses", "1536: Argentina founded by Spanish, later to become British trading partner"],
            "2-3": ["1014: Sweyn Forkbeard dies, ending Danish rule over England", "1690: First paper money issued by Massachusetts Bay Colony"],
            "2-4": ["1920: Winston Churchill becomes Secretary of State for the Colonies", "1861: Confederate States formed, threatening British cotton supply"],
            "2-5": ["1885: Congo Free State established by Leopold II, rival to British East Africa", "1631: Roger Williams arrives in Boston, later founding Rhode Island colony"]
        };
    }

    updateHistoricalFact() {
        const currentDate = this.currentDate; // Use the app's current date, not today
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const key = `${month}-${day}`;
        
        const events = this.historicalEvents[key];
        if (events && events.length > 0) {
            // Pick a random event for this date
            const randomEvent = events[Math.floor(Math.random() * events.length)];
            
            // Update both personal and work history displays
            const historyElement = document.getElementById('historical-fact');
            const historyElementWork = document.getElementById('historical-fact-work');
            
            if (historyElement) {
                historyElement.textContent = randomEvent;
            }
            if (historyElementWork) {
                historyElementWork.textContent = randomEvent;
            }
        }
    }

    initializeHistoryState() {
        // Start with history sections collapsed
        const content = document.getElementById('history-content');
        const contentWork = document.getElementById('history-content-work');
        const toggle = document.getElementById('history-toggle');
        const toggleWork = document.getElementById('history-toggle-work');
        
        if (content) {
            content.style.display = 'none';
            toggle.textContent = '📖';
            toggle.title = 'Show historical fact';
        }
        
        if (contentWork) {
            contentWork.style.display = 'none';
            toggleWork.textContent = '📖';
            toggleWork.title = 'Show historical fact';
        }
    }

    toggleHistorySection(tab = 'personal') {
        const suffix = tab === 'work' ? '-work' : '';
        const content = document.getElementById(`history-content${suffix}`);
        const toggle = document.getElementById(`history-toggle${suffix}`);
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '📚';
            toggle.title = 'Hide historical fact';
        } else {
            content.style.display = 'none';
            toggle.textContent = '📖';
            toggle.title = 'Show historical fact';
        }
    }

    loadTasks() {
        const stored = localStorage.getItem('taskTodoPlanner');
        return stored ? JSON.parse(stored) : { personal: {}, work: {}, pool: [] };
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskTODOPlanner();
});