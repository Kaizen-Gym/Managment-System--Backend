# Kaizen Gym Management System API Documentation

## Introduction

The Kaizen Gym Management System is a comprehensive solution designed to streamline operations for fitness centers and gyms. This robust platform enables efficient management of memberships, attendance tracking, financial reporting, and automated system maintenance.

Developed for Kaizen, this system provides gym owners and staff with powerful tools for member management, payment processing, attendance tracking, and detailed analytics to make data-driven business decisions.

## System Architecture

The application follows a modern client-server architecture with:

- **Backend**: Node.js with Express framework
- **Database**: MongoDB
- **Authentication**: JWT-based authentication system
- **Security**: CSRF protection, HTTP-only cookies
- **Logging**: Winston logger with daily log rotation
- **Automated Jobs**: Node-schedule for membership status updates and database backups

## API Endpoints

### Authentication

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

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "number": "string",
  "email": "string",
  "role": "string",
  "permissions": ["string"],
  "token": {
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

#### Login User

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

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "email": "string",
  "role": "string",
  "permissions": ["string"],
  "gymId": "string"
}
```

#### Verify Session

```http
GET /api/auth/session
```

**Response:**

```json
{
  "authenticated": true,
  "user": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "role": "string",
    "permissions": ["string"],
    "gymId": "string"
  }
}
```

#### Refresh Token

```http
POST /api/auth/refresh-token
```

**Response:**

```json
{
  "success": true
}
```

#### Logout

```http
POST /api/auth/logout
```

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

#### Get User Profile

```http
GET /api/auth/profile
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "email": "string",
  "number": "string",
  "user_type": "string",
  "permissions": ["string"],
  "createdAt": "date",
  "gymId": {
    "_id": "string",
    "name": "string",
    "address": "string"
  }
}
```

#### Check User Role

```http
GET /api/auth/check-role
```

**Response:**

```json
{
  "role": "string"
}
```

### Member Management

#### Create New Member

```http
POST /api/member/signup
```

**Body:** (multipart/form-data)

```
name: string
number: string
gender: string
age: number
email: string (optional)
membership_type: string
membership_amount: number
membership_due_amount: number (optional)
membership_payment_status: string
membership_payment_mode: string
membership_payment_date: date
photo: file (optional)
```

**Response:**

```json
{
  "message": "User created successfully"
}
```

#### Get All Members

```http
GET /api/member/members
```

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 10)
status: string (all, Active, Inactive, or Expired)
```

**Response:**

```json
{
  "members": [
    {
      "_id": "string",
      "name": "string",
      "gender": "string",
      "age": "number",
      "email": "string",
      "number": "string",
      "membership_type": "string",
      "membership_status": "string",
      "membership_start_date": "date",
      "membership_end_date": "date"
    }
  ],
  "total": "number",
  "page": "number",
  "totalPages": "number"
}
```

#### Get Member by Number

```http
GET /api/member/members/:number
```

**Response:**

```json
{
  "_id": "string",
  "id": "string",
  "name": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "number": "string",
  "member_total_payment": "number",
  "member_total_due_amount": "number",
  "membership_type": "string",
  "membership_status": "string",
  "membership_start_date": "date",
  "membership_end_date": "date",
  "membership_duration": "number",
  "membership_amount": "number",
  "membership_due_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_date": "date",
  "membership_payment_mode": "string"
}
```

#### Delete Member

```http
DELETE /api/member/members/:number
```

**Response:**

```json
{
  "message": "User deleted successfully"
}
```

#### Update Member

```http
PUT /api/member/members/:number
```

**Body:** (multipart/form-data)

```
name: string (optional)
gender: string (optional)
age: number (optional)
email: string (optional)
membership_type: string (optional)
membership_amount: number (optional)
membership_due_amount: number (optional)
membership_payment_status: string (optional)
membership_payment_mode: string (optional)
membership_start_date: date (optional)
photo: file (optional)
```

**Response:**

