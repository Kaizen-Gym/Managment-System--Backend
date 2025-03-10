# Gym Management System Backend Documentation

## Overview

This backend system provides a RESTful API for managing gym operations including member management, trainer management, attendance tracking, membership plans, reporting, and user management, including photo uploads for members and trainers.

## Technologies Used

- Node.js
- Express.js
- MongoDB (with Mongoose)
- JSON Web Tokens (JWT)
- CORS
- Multer (for file uploads)
- Sharp (for image processing)

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

_Requires Authentication Token_

#### Get Profile

```http
GET /api/auth/profile
```

_Requires Authentication Token_

#### Check User Role

```http
GET /api/auth/check-role
```

_Requires Authentication Token_

### Member Routes (`/api/member`)

#### Create Member

```http
POST /api/member/signup
```

_Requires Authentication Token_
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
  "membership_due_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_mode": "string",
  "membership_payment_date": "date",
  "photo": "file (image)" // Optional:  File upload using multipart/form-data
}
```

#### Get All Members

```http
GET /api/member/members
```

_Requires Authentication Token_

#### Get Member by Number

```http
GET /api/member/members/:number
```

_Requires Authentication Token_

#### Update Member by Number

```http
PUT /api/member/members/:number
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string", // Optional
  "gender": "string", // Optional
  "age": "number", // Optional
  "email": "string", // Optional
  "membership_type": "string", // Optional
  "membership_amount": "number", // Optional
  "membership_due_amount": "number", // Optional
  "membership_payment_status": "string", // Optional
  "membership_payment_mode": "string", // Optional
  "membership_payment_date": "date", // Optional
  "photo": "file (image)" // Optional: File upload (multipart/form-data)
}
```

#### Delete Member by Number

```http
DELETE /api/member/members/:number
```

_Requires Authentication Token_

#### Add Membership Days (Transfer Days)

```http
POST /api/member/transfer
```

_Requires Authentication Token_
**Body:**

```json
{
  "source_number": "string", // Phone number of the member donating days
  "target_number": "string" // Phone number of the member receiving days
}
```

#### Add Complimentary Days

```http
POST /api/member/complimentary-days
```

_Requires Authentication Token_
**Body:**

```json
{
  "number": "string", // Phone number of the member
  "days": "number" // Number of complimentary days to add
}
```

#### Get Membership Form Data (Placeholder)

```http
GET /api/member/membership-form/:number
```

_Requires Authentication Token_

### Trainer Routes (`/api`)

#### Create Trainer

```http
POST /api/trainer
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string",
  "email": "string",
  "number": "string",
  "specialization": "string",
  "experience": "number",
  "certifications": "array",
  "schedule": "object",
  "photo": "file (image)" // Optional: File upload (multipart/form-data)
}
```

#### Get All Trainers

```http
GET /api/trainers
```

_Requires Authentication Token_

#### Get Trainer by ID

```http
GET /api/trainer/:id
```

_Requires Authentication Token_

#### Update Trainer by ID

```http
PUT /api/trainer/:id
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string", // Optional
  "email": "string", // Optional
  "number": "string", // Optional
  "specialization": "string", // Optional
  "experience": "number", // Optional
  "certifications": "array", // Optional
  "schedule": "object", // Optional
  "photo": "file (image)" // Optional:  File upload (multipart/form-data)
}
```

#### Delete Trainer by ID

```http
DELETE /api/trainer/:id
```

_Requires Authentication Token_

### Attendance Routes (`/api`)

#### Check-in Member

```http
POST /api/attendance/checkin
```

_Requires Authentication Token_
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

_Requires Authentication Token_
**Body:**

```json
{
  "number": "string"
}
```

#### Get Attendance Records for a Specific Member

```http
GET /api/attendance/:number
```

_Requires Authentication Token_
_Returns an array of attendance records_

#### Get All Attendance Records (for the gym)

```http
GET /api/attendance
```

_Requires Authentication Token_

### Membership Routes (`/api/memberships`)

#### Renew Membership

```http
POST /api/memberships/renew
```

_Requires Authentication Token_
**Body:**

```json
{
  "number": "string",
  "membership_type": "string",
  "membership_amount": "number",
  "membership_due_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_mode": "string"
}
```

#### Get All Renew Records

```http
GET /api/memberships/renew
```

_Requires Authentication Token_

#### Get Renew Records for a specific user

```http
GET /api/memberships/renew/:number
```

_Requires Authentication Token_

#### Delete Renew Record

```http
DELETE /api/memberships/renew/:id
```

_Requires Authentication Token_

#### Update Renew Record

```http
PUT /api/memberships/renew/:id
```

_Requires Authentication Token_
**Body:**

```json
{
  "membership_type": "string", // Optional
  "membership_amount": "number", // Optional
  "membership_payment_status": "string", // Optional
  "membership_payment_mode": "string" // Optional
}
```

#### Get Membership Plans

```http
GET /api/memberships/plans
```

_Requires Authentication Token_

#### Create Membership Plan

```http
POST /api/memberships/plans
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string",
  "duration": "number", // in months
  "price": "number",
  "description": "string",
  "features": "array" // Optional
}
```

#### Update Membership Plan

```http
PUT /api/memberships/plans/:id
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string",
  "duration": "number", // in months
  "price": "number",
  "description": "string",
  "features": "array" // Optional
}
```

#### Delete Membership Plan

```http
DELETE /api/memberships/plans/:id
```

_Requires Authentication Token_

#### Pay Due Amount

```http
POST /api/memberships/pay-due
```

_Requires Authentication Token_
**Body:**

```json
{
  "number": "string",
  "amount_paid": "number",
  "payment_mode": "string"
}
```

### User Routes (`/api`)

#### List All Users

```http
GET /api/users
```

_Requires Authentication Token_

#### Create User

```http
POST /api/users
```

_Requires Authentication Token_
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
  "permissions": "array of strings (optional)", // Defaults to role's permissions if not provided.
  "gymId": "string"
}
```

