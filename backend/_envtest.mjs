import 'dotenv/config';
console.log('DATABASE_URL =', process.env.DATABASE_URL);
console.log('JWT_SECRET set?', !!process.env.JWT_SECRET);
console.log('PORT =', process.env.PORT);
