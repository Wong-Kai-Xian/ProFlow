# Profile Components

This directory contains all components related to customer profile management.

## Components Overview

### Core Components
- **Card.js** - Reusable card wrapper component with consistent styling
- **CustomerInfo.js** - Displays customer personal information
- **CompanyInfo.js** - Shows company details and information
- **CompanyReputation.js** - AI-generated company reputation display

### Interactive Components
- **StatusPanel.js** - Customer status management with stages (Working, Qualified, Converted)
- **TaskManager.js** - Task management for each customer stage
- **ActivityRecord.js** - Activity logging and display
- **Reminders.js** - Reminder management component
- **AttachedFiles.js** - File attachment display

### Utilities
- **constants.js** - Shared colors, styles, and configuration constants
- **customerData.json** - Mock customer data for development
- **index.js** - Centralized exports for clean imports

## Usage

### Import individual components:
```javascript
import CustomerInfo from './profile-component/CustomerInfo';
import StatusPanel from './profile-component/StatusPanel';
```

### Or import multiple components at once:
```javascript
import { 
  CustomerInfo, 
  StatusPanel, 
  ActivityRecord,
  COLORS 
} from './profile-component';
```

## Styling Approach

All components use:
- **Consistent colors** from `constants.js`
- **Shared button styles** via `BUTTON_STYLES`
- **Standardized input styles** via `INPUT_STYLES`
- **Uniform spacing** and border radius values

## State Management

Components follow these patterns:
- **Controlled components** - All form inputs are controlled
- **Prop callbacks** - Data changes flow up through callback props
- **Immutable updates** - State updates use spread operators
- **Separation of concerns** - Each component handles its own UI logic

## Key Features

1. **Responsive Design** - Components adapt to different screen sizes
2. **Consistent UX** - Uniform styling and interaction patterns
3. **Accessibility** - Proper keyboard navigation and ARIA attributes
4. **Performance** - Optimized re-renders and efficient state updates
5. **Maintainability** - Clean, documented, and reusable code
