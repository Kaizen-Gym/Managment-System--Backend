# Gym Management System Backend Documentation

## Overview
This backend system provides a RESTful API for managing gym operations including member management, trainer management, attendance tracking, membership plans, and reporting.

## Technologies Used
- Node.js
- Express.js
- MongoDB (with Mongoose)
- JSON Web Tokens (JWT)
- CORS

## API Endpoints

### Authentication Routes (`/api/auth`)

#### Register User
```http
POST /api/auth/register
```
**Body:**
```json
{
  "name": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "number": "string",
  "password": "string",
  "user_type": "string",
  "gymId": "string"
}
```

#### Login
```http
POST /api/auth/login
```
**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

#### Logout
```http
POST /api/auth/logout
```
*Requires Authentication Token*

#### Get Profile
```http
GET /api/auth/profile
```
*Requires Authentication Token*

### Member Routes (`/api/member`)

#### Create Member
```http
POST /api/member/signup
```
*Requires Authentication Token*
**Body:**
```json
{
  "name": "string",
  "number": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "membership_type": "string",
  "membership_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_mode": "string",
  "membership_payment_date": "date"
}
```

#### Get All Members
```http
GET /api/member/members
```
*Requires Authentication Token*

#### Get Member by Number
```http
GET /api/member/members/:number
```
*Requires Authentication Token*

### Trainer Routes (`/api`)

#### Create Trainer
```http
POST /api/trainer
```
*Requires Authentication Token*
**Body:**
```json
{
  "name": "string",
  "email": "string",
  "number": "string",
  "address": "string",
  "specialization": "string",
  "experience": "number",
  "certifications": "array",
  "schedule": "object"
}
```

#### Get All Trainers
```http
GET /api/trainers
```
*Requires Authentication Token*

### Attendance Routes (`/api`)

#### Check-in Member
```http
POST /api/attendance/checkin
```
*Requires Authentication Token*
**Body:**
```json
{
  "number": "string"
}
```

#### Check-out Member
```http
POST /api/attendance/checkout
```
*Requires Authentication Token*
**Body:**
```json
{
  "number": "string"
}
```

### Membership Routes (`/api/memberships`)

#### Renew Membership
```http
POST /api/memberships/renew
```
*Requires Authentication Token*
**Body:**
```json
{
  "number": "string",
  "membership_type": "string",
  "membership_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_mode": "string"
}
```

#### Get Membership Plans
```http
GET /api/memberships/plans
```
*Requires Authentication Token*

### Report Routes (`/api/reports`)

#### Get Membership Reports
```http
GET /api/reports/membership
```
*Requires Authentication Token*

#### Get Financial Reports
```http
GET /api/reports/financial
```
*Requires Authentication Token*

## Middleware

### Authentication Middleware
- `protect`: Verifies JWT token and attaches user to request
- `attachGym`: Extracts gym ID from JWT token and attaches to request

## Error Handling
The API returns appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Environment Variables
Required environment variables:
```
MongoDB=<mongodb-connection-string>
JWT_SECRET=<jwt-secret-key>
```

## Logging
The system uses a custom logger that writes to:
- `logs.log`: General application logs
- `debug.log`: Debug-level information

## Security Features
- JWT-based authentication
- Password hashing
- CORS protection
- Request validation
- Gym-specific data isolation

## Data Models

### User
- name: String
- gender: String
- age: Number
- email: String
- number: String
- password: String
- user_type: String
- gymId: ObjectId

### Member
- name: String
- number: String
- gender: String
- age: Number
- email: String
- membership_type: String
- membership_amount: Number
- membership_status: String
- gymId: ObjectId

### Trainer
- name: String
- email: String
- number: String
- address: String
- specialization: String
- experience: Number
- certifications: Array
- schedule: Object
- gymId: ObjectId

### Attendance
- name: String
- number: String
- checkIn: Date
- checkOut: Date
- gymId: ObjectId