#### Edit User by ID

```http
PUT /api/users/:id
```

_Requires Authentication Token_
**Body:**

```json
{
  "name": "string", // Optional
  "gender": "string", // Optional
  "age": "number", // Optional
  "email": "string", // Optional
  "number": "string", // Optional
  "user_type": "string", // Optional
  "permissions": "array of strings (optional)" // Optional
}
```

#### Delete User by ID

```http
DELETE /api/users/:id
```

_Requires Authentication Token_

#### Get Available Roles

```http
GET /api/roles
```

_Requires Authentication Token_

#### Create Role

```http
POST /api/roles
```

_Requires Authentication Token_
**Body:**

```json
{
  "roleName": "string",
  "defaultPermissions": "array of strings" // Optional
  "currentPermissions": "array of strings" // Optional
}
```

#### Update Role

```http
PUT /api/roles/:roleName
```

_Requires Authentication Token_
**Body:**

```json
{
  "defaultPermissions": "array of strings", // Optional
  "currentPermissions": "array of strings" // Optional
}
```

#### Delete Role

```http
DELETE /api/roles/:id
```

_Requires Authentication Token_

### Report Routes (`/api/reports`)

#### Get Membership Reports (with Filters)

```http
GET /api/reports/membership
```

_Requires Authentication Token_

- **Query Parameters (Optional):**
  - `name`: String (partial match, case-insensitive)
  - `gender`: String
  - `email`: String
  - `number`: String
  - `membership_type`: String
  - `membership_status`: String
  - `membership_payment_status`: String
  - `membership_payment_mode`: String
  - `membership_payment_reference`: String
  - `age`: Number
  - `member_total_payment`: Number
  - `membership_duration`: Number
  - `membership_amount`: Number
  - `membership_start_date_from`: Date (YYYY-MM-DD)
  - `membership_start_date_to`: Date (YYYY-MM-DD)
  - `membership_end_date_from`: Date (YYYY-MM-DD)
  - `membership_end_date_to`: Date (YYYY-MM-DD)
  - `membership_payment_date_from`: Date (YYYY-MM-DD)
  - `membership_payment_date_to`: Date (YYYY-MM-DD)

#### Get Financial Reports

```http
GET /api/reports/financial
```

_Requires Authentication Token_

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
- 409: Conflict (e.g., user already exists)
- 500: Server Error

## Environment Variables

Required environment variables:

```
MongoDB=<mongodb-connection-string>
JWT_SECRET=<jwt-secret-key>
ALLOWED_ORIGINS=<comma-separated-list-of-allowed-origins> // Optional: For CORS configuration.
```

## Logging

The system uses a custom logger that writes to:

- `logs.log`: General application logs
- `debug.log`: Debug-level information

## Security Features

- JWT-based authentication
- Password hashing (bcrypt)
- CORS protection (with origin whitelisting)
- Request validation
- Data sanitization
- Gym-specific data isolation
- Input validation (e.g., required fields, data types, min/max values)

## Data Models

### User

- name: String
- gender: String
- age: Number
- email: String
- number: String
- password: String
- user_type: String (Admin, User, Trainer, Receptionist, Manager)
- permissions: [String]
- gymId: ObjectId
- createdAt: Date

### Member

- id: String (generated)
- name: String
- number: String
- gender: String
- age: Number
- email: String
- member_total_payment: Number
- member_total_due_amount: Number
- createdAt: Date
- photo: { data: Buffer, contentType: String }
- membership_type: String
- membership_status: String
- membership_start_date: Date
- membership_end_date: Date
- membership_duration: Number
- membership_amount: Number
- membership_due_amount: Number
- membership_payment_status: String
- membership_payment_date: Date
- membership_payment_mode: String
- membership_payment_reference: String
- gymId: ObjectId

### Trainer

- id: String (generated)
- name: String
- email: String
- number: String
- specialization: String
- experience: Number
- certifications: [String]
- schedule: [ { day: String, startTime: String, endTime: String } ]
- createdAt: Date
- photo: { data: Buffer, contentType: String }
- gymId: ObjectId

### Attendance

- id: String
- name: String
- number: String
- checkIn: Date
- checkOut: Date
- attendanceType: String (In-Person, Virtual)
- gymId: ObjectId
- timestamps: true

### MembershipPlan

- name: String
- duration: Number (in months)
- price: Number
- description: String
- features: [String]
- gymId: ObjectId
- timestamps: true

### Renew

- id: String
- name: String
- number: String
- membership_type: String
- membership_amount: Number
- membership_due_amount: Number
- membership_payment_status: String
- membership_payment_date: Date
- membership_payment_mode: String
- membership_end_date: Date
- gymId: ObjectId
- is_due_payment: Boolean
- payment_type: String (Membership Renewal, Due Payment)

### Role

- roleName: String
- defaultPermissions: [String]
- currentPermissions: [String]
- timestamps: true
