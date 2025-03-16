'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Pixel, AnimatedPixel, User, COLOR_PALETTE } from '../types/pixel';

interface UsePixelSocketProps {
  userId: string;
  nickname?: string;
}

interface UsePixelSocketReturn {
  pixels: Pixel[];
  animatedPixels: AnimatedPixel[];
  users: User[];
  isConnected: boolean;
  initialLoadComplete: boolean;
  updatePixel: (pixel: Pixel) => void;
  registerUser: (nickname: string) => void;
}

export function usePixelSocket({ userId, nickname }: UsePixelSocketProps): UsePixelSocketReturn {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [animatedPixels, setAnimatedPixels] = useState<AnimatedPixel[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const registeredRef = useRef<boolean>(false);
  
  // 소켓 연결 설정
  useEffect(() => {
    if (socketRef.current || isConnectingRef.current) return;
    
    isConnectingRef.current = true;
    
    const connectSocket = () => {
      try {
        console.log('소켓 연결 시도 중...');
        
        fetch('/api/socketio')
          .then(() => {
            console.log('Socket.io 서버 초기화 완료');
            
            const socket = io({
              path: '/api/socketio',
              reconnectionAttempts: 10,
              reconnectionDelay: 3000,
              reconnection: true,
              timeout: 20000,
              transports: ['websocket', 'polling']
            });
            
            socketRef.current = socket;
            
            socket.on('connect', () => {
              console.log('소켓 연결됨:', socket.id);
              setIsConnected(true);
              isConnectingRef.current = false;
              
              // 저장된 닉네임이 있으면 자동 등록
              if (nickname && !registeredRef.current) {
                registerUserWithSocket(socket, userId, nickname);
              }
            });
            
            socket.on('initialPixels', (initialPixels: Pixel[]) => {
              console.log('초기 픽셀 데이터 수신:', initialPixels.length);
              setPixels(initialPixels);
              setInitialLoadComplete(true);
            });
            
            socket.on('usersList', (usersList: User[]) => {
              console.log('사용자 목록 업데이트:', usersList.length);
              setUsers(usersList);
            });
            
            socket.on('pixelUpdated', (updatedPixel: Pixel) => {
              // 픽셀 업데이트
              setPixels(prevPixels => {
                const pixelIndex = prevPixels.findIndex(
                  p => p.x === updatedPixel.x && p.y === updatedPixel.y
                );
                
                if (pixelIndex !== -1) {
                  const newPixels = [...prevPixels];
                  newPixels[pixelIndex] = updatedPixel;
                  return newPixels;
                } else {
                  return [...prevPixels, updatedPixel];
                }
              });
              
              // 다른 사용자가 그린 픽셀이면 애니메이션 추가
              if (updatedPixel.userId !== userId) {
                // 해당 사용자의 닉네임 찾기
                let userNickname = '익명';
                const pixelUser = users.find(u => u.id === updatedPixel.userId);
                if (pixelUser) {
                  userNickname = pixelUser.nickname;
                }
                
                const animPixel: AnimatedPixel = {
                  ...updatedPixel,
                  timestamp: Date.now(),
                  nickname: userNickname
                };
                
                setAnimatedPixels(prev => {
                  // 동일한 위치의 이전 애니메이션 제거
                  const filtered = prev.filter(p => !(p.x === updatedPixel.x && p.y === updatedPixel.y));
                  return [...filtered, animPixel];
                });
                
                // 애니메이션 종료 후 목록에서 제거
                setTimeout(() => {
                  setAnimatedPixels(prev => 
                    prev.filter(p => p !== animPixel)
                  );
                }, 1000);
              }
            });
            
            socket.on('disconnect', () => {
              console.log('소켓 연결 해제됨');
              setIsConnected(false);
              registeredRef.current = false;
            });
            
            socket.io.on('error', (error) => {
              console.error('소켓 IO 오류:', error);
            });
          })
          .catch(err => {
            console.error('소켓 서버 초기화 API 호출 오류:', err);
            isConnectingRef.current = false;
          });
      } catch (error) {
        console.error('소켓 초기화 오류:', error);
        isConnectingRef.current = false;
      }
    };
    
    connectSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      isConnectingRef.current = false;
      registeredRef.current = false;
    };
  }, [userId, nickname]);
  
  // 사용자 등록 함수
  const registerUser = useCallback((newNickname: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('소켓 연결이 되어있지 않아 사용자 등록을 할 수 없습니다.');
      return;
    }
    
    registerUserWithSocket(socketRef.current, userId, newNickname);
  }, [userId, isConnected]);
  
  // 사용자 등록 헬퍼 함수
  const registerUserWithSocket = (socket: Socket, userId: string, nickname: string) => {
    const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    
    socket.emit('registerUser', {
      id: userId,
      nickname: nickname,
      color: randomColor
    });
    
    registeredRef.current = true;
    console.log(`사용자 등록: ${nickname} (${userId})`);
  };
  
  // 픽셀 업데이트 함수
  const updatePixel = useCallback((pixel: Pixel) => {
    const updatedPixel = { ...pixel, userId };
    
    // 낙관적 UI 업데이트
    setPixels(prevPixels => {
      const pixelIndex = prevPixels.findIndex(
        p => p.x === pixel.x && p.y === pixel.y
      );
      
      if (pixelIndex !== -1) {
        const newPixels = [...prevPixels];
        newPixels[pixelIndex] = updatedPixel;
        return newPixels;
      } else {
        return [...prevPixels, updatedPixel];
      }
    });
    
    // 애니메이션 효과 추가
    const animPixel: AnimatedPixel = {
      ...updatedPixel,
      timestamp: Date.now(),
      nickname: nickname || '나'
    };
    
    setAnimatedPixels(prev => {
      // 동일한 위치의 이전 애니메이션 제거
      const filtered = prev.filter(p => !(p.x === pixel.x && p.y === pixel.y));
      return [...filtered, animPixel];
    });
    
    // 애니메이션 종료 후 목록에서 제거
    setTimeout(() => {
      setAnimatedPixels(prev => 
        prev.filter(p => p !== animPixel)
      );
    }, 1000);
    
    // 서버로 업데이트 전송
    if (socketRef.current) {
      socketRef.current.emit('updatePixel', updatedPixel);
    }
  }, [userId, nickname]);
  
  return {
    pixels,
    animatedPixels,
    users,
    isConnected,
    initialLoadComplete,
    updatePixel,
    registerUser
  };
} 