# StayKenya

StayKenya is a full-stack property booking and management system built with the MERN stack (MongoDB, Express.js, React, Node.js). It was developed as a final year project for the Diploma in Information and Communication Technology (DICT) at Thika Technical Training Institute, supervised by Mr. Boniface Mul.

## Features

- User authentication - secure login and registration using JWT (JSON Web Tokens)
- Guest/User booking - browse property listings and make bookings
- Admin/Host management - manage properties, view and handle bookings
- RESTful API - Express.js backend with organized routes and controllers for auth, properties, bookings, and admin functions
- MongoDB database - Mongoose models for Users, Properties, and Bookings

## Tech Stack

Frontend: React, Vite, Tailwind CSS
Backend: Node.js, Express.js
Database: MongoDB (Mongoose)
Authentication: JWT

## Getting Started

### Prerequisites
- Node.js installed
- MongoDB (local or a hosted instance like MongoDB Atlas)

### Setup

1. Clone the repository
   git clone https://github.com/nyagafelix81-dotcom/StayKenya.git
   cd StayKenya/system

2. Install backend dependencies
   cd backend
   npm install

3. Create a .env file in the backend folder with your own values:
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5000

4. Install frontend dependencies
   cd ../frontend
   npm install

5. Run the backend
   cd ../backend
   npm start

6. Run the frontend (in a separate terminal)
   cd frontend
   npm run dev

## Author

Felix Nyaga
Diploma in ICT, Thika Technical Training Institute
LinkedIn: linkedin.com/in/nyagafelixi-ke
nyagafelix81@gmail.com
