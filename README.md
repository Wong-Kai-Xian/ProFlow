<img src="public/proflow-logo.png" width="50" alt="ProFlow Logo"> ProFlow
This document provides a comprehensive overview of **ProFlow**, our submission to the **Future Ready Hackathon** in the category of **Digital Transformation for Traditional Processes**.

## 1. Project Overview

ProFlow is a comprehensive web application designed to streamline project management, client relationship management, and team collaboration. It provides a centralized platform for creating and managing projects, tracking customer interactions, facilitating team communication through forums, and handling various administrative tasks like approvals and quotes. The system is built to enhance productivity and organization for individuals and teams.

## 2. Team NoName
We are a multidisciplinary team where every member contributed to all aspects of the project, including design, coding, testing, and documentation.
- BEH JIAN YONG
- TAN CHAN JIEN
- WONG KAI XIAN

## 3. For Competition Purposes Only
This project was developed exclusively for the **Future Ready Hackathon** competition. Please do not copy, replicate, or use the source code or concepts for commercial or personal use.

## 4. Live Demo & Login Details
To give you the best user experience with our integrated Google services, we have prepared a dedicated test account. You can log in at our live website:

**Live URL**: https://proflowapp.vercel.app/

**Login Credentials (System Login):**
- Email: proflow231@gmail.com
- Password: 123456

This account is specifically configured to demonstrate our Google Auth 2.0 implementation and to access integrated features like Google Docs.

## 5. Problem & Solution Summary

### 5.1 The Problem
Traditional business processes are a silent drain on productivity and revenue. Our research shows that:
- **Rework & Poor Communication**: 80% of employees spend up to half their time on rework caused by poor communication and disorganized processes. _(Geneca)_
- **Lost Revenue**: Companies lose RM 2.5M annually per company from missed follow-ups and inefficient client tracking. _(Greenlight Studio)_
- **Wasted Time**: An average of 4 hours per workday are wasted on inefficiency and repetitive activities. _(PwC)_
- **Fragmented Tools**: Teams struggle with disconnected tools and scattered workflows, making it difficult to align on projects, track customer journeys, and consistently follow standard procedures.

### 5.2 The Solution
ProFlow provides a single, intelligent workspace that directly addresses these pain points. We unify all essential business functions to significantly reduce rework, prevent missed opportunities, and streamline operations.
- **Unified Workspace**: We bring all your customer profiles, project workspaces, and communication into one place.
- **AI-Powered Workflows**: Our system offers standardized SOP templates with the option to generate custom ones using AI, ensuring consistent execution across all teams and projects.
- **Automated Efficiency**: Automated reminders and timelines are built-in to prevent missed follow-ups and ensure every task is completed on time.
- **Seamless Collaboration**: Our platform features integrated video meetings, structured forums, and real-time document sharing to keep teams aligned and communication clear.
- **Financial Control**: We provide tools for managing quotes, tracking project costs, and monitoring budgets to give you full visibility into your profitability.

## 6. Technology Stack
- **Frontend**: Built with React, utilizing modern frameworks like Tailwind CSS for design and Recharts for data visualization.
- **Backend**: Powered by Node.js + Express, handling all server-side logic and API integrations.
- **Database & Authentication**: Leverages Firebase for a scalable, serverless solution, including Firestore for the database and Firebase Authentication for user security.
- **AI & Productivity**: Integrates powerful APIs from Google (Gemini, Cloud Speech, Drive, Calendar, Gmail) for AI-assisted workflows and seamless productivity.
- **Communication**: Features integrated video conferencing via Jitsi Meet.
- **Financials**: Uses APIs like PayPal for payments and Currency-API for real-time exchange rates.
- **Mapping**: Implements Leaflet with OpenStreetMap for interactive map features.
- **Document Management**: Capable of handling PDF generation and file management with PDF-Lib and Google Drive API.
- **AI**: Google Generative Language API

## 7. Setup & Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd ProFlow
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```
    

3.  Configure Firebase:
    - Update the values in src/firebase.js with your Firebase project configuration (apiKey, authDomain, projectId, storageBucket, etc.).
    - Enable Email/Password authentication in Firebase.
    - Set Firestore rules appropriately for collections like users, projects, forums, organizations, and customerProfiles.

4.  (Optional) Configure AI and Google keys:
    - In development, you can store keys in browser localStorage or via the in‑app Personal Assistant.
    - Common keys: gemini_api_key, serp_api_key, news_api_key, google_oauth_client_id.

5.  (Optional) Configure Jitsi:
    - The app uses public meet.jit.si rooms by default for embedded meetings.
    - To use your own Jitsi domain, update the meeting URLs in pages/Forum.js, pages/ProjectDetail.js, and pages/CustomerProfile.js.

6.  Run the frontend application:
    ```bash
    npm start
    # or
    yarn start
    ```
    
    The application will open at http://localhost:3000.

7.  Build and deploy:
    ```bash
    npm run build
    # Optional (GitHub Pages)
    npm run deploy
    ```


## 8. Usage

- ***User Authentication & Profiles***: Secure user registration, login, and personalized profile pages.
- ***Unified Dashboard***: A central hub to view project statuses, financial health, and key metrics at a glance.
- ***Client Relationship Management***: Manage client organizations and their associated customer profiles. You can add, edit, and view detailed customer information, including activity records and attached files.
- ***Projects***: Create, edit, and manage projects with defined stages and team members.
- ***Forums***: Dedicated forums for project discussions, file sharing, and media exchange, with features to invite members and manage topics.
- ***Approvals***: Functionality for handling project approvals and e-signatures.
- ***Financial Management***: Track project budgets, costs, and financial performance with integrated dashboards and reporting.
- ***Team Management***: A dedicated page to view and manage your team members across all projects.
- ***Intuitive Navigation***: Use the top bar to easily navigate between all key features of the application.
- ***AI Assistant (Cat)***: An intelligent assistant that helps with workflows

## 9. Reflection: Challenges & Learnings
The biggest challenge in building ProFlow was not just to create a product, but to build a truly integrated solution that solves real-world business problems. Our key takeaways from this process include:
- **Prioritizing a Unified Experience:** We realized that our most important job was to eliminate fragmentation. Every feature we built, from the project hub to the financial tracking, had to seamlessly connect to create a single source of truth for the user.
- **Leveraging AI for Tangible Value:** We learned that simply adding an "AI feature" isn't enough. Our focus shifted to using AI to solve a specific pain point—generating a structured SOP—to deliver immediate, measurable value to the user.
- **Building for Scale:** We learned to make architectural decisions that would allow for future growth. The use of a scalable NoSQL database like Firestore and a modular component structure ensures our solution can grow with its users.
- **The Power of a Unified Team:** We learned the importance of cross-functional collaboration. By contributing to all aspects of the project, we gained a holistic understanding of the product, which helped us make better decisions and build a more cohesive application.

