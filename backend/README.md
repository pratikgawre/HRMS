# Kavya HRMS Backend (Spring Boot)

## Run
1. `cd backend`
2. `mvn spring-boot:run`
3. Backend starts at `http://localhost:8080` by default
4. If port `8080` is already in use in PowerShell, run:
   `$env:SERVER_PORT=8081; mvn spring-boot:run`
5. If you move the backend to another port, start the frontend with:
   `$env:VITE_BACKEND_URL='http://localhost:8081'; npm run dev`

## MongoDB (Local + Compass)
- Backend expects MongoDB at: `mongodb://localhost:27017/hrmsdb`
- Open MongoDB Compass and connect with: `mongodb://localhost:27017`
- Database name: `hrmsdb`

## SMTP Email Setup
- Email delivery stays disabled until SMTP settings are provided.
- Set these environment variables before starting the backend:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USERNAME=your-email@gmail.com`
- `SMTP_PASSWORD=your-app-password`
- `SMTP_FROM=your-email@gmail.com`
- For Gmail, use an App Password instead of your normal account password.
- After setting these values, restart the backend and the SMTP warning will disappear.

## APIs
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/employees`
- `GET/POST /api/attendance`
- `GET /api/attendance/employee/{employeeId}`
- `GET/POST/PUT /api/leaves`
- `GET/POST/PUT/DELETE /api/announcements`
- `GET /api/dashboard/admin/summary`

## Sample Login
- Email: `admin@gmail.com`
- Password: `admin123`

## Next Frontend Integration
- Replace `localStorage` utility calls with `fetch` calls to above APIs.
- Start from:
  - `auth.js`
  - `employeeStorage.js`
  - `leaveStorage.js`
  - `announcementStorage.js`
  - `attendanceStorage.js`
