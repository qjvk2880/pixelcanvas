import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/db/connection';
import { Pixel } from '../../lib/models/Pixel';
import { User } from '../../lib/models/User';

// Socket.io 타입 정의
export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

// API 요청이 소켓을 위한 것인지 확인
export const config = {
  api: {
    bodyParser: false,
  },
};

// 온라인 사용자 목록 (메모리에 저장)
const onlineUsers = new Map<string, { id: string; nickname: string; color?: string; lastActivity: number }>();

// Socket.io 서버를 설정하지 않았다면 설정
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (res.socket.server.io) {
    console.log('Socket.io 서버가 이미 실행 중입니다.');
    res.end();
    return;
  }

  try {
    console.log('소켓 서버 초기화 중...');

    // MongoDB 연결
    await connectToDatabase();

    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socketio',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      connectTimeout: 45000,
      pingInterval: 30000,
      pingTimeout: 60000,
      transports: ['websocket', 'polling']
    });

    // 소켓 연결 이벤트 처리
    io.on('connection', async (socket) => {
      console.log('클라이언트 연결됨:', socket.id);

      // 초기 픽셀 데이터 로드 및 전송
      const initialPixels = await loadInitialPixels();
      socket.emit('initialPixels', initialPixels);
      
      // 사용자 목록 전송
      socket.emit('usersList', Array.from(onlineUsers.values()));

      // 사용자 등록
      socket.on('registerUser', async (userData: { id: string; nickname: string; color?: string }) => {
        try {
          const { id, nickname, color } = userData;
          
          // 사용자 정보 저장
          onlineUsers.set(socket.id, {
            id,
            nickname,
            color: color || '#000000',
            lastActivity: Date.now()
          });
          
          // 사용자 정보 DB 업데이트
          await User.findOneAndUpdate(
            { userId: id },
            { 
              nickname,
              color,
              lastActivity: new Date(),
              isOnline: true
            },
            { upsert: true, new: true }
          );
          
          // 모든 클라이언트에게 업데이트된 사용자 목록 전송
          io.emit('usersList', Array.from(onlineUsers.values()));
          console.log(`사용자 등록됨: ${nickname} (${id})`);
        } catch (error) {
          console.error('사용자 등록 중 오류:', error);
        }
      });

      // 픽셀 업데이트 이벤트 처리
      socket.on('updatePixel', async (pixel: { x: number; y: number; color: string; userId?: string }) => {
        try {
          // 사용자 활동 시간 업데이트
          if (pixel.userId && onlineUsers.has(socket.id)) {
            const user = onlineUsers.get(socket.id);
            if (user) {
              user.lastActivity = Date.now();
              onlineUsers.set(socket.id, user);
            }
          }
          
          // DB에 업데이트
          await updatePixelInDb(pixel);
          
          // 모든 클라이언트에게 변경 사항 브로드캐스트
          io.emit('pixelUpdated', pixel);
        } catch (error) {
          console.error('픽셀 업데이트 중 오류:', error);
        }
      });

      socket.on('disconnect', async () => {
        console.log('클라이언트 연결 해제됨:', socket.id);
        
        // 사용자 목록에서 제거
        if (onlineUsers.has(socket.id)) {
          const user = onlineUsers.get(socket.id);
          if (user) {
            // DB에서 사용자 상태 업데이트
            await User.findOneAndUpdate(
              { userId: user.id },
              { isOnline: false, lastActivity: new Date() }
            );
            
            // 메모리에서 제거
            onlineUsers.delete(socket.id);
            
            // 업데이트된 사용자 목록 브로드캐스트
            io.emit('usersList', Array.from(onlineUsers.values()));
            console.log(`사용자 오프라인: ${user.nickname}`);
          }
        }
      });

      socket.on('error', (error) => {
        console.error('소켓 오류:', error);
      });
    });

    // 서버 오류 처리
    io.engine.on('connection_error', (err) => {
      console.error('연결 오류:', err);
    });

    // 비활성 사용자 정리 (5분마다)
    setInterval(() => {
      const now = Date.now();
      const inactiveTimeout = 10 * 60 * 1000; // 10분
      
      for (const [socketId, user] of onlineUsers.entries()) {
        if (now - user.lastActivity > inactiveTimeout) {
          console.log(`비활성 사용자 제거: ${user.nickname}`);
          onlineUsers.delete(socketId);
          
          // DB 업데이트
          User.findOneAndUpdate(
            { userId: user.id },
            { isOnline: false, lastActivity: new Date() }
          ).catch(err => console.error('비활성 사용자 DB 업데이트 오류:', err));
        }
      }
      
      // 업데이트된 사용자 목록 브로드캐스트
      io.emit('usersList', Array.from(onlineUsers.values()));
    }, 5 * 60 * 1000); // 5분마다 실행

    res.socket.server.io = io;
    console.log('Socket.io 서버가 성공적으로 시작되었습니다.');
  } catch (error) {
    console.error('Socket.io 서버 초기화 오류:', error);
  }

  res.end();
}

// 초기 픽셀 데이터 로드 - 캐싱 추가
let cachedPixels: any[] | null = null;
const pixelCacheTime = 10000; // 10초 캐시
let lastCacheTime = 0;

const loadInitialPixels = async (): Promise<any[]> => {
  try {
    // 캐시된 데이터가 있고 캐시 시간이 지나지 않았으면 사용
    const now = Date.now();
    if (cachedPixels && now - lastCacheTime < pixelCacheTime) {
      console.log(`캐시된 픽셀 데이터 전송 (${cachedPixels.length}개)`);
      return cachedPixels;
    }

    // 캐시가 없거나 만료된 경우 새로 로드
    const pixels = await Pixel.find({}).lean();
    cachedPixels = pixels;
    lastCacheTime = now;
    console.log(`초기 픽셀 데이터 전송 (${pixels.length}개)`);
    return pixels;
  } catch (error) {
    console.error('초기 픽셀 데이터 로드 오류:', error);
    return [];
  }
};

// 픽셀 업데이트를 DB에 반영하고 캐시 업데이트
const updatePixelInDb = async (pixel: { x: number; y: number; color: string; userId?: string }) => {
  try {
    const { x, y, color, userId } = pixel;
    
    // DB에 업데이트
    const filter = { x, y };
    const update = {
      $set: { 
        color, 
        userId, 
        lastModified: new Date() 
      }
    };
    const options = { upsert: true, new: true };
    
    const updatedPixel = await Pixel.findOneAndUpdate(filter, update, options).lean();
    
    // 캐시 업데이트
    if (cachedPixels) {
      const pixelIndex = cachedPixels.findIndex(p => p.x === x && p.y === y);
      if (pixelIndex !== -1) {
        cachedPixels[pixelIndex] = { x, y, color, userId }; 
      } else {
        cachedPixels.push({ x, y, color, userId });
      }
      lastCacheTime = Date.now();
    }
    
    return updatedPixel;
  } catch (error) {
    console.error('픽셀 업데이트 오류:', error);
    return null;
  }
}; 