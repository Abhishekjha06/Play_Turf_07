import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 }, // Ramp up to 20 virtual users
        { duration: '1m', target: 20 },  // Hold at 20 virtual users
        { duration: '10s', target: 0 },  // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
// If hitting Supabase directly, you would configure SUPABASE_URL and KEY in ENV

export default function () {
    // 1. Visit Landing Page
    let res = http.get(`${BASE_URL}/`);
    check(res, {
        'Landing page status is 200': (r) => r.status === 200,
    });
    sleep(1);

    // 2. Visit Turfs Page
    res = http.get(`${BASE_URL}/turfs`);
    check(res, {
        'Turfs page status is 200': (r) => r.status === 200,
    });
    sleep(1);

    // 3. Search for a turf
    res = http.get(`${BASE_URL}/?q=football`);
    check(res, {
        'Search returns 200': (r) => r.status === 200,
    });
    sleep(2);
}
