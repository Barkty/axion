# API Documentation
## API Endpoints Summary

## Authentication

Method	Endpoint	Description	Role
POST	/api/auth/login	User login	Public
POST	/api/auth/register	Register school admin	Public (with registration code)
POST	/api/auth/logout	Logout	All
POST	/api/auth/refresh	Refresh token	All
Schools
Method	Endpoint	Description	Role
POST	/api/schools	Create school	Superadmin
GET	/api/schools	List schools	Superadmin
GET	/api/schools/:id	Get school details	Superadmin, School Admin
PUT	/api/schools/:id	Update school	Superadmin, School Admin
DELETE	/api/schools/:id	Delete school	Superadmin
GET	/api/schools/:id/stats	Get school statistics	Superadmin, School Admin

## Classrooms

Method	Endpoint	Description	Role
POST	/api/classrooms	Create classroom	School Admin
GET	/api/classrooms	List classrooms	School Admin
GET	/api/classrooms/:id	Get classroom details	School Admin
PUT	/api/classrooms/:id	Update classroom	School Admin
DELETE	/api/classrooms/:id	Delete classroom	School Admin
POST	/api/classrooms/:id/teacher	Assign teacher	School Admin
GET	/api/classrooms/:id/students	Get classroom students	School Admin, Teacher
Students
Method	Endpoint	Description	Role
POST	/api/students	Create student	School Admin
GET	/api/students	List students	School Admin, Teacher
GET	/api/students/:id	Get student details	School Admin, Teacher
PUT	/api/students/:id	Update student	School Admin, Teacher
DELETE	/api/students/:id	Delete student	School Admin
POST	/api/students/:id/transfer	Transfer student	School Admin
GET	/api/students/:id/history	Get transfer history	School Admin

## Sample Request/Response

Create School
```http
POST /api/schools
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Springfield Elementary School",
  "code": "SES-001",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "USA"
  },
  "contact": {
    "email": "info@springfield.edu",
    "phone": "+1-555-123-4567",
    "website": "https://springfield.edu"
  },
  "settings": {
    "maxClassrooms": 50,
    "maxStudentsPerClass": 30,
    "academicYear": "2024-2025"
  }
}
```
Response:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Springfield Elementary School",
  "code": "SES-001",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "USA"
  },
  "contact": {
    "email": "info@springfield.edu",
    "phone": "+1-555-123-4567",
    "website": "https://springfield.edu"
  },
  "settings": {
    "maxClassrooms": 50,
    "maxStudentsPerClass": 30,
    "academicYear": "2024-2025"
  },
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```