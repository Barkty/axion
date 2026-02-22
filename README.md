# School Management System API

A RESTful API for managing schools, classrooms, and students built with the Axion framework.

## Features

- Role-based access control (Superadmin, School Admin, Teacher)
- Complete school management
- Classroom management with capacity tracking
- Student enrollment and transfer capabilities
- JWT authentication
- Rate limiting
- Redis caching
- Comprehensive error handling
- Audit logging for transfers

## Prerequisites

- Node.js 22+
- MongoDB 4+
- Redis 6+

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Barkty/school-management-api.git
cd school-management-api
```

2. Install dependencies:

```bash
npm install
```
3. Configure environment variables:
```bash
    cp .env.example .env
```

Edit .env with your configuration:

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/school_management

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

```

4. Start the application:

```bash
    npm start
```

For development

```bash
npm run dev
```

## Docker Deployment
1. Build the Docker image:

```bash
docker build -t school-management-api .
```

2. Run with Docker Compose:

```bash
docker-compose up -d
```

## API Documentation
Full API documentation is available at `/api-docs` when running the server.

Authentication Flow
1. Register a new user (superadmin creates school admins)

2. Login to receive JWT token

3. Include token in subsequent requests:
```javascript 
    Authorization: Bearer {yourtoken}
```

## Testing
### Run unit tests:

```bash
npm test
```
### Run integration tests:

```bash

npm run test:integration
```

## Project Structure
```text

├── managers/
│   ├── entities/
│   │   ├── school/
│   │   │   └── School.manager.js
│   │   ├── classroom/
│   │   │   └── Classroom.manager.js
│   │   └── student/
│   │       └── Student.manager.js
│   └── auth/
│       └── Auth.manager.js
├── mws/
│   ├
│   │── __auth.mw.js
│   │── __rateLimit.mw.js
│   └── validation/
│       └── validate.mw.js
├── models/
│   ├── School.model.js
│   ├── Classroom.model.js
│   └── Student.model.js
├── connect/
│   ├── mongo.js
│   └── redis.js
├── loaders/
│   ├── ManagersLoader.js
│   └── MiddlewaresLoader.js
├── tests/
│   ├── unit/
│   └── integration/
└── static_arch/
    └── main.system.js

```

## Performance Considerations
1. Redis caching for frequently accessed data

2. MongoDB indexing on commonly queried fields

3. Rate limiting to prevent abuse

4. Database connection pooling

5. Pagination for list endpoints

## Security Features
1. JWT token authentication

2. Password hashing with bcrypt

3. Rate limiting

4. Input validation and sanitization

5. Role-based access control

6. Token blacklisting on logout

7. Helmet.js for security headers

## Error Handling
The API uses standard HTTP status codes:

1. 200: Success

2. 201: Created

3. 400: Bad Request

4. 401: Unauthorized

5. 403: Forbidden

5. 404: Not Found

6. 409: Conflict

7. 429: Too Many Requests

8. 500: Internal Server Error

### Error responses include:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Monitoring
Health check endpoint: `/health`

Metrics endpoint: `/metrics` (if configured)

Contributing
Please read [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

License
This project is licensed under the MIT License.

```text

This implementation maintains the Axion architecture patterns while adding comprehensive school management functionality. The code is modular, follows best practices, and includes proper error handling, validation, caching, and security measures.
```