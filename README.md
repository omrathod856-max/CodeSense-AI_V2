# CodeSense-AI
An AI-powered interview preparation platform that helps users practice coding interviews with intelligent feedback and analytics.
## 🚀 Features
- **User Authentication**: Secure signup/login system with JWT-based authentication
- **AI-Powered Interviews**: Interactive interview sessions with AI interviewer
- **Analytics Dashboard**: Track your interview performance and progress
- **Recent Activity**: View your interview history and activities
- **Quick Start Guide**: Easy onboarding for new users
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
## 🛠️ Tech Stack
### Frontend (Client)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, Lucide React, Tabler Icons
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Animation**: Motion (Framer Motion)
### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Validation**: Joi
- **CORS**: Enabled for cross-origin requests
## 📋 Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local or MongoDB Atlas account)
## 💻 Installation
### 1. Clone the repository
```bash
git clone https://github.com/YashThakur-997/CodeSense-AI.git
cd CodeSense-AI
```
### 2. Install Server Dependencies
```bash
cd server
npm install
```
### 3. Install Client Dependencies
```bash
cd ../client
npm install
```
## ⚙️ Configuration
### Server Configuration
Create a `.env` file in the `server` directory with the following variables:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```
## 🚀 Running the Application
### Start the Server
```bash
cd server
npm start
```
The server will run on `http://localhost:5000` (or your configured PORT)
### Start the Client
```bash
cd client
npm run dev
```
The client will run on `http://localhost:5173`
## 📁 Project Structure
```
CodeSense-AI/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── assets/        # Static assets
│   │   ├── components/    # Reusable UI components
│   │   ├── tabs/          # Page components
│   │   │   ├── auth/      # Authentication pages
│   │   │   └── features/  # Main feature pages
│   │   ├── lib/           # Utility functions
│   │   ├── App.tsx        # Main App component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── vite.config.ts
│
└── server/                 # Backend Express application
    ├── controllers/        # Route controllers
    ├── middlewares/        # Custom middlewares
    ├── models/            # MongoDB models
    ├── routes/            # API routes
    ├── index.js           # Server entry point
    └── package.json
```
## 🔌 API Endpoints
### Authentication
- `POST /auth/signup` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
## 📝 License
This project is open source and available under the [MIT License](LICENSE).
## 👤 Author
**Yash Thakur**
- GitHub: [@YashThakur-997](https://github.com/YashThakur-997)
## 🙏 Acknowledgments
- React team for the amazing framework
- Vite for the blazing fast build tool
- All contributors who help improve this project
