# Anandi Productions - Production Management App

A Frame.io-style production management system built with Next.js and Firebase.

## Features

- 🔐 **Setup Wizard** - First-time setup creates admin account
- 👥 **Team Management** - Add, edit, delete team members (Core, Freelancers, Clients)
- 📁 **Project Management** - Create and manage production projects
- 🎬 **Asset Organization** - Categories, collections, and folder views
- 🔒 **Role-Based Access** - Producer, Team Lead, Freelancer, Client roles
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

---

## 🚀 Deployment Guide

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name (e.g., "anandi-production")
4. Disable Google Analytics (optional)
5. Click **Create project**

### Step 2: Enable Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click **"Get started"**
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider
5. Click **Save**

### Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"**
4. Select your region (e.g., asia-south1 for India)
5. Click **Enable**

### Step 4: Set Firestore Security Rules

Go to **Firestore → Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow read for settings (needed for setup check)
    match /settings/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### Step 5: Enable Storage

1. Go to **Build → Storage**
2. Click **"Get started"**
3. Choose **"Start in production mode"**
4. Select your region
5. Click **Done**

### Step 6: Set Storage Security Rules

Go to **Storage → Rules** and paste:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### Step 7: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"**
3. Click **"Web"** (</> icon)
4. Register app with name "anandi-web"
5. Copy the config values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 8: Deploy to Vercel

1. Push code to GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Click **"New Project"**
4. Import your GitHub repository
5. Add Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your-project-id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Your App ID |

6. Click **Deploy**

### Step 9: First-Time Setup

1. Visit your deployed URL
2. You'll see the **Setup Wizard**
3. Enter your admin details:
   - Full Name
   - Email
   - Password
   - Company Name
4. Complete the setup
5. You're now the **Producer (Admin)**!

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Producer** | Full access - manage everything |
| **Admin** | Full access |
| **Team Lead** | Full access |
| **Project Lead** | Manage assigned projects |
| **Freelancer** | See assigned projects/categories only |
| **Client** | See approved/review assets only |

---

## 📁 Project Structure

```
anandi-production/
├── app/
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
│   ├── SetupWizard.js
│   ├── LoginPage.js
│   └── MainApp.js
├── lib/
│   ├── firebase.js
│   ├── auth-context.js
│   └── firestore.js
├── public/
├── .env.example
├── jsconfig.json
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── README.md
```

---

## 🔧 Local Development

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in your Firebase config values
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000)

---

## 📝 Adding Team Members

As Producer/Admin:

1. Go to **Team** tab
2. Click **"+ Add Member"**
3. Choose type: Core Team, Freelancer, or Client
4. Fill in details:
   - Name
   - Email
   - Password (they can use this to login)
   - Phone (optional)
   - Role (for non-clients)
5. Click **"Add Member"**

The new user can now login with their email and password!

---

## 🛠️ Customization

### Adding New Roles

Edit `lib/firestore.js`:

```javascript
export const TEAM_ROLES = {
  // Add your new role
  'new-role': { label: 'New Role', icon: '🆕', color: '#ff0000' },
  // ... existing roles
};
```

### Changing Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  background: '#0d0d14',  // Main background
  primary: '#6366f1',      // Accent color
  // ... etc
}
```

---

## 📞 Support

For issues or questions, contact the developer or create an issue on GitHub.

---

## License

MIT License - feel free to use and modify for your production house! This for in-house team to Use
