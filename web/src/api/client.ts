import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

export default apiClient;
