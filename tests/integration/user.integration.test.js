/**
 * User API — Supertest Integration Tests
 *
 * Every test makes real HTTP requests through the full stack:
 *   supertest → Express → __token/__shark/__user middleware → UserManager → MongoDB
 */

const request = require('supertest');
const { createTestApp } = require('../_setup');
const { userData } = require('../_mocks');

let app;

beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
})

// ─── POST /api/user/register ──────────────────────────────────────────────────

describe('POST /api/user/register', () => {
    it('returns 200 with tokens and user object', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send(userData())
            .expect(200);

        process.env.USER_ACCESS_TOKEN_ONE = res.body.data.accessToken;
        process.env.USER_REFRESH_TOKEN_ONE = res.body.data.refreshToken;
        process.env.USER_EMAIL_ONE = res.body.data.user.email;
        expect(res.body.ok).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user.email).toBeDefined();
    });

    it('does not return password in response', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send(userData())
            .expect(200);

        expect(res.body.data.user.password).toBeUndefined();
    });

    it('returns 400 on duplicate email', async () => {
        const data = userData({ email: `${process.env.USER_EMAIL_ONE}` });

        const res = await request(app)
            .post('/api/user/register')
            .send(data)
            .expect(400);

        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toMatch(/already exists/i);
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({ email: 'bad@test.com' })
            .expect(400);

        expect(res.body.ok).toBe(false);
    });

    it('is accessible without a token (public route)', async () => {
        // No .set('token', ...) — should NOT return 401
        const res = await request(app)
            .post('/api/user/register')
            .send(userData())
            .expect(200);

        expect(res.body.ok).toBe(true);
    });
});

// ─── POST /api/user/login ─────────────────────────────────────────────────────

describe('POST /api/user/login', () => {
    it('returns tokens on valid credentials', async () => {
        const data = userData();
        // await registerUser(app, data);

        const res = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: data.password })
            .expect(200);

        expect(res.body.ok).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.expiresIn).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
        const data = userData();
        await registerUser(app, data);

        const res = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: 'WrongPass@999' })
            .expect(401);

        expect(res.body.ok).toBe(false);
    });

    it('returns 401 for non-existent email', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({ email: 'ghost@nobody.com', password: 'Test@1234' })
            .expect(401);

        expect(res.body.ok).toBe(false);
    });

    it('returns 403 for inactive account', async () => {
        const data = userData();
        // const { user } = await registerUser(app, data);

        // Deactivate directly in DB
        // const User = require('../../mongomodels/User');
        // await User.findByIdAndUpdate(user._id, { status: 'inactive' });

        const res = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: data.password })
            .expect(403);

        expect(res.body.ok).toBe(false);
    });

    it('is accessible without a token (public route)', async () => {
        const data = userData();

        const res = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: data.password });

        expect(res.status).not.toBe(401);
        expect(res.body.ok).toBe(true);
    });
});

// ─── POST /api/user/logout ────────────────────────────────────────────────────

describe('POST /api/user/logout', () => {
    it('returns 200 and blacklists the token', async () => {
        // const { token, api } = await (async () => {
        //     const { token } = await registerUser(app);
        //     return { token, api: authed(app, token) };
        // })();

        const res = await api.post('/api/user/logout').expect(200);
        expect(res.body.ok).toBe(true);

        // Subsequent request with the same token should be rejected
        const res2 = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${process.env.USER_ACCESS_TOKEN_ONE}`);

        expect(res2.status).toBe(401);
    });

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/user/logout').expect(401);
        expect(res.body.ok).toBe(false);
    });
});

// ─── GET /api/user/profile ────────────────────────────────────────────────────

describe('GET /api/user/profile', () => {
    it('returns the authenticated user profile', async () => {
        const data = userData();
        // const { token } = await registerUser(app, data);

        const res = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${process.env.USER_ACCESS_TOKEN_ONE}`)
            .expect(200);

        expect(res.body.ok).toBe(true);
        expect(res.body.data.email).toBe(data.email.toLowerCase());
        expect(res.body.data.password).toBeUndefined();
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/user/profile').expect(401);
        expect(res.body.ok).toBe(false);
    });
});

// ─── PUT /api/user/profile ────────────────────────────────────────────────────

describe('PUT /api/user/profile', () => {
    it('updates profile fields and reflects in next get', async () => {
        // const { token } = await registerUser(app);
        // const api = authed(app, token);

        const res = await api.put('/api/user/profile')
            .send({ profile: { firstName: 'Updated', lastName: 'Name' } })
            .expect(200);

        expect(res.body.ok).toBe(true);

        const profileRes = await api.get('/api/user/profile').expect(200);
        expect(profileRes.body.data.profile.firstName).toBe('Updated');
    });

    it('returns 400 if trying to take an existing email', async () => {
        // await registerUser(app, { email: 'taken@test.com' });
        // const { token } = await registerUser(app);

        const res = await request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${process.env.USER_ACCESS_TOKEN_ONE}`)
            .send({ email: 'taken@test.com' })
            .expect(400);

        expect(res.body.ok).toBe(false);
    });
});

// ─── POST /api/user/change-password ──────────────────────────────────────────

describe('POST /api/user/change-password', () => {
    it('changes password and allows login with new password', async () => {
        const data = userData();
        // const { token } = await registerUser(app, data);

        const changeRes = await request(app)
            .post('/api/user/change-password')
            .set('Authorization', `Bearer ${process.env.USER_ACCESS_TOKEN_ONE}`)
            .send({ currentPassword: data.password, newPassword: 'NewPass@5678', confirmPassword: 'NewPass@5678' })
            .expect(200);

        expect(changeRes.body.ok).toBe(true);

        // Old password fails
        const oldLoginRes = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: data.password });
        expect(oldLoginRes.body.ok).toBe(false);

        // New password works
        const newLoginRes = await request(app)
            .post('/api/user/login')
            .send({ email: data.email, password: 'NewPass@5678' });
        expect(newLoginRes.body.ok).toBe(true);
    });

    it('returns 400 for wrong current password', async () => {
        const res = await request(app)
            .post('/api/user/change-password')
            .set('Authorization', `Bearer ${process.env.USER_ACCESS_TOKEN_ONE}`)
            .send({ currentPassword: 'WrongPass@000', newPassword: 'NewPass@5678', confirmPassword: 'NewPass@5678' })
            .expect(400);

        expect(res.body.ok).toBe(false);
    });
});