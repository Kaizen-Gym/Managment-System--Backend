import csrf from 'csurf';

const isDevelopment = process.env.NODE_ENV !== 'production';

const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'strict'
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req) => {
    return req.headers['x-csrf-token'] || req.cookies['XSRF-TOKEN'];
  }
});

export default csrfProtection;