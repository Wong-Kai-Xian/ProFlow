# ProFlow

## Project Overview

ProFlow is a comprehensive web application designed to streamline project management, client relationship management, and team collaboration. It provides a centralized platform for creating and managing projects, tracking customer interactions, facilitating team communication through forums, and handling various administrative tasks like approvals and quotes. The system is built to enhance productivity and organization for individuals and teams.

## Key Features

*   **User Authentication & Profiles:** Secure user registration, login, and personalized profile pages for each user.
*   **Project Management:** Create, edit, and manage projects with defined stages, descriptions, and team members. Allows for flexible team assignment and project ID-based joining.
*   **Team Collaboration (Forums):** Dedicated forums for project discussions, file sharing, and media exchange. Features include:
    *   Display of forum IDs for easy sharing.
    *   Invite members functionality with one-click copy of forum IDs.
    *   Discussion boards, shared files, media galleries, and reminders within each forum.
*   **Client Relationship Management (Contacts):** Manage client organizations and their associated customer profiles.
    *   Add, edit, and delete organizations and individual client contacts.
    *   Detailed customer profiles with company information, reputation, activity records, reminders, and attached files.
    *   Direct communication options (WhatsApp, Email) from client profiles.
*   **Team Page:** A dedicated page to view and manage your team members across all projects. Synchronized with contact team data.
*   **Approvals & Quotes:** Functionality for managing project approvals and generating quotes (under development).
*   **Responsive UI:** Designed with a clean and modern user interface for an optimal experience across various devices.

## Technologies Used

*   **Frontend:** React.js
*   **Backend/Database:** Google Firebase (Firestore, Authentication)
*   **Styling:** Inline styles using constants for consistent design
*   **Routing:** React Router DOM
*   **Icons:** React Icons

## Setup and Installation

Follow these steps to set up and run ProFlow locally:

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or Yarn
*   Firebase Project: You'll need to set up a Firebase project and configure Firestore and Authentication.

### Steps

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd ProFlow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Firebase:**
    *   Create a `firebase.js` file in the `src/` directory.
    *   Add your Firebase configuration details to `src/firebase.js`:

        ```javascript
        // src/firebase.js
        import { initializeApp } from "firebase/app";
        import { getAuth } from "firebase/auth";
        import { getFirestore } from "firebase/firestore";

        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_AUTH_DOMAIN",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_STORAGE_BUCKET",
          messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
          appId: "YOUR_APP_ID"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        export { app, auth, db };
        ```
    *   Enable Email/Password authentication in your Firebase project.
    *   Set up Firestore rules (e.g., allow read/write for authenticated users for `users`, `projects`, `forums`, `organizations`, `customerProfiles` collections).

4.  **Run the application:**
    ```bash
    npm start
    # or
    yarn start
    ```
    The application will open in your browser at `http://localhost:3000`.

## Usage

*   **Register/Login:** Create a new account or log in with existing credentials.
*   **Navigation:** Use the top bar to navigate between Home, Projects, Forum, Customer Profile, Approvals, Quotes, and Team pages.
*   **Projects:** Create new projects, add team members, and track their stages.
*   **Forums:** Join or create forums for discussions and collaboration. Invite members using the forum ID.
*   **Contacts:** Manage your client organizations and customer profiles.
*   **Team:** View all team members across your projects.
*   **User Profile:** Click on your user icon in the top bar or any linked user name/email to view their profile.

## Contributing

We welcome contributions! Please feel free to fork the repository, create a new branch, and submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).