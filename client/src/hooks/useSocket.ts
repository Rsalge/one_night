import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, AuthClientToServerEvents, AuthServerToClientEvents } from '../types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type AuthSocket = Socket<AuthServerToClientEvents, AuthClientToServerEvents>;

// One Night backend runs on port 3000
const SOCKET_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

/**
 * Main game socket - requires authentication token
 */
export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Don't connect without a token
    if (!token) {
      setIsConnected(false);
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
      setIsConnected(true);
      setAuthError(null);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      if (err.message === 'Authentication required' || err.message === 'Invalid token') {
        setAuthError(err.message);
        // Token expired or invalid, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const emit = useCallback(<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => {
    if (socketRef.current) {
      socketRef.current.emit(event, ...args);
    }
  }, []);

  const on = useCallback(<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => {
    if (socketRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socketRef.current.on(event, callback as any);
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socketRef.current?.off(event, callback as any);
    };
  }, []);

  const off = useCallback(<K extends keyof ServerToClientEvents>(
    event: K,
    callback?: ServerToClientEvents[K]
  ) => {
    if (socketRef.current) {
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socketRef.current.off(event, callback as any);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const getSocketId = useCallback(() => {
    return socketRef.current?.id ?? null;
  }, []);

  const reconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current?.connect();
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    authError,
    emit,
    on,
    off,
    getSocketId,
    reconnect,
  };
}

/**
 * Auth socket - for login/register only (no token required)
 */
export function useAuthSocket() {
  const socketRef = useRef<AuthSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(`${SOCKET_URL}/auth`, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      console.log('Auth socket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Auth socket disconnected');
      setIsConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