```json
{
  "message": "Member updated successfully",
  "member": {
    "_id": "string",
    "id": "string",
    "name": "string",
    "gender": "string",
    "age": "number",
    "email": "string",
    "number": "string",
    "membership_type": "string",
    "membership_status": "string",
    "membership_start_date": "date",
    "membership_end_date": "date"
  }
}
```

#### Transfer Membership Days

```http
POST /api/member/transfer
```

**Body:**

```json
{
  "source_number": "string",
  "target_number": "string"
}
```

**Response:**

```json
{
  "message": "Membership days transferred successfully"
}
```

#### Add Complimentary Days

```http
POST /api/member/complimentary-days
```

**Body:**

```json
{
  "number": "string",
  "days": "number"
}
```

**Response:**

```json
{
  "message": "5 complimentary days added successfully",
  "newExpiryDate": "date"
}
```

#### Get Membership Form

```http
GET /api/member/membership-form/:number
```

**Response:**

```json
{
  "message": "Membership form data",
  "member": {
    "_id": "string",
    "name": "string",
    "number": "string"
    // Other member details
  }
}
```

#### Search Members

```http
POST /api/member/search
```

**Body:**

```json
{
  "query": "string"
}
```

**Response:**

```json
{
  "count": "number",
  "members": [
    {
      "_id": "string",
      "name": "string",
      "email": "string",
      "number": "string",
      "membership_type": "string",
      "membership_status": "string",
      "membership_end_date": "date",
      "id": "string"
    }
  ]
}
```

### Membership Management

#### Renew Membership

```http
POST /api/memberships/renew
```

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

**Response:**

```json
{
  "message": "Membership renewed successfully",
  "member": {
    "_id": "string",
    "name": "string",
    "number": "string",
    "membership_type": "string",
    "membership_end_date": "date"
  }
}
```

#### Get All Renewal Records

```http
GET /api/memberships/renew
```

**Response:**

```json
[
  {
    "_id": "string",
    "id": "string",
    "name": "string",
    "number": "string",
    "membership_type": "string",
    "membership_amount": "number",
    "membership_due_amount": "number",
    "membership_payment_status": "string",
    "membership_payment_date": "date",
    "membership_payment_mode": "string",
    "membership_end_date": "date"
  }
]
```

#### Get Member Renewal Records

```http
GET /api/memberships/renew/:number
```

**Response:**

```json
[
  {
    "_id": "string",
    "id": "string",
    "name": "string",
    "number": "string",
    "membership_type": "string",
    "membership_amount": "number",
    "membership_due_amount": "number",
    "membership_payment_status": "string",
    "membership_payment_date": "date",
    "membership_payment_mode": "string",
    "membership_end_date": "date"
  }
]
```

#### Delete Renewal Record

```http
DELETE /api/memberships/renew/:id
```

**Response:**

```json
{
  "message": "Renew record deleted successfully"
}
```

#### Update Renewal Record

```http
PUT /api/memberships/renew/:id
```

**Body:**

```json
{
  "membership_type": "string",
  "membership_amount": "number",
  "membership_payment_status": "string",
  "membership_payment_mode": "string"
}
```

**Response:**

```json
{
  "message": "Renew record updated successfully",
  "record": {
    "_id": "string",
    "name": "string",
    "number": "string",
    "membership_type": "string",
    "membership_amount": "number",
    "membership_payment_status": "string",
    "membership_payment_mode": "string"
  }
}
```

#### Get Membership Plans

```http
GET /api/memberships/plans
```

**Response:**

```json
[
  {
    "_id": "string",
    "name": "string",
    "duration": "number",
    "price": "number",
    "description": "string",
    "features": ["string"],
    "gymId": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

#### Create Membership Plan

```http
POST /api/memberships/plans
```

**Body:**

```json
{
  "name": "string",
  "duration": "number",
  "price": "number",
  "description": "string",
  "features": ["string"]
}
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "duration": "number",
  "price": "number",
  "description": "string",
  "features": ["string"],
  "gymId": "string",
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Update Membership Plan

