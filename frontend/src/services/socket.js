import { io } from 'socket.io-client';

let socket = null;

/**
 * Get or initialize active Socket.IO connection
 */
export const getSocket = () => {
  const token = localStorage.getItem('vitalink_token');
  const socketUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

  if (!socket) {
    socket = io(socketUrl, {
      auth: {
        token
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      // Socket connected
    });

    socket.on('connect_error', (err) => {
      console.warn('[VitaLink Socket] Connection error:', err.message);
    });
  } else if (token && socket.auth?.token !== token) {
    // Refresh auth token if changed
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }

  return socket;
};

/**
 * Disconnect socket on logout
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default {
  getSocket,
  disconnectSocket
};
