# todo

A simple, minimalist task management application with cloud sync capabilities. Organize daily tasks across Personal and Work categories with seamless GitHub Gist backup.

## ✨ Features

### Core Functionality
- **Daily Task Management**: Add, edit, and organize tasks for any day
- **Personal/Work Categories**: Separate lists for different types of tasks
- **Task Status System**:
  - **Pending**: Regular tasks (default state)
  - **In Progress**: Tasks you're actively working on (⏳ icon)
  - **Completed**: Finished tasks with strikethrough styling

### Navigation & Organization
- **Calendar Date Picker**: Click on the date to jump to any day
- **Prev/Next Navigation**: Quick navigation between adjacent days
- **Drag & Drop**: Reorder tasks within a day or drag to calendar arrows to move between dates
- **Inline Editing**: Click the edit button (✎) to modify task text

### Visual Feedback
- **Completion Tracking**: Different strikethrough colors based on timing:
  - **Black**: Completed on original day
  - **Red**: Completed late
  - **Green**: Completed early
- **Status Indicators**: Clear visual states for all task statuses
- **Mobile-First Design**: Responsive interface optimized for all devices

### 🔄 Cloud Sync (NEW!)
- **GitHub Gist Integration**: Sync tasks across all your devices
- **Private Storage**: Your data stays secure in private GitHub Gists
- **Automatic Merging**: Smart conflict resolution between devices
- **One-Time Setup**: Configure once, sync everywhere
- **Real-Time Feedback**: Visual indicators for sync status

## 🚀 Quick Start

### Basic Usage
1. Open `index.html` in your web browser
2. Start adding tasks to Personal or Work categories
3. Use the calendar or arrow buttons to navigate dates
4. Drag tasks to reorder or move between days

### Setting Up Cloud Sync
1. **Get GitHub Token**:
   - Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Generate new token with **"gist"** permission only
   - Copy the token (starts with `ghp_` or `github_pat_`)

2. **Configure App**:
   - Click the ⚙ (settings) button in the app
   - Paste your GitHub token
   - Click "Save Token"

3. **Start Syncing**:
   - Click the ☁ (sync) button to backup/sync your tasks
   - Use the same token on other devices to access your data

## 🎯 Task Management

### Available Actions
- **✎ Edit**: Modify task text inline
- **⏳/⏸ Progress**: Toggle in-progress status
- **✓ Complete**: Mark as done
- **↶ Uncomplete**: Revert completed tasks
- **× Delete**: Remove permanently

### Smart Features
- **Task Persistence**: Data survives browser restarts
- **Cross-Device Sync**: Access your tasks from anywhere
- **Conflict Resolution**: Automatic merging of changes from multiple devices
- **Offline Support**: Works without internet, syncs when online

## 🔒 Privacy & Security

- **Local First**: Tasks are stored locally in your browser
- **Private Gists**: Cloud sync uses private GitHub Gists (not public)
- **Token Security**: Your GitHub token is stored locally only
- **No Tracking**: No analytics, no data collection
- **Open Source**: All code is transparent and auditable

## 🛠 Technical Details

- **Pure Frontend**: HTML5, CSS3, and vanilla JavaScript
- **No Dependencies**: Works offline, no build process required
- **Modern Standards**: ES6, CSS Grid/Flexbox, HTML5 APIs
- **Storage Options**: localStorage + GitHub Gist sync
- **Responsive Design**: Mobile-first approach with desktop optimization

## 📁 File Structure

```
todo/
├── index.html          # Main application
├── styles.css          # Modern minimalist styling  
├── script.js           # App logic + GitHub sync
├── README.md           # This file
└── .gitignore          # Git exclusions
```

## 🌐 Browser Support

Works on all modern browsers with support for:
- localStorage API
- ES6 JavaScript (async/await, classes)
- CSS Grid and Flexbox  
- HTML5 drag and drop API
- Fetch API for cloud sync

## 🤝 Contributing

This is a simple, focused project. Feel free to:
- Report issues
- Suggest improvements
- Submit pull requests
- Fork for your own modifications

## 📄 License

Open source - use however you'd like!