```http
PUT /api/memberships/plans/:id
```

**Body:**

```json
{
  "name": "string",
  "duration": "number",
  "price": "number",
  "description": "string",
  "features": ["string"]
}
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "duration": "number",
  "price": "number",
  "description": "string",
  "features": ["string"],
  "gymId": "string",
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Delete Membership Plan

```http
DELETE /api/memberships/plans/:id
```

**Response:**

```json
{
  "message": "Membership plan deleted successfully"
}
```

#### Process Due Payment

```http
POST /api/memberships/pay-due
```

**Body:**

```json
{
  "number": "string",
  "amount_paid": "number",
  "payment_mode": "string"
}
```

**Response:**

```json
{
  "message": "Due payment processed successfully",
  "remaining_due": "number",
  "payment_details": {
    "amount_paid": "number",
    "payment_date": "date",
    "payment_mode": "string"
  }
}
```

### Attendance Management

#### Check-in Member

```http
POST /api/attendance/checkin
```

**Body:**

```json
{
  "number": "string"
}
```

**Response:**

```json
{
  "message": "Check-in recorded",
  "attendance": {
    "_id": "string",
    "name": "string",
    "number": "string",
    "checkIn": "date",
    "gymId": "string"
  }
}
```

#### Check-out Member

```http
POST /api/attendance/checkout
```

**Body:**

```json
{
  "number": "string"
}
```

**Response:**

```json
{
  "message": "Check-out recorded",
  "attendance": {
    "_id": "string",
    "name": "string",
    "number": "string",
    "checkIn": "date",
    "checkOut": "date",
    "gymId": "string"
  }
}
```

#### Get All Attendance Records

```http
GET /api/attendance
```

**Response:**

```json
{
  "gymId": "string",
  "attendances": [
    {
      "_id": "string",
      "id": "string",
      "name": "string",
      "number": "string",
      "checkIn": "date",
      "checkOut": "date",
      "gymId": "string"
    }
  ]
}
```

#### Get Member Attendance Records

```http
GET /api/attendance/:number
```

**Response:**

```json
[
  {
    "_id": "string",
    "id": "string",
    "name": "string",
    "number": "string",
    "checkIn": "date",
    "checkOut": "date",
    "gymId": "string"
  }
]
```

### Reports and Analytics

#### Get Membership Reports

```http
GET /api/reports/membership
```

**Response:**

```json
{
  "totalActiveMembers": "number",
  "newMemberSignups": [
    {
      "_id": "date-string",
      "count": "number"
    }
  ],
  "expiringMemberships": [
    {
      "_id": "string",
      "name": "string",
      "membership_end_date": "date"
    }
  ],
  "membershipRenewalRate": "number",
  "dailyRenewals": [
    {
      "_id": "date-string",
      "count": "number"
    }
  ],
  "monthlyRenewals": [
    {
      "_id": {
        "year": "number",
        "month": "number"
      },
      "count": "number"
    }
  ],
  "renewalRevenue": "number",
  "paymentSummary": {
    "totalPayments": "number",
    "totalRevenue": "number"
  },
  "paymentMethodsBreakdown": [
    {
      "_id": "string",
      "count": "number",
      "total": "number"
    }
  ]
}
```

#### Get Financial Reports

```http
GET /api/reports/financial
```

**Response:**

```json
{
  "totalRevenue": "number",
  "totalDue": "number",
  "paymentSummary": {
    "totalPayments": "number",
    "totalRevenue": "number",
    "totalDue": "number",
    "totalRefunds": "number",
    "totalPendingPayments": "number",
    "totalFailedPayments": "number"
  },
  "dailyPayments": [
    {
      "_id": "date-string",
      "count": "number"
    }
  ],
  "monthlyPayments": [
    {
      "_id": {
        "year": "number",
        "month": "number"
      },
      "count": "number"
    }
  ],
  "paymentMethodsBreakdown": [
    {
      "_id": "string",
      "count": "number",
      "total": "number"
    }
  ]
}
```

#### Get Membership Analytics

```http
GET /api/reports/analytics/membership
```

**Query Parameters:**
```
date: string (ISO date, default: today)
interval: string (15, 30, 90, all - default: 30)
```

**Response:**

```json
{
  "retention": {
    "currentRetentionRate": "number",
    "monthlyRetention": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "totalMembers": "number",
        "retainedMembers": "number"
      }
    ],
    "activeMembers": "number",
    "totalAnalyzed": "number"
  },
  "churn": {
    "currentChurnRate": "number",
    "lostMembersCount": "number",
    "churnReasons": {
      "expired": "number",
      "inactive": "number"
    },
    "monthlyChurn": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "count": "number"
      }
    ]
  },
  "growth": {
    "currentMonthGrowth": {
      "newMembers": "number",
      "totalRevenue": "number"
    },
    "monthlyGrowth": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "newMembers": "number",
        "totalRevenue": "number"
      }
    ],
    "totalGrowth": "number"
  },
  "demographics": {
    "ageDistribution": [
      {
        "_id": "string",
        "count": "number"
      }
    ],
    "genderDistribution": [
      {
        "_id": "string",
        "count": "number"
      }
    ],
    "membershipTypeDistribution": [
      {
        "_id": "string",
        "count": "number",
        "revenue": "number"
      }
    ]
  },
  "trends": [
    {
      "_id": {
        "year": "number",
        "month": "number"
      },
      "activeMembers": "number",
      "totalRevenue": "number",
      "averageDuration": "number"
    }
  ]
}
```

#### Get Attendance Analytics

```http
GET /api/reports/analytics/attendance
```

**Query Parameters:**
```
date: string (ISO date, default: today)
interval: string (15, 30, 90, all - default: 30)
```

**Response:**

```json
{
  "peakHours": {
    "hourlyPatterns": [
      {
        "_id": {
          "hour": "number",
          "dayOfWeek": "number"
        },
        "count": "number"
      }
    ],
    "averageVisitDuration": "number",
    "busiestDays": [
      {
        "_id": {
          "dayOfWeek": "number"
        },
        "count": "number"
      }
    ],
    "totalVisits": "number"
  },
  "weeklyPatterns": [
    {
      "_id": {
        "dayOfWeek": "number",
        "hour": "number"
      },
      "count": "number"
    }
  ],
  "monthlyTrends": [
    {
      "_id": {
        "year": "number",
        "month": "number"
      },
      "totalVisits": "number",
      "uniqueMembers": "number"
    }
  ],
  "heatmapData": [
    {
      "_id": {
        "date": "string",
        "hour": "number"
      },
      "count": "number"
    }
  ],
  "dateRange": {
    "startDate": "date",
    "endDate": "date"
  }
}
```

#### Get Financial Analytics

```http
GET /api/reports/analytics/financial
```

**Query Parameters:**
```
date: string (ISO date, default: today)
interval: string (15, 30, 90, all - default: 30)
```

**Response:**

```json
{
  "projections": {
    "historicalRevenue": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "revenue": "number",
        "renewalCount": "number"
      }
    ],
    "metrics": {
      "renewalRate": "number",
      "growthRate": "number",
      "averageMembershipAmount": "number",
      "averageRenewalAmount": "number"
    },
    "projections": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "projectedRevenue": "number",
        "expectedRenewals": "number",
        "baseRevenue": "number",
        "growthRevenue": "number"
      }
    ],
    "upcomingRenewals": [
      {
        "amount": "number",
        "dueDate": "date"
      }
    ]
  },
  "paymentAnalysis": {
    "paymentMethods": [
      {
        "_id": "string",
        "count": "number",
        "total": "number"
      }
    ],
    "paymentTrends": [
      {
        "_id": {
          "year": "number",
          "month": "number"
        },
        "total": "number",
        "count": "number"
      }
    ],
    "dateRange": {
      "startDate": "date",
      "endDate": "date"
    }
  },
  "duePaymentsTrend": [
    {
      "_id": {
        "year": "number",
        "month": "number"
      },
      "totalDue": "number",
      "count": "number"
    }
  ],
  "profitabilityMetrics": {
    "totalRevenue": "number",
    "totalDues": "number",
    "totalExpenses": "number",
    "netIncome": "number",
    "profitMargin": "number",
    "dateRange": {
      "startDate": "date",
      "endDate": "date"
    }
  },
  "dateRange": {
    "startDate": "date",
    "endDate": "date"
  }
}
```

#### Get Upcoming Renewals

```http
GET /api/reports/upcoming-renewals
```

**Response:**

```json
{
  "renewals": [
    {
      "_id": "string",
      "name": "string",
      "number": "string",
      "membership_type": "string",
      "membership_end_date": "date",
      "membership_amount": "number"
    }
  ],
  "totalCount": "number",
  "totalExpectedRevenue": "number",
  "queryDetails": {
    "dateRange": {
      "from": "date",
      "to": "date"
    },
    "gymId": "string"
  }
}
```

#### Get Due Payment Details

```http
GET /api/reports/due-details
```

**Response:**

```json
{
  "members": [
    {
      "_id": "string",
      "name": "string",
      "number": "string",
      "member_total_due_amount": "number",
      "membership_type": "string",
      "last_payment_date": "date",
      "last_due_payment_date": "date",
      "payment_history": [
        {
          "amount": "number",
          "date": "date",
          "mode": "string"
        }
      ]
    }
  ],
  "totalDue": "number",
  "statistics": {
    "totalMembers": "number",
    "averageDueAmount": "number",
    "highestDueAmount": "number",
    "lowestDueAmount": "number"
  },
  "summary": {
    "totalPaymentsProcessed": "number",
    "recentPayments": [
      {
        "amount": "number",
        "date": "date",
        "mode": "string"
      }
    ]
  }
}
```

### User and Role Management

#### Get All Users

```http
GET /api/users
```

**Response:**

```json
[
  {
    "_id": "string",
    "name": "string",
    "gender": "string",
    "age": "number",
    "email": "string",
    "number": "string",
    "user_type": "string",
    "permissions": ["string"],
    "createdAt": "date",
    "gymId": "string"
  }
]
```

#### Edit User

```http
PUT /api/users/:id
```

**Body:**

```json
{
  "name": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "number": "string",
  "user_type": "string",
  "permissions": ["string"]
}
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "number": "string",
  "user_type": "string",
  "permissions": ["string"],
  "createdAt": "date",
  "gymId": "string"
}
```

#### Delete User

```http
DELETE /api/users/:id
```

**Response:**

```json
{
  "message": "User deleted successfully"
}
```

#### Get All Roles

```http
GET /api/roles
```

**Response:**

```json
[
  {
    "_id": "string",
    "roleName": "string",
    "defaultPermissions": ["string"],
    "currentPermissions": ["string"],
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

#### Create User

```http
POST /api/users
```

**Body:**

```json
{
  "email": "string",
  "name": "string",
  "user_type": "string",
  "number": "string",
  "password": "string",
  "gender": "string",
  "age": "number",
  "permissions": ["string"],
  "gymId": "string"
}
```

**Response:**

```json
{
  "_id": "string",
  "email": "string",
  "name": "string",
  "user_type": "string",
  "number": "string",
  "gender": "string",
  "age": "number",
  "permissions": ["string"],
  "gymId": "string"
}
```

#### Get User by ID

```http
GET /api/users/:id
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "gender": "string",
  "age": "number",
  "email": "string",
  "number": "string",
  "user_type": "string",
  "permissions": ["string"],
  "createdAt": "date",
  "gymId": "string"
}
```

### Role Management

#### Create Role

```http
POST /api/roles
```

**Body:**

```json
{
  "roleName": "string",
  "defaultPermissions": ["string"],
  "currentPermissions": ["string"]
}
```

**Response:**

```json
{
  "_id": "string",
  "roleName": "string",
  "defaultPermissions": ["string"],
  "currentPermissions": ["string"],
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Get All Roles

```http
GET /api/roles
```

**Response:**

```json
[
  {
    "_id": "string",
    "roleName": "string",
    "defaultPermissions": ["string"],
    "currentPermissions": ["string"],
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

#### Update Role Permissions

```http
PUT /api/roles/:roleName
```

**Body:**

```json
{
  "defaultPermissions": ["string"],
  "currentPermissions": ["string"]
}
```

**Response:**

```json
{
  "_id": "string",
  "roleName": "string",
  "defaultPermissions": ["string"],
  "currentPermissions": ["string"],
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Delete Role

```http
DELETE /api/roles/:id
```

**Response:**

```json
{
  "message": "Role removed successfully",
  "deletedRole": {
    "name": "string",
    "id": "string"
  }
}
```

#### Get Role by Name

```http
GET /api/roles/:roleName
```

**Response:**

```json
{
  "_id": "string",
  "roleName": "string",
  "defaultPermissions": ["string"],
  "currentPermissions": ["string"],
  "createdAt": "date",
  "updatedAt": "date"
}
```

### Trainer Management

#### Create Trainer

```http
POST /api/trainer
```

**Body:** (multipart/form-data)

```
name: string
email: string
number: string
specialization: string
experience: number
certifications: string (comma-separated)
schedule: string (JSON array)
photo: file (optional)
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "email": "string",
  "number": "string",
  "specialization": "string",
  "experience": "number",
  "certifications": ["string"],
  "schedule": [
    {
      "day": "string",
      "startTime": "string",
      "endTime": "string"
    }
  ],
  "gymId": "string"
}
```

#### Get All Trainers

```http
GET /api/trainers
```

**Response:**

```json
[
  {
    "_id": "string",
    "name": "string",
    "email": "string",
    "number": "string",
    "specialization": "string",
    "experience": "number",
    "certifications": ["string"],
    "schedule": [
      {
        "day": "string",
        "startTime": "string",
        "endTime": "string"
      }
    ],
    "createdAt": "date",
    "gymId": "string"
  }
]
```

#### Get Trainer by ID

```http
GET /api/trainer/:id
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "email": "string",
  "number": "string",
  "specialization": "string",
  "experience": "number",
  "certifications": ["string"],
  "schedule": [
    {
      "day": "string",
      "startTime": "string",
      "endTime": "string"
    }
  ],
  "createdAt": "date",
  "gymId": "string"
}
```

#### Update Trainer

```http
PUT /api/trainer/:id
```

**Body:** (multipart/form-data)

```
name: string (optional)
email: string (optional)
number: string (optional)
specialization: string (optional)
experience: number (optional)
certifications: string (comma-separated, optional)
schedule: string (JSON array, optional)
photo: file (optional)
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "email": "string",
  "number": "string",
  "specialization": "string",
  "experience": "number",
  "certifications": ["string"],
  "schedule": [
    {
      "day": "string",
      "startTime": "string",
      "endTime": "string"
    }
  ],
  "createdAt": "date",
  "gymId": "string"
}
```

#### Delete Trainer

```http
DELETE /api/trainer/:id
```

**Response:**

```json
{
  "message": "Trainer removed"
}
```

### Settings Management

#### Get Settings

```http
GET /api/settings
```

**Response:**

```json
{
  "_id": "string",
  "gymId": "string",
  "gymName": "string",
  "gymAddress": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Update Settings

```http
PUT /api/settings
```

**Body:**

```json
{
  "gymName": "string",
  "gymAddress": "string",
  "contactEmail": "string",
  "contactPhone": "string"
}
```

**Response:**

```json
{
  "_id": "string",
  "gymId": "string",
  "gymName": "string",
  "gymAddress": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "createdAt": "date",
  "updatedAt": "date"
}
```

#### Create Backup

```http
POST /api/settings/backup
```

**Response:**

```json
{
  "message": "Backup completed successfully"
}
```

#### List Backups

```http
GET /api/settings/backups
```

**Response:**

```json
[
  {
    "filename": "string",
    "size": "number",
    "createdAt": "date"
  }
]
```

#### Restore from Backup

```http
POST /api/settings/restore/:filename
```

**Response:**

```json
{
  "message": "Restore completed successfully"
}
```

#### Upload Backup

```http
POST /api/settings/upload-backup
```

**Body:** (multipart/form-data)

```
backup: file
```

**Response:**

```json
{
  "message": "Backup file uploaded successfully",
  "filename": "string"
}
```

#### Get System Information

```http
GET /api/settings/system-info
```

**Response:**

```json
{
  "success": true,
  "data": {
    "lastBackup": "string",
    "system": {
      "version": "string",
      "uptime": "string",
      "lastMaintenance": "string",
      "connections": {
        "current": "number",
        "available": "number"
      }
    },
    "database": {
      "name": "string",
      "size": "string",
      "collections": "number",
      "documents": "number",
      "indexes": "number"
    },
    "os": {
      "type": "string",
      "platform": "string",
      "arch": "string",
      "release": "string",
      "uptime": "string",
      "memory": {
        "total": "string",
        "free": "string"
      },
      "cpus": "number"
    },
    "storageInfo": {
      "backupDirectory": "string",
      "totalBackups": "number",
      "oldestBackup": "string",
      "newestBackup": "string",
      "totalSize": "string"
    }
  }
}
```

#### Get Next Backup Time

```http
GET /api/settings/next-backup
```

**Response:**

```json
{
  "nextBackup": "date",
  "timezone": "string",
  "message": "string"
}
```

#### Get Gym Settings

```http
GET /api/settings/gym
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "string",
    "gymId": "string",
    "gymName": "string",
    "gymAddress": "string",
    "contactEmail": "string",
    "contactPhone": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

#### Update Gym Settings

```http
PUT /api/settings/gym
```

**Body:**

```json
{
  "gymName": "string",
  "gymAddress": "string",
  "contactEmail": "string",
  "contactPhone": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "_id": "string",
    "gymId": "string",
    "gymName": "string",
    "gymAddress": "string",
    "contactEmail": "string",
    "contactPhone": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

#### Delete Gym Settings

```http
DELETE /api/settings/gym
```

**Response:**

```json
{
  "success": true,
  "message": "Settings deleted successfully"
}
```

### Utility Routes

#### Get All Gyms

```http
GET /api/utils/gyms
```

**Response:**

```json
[
  {
    "_id": "string",
    "name": "string",
    "address": "string"
  }
]
```

#### Get Specific Gym

```http
GET /api/utils/gym
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "address": "string"
}
```

#### Update Gym Details

```http
PUT /api/utils/gym
```

**Body:**

```json
{
  "name": "string",
  "address": "string"
}
```

**Response:**

```json
{
  "_id": "string",
  "name": "string",
  "address": "string"
}
```

## Security Features

The Kaizen Gym Management System implements several security measures:

1. **JWT Authentication**: Secure token-based authentication
2. **HTTP-only Cookies**: Prevention of XSS attacks
3. **CSRF Protection**: Cross-Site Request Forgery prevention
4. **Input Validation**: Comprehensive validation of user inputs
5. **Error Handling**: Centralized error handling with appropriate responses
6. **Password Hashing**: Secure storage of user passwords using bcrypt
7. **Role-Based Access Control**: Restricting access based on user roles
8. **Logging**: Comprehensive logging for security auditing

## Deployment Requirements

- Node.js (v14+)
- MongoDB (v4.4+)
- MongoDB tools (mongodump for backups)
- Sufficient storage for database backups
- Memory: 2GB RAM (minimum)
- CPU: 1vCPU (minimum, 2+ recommended)
- Disk: 20GB+ (depends on member count and backup retention)