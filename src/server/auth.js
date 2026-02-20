const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/db');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'one-night-werewolf-secret-CHANGE-IN-PRODUCTION';

/**
 * Register a new user
 */
async function register(username, password) {
    // Validation
    if (!username || username.length < 2 || username.length > 20) {
        throw new Error('Username must be 2-20 characters');
    }
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }

    // Check if username exists
    const existing = await prisma.user.findUnique({
        where: { username }
    });
    if (existing) {
        throw new Error('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
        data: {
            username,
            passwordHash
        }
    });

    // Generate token
    const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET
    );

    return { token, user: { id: user.id, username: user.username } };
}

/**
 * Login existing user
 */
async function login(username, password) {
    const user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) {
        throw new Error('Invalid username or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        throw new Error('Invalid username or password');
    }

    const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET
    );

    return { token, user: { id: user.id, username: user.username } };
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = { register, login, verifyToken };
