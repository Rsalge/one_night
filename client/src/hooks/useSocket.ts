import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// One Night backend runs on port 3000
const SOCKET_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
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

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
    getSocketId,
  };
}
